import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";
import { storage } from "./storage";
import { db, pool } from "./db";
import { sql } from "drizzle-orm";
import bcrypt from "bcrypt";
import { randomUUID, randomBytes } from "crypto";
import {
  signupApiSchema,
  loginFormSchema,
  insertIdeaSchema,
  insertIncidentSchema,
  insertMeetingSchema,
  insertMeetingRegistrationSchema,
  insertLeadSchema,
  superadminLoginSchema,
  insertSubscriptionPlanSchema,
  insertQuoteSchema,
  insertQuoteLineItemSchema,
  insertInvoiceSchema,
  insertInvoiceLineItemSchema,
  insertPaymentSchema,
  insertAssociationSchema,
  insertAssociationUserSchema,
} from "@shared/schema";
import { sendIdeaStatusEmail, sendIncidentStatusEmail, sendMeetingRegistrationEmail, sendWelcomeEmail, sendQuoteEmail, sendInvoiceEmail, sendPasswordResetEmail, sendSignupConfirmationEmail, sendElectedOfficialNotificationEmail, sendEmail, sendRenewalReminderEmail, sendLeadMessageEmail, wrapEmailContent, sendChatMessageToOfficialEmail, sendChatReplyToRequesterEmail } from "./email";
import { generateQuotePdf, generateInvoicePdf, generateMandateOrderPdf, generateMandateInvoicePdf } from "./pdf";
import { getUncachableStripeClient, getStripePublishableKey, getCurrentStripeMode, invalidateStripeSync } from "./stripeClient";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { validateSiret } from "./services/siret-validation";
import { logActivity, isDeviceBlocked, getClientIp, parseUserAgent } from "./activity-tracker";
import type { Tenant } from "@shared/schema";
import cookieParser from "cookie-parser";

// Helper function to check if tenant account is blocked
function isTenantBlocked(tenant: Tenant): { blocked: boolean; reason?: string } {
  // Check if billing status is suspended or cancelled
  if (tenant.billingStatus === "SUSPENDED") {
    return { blocked: true, reason: "Votre compte est suspendu. Veuillez regulariser votre paiement." };
  }
  if (tenant.billingStatus === "CANCELLED") {
    return { blocked: true, reason: "Votre abonnement a ete annule." };
  }
  
  // Check if trial has expired
  if (tenant.billingStatus === "TRIAL" && tenant.trialEndsAt) {
    const now = new Date();
    if (now > new Date(tenant.trialEndsAt)) {
      return { blocked: true, reason: "Votre periode d'essai a expire. Veuillez souscrire a un abonnement." };
    }
  }
  
  return { blocked: false };
}

type AdminMenuCode = "DASHBOARD" | "IDEAS" | "INCIDENTS" | "MEETINGS" | "ASSOCIATIONS" | "ELUS" | "DOMAINS" | "PHOTOS" | "ADMINS" | "SHARE" | "SETTINGS" | "BILLING";

interface AdminAuthResult {
  authenticated: boolean;
  isElectedOfficial: boolean;
  hasMenuAccess: boolean;
  userId?: string;
  electedOfficialId?: string;
  error?: string;
}

async function checkAdminAuth(
  req: Express.Request,
  tenantId: string,
  requiredMenuCode?: AdminMenuCode
): Promise<AdminAuthResult> {
  const session = req.session as any;
  
  if (session.userId && session.tenantId === tenantId) {
    return {
      authenticated: true,
      isElectedOfficial: false,
      hasMenuAccess: true,
      userId: session.userId,
    };
  }
  
  if (session.electedOfficialId && session.tenantId === tenantId) {
    if (!requiredMenuCode) {
      return {
        authenticated: true,
        isElectedOfficial: true,
        hasMenuAccess: true,
        electedOfficialId: session.electedOfficialId,
      };
    }
    
    const electedOfficial = await storage.getElectedOfficialById(session.electedOfficialId);
    if (!electedOfficial || electedOfficial.tenantId !== tenantId) {
      return { authenticated: false, isElectedOfficial: true, hasMenuAccess: false, error: "Not authenticated" };
    }
    
    if (electedOfficial.hasFullAccess) {
      return {
        authenticated: true,
        isElectedOfficial: true,
        hasMenuAccess: true,
        electedOfficialId: session.electedOfficialId,
      };
    }
    
    const permissions = await storage.getElectedOfficialMenuPermissions(session.electedOfficialId);
    const hasAccess = permissions.includes(requiredMenuCode);
    
    return {
      authenticated: true,
      isElectedOfficial: true,
      hasMenuAccess: hasAccess,
      electedOfficialId: session.electedOfficialId,
      error: hasAccess ? undefined : "Permission denied",
    };
  }
  
  return { authenticated: false, isElectedOfficial: false, hasMenuAccess: false, error: "Not authenticated" };
}

// Helper function to create mandate order from accepted quote
// tenantIdOverride is used when converting a lead (quote has no tenantId yet)
async function createMandateOrderFromQuote(quoteId: string, tenantIdOverride?: string): Promise<void> {
  try {
    // Get the quote with line items
    const quote = await storage.getQuoteById(quoteId);
    if (!quote || quote.paymentMethod !== "ADMINISTRATIVE_MANDATE") {
      return;
    }
    
    // Use override tenantId if provided (for lead conversion), otherwise use quote's tenantId
    const effectiveTenantId = tenantIdOverride || quote.tenantId;
    
    // For lead conversion, tenantId is required; for existing tenant quotes it's optional
    if (!effectiveTenantId && tenantIdOverride !== undefined) {
      console.error(`Cannot create mandate order: no tenantId available for quote ${quoteId}`);
      return;
    }
    
    // Check if mandate order already exists for this quote (optimized query)
    const existing = await storage.getMandateOrderByQuoteId(quoteId);
    if (existing) {
      console.log(`Mandate order already exists for quote ${quoteId}`);
      return;
    }
    
    // Get quote line items
    const lineItems = await storage.getQuoteLineItems(quoteId);
    if (lineItems.length === 0) {
      console.log(`No line items found for quote ${quoteId}`);
      return;
    }
    
    // Find the plan line item (has planId set)
    const planItem = lineItems.find(item => item.planId !== null);
    if (!planItem || !planItem.planId) {
      console.log(`No plan found in quote ${quoteId} line items`);
      return;
    }
    
    // Calculate amounts from quote line items (use total to account for quantity)
    const planAmount = planItem.total || 0;
    let addonsAmount = 0;
    const addonsSnapshot: { id: string; code: string; name: string; quantity: number; unitPrice: number; totalPrice: number }[] = [];
    
    for (const item of lineItems) {
      // Addon items have addonId set
      if (item.addonId) {
        const addon = await storage.getAddonById(item.addonId);
        // Use addon name directly, not line item description (which may already contain quantity)
        addonsSnapshot.push({
          id: item.addonId,
          code: addon?.code || "ADDON",
          name: addon?.name || "Addon",
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice || 0,
          totalPrice: item.total || 0
        });
        addonsAmount += item.total || 0;
      }
    }
    
    const annualAmount = planAmount + addonsAmount;
    // Calculate discount from difference between line items total and quote total
    const discountAmount = Math.max(0, annualAmount - quote.total);
    const finalAmount = quote.total;
    
    // Generate order number
    const orderNumber = await storage.generateOrderNumber();
    
    // Create mandate order
    const mandateOrder = await storage.createMandateOrder({
      orderNumber,
      quoteId: quote.id,
      tenantId: effectiveTenantId || null,
      planId: planItem.planId,
      status: "PENDING_VALIDATION",
      billingCycle: "YEARLY",
      planAmount,
      addonsAmount,
      addonsSnapshot: addonsSnapshot.length > 0 ? JSON.stringify(addonsSnapshot) : null,
      annualAmount,
      discountAmount,
      finalAmount,
      clientName: quote.clientName || "",
      clientSiret: quote.prospectMandateSiret || "",
      clientAddress: quote.prospectMandateBillingAddress || quote.clientAddress || null,
      billingService: quote.prospectMandateBillingService || null,
      accountingContactName: null,
      accountingContactEmail: quote.clientEmail || null,
      accountingContactPhone: null,
      purchaseOrderNumber: null,
      engagementNumber: null,
      serviceCode: null,
      useChorusPro: quote.prospectMandateUseChorusPro || false,
      chorusProRecipientSiret: null,
      chorusProServiceCode: null,
    });
    
    // Log the order creation
    if (effectiveTenantId) {
      await storage.createMandateActivity({
        tenantId: effectiveTenantId,
        orderId: mandateOrder.id,
        activityType: "ORDER_CREATED",
        title: "Commande créée depuis devis",
        description: `Commande ${orderNumber} créée automatiquement depuis le devis ${quote.quoteNumber}`,
        performedByType: "system",
      });
    }
    
    console.log(`Created mandate order ${orderNumber} from quote ${quote.quoteNumber}`);
  } catch (error) {
    console.error("Error creating mandate order from quote:", error);
  }
}

declare module "express-session" {
  interface SessionData {
    userId?: string;
    tenantId?: string;
    superadminId?: string;
    associationUserId?: string;
    associationId?: string;
    electedOfficialId?: string;
  }
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<void> {
  // Trust proxy for secure cookies behind Replit's load balancer
  if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }

  const PgStore = connectPgSimple(session);
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  });

  app.use(
    session({
      store: new PgStore({
        pool,
        tableName: "session",
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET || "voxpopulous-secret-key-change-in-production",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      },
    })
  );

  // Cookie parser for device tracking
  app.use(cookieParser());

  // Health check endpoint for Docker/Scaleway
  app.get("/api/health", (req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Helper function to get or create device ID and set cookie
  const getOrCreateDeviceId = (req: any, res: any): string => {
    let deviceId = req.cookies?.vp_device_id;
    if (!deviceId) {
      deviceId = randomUUID();
      res.cookie("vp_device_id", deviceId, {
        maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
        httpOnly: false, // Readable by client for tracking
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      });
    }
    return deviceId;
  };

  // Middleware to check device block status on authenticated requests only
  const deviceBlockMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    // Only apply to authenticated sessions - check if any auth session exists
    const hasAuthSession = !!(
      req.session?.superadminId ||
      req.session?.userId ||
      req.session?.tenantId ||
      req.session?.electedOfficialId ||
      req.session?.associationUserId
    );
    
    if (!hasAuthSession) {
      return next();
    }
    
    // Get or create device ID for authenticated requests - always enforce device ID
    const deviceId = getOrCreateDeviceId(req, res);
    
    // Check if device ID stored in session matches cookie (prevents cookie clearing bypass)
    const sessionDeviceId = (req.session as any).deviceId;
    if (sessionDeviceId && sessionDeviceId !== deviceId) {
      // Cookie was cleared and regenerated - use session's device ID for blocking check
      const blockStatus = await isDeviceBlocked(sessionDeviceId);
      if (blockStatus.blocked) {
        req.session.destroy((err) => {
          if (err) console.error("Session destroy error:", err);
        });
        return res.status(403).json({ 
          error: blockStatus.reason || "Appareil bloque",
          deviceBlocked: true
        });
      }
    }
    
    // Check current device ID
    const blockStatus = await isDeviceBlocked(deviceId);
    if (blockStatus.blocked) {
      // Clear session to log out the blocked device
      req.session.destroy((err) => {
        if (err) console.error("Session destroy error:", err);
      });
      return res.status(403).json({ 
        error: blockStatus.reason || "Appareil bloque",
        deviceBlocked: true
      });
    }
    
    // Store device ID in session for future validation
    if (!sessionDeviceId) {
      (req.session as any).deviceId = deviceId;
    }
    
    next();
  };
  
  // Apply device block middleware to all routes
  app.use(deviceBlockMiddleware);

  // Device tracking endpoint - generates/returns device ID and checks if device is blocked
  app.get("/api/device/status", async (req, res) => {
    try {
      const deviceId = getOrCreateDeviceId(req, res);
      const blockStatus = await isDeviceBlocked(deviceId);
      res.json({ deviceId, blocked: blockStatus.blocked, reason: blockStatus.reason });
    } catch (error) {
      console.error("Device status error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.post("/api/objects/upload", async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error: any) {
      console.error("Upload URL error:", error);
      res.status(500).json({ error: error.message || "Failed to get upload URL" });
    }
  });

  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // ==========================================
  // SUPERADMIN ROUTES
  // ==========================================

  app.post("/api/superadmin/login", async (req, res) => {
    try {
      const parsed = superadminLoginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Donnees invalides" });
      }

      const { email, password } = parsed.data;
      
      // Get or create device ID and check blocking
      const deviceId = getOrCreateDeviceId(req, res);
      const blockStatus = await isDeviceBlocked(deviceId);
      if (blockStatus.blocked) {
        return res.status(403).json({ error: blockStatus.reason || "Appareil bloque", deviceBlocked: true });
      }
      
      const superadmin = await storage.getSuperadminByEmail(email);
      if (!superadmin) {
        return res.status(401).json({ error: "Email ou mot de passe incorrect" });
      }

      const passwordMatch = await bcrypt.compare(password, superadmin.passwordHash);
      if (!passwordMatch) {
        return res.status(401).json({ error: "Email ou mot de passe incorrect" });
      }

      req.session.superadminId = superadmin.id;
      await storage.updateSuperadminLastLogin(superadmin.id);
      
      // Log activity
      await logActivity({
        req,
        deviceId,
        activityType: "LOGIN",
        superadminId: superadmin.id,
        superadminEmail: superadmin.email,
        actionDetails: "Connexion superadmin"
      });

      const { passwordHash, ...safeAdmin } = superadmin;
      res.json({ superadmin: safeAdmin });
    } catch (error) {
      console.error("Superadmin login error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.post("/api/superadmin/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  app.get("/api/superadmin/me", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }

    const superadmin = await storage.getSuperadminById(req.session.superadminId);
    if (!superadmin) {
      return res.status(401).json({ error: "Superadmin non trouve" });
    }

    const { passwordHash, ...safeAdmin } = superadmin;
    res.json({ superadmin: safeAdmin });
  });

  // Superadmin settings (theme)
  app.get("/api/superadmin/settings/theme", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const settings = await storage.getSuperadminSettings();
      res.json({ themeKey: settings?.themeKey || "blue" });
    } catch (error) {
      console.error("Get theme error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.put("/api/superadmin/settings/theme", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const { themeKey } = req.body;
      if (!themeKey) {
        return res.status(400).json({ error: "Theme requis" });
      }
      const settings = await storage.updateSuperadminSettings(themeKey);
      res.json(settings);
    } catch (error) {
      console.error("Update theme error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.get("/api/superadmin/settings/stripe-mode", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const mode = await getCurrentStripeMode();
      res.json({ stripeMode: mode });
    } catch (error) {
      console.error("Get stripe mode error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.put("/api/superadmin/settings/stripe-mode", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const { stripeMode } = req.body;
      if (!stripeMode || !['test', 'live'].includes(stripeMode)) {
        return res.status(400).json({ error: "Mode Stripe invalide (test ou live)" });
      }
      const settings = await storage.updateStripeMode(stripeMode);
      invalidateStripeSync();
      res.json({ stripeMode: settings.stripeMode });
    } catch (error) {
      console.error("Update stripe mode error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.get("/api/superadmin/settings/company", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const settings = await storage.getCompanySettings();
      res.json(settings || {});
    } catch (error) {
      console.error("Get company settings error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.put("/api/superadmin/settings/company", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const { 
        companyName, formeJuridique, capitalSocial, address, siret, siren, 
        rcsVille, rcsNumero, tvaNumber, email, phone, website, iban, bic, 
        directeurNom, directeurFonction, dpoEmail, dpoAdresse, mediateur,
        tribunalCompetent, hebergeurNom, hebergeurAdresse, paymentTerms, legalMentions 
      } = req.body;
      const settings = await storage.updateCompanySettings({
        companyName,
        formeJuridique,
        capitalSocial,
        address,
        siret,
        siren,
        rcsVille,
        rcsNumero,
        tvaNumber,
        email,
        phone,
        website,
        iban,
        bic,
        directeurNom,
        directeurFonction,
        dpoEmail,
        dpoAdresse,
        mediateur,
        tribunalCompetent,
        hebergeurNom,
        hebergeurAdresse,
        paymentTerms,
        legalMentions,
      });
      res.json(settings);
    } catch (error) {
      console.error("Update company settings error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Sync emitter info across all quotes and invoices
  app.post("/api/superadmin/settings/company/sync-documents", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const companySettings = await storage.getCompanySettings();
      if (!companySettings?.companyName) {
        return res.status(400).json({ error: "Veuillez d'abord configurer les informations de la societe" });
      }

      const emitterInfo = {
        emitterName: companySettings.companyName,
        emitterAddress: companySettings.address || null,
        emitterSiret: companySettings.siret || null,
        emitterTva: companySettings.tvaNumber || null,
      };

      const quotesUpdated = await storage.updateAllQuotesEmitterInfo(emitterInfo);
      const invoicesUpdated = await storage.updateAllInvoicesEmitterInfo(emitterInfo);

      res.json({
        success: true,
        quotesUpdated,
        invoicesUpdated,
        message: `${quotesUpdated} devis et ${invoicesUpdated} factures mis a jour`,
      });
    } catch (error) {
      console.error("Sync documents error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ==========================================
  // LEGAL ENTITY SETTINGS (for legal pages)
  // ==========================================

  app.get("/api/superadmin/settings/legal", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const settings = await storage.getLegalEntitySettings();
      res.json(settings || {});
    } catch (error) {
      console.error("Get legal settings error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.put("/api/superadmin/settings/legal", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const settings = await storage.updateLegalEntitySettings(req.body);
      res.json(settings);
    } catch (error) {
      console.error("Update legal settings error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Public endpoint to get current Stripe mode (test or live)
  app.get("/api/public/stripe-mode", async (req, res) => {
    try {
      const mode = await getCurrentStripeMode();
      res.json({ stripeMode: mode });
    } catch (error) {
      console.error("Get stripe mode error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Public endpoint for legal pages (no auth required) - uses unified company settings
  app.get("/api/public/legal-settings", async (req, res) => {
    try {
      const settings = await storage.getCompanySettings();
      if (!settings) {
        return res.json({});
      }
      // Map company settings to legal page format for backward compatibility
      res.json({
        raisonSociale: settings.companyName,
        formeJuridique: settings.formeJuridique,
        capitalSocial: settings.capitalSocial,
        siret: settings.siret,
        rcsVille: settings.rcsVille,
        rcsNumero: settings.rcsNumero,
        tvaIntracommunautaire: settings.tvaNumber,
        siegeAdresse: settings.address,
        directeurNom: settings.directeurNom,
        directeurFonction: settings.directeurFonction,
        contactEmail: settings.email,
        contactPhone: settings.phone,
        dpoEmail: settings.dpoEmail,
        dpoAdresse: settings.dpoAdresse,
        mediateur: settings.mediateur,
        tribunalCompetent: settings.tribunalCompetent,
        hebergeurNom: settings.hebergeurNom,
        hebergeurAdresse: settings.hebergeurAdresse,
      });
    } catch (error) {
      console.error("Get public legal settings error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ==========================================
  // CHORUS PRO CONFIGURATION - DOCUMENT NUMBER FORMATS
  // ==========================================

  app.get("/api/superadmin/settings/document-formats", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const { documentType } = req.query;
      const formats = documentType 
        ? await storage.getDocumentNumberFormats(documentType as string)
        : await storage.getAllDocumentNumberFormats();
      res.json(formats);
    } catch (error) {
      console.error("Get document formats error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.post("/api/superadmin/settings/document-formats", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const { code, name, description, documentType, pattern, prefix, separator, yearFormat, sequenceDigits, includeMonth, example, isDefault, displayOrder } = req.body;
      if (!code || !name || !documentType || !pattern) {
        return res.status(400).json({ error: "Code, nom, type de document et pattern requis" });
      }
      const format = await storage.createDocumentNumberFormat({
        code, name, description, documentType, pattern, prefix, separator, yearFormat, sequenceDigits, includeMonth, example, isDefault, displayOrder
      });
      res.json(format);
    } catch (error) {
      console.error("Create document format error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.put("/api/superadmin/settings/document-formats/:id", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const format = await storage.updateDocumentNumberFormat(req.params.id, req.body);
      if (!format) {
        return res.status(404).json({ error: "Format non trouve" });
      }
      res.json(format);
    } catch (error) {
      console.error("Update document format error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.delete("/api/superadmin/settings/document-formats/:id", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      await storage.deleteDocumentNumberFormat(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete document format error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ==========================================
  // CHORUS PRO CONFIGURATION - SERVICE CODES
  // ==========================================

  app.get("/api/superadmin/settings/service-codes", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const codes = await storage.getAllServiceCodes();
      res.json(codes);
    } catch (error) {
      console.error("Get service codes error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.post("/api/superadmin/settings/service-codes", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const { code, name, description, isDefault, displayOrder } = req.body;
      if (!code || !name) {
        return res.status(400).json({ error: "Code et nom requis" });
      }
      const serviceCode = await storage.createServiceCode({
        code, name, description, isDefault, displayOrder
      });
      res.json(serviceCode);
    } catch (error) {
      console.error("Create service code error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.put("/api/superadmin/settings/service-codes/:id", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const serviceCode = await storage.updateServiceCode(req.params.id, req.body);
      if (!serviceCode) {
        return res.status(404).json({ error: "Code service non trouve" });
      }
      res.json(serviceCode);
    } catch (error) {
      console.error("Update service code error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.delete("/api/superadmin/settings/service-codes/:id", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      await storage.deleteServiceCode(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete service code error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Public API for document formats and service codes (for signup)
  app.get("/api/public/document-formats", async (req, res) => {
    try {
      const { documentType } = req.query;
      const formats = await storage.getDocumentNumberFormats(documentType as string);
      res.json(formats);
    } catch (error) {
      console.error("Get public document formats error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.get("/api/public/service-codes", async (req, res) => {
    try {
      const codes = await storage.getServiceCodes();
      res.json(codes);
    } catch (error) {
      console.error("Get public service codes error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ==========================================
  // ELU FUNCTIONS MANAGEMENT (for mairies/EPCI)
  // ==========================================
  app.get("/api/superadmin/settings/elu-functions", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const functions = await storage.getAllEluFunctions();
      res.json(functions);
    } catch (error) {
      console.error("Get elu functions error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.post("/api/superadmin/settings/elu-functions", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const { label, isDefault, isActive, displayOrder } = req.body;
      if (!label) {
        return res.status(400).json({ error: "Libelle requis" });
      }
      const fn = await storage.createEluFunction({ label, isDefault, isActive, displayOrder });
      res.json(fn);
    } catch (error) {
      console.error("Create elu function error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.put("/api/superadmin/settings/elu-functions/:id", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const fn = await storage.updateEluFunction(req.params.id, req.body);
      if (!fn) {
        return res.status(404).json({ error: "Fonction non trouvee" });
      }
      res.json(fn);
    } catch (error) {
      console.error("Update elu function error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.delete("/api/superadmin/settings/elu-functions/:id", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      await storage.deleteEluFunction(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete elu function error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ==========================================
  // BUREAU MEMBER FUNCTIONS MANAGEMENT (for associations)
  // ==========================================
  app.get("/api/superadmin/settings/bureau-functions", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const functions = await storage.getAllBureauMemberFunctions();
      res.json(functions);
    } catch (error) {
      console.error("Get bureau functions error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.post("/api/superadmin/settings/bureau-functions", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const { label, isDefault, isActive, displayOrder } = req.body;
      if (!label) {
        return res.status(400).json({ error: "Libelle requis" });
      }
      const fn = await storage.createBureauMemberFunction({ label, isDefault, isActive, displayOrder });
      res.json(fn);
    } catch (error) {
      console.error("Create bureau function error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.put("/api/superadmin/settings/bureau-functions/:id", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const fn = await storage.updateBureauMemberFunction(req.params.id, req.body);
      if (!fn) {
        return res.status(404).json({ error: "Fonction non trouvee" });
      }
      res.json(fn);
    } catch (error) {
      console.error("Update bureau function error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.delete("/api/superadmin/settings/bureau-functions/:id", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      await storage.deleteBureauMemberFunction(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete bureau function error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Public endpoints for functions (for tenant admin pages)
  app.get("/api/public/elu-functions", async (req, res) => {
    try {
      const functions = await storage.getEluFunctions();
      res.json(functions);
    } catch (error) {
      console.error("Get public elu functions error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.get("/api/public/bureau-functions", async (req, res) => {
    try {
      const functions = await storage.getBureauMemberFunctions();
      res.json(functions);
    } catch (error) {
      console.error("Get public bureau functions error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Superadmin accounts management
  app.get("/api/superadmin/admins", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const admins = await storage.getAllSuperadmins();
      const safeAdmins = admins.map(({ passwordHash, ...admin }) => admin);
      res.json(safeAdmins);
    } catch (error) {
      console.error("Get admins error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.post("/api/superadmin/admins", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const { email, name, password } = req.body;
      if (!email || !name || !password) {
        return res.status(400).json({ error: "Email, nom et mot de passe requis" });
      }
      const existing = await storage.getSuperadminByEmail(email);
      if (existing) {
        return res.status(400).json({ error: "Cet email est deja utilise" });
      }
      const passwordHash = await bcrypt.hash(password, 10);
      const admin = await storage.createSuperadmin({ email, name, passwordHash });
      const { passwordHash: _, ...safeAdmin } = admin;
      res.json(safeAdmin);
    } catch (error) {
      console.error("Create admin error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.patch("/api/superadmin/admins/:id", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const { email, name, password, isActive } = req.body;
      const updateData: { email?: string; name?: string; passwordHash?: string; isActive?: boolean } = {};
      if (email) updateData.email = email;
      if (name) updateData.name = name;
      if (password) updateData.passwordHash = await bcrypt.hash(password, 10);
      if (typeof isActive === 'boolean') updateData.isActive = isActive;
      
      const admin = await storage.updateSuperadmin(req.params.id, updateData);
      if (!admin) {
        return res.status(404).json({ error: "Admin non trouve" });
      }
      const { passwordHash: _, ...safeAdmin } = admin;
      res.json(safeAdmin);
    } catch (error) {
      console.error("Update admin error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.delete("/api/superadmin/admins/:id", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      if (req.params.id === req.session.superadminId) {
        return res.status(400).json({ error: "Vous ne pouvez pas supprimer votre propre compte" });
      }
      const deleted = await storage.deleteSuperadmin(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Admin non trouve" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Delete admin error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.get("/api/superadmin/stats", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }

    try {
      const stats = await storage.getGlobalStats();
      res.json(stats);
    } catch (error) {
      console.error("Stats error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.get("/api/superadmin/tenants", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }

    try {
      const tenants = await storage.getAllTenants();
      const allAssociations = await storage.getAllAssociations();
      res.json({ tenants, associations: allAssociations });
    } catch (error) {
      console.error("Tenants list error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.get("/api/superadmin/tenants/:id/details", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }

    try {
      const tenant = await storage.getTenantById(req.params.id);
      if (!tenant) {
        return res.status(404).json({ error: "Client non trouve" });
      }

      const admins = await storage.getUsersByTenantId(tenant.id);
      const associationsQuota = await storage.getTenantAssociationQuota(tenant.id);
      const adminsQuota = await storage.getTenantAdminQuota(tenant.id);
      
      let plan = null;
      let catalogFeatures: any[] = [];
      if (tenant.subscriptionPlanId) {
        plan = await storage.getSubscriptionPlanById(tenant.subscriptionPlanId);
        if (plan) {
          catalogFeatures = await storage.getPlanFeatureAssignments(plan.id);
        }
      } else if (tenant.subscriptionPlan) {
        plan = await storage.getSubscriptionPlanByCode(tenant.subscriptionPlan);
        if (plan) {
          catalogFeatures = await storage.getPlanFeatureAssignments(plan.id);
        }
      }
      
      // If no plan found, try to get it from mandate subscription/order
      if (!plan) {
        const mandateSubscription = await storage.getMandateSubscriptionByTenant(tenant.id);
        if (mandateSubscription?.planId) {
          plan = await storage.getSubscriptionPlanById(mandateSubscription.planId);
          if (plan) {
            catalogFeatures = await storage.getPlanFeatureAssignments(plan.id);
          }
        } else {
          // Try from latest mandate order
          const mandateOrders = await storage.getMandateOrdersByTenant(tenant.id);
          const latestOrder = mandateOrders
            .filter(o => o.planId && (o.status === "ACCEPTED" || o.status === "INVOICED"))
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
          if (latestOrder?.planId) {
            plan = await storage.getSubscriptionPlanById(latestOrder.planId);
            if (plan) {
              catalogFeatures = await storage.getPlanFeatureAssignments(plan.id);
            }
          }
        }
      }

      // Communes quota for EPCI tenants
      let communesQuota = { used: 0, allowed: 0, remaining: 0 };
      if (tenant.tenantType === "EPCI") {
        const communes = await storage.getCommunesByEpciId(tenant.id);
        const planIncluded = plan?.communesIncluded || 0;
        const purchased = tenant.purchasedCommunes || 0;
        const allowed = planIncluded + purchased;
        communesQuota = { used: communes.length, allowed, remaining: Math.max(0, allowed - communes.length) };
      }

      res.json({
        tenant,
        admins: admins.map(a => ({
          id: a.id,
          name: a.name,
          email: a.email,
          role: a.role,
          createdAt: a.createdAt,
        })),
        plan: plan ? { ...plan, catalogFeatures } : null,
        quotas: {
          associations: associationsQuota,
          admins: adminsQuota,
          communes: communesQuota,
        },
      });
    } catch (error) {
      console.error("Tenant details error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Update tenant quantities (purchasedCommunes, purchasedAssociations, purchasedAdmins)
  app.put("/api/superadmin/tenants/:id/quantities", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }

    try {
      const tenant = await storage.getTenantById(req.params.id);
      if (!tenant) {
        return res.status(404).json({ error: "Client non trouve" });
      }

      const { purchasedCommunes, purchasedAssociations, purchasedAdmins } = req.body;

      // Validate inputs
      if (purchasedCommunes !== undefined && (typeof purchasedCommunes !== "number" || purchasedCommunes < 0)) {
        return res.status(400).json({ error: "purchasedCommunes doit etre un nombre positif" });
      }
      if (purchasedAssociations !== undefined && (typeof purchasedAssociations !== "number" || purchasedAssociations < 0)) {
        return res.status(400).json({ error: "purchasedAssociations doit etre un nombre positif" });
      }
      if (purchasedAdmins !== undefined && (typeof purchasedAdmins !== "number" || purchasedAdmins < 0)) {
        return res.status(400).json({ error: "purchasedAdmins doit etre un nombre positif" });
      }

      const updated = await storage.updateTenantQuantities(req.params.id, {
        purchasedCommunes: purchasedCommunes ?? tenant.purchasedCommunes,
        purchasedAssociations: purchasedAssociations ?? tenant.purchasedAssociations,
        purchasedAdmins: purchasedAdmins ?? tenant.purchasedAdmins,
      });

      res.json(updated);
    } catch (error) {
      console.error("Update tenant quantities error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Superadmin: Send password reset link to a specific admin
  app.post("/api/superadmin/tenants/:tenantId/admins/:adminId/send-reset-link", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }

    try {
      const { tenantId, adminId } = req.params;
      
      const tenant = await storage.getTenantById(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: "Client non trouve" });
      }

      const admin = await storage.getUserById(adminId);
      if (!admin || admin.tenantId !== tenantId) {
        return res.status(404).json({ error: "Administrateur non trouve" });
      }

      // Create password reset token
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await storage.createPasswordResetToken({
        token,
        type: "ADMIN",
        userId: admin.id,
        electedOfficialId: undefined,
        email: admin.email.toLowerCase(),
        tenantId: tenant.id,
        expiresAt
      });

      // Build reset URL
      const baseUrl = 'https://voxpopulous.fr';
      const resetUrl = `${baseUrl}/structures/${tenant.slug}/admin/reset-password?token=${token}`;

      // Send email
      const emailContent = `
        <h2 style="color: #1e293b; margin: 0 0 24px 0; font-size: 24px;">Reinitialisation de votre mot de passe</h2>
        <p style="color: #475569; line-height: 1.6; margin: 0 0 16px 0;">Bonjour ${admin.name || admin.email},</p>
        <p style="color: #475569; line-height: 1.6; margin: 0 0 16px 0;">
          L'administrateur de la plateforme VoxPopulous a demande la reinitialisation de votre mot de passe pour acceder a l'espace d'administration de <strong style="color: #1e293b;">${tenant.name}</strong>.
        </p>
        <p style="color: #475569; line-height: 1.6; margin: 0 0 24px 0;">Cliquez sur le bouton ci-dessous pour creer un nouveau mot de passe :</p>
        <p style="text-align: center; margin: 0 0 24px 0;">
          <a href="${resetUrl}" style="display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 500;">
            Reinitialiser mon mot de passe
          </a>
        </p>
        <p style="color: #64748b; font-size: 14px; margin: 0 0 8px 0;">Ce lien est valable pendant 1 heure.</p>
        <p style="color: #64748b; font-size: 14px; margin: 0;">Si vous n'avez pas demande cette reinitialisation, vous pouvez ignorer cet email.</p>
      `;
      
      await sendEmail({
        to: admin.email.toLowerCase(),
        subject: "Reinitialisation de votre mot de passe - VoxPopulous",
        html: wrapEmailContent(emailContent),
      });

      res.json({ success: true, message: "Lien de reinitialisation envoye" });
    } catch (error) {
      console.error("Password reset link error:", error);
      res.status(500).json({ error: "Impossible d'envoyer l'email" });
    }
  });

  // Impersonation endpoint - allows superadmin to login as a tenant admin
  app.post("/api/superadmin/tenants/:tenantId/impersonate/:adminId", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }

    try {
      const { tenantId, adminId } = req.params;
      
      const tenant = await storage.getTenantById(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: "Client non trouve" });
      }

      const admin = await storage.getUserById(adminId);
      if (!admin || admin.tenantId !== tenantId) {
        return res.status(404).json({ error: "Administrateur non trouve" });
      }

      // Set the session to impersonate the tenant admin
      req.session.userId = admin.id;
      req.session.tenantId = tenant.id;
      // Keep superadminId so we know it's an impersonation session
      
      res.json({ 
        success: true, 
        redirectUrl: `/structures/${tenant.slug}/admin`,
        impersonating: {
          tenantName: tenant.name,
          adminName: admin.name,
          adminEmail: admin.email,
        }
      });
    } catch (error) {
      console.error("Impersonation error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Superadmin: Send password reset link to tenant's primary admin
  app.post("/api/superadmin/tenants/:id/send-reset-link", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }

    try {
      const tenant = await storage.getTenantById(req.params.id);
      if (!tenant) {
        return res.status(404).json({ error: "Client non trouve" });
      }

      // Get the primary admin (first admin created for this tenant)
      const admins = await storage.getUsersByTenantId(tenant.id);
      if (admins.length === 0) {
        return res.status(404).json({ error: "Aucun administrateur trouve pour ce client" });
      }

      // Get the primary admin (first one by creation date)
      const primaryAdmin = admins.sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )[0];

      // Create password reset token
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await storage.createPasswordResetToken({
        token,
        type: "ADMIN",
        userId: primaryAdmin.id,
        electedOfficialId: undefined,
        email: primaryAdmin.email.toLowerCase(),
        tenantId: tenant.id,
        expiresAt
      });

      // Build reset URL - always use the custom production domain
      const baseUrl = 'https://voxpopulous.fr';
      const resetUrl = `${baseUrl}/structures/${tenant.slug}/admin/reset-password?token=${token}`;

      // Send email
      const emailContent = `
        <h2 style="color: #1e293b; margin: 0 0 24px 0; font-size: 24px;">Reinitialisation de votre mot de passe</h2>
        <p style="color: #475569; line-height: 1.6; margin: 0 0 16px 0;">Bonjour ${primaryAdmin.name || primaryAdmin.email},</p>
        <p style="color: #475569; line-height: 1.6; margin: 0 0 16px 0;">
          L'administrateur de la plateforme VoxPopulous a demande la reinitialisation de votre mot de passe pour acceder a l'espace d'administration de <strong style="color: #1e293b;">${tenant.name}</strong>.
        </p>
        <p style="color: #475569; line-height: 1.6; margin: 0 0 24px 0;">Cliquez sur le bouton ci-dessous pour creer un nouveau mot de passe :</p>
        <p style="text-align: center; margin: 0 0 24px 0;">
          <a href="${resetUrl}" style="display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 500;">
            Reinitialiser mon mot de passe
          </a>
        </p>
        <p style="color: #64748b; font-size: 14px; margin: 0 0 8px 0;">Ce lien est valable pendant 1 heure.</p>
        <p style="color: #64748b; font-size: 14px; margin: 0;">Si vous n'avez pas demande cette reinitialisation, vous pouvez contacter le support.</p>
      `;
      await sendEmail({
        to: primaryAdmin.email.toLowerCase(),
        subject: "Reinitialisation de votre mot de passe - VoxPopulous",
        html: wrapEmailContent(emailContent, { title: 'Reinitialisation de mot de passe' })
      });

      res.json({ 
        success: true, 
        adminEmail: primaryAdmin.email,
        adminName: primaryAdmin.name 
      });
    } catch (error) {
      console.error("Send reset link error:", error);
      res.status(500).json({ error: "Erreur lors de l'envoi de l'email" });
    }
  });

  app.get("/api/superadmin/leads", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }

    try {
      const leads = await storage.getAllLeads();
      res.json(leads);
    } catch (error) {
      console.error("Leads list error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.patch("/api/superadmin/leads/:id/status", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }

    try {
      const { status } = req.body;
      if (!["NEW", "CONTACTED", "CONVERTED", "IGNORED"].includes(status)) {
        return res.status(400).json({ error: "Statut invalide" });
      }

      const updated = await storage.updateLeadStatus(req.params.id, status);
      if (!updated) {
        return res.status(404).json({ error: "Lead non trouve" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Lead status update error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.post("/api/superadmin/leads/:id/convert", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }

    try {
      const { subscriptionPlanId, billingInterval, tenantType } = req.body;
      
      const lead = await storage.getLeadById(req.params.id);
      if (!lead) {
        return res.status(404).json({ error: "Prospect non trouve" });
      }

      if (lead.status === "CONVERTED") {
        return res.status(400).json({ error: "Ce prospect a deja ete converti" });
      }

      const existingUser = await storage.getUserByEmail(lead.email);
      if (existingUser) {
        return res.status(400).json({ error: "Un compte existe deja avec cet email" });
      }

      const generateSlug = (name: string): string => {
        return name
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .substring(0, 50);
      };

      const generatePassword = (): string => {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
        let password = "";
        for (let i = 0; i < 12; i++) {
          password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
      };

      let baseSlug = generateSlug(lead.organisationName);
      let slug = baseSlug;
      let counter = 1;
      while (await storage.getTenantBySlug(slug)) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 30);

      // Find accepted quote for this lead to extract addon quantities and payment method
      const leadQuotes = await storage.getQuotesByLeadId(lead.id);
      const acceptedQuote = leadQuotes.find(q => q.status === "ACCEPTED");
      
      // Extract addon quantities from quote line items
      let purchasedAssociations = 0;
      let purchasedAdmins = 0;
      let purchasedCommunes = 0;
      
      if (acceptedQuote) {
        const lineItems = await storage.getQuoteLineItems(acceptedQuote.id);
        // Preload all addons to avoid N+1 queries
        const allAddons = await storage.getAllAddons();
        const addonMap = new Map(allAddons.map((a: { id: string; code: string }) => [a.id, a]));
        
        for (const item of lineItems) {
          // Only process items that have an addonId (meaning they are addon line items)
          if (item.addonId) {
            const addon = addonMap.get(item.addonId);
            if (addon) {
              // Accumulate quantities in case of multiple line items with same addon
              if (addon.code === "ASSOCIATIONS") {
                purchasedAssociations += item.quantity || 0;
              } else if (addon.code === "ADMIN") {
                purchasedAdmins += item.quantity || 0;
              } else if (addon.code === "MAIRIES") {
                purchasedCommunes += item.quantity || 0;
              }
            }
          }
        }
      }

      const tenant = await storage.createTenant({
        name: lead.organisationName,
        slug,
        tenantType: tenantType || "MAIRIE",
        contactEmail: lead.email,
        contactName: `${lead.firstName} ${lead.lastName}`,
        subscriptionPlan: "FREE_TRIAL",
        subscriptionPlanId: subscriptionPlanId || null,
        billingInterval: billingInterval || "MONTHLY",
        billingStatus: "TRIAL",
        trialEndsAt,
        purchasedAssociations,
        purchasedAdmins,
        purchasedCommunes,
      });

      const password = generatePassword();
      const passwordHash = await bcrypt.hash(password, 10);

      await storage.createUser({
        tenantId: tenant.id,
        name: `${lead.firstName} ${lead.lastName}`,
        email: lead.email,
        passwordHash,
        role: "ADMIN",
      });
      
      // Create billing preferences based on quote payment method (default to STRIPE if no quote)
      const paymentMethod = acceptedQuote?.paymentMethod === "ADMINISTRATIVE_MANDATE" 
        ? "ADMINISTRATIVE_MANDATE" 
        : "STRIPE";
      await storage.upsertTenantBillingPreferences(tenant.id, {
        preferredPaymentMethod: paymentMethod,
      });

      await storage.updateLeadStatus(lead.id, "CONVERTED");
      
      // Update pipeline stage to CONVERTED
      await storage.updateLeadPipelineStage(lead.id, "CONVERTED");
      if (acceptedQuote && acceptedQuote.paymentMethod === "ADMINISTRATIVE_MANDATE") {
        // Create mandate order from accepted quote
        await createMandateOrderFromQuote(acceptedQuote.id, tenant.id);
      }

      const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
      const host = req.get("host") || "localhost:5000";
      const loginUrl = `${protocol}://${host}/structures/${tenant.slug}/admin/login`;

      await sendWelcomeEmail(
        lead.email,
        `${lead.firstName} ${lead.lastName}`,
        lead.organisationName,
        loginUrl,
        lead.email,
        password
      );

      res.json({
        success: true,
        tenant,
        message: `Client cree avec succes. Un email a ete envoye a ${lead.email}`
      });
    } catch (error) {
      console.error("Lead conversion error:", error);
      res.status(500).json({ error: "Erreur lors de la conversion du prospect" });
    }
  });

  app.delete("/api/superadmin/leads/:id", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const deleted = await storage.deleteLead(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Prospect non trouve" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Lead delete error:", error);
      res.status(500).json({ error: "Erreur lors de la suppression du prospect" });
    }
  });

  // Pipeline stage update
  app.patch("/api/superadmin/leads/:id/pipeline-stage", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const { stage } = req.body;
      const validStages = ["NEW", "CONTACTED", "QUOTED", "AWAITING_DECISION", "AWAITING_PAYMENT", "CONVERTED", "LOST"];
      if (!validStages.includes(stage)) {
        return res.status(400).json({ error: "Etape du pipeline invalide" });
      }
      const updated = await storage.updateLeadPipelineStage(req.params.id, stage);
      if (!updated) {
        return res.status(404).json({ error: "Prospect non trouve" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Lead pipeline update error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Update lead details
  app.patch("/api/superadmin/leads/:id", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const { tenantType, assignedSuperadminId } = req.body;
      const updated = await storage.updateLead(req.params.id, { tenantType, assignedSuperadminId });
      if (!updated) {
        return res.status(404).json({ error: "Prospect non trouve" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Lead update error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Get lead with messages
  app.get("/api/superadmin/leads/:id/detail", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const lead = await storage.getLeadById(req.params.id);
      if (!lead) {
        return res.status(404).json({ error: "Prospect non trouve" });
      }
      const messages = await storage.getLeadMessages(req.params.id);
      const unreadCount = await storage.getUnreadLeadMessageCount(req.params.id);
      // Mark messages from lead as read when superadmin views
      await storage.markLeadMessagesAsRead(req.params.id, "SUPERADMIN");
      // Get quotes linked to this lead
      const leadQuotes = await storage.getQuotesByLeadId(req.params.id);
      res.json({ lead, messages, unreadCount, quotes: leadQuotes });
    } catch (error) {
      console.error("Lead detail error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Get lead messages
  app.get("/api/superadmin/leads/:id/messages", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const messages = await storage.getLeadMessages(req.params.id);
      res.json(messages);
    } catch (error) {
      console.error("Lead messages error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Create lead message (superadmin sending to lead)
  app.post("/api/superadmin/leads/:id/messages", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const { subject, body } = req.body;
      if (!body) {
        return res.status(400).json({ error: "Message requis" });
      }
      let lead = await storage.getLeadById(req.params.id);
      if (!lead) {
        return res.status(404).json({ error: "Prospect non trouve" });
      }
      // Generate publicToken if not exists (for portal access)
      let portalToken = lead.publicToken;
      if (!portalToken) {
        portalToken = randomUUID();
        await storage.updateLead(req.params.id, { publicToken: portalToken });
        lead = { ...lead, publicToken: portalToken };
      }
      const message = await storage.createLeadMessage({
        leadId: req.params.id,
        senderType: "SUPERADMIN",
        senderSuperadminId: req.session.superadminId,
        subject,
        body,
      });
      // Update pipeline stage to CONTACTED if still NEW
      if (lead.pipelineStage === "NEW") {
        await storage.updateLeadPipelineStage(req.params.id, "CONTACTED");
      }
      // Send email to lead with portal link
      await sendLeadMessageEmail(lead.email, `${lead.firstName} ${lead.lastName}`, subject || "Nouveau message", body, portalToken);
      res.json(message);
    } catch (error) {
      console.error("Lead message error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Create quote from lead
  app.post("/api/superadmin/leads/:id/quote", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const lead = await storage.getLeadById(req.params.id);
      if (!lead) {
        return res.status(404).json({ error: "Prospect non trouve" });
      }
      const { planId, billingInterval, notes, addons } = req.body;
      if (!planId) {
        return res.status(400).json({ error: "Plan requis" });
      }
      const plan = await storage.getSubscriptionPlanById(planId);
      if (!plan) {
        return res.status(404).json({ error: "Plan non trouve" });
      }
      // Create quote
      const quoteNumber = await storage.getNextQuoteNumber();
      const interval = billingInterval || "YEARLY";
      const unitPrice = interval === "MONTHLY" ? plan.monthlyPrice : plan.yearlyPrice;
      const lineItemsData: { description: string; quantity: number; unitPrice: number; total: number; planId?: string; addonId?: string; billingInterval?: string }[] = [
        {
          description: `${plan.name} - Abonnement ${interval === "MONTHLY" ? "mensuel" : "annuel"}`,
          quantity: 1,
          unitPrice,
          total: unitPrice,
          planId: plan.id,
          billingInterval: interval,
        }
      ];
      // Add addons if provided
      if (addons && Array.isArray(addons)) {
        for (const addonItem of addons) {
          const addon = await storage.getAddonById(addonItem.addonId);
          if (addon) {
            const addonPrice = interval === "MONTHLY" ? addon.defaultMonthlyPrice : addon.defaultYearlyPrice;
            lineItemsData.push({
              description: `${addon.name} x${addonItem.quantity}`,
              quantity: addonItem.quantity,
              unitPrice: addonPrice,
              total: addonPrice * addonItem.quantity,
              addonId: addon.id,
              billingInterval: interval,
            });
          }
        }
      }
      const subtotal = lineItemsData.reduce((sum, item) => sum + item.total, 0);
      // TVA non applicable - Voxpopulous est auto-entrepreneur (art. 293B CGI)
      const taxRate = 0;
      const taxAmount = 0;
      const total = subtotal;
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + 30);
      const companySettings = await storage.getCompanySettings();
      const quote = await storage.createQuote({
        quoteNumber,
        leadId: lead.id,
        clientName: lead.organisationName,
        clientEmail: lead.email,
        emitterName: companySettings?.companyName || "Voxpopulous",
        emitterAddress: companySettings?.address || "",
        emitterSiret: companySettings?.siret || "",
        emitterTva: companySettings?.tvaNumber || "",
        status: "DRAFT",
        quoteSource: "PROSPECT_CONTACT",
        subtotal,
        taxRate,
        taxAmount,
        total,
        validUntil,
        notes,
        publicToken: randomBytes(32).toString("hex"),
      });
      // Create line items
      for (const item of lineItemsData) {
        await storage.createQuoteLineItem({
          quoteId: quote.id,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
          planId: item.planId,
          addonId: item.addonId,
          billingInterval: item.billingInterval as any,
        });
      }
      // Update pipeline stage
      await storage.updateLeadPipelineStage(req.params.id, "QUOTED");
      res.json(quote);
    } catch (error) {
      console.error("Create quote from lead error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.delete("/api/superadmin/tenants/:id", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const deleted = await storage.deleteArchivedTenant(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Client non trouve" });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("Tenant delete error:", error);
      res.status(500).json({ error: error.message || "Erreur lors de la suppression du client" });
    }
  });

  // Tenant lifecycle management
  app.post("/api/superadmin/tenants/:id/suspend", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const { reason } = req.body;
      if (!reason) {
        return res.status(400).json({ error: "La raison de la suspension est requise" });
      }
      const tenant = await storage.suspendTenant(req.params.id, reason, req.session.superadminId);
      if (!tenant) {
        return res.status(404).json({ error: "Client non trouve" });
      }
      res.json(tenant);
    } catch (error) {
      console.error("Tenant suspend error:", error);
      res.status(500).json({ error: "Erreur lors de la suspension du client" });
    }
  });

  app.post("/api/superadmin/tenants/:id/unsuspend", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const tenant = await storage.unsuspendTenant(req.params.id);
      if (!tenant) {
        return res.status(404).json({ error: "Client non trouve" });
      }
      res.json(tenant);
    } catch (error) {
      console.error("Tenant unsuspend error:", error);
      res.status(500).json({ error: "Erreur lors de la reactivation du client" });
    }
  });

  app.post("/api/superadmin/tenants/:id/archive", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const { reason } = req.body;
      if (!reason) {
        return res.status(400).json({ error: "La raison de l'archivage est requise" });
      }
      const tenant = await storage.archiveTenant(req.params.id, reason, req.session.superadminId);
      if (!tenant) {
        return res.status(404).json({ error: "Client non trouve" });
      }
      res.json(tenant);
    } catch (error) {
      console.error("Tenant archive error:", error);
      res.status(500).json({ error: "Erreur lors de l'archivage du client" });
    }
  });

  app.post("/api/superadmin/tenants/:id/set-free", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const { isFree } = req.body;
      if (typeof isFree !== "boolean") {
        return res.status(400).json({ error: "Le parametre isFree est requis" });
      }
      const tenant = await storage.setTenantFreeStatus(req.params.id, isFree);
      if (!tenant) {
        return res.status(404).json({ error: "Client non trouve" });
      }
      res.json(tenant);
    } catch (error) {
      console.error("Tenant set-free error:", error);
      res.status(500).json({ error: "Erreur lors de la mise a jour du statut gratuit" });
    }
  });

  app.get("/api/superadmin/tenants-by-status/:status", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const status = req.params.status.toUpperCase() as "ACTIVE" | "SUSPENDED" | "ARCHIVED";
      if (!["ACTIVE", "SUSPENDED", "ARCHIVED"].includes(status)) {
        return res.status(400).json({ error: "Statut invalide" });
      }
      const tenants = await storage.getTenantsByLifecycleStatus(status);
      res.json(tenants);
    } catch (error) {
      console.error("Tenants by status error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ==========================================
  // SUBSCRIPTION CANCELLATION
  // ==========================================

  // Cancel subscription (Stripe or Mandate) - Superadmin action
  app.post("/api/superadmin/tenants/:id/cancel-subscription", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const { reason, cancelAtPeriodEnd } = req.body;
      if (!reason) {
        return res.status(400).json({ error: "La raison de l'annulation est requise" });
      }

      const tenant = await storage.getTenantById(req.params.id);
      if (!tenant) {
        return res.status(404).json({ error: "Client non trouve" });
      }

      // Check if tenant has Stripe subscription
      if (tenant.stripeSubscriptionId) {
        // Cancel Stripe subscription
        const stripe = await getUncachableStripeClient();
        if (cancelAtPeriodEnd) {
          // Cancel at end of billing period
          await stripe.subscriptions.update(tenant.stripeSubscriptionId, {
            cancel_at_period_end: true,
            metadata: { cancellation_reason: reason }
          });
        } else {
          // Cancel immediately
          await stripe.subscriptions.cancel(tenant.stripeSubscriptionId, {
            prorate: true
          });
        }
        
        // Update tenant status
        const updatedTenant = await storage.updateTenantBillingStatus(tenant.id, "CANCELLED");
        
        // Log activity
        await storage.createMandateActivity({
          tenantId: tenant.id,
          activityType: "SUBSCRIPTION_CANCELLED",
          title: "Abonnement Stripe annule",
          description: `Abonnement annule par superadmin. Raison: ${reason}`,
          performedBy: req.session.superadminId,
          performedByType: "superadmin",
        });
        
        return res.json({ 
          success: true, 
          message: cancelAtPeriodEnd 
            ? "L'abonnement sera annule a la fin de la periode de facturation" 
            : "L'abonnement Stripe a ete annule",
          tenant: updatedTenant 
        });
      } 
      
      // Check for mandate subscription
      const mandateSubscription = await storage.getActiveMandateSubscription(tenant.id);
      if (mandateSubscription) {
        // Cancel mandate subscription
        await storage.updateMandateSubscription(mandateSubscription.id, { status: "CANCELLED" });
        
        // Update tenant status
        const updatedTenant = await storage.updateTenantBillingStatus(tenant.id, "CANCELLED");
        
        // Log activity
        await storage.createMandateActivity({
          tenantId: tenant.id,
          activityType: "SUBSCRIPTION_CANCELLED",
          title: "Abonnement par mandat annule",
          description: `Abonnement annule par superadmin. Raison: ${reason}`,
          performedBy: req.session.superadminId,
          performedByType: "superadmin",
        });
        
        return res.json({ 
          success: true, 
          message: "L'abonnement par mandat administratif a ete annule",
          tenant: updatedTenant 
        });
      }

      // No active subscription found - just update status
      const updatedTenant = await storage.updateTenantBillingStatus(tenant.id, "CANCELLED");
      return res.json({ 
        success: true, 
        message: "Le statut de facturation a ete mis a jour",
        tenant: updatedTenant 
      });
      
    } catch (error) {
      console.error("Cancel subscription error:", error);
      res.status(500).json({ error: "Erreur lors de l'annulation de l'abonnement" });
    }
  });

  // ==========================================
  // SUPERADMIN BILLING ROUTES
  // ==========================================

  app.get("/api/superadmin/plans", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const plans = await storage.getAllSubscriptionPlans();
      res.json(plans);
    } catch (error) {
      console.error("Plans list error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.post("/api/superadmin/plans", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const parsed = insertSubscriptionPlanSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Donnees invalides", details: parsed.error.flatten() });
      }
      const plan = await storage.createSubscriptionPlan(parsed.data);
      res.json(plan);
    } catch (error: any) {
      console.error("Plan creation error:", error);
      res.status(500).json({ error: error.message || "Erreur serveur" });
    }
  });

  app.put("/api/superadmin/plans/reorder", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const { planIds } = req.body;
      if (!Array.isArray(planIds)) {
        return res.status(400).json({ error: "planIds doit etre un tableau" });
      }
      await storage.reorderSubscriptionPlans(planIds);
      res.json({ success: true });
    } catch (error) {
      console.error("Plan reorder error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.put("/api/superadmin/plans/:id", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const plan = await storage.updateSubscriptionPlan(req.params.id, req.body);
      if (!plan) {
        return res.status(404).json({ error: "Plan non trouve" });
      }
      res.json(plan);
    } catch (error: any) {
      console.error("Plan update error:", error);
      res.status(500).json({ error: error.message || "Erreur serveur" });
    }
  });

  app.delete("/api/superadmin/plans/:id", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      await storage.deleteSubscriptionPlan(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Plan deletion error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Plan Features routes
  app.get("/api/superadmin/plans/:planId/features", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const features = await storage.getPlanFeatures(req.params.planId);
      res.json(features);
    } catch (error) {
      console.error("Plan features fetch error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.post("/api/superadmin/plans/:planId/legacy-features", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const feature = await storage.createPlanFeature({
        planId: req.params.planId,
        label: req.body.label,
        included: req.body.included ?? true,
        sortOrder: req.body.sortOrder ?? 0,
      });
      res.json(feature);
    } catch (error: any) {
      console.error("Plan feature creation error:", error);
      res.status(500).json({ error: error.message || "Erreur serveur" });
    }
  });

  app.put("/api/superadmin/plan-features/:id", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const feature = await storage.updatePlanFeature(req.params.id, req.body);
      if (!feature) {
        return res.status(404).json({ error: "Fonctionnalite non trouvee" });
      }
      res.json(feature);
    } catch (error: any) {
      console.error("Plan feature update error:", error);
      res.status(500).json({ error: error.message || "Erreur serveur" });
    }
  });

  app.delete("/api/superadmin/plan-features/:id", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      await storage.deletePlanFeature(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Plan feature deletion error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Public route for plans with features (for pricing page)
  app.get("/api/public/plans", async (req, res) => {
    try {
      const plansWithFeatures = await storage.getPlansWithFeatures();
      const activePlans = plansWithFeatures.filter(p => p.isActive);
      res.json(activePlans);
    } catch (error) {
      console.error("Public plans fetch error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Public: Get tenant effective features (for feature gating)
  app.get("/api/tenants/:slug/features", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant non trouve" });
      }
      const features = await storage.getTenantEffectiveFeatures(tenant.id);
      res.json(features);
    } catch (error) {
      console.error("Tenant features error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Public: Get association effective features (inherited from tenant)
  app.get("/api/structures/:tenantSlug/:associationSlug/features", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.tenantSlug);
      if (!tenant) {
        return res.status(404).json({ error: "Commune non trouvee" });
      }
      const association = await storage.getAssociationBySlug(tenant.id, req.params.associationSlug);
      if (!association) {
        return res.status(404).json({ error: "Association non trouvee" });
      }
      const features = await storage.getAssociationEffectiveFeatures(association.id);
      res.json(features);
    } catch (error) {
      console.error("Association features error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Feature catalog routes
  app.get("/api/superadmin/features", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const featuresList = await storage.getAllFeatures();
      res.json(featuresList);
    } catch (error) {
      console.error("Features list error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.get("/api/superadmin/features/:id", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const feature = await storage.getFeatureById(req.params.id);
      if (!feature) {
        return res.status(404).json({ error: "Fonctionnalite non trouvee" });
      }
      res.json(feature);
    } catch (error) {
      console.error("Feature fetch error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.post("/api/superadmin/features", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const feature = await storage.createFeature({
        name: req.body.name,
        code: req.body.code,
        description: req.body.description || null,
        displayOrder: req.body.displayOrder ?? 0,
      });
      res.json(feature);
    } catch (error: any) {
      console.error("Feature creation error:", error);
      res.status(500).json({ error: error.message || "Erreur serveur" });
    }
  });

  app.put("/api/superadmin/features/:id", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const feature = await storage.updateFeature(req.params.id, req.body);
      if (!feature) {
        return res.status(404).json({ error: "Fonctionnalite non trouvee" });
      }
      res.json(feature);
    } catch (error: any) {
      console.error("Feature update error:", error);
      res.status(500).json({ error: error.message || "Erreur serveur" });
    }
  });

  app.delete("/api/superadmin/features/:id", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      await storage.deleteFeature(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Feature deletion error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Plan feature assignments routes
  app.get("/api/superadmin/plans/:planId/assignments", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const assignments = await storage.getPlanFeatureAssignments(req.params.planId);
      res.json(assignments);
    } catch (error) {
      console.error("Plan assignments fetch error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.post("/api/superadmin/plans/:planId/features", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const { featureIds } = req.body;
      await storage.setPlanFeatures(req.params.planId, featureIds || []);
      const assignments = await storage.getPlanFeatureAssignments(req.params.planId);
      res.json(assignments);
    } catch (error: any) {
      console.error("Plan features update error:", error);
      res.status(500).json({ error: error.message || "Erreur serveur" });
    }
  });

  // Public route for plans with catalog features
  app.get("/api/public/plans-catalog", async (req, res) => {
    try {
      const tenantType = req.query.tenantType as string | undefined;
      const plansWithFeatures = await storage.getPlansWithCatalogFeatures();
      let activePlans = plansWithFeatures.filter(p => p.isActive);
      
      if (tenantType) {
        activePlans = activePlans.filter(p => {
          if (!p.targetTenantTypes || p.targetTenantTypes.length === 0) {
            return true;
          }
          return p.targetTenantTypes.includes(tenantType);
        });
      }
      
      res.json(activePlans);
    } catch (error) {
      console.error("Public plans catalog fetch error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Public route for plans with addon access
  app.get("/api/public/plans-with-addons", async (req, res) => {
    try {
      const plansWithAddons = await storage.getPlansWithAddonAccess();
      const activePlans = plansWithAddons.filter(p => p.isActive);
      res.json(activePlans);
    } catch (error) {
      console.error("Public plans with addons fetch error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Public route for organization search
  app.get("/api/public/organizations", async (req, res) => {
    try {
      const { type, search } = req.query;
      
      // Get all tenants (mairies & EPCI)
      const allTenants = await storage.getAllTenants();
      // Get all active associations
      const allAssociations = await storage.getAllAssociations();
      
      // Build organizations list
      let organizations: Array<{
        id: string;
        name: string;
        type: "MAIRIE" | "EPCI" | "ASSOCIATION";
        slug: string;
        parentSlug?: string;
        logoUrl?: string | null;
        city?: string | null;
      }> = [];
      
      // Add tenants (mairies and EPCI)
      for (const tenant of allTenants) {
        if (tenant.tenantType === "MAIRIE" || tenant.tenantType === "EPCI") {
          organizations.push({
            id: tenant.id,
            name: tenant.name,
            type: tenant.tenantType as "MAIRIE" | "EPCI",
            slug: tenant.slug,
            logoUrl: tenant.logoUrl,
          });
        }
      }
      
      // Add associations
      for (const assoc of allAssociations) {
        // Find parent tenant
        const parentTenant = allTenants.find(t => t.id === assoc.tenantId);
        if (parentTenant) {
          organizations.push({
            id: assoc.id,
            name: assoc.name,
            type: "ASSOCIATION",
            slug: assoc.slug,
            parentSlug: parentTenant.slug,
            logoUrl: assoc.logoUrl,
          });
        }
      }
      
      // Filter by type if specified
      if (type && typeof type === "string") {
        organizations = organizations.filter(org => org.type === type.toUpperCase());
      }
      
      // Filter by search term if specified
      if (search && typeof search === "string") {
        const searchLower = search.toLowerCase();
        organizations = organizations.filter(org => 
          org.name.toLowerCase().includes(searchLower)
        );
      }
      
      // Sort alphabetically
      organizations.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
      
      res.json(organizations);
    } catch (error) {
      console.error("Public organizations fetch error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Public route for active addons (for pricing page)
  app.get("/api/public/addons", async (req, res) => {
    try {
      const allAddons = await storage.listAddons();
      const activeAddons = allAddons.filter((a: { isActive: boolean }) => a.isActive);
      res.json(activeAddons);
    } catch (error) {
      console.error("Public addons fetch error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Public quote validation routes
  app.get("/api/public/quotes/:token", async (req, res) => {
    try {
      const quote = await storage.getQuoteByPublicToken(req.params.token);
      if (!quote) {
        return res.status(404).json({ error: "Devis non trouve" });
      }
      const lineItems = await storage.getQuoteLineItems(quote.id);
      
      // Enrich line items with plan monthly/yearly prices for CB payment options
      const enrichedLineItems = await Promise.all(lineItems.map(async (item) => {
        if (item.planId) {
          const plan = await storage.getSubscriptionPlanById(item.planId);
          if (plan) {
            return {
              ...item,
              planMonthlyPrice: plan.monthlyPrice,
              planYearlyPrice: plan.yearlyPrice,
            };
          }
        }
        if (item.addonId) {
          const addon = await storage.getAddonById(item.addonId);
          if (addon) {
            return {
              ...item,
              addonMonthlyPrice: addon.defaultMonthlyPrice,
              addonYearlyPrice: addon.defaultYearlyPrice,
            };
          }
        }
        return item;
      }));
      
      res.json({ quote, lineItems: enrichedLineItems });
    } catch (error) {
      console.error("Public quote fetch error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.post("/api/public/quotes/:token/accept", async (req, res) => {
    try {
      const quote = await storage.getQuoteByPublicToken(req.params.token);
      if (!quote) {
        return res.status(404).json({ error: "Devis non trouve" });
      }
      if (quote.status !== "SENT") {
        return res.status(400).json({ error: "Ce devis ne peut plus etre accepte" });
      }
      if (new Date(quote.validUntil) < new Date()) {
        return res.status(400).json({ error: "Ce devis a expire" });
      }
      const { paymentMethod, email, mandateUrl } = req.body;
      const updates: Partial<typeof quote> = {
        status: "ACCEPTED",
        acceptedAt: new Date(),
        acceptedByEmail: email,
        paymentMethod: paymentMethod || quote.paymentMethod,
      };
      if (paymentMethod === "ADMINISTRATIVE_MANDATE" && mandateUrl) {
        updates.administrativeMandateUrl = mandateUrl;
        updates.administrativeMandateStatus = "PENDING";
      }
      const updatedQuote = await storage.updateQuote(quote.id, updates);
      res.json({ quote: updatedQuote, success: true });
    } catch (error) {
      console.error("Quote accept error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.post("/api/public/quotes/:token/stripe/create-payment-intent", async (req, res) => {
    try {
      const quote = await storage.getQuoteByPublicToken(req.params.token);
      if (!quote) {
        return res.status(404).json({ error: "Devis non trouve" });
      }
      if (quote.status !== "SENT") {
        return res.status(400).json({ error: "Ce devis ne peut plus etre paye" });
      }
      const stripe = await getUncachableStripeClient();
      const paymentIntent = await stripe.paymentIntents.create({
        amount: quote.total,
        currency: "eur",
        metadata: {
          quoteId: quote.id,
          quoteNumber: quote.quoteNumber,
          clientEmail: quote.clientEmail,
        },
        receipt_email: quote.clientEmail,
      });
      await storage.updateQuote(quote.id, {
        stripePaymentIntentId: paymentIntent.id,
      });
      res.json({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      });
    } catch (error: any) {
      console.error("Stripe PaymentIntent creation error:", error);
      res.status(500).json({ error: error.message || "Erreur Stripe" });
    }
  });

  app.post("/api/public/quotes/:token/stripe/create-subscription", async (req, res) => {
    try {
      const quote = await storage.getQuoteByPublicToken(req.params.token);
      if (!quote) {
        return res.status(404).json({ error: "Devis non trouve" });
      }
      if (quote.status !== "SENT") {
        return res.status(400).json({ error: "Ce devis ne peut plus etre paye" });
      }
      const stripe = await getUncachableStripeClient();
      const { billingInterval, email, paymentMethodType } = req.body;
      let customer = await stripe.customers.list({ email: quote.clientEmail, limit: 1 });
      let customerId: string;
      if (customer.data.length > 0) {
        customerId = customer.data[0].id;
      } else {
        const newCustomer = await stripe.customers.create({
          email: email || quote.clientEmail,
          name: quote.clientName,
          metadata: { quoteId: quote.id },
        });
        customerId = newCustomer.id;
      }
      const lineItems = await storage.getQuoteLineItems(quote.id);
      const planItem = lineItems.find(item => item.planId);
      if (!planItem) {
        return res.status(400).json({ error: "Aucun abonnement dans ce devis" });
      }
      
      // Get the plan to access correct monthly/yearly price based on chosen interval
      const plan = planItem.planId ? await storage.getSubscriptionPlanById(planItem.planId) : null;
      const interval = billingInterval === "YEARLY" ? "year" : "month";
      
      // Use the correct price based on billing interval (amounts are in euros, convert to cents for Stripe)
      let unitAmountCents: number;
      if (plan) {
        // Use plan's monthly or yearly price based on chosen interval
        const priceInEuros = billingInterval === "YEARLY" ? plan.yearlyPrice : plan.monthlyPrice;
        unitAmountCents = Math.round(priceInEuros * 100);
      } else {
        // Fallback to stored price (already in euros, convert to cents)
        unitAmountCents = Math.round((planItem.unitPrice || 0) * 100);
      }
      
      const product = await stripe.products.create({
        name: planItem.description,
        metadata: { quoteId: quote.id },
      });
      const price = await stripe.prices.create({
        currency: "eur",
        product: product.id,
        unit_amount: unitAmountCents,
        recurring: { interval },
      });
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: price.id }],
        payment_behavior: "default_incomplete",
        payment_settings: {
          payment_method_types: paymentMethodType === "sepa_debit" ? ["sepa_debit"] : ["card"],
          save_default_payment_method: "on_subscription",
        },
        expand: ["latest_invoice.payment_intent", "pending_setup_intent"],
        metadata: { quoteId: quote.id, quoteNumber: quote.quoteNumber },
      });
      await storage.updateQuote(quote.id, {
        stripeSubscriptionId: subscription.id,
      });
      const invoice = subscription.latest_invoice as any;
      const paymentIntent = invoice?.payment_intent;
      const setupIntent = subscription.pending_setup_intent as any;
      res.json({
        subscriptionId: subscription.id,
        clientSecret: paymentIntent?.client_secret || setupIntent?.client_secret,
        status: subscription.status,
      });
    } catch (error: any) {
      console.error("Stripe subscription creation error:", error);
      res.status(500).json({ error: error.message || "Erreur Stripe" });
    }
  });

  app.post("/api/public/quotes/:token/mandate/upload-url", async (req, res) => {
    try {
      const quote = await storage.getQuoteByPublicToken(req.params.token);
      if (!quote) {
        return res.status(404).json({ error: "Devis non trouve" });
      }
      const { filename, contentType } = req.body;
      if (!filename || !contentType) {
        return res.status(400).json({ error: "Nom de fichier et type requis" });
      }
      const bucketName = process.env.REPLIT_OBJECT_STORAGE_BUCKET_NAME;
      if (!bucketName) {
        return res.status(500).json({ error: "Object storage non configure" });
      }
      const { Storage } = await import("@google-cloud/storage");
      const storage_client = new Storage();
      const bucket = storage_client.bucket(bucketName);
      const ext = filename.split(".").pop() || "pdf";
      const key = `.private/mandates/${quote.id}_${Date.now()}.${ext}`;
      const file = bucket.file(key);
      const [signedUrl] = await file.getSignedUrl({
        version: "v4",
        action: "write",
        expires: Date.now() + 15 * 60 * 1000,
        contentType,
      });
      res.json({ uploadUrl: signedUrl, key });
    } catch (error: any) {
      console.error("Mandate upload URL error:", error);
      res.status(500).json({ error: error.message || "Erreur serveur" });
    }
  });

  app.post("/api/public/quotes/:token/mandate/confirm", async (req, res) => {
    try {
      const quote = await storage.getQuoteByPublicToken(req.params.token);
      if (!quote) {
        return res.status(404).json({ error: "Devis non trouve" });
      }
      const { key, email } = req.body;
      if (!key) {
        return res.status(400).json({ error: "Cle de fichier requise" });
      }
      const updatedQuote = await storage.updateQuote(quote.id, {
        status: "ACCEPTED",
        acceptedAt: new Date(),
        acceptedByEmail: email || quote.clientEmail,
        paymentMethod: "ADMINISTRATIVE_MANDATE",
        administrativeMandateUrl: key,
        administrativeMandateStatus: "PENDING",
      });
      
      // Create mandate order from accepted quote
      await createMandateOrderFromQuote(quote.id);
      
      res.json({ quote: updatedQuote, success: true });
    } catch (error: any) {
      console.error("Mandate confirm error:", error);
      res.status(500).json({ error: error.message || "Erreur serveur" });
    }
  });

  // Reject quote from public link
  app.post("/api/public/quotes/:token/reject", async (req, res) => {
    try {
      const quote = await storage.getQuoteByPublicToken(req.params.token);
      if (!quote) {
        return res.status(404).json({ error: "Devis non trouve" });
      }
      if (quote.status !== "SENT") {
        return res.status(400).json({ error: "Ce devis ne peut plus etre modifie" });
      }
      const { reason } = req.body;
      const updatedQuote = await storage.updateQuote(quote.id, {
        status: "REJECTED",
        rejectedAt: new Date(),
        rejectionReason: reason || null,
      });
      // Update lead pipeline stage if linked
      if (quote.leadId) {
        await storage.updateLeadPipelineStage(quote.leadId, "LOST");
      }
      res.json({ quote: updatedQuote, success: true });
    } catch (error: any) {
      console.error("Quote reject error:", error);
      res.status(500).json({ error: error.message || "Erreur serveur" });
    }
  });

  // Accept quote with digital signature
  app.post("/api/public/quotes/:token/accept-with-signature", async (req, res) => {
    try {
      const quote = await storage.getQuoteByPublicToken(req.params.token);
      if (!quote) {
        return res.status(404).json({ error: "Devis non trouve" });
      }
      if (quote.status !== "SENT") {
        return res.status(400).json({ error: "Ce devis ne peut plus etre valide" });
      }
      const { signatureDataUrl, signerName, signerCapacity } = req.body;
      if (!signatureDataUrl || !signerName || !signerCapacity) {
        return res.status(400).json({ error: "Signature, nom et qualite requis" });
      }

      // Upload signature image to object storage
      const base64Data = signatureDataUrl.replace(/^data:image\/png;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      
      const bucketId = process.env.REPLIT_OBJECT_STORAGE_BUCKET_NAME || process.env.PRIVATE_OBJECT_DIR?.split("/")[1];
      if (!bucketId) {
        return res.status(500).json({ error: "Object storage non configure" });
      }
      const signatureKey = `signatures/quote-${quote.id}-${Date.now()}.png`;
      
      const { objectStorageClient } = await import("./objectStorage");
      const bucket = objectStorageClient.bucket(bucketId);
      const file = bucket.file(signatureKey);
      await file.save(buffer, { contentType: "image/png" });

      const updatedQuote = await storage.updateQuote(quote.id, {
        status: "ACCEPTED",
        acceptedAt: new Date(),
        acceptedByName: signerName,
        acceptedByEmail: quote.clientEmail,
        paymentMethod: "ADMINISTRATIVE_MANDATE",
        signatureImageUrl: signatureKey,
        signedByName: signerName,
        signedByCapacity: signerCapacity,
        signedAt: new Date(),
        paymentSelectionStatus: "MANDATE_SELECTED",
        paymentSelectionAt: new Date(),
        administrativeMandateUrl: signatureKey,
        administrativeMandateStatus: "SIGNED",
      });

      // Update lead pipeline stage if linked
      if (quote.leadId) {
        await storage.updateLeadPipelineStage(quote.leadId, "AWAITING_PAYMENT");
      }
      
      // Create mandate order from accepted quote
      await createMandateOrderFromQuote(quote.id);

      res.json({ quote: updatedQuote, success: true });
    } catch (error: any) {
      console.error("Quote signature accept error:", error);
      res.status(500).json({ error: error.message || "Erreur serveur" });
    }
  });

  // Get upload URL for scanned document
  app.post("/api/public/quotes/:token/scanned-document/upload-url", async (req, res) => {
    try {
      const quote = await storage.getQuoteByPublicToken(req.params.token);
      if (!quote) {
        return res.status(404).json({ error: "Devis non trouve" });
      }
      if (quote.status !== "SENT") {
        return res.status(400).json({ error: "Ce devis ne peut plus etre valide" });
      }
      const { filename, contentType } = req.body;
      if (!filename || !contentType) {
        return res.status(400).json({ error: "Nom de fichier et type requis" });
      }

      const ext = filename.split(".").pop() || "pdf";
      const key = `scanned-quotes/quote-${quote.id}-${Date.now()}.${ext}`;
      
      const bucketId = process.env.REPLIT_OBJECT_STORAGE_BUCKET_NAME || process.env.PRIVATE_OBJECT_DIR?.split("/")[1];
      if (!bucketId) {
        return res.status(500).json({ error: "Object storage non configure" });
      }
      
      const { objectStorageClient } = await import("./objectStorage");
      const bucket = objectStorageClient.bucket(bucketId);
      const file = bucket.file(key);
      const [signedUrl] = await file.getSignedUrl({
        version: "v4",
        action: "write",
        expires: Date.now() + 15 * 60 * 1000,
        contentType,
      });

      res.json({ signedUrl, key });
    } catch (error: any) {
      console.error("Scanned document upload URL error:", error);
      res.status(500).json({ error: error.message || "Erreur serveur" });
    }
  });

  // Accept quote with uploaded scanned document
  app.post("/api/public/quotes/:token/accept-with-document", async (req, res) => {
    try {
      const quote = await storage.getQuoteByPublicToken(req.params.token);
      if (!quote) {
        return res.status(404).json({ error: "Devis non trouve" });
      }
      if (quote.status !== "SENT") {
        return res.status(400).json({ error: "Ce devis ne peut plus etre valide" });
      }
      const { documentKey, originalFilename } = req.body;
      if (!documentKey) {
        return res.status(400).json({ error: "Cle de document requise" });
      }

      const updatedQuote = await storage.updateQuote(quote.id, {
        status: "ACCEPTED",
        acceptedAt: new Date(),
        acceptedByEmail: quote.clientEmail,
        paymentMethod: "ADMINISTRATIVE_MANDATE",
        scannedDocumentUrl: documentKey,
        scannedDocumentOriginalName: originalFilename || null,
        paymentSelectionStatus: "MANDATE_SELECTED",
        paymentSelectionAt: new Date(),
        administrativeMandateUrl: documentKey,
        administrativeMandateStatus: "SIGNED",
      });

      // Update lead pipeline stage if linked
      if (quote.leadId) {
        await storage.updateLeadPipelineStage(quote.leadId, "AWAITING_PAYMENT");
      }
      
      // Create mandate order from accepted quote
      await createMandateOrderFromQuote(quote.id);

      res.json({ quote: updatedQuote, success: true });
    } catch (error: any) {
      console.error("Quote document accept error:", error);
      res.status(500).json({ error: error.message || "Erreur serveur" });
    }
  });

  // Select payment method (for quotes from lead pipeline)
  app.post("/api/public/quotes/:token/select-payment-method", async (req, res) => {
    try {
      const quote = await storage.getQuoteByPublicToken(req.params.token);
      if (!quote) {
        return res.status(404).json({ error: "Devis non trouve" });
      }
      if (quote.status !== "ACCEPTED") {
        return res.status(400).json({ error: "Ce devis doit d'abord etre accepte" });
      }
      const { paymentMethod, mandateDetails } = req.body;
      if (!paymentMethod || !["STRIPE", "ADMINISTRATIVE_MANDATE"].includes(paymentMethod)) {
        return res.status(400).json({ error: "Methode de paiement invalide" });
      }
      const isMandate = paymentMethod === "ADMINISTRATIVE_MANDATE";
      const updates: Partial<typeof quote> = {
        paymentMethod,
        paymentSelectionStatus: isMandate ? "MANDATE_SELECTED" : "STRIPE_SELECTED",
        paymentSelectionAt: new Date(),
        prospectMandateSiret: isMandate && mandateDetails?.siret ? mandateDetails.siret : null,
        prospectMandateBillingAddress: isMandate && mandateDetails?.billingAddress ? mandateDetails.billingAddress : null,
        prospectMandateBillingService: isMandate && mandateDetails?.billingService ? mandateDetails.billingService : null,
        prospectMandateUseChorusPro: isMandate && mandateDetails?.useChorusPro ? mandateDetails.useChorusPro : null,
      };
      const updatedQuote = await storage.updateQuote(quote.id, updates);
      // Update lead pipeline stage
      if (quote.leadId) {
        await storage.updateLeadPipelineStage(quote.leadId, "AWAITING_PAYMENT");
      }
      res.json({ quote: updatedQuote, success: true });
    } catch (error: any) {
      console.error("Payment method selection error:", error);
      res.status(500).json({ error: error.message || "Erreur serveur" });
    }
  });

  // Public lead messaging endpoints (via publicToken)
  app.get("/api/public/leads/:token", async (req, res) => {
    try {
      const lead = await storage.getLeadByPublicToken(req.params.token);
      if (!lead) {
        return res.status(404).json({ error: "Prospect non trouve" });
      }
      const messages = await storage.getLeadMessages(lead.id);
      const quotes = await storage.getQuotesByLeadId(lead.id);
      res.json({ lead, messages, quotes });
    } catch (error) {
      console.error("Public lead fetch error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.post("/api/public/leads/:token/messages", async (req, res) => {
    try {
      const lead = await storage.getLeadByPublicToken(req.params.token);
      if (!lead) {
        return res.status(404).json({ error: "Prospect non trouve" });
      }
      const { subject, body } = req.body;
      if (!body || body.trim().length === 0) {
        return res.status(400).json({ error: "Message requis" });
      }
      const message = await storage.createLeadMessage({
        leadId: lead.id,
        senderType: "LEAD",
        subject: subject || null,
        body,
        senderEmail: lead.email,
      });
      res.json(message);
    } catch (error) {
      console.error("Public lead message error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Addon routes
  app.get("/api/superadmin/addons", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const addonsList = await storage.listAddons();
      res.json(addonsList);
    } catch (error) {
      console.error("Addons list error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.get("/api/superadmin/addons/:id", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const addon = await storage.getAddonById(req.params.id);
      if (!addon) {
        return res.status(404).json({ error: "Option non trouvee" });
      }
      res.json(addon);
    } catch (error) {
      console.error("Addon fetch error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.post("/api/superadmin/addons", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const addon = await storage.createAddon(req.body);
      res.json(addon);
    } catch (error: any) {
      console.error("Addon creation error:", error);
      res.status(500).json({ error: error.message || "Erreur serveur" });
    }
  });

  app.put("/api/superadmin/addons/:id", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const addon = await storage.updateAddon(req.params.id, req.body);
      if (!addon) {
        return res.status(404).json({ error: "Option non trouvee" });
      }
      res.json(addon);
    } catch (error: any) {
      console.error("Addon update error:", error);
      res.status(500).json({ error: error.message || "Erreur serveur" });
    }
  });

  app.delete("/api/superadmin/addons/:id", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      await storage.deleteAddon(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Addon delete error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Addon usage stats (for subscriptions page)
  app.get("/api/superadmin/addon-stats", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const stats = await storage.getAddonUsageStats();
      res.json(stats);
    } catch (error) {
      console.error("Addon stats error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Plan-Addon access routes
  app.get("/api/superadmin/plans/:planId/addon-access", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const access = await storage.getPlanAddonAccess(req.params.planId);
      res.json(access);
    } catch (error) {
      console.error("Plan addon access fetch error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.post("/api/superadmin/plans/:planId/addon-access", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const { addonAccess } = req.body;
      await storage.setPlanAddonAccess(req.params.planId, addonAccess || []);
      const updated = await storage.getPlanAddonAccess(req.params.planId);
      res.json(updated);
    } catch (error: any) {
      console.error("Plan addon access update error:", error);
      res.status(500).json({ error: error.message || "Erreur serveur" });
    }
  });

  app.get("/api/superadmin/products", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const productsList = await storage.getAllProducts();
      res.json(productsList);
    } catch (error) {
      console.error("Products list error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.get("/api/superadmin/products/active", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const productsList = await storage.getActiveProducts();
      res.json(productsList);
    } catch (error) {
      console.error("Active products list error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.get("/api/superadmin/products/:id", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const product = await storage.getProductById(req.params.id);
      if (!product) {
        return res.status(404).json({ error: "Produit non trouve" });
      }
      res.json(product);
    } catch (error) {
      console.error("Product fetch error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.post("/api/superadmin/products", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const product = await storage.createProduct(req.body);
      res.json(product);
    } catch (error: any) {
      console.error("Product creation error:", error);
      res.status(500).json({ error: error.message || "Erreur serveur" });
    }
  });

  app.put("/api/superadmin/products/:id", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const product = await storage.updateProduct(req.params.id, req.body);
      if (!product) {
        return res.status(404).json({ error: "Produit non trouve" });
      }
      res.json(product);
    } catch (error) {
      console.error("Product update error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.delete("/api/superadmin/products/:id", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      await storage.deleteProduct(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Product deletion error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.get("/api/superadmin/tenants/:id/features", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const overrides = await storage.getTenantFeatureOverrides(req.params.id);
      res.json(overrides || {});
    } catch (error) {
      console.error("Feature overrides error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.put("/api/superadmin/tenants/:id/features", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const overrides = await storage.upsertTenantFeatureOverrides(req.params.id, req.body);
      res.json(overrides);
    } catch (error) {
      console.error("Feature overrides update error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.put("/api/superadmin/tenants/:id/subscription", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const { planId, interval, billingStatus } = req.body;
      let tenant = await storage.getTenantById(req.params.id);
      if (!tenant) {
        return res.status(404).json({ error: "Client non trouve" });
      }
      
      if (planId && interval) {
        tenant = await storage.updateTenantSubscription(req.params.id, planId, interval);
      }
      if (billingStatus) {
        tenant = await storage.updateTenantBillingStatus(req.params.id, billingStatus);
      }
      
      res.json(tenant);
    } catch (error) {
      console.error("Subscription update error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.get("/api/superadmin/quotes", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const quotesList = await storage.getAllQuotes();
      res.json(quotesList);
    } catch (error) {
      console.error("Quotes list error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.get("/api/superadmin/quotes/:id", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const quote = await storage.getQuoteById(req.params.id);
      if (!quote) {
        return res.status(404).json({ error: "Devis non trouve" });
      }
      const lineItems = await storage.getQuoteLineItems(req.params.id);
      res.json({ ...quote, lineItems });
    } catch (error) {
      console.error("Quote fetch error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.post("/api/superadmin/quotes", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const quoteNumber = await storage.getNextQuoteNumber();
      const { lineItems, validUntil, ...quoteData } = req.body;
      const quote = await storage.createQuote({ 
        ...quoteData, 
        quoteNumber,
        validUntil: new Date(validUntil),
      });
      
      if (lineItems && Array.isArray(lineItems)) {
        for (const item of lineItems) {
          await storage.createQuoteLineItem({ ...item, quoteId: quote.id });
        }
      }
      
      res.json(quote);
    } catch (error: any) {
      console.error("Quote creation error:", error);
      res.status(500).json({ error: error.message || "Erreur serveur" });
    }
  });

  app.put("/api/superadmin/quotes/:id", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const { lineItems, validUntil, ...quoteData } = req.body;
      const quote = await storage.updateQuote(req.params.id, {
        ...quoteData,
        ...(validUntil && { validUntil: new Date(validUntil) }),
      });
      if (!quote) {
        return res.status(404).json({ error: "Devis non trouve" });
      }
      
      if (lineItems && Array.isArray(lineItems)) {
        await storage.deleteQuoteLineItems(req.params.id);
        for (const item of lineItems) {
          await storage.createQuoteLineItem({ ...item, quoteId: quote.id });
        }
      }
      
      res.json(quote);
    } catch (error) {
      console.error("Quote update error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.get("/api/superadmin/quotes/:id/pdf", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const quote = await storage.getQuoteById(req.params.id);
      if (!quote) {
        return res.status(404).json({ error: "Devis non trouve" });
      }
      const lineItems = await storage.getQuoteLineItems(req.params.id);
      const quoteWithItems = { ...quote, lineItems };
      
      const pdfBuffer = await generateQuotePdf(quoteWithItems);
      
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="Devis_${quote.quoteNumber}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Quote PDF generation error:", error);
      res.status(500).json({ error: "Erreur lors de la generation du PDF" });
    }
  });

  app.post("/api/superadmin/quotes/:id/send", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const { recipientEmail, customMessage } = req.body;
      
      const quote = await storage.getQuoteById(req.params.id);
      if (!quote) {
        return res.status(404).json({ error: "Devis non trouve" });
      }
      
      const email = recipientEmail || quote.clientEmail;
      if (!email) {
        return res.status(400).json({ error: "Email du destinataire requis" });
      }
      
      const lineItems = await storage.getQuoteLineItems(req.params.id);
      const quoteWithItems = { ...quote, lineItems };
      
      const pdfBuffer = await generateQuotePdf(quoteWithItems);
      
      const success = await sendQuoteEmail(
        email,
        quote.clientName || "",
        quote.quoteNumber,
        quote.total || 0,
        quote.validUntil,
        pdfBuffer,
        customMessage,
        quote.publicToken || undefined
      );
      
      if (!success) {
        return res.status(500).json({ error: "Erreur lors de l'envoi de l'email" });
      }
      
      await storage.updateQuote(req.params.id, { 
        status: quote.status === "DRAFT" ? "SENT" : quote.status,
        sentAt: new Date()
      });
      
      res.json({ success: true, message: `Devis envoye a ${email}` });
    } catch (error) {
      console.error("Quote send error:", error);
      res.status(500).json({ error: "Erreur lors de l'envoi du devis" });
    }
  });

  app.post("/api/superadmin/quotes/:id/generate-token", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const quote = await storage.getQuoteById(req.params.id);
      if (!quote) {
        return res.status(404).json({ error: "Devis non trouve" });
      }
      if (quote.publicToken) {
        return res.json({ publicToken: quote.publicToken, url: `/q/${quote.publicToken}` });
      }
      const token = await storage.generateQuotePublicToken(req.params.id);
      res.json({ publicToken: token, url: `/q/${token}` });
    } catch (error) {
      console.error("Token generation error:", error);
      res.status(500).json({ error: "Erreur lors de la generation du lien" });
    }
  });

  app.post("/api/superadmin/quotes/:id/mandate/approve", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const quote = await storage.getQuoteById(req.params.id);
      if (!quote) {
        return res.status(404).json({ error: "Devis non trouve" });
      }
      if (quote.administrativeMandateStatus !== "PENDING") {
        return res.status(400).json({ error: "Ce mandat n'est pas en attente de validation" });
      }
      const updated = await storage.updateQuote(req.params.id, {
        administrativeMandateStatus: "APPROVED",
      });
      res.json({ quote: updated, success: true });
    } catch (error) {
      console.error("Mandate approve error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.post("/api/superadmin/quotes/:id/mandate/reject", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const quote = await storage.getQuoteById(req.params.id);
      if (!quote) {
        return res.status(404).json({ error: "Devis non trouve" });
      }
      if (quote.administrativeMandateStatus !== "PENDING") {
        return res.status(400).json({ error: "Ce mandat n'est pas en attente de validation" });
      }
      const updated = await storage.updateQuote(req.params.id, {
        administrativeMandateStatus: "REJECTED",
      });
      res.json({ quote: updated, success: true });
    } catch (error) {
      console.error("Mandate reject error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.get("/api/superadmin/invoices", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const invoicesList = await storage.getAllInvoices();
      res.json(invoicesList);
    } catch (error) {
      console.error("Invoices list error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.get("/api/superadmin/invoices/:id", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const invoice = await storage.getInvoiceById(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: "Facture non trouvee" });
      }
      const lineItems = await storage.getInvoiceLineItems(req.params.id);
      res.json({ ...invoice, lineItems });
    } catch (error) {
      console.error("Invoice fetch error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.post("/api/superadmin/invoices", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const invoiceNumber = await storage.getNextInvoiceNumber();
      const { lineItems, ...invoiceData } = req.body;
      const invoice = await storage.createInvoice({ ...invoiceData, invoiceNumber });
      
      if (lineItems && Array.isArray(lineItems)) {
        for (const item of lineItems) {
          await storage.createInvoiceLineItem({ ...item, invoiceId: invoice.id });
        }
      }
      
      res.json(invoice);
    } catch (error: any) {
      console.error("Invoice creation error:", error);
      res.status(500).json({ error: error.message || "Erreur serveur" });
    }
  });

  app.post("/api/superadmin/invoices/from-quote/:quoteId", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const quote = await storage.getQuoteById(req.params.quoteId);
      if (!quote) {
        return res.status(404).json({ error: "Devis non trouve" });
      }
      
      const quoteLineItems = await storage.getQuoteLineItems(req.params.quoteId);
      const invoiceNumber = await storage.getNextInvoiceNumber();
      
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);
      
      const invoice = await storage.createInvoice({
        invoiceNumber,
        tenantId: quote.tenantId,
        quoteId: quote.id,
        clientName: quote.clientName,
        clientEmail: quote.clientEmail,
        clientAddress: quote.clientAddress,
        clientSiret: quote.clientSiret,
        emitterName: quote.emitterName,
        emitterAddress: quote.emitterAddress,
        emitterSiret: quote.emitterSiret,
        emitterTva: quote.emitterTva,
        subtotal: quote.subtotal,
        taxRate: quote.taxRate,
        taxAmount: quote.taxAmount,
        total: quote.total,
        dueDate,
        notes: quote.notes,
        status: "DRAFT",
      });
      
      for (const item of quoteLineItems) {
        await storage.createInvoiceLineItem({
          invoiceId: invoice.id,
          productId: item.productId,
          planId: item.planId,
          addonId: item.addonId,
          billingInterval: item.billingInterval,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
        });
      }
      
      await storage.updateQuote(quote.id, { status: "ACCEPTED", acceptedAt: new Date() });
      
      res.json(invoice);
    } catch (error: any) {
      console.error("Invoice from quote error:", error);
      res.status(500).json({ error: error.message || "Erreur serveur" });
    }
  });

  app.put("/api/superadmin/invoices/:id", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const { lineItems, ...invoiceData } = req.body;
      const invoice = await storage.updateInvoice(req.params.id, invoiceData);
      if (!invoice) {
        return res.status(404).json({ error: "Facture non trouvee" });
      }
      
      if (lineItems && Array.isArray(lineItems)) {
        await storage.deleteInvoiceLineItems(req.params.id);
        for (const item of lineItems) {
          await storage.createInvoiceLineItem({ ...item, invoiceId: invoice.id });
        }
      }
      
      res.json(invoice);
    } catch (error) {
      console.error("Invoice update error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.get("/api/superadmin/invoices/:id/pdf", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const invoice = await storage.getInvoiceById(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: "Facture non trouvee" });
      }
      const lineItems = await storage.getInvoiceLineItems(req.params.id);
      const invoiceWithItems = { ...invoice, lineItems };
      
      const pdfBuffer = await generateInvoicePdf(invoiceWithItems);
      
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="Facture_${invoice.invoiceNumber}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Invoice PDF generation error:", error);
      res.status(500).json({ error: "Erreur lors de la generation du PDF" });
    }
  });

  app.post("/api/superadmin/invoices/:id/send", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const { recipientEmail, customMessage } = req.body;
      
      const invoice = await storage.getInvoiceById(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: "Facture non trouvee" });
      }
      
      const email = recipientEmail || invoice.clientEmail;
      if (!email) {
        return res.status(400).json({ error: "Email du destinataire requis" });
      }
      
      const lineItems = await storage.getInvoiceLineItems(req.params.id);
      const invoiceWithItems = { ...invoice, lineItems };
      
      const pdfBuffer = await generateInvoicePdf(invoiceWithItems);
      
      const success = await sendInvoiceEmail(
        email,
        invoice.clientName || "",
        invoice.invoiceNumber,
        invoice.total || 0,
        invoice.dueDate,
        pdfBuffer,
        customMessage
      );
      
      if (!success) {
        return res.status(500).json({ error: "Erreur lors de l'envoi de l'email" });
      }
      
      await storage.updateInvoice(req.params.id, { 
        status: invoice.status === "DRAFT" ? "SENT" : invoice.status,
        sentAt: new Date()
      });
      
      res.json({ success: true, message: `Facture envoyee a ${email}` });
    } catch (error) {
      console.error("Invoice send error:", error);
      res.status(500).json({ error: "Erreur lors de l'envoi de la facture" });
    }
  });

  app.get("/api/superadmin/payments", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const paymentsList = await storage.getAllPayments();
      res.json(paymentsList);
    } catch (error) {
      console.error("Payments list error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.post("/api/superadmin/payments", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const parsed = insertPaymentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Donnees invalides", details: parsed.error.flatten() });
      }
      
      const payment = await storage.createPayment(parsed.data);
      
      if (parsed.data.status === "COMPLETED" && parsed.data.invoiceId) {
        await storage.updateInvoice(parsed.data.invoiceId, { 
          status: "PAID", 
          paidAt: new Date() 
        });
      }
      
      res.json(payment);
    } catch (error: any) {
      console.error("Payment creation error:", error);
      res.status(500).json({ error: error.message || "Erreur serveur" });
    }
  });

  app.put("/api/superadmin/payments/:id", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const payment = await storage.updatePayment(req.params.id, req.body);
      if (!payment) {
        return res.status(404).json({ error: "Paiement non trouve" });
      }
      
      if (req.body.status === "COMPLETED" && payment.invoiceId) {
        await storage.updateInvoice(payment.invoiceId, { 
          status: "PAID", 
          paidAt: new Date() 
        });
      }
      
      res.json(payment);
    } catch (error) {
      console.error("Payment update error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ==========================================
  // MANDATE MANAGEMENT (Superadmin)
  // ==========================================

  app.get("/api/superadmin/mandate-orders", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const orders = await storage.getAllMandateOrders();
      res.json(orders);
    } catch (error) {
      console.error("Mandate orders list error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.get("/api/superadmin/mandate-orders/:id", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const order = await storage.getMandateOrderById(req.params.id);
      if (!order) {
        return res.status(404).json({ error: "Commande non trouvee" });
      }
      const tenant = order.tenantId ? await storage.getTenantById(order.tenantId) : null;
      const documents = await storage.getMandateDocumentsByOrder(order.id);
      const activities = await storage.getMandateActivitiesByOrder(order.id);
      res.json({ order, tenant, documents, activities });
    } catch (error) {
      console.error("Mandate order details error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.put("/api/superadmin/mandate-orders/:id/validate", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const order = await storage.getMandateOrderById(req.params.id);
      if (!order) {
        return res.status(404).json({ error: "Commande non trouvee" });
      }

      // State guard: only allow validation from PENDING_VALIDATION or PENDING_BC
      const allowedStatuses = ["PENDING_VALIDATION", "PENDING_BC"];
      if (!allowedStatuses.includes(order.status)) {
        return res.status(400).json({ 
          error: `La commande ne peut pas etre validee depuis le statut ${order.status}` 
        });
      }

      const hasBc = req.body.hasPurchaseOrder === true;
      const newStatus = hasBc ? "ACCEPTED" : "PENDING_BC";
      
      // Generate BC number when accepting the order
      let commandeNumber: string | undefined;
      if (hasBc) {
        commandeNumber = await storage.generateDocumentNumber('COMMANDE');
      }

      const updated = await storage.updateMandateOrderStatus(order.id, newStatus, {
        validatedBy: req.session.superadminId,
        commandeNumber
      });

      if (order.tenantId) {
        const bcInfo = commandeNumber ? ` - Numéro BC: ${commandeNumber}` : "";
        await storage.createMandateActivity({
          tenantId: order.tenantId,
          orderId: order.id,
          activityType: "ORDER_VALIDATED",
          title: hasBc ? "Commande acceptée" : "Commande validée - en attente BC",
          description: `Devis ${order.orderNumber} validé par superadmin${bcInfo}`,
          oldValue: order.status,
          newValue: newStatus,
          performedBy: req.session.superadminId,
          performedByType: "superadmin",
        });
      }

      if (hasBc && order.tenantId) {
        // Create subscription and activate tenant
        const startDate = new Date();
        const endDate = new Date();
        endDate.setFullYear(endDate.getFullYear() + 1);

        const subscription = await storage.createMandateSubscription({
          tenantId: order.tenantId,
          orderId: order.id,
          planId: order.planId,
          status: "ACTIVE",
          startDate,
          endDate,
        });
        
        // Update with activation info
        await storage.updateMandateSubscription(subscription.id, {
          activatedAt: new Date(),
          activatedBy: req.session.superadminId,
        });

        // Update tenant billing status without changing the subscription plan
        await storage.updateTenantBillingStatus(order.tenantId, "ACTIVE");

        await storage.createMandateActivity({
          tenantId: order.tenantId,
          orderId: order.id,
          subscriptionId: subscription.id,
          activityType: "SUBSCRIPTION_ACTIVATED",
          title: "Abonnement activé",
          description: `Abonnement activé du ${startDate.toLocaleDateString('fr-FR')} au ${endDate.toLocaleDateString('fr-FR')}`,
          performedBy: req.session.superadminId,
          performedByType: "superadmin",
        });
      }

      res.json(updated);
    } catch (error) {
      console.error("Mandate order validation error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.put("/api/superadmin/mandate-orders/:id/reject", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const order = await storage.getMandateOrderById(req.params.id);
      if (!order) {
        return res.status(404).json({ error: "Commande non trouvee" });
      }

      // State guard: only allow rejection from PENDING_VALIDATION or PENDING_BC
      const allowedStatuses = ["PENDING_VALIDATION", "PENDING_BC"];
      if (!allowedStatuses.includes(order.status)) {
        return res.status(400).json({ 
          error: `La commande ne peut pas etre rejetee depuis le statut ${order.status}` 
        });
      }

      const updated = await storage.updateMandateOrderStatus(order.id, "REJECTED", {
        rejectionReason: req.body.reason || "Aucune raison fournie"
      });

      if (order.tenantId) {
        await storage.createMandateActivity({
          tenantId: order.tenantId,
          orderId: order.id,
          activityType: "ORDER_REJECTED",
          title: "Commande rejetée",
          description: req.body.reason || "Commande rejetée sans raison spécifiée",
          oldValue: order.status,
          newValue: "REJECTED",
          performedBy: req.session.superadminId,
          performedByType: "superadmin",
        });
      }

      res.json(updated);
    } catch (error) {
      console.error("Mandate order rejection error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.get("/api/superadmin/mandate-invoices", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const invoicesList = await storage.getAllMandateInvoices();
      res.json(invoicesList);
    } catch (error) {
      console.error("Mandate invoices list error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.post("/api/superadmin/mandate-orders/:id/generate-invoice", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const order = await storage.getMandateOrderById(req.params.id);
      if (!order) {
        return res.status(404).json({ error: "Commande non trouvee" });
      }

      if (order.status !== "ACCEPTED") {
        return res.status(400).json({ error: "La commande doit etre acceptee pour generer une facture" });
      }

      if (!order.tenantId) {
        return res.status(400).json({ error: "La commande n'est associee a aucun tenant" });
      }

      const subscription = await storage.getMandateSubscriptionByTenant(order.tenantId);
      if (!subscription) {
        return res.status(400).json({ error: "Aucun abonnement trouve pour ce tenant" });
      }

      const companySettings = await storage.getCompanySettings();
      const invoiceNumber = await storage.generateInvoiceNumber();

      // Calculate addons amount from snapshot
      let addonsAmount = 0;
      if (order.addonsSnapshot) {
        try {
          const addons = JSON.parse(order.addonsSnapshot);
          if (Array.isArray(addons)) {
            addonsAmount = addons.reduce((sum: number, a: any) => sum + (a.totalPrice || 0), 0);
          }
        } catch {}
      }
      
      const invoice = await storage.createMandateInvoice({
        invoiceNumber,
        orderId: order.id,
        subscriptionId: subscription.id,
        tenantId: order.tenantId,
        status: "DRAFT",
        planAmount: order.planAmount || 0,
        addonsAmount,
        addonsSnapshot: order.addonsSnapshot || null,
        subtotal: order.annualAmount,
        discountAmount: order.discountAmount || 0,
        totalAmount: order.finalAmount,
        periodStart: subscription.startDate,
        periodEnd: subscription.endDate,
        clientName: order.clientName,
        clientSiret: order.clientSiret,
        clientAddress: order.clientAddress || null,
        billingService: order.billingService || null,
        purchaseOrderNumber: order.purchaseOrderNumber || null,
        engagementNumber: order.engagementNumber || null,
        serviceCode: order.serviceCode || null,
        emitterName: companySettings?.companyName || "Voxpopulous",
        emitterAddress: companySettings?.address || null,
        emitterSiret: companySettings?.siret || null,
        emitterTva: companySettings?.tvaNumber || null,
        emitterIban: companySettings?.iban || null,
        emitterBic: companySettings?.bic || null,
        paymentTerms: companySettings?.paymentTerms || "Paiement a 30 jours",
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      });

      // Transition order status to INVOICED
      await storage.updateMandateOrderStatus(order.id, "INVOICED");

      if (order.tenantId) {
        await storage.createMandateActivity({
          tenantId: order.tenantId,
          orderId: order.id,
          invoiceId: invoice.id,
          activityType: "INVOICE_GENERATED",
          title: "Facture générée",
          description: `Facture ${invoiceNumber} générée pour ${order.finalAmount.toFixed(2)}€`,
          oldValue: "ACCEPTED",
          newValue: "INVOICED",
          performedBy: req.session.superadminId,
          performedByType: "superadmin",
        });

        // Schedule reminders at J+35, J+50, J+65
        const dueDateMs = invoice.dueDate.getTime();
        const reminderDays = [35, 50, 65];
        for (let i = 0; i < reminderDays.length; i++) {
          const scheduledFor = new Date(dueDateMs + reminderDays[i] * 24 * 60 * 60 * 1000);
          await storage.createMandateReminder({
            invoiceId: invoice.id,
            tenantId: order.tenantId,
            reminderLevel: i + 1,
            scheduledFor,
          });
        }
      }

      res.json(invoice);
    } catch (error) {
      console.error("Invoice generation error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.put("/api/superadmin/mandate-invoices/:id/status", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const { status } = req.body;
      if (!["SENT", "MANDATED", "PAID", "CANCELLED"].includes(status)) {
        return res.status(400).json({ error: "Statut invalide" });
      }

      const invoice = await storage.getMandateInvoiceById(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: "Facture non trouvee" });
      }

      const updates: any = { status };
      if (status === "SENT") updates.sentAt = new Date();
      if (status === "MANDATED") updates.mandatedAt = new Date();
      if (status === "PAID") {
        updates.paidAt = new Date();
        updates.paymentReference = req.body.paymentReference || null;
      }

      const updated = await storage.updateMandateInvoice(invoice.id, updates);

      if (invoice.tenantId) {
        await storage.createMandateActivity({
          tenantId: invoice.tenantId,
          invoiceId: invoice.id,
          activityType: status === "PAID" ? "PAYMENT_RECEIVED" : "STATUS_CHANGED",
          title: status === "PAID" ? "Paiement reçu" : `Statut changé: ${status}`,
          description: `Facture ${invoice.invoiceNumber} - statut: ${status}`,
          oldValue: invoice.status,
          newValue: status,
          performedBy: req.session.superadminId,
          performedByType: "superadmin",
        });
      }

      res.json(updated);
    } catch (error) {
      console.error("Invoice status update error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.get("/api/superadmin/mandate-activities", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const tenantId = req.query.tenantId as string;
      if (!tenantId) {
        return res.status(400).json({ error: "tenantId requis" });
      }
      const activities = await storage.getMandateActivitiesByTenant(tenantId);
      res.json(activities);
    } catch (error) {
      console.error("Mandate activities error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // PDF Download endpoints for mandate orders and invoices
  app.get("/api/superadmin/mandate-orders/:id/pdf", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const order = await storage.getMandateOrderById(req.params.id);
      if (!order) {
        return res.status(404).json({ error: "Commande non trouvee" });
      }
      
      const [plan, settings, tenant] = await Promise.all([
        storage.getSubscriptionPlanById(order.planId),
        storage.getCompanySettings(),
        order.tenantId ? storage.getTenantById(order.tenantId) : Promise.resolve(undefined)
      ]);
      
      // Use stored addonsSnapshot from order if available, otherwise fallback to tenant data
      let addonsWithQuantity: any[] = [];
      if (order.addonsSnapshot) {
        try {
          const snapshot = JSON.parse(order.addonsSnapshot);
          addonsWithQuantity = snapshot.map((s: any) => ({
            id: s.id,
            name: s.name,
            code: s.code,
            defaultYearlyPrice: s.unitPrice, // already in euros
            quantity: s.quantity
          }));
        } catch (e) { /* ignore parse errors */ }
      }
      
      const orderWithPlan = { 
        ...order, 
        plan: plan || undefined,
        tenantType: tenant?.tenantType,
        addons: addonsWithQuantity
      };
      
      const pdfBuffer = await generateMandateOrderPdf(orderWithPlan, settings);
      
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${order.orderNumber}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Mandate order PDF error:", error);
      res.status(500).json({ error: "Erreur lors de la generation du PDF" });
    }
  });

  app.get("/api/superadmin/mandate-invoices/:id/pdf", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const invoice = await storage.getMandateInvoiceById(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: "Facture non trouvee" });
      }
      
      const settings = await storage.getCompanySettings();
      
      let plan = null;
      let tenantType: "MAIRIE" | "EPCI" | "ASSOCIATION" | undefined;
      let addonsWithQuantity: any[] = [];
      
      if (invoice.orderId) {
        const order = await storage.getMandateOrderById(invoice.orderId);
        if (order) {
          const [fetchedPlan, tenant] = await Promise.all([
            storage.getSubscriptionPlanById(order.planId),
            order.tenantId ? storage.getTenantById(order.tenantId) : Promise.resolve(undefined)
          ]);
          plan = fetchedPlan;
          tenantType = tenant?.tenantType;
          
          // Use stored addonsSnapshot from invoice or order
          const snapshotSource = invoice.addonsSnapshot || order.addonsSnapshot;
          if (snapshotSource) {
            try {
              const snapshot = JSON.parse(snapshotSource);
              addonsWithQuantity = snapshot.map((s: any) => ({
                id: s.id,
                name: s.name,
                code: s.code,
                defaultYearlyPrice: s.unitPrice, // already in euros
                quantity: s.quantity
              }));
            } catch (e) { /* ignore parse errors */ }
          }
        }
      }
      
      const invoiceWithPlan = { 
        ...invoice, 
        plan: plan || undefined,
        tenantType,
        addons: addonsWithQuantity
      };
      
      const pdfBuffer = await generateMandateInvoicePdf(invoiceWithPlan, settings);
      
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${invoice.invoiceNumber}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Mandate invoice PDF error:", error);
      res.status(500).json({ error: "Erreur lors de la generation du PDF" });
    }
  });

  // ==========================================
  // DELETE MANDATE ORDERS/INVOICES (Superadmin)
  // ==========================================

  app.delete("/api/superadmin/mandate-orders/:id", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const order = await storage.getMandateOrderById(req.params.id);
      if (!order) {
        return res.status(404).json({ error: "Commande non trouvee" });
      }
      
      // Check if already deleted
      if (order.isDeleted) {
        return res.status(409).json({ error: "Cette commande a deja ete supprimee" });
      }
      
      // Soft delete the order
      await storage.softDeleteMandateOrder(order.id, req.session.superadminId);
      
      // Get superadmin name for audit log
      const superadmin = await storage.getSuperadminById(req.session.superadminId);
      
      // Create audit log
      await storage.createAuditLog({
        actorId: req.session.superadminId,
        actorType: "SUPERADMIN",
        actorName: superadmin?.name || "Superadmin",
        actionType: "DELETE_MANDATE_ORDER",
        targetType: "mandate_order",
        targetId: order.id,
        targetName: order.orderNumber,
        metadata: JSON.stringify({
          clientName: order.clientName,
          clientSiret: order.clientSiret,
          status: order.status,
          finalAmount: order.finalAmount
        })
      });
      
      res.json({ success: true, message: "Commande supprimee" });
    } catch (error) {
      console.error("Delete mandate order error:", error);
      res.status(500).json({ error: "Erreur lors de la suppression" });
    }
  });

  app.delete("/api/superadmin/mandate-invoices/:id", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const invoice = await storage.getMandateInvoiceById(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: "Facture non trouvee" });
      }
      
      // Check if already deleted
      if (invoice.isDeleted) {
        return res.status(409).json({ error: "Cette facture a deja ete supprimee" });
      }
      
      // Soft delete the invoice
      await storage.softDeleteMandateInvoice(invoice.id, req.session.superadminId);
      
      // Get superadmin name for audit log
      const superadmin = await storage.getSuperadminById(req.session.superadminId);
      
      // Create audit log
      await storage.createAuditLog({
        actorId: req.session.superadminId,
        actorType: "SUPERADMIN",
        actorName: superadmin?.name || "Superadmin",
        actionType: "DELETE_MANDATE_INVOICE",
        targetType: "mandate_invoice",
        targetId: invoice.id,
        targetName: invoice.invoiceNumber,
        metadata: JSON.stringify({
          clientName: invoice.clientName,
          clientSiret: invoice.clientSiret,
          status: invoice.status,
          totalAmount: invoice.totalAmount
        })
      });
      
      res.json({ success: true, message: "Facture supprimee" });
    } catch (error) {
      console.error("Delete mandate invoice error:", error);
      res.status(500).json({ error: "Erreur lors de la suppression" });
    }
  });

  // ==========================================
  // AUDIT LOGS (Superadmin)
  // ==========================================

  app.get("/api/superadmin/audit-logs", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const { actionType, actorId, targetType, limit = "50", offset = "0" } = req.query;
      
      const filters = {
        actionType: actionType as string | undefined,
        actorId: actorId as string | undefined,
        targetType: targetType as string | undefined,
        limit: parseInt(limit as string) || 50,
        offset: parseInt(offset as string) || 0,
      };
      
      const [logs, total] = await Promise.all([
        storage.getAuditLogs(filters),
        storage.getAuditLogsCount({ actionType: filters.actionType, actorId: filters.actorId, targetType: filters.targetType })
      ]);
      
      res.json({ logs, total, limit: filters.limit, offset: filters.offset });
    } catch (error) {
      console.error("Audit logs error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ==========================================
  // STRIPE BILLING TRACKING (Superadmin)
  // ==========================================

  app.get("/api/superadmin/stripe/subscriptions", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const result = await db.execute(sql`
        SELECT 
          s.id,
          s.customer,
          s.status,
          s.current_period_start,
          s.current_period_end,
          s.cancel_at_period_end,
          s.canceled_at,
          s.metadata,
          s._updated_at as updated_at,
          c.email as customer_email,
          c.name as customer_name,
          c.metadata as customer_metadata
        FROM stripe.subscriptions s
        LEFT JOIN stripe.customers c ON s.customer = c.id
        ORDER BY s._updated_at DESC
      `);
      res.json(result.rows);
    } catch (error) {
      console.error("Stripe subscriptions error:", error);
      res.status(500).json({ error: "Erreur lors de la recuperation des abonnements Stripe" });
    }
  });

  app.get("/api/superadmin/stripe/invoices", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const result = await db.execute(sql`
        SELECT 
          i.id,
          i.customer,
          i.status,
          i.amount_due,
          i.amount_paid,
          i.total,
          i.currency,
          i.period_start,
          i.period_end,
          i.hosted_invoice_url,
          i.metadata,
          i._updated_at as updated_at,
          c.email as customer_email,
          c.name as customer_name,
          c.metadata as customer_metadata
        FROM stripe.invoices i
        LEFT JOIN stripe.customers c ON i.customer = c.id
        ORDER BY i._updated_at DESC
      `);
      res.json(result.rows);
    } catch (error) {
      console.error("Stripe invoices error:", error);
      res.status(500).json({ error: "Erreur lors de la recuperation des factures Stripe" });
    }
  });

  app.get("/api/superadmin/stripe/payments", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const result = await db.execute(sql`
        SELECT 
          pi.id,
          pi.customer,
          pi.status,
          pi.amount,
          pi.currency,
          pi.payment_method,
          pi.metadata,
          pi._updated_at as updated_at,
          c.email as customer_email,
          c.name as customer_name
        FROM stripe.payment_intents pi
        LEFT JOIN stripe.customers c ON pi.customer = c.id
        ORDER BY pi._updated_at DESC
      `);
      res.json(result.rows);
    } catch (error) {
      console.error("Stripe payments error:", error);
      res.status(500).json({ error: "Erreur lors de la recuperation des paiements Stripe" });
    }
  });

  // ==========================================
  // CLIENT SUBSCRIPTIONS TRACKING (Superadmin)
  // ==========================================

  app.get("/api/superadmin/client-subscriptions", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const subscriptions: any[] = [];

      // Get Stripe subscriptions
      try {
        const stripeResult = await db.execute(sql`
          SELECT 
            s.id as stripe_subscription_id,
            s.customer,
            s.status,
            s.current_period_start,
            s.current_period_end,
            c.metadata as customer_metadata
          FROM stripe.subscriptions s
          LEFT JOIN stripe.customers c ON s.customer = c.id
          WHERE s.status IN ('active', 'trialing', 'past_due')
        `);

        for (const row of stripeResult.rows) {
          const metadata = row.customer_metadata as { tenantId?: string } | null;
          const tenantId = metadata?.tenantId;
          if (tenantId) {
            const tenant = await storage.getTenantById(tenantId);
            if (tenant) {
              const plan = tenant.subscriptionPlanId ? await storage.getSubscriptionPlanById(tenant.subscriptionPlanId) : null;
              const periodStart = row.current_period_start as number | null;
              const periodEnd = row.current_period_end as number | null;
              const startDate = periodStart ? new Date(periodStart * 1000) : null;
              const endDate = periodEnd ? new Date(periodEnd * 1000) : null;
              const daysRemaining = endDate ? Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

              subscriptions.push({
                tenantId: tenant.id,
                tenantName: tenant.name,
                tenantSlug: tenant.slug,
                paymentType: "STRIPE",
                planName: plan?.name || "N/A",
                status: row.status,
                startDate: startDate?.toISOString() || null,
                endDate: endDate?.toISOString() || null,
                durationMonths: 1,
                daysRemaining,
                renewalReminderSent: false,
                nextReminderDate: null,
                stripeSubscriptionId: row.stripe_subscription_id,
              });
            }
          }
        }
      } catch (stripeError) {
        console.error("Error fetching Stripe subscriptions:", stripeError);
      }

      // Get mandate subscriptions
      const mandateSubs = await storage.getAllMandateSubscriptions();
      for (const ms of mandateSubs) {
        const tenant = await storage.getTenantById(ms.tenantId);
        if (tenant) {
          const plan = ms.planId ? await storage.getSubscriptionPlanById(ms.planId) : null;
          const daysRemaining = ms.endDate ? Math.ceil((new Date(ms.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

          subscriptions.push({
            tenantId: tenant.id,
            tenantName: tenant.name,
            tenantSlug: tenant.slug,
            paymentType: "MANDATE",
            planName: plan?.name || "N/A",
            status: ms.status,
            startDate: ms.startDate?.toISOString() || null,
            endDate: ms.endDate?.toISOString() || null,
            durationMonths: 12,
            daysRemaining,
            renewalReminderSent: !!ms.renewalReminderSentAt,
            nextReminderDate: null,
            mandateSubscriptionId: ms.id,
          });
        }
      }

      // Sort by days remaining (ascending, most urgent first)
      subscriptions.sort((a, b) => {
        if (a.daysRemaining === null && b.daysRemaining === null) return 0;
        if (a.daysRemaining === null) return 1;
        if (b.daysRemaining === null) return -1;
        return a.daysRemaining - b.daysRemaining;
      });

      res.json(subscriptions);
    } catch (error) {
      console.error("Client subscriptions error:", error);
      res.status(500).json({ error: "Erreur lors de la recuperation des abonnements" });
    }
  });

  app.get("/api/superadmin/renewal-reminders", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const reminders = await storage.getAllMandateReminders();
      const result = [];
      
      for (const reminder of reminders) {
        // Only return renewal reminders (type RENEWAL)
        if (reminder.reminderType !== "RENEWAL") continue;
        
        const tenant = await storage.getTenantById(reminder.tenantId);
        const subscription = reminder.subscriptionId 
          ? await storage.getMandateSubscriptionById(reminder.subscriptionId) 
          : null;
        
        result.push({
          id: reminder.id,
          tenantId: reminder.tenantId,
          tenantName: tenant?.name || "Inconnu",
          subscriptionId: reminder.subscriptionId || null,
          reminderLevel: reminder.reminderLevel,
          scheduledFor: reminder.scheduledFor?.toISOString() || null,
          sentAt: reminder.sentAt?.toISOString() || null,
          emailTo: reminder.emailTo || "",
          subscriptionEndDate: subscription?.endDate?.toISOString() || null,
        });
      }

      // Sort by scheduled date
      result.sort((a, b) => {
        if (!a.scheduledFor && !b.scheduledFor) return 0;
        if (!a.scheduledFor) return 1;
        if (!b.scheduledFor) return -1;
        return new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime();
      });

      res.json(result);
    } catch (error) {
      console.error("Renewal reminders error:", error);
      res.status(500).json({ error: "Erreur lors de la recuperation des relances" });
    }
  });

  app.post("/api/superadmin/generate-renewal-reminders", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const mandateSubs = await storage.getAllMandateSubscriptions();
      let created = 0;

      for (const sub of mandateSubs) {
        if (sub.status !== "ACTIVE" || !sub.endDate) continue;

        const tenant = await storage.getTenantById(sub.tenantId);
        if (!tenant) continue;

        // Get tenant admin email from billing preferences or first admin user
        const billingPrefs = await storage.getTenantBillingPreferences(tenant.id);
        const emailTo = billingPrefs?.accountingContactEmail || "";

        const endDate = new Date(sub.endDate);
        const now = new Date();
        const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        // Generate reminders at J-60, J-30, J-15
        const reminderLevels = [
          { level: 1, daysBeforeEnd: 60 },
          { level: 2, daysBeforeEnd: 30 },
          { level: 3, daysBeforeEnd: 15 },
        ];

        for (const { level, daysBeforeEnd } of reminderLevels) {
          if (daysRemaining <= daysBeforeEnd) {
            // Check if a renewal reminder already exists for this subscription and level
            const existingReminder = await storage.getRenewalReminderBySubscriptionAndLevel(sub.id, level);
            if (!existingReminder) {
              const scheduledFor = new Date(endDate);
              scheduledFor.setDate(scheduledFor.getDate() - daysBeforeEnd);
              
              await storage.createMandateReminder({
                tenantId: tenant.id,
                subscriptionId: sub.id,
                reminderType: "RENEWAL",
                reminderLevel: level, // 1, 2, 3 for J-60, J-30, J-15
                scheduledFor,
                emailTo,
                emailSubject: `Renouvellement ${level === 1 ? "J-60" : level === 2 ? "J-30" : "J-15"} - ${tenant.name}`,
              });
              created++;
            }
          }
        }
      }

      res.json({ created, message: `${created} relances generees` });
    } catch (error) {
      console.error("Generate renewal reminders error:", error);
      res.status(500).json({ error: "Erreur lors de la generation des relances" });
    }
  });

  app.post("/api/superadmin/renewal-reminders/:id/send", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const reminder = await storage.getMandateReminderById(req.params.id);
      if (!reminder) {
        return res.status(404).json({ error: "Relance non trouvee" });
      }

      // Verify this is a renewal reminder
      if (reminder.reminderType !== "RENEWAL") {
        return res.status(400).json({ error: "Cette relance n'est pas une relance de renouvellement" });
      }

      const tenant = await storage.getTenantById(reminder.tenantId);
      if (!tenant) {
        return res.status(404).json({ error: "Client non trouve" });
      }

      // Get the subscription linked to this reminder (require subscriptionId for renewal reminders)
      if (!reminder.subscriptionId) {
        return res.status(400).json({ error: "Relance sans abonnement associe" });
      }
      const subscription = await storage.getMandateSubscriptionById(reminder.subscriptionId);
      if (!subscription) {
        return res.status(404).json({ error: "Abonnement non trouve" });
      }

      // Send renewal reminder email
      if (reminder.emailTo) {
        const endDate = subscription.endDate ? new Date(subscription.endDate).toLocaleDateString("fr-FR") : "N/A";
        const levelText = reminder.reminderLevel === 1 ? "J-60" : reminder.reminderLevel === 2 ? "J-30" : "J-15";

        await sendRenewalReminderEmail(
          reminder.emailTo,
          tenant.name,
          endDate,
          levelText
        );
      }

      // Mark reminder as sent
      await storage.updateMandateReminder(reminder.id, {
        sentAt: new Date(),
      });

      // Log activity
      await storage.createMandateActivity({
        tenantId: tenant.id,
        orderId: null,
        subscriptionId: subscription.id,
        activityType: "REMINDER_SENT",
        title: `Relance de renouvellement envoyee (${reminder.reminderLevel === 1 ? "J-60" : reminder.reminderLevel === 2 ? "J-30" : "J-15"})`,
        description: `Relance envoyee a ${reminder.emailTo}`,
        performedBy: req.session.superadminId,
        performedByType: "superadmin",
      });

      res.json({ success: true, message: "Relance envoyee" });
    } catch (error) {
      console.error("Send renewal reminder error:", error);
      res.status(500).json({ error: "Erreur lors de l'envoi de la relance" });
    }
  });

  // Generate renewal order for a mandate subscription
  app.post("/api/superadmin/generate-renewal-order/:subscriptionId", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const subscription = await storage.getMandateSubscriptionById(req.params.subscriptionId);
      if (!subscription) {
        return res.status(404).json({ error: "Abonnement non trouve" });
      }

      // Check if renewal order already exists
      if (subscription.renewalOrderId) {
        return res.status(400).json({ error: "Un bon de commande de renouvellement existe deja" });
      }

      const tenant = await storage.getTenantById(subscription.tenantId);
      if (!tenant) {
        return res.status(404).json({ error: "Client non trouve" });
      }

      const plan = await storage.getSubscriptionPlanById(subscription.planId);
      if (!plan) {
        return res.status(404).json({ error: "Plan non trouve" });
      }

      // Get billing preferences and original order
      const billingPrefs = await storage.getTenantBillingPreferences(tenant.id);
      const originalOrder = await storage.getMandateOrderById(subscription.orderId);

      // Calculate amounts with addons
      const planAmount = plan.yearlyPrice;
      
      // Calculate addons from tenant quantities
      const allAddons = await storage.getAllAddons();
      const addonsSnapshot: { id: string; code: string; name: string; quantity: number; unitPrice: number; totalPrice: number }[] = [];
      let addonsAmount = 0;
      
      for (const addon of allAddons) {
        let quantity = 0;
        if (addon.code === "ADMIN" && tenant.purchasedAdmins && tenant.purchasedAdmins > 0) quantity = tenant.purchasedAdmins;
        else if (addon.code === "ASSOCIATIONS" && tenant.purchasedAssociations && tenant.purchasedAssociations > 0) quantity = tenant.purchasedAssociations;
        else if (addon.code === "MAIRIES" && tenant.purchasedCommunes && tenant.purchasedCommunes > 0) quantity = tenant.purchasedCommunes;
        
        if (quantity > 0) {
          // Administrative mandate renewals are always yearly - use yearly price (stored in euros)
          const unitPrice = addon.defaultYearlyPrice || 0;
          const totalPrice = unitPrice * quantity;
          addonsSnapshot.push({
            id: addon.id,
            code: addon.code,
            name: addon.name,
            quantity,
            unitPrice,
            totalPrice
          });
          addonsAmount += totalPrice;
        }
      }
      
      const annualAmount = planAmount + addonsAmount;
      const discountAmount = 0; // No discount for renewals
      const finalAmount = annualAmount;

      // Generate new order number
      const orderNumber = await storage.generateOrderNumber();

      // Create renewal order (use original order's SIRET or tenant's SIRET)
      const renewalOrder = await storage.createMandateOrder({
        orderNumber,
        tenantId: tenant.id,
        planId: subscription.planId,
        status: "PENDING_VALIDATION",
        billingCycle: "YEARLY",
        planAmount,
        addonsAmount,
        addonsSnapshot: addonsSnapshot.length > 0 ? JSON.stringify(addonsSnapshot) : null,
        annualAmount,
        discountAmount,
        finalAmount,
        clientName: tenant.name,
        clientSiret: originalOrder?.clientSiret || tenant.siret || "",
        clientAddress: billingPrefs?.billingAddress || null,
        billingService: billingPrefs?.billingService || null,
        accountingContactName: billingPrefs?.accountingContactName || null,
        accountingContactEmail: billingPrefs?.accountingContactEmail || null,
        accountingContactPhone: billingPrefs?.accountingContactPhone || null,
        purchaseOrderNumber: null,
        engagementNumber: billingPrefs?.engagementNumber || null,
        serviceCode: billingPrefs?.serviceCode || null,
        useChorusPro: billingPrefs?.useChorusPro || false,
        chorusProRecipientSiret: billingPrefs?.chorusProRecipientSiret || null,
        chorusProServiceCode: billingPrefs?.chorusProServiceCode || null,
      });

      // Update subscription with renewal order ID
      await storage.updateMandateSubscription(subscription.id, {
        renewalOrderId: renewalOrder.id,
      });

      // Log activity
      await storage.createMandateActivity({
        tenantId: tenant.id,
        orderId: renewalOrder.id,
        subscriptionId: subscription.id,
        activityType: "RENEWAL_INITIATED",
        title: "Renouvellement initie",
        description: `Bon de commande de renouvellement ${orderNumber} genere`,
        performedBy: req.session.superadminId,
        performedByType: "superadmin",
      });

      res.json({ 
        success: true, 
        orderId: renewalOrder.id,
        orderNumber: renewalOrder.orderNumber,
        message: `Bon de commande de renouvellement ${orderNumber} genere` 
      });
    } catch (error) {
      console.error("Generate renewal order error:", error);
      res.status(500).json({ error: "Erreur lors de la generation du bon de commande" });
    }
  });

  // ==========================================
  // ACTIVITY TRACKING & DEVICE MANAGEMENT
  // ==========================================
  
  // Get all activity logs (superadmin only)
  app.get("/api/superadmin/activity-logs", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      const logs = await storage.getActivityLogs(limit, offset);
      const total = await storage.getActivityLogsCount();
      res.json({ logs, total, limit, offset });
    } catch (error) {
      console.error("Activity logs error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Get activity logs for a specific device
  app.get("/api/superadmin/activity-logs/device/:deviceId", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const logs = await storage.getActivityLogsByDeviceId(req.params.deviceId);
      res.json(logs);
    } catch (error) {
      console.error("Device activity logs error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Get all blocked devices
  app.get("/api/superadmin/blocked-devices", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const devices = await storage.getAllBlockedDevices();
      res.json(devices);
    } catch (error) {
      console.error("Blocked devices error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Block a device
  app.post("/api/superadmin/devices/:deviceId/block", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const { deviceId } = req.params;
      const { reason } = req.body;
      
      // Get superadmin info
      const superadmin = await storage.getSuperadminById(req.session.superadminId);
      
      // Get the last activity for this device to get additional info
      const deviceLogs = await storage.getActivityLogsByDeviceId(deviceId);
      const lastLog = deviceLogs[0];
      
      // Check if already blocked
      const existingBlock = await storage.getBlockedDeviceByDeviceId(deviceId);
      if (existingBlock) {
        return res.status(400).json({ error: "Appareil deja bloque" });
      }
      
      const blocked = await storage.createBlockedDevice({
        deviceId,
        reason: reason || "Bloque par superadmin",
        blockedBy: req.session.superadminId,
        blockedByEmail: superadmin?.email,
        lastIpAddress: lastLog?.ipAddress,
        lastUserAgent: lastLog?.userAgent,
        lastTenantName: lastLog?.tenantName,
        lastUserName: lastLog?.userName || lastLog?.electedOfficialName || lastLog?.superadminEmail,
        isActive: true,
      });
      
      res.json(blocked);
    } catch (error) {
      console.error("Block device error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Unblock a device
  app.post("/api/superadmin/devices/:deviceId/unblock", async (req, res) => {
    if (!req.session.superadminId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const { deviceId } = req.params;
      const unblocked = await storage.unblockDevice(deviceId);
      if (!unblocked) {
        return res.status(404).json({ error: "Appareil non trouve dans la liste des bloques" });
      }
      res.json(unblocked);
    } catch (error) {
      console.error("Unblock device error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ==========================================
  // TENANT PUBLIC ROUTES
  // ==========================================

  // Middleware to check tenant lifecycle status for write operations
  const checkTenantWriteAccess = async (req: Request, res: Response, next: NextFunction) => {
    const slug = req.params.slug;
    if (!slug) return next();
    
    try {
      const tenant = await storage.getTenantBySlug(slug);
      if (!tenant) {
        return res.status(404).json({ error: "Client non trouve" });
      }
      
      if (tenant.lifecycleStatus === "ARCHIVED") {
        return res.status(423).json({ 
          error: "Ce compte est archive et ne peut plus etre modifie",
          lifecycleStatus: "ARCHIVED"
        });
      }
      
      if (tenant.lifecycleStatus === "SUSPENDED") {
        return res.status(423).json({ 
          error: "Ce compte est suspendu. Veuillez contacter l'administrateur pour reactiver votre compte.",
          lifecycleStatus: "SUSPENDED",
          suspendedReason: tenant.suspendedReason
        });
      }
      
      next();
    } catch (error) {
      console.error("Tenant access check error:", error);
      next();
    }
  };

  app.get("/api/tenants/:slug", async (req, res) => {
    const tenant = await storage.getTenantBySlug(req.params.slug);
    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }
    const { id, ...publicTenant } = tenant;
    res.json({ id, ...publicTenant });
  });

  app.post("/api/signup", async (req, res) => {
    try {
      const data = signupApiSchema.parse(req.body);
      
      const isAdministrativeMandate = data.paymentMethod === "ADMINISTRATIVE_MANDATE";
      
      if (isAdministrativeMandate && !data.mandateDetails) {
        return res.status(400).json({ error: "Les details du mandat administratif sont requis" });
      }
      
      if (isAdministrativeMandate && !data.mandateDetails?.siret) {
        return res.status(400).json({ error: "Le SIRET est requis pour le mandat administratif" });
      }
      
      if (isAdministrativeMandate && data.mandateDetails?.siret) {
        const siretValidation = await validateSiret(data.mandateDetails.siret);
        if (!siretValidation.isValid) {
          return res.status(400).json({ error: siretValidation.error || "SIRET invalide" });
        }
      }
      
      // Note: Optional mandate fields (useChorusPro, chorusProDetails, etc.) are now configured
      // post-signup in the tenant admin billing settings page
      
      const existing = await storage.getTenantBySlug(data.slug);
      if (existing) {
        return res.status(400).json({ error: "Ce nom d'URL est deja utilise" });
      }

      const existingUser = await storage.getUserByEmail(data.adminEmail);
      if (existingUser) {
        return res.status(400).json({ error: "Cet email est deja utilise pour un autre compte" });
      }

      const registrationDate = new Date();
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 30);

      const billingInterval = isAdministrativeMandate ? "YEARLY" : (data.billingInterval === "yearly" ? "YEARLY" : "MONTHLY");

      const tenant = await storage.createTenant({
        name: data.communeName,
        slug: data.slug,
        tenantType: data.tenantType,
        contactEmail: data.adminEmail,
        contactName: data.adminName,
        epci: data.epci || null,
        siret: data.mandateDetails?.siret || null,
        subscriptionPlan: "FREE_TRIAL",
        subscriptionPlanId: data.planId,
        billingInterval: billingInterval as "MONTHLY" | "YEARLY",
        billingStatus: "TRIAL",
        trialEndsAt,
        purchasedCommunes: data.communesCount || 0,
        purchasedAssociations: data.associationsCount || 0,
        purchasedAdmins: Math.max(0, (data.adminsCount || 1) - 1),
      });

      const passwordHash = await bcrypt.hash(data.password, 10);
      await storage.createUser({
        tenantId: tenant.id,
        name: data.adminName,
        email: data.adminEmail,
        passwordHash,
        role: "ADMIN",
      });

      // Setup document numbering config with default formats (can be customized later in admin panel)
      await storage.setupDefaultNumberingConfigForTenant(tenant.id);

      if (isAdministrativeMandate && data.mandateDetails) {
        // Set up billing preferences with minimal info - details can be completed in admin panel
        await storage.upsertTenantBillingPreferences(tenant.id, {
          preferredPaymentMethod: "ADMINISTRATIVE_MANDATE",
          billingAddress: null,
          billingService: null,
          accountingContactName: null,
          accountingContactEmail: null,
          accountingContactPhone: null,
          serviceCode: null,
          engagementNumber: null,
          purchaseOrderNumber: null,
          useChorusPro: false,
          chorusProRecipientSiret: null,
          chorusProServiceCode: null,
          chorusProServiceLabel: null,
          chorusProEngagementNumber: null,
        });

        // Create mandate order for administrative mandate payment
        const plan = await storage.getSubscriptionPlanById(data.planId);
        if (plan) {
          const planAmount = plan.yearlyPrice; // in cents
          
          // Calculate addons amount and create snapshot
          const allAddons = await storage.getAllAddons();
          const addonsSnapshot: { id: string; code: string; name: string; quantity: number; unitPrice: number; totalPrice: number }[] = [];
          let addonsAmount = 0;
          
          const extraAdmins = Math.max(0, (data.adminsCount || 1) - 1);
          const extraAssociations = data.associationsCount || 0;
          const extraCommunes = data.communesCount || 0;
          
          for (const addon of allAddons) {
            let quantity = 0;
            if (addon.code === "ADMIN" && extraAdmins > 0) quantity = extraAdmins;
            else if (addon.code === "ASSOCIATIONS" && extraAssociations > 0) quantity = extraAssociations;
            else if (addon.code === "MAIRIES" && extraCommunes > 0) quantity = extraCommunes;
            
            if (quantity > 0) {
              // Administrative mandates are always yearly - use yearly price (stored in euros)
              const unitPrice = addon.defaultYearlyPrice || 0;
              const totalPrice = unitPrice * quantity;
              addonsSnapshot.push({
                id: addon.id,
                code: addon.code,
                name: addon.name,
                quantity,
                unitPrice,
                totalPrice
              });
              addonsAmount += totalPrice;
            }
          }
          
          const annualAmount = planAmount + addonsAmount;
          // yearlyPrice already includes the 2-month discount (10 months instead of 12)
          // So no additional discount should be applied
          const discountAmount = 0;
          const finalAmount = annualAmount;

          const orderNumber = await storage.generateOrderNumber();
          const mandateOrder = await storage.createMandateOrder({
            orderNumber,
            tenantId: tenant.id,
            planId: data.planId,
            status: "PENDING_VALIDATION",
            billingCycle: "YEARLY",
            planAmount,
            addonsAmount,
            addonsSnapshot: addonsSnapshot.length > 0 ? JSON.stringify(addonsSnapshot) : null,
            annualAmount,
            discountAmount,
            finalAmount,
            clientName: data.communeName,
            clientSiret: data.mandateDetails.siret,
            clientAddress: null, // To be completed in admin panel
            billingService: null, // To be completed in admin panel
            accountingContactName: null,
            accountingContactEmail: null,
            accountingContactPhone: null,
            purchaseOrderNumber: null,
            engagementNumber: null,
            serviceCode: null,
            useChorusPro: false,
            chorusProRecipientSiret: null,
            chorusProServiceCode: null,
          });

          // Log the order creation in activity journal
          await storage.createMandateActivity({
            tenantId: tenant.id,
            orderId: mandateOrder.id,
            activityType: "ORDER_CREATED",
            title: "Commande créée",
            description: `Commande ${orderNumber} créée lors de l'inscription`,
            performedByType: "system",
          });
        }
      } else {
        await storage.upsertTenantBillingPreferences(tenant.id, {
          preferredPaymentMethod: "STRIPE",
        });
      }

      const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
      const host = req.get("host") || "localhost:5000";
      const loginUrl = `${protocol}://${host}/structures/${tenant.slug}/admin/login`;
      
      sendSignupConfirmationEmail(
        data.adminEmail,
        data.adminName,
        data.communeName,
        registrationDate,
        trialEndsAt,
        loginUrl
      ).catch(err => console.error("Failed to send signup confirmation email:", err));

      res.json({ success: true, slug: tenant.slug });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Erreur lors de l'inscription" });
    }
  });

  app.post("/api/leads", async (req, res) => {
    try {
      const data = insertLeadSchema.parse(req.body);
      await storage.createLead(data);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/validate-siret", async (req, res) => {
    try {
      const { siret } = req.body;
      if (!siret || typeof siret !== "string") {
        return res.status(400).json({ error: "SIRET requis" });
      }
      const result = await validateSiret(siret);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erreur de validation SIRET" });
    }
  });

  app.post("/api/tenants/:slug/admin/login", async (req, res) => {
    try {
      // Get or create device ID and check blocking
      const deviceId = getOrCreateDeviceId(req, res);
      const deviceBlockStatus = await isDeviceBlocked(deviceId);
      if (deviceBlockStatus.blocked) {
        return res.status(403).json({ error: deviceBlockStatus.reason || "Appareil bloque", deviceBlocked: true });
      }
      
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }

      const data = loginFormSchema.parse(req.body);
      const user = await storage.getUserByEmailAndTenant(data.email, tenant.id);
      
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const valid = await bcrypt.compare(data.password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      req.session.userId = user.id;
      req.session.tenantId = tenant.id;
      
      // Log activity
      await logActivity({
        req,
        deviceId,
        activityType: "LOGIN",
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        tenantName: tenant.name,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role || undefined,
        actionDetails: "Connexion admin tenant"
      });

      res.json({ success: true, user: { id: user.id, name: user.name, email: user.email } });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/tenants/:slug/admin/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  app.get("/api/tenants/:slug/admin/me", async (req, res) => {
    const tenant = await storage.getTenantBySlug(req.params.slug);
    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }
    
    // Check if tenant account is blocked
    const blockStatus = isTenantBlocked(tenant);
    
    // Check for regular admin session
    if (req.session.userId && req.session.tenantId === tenant.id) {
      const user = await storage.getUserById(req.session.userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      return res.json({ 
        id: user.id, 
        name: user.name, 
        email: user.email, 
        role: user.role,
        accountBlocked: blockStatus.blocked,
        blockReason: blockStatus.reason,
        billingStatus: tenant.billingStatus,
        trialEndsAt: tenant.trialEndsAt,
        isElectedOfficial: false,
      });
    }
    
    // Check for elected official session
    if (req.session.electedOfficialId && req.session.tenantId === tenant.id) {
      const electedOfficial = await storage.getElectedOfficialById(req.session.electedOfficialId);
      if (!electedOfficial || electedOfficial.tenantId !== tenant.id) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const menuPermissions = await storage.getElectedOfficialMenuPermissions(electedOfficial.id);
      
      return res.json({
        id: electedOfficial.id,
        name: `${electedOfficial.firstName} ${electedOfficial.lastName}`,
        email: electedOfficial.email,
        accountBlocked: blockStatus.blocked,
        blockReason: blockStatus.reason,
        billingStatus: tenant.billingStatus,
        trialEndsAt: tenant.trialEndsAt,
        isElectedOfficial: true,
        electedOfficial: {
          id: electedOfficial.id,
          firstName: electedOfficial.firstName,
          lastName: electedOfficial.lastName,
          email: electedOfficial.email,
          hasFullAccess: electedOfficial.hasFullAccess,
          menuPermissions,
        }
      });
    }
    
    return res.status(401).json({ error: "Not authenticated" });
  });

  // Route to check account status
  app.get("/api/tenants/:slug/admin/account-status", async (req, res) => {
    if (!req.session.userId || !req.session.tenantId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const tenant = await storage.getTenantBySlug(req.params.slug);
    if (!tenant || tenant.id !== req.session.tenantId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const blockStatus = isTenantBlocked(tenant);
    
    res.json({
      blocked: blockStatus.blocked,
      reason: blockStatus.reason,
      billingStatus: tenant.billingStatus,
      trialEndsAt: tenant.trialEndsAt,
      subscriptionPlan: tenant.subscriptionPlan,
    });
  });

  app.get("/api/tenants/:slug/admin/stats", async (req, res) => {
    const tenant = await storage.getTenantBySlug(req.params.slug);
    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }
    
    const auth = await checkAdminAuth(req, tenant.id, "DASHBOARD");
    if (!auth.authenticated) {
      return res.status(401).json({ error: auth.error || "Not authenticated" });
    }
    if (!auth.hasMenuAccess) {
      return res.status(403).json({ error: "Permission denied" });
    }

    const stats = await storage.getStats(tenant.id);
    res.json(stats);
  });

  app.get("/api/tenants/:slug/ideas", async (req, res) => {
    const tenant = await storage.getTenantBySlug(req.params.slug);
    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    const ideas = await storage.getIdeasByTenant(tenant.id);
    res.json(ideas);
  });

  app.post("/api/tenants/:slug/ideas", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }

      const data = insertIdeaSchema.parse(req.body);
      const idea = await storage.createIdea({
        ...data,
        tenantId: tenant.id,
        publicToken: randomUUID(),
      });

      if (idea.domainId) {
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const adminUrl = `${baseUrl}/structures/${tenant.slug}/admin/ideas`;
        const officials = await storage.getElectedOfficialsByDomainId(idea.domainId);
        const domain = await storage.getTenantInterventionDomainById(idea.domainId);
        const categoryName = domain?.name || idea.category;
        
        for (const official of officials) {
          if (official.email) {
            sendElectedOfficialNotificationEmail(
              official.email,
              `${official.firstName} ${official.lastName}`,
              'idea',
              idea.title,
              idea.description,
              categoryName,
              tenant.name,
              adminUrl
            ).catch(err => console.error('Failed to notify elected official:', err));
          }
        }
      }

      res.json(idea);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/tenants/:slug/ideas/track/:token", async (req, res) => {
    const idea = await storage.getIdeaByToken(req.params.token);
    if (!idea) {
      return res.status(404).json({ error: "Idea not found" });
    }
    res.json(idea);
  });

  app.get("/api/tenants/:slug/my-contributions", async (req, res) => {
    const { anonymousId } = req.query;
    if (!anonymousId || typeof anonymousId !== 'string') {
      return res.status(400).json({ error: "Anonymous ID required" });
    }

    const tenant = await storage.getTenantBySlug(req.params.slug);
    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    const [ideas, incidents] = await Promise.all([
      storage.getIdeasByAnonymousId(tenant.id, anonymousId),
      storage.getIncidentsByAnonymousId(tenant.id, anonymousId),
    ]);

    res.json({ ideas, incidents });
  });

  app.post("/api/tenants/:slug/ideas/:ideaId/vote", async (req, res) => {
    const tenant = await storage.getTenantBySlug(req.params.slug);
    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    const idea = await storage.getIdeaById(req.params.ideaId);
    if (!idea || idea.tenantId !== tenant.id) {
      return res.status(404).json({ error: "Idea not found" });
    }

    const { voteType, anonymousVoterId } = req.body;
    const direction: 'up' | 'down' = voteType === 'down' ? 'down' : 'up';
    const voterIp = req.ip || req.socket.remoteAddress || "unknown";
    
    const existingVote = await storage.getIdeaVoteByVoter(idea.id, voterIp, anonymousVoterId);
    
    if (existingVote) {
      // If clicking same vote type, remove the vote (toggle off)
      if (existingVote.voteType === direction) {
        await storage.removeIdeaVote(existingVote.id, idea.id, existingVote.voteType);
        const updatedIdea = await storage.getIdeaById(idea.id);
        return res.json({ 
          success: true, 
          action: 'removed',
          upVotes: updatedIdea?.upVotesCount || 0,
          downVotes: updatedIdea?.downVotesCount || 0,
          totalVotes: updatedIdea?.votesCount || 0,
          userVote: null
        });
      }
      // If clicking different vote type, change the vote
      await storage.updateIdeaVote(existingVote.id, idea.id, direction, existingVote.voteType);
      const updatedIdea = await storage.getIdeaById(idea.id);
      return res.json({ 
        success: true, 
        action: 'changed',
        upVotes: updatedIdea?.upVotesCount || 0,
        downVotes: updatedIdea?.downVotesCount || 0,
        totalVotes: updatedIdea?.votesCount || 0,
        userVote: direction
      });
    }

    // New vote
    await storage.createIdeaVote(idea.id, voterIp, direction, anonymousVoterId);
    const updatedIdea = await storage.getIdeaById(idea.id);
    
    res.json({ 
      success: true, 
      action: 'created',
      upVotes: updatedIdea?.upVotesCount || 0,
      downVotes: updatedIdea?.downVotesCount || 0,
      totalVotes: updatedIdea?.votesCount || 0,
      userVote: direction
    });
  });

  // Get user's vote status for an idea
  app.get("/api/tenants/:slug/ideas/:ideaId/vote-status", async (req, res) => {
    const tenant = await storage.getTenantBySlug(req.params.slug);
    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    const idea = await storage.getIdeaById(req.params.ideaId);
    if (!idea || idea.tenantId !== tenant.id) {
      return res.status(404).json({ error: "Idea not found" });
    }

    const { anonymousVoterId } = req.query;
    const voterIp = req.ip || req.socket.remoteAddress || "unknown";
    
    const existingVote = await storage.getIdeaVoteByVoter(
      idea.id, 
      voterIp, 
      typeof anonymousVoterId === 'string' ? anonymousVoterId : undefined
    );
    
    res.json({ 
      userVote: existingVote?.voteType || null,
      upVotes: idea.upVotesCount,
      downVotes: idea.downVotesCount,
      totalVotes: idea.votesCount
    });
  });

  app.get("/api/tenants/:slug/admin/ideas", async (req, res) => {
    const tenant = await storage.getTenantBySlug(req.params.slug);
    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }
    
    const auth = await checkAdminAuth(req, tenant.id, "IDEAS");
    if (!auth.authenticated) {
      return res.status(401).json({ error: auth.error || "Not authenticated" });
    }
    if (!auth.hasMenuAccess) {
      return res.status(403).json({ error: "Permission denied" });
    }

    const ideas = await storage.getIdeasByTenant(tenant.id);
    res.json(ideas);
  });

  app.post("/api/tenants/:slug/admin/ideas/:ideaId/status", async (req, res) => {
    const tenant = await storage.getTenantBySlug(req.params.slug);
    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }
    
    const auth = await checkAdminAuth(req, tenant.id, "IDEAS");
    if (!auth.authenticated) {
      return res.status(401).json({ error: auth.error || "Not authenticated" });
    }
    if (!auth.hasMenuAccess) {
      return res.status(403).json({ error: "Permission denied" });
    }

    const idea = await storage.getIdeaById(req.params.ideaId);
    if (!idea || idea.tenantId !== tenant.id) {
      return res.status(404).json({ error: "Idea not found" });
    }

    const updated = await storage.updateIdeaStatus(idea.id, req.body.status);
    
    if (updated && idea.createdByEmail) {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const trackingUrl = `${baseUrl}/structures/${tenant.slug}/ideas/track/${idea.publicToken}`;
      sendIdeaStatusEmail(idea.createdByEmail, idea.title, req.body.status, tenant.name, trackingUrl)
        .catch(err => console.error('Failed to send idea status email:', err));
    }
    
    res.json(updated);
  });

  app.get("/api/tenants/:slug/incidents", async (req, res) => {
    const tenant = await storage.getTenantBySlug(req.params.slug);
    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    const incidents = await storage.getIncidentsByTenant(tenant.id);
    res.json(incidents);
  });

  app.post("/api/tenants/:slug/incidents", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }

      const data = insertIncidentSchema.parse(req.body);
      const incident = await storage.createIncident({
        ...data,
        tenantId: tenant.id,
        publicToken: randomUUID(),
      });

      if (incident.domainId) {
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const adminUrl = `${baseUrl}/structures/${tenant.slug}/admin/incidents`;
        const officials = await storage.getElectedOfficialsByDomainId(incident.domainId);
        const domain = await storage.getTenantInterventionDomainById(incident.domainId);
        const categoryName = domain?.name || incident.category;
        
        for (const official of officials) {
          if (official.email) {
            sendElectedOfficialNotificationEmail(
              official.email,
              `${official.firstName} ${official.lastName}`,
              'incident',
              incident.title,
              incident.description,
              categoryName,
              tenant.name,
              adminUrl
            ).catch(err => console.error('Failed to notify elected official:', err));
          }
        }
      }

      res.json(incident);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/tenants/:slug/incidents/track/:token", async (req, res) => {
    const incident = await storage.getIncidentByToken(req.params.token);
    if (!incident) {
      return res.status(404).json({ error: "Incident not found" });
    }
    res.json(incident);
  });

  app.get("/api/tenants/:slug/admin/incidents", async (req, res) => {
    const tenant = await storage.getTenantBySlug(req.params.slug);
    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }
    
    const auth = await checkAdminAuth(req, tenant.id, "INCIDENTS");
    if (!auth.authenticated) {
      return res.status(401).json({ error: auth.error || "Not authenticated" });
    }
    if (!auth.hasMenuAccess) {
      return res.status(403).json({ error: "Permission denied" });
    }

    const incidents = await storage.getIncidentsByTenant(tenant.id);
    res.json(incidents);
  });

  app.post("/api/tenants/:slug/admin/incidents/:incidentId/status", async (req, res) => {
    const tenant = await storage.getTenantBySlug(req.params.slug);
    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }
    
    const auth = await checkAdminAuth(req, tenant.id, "INCIDENTS");
    if (!auth.authenticated) {
      return res.status(401).json({ error: auth.error || "Not authenticated" });
    }
    if (!auth.hasMenuAccess) {
      return res.status(403).json({ error: "Permission denied" });
    }

    const incident = await storage.getIncidentById(req.params.incidentId);
    if (!incident || incident.tenantId !== tenant.id) {
      return res.status(404).json({ error: "Incident not found" });
    }

    const updated = await storage.updateIncidentStatus(incident.id, req.body.status);
    
    if (updated && incident.createdByEmail) {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const trackingUrl = `${baseUrl}/structures/${tenant.slug}/incidents/track/${incident.publicToken}`;
      sendIncidentStatusEmail(incident.createdByEmail, incident.title, req.body.status, tenant.name, trackingUrl)
        .catch(err => console.error('Failed to send incident status email:', err));
    }
    
    res.json(updated);
  });

  app.get("/api/tenants/:slug/meetings", async (req, res) => {
    const tenant = await storage.getTenantBySlug(req.params.slug);
    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    const meetings = await storage.getMeetingsByTenant(tenant.id);
    res.json(meetings);
  });

  app.get("/api/tenants/:slug/meetings/:meetingId", async (req, res) => {
    const tenant = await storage.getTenantBySlug(req.params.slug);
    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    const meeting = await storage.getMeetingById(req.params.meetingId);
    if (!meeting || meeting.tenantId !== tenant.id) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    res.json(meeting);
  });

  app.post("/api/tenants/:slug/meetings/:meetingId/register", async (req, res) => {
    try {
      console.log("Meeting registration request:", { slug: req.params.slug, meetingId: req.params.meetingId, body: req.body });
      
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        console.log("Meeting registration error: Tenant not found");
        return res.status(404).json({ error: "Tenant not found" });
      }

      const meeting = await storage.getMeetingById(req.params.meetingId);
      if (!meeting || meeting.tenantId !== tenant.id) {
        console.log("Meeting registration error: Meeting not found", { meetingId: req.params.meetingId, tenantId: tenant.id });
        return res.status(404).json({ error: "Meeting not found" });
      }

      if (meeting.status !== "SCHEDULED") {
        console.log("Meeting registration error: Meeting not scheduled", { status: meeting.status });
        return res.status(400).json({ error: "Meeting is not open for registration" });
      }

      if (meeting.capacity && meeting.registrationsCount >= meeting.capacity) {
        console.log("Meeting registration error: Meeting full", { capacity: meeting.capacity, registrations: meeting.registrationsCount });
        return res.status(400).json({ error: "Meeting is full" });
      }

      const data = insertMeetingRegistrationSchema.parse(req.body);
      console.log("Meeting registration parsed data:", data);
      
      const registration = await storage.createMeetingRegistration({
        ...data,
        meetingId: meeting.id,
      });
      console.log("Meeting registration created:", registration);

      sendMeetingRegistrationEmail(
        data.email,
        data.fullName,
        meeting.title,
        meeting.dateTime,
        meeting.location,
        tenant.name
      ).catch(err => console.error('Failed to send meeting registration email:', err));

      res.json(registration);
    } catch (error: any) {
      console.error("Meeting registration exception:", error);
      res.status(400).json({ error: error.message });
    }
  });

  // Public: Get meeting registrations (names only for privacy)
  app.get("/api/tenants/:slug/meetings/:meetingId/registrations", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }

      const meeting = await storage.getMeetingById(req.params.meetingId);
      if (!meeting || meeting.tenantId !== tenant.id) {
        return res.status(404).json({ error: "Meeting not found" });
      }

      const registrations = await storage.getMeetingRegistrations(meeting.id);
      // Return only names for public view (privacy)
      const publicRegistrations = registrations.map(r => ({
        id: r.id,
        fullName: r.fullName,
        createdAt: r.createdAt,
      }));
      res.json(publicRegistrations);
    } catch (error) {
      console.error("Meeting registrations error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.get("/api/tenants/:slug/admin/meetings", async (req, res) => {
    const tenant = await storage.getTenantBySlug(req.params.slug);
    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }
    
    const auth = await checkAdminAuth(req, tenant.id, "MEETINGS");
    if (!auth.authenticated) {
      return res.status(401).json({ error: auth.error || "Not authenticated" });
    }
    if (!auth.hasMenuAccess) {
      return res.status(403).json({ error: "Permission denied" });
    }

    const meetings = await storage.getMeetingsByTenant(tenant.id);
    res.json(meetings);
  });

  app.get("/api/tenants/:slug/admin/meetings/:meetingId", async (req, res) => {
    const tenant = await storage.getTenantBySlug(req.params.slug);
    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }
    
    const auth = await checkAdminAuth(req, tenant.id, "MEETINGS");
    if (!auth.authenticated) {
      return res.status(401).json({ error: auth.error || "Not authenticated" });
    }
    if (!auth.hasMenuAccess) {
      return res.status(403).json({ error: "Permission denied" });
    }

    const meeting = await storage.getMeetingById(req.params.meetingId);
    if (!meeting || meeting.tenantId !== tenant.id) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    res.json(meeting);
  });

  app.post("/api/tenants/:slug/admin/meetings", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      const auth = await checkAdminAuth(req, tenant.id, "MEETINGS");
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error || "Not authenticated" });
      }
      if (!auth.hasMenuAccess) {
        return res.status(403).json({ error: "Permission denied" });
      }

      // Convert dateTime string to Date object
      const body = {
        ...req.body,
        dateTime: req.body.dateTime ? new Date(req.body.dateTime) : undefined,
      };

      const data = insertMeetingSchema.parse(body);
      const meeting = await storage.createMeeting({
        ...data,
        tenantId: tenant.id,
      });

      res.json(meeting);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/tenants/:slug/admin/meetings/:meetingId/status", async (req, res) => {
    const tenant = await storage.getTenantBySlug(req.params.slug);
    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }
    
    const auth = await checkAdminAuth(req, tenant.id, "MEETINGS");
    if (!auth.authenticated) {
      return res.status(401).json({ error: auth.error || "Not authenticated" });
    }
    if (!auth.hasMenuAccess) {
      return res.status(403).json({ error: "Permission denied" });
    }

    const meeting = await storage.getMeetingById(req.params.meetingId);
    if (!meeting || meeting.tenantId !== tenant.id) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    const updated = await storage.updateMeetingStatus(meeting.id, req.body.status);
    res.json(updated);
  });

  app.get("/api/stripe/publishable-key", async (_req, res) => {
    try {
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get Stripe key" });
    }
  });

  app.post("/api/tenants/:slug/admin/billing/create-checkout", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      const auth = await checkAdminAuth(req, tenant.id, "BILLING");
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error || "Not authenticated" });
      }
      if (!auth.hasMenuAccess) {
        return res.status(403).json({ error: "Permission denied" });
      }

      const user = auth.userId ? await storage.getUserById(auth.userId) : null;
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      const { planId, interval, priceId } = req.body;
      
      let stripePriceId = priceId;
      let selectedPlanId = planId;
      
      if (planId && interval) {
        const plan = await storage.getSubscriptionPlanById(planId);
        if (!plan) {
          return res.status(400).json({ error: "Plan not found" });
        }
        const stripeMode = await getCurrentStripeMode();
        if (stripeMode === 'live') {
          stripePriceId = interval === 'yearly' ? plan.stripePriceIdYearlyLive : plan.stripePriceIdMonthlyLive;
        } else {
          stripePriceId = interval === 'yearly' ? plan.stripePriceIdYearlyTest : plan.stripePriceIdMonthlyTest;
        }
        if (!stripePriceId) {
          return res.status(400).json({ error: `No Stripe price configured for this plan in ${stripeMode} mode` });
        }
      }
      
      if (!stripePriceId) {
        return res.status(400).json({ error: "Price ID required" });
      }

      const stripe = await getUncachableStripeClient();

      let customerId = tenant.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: tenant.contactEmail || user.email,
          name: tenant.name,
          metadata: { tenantId: tenant.id },
        });
        await storage.updateTenantStripeInfo(tenant.id, { stripeCustomerId: customer.id });
        customerId = customer.id;
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{ price: stripePriceId, quantity: 1 }],
        mode: 'subscription',
        success_url: `${baseUrl}/structures/${tenant.slug}/admin/billing?success=true`,
        cancel_url: `${baseUrl}/structures/${tenant.slug}/admin/billing?canceled=true`,
        metadata: { tenantId: tenant.id, planId: selectedPlanId || '' },
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Checkout error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/tenants/:slug/admin/billing/portal", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      const auth = await checkAdminAuth(req, tenant.id, "BILLING");
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error || "Not authenticated" });
      }
      if (!auth.hasMenuAccess) {
        return res.status(403).json({ error: "Permission denied" });
      }

      if (!tenant.stripeCustomerId) {
        return res.status(400).json({ error: "No billing account found" });
      }

      const stripe = await getUncachableStripeClient();
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: tenant.stripeCustomerId,
        return_url: `${baseUrl}/structures/${tenant.slug}/admin/billing`,
      });

      res.json({ url: portalSession.url });
    } catch (error: any) {
      console.error("Portal error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Tenant admin requests subscription cancellation
  app.post("/api/tenants/:slug/admin/billing/cancel-request", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Commune non trouvee" });
      }
      
      const auth = await checkAdminAuth(req, tenant.id, "BILLING");
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error || "Non authentifie" });
      }
      if (!auth.hasMenuAccess) {
        return res.status(403).json({ error: "Permission refusee" });
      }

      const { reason } = req.body;
      if (!reason || typeof reason !== "string") {
        return res.status(400).json({ error: "La raison est requise" });
      }
      
      const trimmedReason = reason.trim();
      if (trimmedReason.length < 10) {
        return res.status(400).json({ error: "La raison doit contenir au moins 10 caracteres" });
      }
      if (trimmedReason.length > 1000) {
        return res.status(400).json({ error: "La raison ne doit pas depasser 1000 caracteres" });
      }

      // Get actor info for logging (admin or elected official with BILLING permission)
      let adminName = "Utilisateur";
      let performedBy: string;
      
      if (auth.userId) {
        const user = await storage.getUserById(auth.userId);
        if (!user) {
          return res.status(400).json({ error: "Utilisateur non trouve" });
        }
        adminName = user.name || user.email || "Administrateur";
        performedBy = auth.userId;
      } else if (auth.electedOfficialId) {
        const electedOfficial = await storage.getElectedOfficialById(auth.electedOfficialId);
        if (!electedOfficial) {
          return res.status(400).json({ error: "Elu non trouve" });
        }
        adminName = `${electedOfficial.firstName} ${electedOfficial.lastName}`.trim() || electedOfficial.email || "Elu";
        performedBy = auth.electedOfficialId;
      } else {
        return res.status(400).json({ error: "Impossible d'identifier l'utilisateur" });
      }

      // Log cancellation request as an activity
      await storage.createMandateActivity({
        tenantId: tenant.id,
        activityType: "CANCELLATION_REQUESTED",
        title: "Demande d'annulation d'abonnement",
        description: `${auth.isElectedOfficial ? "L'elu" : "L'administrateur"} ${adminName} a demande l'annulation. Raison: ${trimmedReason}`,
        performedBy: performedBy,
        performedByType: auth.isElectedOfficial ? "elected_official" : "admin",
      });

      // TODO: Send notification email to superadmin
      
      res.json({ 
        success: true, 
        message: "Votre demande d'annulation a ete enregistree. Notre equipe vous contactera prochainement." 
      });
    } catch (error) {
      console.error("Cancel request error:", error);
      res.status(500).json({ error: "Erreur lors de la demande d'annulation" });
    }
  });

  app.get("/api/tenants/:slug/admin/billing", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      const auth = await checkAdminAuth(req, tenant.id, "BILLING");
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error || "Not authenticated" });
      }
      if (!auth.hasMenuAccess) {
        return res.status(403).json({ error: "Permission denied" });
      }

      const billingInfo = await storage.getTenantBillingInfo(tenant.id);
      if (!billingInfo) {
        return res.status(404).json({ error: "Billing info not found" });
      }

      // Get available plans for comparison
      const allPlans = await storage.getAllSubscriptionPlans();
      
      // Get addons available for this plan
      let availableAddons: any[] = [];
      if (billingInfo.plan) {
        const planAddons = await storage.getPlanAddonAccess(billingInfo.plan.id);
        availableAddons = planAddons.filter((a: any) => a.isEnabled);
      }

      res.json({
        ...billingInfo,
        hasStripeCustomer: !!billingInfo.tenant.stripeCustomerId,
        hasSubscription: !!billingInfo.tenant.stripeSubscriptionId,
        allPlans,
        availableAddons,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get full billing info with plan, addons, pending changes, ledger balance
  app.get("/api/tenants/:slug/admin/billing/info", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      const auth = await checkAdminAuth(req, tenant.id, "BILLING");
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error || "Not authenticated" });
      }
      if (!auth.hasMenuAccess) {
        return res.status(403).json({ error: "Permission denied" });
      }

      const billingInfo = await storage.getTenantBillingInfo(tenant.id);
      if (!billingInfo) {
        return res.status(404).json({ error: "Billing info not found" });
      }

      res.json(billingInfo);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get comprehensive billing summary with costs
  app.get("/api/tenants/:slug/admin/billing/summary", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      const auth = await checkAdminAuth(req, tenant.id, "BILLING");
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error || "Not authenticated" });
      }
      if (!auth.hasMenuAccess) {
        return res.status(403).json({ error: "Permission denied" });
      }

      const billingInfo = await storage.getTenantBillingInfo(tenant.id);
      if (!billingInfo) {
        return res.status(404).json({ error: "Billing info not found" });
      }

      // Check if this is a mandate tenant - check preferences OR active mandate subscription
      const mandateSubscription = await storage.getMandateSubscriptionByTenant(tenant.id);
      const billingPrefs = await storage.getTenantBillingPreferences(tenant.id);
      const isMandateTenant = mandateSubscription?.status === "ACTIVE" || 
        billingPrefs?.preferredPaymentMethod === "ADMINISTRATIVE_MANDATE";
      
      let billingInterval = tenant.billingInterval || "MONTHLY";
      let planCost = 0;
      let plan: typeof billingInfo.plan | undefined = billingInfo.plan;
      let addonsWithPricing: any[] = [];
      let addonsTotalCost = 0;
      
      if (isMandateTenant) {
        // For mandate tenants, get plan and costs from mandate data
        billingInterval = "YEARLY"; // Administrative mandates are always yearly
        
        if (mandateSubscription?.planId) {
          plan = await storage.getSubscriptionPlanById(mandateSubscription.planId) || null;
        }
        
        // Get the latest order to get accurate pricing (sorted by date descending)
        // Prefer ACCEPTED/INVOICED orders, fall back to pending orders, exclude CANCELLED/REJECTED
        const mandateOrders = await storage.getMandateOrdersByTenant(tenant.id);
        const validOrders = mandateOrders
          .filter(o => o.status !== "CANCELLED" && o.status !== "REJECTED")
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        // Prefer accepted/invoiced orders, otherwise use latest pending order
        const latestOrder = validOrders.find(o => o.status === "INVOICED" || o.status === "ACCEPTED") 
          || validOrders[0];
        
        if (latestOrder) {
          planCost = latestOrder.planAmount || (plan?.yearlyPrice || 0);
          addonsTotalCost = latestOrder.addonsAmount || 0;
          
          // Parse addons from snapshot
          if (latestOrder.addonsSnapshot) {
            try {
              const snapshotAddons = typeof latestOrder.addonsSnapshot === "string"
                ? JSON.parse(latestOrder.addonsSnapshot)
                : latestOrder.addonsSnapshot;
              
              addonsWithPricing = (snapshotAddons || []).map((a: any) => ({
                addonId: a.id,
                quantity: a.quantity,
                addon: { name: a.name, code: a.code },
                effectiveUnitPrice: a.unitPrice,
                subtotal: a.totalPrice,
                monthlyUnitPrice: 0,
                yearlyUnitPrice: a.unitPrice,
              }));
            } catch {}
          }
        } else {
          // No mandate order found - fall back to plan pricing and virtual addons from tenant.purchased* columns
          if (plan) {
            planCost = plan.yearlyPrice || 0;
          }
          
          // Create virtual addons from tenant.purchased* columns for mandate tenants without orders
          const allAddonsForPricing = await storage.listAddons();
          
          if (tenant.purchasedAssociations && tenant.purchasedAssociations > 0) {
            const assocAddon = allAddonsForPricing.find((a: any) => a.code?.toUpperCase() === "ASSOCIATIONS");
            if (assocAddon) {
              const unitPrice = assocAddon.defaultYearlyPrice || 0;
              const subtotal = unitPrice * tenant.purchasedAssociations;
              addonsWithPricing.push({
                addonId: assocAddon.id,
                quantity: tenant.purchasedAssociations,
                addon: { name: assocAddon.name, code: assocAddon.code },
                effectiveUnitPrice: unitPrice,
                subtotal,
                monthlyUnitPrice: 0,
                yearlyUnitPrice: unitPrice,
              });
              addonsTotalCost += subtotal;
            }
          }
          
          if (tenant.purchasedAdmins && tenant.purchasedAdmins > 0) {
            const adminAddon = allAddonsForPricing.find((a: any) => a.code?.toUpperCase() === "ADMIN");
            if (adminAddon) {
              const unitPrice = adminAddon.defaultYearlyPrice || 0;
              const subtotal = unitPrice * tenant.purchasedAdmins;
              addonsWithPricing.push({
                addonId: adminAddon.id,
                quantity: tenant.purchasedAdmins,
                addon: { name: adminAddon.name, code: adminAddon.code },
                effectiveUnitPrice: unitPrice,
                subtotal,
                monthlyUnitPrice: 0,
                yearlyUnitPrice: unitPrice,
              });
              addonsTotalCost += subtotal;
            }
          }
          
          if (tenant.purchasedCommunes && tenant.purchasedCommunes > 0) {
            const communeAddon = allAddonsForPricing.find((a: any) => a.code?.toUpperCase() === "MAIRIES");
            if (communeAddon) {
              const unitPrice = communeAddon.defaultYearlyPrice || 0;
              const subtotal = unitPrice * tenant.purchasedCommunes;
              addonsWithPricing.push({
                addonId: communeAddon.id,
                quantity: tenant.purchasedCommunes,
                addon: { name: communeAddon.name, code: communeAddon.code },
                effectiveUnitPrice: unitPrice,
                subtotal,
                monthlyUnitPrice: 0,
                yearlyUnitPrice: unitPrice,
              });
              addonsTotalCost += subtotal;
            }
          }
        }
      } else {
        // Standard Stripe-based billing
        // Calculate plan cost
        if (billingInfo.plan) {
          planCost = billingInterval === "YEARLY" 
            ? billingInfo.plan.yearlyPrice 
            : billingInfo.plan.monthlyPrice;
        }

        // Get plan addon access for pricing overrides
        const planAddonAccess = billingInfo.plan 
          ? await storage.getPlanAddonAccess(billingInfo.plan.id)
          : [];

        // Get all addons for reference
        const allAddonsForPricing = await storage.listAddons();

        // For tenants with no tenantAddons entries but purchased addons, create virtual addon entries from tenant.purchased* columns
        // This handles both trial tenants and Stripe tenants where tenant_addons records weren't created during signup
        let effectiveAddons = billingInfo.addons;
        if (billingInfo.addons.length === 0) {
          const virtualAddons: any[] = [];
          
          // Add associations addon if tenant has purchased associations
          if (tenant.purchasedAssociations && tenant.purchasedAssociations > 0) {
            const assocAddon = allAddonsForPricing.find((a: any) => a.code?.toUpperCase() === "ASSOCIATIONS");
            if (assocAddon) {
              virtualAddons.push({
                id: `virtual-assoc-${tenant.id}`,
                tenantId: tenant.id,
                addonId: assocAddon.id,
                quantity: tenant.purchasedAssociations,
                addon: assocAddon,
              });
            }
          }
          
          // Add admins addon if tenant has purchased extra admins
          if (tenant.purchasedAdmins && tenant.purchasedAdmins > 0) {
            const adminAddon = allAddonsForPricing.find((a: any) => a.code?.toUpperCase() === "ADMIN");
            if (adminAddon) {
              virtualAddons.push({
                id: `virtual-admin-${tenant.id}`,
                tenantId: tenant.id,
                addonId: adminAddon.id,
                quantity: tenant.purchasedAdmins,
                addon: adminAddon,
              });
            }
          }
          
          // Add communes/mairies addon if tenant has purchased communes (for EPCI)
          if (tenant.purchasedCommunes && tenant.purchasedCommunes > 0) {
            const communeAddon = allAddonsForPricing.find((a: any) => a.code?.toUpperCase() === "MAIRIES");
            if (communeAddon) {
              virtualAddons.push({
                id: `virtual-commune-${tenant.id}`,
                tenantId: tenant.id,
                addonId: communeAddon.id,
                quantity: tenant.purchasedCommunes,
                addon: communeAddon,
              });
            }
          }
          
          effectiveAddons = virtualAddons;
        }

        // Calculate addon costs with effective prices
        addonsWithPricing = await Promise.all(effectiveAddons.map(async (ta: any) => {
          const accessEntry = planAddonAccess.find((a: any) => a.addonId === ta.addonId);
          
          // Get effective unit price (plan override or addon default)
          const monthlyUnitPrice = accessEntry?.monthlyPrice ?? ta.addon.defaultMonthlyPrice ?? 0;
          const yearlyUnitPrice = accessEntry?.yearlyPrice ?? ta.addon.defaultYearlyPrice ?? 0;
          const effectiveUnitPrice = billingInterval === "YEARLY" ? yearlyUnitPrice : monthlyUnitPrice;
          const subtotal = effectiveUnitPrice * ta.quantity;

          return {
            ...ta,
            monthlyUnitPrice,
            yearlyUnitPrice,
            effectiveUnitPrice,
            subtotal,
          };
        }));

        addonsTotalCost = addonsWithPricing.reduce((sum, a) => sum + a.subtotal, 0);
      }
      
      const totalCost = planCost + addonsTotalCost;

      // Get plan addon access for available addons display
      const planAddonAccess = plan 
        ? await storage.getPlanAddonAccess(plan.id)
        : [];

      // Get all available addons for the plan
      const allAddons = await storage.listAddons();
      
      // Helper to get current quantity for an addon (from tenantAddons or tenant.purchased* for trials)
      const getAddonCurrentQuantity = (addon: any): number => {
        // First check tenantAddons table
        const tenantAddonQty = billingInfo.addons.find((ta: any) => ta.addonId === addon.id)?.quantity;
        if (tenantAddonQty !== undefined && tenantAddonQty > 0) return tenantAddonQty;
        
        // For trial tenants, check tenant.purchased* columns
        if (tenant.billingStatus === "TRIAL") {
          const code = addon.code?.toUpperCase();
          if (code === "ASSOCIATIONS") return tenant.purchasedAssociations || 0;
          if (code === "ADMIN") return tenant.purchasedAdmins || 0;
          if (code === "MAIRIES") return tenant.purchasedCommunes || 0;
        }
        
        return 0;
      };
      
      const availableAddons = isMandateTenant ? [] : allAddons
        .filter((a: any) => a.isActive)
        .map((addon: any) => {
          const accessEntry = planAddonAccess.find((pa: any) => pa.addonId === addon.id);
          const isEnabled = accessEntry?.isEnabled ?? false;
          const monthlyPrice = accessEntry?.monthlyPrice ?? addon.defaultMonthlyPrice ?? 0;
          const yearlyPrice = accessEntry?.yearlyPrice ?? addon.defaultYearlyPrice ?? 0;
          const currentQuantity = getAddonCurrentQuantity(addon);
          
          return {
            ...addon,
            isEnabled,
            monthlyPrice,
            yearlyPrice,
            currentQuantity,
          };
        })
        .filter((a: any) => a.isEnabled);

      // Get addons included with the plan (isEnabled=true with price=0)
      const planIncludedAddons = isMandateTenant ? [] : allAddons
        .filter((a: any) => a.isActive)
        .map((addon: any) => {
          const accessEntry = planAddonAccess.find((pa: any) => pa.addonId === addon.id);
          const quantity = getAddonCurrentQuantity(addon);
          return { addon, accessEntry, quantity };
        })
        .filter(({ accessEntry }) => {
          if (!accessEntry?.isEnabled) return false;
          // Included if both monthly and yearly prices are 0 (free with plan)
          const monthlyPrice = accessEntry.monthlyPrice ?? 0;
          const yearlyPrice = accessEntry.yearlyPrice ?? 0;
          return monthlyPrice === 0 && yearlyPrice === 0;
        })
        .map(({ addon, quantity }) => ({
          id: addon.id,
          name: addon.name,
          description: addon.description,
          quantity: quantity,
        }));

      // Get all plans for comparison
      const allPlans = await storage.getAllSubscriptionPlans();

      // Enrich pending changes with addon/plan details
      const enrichedPendingChanges = await Promise.all(billingInfo.pendingChanges.map(async (change) => {
        let addonName: string | null = null;
        let addonUnitPrice: number | null = null;
        let fromPlanName: string | null = null;
        let toPlanName: string | null = null;
        let priceDelta: number | null = null;
        
        if (change.changeType === "ADDON_CHANGE" && change.addonId) {
          const addon = await storage.getAddonById(change.addonId);
          if (addon) {
            addonName = addon.name;
            const unitPrice = billingInterval === "YEARLY" 
              ? addon.defaultYearlyPrice 
              : addon.defaultMonthlyPrice;
            addonUnitPrice = unitPrice;
            
            const fromQty = change.fromQuantity || 0;
            const toQty = change.toQuantity || 0;
            priceDelta = (toQty - fromQty) * unitPrice;
          }
        }
        
        if (change.changeType === "PLAN_CHANGE") {
          if (change.fromPlanId) {
            const fromPlan = allPlans.find(p => p.id === change.fromPlanId);
            fromPlanName = fromPlan?.name || null;
          }
          if (change.toPlanId) {
            const toPlan = allPlans.find(p => p.id === change.toPlanId);
            toPlanName = toPlan?.name || null;
          }
        }
        
        return {
          ...change,
          addonName,
          addonUnitPrice,
          fromPlanName,
          toPlanName,
          priceDelta,
        };
      }));

      res.json({
        tenant: billingInfo.tenant,
        plan,
        planCost,
        billingInterval,
        addons: addonsWithPricing,
        addonsTotalCost,
        totalCost,
        preferences: billingInfo.preferences,
        pendingChanges: enrichedPendingChanges,
        ledgerBalance: billingInfo.ledgerBalance,
        availableAddons,
        planIncludedAddons,
        allPlans: allPlans.filter(p => p.isActive),
        hasStripeCustomer: !!tenant.stripeCustomerId,
        hasSubscription: !!tenant.stripeSubscriptionId,
        isMandateTenant,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Preview addon change (calculate delta and future total)
  app.post("/api/tenants/:slug/admin/billing/addon-preview", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      const auth = await checkAdminAuth(req, tenant.id, "BILLING");
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error || "Not authenticated" });
      }
      if (!auth.hasMenuAccess) {
        return res.status(403).json({ error: "Permission denied" });
      }

      const { addonId, newQuantity } = req.body;
      if (!addonId || newQuantity === undefined) {
        return res.status(400).json({ error: "addonId and newQuantity required" });
      }

      const addon = await storage.getAddonById(addonId);
      if (!addon) {
        return res.status(400).json({ error: "Addon not found" });
      }

      const billingInterval = tenant.billingInterval || "MONTHLY";
      
      // Get effective price
      let unitPrice = billingInterval === "YEARLY" 
        ? addon.defaultYearlyPrice 
        : addon.defaultMonthlyPrice;
      
      if (tenant.subscriptionPlanId) {
        const planAddons = await storage.getPlanAddonAccess(tenant.subscriptionPlanId);
        const accessEntry = planAddons.find((a: any) => a.addonId === addonId);
        if (accessEntry) {
          unitPrice = billingInterval === "YEARLY"
            ? (accessEntry.yearlyPrice ?? unitPrice)
            : (accessEntry.monthlyPrice ?? unitPrice);
        }
      }

      const tenantAddon = await storage.getTenantAddon(tenant.id, addonId);
      const currentQuantity = tenantAddon?.quantity || 0;
      const quantityDiff = newQuantity - currentQuantity;

      // Calculate proration for immediate change based on billing cycle
      const now = new Date();
      let daysInPeriod: number;
      let daysRemaining: number;
      
      if (billingInterval === "YEARLY") {
        // For yearly billing, calculate based on subscription period
        // Try to get mandate subscription dates first
        const activeMandateSub = await storage.getMandateSubscriptionByTenant(tenant.id);
        
        if (activeMandateSub && activeMandateSub.status === "ACTIVE" && activeMandateSub.endDate) {
          // Use mandate subscription end date
          const endDate = new Date(activeMandateSub.endDate);
          const startDate = new Date(activeMandateSub.startDate);
          daysInPeriod = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
          daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        } else {
          // Fall back to calculating from tenant creation date (anniversary-based)
          const createdAt = new Date(tenant.createdAt);
          // Calculate next anniversary date
          let nextAnniversary = new Date(createdAt);
          nextAnniversary.setFullYear(now.getFullYear());
          if (nextAnniversary <= now) {
            nextAnniversary.setFullYear(now.getFullYear() + 1);
          }
          // Previous anniversary
          const prevAnniversary = new Date(nextAnniversary);
          prevAnniversary.setFullYear(prevAnniversary.getFullYear() - 1);
          
          daysInPeriod = Math.ceil((nextAnniversary.getTime() - prevAnniversary.getTime()) / (1000 * 60 * 60 * 24));
          daysRemaining = Math.max(0, Math.ceil((nextAnniversary.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        }
      } else {
        // For monthly billing, use days in current month
        daysInPeriod = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        daysRemaining = daysInPeriod - now.getDate();
      }
      
      let immediateCharge = 0;
      let immediateCredit = 0;
      
      if (quantityDiff > 0) {
        immediateCharge = (unitPrice / daysInPeriod) * daysRemaining * quantityDiff;
      } else if (quantityDiff < 0) {
        immediateCredit = (unitPrice / daysInPeriod) * daysRemaining * Math.abs(quantityDiff);
      }

      // Calculate future recurring cost difference
      const currentAddonCost = currentQuantity * unitPrice;
      const newAddonCost = newQuantity * unitPrice;
      const recurringDelta = newAddonCost - currentAddonCost;

      // Calculate new total subscription cost
      const billingInfo = await storage.getTenantBillingInfo(tenant.id);
      let planCost = 0;
      if (billingInfo?.plan) {
        planCost = billingInterval === "YEARLY" 
          ? billingInfo.plan.yearlyPrice 
          : billingInfo.plan.monthlyPrice;
      }
      
      // Current addons total (excluding this addon)
      const otherAddonsCost = (billingInfo?.addons || [])
        .filter(a => a.addonId !== addonId)
        .reduce((sum, a) => {
          const price = billingInterval === "YEARLY" 
            ? (a.addon.defaultYearlyPrice || 0)
            : (a.addon.defaultMonthlyPrice || 0);
          return sum + (price * a.quantity);
        }, 0);

      const newTotalCost = planCost + otherAddonsCost + newAddonCost;
      const currentTotalCost = planCost + otherAddonsCost + currentAddonCost;

      res.json({
        addonId,
        addonName: addon.name,
        currentQuantity,
        newQuantity,
        quantityDiff,
        unitPrice,
        billingInterval,
        immediateCharge,
        immediateCredit,
        recurringDelta,
        currentAddonCost,
        newAddonCost,
        currentTotalCost,
        newTotalCost,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get ledger entries
  app.get("/api/tenants/:slug/admin/billing/ledger", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      const auth = await checkAdminAuth(req, tenant.id, "BILLING");
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error || "Not authenticated" });
      }
      if (!auth.hasMenuAccess) {
        return res.status(403).json({ error: "Permission denied" });
      }

      const entries = await storage.getTenantLedgerEntries(tenant.id);
      res.json(entries);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get comprehensive billing history (ledger + applied changes)
  app.get("/api/tenants/:slug/admin/billing/history", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      const auth = await checkAdminAuth(req, tenant.id, "BILLING");
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error || "Not authenticated" });
      }
      if (!auth.hasMenuAccess) {
        return res.status(403).json({ error: "Permission denied" });
      }

      // Get ledger entries
      const ledgerEntries = await storage.getTenantLedgerEntries(tenant.id);
      
      // Get all billing changes (including pending, applied, and cancelled)
      const allChanges = await storage.getAllBillingChanges(tenant.id);
      const allPlans = await storage.getAllSubscriptionPlans();
      const allAddons = await storage.listAddons();
      const billingInterval = tenant.billingInterval || "MONTHLY";
      
      // Enrich billing changes with addon/plan names and compute monetary impacts
      const enrichedChanges = await Promise.all(allChanges.map(async (change: any) => {
        let addonName: string | null = null;
        let fromPlanName: string | null = null;
        let toPlanName: string | null = null;
        let recurringDelta: number = 0;
        
        // Use the billing interval from the change itself, or fall back to tenant default
        const effectiveInterval = change.toBillingInterval || change.fromBillingInterval || billingInterval;
        
        if (change.changeType === "ADDON_CHANGE" && change.addonId) {
          const addon = allAddons.find((a: any) => a.id === change.addonId);
          addonName = addon?.name || null;
          
          if (addon) {
            // Get effective unit price based on the change's billing interval
            let unitPrice = effectiveInterval === "YEARLY" 
              ? addon.defaultYearlyPrice 
              : addon.defaultMonthlyPrice;
            
            // Check for plan-specific pricing using the target plan
            const targetPlanId = change.toPlanId || tenant.subscriptionPlanId;
            if (targetPlanId) {
              const planAddons = await storage.getPlanAddonAccess(targetPlanId);
              const accessEntry = planAddons.find((a: any) => a.addonId === change.addonId);
              if (accessEntry) {
                unitPrice = effectiveInterval === "YEARLY"
                  ? (accessEntry.yearlyPrice ?? unitPrice)
                  : (accessEntry.monthlyPrice ?? unitPrice);
              }
            }
            
            // Calculate recurring delta
            const fromQty = change.fromQuantity || 0;
            const toQty = change.toQuantity || 0;
            recurringDelta = (toQty - fromQty) * unitPrice;
          }
        }
        
        if (change.changeType === "PLAN_CHANGE") {
          let fromPrice = 0;
          let toPrice = 0;
          
          // Use the intervals from the change record for accurate delta calculation
          const fromInterval = change.fromBillingInterval || billingInterval;
          const toInterval = change.toBillingInterval || billingInterval;
          
          if (change.fromPlanId) {
            const fromPlan = allPlans.find((p: any) => p.id === change.fromPlanId);
            fromPlanName = fromPlan?.name || null;
            if (fromPlan) {
              fromPrice = fromInterval === "YEARLY" ? fromPlan.yearlyPrice : fromPlan.monthlyPrice;
            }
          }
          if (change.toPlanId) {
            const toPlan = allPlans.find((p: any) => p.id === change.toPlanId);
            toPlanName = toPlan?.name || null;
            if (toPlan) {
              toPrice = toInterval === "YEARLY" ? toPlan.yearlyPrice : toPlan.monthlyPrice;
            }
          }
          
          recurringDelta = toPrice - fromPrice;
        }
        
        return {
          ...change,
          addonName,
          fromPlanName,
          toPlanName,
          recurringDelta,
          prorataCredit: change.prorataCredit || 0,
          prorataDebit: change.prorataDebit || 0,
        };
      }));

      // Combine and sort by date (most recent first)
      type HistoryEvent = {
        id: string;
        type: 'ledger' | 'change';
        date: Date;
        eventType: string;
        description: string;
        amount?: number;
        recurringDelta?: number;
        prorataCredit?: number;
        prorataDebit?: number;
        status?: string;
        addonName?: string | null;
        fromQuantity?: number | null;
        toQuantity?: number | null;
        fromPlanName?: string | null;
        toPlanName?: string | null;
        paymentMethod?: string | null;
      };

      const historyEvents: HistoryEvent[] = [];

      // Add ledger entries
      ledgerEntries.forEach((entry: any) => {
        historyEvents.push({
          id: entry.id,
          type: 'ledger',
          date: new Date(entry.createdAt),
          eventType: entry.entryType,
          description: entry.description || (entry.entryType === 'CREDIT' ? 'Credit' : 'Debit'),
          amount: entry.amount,
        });
      });

      // Add billing changes (include all statuses: PENDING, APPLIED, CANCELLED)
      enrichedChanges.forEach((change: any) => {
        let description = '';
        if (change.changeType === 'ADDON_CHANGE') {
          description = `${change.addonName || 'Option'}: ${change.fromQuantity || 0} → ${change.toQuantity || 0} unites`;
        } else if (change.changeType === 'PLAN_CHANGE') {
          description = `Forfait: ${change.fromPlanName || 'Aucun'} → ${change.toPlanName || 'Aucun'}`;
        }
        
        historyEvents.push({
          id: change.id,
          type: 'change',
          date: new Date(change.appliedAt || change.effectiveDate || change.createdAt),
          eventType: change.changeType,
          description,
          status: change.status,
          recurringDelta: change.recurringDelta,
          prorataCredit: change.prorataCredit,
          prorataDebit: change.prorataDebit,
          addonName: change.addonName,
          fromQuantity: change.fromQuantity,
          toQuantity: change.toQuantity,
          fromPlanName: change.fromPlanName,
          toPlanName: change.toPlanName,
          paymentMethod: change.paymentMethod,
        });
      });

      // Sort by date descending (most recent first)
      historyEvents.sort((a, b) => b.date.getTime() - a.date.getTime());

      res.json(historyEvents);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update billing preferences (payment method)
  app.put("/api/tenants/:slug/admin/billing/preferences", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      const auth = await checkAdminAuth(req, tenant.id, "BILLING");
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error || "Not authenticated" });
      }
      if (!auth.hasMenuAccess) {
        return res.status(403).json({ error: "Permission denied" });
      }

      const { preferredPaymentMethod, poNumber, notes } = req.body;
      const prefs = await storage.upsertTenantBillingPreferences(tenant.id, {
        preferredPaymentMethod,
        poNumber,
        notes,
      });

      res.json(prefs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Schedule plan change
  app.post("/api/tenants/:slug/admin/billing/change-plan", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      const auth = await checkAdminAuth(req, tenant.id, "BILLING");
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error || "Not authenticated" });
      }
      if (!auth.hasMenuAccess) {
        return res.status(403).json({ error: "Permission denied" });
      }

      const { newPlanId, newBillingInterval } = req.body;
      if (!newPlanId) {
        return res.status(400).json({ error: "Nouveau forfait requis" });
      }

      const newPlan = await storage.getSubscriptionPlanById(newPlanId);
      if (!newPlan) {
        return res.status(400).json({ error: "Forfait non trouve" });
      }

      // Calculate effective date (1st of next month)
      const now = new Date();
      const effectiveDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      // Calculate proration if applicable
      const currentPlan = tenant.subscriptionPlanId 
        ? await storage.getSubscriptionPlanById(tenant.subscriptionPlanId) 
        : null;
      
      let prorataCredit = 0;
      let prorataDebit = 0;
      
      if (currentPlan && tenant.billingInterval) {
        // Calculate proration based on billing cycle
        let daysInPeriod: number;
        let daysRemaining: number;
        
        if (tenant.billingInterval === "YEARLY") {
          // For yearly billing, calculate based on subscription period
          const activeMandateSub = await storage.getMandateSubscriptionByTenant(tenant.id);
          
          if (activeMandateSub && activeMandateSub.status === "ACTIVE" && activeMandateSub.endDate) {
            // Use mandate subscription end date
            const endDate = new Date(activeMandateSub.endDate);
            const startDate = new Date(activeMandateSub.startDate);
            daysInPeriod = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
            daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
          } else {
            // Fall back to calculating from tenant creation date (anniversary-based)
            const createdAt = new Date(tenant.createdAt);
            let nextAnniversary = new Date(createdAt);
            nextAnniversary.setFullYear(now.getFullYear());
            if (nextAnniversary <= now) {
              nextAnniversary.setFullYear(now.getFullYear() + 1);
            }
            const prevAnniversary = new Date(nextAnniversary);
            prevAnniversary.setFullYear(prevAnniversary.getFullYear() - 1);
            
            daysInPeriod = Math.ceil((nextAnniversary.getTime() - prevAnniversary.getTime()) / (1000 * 60 * 60 * 24));
            daysRemaining = Math.max(0, Math.ceil((nextAnniversary.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
          }
        } else {
          // For monthly billing, use days in current month
          daysInPeriod = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
          daysRemaining = daysInPeriod - now.getDate();
        }
        
        // Plan prices are in euros - use the full period price for proration
        const currentPeriodPrice = tenant.billingInterval === "YEARLY" 
          ? currentPlan.yearlyPrice 
          : currentPlan.monthlyPrice;
        const newPeriodPrice = (newBillingInterval || tenant.billingInterval) === "YEARLY"
          ? newPlan.yearlyPrice
          : newPlan.monthlyPrice;
        
        // Credit for unused portion of current plan (in euros)
        prorataCredit = (currentPeriodPrice / daysInPeriod) * daysRemaining;
        // Debit for new plan portion if upgrading
        if (newPeriodPrice > currentPeriodPrice) {
          prorataDebit = ((newPeriodPrice - currentPeriodPrice) / daysInPeriod) * daysRemaining;
        }
      }

      // Get payment preferences
      const prefs = await storage.getTenantBillingPreferences(tenant.id);
      const paymentMethod = prefs?.preferredPaymentMethod || "STRIPE";

      const change = await storage.createBillingChange({
        tenantId: tenant.id,
        changeType: "PLAN_CHANGE",
        fromPlanId: tenant.subscriptionPlanId || undefined,
        toPlanId: newPlanId,
        fromBillingInterval: tenant.billingInterval || undefined,
        toBillingInterval: newBillingInterval || tenant.billingInterval || "MONTHLY",
        effectiveDate,
        prorataCredit, // Already in euros
        prorataDebit,
        paymentMethod,
      });

      res.json({ 
        change,
        message: `Changement de forfait programme pour le ${effectiveDate.toLocaleDateString('fr-FR')}`,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Schedule addon quantity change
  app.post("/api/tenants/:slug/admin/billing/change-addon", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      const auth = await checkAdminAuth(req, tenant.id, "BILLING");
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error || "Not authenticated" });
      }
      if (!auth.hasMenuAccess) {
        return res.status(403).json({ error: "Permission denied" });
      }

      const { addonId, newQuantity, immediate } = req.body;
      if (!addonId || newQuantity === undefined) {
        return res.status(400).json({ error: "Option et quantite requises" });
      }

      const addon = await storage.getAddonById(addonId);
      if (!addon) {
        return res.status(400).json({ error: "Option non trouvee" });
      }

      // Get current quantity
      const tenantAddon = await storage.getTenantAddon(tenant.id, addonId);
      const currentQuantity = tenantAddon?.quantity || 0;

      // Calculate effective date
      const now = new Date();
      const effectiveDate = immediate 
        ? now 
        : new Date(now.getFullYear(), now.getMonth() + 1, 1);

      // Calculate proration
      let prorataCredit = 0;
      let prorataDebit = 0;
      
      if (tenant.billingInterval) {
        // Get addon pricing
        let unitPrice = tenant.billingInterval === "YEARLY" 
          ? addon.defaultYearlyPrice 
          : addon.defaultMonthlyPrice;
        
        // Check for plan-specific override
        if (tenant.subscriptionPlanId) {
          const planAddons = await storage.getPlanAddonAccess(tenant.subscriptionPlanId);
          const accessEntry = planAddons.find((a: any) => a.addonId === addonId);
          if (accessEntry) {
            unitPrice = tenant.billingInterval === "YEARLY"
              ? (accessEntry.yearlyPrice ?? unitPrice)
              : (accessEntry.monthlyPrice ?? unitPrice);
          }
        }

        // Calculate proration based on billing cycle
        let daysInPeriod: number;
        let daysRemaining: number;
        
        if (tenant.billingInterval === "YEARLY") {
          // For yearly billing, calculate based on subscription period
          const activeMandateSub = await storage.getMandateSubscriptionByTenant(tenant.id);
          
          if (activeMandateSub && activeMandateSub.status === "ACTIVE" && activeMandateSub.endDate) {
            // Use mandate subscription end date
            const endDate = new Date(activeMandateSub.endDate);
            const startDate = new Date(activeMandateSub.startDate);
            daysInPeriod = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
            daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
          } else {
            // Fall back to calculating from tenant creation date (anniversary-based)
            const createdAt = new Date(tenant.createdAt);
            let nextAnniversary = new Date(createdAt);
            nextAnniversary.setFullYear(now.getFullYear());
            if (nextAnniversary <= now) {
              nextAnniversary.setFullYear(now.getFullYear() + 1);
            }
            const prevAnniversary = new Date(nextAnniversary);
            prevAnniversary.setFullYear(prevAnniversary.getFullYear() - 1);
            
            daysInPeriod = Math.ceil((nextAnniversary.getTime() - prevAnniversary.getTime()) / (1000 * 60 * 60 * 24));
            daysRemaining = Math.max(0, Math.ceil((nextAnniversary.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
          }
        } else {
          // For monthly billing, use days in current month
          daysInPeriod = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
          daysRemaining = daysInPeriod - now.getDate();
        }
        
        const quantityDiff = newQuantity - currentQuantity;
        
        if (quantityDiff > 0) {
          // Adding more: debit for the extra
          prorataDebit = (unitPrice / daysInPeriod) * daysRemaining * quantityDiff;
        } else if (quantityDiff < 0) {
          // Reducing: credit for unused
          prorataCredit = (unitPrice / daysInPeriod) * daysRemaining * Math.abs(quantityDiff);
        }
      }

      const prefs = await storage.getTenantBillingPreferences(tenant.id);
      const paymentMethod = prefs?.preferredPaymentMethod || "STRIPE";

      const change = await storage.createBillingChange({
        tenantId: tenant.id,
        changeType: "ADDON_CHANGE",
        addonId,
        fromQuantity: currentQuantity,
        toQuantity: newQuantity,
        effectiveDate,
        prorataCredit,
        prorataDebit,
        paymentMethod,
      });

      // If immediate, apply now
      if (immediate) {
        await storage.upsertTenantAddon(tenant.id, addonId, newQuantity);
        await storage.applyBillingChange(change.id);
        
        // Create ledger entries
        if (prorataCredit > 0) {
          await storage.createLedgerEntry({
            tenantId: tenant.id,
            billingChangeId: change.id,
            entryType: "CREDIT",
            amount: prorataCredit,
            description: `Credit prorata - Reduction ${addon.name}`,
          });
        }
        if (prorataDebit > 0) {
          await storage.createLedgerEntry({
            tenantId: tenant.id,
            billingChangeId: change.id,
            entryType: "DEBIT",
            amount: prorataDebit,
            description: `Debit prorata - Augmentation ${addon.name}`,
          });
        }
      }

      res.json({ 
        change,
        message: immediate 
          ? "Modification appliquee immediatement"
          : `Modification programmee pour le ${effectiveDate.toLocaleDateString('fr-FR')}`,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Cancel pending billing change
  app.delete("/api/tenants/:slug/admin/billing/changes/:changeId", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      const auth = await checkAdminAuth(req, tenant.id, "BILLING");
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error || "Not authenticated" });
      }
      if (!auth.hasMenuAccess) {
        return res.status(403).json({ error: "Permission denied" });
      }

      const cancelled = await storage.cancelBillingChange(req.params.changeId);
      if (!cancelled) {
        return res.status(404).json({ error: "Changement non trouve" });
      }

      res.json({ message: "Changement annule" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get ledger entries
  app.get("/api/tenants/:slug/admin/billing/ledger", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      const auth = await checkAdminAuth(req, tenant.id, "BILLING");
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error || "Not authenticated" });
      }
      if (!auth.hasMenuAccess) {
        return res.status(403).json({ error: "Permission denied" });
      }

      const entries = await storage.getTenantLedgerEntries(tenant.id);
      const balance = await storage.getTenantLedgerBalance(tenant.id);

      res.json({ entries, balance });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get mandate orders for tenant
  app.get("/api/tenants/:slug/admin/billing/mandate-orders", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      const auth = await checkAdminAuth(req, tenant.id, "BILLING");
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error || "Not authenticated" });
      }
      if (!auth.hasMenuAccess) {
        return res.status(403).json({ error: "Permission denied" });
      }

      const orders = await storage.getMandateOrdersByTenant(tenant.id);
      
      // Enrich orders with plan name
      const plans = await storage.getAllSubscriptionPlans();
      const planMap = new Map(plans.map(p => [p.id, p]));
      
      const enrichedOrders = orders.map(order => ({
        ...order,
        planName: planMap.get(order.planId)?.name || "Forfait",
      }));
      
      res.json(enrichedOrders);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get mandate invoices for tenant
  app.get("/api/tenants/:slug/admin/billing/mandate-invoices", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      const auth = await checkAdminAuth(req, tenant.id, "BILLING");
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error || "Not authenticated" });
      }
      if (!auth.hasMenuAccess) {
        return res.status(403).json({ error: "Permission denied" });
      }

      const invoices = await storage.getMandateInvoicesByTenant(tenant.id);
      
      // Enrich invoices with plan name from linked order
      const orders = await storage.getMandateOrdersByTenant(tenant.id);
      const plans = await storage.getAllSubscriptionPlans();
      const planMap = new Map(plans.map(p => [p.id, p]));
      const orderMap = new Map(orders.map(o => [o.id, o]));
      
      const enrichedInvoices = invoices.map(invoice => {
        const order = invoice.orderId ? orderMap.get(invoice.orderId) : null;
        const planId = order?.planId;
        return {
          ...invoice,
          planName: planId ? planMap.get(planId)?.name || "Forfait" : "Forfait",
        };
      });
      
      res.json(enrichedInvoices);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Download mandate order PDF for tenant
  app.get("/api/tenants/:slug/admin/billing/mandate-orders/:id/pdf", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      const auth = await checkAdminAuth(req, tenant.id, "BILLING");
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error || "Not authenticated" });
      }
      if (!auth.hasMenuAccess) {
        return res.status(403).json({ error: "Permission denied" });
      }

      const order = await storage.getMandateOrderById(req.params.id);
      if (!order) {
        return res.status(404).json({ error: "Bon de commande non trouve" });
      }
      if (order.tenantId !== tenant.id) {
        return res.status(403).json({ error: "Acces non autorise" });
      }

      const [plan, settings] = await Promise.all([
        order.planId ? storage.getSubscriptionPlanById(order.planId) : undefined,
        storage.getCompanySettings()
      ]);
      
      // Use stored addonsSnapshot from order
      let addonsWithQuantity: any[] = [];
      if (order.addonsSnapshot) {
        try {
          const snapshot = JSON.parse(order.addonsSnapshot);
          addonsWithQuantity = snapshot.map((s: any) => ({
            id: s.id,
            name: s.name,
            code: s.code,
            defaultYearlyPrice: s.unitPrice, // already in euros
            quantity: s.quantity
          }));
        } catch (e) { /* ignore */ }
      }
      
      const orderWithPlan = { 
        ...order, 
        plan: plan || undefined,
        tenantType: tenant.tenantType,
        addons: addonsWithQuantity
      };
      
      const pdfBuffer = await generateMandateOrderPdf(orderWithPlan, settings);
      
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="bon-commande-${order.orderNumber}.pdf"`);
      res.send(pdfBuffer);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Upload BC document for mandate order (tenant admin)
  app.post("/api/tenants/:slug/admin/billing/mandate-orders/:id/upload-bc", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      const auth = await checkAdminAuth(req, tenant.id, "BILLING");
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error || "Not authenticated" });
      }
      if (!auth.hasMenuAccess) {
        return res.status(403).json({ error: "Permission denied" });
      }

      const order = await storage.getMandateOrderById(req.params.id);
      if (!order) {
        return res.status(404).json({ error: "Commande non trouvee" });
      }
      if (order.tenantId !== tenant.id) {
        return res.status(403).json({ error: "Acces non autorise" });
      }

      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL, orderId: req.params.id });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Save BC document metadata after upload (tenant admin)
  app.post("/api/tenants/:slug/admin/billing/mandate-orders/:id/save-bc-document", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      const auth = await checkAdminAuth(req, tenant.id, "BILLING");
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error || "Not authenticated" });
      }
      if (!auth.hasMenuAccess) {
        return res.status(403).json({ error: "Permission denied" });
      }

      const order = await storage.getMandateOrderById(req.params.id);
      if (!order) {
        return res.status(404).json({ error: "Commande non trouvee" });
      }
      if (order.tenantId !== tenant.id) {
        return res.status(403).json({ error: "Acces non autorise" });
      }

      const { fileName, fileUrl, fileSize, mimeType, reference } = req.body;

      const objectStorageService = new ObjectStorageService();
      const normalizedPath = objectStorageService.normalizeObjectEntityPath(fileUrl);

      const document = await storage.createMandateDocument({
        orderId: req.params.id,
        tenantId: tenant.id,
        documentType: "PURCHASE_ORDER",
        fileName,
        fileUrl: normalizedPath,
        fileSize,
        mimeType,
        reference: reference || order.purchaseOrderNumber,
        uploadedBy: auth.userId,
      });

      res.json(document);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get BC documents for mandate order (tenant admin)
  app.get("/api/tenants/:slug/admin/billing/mandate-orders/:id/documents", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      const auth = await checkAdminAuth(req, tenant.id, "BILLING");
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error || "Not authenticated" });
      }
      if (!auth.hasMenuAccess) {
        return res.status(403).json({ error: "Permission denied" });
      }

      const order = await storage.getMandateOrderById(req.params.id);
      if (!order) {
        return res.status(404).json({ error: "Commande non trouvee" });
      }
      if (order.tenantId !== tenant.id) {
        return res.status(403).json({ error: "Acces non autorise" });
      }

      const documents = await storage.getMandateDocumentsByOrder(req.params.id);
      res.json(documents);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update mandate order BC info (tenant admin)
  app.put("/api/tenants/:slug/admin/billing/mandate-orders/:id/bc-info", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      const auth = await checkAdminAuth(req, tenant.id, "BILLING");
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error || "Not authenticated" });
      }
      if (!auth.hasMenuAccess) {
        return res.status(403).json({ error: "Permission denied" });
      }

      const order = await storage.getMandateOrderById(req.params.id);
      if (!order) {
        return res.status(404).json({ error: "Commande non trouvee" });
      }
      if (order.tenantId !== tenant.id) {
        return res.status(403).json({ error: "Acces non autorise" });
      }

      const { engagementNumber, purchaseOrderNumber, serviceCode } = req.body;

      const updatedOrder = await storage.updateMandateOrder(req.params.id, {
        engagementNumber: engagementNumber || null,
        purchaseOrderNumber: purchaseOrderNumber || null,
        serviceCode: serviceCode || null,
      });

      res.json(updatedOrder);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Validate mandate order by tenant admin (client validates their purchase order)
  app.put("/api/tenants/:slug/admin/billing/mandate-orders/:id/validate", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      const auth = await checkAdminAuth(req, tenant.id, "BILLING");
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error || "Not authenticated" });
      }
      if (!auth.hasMenuAccess) {
        return res.status(403).json({ error: "Permission denied" });
      }

      const order = await storage.getMandateOrderById(req.params.id);
      if (!order) {
        return res.status(404).json({ error: "Commande non trouvee" });
      }
      if (order.tenantId !== tenant.id) {
        return res.status(403).json({ error: "Acces non autorise" });
      }

      if (order.status !== "PENDING_VALIDATION") {
        return res.status(400).json({ error: "Cette commande ne peut plus etre validee dans ce statut" });
      }

      const documents = await storage.getMandateDocumentsByOrder(order.id);
      if (documents.length === 0) {
        return res.status(400).json({ error: "Veuillez joindre votre bon de commande" });
      }

      const updatedOrder = await storage.updateMandateOrderStatus(order.id, "PENDING_BC", {
        validatedBy: auth.userId
      });

      const bcInfo = order.purchaseOrderNumber ? ` avec le BC ${order.purchaseOrderNumber}` : "";
      await storage.createMandateActivity({
        tenantId: tenant.id,
        orderId: order.id,
        activityType: "BC_UPLOADED",
        title: "Commande validee par le client",
        description: `La commande ${order.orderNumber} a ete validee${bcInfo}`,
        oldValue: "PENDING_VALIDATION",
        newValue: "PENDING_BC",
        performedBy: auth.userId,
        performedByType: "admin",
      });

      res.json(updatedOrder);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Download mandate invoice PDF for tenant
  app.get("/api/tenants/:slug/admin/billing/mandate-invoices/:id/pdf", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      const auth = await checkAdminAuth(req, tenant.id, "BILLING");
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error || "Not authenticated" });
      }
      if (!auth.hasMenuAccess) {
        return res.status(403).json({ error: "Permission denied" });
      }

      const invoice = await storage.getMandateInvoiceById(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: "Facture non trouvee" });
      }
      if (invoice.tenantId !== tenant.id) {
        return res.status(403).json({ error: "Acces non autorise" });
      }

      const settings = await storage.getCompanySettings();
      const order = invoice.orderId ? await storage.getMandateOrderById(invoice.orderId) : undefined;
      const plan = order?.planId ? await storage.getSubscriptionPlanById(order.planId) : undefined;
      
      // Use stored addonsSnapshot from invoice or order
      let addonsWithQuantity: any[] = [];
      const snapshotSource = invoice.addonsSnapshot || order?.addonsSnapshot;
      if (snapshotSource) {
        try {
          const snapshot = JSON.parse(snapshotSource);
          addonsWithQuantity = snapshot.map((s: any) => ({
            id: s.id,
            name: s.name,
            code: s.code,
            defaultYearlyPrice: s.unitPrice, // already in euros
            quantity: s.quantity
          }));
        } catch (e) { /* ignore */ }
      }
      
      const invoiceWithPlan = { 
        ...invoice, 
        order: order || undefined, 
        plan: plan || undefined,
        tenantType: tenant.tenantType,
        addons: addonsWithQuantity
      };
      
      const pdfBuffer = await generateMandateInvoicePdf(invoiceWithPlan, settings);
      
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="facture-${invoice.invoiceNumber}.pdf"`);
      res.send(pdfBuffer);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get mandate billing information for tenant
  app.get("/api/tenants/:slug/admin/billing/mandate-info", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      const auth = await checkAdminAuth(req, tenant.id, "BILLING");
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error || "Not authenticated" });
      }
      if (!auth.hasMenuAccess) {
        return res.status(403).json({ error: "Permission denied" });
      }

      res.json({
        siret: tenant.siret,
        mandateBillingAddress: tenant.mandateBillingAddress,
        mandateBillingService: tenant.mandateBillingService,
        mandateAccountingContactName: tenant.mandateAccountingContactName,
        mandateAccountingContactEmail: tenant.mandateAccountingContactEmail,
        mandateAccountingContactPhone: tenant.mandateAccountingContactPhone,
        mandateServiceCode: tenant.mandateServiceCode,
        mandateEngagementNumber: tenant.mandateEngagementNumber,
        mandatePurchaseOrderNumber: tenant.mandatePurchaseOrderNumber,
        mandateUseChorusPro: tenant.mandateUseChorusPro,
        mandateChorusProSiret: tenant.mandateChorusProSiret,
        mandateChorusProServiceCode: tenant.mandateChorusProServiceCode,
        mandateChorusProServiceLabel: tenant.mandateChorusProServiceLabel,
        mandateChorusProEngagementNumber: tenant.mandateChorusProEngagementNumber,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update mandate billing information for tenant
  app.put("/api/tenants/:slug/admin/billing/mandate-info", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      const auth = await checkAdminAuth(req, tenant.id, "BILLING");
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error || "Not authenticated" });
      }
      if (!auth.hasMenuAccess) {
        return res.status(403).json({ error: "Permission denied" });
      }

      const {
        mandateBillingAddress,
        mandateBillingService,
        mandateAccountingContactName,
        mandateAccountingContactEmail,
        mandateAccountingContactPhone,
        mandateServiceCode,
        mandateEngagementNumber,
        mandatePurchaseOrderNumber,
        mandateUseChorusPro,
        mandateChorusProSiret,
        mandateChorusProServiceCode,
        mandateChorusProServiceLabel,
        mandateChorusProEngagementNumber,
      } = req.body;

      const updatedTenant = await storage.updateTenantMandateBillingInfo(tenant.id, {
        mandateBillingAddress: mandateBillingAddress || null,
        mandateBillingService: mandateBillingService || null,
        mandateAccountingContactName: mandateAccountingContactName || null,
        mandateAccountingContactEmail: mandateAccountingContactEmail || null,
        mandateAccountingContactPhone: mandateAccountingContactPhone || null,
        mandateServiceCode: mandateServiceCode || null,
        mandateEngagementNumber: mandateEngagementNumber || null,
        mandatePurchaseOrderNumber: mandatePurchaseOrderNumber || null,
        mandateUseChorusPro: mandateUseChorusPro ?? false,
        mandateChorusProSiret: mandateChorusProSiret || null,
        mandateChorusProServiceCode: mandateChorusProServiceCode || null,
        mandateChorusProServiceLabel: mandateChorusProServiceLabel || null,
        mandateChorusProEngagementNumber: mandateChorusProEngagementNumber || null,
      });

      res.json({ success: true, tenant: updatedTenant });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get active mandate subscription details for tenant billing display
  app.get("/api/tenants/:slug/admin/billing/active-subscription", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      const auth = await checkAdminAuth(req, tenant.id, "BILLING");
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error || "Not authenticated" });
      }

      // Get active mandate subscription
      const mandateSubscription = await storage.getActiveMandateSubscription(tenant.id);
      if (!mandateSubscription) {
        return res.json({ active: false });
      }

      // Get the plan details
      const plan = await storage.getSubscriptionPlanById(mandateSubscription.planId);
      
      // Get the latest paid/sent invoice for addons snapshot (sorted by creation date descending)
      const invoices = await storage.getMandateInvoicesByTenant(tenant.id);
      const sortedInvoices = [...invoices].sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      const latestInvoice = sortedInvoices.find(inv => ["SENT", "MANDATED", "PAID"].includes(inv.status));
      
      // Parse addons from invoice snapshot or order
      let addons: any[] = [];
      if (latestInvoice?.addonsSnapshot) {
        try {
          addons = JSON.parse(latestInvoice.addonsSnapshot);
        } catch (e) { /* ignore */ }
      } else {
        // Fall back to order snapshot
        const order = mandateSubscription.orderId ? await storage.getMandateOrderById(mandateSubscription.orderId) : null;
        if (order?.addonsSnapshot) {
          try {
            addons = JSON.parse(order.addonsSnapshot);
          } catch (e) { /* ignore */ }
        }
      }
      
      // Fall back to tenant.purchased* columns if no addons from invoice/order
      if (addons.length === 0) {
        const allAddons = await storage.listAddons();
        
        if (tenant.purchasedAssociations && tenant.purchasedAssociations > 0) {
          const assocAddon = allAddons.find((a: any) => a.code?.toUpperCase() === "ASSOCIATIONS");
          if (assocAddon) {
            addons.push({
              id: assocAddon.id,
              code: assocAddon.code,
              name: assocAddon.name,
              quantity: tenant.purchasedAssociations,
              unitPrice: assocAddon.defaultYearlyPrice || 0,
              totalPrice: (assocAddon.defaultYearlyPrice || 0) * tenant.purchasedAssociations,
            });
          }
        }
        
        if (tenant.purchasedAdmins && tenant.purchasedAdmins > 0) {
          const adminAddon = allAddons.find((a: any) => a.code?.toUpperCase() === "ADMIN");
          if (adminAddon) {
            addons.push({
              id: adminAddon.id,
              code: adminAddon.code,
              name: adminAddon.name,
              quantity: tenant.purchasedAdmins,
              unitPrice: adminAddon.defaultYearlyPrice || 0,
              totalPrice: (adminAddon.defaultYearlyPrice || 0) * tenant.purchasedAdmins,
            });
          }
        }
        
        if (tenant.purchasedCommunes && tenant.purchasedCommunes > 0) {
          const communeAddon = allAddons.find((a: any) => a.code?.toUpperCase() === "MAIRIES");
          if (communeAddon) {
            addons.push({
              id: communeAddon.id,
              code: communeAddon.code,
              name: communeAddon.name,
              quantity: tenant.purchasedCommunes,
              unitPrice: communeAddon.defaultYearlyPrice || 0,
              totalPrice: (communeAddon.defaultYearlyPrice || 0) * tenant.purchasedCommunes,
            });
          }
        }
      }

      res.json({
        active: true,
        subscription: {
          id: mandateSubscription.id,
          status: mandateSubscription.status,
          startDate: mandateSubscription.startDate,
          endDate: mandateSubscription.endDate,
          planId: mandateSubscription.planId,
        },
        plan: plan ? {
          id: plan.id,
          name: plan.name,
          monthlyPrice: plan.monthlyPrice,
          yearlyPrice: plan.yearlyPrice,
        } : null,
        addons,
        latestInvoice: latestInvoice ? {
          id: latestInvoice.id,
          invoiceNumber: latestInvoice.invoiceNumber,
          status: latestInvoice.status,
          totalAmount: latestInvoice.totalAmount,
          periodStart: latestInvoice.periodStart,
          periodEnd: latestInvoice.periodEnd,
          paidAt: latestInvoice.paidAt,
        } : null,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get Stripe invoices for a tenant
  app.get("/api/tenants/:slug/admin/billing/stripe-invoices", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      const auth = await checkAdminAuth(req, tenant.id, "BILLING");
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error || "Not authenticated" });
      }
      if (!auth.hasMenuAccess) {
        return res.status(403).json({ error: "Permission denied" });
      }

      // If no Stripe customer ID, return empty array
      if (!tenant.stripeCustomerId) {
        return res.json([]);
      }

      // Query Stripe invoices for this customer from the stripe sync tables
      const result = await db.execute(sql`
        SELECT 
          i.id,
          i.number as invoice_number,
          i.status,
          i.amount_due,
          i.amount_paid,
          i.total,
          i.currency,
          i.period_start,
          i.period_end,
          i.hosted_invoice_url,
          i.invoice_pdf,
          i.created,
          i._updated_at as updated_at
        FROM stripe.invoices i
        WHERE i.customer = ${tenant.stripeCustomerId}
        ORDER BY i.created DESC
      `);

      res.json(result.rows);
    } catch (error: any) {
      console.error("Error fetching tenant Stripe invoices:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Public subscription endpoint - handles both Stripe and administrative payments
  app.post("/api/public/subscribe", async (req, res) => {
    try {
      const { planId, billingPeriod, addonSelections, organization, admin, paymentMethod } = req.body;

      // Validate required fields
      if (!planId || !organization || !admin || !paymentMethod) {
        return res.status(400).json({ error: "Donnees manquantes" });
      }

      // Check if slug is available
      const existingTenant = await storage.getTenantBySlug(organization.slug);
      if (existingTenant) {
        return res.status(400).json({ error: "Cet identifiant est deja utilise" });
      }

      // Check if email is already used
      const existingUser = await storage.getUserByEmail(admin.email);
      if (existingUser) {
        return res.status(400).json({ error: "Cet email est deja utilise" });
      }

      // Get the subscription plan
      const plan = await storage.getSubscriptionPlanById(planId);
      if (!plan) {
        return res.status(400).json({ error: "Forfait non trouve" });
      }

      // Build address string from components
      const fullAddress = [
        organization.address,
        organization.postalCode,
        organization.city
      ].filter(Boolean).join(", ");

      // Calculate addon quantities from selections
      let purchasedCommunes = 0;
      let purchasedAssociations = 0;
      let purchasedAdmins = 0;
      
      if (addonSelections && addonSelections.length > 0) {
        for (const selection of addonSelections) {
          if (selection.quantity > 0) {
            const addon = await storage.getAddonById(selection.addonId);
            if (addon) {
              if (addon.code === "MAIRIES") purchasedCommunes = selection.quantity;
              else if (addon.code === "ASSOCIATIONS") purchasedAssociations = selection.quantity;
              else if (addon.code === "ADMIN") purchasedAdmins = selection.quantity;
            }
          }
        }
      }

      // Create tenant - use TRIAL status for now, will be updated after payment
      const tenant = await storage.createTenant({
        name: organization.name,
        slug: organization.slug,
        contactEmail: organization.contactEmail,
        contactName: admin.name,
        contactAddress: fullAddress || null,
        siret: organization.siret || null,
        subscriptionPlan: "FREE_TRIAL", // Start as trial, updated on payment
        subscriptionPlanId: plan.id,
        billingInterval: billingPeriod === "yearly" ? "YEARLY" : "MONTHLY",
        billingStatus: "TRIAL", // Will be updated to ACTIVE after payment
        // Store addon quantities for both Stripe and mandate flows
        purchasedCommunes,
        purchasedAssociations,
        purchasedAdmins,
      });

      // Create admin user
      const passwordHash = await bcrypt.hash(admin.password, 10);
      const user = await storage.createUser({
        tenantId: tenant.id,
        name: admin.name,
        email: admin.email,
        passwordHash,
        role: "ADMIN",
      });

      // Store addon selections in tenant metadata for later processing
      // (We'll handle this during payment completion)

      if (paymentMethod === "stripe") {
        // Create Stripe customer and checkout session
        const stripe = await getUncachableStripeClient();
        
        const customer = await stripe.customers.create({
          email: organization.contactEmail,
          name: organization.name,
          metadata: { tenantId: tenant.id },
        });
        
        await storage.updateTenantStripeInfo(tenant.id, { stripeCustomerId: customer.id });

        // Calculate total price for Stripe (prices are in euros, convert to centimes for Stripe API)
        const basePriceInEuros = billingPeriod === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
        const basePriceInCents = basePriceInEuros * 100; // Convert euros to centimes for Stripe
        const recurringInterval = billingPeriod === "yearly" ? 'year' : 'month';
        
        // Build line items array with plan and addons
        const lineItems: any[] = [{
          price_data: {
            currency: 'eur',
            product_data: {
              name: `Abonnement ${plan.name}`,
              description: plan.description || `Forfait ${plan.code}`,
            },
            unit_amount: basePriceInCents,
            recurring: {
              interval: recurringInterval,
            },
          },
          quantity: 1,
        }];
        
        // Add addon line items for Stripe checkout
        if (addonSelections && addonSelections.length > 0) {
          const planAddonAccess = await storage.getPlanAddonAccess(plan.id);
          
          for (const selection of addonSelections) {
            if (selection.quantity > 0) {
              const addon = await storage.getAddonById(selection.addonId);
              if (addon) {
                // Check for plan-specific pricing override
                const accessEntry = planAddonAccess.find((a: { addonId: string }) => a.addonId === selection.addonId);
                const monthlyPrice = accessEntry?.monthlyPrice ?? addon.defaultMonthlyPrice ?? 0;
                const yearlyPrice = accessEntry?.yearlyPrice ?? addon.defaultYearlyPrice ?? 0;
                // Prices are in euros, convert to centimes for Stripe
                const unitPriceInCents = Math.round((billingPeriod === "yearly" ? yearlyPrice : monthlyPrice) * 100);
                
                if (unitPriceInCents > 0) {
                  lineItems.push({
                    price_data: {
                      currency: 'eur',
                      product_data: {
                        name: `Option: ${addon.name}`,
                        description: addon.description || `Option ${addon.code}`,
                      },
                      unit_amount: unitPriceInCents,
                      recurring: {
                        interval: recurringInterval,
                      },
                    },
                    quantity: selection.quantity,
                  });
                }
              }
            }
          }
        }
        
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        
        const session = await stripe.checkout.sessions.create({
          customer: customer.id,
          payment_method_types: ['card'],
          line_items: lineItems,
          mode: 'subscription',
          success_url: `${baseUrl}/structures/${tenant.slug}/admin/billing?success=true`,
          cancel_url: `${baseUrl}/subscribe?plan=${planId}&canceled=true`,
          metadata: { 
            tenantId: tenant.id,
            planId: plan.id,
            billingPeriod,
          },
        });

        res.json({ checkoutUrl: session.url, slug: tenant.slug });
      } else {
        // Create a quote for administrative payment
        const quoteNumber = await storage.getNextQuoteNumber();
        const validUntil = new Date();
        validUntil.setDate(validUntil.getDate() + 30);

        // Get company settings for emitter info
        const companySettings = await storage.getCompanySettings();
        
        // Get plan addon access for pricing
        const planAddonAccess = await storage.getPlanAddonAccess(plan.id);

        // Calculate prices
        const basePriceInCents = billingPeriod === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
        let subtotal = basePriceInCents;
        
        // Add addon prices (flat pricing: price * quantity, convert euros to centimes)
        if (addonSelections && addonSelections.length > 0) {
          for (const selection of addonSelections) {
            const addon = await storage.getAddonById(selection.addonId);
            if (addon && selection.quantity > 0) {
              // Check for plan-specific pricing override
              const accessEntry = planAddonAccess.find((a: { addonId: string }) => a.addonId === selection.addonId);
              const monthlyPrice = accessEntry?.monthlyPrice ?? addon.defaultMonthlyPrice;
              const yearlyPrice = accessEntry?.yearlyPrice ?? addon.defaultYearlyPrice;
              const unitPrice = billingPeriod === "yearly" ? yearlyPrice : monthlyPrice;
              subtotal += unitPrice * selection.quantity * 100; // Convert euros to centimes
            }
          }
        }

        const taxRate = 20;
        const taxAmount = Math.round(subtotal * taxRate / 100);
        const total = subtotal + taxAmount;

        const quote = await storage.createQuote({
          quoteNumber,
          tenantId: tenant.id,
          clientName: organization.name,
          clientEmail: organization.contactEmail,
          clientAddress: [organization.address, organization.postalCode, organization.city].filter(Boolean).join(", ") || null,
          clientSiret: organization.siret || null,
          emitterName: companySettings?.companyName || "Voxpopulous",
          emitterAddress: companySettings?.address || null,
          emitterSiret: companySettings?.siret || null,
          emitterTva: companySettings?.tvaNumber || null,
          status: "DRAFT",
          subtotal,
          taxRate,
          taxAmount,
          total,
          validUntil,
          notes: `Abonnement ${plan.name} - ${billingPeriod === "yearly" ? "Annuel" : "Mensuel"}`,
        });

        // Create quote line items
        await storage.createQuoteLineItem({
          quoteId: quote.id,
          planId: plan.id,
          billingInterval: billingPeriod === "yearly" ? "YEARLY" : "MONTHLY",
          description: `Forfait ${plan.name} - ${billingPeriod === "yearly" ? "Annuel" : "Mensuel"}`,
          quantity: 1,
          unitPrice: basePriceInCents,
          total: basePriceInCents,
        });

        // Add addon line items (flat pricing: price * quantity)
        if (addonSelections && addonSelections.length > 0) {
          for (const selection of addonSelections) {
            const addon = await storage.getAddonById(selection.addonId);
            if (addon && selection.quantity > 0) {
              // Check for plan-specific pricing override (already fetched above)
              const accessEntry = planAddonAccess.find((a: { addonId: string }) => a.addonId === selection.addonId);
              const monthlyPrice = accessEntry?.monthlyPrice ?? addon.defaultMonthlyPrice;
              const yearlyPrice = accessEntry?.yearlyPrice ?? addon.defaultYearlyPrice;
              const unitPriceEuros = billingPeriod === "yearly" ? yearlyPrice : monthlyPrice;
              const unitPriceCents = unitPriceEuros * 100;
              const totalCents = unitPriceCents * selection.quantity;
              await storage.createQuoteLineItem({
                quoteId: quote.id,
                addonId: addon.id,
                description: `${addon.name} (x${selection.quantity})`,
                quantity: selection.quantity,
                unitPrice: unitPriceCents,
                total: totalCents,
              });
            }
          }
        }

        // Send welcome email for administrative payment
        const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
        const host = req.get("host") || "localhost:5000";
        const loginUrl = `${protocol}://${host}/structures/${tenant.slug}/admin/login`;
        
        try {
          await sendWelcomeEmail(
            admin.email,
            admin.name,
            organization.name,
            loginUrl,
            admin.email,
            admin.password
          );
          console.log(`Welcome email sent to ${admin.email}`);
        } catch (emailError) {
          console.error("Failed to send welcome email:", emailError);
          // Don't fail the subscription if email fails
        }

        res.json({ quoteId: quote.id, slug: tenant.slug });
      }
    } catch (error: any) {
      console.error("Subscription error:", error);
      res.status(500).json({ error: error.message || "Erreur lors de l'inscription" });
    }
  });

  // Trial signup with card capture (Setup Intent) or administrative mandate
  app.post("/api/public/subscribe-trial", async (req, res) => {
    try {
      const { planId, billingPeriod, addonSelections, organization, admin, captureCard, poNumber } = req.body;

      // Validate required fields
      if (!planId || !organization || !admin) {
        return res.status(400).json({ error: "Donnees manquantes" });
      }

      // Check if slug is available
      const existingTenant = await storage.getTenantBySlug(organization.slug);
      if (existingTenant) {
        return res.status(400).json({ error: "Cet identifiant est deja utilise" });
      }

      // Check if email is already used
      const existingUser = await storage.getUserByEmail(admin.email);
      if (existingUser) {
        return res.status(400).json({ error: "Cet email est deja utilise" });
      }

      // Get the subscription plan
      const plan = await storage.getSubscriptionPlanById(planId);
      if (!plan) {
        return res.status(400).json({ error: "Forfait non trouve" });
      }

      // Build address string from components
      const fullAddress = [
        organization.address,
        organization.postalCode,
        organization.city
      ].filter(Boolean).join(", ");

      // Calculate trial end date (14 days from now)
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 14);

      // Create tenant in TRIAL status
      const tenant = await storage.createTenant({
        name: organization.name,
        slug: organization.slug,
        contactEmail: organization.contactEmail,
        contactName: admin.name,
        contactAddress: fullAddress || null,
        siret: organization.siret || null,
        subscriptionPlan: "FREE_TRIAL",
        subscriptionPlanId: plan.id,
        billingInterval: billingPeriod === "yearly" ? "YEARLY" : "MONTHLY",
        billingStatus: "TRIAL",
        trialEndsAt,
      });

      // Create admin user
      const passwordHash = await bcrypt.hash(admin.password, 10);
      const user = await storage.createUser({
        tenantId: tenant.id,
        name: admin.name,
        email: admin.email,
        passwordHash,
        role: "ADMIN",
      });

      // Store addon selections and billing preferences
      const preferredPaymentMethod = captureCard ? "STRIPE" : "ADMINISTRATIVE_MANDATE";
      const billingNotes = JSON.stringify({
        pendingAddons: addonSelections || [],
        selectedPlanId: plan.id,
        selectedBillingPeriod: billingPeriod,
      });
      
      await storage.upsertTenantBillingPreferences(tenant.id, {
        preferredPaymentMethod,
        poNumber: poNumber || null,
        notes: billingNotes,
      });

      let setupIntentClientSecret = null;
      let stripeCustomerId = null;
      let quoteId = null;

      // If user wants to capture card for automatic billing after trial
      if (captureCard) {
        const stripe = await getUncachableStripeClient();
        
        // Create Stripe customer
        const customer = await stripe.customers.create({
          email: organization.contactEmail,
          name: organization.name,
          metadata: { tenantId: tenant.id },
        });
        
        stripeCustomerId = customer.id;

        // Create Setup Intent to capture card without charging
        const setupIntent = await stripe.setupIntents.create({
          customer: customer.id,
          payment_method_types: ['card'],
          metadata: {
            tenantId: tenant.id,
            planId: plan.id,
            billingPeriod,
          },
          usage: 'off_session', // For future off-session payments
        });

        await storage.updateTenantStripeInfo(tenant.id, {
          stripeCustomerId: customer.id,
          stripeSetupIntentId: setupIntent.id,
        });

        setupIntentClientSecret = setupIntent.client_secret;
      } else {
        // Administrative mandate - create a quote for approval
        const quoteNumber = await storage.getNextQuoteNumber();
        const validUntil = new Date();
        validUntil.setDate(validUntil.getDate() + 30);

        const companySettings = await storage.getCompanySettings();
        const planAddonAccess = await storage.getPlanAddonAccess(plan.id);

        // Calculate prices - plan prices are in euros, convert to cents
        const basePriceEuros = billingPeriod === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
        const basePriceCents = basePriceEuros * 100;
        let subtotal = basePriceCents;
        
        // Add addon prices if any
        if (addonSelections && addonSelections.length > 0) {
          for (const selection of addonSelections) {
            const addon = await storage.getAddonById(selection.addonId);
            if (addon && selection.quantity > 0) {
              const accessEntry = planAddonAccess.find((a: { addonId: string }) => a.addonId === selection.addonId);
              const monthlyPrice = accessEntry?.monthlyPrice ?? addon.defaultMonthlyPrice;
              const yearlyPrice = accessEntry?.yearlyPrice ?? addon.defaultYearlyPrice;
              const unitPriceEuros = billingPeriod === "yearly" ? yearlyPrice : monthlyPrice;
              const unitPriceCents = unitPriceEuros * 100;
              subtotal += unitPriceCents * selection.quantity;
            }
          }
        }

        const taxRate = 20;
        const taxAmount = Math.round(subtotal * taxRate / 100);
        const total = subtotal + taxAmount;

        const quote = await storage.createQuote({
          quoteNumber,
          tenantId: tenant.id,
          clientName: organization.name,
          clientEmail: organization.contactEmail,
          clientAddress: fullAddress || null,
          clientSiret: organization.siret || null,
          emitterName: companySettings?.companyName || "Voxpopulous",
          emitterAddress: companySettings?.address || null,
          emitterSiret: companySettings?.siret || null,
          emitterTva: companySettings?.tvaNumber || null,
          status: "DRAFT",
          subtotal,
          taxRate,
          taxAmount,
          total,
          validUntil,
          notes: `Abonnement ${plan.name} - ${billingPeriod === "yearly" ? "Annuel" : "Mensuel"}${poNumber ? ` - Bon de commande: ${poNumber}` : ''}`,
        });

        // Create quote line items
        await storage.createQuoteLineItem({
          quoteId: quote.id,
          planId: plan.id,
          billingInterval: billingPeriod === "yearly" ? "YEARLY" : "MONTHLY",
          description: `Forfait ${plan.name} - ${billingPeriod === "yearly" ? "Annuel" : "Mensuel"} (Debut apres periode d'essai)`,
          quantity: 1,
          unitPrice: basePriceCents,
          total: basePriceCents,
        });

        // Add addon line items
        if (addonSelections && addonSelections.length > 0) {
          for (const selection of addonSelections) {
            const addon = await storage.getAddonById(selection.addonId);
            if (addon && selection.quantity > 0) {
              const accessEntry = planAddonAccess.find((a: { addonId: string }) => a.addonId === selection.addonId);
              const monthlyPrice = accessEntry?.monthlyPrice ?? addon.defaultMonthlyPrice;
              const yearlyPrice = accessEntry?.yearlyPrice ?? addon.defaultYearlyPrice;
              const unitPriceEuros = billingPeriod === "yearly" ? yearlyPrice : monthlyPrice;
              const unitPriceCents = unitPriceEuros * 100;
              const totalCents = unitPriceCents * selection.quantity;
              await storage.createQuoteLineItem({
                quoteId: quote.id,
                addonId: addon.id,
                description: `${addon.name} (x${selection.quantity})`,
                quantity: selection.quantity,
                unitPrice: unitPriceCents,
                total: totalCents,
              });
            }
          }
        }

        quoteId = quote.id;
      }

      // Send welcome email
      const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
      const host = req.get("host") || "localhost:5000";
      const loginUrl = `${protocol}://${host}/structures/${tenant.slug}/admin/login`;
      
      try {
        await sendWelcomeEmail(
          admin.email,
          admin.name,
          organization.name,
          loginUrl,
          admin.email,
          admin.password
        );
        console.log(`Welcome email sent to ${admin.email}`);
      } catch (emailError) {
        console.error("Failed to send welcome email:", emailError);
      }

      res.json({
        success: true,
        slug: tenant.slug,
        trialEndsAt: trialEndsAt.toISOString(),
        setupIntentClientSecret, // For Stripe Elements on frontend (Stripe flow)
        stripeCustomerId,
        quoteId, // For administrative mandate flow
        paymentMethod: captureCard ? 'stripe' : 'administrative_mandate',
      });
    } catch (error: any) {
      console.error("Trial subscription error:", error);
      res.status(500).json({ error: error.message || "Erreur lors de l'inscription" });
    }
  });

  // Confirm Setup Intent (called after card capture on frontend)
  app.post("/api/tenants/:slug/admin/billing/confirm-setup-intent", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      const auth = await checkAdminAuth(req, tenant.id, "BILLING");
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error || "Not authenticated" });
      }

      const { paymentMethodId } = req.body;
      if (!paymentMethodId) {
        return res.status(400).json({ error: "Payment method ID required" });
      }

      // Store the payment method for future use
      await storage.updateTenantStripeInfo(tenant.id, {
        stripeDefaultPaymentMethodId: paymentMethodId,
      });

      // Set as default payment method on the Stripe customer
      if (tenant.stripeCustomerId) {
        const stripe = await getUncachableStripeClient();
        await stripe.customers.update(tenant.stripeCustomerId, {
          invoice_settings: { default_payment_method: paymentMethodId },
        });
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get trial status
  app.get("/api/tenants/:slug/admin/billing/trial-status", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      const auth = await checkAdminAuth(req, tenant.id, "BILLING");
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error || "Not authenticated" });
      }

      const trialEndsAt = tenant.trialEndsAt;
      const isInTrial = tenant.billingStatus === "TRIAL" && trialEndsAt && new Date(trialEndsAt) > new Date();
      const daysRemaining = trialEndsAt
        ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : 0;

      res.json({
        isInTrial,
        trialEndsAt,
        daysRemaining,
        billingStatus: tenant.billingStatus,
        hasPaymentMethod: !!tenant.stripeDefaultPaymentMethodId,
        hasStripeCustomer: !!tenant.stripeCustomerId,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==========================================
  // TENANT ADMIN MANAGEMENT ROUTES
  // ==========================================

  // List tenant admins with quota
  app.get("/api/tenants/:slug/admin/admins", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      const auth = await checkAdminAuth(req, tenant.id, "ADMINS");
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error || "Non authentifie" });
      }
      if (!auth.hasMenuAccess) {
        return res.status(403).json({ error: "Permission denied" });
      }

      const admins = await storage.getUsersByTenantId(tenant.id);
      const quota = await storage.getTenantAdminQuota(tenant.id);

      res.json({
        admins: admins.map(a => ({
          id: a.id,
          name: a.name,
          email: a.email,
          role: a.role,
          createdAt: a.createdAt,
        })),
        quota,
      });
    } catch (error) {
      console.error("Admins list error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Create tenant admin
  app.post("/api/tenants/:slug/admin/admins", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      const auth = await checkAdminAuth(req, tenant.id, "ADMINS");
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error || "Non authentifie" });
      }
      if (!auth.hasMenuAccess) {
        return res.status(403).json({ error: "Permission denied" });
      }

      // Check quota before creating
      const quota = await storage.getTenantAdminQuota(tenant.id);
      if (quota.remaining <= 0) {
        return res.status(409).json({
          error: "Quota d'administrateurs atteint",
          message: `Vous avez atteint la limite de ${quota.allowed} administrateur(s). Mettez a jour votre abonnement pour en ajouter davantage.`,
          quota,
        });
      }

      const { name, email, password, role } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({ error: "Nom, email et mot de passe requis" });
      }

      // Check if email is already used
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "Cet email est deja utilise" });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const newAdmin = await storage.createUser({
        tenantId: tenant.id,
        name,
        email,
        passwordHash,
        role: role || "ADMIN",
      });

      res.json({
        id: newAdmin.id,
        name: newAdmin.name,
        email: newAdmin.email,
        role: newAdmin.role,
        createdAt: newAdmin.createdAt,
      });
    } catch (error: any) {
      console.error("Admin creation error:", error);
      res.status(500).json({ error: error.message || "Erreur serveur" });
    }
  });

  // Delete tenant admin
  app.delete("/api/tenants/:slug/admin/admins/:id", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      const auth = await checkAdminAuth(req, tenant.id, "ADMINS");
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error || "Non authentifie" });
      }
      if (!auth.hasMenuAccess) {
        return res.status(403).json({ error: "Permission denied" });
      }

      // Prevent self-deletion
      if (req.params.id === req.session.userId) {
        return res.status(400).json({ error: "Vous ne pouvez pas supprimer votre propre compte" });
      }

      const admin = await storage.getUserById(req.params.id);
      if (!admin || admin.tenantId !== tenant.id) {
        return res.status(404).json({ error: "Administrateur non trouve" });
      }

      await storage.deleteUser(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Admin deletion error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ==========================================
  // ASSOCIATION ROUTES
  // ==========================================

  // Tenant Admin: List associations for tenant
  app.get("/api/tenants/:slug/admin/associations", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      const auth = await checkAdminAuth(req, tenant.id, "ASSOCIATIONS");
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error || "Non authentifie" });
      }
      if (!auth.hasMenuAccess) {
        return res.status(403).json({ error: "Permission denied" });
      }

      const associations = await storage.getAssociationsByTenant(tenant.id);
      const quota = await storage.getTenantAssociationQuota(tenant.id);
      res.json({ associations, quota });
    } catch (error) {
      console.error("Associations list error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Tenant Admin: Create association
  app.post("/api/tenants/:slug/admin/associations", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      const auth = await checkAdminAuth(req, tenant.id, "ASSOCIATIONS");
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error || "Non authentifie" });
      }
      if (!auth.hasMenuAccess) {
        return res.status(403).json({ error: "Permission denied" });
      }

      // Check quota before creating
      const quota = await storage.getTenantAssociationQuota(tenant.id);
      if (quota.remaining <= 0) {
        return res.status(409).json({ 
          error: "Quota d'associations atteint", 
          message: `Vous avez atteint la limite de ${quota.allowed} association(s). Mettez a jour votre abonnement pour en creer davantage.`,
          quota 
        });
      }

      const parsed = insertAssociationSchema.safeParse({
        ...req.body,
        tenantId: tenant.id,
      });
      if (!parsed.success) {
        return res.status(400).json({ error: "Donnees invalides", details: parsed.error.flatten() });
      }

      // Check if slug is unique for this tenant
      const existing = await storage.getAssociationBySlug(tenant.id, parsed.data.slug);
      if (existing) {
        return res.status(400).json({ error: "Ce slug est deja utilise" });
      }

      const association = await storage.createAssociation(parsed.data);

      // Create admin user if provided
      if (req.body.adminEmail && req.body.adminPassword) {
        const passwordHash = await bcrypt.hash(req.body.adminPassword, 10);
        await storage.createAssociationUser({
          associationId: association.id,
          name: req.body.adminName || "Admin",
          email: req.body.adminEmail,
          passwordHash,
          role: "ADMIN",
        });

        // Send welcome email to the association admin
        if (tenant) {
          // Always use the custom production domain for emails
          const baseUrl = 'https://voxpopulous.fr';
          const loginUrl = `${baseUrl}/structures/${req.params.slug}/${association.slug}/admin/login`;
          
          await sendWelcomeEmail(
            req.body.adminEmail,
            req.body.adminName || "Admin",
            association.name,
            loginUrl,
            req.body.adminEmail,
            req.body.adminPassword
          );
        }
      }

      res.json(association);
    } catch (error: any) {
      console.error("Association creation error:", error);
      res.status(500).json({ error: error.message || "Erreur serveur" });
    }
  });

  // Tenant Admin: Get single association
  app.get("/api/tenants/:slug/admin/associations/:id", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      const auth = await checkAdminAuth(req, tenant.id, "ASSOCIATIONS");
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error || "Non authentifie" });
      }
      if (!auth.hasMenuAccess) {
        return res.status(403).json({ error: "Permission denied" });
      }

      const association = await storage.getAssociationById(req.params.id);
      if (!association || association.tenantId !== tenant.id) {
        return res.status(404).json({ error: "Association non trouvee" });
      }
      res.json(association);
    } catch (error) {
      console.error("Association fetch error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Tenant Admin: Update association
  app.put("/api/tenants/:slug/admin/associations/:id", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      const auth = await checkAdminAuth(req, tenant.id, "ASSOCIATIONS");
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error || "Non authentifie" });
      }
      if (!auth.hasMenuAccess) {
        return res.status(403).json({ error: "Permission denied" });
      }

      const association = await storage.getAssociationById(req.params.id);
      if (!association || association.tenantId !== tenant.id) {
        return res.status(404).json({ error: "Association non trouvee" });
      }

      // If slug is being changed, check uniqueness
      if (req.body.slug && req.body.slug !== association.slug) {
        const existing = await storage.getAssociationBySlug(tenant.id, req.body.slug);
        if (existing) {
          return res.status(400).json({ error: "Ce slug est deja utilise" });
        }
      }

      const updated = await storage.updateAssociation(req.params.id, req.body);
      res.json(updated);
    } catch (error: any) {
      console.error("Association update error:", error);
      res.status(500).json({ error: error.message || "Erreur serveur" });
    }
  });

  // Tenant Admin: Delete association
  app.delete("/api/tenants/:slug/admin/associations/:id", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      const auth = await checkAdminAuth(req, tenant.id, "ASSOCIATIONS");
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error || "Non authentifie" });
      }
      if (!auth.hasMenuAccess) {
        return res.status(403).json({ error: "Permission denied" });
      }

      const association = await storage.getAssociationById(req.params.id);
      if (!association || association.tenantId !== tenant.id) {
        return res.status(404).json({ error: "Association non trouvee" });
      }

      await storage.deleteAssociation(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Association deletion error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Public: List all active associations for a tenant
  app.get("/api/tenants/:slug/associations", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Commune non trouvee" });
      }

      const associations = await storage.getAssociationsByTenant(tenant.id);
      const activeAssociations = associations.filter(a => a.isActive);
      res.json(activeAssociations);
    } catch (error) {
      console.error("Associations list error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Public: Get association by slug
  app.get("/api/tenants/:slug/associations/:assocSlug", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Commune non trouvee" });
      }

      // getAssociationBySlug already scopes by tenantId
      const association = await storage.getAssociationBySlug(tenant.id, req.params.assocSlug);
      if (!association || !association.isActive) {
        return res.status(404).json({ error: "Association non trouvee" });
      }

      // Double-check tenant ownership
      if (association.tenantId !== tenant.id) {
        return res.status(404).json({ error: "Association non trouvee" });
      }

      res.json(association);
    } catch (error) {
      console.error("Association fetch error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Association: Login
  app.post("/api/tenants/:slug/associations/:assocSlug/login", async (req, res) => {
    try {
      // Get or create device ID and check blocking
      const deviceId = getOrCreateDeviceId(req, res);
      const deviceBlockStatus = await isDeviceBlocked(deviceId);
      if (deviceBlockStatus.blocked) {
        return res.status(403).json({ error: deviceBlockStatus.reason || "Appareil bloque", deviceBlocked: true });
      }
      
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Commune non trouvee" });
      }

      // Use getAssociationBySlug which scopes by tenantId
      const association = await storage.getAssociationBySlug(tenant.id, req.params.assocSlug);
      if (!association || !association.isActive) {
        return res.status(404).json({ error: "Association non trouvee" });
      }

      // Verify association belongs to this tenant
      if (association.tenantId !== tenant.id) {
        return res.status(404).json({ error: "Association non trouvee" });
      }

      const { email, password } = req.body;
      const user = await storage.getAssociationUserByEmail(association.id, email);
      if (!user) {
        return res.status(401).json({ error: "Email ou mot de passe incorrect" });
      }

      const passwordMatch = await bcrypt.compare(password, user.passwordHash);
      if (!passwordMatch) {
        return res.status(401).json({ error: "Email ou mot de passe incorrect" });
      }

      req.session.associationUserId = user.id;
      req.session.associationId = association.id;
      req.session.tenantId = tenant.id;
      
      // Log activity
      await logActivity({
        req,
        deviceId,
        activityType: "LOGIN",
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        tenantName: tenant.name,
        associationSlug: association.slug,
        associationName: association.name,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role || undefined,
        actionDetails: "Connexion association"
      });

      const { passwordHash, ...safeUser } = user;
      res.json({ user: safeUser, association });
    } catch (error) {
      console.error("Association login error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Association: Logout
  app.post("/api/tenants/:slug/associations/:assocSlug/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  // Association: Get current user
  app.get("/api/tenants/:slug/associations/:assocSlug/me", async (req, res) => {
    if (!req.session.associationUserId || !req.session.associationId || !req.session.tenantId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      // Verify tenant matches URL
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant || tenant.id !== req.session.tenantId) {
        return res.status(401).json({ error: "Non authentifie" });
      }

      const user = await storage.getAssociationUserById(req.session.associationUserId);
      if (!user) {
        return res.status(401).json({ error: "Utilisateur non trouve" });
      }

      const association = await storage.getAssociationById(req.session.associationId);
      if (!association) {
        return res.status(401).json({ error: "Association non trouvee" });
      }

      // Verify association belongs to tenant and matches URL
      if (association.tenantId !== tenant.id || association.slug !== req.params.assocSlug) {
        return res.status(401).json({ error: "Non authentifie" });
      }

      const { passwordHash, ...safeUser } = user;
      res.json({ user: safeUser, association });
    } catch (error) {
      console.error("Association me error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Association Admin: Get association users
  app.get("/api/tenants/:slug/associations/:assocSlug/admin/users", async (req, res) => {
    if (!req.session.associationUserId || !req.session.associationId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const user = await storage.getAssociationUserById(req.session.associationUserId);
      if (!user || user.role !== "ADMIN") {
        return res.status(403).json({ error: "Acces refuse" });
      }

      const users = await storage.getAssociationUsers(req.session.associationId);
      const safeUsers = users.map(({ passwordHash, ...u }) => u);
      res.json(safeUsers);
    } catch (error) {
      console.error("Association users list error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Association Admin: Create user
  app.post("/api/tenants/:slug/associations/:assocSlug/admin/users", async (req, res) => {
    if (!req.session.associationUserId || !req.session.associationId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const currentUser = await storage.getAssociationUserById(req.session.associationUserId);
      if (!currentUser || currentUser.role !== "ADMIN") {
        return res.status(403).json({ error: "Acces refuse" });
      }

      const { name, email, password, role } = req.body;
      
      // Check if email already exists
      const existing = await storage.getAssociationUserByEmail(req.session.associationId, email);
      if (existing) {
        return res.status(400).json({ error: "Cet email est deja utilise" });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const newUser = await storage.createAssociationUser({
        associationId: req.session.associationId,
        name,
        email,
        passwordHash,
        role: role || "MEMBER",
      });

      const { passwordHash: _, ...safeUser } = newUser;
      res.json(safeUser);
    } catch (error: any) {
      console.error("Association user creation error:", error);
      res.status(500).json({ error: error.message || "Erreur serveur" });
    }
  });

  // ==========================================
  // ASSOCIATION IDEAS ROUTES
  // ==========================================

  // Association Admin: Get ideas
  app.get("/api/associations/:associationId/admin/ideas", async (req, res) => {
    if (!req.session.associationUserId || !req.session.associationId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    if (req.session.associationId !== req.params.associationId) {
      return res.status(403).json({ error: "Acces refuse" });
    }
    try {
      const ideas = await storage.getAssociationIdeas(req.params.associationId);
      res.json(ideas);
    } catch (error) {
      console.error("Association ideas list error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Association Admin: Get idea by ID
  app.get("/api/associations/:associationId/admin/ideas/:id", async (req, res) => {
    if (!req.session.associationUserId || !req.session.associationId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    if (req.session.associationId !== req.params.associationId) {
      return res.status(403).json({ error: "Acces refuse" });
    }
    try {
      const idea = await storage.getAssociationIdeaById(req.params.id);
      if (!idea || idea.associationId !== req.params.associationId) {
        return res.status(404).json({ error: "Idee non trouvee" });
      }
      res.json(idea);
    } catch (error) {
      console.error("Association idea fetch error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Association Admin: Update idea status
  app.patch("/api/associations/:associationId/admin/ideas/:id/status", async (req, res) => {
    if (!req.session.associationUserId || !req.session.associationId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    if (req.session.associationId !== req.params.associationId) {
      return res.status(403).json({ error: "Acces refuse" });
    }
    try {
      const idea = await storage.getAssociationIdeaById(req.params.id);
      if (!idea || idea.associationId !== req.params.associationId) {
        return res.status(404).json({ error: "Idee non trouvee" });
      }
      const { status } = req.body;
      const updated = await storage.updateAssociationIdeaStatus(req.params.id, status);
      res.json(updated);
    } catch (error) {
      console.error("Association idea status update error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Association Public: Get ideas
  app.get("/api/associations/:associationId/ideas", async (req, res) => {
    try {
      const association = await storage.getAssociationById(req.params.associationId);
      if (!association || !association.isActive) {
        return res.status(404).json({ error: "Association non trouvee" });
      }
      const ideas = await storage.getAssociationIdeas(req.params.associationId);
      res.json(ideas);
    } catch (error) {
      console.error("Association public ideas error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Association Public: Submit idea
  app.post("/api/associations/:associationId/ideas", async (req, res) => {
    try {
      const association = await storage.getAssociationById(req.params.associationId);
      if (!association || !association.isActive) {
        return res.status(404).json({ error: "Association non trouvee" });
      }
      const { title, description, category, authorEmail } = req.body;
      const publicToken = randomUUID();
      const idea = await storage.createAssociationIdea({
        associationId: req.params.associationId,
        title,
        description,
        category: category || "GENERAL",
        createdByEmail: authorEmail || null,
        publicToken,
      });
      res.json(idea);
    } catch (error) {
      console.error("Association idea creation error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Association Public: Vote on idea
  app.post("/api/associations/:associationId/ideas/:id/vote", async (req, res) => {
    try {
      const idea = await storage.getAssociationIdeaById(req.params.id);
      if (!idea || idea.associationId !== req.params.associationId) {
        return res.status(404).json({ error: "Idee non trouvee" });
      }
      
      const { voteType, anonymousVoterId } = req.body;
      const direction: 'up' | 'down' = voteType === 'down' ? 'down' : 'up';
      const voterIp = req.ip || req.socket.remoteAddress || "unknown";
      
      const existingVote = await storage.getAssociationIdeaVoteByVoter(idea.id, voterIp, anonymousVoterId);
      
      if (existingVote) {
        // If clicking same vote type, remove the vote (toggle off)
        if (existingVote.voteType === direction) {
          await storage.removeAssociationIdeaVote(existingVote.id, idea.id, existingVote.voteType);
          const updatedIdea = await storage.getAssociationIdeaById(idea.id);
          return res.json({ 
            success: true, 
            action: 'removed',
            upVotes: updatedIdea?.upVotesCount || 0,
            downVotes: updatedIdea?.downVotesCount || 0,
            totalVotes: updatedIdea?.votesCount || 0,
            userVote: null
          });
        }
        // If clicking different vote type, change the vote
        await storage.updateAssociationIdeaVote(existingVote.id, idea.id, direction, existingVote.voteType);
        const updatedIdea = await storage.getAssociationIdeaById(idea.id);
        return res.json({ 
          success: true, 
          action: 'changed',
          upVotes: updatedIdea?.upVotesCount || 0,
          downVotes: updatedIdea?.downVotesCount || 0,
          totalVotes: updatedIdea?.votesCount || 0,
          userVote: direction
        });
      }

      // New vote
      await storage.createAssociationIdeaVote(idea.id, voterIp, direction, anonymousVoterId);
      const updatedIdea = await storage.getAssociationIdeaById(idea.id);
      
      res.json({ 
        success: true, 
        action: 'created',
        upVotes: updatedIdea?.upVotesCount || 0,
        downVotes: updatedIdea?.downVotesCount || 0,
        totalVotes: updatedIdea?.votesCount || 0,
        userVote: direction
      });
    } catch (error) {
      console.error("Association idea vote error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Association Public: Get vote status for an idea
  app.get("/api/associations/:associationId/ideas/:id/vote-status", async (req, res) => {
    try {
      const idea = await storage.getAssociationIdeaById(req.params.id);
      if (!idea || idea.associationId !== req.params.associationId) {
        return res.status(404).json({ error: "Idee non trouvee" });
      }

      const { anonymousVoterId } = req.query;
      const voterIp = req.ip || req.socket.remoteAddress || "unknown";
      
      const existingVote = await storage.getAssociationIdeaVoteByVoter(
        idea.id, 
        voterIp, 
        typeof anonymousVoterId === 'string' ? anonymousVoterId : undefined
      );
      
      res.json({ 
        userVote: existingVote?.voteType || null,
        upVotes: idea.upVotesCount,
        downVotes: idea.downVotesCount,
        totalVotes: idea.votesCount
      });
    } catch (error) {
      console.error("Association idea vote status error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ==========================================
  // ASSOCIATION INCIDENTS ROUTES
  // ==========================================

  // Association Admin: Get incidents
  app.get("/api/associations/:associationId/admin/incidents", async (req, res) => {
    if (!req.session.associationUserId || !req.session.associationId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    if (req.session.associationId !== req.params.associationId) {
      return res.status(403).json({ error: "Acces refuse" });
    }
    try {
      const incidents = await storage.getAssociationIncidents(req.params.associationId);
      res.json(incidents);
    } catch (error) {
      console.error("Association incidents list error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Association Admin: Get incident by ID
  app.get("/api/associations/:associationId/admin/incidents/:id", async (req, res) => {
    if (!req.session.associationUserId || !req.session.associationId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    if (req.session.associationId !== req.params.associationId) {
      return res.status(403).json({ error: "Acces refuse" });
    }
    try {
      const incident = await storage.getAssociationIncidentById(req.params.id);
      if (!incident || incident.associationId !== req.params.associationId) {
        return res.status(404).json({ error: "Signalement non trouve" });
      }
      res.json(incident);
    } catch (error) {
      console.error("Association incident fetch error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Association Admin: Update incident status
  app.patch("/api/associations/:associationId/admin/incidents/:id/status", async (req, res) => {
    if (!req.session.associationUserId || !req.session.associationId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    if (req.session.associationId !== req.params.associationId) {
      return res.status(403).json({ error: "Acces refuse" });
    }
    try {
      const incident = await storage.getAssociationIncidentById(req.params.id);
      if (!incident || incident.associationId !== req.params.associationId) {
        return res.status(404).json({ error: "Signalement non trouve" });
      }
      const { status } = req.body;
      const updated = await storage.updateAssociationIncidentStatus(req.params.id, status);
      res.json(updated);
    } catch (error) {
      console.error("Association incident status update error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Association Public: Get incidents
  app.get("/api/associations/:associationId/incidents", async (req, res) => {
    try {
      const association = await storage.getAssociationById(req.params.associationId);
      if (!association || !association.isActive) {
        return res.status(404).json({ error: "Association non trouvee" });
      }
      const incidents = await storage.getAssociationIncidents(req.params.associationId);
      res.json(incidents);
    } catch (error) {
      console.error("Association public incidents error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Association Public: Submit incident
  app.post("/api/associations/:associationId/incidents", async (req, res) => {
    try {
      const association = await storage.getAssociationById(req.params.associationId);
      if (!association || !association.isActive) {
        return res.status(404).json({ error: "Association non trouvee" });
      }
      const { title, description, category, locationText, authorEmail, photoUrl, latitude, longitude } = req.body;
      const publicToken = randomUUID();
      const incident = await storage.createAssociationIncident({
        associationId: req.params.associationId,
        title,
        description,
        category: category || "OTHER",
        locationText: locationText || "",
        createdByEmail: authorEmail || null,
        photoUrl: photoUrl || null,
        publicToken,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
      });
      res.json(incident);
    } catch (error) {
      console.error("Association incident creation error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ==========================================
  // ASSOCIATION MEETINGS ROUTES
  // ==========================================

  // Association Admin: Get meetings
  app.get("/api/associations/:associationId/admin/meetings", async (req, res) => {
    if (!req.session.associationUserId || !req.session.associationId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    if (req.session.associationId !== req.params.associationId) {
      return res.status(403).json({ error: "Acces refuse" });
    }
    try {
      const meetings = await storage.getAssociationMeetings(req.params.associationId);
      res.json(meetings);
    } catch (error) {
      console.error("Association meetings list error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Association Admin: Get meeting by ID
  app.get("/api/associations/:associationId/admin/meetings/:id", async (req, res) => {
    if (!req.session.associationUserId || !req.session.associationId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    if (req.session.associationId !== req.params.associationId) {
      return res.status(403).json({ error: "Acces refuse" });
    }
    try {
      const meeting = await storage.getAssociationMeetingById(req.params.id);
      if (!meeting || meeting.associationId !== req.params.associationId) {
        return res.status(404).json({ error: "Evenement non trouve" });
      }
      const registrations = await storage.getAssociationMeetingRegistrations(req.params.id);
      res.json({ ...meeting, registrations });
    } catch (error) {
      console.error("Association meeting fetch error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Association Admin: Create meeting
  app.post("/api/associations/:associationId/admin/meetings", async (req, res) => {
    if (!req.session.associationUserId || !req.session.associationId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    if (req.session.associationId !== req.params.associationId) {
      return res.status(403).json({ error: "Acces refuse" });
    }
    try {
      const { title, description, dateTime, location, capacity } = req.body;
      const meeting = await storage.createAssociationMeeting({
        associationId: req.params.associationId,
        title,
        description: description || null,
        dateTime: new Date(dateTime),
        location: location || "",
        capacity: capacity || null,
      });
      res.json(meeting);
    } catch (error) {
      console.error("Association meeting creation error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Association Admin: Update meeting
  app.patch("/api/associations/:associationId/admin/meetings/:id", async (req, res) => {
    if (!req.session.associationUserId || !req.session.associationId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    if (req.session.associationId !== req.params.associationId) {
      return res.status(403).json({ error: "Acces refuse" });
    }
    try {
      const meeting = await storage.getAssociationMeetingById(req.params.id);
      if (!meeting || meeting.associationId !== req.params.associationId) {
        return res.status(404).json({ error: "Evenement non trouve" });
      }
      const { title, description, dateTime, location, capacity } = req.body;
      const updated = await storage.updateAssociationMeeting(req.params.id, {
        title,
        description,
        dateTime: dateTime ? new Date(dateTime) : undefined,
        location,
        capacity,
      });
      res.json(updated);
    } catch (error) {
      console.error("Association meeting update error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Association Admin: Update meeting status
  app.patch("/api/associations/:associationId/admin/meetings/:id/status", async (req, res) => {
    if (!req.session.associationUserId || !req.session.associationId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    if (req.session.associationId !== req.params.associationId) {
      return res.status(403).json({ error: "Acces refuse" });
    }
    try {
      const meeting = await storage.getAssociationMeetingById(req.params.id);
      if (!meeting || meeting.associationId !== req.params.associationId) {
        return res.status(404).json({ error: "Evenement non trouve" });
      }
      const { status } = req.body;
      const updated = await storage.updateAssociationMeetingStatus(req.params.id, status);
      res.json(updated);
    } catch (error) {
      console.error("Association meeting status update error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Association Admin: Delete meeting
  app.delete("/api/associations/:associationId/admin/meetings/:id", async (req, res) => {
    if (!req.session.associationUserId || !req.session.associationId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    if (req.session.associationId !== req.params.associationId) {
      return res.status(403).json({ error: "Acces refuse" });
    }
    try {
      const meeting = await storage.getAssociationMeetingById(req.params.id);
      if (!meeting || meeting.associationId !== req.params.associationId) {
        return res.status(404).json({ error: "Evenement non trouve" });
      }
      await storage.deleteAssociationMeeting(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Association meeting delete error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Association Public: Get meetings
  app.get("/api/associations/:associationId/meetings", async (req, res) => {
    try {
      const association = await storage.getAssociationById(req.params.associationId);
      if (!association || !association.isActive) {
        return res.status(404).json({ error: "Association non trouvee" });
      }
      const meetings = await storage.getAssociationMeetings(req.params.associationId);
      const publicMeetings = meetings.filter(m => m.status === "SCHEDULED");
      res.json(publicMeetings);
    } catch (error) {
      console.error("Association public meetings error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Association Public: Get single meeting by ID
  app.get("/api/associations/:associationId/meetings/:id", async (req, res) => {
    try {
      const association = await storage.getAssociationById(req.params.associationId);
      if (!association || !association.isActive) {
        return res.status(404).json({ error: "Association non trouvee" });
      }
      const meeting = await storage.getAssociationMeetingById(req.params.id);
      if (!meeting || meeting.associationId !== req.params.associationId) {
        return res.status(404).json({ error: "Evenement non trouve" });
      }
      const registrations = await storage.getAssociationMeetingRegistrations(req.params.id);
      res.json({ ...meeting, registrationsCount: registrations.length });
    } catch (error) {
      console.error("Association public meeting detail error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Association Public: Get meeting registrations (names only for privacy)
  app.get("/api/associations/:associationId/meetings/:id/registrations", async (req, res) => {
    try {
      const association = await storage.getAssociationById(req.params.associationId);
      if (!association || !association.isActive) {
        return res.status(404).json({ error: "Association non trouvee" });
      }
      const meeting = await storage.getAssociationMeetingById(req.params.id);
      if (!meeting || meeting.associationId !== req.params.associationId) {
        return res.status(404).json({ error: "Evenement non trouve" });
      }
      const registrations = await storage.getAssociationMeetingRegistrations(req.params.id);
      // Return only names for public view (privacy)
      const publicRegistrations = registrations.map(r => ({
        id: r.id,
        fullName: r.fullName,
        createdAt: r.createdAt,
      }));
      res.json(publicRegistrations);
    } catch (error) {
      console.error("Association meeting registrations error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Association Public: Register for meeting
  app.post("/api/associations/:associationId/meetings/:id/register", async (req, res) => {
    try {
      const meeting = await storage.getAssociationMeetingById(req.params.id);
      if (!meeting || meeting.associationId !== req.params.associationId) {
        return res.status(404).json({ error: "Evenement non trouve" });
      }
      if (meeting.status !== "SCHEDULED") {
        return res.status(400).json({ error: "Les inscriptions ne sont pas ouvertes" });
      }
      const registrations = await storage.getAssociationMeetingRegistrations(req.params.id);
      if (meeting.capacity && registrations.length >= meeting.capacity) {
        return res.status(400).json({ error: "Nombre maximum de participants atteint" });
      }
      const { fullName, email, comment } = req.body;
      const registration = await storage.createAssociationMeetingRegistration({
        meetingId: req.params.id,
        fullName,
        email,
        comment: comment || null,
      });
      res.json(registration);
    } catch (error) {
      console.error("Association meeting registration error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ==========================================
  // ASSOCIATION BUREAU ROUTES
  // ==========================================

  // Association Admin: Get bureau members
  app.get("/api/associations/:associationId/admin/bureau", async (req, res) => {
    if (!req.session.associationUserId || !req.session.associationId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    if (req.session.associationId !== req.params.associationId) {
      return res.status(403).json({ error: "Acces refuse" });
    }
    try {
      const members = await storage.getBureauMembers(req.params.associationId);
      res.json(members);
    } catch (error) {
      console.error("Bureau members list error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Association Admin: Create bureau member
  app.post("/api/associations/:associationId/admin/bureau", async (req, res) => {
    if (!req.session.associationUserId || !req.session.associationId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    if (req.session.associationId !== req.params.associationId) {
      return res.status(403).json({ error: "Acces refuse" });
    }
    try {
      const { firstName, lastName, function: memberFunction, email, photoUrl, photoObjectPath } = req.body;
      const member = await storage.createBureauMember({
        associationId: req.params.associationId,
        firstName,
        lastName,
        function: memberFunction,
        email,
        photoUrl: photoUrl || null,
        photoObjectPath: photoObjectPath || null,
      });
      res.json(member);
    } catch (error) {
      console.error("Bureau member creation error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Association Admin: Update bureau member
  app.patch("/api/associations/:associationId/admin/bureau/:id", async (req, res) => {
    if (!req.session.associationUserId || !req.session.associationId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    if (req.session.associationId !== req.params.associationId) {
      return res.status(403).json({ error: "Acces refuse" });
    }
    try {
      const member = await storage.getBureauMemberById(req.params.id);
      if (!member || member.associationId !== req.params.associationId) {
        return res.status(404).json({ error: "Membre non trouve" });
      }
      const updated = await storage.updateBureauMember(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Bureau member update error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Association Admin: Delete bureau member
  app.delete("/api/associations/:associationId/admin/bureau/:id", async (req, res) => {
    if (!req.session.associationUserId || !req.session.associationId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    if (req.session.associationId !== req.params.associationId) {
      return res.status(403).json({ error: "Acces refuse" });
    }
    try {
      const member = await storage.getBureauMemberById(req.params.id);
      if (!member || member.associationId !== req.params.associationId) {
        return res.status(404).json({ error: "Membre non trouve" });
      }
      await storage.deleteBureauMember(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Bureau member delete error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Association Public: Get bureau members (for public page, with domains)
  app.get("/api/associations/:associationId/bureau", async (req, res) => {
    try {
      const association = await storage.getAssociationById(req.params.associationId);
      if (!association || !association.isActive) {
        return res.status(404).json({ error: "Association non trouvee" });
      }
      const members = await storage.getBureauMembers(req.params.associationId);
      // Include domains for each member
      const membersWithDomains = await Promise.all(
        members.map(async (member) => {
          const domains = await storage.getBureauMemberDomains(member.id);
          return { ...member, domains };
        })
      );
      res.json(membersWithDomains);
    } catch (error) {
      console.error("Public bureau members error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Association Public: Get single bureau member profile with domains
  app.get("/api/associations/:associationId/bureau/:id", async (req, res) => {
    try {
      const association = await storage.getAssociationById(req.params.associationId);
      if (!association || !association.isActive) {
        return res.status(404).json({ error: "Association non trouvee" });
      }
      const result = await storage.getBureauMemberWithDomains(req.params.id);
      if (!result || result.member.associationId !== req.params.associationId) {
        return res.status(404).json({ error: "Membre non trouve" });
      }
      res.json({ ...result.member, domains: result.domains });
    } catch (error) {
      console.error("Public bureau member profile error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ==========================================
  // ASSOCIATION STATS ROUTES
  // ==========================================

  // Association Admin: Get stats
  app.get("/api/associations/:associationId/admin/stats", async (req, res) => {
    if (!req.session.associationUserId || !req.session.associationId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    if (req.session.associationId !== req.params.associationId) {
      return res.status(403).json({ error: "Acces refuse" });
    }
    try {
      const stats = await storage.getAssociationStats(req.params.associationId);
      // Transform to frontend expected format
      res.json({
        ideasCount: stats.ideas.total,
        ideasNew: stats.ideas.new,
        incidentsCount: stats.incidents.total,
        incidentsNew: stats.incidents.new,
        meetingsCount: stats.meetings.total,
        meetingsUpcoming: stats.meetings.upcoming,
        bureauMembersCount: stats.bureau.total,
      });
    } catch (error) {
      console.error("Association stats error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ==========================================
  // ASSOCIATION PHOTOS ROUTES
  // ==========================================

  // Association Admin: Get photos
  app.get("/api/associations/:associationId/admin/photos", async (req, res) => {
    if (!req.session.associationUserId || !req.session.associationId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    if (req.session.associationId !== req.params.associationId) {
      return res.status(403).json({ error: "Acces refuse" });
    }
    try {
      const photos = await storage.getAssociationPhotos(req.params.associationId);
      res.json(photos);
    } catch (error) {
      console.error("Association photos list error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Association Admin: Create photo
  app.post("/api/associations/:associationId/admin/photos", async (req, res) => {
    if (!req.session.associationUserId || !req.session.associationId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    if (req.session.associationId !== req.params.associationId) {
      return res.status(403).json({ error: "Acces refuse" });
    }
    try {
      const { title, description, url, displayOrder, isFeatured } = req.body;
      if (!url) {
        return res.status(400).json({ error: "URL de la photo requise" });
      }
      const photo = await storage.createAssociationPhoto({
        associationId: req.params.associationId,
        title: title || null,
        description: description || null,
        url,
        displayOrder: displayOrder || 0,
        isFeatured: isFeatured || false,
      });
      res.json(photo);
    } catch (error) {
      console.error("Association photo creation error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Association Admin: Update photo
  app.patch("/api/associations/:associationId/admin/photos/:id", async (req, res) => {
    if (!req.session.associationUserId || !req.session.associationId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    if (req.session.associationId !== req.params.associationId) {
      return res.status(403).json({ error: "Acces refuse" });
    }
    try {
      const photo = await storage.getAssociationPhotoById(req.params.id);
      if (!photo || photo.associationId !== req.params.associationId) {
        return res.status(404).json({ error: "Photo non trouvee" });
      }
      const updated = await storage.updateAssociationPhoto(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Association photo update error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Association Admin: Delete photo
  app.delete("/api/associations/:associationId/admin/photos/:id", async (req, res) => {
    if (!req.session.associationUserId || !req.session.associationId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    if (req.session.associationId !== req.params.associationId) {
      return res.status(403).json({ error: "Acces refuse" });
    }
    try {
      const photo = await storage.getAssociationPhotoById(req.params.id);
      if (!photo || photo.associationId !== req.params.associationId) {
        return res.status(404).json({ error: "Photo non trouvee" });
      }
      await storage.deleteAssociationPhoto(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Association photo delete error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Association Public: Get photos (for public page)
  app.get("/api/associations/:associationId/photos", async (req, res) => {
    try {
      const association = await storage.getAssociationById(req.params.associationId);
      if (!association || !association.isActive) {
        return res.status(404).json({ error: "Association non trouvee" });
      }
      const photos = await storage.getAssociationPhotos(req.params.associationId);
      res.json(photos);
    } catch (error) {
      console.error("Public association photos error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ==========================================
  // TENANT SETTINGS ROUTES
  // ==========================================

  // Tenant Admin: Get settings
  app.get("/api/tenants/:slug/admin/settings", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      const auth = await checkAdminAuth(req, tenant.id, "SETTINGS");
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error || "Non authentifie" });
      }
      if (!auth.hasMenuAccess) {
        return res.status(403).json({ error: "Permission denied" });
      }

      res.json({
        name: tenant.name,
        presentationText: tenant.presentationText,
        logoUrl: tenant.logoUrl,
        primaryColor: tenant.primaryColor,
        secondaryColor: tenant.secondaryColor,
        accentColor: tenant.accentColor,
        backgroundColor: tenant.backgroundColor,
      });
    } catch (error) {
      console.error("Tenant settings get error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Tenant Admin: Update settings
  app.patch("/api/tenants/:slug/admin/settings", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      const auth = await checkAdminAuth(req, tenant.id, "SETTINGS");
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error || "Non authentifie" });
      }
      if (!auth.hasMenuAccess) {
        return res.status(403).json({ error: "Permission denied" });
      }

      const { presentationText, logoUrl, primaryColor, secondaryColor, accentColor, backgroundColor } = req.body;
      const updated = await storage.updateTenantSettings(tenant.id, {
        presentationText,
        logoUrl,
        primaryColor,
        secondaryColor,
        accentColor,
        backgroundColor,
      });
      res.json(updated);
    } catch (error) {
      console.error("Tenant settings update error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ==========================================
  // ASSOCIATION SETTINGS ROUTES
  // ==========================================

  // Association Admin: Get settings
  app.get("/api/associations/:associationId/admin/settings", async (req, res) => {
    if (!req.session.associationUserId || !req.session.associationId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    if (req.session.associationId !== req.params.associationId) {
      return res.status(403).json({ error: "Acces refuse" });
    }
    try {
      const association = await storage.getAssociationById(req.params.associationId);
      if (!association) {
        return res.status(404).json({ error: "Association non trouvee" });
      }
      res.json({
        name: association.name,
        description: association.description,
        logoUrl: association.logoUrl,
        primaryColor: association.primaryColor,
        secondaryColor: association.secondaryColor,
        accentColor: association.accentColor,
        backgroundColor: association.backgroundColor,
      });
    } catch (error) {
      console.error("Association settings get error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Association Admin: Update settings
  app.patch("/api/associations/:associationId/admin/settings", async (req, res) => {
    if (!req.session.associationUserId || !req.session.associationId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    if (req.session.associationId !== req.params.associationId) {
      return res.status(403).json({ error: "Acces refuse" });
    }
    try {
      const association = await storage.getAssociationById(req.params.associationId);
      if (!association) {
        return res.status(404).json({ error: "Association non trouvee" });
      }
      const { description, logoUrl, primaryColor, secondaryColor, accentColor, backgroundColor } = req.body;
      const updated = await storage.updateAssociation(req.params.associationId, {
        description,
        logoUrl,
        primaryColor,
        secondaryColor,
        accentColor,
        backgroundColor,
      });
      res.json(updated);
    } catch (error) {
      console.error("Association settings update error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ==========================================
  // TENANT PHOTOS ROUTES
  // ==========================================

  // Tenant Admin: Get photos
  app.get("/api/tenants/:slug/admin/photos", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      const auth = await checkAdminAuth(req, tenant.id, "PHOTOS");
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error || "Non authentifie" });
      }
      if (!auth.hasMenuAccess) {
        return res.status(403).json({ error: "Permission denied" });
      }

      const photos = await storage.getTenantPhotos(tenant.id);
      res.json(photos);
    } catch (error) {
      console.error("Tenant photos list error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Tenant Admin: Create photo
  app.post("/api/tenants/:slug/admin/photos", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      const auth = await checkAdminAuth(req, tenant.id, "PHOTOS");
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error || "Non authentifie" });
      }
      if (!auth.hasMenuAccess) {
        return res.status(403).json({ error: "Permission denied" });
      }

      const { title, description, url, displayOrder, isFeatured } = req.body;
      if (!url) {
        return res.status(400).json({ error: "URL de la photo requise" });
      }
      const photo = await storage.createTenantPhoto({
        tenantId: tenant.id,
        title: title || null,
        description: description || null,
        url,
        displayOrder: displayOrder || 0,
        isFeatured: isFeatured || false,
      });
      res.json(photo);
    } catch (error) {
      console.error("Tenant photo creation error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Tenant Admin: Update photo
  app.patch("/api/tenants/:slug/admin/photos/:id", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      const auth = await checkAdminAuth(req, tenant.id, "PHOTOS");
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error || "Non authentifie" });
      }
      if (!auth.hasMenuAccess) {
        return res.status(403).json({ error: "Permission denied" });
      }

      const photo = await storage.getTenantPhotoById(req.params.id);
      if (!photo || photo.tenantId !== tenant.id) {
        return res.status(404).json({ error: "Photo non trouvee" });
      }
      const updated = await storage.updateTenantPhoto(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Tenant photo update error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Tenant Admin: Delete photo
  app.delete("/api/tenants/:slug/admin/photos/:id", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      const auth = await checkAdminAuth(req, tenant.id, "PHOTOS");
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error || "Non authentifie" });
      }
      if (!auth.hasMenuAccess) {
        return res.status(403).json({ error: "Permission denied" });
      }

      const photo = await storage.getTenantPhotoById(req.params.id);
      if (!photo || photo.tenantId !== tenant.id) {
        return res.status(404).json({ error: "Photo non trouvee" });
      }
      await storage.deleteTenantPhoto(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Tenant photo delete error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Tenant Public: Get photos (for landing page)
  app.get("/api/tenants/:slug/photos", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Commune non trouvee" });
      }
      const photos = await storage.getTenantPhotos(tenant.id);
      res.json(photos);
    } catch (error) {
      console.error("Public tenant photos error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ==========================================
  // ELECTED OFFICIALS ROUTES
  // ==========================================

  // Public: Get elected officials for a tenant (with domains)
  app.get("/api/tenants/:slug/elus", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Commune non trouvee" });
      }
      const elus = await storage.getElectedOfficialsByTenant(tenant.id);
      // Include domains for each elu
      const elusWithDomains = await Promise.all(
        elus.map(async (elu) => {
          const domains = await storage.getElectedOfficialDomains(elu.id);
          return { ...elu, domains };
        })
      );
      res.json(elusWithDomains);
    } catch (error) {
      console.error("Public elected officials error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Public: Get single elected official profile with domains
  app.get("/api/tenants/:slug/elus/:id", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Commune non trouvee" });
      }
      const result = await storage.getElectedOfficialWithDomains(req.params.id);
      if (!result || result.official.tenantId !== tenant.id) {
        return res.status(404).json({ error: "Elu non trouve" });
      }
      res.json({ ...result.official, domains: result.domains });
    } catch (error) {
      console.error("Public elected official profile error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Admin: Get elected officials list
  app.get("/api/tenants/:slug/admin/elus", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      const auth = await checkAdminAuth(req, tenant.id, "ELUS");
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error || "Non authentifie" });
      }
      if (!auth.hasMenuAccess) {
        return res.status(403).json({ error: "Permission denied" });
      }

      const elus = await storage.getElectedOfficialsByTenant(tenant.id);
      res.json(elus);
    } catch (error) {
      console.error("Admin elected officials error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Admin: Create elected official
  app.post("/api/tenants/:slug/admin/elus", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      const auth = await checkAdminAuth(req, tenant.id, "ELUS");
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error || "Non authentifie" });
      }
      if (!auth.hasMenuAccess) {
        return res.status(403).json({ error: "Permission denied" });
      }

      const { firstName, lastName, function: fn, photoUrl, photoObjectPath, email, bio, displayOrder } = req.body;
      if (!firstName || !lastName || !fn) {
        return res.status(400).json({ error: "Prenom, nom et fonction sont requis" });
      }
      const elu = await storage.createElectedOfficial({
        tenantId: tenant.id,
        firstName,
        lastName,
        function: fn,
        photoUrl: photoUrl || null,
        photoObjectPath: photoObjectPath || null,
        email: email || null,
        bio: bio || null,
        displayOrder: displayOrder || 0,
      });
      
      let invitationSent = false;
      let invitationError: string | null = null;
      
      if (email) {
        try {
          const token = randomBytes(32).toString("hex");
          const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
          await storage.setElectedOfficialInvitation(elu.id, token, expiresAt);
          
          // Always use the custom production domain for emails
          const baseUrl = 'https://voxpopulous.fr';
          const inviteLink = `${baseUrl}/elus/setup-password?token=${token}`;
          
          const inviteContent = `
            <h2 style="color: #1e293b; margin: 0 0 24px 0; font-size: 24px;">Bienvenue sur VoxPopulous</h2>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px 0;">Bonjour ${firstName} ${lastName},</p>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px 0;">
              Vous avez ete invite a acceder a l'espace d'administration de <strong style="color: #1e293b;">${tenant.name}</strong> sur VoxPopulous.
            </p>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 24px 0;">Pour creer votre mot de passe et acceder a votre compte, cliquez sur le bouton ci-dessous :</p>
            <p style="text-align: center; margin: 0 0 24px 0;">
              <a href="${inviteLink}" style="display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 500;">Creer mon mot de passe</a>
            </p>
            <p style="color: #64748b; font-size: 14px; margin: 0 0 16px 0;">Ce lien est valable pendant 7 jours.</p>
            <p style="color: #475569; line-height: 1.6; margin: 0;">Cordialement,<br>L'equipe VoxPopulous</p>
          `;
          await sendEmail({
            to: email,
            subject: `Invitation a rejoindre l'espace administration - ${tenant.name}`,
            html: wrapEmailContent(inviteContent, { title: 'Invitation VoxPopulous' })
          });
          invitationSent = true;
        } catch (emailError) {
          console.error("Auto-invitation email error:", emailError);
          invitationError = "L'invitation a ete creee mais l'envoi d'email a echoue";
        }
      }
      
      res.json({ ...elu, invitationSent, invitationError });
    } catch (error) {
      console.error("Create elected official error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Admin: Update elected official
  app.put("/api/tenants/:slug/admin/elus/:id", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      const auth = await checkAdminAuth(req, tenant.id, "ELUS");
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error || "Non authentifie" });
      }
      if (!auth.hasMenuAccess) {
        return res.status(403).json({ error: "Permission denied" });
      }

      const existing = await storage.getElectedOfficialById(req.params.id);
      if (!existing || existing.tenantId !== tenant.id) {
        return res.status(404).json({ error: "Elu non trouve" });
      }
      const { firstName, lastName, function: fn, photoUrl, photoObjectPath, email, bio, displayOrder, isActive } = req.body;
      const updated = await storage.updateElectedOfficial(req.params.id, {
        firstName,
        lastName,
        function: fn,
        photoUrl,
        photoObjectPath,
        email,
        bio,
        displayOrder,
        isActive,
      });
      res.json(updated);
    } catch (error) {
      console.error("Update elected official error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Admin: Delete elected official
  app.delete("/api/tenants/:slug/admin/elus/:id", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      const auth = await checkAdminAuth(req, tenant.id, "ELUS");
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error || "Non authentifie" });
      }
      if (!auth.hasMenuAccess) {
        return res.status(403).json({ error: "Permission denied" });
      }

      const existing = await storage.getElectedOfficialById(req.params.id);
      if (!existing || existing.tenantId !== tenant.id) {
        return res.status(404).json({ error: "Elu non trouve" });
      }
      await storage.deleteElectedOfficial(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete elected official error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Admin: Get menu permissions for elected official
  app.get("/api/tenants/:slug/admin/elus/:id/permissions", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      const auth = await checkAdminAuth(req, tenant.id, "ELUS");
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error || "Non authentifie" });
      }
      if (!auth.hasMenuAccess) {
        return res.status(403).json({ error: "Permission denied" });
      }

      const official = await storage.getElectedOfficialById(req.params.id);
      if (!official || official.tenantId !== tenant.id) {
        return res.status(404).json({ error: "Elu non trouve" });
      }
      const permissions = await storage.getElectedOfficialMenuPermissions(req.params.id);
      res.json({ 
        hasFullAccess: official.hasFullAccess,
        menuPermissions: permissions
      });
    } catch (error) {
      console.error("Get elected official permissions error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Admin: Set menu permissions for elected official
  app.post("/api/tenants/:slug/admin/elus/:id/permissions", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      const auth = await checkAdminAuth(req, tenant.id, "ELUS");
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error || "Non authentifie" });
      }
      if (!auth.hasMenuAccess) {
        return res.status(403).json({ error: "Permission denied" });
      }

      const official = await storage.getElectedOfficialById(req.params.id);
      if (!official || official.tenantId !== tenant.id) {
        return res.status(404).json({ error: "Elu non trouve" });
      }
      const { hasFullAccess, menuPermissions } = req.body;
      // Update hasFullAccess on the official
      await storage.updateElectedOfficial(req.params.id, { hasFullAccess: !!hasFullAccess });
      // Set menu permissions (only relevant if not full access)
      if (!hasFullAccess && Array.isArray(menuPermissions)) {
        await storage.setElectedOfficialMenuPermissions(req.params.id, menuPermissions);
      } else if (hasFullAccess) {
        // Clear granular permissions when full access is enabled
        await storage.setElectedOfficialMenuPermissions(req.params.id, []);
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Set elected official permissions error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Admin: Send invitation to elected official
  app.post("/api/tenants/:slug/admin/elus/:id/invite", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      const auth = await checkAdminAuth(req, tenant.id, "ELUS");
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error || "Non authentifie" });
      }
      if (!auth.hasMenuAccess) {
        return res.status(403).json({ error: "Permission denied" });
      }

      const official = await storage.getElectedOfficialById(req.params.id);
      if (!official || official.tenantId !== tenant.id) {
        return res.status(404).json({ error: "Elu non trouve" });
      }
      if (!official.email) {
        return res.status(400).json({ error: "Cet elu n'a pas d'adresse email" });
      }
      // Generate invitation token
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      await storage.setElectedOfficialInvitation(req.params.id, token, expiresAt);
      
      // Send email with invitation link - always use the custom production domain
      const baseUrl = 'https://voxpopulous.fr';
      const inviteLink = `${baseUrl}/elus/setup-password?token=${token}`;
      
      try {
        const inviteContent = `
          <h2 style="color: #1e293b; margin: 0 0 24px 0; font-size: 24px;">Bienvenue sur VoxPopulous</h2>
          <p style="color: #475569; line-height: 1.6; margin: 0 0 16px 0;">Bonjour ${official.firstName} ${official.lastName},</p>
          <p style="color: #475569; line-height: 1.6; margin: 0 0 16px 0;">
            Vous avez ete invite a acceder a l'espace d'administration de <strong style="color: #1e293b;">${tenant.name}</strong> sur VoxPopulous.
          </p>
          <p style="color: #475569; line-height: 1.6; margin: 0 0 24px 0;">Pour creer votre mot de passe et acceder a votre compte, cliquez sur le bouton ci-dessous :</p>
          <p style="text-align: center; margin: 0 0 24px 0;">
            <a href="${inviteLink}" style="display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 500;">Creer mon mot de passe</a>
          </p>
          <p style="color: #64748b; font-size: 14px; margin: 0 0 16px 0;">Ce lien est valable pendant 7 jours.</p>
          <p style="color: #475569; line-height: 1.6; margin: 0;">Cordialement,<br>L'equipe VoxPopulous</p>
        `;
        await sendEmail({
          to: official.email,
          subject: `Invitation a rejoindre l'espace administration - ${tenant.name}`,
          html: wrapEmailContent(inviteContent, { title: 'Invitation VoxPopulous' })
        });
        res.json({ success: true, message: "Invitation envoyee" });
      } catch (emailError) {
        console.error("Email sending error:", emailError);
        // Still return success - invitation token is set even if email fails
        res.json({ success: true, message: "Invitation creee mais l'envoi d'email a echoue", inviteLink });
      }
    } catch (error) {
      console.error("Invite elected official error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Public: Validate invitation token
  app.get("/api/elus/validate-token", async (req, res) => {
    try {
      const { token } = req.query;
      if (!token || typeof token !== "string") {
        return res.status(400).json({ error: "Token manquant" });
      }
      const official = await storage.getElectedOfficialByInvitationToken(token);
      if (!official) {
        return res.status(404).json({ error: "Token invalide ou expire" });
      }
      if (official.invitationExpiresAt && new Date(official.invitationExpiresAt) < new Date()) {
        return res.status(400).json({ error: "Token expire" });
      }
      const tenant = await storage.getTenantById(official.tenantId);
      res.json({ 
        firstName: official.firstName, 
        lastName: official.lastName,
        tenantName: tenant?.name || ""
      });
    } catch (error) {
      console.error("Validate token error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Public: Set password from invitation token
  app.post("/api/elus/set-password", async (req, res) => {
    try {
      const { token, password } = req.body;
      if (!token || !password) {
        return res.status(400).json({ error: "Token et mot de passe requis" });
      }
      if (password.length < 8) {
        return res.status(400).json({ error: "Le mot de passe doit contenir au moins 8 caracteres" });
      }
      const official = await storage.getElectedOfficialByInvitationToken(token);
      if (!official) {
        return res.status(404).json({ error: "Token invalide ou expire" });
      }
      if (official.invitationExpiresAt && new Date(official.invitationExpiresAt) < new Date()) {
        return res.status(400).json({ error: "Token expire" });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      await storage.setElectedOfficialPassword(official.id, hashedPassword);
      const tenant = await storage.getTenantById(official.tenantId);
      res.json({ success: true, tenantSlug: tenant?.slug });
    } catch (error) {
      console.error("Set password error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Password reset request (for both admin users and elected officials)
  app.post("/api/password-reset/request", async (req, res) => {
    try {
      const { email, tenantSlug } = req.body;
      if (!email || !tenantSlug) {
        return res.status(400).json({ error: "Email et identifiant de la structure requis" });
      }
      
      const tenant = await storage.getTenantBySlug(tenantSlug);
      if (!tenant) {
        return res.json({ success: true });
      }
      
      const adminUser = await storage.getUserByEmailAndTenant(email.toLowerCase(), tenant.id);
      const electedOfficial = await storage.getElectedOfficialByEmailAndTenant(email.toLowerCase(), tenant.id);
      
      if (!adminUser && !electedOfficial) {
        return res.json({ success: true });
      }
      
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      
      await storage.createPasswordResetToken({
        token,
        type: adminUser ? "ADMIN" : "ELU",
        userId: adminUser?.id,
        electedOfficialId: electedOfficial?.id,
        email: email.toLowerCase(),
        tenantId: tenant.id,
        expiresAt
      });
      
      // Build reset URL - always use the custom production domain
      const baseUrl = 'https://voxpopulous.fr';
      const resetUrl = `${baseUrl}/structures/${tenantSlug}/admin/reset-password?token=${token}`;
      
      const userName = adminUser ? adminUser.email : (electedOfficial?.firstName + " " + electedOfficial?.lastName);
      
      const resetContent = `
        <h2 style="color: #1e293b; margin: 0 0 24px 0; font-size: 24px;">Reinitialisation de votre mot de passe</h2>
        <p style="color: #475569; line-height: 1.6; margin: 0 0 16px 0;">Bonjour ${userName},</p>
        <p style="color: #475569; line-height: 1.6; margin: 0 0 16px 0;">
          Vous avez demande la reinitialisation de votre mot de passe pour acceder a l'espace d'administration de <strong style="color: #1e293b;">${tenant.name}</strong>.
        </p>
        <p style="color: #475569; line-height: 1.6; margin: 0 0 24px 0;">Cliquez sur le bouton ci-dessous pour creer un nouveau mot de passe :</p>
        <p style="text-align: center; margin: 0 0 24px 0;">
          <a href="${resetUrl}" style="display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 500;">
            Reinitialiser mon mot de passe
          </a>
        </p>
        <p style="color: #64748b; font-size: 14px; margin: 0 0 8px 0;">Ce lien est valable pendant 1 heure.</p>
        <p style="color: #64748b; font-size: 14px; margin: 0;">Si vous n'avez pas demande cette reinitialisation, vous pouvez ignorer cet email.</p>
      `;
      await sendEmail({
        to: email.toLowerCase(),
        subject: "Reinitialisation de votre mot de passe - VoxPopulous",
        html: wrapEmailContent(resetContent, { title: 'Reinitialisation de mot de passe' })
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Password reset request error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Password reset validate token
  app.get("/api/password-reset/validate", async (req, res) => {
    try {
      const token = req.query.token as string;
      if (!token) {
        return res.status(400).json({ error: "Token requis" });
      }
      
      const resetToken = await storage.getPasswordResetToken(token);
      if (!resetToken) {
        return res.status(404).json({ error: "Token invalide" });
      }
      
      if (resetToken.usedAt) {
        return res.status(400).json({ error: "Ce lien a deja ete utilise" });
      }
      
      if (new Date(resetToken.expiresAt) < new Date()) {
        return res.status(400).json({ error: "Ce lien a expire" });
      }
      
      res.json({ 
        email: resetToken.email,
        type: resetToken.type.toLowerCase()
      });
    } catch (error) {
      console.error("Password reset validate error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Password reset confirm
  app.post("/api/password-reset/confirm", async (req, res) => {
    try {
      const { token, password } = req.body;
      if (!token || !password) {
        return res.status(400).json({ error: "Token et mot de passe requis" });
      }
      if (password.length < 8) {
        return res.status(400).json({ error: "Le mot de passe doit contenir au moins 8 caracteres" });
      }
      
      const resetToken = await storage.getPasswordResetToken(token);
      if (!resetToken) {
        return res.status(404).json({ error: "Token invalide ou expire" });
      }
      
      if (resetToken.usedAt) {
        return res.status(400).json({ error: "Ce lien a deja ete utilise" });
      }
      
      if (new Date(resetToken.expiresAt) < new Date()) {
        return res.status(400).json({ error: "Ce lien a expire" });
      }
      
      const hashedPassword = await bcrypt.hash(password, 10);
      
      if (resetToken.type === "ADMIN" && resetToken.userId) {
        await storage.updateUserPassword(resetToken.userId, hashedPassword);
      } else if (resetToken.type === "ELU" && resetToken.electedOfficialId) {
        await storage.setElectedOfficialPassword(resetToken.electedOfficialId, hashedPassword);
      } else {
        return res.status(400).json({ error: "Configuration de token invalide" });
      }
      
      await storage.markPasswordResetTokenUsed(token);
      const tenant = await storage.getTenantById(resetToken.tenantId);
      
      res.json({ success: true, tenantSlug: tenant?.slug });
    } catch (error) {
      console.error("Password reset confirm error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Elected official login
  app.post("/api/elus/login", async (req, res) => {
    try {
      // Get or create device ID and check blocking
      const deviceId = getOrCreateDeviceId(req, res);
      const deviceBlockStatus = await isDeviceBlocked(deviceId);
      if (deviceBlockStatus.blocked) {
        return res.status(403).json({ error: deviceBlockStatus.reason || "Appareil bloque", deviceBlocked: true });
      }
      
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email et mot de passe requis" });
      }
      const official = await storage.getElectedOfficialByEmail(email);
      if (!official || !official.passwordHash) {
        return res.status(401).json({ error: "Email ou mot de passe incorrect" });
      }
      const isValid = await bcrypt.compare(password, official.passwordHash);
      if (!isValid) {
        return res.status(401).json({ error: "Email ou mot de passe incorrect" });
      }
      // Update last login
      await storage.updateElectedOfficialLastLogin(official.id);
      // Set session for elected official
      req.session.electedOfficialId = official.id;
      req.session.tenantId = official.tenantId;
      const tenant = await storage.getTenantById(official.tenantId);
      const permissions = await storage.getElectedOfficialMenuPermissions(official.id);
      
      // Log activity
      await logActivity({
        req,
        deviceId,
        activityType: "LOGIN",
        tenantId: official.tenantId,
        tenantSlug: tenant?.slug,
        tenantName: tenant?.name,
        electedOfficialId: official.id,
        electedOfficialName: `${official.firstName} ${official.lastName}`,
        actionDetails: "Connexion elu"
      });
      
      res.json({ 
        success: true, 
        electedOfficial: {
          id: official.id,
          firstName: official.firstName,
          lastName: official.lastName,
          email: official.email,
          hasFullAccess: official.hasFullAccess,
          menuPermissions: permissions
        },
        tenant: tenant ? { slug: tenant.slug, name: tenant.name } : null
      });
    } catch (error) {
      console.error("Elected official login error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Elected official logout
  app.post("/api/elus/logout", async (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ error: "Erreur serveur" });
      }
      res.json({ success: true });
    });
  });

  // Get current elected official session
  app.get("/api/elus/me", async (req, res) => {
    try {
      if (!req.session.electedOfficialId) {
        return res.status(401).json({ error: "Non authentifie" });
      }
      const official = await storage.getElectedOfficialById(req.session.electedOfficialId);
      if (!official) {
        return res.status(401).json({ error: "Session invalide" });
      }
      const tenant = await storage.getTenantById(official.tenantId);
      const permissions = await storage.getElectedOfficialMenuPermissions(official.id);
      res.json({
        electedOfficial: {
          id: official.id,
          firstName: official.firstName,
          lastName: official.lastName,
          email: official.email,
          hasFullAccess: official.hasFullAccess,
          menuPermissions: permissions
        },
        tenant: tenant ? { slug: tenant.slug, name: tenant.name } : null
      });
    } catch (error) {
      console.error("Get elected official session error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ==========================================
  // TENANT INTERVENTION DOMAINS ROUTES
  // ==========================================

  // Public: Get active intervention domains for tenant (for citizen forms)
  app.get("/api/tenants/:slug/domains", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      const domains = await storage.getTenantInterventionDomains(tenant.id);
      // Return domains sorted by displayOrder
      const sortedDomains = domains
        .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
      res.json(sortedDomains);
    } catch (error) {
      console.error("Public domains error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Admin: Get intervention domains for tenant
  app.get("/api/tenants/:slug/admin/domains", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      const auth = await checkAdminAuth(req, tenant.id, "DOMAINS");
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error || "Non authentifie" });
      }
      if (!auth.hasMenuAccess) {
        return res.status(403).json({ error: "Permission denied" });
      }

      const domains = await storage.getTenantInterventionDomains(tenant.id);
      res.json(domains);
    } catch (error) {
      console.error("Tenant domains error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Admin: Create intervention domain
  app.post("/api/tenants/:slug/admin/domains", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      const auth = await checkAdminAuth(req, tenant.id, "DOMAINS");
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error || "Non authentifie" });
      }
      if (!auth.hasMenuAccess) {
        return res.status(403).json({ error: "Permission denied" });
      }

      const { name, description, color, displayOrder } = req.body;
      if (!name) {
        return res.status(400).json({ error: "Le nom est requis" });
      }
      const domain = await storage.createTenantInterventionDomain({
        tenantId: tenant.id,
        name,
        description: description || null,
        color: color || null,
        displayOrder: displayOrder || 0,
      });
      res.json(domain);
    } catch (error) {
      console.error("Create tenant domain error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Admin: Update intervention domain
  app.put("/api/tenants/:slug/admin/domains/:id", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      const auth = await checkAdminAuth(req, tenant.id, "DOMAINS");
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error || "Non authentifie" });
      }
      if (!auth.hasMenuAccess) {
        return res.status(403).json({ error: "Permission denied" });
      }

      const existing = await storage.getTenantInterventionDomainById(req.params.id);
      if (!existing || existing.tenantId !== tenant.id) {
        return res.status(404).json({ error: "Domaine non trouve" });
      }
      const { name, description, color, displayOrder } = req.body;
      const updated = await storage.updateTenantInterventionDomain(req.params.id, {
        name,
        description,
        color,
        displayOrder,
      });
      res.json(updated);
    } catch (error) {
      console.error("Update tenant domain error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Admin: Delete intervention domain
  app.delete("/api/tenants/:slug/admin/domains/:id", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      const auth = await checkAdminAuth(req, tenant.id, "DOMAINS");
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error || "Non authentifie" });
      }
      if (!auth.hasMenuAccess) {
        return res.status(403).json({ error: "Permission denied" });
      }

      const existing = await storage.getTenantInterventionDomainById(req.params.id);
      if (!existing || existing.tenantId !== tenant.id) {
        return res.status(404).json({ error: "Domaine non trouve" });
      }
      await storage.deleteTenantInterventionDomain(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete tenant domain error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Admin: Initialize default intervention domains from IDEA_CATEGORIES
  app.post("/api/tenants/:slug/admin/domains/initialize-defaults", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      const auth = await checkAdminAuth(req, tenant.id, "DOMAINS");
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error || "Non authentifie" });
      }
      if (!auth.hasMenuAccess) {
        return res.status(403).json({ error: "Permission denied" });
      }
      
      // Default categories with colors
      const defaultDomains = [
        { name: "Urbanisme", color: "#3b82f6" },
        { name: "Transport", color: "#22c55e" },
        { name: "Environnement", color: "#10b981" },
        { name: "Culture", color: "#a855f7" },
        { name: "Sport", color: "#f97316" },
        { name: "Education", color: "#eab308" },
        { name: "Social", color: "#ec4899" },
        { name: "Economie", color: "#06b6d4" },
        { name: "Vie associative", color: "#8b5cf6" },
        { name: "Evenements", color: "#f59e0b" },
        { name: "Communication", color: "#3b82f6" },
        { name: "Autre", color: "#ef4444" },
      ];
      
      // Get existing domains for this tenant
      const existingDomains = await storage.getTenantInterventionDomains(tenant.id);
      const existingNames = existingDomains.map(d => d.name.toLowerCase());
      
      // Create only domains that don't exist yet
      const createdDomains = [];
      let displayOrder = existingDomains.length > 0 
        ? Math.max(...existingDomains.map(d => d.displayOrder)) + 1 
        : 0;
      
      for (const domainData of defaultDomains) {
        if (!existingNames.includes(domainData.name.toLowerCase())) {
          const domain = await storage.createTenantInterventionDomain({
            tenantId: tenant.id,
            name: domainData.name,
            description: null,
            color: domainData.color,
            displayOrder: displayOrder++,
          });
          createdDomains.push(domain);
        }
      }
      
      res.json({ 
        success: true, 
        created: createdDomains.length,
        skipped: defaultDomains.length - createdDomains.length,
        domains: createdDomains 
      });
    } catch (error) {
      console.error("Initialize default domains error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Admin: Get domains for an elected official
  app.get("/api/tenants/:slug/admin/elus/:id/domains", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      const auth = await checkAdminAuth(req, tenant.id, "ELUS");
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error || "Non authentifie" });
      }
      if (!auth.hasMenuAccess) {
        return res.status(403).json({ error: "Permission denied" });
      }

      const elu = await storage.getElectedOfficialById(req.params.id);
      if (!elu || elu.tenantId !== tenant.id) {
        return res.status(404).json({ error: "Elu non trouve" });
      }
      const domains = await storage.getElectedOfficialDomains(req.params.id);
      res.json(domains);
    } catch (error) {
      console.error("Elected official domains error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Admin: Set domains for an elected official
  app.post("/api/tenants/:slug/admin/elus/:id/domains", async (req, res) => {
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      const auth = await checkAdminAuth(req, tenant.id, "ELUS");
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error || "Non authentifie" });
      }
      if (!auth.hasMenuAccess) {
        return res.status(403).json({ error: "Permission denied" });
      }

      const elu = await storage.getElectedOfficialById(req.params.id);
      if (!elu || elu.tenantId !== tenant.id) {
        return res.status(404).json({ error: "Elu non trouve" });
      }
      const { domainIds } = req.body;
      if (!Array.isArray(domainIds)) {
        return res.status(400).json({ error: "domainIds doit etre un tableau" });
      }
      await storage.setElectedOfficialDomains(req.params.id, domainIds);
      const domains = await storage.getElectedOfficialDomains(req.params.id);
      res.json(domains);
    } catch (error) {
      console.error("Set elected official domains error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ==========================================
  // ASSOCIATION INTERVENTION DOMAINS ROUTES
  // ==========================================

  // Admin: Get intervention domains for association
  app.get("/api/tenants/:slug/associations/:associationSlug/admin/domains", async (req, res) => {
    if (!req.session.associationUserId || !req.session.associationId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const association = await storage.getAssociationBySlug(req.params.slug, req.params.associationSlug);
      if (!association || association.id !== req.session.associationId) {
        return res.status(403).json({ error: "Acces refuse" });
      }
      const domains = await storage.getAssociationInterventionDomains(association.id);
      res.json(domains);
    } catch (error) {
      console.error("Association domains error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Admin: Create association intervention domain
  app.post("/api/tenants/:slug/associations/:associationSlug/admin/domains", async (req, res) => {
    if (!req.session.associationUserId || !req.session.associationId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const association = await storage.getAssociationBySlug(req.params.slug, req.params.associationSlug);
      if (!association || association.id !== req.session.associationId) {
        return res.status(403).json({ error: "Acces refuse" });
      }
      const { name, description, color, displayOrder } = req.body;
      if (!name) {
        return res.status(400).json({ error: "Le nom est requis" });
      }
      const domain = await storage.createAssociationInterventionDomain({
        associationId: association.id,
        name,
        description: description || null,
        color: color || null,
        displayOrder: displayOrder || 0,
      });
      res.json(domain);
    } catch (error) {
      console.error("Create association domain error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Admin: Update association intervention domain
  app.put("/api/tenants/:slug/associations/:associationSlug/admin/domains/:id", async (req, res) => {
    if (!req.session.associationUserId || !req.session.associationId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const association = await storage.getAssociationBySlug(req.params.slug, req.params.associationSlug);
      if (!association || association.id !== req.session.associationId) {
        return res.status(403).json({ error: "Acces refuse" });
      }
      const existing = await storage.getAssociationInterventionDomainById(req.params.id);
      if (!existing || existing.associationId !== association.id) {
        return res.status(404).json({ error: "Domaine non trouve" });
      }
      const { name, description, color, displayOrder } = req.body;
      const updated = await storage.updateAssociationInterventionDomain(req.params.id, {
        name,
        description,
        color,
        displayOrder,
      });
      res.json(updated);
    } catch (error) {
      console.error("Update association domain error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Admin: Delete association intervention domain
  app.delete("/api/tenants/:slug/associations/:associationSlug/admin/domains/:id", async (req, res) => {
    if (!req.session.associationUserId || !req.session.associationId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const association = await storage.getAssociationBySlug(req.params.slug, req.params.associationSlug);
      if (!association || association.id !== req.session.associationId) {
        return res.status(403).json({ error: "Acces refuse" });
      }
      const existing = await storage.getAssociationInterventionDomainById(req.params.id);
      if (!existing || existing.associationId !== association.id) {
        return res.status(404).json({ error: "Domaine non trouve" });
      }
      await storage.deleteAssociationInterventionDomain(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete association domain error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Admin: Get domains for a bureau member
  app.get("/api/tenants/:slug/associations/:associationSlug/admin/bureau/:id/domains", async (req, res) => {
    if (!req.session.associationUserId || !req.session.associationId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const association = await storage.getAssociationBySlug(req.params.slug, req.params.associationSlug);
      if (!association || association.id !== req.session.associationId) {
        return res.status(403).json({ error: "Acces refuse" });
      }
      const member = await storage.getBureauMemberById(req.params.id);
      if (!member || member.associationId !== association.id) {
        return res.status(404).json({ error: "Membre non trouve" });
      }
      const domains = await storage.getBureauMemberDomains(req.params.id);
      res.json(domains);
    } catch (error) {
      console.error("Bureau member domains error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Admin: Set domains for a bureau member
  app.post("/api/tenants/:slug/associations/:associationSlug/admin/bureau/:id/domains", async (req, res) => {
    if (!req.session.associationUserId || !req.session.associationId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const association = await storage.getAssociationBySlug(req.params.slug, req.params.associationSlug);
      if (!association || association.id !== req.session.associationId) {
        return res.status(403).json({ error: "Acces refuse" });
      }
      const member = await storage.getBureauMemberById(req.params.id);
      if (!member || member.associationId !== association.id) {
        return res.status(404).json({ error: "Membre non trouve" });
      }
      const { domainIds } = req.body;
      if (!Array.isArray(domainIds)) {
        return res.status(400).json({ error: "domainIds doit etre un tableau" });
      }
      await storage.setBureauMemberDomains(req.params.id, domainIds);
      const domains = await storage.getBureauMemberDomains(req.params.id);
      res.json(domains);
    } catch (error) {
      console.error("Set bureau member domains error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ==========================================
  // ASSOCIATION INTERVENTION DOMAINS ROUTES (by associationId)
  // ==========================================

  // Admin: Get intervention domains for association (by associationId)
  app.get("/api/associations/:associationId/admin/domains", async (req, res) => {
    if (!req.session.associationUserId || !req.session.associationId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const associationId = req.params.associationId;
      if (associationId !== req.session.associationId) {
        return res.status(403).json({ error: "Acces refuse" });
      }
      const domains = await storage.getAssociationInterventionDomains(associationId);
      res.json(domains);
    } catch (error) {
      console.error("Association domains error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Admin: Create association intervention domain (by associationId)
  app.post("/api/associations/:associationId/admin/domains", async (req, res) => {
    if (!req.session.associationUserId || !req.session.associationId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const associationId = req.params.associationId;
      if (associationId !== req.session.associationId) {
        return res.status(403).json({ error: "Acces refuse" });
      }
      const { name, description, color, displayOrder } = req.body;
      if (!name) {
        return res.status(400).json({ error: "Le nom est requis" });
      }
      const domain = await storage.createAssociationInterventionDomain({
        associationId,
        name,
        description: description || null,
        color: color || null,
        displayOrder: displayOrder || 0,
      });
      res.json(domain);
    } catch (error) {
      console.error("Create association domain error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Admin: Update association intervention domain (by associationId)
  app.put("/api/associations/:associationId/admin/domains/:id", async (req, res) => {
    if (!req.session.associationUserId || !req.session.associationId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const associationId = req.params.associationId;
      if (associationId !== req.session.associationId) {
        return res.status(403).json({ error: "Acces refuse" });
      }
      const existing = await storage.getAssociationInterventionDomainById(req.params.id);
      if (!existing || existing.associationId !== associationId) {
        return res.status(404).json({ error: "Domaine non trouve" });
      }
      const { name, description, color, displayOrder } = req.body;
      const updated = await storage.updateAssociationInterventionDomain(req.params.id, {
        name,
        description,
        color,
        displayOrder,
      });
      res.json(updated);
    } catch (error) {
      console.error("Update association domain error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Admin: Delete association intervention domain (by associationId)
  app.delete("/api/associations/:associationId/admin/domains/:id", async (req, res) => {
    if (!req.session.associationUserId || !req.session.associationId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const associationId = req.params.associationId;
      if (associationId !== req.session.associationId) {
        return res.status(403).json({ error: "Acces refuse" });
      }
      const existing = await storage.getAssociationInterventionDomainById(req.params.id);
      if (!existing || existing.associationId !== associationId) {
        return res.status(404).json({ error: "Domaine non trouve" });
      }
      await storage.deleteAssociationInterventionDomain(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete association domain error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Admin: Get domains for a bureau member (by associationId)
  app.get("/api/associations/:associationId/admin/bureau/:id/domains", async (req, res) => {
    if (!req.session.associationUserId || !req.session.associationId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const associationId = req.params.associationId;
      if (associationId !== req.session.associationId) {
        return res.status(403).json({ error: "Acces refuse" });
      }
      const member = await storage.getBureauMemberById(req.params.id);
      if (!member || member.associationId !== associationId) {
        return res.status(404).json({ error: "Membre non trouve" });
      }
      const domains = await storage.getBureauMemberDomains(req.params.id);
      res.json(domains);
    } catch (error) {
      console.error("Bureau member domains error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Admin: Set domains for a bureau member (by associationId)
  app.post("/api/associations/:associationId/admin/bureau/:id/domains", async (req, res) => {
    if (!req.session.associationUserId || !req.session.associationId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const associationId = req.params.associationId;
      if (associationId !== req.session.associationId) {
        return res.status(403).json({ error: "Acces refuse" });
      }
      const member = await storage.getBureauMemberById(req.params.id);
      if (!member || member.associationId !== associationId) {
        return res.status(404).json({ error: "Membre non trouve" });
      }
      const { domainIds } = req.body;
      if (!Array.isArray(domainIds)) {
        return res.status(400).json({ error: "domainIds doit etre un tableau" });
      }
      await storage.setBureauMemberDomains(req.params.id, domainIds);
      const domains = await storage.getBureauMemberDomains(req.params.id);
      res.json(domains);
    } catch (error) {
      console.error("Set bureau member domains error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ==========================================
  // EPCI COMMUNES MANAGEMENT ROUTES
  // ==========================================

  // EPCI Admin: List communes created by this EPCI + quota info
  app.get("/api/tenants/:slug/admin/communes", async (req, res) => {
    if (!req.session.userId || !req.session.tenantId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant || tenant.id !== req.session.tenantId) {
        return res.status(401).json({ error: "Non authentifie" });
      }
      if (tenant.tenantType !== "EPCI") {
        return res.status(403).json({ error: "Cette fonctionnalite est reservee aux EPCI" });
      }
      const communes = await storage.getCommunesByEpciId(tenant.id);
      
      // Calculate quota
      const planIncluded = tenant.subscriptionPlanId 
        ? (await storage.getSubscriptionPlanById(tenant.subscriptionPlanId))?.communesIncluded || 0
        : 0;
      const purchased = tenant.purchasedCommunes || 0;
      const allowed = planIncluded + purchased;
      const used = communes.length;
      
      res.json({ 
        communes,
        quota: {
          allowed,
          used,
          remaining: Math.max(0, allowed - used),
          planIncluded,
          purchased
        }
      });
    } catch (error) {
      console.error("EPCI communes list error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // EPCI Admin: Create a new commune
  app.post("/api/tenants/:slug/admin/communes", async (req, res) => {
    if (!req.session.userId || !req.session.tenantId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant || tenant.id !== req.session.tenantId) {
        return res.status(401).json({ error: "Non authentifie" });
      }
      if (tenant.tenantType !== "EPCI") {
        return res.status(403).json({ error: "Cette fonctionnalite est reservee aux EPCI" });
      }
      
      // Check quota
      const communes = await storage.getCommunesByEpciId(tenant.id);
      const planIncluded = tenant.subscriptionPlanId 
        ? (await storage.getSubscriptionPlanById(tenant.subscriptionPlanId))?.communesIncluded || 0
        : 0;
      const purchased = tenant.purchasedCommunes || 0;
      const allowed = planIncluded + purchased;
      
      if (communes.length >= allowed) {
        return res.status(400).json({ error: "Quota atteint. Vous devez augmenter votre forfait pour creer plus de communes." });
      }
      
      // Validate input
      const { name, slug, adminEmail, adminName, password } = req.body;
      if (!name || name.length < 2) {
        return res.status(400).json({ error: "Le nom doit contenir au moins 2 caracteres" });
      }
      if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
        return res.status(400).json({ error: "L'URL doit contenir uniquement des lettres minuscules, chiffres et tirets" });
      }
      if (!adminEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
        return res.status(400).json({ error: "Email invalide" });
      }
      if (!adminName || adminName.length < 2) {
        return res.status(400).json({ error: "Le nom de l'administrateur doit contenir au moins 2 caracteres" });
      }
      if (!password || password.length < 8) {
        return res.status(400).json({ error: "Le mot de passe doit contenir au moins 8 caracteres" });
      }
      
      // Check slug availability
      const existingSlug = await storage.getTenantBySlug(slug);
      if (existingSlug) {
        return res.status(400).json({ error: "Cette URL est deja utilisee" });
      }
      
      // Create commune as MAIRIE tenant linked to this EPCI
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 30);
      
      const newCommune = await storage.createTenant({
        name,
        slug,
        tenantType: "MAIRIE",
        contactEmail: adminEmail,
        contactName: adminName,
        parentEpciId: tenant.id,
        subscriptionPlan: "FREE_TRIAL",
        subscriptionPlanId: tenant.subscriptionPlanId, // Inherit plan from EPCI
        billingStatus: "TRIAL",
        trialEndsAt,
      });
      
      // Create admin user for the commune
      const passwordHash = await bcrypt.hash(password, 10);
      await storage.createUser({
        tenantId: newCommune.id,
        name: adminName,
        email: adminEmail,
        passwordHash,
        role: "ADMIN",
      });
      
      res.json(newCommune);
    } catch (error) {
      console.error("Create commune error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // EPCI Admin: Delete a commune created by this EPCI
  app.delete("/api/tenants/:slug/admin/communes/:communeId", async (req, res) => {
    if (!req.session.userId || !req.session.tenantId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    try {
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant || tenant.id !== req.session.tenantId) {
        return res.status(401).json({ error: "Non authentifie" });
      }
      if (tenant.tenantType !== "EPCI") {
        return res.status(403).json({ error: "Cette fonctionnalite est reservee aux EPCI" });
      }

      const commune = await storage.getTenantById(req.params.communeId);
      if (!commune) {
        return res.status(404).json({ error: "Commune non trouvee" });
      }
      if (commune.parentEpciId !== tenant.id) {
        return res.status(400).json({ error: "Cette commune n'appartient pas a cet EPCI" });
      }

      // For now, we unlink the commune (soft delete)
      // In a real scenario, you might want to archive or fully delete
      const updated = await storage.unlinkCommuneFromEpci(commune.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete commune error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ==========================================
  // CHAT ROUTES
  // ==========================================

  // Create a new chat thread for contacting an official/member
  app.post("/api/chat/threads", async (req, res) => {
    try {
      const { subjectType, subjectId, tenantId, associationId, requesterName, requesterEmail, subject, message } = req.body;
      
      if (!subjectType || !subjectId || !requesterName || !requesterEmail || !subject || !message) {
        return res.status(400).json({ error: "Tous les champs sont requis" });
      }
      
      let officialEmail: string | null = null;
      let officialName: string = "";
      let organizationName: string = "";
      
      // Validate subject exists based on type and get email
      if (subjectType === "TENANT_ELU" || subjectType === "EPCI_ELU") {
        const official = await storage.getElectedOfficialById(subjectId);
        if (!official) {
          return res.status(404).json({ error: "Elu non trouve" });
        }
        officialEmail = official.email;
        officialName = `${official.firstName} ${official.lastName}`;
        
        // Get tenant name for organization
        if (tenantId) {
          const tenant = await storage.getTenantById(tenantId);
          organizationName = tenant?.name || "Votre collectivite";
        }
      } else if (subjectType === "ASSOCIATION_MEMBER") {
        const member = await storage.getBureauMemberById(subjectId);
        if (!member) {
          return res.status(404).json({ error: "Membre non trouve" });
        }
        officialEmail = member.email;
        officialName = `${member.firstName} ${member.lastName}`;
        
        // Get association name for organization
        if (associationId) {
          const association = await storage.getAssociationById(associationId);
          organizationName = association?.name || "Votre association";
        }
      }
      
      // Create the thread
      const thread = await storage.createChatThread({
        subjectType,
        subjectId,
        tenantId: tenantId || null,
        associationId: associationId || null,
        requesterName,
        requesterEmail,
        subject,
      });
      
      // Create the first message
      await storage.createChatMessage({
        threadId: thread.id,
        senderType: "requester",
        senderName: requesterName,
        content: message,
      });
      
      // Send email notification to official/member with chat link
      if (officialEmail) {
        const baseUrl = process.env.REPLIT_DEV_DOMAIN 
          ? `https://${process.env.REPLIT_DEV_DOMAIN}`
          : process.env.REPLIT_DEPLOYMENT_URL || 'http://localhost:5000';
        const chatLink = `${baseUrl}/chat/official/${thread.officialToken}`;
        
        sendChatMessageToOfficialEmail(
          officialEmail,
          officialName,
          requesterName,
          requesterEmail,
          subject,
          message,
          organizationName,
          chatLink
        ).catch(err => console.error("Failed to send chat notification email:", err));
      }
      
      res.json(thread);
    } catch (error) {
      console.error("Create chat thread error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Get chat threads by subject (for officials/members to see their messages)
  app.get("/api/chat/threads/by-subject/:subjectType/:subjectId", async (req, res) => {
    try {
      const threads = await storage.getChatThreadsBySubject(
        req.params.subjectType,
        req.params.subjectId
      );
      res.json(threads);
    } catch (error) {
      console.error("Get chat threads error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Get chat threads by requester email (for citizens to see their conversations)
  app.get("/api/chat/threads/by-email/:email", async (req, res) => {
    try {
      const threads = await storage.getChatThreadsByRequesterEmail(req.params.email);
      res.json(threads);
    } catch (error) {
      console.error("Get chat threads by email error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Get a single chat thread with messages
  app.get("/api/chat/threads/:threadId", async (req, res) => {
    try {
      const thread = await storage.getChatThreadById(req.params.threadId);
      if (!thread) {
        return res.status(404).json({ error: "Conversation non trouvee" });
      }
      const messages = await storage.getChatMessagesByThread(req.params.threadId);
      res.json({ thread, messages });
    } catch (error) {
      console.error("Get chat thread error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Add a message to a chat thread
  app.post("/api/chat/threads/:threadId/messages", async (req, res) => {
    try {
      const thread = await storage.getChatThreadById(req.params.threadId);
      if (!thread) {
        return res.status(404).json({ error: "Conversation non trouvee" });
      }
      
      const { senderType, senderName, content } = req.body;
      if (!senderType || !senderName || !content) {
        return res.status(400).json({ error: "Tous les champs sont requis" });
      }
      
      const message = await storage.createChatMessage({
        threadId: req.params.threadId,
        senderType,
        senderName,
        content,
      });
      
      // Send email notification based on who sent the message
      const baseUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : process.env.REPLIT_DEPLOYMENT_URL || 'http://localhost:5000';
      
      if (senderType === "official") {
        // Official replied to requester - send email to the requester
        let organizationName = "";
        
        // Get official info for the email
        if (thread.subjectType === "TENANT_ELU" || thread.subjectType === "EPCI_ELU") {
          if (thread.tenantId) {
            const tenant = await storage.getTenantById(thread.tenantId);
            organizationName = tenant?.name || "Votre collectivite";
          }
        } else if (thread.subjectType === "ASSOCIATION_MEMBER") {
          if (thread.associationId) {
            const association = await storage.getAssociationById(thread.associationId);
            organizationName = association?.name || "Votre association";
          }
        }
        
        const chatLink = `${baseUrl}/chat/public/${thread.publicToken}`;
        sendChatReplyToRequesterEmail(
          thread.requesterEmail,
          thread.requesterName,
          senderName,
          thread.subject,
          content,
          organizationName,
          chatLink
        ).catch(err => console.error("Failed to send chat reply email:", err));
      } else if (senderType === "requester") {
        // Requester sent a follow-up message - send email to the official
        let officialEmail: string | null = null;
        let officialName = "";
        let organizationName = "";
        
        if (thread.subjectType === "TENANT_ELU" || thread.subjectType === "EPCI_ELU") {
          const official = await storage.getElectedOfficialById(thread.subjectId);
          if (official) {
            officialEmail = official.email;
            officialName = `${official.firstName} ${official.lastName}`;
          }
          if (thread.tenantId) {
            const tenant = await storage.getTenantById(thread.tenantId);
            organizationName = tenant?.name || "Votre collectivite";
          }
        } else if (thread.subjectType === "ASSOCIATION_MEMBER") {
          const member = await storage.getBureauMemberById(thread.subjectId);
          if (member) {
            officialEmail = member.email;
            officialName = `${member.firstName} ${member.lastName}`;
          }
          if (thread.associationId) {
            const association = await storage.getAssociationById(thread.associationId);
            organizationName = association?.name || "Votre association";
          }
        }
        
        if (officialEmail) {
          const chatLink = `${baseUrl}/chat/official/${thread.officialToken}`;
          sendChatMessageToOfficialEmail(
            officialEmail,
            officialName,
            thread.requesterName,
            thread.requesterEmail,
            thread.subject,
            content,
            organizationName,
            chatLink
          ).catch(err => console.error("Failed to send chat notification email:", err));
        }
      }
      
      res.json(message);
    } catch (error) {
      console.error("Create chat message error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Mark messages as read
  app.post("/api/chat/threads/:threadId/mark-read", async (req, res) => {
    try {
      const thread = await storage.getChatThreadById(req.params.threadId);
      if (!thread) {
        return res.status(404).json({ error: "Conversation non trouvee" });
      }
      
      const { senderType } = req.body; // The type of the reader (to mark opposite messages as read)
      if (!senderType) {
        return res.status(400).json({ error: "Type de lecteur requis" });
      }
      
      await storage.markChatMessagesAsRead(req.params.threadId, senderType);
      res.json({ success: true });
    } catch (error) {
      console.error("Mark messages read error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Close a chat thread
  app.post("/api/chat/threads/:threadId/close", async (req, res) => {
    try {
      const thread = await storage.updateChatThreadStatus(req.params.threadId, "CLOSED");
      if (!thread) {
        return res.status(404).json({ error: "Conversation non trouvee" });
      }
      res.json(thread);
    } catch (error) {
      console.error("Close chat thread error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Get unread messages count for an official/member
  app.get("/api/chat/unread/:subjectType/:subjectId", async (req, res) => {
    try {
      const count = await storage.getUnreadChatMessagesCount(
        req.params.subjectType,
        req.params.subjectId
      );
      res.json({ count });
    } catch (error) {
      console.error("Get unread count error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // =====================================================
  // REAL-TIME CHAT WITH TOKEN ACCESS
  // =====================================================
  
  // Store SSE connections per thread
  const sseConnections = new Map<string, Set<Response>>();

  // Access chat thread via public token (for citizens from email link)
  app.get("/api/chat/public/:token", async (req, res) => {
    try {
      const thread = await storage.getChatThreadByPublicToken(req.params.token);
      if (!thread) {
        return res.status(404).json({ error: "Conversation non trouvee ou lien expire" });
      }
      const messages = await storage.getChatMessagesByThread(thread.id);
      
      // Mark official messages as read when citizen accesses
      await storage.markChatMessagesAsRead(thread.id, "requester");
      
      // Set a cookie to remember this session
      res.cookie(`chat_session_${thread.id}`, 'public', { 
        httpOnly: true, 
        maxAge: 90 * 24 * 60 * 60 * 1000, // 90 days
        sameSite: 'lax'
      });
      
      res.json({ 
        thread: { ...thread, accessType: 'public' }, 
        messages 
      });
    } catch (error) {
      console.error("Get chat by public token error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Access chat thread via official token (for elected officials/bureau members from email link)
  app.get("/api/chat/official/:token", async (req, res) => {
    try {
      const thread = await storage.getChatThreadByOfficialToken(req.params.token);
      if (!thread) {
        return res.status(404).json({ error: "Conversation non trouvee ou lien expire" });
      }
      const messages = await storage.getChatMessagesByThread(thread.id);
      
      // Mark requester messages as read when official accesses
      await storage.markChatMessagesAsRead(thread.id, "official");
      
      // Set a cookie to remember this session
      res.cookie(`chat_session_${thread.id}`, 'official', { 
        httpOnly: true, 
        maxAge: 90 * 24 * 60 * 60 * 1000, // 90 days
        sameSite: 'lax'
      });
      
      res.json({ 
        thread: { ...thread, accessType: 'official' }, 
        messages 
      });
    } catch (error) {
      console.error("Get chat by official token error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Add message via public token (citizen sending message)
  app.post("/api/chat/public/:token/messages", async (req, res) => {
    try {
      const thread = await storage.getChatThreadByPublicToken(req.params.token);
      if (!thread) {
        return res.status(404).json({ error: "Conversation non trouvee" });
      }
      if (thread.status === "CLOSED") {
        return res.status(400).json({ error: "Cette conversation est fermee" });
      }
      
      const { content } = req.body;
      if (!content) {
        return res.status(400).json({ error: "Message requis" });
      }
      
      const message = await storage.createChatMessage({
        threadId: thread.id,
        senderType: "requester",
        senderName: thread.requesterName,
        content,
      });
      
      // Send email notification to official
      const baseUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : process.env.REPLIT_DEPLOYMENT_URL || 'http://localhost:5000';
      const chatLink = `${baseUrl}/chat/official/${thread.officialToken}`;
      
      // Get official info and send email
      let officialEmail: string | null = null;
      let officialName: string = "";
      let organizationName: string = "";
      
      if (thread.subjectType === "TENANT_ELU" || thread.subjectType === "EPCI_ELU") {
        const official = await storage.getElectedOfficialById(thread.subjectId);
        if (official?.email) {
          officialEmail = official.email;
          officialName = `${official.firstName} ${official.lastName}`;
          if (thread.tenantId) {
            const tenant = await storage.getTenantById(thread.tenantId);
            organizationName = tenant?.name || "";
          }
        }
      } else if (thread.subjectType === "ASSOCIATION_MEMBER") {
        const member = await storage.getBureauMemberById(thread.subjectId);
        if (member?.email) {
          officialEmail = member.email;
          officialName = `${member.firstName} ${member.lastName}`;
          if (thread.associationId) {
            const association = await storage.getAssociationById(thread.associationId);
            organizationName = association?.name || "";
          }
        }
      }
      
      if (officialEmail) {
        await sendChatMessageToOfficialEmail(
          officialEmail,
          officialName,
          thread.requesterName,
          thread.requesterEmail,
          thread.subject,
          content,
          organizationName,
          chatLink
        );
      }
      
      // Notify SSE connections
      const connections = sseConnections.get(thread.id);
      if (connections) {
        const eventData = JSON.stringify({ type: 'new_message', message });
        connections.forEach(client => {
          client.write(`data: ${eventData}\n\n`);
        });
      }
      
      res.json(message);
    } catch (error) {
      console.error("Add message via public token error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Add message via official token (official replying)
  app.post("/api/chat/official/:token/messages", async (req, res) => {
    try {
      const thread = await storage.getChatThreadByOfficialToken(req.params.token);
      if (!thread) {
        return res.status(404).json({ error: "Conversation non trouvee" });
      }
      if (thread.status === "CLOSED") {
        return res.status(400).json({ error: "Cette conversation est fermee" });
      }
      
      const { content, senderName } = req.body;
      if (!content || !senderName) {
        return res.status(400).json({ error: "Message et nom requis" });
      }
      
      const message = await storage.createChatMessage({
        threadId: thread.id,
        senderType: "official",
        senderName,
        content,
      });
      
      // Send email notification to citizen
      const baseUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : process.env.REPLIT_DEPLOYMENT_URL || 'http://localhost:5000';
      const chatLink = `${baseUrl}/chat/public/${thread.publicToken}`;
      
      let organizationName: string = "";
      if (thread.tenantId) {
        const tenant = await storage.getTenantById(thread.tenantId);
        organizationName = tenant?.name || "";
      } else if (thread.associationId) {
        const association = await storage.getAssociationById(thread.associationId);
        organizationName = association?.name || "";
      }
      
      await sendChatReplyToRequesterEmail(
        thread.requesterEmail,
        thread.requesterName,
        senderName,
        thread.subject,
        content,
        organizationName,
        chatLink
      );
      
      // Notify SSE connections
      const connections = sseConnections.get(thread.id);
      if (connections) {
        const eventData = JSON.stringify({ type: 'new_message', message });
        connections.forEach(client => {
          client.write(`data: ${eventData}\n\n`);
        });
      }
      
      res.json(message);
    } catch (error) {
      console.error("Add message via official token error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // SSE endpoint for real-time updates on a thread (requires token for authorization)
  app.get("/api/chat/sse/:threadId", async (req, res) => {
    const threadId = req.params.threadId;
    const token = req.query.token as string;
    const tokenType = req.query.type as string;
    
    // Verify thread exists and validate token
    const thread = await storage.getChatThreadById(threadId);
    if (!thread) {
      return res.status(404).json({ error: "Conversation non trouvee" });
    }
    
    // Validate the token for authorization
    if (!token || !tokenType) {
      return res.status(401).json({ error: "Autorisation requise" });
    }
    
    // Only allow valid token types
    if (!['public', 'official'].includes(tokenType)) {
      return res.status(401).json({ error: "Type de token invalide" });
    }
    
    // Validate the token matches the expected type
    const isValidToken = 
      (tokenType === 'public' && thread.publicToken === token) ||
      (tokenType === 'official' && thread.officialToken === token);
    
    if (!isValidToken) {
      return res.status(401).json({ error: "Token invalide" });
    }
    
    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    
    // Add this connection to the set
    if (!sseConnections.has(threadId)) {
      sseConnections.set(threadId, new Set());
    }
    sseConnections.get(threadId)!.add(res);
    
    // Send initial connection confirmation
    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);
    
    // Heartbeat to keep connection alive
    const heartbeat = setInterval(() => {
      res.write(`: heartbeat\n\n`);
    }, 30000);
    
    // Clean up on disconnect
    req.on('close', () => {
      clearInterval(heartbeat);
      const connections = sseConnections.get(threadId);
      if (connections) {
        connections.delete(res);
        if (connections.size === 0) {
          sseConnections.delete(threadId);
        }
      }
    });
  });

  // Close thread via official token
  app.post("/api/chat/official/:token/close", async (req, res) => {
    try {
      const thread = await storage.getChatThreadByOfficialToken(req.params.token);
      if (!thread) {
        return res.status(404).json({ error: "Conversation non trouvee" });
      }
      
      const updated = await storage.updateChatThreadStatus(thread.id, "CLOSED");
      
      // Notify SSE connections
      const connections = sseConnections.get(thread.id);
      if (connections) {
        const eventData = JSON.stringify({ type: 'thread_closed' });
        connections.forEach(client => {
          client.write(`data: ${eventData}\n\n`);
        });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Close thread via official token error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });
}
