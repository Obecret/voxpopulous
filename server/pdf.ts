import PDFDocument from "pdfkit";
import { Quote, QuoteLineItem, Invoice, InvoiceLineItem, MandateOrder, MandateInvoice, SubscriptionPlan, CompanySettings, Addon, TenantAddon } from "@shared/schema";

interface QuoteWithLineItems extends Quote {
  lineItems: QuoteLineItem[];
}

interface InvoiceWithLineItems extends Invoice {
  lineItems: InvoiceLineItem[];
}

interface AddonWithQuantity extends Addon {
  quantity: number;
}

interface MandateOrderWithPlan extends MandateOrder {
  plan?: SubscriptionPlan;
  tenantType?: "MAIRIE" | "EPCI" | "ASSOCIATION";
  addons?: AddonWithQuantity[];
}

function getDocumentTitleAndNumber(order: MandateOrderWithPlan): { title: string; number: string } {
  switch (order.status) {
    case "PENDING_VALIDATION":
      return { title: "DEVIS", number: order.orderNumber };
    case "PENDING_BC":
      return { title: "DEVIS VALIDE", number: order.orderNumber };
    case "ACCEPTED":
    case "INVOICED":
      return { title: "BON DE COMMANDE", number: order.commandeNumber || order.orderNumber };
    case "REJECTED":
      return { title: "DEVIS REFUSE", number: order.orderNumber };
    default:
      return { title: "DEVIS", number: order.orderNumber };
  }
}

interface MandateInvoiceWithOrder extends MandateInvoice {
  order?: MandateOrder;
  plan?: SubscriptionPlan;
  tenantType?: "MAIRIE" | "EPCI" | "ASSOCIATION";
  addons?: AddonWithQuantity[];
}

const PAGE_WIDTH = 595.28;
const M = 40;
const W = PAGE_WIDTH - M * 2;

const C = {
  dark: "#1f2937",
  gray: "#6b7280",
  light: "#f9fafb",
  border: "#e5e7eb",
  accent: "#2563eb",
  green: "#059669",
};

function fc(cents: number): string {
  return formatEuros(cents / 100);
}

function fe(euros: number): string {
  return formatEuros(euros);
}

function formatEuros(amount: number): string {
  const formatted = amount.toFixed(2).replace('.', ',');
  const parts = formatted.split(',');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return parts.join(',') + ' €';
}

function fd(d: Date | string | null): string {
  if (!d) return "-";
  return (typeof d === "string" ? new Date(d) : d).toLocaleDateString("fr-FR");
}

function initDoc(): PDFKit.PDFDocument {
  return new PDFDocument({ size: "A4", margin: M, autoFirstPage: true });
}

function drawBrandHeader(doc: PDFKit.PDFDocument) {
  doc.font("Helvetica-Bold").fontSize(22).fillColor(C.accent).text("Voxpopulous.fr", M, 30);
  doc.font("Helvetica").fontSize(10).fillColor(C.gray).text("L'outil de participation Citoyenne pour les Mairies, EPCI et Associations", M, 55);
  doc.moveTo(M, 75).lineTo(PAGE_WIDTH - M, 75).strokeColor(C.border).lineWidth(1).stroke();
}

function drawDocTitle(doc: PDFKit.PDFDocument, title: string, num: string, date: string) {
  doc.font("Helvetica-Bold").fontSize(18).fillColor(C.dark).text(title, M, 85);
  doc.font("Helvetica").fontSize(11).fillColor(C.gray).text(`N° ${num}`, M, 108);
  doc.text(`Date: ${date}`, PAGE_WIDTH - M - 120, 108, { width: 120, align: "right" });
}

function drawSection(doc: PDFKit.PDFDocument, x: number, y: number, w: number, title: string): number {
  doc.font("Helvetica-Bold").fontSize(10).fillColor(C.dark).text(title.toUpperCase(), x, y);
  doc.moveTo(x, y + 14).lineTo(x + w, y + 14).strokeColor(C.border).lineWidth(0.5).stroke();
  return y + 20;
}

export async function generateQuotePdf(quote: QuoteWithLineItems): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = initDoc();
      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      drawBrandHeader(doc);
      drawDocTitle(doc, "DEVIS", quote.quoteNumber, fd(quote.createdAt));

      let y = 130;
      const hw = W / 2 - 10;

      let sy = drawSection(doc, M, y, hw, "Emetteur");
      doc.font("Helvetica-Bold").fontSize(11).fillColor(C.dark).text(quote.emitterName || "Voxpopulous", M, sy);
      doc.font("Helvetica").fontSize(10).fillColor(C.gray);
      if (quote.emitterSiret) doc.text(`SIRET: ${quote.emitterSiret}`, M, sy + 14);
      if (quote.emitterTva) doc.text(`TVA: ${quote.emitterTva}`, M, sy + 26);

      sy = drawSection(doc, M + hw + 20, y, hw, "Destinataire");
      doc.font("Helvetica-Bold").fontSize(11).fillColor(C.dark).text(quote.clientName || "", M + hw + 20, sy);
      doc.font("Helvetica").fontSize(10).fillColor(C.gray);
      if (quote.clientSiret) doc.text(`SIRET: ${quote.clientSiret}`, M + hw + 20, sy + 14);
      if (quote.clientEmail) doc.text(quote.clientEmail, M + hw + 20, sy + 26);

      y += 70;

      const st: Record<string, string> = { DRAFT: "Brouillon", SENT: "Envoye", ACCEPTED: "Accepte", REJECTED: "Refuse", EXPIRED: "Expire" };
      doc.font("Helvetica").fontSize(10).fillColor(C.gray);
      doc.text(`Statut: ${st[quote.status] || quote.status}  |  Validite: ${fd(quote.validUntil)}`, M, y);
      y += 20;

      doc.rect(M, y, W, 22).fillColor(C.light).fill();
      doc.font("Helvetica-Bold").fontSize(10).fillColor(C.dark);
      doc.text("Description", M + 8, y + 6, { width: 260 });
      doc.text("Qte", M + 280, y + 6, { width: 40, align: "center" });
      doc.text("Prix unit. HT", M + 330, y + 6, { width: 80, align: "right" });
      doc.text("Total HT", M + 420, y + 6, { width: 70, align: "right" });
      y += 22;

      const items = (quote.lineItems || []).slice(0, 6);
      doc.font("Helvetica").fontSize(10);
      items.forEach((it) => {
        doc.fillColor(C.dark).text(it.description || "", M + 8, y + 5, { width: 260 });
        doc.text(String(it.quantity || 1), M + 280, y + 5, { width: 40, align: "center" });
        // Amounts stored in euros, use fe() not fc()
        doc.text(fe(it.unitPrice || 0), M + 330, y + 5, { width: 80, align: "right" });
        doc.text(fe(it.total || 0), M + 420, y + 5, { width: 70, align: "right" });
        doc.moveTo(M, y + 20).lineTo(PAGE_WIDTH - M, y + 20).strokeColor(C.border).lineWidth(0.3).stroke();
        y += 22;
      });

      y += 10;
      const tx = M + W - 200;
      doc.fontSize(11).fillColor(C.dark);
      // Amounts stored in euros, use fe() not fc()
      doc.text("Total HT:", tx, y); doc.text(fe(quote.subtotal || 0), tx, y, { width: 150, align: "right" }); y += 16;
      
      // Check if VAT applies (taxAmount > 0 and taxRate > 0)
      const hasVat = (quote.taxAmount || 0) > 0 && (quote.taxRate || 0) > 0;
      if (hasVat) {
        doc.text(`TVA (${quote.taxRate}%):`, tx, y); doc.text(fe(quote.taxAmount || 0), tx, y, { width: 150, align: "right" }); y += 16;
      } else {
        doc.text("TVA non applicable - art. 293B CGI", tx, y); y += 16;
      }
      
      doc.font("Helvetica-Bold").fontSize(12);
      doc.text("Total TTC:", tx, y); doc.text(fe(quote.total || 0), tx, y, { width: 150, align: "right" });
      y += 30;

      doc.font("Helvetica").fontSize(9).fillColor(C.gray);
      doc.text("Conditions: Devis valable jusqu'a la date indiquee. Paiement sous 30 jours par virement ou mandat administratif.", M, y, { width: W });

      doc.end();
    } catch (e) { reject(e); }
  });
}

export async function generateInvoicePdf(invoice: InvoiceWithLineItems): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = initDoc();
      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      drawBrandHeader(doc);
      drawDocTitle(doc, "FACTURE", invoice.invoiceNumber, fd(invoice.createdAt));

      let y = 130;
      const hw = W / 2 - 10;

      let sy = drawSection(doc, M, y, hw, "Fournisseur");
      doc.font("Helvetica-Bold").fontSize(11).fillColor(C.dark).text(invoice.emitterName || "Voxpopulous", M, sy);
      doc.font("Helvetica").fontSize(10).fillColor(C.gray);
      if (invoice.emitterSiret) doc.text(`SIRET: ${invoice.emitterSiret}`, M, sy + 14);
      if (invoice.emitterTva) doc.text(`TVA: ${invoice.emitterTva}`, M, sy + 26);

      sy = drawSection(doc, M + hw + 20, y, hw, "Client");
      doc.font("Helvetica-Bold").fontSize(11).fillColor(C.dark).text(invoice.clientName || "", M + hw + 20, sy);
      doc.font("Helvetica").fontSize(10).fillColor(C.gray);
      if (invoice.clientSiret) doc.text(`SIRET: ${invoice.clientSiret}`, M + hw + 20, sy + 14);
      if (invoice.clientEmail) doc.text(invoice.clientEmail, M + hw + 20, sy + 26);

      y += 70;

      const st: Record<string, string> = { DRAFT: "Brouillon", SENT: "Envoyee", PAID: "Payee", OVERDUE: "En retard", CANCELLED: "Annulee" };
      doc.font("Helvetica").fontSize(10).fillColor(C.gray);
      doc.text(`Statut: ${st[invoice.status] || invoice.status}  |  Echeance: ${fd(invoice.dueDate)}`, M, y);
      y += 20;

      doc.rect(M, y, W, 22).fillColor(C.light).fill();
      doc.font("Helvetica-Bold").fontSize(10).fillColor(C.dark);
      doc.text("Description", M + 8, y + 6, { width: 260 });
      doc.text("Qte", M + 280, y + 6, { width: 40, align: "center" });
      doc.text("Prix unit. HT", M + 330, y + 6, { width: 80, align: "right" });
      doc.text("Total HT", M + 420, y + 6, { width: 70, align: "right" });
      y += 22;

      const items = (invoice.lineItems || []).slice(0, 6);
      doc.font("Helvetica").fontSize(10);
      items.forEach((it) => {
        doc.fillColor(C.dark).text(it.description || "", M + 8, y + 5, { width: 260 });
        doc.text(String(it.quantity || 1), M + 280, y + 5, { width: 40, align: "center" });
        doc.text(fe(it.unitPrice || 0), M + 330, y + 5, { width: 80, align: "right" });
        doc.text(fe(it.total || 0), M + 420, y + 5, { width: 70, align: "right" });
        doc.moveTo(M, y + 20).lineTo(PAGE_WIDTH - M, y + 20).strokeColor(C.border).lineWidth(0.3).stroke();
        y += 22;
      });

      y += 10;
      const tx = M + W - 200;
      doc.fontSize(11).fillColor(C.dark);
      doc.text("Total HT:", tx, y); doc.text(fe(invoice.subtotal || 0), tx, y, { width: 150, align: "right" }); y += 16;
      doc.text(`TVA (${invoice.taxRate || 20}%):`, tx, y); doc.text(fe(invoice.taxAmount || 0), tx, y, { width: 150, align: "right" }); y += 16;
      doc.font("Helvetica-Bold").fontSize(12);
      doc.text("Total TTC:", tx, y); doc.text(fe(invoice.total || 0), tx, y, { width: 150, align: "right" });
      y += 30;

      doc.font("Helvetica").fontSize(9).fillColor(C.gray);
      doc.text("Paiement par virement bancaire ou mandat administratif. Delai: 30 jours.", M, y, { width: W });

      doc.end();
    } catch (e) { reject(e); }
  });
}

export async function generateMandateOrderPdf(order: MandateOrderWithPlan, settings?: CompanySettings): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = initDoc();
      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      drawBrandHeader(doc);
      const { title, number } = getDocumentTitleAndNumber(order);
      drawDocTitle(doc, title, number, fd(order.createdAt));

      let y = 130;
      const hw = W / 2 - 10;

      let sy = drawSection(doc, M, y, hw, "Fournisseur");
      doc.font("Helvetica-Bold").fontSize(11).fillColor(C.dark).text(settings?.companyName || "Voxpopulous SAS", M, sy);
      doc.font("Helvetica").fontSize(10).fillColor(C.gray);
      let lineOff = 14;
      if (settings?.address) { doc.text(settings.address, M, sy + lineOff, { width: hw }); lineOff += 26; }
      const siretSiren = [settings?.siret ? `SIRET: ${settings.siret}` : null, settings?.siren ? `SIREN: ${settings.siren}` : null].filter(Boolean).join(" | ") || "SIRET: A completer";
      doc.text(siretSiren, M, sy + lineOff); lineOff += 12;
      doc.text(settings?.tvaNumber ? `TVA: ${settings.tvaNumber}` : "TVA: A completer", M, sy + lineOff);

      sy = drawSection(doc, M + hw + 20, y, hw, "Client");
      doc.font("Helvetica-Bold").fontSize(11).fillColor(C.dark).text(order.clientName, M + hw + 20, sy, { width: hw });
      doc.font("Helvetica").fontSize(10).fillColor(C.gray);
      let clientLineOff = 14;
      if (order.clientAddress) { doc.text(order.clientAddress.substring(0, 45), M + hw + 20, sy + clientLineOff, { width: hw }); clientLineOff += 12; }
      if (order.billingService) { doc.text(`Service: ${order.billingService.substring(0, 35)}`, M + hw + 20, sy + clientLineOff, { width: hw }); clientLineOff += 12; }
      doc.text(`SIRET: ${order.clientSiret}`, M + hw + 20, sy + clientLineOff);

      y += 90;

      const refs: string[] = [];
      if (order.purchaseOrderNumber) refs.push(`BC Client: ${order.purchaseOrderNumber}`);
      if (order.engagementNumber) refs.push(`N° Engagement: ${order.engagementNumber}`);
      if (order.serviceCode) refs.push(`Code Service: ${order.serviceCode}`);
      if (order.useChorusPro) refs.push("Chorus Pro: Oui");

      doc.rect(M, y, W, refs.length > 0 ? 38 : 24).fillColor("#e0f2fe").fill();
      doc.rect(M, y, W, refs.length > 0 ? 38 : 24).strokeColor("#0284c7").lineWidth(1).stroke();
      doc.font("Helvetica-Bold").fontSize(10).fillColor("#0369a1").text("References administratives (Chorus Pro)", M + 8, y + 6);
      if (refs.length > 0) {
        doc.font("Helvetica").fontSize(9).fillColor(C.dark).text(refs.join("  |  "), M + 8, y + 22, { width: W - 16 });
        y += 48;
      } else {
        y += 34;
      }

      doc.rect(M, y, W, 22).fillColor(C.light).fill();
      doc.font("Helvetica-Bold").fontSize(10).fillColor(C.dark);
      doc.text("Designation", M + 8, y + 6, { width: 280 });
      doc.text("Montant HT", M + 380, y + 6, { width: 60, align: "right" });
      doc.text("Total", M + 450, y + 6, { width: 55, align: "right" });
      y += 22;

      const tenantTypeLabel = order.tenantType === "MAIRIE" ? "Mairie" : order.tenantType === "EPCI" ? "EPCI" : order.tenantType === "ASSOCIATION" ? "Association" : "";
      const planFeatures: string[] = [];
      if (order.plan?.hasIdeas) planFeatures.push("Boite a idees");
      if (order.plan?.hasIncidents) planFeatures.push("Signalements");
      if (order.plan?.hasMeetings) planFeatures.push("Reunions publiques");
      
      doc.font("Helvetica-Bold").fontSize(11).fillColor(C.dark);
      doc.text(`${order.plan?.name || "Abonnement"} - Forfait ${tenantTypeLabel}`, M + 8, y + 5, { width: 340 });
      doc.font("Helvetica").fontSize(9).fillColor(C.gray);
      const featuresText = planFeatures.length > 0 ? `Inclus: ${planFeatures.join(", ")}` : "Plateforme de participation citoyenne";
      doc.text(featuresText, M + 8, y + 18, { width: 340 });
      // Use planAmount for the base plan, fallback to annualAmount for older orders without planAmount
      // All amounts are stored in euros, no conversion needed
      const basePlanAmount = order.planAmount || order.annualAmount || 0;
      doc.fillColor(C.dark).fontSize(10);
      doc.text(fe(basePlanAmount), M + 380, y + 10, { width: 60, align: "right" });
      doc.text(fe(basePlanAmount), M + 450, y + 10, { width: 55, align: "right" });
      doc.moveTo(M, y + 32).lineTo(PAGE_WIDTH - M, y + 32).strokeColor(C.border).lineWidth(0.3).stroke();
      y += 36;

      // Calculate addons total for display - parse from addonsSnapshot
      let addonsTotal = 0;
      const orderAddons: Array<{id: string; code: string; name: string; quantity: number; unitPrice: number; totalPrice: number}> = [];
      if (order.addonsSnapshot) {
        try {
          const parsed = JSON.parse(order.addonsSnapshot);
          if (Array.isArray(parsed)) orderAddons.push(...parsed);
        } catch {}
      }
      if (orderAddons.length > 0) {
        for (const addon of orderAddons) {
          doc.font("Helvetica").fontSize(10).fillColor(C.dark);
          doc.text(`Option: ${addon.name} x${addon.quantity}`, M + 8, y + 5, { width: 340 });
          const addonPrice = addon.totalPrice; // totalPrice is in euros
          addonsTotal += addonPrice;
          doc.text(fe(addonPrice), M + 380, y + 5, { width: 60, align: "right" });
          doc.text(fe(addonPrice), M + 450, y + 5, { width: 55, align: "right" });
          doc.moveTo(M, y + 18).lineTo(PAGE_WIDTH - M, y + 18).strokeColor(C.border).lineWidth(0.3).stroke();
          y += 22;
        }
      }

      // Total HT = base plan + addons (all in euros) - prices already include any discounts
      const totalHT = basePlanAmount + addonsTotal;
      const tx = M + W - 200;
      doc.fontSize(11).fillColor(C.dark);
      doc.text("Total HT:", tx, y); doc.text(fe(totalHT), tx, y, { width: 190, align: "right" }); y += 16;
      
      doc.font("Helvetica").fontSize(9).fillColor(C.gray);
      doc.text("TVA non applicable - art. 293B CGI", tx, y);
      doc.fontSize(11).fillColor(C.dark).text(fe(0), tx, y, { width: 190, align: "right" }); y += 18;
      
      // Total TTC equals Total HT (prices already include discounts, no VAT)
      doc.font("Helvetica-Bold").fontSize(13);
      doc.text("TOTAL TTC:", tx, y); doc.text(fe(totalHT), tx, y, { width: 190, align: "right" });
      y += 30;

      const bankIban = settings?.iban;
      const bankBic = settings?.bic;
      if (bankIban || bankBic) {
        doc.font("Helvetica-Bold").fontSize(10).fillColor(C.dark).text("Coordonnees bancaires", M, y);
        y += 14;
        doc.font("Helvetica").fontSize(10).fillColor(C.gray);
        const bankInfo = [bankIban ? `IBAN: ${bankIban}` : null, bankBic ? `BIC: ${bankBic}` : null].filter(Boolean).join("  |  ");
        doc.text(bankInfo, M, y);
        y += 20;
      }

      doc.font("Helvetica-Bold").fontSize(10).fillColor(C.dark).text("Modalites de paiement", M, y);
      y += 14;
      doc.font("Helvetica").fontSize(10).fillColor(C.gray);
      doc.text(settings?.paymentTerms || "Paiement par mandat administratif. Delai: 30 jours a compter de la reception de la facture.", M, y, { width: W });
      
      const orderContactEmail = settings?.email;
      const orderContactPhone = settings?.phone;
      if (orderContactEmail || orderContactPhone) {
        y += 25;
        doc.font("Helvetica-Bold").fontSize(10).fillColor(C.dark).text("Contact", M, y);
        y += 14;
        doc.font("Helvetica").fontSize(10).fillColor(C.gray);
        const orderContactInfo = [orderContactEmail ? `Email: ${orderContactEmail}` : null, orderContactPhone ? `Tel: ${orderContactPhone}` : null].filter(Boolean).join("  |  ");
        doc.text(orderContactInfo, M, y);
      }
      
      if (settings?.legalMentions) {
        y += 25;
        doc.font("Helvetica").fontSize(8).fillColor(C.gray);
        doc.text(settings.legalMentions, M, y, { width: W });
      }

      doc.end();
    } catch (e) { reject(e); }
  });
}

export async function generateMandateInvoicePdf(invoice: MandateInvoiceWithOrder, settings?: CompanySettings): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = initDoc();
      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      drawBrandHeader(doc);
      drawDocTitle(doc, "FACTURE", invoice.invoiceNumber, fd(invoice.createdAt));

      let y = 130;
      const hw = W / 2 - 10;

      let sy = drawSection(doc, M, y, hw, "Fournisseur");
      const emitterName = invoice.emitterName || settings?.companyName || "Voxpopulous SAS";
      const emitterAddress = settings?.address;
      const emitterSiret = invoice.emitterSiret || settings?.siret;
      const emitterSiren = settings?.siren;
      const emitterTva = invoice.emitterTva || settings?.tvaNumber;
      
      doc.font("Helvetica-Bold").fontSize(11).fillColor(C.dark).text(emitterName, M, sy);
      doc.font("Helvetica").fontSize(10).fillColor(C.gray);
      let lineOffset = 14;
      if (emitterAddress) { doc.text(emitterAddress, M, sy + lineOffset, { width: hw }); lineOffset += 26; }
      const siretSiren = [emitterSiret ? `SIRET: ${emitterSiret}` : null, emitterSiren ? `SIREN: ${emitterSiren}` : null].filter(Boolean).join(" | ");
      if (siretSiren) { doc.text(siretSiren, M, sy + lineOffset); lineOffset += 12; }
      if (emitterTva) { doc.text(`TVA: ${emitterTva}`, M, sy + lineOffset); }

      sy = drawSection(doc, M + hw + 20, y, hw, "Client");
      doc.font("Helvetica-Bold").fontSize(11).fillColor(C.dark).text(invoice.clientName, M + hw + 20, sy, { width: hw });
      doc.font("Helvetica").fontSize(10).fillColor(C.gray);
      let invClientLineOff = 14;
      if (invoice.clientAddress) { doc.text(invoice.clientAddress.substring(0, 45), M + hw + 20, sy + invClientLineOff, { width: hw }); invClientLineOff += 12; }
      if (invoice.billingService) { doc.text(`Service: ${invoice.billingService.substring(0, 35)}`, M + hw + 20, sy + invClientLineOff, { width: hw }); invClientLineOff += 12; }
      doc.text(`SIRET: ${invoice.clientSiret}`, M + hw + 20, sy + invClientLineOff);

      y += 90;

      const refs: string[] = [];
      if (invoice.purchaseOrderNumber) refs.push(`BC: ${invoice.purchaseOrderNumber}`);
      if (invoice.engagementNumber) refs.push(`Engagement: ${invoice.engagementNumber}`);
      if (invoice.serviceCode) refs.push(`Service: ${invoice.serviceCode}`);

      const boxHeight = refs.length > 0 ? 50 : 36;
      doc.rect(M, y, W, boxHeight).fillColor("#e0f2fe").fill();
      doc.rect(M, y, W, boxHeight).strokeColor("#0284c7").lineWidth(1).stroke();
      doc.font("Helvetica-Bold").fontSize(10).fillColor("#0369a1").text("References administratives (Chorus Pro)", M + 8, y + 6);
      if (refs.length > 0) {
        doc.font("Helvetica").fontSize(9).fillColor(C.dark).text(refs.join("  |  "), M + 8, y + 20, { width: W - 16 });
      }
      doc.font("Helvetica").fontSize(9).fillColor(C.dark).text(`Periode: ${fd(invoice.periodStart)} au ${fd(invoice.periodEnd)}  |  Echeance: ${fd(invoice.dueDate)}`, M + 8, y + (refs.length > 0 ? 34 : 20), { width: W - 16 });
      y += boxHeight + 10;

      doc.rect(M, y, W, 22).fillColor(C.light).fill();
      doc.font("Helvetica-Bold").fontSize(10).fillColor(C.dark);
      doc.text("Designation", M + 8, y + 6, { width: 280 });
      doc.text("Montant HT", M + 380, y + 6, { width: 60, align: "right" });
      doc.text("Total", M + 450, y + 6, { width: 55, align: "right" });
      y += 22;

      const invTenantTypeLabel = invoice.tenantType === "MAIRIE" ? "Mairie" : invoice.tenantType === "EPCI" ? "EPCI" : invoice.tenantType === "ASSOCIATION" ? "Association" : "";
      const invPlanFeatures: string[] = [];
      if (invoice.plan?.hasIdeas) invPlanFeatures.push("Boite a idees");
      if (invoice.plan?.hasIncidents) invPlanFeatures.push("Signalements");
      if (invoice.plan?.hasMeetings) invPlanFeatures.push("Reunions publiques");
      
      doc.font("Helvetica-Bold").fontSize(11).fillColor(C.dark);
      doc.text(`${invoice.plan?.name || "Abonnement"} - Forfait ${invTenantTypeLabel}`, M + 8, y + 5, { width: 340 });
      doc.font("Helvetica").fontSize(9).fillColor(C.gray);
      const invFeaturesText = invPlanFeatures.length > 0 ? `Inclus: ${invPlanFeatures.join(", ")}` : "Plateforme de participation citoyenne";
      doc.text(invFeaturesText, M + 8, y + 18, { width: 340 });
      // Use planAmount for base plan, fallback to subtotal for older invoices
      // All amounts are stored in euros, no conversion needed
      const invBasePlanAmount = invoice.planAmount || invoice.subtotal || 0;
      doc.fillColor(C.dark).fontSize(10);
      doc.text(fe(invBasePlanAmount), M + 380, y + 10, { width: 60, align: "right" });
      doc.text(fe(invBasePlanAmount), M + 450, y + 10, { width: 55, align: "right" });
      doc.moveTo(M, y + 32).lineTo(PAGE_WIDTH - M, y + 32).strokeColor(C.border).lineWidth(0.3).stroke();
      y += 36;

      // Calculate addons total for display - parse from addonsSnapshot
      let invAddonsTotal = 0;
      const invoiceAddons: Array<{id: string; code: string; name: string; quantity: number; unitPrice: number; totalPrice: number}> = [];
      if (invoice.addonsSnapshot) {
        try {
          const parsed = JSON.parse(invoice.addonsSnapshot);
          if (Array.isArray(parsed)) invoiceAddons.push(...parsed);
        } catch {}
      }
      if (invoiceAddons.length > 0) {
        for (const addon of invoiceAddons) {
          doc.font("Helvetica").fontSize(10).fillColor(C.dark);
          doc.text(`Option: ${addon.name} x${addon.quantity}`, M + 8, y + 5, { width: 340 });
          const addonPrice = addon.totalPrice; // totalPrice is in euros
          invAddonsTotal += addonPrice;
          doc.text(fe(addonPrice), M + 380, y + 5, { width: 60, align: "right" });
          doc.text(fe(addonPrice), M + 450, y + 5, { width: 55, align: "right" });
          doc.moveTo(M, y + 18).lineTo(PAGE_WIDTH - M, y + 18).strokeColor(C.border).lineWidth(0.3).stroke();
          y += 22;
        }
      }

      // Total HT = base plan + addons (all in euros) - prices already include any discounts
      const invTotalHT = invBasePlanAmount + invAddonsTotal;
      const tx = M + W - 200;
      doc.fontSize(11).fillColor(C.dark);
      doc.text("Sous-total HT:", tx, y); doc.text(fe(invTotalHT), tx, y, { width: 190, align: "right" }); y += 16;
      
      doc.font("Helvetica").fontSize(9).fillColor(C.gray);
      doc.text("TVA non applicable - art. 293B CGI", tx, y);
      doc.fontSize(11).fillColor(C.dark).text(fe(invoice.taxAmount || 0), tx, y, { width: 190, align: "right" }); y += 18;
      
      // Total TTC equals Total HT (prices already include discounts)
      doc.font("Helvetica-Bold").fontSize(13);
      doc.text("TOTAL TTC:", tx, y); doc.text(fe(invTotalHT), tx, y, { width: 190, align: "right" });
      y += 30;

      const bankIban = invoice.emitterIban || settings?.iban;
      const bankBic = invoice.emitterBic || settings?.bic;
      
      if (bankIban || bankBic) {
        doc.font("Helvetica-Bold").fontSize(10).fillColor(C.dark).text("Coordonnees bancaires", M, y);
        y += 14;
        doc.font("Helvetica").fontSize(10).fillColor(C.gray);
        const bankInfo = [bankIban ? `IBAN: ${bankIban}` : null, bankBic ? `BIC: ${bankBic}` : null].filter(Boolean).join("  |  ");
        doc.text(bankInfo, M, y);
        y += 20;
      }

      doc.font("Helvetica-Bold").fontSize(10).fillColor(C.dark).text("Modalites de paiement", M, y);
      y += 14;
      doc.font("Helvetica").fontSize(10).fillColor(C.gray);
      doc.text(settings?.paymentTerms || "Paiement par mandat administratif ou virement bancaire. Delai: 30 jours.", M, y, { width: W });
      
      const contactEmail = settings?.email;
      const contactPhone = settings?.phone;
      if (contactEmail || contactPhone) {
        y += 25;
        doc.font("Helvetica-Bold").fontSize(10).fillColor(C.dark).text("Contact", M, y);
        y += 14;
        doc.font("Helvetica").fontSize(10).fillColor(C.gray);
        const contactInfo = [contactEmail ? `Email: ${contactEmail}` : null, contactPhone ? `Tel: ${contactPhone}` : null].filter(Boolean).join("  |  ");
        doc.text(contactInfo, M, y);
      }
      
      if (settings?.legalMentions) {
        y += 25;
        doc.font("Helvetica").fontSize(8).fillColor(C.gray);
        doc.text(settings.legalMentions, M, y, { width: W });
      }

      doc.end();
    } catch (e) { reject(e); }
  });
}
