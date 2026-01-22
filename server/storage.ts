import crypto from "crypto";
import { 
  type Tenant, type InsertTenant,
  type User, type InsertUser,
  type Lead, type InsertLead,
  type LeadMessage, type InsertLeadMessage,
  type Idea, type InsertIdea,
  type IdeaVote,
  type Incident, type InsertIncident,
  type Meeting, type InsertMeeting,
  type MeetingIdea,
  type MeetingRegistration, type InsertMeetingRegistration,
  type Superadmin, type InsertSuperadmin,
  type SuperadminSettings,
  type CompanySettings, type InsertCompanySettings,
  type SubscriptionPlan, type InsertSubscriptionPlan,
  type PlanFeature, type InsertPlanFeature,
  type Feature, type InsertFeature,
  type PlanFeatureAssignment, type InsertPlanFeatureAssignment,
  type Addon, type InsertAddon,
  type PlanAddonAccess, type InsertPlanAddonAccess,
  type TenantAddon, type InsertTenantAddon,
  type TenantBillingChange, type InsertTenantBillingChange,
  type BillingLedgerEntry, type InsertBillingLedgerEntry,
  type TenantBillingPreferences, type InsertTenantBillingPreferences,
  type Association, type InsertAssociation,
  type AssociationUser, type InsertAssociationUser,
  type AssociationIdea, type InsertAssociationIdea,
  type AssociationIdeaVote,
  type AssociationIncident, type InsertAssociationIncident,
  type AssociationMeeting, type InsertAssociationMeeting,
  type AssociationMeetingRegistration, type InsertAssociationMeetingRegistration,
  type BureauMember, type InsertBureauMember,
  type ElectedOfficial, type InsertElectedOfficial,
  type TenantPhoto, type InsertTenantPhoto,
  type AssociationPhoto, type InsertAssociationPhoto,
  type TenantEvent, type InsertTenantEvent,
  type AssociationEvent, type InsertAssociationEvent,
  type Product, type InsertProduct,
  type Quote, type InsertQuote,
  type QuoteLineItem, type InsertQuoteLineItem,
  type Invoice, type InsertInvoice,
  type InvoiceLineItem, type InsertInvoiceLineItem,
  type Payment, type InsertPayment,
  type TenantFeatureOverride,
  type TenantInterventionDomain, type InsertTenantInterventionDomain,
  type AssociationInterventionDomain, type InsertAssociationInterventionDomain,
  type ElectedOfficialDomain,
  type BureauMemberDomain,
  type ElectedOfficialMenuPermission,
  type AdminMenuCode,
  type MandateOrder, type InsertMandateOrder,
  type MandateSubscription, type InsertMandateSubscription,
  type MandateDocument, type InsertMandateDocument,
  type MandateInvoice, type InsertMandateInvoice,
  type MandateActivity, type InsertMandateActivity,
  type MandateReminder, type InsertMandateReminder,
  type SubscriptionReminder, type InsertSubscriptionReminder,
  type InvoiceSequence, type InsertInvoiceSequence,
  type LegalEntitySettings, type InsertLegalEntitySettings,
  type AuditLog, type InsertAuditLog,
  type DocumentNumberFormat, type InsertDocumentNumberFormat,
  type ServiceCode, type InsertServiceCode,
  type TenantServiceCode, type InsertTenantServiceCode,
  type TenantDocumentNumberingConfig, type InsertTenantDocumentNumberingConfig,
  type EluFunction, type InsertEluFunction,
  type BureauMemberFunction, type InsertBureauMemberFunction,
  type GlobalMunicipalityDomain, type InsertGlobalMunicipalityDomain,
  type GlobalAssociationDomain, type InsertGlobalAssociationDomain,
  type GlobalEventType, type InsertGlobalEventType,
  type TenantEventImage, type InsertTenantEventImage,
  type AssociationEventImage, type InsertAssociationEventImage,
  type TenantEventRegistration, type InsertTenantEventRegistration,
  type TenantEventIdea, type InsertTenantEventIdea,
  type ChatThread, type InsertChatThread,
  type ChatMessage, type InsertChatMessage,
  type ActivityLog, type InsertActivityLog,
  type BlockedDevice, type InsertBlockedDevice,
  tenants, users, leads, leadMessages, ideas, ideaVotes, incidents, meetings, meetingIdeas, meetingRegistrations, superadmins, superadminSettings, companySettings,
  subscriptionPlans, planFeatures, features, planFeatureAssignments, addons, planAddonAccess, tenantAddons, tenantFeatureOverrides, associations, associationUsers, 
  associationIdeas, associationIdeaVotes, associationIncidents, associationMeetings, associationMeetingRegistrations, bureauMembers, tenantElectedOfficials,
  tenantPhotos, associationPhotos,
  products, quotes, quoteLineItems, invoices, invoiceLineItems, payments,
  tenantInterventionDomains, associationInterventionDomains, electedOfficialDomains, bureauMemberDomains,
  electedOfficialMenuPermissions, passwordResetTokens,
  tenantBillingChanges, billingLedgerEntries, tenantBillingPreferences,
  mandateOrders, mandateSubscriptions, mandateDocuments, mandateInvoices, mandateActivities, mandateReminders, subscriptionReminders, invoiceSequences,
  auditLogs,
  documentNumberFormats, serviceCodes, tenantServiceCodes, tenantDocumentNumberingConfig,
  legalEntitySettings, eluFunctions, bureauMemberFunctions,
  globalMunicipalityDomains, globalAssociationDomains, globalEventTypes,
  chatThreads, chatMessages,
  activityLogs, blockedDevices,
  tenantEvents, associationEvents,
  tenantEventImages, associationEventImages, tenantEventRegistrations, associationEventRegistrations, tenantEventIdeas,
  InsertAssociationEventRegistration, AssociationEventRegistration
} from "@shared/schema";
import { db } from "./db";
import { eq, and, sql, desc, asc, gte, count } from "drizzle-orm";

export interface IStorage {
  getTenantBySlug(slug: string): Promise<Tenant | undefined>;
  getTenantById(id: string): Promise<Tenant | undefined>;
  createTenant(tenant: InsertTenant): Promise<Tenant>;
  
  getUserById(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByEmailAndTenant(email: string, tenantId: string): Promise<User | undefined>;
  getUsersByTenantId(tenantId: string): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUserPassword(userId: string, passwordHash: string): Promise<User | undefined>;
  
  createLead(lead: InsertLead): Promise<Lead>;
  getLeadById(id: string): Promise<Lead | undefined>;
  
  getIdeasByTenant(tenantId: string, includeArchived?: boolean): Promise<Idea[]>;
  getIdeaById(id: string): Promise<Idea | undefined>;
  getIdeaByToken(token: string): Promise<Idea | undefined>;
  createIdea(idea: InsertIdea & { tenantId: string; publicToken: string }): Promise<Idea>;
  updateIdeaStatus(id: string, status: string): Promise<Idea | undefined>;
  setIdeaArchived(id: string, isArchived: boolean): Promise<Idea | undefined>;
  incrementIdeaVotes(id: string): Promise<void>;
  
  getIdeaVoteByIp(ideaId: string, voterIp: string): Promise<IdeaVote | undefined>;
  createIdeaVote(ideaId: string, voterIp: string): Promise<IdeaVote>;
  
  getIncidentsByTenant(tenantId: string, includeArchived?: boolean): Promise<Incident[]>;
  getIncidentById(id: string): Promise<Incident | undefined>;
  getIncidentByToken(token: string): Promise<Incident | undefined>;
  createIncident(incident: InsertIncident & { tenantId: string; publicToken: string }): Promise<Incident>;
  updateIncidentStatus(id: string, status: string): Promise<Incident | undefined>;
  setIncidentArchived(id: string, isArchived: boolean): Promise<Incident | undefined>;
  
  getIdeasByAnonymousId(tenantId: string, anonymousId: string): Promise<Idea[]>;
  getIncidentsByAnonymousId(tenantId: string, anonymousId: string): Promise<Incident[]>;
  
  getMeetingsByTenant(tenantId: string, includeArchived?: boolean): Promise<(Meeting & { registrationsCount: number })[]>;
  getMeetingById(id: string): Promise<(Meeting & { registrationsCount: number; ideas: Idea[]; registrations: MeetingRegistration[] }) | undefined>;
  createMeeting(meeting: InsertMeeting & { tenantId: string }): Promise<Meeting>;
  updateMeetingStatus(id: string, status: string): Promise<Meeting | undefined>;
  setMeetingArchived(id: string, isArchived: boolean): Promise<Meeting | undefined>;
  
  getMeetingRegistrations(meetingId: string): Promise<MeetingRegistration[]>;
  createMeetingRegistration(reg: InsertMeetingRegistration & { meetingId: string }): Promise<MeetingRegistration>;
  
  getTenantEvents(tenantId: string, includeArchived?: boolean): Promise<TenantEvent[]>;
  getTenantEventById(id: string): Promise<TenantEvent | undefined>;
  createTenantEvent(event: InsertTenantEvent & { tenantId: string }): Promise<TenantEvent>;
  updateTenantEvent(id: string, event: Partial<InsertTenantEvent>): Promise<TenantEvent | undefined>;
  setTenantEventArchived(id: string, isArchived: boolean): Promise<TenantEvent | undefined>;
  
  getAssociationEvents(associationId: string, includeArchived?: boolean): Promise<AssociationEvent[]>;
  getAssociationEventById(id: string): Promise<AssociationEvent | undefined>;
  createAssociationEvent(event: InsertAssociationEvent & { associationId: string }): Promise<AssociationEvent>;
  updateAssociationEvent(id: string, event: Partial<InsertAssociationEvent>): Promise<AssociationEvent | undefined>;
  setAssociationEventArchived(id: string, isArchived: boolean): Promise<AssociationEvent | undefined>;
  
  getStats(tenantId: string): Promise<{
    ideas: { total: number; new: number };
    incidents: { total: number; new: number };
    meetings: { total: number; upcoming: number };
  }>;
  
  updateTenantStripeInfo(tenantId: string, stripeInfo: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    stripeDefaultPaymentMethodId?: string;
    stripeSetupIntentId?: string;
  }): Promise<Tenant | undefined>;
  
  updateTenantBillingStatus(tenantId: string, status: string, plan?: string): Promise<Tenant | undefined>;
  
  updateTenantSettings(tenantId: string, settings: {
    presentationText?: string;
    logoUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
    backgroundColor?: string;
  }): Promise<Tenant | undefined>;
  
  getTenantByStripeCustomerId(customerId: string): Promise<Tenant | undefined>;
  
  getSuperadminByEmail(email: string): Promise<Superadmin | undefined>;
  getSuperadminById(id: string): Promise<Superadmin | undefined>;
  createSuperadmin(superadmin: InsertSuperadmin): Promise<Superadmin>;
  updateSuperadminLastLogin(id: string): Promise<void>;
  getAllSuperadmins(): Promise<Superadmin[]>;
  updateSuperadmin(id: string, data: { email?: string; name?: string; passwordHash?: string; isActive?: boolean }): Promise<Superadmin | undefined>;
  deleteSuperadmin(id: string): Promise<boolean>;
  getSuperadminSettings(): Promise<SuperadminSettings | undefined>;
  updateSuperadminSettings(themeKey: string): Promise<SuperadminSettings>;
  updateStripeMode(mode: 'test' | 'live'): Promise<SuperadminSettings>;
  
  getCompanySettings(): Promise<CompanySettings | undefined>;
  updateCompanySettings(data: Partial<InsertCompanySettings>): Promise<CompanySettings>;
  
  getLegalEntitySettings(): Promise<LegalEntitySettings | undefined>;
  updateLegalEntitySettings(data: Partial<InsertLegalEntitySettings>): Promise<LegalEntitySettings>;
  
  getAllTenants(): Promise<Tenant[]>;
  getAllLeads(): Promise<Lead[]>;
  updateLeadStatus(id: string, status: string): Promise<Lead | undefined>;
  deleteLead(id: string): Promise<boolean>;
  getLeadByPublicToken(token: string): Promise<Lead | undefined>;
  updateLeadPipelineStage(id: string, stage: string): Promise<Lead | undefined>;
  updateLead(id: string, data: Partial<Lead>): Promise<Lead | undefined>;
  getLeadMessages(leadId: string): Promise<LeadMessage[]>;
  createLeadMessage(message: InsertLeadMessage): Promise<LeadMessage>;
  markLeadMessagesAsRead(leadId: string, senderType: string): Promise<void>;
  getUnreadLeadMessageCount(leadId: string): Promise<number>;
  getQuotesByLeadId(leadId: string): Promise<Quote[]>;
  deleteTenant(id: string): Promise<boolean>;
  getGlobalStats(): Promise<{
    tenants: { total: number; trial: number; active: number; cancelled: number };
    leads: { total: number; new: number; converted: number };
  }>;
  
  updateTenantQuantities(tenantId: string, quantities: {
    purchasedCommunes?: number;
    purchasedAssociations?: number;
    purchasedAdmins?: number;
  }): Promise<Tenant | undefined>;
  
  createPasswordResetToken(data: {
    token: string;
    type: "ADMIN" | "ELU";
    userId?: string;
    electedOfficialId?: string;
    email: string;
    tenantId: string;
    expiresAt: Date;
  }): Promise<void>;
  getPasswordResetToken(token: string): Promise<{
    id: string;
    token: string;
    type: "ADMIN" | "ELU";
    userId: string | null;
    electedOfficialId: string | null;
    email: string;
    tenantId: string;
    expiresAt: Date;
    usedAt: Date | null;
    createdAt: Date;
  } | undefined>;
  markPasswordResetTokenUsed(token: string): Promise<void>;
  getElectedOfficialByEmailAndTenant(email: string, tenantId: string): Promise<ElectedOfficial | undefined>;
  
  // Billing management methods
  getTenantBillingInfo(tenantId: string): Promise<{
    tenant: Tenant;
    plan: SubscriptionPlan | null;
    addons: (TenantAddon & { addon: Addon })[];
    preferences: TenantBillingPreferences | null;
    pendingChanges: TenantBillingChange[];
    ledgerBalance: number;
  } | undefined>;
  getTenantBillingPreferences(tenantId: string): Promise<TenantBillingPreferences | undefined>;
  upsertTenantBillingPreferences(tenantId: string, prefs: Partial<InsertTenantBillingPreferences>): Promise<TenantBillingPreferences>;
  createBillingChange(change: InsertTenantBillingChange): Promise<TenantBillingChange>;
  getPendingBillingChanges(tenantId: string): Promise<TenantBillingChange[]>;
  getAllBillingChanges(tenantId: string): Promise<TenantBillingChange[]>;
  applyBillingChange(changeId: string): Promise<TenantBillingChange | undefined>;
  cancelBillingChange(changeId: string): Promise<TenantBillingChange | undefined>;
  createLedgerEntry(entry: InsertBillingLedgerEntry): Promise<BillingLedgerEntry>;
  getTenantLedgerBalance(tenantId: string): Promise<number>;
  getTenantLedgerEntries(tenantId: string): Promise<BillingLedgerEntry[]>;
  updateTenantPlan(tenantId: string, planId: string, billingInterval: "MONTHLY" | "YEARLY"): Promise<Tenant | undefined>;
  getTenantAddon(tenantId: string, addonId: string): Promise<TenantAddon | undefined>;
  upsertTenantAddon(tenantId: string, addonId: string, quantity: number): Promise<TenantAddon>;
  getAllAddons(): Promise<Addon[]>;
  
  // Tenant lifecycle management
  suspendTenant(tenantId: string, reason: string, suspendedBy: string): Promise<Tenant | undefined>;
  unsuspendTenant(tenantId: string): Promise<Tenant | undefined>;
  archiveTenant(tenantId: string, reason: string, archivedBy: string): Promise<Tenant | undefined>;
  setTenantFreeStatus(tenantId: string, isFree: boolean): Promise<Tenant | undefined>;
  getTenantsByLifecycleStatus(status: "ACTIVE" | "SUSPENDED" | "ARCHIVED"): Promise<Tenant[]>;
  deleteArchivedTenant(tenantId: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  async getTenantBySlug(slug: string): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, slug));
    return tenant || undefined;
  }

  async getTenantById(id: string): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id));
    return tenant || undefined;
  }

  async createTenant(tenant: InsertTenant): Promise<Tenant> {
    const [newTenant] = await db.insert(tenants).values(tenant).returning();
    return newTenant;
  }

  async getUserById(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async getUserByEmailAndTenant(email: string, tenantId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(
      and(eq(users.email, email), eq(users.tenantId, tenantId))
    );
    return user || undefined;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async getUsersByTenantId(tenantId: string): Promise<User[]> {
    return db.select().from(users)
      .where(eq(users.tenantId, tenantId))
      .orderBy(asc(users.createdAt));
  }

  async updateUserPassword(userId: string, passwordHash: string): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set({ passwordHash })
      .where(eq(users.id, userId))
      .returning();
    return updated || undefined;
  }

  async createLead(lead: InsertLead): Promise<Lead> {
    const [newLead] = await db.insert(leads).values(lead).returning();
    return newLead;
  }

  async getLeadById(id: string): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(eq(leads.id, id));
    return lead || undefined;
  }

  async getIdeasByTenant(tenantId: string, includeArchived: boolean = false): Promise<Idea[]> {
    const conditions = [eq(ideas.tenantId, tenantId)];
    if (!includeArchived) {
      conditions.push(eq(ideas.isArchived, false));
    }
    return db.select().from(ideas)
      .where(and(...conditions))
      .orderBy(desc(ideas.createdAt));
  }

  async getIdeaById(id: string): Promise<Idea | undefined> {
    const [idea] = await db.select().from(ideas).where(eq(ideas.id, id));
    return idea || undefined;
  }

  async getIdeaByToken(token: string): Promise<Idea | undefined> {
    const [idea] = await db.select().from(ideas).where(eq(ideas.publicToken, token));
    return idea || undefined;
  }

  async createIdea(idea: InsertIdea & { tenantId: string; publicToken: string }): Promise<Idea> {
    const [newIdea] = await db.insert(ideas).values({
      ...idea,
      status: "NEW",
      votesCount: 0,
    }).returning();
    return newIdea;
  }

  async updateIdeaStatus(id: string, status: string): Promise<Idea | undefined> {
    const [updated] = await db.update(ideas)
      .set({ status: status as any, updatedAt: new Date() })
      .where(eq(ideas.id, id))
      .returning();
    return updated || undefined;
  }

  async setIdeaArchived(id: string, isArchived: boolean): Promise<Idea | undefined> {
    const [updated] = await db.update(ideas)
      .set({ isArchived, updatedAt: new Date() })
      .where(eq(ideas.id, id))
      .returning();
    return updated || undefined;
  }

  async incrementIdeaVotes(id: string): Promise<void> {
    await db.update(ideas)
      .set({ votesCount: sql`${ideas.votesCount} + 1` })
      .where(eq(ideas.id, id));
  }

  async getIdeaVoteByVoter(ideaId: string, voterIp: string, anonymousVoterId?: string): Promise<IdeaVote | undefined> {
    // Try to find by anonymous voter ID first (more reliable), then by IP
    if (anonymousVoterId) {
      const [vote] = await db.select().from(ideaVotes)
        .where(and(eq(ideaVotes.ideaId, ideaId), eq(ideaVotes.anonymousVoterId, anonymousVoterId)));
      if (vote) return vote;
    }
    const [vote] = await db.select().from(ideaVotes)
      .where(and(eq(ideaVotes.ideaId, ideaId), eq(ideaVotes.voterIp, voterIp)));
    return vote || undefined;
  }

  async getIdeaVoteByIp(ideaId: string, voterIp: string): Promise<IdeaVote | undefined> {
    const [vote] = await db.select().from(ideaVotes)
      .where(and(eq(ideaVotes.ideaId, ideaId), eq(ideaVotes.voterIp, voterIp)));
    return vote || undefined;
  }

  async createIdeaVote(ideaId: string, voterIp: string, voteType: 'up' | 'down' = 'up', anonymousVoterId?: string): Promise<IdeaVote> {
    const [vote] = await db.insert(ideaVotes).values({
      ideaId,
      voterIp,
      voteType,
      anonymousVoterId,
    }).returning();
    
    // Update vote counts based on vote type
    if (voteType === 'up') {
      await db.update(ideas)
        .set({ 
          votesCount: sql`${ideas.votesCount} + 1`,
          upVotesCount: sql`${ideas.upVotesCount} + 1`
        })
        .where(eq(ideas.id, ideaId));
    } else {
      await db.update(ideas)
        .set({ 
          votesCount: sql`${ideas.votesCount} + 1`,
          downVotesCount: sql`${ideas.downVotesCount} + 1`
        })
        .where(eq(ideas.id, ideaId));
    }
    
    return vote;
  }

  async updateIdeaVote(voteId: string, ideaId: string, newVoteType: 'up' | 'down', oldVoteType: string): Promise<IdeaVote | undefined> {
    const [updatedVote] = await db.update(ideaVotes)
      .set({ voteType: newVoteType })
      .where(eq(ideaVotes.id, voteId))
      .returning();
    
    // Update counts: decrement old type, increment new type (prevent negative with GREATEST)
    if (oldVoteType === 'up' && newVoteType === 'down') {
      await db.update(ideas)
        .set({ 
          upVotesCount: sql`GREATEST(0, ${ideas.upVotesCount} - 1)`,
          downVotesCount: sql`${ideas.downVotesCount} + 1`
        })
        .where(eq(ideas.id, ideaId));
    } else if (oldVoteType === 'down' && newVoteType === 'up') {
      await db.update(ideas)
        .set({ 
          upVotesCount: sql`${ideas.upVotesCount} + 1`,
          downVotesCount: sql`GREATEST(0, ${ideas.downVotesCount} - 1)`
        })
        .where(eq(ideas.id, ideaId));
    }
    
    return updatedVote;
  }

  async removeIdeaVote(voteId: string, ideaId: string, voteType: string): Promise<void> {
    await db.delete(ideaVotes).where(eq(ideaVotes.id, voteId));
    
    // Decrement the appropriate count (prevent negative with GREATEST)
    if (voteType === 'up') {
      await db.update(ideas)
        .set({ 
          votesCount: sql`GREATEST(0, ${ideas.votesCount} - 1)`,
          upVotesCount: sql`GREATEST(0, ${ideas.upVotesCount} - 1)`
        })
        .where(eq(ideas.id, ideaId));
    } else {
      await db.update(ideas)
        .set({ 
          votesCount: sql`GREATEST(0, ${ideas.votesCount} - 1)`,
          downVotesCount: sql`GREATEST(0, ${ideas.downVotesCount} - 1)`
        })
        .where(eq(ideas.id, ideaId));
    }
  }

  async getIncidentsByTenant(tenantId: string, includeArchived: boolean = false): Promise<Incident[]> {
    const conditions = [eq(incidents.tenantId, tenantId)];
    if (!includeArchived) {
      conditions.push(eq(incidents.isArchived, false));
    }
    return db.select().from(incidents)
      .where(and(...conditions))
      .orderBy(desc(incidents.createdAt));
  }

  async getIncidentById(id: string): Promise<Incident | undefined> {
    const [incident] = await db.select().from(incidents).where(eq(incidents.id, id));
    return incident || undefined;
  }

  async getIncidentByToken(token: string): Promise<Incident | undefined> {
    const [incident] = await db.select().from(incidents).where(eq(incidents.publicToken, token));
    return incident || undefined;
  }

  async createIncident(incident: InsertIncident & { tenantId: string; publicToken: string }): Promise<Incident> {
    const [newIncident] = await db.insert(incidents).values({
      ...incident,
      status: "NEW",
    }).returning();
    return newIncident;
  }

  async updateIncidentStatus(id: string, status: string): Promise<Incident | undefined> {
    const [updated] = await db.update(incidents)
      .set({ status: status as any, updatedAt: new Date() })
      .where(eq(incidents.id, id))
      .returning();
    return updated || undefined;
  }

  async setIncidentArchived(id: string, isArchived: boolean): Promise<Incident | undefined> {
    const [updated] = await db.update(incidents)
      .set({ isArchived, updatedAt: new Date() })
      .where(eq(incidents.id, id))
      .returning();
    return updated || undefined;
  }

  async getIdeasByAnonymousId(tenantId: string, anonymousId: string): Promise<Idea[]> {
    return db.select().from(ideas)
      .where(and(eq(ideas.tenantId, tenantId), eq(ideas.anonymousSubmitterId, anonymousId)))
      .orderBy(desc(ideas.createdAt));
  }

  async getIncidentsByAnonymousId(tenantId: string, anonymousId: string): Promise<Incident[]> {
    return db.select().from(incidents)
      .where(and(eq(incidents.tenantId, tenantId), eq(incidents.anonymousSubmitterId, anonymousId)))
      .orderBy(desc(incidents.createdAt));
  }

  async getMeetingsByTenant(tenantId: string, includeArchived: boolean = false): Promise<(Meeting & { registrationsCount: number })[]> {
    const conditions = [eq(meetings.tenantId, tenantId)];
    if (!includeArchived) {
      conditions.push(eq(meetings.isArchived, false));
    }
    const meetingsList = await db.select().from(meetings)
      .where(and(...conditions))
      .orderBy(asc(meetings.dateTime));
    
    const result = await Promise.all(meetingsList.map(async (meeting) => {
      const regs = await db.select({ count: count() }).from(meetingRegistrations)
        .where(eq(meetingRegistrations.meetingId, meeting.id));
      return {
        ...meeting,
        registrationsCount: regs[0]?.count || 0,
      };
    }));
    
    return result;
  }

  async getMeetingById(id: string): Promise<(Meeting & { registrationsCount: number; ideas: Idea[]; registrations: MeetingRegistration[] }) | undefined> {
    const [meeting] = await db.select().from(meetings).where(eq(meetings.id, id));
    if (!meeting) return undefined;

    const meetingIdeaLinks = await db.select().from(meetingIdeas)
      .where(eq(meetingIdeas.meetingId, id));
    
    const linkedIdeas: Idea[] = [];
    for (const link of meetingIdeaLinks) {
      const [idea] = await db.select().from(ideas).where(eq(ideas.id, link.ideaId));
      if (idea) linkedIdeas.push(idea);
    }

    const registrations = await db.select().from(meetingRegistrations)
      .where(eq(meetingRegistrations.meetingId, id));

    return {
      ...meeting,
      registrationsCount: registrations.length,
      ideas: linkedIdeas,
      registrations,
    };
  }

  async createMeeting(meeting: InsertMeeting & { tenantId: string }): Promise<Meeting> {
    const [newMeeting] = await db.insert(meetings).values({
      ...meeting,
      status: meeting.status || "SCHEDULED",
    }).returning();
    return newMeeting;
  }

  async updateMeetingStatus(id: string, status: string): Promise<Meeting | undefined> {
    const [updated] = await db.update(meetings)
      .set({ status: status as any, updatedAt: new Date() })
      .where(eq(meetings.id, id))
      .returning();
    return updated || undefined;
  }

  async setMeetingArchived(id: string, isArchived: boolean): Promise<Meeting | undefined> {
    const [updated] = await db.update(meetings)
      .set({ isArchived, updatedAt: new Date() })
      .where(eq(meetings.id, id))
      .returning();
    return updated || undefined;
  }

  async getMeetingRegistrations(meetingId: string): Promise<MeetingRegistration[]> {
    return db.select().from(meetingRegistrations)
      .where(eq(meetingRegistrations.meetingId, meetingId));
  }

  async createMeetingRegistration(reg: InsertMeetingRegistration & { meetingId: string }): Promise<MeetingRegistration> {
    const [newReg] = await db.insert(meetingRegistrations).values(reg).returning();
    return newReg;
  }

  async getTenantEvents(tenantId: string, includeArchived: boolean = false): Promise<TenantEvent[]> {
    const conditions = [eq(tenantEvents.tenantId, tenantId)];
    if (!includeArchived) {
      conditions.push(eq(tenantEvents.isArchived, false));
    }
    return db.select().from(tenantEvents)
      .where(and(...conditions))
      .orderBy(asc(tenantEvents.startDate));
  }

  async getTenantEventById(id: string): Promise<TenantEvent | undefined> {
    const [event] = await db.select().from(tenantEvents).where(eq(tenantEvents.id, id));
    return event || undefined;
  }

  async createTenantEvent(event: InsertTenantEvent & { tenantId: string }): Promise<TenantEvent> {
    const [newEvent] = await db.insert(tenantEvents).values({
      ...event,
      status: event.status || "SCHEDULED",
    }).returning();
    return newEvent;
  }

  async updateTenantEvent(id: string, event: Partial<InsertTenantEvent>): Promise<TenantEvent | undefined> {
    const [updated] = await db.update(tenantEvents)
      .set({ ...event, updatedAt: new Date() })
      .where(eq(tenantEvents.id, id))
      .returning();
    return updated || undefined;
  }

  async setTenantEventArchived(id: string, isArchived: boolean): Promise<TenantEvent | undefined> {
    const [updated] = await db.update(tenantEvents)
      .set({ isArchived, updatedAt: new Date() })
      .where(eq(tenantEvents.id, id))
      .returning();
    return updated || undefined;
  }

  async getAssociationEvents(associationId: string, includeArchived: boolean = false): Promise<AssociationEvent[]> {
    const conditions = [eq(associationEvents.associationId, associationId)];
    if (!includeArchived) {
      conditions.push(eq(associationEvents.isArchived, false));
    }
    return db.select().from(associationEvents)
      .where(and(...conditions))
      .orderBy(asc(associationEvents.startDate));
  }

  async getAssociationEventById(id: string): Promise<AssociationEvent | undefined> {
    const [event] = await db.select().from(associationEvents).where(eq(associationEvents.id, id));
    return event || undefined;
  }

  async createAssociationEvent(event: InsertAssociationEvent & { associationId: string }): Promise<AssociationEvent> {
    const [newEvent] = await db.insert(associationEvents).values({
      ...event,
      status: event.status || "SCHEDULED",
    }).returning();
    return newEvent;
  }

  async updateAssociationEvent(id: string, event: Partial<InsertAssociationEvent>): Promise<AssociationEvent | undefined> {
    const [updated] = await db.update(associationEvents)
      .set({ ...event, updatedAt: new Date() })
      .where(eq(associationEvents.id, id))
      .returning();
    return updated || undefined;
  }

  async setAssociationEventArchived(id: string, isArchived: boolean): Promise<AssociationEvent | undefined> {
    const [updated] = await db.update(associationEvents)
      .set({ isArchived, updatedAt: new Date() })
      .where(eq(associationEvents.id, id))
      .returning();
    return updated || undefined;
  }

  async getStats(tenantId: string): Promise<{
    ideas: { total: number; new: number };
    incidents: { total: number; new: number };
    meetings: { total: number; upcoming: number };
  }> {
    const [ideasTotal] = await db.select({ count: count() }).from(ideas)
      .where(eq(ideas.tenantId, tenantId));
    const [ideasNew] = await db.select({ count: count() }).from(ideas)
      .where(and(eq(ideas.tenantId, tenantId), eq(ideas.status, "NEW")));
    
    const [incidentsTotal] = await db.select({ count: count() }).from(incidents)
      .where(eq(incidents.tenantId, tenantId));
    const [incidentsNew] = await db.select({ count: count() }).from(incidents)
      .where(and(eq(incidents.tenantId, tenantId), eq(incidents.status, "NEW")));
    
    const [meetingsTotal] = await db.select({ count: count() }).from(meetings)
      .where(eq(meetings.tenantId, tenantId));
    const [meetingsUpcoming] = await db.select({ count: count() }).from(meetings)
      .where(and(
        eq(meetings.tenantId, tenantId),
        eq(meetings.status, "SCHEDULED"),
        gte(meetings.dateTime, new Date())
      ));

    return {
      ideas: {
        total: ideasTotal?.count || 0,
        new: ideasNew?.count || 0,
      },
      incidents: {
        total: incidentsTotal?.count || 0,
        new: incidentsNew?.count || 0,
      },
      meetings: {
        total: meetingsTotal?.count || 0,
        upcoming: meetingsUpcoming?.count || 0,
      },
    };
  }

  async updateTenantStripeInfo(tenantId: string, stripeInfo: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    stripeDefaultPaymentMethodId?: string;
    stripeSetupIntentId?: string;
  }): Promise<Tenant | undefined> {
    const [updated] = await db.update(tenants)
      .set({ ...stripeInfo, updatedAt: new Date() })
      .where(eq(tenants.id, tenantId))
      .returning();
    return updated || undefined;
  }

  async updateTenantBillingStatus(tenantId: string, status: string, plan?: string): Promise<Tenant | undefined> {
    const updateData: any = { billingStatus: status as any, updatedAt: new Date() };
    if (plan) {
      updateData.subscriptionPlan = plan;
    }
    const [updated] = await db.update(tenants)
      .set(updateData)
      .where(eq(tenants.id, tenantId))
      .returning();
    return updated || undefined;
  }

  async updateTenantSettings(tenantId: string, settings: {
    presentationText?: string;
    logoUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
    backgroundColor?: string;
  }): Promise<Tenant | undefined> {
    const [updated] = await db.update(tenants)
      .set({ ...settings, updatedAt: new Date() })
      .where(eq(tenants.id, tenantId))
      .returning();
    return updated || undefined;
  }

  async getTenantByStripeCustomerId(customerId: string): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants)
      .where(eq(tenants.stripeCustomerId, customerId));
    return tenant || undefined;
  }

  async updateTenantQuantities(tenantId: string, quantities: {
    purchasedCommunes?: number;
    purchasedAssociations?: number;
    purchasedAdmins?: number;
  }): Promise<Tenant | undefined> {
    const [updated] = await db.update(tenants)
      .set({ ...quantities, updatedAt: new Date() })
      .where(eq(tenants.id, tenantId))
      .returning();
    return updated || undefined;
  }

  async updateTenantMandateBillingInfo(tenantId: string, info: {
    mandateBillingAddress?: string | null;
    mandateBillingService?: string | null;
    mandateAccountingContactName?: string | null;
    mandateAccountingContactEmail?: string | null;
    mandateAccountingContactPhone?: string | null;
    mandateServiceCode?: string | null;
    mandateEngagementNumber?: string | null;
    mandatePurchaseOrderNumber?: string | null;
    mandateUseChorusPro?: boolean;
    mandateChorusProSiret?: string | null;
    mandateChorusProServiceCode?: string | null;
    mandateChorusProServiceLabel?: string | null;
    mandateChorusProEngagementNumber?: string | null;
  }): Promise<Tenant | undefined> {
    const [updated] = await db.update(tenants)
      .set({ ...info, updatedAt: new Date() })
      .where(eq(tenants.id, tenantId))
      .returning();
    return updated || undefined;
  }

  async getSuperadminByEmail(email: string): Promise<Superadmin | undefined> {
    const [superadmin] = await db.select().from(superadmins).where(eq(superadmins.email, email));
    return superadmin || undefined;
  }

  async getSuperadminById(id: string): Promise<Superadmin | undefined> {
    const [superadmin] = await db.select().from(superadmins).where(eq(superadmins.id, id));
    return superadmin || undefined;
  }

  async createSuperadmin(superadmin: InsertSuperadmin): Promise<Superadmin> {
    const [newSuperadmin] = await db.insert(superadmins).values(superadmin).returning();
    return newSuperadmin;
  }

  async updateSuperadminLastLogin(id: string): Promise<void> {
    await db.update(superadmins)
      .set({ lastLoginAt: new Date() })
      .where(eq(superadmins.id, id));
  }

  async getAllSuperadmins(): Promise<Superadmin[]> {
    return db.select().from(superadmins).orderBy(desc(superadmins.createdAt));
  }

  async updateSuperadmin(id: string, data: { email?: string; name?: string; passwordHash?: string; isActive?: boolean }): Promise<Superadmin | undefined> {
    const [updated] = await db.update(superadmins)
      .set(data)
      .where(eq(superadmins.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteSuperadmin(id: string): Promise<boolean> {
    const result = await db.delete(superadmins).where(eq(superadmins.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getSuperadminSettings(): Promise<SuperadminSettings | undefined> {
    const [settings] = await db.select().from(superadminSettings).limit(1);
    return settings || undefined;
  }

  async updateSuperadminSettings(themeKey: string): Promise<SuperadminSettings> {
    const existing = await this.getSuperadminSettings();
    if (existing) {
      const [updated] = await db.update(superadminSettings)
        .set({ themeKey, updatedAt: new Date() })
        .where(eq(superadminSettings.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(superadminSettings)
        .values({ themeKey })
        .returning();
      return created;
    }
  }

  async updateStripeMode(mode: 'test' | 'live'): Promise<SuperadminSettings> {
    const existing = await this.getSuperadminSettings();
    if (existing) {
      const [updated] = await db.update(superadminSettings)
        .set({ stripeMode: mode, updatedAt: new Date() })
        .where(eq(superadminSettings.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(superadminSettings)
        .values({ stripeMode: mode })
        .returning();
      return created;
    }
  }

  async getCompanySettings(): Promise<CompanySettings | undefined> {
    const [settings] = await db.select().from(companySettings).limit(1);
    return settings || undefined;
  }

  async updateCompanySettings(data: Partial<InsertCompanySettings>): Promise<CompanySettings> {
    const existing = await this.getCompanySettings();
    if (existing) {
      const [updated] = await db.update(companySettings)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(companySettings.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(companySettings)
        .values({ ...data } as InsertCompanySettings)
        .returning();
      return created;
    }
  }

  async getLegalEntitySettings(): Promise<LegalEntitySettings | undefined> {
    const [settings] = await db.select().from(legalEntitySettings).limit(1);
    return settings || undefined;
  }

  async updateLegalEntitySettings(data: Partial<InsertLegalEntitySettings>): Promise<LegalEntitySettings> {
    const existing = await this.getLegalEntitySettings();
    if (existing) {
      const [updated] = await db.update(legalEntitySettings)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(legalEntitySettings.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(legalEntitySettings)
        .values({ ...data } as InsertLegalEntitySettings)
        .returning();
      return created;
    }
  }

  async getAllTenants(): Promise<Tenant[]> {
    return db.select().from(tenants).orderBy(desc(tenants.createdAt));
  }

  async getAllLeads(): Promise<Lead[]> {
    return db.select().from(leads).orderBy(desc(leads.createdAt));
  }

  async updateLeadStatus(id: string, status: string): Promise<Lead | undefined> {
    const [updated] = await db.update(leads)
      .set({ status: status as any })
      .where(eq(leads.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteLead(id: string): Promise<boolean> {
    // First delete lead messages
    await db.delete(leadMessages).where(eq(leadMessages.leadId, id));
    const result = await db.delete(leads).where(eq(leads.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getLeadByPublicToken(token: string): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(eq(leads.publicToken, token));
    return lead || undefined;
  }

  async updateLeadPipelineStage(id: string, stage: string): Promise<Lead | undefined> {
    const [updated] = await db.update(leads)
      .set({ pipelineStage: stage as any })
      .where(eq(leads.id, id))
      .returning();
    return updated || undefined;
  }

  async updateLead(id: string, data: Partial<Lead>): Promise<Lead | undefined> {
    const [updated] = await db.update(leads)
      .set(data as any)
      .where(eq(leads.id, id))
      .returning();
    return updated || undefined;
  }

  async getLeadMessages(leadId: string): Promise<LeadMessage[]> {
    return db.select().from(leadMessages)
      .where(eq(leadMessages.leadId, leadId))
      .orderBy(asc(leadMessages.createdAt));
  }

  async createLeadMessage(message: InsertLeadMessage): Promise<LeadMessage> {
    const [created] = await db.insert(leadMessages).values(message).returning();
    // Update lastMessageAt on the lead
    await db.update(leads)
      .set({ 
        lastMessageAt: new Date(),
        lastContactedAt: message.senderType === "SUPERADMIN" ? new Date() : undefined
      })
      .where(eq(leads.id, message.leadId));
    return created;
  }

  async markLeadMessagesAsRead(leadId: string, senderType: string): Promise<void> {
    // Mark messages from the OTHER sender type as read
    const otherSenderType = senderType === "SUPERADMIN" ? "LEAD" : "SUPERADMIN";
    await db.update(leadMessages)
      .set({ isRead: true, readAt: new Date() })
      .where(and(
        eq(leadMessages.leadId, leadId),
        eq(leadMessages.senderType, otherSenderType as any),
        eq(leadMessages.isRead, false)
      ));
  }

  async getUnreadLeadMessageCount(leadId: string): Promise<number> {
    const [result] = await db.select({ count: count() }).from(leadMessages)
      .where(and(
        eq(leadMessages.leadId, leadId),
        eq(leadMessages.senderType, "LEAD"),
        eq(leadMessages.isRead, false)
      ));
    return result?.count || 0;
  }

  async deleteTenant(id: string, visitedIds: Set<string> = new Set()): Promise<boolean> {
    // Cycle protection - prevent infinite recursion from corrupted data
    if (visitedIds.has(id)) {
      console.warn(`Cycle detected in tenant deletion: ${id} was already visited`);
      return false;
    }
    visitedIds.add(id);
    
    const now = new Date();
    
    // First, recursively delete child tenants (mairies under EPCI, associations as tenants)
    // Child mairies (have parentEpciId pointing to this tenant)
    const childMairies = await db.select().from(tenants).where(eq(tenants.parentEpciId, id));
    for (const child of childMairies) {
      await this.deleteTenant(child.id, visitedIds);
    }
    // Child tenants (have parentTenantId pointing to this tenant)
    const childTenants = await db.select().from(tenants).where(eq(tenants.parentTenantId, id));
    for (const child of childTenants) {
      await this.deleteTenant(child.id, visitedIds);
    }
    
    // ARCHIVE billing documents (preserve for legal/audit purposes)
    // Archive quotes and set tenantId to null
    await db.update(quotes)
      .set({ isArchived: true, archivedAt: now, tenantId: null })
      .where(eq(quotes.tenantId, id));
    
    // Archive invoices and set tenantId to null  
    await db.update(invoices)
      .set({ isArchived: true, archivedAt: now, tenantId: null })
      .where(eq(invoices.tenantId, id));
    
    // Archive mandate orders and set tenantId to null
    await db.update(mandateOrders)
      .set({ isArchived: true, archivedAt: now, tenantId: null })
      .where(eq(mandateOrders.tenantId, id));
    
    // Archive mandate invoices and set tenantId to null
    await db.update(mandateInvoices)
      .set({ isArchived: true, archivedAt: now, tenantId: null })
      .where(eq(mandateInvoices.tenantId, id));
    
    // Update mandate subscriptions to remove tenant reference
    await db.update(mandateSubscriptions)
      .set({ tenantId: null as any })
      .where(eq(mandateSubscriptions.tenantId, id));
    
    // Update mandate documents to remove tenant reference
    await db.update(mandateDocuments)
      .set({ tenantId: null as any })
      .where(eq(mandateDocuments.tenantId, id));
    
    // Update payments to remove tenant reference (keep for audit)
    await db.update(payments)
      .set({ tenantId: null })
      .where(eq(payments.tenantId, id));
    
    // Delete password reset tokens for this tenant
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.tenantId, id));
    
    // Delete related data that doesn't need archiving
    // Meeting registrations
    await db.delete(meetingRegistrations).where(
      sql`meeting_id IN (SELECT id FROM meetings WHERE tenant_id = ${id})`
    );
    // Meeting ideas
    await db.delete(meetingIdeas).where(
      sql`meeting_id IN (SELECT id FROM meetings WHERE tenant_id = ${id})`
    );
    // Meetings
    await db.delete(meetings).where(eq(meetings.tenantId, id));
    // Idea votes
    await db.delete(ideaVotes).where(
      sql`idea_id IN (SELECT id FROM ideas WHERE tenant_id = ${id})`
    );
    // Ideas
    await db.delete(ideas).where(eq(ideas.tenantId, id));
    // Incidents
    await db.delete(incidents).where(eq(incidents.tenantId, id));
    
    // Association-related data (must delete in correct order for FK constraints)
    // Bureau member domains
    await db.delete(bureauMemberDomains).where(
      sql`bureau_member_id IN (SELECT id FROM bureau_members WHERE association_id IN (SELECT id FROM associations WHERE tenant_id = ${id}))`
    );
    // Bureau members
    await db.delete(bureauMembers).where(
      sql`association_id IN (SELECT id FROM associations WHERE tenant_id = ${id})`
    );
    // Association intervention domains
    await db.delete(associationInterventionDomains).where(
      sql`association_id IN (SELECT id FROM associations WHERE tenant_id = ${id})`
    );
    // Association meeting registrations
    await db.delete(associationMeetingRegistrations).where(
      sql`meeting_id IN (SELECT id FROM association_meetings WHERE association_id IN (SELECT id FROM associations WHERE tenant_id = ${id}))`
    );
    // Association meetings
    await db.delete(associationMeetings).where(
      sql`association_id IN (SELECT id FROM associations WHERE tenant_id = ${id})`
    );
    // Association idea votes
    await db.delete(associationIdeaVotes).where(
      sql`idea_id IN (SELECT id FROM association_ideas WHERE association_id IN (SELECT id FROM associations WHERE tenant_id = ${id}))`
    );
    // Association ideas
    await db.delete(associationIdeas).where(
      sql`association_id IN (SELECT id FROM associations WHERE tenant_id = ${id})`
    );
    // Association incidents
    await db.delete(associationIncidents).where(
      sql`association_id IN (SELECT id FROM associations WHERE tenant_id = ${id})`
    );
    // Association photos
    await db.delete(associationPhotos).where(
      sql`association_id IN (SELECT id FROM associations WHERE tenant_id = ${id})`
    );
    // Association users
    await db.delete(associationUsers).where(
      sql`association_id IN (SELECT id FROM associations WHERE tenant_id = ${id})`
    );
    // Associations
    await db.delete(associations).where(eq(associations.tenantId, id));
    
    // Tenant addons
    await db.delete(tenantAddons).where(eq(tenantAddons.tenantId, id));
    // Tenant feature overrides
    await db.delete(tenantFeatureOverrides).where(eq(tenantFeatureOverrides.tenantId, id));
    // Tenant billing preferences
    await db.delete(tenantBillingPreferences).where(eq(tenantBillingPreferences.tenantId, id));
    // Tenant billing changes
    await db.delete(tenantBillingChanges).where(eq(tenantBillingChanges.tenantId, id));
    // Billing ledger entries
    await db.delete(billingLedgerEntries).where(eq(billingLedgerEntries.tenantId, id));
    // Mandate activities - keep for audit but remove tenant reference
    await db.update(mandateActivities)
      .set({ tenantId: null as any })
      .where(eq(mandateActivities.tenantId, id));
    // Delete mandate reminders
    await db.delete(mandateReminders).where(eq(mandateReminders.tenantId, id));
    // Delete subscription reminders
    await db.delete(subscriptionReminders).where(eq(subscriptionReminders.tenantId, id));
    // Elected official domains
    await db.delete(electedOfficialDomains).where(
      sql`elected_official_id IN (SELECT id FROM tenant_elected_officials WHERE tenant_id = ${id})`
    );
    // Elected official menu permissions
    await db.delete(electedOfficialMenuPermissions).where(
      sql`elected_official_id IN (SELECT id FROM tenant_elected_officials WHERE tenant_id = ${id})`
    );
    // Elected officials
    await db.delete(tenantElectedOfficials).where(eq(tenantElectedOfficials.tenantId, id));
    // Tenant photos
    await db.delete(tenantPhotos).where(eq(tenantPhotos.tenantId, id));
    // Tenant intervention domains
    await db.delete(tenantInterventionDomains).where(eq(tenantInterventionDomains.tenantId, id));
    // Tenant service codes
    await db.delete(tenantServiceCodes).where(eq(tenantServiceCodes.tenantId, id));
    // Tenant document numbering config
    await db.delete(tenantDocumentNumberingConfig).where(eq(tenantDocumentNumberingConfig.tenantId, id));
    // Users
    await db.delete(users).where(eq(users.tenantId, id));
    
    // Finally delete tenant
    const result = await db.delete(tenants).where(eq(tenants.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getGlobalStats(): Promise<{
    tenants: { total: number; trial: number; active: number; cancelled: number };
    leads: { total: number; new: number; converted: number };
  }> {
    const [tenantsTotal] = await db.select({ count: count() }).from(tenants);
    const [tenantsTrial] = await db.select({ count: count() }).from(tenants)
      .where(eq(tenants.billingStatus, "TRIAL"));
    const [tenantsActive] = await db.select({ count: count() }).from(tenants)
      .where(eq(tenants.billingStatus, "ACTIVE"));
    const [tenantsCancelled] = await db.select({ count: count() }).from(tenants)
      .where(eq(tenants.billingStatus, "CANCELLED"));

    const [leadsTotal] = await db.select({ count: count() }).from(leads);
    const [leadsNew] = await db.select({ count: count() }).from(leads)
      .where(eq(leads.status, "NEW"));
    const [leadsConverted] = await db.select({ count: count() }).from(leads)
      .where(eq(leads.status, "CONVERTED"));

    return {
      tenants: {
        total: tenantsTotal?.count || 0,
        trial: tenantsTrial?.count || 0,
        active: tenantsActive?.count || 0,
        cancelled: tenantsCancelled?.count || 0,
      },
      leads: {
        total: leadsTotal?.count || 0,
        new: leadsNew?.count || 0,
        converted: leadsConverted?.count || 0,
      },
    };
  }

  async getAllSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    return db.select().from(subscriptionPlans).orderBy(asc(subscriptionPlans.displayOrder), asc(subscriptionPlans.monthlyPrice));
  }

  async reorderSubscriptionPlans(planIds: string[]): Promise<void> {
    for (let i = 0; i < planIds.length; i++) {
      await db.update(subscriptionPlans)
        .set({ displayOrder: i, updatedAt: new Date() })
        .where(eq(subscriptionPlans.id, planIds[i]));
    }
  }

  async getSubscriptionPlanById(id: string): Promise<SubscriptionPlan | undefined> {
    const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, id));
    return plan || undefined;
  }

  async getSubscriptionPlanByCode(code: string): Promise<SubscriptionPlan | undefined> {
    const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.code, code));
    return plan || undefined;
  }

  async createSubscriptionPlan(plan: InsertSubscriptionPlan): Promise<SubscriptionPlan> {
    const [newPlan] = await db.insert(subscriptionPlans).values(plan).returning();
    return newPlan;
  }

  async updateSubscriptionPlan(id: string, updates: Partial<InsertSubscriptionPlan>): Promise<SubscriptionPlan | undefined> {
    const [updated] = await db.update(subscriptionPlans)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(subscriptionPlans.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteSubscriptionPlan(id: string): Promise<void> {
    // Check if any tenants are using this plan
    const [tenant] = await db.select().from(tenants).where(eq(tenants.subscriptionPlanId, id)).limit(1);
    if (tenant) {
      throw new Error("Ce forfait est utilise par au moins un client et ne peut pas etre supprime");
    }
    
    // Delete all related records first
    await db.delete(planFeatures).where(eq(planFeatures.planId, id));
    await db.delete(planFeatureAssignments).where(eq(planFeatureAssignments.planId, id));
    await db.delete(planAddonAccess).where(eq(planAddonAccess.planId, id));
    
    // Finally delete the plan
    await db.delete(subscriptionPlans).where(eq(subscriptionPlans.id, id));
  }

  async getPlanFeatures(planId: string): Promise<PlanFeature[]> {
    return db.select().from(planFeatures)
      .where(eq(planFeatures.planId, planId))
      .orderBy(asc(planFeatures.sortOrder));
  }

  async getAllPlanFeatures(): Promise<PlanFeature[]> {
    return db.select().from(planFeatures).orderBy(asc(planFeatures.sortOrder));
  }

  async createPlanFeature(feature: InsertPlanFeature): Promise<PlanFeature> {
    const [newFeature] = await db.insert(planFeatures).values(feature).returning();
    return newFeature;
  }

  async updatePlanFeature(id: string, updates: Partial<InsertPlanFeature>): Promise<PlanFeature | undefined> {
    const [updated] = await db.update(planFeatures)
      .set(updates)
      .where(eq(planFeatures.id, id))
      .returning();
    return updated || undefined;
  }

  async deletePlanFeature(id: string): Promise<void> {
    await db.delete(planFeatures).where(eq(planFeatures.id, id));
  }

  async getPlansWithFeatures(): Promise<(SubscriptionPlan & { features: PlanFeature[] })[]> {
    const plans = await this.getAllSubscriptionPlans();
    const planFeaturesData = await this.getAllPlanFeatures();
    return plans.map(plan => ({
      ...plan,
      features: planFeaturesData.filter(f => f.planId === plan.id),
    }));
  }

  async getAllFeatures(): Promise<Feature[]> {
    return db.select().from(features).orderBy(asc(features.displayOrder), asc(features.name));
  }

  async getFeatureById(id: string): Promise<Feature | undefined> {
    const [feature] = await db.select().from(features).where(eq(features.id, id));
    return feature || undefined;
  }

  async getFeatureByCode(code: string): Promise<Feature | undefined> {
    const [feature] = await db.select().from(features).where(eq(features.code, code));
    return feature || undefined;
  }

  async createFeature(feature: InsertFeature): Promise<Feature> {
    const [newFeature] = await db.insert(features).values(feature).returning();
    return newFeature;
  }

  async updateFeature(id: string, updates: Partial<InsertFeature>): Promise<Feature | undefined> {
    const [updated] = await db.update(features)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(features.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteFeature(id: string): Promise<void> {
    await db.delete(planFeatureAssignments).where(eq(planFeatureAssignments.featureId, id));
    await db.delete(features).where(eq(features.id, id));
  }

  async getPlanFeatureAssignments(planId: string): Promise<(PlanFeatureAssignment & { feature: Feature })[]> {
    const assignments = await db.select().from(planFeatureAssignments)
      .where(eq(planFeatureAssignments.planId, planId));
    
    const result: (PlanFeatureAssignment & { feature: Feature })[] = [];
    for (const assignment of assignments) {
      const feature = await this.getFeatureById(assignment.featureId);
      if (feature) {
        result.push({ ...assignment, feature });
      }
    }
    return result;
  }

  async setPlanFeatures(planId: string, featureIds: string[]): Promise<void> {
    await db.delete(planFeatureAssignments).where(eq(planFeatureAssignments.planId, planId));
    if (featureIds.length > 0) {
      await db.insert(planFeatureAssignments).values(
        featureIds.map(featureId => ({
          planId,
          featureId,
        }))
      );
    }
  }

  async addFeatureToPlan(planId: string, featureId: string): Promise<PlanFeatureAssignment> {
    const [assignment] = await db.insert(planFeatureAssignments)
      .values({ planId, featureId })
      .returning();
    return assignment;
  }

  async removeFeatureFromPlan(planId: string, featureId: string): Promise<void> {
    await db.delete(planFeatureAssignments)
      .where(and(
        eq(planFeatureAssignments.planId, planId),
        eq(planFeatureAssignments.featureId, featureId)
      ));
  }

  async getPlansWithCatalogFeatures(): Promise<(SubscriptionPlan & { catalogFeatures: (PlanFeatureAssignment & { feature: Feature })[] })[]> {
    const plans = await this.getAllSubscriptionPlans();
    const result: (SubscriptionPlan & { catalogFeatures: (PlanFeatureAssignment & { feature: Feature })[] })[] = [];
    for (const plan of plans) {
      const catalogFeatures = await this.getPlanFeatureAssignments(plan.id);
      result.push({ ...plan, catalogFeatures });
    }
    return result;
  }

  async getAllProducts(): Promise<Product[]> {
    return db.select().from(products).orderBy(asc(products.name));
  }

  async getActiveProducts(): Promise<Product[]> {
    return db.select().from(products)
      .where(eq(products.isActive, true))
      .orderBy(asc(products.name));
  }

  async getProductById(id: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product || undefined;
  }

  async getProductByCode(code: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.code, code));
    return product || undefined;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [newProduct] = await db.insert(products).values(product).returning();
    return newProduct;
  }

  async updateProduct(id: string, updates: Partial<InsertProduct>): Promise<Product | undefined> {
    const [updated] = await db.update(products)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteProduct(id: string): Promise<void> {
    await db.delete(products).where(eq(products.id, id));
  }

  async getTenantFeatureOverrides(tenantId: string): Promise<TenantFeatureOverride | undefined> {
    const [override] = await db.select().from(tenantFeatureOverrides)
      .where(eq(tenantFeatureOverrides.tenantId, tenantId));
    return override || undefined;
  }

  async upsertTenantFeatureOverrides(tenantId: string, overrides: Partial<TenantFeatureOverride>): Promise<TenantFeatureOverride> {
    const existing = await this.getTenantFeatureOverrides(tenantId);
    if (existing) {
      const [updated] = await db.update(tenantFeatureOverrides)
        .set({ ...overrides, updatedAt: new Date() })
        .where(eq(tenantFeatureOverrides.tenantId, tenantId))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(tenantFeatureOverrides)
        .values({ tenantId, ...overrides } as any)
        .returning();
      return created;
    }
  }

  // Get effective features for a tenant (plan features + overrides + catalog features)
  async getTenantEffectiveFeatures(tenantId: string): Promise<{
    hasIdeas: boolean;
    hasIncidents: boolean;
    hasMeetings: boolean;
    hasEvents: boolean;
    features: string[];
    planName?: string;
  }> {
    const tenant = await this.getTenantById(tenantId);
    if (!tenant) {
      return { hasIdeas: false, hasIncidents: false, hasMeetings: false, hasEvents: false, features: [] };
    }

    // Get plan features (legacy flags)
    let planFeatures = { hasIdeas: true, hasIncidents: true, hasMeetings: true, hasEvents: true, planName: undefined as string | undefined };
    let catalogFeatureCodes: string[] = [];
    
    if (tenant.subscriptionPlanId) {
      const plan = await this.getSubscriptionPlanById(tenant.subscriptionPlanId);
      if (plan) {
        planFeatures = {
          hasIdeas: plan.hasIdeas,
          hasIncidents: plan.hasIncidents,
          hasMeetings: plan.hasMeetings,
          hasEvents: plan.hasEvents,
          planName: plan.name,
        };
        
        // Get catalog features from plan assignments
        const assignments = await db.select({
          featureCode: features.code,
        })
        .from(planFeatureAssignments)
        .innerJoin(features, eq(planFeatureAssignments.featureId, features.id))
        .where(eq(planFeatureAssignments.planId, plan.id));
        
        catalogFeatureCodes = assignments.map(a => a.featureCode);
      }
    }

    // Get overrides
    const overrides = await this.getTenantFeatureOverrides(tenantId);
    
    // Merge legacy flags with catalog features
    const effectiveFeatures = {
      hasIdeas: overrides?.hasIdeas ?? planFeatures.hasIdeas,
      hasIncidents: overrides?.hasIncidents ?? planFeatures.hasIncidents,
      hasMeetings: overrides?.hasMeetings ?? planFeatures.hasMeetings,
      hasEvents: overrides?.hasEvents ?? planFeatures.hasEvents,
      features: catalogFeatureCodes,
      planName: planFeatures.planName,
    };
    
    // Also add legacy flags as feature codes for unified checking
    if (effectiveFeatures.hasIdeas && !effectiveFeatures.features.includes('ideas')) {
      effectiveFeatures.features.push('ideas');
    }
    if (effectiveFeatures.hasIncidents && !effectiveFeatures.features.includes('incidents')) {
      effectiveFeatures.features.push('incidents');
    }
    if (effectiveFeatures.hasMeetings && !effectiveFeatures.features.includes('meetings')) {
      effectiveFeatures.features.push('meetings');
    }
    if (effectiveFeatures.hasEvents && !effectiveFeatures.features.includes('events')) {
      effectiveFeatures.features.push('events');
    }
    
    return effectiveFeatures;
  }

  // Get effective features for an association (inherited from parent tenant)
  async getAssociationEffectiveFeatures(associationId: string): Promise<{
    hasIdeas: boolean;
    hasIncidents: boolean;
    hasMeetings: boolean;
    hasEvents: boolean;
    features: string[];
    planName?: string;
  }> {
    const association = await this.getAssociationById(associationId);
    if (!association) {
      return { hasIdeas: false, hasIncidents: false, hasMeetings: false, hasEvents: false, features: [] };
    }
    
    // Inherit features from parent tenant
    return this.getTenantEffectiveFeatures(association.tenantId);
  }

  async getAllQuotes(): Promise<Quote[]> {
    return db.select().from(quotes).orderBy(desc(quotes.createdAt));
  }

  async getQuoteById(id: string): Promise<Quote | undefined> {
    const [quote] = await db.select().from(quotes).where(eq(quotes.id, id));
    return quote || undefined;
  }

  async getQuoteByPublicToken(token: string): Promise<Quote | undefined> {
    const [quote] = await db.select().from(quotes).where(eq(quotes.publicToken, token));
    return quote || undefined;
  }

  async getQuotesByLeadId(leadId: string): Promise<Quote[]> {
    return db.select().from(quotes).where(eq(quotes.leadId, leadId)).orderBy(desc(quotes.createdAt));
  }

  async generateQuotePublicToken(quoteId: string): Promise<string> {
    const token = crypto.randomUUID();
    await db.update(quotes)
      .set({ publicToken: token })
      .where(eq(quotes.id, quoteId));
    return token;
  }

  async createQuote(quote: InsertQuote & { quoteNumber: string }): Promise<Quote> {
    const [newQuote] = await db.insert(quotes).values(quote).returning();
    return newQuote;
  }

  async updateQuote(id: string, updates: Partial<Quote>): Promise<Quote | undefined> {
    const [updated] = await db.update(quotes)
      .set(updates)
      .where(eq(quotes.id, id))
      .returning();
    return updated || undefined;
  }

  async updateAllQuotesEmitterInfo(emitterInfo: {
    emitterName: string;
    emitterAddress: string | null;
    emitterSiret: string | null;
    emitterTva: string | null;
  }): Promise<number> {
    const result = await db.update(quotes)
      .set({
        emitterName: emitterInfo.emitterName,
        emitterAddress: emitterInfo.emitterAddress,
        emitterSiret: emitterInfo.emitterSiret,
        emitterTva: emitterInfo.emitterTva,
      })
      .returning();
    return result.length;
  }

  async getQuoteLineItems(quoteId: string): Promise<QuoteLineItem[]> {
    return db.select().from(quoteLineItems).where(eq(quoteLineItems.quoteId, quoteId));
  }

  async createQuoteLineItem(item: InsertQuoteLineItem): Promise<QuoteLineItem> {
    const [newItem] = await db.insert(quoteLineItems).values(item).returning();
    return newItem;
  }

  async deleteQuoteLineItems(quoteId: string): Promise<void> {
    await db.delete(quoteLineItems).where(eq(quoteLineItems.quoteId, quoteId));
  }

  async getAllInvoices(): Promise<Invoice[]> {
    return db.select().from(invoices).orderBy(desc(invoices.createdAt));
  }

  async getInvoiceById(id: string): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
    return invoice || undefined;
  }

  async createInvoice(invoice: InsertInvoice & { invoiceNumber: string }): Promise<Invoice> {
    const [newInvoice] = await db.insert(invoices).values(invoice).returning();
    return newInvoice;
  }

  async updateInvoice(id: string, updates: Partial<Invoice>): Promise<Invoice | undefined> {
    const [updated] = await db.update(invoices)
      .set(updates)
      .where(eq(invoices.id, id))
      .returning();
    return updated || undefined;
  }

  async updateAllInvoicesEmitterInfo(emitterInfo: {
    emitterName: string;
    emitterAddress: string | null;
    emitterSiret: string | null;
    emitterTva: string | null;
  }): Promise<number> {
    const result = await db.update(invoices)
      .set({
        emitterName: emitterInfo.emitterName,
        emitterAddress: emitterInfo.emitterAddress,
        emitterSiret: emitterInfo.emitterSiret,
        emitterTva: emitterInfo.emitterTva,
      })
      .returning();
    return result.length;
  }

  async getInvoiceLineItems(invoiceId: string): Promise<InvoiceLineItem[]> {
    return db.select().from(invoiceLineItems).where(eq(invoiceLineItems.invoiceId, invoiceId));
  }

  async createInvoiceLineItem(item: InsertInvoiceLineItem): Promise<InvoiceLineItem> {
    const [newItem] = await db.insert(invoiceLineItems).values(item).returning();
    return newItem;
  }

  async deleteInvoiceLineItems(invoiceId: string): Promise<void> {
    await db.delete(invoiceLineItems).where(eq(invoiceLineItems.invoiceId, invoiceId));
  }

  async getAllPayments(): Promise<Payment[]> {
    return db.select().from(payments).orderBy(desc(payments.createdAt));
  }

  async getPaymentsByTenant(tenantId: string): Promise<Payment[]> {
    return db.select().from(payments)
      .where(eq(payments.tenantId, tenantId))
      .orderBy(desc(payments.createdAt));
  }

  async getPaymentsByInvoice(invoiceId: string): Promise<Payment[]> {
    return db.select().from(payments)
      .where(eq(payments.invoiceId, invoiceId))
      .orderBy(desc(payments.createdAt));
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    const [newPayment] = await db.insert(payments).values(payment).returning();
    return newPayment;
  }

  async updatePayment(id: string, updates: Partial<Payment>): Promise<Payment | undefined> {
    const [updated] = await db.update(payments)
      .set(updates)
      .where(eq(payments.id, id))
      .returning();
    return updated || undefined;
  }

  async getNextQuoteNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const [result] = await db.select({ count: count() }).from(quotes);
    const num = (result?.count || 0) + 1;
    return `DEV-${year}-${String(num).padStart(4, '0')}`;
  }

  async getNextInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const [result] = await db.select({ count: count() }).from(invoices);
    const num = (result?.count || 0) + 1;
    return `FAC-${year}-${String(num).padStart(4, '0')}`;
  }

  async updateTenantSubscription(tenantId: string, planId: string, interval: string): Promise<Tenant | undefined> {
    const [updated] = await db.update(tenants)
      .set({ 
        subscriptionPlanId: planId, 
        billingInterval: interval as any,
        updatedAt: new Date() 
      })
      .where(eq(tenants.id, tenantId))
      .returning();
    return updated || undefined;
  }

  // Addon methods
  async listAddons(): Promise<Addon[]> {
    return db.select().from(addons).orderBy(asc(addons.name));
  }

  async getAddonById(id: string): Promise<Addon | undefined> {
    const [addon] = await db.select().from(addons).where(eq(addons.id, id));
    return addon || undefined;
  }

  async getAllAddons(): Promise<Addon[]> {
    return db.select().from(addons).where(eq(addons.isActive, true));
  }

  async getAddonByCode(code: string): Promise<Addon | undefined> {
    const [addon] = await db.select().from(addons).where(eq(addons.code, code));
    return addon || undefined;
  }

  async createAddon(addon: InsertAddon): Promise<Addon> {
    const [newAddon] = await db.insert(addons).values(addon).returning();
    return newAddon;
  }

  async updateAddon(id: string, updates: Partial<InsertAddon>): Promise<Addon | undefined> {
    const [updated] = await db.update(addons)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(addons.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteAddon(id: string): Promise<void> {
    await db.delete(planAddonAccess).where(eq(planAddonAccess.addonId, id));
    await db.delete(tenantAddons).where(eq(tenantAddons.addonId, id));
    await db.delete(addons).where(eq(addons.id, id));
  }

  // Plan-Addon access methods
  async getPlanAddonAccess(planId: string): Promise<(PlanAddonAccess & { addon: Addon })[]> {
    const accessList = await db.select().from(planAddonAccess)
      .where(eq(planAddonAccess.planId, planId));
    
    const results: (PlanAddonAccess & { addon: Addon })[] = [];
    for (const access of accessList) {
      const addon = await this.getAddonById(access.addonId);
      if (addon) {
        results.push({ ...access, addon });
      }
    }
    return results;
  }

  async setPlanAddonAccess(planId: string, addonAccess: { addonId: string; isEnabled: boolean; monthlyPrice?: number | null; yearlyPrice?: number | null }[]): Promise<void> {
    const existingAccess = await db.select().from(planAddonAccess)
      .where(eq(planAddonAccess.planId, planId));
    
    const existingData = new Map<string, { monthlyPrice: number | null; yearlyPrice: number | null }>();
    existingAccess.forEach(a => {
      existingData.set(a.addonId, {
        monthlyPrice: a.monthlyPrice,
        yearlyPrice: a.yearlyPrice,
      });
    });
    
    await db.delete(planAddonAccess).where(eq(planAddonAccess.planId, planId));
    
    if (addonAccess.length > 0) {
      await db.insert(planAddonAccess).values(
        addonAccess.map(a => {
          const existing = existingData.get(a.addonId);
          return {
            planId,
            addonId: a.addonId,
            isEnabled: a.isEnabled,
            monthlyPrice: a.monthlyPrice ?? existing?.monthlyPrice ?? null,
            yearlyPrice: a.yearlyPrice ?? existing?.yearlyPrice ?? null,
          };
        })
      );
    }
  }

  async getPlansWithAddonAccess(): Promise<(SubscriptionPlan & { addonAccess: (PlanAddonAccess & { addon: Addon })[] })[]> {
    const allPlans = await this.getAllSubscriptionPlans();
    const results: (SubscriptionPlan & { addonAccess: (PlanAddonAccess & { addon: Addon })[] })[] = [];
    
    for (const plan of allPlans) {
      const access = await this.getPlanAddonAccess(plan.id);
      results.push({ ...plan, addonAccess: access });
    }
    return results;
  }

  // Association methods
  async getAssociationsByTenant(tenantId: string): Promise<Association[]> {
    return db.select().from(associations)
      .where(eq(associations.tenantId, tenantId))
      .orderBy(asc(associations.name));
  }

  async getAllAssociations(): Promise<Association[]> {
    return db.select().from(associations)
      .where(eq(associations.isActive, true))
      .orderBy(asc(associations.name));
  }

  async getAssociationById(id: string): Promise<Association | undefined> {
    const [association] = await db.select().from(associations).where(eq(associations.id, id));
    return association || undefined;
  }

  async getAssociationBySlug(tenantId: string, slug: string): Promise<Association | undefined> {
    const [association] = await db.select().from(associations)
      .where(and(eq(associations.tenantId, tenantId), eq(associations.slug, slug)));
    return association || undefined;
  }

  async createAssociation(association: InsertAssociation): Promise<Association> {
    const [newAssociation] = await db.insert(associations).values(association).returning();
    return newAssociation;
  }

  async updateAssociation(id: string, updates: Partial<InsertAssociation>): Promise<Association | undefined> {
    const [updated] = await db.update(associations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(associations.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteAssociation(id: string): Promise<void> {
    // Delete all votes for ideas of this association first
    await db.delete(associationIdeaVotes).where(
      sql`idea_id IN (SELECT id FROM association_ideas WHERE association_id = ${id})`
    );
    // Delete all meeting registrations
    await db.delete(associationMeetingRegistrations).where(
      sql`meeting_id IN (SELECT id FROM association_meetings WHERE association_id = ${id})`
    );
    // Delete all related data
    await db.delete(associationIdeas).where(eq(associationIdeas.associationId, id));
    await db.delete(associationIncidents).where(eq(associationIncidents.associationId, id));
    await db.delete(associationMeetings).where(eq(associationMeetings.associationId, id));
    await db.delete(associationPhotos).where(eq(associationPhotos.associationId, id));
    await db.delete(associationInterventionDomains).where(eq(associationInterventionDomains.associationId, id));
    await db.delete(associationUsers).where(eq(associationUsers.associationId, id));
    // Finally delete the association itself
    await db.delete(associations).where(eq(associations.id, id));
  }

  async getAssociationUserByEmail(associationId: string, email: string): Promise<AssociationUser | undefined> {
    const [user] = await db.select().from(associationUsers)
      .where(and(eq(associationUsers.associationId, associationId), eq(associationUsers.email, email)));
    return user || undefined;
  }

  async getAssociationUserById(id: string): Promise<AssociationUser | undefined> {
    const [user] = await db.select().from(associationUsers).where(eq(associationUsers.id, id));
    return user || undefined;
  }

  async createAssociationUser(user: InsertAssociationUser): Promise<AssociationUser> {
    const [newUser] = await db.insert(associationUsers).values(user).returning();
    return newUser;
  }

  async getAssociationUsers(associationId: string): Promise<AssociationUser[]> {
    return db.select().from(associationUsers)
      .where(eq(associationUsers.associationId, associationId))
      .orderBy(asc(associationUsers.name));
  }

  async getTenantAssociationQuota(tenantId: string): Promise<{ used: number; allowed: number; remaining: number; parentEpciName?: string }> {
    const tenant = await this.getTenantById(tenantId);
    
    // Si c'est une mairie enfant d'un EPCI, utiliser le quota du parent
    if (tenant?.parentEpciId) {
      const parentEpci = await this.getTenantById(tenant.parentEpciId);
      if (parentEpci) {
        // Calculer le quota du parent EPCI
        const parentQuota = await this.getEpciAssociationQuotaWithChildren(tenant.parentEpciId);
        return { 
          ...parentQuota, 
          parentEpciName: parentEpci.name 
        };
      }
    }
    
    // Calculer le quota normalement pour les tenants independants
    const [usedResult] = await db.select({ count: count() })
      .from(associations)
      .where(and(eq(associations.tenantId, tenantId), eq(associations.isActive, true)));
    const used = usedResult?.count || 0;

    let planIncluded = 0;
    let planAccessQuantity = 0;
    let purchasedAddonQuantity = 0;
    let planId: string | null = null;

    if (tenant?.subscriptionPlanId) {
      planId = tenant.subscriptionPlanId;
      const plan = await this.getSubscriptionPlanById(planId);
      planIncluded = plan?.associationsIncluded || 0;
    } else if (tenant?.subscriptionPlan) {
      const planByCode = await this.getSubscriptionPlanByCode(tenant.subscriptionPlan);
      if (planByCode) {
        planId = planByCode.id;
        planIncluded = planByCode.associationsIncluded || 0;
      }
    }

    // For mandate tenants, get plan from mandate subscription/order
    if (!planId) {
      const mandateSubscription = await this.getMandateSubscriptionByTenant(tenantId);
      if (mandateSubscription?.planId) {
        planId = mandateSubscription.planId;
        const plan = await this.getSubscriptionPlanById(planId);
        planIncluded = plan?.associationsIncluded || 0;
      } else {
        // Try from latest mandate order
        const mandateOrders = await this.getMandateOrdersByTenant(tenantId);
        const latestOrder = mandateOrders
          .filter(o => o.planId && (o.status === "ACCEPTED" || o.status === "INVOICED"))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
        if (latestOrder?.planId) {
          planId = latestOrder.planId;
          const plan = await this.getSubscriptionPlanById(planId);
          planIncluded = plan?.associationsIncluded || 0;
        }
      }
    }

    // Get purchased addon quantities from tenantAddons table (for Stripe tenants)
    const tenantAddonsList = await db.select().from(tenantAddons)
      .where(eq(tenantAddons.tenantId, tenantId));
    for (const ta of tenantAddonsList) {
      const addon = await this.getAddonById(ta.addonId);
      if (addon?.code.toUpperCase() === "ASSOCIATIONS") {
        purchasedAddonQuantity += ta.quantity;
      }
    }

    // For mandate tenants, also check addons from mandate order snapshot
    if (purchasedAddonQuantity === 0) {
      const mandateOrders = await this.getMandateOrdersByTenant(tenantId);
      const latestOrder = mandateOrders
        .filter(o => o.status === "ACCEPTED" || o.status === "INVOICED")
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      if (latestOrder?.addonsSnapshot) {
        try {
          const snapshotAddons = typeof latestOrder.addonsSnapshot === "string"
            ? JSON.parse(latestOrder.addonsSnapshot)
            : latestOrder.addonsSnapshot;
          for (const addon of snapshotAddons || []) {
            if (addon.code?.toUpperCase() === "ASSOCIATIONS") {
              purchasedAddonQuantity += addon.quantity || 0;
            }
          }
        } catch {}
      }
    }

    // Also include directly purchased associations from superadmin back-office
    const purchasedAssociations = tenant?.purchasedAssociations || 0;
    const allowed = planIncluded + planAccessQuantity + purchasedAddonQuantity + purchasedAssociations;
    const remaining = Math.max(0, allowed - used);

    return { used, allowed, remaining };
  }
  
  // Calculer le quota d'associations pour un EPCI incluant toutes ses mairies enfants
  async getEpciAssociationQuotaWithChildren(epciTenantId: string): Promise<{ used: number; allowed: number; remaining: number }> {
    // Obtenir toutes les mairies enfants de cet EPCI
    const childTenants = await db.select().from(tenants)
      .where(eq(tenants.parentEpciId, epciTenantId));
    
    // Calculer le total des associations utilisees par l'EPCI et ses mairies enfants
    let totalUsed = 0;
    
    // Associations de l'EPCI parent
    const [epciUsed] = await db.select({ count: count() })
      .from(associations)
      .where(and(eq(associations.tenantId, epciTenantId), eq(associations.isActive, true)));
    totalUsed += epciUsed?.count || 0;
    
    // Associations de chaque mairie enfant
    for (const child of childTenants) {
      const [childUsed] = await db.select({ count: count() })
        .from(associations)
        .where(and(eq(associations.tenantId, child.id), eq(associations.isActive, true)));
      totalUsed += childUsed?.count || 0;
    }
    
    // Calculer le quota autorise de l'EPCI
    const epciTenant = await this.getTenantById(epciTenantId);
    let planIncluded = 0;
    let purchasedAddonQuantity = 0;
    let planId: string | null = null;

    if (epciTenant?.subscriptionPlanId) {
      planId = epciTenant.subscriptionPlanId;
      const plan = await this.getSubscriptionPlanById(planId);
      planIncluded = plan?.associationsIncluded || 0;
    }

    // For mandate EPCI, get plan from mandate subscription/order
    if (!planId) {
      const mandateSubscription = await this.getMandateSubscriptionByTenant(epciTenantId);
      if (mandateSubscription?.planId) {
        planId = mandateSubscription.planId;
        const plan = await this.getSubscriptionPlanById(planId);
        planIncluded = plan?.associationsIncluded || 0;
      } else {
        const mandateOrders = await this.getMandateOrdersByTenant(epciTenantId);
        const latestOrder = mandateOrders
          .filter(o => o.planId && (o.status === "ACCEPTED" || o.status === "INVOICED"))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
        if (latestOrder?.planId) {
          planId = latestOrder.planId;
          const plan = await this.getSubscriptionPlanById(planId);
          planIncluded = plan?.associationsIncluded || 0;
        }
      }
    }

    // Get purchased addon quantities from Stripe tenantAddons table
    const stripeAddonsList = await db.select().from(tenantAddons)
      .where(eq(tenantAddons.tenantId, epciTenantId));
    for (const ta of stripeAddonsList) {
      const addon = await this.getAddonById(ta.addonId);
      if (addon?.code.toUpperCase() === "ASSOCIATIONS") {
        purchasedAddonQuantity += ta.quantity;
      }
    }

    // Also check mandate order snapshot for addons
    if (purchasedAddonQuantity === 0) {
      const mandateOrders = await this.getMandateOrdersByTenant(epciTenantId);
      const latestOrder = mandateOrders
        .filter(o => o.status === "ACCEPTED" || o.status === "INVOICED")
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      if (latestOrder?.addonsSnapshot) {
        try {
          const snapshotAddons = typeof latestOrder.addonsSnapshot === "string"
            ? JSON.parse(latestOrder.addonsSnapshot)
            : latestOrder.addonsSnapshot;
          for (const addon of snapshotAddons || []) {
            if (addon.code?.toUpperCase() === "ASSOCIATIONS") {
              purchasedAddonQuantity += addon.quantity || 0;
            }
          }
        } catch {}
      }
    }

    const purchasedAssociations = epciTenant?.purchasedAssociations || 0;
    const allowed = planIncluded + purchasedAddonQuantity + purchasedAssociations;
    const remaining = Math.max(0, allowed - totalUsed);

    return { used: totalUsed, allowed, remaining };
  }

  async getAddonUsageStats(): Promise<{
    addonId: string;
    addonName: string;
    addonCode: string;
    totalQuantity: number;
    tenantCount: number;
    monthlyPrice: number;
    yearlyPrice: number;
  }[]> {
    const allAddons = await this.listAddons();
    const stats: {
      addonId: string;
      addonName: string;
      addonCode: string;
      totalQuantity: number;
      tenantCount: number;
      monthlyPrice: number;
      yearlyPrice: number;
    }[] = [];

    for (const addon of allAddons) {
      const usageData = await db.select({ 
        count: count(),
        totalQty: sql<number>`COALESCE(SUM(${tenantAddons.quantity}), 0)`
      })
        .from(tenantAddons)
        .where(eq(tenantAddons.addonId, addon.id));
      
      stats.push({
        addonId: addon.id,
        addonName: addon.name,
        addonCode: addon.code,
        totalQuantity: usageData[0]?.totalQty || 0,
        tenantCount: usageData[0]?.count || 0,
        monthlyPrice: addon.defaultMonthlyPrice,
        yearlyPrice: addon.defaultYearlyPrice,
      });
    }

    return stats;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getTenantAdminQuota(tenantId: string): Promise<{
    used: number;
    allowed: number;
    remaining: number;
  }> {
    const tenant = await this.getTenantById(tenantId);
    if (!tenant) {
      return { used: 0, allowed: 1, remaining: 1 };
    }

    let planIncluded = 1;
    let planAccessQuantity = 0;
    let planId: string | null = null;

    if (tenant.subscriptionPlanId) {
      planId = tenant.subscriptionPlanId;
      const plan = await this.getSubscriptionPlanById(planId);
      planIncluded = plan?.maxAdmins || 1;
    } else if (tenant.subscriptionPlan) {
      const planByCode = await this.getSubscriptionPlanByCode(tenant.subscriptionPlan);
      if (planByCode) {
        planId = planByCode.id;
        planIncluded = planByCode.maxAdmins || 1;
      }
    }

    // For mandate tenants, get plan from mandate subscription/order
    if (!planId) {
      const mandateSubscription = await this.getMandateSubscriptionByTenant(tenantId);
      if (mandateSubscription?.planId) {
        planId = mandateSubscription.planId;
        const plan = await this.getSubscriptionPlanById(planId);
        planIncluded = plan?.maxAdmins || 1;
      } else {
        // Try from latest mandate order
        const mandateOrders = await this.getMandateOrdersByTenant(tenantId);
        const latestOrder = mandateOrders
          .filter(o => o.planId && (o.status === "ACCEPTED" || o.status === "INVOICED"))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
        if (latestOrder?.planId) {
          planId = latestOrder.planId;
          const plan = await this.getSubscriptionPlanById(planId);
          planIncluded = plan?.maxAdmins || 1;
        }
      }
    }

    // Get purchased addon quantities for ADMIN from tenantAddons table (for Stripe tenants)
    const tenantAddonsList = await db.select().from(tenantAddons)
      .where(eq(tenantAddons.tenantId, tenantId));
    let purchasedAdminQuantity = 0;
    for (const ta of tenantAddonsList) {
      const addon = await this.getAddonById(ta.addonId);
      if (addon?.code.toUpperCase() === "ADMIN") {
        purchasedAdminQuantity += ta.quantity;
      }
    }

    // For mandate tenants, also check addons from mandate order snapshot
    if (purchasedAdminQuantity === 0) {
      const mandateOrders = await this.getMandateOrdersByTenant(tenantId);
      const latestOrder = mandateOrders
        .filter(o => o.status === "ACCEPTED" || o.status === "INVOICED")
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      if (latestOrder?.addonsSnapshot) {
        try {
          const snapshotAddons = typeof latestOrder.addonsSnapshot === "string"
            ? JSON.parse(latestOrder.addonsSnapshot)
            : latestOrder.addonsSnapshot;
          for (const addon of snapshotAddons || []) {
            if (addon.code?.toUpperCase() === "ADMIN" || addon.code?.toUpperCase() === "ADMINS") {
              purchasedAdminQuantity += addon.quantity || 0;
            }
          }
        } catch {}
      }
    }

    // For trial tenants, also check purchasedAdmins column directly on tenant
    if (purchasedAdminQuantity === 0 && tenant.purchasedAdmins && tenant.purchasedAdmins > 0) {
      purchasedAdminQuantity = tenant.purchasedAdmins;
    }

    const allowed = planIncluded + purchasedAdminQuantity;

    const adminsList = await this.getUsersByTenantId(tenantId);
    const used = adminsList.length;

    return {
      used,
      allowed,
      remaining: Math.max(0, allowed - used),
    };
  }

  // Association Ideas methods
  async getAssociationIdeas(associationId: string, includeArchived: boolean = false): Promise<AssociationIdea[]> {
    const conditions = [eq(associationIdeas.associationId, associationId)];
    if (!includeArchived) {
      conditions.push(eq(associationIdeas.isArchived, false));
    }
    return db.select().from(associationIdeas)
      .where(and(...conditions))
      .orderBy(desc(associationIdeas.createdAt));
  }

  async getAssociationIdeaById(id: string): Promise<AssociationIdea | undefined> {
    const [idea] = await db.select().from(associationIdeas).where(eq(associationIdeas.id, id));
    return idea || undefined;
  }

  async getAssociationIdeaByToken(token: string): Promise<AssociationIdea | undefined> {
    const [idea] = await db.select().from(associationIdeas).where(eq(associationIdeas.publicToken, token));
    return idea || undefined;
  }

  async createAssociationIdea(idea: InsertAssociationIdea & { associationId: string; publicToken: string }): Promise<AssociationIdea> {
    const [newIdea] = await db.insert(associationIdeas).values({
      ...idea,
      status: "NEW",
      votesCount: 0,
    }).returning();
    return newIdea;
  }

  async updateAssociationIdeaStatus(id: string, status: string): Promise<AssociationIdea | undefined> {
    const [updated] = await db.update(associationIdeas)
      .set({ status: status as any, updatedAt: new Date() })
      .where(eq(associationIdeas.id, id))
      .returning();
    return updated || undefined;
  }

  async setAssociationIdeaArchived(id: string, isArchived: boolean): Promise<AssociationIdea | undefined> {
    const [updated] = await db.update(associationIdeas)
      .set({ isArchived, updatedAt: new Date() })
      .where(eq(associationIdeas.id, id))
      .returning();
    return updated || undefined;
  }

  async incrementAssociationIdeaVotes(id: string): Promise<void> {
    await db.update(associationIdeas)
      .set({ votesCount: sql`${associationIdeas.votesCount} + 1` })
      .where(eq(associationIdeas.id, id));
  }

  async getAssociationIdeaVoteByVoter(ideaId: string, voterIp: string, anonymousVoterId?: string): Promise<AssociationIdeaVote | undefined> {
    // Try to find by anonymous voter ID first (more reliable), then by IP
    if (anonymousVoterId) {
      const [vote] = await db.select().from(associationIdeaVotes)
        .where(and(eq(associationIdeaVotes.ideaId, ideaId), eq(associationIdeaVotes.anonymousVoterId, anonymousVoterId)));
      if (vote) return vote;
    }
    const [vote] = await db.select().from(associationIdeaVotes)
      .where(and(eq(associationIdeaVotes.ideaId, ideaId), eq(associationIdeaVotes.voterIp, voterIp)));
    return vote || undefined;
  }

  async getAssociationIdeaVoteByIp(ideaId: string, voterIp: string): Promise<AssociationIdeaVote | undefined> {
    const [vote] = await db.select().from(associationIdeaVotes)
      .where(and(eq(associationIdeaVotes.ideaId, ideaId), eq(associationIdeaVotes.voterIp, voterIp)));
    return vote || undefined;
  }

  async createAssociationIdeaVote(ideaId: string, voterIp: string, voteType: 'up' | 'down' = 'up', anonymousVoterId?: string): Promise<AssociationIdeaVote> {
    const [vote] = await db.insert(associationIdeaVotes).values({
      ideaId,
      voterIp,
      voteType,
      anonymousVoterId,
    }).returning();
    
    // Update vote counts based on vote type
    if (voteType === 'up') {
      await db.update(associationIdeas)
        .set({ 
          votesCount: sql`${associationIdeas.votesCount} + 1`,
          upVotesCount: sql`${associationIdeas.upVotesCount} + 1`
        })
        .where(eq(associationIdeas.id, ideaId));
    } else {
      await db.update(associationIdeas)
        .set({ 
          votesCount: sql`${associationIdeas.votesCount} + 1`,
          downVotesCount: sql`${associationIdeas.downVotesCount} + 1`
        })
        .where(eq(associationIdeas.id, ideaId));
    }
    
    return vote;
  }

  async updateAssociationIdeaVote(voteId: string, ideaId: string, newVoteType: 'up' | 'down', oldVoteType: string): Promise<AssociationIdeaVote | undefined> {
    const [updatedVote] = await db.update(associationIdeaVotes)
      .set({ voteType: newVoteType })
      .where(eq(associationIdeaVotes.id, voteId))
      .returning();
    
    // Update counts: decrement old type, increment new type (prevent negative with GREATEST)
    if (oldVoteType === 'up' && newVoteType === 'down') {
      await db.update(associationIdeas)
        .set({ 
          upVotesCount: sql`GREATEST(0, ${associationIdeas.upVotesCount} - 1)`,
          downVotesCount: sql`${associationIdeas.downVotesCount} + 1`
        })
        .where(eq(associationIdeas.id, ideaId));
    } else if (oldVoteType === 'down' && newVoteType === 'up') {
      await db.update(associationIdeas)
        .set({ 
          upVotesCount: sql`${associationIdeas.upVotesCount} + 1`,
          downVotesCount: sql`GREATEST(0, ${associationIdeas.downVotesCount} - 1)`
        })
        .where(eq(associationIdeas.id, ideaId));
    }
    
    return updatedVote;
  }

  async removeAssociationIdeaVote(voteId: string, ideaId: string, voteType: string): Promise<void> {
    await db.delete(associationIdeaVotes).where(eq(associationIdeaVotes.id, voteId));
    
    // Decrement the appropriate count (prevent negative with GREATEST)
    if (voteType === 'up') {
      await db.update(associationIdeas)
        .set({ 
          votesCount: sql`GREATEST(0, ${associationIdeas.votesCount} - 1)`,
          upVotesCount: sql`GREATEST(0, ${associationIdeas.upVotesCount} - 1)`
        })
        .where(eq(associationIdeas.id, ideaId));
    } else {
      await db.update(associationIdeas)
        .set({ 
          votesCount: sql`GREATEST(0, ${associationIdeas.votesCount} - 1)`,
          downVotesCount: sql`GREATEST(0, ${associationIdeas.downVotesCount} - 1)`
        })
        .where(eq(associationIdeas.id, ideaId));
    }
  }

  // Association Incidents methods
  async getAssociationIncidents(associationId: string, includeArchived: boolean = false): Promise<AssociationIncident[]> {
    const conditions = [eq(associationIncidents.associationId, associationId)];
    if (!includeArchived) {
      conditions.push(eq(associationIncidents.isArchived, false));
    }
    return db.select().from(associationIncidents)
      .where(and(...conditions))
      .orderBy(desc(associationIncidents.createdAt));
  }

  async getAssociationIncidentById(id: string): Promise<AssociationIncident | undefined> {
    const [incident] = await db.select().from(associationIncidents).where(eq(associationIncidents.id, id));
    return incident || undefined;
  }

  async getAssociationIncidentByToken(token: string): Promise<AssociationIncident | undefined> {
    const [incident] = await db.select().from(associationIncidents).where(eq(associationIncidents.publicToken, token));
    return incident || undefined;
  }

  async createAssociationIncident(incident: InsertAssociationIncident & { associationId: string; publicToken: string }): Promise<AssociationIncident> {
    const [newIncident] = await db.insert(associationIncidents).values({
      ...incident,
      status: "NEW",
    }).returning();
    return newIncident;
  }

  async updateAssociationIncidentStatus(id: string, status: string): Promise<AssociationIncident | undefined> {
    const [updated] = await db.update(associationIncidents)
      .set({ status: status as any, updatedAt: new Date() })
      .where(eq(associationIncidents.id, id))
      .returning();
    return updated || undefined;
  }

  async setAssociationIncidentArchived(id: string, isArchived: boolean): Promise<AssociationIncident | undefined> {
    const [updated] = await db.update(associationIncidents)
      .set({ isArchived, updatedAt: new Date() })
      .where(eq(associationIncidents.id, id))
      .returning();
    return updated || undefined;
  }

  // Association Meetings methods
  async getAssociationMeetings(associationId: string, includeArchived: boolean = false): Promise<(AssociationMeeting & { registrationsCount: number })[]> {
    const conditions = [eq(associationMeetings.associationId, associationId)];
    if (!includeArchived) {
      conditions.push(eq(associationMeetings.isArchived, false));
    }
    const meetingsList = await db.select().from(associationMeetings)
      .where(and(...conditions))
      .orderBy(asc(associationMeetings.dateTime));
    
    const result = await Promise.all(meetingsList.map(async (meeting) => {
      const regs = await db.select({ count: count() }).from(associationMeetingRegistrations)
        .where(eq(associationMeetingRegistrations.meetingId, meeting.id));
      return {
        ...meeting,
        registrationsCount: regs[0]?.count || 0,
      };
    }));
    
    return result;
  }

  async getAssociationMeetingById(id: string): Promise<(AssociationMeeting & { registrationsCount: number; registrations: AssociationMeetingRegistration[] }) | undefined> {
    const [meeting] = await db.select().from(associationMeetings).where(eq(associationMeetings.id, id));
    if (!meeting) return undefined;

    const registrations = await db.select().from(associationMeetingRegistrations)
      .where(eq(associationMeetingRegistrations.meetingId, id));

    return {
      ...meeting,
      registrationsCount: registrations.length,
      registrations,
    };
  }

  async createAssociationMeeting(meeting: InsertAssociationMeeting & { associationId: string }): Promise<AssociationMeeting> {
    const [newMeeting] = await db.insert(associationMeetings).values({
      ...meeting,
      status: meeting.status || "SCHEDULED",
    }).returning();
    return newMeeting;
  }

  async updateAssociationMeeting(id: string, updates: Partial<InsertAssociationMeeting>): Promise<AssociationMeeting | undefined> {
    const [updated] = await db.update(associationMeetings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(associationMeetings.id, id))
      .returning();
    return updated || undefined;
  }

  async setAssociationMeetingArchived(id: string, isArchived: boolean): Promise<AssociationMeeting | undefined> {
    const [updated] = await db.update(associationMeetings)
      .set({ isArchived, updatedAt: new Date() })
      .where(eq(associationMeetings.id, id))
      .returning();
    return updated || undefined;
  }

  async updateAssociationMeetingStatus(id: string, status: string): Promise<AssociationMeeting | undefined> {
    const [updated] = await db.update(associationMeetings)
      .set({ status: status as any, updatedAt: new Date() })
      .where(eq(associationMeetings.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteAssociationMeeting(id: string): Promise<void> {
    await db.delete(associationMeetingRegistrations).where(eq(associationMeetingRegistrations.meetingId, id));
    await db.delete(associationMeetings).where(eq(associationMeetings.id, id));
  }

  async getAssociationMeetingRegistrations(meetingId: string): Promise<AssociationMeetingRegistration[]> {
    return db.select().from(associationMeetingRegistrations)
      .where(eq(associationMeetingRegistrations.meetingId, meetingId));
  }

  async createAssociationMeetingRegistration(reg: InsertAssociationMeetingRegistration): Promise<AssociationMeetingRegistration> {
    const [newReg] = await db.insert(associationMeetingRegistrations).values(reg).returning();
    return newReg;
  }

  // Bureau Members methods
  async getBureauMembers(associationId: string): Promise<BureauMember[]> {
    return db.select().from(bureauMembers)
      .where(eq(bureauMembers.associationId, associationId))
      .orderBy(asc(bureauMembers.lastName), asc(bureauMembers.firstName));
  }

  async getBureauMemberById(id: string): Promise<BureauMember | undefined> {
    const [member] = await db.select().from(bureauMembers).where(eq(bureauMembers.id, id));
    return member || undefined;
  }

  async getBureauMemberByEmail(associationId: string, email: string): Promise<BureauMember | undefined> {
    const [member] = await db.select().from(bureauMembers)
      .where(and(eq(bureauMembers.associationId, associationId), eq(bureauMembers.email, email)));
    return member || undefined;
  }

  async createBureauMember(member: InsertBureauMember): Promise<BureauMember> {
    const [newMember] = await db.insert(bureauMembers).values(member).returning();
    return newMember;
  }

  async updateBureauMember(id: string, updates: Partial<InsertBureauMember>): Promise<BureauMember | undefined> {
    const [updated] = await db.update(bureauMembers)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(bureauMembers.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteBureauMember(id: string): Promise<void> {
    await db.delete(bureauMembers).where(eq(bureauMembers.id, id));
  }

  // Association Stats
  async getAssociationStats(associationId: string): Promise<{
    ideas: { total: number; new: number };
    incidents: { total: number; new: number };
    meetings: { total: number; upcoming: number };
    bureau: { total: number; active: number };
  }> {
    const [ideasTotal] = await db.select({ count: count() }).from(associationIdeas)
      .where(eq(associationIdeas.associationId, associationId));
    const [ideasNew] = await db.select({ count: count() }).from(associationIdeas)
      .where(and(eq(associationIdeas.associationId, associationId), eq(associationIdeas.status, "NEW")));
    
    const [incidentsTotal] = await db.select({ count: count() }).from(associationIncidents)
      .where(eq(associationIncidents.associationId, associationId));
    const [incidentsNew] = await db.select({ count: count() }).from(associationIncidents)
      .where(and(eq(associationIncidents.associationId, associationId), eq(associationIncidents.status, "NEW")));
    
    const [meetingsTotal] = await db.select({ count: count() }).from(associationMeetings)
      .where(eq(associationMeetings.associationId, associationId));
    const [meetingsUpcoming] = await db.select({ count: count() }).from(associationMeetings)
      .where(and(
        eq(associationMeetings.associationId, associationId),
        eq(associationMeetings.status, "SCHEDULED"),
        gte(associationMeetings.dateTime, new Date())
      ));

    const [bureauTotal] = await db.select({ count: count() }).from(bureauMembers)
      .where(eq(bureauMembers.associationId, associationId));
    const [bureauActive] = await db.select({ count: count() }).from(bureauMembers)
      .where(and(eq(bureauMembers.associationId, associationId), eq(bureauMembers.isActive, true)));

    return {
      ideas: {
        total: ideasTotal?.count || 0,
        new: ideasNew?.count || 0,
      },
      incidents: {
        total: incidentsTotal?.count || 0,
        new: incidentsNew?.count || 0,
      },
      meetings: {
        total: meetingsTotal?.count || 0,
        upcoming: meetingsUpcoming?.count || 0,
      },
      bureau: {
        total: bureauTotal?.count || 0,
        active: bureauActive?.count || 0,
      },
    };
  }

  // Tenant Photos methods
  async getTenantPhotos(tenantId: string): Promise<TenantPhoto[]> {
    return db.select().from(tenantPhotos)
      .where(eq(tenantPhotos.tenantId, tenantId))
      .orderBy(asc(tenantPhotos.displayOrder));
  }

  async getTenantPhotoById(id: string): Promise<TenantPhoto | undefined> {
    const [photo] = await db.select().from(tenantPhotos).where(eq(tenantPhotos.id, id));
    return photo || undefined;
  }

  async createTenantPhoto(photo: InsertTenantPhoto): Promise<TenantPhoto> {
    const [newPhoto] = await db.insert(tenantPhotos).values(photo).returning();
    return newPhoto;
  }

  async updateTenantPhoto(id: string, updates: Partial<InsertTenantPhoto>): Promise<TenantPhoto | undefined> {
    const [updated] = await db.update(tenantPhotos)
      .set(updates)
      .where(eq(tenantPhotos.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteTenantPhoto(id: string): Promise<void> {
    await db.delete(tenantPhotos).where(eq(tenantPhotos.id, id));
  }

  // Association Photos methods
  async getAssociationPhotos(associationId: string): Promise<AssociationPhoto[]> {
    return db.select().from(associationPhotos)
      .where(eq(associationPhotos.associationId, associationId))
      .orderBy(asc(associationPhotos.displayOrder));
  }

  async getAssociationPhotoById(id: string): Promise<AssociationPhoto | undefined> {
    const [photo] = await db.select().from(associationPhotos).where(eq(associationPhotos.id, id));
    return photo || undefined;
  }

  async createAssociationPhoto(photo: InsertAssociationPhoto): Promise<AssociationPhoto> {
    const [newPhoto] = await db.insert(associationPhotos).values(photo).returning();
    return newPhoto;
  }

  async updateAssociationPhoto(id: string, updates: Partial<InsertAssociationPhoto>): Promise<AssociationPhoto | undefined> {
    const [updated] = await db.update(associationPhotos)
      .set(updates)
      .where(eq(associationPhotos.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteAssociationPhoto(id: string): Promise<void> {
    await db.delete(associationPhotos).where(eq(associationPhotos.id, id));
  }

  // Elected Officials methods
  async getElectedOfficialsByTenant(tenantId: string): Promise<ElectedOfficial[]> {
    return db.select().from(tenantElectedOfficials)
      .where(eq(tenantElectedOfficials.tenantId, tenantId))
      .orderBy(asc(tenantElectedOfficials.displayOrder));
  }

  async getElectedOfficialById(id: string): Promise<ElectedOfficial | undefined> {
    const [official] = await db.select().from(tenantElectedOfficials).where(eq(tenantElectedOfficials.id, id));
    return official || undefined;
  }

  async createElectedOfficial(data: InsertElectedOfficial): Promise<ElectedOfficial> {
    const [newOfficial] = await db.insert(tenantElectedOfficials).values(data).returning();
    return newOfficial;
  }

  async updateElectedOfficial(id: string, updates: Partial<InsertElectedOfficial>): Promise<ElectedOfficial | undefined> {
    const [updated] = await db.update(tenantElectedOfficials)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(tenantElectedOfficials.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteElectedOfficial(id: string): Promise<void> {
    await db.delete(electedOfficialMenuPermissions).where(eq(electedOfficialMenuPermissions.electedOfficialId, id));
    await db.delete(electedOfficialDomains).where(eq(electedOfficialDomains.electedOfficialId, id));
    await db.delete(tenantElectedOfficials).where(eq(tenantElectedOfficials.id, id));
  }

  // Elected Official by Email (for login)
  async getElectedOfficialByEmail(email: string): Promise<ElectedOfficial | undefined> {
    const [official] = await db.select().from(tenantElectedOfficials)
      .where(and(
        eq(tenantElectedOfficials.email, email),
        eq(tenantElectedOfficials.isActive, true)
      ));
    return official || undefined;
  }

  // Elected Official by Invitation Token
  async getElectedOfficialByInvitationToken(token: string): Promise<ElectedOfficial | undefined> {
    const [official] = await db.select().from(tenantElectedOfficials)
      .where(eq(tenantElectedOfficials.invitationToken, token));
    return official || undefined;
  }

  // Set password and clear invitation token
  async setElectedOfficialPassword(id: string, passwordHash: string): Promise<ElectedOfficial | undefined> {
    const [updated] = await db.update(tenantElectedOfficials)
      .set({ 
        passwordHash,
        invitationToken: null,
        invitationExpiresAt: null,
        updatedAt: new Date()
      })
      .where(eq(tenantElectedOfficials.id, id))
      .returning();
    return updated || undefined;
  }

  // Set invitation token for an elected official
  async setElectedOfficialInvitation(id: string, token: string, expiresAt: Date): Promise<ElectedOfficial | undefined> {
    const [updated] = await db.update(tenantElectedOfficials)
      .set({ 
        invitationToken: token,
        invitationExpiresAt: expiresAt,
        invitedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(tenantElectedOfficials.id, id))
      .returning();
    return updated || undefined;
  }

  // Password reset token methods
  async createPasswordResetToken(data: {
    token: string;
    type: "ADMIN" | "ELU";
    userId?: string;
    electedOfficialId?: string;
    email: string;
    tenantId: string;
    expiresAt: Date;
  }): Promise<void> {
    await db.insert(passwordResetTokens).values(data);
  }

  async getPasswordResetToken(token: string): Promise<{
    id: string;
    token: string;
    type: "ADMIN" | "ELU";
    userId: string | null;
    electedOfficialId: string | null;
    email: string;
    tenantId: string;
    expiresAt: Date;
    usedAt: Date | null;
    createdAt: Date;
  } | undefined> {
    const [result] = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.token, token));
    return result || undefined;
  }

  async markPasswordResetTokenUsed(token: string): Promise<void> {
    await db.update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.token, token));
  }

  async invalidatePasswordResetTokensForUser(userId: string, type: "ADMIN" | "ELU"): Promise<void> {
    if (type === "ADMIN") {
      await db.update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(and(eq(passwordResetTokens.userId, userId), eq(passwordResetTokens.type, "ADMIN")));
    } else {
      await db.update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(and(eq(passwordResetTokens.electedOfficialId, userId), eq(passwordResetTokens.type, "ELU")));
    }
  }

  async getElectedOfficialByEmailAndTenant(email: string, tenantId: string): Promise<ElectedOfficial | undefined> {
    const [official] = await db.select()
      .from(tenantElectedOfficials)
      .where(and(
        eq(tenantElectedOfficials.email, email.toLowerCase()),
        eq(tenantElectedOfficials.tenantId, tenantId)
      ));
    return official || undefined;
  }

  // Update last login timestamp
  async updateElectedOfficialLastLogin(id: string): Promise<void> {
    await db.update(tenantElectedOfficials)
      .set({ lastLoginAt: new Date() })
      .where(eq(tenantElectedOfficials.id, id));
  }

  // Get menu permissions for an elected official
  async getElectedOfficialMenuPermissions(electedOfficialId: string): Promise<AdminMenuCode[]> {
    const permissions = await db.select().from(electedOfficialMenuPermissions)
      .where(eq(electedOfficialMenuPermissions.electedOfficialId, electedOfficialId));
    return permissions.map(p => p.menuCode as AdminMenuCode);
  }

  // Set menu permissions for an elected official (replace all)
  async setElectedOfficialMenuPermissions(electedOfficialId: string, menuCodes: AdminMenuCode[]): Promise<void> {
    await db.delete(electedOfficialMenuPermissions)
      .where(eq(electedOfficialMenuPermissions.electedOfficialId, electedOfficialId));
    
    if (menuCodes.length > 0) {
      await db.insert(electedOfficialMenuPermissions).values(
        menuCodes.map(menuCode => ({
          electedOfficialId,
          menuCode
        }))
      );
    }
  }

  // Tenant Intervention Domains methods
  async getTenantInterventionDomains(tenantId: string): Promise<TenantInterventionDomain[]> {
    return db.select().from(tenantInterventionDomains)
      .where(eq(tenantInterventionDomains.tenantId, tenantId))
      .orderBy(asc(tenantInterventionDomains.displayOrder));
  }

  async getTenantInterventionDomainById(id: string): Promise<TenantInterventionDomain | undefined> {
    const [domain] = await db.select().from(tenantInterventionDomains).where(eq(tenantInterventionDomains.id, id));
    return domain || undefined;
  }

  async createTenantInterventionDomain(data: InsertTenantInterventionDomain): Promise<TenantInterventionDomain> {
    const [newDomain] = await db.insert(tenantInterventionDomains).values(data).returning();
    return newDomain;
  }

  async updateTenantInterventionDomain(id: string, updates: Partial<InsertTenantInterventionDomain>): Promise<TenantInterventionDomain | undefined> {
    const [updated] = await db.update(tenantInterventionDomains)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(tenantInterventionDomains.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteTenantInterventionDomain(id: string): Promise<void> {
    await db.delete(electedOfficialDomains).where(eq(electedOfficialDomains.domainId, id));
    await db.delete(tenantInterventionDomains).where(eq(tenantInterventionDomains.id, id));
  }

  // Association Intervention Domains methods
  async getAssociationInterventionDomains(associationId: string): Promise<AssociationInterventionDomain[]> {
    return db.select().from(associationInterventionDomains)
      .where(eq(associationInterventionDomains.associationId, associationId))
      .orderBy(asc(associationInterventionDomains.displayOrder));
  }

  async getAssociationInterventionDomainById(id: string): Promise<AssociationInterventionDomain | undefined> {
    const [domain] = await db.select().from(associationInterventionDomains).where(eq(associationInterventionDomains.id, id));
    return domain || undefined;
  }

  async createAssociationInterventionDomain(data: InsertAssociationInterventionDomain): Promise<AssociationInterventionDomain> {
    const [newDomain] = await db.insert(associationInterventionDomains).values(data).returning();
    return newDomain;
  }

  async updateAssociationInterventionDomain(id: string, updates: Partial<InsertAssociationInterventionDomain>): Promise<AssociationInterventionDomain | undefined> {
    const [updated] = await db.update(associationInterventionDomains)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(associationInterventionDomains.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteAssociationInterventionDomain(id: string): Promise<void> {
    await db.delete(bureauMemberDomains).where(eq(bureauMemberDomains.domainId, id));
    await db.delete(associationInterventionDomains).where(eq(associationInterventionDomains.id, id));
  }

  // Elected Official Domains (many-to-many) - now using global municipality domains
  async getElectedOfficialDomains(electedOfficialId: string): Promise<GlobalMunicipalityDomain[]> {
    const links = await db.select().from(electedOfficialDomains)
      .where(eq(electedOfficialDomains.electedOfficialId, electedOfficialId));
    const domains: GlobalMunicipalityDomain[] = [];
    for (const link of links) {
      const [domain] = await db.select().from(globalMunicipalityDomains)
        .where(eq(globalMunicipalityDomains.id, link.domainId));
      if (domain) domains.push(domain);
    }
    return domains;
  }

  async setElectedOfficialDomains(electedOfficialId: string, domainIds: string[]): Promise<void> {
    await db.delete(electedOfficialDomains).where(eq(electedOfficialDomains.electedOfficialId, electedOfficialId));
    for (const domainId of domainIds) {
      await db.insert(electedOfficialDomains).values({ electedOfficialId, domainId });
    }
  }

  async getElectedOfficialsByDomainId(domainId: string): Promise<ElectedOfficial[]> {
    const links = await db.select().from(electedOfficialDomains)
      .where(eq(electedOfficialDomains.domainId, domainId));
    const officials: ElectedOfficial[] = [];
    for (const link of links) {
      const [official] = await db.select().from(tenantElectedOfficials)
        .where(and(
          eq(tenantElectedOfficials.id, link.electedOfficialId),
          eq(tenantElectedOfficials.isActive, true)
        ));
      if (official && official.email) officials.push(official);
    }
    return officials;
  }

  // Bureau Member Domains (many-to-many) - now using global association domains
  async getBureauMemberDomains(bureauMemberId: string): Promise<GlobalAssociationDomain[]> {
    const links = await db.select().from(bureauMemberDomains)
      .where(eq(bureauMemberDomains.bureauMemberId, bureauMemberId));
    const domains: GlobalAssociationDomain[] = [];
    for (const link of links) {
      const [domain] = await db.select().from(globalAssociationDomains)
        .where(eq(globalAssociationDomains.id, link.domainId));
      if (domain) domains.push(domain);
    }
    return domains;
  }

  async setBureauMemberDomains(bureauMemberId: string, domainIds: string[]): Promise<void> {
    await db.delete(bureauMemberDomains).where(eq(bureauMemberDomains.bureauMemberId, bureauMemberId));
    for (const domainId of domainIds) {
      await db.insert(bureauMemberDomains).values({ bureauMemberId, domainId });
    }
  }

  // EPCI Communes Management (communes are tenants with parentEpciId)
  async getCommunesByEpciId(epciId: string): Promise<Tenant[]> {
    return db.select().from(tenants)
      .where(eq(tenants.parentEpciId, epciId))
      .orderBy(asc(tenants.name));
  }

  async linkCommuneToEpci(communeId: string, epciId: string): Promise<Tenant | null> {
    const [updated] = await db.update(tenants)
      .set({ parentEpciId: epciId, updatedAt: new Date() })
      .where(eq(tenants.id, communeId))
      .returning();
    return updated || null;
  }

  async unlinkCommuneFromEpci(communeId: string): Promise<Tenant | null> {
    const [updated] = await db.update(tenants)
      .set({ parentEpciId: null, updatedAt: new Date() })
      .where(eq(tenants.id, communeId))
      .returning();
    return updated || null;
  }

  async getAvailableCommunesForEpci(): Promise<Tenant[]> {
    return db.select().from(tenants)
      .where(
        and(
          eq(tenants.tenantType, "MAIRIE"),
          sql`${tenants.parentEpciId} IS NULL`
        )
      )
      .orderBy(asc(tenants.name));
  }

  // Billing management methods
  async getTenantBillingInfo(tenantId: string): Promise<{
    tenant: Tenant;
    plan: SubscriptionPlan | null;
    addons: (TenantAddon & { addon: Addon })[];
    preferences: TenantBillingPreferences | null;
    pendingChanges: TenantBillingChange[];
    ledgerBalance: number;
  } | undefined> {
    const tenant = await this.getTenantById(tenantId);
    if (!tenant) return undefined;

    let plan: SubscriptionPlan | null = null;
    if (tenant.subscriptionPlanId) {
      const [p] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, tenant.subscriptionPlanId));
      plan = p || null;
    }

    const tenantAddonsList = await db.select().from(tenantAddons).where(eq(tenantAddons.tenantId, tenantId));
    const addonsWithDetails: (TenantAddon & { addon: Addon })[] = [];
    for (const ta of tenantAddonsList) {
      const [addon] = await db.select().from(addons).where(eq(addons.id, ta.addonId));
      if (addon) {
        addonsWithDetails.push({ ...ta, addon });
      }
    }

    const [preferences] = await db.select().from(tenantBillingPreferences).where(eq(tenantBillingPreferences.tenantId, tenantId));
    const pendingChanges = await this.getPendingBillingChanges(tenantId);
    const ledgerBalance = await this.getTenantLedgerBalance(tenantId);

    return {
      tenant,
      plan,
      addons: addonsWithDetails,
      preferences: preferences || null,
      pendingChanges,
      ledgerBalance,
    };
  }

  async getTenantBillingPreferences(tenantId: string): Promise<TenantBillingPreferences | undefined> {
    const [prefs] = await db.select().from(tenantBillingPreferences).where(eq(tenantBillingPreferences.tenantId, tenantId));
    return prefs || undefined;
  }

  async upsertTenantBillingPreferences(tenantId: string, prefs: Partial<InsertTenantBillingPreferences>): Promise<TenantBillingPreferences> {
    const existing = await this.getTenantBillingPreferences(tenantId);
    if (existing) {
      const [updated] = await db.update(tenantBillingPreferences)
        .set({ ...prefs, updatedAt: new Date() })
        .where(eq(tenantBillingPreferences.tenantId, tenantId))
        .returning();
      return updated;
    }
    const [created] = await db.insert(tenantBillingPreferences)
      .values({ tenantId, ...prefs } as InsertTenantBillingPreferences)
      .returning();
    return created;
  }

  async createBillingChange(change: InsertTenantBillingChange): Promise<TenantBillingChange> {
    const [created] = await db.insert(tenantBillingChanges).values(change).returning();
    return created;
  }

  async getPendingBillingChanges(tenantId: string): Promise<TenantBillingChange[]> {
    return db.select().from(tenantBillingChanges)
      .where(and(
        eq(tenantBillingChanges.tenantId, tenantId),
        eq(tenantBillingChanges.status, "PENDING")
      ))
      .orderBy(asc(tenantBillingChanges.effectiveDate));
  }

  async getAllBillingChanges(tenantId: string): Promise<TenantBillingChange[]> {
    return db.select().from(tenantBillingChanges)
      .where(eq(tenantBillingChanges.tenantId, tenantId))
      .orderBy(desc(tenantBillingChanges.createdAt));
  }

  async applyBillingChange(changeId: string): Promise<TenantBillingChange | undefined> {
    const [updated] = await db.update(tenantBillingChanges)
      .set({ status: "APPLIED", appliedAt: new Date() })
      .where(eq(tenantBillingChanges.id, changeId))
      .returning();
    return updated || undefined;
  }

  async cancelBillingChange(changeId: string): Promise<TenantBillingChange | undefined> {
    const [updated] = await db.update(tenantBillingChanges)
      .set({ status: "CANCELLED" })
      .where(eq(tenantBillingChanges.id, changeId))
      .returning();
    return updated || undefined;
  }

  async createLedgerEntry(entry: InsertBillingLedgerEntry): Promise<BillingLedgerEntry> {
    const [created] = await db.insert(billingLedgerEntries).values(entry).returning();
    return created;
  }

  async getTenantLedgerBalance(tenantId: string): Promise<number> {
    const entries = await db.select().from(billingLedgerEntries)
      .where(and(
        eq(billingLedgerEntries.tenantId, tenantId),
        eq(billingLedgerEntries.appliedToInvoice, false)
      ));
    let balance = 0;
    for (const e of entries) {
      if (e.entryType === "CREDIT") {
        balance += e.amount;
      } else {
        balance -= e.amount;
      }
    }
    return balance;
  }

  async getTenantLedgerEntries(tenantId: string): Promise<BillingLedgerEntry[]> {
    return db.select().from(billingLedgerEntries)
      .where(eq(billingLedgerEntries.tenantId, tenantId))
      .orderBy(desc(billingLedgerEntries.createdAt));
  }

  async updateTenantPlan(tenantId: string, planId: string, billingInterval: "MONTHLY" | "YEARLY"): Promise<Tenant | undefined> {
    const [updated] = await db.update(tenants)
      .set({ subscriptionPlanId: planId, billingInterval, updatedAt: new Date() })
      .where(eq(tenants.id, tenantId))
      .returning();
    return updated || undefined;
  }

  async getTenantAddon(tenantId: string, addonId: string): Promise<TenantAddon | undefined> {
    const [tenantAddon] = await db.select().from(tenantAddons)
      .where(and(eq(tenantAddons.tenantId, tenantId), eq(tenantAddons.addonId, addonId)));
    return tenantAddon || undefined;
  }

  async upsertTenantAddon(tenantId: string, addonId: string, quantity: number): Promise<TenantAddon> {
    const existing = await this.getTenantAddon(tenantId, addonId);
    if (existing) {
      if (quantity <= 0) {
        await db.delete(tenantAddons).where(eq(tenantAddons.id, existing.id));
        return existing;
      }
      const [updated] = await db.update(tenantAddons)
        .set({ quantity })
        .where(eq(tenantAddons.id, existing.id))
        .returning();
      return updated;
    }
    if (quantity <= 0) {
      throw new Error("Cannot create addon with zero quantity");
    }
    const [created] = await db.insert(tenantAddons)
      .values({ tenantId, addonId, quantity })
      .returning();
    return created;
  }

  // ==========================================
  // MANDATE MANAGEMENT
  // ==========================================

  // Generate document number based on configured format
  // Uses stable sequence keys (prefix only) to avoid UNIQUE constraint conflicts
  async generateDocumentNumber(documentType: 'DEVIS' | 'COMMANDE' | 'FACTURE' | 'AVOIR'): Promise<string> {
    const year = new Date().getFullYear();
    const month = new Date().getMonth() + 1;
    
    // Get the default format for this document type
    const [format] = await db.select().from(documentNumberFormats)
      .where(and(
        eq(documentNumberFormats.documentType, documentType),
        eq(documentNumberFormats.isDefault, true),
        eq(documentNumberFormats.isActive, true)
      ))
      .limit(1);
    
    // Fallback to first active format if no default
    const activeFormat = format || (await db.select().from(documentNumberFormats)
      .where(and(
        eq(documentNumberFormats.documentType, documentType),
        eq(documentNumberFormats.isActive, true)
      ))
      .limit(1))[0];
    
    // Stable sequence prefixes (don't change based on year/month)
    const sequencePrefixes: Record<string, string> = {
      'DEVIS': 'DV',
      'COMMANDE': 'BC',
      'FACTURE': 'FA',
      'AVOIR': 'AV'
    };
    
    // Display prefixes (can be configured in format)
    const displayPrefix = activeFormat?.prefix || sequencePrefixes[documentType];
    const separator = activeFormat?.separator || '-';
    const sequenceDigits = activeFormat?.sequenceDigits || 5;
    const includeMonth = activeFormat?.includeMonth || false;
    
    // Use stable sequence key (just the document type prefix)
    const sequenceKey = sequencePrefixes[documentType];
    
    const result = await db.execute(sql`
      INSERT INTO invoice_sequences (year, last_number, prefix)
      VALUES (${year}, 1, ${sequenceKey})
      ON CONFLICT (year, prefix)
      DO UPDATE SET last_number = invoice_sequences.last_number + 1, updated_at = NOW()
      RETURNING last_number
    `);
    const lastNumber = (result.rows[0] as any)?.last_number || 1;
    
    // Build the document number
    if (includeMonth) {
      return `${displayPrefix}${separator}${year}${separator}${String(month).padStart(2, '0')}${separator}${String(lastNumber).padStart(sequenceDigits, '0')}`;
    }
    return `${displayPrefix}${separator}${year}${separator}${String(lastNumber).padStart(sequenceDigits, '0')}`;
  }

  // Convenience methods for new document types
  async generateDevisNumber(): Promise<string> {
    return this.generateDocumentNumber('DEVIS');
  }

  async generateCommandeNumber(): Promise<string> {
    return this.generateDocumentNumber('COMMANDE');
  }

  async generateFactureNumber(): Promise<string> {
    return this.generateDocumentNumber('FACTURE');
  }

  async generateAvoirNumber(): Promise<string> {
    return this.generateDocumentNumber('AVOIR');
  }

  // Legacy methods - use new document type numbering
  async generateOrderNumber(): Promise<string> {
    // Mandate orders are COMMANDE (BC = Bon de Commande) documents
    return this.generateDocumentNumber('COMMANDE');
  }

  async generateInvoiceNumber(): Promise<string> {
    // Mandate invoices are FACTURE documents
    return this.generateDocumentNumber('FACTURE');
  }

  async createMandateOrder(order: InsertMandateOrder): Promise<MandateOrder> {
    const [created] = await db.insert(mandateOrders).values(order).returning();
    return created;
  }

  async getMandateOrderById(id: string): Promise<MandateOrder | undefined> {
    const [order] = await db.select().from(mandateOrders).where(eq(mandateOrders.id, id));
    return order || undefined;
  }

  async getMandateOrdersByTenant(tenantId: string): Promise<MandateOrder[]> {
    return db.select().from(mandateOrders)
      .where(eq(mandateOrders.tenantId, tenantId))
      .orderBy(desc(mandateOrders.createdAt));
  }

  async getAllMandateOrders(): Promise<MandateOrder[]> {
    return db.select().from(mandateOrders)
      .where(eq(mandateOrders.isDeleted, false))
      .orderBy(desc(mandateOrders.createdAt));
  }

  async getMandateOrderByQuoteId(quoteId: string): Promise<MandateOrder | undefined> {
    const [order] = await db.select().from(mandateOrders)
      .where(and(eq(mandateOrders.quoteId, quoteId), eq(mandateOrders.isDeleted, false)))
      .limit(1);
    return order;
  }

  async updateMandateOrderStatus(id: string, status: string, extra?: { validatedBy?: string; rejectionReason?: string; commandeNumber?: string }): Promise<MandateOrder | undefined> {
    const updates: any = { status, updatedAt: new Date() };
    if (status === "ACCEPTED" || status === "PENDING_BC") {
      updates.validatedAt = new Date();
      if (extra?.validatedBy) updates.validatedBy = extra.validatedBy;
      if (extra?.commandeNumber) updates.commandeNumber = extra.commandeNumber;
    }
    if (status === "REJECTED") {
      updates.rejectedAt = new Date();
      if (extra?.rejectionReason) updates.rejectionReason = extra.rejectionReason;
    }
    const [updated] = await db.update(mandateOrders)
      .set(updates)
      .where(eq(mandateOrders.id, id))
      .returning();
    return updated || undefined;
  }

  async updateMandateOrder(id: string, updates: Partial<MandateOrder>): Promise<MandateOrder | undefined> {
    const [updated] = await db.update(mandateOrders)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(mandateOrders.id, id))
      .returning();
    return updated || undefined;
  }

  async createMandateSubscription(subscription: InsertMandateSubscription): Promise<MandateSubscription> {
    const [created] = await db.insert(mandateSubscriptions).values(subscription).returning();
    return created;
  }

  async getMandateSubscriptionById(id: string): Promise<MandateSubscription | undefined> {
    const [sub] = await db.select().from(mandateSubscriptions).where(eq(mandateSubscriptions.id, id));
    return sub || undefined;
  }

  async getMandateSubscriptionByTenant(tenantId: string): Promise<MandateSubscription | undefined> {
    const [sub] = await db.select().from(mandateSubscriptions)
      .where(eq(mandateSubscriptions.tenantId, tenantId))
      .orderBy(desc(mandateSubscriptions.createdAt))
      .limit(1);
    return sub || undefined;
  }

  async getActiveMandateSubscription(tenantId: string): Promise<MandateSubscription | undefined> {
    const [sub] = await db.select().from(mandateSubscriptions)
      .where(and(
        eq(mandateSubscriptions.tenantId, tenantId),
        eq(mandateSubscriptions.status, "ACTIVE")
      ))
      .limit(1);
    return sub || undefined;
  }

  async updateMandateSubscription(id: string, updates: Partial<MandateSubscription>): Promise<MandateSubscription | undefined> {
    const [updated] = await db.update(mandateSubscriptions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(mandateSubscriptions.id, id))
      .returning();
    return updated || undefined;
  }

  async createMandateDocument(doc: InsertMandateDocument): Promise<MandateDocument> {
    const [created] = await db.insert(mandateDocuments).values(doc).returning();
    return created;
  }

  async getMandateDocumentsByOrder(orderId: string): Promise<MandateDocument[]> {
    return db.select().from(mandateDocuments)
      .where(eq(mandateDocuments.orderId, orderId))
      .orderBy(desc(mandateDocuments.createdAt));
  }

  async getMandateDocumentsByTenant(tenantId: string): Promise<MandateDocument[]> {
    return db.select().from(mandateDocuments)
      .where(eq(mandateDocuments.tenantId, tenantId))
      .orderBy(desc(mandateDocuments.createdAt));
  }

  async createMandateInvoice(invoice: InsertMandateInvoice): Promise<MandateInvoice> {
    const [created] = await db.insert(mandateInvoices).values(invoice).returning();
    return created;
  }

  async getMandateInvoiceById(id: string): Promise<MandateInvoice | undefined> {
    const [inv] = await db.select().from(mandateInvoices).where(eq(mandateInvoices.id, id));
    return inv || undefined;
  }

  async getMandateInvoicesByTenant(tenantId: string): Promise<MandateInvoice[]> {
    return db.select().from(mandateInvoices)
      .where(eq(mandateInvoices.tenantId, tenantId))
      .orderBy(desc(mandateInvoices.createdAt));
  }

  async getAllMandateInvoices(): Promise<MandateInvoice[]> {
    return db.select().from(mandateInvoices)
      .where(eq(mandateInvoices.isDeleted, false))
      .orderBy(desc(mandateInvoices.createdAt));
  }

  async updateMandateInvoice(id: string, updates: Partial<MandateInvoice>): Promise<MandateInvoice | undefined> {
    const [updated] = await db.update(mandateInvoices)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(mandateInvoices.id, id))
      .returning();
    return updated || undefined;
  }

  async createMandateActivity(activity: InsertMandateActivity): Promise<MandateActivity> {
    const [created] = await db.insert(mandateActivities).values(activity).returning();
    return created;
  }

  async getMandateActivitiesByTenant(tenantId: string): Promise<MandateActivity[]> {
    return db.select().from(mandateActivities)
      .where(eq(mandateActivities.tenantId, tenantId))
      .orderBy(desc(mandateActivities.createdAt));
  }

  async getMandateActivitiesByOrder(orderId: string): Promise<MandateActivity[]> {
    return db.select().from(mandateActivities)
      .where(eq(mandateActivities.orderId, orderId))
      .orderBy(desc(mandateActivities.createdAt));
  }

  async getMandateActivitiesByInvoice(invoiceId: string): Promise<MandateActivity[]> {
    return db.select().from(mandateActivities)
      .where(eq(mandateActivities.invoiceId, invoiceId))
      .orderBy(desc(mandateActivities.createdAt));
  }

  async createMandateReminder(reminder: InsertMandateReminder): Promise<MandateReminder> {
    const [created] = await db.insert(mandateReminders).values(reminder).returning();
    return created;
  }

  async getMandateRemindersByInvoice(invoiceId: string): Promise<MandateReminder[]> {
    return db.select().from(mandateReminders)
      .where(eq(mandateReminders.invoiceId, invoiceId))
      .orderBy(asc(mandateReminders.reminderLevel));
  }

  async getPendingMandateReminders(): Promise<MandateReminder[]> {
    const now = new Date();
    return db.select().from(mandateReminders)
      .where(and(
        sql`${mandateReminders.scheduledFor} <= ${now}`,
        sql`${mandateReminders.sentAt} IS NULL`,
        eq(mandateReminders.isCancelled, false)
      ))
      .orderBy(asc(mandateReminders.scheduledFor));
  }

  async markMandateReminderSent(id: string): Promise<MandateReminder | undefined> {
    const [updated] = await db.update(mandateReminders)
      .set({ sentAt: new Date() })
      .where(eq(mandateReminders.id, id))
      .returning();
    return updated || undefined;
  }

  async getSubscriptionsNearingExpiry(daysBeforeExpiry: number): Promise<MandateSubscription[]> {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysBeforeExpiry);
    return db.select().from(mandateSubscriptions)
      .where(and(
        eq(mandateSubscriptions.status, "ACTIVE"),
        sql`${mandateSubscriptions.endDate} <= ${targetDate}`,
        sql`${mandateSubscriptions.renewalReminderSentAt} IS NULL`
      ));
  }

  async getExpiredSubscriptions(): Promise<MandateSubscription[]> {
    const now = new Date();
    return db.select().from(mandateSubscriptions)
      .where(and(
        eq(mandateSubscriptions.status, "ACTIVE"),
        sql`${mandateSubscriptions.endDate} < ${now}`
      ));
  }

  async getGracePeriodExpiredSubscriptions(graceDays: number): Promise<MandateSubscription[]> {
    const graceExpiry = new Date();
    graceExpiry.setDate(graceExpiry.getDate() - graceDays);
    return db.select().from(mandateSubscriptions)
      .where(and(
        eq(mandateSubscriptions.status, "GRACE_PERIOD"),
        sql`${mandateSubscriptions.gracePeriodStartedAt} <= ${graceExpiry}`
      ));
  }

  async getAllMandateSubscriptions(): Promise<MandateSubscription[]> {
    return db.select().from(mandateSubscriptions)
      .orderBy(desc(mandateSubscriptions.createdAt));
  }

  async getAllMandateReminders(): Promise<MandateReminder[]> {
    return db.select().from(mandateReminders)
      .orderBy(desc(mandateReminders.createdAt));
  }

  async getMandateReminderById(id: string): Promise<MandateReminder | undefined> {
    const [reminder] = await db.select().from(mandateReminders)
      .where(eq(mandateReminders.id, id));
    return reminder || undefined;
  }

  async getMandateReminderByTenantAndLevel(tenantId: string, level: number): Promise<MandateReminder | undefined> {
    const [reminder] = await db.select().from(mandateReminders)
      .where(and(
        eq(mandateReminders.tenantId, tenantId),
        eq(mandateReminders.reminderLevel, level)
      ));
    return reminder || undefined;
  }

  async getRenewalReminderBySubscriptionAndLevel(subscriptionId: string, level: number): Promise<MandateReminder | undefined> {
    const [reminder] = await db.select().from(mandateReminders)
      .where(and(
        eq(mandateReminders.subscriptionId, subscriptionId),
        eq(mandateReminders.reminderLevel, level),
        eq(mandateReminders.reminderType, "RENEWAL")
      ))
      .limit(1);
    return reminder || undefined;
  }

  async updateMandateReminder(id: string, updates: Partial<MandateReminder>): Promise<MandateReminder | undefined> {
    const [updated] = await db.update(mandateReminders)
      .set(updates)
      .where(eq(mandateReminders.id, id))
      .returning();
    return updated || undefined;
  }

  // Subscription/Trial Renewal Reminders
  async createSubscriptionReminder(reminder: InsertSubscriptionReminder): Promise<SubscriptionReminder> {
    const [created] = await db.insert(subscriptionReminders).values(reminder).returning();
    return created;
  }

  async getSubscriptionRemindersByTenant(tenantId: string): Promise<SubscriptionReminder[]> {
    return db.select().from(subscriptionReminders)
      .where(eq(subscriptionReminders.tenantId, tenantId))
      .orderBy(asc(subscriptionReminders.scheduledFor));
  }

  async getPendingSubscriptionReminders(): Promise<SubscriptionReminder[]> {
    const now = new Date();
    return db.select().from(subscriptionReminders)
      .where(and(
        sql`${subscriptionReminders.scheduledFor} <= ${now}`,
        eq(subscriptionReminders.status, "PENDING")
      ))
      .orderBy(asc(subscriptionReminders.scheduledFor));
  }

  async getExistingSubscriptionReminder(tenantId: string, daysBeforeExpiry: number, expiryDate: Date, context: "TRIAL" | "SUBSCRIPTION"): Promise<SubscriptionReminder | undefined> {
    const [reminder] = await db.select().from(subscriptionReminders)
      .where(and(
        eq(subscriptionReminders.tenantId, tenantId),
        eq(subscriptionReminders.daysBeforeExpiry, daysBeforeExpiry),
        eq(subscriptionReminders.reminderContext, context),
        sql`DATE(${subscriptionReminders.expiryDate}) = DATE(${expiryDate})`
      ))
      .limit(1);
    return reminder || undefined;
  }

  async updateSubscriptionReminder(id: string, updates: Partial<SubscriptionReminder>): Promise<SubscriptionReminder | undefined> {
    const [updated] = await db.update(subscriptionReminders)
      .set(updates)
      .where(eq(subscriptionReminders.id, id))
      .returning();
    return updated || undefined;
  }

  async cancelSubscriptionRemindersForTenant(tenantId: string): Promise<void> {
    await db.update(subscriptionReminders)
      .set({ status: "CANCELLED" })
      .where(and(
        eq(subscriptionReminders.tenantId, tenantId),
        eq(subscriptionReminders.status, "PENDING")
      ));
  }

  async scheduleSubscriptionReminders(tenantId: string, expiryDate: Date, context: "TRIAL" | "SUBSCRIPTION", contactEmail: string): Promise<void> {
    const daysBeforeExpiryList = [30, 15, 7, 2, 1];
    
    for (const daysBeforeExpiry of daysBeforeExpiryList) {
      const scheduledFor = new Date(expiryDate);
      scheduledFor.setDate(scheduledFor.getDate() - daysBeforeExpiry);
      
      // Only schedule if it's in the future
      if (scheduledFor > new Date()) {
        const existing = await this.getExistingSubscriptionReminder(tenantId, daysBeforeExpiry, expiryDate, context);
        if (!existing) {
          await this.createSubscriptionReminder({
            tenantId,
            reminderContext: context,
            daysBeforeExpiry,
            expiryDate,
            scheduledFor,
            status: "PENDING",
            emailTo: contactEmail,
            retryCount: 0,
          });
        }
      }
    }
  }

  // Tenant lifecycle management
  async suspendTenant(tenantId: string, reason: string, suspendedBy: string): Promise<Tenant | undefined> {
    const [updated] = await db.update(tenants)
      .set({
        lifecycleStatus: "SUSPENDED",
        suspendedAt: new Date(),
        suspendedReason: reason,
        suspendedBy: suspendedBy,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId))
      .returning();
    return updated || undefined;
  }

  async unsuspendTenant(tenantId: string): Promise<Tenant | undefined> {
    const [updated] = await db.update(tenants)
      .set({
        lifecycleStatus: "ACTIVE",
        suspendedAt: null,
        suspendedReason: null,
        suspendedBy: null,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId))
      .returning();
    return updated || undefined;
  }

  async archiveTenant(tenantId: string, reason: string, archivedBy: string): Promise<Tenant | undefined> {
    const [updated] = await db.update(tenants)
      .set({
        lifecycleStatus: "ARCHIVED",
        archivedAt: new Date(),
        archivedReason: reason,
        archivedBy: archivedBy,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId))
      .returning();
    return updated || undefined;
  }

  async setTenantFreeStatus(tenantId: string, isFree: boolean): Promise<Tenant | undefined> {
    const [updated] = await db.update(tenants)
      .set({
        isFree: isFree,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId))
      .returning();
    return updated || undefined;
  }

  async getTenantsByLifecycleStatus(status: "ACTIVE" | "SUSPENDED" | "ARCHIVED"): Promise<Tenant[]> {
    return db.select().from(tenants)
      .where(eq(tenants.lifecycleStatus, status))
      .orderBy(desc(tenants.createdAt));
  }

  async deleteArchivedTenant(tenantId: string): Promise<boolean> {
    // First check if tenant is archived
    const tenant = await this.getTenantById(tenantId);
    if (!tenant || tenant.lifecycleStatus !== "ARCHIVED") {
      throw new Error("Seuls les clients archivés peuvent être supprimés");
    }
    // Use existing deleteTenant method which handles cascade
    return this.deleteTenant(tenantId);
  }

  // ==========================================
  // AUDIT LOGS
  // ==========================================

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [newLog] = await db.insert(auditLogs).values(log).returning();
    return newLog;
  }

  async getAuditLogs(filters?: {
    actionType?: string;
    actorId?: string;
    targetType?: string;
    limit?: number;
    offset?: number;
  }): Promise<AuditLog[]> {
    let query = db.select().from(auditLogs);
    
    const conditions = [];
    if (filters?.actionType) {
      conditions.push(eq(auditLogs.actionType, filters.actionType as any));
    }
    if (filters?.actorId) {
      conditions.push(eq(auditLogs.actorId, filters.actorId));
    }
    if (filters?.targetType) {
      conditions.push(eq(auditLogs.targetType, filters.targetType));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    query = query.orderBy(desc(auditLogs.createdAt)) as any;
    
    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }
    if (filters?.offset) {
      query = query.offset(filters.offset) as any;
    }
    
    return query;
  }

  async getAuditLogsCount(filters?: {
    actionType?: string;
    actorId?: string;
    targetType?: string;
  }): Promise<number> {
    const conditions = [];
    if (filters?.actionType) {
      conditions.push(eq(auditLogs.actionType, filters.actionType as any));
    }
    if (filters?.actorId) {
      conditions.push(eq(auditLogs.actorId, filters.actorId));
    }
    if (filters?.targetType) {
      conditions.push(eq(auditLogs.targetType, filters.targetType));
    }
    
    let query = db.select({ count: count() }).from(auditLogs);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    const [result] = await query;
    return result?.count || 0;
  }

  // ==========================================
  // SOFT DELETE MANDATE ORDERS/INVOICES
  // ==========================================

  async softDeleteMandateOrder(orderId: string, deletedBy: string): Promise<MandateOrder | undefined> {
    const [updated] = await db.update(mandateOrders)
      .set({
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: deletedBy,
        updatedAt: new Date(),
      })
      .where(eq(mandateOrders.id, orderId))
      .returning();
    return updated || undefined;
  }

  async softDeleteMandateInvoice(invoiceId: string, deletedBy: string): Promise<MandateInvoice | undefined> {
    const [updated] = await db.update(mandateInvoices)
      .set({
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: deletedBy,
        updatedAt: new Date(),
      })
      .where(eq(mandateInvoices.id, invoiceId))
      .returning();
    return updated || undefined;
  }

  async getAllMandateOrdersIncludingDeleted(): Promise<MandateOrder[]> {
    return db.select().from(mandateOrders)
      .orderBy(desc(mandateOrders.createdAt));
  }

  async getAllMandateInvoicesIncludingDeleted(): Promise<MandateInvoice[]> {
    return db.select().from(mandateInvoices)
      .orderBy(desc(mandateInvoices.createdAt));
  }

  // ==========================================
  // CHORUS PRO CONFIGURATION - DOCUMENT NUMBER FORMATS
  // ==========================================

  async getDocumentNumberFormats(documentType?: string): Promise<DocumentNumberFormat[]> {
    if (documentType) {
      return db.select().from(documentNumberFormats)
        .where(and(
          eq(documentNumberFormats.documentType, documentType as any),
          eq(documentNumberFormats.isActive, true)
        ))
        .orderBy(asc(documentNumberFormats.displayOrder));
    }
    return db.select().from(documentNumberFormats)
      .where(eq(documentNumberFormats.isActive, true))
      .orderBy(asc(documentNumberFormats.displayOrder));
  }

  async getAllDocumentNumberFormats(): Promise<DocumentNumberFormat[]> {
    return db.select().from(documentNumberFormats)
      .orderBy(asc(documentNumberFormats.displayOrder));
  }

  async getDocumentNumberFormatById(id: string): Promise<DocumentNumberFormat | undefined> {
    const [format] = await db.select().from(documentNumberFormats)
      .where(eq(documentNumberFormats.id, id));
    return format || undefined;
  }

  async createDocumentNumberFormat(format: InsertDocumentNumberFormat): Promise<DocumentNumberFormat> {
    const [created] = await db.insert(documentNumberFormats).values(format).returning();
    return created;
  }

  async updateDocumentNumberFormat(id: string, data: Partial<InsertDocumentNumberFormat>): Promise<DocumentNumberFormat | undefined> {
    const [updated] = await db.update(documentNumberFormats)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(documentNumberFormats.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteDocumentNumberFormat(id: string): Promise<boolean> {
    const result = await db.delete(documentNumberFormats)
      .where(eq(documentNumberFormats.id, id));
    return true;
  }

  // ==========================================
  // CHORUS PRO CONFIGURATION - SERVICE CODES
  // ==========================================

  async getServiceCodes(): Promise<ServiceCode[]> {
    return db.select().from(serviceCodes)
      .where(eq(serviceCodes.isActive, true))
      .orderBy(asc(serviceCodes.displayOrder));
  }

  async getAllServiceCodes(): Promise<ServiceCode[]> {
    return db.select().from(serviceCodes)
      .orderBy(asc(serviceCodes.displayOrder));
  }

  async getServiceCodeById(id: string): Promise<ServiceCode | undefined> {
    const [code] = await db.select().from(serviceCodes)
      .where(eq(serviceCodes.id, id));
    return code || undefined;
  }

  async createServiceCode(code: InsertServiceCode): Promise<ServiceCode> {
    const [created] = await db.insert(serviceCodes).values(code).returning();
    return created;
  }

  async updateServiceCode(id: string, data: Partial<InsertServiceCode>): Promise<ServiceCode | undefined> {
    const [updated] = await db.update(serviceCodes)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(serviceCodes.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteServiceCode(id: string): Promise<boolean> {
    await db.delete(serviceCodes)
      .where(eq(serviceCodes.id, id));
    return true;
  }

  // ==========================================
  // TENANT SERVICE CODES
  // ==========================================

  async getTenantServiceCodes(tenantId: string): Promise<TenantServiceCode[]> {
    return db.select().from(tenantServiceCodes)
      .where(and(
        eq(tenantServiceCodes.tenantId, tenantId),
        eq(tenantServiceCodes.isActive, true)
      ))
      .orderBy(asc(tenantServiceCodes.displayOrder));
  }

  async createTenantServiceCode(code: InsertTenantServiceCode): Promise<TenantServiceCode> {
    const [created] = await db.insert(tenantServiceCodes).values(code).returning();
    return created;
  }

  async updateTenantServiceCode(id: string, data: Partial<InsertTenantServiceCode>): Promise<TenantServiceCode | undefined> {
    const [updated] = await db.update(tenantServiceCodes)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(tenantServiceCodes.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteTenantServiceCode(id: string): Promise<boolean> {
    await db.delete(tenantServiceCodes)
      .where(eq(tenantServiceCodes.id, id));
    return true;
  }

  async copyDefaultServiceCodesToTenant(tenantId: string): Promise<TenantServiceCode[]> {
    const defaultCodes = await this.getServiceCodes();
    const created: TenantServiceCode[] = [];
    
    for (const code of defaultCodes) {
      const [tenantCode] = await db.insert(tenantServiceCodes).values({
        tenantId,
        code: code.code,
        name: code.name,
        description: code.description,
        displayOrder: code.displayOrder || 0,
      }).returning();
      created.push(tenantCode);
    }
    
    return created;
  }

  // ==========================================
  // TENANT DOCUMENT NUMBERING CONFIG
  // ==========================================

  async getTenantDocumentNumberingConfig(tenantId: string): Promise<TenantDocumentNumberingConfig[]> {
    return db.select().from(tenantDocumentNumberingConfig)
      .where(eq(tenantDocumentNumberingConfig.tenantId, tenantId));
  }

  async getTenantDocumentNumberingConfigByType(tenantId: string, documentType: string): Promise<TenantDocumentNumberingConfig | undefined> {
    const [config] = await db.select().from(tenantDocumentNumberingConfig)
      .where(and(
        eq(tenantDocumentNumberingConfig.tenantId, tenantId),
        eq(tenantDocumentNumberingConfig.documentType, documentType as any)
      ));
    return config || undefined;
  }

  async createTenantDocumentNumberingConfig(config: InsertTenantDocumentNumberingConfig): Promise<TenantDocumentNumberingConfig> {
    const [created] = await db.insert(tenantDocumentNumberingConfig).values(config).returning();
    return created;
  }

  async updateTenantDocumentNumberingConfig(id: string, data: Partial<InsertTenantDocumentNumberingConfig>): Promise<TenantDocumentNumberingConfig | undefined> {
    const [updated] = await db.update(tenantDocumentNumberingConfig)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(tenantDocumentNumberingConfig.id, id))
      .returning();
    return updated || undefined;
  }

  async setupDefaultNumberingConfigForTenant(
    tenantId: string,
    customDevisFormatId?: string,
    customCommandeFormatId?: string,
    customFactureFormatId?: string,
    customAvoirFormatId?: string
  ): Promise<TenantDocumentNumberingConfig[]> {
    const configs: TenantDocumentNumberingConfig[] = [];
    const allFormats = await this.getAllDocumentNumberFormats();
    const currentYear = new Date().getFullYear();
    
    const documentTypes = [
      { type: 'DEVIS' as const, customFormatId: customDevisFormatId },
      { type: 'COMMANDE' as const, customFormatId: customCommandeFormatId },
      { type: 'FACTURE' as const, customFormatId: customFactureFormatId },
      { type: 'AVOIR' as const, customFormatId: customAvoirFormatId },
    ];
    
    for (const { type, customFormatId } of documentTypes) {
      let formatId = customFormatId;
      
      // Validate custom format ID exists and is of correct type
      if (formatId) {
        const format = allFormats.find(f => f.id === formatId && f.documentType === type && f.isActive);
        if (!format) {
          console.warn(`Invalid ${type} format ID ${formatId}, using default`);
          formatId = undefined;
        }
      }
      
      // Fall back to default if no valid custom ID
      if (!formatId) {
        const defaultFormat = allFormats.find(f => f.documentType === type && f.isDefault && f.isActive);
        if (defaultFormat) formatId = defaultFormat.id;
      }
      
      if (formatId) {
        const [config] = await db.insert(tenantDocumentNumberingConfig).values({
          tenantId,
          documentType: type,
          formatId,
          currentSequence: 0,
          lastResetYear: currentYear,
        }).returning();
        configs.push(config);
      }
    }
    
    return configs;
  }

  // =====================================================
  // ELU FUNCTIONS
  // =====================================================
  async getEluFunctions(): Promise<EluFunction[]> {
    return db.select().from(eluFunctions)
      .where(eq(eluFunctions.isActive, true))
      .orderBy(asc(eluFunctions.displayOrder));
  }

  async getAllEluFunctions(): Promise<EluFunction[]> {
    return db.select().from(eluFunctions)
      .orderBy(asc(eluFunctions.displayOrder));
  }

  async getEluFunctionById(id: string): Promise<EluFunction | undefined> {
    const [fn] = await db.select().from(eluFunctions)
      .where(eq(eluFunctions.id, id));
    return fn || undefined;
  }

  async createEluFunction(fn: InsertEluFunction): Promise<EluFunction> {
    const [created] = await db.insert(eluFunctions).values(fn).returning();
    return created;
  }

  async updateEluFunction(id: string, data: Partial<InsertEluFunction>): Promise<EluFunction | undefined> {
    const [updated] = await db.update(eluFunctions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(eluFunctions.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteEluFunction(id: string): Promise<boolean> {
    await db.delete(eluFunctions)
      .where(eq(eluFunctions.id, id));
    return true;
  }

  // =====================================================
  // BUREAU MEMBER FUNCTIONS
  // =====================================================
  async getBureauMemberFunctions(): Promise<BureauMemberFunction[]> {
    return db.select().from(bureauMemberFunctions)
      .where(eq(bureauMemberFunctions.isActive, true))
      .orderBy(asc(bureauMemberFunctions.displayOrder));
  }

  async getAllBureauMemberFunctions(): Promise<BureauMemberFunction[]> {
    return db.select().from(bureauMemberFunctions)
      .orderBy(asc(bureauMemberFunctions.displayOrder));
  }

  async getBureauMemberFunctionById(id: string): Promise<BureauMemberFunction | undefined> {
    const [fn] = await db.select().from(bureauMemberFunctions)
      .where(eq(bureauMemberFunctions.id, id));
    return fn || undefined;
  }

  async createBureauMemberFunction(fn: InsertBureauMemberFunction): Promise<BureauMemberFunction> {
    const [created] = await db.insert(bureauMemberFunctions).values(fn).returning();
    return created;
  }

  async updateBureauMemberFunction(id: string, data: Partial<InsertBureauMemberFunction>): Promise<BureauMemberFunction | undefined> {
    const [updated] = await db.update(bureauMemberFunctions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(bureauMemberFunctions.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteBureauMemberFunction(id: string): Promise<boolean> {
    await db.delete(bureauMemberFunctions)
      .where(eq(bureauMemberFunctions.id, id));
    return true;
  }

  // =====================================================
  // GLOBAL MUNICIPALITY DOMAINS
  // =====================================================
  async getActiveGlobalMunicipalityDomains(): Promise<GlobalMunicipalityDomain[]> {
    return db.select().from(globalMunicipalityDomains)
      .where(eq(globalMunicipalityDomains.isActive, true))
      .orderBy(asc(globalMunicipalityDomains.displayOrder));
  }

  async getAllGlobalMunicipalityDomains(): Promise<GlobalMunicipalityDomain[]> {
    return db.select().from(globalMunicipalityDomains)
      .orderBy(asc(globalMunicipalityDomains.displayOrder));
  }

  async createGlobalMunicipalityDomain(domain: InsertGlobalMunicipalityDomain): Promise<GlobalMunicipalityDomain> {
    const [created] = await db.insert(globalMunicipalityDomains).values(domain).returning();
    return created;
  }

  async updateGlobalMunicipalityDomain(id: string, data: Partial<InsertGlobalMunicipalityDomain>): Promise<GlobalMunicipalityDomain | undefined> {
    const [updated] = await db.update(globalMunicipalityDomains)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(globalMunicipalityDomains.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteGlobalMunicipalityDomain(id: string): Promise<boolean> {
    await db.delete(globalMunicipalityDomains)
      .where(eq(globalMunicipalityDomains.id, id));
    return true;
  }

  // =====================================================
  // GLOBAL ASSOCIATION DOMAINS
  // =====================================================
  async getActiveGlobalAssociationDomains(): Promise<GlobalAssociationDomain[]> {
    return db.select().from(globalAssociationDomains)
      .where(eq(globalAssociationDomains.isActive, true))
      .orderBy(asc(globalAssociationDomains.displayOrder));
  }

  async getAllGlobalAssociationDomains(): Promise<GlobalAssociationDomain[]> {
    return db.select().from(globalAssociationDomains)
      .orderBy(asc(globalAssociationDomains.displayOrder));
  }

  async createGlobalAssociationDomain(domain: InsertGlobalAssociationDomain): Promise<GlobalAssociationDomain> {
    const [created] = await db.insert(globalAssociationDomains).values(domain).returning();
    return created;
  }

  async updateGlobalAssociationDomain(id: string, data: Partial<InsertGlobalAssociationDomain>): Promise<GlobalAssociationDomain | undefined> {
    const [updated] = await db.update(globalAssociationDomains)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(globalAssociationDomains.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteGlobalAssociationDomain(id: string): Promise<boolean> {
    await db.delete(globalAssociationDomains)
      .where(eq(globalAssociationDomains.id, id));
    return true;
  }

  // =====================================================
  // GLOBAL EVENT TYPES
  // =====================================================
  async getActiveGlobalEventTypes(): Promise<GlobalEventType[]> {
    return db.select().from(globalEventTypes)
      .where(eq(globalEventTypes.isActive, true))
      .orderBy(asc(globalEventTypes.displayOrder));
  }

  async getAllGlobalEventTypes(): Promise<GlobalEventType[]> {
    return db.select().from(globalEventTypes)
      .orderBy(asc(globalEventTypes.displayOrder));
  }

  async getGlobalEventTypeById(id: string): Promise<GlobalEventType | undefined> {
    const [eventType] = await db.select().from(globalEventTypes)
      .where(eq(globalEventTypes.id, id));
    return eventType || undefined;
  }

  async getGlobalEventTypeByCode(code: string): Promise<GlobalEventType | undefined> {
    const [eventType] = await db.select().from(globalEventTypes)
      .where(eq(globalEventTypes.code, code));
    return eventType || undefined;
  }

  async createGlobalEventType(eventType: InsertGlobalEventType): Promise<GlobalEventType> {
    const [created] = await db.insert(globalEventTypes).values(eventType).returning();
    return created;
  }

  async updateGlobalEventType(id: string, data: Partial<InsertGlobalEventType>): Promise<GlobalEventType | undefined> {
    const [updated] = await db.update(globalEventTypes)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(globalEventTypes.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteGlobalEventType(id: string): Promise<boolean> {
    await db.delete(globalEventTypes)
      .where(eq(globalEventTypes.id, id));
    return true;
  }

  // =====================================================
  // EVENT IMAGES
  // =====================================================
  async getTenantEventImages(eventId: string): Promise<TenantEventImage[]> {
    return db.select().from(tenantEventImages)
      .where(eq(tenantEventImages.eventId, eventId))
      .orderBy(asc(tenantEventImages.sortOrder));
  }

  async createTenantEventImage(image: InsertTenantEventImage): Promise<TenantEventImage> {
    const [created] = await db.insert(tenantEventImages).values(image).returning();
    return created;
  }

  async getTenantEventImageById(id: string): Promise<TenantEventImage | undefined> {
    const [image] = await db.select().from(tenantEventImages)
      .where(eq(tenantEventImages.id, id));
    return image;
  }

  async deleteTenantEventImage(id: string): Promise<boolean> {
    await db.delete(tenantEventImages)
      .where(eq(tenantEventImages.id, id));
    return true;
  }

  async getAssociationEventImages(eventId: string): Promise<AssociationEventImage[]> {
    return db.select().from(associationEventImages)
      .where(eq(associationEventImages.eventId, eventId))
      .orderBy(asc(associationEventImages.sortOrder));
  }

  async createAssociationEventImage(image: InsertAssociationEventImage): Promise<AssociationEventImage> {
    const [created] = await db.insert(associationEventImages).values(image).returning();
    return created;
  }

  async getAssociationEventImageById(id: string): Promise<AssociationEventImage | undefined> {
    const [image] = await db.select().from(associationEventImages)
      .where(eq(associationEventImages.id, id));
    return image;
  }

  async deleteAssociationEventImage(id: string): Promise<boolean> {
    await db.delete(associationEventImages)
      .where(eq(associationEventImages.id, id));
    return true;
  }

  // =====================================================
  // EVENT REGISTRATIONS
  // =====================================================
  async getTenantEventRegistrations(eventId: string): Promise<TenantEventRegistration[]> {
    return db.select().from(tenantEventRegistrations)
      .where(eq(tenantEventRegistrations.eventId, eventId))
      .orderBy(desc(tenantEventRegistrations.createdAt));
  }

  async getTenantEventRegistrationsCount(eventId: string): Promise<number> {
    const result = await db.select({ total: sql<number>`COALESCE(SUM(${tenantEventRegistrations.numberOfGuests}), 0)` })
      .from(tenantEventRegistrations)
      .where(eq(tenantEventRegistrations.eventId, eventId));
    return Number(result[0]?.total || 0);
  }

  async createTenantEventRegistration(registration: InsertTenantEventRegistration): Promise<TenantEventRegistration> {
    const [created] = await db.insert(tenantEventRegistrations).values(registration).returning();
    return created;
  }

  async deleteTenantEventRegistration(id: string): Promise<boolean> {
    await db.delete(tenantEventRegistrations)
      .where(eq(tenantEventRegistrations.id, id));
    return true;
  }

  // =====================================================
  // ASSOCIATION EVENT REGISTRATIONS
  // =====================================================
  async getAssociationEventRegistrations(eventId: string): Promise<AssociationEventRegistration[]> {
    return db.select().from(associationEventRegistrations)
      .where(eq(associationEventRegistrations.eventId, eventId))
      .orderBy(desc(associationEventRegistrations.createdAt));
  }

  async getAssociationEventRegistrationsCount(eventId: string): Promise<number> {
    const result = await db.select({ total: sql<number>`COALESCE(SUM(${associationEventRegistrations.numberOfGuests}), 0)` })
      .from(associationEventRegistrations)
      .where(eq(associationEventRegistrations.eventId, eventId));
    return Number(result[0]?.total || 0);
  }

  async createAssociationEventRegistration(registration: InsertAssociationEventRegistration): Promise<AssociationEventRegistration> {
    const [created] = await db.insert(associationEventRegistrations).values(registration).returning();
    return created;
  }

  async deleteAssociationEventRegistration(id: string): Promise<boolean> {
    await db.delete(associationEventRegistrations)
      .where(eq(associationEventRegistrations.id, id));
    return true;
  }

  // =====================================================
  // EVENT IDEAS LINKING
  // =====================================================
  async getTenantEventIdeas(eventId: string): Promise<TenantEventIdea[]> {
    return db.select().from(tenantEventIdeas)
      .where(eq(tenantEventIdeas.eventId, eventId));
  }

  async createTenantEventIdea(link: InsertTenantEventIdea): Promise<TenantEventIdea> {
    const [created] = await db.insert(tenantEventIdeas).values(link).returning();
    return created;
  }

  async deleteTenantEventIdea(eventId: string, ideaId: string): Promise<boolean> {
    await db.delete(tenantEventIdeas)
      .where(and(
        eq(tenantEventIdeas.eventId, eventId),
        eq(tenantEventIdeas.ideaId, ideaId)
      ));
    return true;
  }

  // =====================================================
  // CHAT THREADS & MESSAGES
  // =====================================================
  async createChatThread(thread: InsertChatThread): Promise<ChatThread> {
    const publicToken = crypto.randomBytes(32).toString('hex');
    const officialToken = crypto.randomBytes(32).toString('hex');
    const [created] = await db.insert(chatThreads).values({
      ...thread,
      publicToken,
      officialToken,
    }).returning();
    return created;
  }

  async getChatThreadById(id: string): Promise<ChatThread | undefined> {
    const [thread] = await db.select().from(chatThreads)
      .where(eq(chatThreads.id, id));
    return thread || undefined;
  }

  async getChatThreadByPublicToken(token: string): Promise<ChatThread | undefined> {
    const [thread] = await db.select().from(chatThreads)
      .where(eq(chatThreads.publicToken, token));
    return thread || undefined;
  }

  async getChatThreadByOfficialToken(token: string): Promise<ChatThread | undefined> {
    const [thread] = await db.select().from(chatThreads)
      .where(eq(chatThreads.officialToken, token));
    return thread || undefined;
  }

  async getChatThreadsBySubject(subjectType: string, subjectId: string): Promise<ChatThread[]> {
    return db.select().from(chatThreads)
      .where(and(
        eq(chatThreads.subjectType, subjectType as any),
        eq(chatThreads.subjectId, subjectId)
      ))
      .orderBy(desc(chatThreads.createdAt));
  }

  async getChatThreadsByRequesterEmail(email: string): Promise<ChatThread[]> {
    return db.select().from(chatThreads)
      .where(eq(chatThreads.requesterEmail, email))
      .orderBy(desc(chatThreads.createdAt));
  }

  async updateChatThreadStatus(id: string, status: "OPEN" | "CLOSED"): Promise<ChatThread | undefined> {
    const [updated] = await db.update(chatThreads)
      .set({ status, updatedAt: new Date() })
      .where(eq(chatThreads.id, id))
      .returning();
    return updated || undefined;
  }

  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const [created] = await db.insert(chatMessages).values(message).returning();
    await db.update(chatThreads)
      .set({ updatedAt: new Date() })
      .where(eq(chatThreads.id, message.threadId));
    return created;
  }

  async getChatMessagesByThread(threadId: string): Promise<ChatMessage[]> {
    return db.select().from(chatMessages)
      .where(eq(chatMessages.threadId, threadId))
      .orderBy(asc(chatMessages.createdAt));
  }

  async markChatMessagesAsRead(threadId: string, senderType: string): Promise<void> {
    await db.update(chatMessages)
      .set({ isRead: true })
      .where(and(
        eq(chatMessages.threadId, threadId),
        sql`${chatMessages.senderType} != ${senderType}`
      ));
  }

  async getUnreadChatMessagesCount(subjectType: string, subjectId: string): Promise<number> {
    const threads = await this.getChatThreadsBySubject(subjectType, subjectId);
    let total = 0;
    for (const thread of threads) {
      const [result] = await db.select({ count: count() }).from(chatMessages)
        .where(and(
          eq(chatMessages.threadId, thread.id),
          eq(chatMessages.isRead, false),
          eq(chatMessages.senderType, "requester")
        ));
      total += result?.count || 0;
    }
    return total;
  }

  // Enhanced profile fetching with domains
  async getElectedOfficialWithDomains(id: string): Promise<{ official: ElectedOfficial; domains: GlobalMunicipalityDomain[] } | undefined> {
    const official = await this.getElectedOfficialById(id);
    if (!official) return undefined;
    
    const domainLinks = await db.select().from(electedOfficialDomains)
      .where(eq(electedOfficialDomains.electedOfficialId, id));
    
    const domains: GlobalMunicipalityDomain[] = [];
    for (const link of domainLinks) {
      const [domain] = await db.select().from(globalMunicipalityDomains)
        .where(eq(globalMunicipalityDomains.id, link.domainId));
      if (domain) domains.push(domain);
    }
    
    return { official, domains };
  }

  async getBureauMemberWithDomains(id: string): Promise<{ member: BureauMember; domains: GlobalAssociationDomain[] } | undefined> {
    const member = await this.getBureauMemberById(id);
    if (!member) return undefined;
    
    const domainLinks = await db.select().from(bureauMemberDomains)
      .where(eq(bureauMemberDomains.bureauMemberId, id));
    
    const domains: GlobalAssociationDomain[] = [];
    for (const link of domainLinks) {
      const [domain] = await db.select().from(globalAssociationDomains)
        .where(eq(globalAssociationDomains.id, link.domainId));
      if (domain) domains.push(domain);
    }
    
    return { member, domains };
  }

  // Activity Logs
  async createActivityLog(log: InsertActivityLog): Promise<ActivityLog> {
    const [created] = await db.insert(activityLogs).values(log).returning();
    return created;
  }

  async getActivityLogs(limit: number = 100, offset: number = 0): Promise<ActivityLog[]> {
    return db.select().from(activityLogs)
      .orderBy(desc(activityLogs.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getActivityLogsByDeviceId(deviceId: string): Promise<ActivityLog[]> {
    return db.select().from(activityLogs)
      .where(eq(activityLogs.deviceId, deviceId))
      .orderBy(desc(activityLogs.createdAt));
  }

  async getActivityLogsCount(): Promise<number> {
    const [result] = await db.select({ count: count() }).from(activityLogs);
    return result?.count || 0;
  }

  // Blocked Devices
  async createBlockedDevice(device: InsertBlockedDevice): Promise<BlockedDevice> {
    const [created] = await db.insert(blockedDevices).values(device).returning();
    return created;
  }

  async getBlockedDeviceByDeviceId(deviceId: string): Promise<BlockedDevice | undefined> {
    const [device] = await db.select().from(blockedDevices)
      .where(and(eq(blockedDevices.deviceId, deviceId), eq(blockedDevices.isActive, true)));
    return device;
  }

  async getAllBlockedDevices(): Promise<BlockedDevice[]> {
    return db.select().from(blockedDevices)
      .orderBy(desc(blockedDevices.createdAt));
  }

  async unblockDevice(deviceId: string): Promise<BlockedDevice | undefined> {
    const [updated] = await db.update(blockedDevices)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(blockedDevices.deviceId, deviceId))
      .returning();
    return updated;
  }

  async deleteActivityLogsByDeviceId(deviceId: string): Promise<void> {
    await db.delete(activityLogs).where(eq(activityLogs.deviceId, deviceId));
  }
}

export const storage = new DatabaseStorage();
