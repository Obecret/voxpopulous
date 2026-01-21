import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, pgEnum, boolean, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userRoleEnum = pgEnum("user_role", ["ADMIN", "MODERATOR"]);
export const subscriptionPlanEnum = pgEnum("subscription_plan", ["FREE_TRIAL", "STANDARD", "PREMIUM"]);
export const billingStatusEnum = pgEnum("billing_status", ["TRIAL", "ACTIVE", "SUSPENDED", "CANCELLED"]);
export const ideaStatusEnum = pgEnum("idea_status", ["NEW", "UNDER_REVIEW", "IN_PROGRESS", "DONE", "REJECTED"]);
export const incidentStatusEnum = pgEnum("incident_status", ["NEW", "ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED", "REJECTED"]);
export const meetingStatusEnum = pgEnum("meeting_status", ["SCHEDULED", "COMPLETED", "CANCELLED"]);
export const leadStatusEnum = pgEnum("lead_status", ["NEW", "CONTACTED", "CONVERTED", "IGNORED"]);
export const billingIntervalEnum = pgEnum("billing_interval", ["MONTHLY", "YEARLY"]);
export const quoteStatusEnum = pgEnum("quote_status", ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"]);
export const invoiceStatusEnum = pgEnum("invoice_status", ["DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED"]);
export const paymentMethodEnum = pgEnum("payment_method", ["STRIPE", "BANK_TRANSFER", "CHECK", "ADMINISTRATIVE_MANDATE"]);
export const paymentStatusEnum = pgEnum("payment_status", ["PENDING", "COMPLETED", "FAILED", "REFUNDED"]);
export const productTypeEnum = pgEnum("product_type", ["SUBSCRIPTION", "SERVICE", "ONE_TIME"]);
export const tenantTypeEnum = pgEnum("tenant_type", ["MAIRIE", "EPCI", "ASSOCIATION"]);
export const quoteSourceEnum = pgEnum("quote_source", ["PROSPECT_CONTACT", "TRIAL_CONVERSION", "MANUAL"]);
export const tenantLifecycleStatusEnum = pgEnum("tenant_lifecycle_status", ["ACTIVE", "SUSPENDED", "ARCHIVED"]);
export const leadPipelineStageEnum = pgEnum("lead_pipeline_stage", ["NEW", "CONTACTED", "QUOTED", "AWAITING_DECISION", "AWAITING_PAYMENT", "CONVERTED", "LOST"]);
export const leadMessageSenderTypeEnum = pgEnum("lead_message_sender_type", ["SUPERADMIN", "LEAD"]);
export const paymentSelectionStatusEnum = pgEnum("payment_selection_status", ["PENDING", "MANDATE_SELECTED", "STRIPE_SELECTED"]);

export const superadmins = pgTable("superadmins", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const stripeModeEnum = pgEnum("stripe_mode", ["test", "live"]);

export const superadminSettings = pgTable("superadmin_settings", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  themeKey: text("theme_key").notNull().default("blue"),
  stripeMode: stripeModeEnum("stripe_mode").notNull().default("test"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const legalEntitySettings = pgTable("legal_entity_settings", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  raisonSociale: text("raison_sociale"),
  formeJuridique: text("forme_juridique"),
  capitalSocial: text("capital_social"),
  siret: text("siret"),
  rcsVille: text("rcs_ville"),
  rcsNumero: text("rcs_numero"),
  tvaIntracommunautaire: text("tva_intracommunautaire"),
  siegeAdresse: text("siege_adresse"),
  directeurNom: text("directeur_nom"),
  directeurFonction: text("directeur_fonction"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  dpoEmail: text("dpo_email"),
  dpoAdresse: text("dpo_adresse"),
  mediateur: text("mediateur"),
  tribunalCompetent: text("tribunal_competent"),
  hebergeurNom: text("hebergeur_nom"),
  hebergeurAdresse: text("hebergeur_adresse"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertLegalEntitySettingsSchema = createInsertSchema(legalEntitySettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertLegalEntitySettings = z.infer<typeof insertLegalEntitySettingsSchema>;
export type LegalEntitySettings = typeof legalEntitySettings.$inferSelect;

export const tenants = pgTable("tenants", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  tenantType: tenantTypeEnum("tenant_type").notNull().default("MAIRIE"),
  parentEpciId: varchar("parent_epci_id", { length: 36 }),
  parentTenantId: varchar("parent_tenant_id", { length: 36 }),
  contactEmail: text("contact_email"),
  contactName: text("contact_name"),
  contactAddress: text("contact_address"),
  siret: text("siret"),
  epci: text("epci"),
  presentationText: text("presentation_text"),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color"),
  secondaryColor: text("secondary_color"),
  accentColor: text("accent_color"),
  backgroundColor: text("background_color"),
  subscriptionPlan: subscriptionPlanEnum("subscription_plan").notNull().default("FREE_TRIAL"),
  subscriptionPlanId: varchar("subscription_plan_id", { length: 36 }),
  billingInterval: billingIntervalEnum("billing_interval"),
  billingStatus: billingStatusEnum("billing_status").notNull().default("TRIAL"),
  trialEndsAt: timestamp("trial_ends_at"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripeDefaultPaymentMethodId: text("stripe_default_payment_method_id"),
  stripeSetupIntentId: text("stripe_setup_intent_id"),
  // Purchased quantities (in addition to plan included quantities)
  purchasedCommunes: integer("purchased_communes").notNull().default(0),
  purchasedAssociations: integer("purchased_associations").notNull().default(0),
  purchasedAdmins: integer("purchased_admins").notNull().default(0),
  // Administrative mandate billing info
  mandateBillingAddress: text("mandate_billing_address"),
  mandateBillingService: text("mandate_billing_service"),
  mandateAccountingContactName: text("mandate_accounting_contact_name"),
  mandateAccountingContactEmail: text("mandate_accounting_contact_email"),
  mandateAccountingContactPhone: text("mandate_accounting_contact_phone"),
  mandateServiceCode: text("mandate_service_code"),
  mandateEngagementNumber: text("mandate_engagement_number"),
  mandatePurchaseOrderNumber: text("mandate_purchase_order_number"),
  mandateUseChorusPro: boolean("mandate_use_chorus_pro").default(false),
  mandateChorusProSiret: text("mandate_chorus_pro_siret"),
  mandateChorusProServiceCode: text("mandate_chorus_pro_service_code"),
  mandateChorusProServiceLabel: text("mandate_chorus_pro_service_label"),
  mandateChorusProEngagementNumber: text("mandate_chorus_pro_engagement_number"),
  mandatePurchaseOrderFormatId: varchar("mandate_purchase_order_format_id", { length: 36 }),
  mandateEngagementFormatId: varchar("mandate_engagement_format_id", { length: 36 }),
  // Lifecycle management
  lifecycleStatus: tenantLifecycleStatusEnum("lifecycle_status").notNull().default("ACTIVE"),
  isFree: boolean("is_free").notNull().default(false),
  suspendedAt: timestamp("suspended_at"),
  suspendedReason: text("suspended_reason"),
  suspendedBy: varchar("suspended_by", { length: 36 }),
  archivedAt: timestamp("archived_at"),
  archivedReason: text("archived_reason"),
  archivedBy: varchar("archived_by", { length: 36 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull().default("ADMIN"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const leads = pgTable("leads", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  organisationName: text("organisation_name").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  message: text("message"),
  status: leadStatusEnum("status").notNull().default("NEW"),
  pipelineStage: leadPipelineStageEnum("pipeline_stage").notNull().default("NEW"),
  tenantType: tenantTypeEnum("tenant_type"),
  assignedSuperadminId: varchar("assigned_superadmin_id", { length: 36 }).references(() => superadmins.id),
  lastContactedAt: timestamp("last_contacted_at"),
  lastMessageAt: timestamp("last_message_at"),
  convertedTenantId: varchar("converted_tenant_id", { length: 36 }),
  publicToken: text("public_token").unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const leadMessages = pgTable("lead_messages", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id", { length: 36 }).notNull().references(() => leads.id),
  senderType: leadMessageSenderTypeEnum("sender_type").notNull(),
  senderSuperadminId: varchar("sender_superadmin_id", { length: 36 }).references(() => superadmins.id),
  senderEmail: text("sender_email"),
  subject: text("subject"),
  body: text("body").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const ideas = pgTable("ideas", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  domainId: varchar("domain_id", { length: 36 }),
  status: ideaStatusEnum("status").notNull().default("NEW"),
  createdByEmail: text("created_by_email"),
  anonymousSubmitterId: text("anonymous_submitter_id"),
  publicToken: text("public_token").notNull().unique(),
  votesCount: integer("votes_count").notNull().default(0),
  upVotesCount: integer("up_votes_count").notNull().default(0),
  downVotesCount: integer("down_votes_count").notNull().default(0),
  isArchived: boolean("is_archived").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const ideaVotes = pgTable("idea_votes", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  ideaId: varchar("idea_id", { length: 36 }).notNull().references(() => ideas.id),
  voterIp: text("voter_ip"),
  voterEmail: text("voter_email"),
  anonymousVoterId: text("anonymous_voter_id"),
  voteType: text("vote_type").notNull().default("up"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const incidents = pgTable("incidents", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  domainId: varchar("domain_id", { length: 36 }),
  status: incidentStatusEnum("status").notNull().default("NEW"),
  locationText: text("location_text").notNull(),
  latitude: real("latitude"),
  longitude: real("longitude"),
  photoUrl: text("photo_url"),
  createdByEmail: text("created_by_email"),
  anonymousSubmitterId: text("anonymous_submitter_id"),
  publicToken: text("public_token").notNull().unique(),
  isArchived: boolean("is_archived").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const meetings = pgTable("meetings", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id),
  title: text("title").notNull(),
  description: text("description"),
  dateTime: timestamp("date_time").notNull(),
  location: text("location").notNull(),
  status: meetingStatusEnum("status").notNull().default("SCHEDULED"),
  capacity: integer("capacity"),
  domainId: varchar("domain_id", { length: 36 }),
  isArchived: boolean("is_archived").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const meetingIdeas = pgTable("meeting_ideas", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  meetingId: varchar("meeting_id", { length: 36 }).notNull().references(() => meetings.id),
  ideaId: varchar("idea_id", { length: 36 }).notNull().references(() => ideas.id),
});

export const meetingRegistrations = pgTable("meeting_registrations", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  meetingId: varchar("meeting_id", { length: 36 }).notNull().references(() => meetings.id),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const subscriptionPlans = pgTable("subscription_plans", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  description: text("description"),
  monthlyPrice: integer("monthly_price").notNull(),
  yearlyPrice: integer("yearly_price").notNull(),
  hasIdeas: boolean("has_ideas").notNull().default(true),
  hasIncidents: boolean("has_incidents").notNull().default(true),
  hasMeetings: boolean("has_meetings").notNull().default(true),
  maxAdmins: integer("max_admins").notNull().default(1),
  associationsIncluded: integer("associations_included").notNull().default(0),
  communesIncluded: integer("communes_included").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  isFree: boolean("is_free").notNull().default(false),
  isBestValue: boolean("is_best_value").notNull().default(false),
  hasPromo: boolean("has_promo").notNull().default(false),
  promoPercent: integer("promo_percent").default(0),
  displayOrder: integer("display_order").notNull().default(0),
  stripePriceIdMonthlyTest: text("stripe_price_id_monthly_test"),
  stripePriceIdYearlyTest: text("stripe_price_id_yearly_test"),
  stripePriceIdMonthlyLive: text("stripe_price_id_monthly_live"),
  stripePriceIdYearlyLive: text("stripe_price_id_yearly_live"),
  targetTenantTypes: text("target_tenant_types").array(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const planFeatures = pgTable("plan_features", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  planId: varchar("plan_id", { length: 36 }).notNull().references(() => subscriptionPlans.id),
  label: text("label").notNull(),
  included: boolean("included").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const features = pgTable("features", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  description: text("description"),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const planFeatureAssignments = pgTable("plan_feature_assignments", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  planId: varchar("plan_id", { length: 36 }).notNull().references(() => subscriptionPlans.id),
  featureId: varchar("feature_id", { length: 36 }).notNull().references(() => features.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Addons with flat pricing (e.g., Associations, Admins, Communes)
// Prices are stored in euros (not centimes) - per unit, per month/year
export const addons = pgTable("addons", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  description: text("description"),
  defaultMonthlyPrice: real("default_monthly_price").notNull().default(0),
  defaultYearlyPrice: real("default_yearly_price").notNull().default(0),
  stripePriceIdMonthlyTest: text("stripe_price_id_monthly_test"),
  stripePriceIdYearlyTest: text("stripe_price_id_yearly_test"),
  stripePriceIdMonthlyLive: text("stripe_price_id_monthly_live"),
  stripePriceIdYearlyLive: text("stripe_price_id_yearly_live"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Plan-Addon access control (which addons are available for each plan)
// monthlyPrice/yearlyPrice: per-plan price overrides (null = use addon default)
export const planAddonAccess = pgTable("plan_addon_access", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  planId: varchar("plan_id", { length: 36 }).notNull().references(() => subscriptionPlans.id),
  addonId: varchar("addon_id", { length: 36 }).notNull().references(() => addons.id),
  isEnabled: boolean("is_enabled").notNull().default(true),
  monthlyPrice: real("monthly_price"),
  yearlyPrice: real("yearly_price"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Tenant addon subscriptions - tracks quantity purchased per addon
export const tenantAddons = pgTable("tenant_addons", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id),
  addonId: varchar("addon_id", { length: 36 }).notNull().references(() => addons.id),
  quantity: integer("quantity").notNull().default(1),
  pendingQuantity: integer("pending_quantity"),
  pendingEffectiveDate: timestamp("pending_effective_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Billing change status enum
export const billingChangeStatusEnum = pgEnum("billing_change_status", ["PENDING", "APPLIED", "CANCELLED"]);
export const billingChangeTypeEnum = pgEnum("billing_change_type", ["PLAN_CHANGE", "ADDON_CHANGE"]);
export const ledgerEntryTypeEnum = pgEnum("ledger_entry_type", ["CREDIT", "DEBIT"]);

// Tenant billing changes - tracks scheduled plan/addon changes
export const tenantBillingChanges = pgTable("tenant_billing_changes", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id),
  changeType: billingChangeTypeEnum("change_type").notNull(),
  status: billingChangeStatusEnum("status").notNull().default("PENDING"),
  // For plan changes
  fromPlanId: varchar("from_plan_id", { length: 36 }),
  toPlanId: varchar("to_plan_id", { length: 36 }),
  fromBillingInterval: billingIntervalEnum("from_billing_interval"),
  toBillingInterval: billingIntervalEnum("to_billing_interval"),
  // For addon changes
  addonId: varchar("addon_id", { length: 36 }),
  fromQuantity: integer("from_quantity"),
  toQuantity: integer("to_quantity"),
  // Scheduling
  effectiveDate: timestamp("effective_date").notNull(),
  // Proration amounts (in euros)
  prorataCredit: real("prorata_credit").default(0),
  prorataDebit: real("prorata_debit").default(0),
  // Payment method for this change
  paymentMethod: paymentMethodEnum("payment_method").notNull().default("STRIPE"),
  // Tracking
  appliedAt: timestamp("applied_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Billing ledger entries - tracks credits and debits for proration
export const billingLedgerEntries = pgTable("billing_ledger_entries", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id),
  billingChangeId: varchar("billing_change_id", { length: 36 }),
  invoiceId: varchar("invoice_id", { length: 36 }),
  entryType: ledgerEntryTypeEnum("entry_type").notNull(),
  amount: real("amount").notNull(),
  description: text("description").notNull(),
  appliedToInvoice: boolean("applied_to_invoice").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Tenant billing preferences
export const tenantBillingPreferences = pgTable("tenant_billing_preferences", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id).unique(),
  preferredPaymentMethod: paymentMethodEnum("preferred_payment_method").notNull().default("STRIPE"),
  poNumber: text("po_number"),
  notes: text("notes"),
  billingAddress: text("billing_address"),
  billingService: text("billing_service"),
  accountingContactName: text("accounting_contact_name"),
  accountingContactEmail: text("accounting_contact_email"),
  accountingContactPhone: text("accounting_contact_phone"),
  serviceCode: text("service_code"),
  engagementNumber: text("engagement_number"),
  purchaseOrderNumber: text("purchase_order_number"),
  useChorusPro: boolean("use_chorus_pro").notNull().default(false),
  chorusProRecipientSiret: text("chorus_pro_recipient_siret"),
  chorusProServiceCode: text("chorus_pro_service_code"),
  chorusProServiceLabel: text("chorus_pro_service_label"),
  chorusProEngagementNumber: text("chorus_pro_engagement_number"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Associations - sub-tenants under municipalities
export const associationRoleEnum = pgEnum("association_role", ["ADMIN", "MEMBER"]);

export const associations = pgTable("associations", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  contactEmail: text("contact_email"),
  logoUrl: text("logo_url"),
  logoIcon: text("logo_icon"),
  primaryColor: text("primary_color"),
  secondaryColor: text("secondary_color"),
  accentColor: text("accent_color"),
  backgroundColor: text("background_color"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const associationUsers = pgTable("association_users", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id", { length: 36 }).notNull().references(() => associations.id),
  name: text("name").notNull(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: associationRoleEnum("role").notNull().default("ADMIN"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Association Ideas - same as tenant ideas but for associations
export const associationIdeas = pgTable("association_ideas", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id", { length: 36 }).notNull().references(() => associations.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  status: ideaStatusEnum("status").notNull().default("NEW"),
  createdByEmail: text("created_by_email"),
  publicToken: text("public_token").notNull().unique(),
  votesCount: integer("votes_count").notNull().default(0),
  upVotesCount: integer("up_votes_count").notNull().default(0),
  downVotesCount: integer("down_votes_count").notNull().default(0),
  isArchived: boolean("is_archived").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const associationIdeaVotes = pgTable("association_idea_votes", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  ideaId: varchar("idea_id", { length: 36 }).notNull().references(() => associationIdeas.id),
  voterIp: text("voter_ip"),
  voterEmail: text("voter_email"),
  anonymousVoterId: text("anonymous_voter_id"),
  voteType: text("vote_type").notNull().default("up"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Association Incidents - same as tenant incidents but for associations
export const associationIncidents = pgTable("association_incidents", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id", { length: 36 }).notNull().references(() => associations.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  status: incidentStatusEnum("status").notNull().default("NEW"),
  locationText: text("location_text").notNull(),
  latitude: real("latitude"),
  longitude: real("longitude"),
  photoUrl: text("photo_url"),
  createdByEmail: text("created_by_email"),
  publicToken: text("public_token").notNull().unique(),
  isArchived: boolean("is_archived").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Association Meetings/Events - same as tenant meetings but for associations
export const associationMeetings = pgTable("association_meetings", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id", { length: 36 }).notNull().references(() => associations.id),
  title: text("title").notNull(),
  description: text("description"),
  dateTime: timestamp("date_time").notNull(),
  location: text("location").notNull(),
  status: meetingStatusEnum("status").notNull().default("SCHEDULED"),
  capacity: integer("capacity"),
  isArchived: boolean("is_archived").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const associationMeetingRegistrations = pgTable("association_meeting_registrations", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  meetingId: varchar("meeting_id", { length: 36 }).notNull().references(() => associationMeetings.id),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Bureau Members - board members of associations
export const bureauMembers = pgTable("bureau_members", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id", { length: 36 }).notNull().references(() => associations.id),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  function: text("function").notNull(),
  email: text("email").notNull(),
  passwordHash: text("password_hash"),
  photoUrl: text("photo_url"),
  photoObjectPath: text("photo_object_path"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Admin menu codes for permission management
export const adminMenuCodeEnum = pgEnum("admin_menu_code", [
  "DASHBOARD",
  "IDEAS", 
  "INCIDENTS",
  "MEETINGS",
  "ASSOCIATIONS",
  "ELUS",
  "DOMAINS",
  "PHOTOS",
  "ADMINS",
  "SHARE",
  "SETTINGS",
  "BILLING"
]);

// Elected Officials - for municipalities (mairies)
export const tenantElectedOfficials = pgTable("tenant_elected_officials", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  function: text("function").notNull(),
  email: text("email"),
  passwordHash: text("password_hash"),
  photoUrl: text("photo_url"),
  photoObjectPath: text("photo_object_path"),
  bio: text("bio"),
  displayOrder: integer("display_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  hasFullAccess: boolean("has_full_access").notNull().default(false),
  invitationToken: text("invitation_token"),
  invitationExpiresAt: timestamp("invitation_expires_at"),
  invitedAt: timestamp("invited_at"),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Menu permissions for elected officials
export const electedOfficialMenuPermissions = pgTable("elected_official_menu_permissions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  electedOfficialId: varchar("elected_official_id", { length: 36 }).notNull().references(() => tenantElectedOfficials.id, { onDelete: "cascade" }),
  menuCode: adminMenuCodeEnum("menu_code").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Password reset tokens - polymorphic for both admin users and elected officials
export const passwordResetTypeEnum = pgEnum("password_reset_type", ["ADMIN", "ELU"]);

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  token: varchar("token", { length: 64 }).notNull().unique(),
  type: passwordResetTypeEnum("type").notNull(),
  userId: varchar("user_id", { length: 36 }), // For ADMIN type
  electedOfficialId: varchar("elected_official_id", { length: 36 }), // For ELU type
  email: varchar("email", { length: 255 }).notNull(),
  tenantId: varchar("tenant_id", { length: 36 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Photos for tenants (municipalities)
export const tenantPhotos = pgTable("tenant_photos", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id),
  title: text("title"),
  description: text("description"),
  url: text("url").notNull(),
  displayOrder: integer("display_order").notNull().default(0),
  isFeatured: boolean("is_featured").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Photos for associations
export const associationPhotos = pgTable("association_photos", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id", { length: 36 }).notNull().references(() => associations.id),
  title: text("title"),
  description: text("description"),
  url: text("url").notNull(),
  displayOrder: integer("display_order").notNull().default(0),
  isFeatured: boolean("is_featured").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const tenantFeatureOverrides = pgTable("tenant_feature_overrides", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id),
  hasIdeas: boolean("has_ideas"),
  hasIncidents: boolean("has_incidents"),
  hasMeetings: boolean("has_meetings"),
  maxAdmins: integer("max_admins"),
  customMonthlyPrice: integer("custom_monthly_price"),
  customYearlyPrice: integer("custom_yearly_price"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const companySettings = pgTable("company_settings", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyName: text("company_name").notNull().default("Voxpopulous"),
  formeJuridique: text("forme_juridique"),
  capitalSocial: text("capital_social"),
  address: text("address"),
  siret: text("siret"),
  siren: text("siren"),
  rcsVille: text("rcs_ville"),
  rcsNumero: text("rcs_numero"),
  tvaNumber: text("tva_number"),
  iban: text("iban"),
  bic: text("bic"),
  email: text("email"),
  phone: text("phone"),
  website: text("website"),
  directeurNom: text("directeur_nom"),
  directeurFonction: text("directeur_fonction"),
  dpoEmail: text("dpo_email"),
  dpoAdresse: text("dpo_adresse"),
  mediateur: text("mediateur"),
  tribunalCompetent: text("tribunal_competent"),
  hebergeurNom: text("hebergeur_nom"),
  hebergeurAdresse: text("hebergeur_adresse"),
  paymentTerms: text("payment_terms").default("Paiement a 30 jours"),
  legalMentions: text("legal_mentions"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type CompanySettings = typeof companySettings.$inferSelect;
export type InsertCompanySettings = typeof companySettings.$inferInsert;

export const products = pgTable("products", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  type: productTypeEnum("type").notNull(),
  description: text("description"),
  defaultUnitPrice: integer("default_unit_price"),
  monthlyPrice: integer("monthly_price"),
  yearlyPrice: integer("yearly_price"),
  subscriptionPlanId: varchar("subscription_plan_id", { length: 36 }).references(() => subscriptionPlans.id),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type BillingIntervalType = "MONTHLY" | "YEARLY";

export const quotes = pgTable("quotes", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  quoteNumber: text("quote_number").notNull().unique(),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id),
  leadId: varchar("lead_id", { length: 36 }).references(() => leads.id),
  isArchived: boolean("is_archived").notNull().default(false),
  archivedAt: timestamp("archived_at"),
  clientName: text("client_name").notNull(),
  clientEmail: text("client_email").notNull(),
  clientAddress: text("client_address"),
  clientSiret: text("client_siret"),
  emitterName: text("emitter_name").notNull().default("Voxpopulous"),
  emitterAddress: text("emitter_address"),
  emitterSiret: text("emitter_siret"),
  emitterTva: text("emitter_tva"),
  status: quoteStatusEnum("status").notNull().default("DRAFT"),
  quoteSource: quoteSourceEnum("quote_source").default("MANUAL"),
  paymentMethod: paymentMethodEnum("payment_method"),
  subtotal: integer("subtotal").notNull(),
  taxRate: integer("tax_rate").notNull().default(20),
  taxAmount: integer("tax_amount").notNull(),
  total: integer("total").notNull(),
  validUntil: timestamp("valid_until").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  sentAt: timestamp("sent_at"),
  acceptedAt: timestamp("accepted_at"),
  publicToken: text("public_token").unique(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripeSetupIntentId: text("stripe_setup_intent_id"),
  sepaMandateId: text("sepa_mandate_id"),
  administrativeMandateUrl: text("administrative_mandate_url"),
  administrativeMandateStatus: text("administrative_mandate_status"),
  acceptedByEmail: text("accepted_by_email"),
  acceptedByName: text("accepted_by_name"),
  rejectedAt: timestamp("rejected_at"),
  rejectionReason: text("rejection_reason"),
  paymentSelectionStatus: paymentSelectionStatusEnum("payment_selection_status").default("PENDING"),
  paymentSelectionAt: timestamp("payment_selection_at"),
  prospectTenantType: tenantTypeEnum("prospect_tenant_type"),
  prospectOrganisationSlug: text("prospect_organisation_slug"),
  prospectAdminPassword: text("prospect_admin_password"),
  stripeCheckoutSessionId: text("stripe_checkout_session_id"),
  prospectMandateSiret: text("prospect_mandate_siret"),
  prospectMandateBillingAddress: text("prospect_mandate_billing_address"),
  prospectMandateBillingService: text("prospect_mandate_billing_service"),
  prospectMandateUseChorusPro: boolean("prospect_mandate_use_chorus_pro"),
  // Digital signature fields
  signatureImageUrl: text("signature_image_url"),
  signedByName: text("signed_by_name"),
  signedByCapacity: text("signed_by_capacity"),
  signedAt: timestamp("signed_at"),
  // Scanned document upload (alternative to digital signature)
  scannedDocumentUrl: text("scanned_document_url"),
  scannedDocumentOriginalName: text("scanned_document_original_name"),
});

export const quoteLineItems = pgTable("quote_line_items", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id", { length: 36 }).notNull().references(() => quotes.id),
  productId: varchar("product_id", { length: 36 }).references(() => products.id),
  planId: varchar("plan_id", { length: 36 }).references(() => subscriptionPlans.id),
  addonId: varchar("addon_id", { length: 36 }).references(() => addons.id),
  billingInterval: billingIntervalEnum("billing_interval"),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: integer("unit_price").notNull(),
  total: integer("total").notNull(),
});

export const invoices = pgTable("invoices", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  invoiceNumber: text("invoice_number").notNull().unique(),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id),
  quoteId: varchar("quote_id", { length: 36 }).references(() => quotes.id),
  isArchived: boolean("is_archived").notNull().default(false),
  archivedAt: timestamp("archived_at"),
  clientName: text("client_name").notNull(),
  clientEmail: text("client_email").notNull(),
  clientAddress: text("client_address"),
  clientSiret: text("client_siret"),
  emitterName: text("emitter_name").notNull().default("Voxpopulous"),
  emitterAddress: text("emitter_address"),
  emitterSiret: text("emitter_siret"),
  emitterTva: text("emitter_tva"),
  emitterIban: text("emitter_iban"),
  emitterBic: text("emitter_bic"),
  status: invoiceStatusEnum("status").notNull().default("DRAFT"),
  subtotal: integer("subtotal").notNull(),
  taxRate: integer("tax_rate").notNull().default(20),
  taxAmount: integer("tax_amount").notNull(),
  total: integer("total").notNull(),
  dueDate: timestamp("due_date").notNull(),
  paymentMethod: paymentMethodEnum("payment_method"),
  paymentTerms: text("payment_terms").default("Paiement a 30 jours"),
  mandateReference: text("mandate_reference"),
  notes: text("notes"),
  legalMentions: text("legal_mentions"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  sentAt: timestamp("sent_at"),
  paidAt: timestamp("paid_at"),
});

export const invoiceLineItems = pgTable("invoice_line_items", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id", { length: 36 }).notNull().references(() => invoices.id),
  productId: varchar("product_id", { length: 36 }).references(() => products.id),
  planId: varchar("plan_id", { length: 36 }).references(() => subscriptionPlans.id),
  addonId: varchar("addon_id", { length: 36 }).references(() => addons.id),
  billingInterval: billingIntervalEnum("billing_interval"),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: integer("unit_price").notNull(),
  total: integer("total").notNull(),
});

export const payments = pgTable("payments", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id", { length: 36 }).references(() => invoices.id),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id),
  amount: integer("amount").notNull(),
  method: paymentMethodEnum("method").notNull(),
  status: paymentStatusEnum("status").notNull().default("PENDING"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  reference: text("reference"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

// ==========================================
// MANDATE MANAGEMENT SYSTEM
// ==========================================

// Mandate order status enum
export const mandateOrderStatusEnum = pgEnum("mandate_order_status", [
  "PENDING_VALIDATION",  // En attente de validation
  "PENDING_BC",          // En attente du BC/engagement
  "ACCEPTED",            // Acceptée
  "INVOICED",            // Facturée
  "REJECTED",            // Rejetée
  "CANCELLED"            // Annulée
]);

// Mandate subscription status enum
export const mandateSubscriptionStatusEnum = pgEnum("mandate_subscription_status", [
  "PENDING_ACTIVATION",  // En attente d'activation
  "ACTIVE",              // Actif
  "GRACE_PERIOD",        // Période de grâce (15 jours après échéance)
  "READ_ONLY",           // Lecture seule (non payé)
  "EXPIRED",             // Expiré
  "CANCELLED"            // Annulé
]);

// Mandate invoice status enum
export const mandateInvoiceStatusEnum = pgEnum("mandate_invoice_status", [
  "DRAFT",               // Brouillon
  "SENT",                // Envoyée
  "MANDATED",            // Mandatée (confirmée par client)
  "PAID",                // Payée
  "OVERDUE",             // En retard
  "CANCELLED"            // Annulée
]);

// Mandate document type enum
export const mandateDocumentTypeEnum = pgEnum("mandate_document_type", [
  "PURCHASE_ORDER",      // Bon de commande
  "ENGAGEMENT",          // Engagement
  "PROFORMA",            // Proforma
  "INVOICE",             // Facture
  "PAYMENT_PROOF",       // Preuve de paiement
  "OTHER"                // Autre
]);

// Mandate activity type enum
export const mandateActivityTypeEnum = pgEnum("mandate_activity_type", [
  "ORDER_CREATED",       // Commande créée
  "ORDER_VALIDATED",     // Commande validée
  "ORDER_REJECTED",      // Commande rejetée
  "BC_UPLOADED",         // BC/engagement uploadé
  "BC_VALIDATED",        // BC validé
  "SUBSCRIPTION_ACTIVATED", // Abonnement activé
  "SUBSCRIPTION_CANCELLED", // Abonnement annulé
  "CANCELLATION_REQUESTED", // Demande d'annulation
  "INVOICE_GENERATED",   // Facture générée
  "INVOICE_SENT",        // Facture envoyée
  "REMINDER_SENT",       // Relance envoyée
  "PAYMENT_RECEIVED",    // Paiement reçu
  "RENEWAL_INITIATED",   // Renouvellement initié
  "STATUS_CHANGED",      // Statut changé
  "GRACE_PERIOD_STARTED", // Période de grâce démarrée
  "READ_ONLY_ACTIVATED", // Passage en lecture seule
  "NOTE_ADDED"           // Note ajoutée
]);

// Mandate Orders - commandes de mandat administratif
export const mandateOrders = pgTable("mandate_orders", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  orderNumber: text("order_number").notNull().unique(), // Numéro de devis (DV-YYYY-NNNN)
  commandeNumber: text("commande_number"), // Numéro de commande (BC-YYYY-NNNN) - généré quand accepté
  quoteId: varchar("quote_id", { length: 36 }).references(() => quotes.id), // Link to original quote if created from quote acceptance
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id),
  planId: varchar("plan_id", { length: 36 }).notNull().references(() => subscriptionPlans.id),
  status: mandateOrderStatusEnum("status").notNull().default("PENDING_VALIDATION"),
  isArchived: boolean("is_archived").notNull().default(false),
  archivedAt: timestamp("archived_at"),
  // Soft delete
  isDeleted: boolean("is_deleted").notNull().default(false),
  deletedAt: timestamp("deleted_at"),
  deletedBy: varchar("deleted_by", { length: 36 }),
  // Billing details
  billingCycle: billingIntervalEnum("billing_cycle").notNull().default("YEARLY"),
  planAmount: integer("plan_amount").default(0), // base plan price in cents
  addonsAmount: integer("addons_amount").default(0), // sum of addons in cents
  addonsSnapshot: text("addons_snapshot"), // JSON array [{id, name, quantity, unitPrice, totalPrice}]
  annualAmount: integer("annual_amount").notNull(), // planAmount + addonsAmount in cents
  discountAmount: integer("discount_amount").default(0), // -2 months discount in cents
  finalAmount: integer("final_amount").notNull(), // annualAmount - discountAmount in cents
  // Client details (copied from tenant/billing preferences for traceability)
  clientName: text("client_name").notNull(),
  clientSiret: text("client_siret").notNull(),
  clientAddress: text("client_address"),
  billingService: text("billing_service"),
  accountingContactName: text("accounting_contact_name"),
  accountingContactEmail: text("accounting_contact_email"),
  accountingContactPhone: text("accounting_contact_phone"),
  // BC/Engagement references
  purchaseOrderNumber: text("purchase_order_number"),
  engagementNumber: text("engagement_number"),
  serviceCode: text("service_code"),
  // Chorus Pro
  useChorusPro: boolean("use_chorus_pro").notNull().default(false),
  chorusProRecipientSiret: text("chorus_pro_recipient_siret"),
  chorusProServiceCode: text("chorus_pro_service_code"),
  // Processing
  validatedAt: timestamp("validated_at"),
  validatedBy: varchar("validated_by", { length: 36 }),
  rejectedAt: timestamp("rejected_at"),
  rejectionReason: text("rejection_reason"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Mandate Subscriptions - abonnements via mandat
export const mandateSubscriptions = pgTable("mandate_subscriptions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id),
  orderId: varchar("order_id", { length: 36 }).notNull().references(() => mandateOrders.id),
  planId: varchar("plan_id", { length: 36 }).notNull().references(() => subscriptionPlans.id),
  status: mandateSubscriptionStatusEnum("status").notNull().default("PENDING_ACTIVATION"),
  // Period
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  // Renewal tracking
  renewalReminderSentAt: timestamp("renewal_reminder_sent_at"),
  renewalOrderId: varchar("renewal_order_id", { length: 36 }),
  // Grace period tracking
  gracePeriodStartedAt: timestamp("grace_period_started_at"),
  readOnlyActivatedAt: timestamp("read_only_activated_at"),
  // Activation
  activatedAt: timestamp("activated_at"),
  activatedBy: varchar("activated_by", { length: 36 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Mandate Documents - BC, engagements, factures uploadées
export const mandateDocuments = pgTable("mandate_documents", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id", { length: 36 }).references(() => mandateOrders.id),
  invoiceId: varchar("invoice_id", { length: 36 }),
  tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id),
  documentType: mandateDocumentTypeEnum("document_type").notNull(),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  // Metadata
  reference: text("reference"), // BC number, engagement number, etc.
  notes: text("notes"),
  uploadedBy: varchar("uploaded_by", { length: 36 }),
  validatedAt: timestamp("validated_at"),
  validatedBy: varchar("validated_by", { length: 36 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Mandate Invoices - factures dédiées aux mandats
export const mandateInvoices = pgTable("mandate_invoices", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  invoiceNumber: text("invoice_number").notNull().unique(),
  orderId: varchar("order_id", { length: 36 }).references(() => mandateOrders.id),
  subscriptionId: varchar("subscription_id", { length: 36 }).references(() => mandateSubscriptions.id),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id),
  status: mandateInvoiceStatusEnum("status").notNull().default("DRAFT"),
  isArchived: boolean("is_archived").notNull().default(false),
  archivedAt: timestamp("archived_at"),
  // Soft delete
  isDeleted: boolean("is_deleted").notNull().default(false),
  deletedAt: timestamp("deleted_at"),
  deletedBy: varchar("deleted_by", { length: 36 }),
  // Amounts (in cents)
  planAmount: integer("plan_amount").default(0), // base plan price in cents
  addonsAmount: integer("addons_amount").default(0), // sum of addons in cents
  addonsSnapshot: text("addons_snapshot"), // JSON array [{id, name, quantity, unitPrice, totalPrice}]
  subtotal: integer("subtotal").notNull(), // planAmount + addonsAmount
  discountAmount: integer("discount_amount").default(0),
  taxAmount: integer("tax_amount").default(0),
  totalAmount: integer("total_amount").notNull(), // subtotal - discountAmount
  // Period covered
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  // Client details (snapshot at invoice time)
  clientName: text("client_name").notNull(),
  clientSiret: text("client_siret").notNull(),
  clientAddress: text("client_address"),
  billingService: text("billing_service"),
  // References
  purchaseOrderNumber: text("purchase_order_number"),
  engagementNumber: text("engagement_number"),
  serviceCode: text("service_code"),
  // Emitter details (snapshot)
  emitterName: text("emitter_name").notNull(),
  emitterAddress: text("emitter_address"),
  emitterSiret: text("emitter_siret"),
  emitterTva: text("emitter_tva"),
  emitterIban: text("emitter_iban"),
  emitterBic: text("emitter_bic"),
  // Payment terms
  paymentTerms: text("payment_terms").default("Paiement a 30 jours"),
  dueDate: timestamp("due_date").notNull(),
  // PDF
  pdfUrl: text("pdf_url"),
  pdfGeneratedAt: timestamp("pdf_generated_at"),
  // Chorus Pro
  chorusProSubmittedAt: timestamp("chorus_pro_submitted_at"),
  chorusProStatus: text("chorus_pro_status"),
  chorusProReference: text("chorus_pro_reference"),
  // Tracking
  sentAt: timestamp("sent_at"),
  mandatedAt: timestamp("mandated_at"),
  paidAt: timestamp("paid_at"),
  paymentReference: text("payment_reference"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Mandate Activities - journal d'activité
export const mandateActivities = pgTable("mandate_activities", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id),
  orderId: varchar("order_id", { length: 36 }).references(() => mandateOrders.id),
  subscriptionId: varchar("subscription_id", { length: 36 }).references(() => mandateSubscriptions.id),
  invoiceId: varchar("invoice_id", { length: 36 }).references(() => mandateInvoices.id),
  activityType: mandateActivityTypeEnum("activity_type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  // Metadata
  oldValue: text("old_value"),
  newValue: text("new_value"),
  metadata: text("metadata"), // JSON string for additional data
  // Actor
  performedBy: varchar("performed_by", { length: 36 }),
  performedByType: text("performed_by_type"), // 'superadmin', 'admin', 'elected_official', 'system'
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Mandate Reminders - relances programmées (payment reminders use invoiceId, renewal reminders use subscriptionId)
export const mandateReminders = pgTable("mandate_reminders", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id", { length: 36 }).references(() => mandateInvoices.id),
  subscriptionId: varchar("subscription_id", { length: 36 }).references(() => mandateSubscriptions.id),
  tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id),
  reminderType: text("reminder_type").notNull().default("PAYMENT"), // "PAYMENT" or "RENEWAL"
  reminderLevel: integer("reminder_level").notNull(), // Payment: 1, 2, 3 for J+35, J+50, J+65; Renewal: 1, 2, 3 for J-60, J-30, J-15
  scheduledFor: timestamp("scheduled_for").notNull(),
  sentAt: timestamp("sent_at"),
  emailTo: text("email_to"),
  emailSubject: text("email_subject"),
  emailBody: text("email_body"),
  isCancelled: boolean("is_cancelled").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Subscription/Trial Renewal Reminders - rappels avant fin d'essai ou abonnement
export const subscriptionReminders = pgTable("subscription_reminders", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id),
  reminderContext: text("reminder_context").notNull(), // 'TRIAL' or 'SUBSCRIPTION'
  daysBeforeExpiry: integer("days_before_expiry").notNull(), // 30, 15, 7, 2, 1
  expiryDate: timestamp("expiry_date").notNull(),
  scheduledFor: timestamp("scheduled_for").notNull(),
  status: text("status").notNull().default("PENDING"), // 'PENDING', 'SENT', 'CANCELLED', 'FAILED'
  sentAt: timestamp("sent_at"),
  emailTo: text("email_to"),
  retryCount: integer("retry_count").notNull().default(0),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Invoice number sequence for mandate invoices
export const invoiceSequences = pgTable("invoice_sequences", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  year: integer("year").notNull(),
  lastNumber: integer("last_number").notNull().default(0),
  prefix: text("prefix").notNull().default("FA"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Global Domains for Municipalities/EPCI - managed by superadmin
export const globalMunicipalityDomains = pgTable("global_municipality_domains", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color"),
  displayOrder: integer("display_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Global Domains for Associations - managed by superadmin
export const globalAssociationDomains = pgTable("global_association_domains", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color"),
  displayOrder: integer("display_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Intervention Domains for Tenants (municipalities) - assigned to elected officials
export const tenantInterventionDomains = pgTable("tenant_intervention_domains", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color"),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Intervention Domains for Associations - assigned to bureau members
export const associationInterventionDomains = pgTable("association_intervention_domains", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id", { length: 36 }).notNull().references(() => associations.id),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color"),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Many-to-many: Elected Officials <-> Global Municipality Domains
export const electedOfficialDomains = pgTable("elected_official_domains", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  electedOfficialId: varchar("elected_official_id", { length: 36 }).notNull().references(() => tenantElectedOfficials.id),
  domainId: varchar("domain_id", { length: 36 }).notNull().references(() => globalMunicipalityDomains.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Many-to-many: Bureau Members <-> Global Association Domains
export const bureauMemberDomains = pgTable("bureau_member_domains", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  bureauMemberId: varchar("bureau_member_id", { length: 36 }).notNull().references(() => bureauMembers.id),
  domainId: varchar("domain_id", { length: 36 }).notNull().references(() => globalAssociationDomains.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Chat system for contacting elected officials and bureau members
export const chatSubjectTypeEnum = pgEnum("chat_subject_type", ["TENANT_ELU", "ASSOCIATION_MEMBER", "EPCI_ELU"]);
export const chatThreadStatusEnum = pgEnum("chat_thread_status", ["OPEN", "CLOSED"]);

export const chatThreads = pgTable("chat_threads", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  subjectType: chatSubjectTypeEnum("subject_type").notNull(),
  subjectId: varchar("subject_id", { length: 36 }).notNull(),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id),
  associationId: varchar("association_id", { length: 36 }).references(() => associations.id),
  requesterName: text("requester_name").notNull(),
  requesterEmail: text("requester_email").notNull(),
  subject: text("subject").notNull(),
  status: chatThreadStatusEnum("status").notNull().default("OPEN"),
  publicToken: varchar("public_token", { length: 64 }).notNull().unique(),
  officialToken: varchar("official_token", { length: 64 }).notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  threadId: varchar("thread_id", { length: 36 }).notNull().references(() => chatThreads.id),
  senderType: text("sender_type").notNull(), // "requester" or "official"
  senderName: text("sender_name").notNull(),
  content: text("content").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTenantSchema = createInsertSchema(tenants).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  createdAt: true,
  status: true,
  pipelineStage: true,
  lastContactedAt: true,
  lastMessageAt: true,
  convertedTenantId: true,
  publicToken: true,
});

export const insertLeadMessageSchema = createInsertSchema(leadMessages).omit({
  id: true,
  createdAt: true,
  isRead: true,
  readAt: true,
});

export const insertIdeaSchema = createInsertSchema(ideas).omit({
  id: true,
  tenantId: true,
  publicToken: true,
  createdAt: true,
  updatedAt: true,
  votesCount: true,
  status: true,
});

export const insertIncidentSchema = createInsertSchema(incidents).omit({
  id: true,
  tenantId: true,
  publicToken: true,
  createdAt: true,
  updatedAt: true,
  status: true,
});

export const insertMeetingSchema = createInsertSchema(meetings).omit({
  id: true,
  tenantId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMeetingRegistrationSchema = createInsertSchema(meetingRegistrations).omit({
  id: true,
  meetingId: true,
  createdAt: true,
});

export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Lead = typeof leads.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type LeadMessage = typeof leadMessages.$inferSelect;
export type InsertLeadMessage = z.infer<typeof insertLeadMessageSchema>;
export type Idea = typeof ideas.$inferSelect;
export type InsertIdea = z.infer<typeof insertIdeaSchema>;
export type IdeaVote = typeof ideaVotes.$inferSelect;
export type Incident = typeof incidents.$inferSelect;
export type InsertIncident = z.infer<typeof insertIncidentSchema>;
export type Meeting = typeof meetings.$inferSelect;
export type InsertMeeting = z.infer<typeof insertMeetingSchema>;
export type MeetingIdea = typeof meetingIdeas.$inferSelect;
export type MeetingRegistration = typeof meetingRegistrations.$inferSelect;
export type InsertMeetingRegistration = z.infer<typeof insertMeetingRegistrationSchema>;

export const insertSuperadminSchema = createInsertSchema(superadmins).omit({
  id: true,
  lastLoginAt: true,
  createdAt: true,
});
export type Superadmin = typeof superadmins.$inferSelect;
export type InsertSuperadmin = z.infer<typeof insertSuperadminSchema>;

export const insertSuperadminSettingsSchema = createInsertSchema(superadminSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type SuperadminSettings = typeof superadminSettings.$inferSelect;
export type InsertSuperadminSettings = z.infer<typeof insertSuperadminSettingsSchema>;

export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type InsertSubscriptionPlan = z.infer<typeof insertSubscriptionPlanSchema>;

export const insertPlanFeatureSchema = createInsertSchema(planFeatures).omit({
  id: true,
  createdAt: true,
});
export type PlanFeature = typeof planFeatures.$inferSelect;
export type InsertPlanFeature = z.infer<typeof insertPlanFeatureSchema>;

export const insertFeatureSchema = createInsertSchema(features).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type Feature = typeof features.$inferSelect;
export type InsertFeature = z.infer<typeof insertFeatureSchema>;

export const insertPlanFeatureAssignmentSchema = createInsertSchema(planFeatureAssignments).omit({
  id: true,
  createdAt: true,
});
export type PlanFeatureAssignment = typeof planFeatureAssignments.$inferSelect;
export type InsertPlanFeatureAssignment = z.infer<typeof insertPlanFeatureAssignmentSchema>;

export const insertAddonSchema = createInsertSchema(addons).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type Addon = typeof addons.$inferSelect;
export type InsertAddon = z.infer<typeof insertAddonSchema>;

export const insertPlanAddonAccessSchema = createInsertSchema(planAddonAccess).omit({
  id: true,
  createdAt: true,
});
export type PlanAddonAccess = typeof planAddonAccess.$inferSelect;
export type InsertPlanAddonAccess = z.infer<typeof insertPlanAddonAccessSchema>;

export const insertTenantAddonSchema = createInsertSchema(tenantAddons).omit({
  id: true,
  createdAt: true,
});
export type TenantAddon = typeof tenantAddons.$inferSelect;
export type InsertTenantAddon = z.infer<typeof insertTenantAddonSchema>;

export const insertTenantBillingChangeSchema = createInsertSchema(tenantBillingChanges).omit({
  id: true,
  createdAt: true,
  appliedAt: true,
});
export type TenantBillingChange = typeof tenantBillingChanges.$inferSelect;
export type InsertTenantBillingChange = z.infer<typeof insertTenantBillingChangeSchema>;

export const insertBillingLedgerEntrySchema = createInsertSchema(billingLedgerEntries).omit({
  id: true,
  createdAt: true,
});
export type BillingLedgerEntry = typeof billingLedgerEntries.$inferSelect;
export type InsertBillingLedgerEntry = z.infer<typeof insertBillingLedgerEntrySchema>;

export const insertTenantBillingPreferencesSchema = createInsertSchema(tenantBillingPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type TenantBillingPreferences = typeof tenantBillingPreferences.$inferSelect;
export type InsertTenantBillingPreferences = z.infer<typeof insertTenantBillingPreferencesSchema>;

// Mandate management types
export const insertMandateOrderSchema = createInsertSchema(mandateOrders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  validatedAt: true,
  rejectedAt: true,
});
export type MandateOrder = typeof mandateOrders.$inferSelect;
export type InsertMandateOrder = z.infer<typeof insertMandateOrderSchema>;

export const insertMandateSubscriptionSchema = createInsertSchema(mandateSubscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  activatedAt: true,
});
export type MandateSubscription = typeof mandateSubscriptions.$inferSelect;
export type InsertMandateSubscription = z.infer<typeof insertMandateSubscriptionSchema>;

export const insertMandateDocumentSchema = createInsertSchema(mandateDocuments).omit({
  id: true,
  createdAt: true,
  validatedAt: true,
});
export type MandateDocument = typeof mandateDocuments.$inferSelect;
export type InsertMandateDocument = z.infer<typeof insertMandateDocumentSchema>;

export const insertMandateInvoiceSchema = createInsertSchema(mandateInvoices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  sentAt: true,
  mandatedAt: true,
  paidAt: true,
  pdfGeneratedAt: true,
  chorusProSubmittedAt: true,
});
export type MandateInvoice = typeof mandateInvoices.$inferSelect;
export type InsertMandateInvoice = z.infer<typeof insertMandateInvoiceSchema>;

export const insertMandateActivitySchema = createInsertSchema(mandateActivities).omit({
  id: true,
  createdAt: true,
});
export type MandateActivity = typeof mandateActivities.$inferSelect;
export type InsertMandateActivity = z.infer<typeof insertMandateActivitySchema>;

export const insertMandateReminderSchema = createInsertSchema(mandateReminders).omit({
  id: true,
  createdAt: true,
  sentAt: true,
});
export type MandateReminder = typeof mandateReminders.$inferSelect;
export type InsertMandateReminder = z.infer<typeof insertMandateReminderSchema>;

export const insertSubscriptionReminderSchema = createInsertSchema(subscriptionReminders).omit({
  id: true,
  createdAt: true,
  sentAt: true,
});
export type SubscriptionReminder = typeof subscriptionReminders.$inferSelect;
export type InsertSubscriptionReminder = z.infer<typeof insertSubscriptionReminderSchema>;

export const insertInvoiceSequenceSchema = createInsertSchema(invoiceSequences).omit({
  id: true,
  updatedAt: true,
});
export type InvoiceSequence = typeof invoiceSequences.$inferSelect;
export type InsertInvoiceSequence = z.infer<typeof insertInvoiceSequenceSchema>;

export const insertAssociationSchema = createInsertSchema(associations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type Association = typeof associations.$inferSelect;
export type InsertAssociation = z.infer<typeof insertAssociationSchema>;

export const insertAssociationUserSchema = createInsertSchema(associationUsers).omit({
  id: true,
  createdAt: true,
});
export type AssociationUser = typeof associationUsers.$inferSelect;
export type InsertAssociationUser = z.infer<typeof insertAssociationUserSchema>;

export const insertAssociationIdeaSchema = createInsertSchema(associationIdeas).omit({
  id: true,
  associationId: true,
  publicToken: true,
  createdAt: true,
  updatedAt: true,
  votesCount: true,
  status: true,
});
export type AssociationIdea = typeof associationIdeas.$inferSelect;
export type InsertAssociationIdea = z.infer<typeof insertAssociationIdeaSchema>;

export type AssociationIdeaVote = typeof associationIdeaVotes.$inferSelect;

export const insertAssociationIncidentSchema = createInsertSchema(associationIncidents).omit({
  id: true,
  associationId: true,
  publicToken: true,
  createdAt: true,
  updatedAt: true,
  status: true,
});
export type AssociationIncident = typeof associationIncidents.$inferSelect;
export type InsertAssociationIncident = z.infer<typeof insertAssociationIncidentSchema>;

export const insertAssociationMeetingSchema = createInsertSchema(associationMeetings).omit({
  id: true,
  associationId: true,
  createdAt: true,
  updatedAt: true,
});
export type AssociationMeeting = typeof associationMeetings.$inferSelect;
export type InsertAssociationMeeting = z.infer<typeof insertAssociationMeetingSchema>;

export const insertAssociationMeetingRegistrationSchema = createInsertSchema(associationMeetingRegistrations).omit({
  id: true,
  createdAt: true,
});
export type AssociationMeetingRegistration = typeof associationMeetingRegistrations.$inferSelect;
export type InsertAssociationMeetingRegistration = z.infer<typeof insertAssociationMeetingRegistrationSchema>;

export const insertBureauMemberSchema = createInsertSchema(bureauMembers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type BureauMember = typeof bureauMembers.$inferSelect;
export type InsertBureauMember = z.infer<typeof insertBureauMemberSchema>;

export const insertElectedOfficialSchema = createInsertSchema(tenantElectedOfficials).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  passwordHash: true,
  invitationToken: true,
  invitationExpiresAt: true,
  invitedAt: true,
  lastLoginAt: true,
});
export type ElectedOfficial = typeof tenantElectedOfficials.$inferSelect;
export type InsertElectedOfficial = z.infer<typeof insertElectedOfficialSchema>;

export const insertElectedOfficialMenuPermissionSchema = createInsertSchema(electedOfficialMenuPermissions).omit({
  id: true,
  createdAt: true,
});
export type ElectedOfficialMenuPermission = typeof electedOfficialMenuPermissions.$inferSelect;
export type InsertElectedOfficialMenuPermission = z.infer<typeof insertElectedOfficialMenuPermissionSchema>;

export const ADMIN_MENU_CODES = [
  "DASHBOARD",
  "IDEAS", 
  "INCIDENTS",
  "MEETINGS",
  "ASSOCIATIONS",
  "ELUS",
  "DOMAINS",
  "PHOTOS",
  "ADMINS",
  "SHARE",
  "SETTINGS",
  "BILLING"
] as const;
export type AdminMenuCode = typeof ADMIN_MENU_CODES[number];

export const insertTenantPhotoSchema = createInsertSchema(tenantPhotos).omit({
  id: true,
  createdAt: true,
});
export type TenantPhoto = typeof tenantPhotos.$inferSelect;
export type InsertTenantPhoto = z.infer<typeof insertTenantPhotoSchema>;

export const insertAssociationPhotoSchema = createInsertSchema(associationPhotos).omit({
  id: true,
  createdAt: true,
});
export type AssociationPhoto = typeof associationPhotos.$inferSelect;
export type InsertAssociationPhoto = z.infer<typeof insertAssociationPhotoSchema>;

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;

export const insertQuoteSchema = createInsertSchema(quotes).omit({
  id: true,
  quoteNumber: true,
  createdAt: true,
  sentAt: true,
  acceptedAt: true,
});
export type Quote = typeof quotes.$inferSelect;
export type InsertQuote = z.infer<typeof insertQuoteSchema>;

export const insertQuoteLineItemSchema = createInsertSchema(quoteLineItems).omit({
  id: true,
});
export type QuoteLineItem = typeof quoteLineItems.$inferSelect;
export type InsertQuoteLineItem = z.infer<typeof insertQuoteLineItemSchema>;

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  invoiceNumber: true,
  createdAt: true,
  sentAt: true,
  paidAt: true,
});
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;

export const insertInvoiceLineItemSchema = createInsertSchema(invoiceLineItems).omit({
  id: true,
});
export type InvoiceLineItem = typeof invoiceLineItems.$inferSelect;
export type InsertInvoiceLineItem = z.infer<typeof insertInvoiceLineItemSchema>;

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});
export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;

export type TenantFeatureOverride = typeof tenantFeatureOverrides.$inferSelect;

// Global Municipality Domains schemas and types
export const insertGlobalMunicipalityDomainSchema = createInsertSchema(globalMunicipalityDomains).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type GlobalMunicipalityDomain = typeof globalMunicipalityDomains.$inferSelect;
export type InsertGlobalMunicipalityDomain = z.infer<typeof insertGlobalMunicipalityDomainSchema>;

// Global Association Domains schemas and types
export const insertGlobalAssociationDomainSchema = createInsertSchema(globalAssociationDomains).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type GlobalAssociationDomain = typeof globalAssociationDomains.$inferSelect;
export type InsertGlobalAssociationDomain = z.infer<typeof insertGlobalAssociationDomainSchema>;

export const insertTenantInterventionDomainSchema = createInsertSchema(tenantInterventionDomains).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type TenantInterventionDomain = typeof tenantInterventionDomains.$inferSelect;
export type InsertTenantInterventionDomain = z.infer<typeof insertTenantInterventionDomainSchema>;

export const insertAssociationInterventionDomainSchema = createInsertSchema(associationInterventionDomains).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type AssociationInterventionDomain = typeof associationInterventionDomains.$inferSelect;
export type InsertAssociationInterventionDomain = z.infer<typeof insertAssociationInterventionDomainSchema>;

export const insertElectedOfficialDomainSchema = createInsertSchema(electedOfficialDomains).omit({
  id: true,
  createdAt: true,
});
export type ElectedOfficialDomain = typeof electedOfficialDomains.$inferSelect;
export type InsertElectedOfficialDomain = z.infer<typeof insertElectedOfficialDomainSchema>;

export const insertBureauMemberDomainSchema = createInsertSchema(bureauMemberDomains).omit({
  id: true,
  createdAt: true,
});
export type BureauMemberDomain = typeof bureauMemberDomains.$inferSelect;
export type InsertBureauMemberDomain = z.infer<typeof insertBureauMemberDomainSchema>;

// Chat schemas
export const insertChatThreadSchema = createInsertSchema(chatThreads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  publicToken: true,
  officialToken: true,
});
export type ChatThread = typeof chatThreads.$inferSelect;
export type InsertChatThread = z.infer<typeof insertChatThreadSchema>;

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
  isRead: true,
});
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;

export const superadminLoginSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

// Strong password validation
const strongPasswordSchema = z.string()
  .min(10, "Minimum 10 caracteres")
  .refine((val) => (val.match(/[A-Z]/g) || []).length >= 2, "Au moins 2 lettres majuscules")
  .refine((val) => (val.match(/[a-z]/g) || []).length >= 2, "Au moins 2 lettres minuscules")
  .refine((val) => /[0-9]/.test(val), "Au moins 1 chiffre")
  .refine((val) => (val.match(/[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/`~;']/g) || []).length >= 2, "Au moins 2 caracteres speciaux");

// Payment method schema for signup (subset of database enum)
export const signupPaymentMethodSchema = z.enum(["STRIPE", "ADMINISTRATIVE_MANDATE"]);
export type SignupPaymentMethod = z.infer<typeof signupPaymentMethodSchema>;

// SIRET validation (14 digits only)
const siretRegex = /^\d{14}$/;
const siretSchema = z.string()
  .trim()
  .regex(siretRegex, "Le SIRET doit contenir exactement 14 chiffres");

// Non-empty string helper (trims whitespace before checking)
const nonEmptyString = (message: string) => z.string().trim().min(1, message);

// Chorus Pro details schema
export const chorusProDetailsSchema = z.object({
  recipientSiret: z.string().trim().regex(siretRegex, "SIRET destinataire invalide (14 chiffres)"),
  serviceCode: nonEmptyString("Code service Chorus Pro requis"),
  serviceLabel: z.string().trim().optional(),
  engagementNumber: z.string().trim().optional(),
  purchaseOrderFormatId: z.string().optional(),
  engagementFormatId: z.string().optional(),
});
export type ChorusProDetails = z.infer<typeof chorusProDetailsSchema>;

// Administrative mandate details schema (full version for backoffice)
export const mandateDetailsSchema = z.object({
  siret: siretSchema,
  billingAddress: z.string().trim().min(5, "Adresse de facturation requise (minimum 5 caracteres)"),
  billingService: z.string().trim().min(2, "Service de facturation requis (minimum 2 caracteres)"),
  accountingContactName: z.string().trim().min(2, "Nom du contact comptabilite requis (minimum 2 caracteres)"),
  accountingContactEmail: z.string().trim().email("Email du contact comptabilite invalide"),
  accountingContactPhone: z.string().trim().optional(),
  serviceCode: z.string().trim().optional(),
  engagementNumber: z.string().trim().optional(),
  purchaseOrderNumber: z.string().trim().optional(),
  useChorusPro: z.boolean().default(false),
  chorusProDetails: chorusProDetailsSchema.optional(),
});
export type MandateDetails = z.infer<typeof mandateDetailsSchema>;

// Simplified mandate details for signup (only SIRET required)
export const signupMandateDetailsSchema = z.object({
  siret: siretSchema,
});
export type SignupMandateDetails = z.infer<typeof signupMandateDetailsSchema>;

// Frontend form schema (with confirmPassword) - Simplified for signup
export const signupFormSchema = z.object({
  tenantType: z.enum(["MAIRIE", "EPCI", "ASSOCIATION"]),
  planId: z.string().min(1, "Veuillez selectionner un forfait"),
  communeName: z.string().min(2, "Minimum 2 caracteres"),
  epci: z.string().optional(),
  slug: z.string().min(2, "Minimum 2 caracteres").regex(/^[a-z0-9-]+$/, "Uniquement lettres minuscules, chiffres et tirets"),
  adminEmail: z.string().email("Email invalide"),
  adminName: z.string().min(2, "Minimum 2 caracteres"),
  password: strongPasswordSchema,
  confirmPassword: z.string().min(1, "Confirmation requise"),
  // Quantities for EPCI and MAIRIE
  communesCount: z.number().int().min(0).default(0),
  associationsCount: z.number().int().min(0).default(0),
  adminsCount: z.number().int().min(1).default(1),
  // Payment method and billing
  paymentMethod: signupPaymentMethodSchema.default("STRIPE"),
  billingInterval: z.enum(["monthly", "yearly"]).default("monthly"),
  // Simplified mandate details for signup (only SIRET required)
  mandateDetails: signupMandateDetailsSchema.optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
}).refine((data) => {
  // Mandate requires yearly billing
  if (data.paymentMethod === "ADMINISTRATIVE_MANDATE" && data.billingInterval !== "yearly") {
    return false;
  }
  return true;
}, {
  message: "Le mandat administratif requiert un abonnement annuel",
  path: ["billingInterval"],
}).refine((data) => {
  // Mandate details required when using mandate (only SIRET)
  if (data.paymentMethod === "ADMINISTRATIVE_MANDATE" && !data.mandateDetails?.siret) {
    return false;
  }
  return true;
}, {
  message: "Le SIRET est requis pour le mandat administratif",
  path: ["mandateDetails", "siret"],
});

export type SignupForm = z.infer<typeof signupFormSchema>;

// Backend signup schema (without confirmPassword) - Simplified for signup
export const signupApiSchema = z.object({
  tenantType: z.enum(["MAIRIE", "EPCI", "ASSOCIATION"]),
  planId: z.string().min(1, "Veuillez selectionner un forfait"),
  communeName: z.string().min(2, "Minimum 2 caracteres"),
  epci: z.string().optional(),
  slug: z.string().min(2, "Minimum 2 caracteres").regex(/^[a-z0-9-]+$/, "Uniquement lettres minuscules, chiffres et tirets"),
  adminEmail: z.string().email("Email invalide"),
  adminName: z.string().min(2, "Minimum 2 caracteres"),
  password: strongPasswordSchema,
  communesCount: z.number().int().min(0).default(0),
  associationsCount: z.number().int().min(0).default(0),
  adminsCount: z.number().int().min(1).default(1),
  paymentMethod: signupPaymentMethodSchema,
  billingInterval: z.enum(["monthly", "yearly"]).default("monthly"),
  mandateDetails: signupMandateDetailsSchema.optional(),
}).superRefine((data, ctx) => {
  if (data.paymentMethod === "ADMINISTRATIVE_MANDATE") {
    if (data.billingInterval !== "yearly") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Le mandat administratif requiert un abonnement annuel",
        path: ["billingInterval"],
      });
    }
    
    if (!data.mandateDetails?.siret || !siretRegex.test(data.mandateDetails.siret.trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Le SIRET doit contenir exactement 14 chiffres",
        path: ["mandateDetails", "siret"],
      });
    }
  }
});

export type SignupApi = z.infer<typeof signupApiSchema>;

export const loginFormSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password required"),
});

export type LoginForm = z.infer<typeof loginFormSchema>;

export const IDEA_CATEGORIES = [
  "Urbanisme",
  "Transport",
  "Environnement",
  "Culture",
  "Sport",
  "Education",
  "Social",
  "Economie",
  "Vie associative",
  "Evenements",
  "Communication",
  "Autre"
];

export const INCIDENT_CATEGORIES = [
  "Voirie",
  "Eclairage",
  "Proprete",
  "Securite",
  "Espaces verts",
  "Mobilier urbain",
  "Terrain",
  "Materiel sportif",
  "Equipement",
  "Batiment",
  "Autre"
];

// Audit action type enum
export const auditActionTypeEnum = pgEnum("audit_action_type", [
  "DELETE_TENANT",
  "DELETE_MANDATE_ORDER",
  "DELETE_MANDATE_INVOICE",
  "HIDE_STRIPE_SUBSCRIPTION",
  "HIDE_STRIPE_INVOICE",
  "HIDE_STRIPE_PAYMENT",
  "ARCHIVE_TENANT",
  "SUSPEND_TENANT",
  "RESTORE_TENANT"
]);

// Audit actor type enum
export const auditActorTypeEnum = pgEnum("audit_actor_type", [
  "SUPERADMIN",
  "SYSTEM"
]);

// Audit Logs - journal d'audit pour toutes les actions administratives
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  actorId: varchar("actor_id", { length: 36 }).notNull(),
  actorType: auditActorTypeEnum("actor_type").notNull(),
  actorName: text("actor_name"),
  actionType: auditActionTypeEnum("action_type").notNull(),
  targetType: text("target_type").notNull(), // "tenant", "mandate_order", "mandate_invoice", etc.
  targetId: text("target_id").notNull(),
  targetName: text("target_name"), // Human-readable name of the target
  metadata: text("metadata"), // JSON string for additional context
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

export const STATUS_LABELS = {
  idea: {
    NEW: "Nouvelle",
    UNDER_REVIEW: "En cours d'examen",
    IN_PROGRESS: "En cours",
    DONE: "Realisee",
    REJECTED: "Rejetee"
  },
  incident: {
    NEW: "Nouveau",
    ACKNOWLEDGED: "Pris en compte",
    IN_PROGRESS: "En cours de traitement",
    RESOLVED: "Resolu",
    REJECTED: "Rejete"
  },
  meeting: {
    SCHEDULED: "Planifiee",
    COMPLETED: "Terminee",
    CANCELLED: "Annulee"
  }
};

// =====================================================
// CHORUS PRO CONFIGURATION - DOCUMENT NUMBERING FORMATS
// =====================================================

// Document type enum for numbering formats
export const documentTypeEnum = pgEnum("document_type", [
  "DEVIS",          // Devis (DV)
  "COMMANDE",       // Bon de commande (BC)
  "FACTURE",        // Facture (FA)
  "AVOIR"           // Avoir (AV)
]);

// Predefined Chorus Pro compliant numbering formats
export const documentNumberFormats = pgTable("document_number_formats", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(), // e.g., "BC-YYYY-NNNN", "ENG-YYYY-MM-NNNN"
  name: text("name").notNull(), // e.g., "Format annuel simple"
  description: text("description"), // Description of the format
  documentType: documentTypeEnum("document_type").notNull(),
  pattern: text("pattern").notNull(), // e.g., "{PREFIX}-{YEAR}-{SEQ:4}"
  prefix: text("prefix"), // Optional fixed prefix like "BC", "ENG"
  separator: text("separator").default("-"), // Default separator
  yearFormat: text("year_format").default("YYYY"), // YYYY or YY
  sequenceDigits: integer("sequence_digits").default(4), // Number of digits for sequence
  includeMonth: boolean("include_month").default(false),
  example: text("example"), // e.g., "BC-2026-0001"
  isDefault: boolean("is_default").default(false),
  isActive: boolean("is_active").default(true),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertDocumentNumberFormatSchema = createInsertSchema(documentNumberFormats).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertDocumentNumberFormat = z.infer<typeof insertDocumentNumberFormatSchema>;
export type DocumentNumberFormat = typeof documentNumberFormats.$inferSelect;

// =====================================================
// CHORUS PRO CONFIGURATION - SERVICE CODES
// =====================================================

// Default service codes for Chorus Pro
export const serviceCodes = pgTable("service_codes", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(), // e.g., "FIN", "DSI", "CAB"
  name: text("name").notNull(), // e.g., "Service Financier"
  description: text("description"),
  isDefault: boolean("is_default").default(false), // Part of default set
  isActive: boolean("is_active").default(true),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertServiceCodeSchema = createInsertSchema(serviceCodes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertServiceCode = z.infer<typeof insertServiceCodeSchema>;
export type ServiceCode = typeof serviceCodes.$inferSelect;

// =====================================================
// TENANT CHORUS PRO CONFIGURATION PREFERENCES
// =====================================================

// Tenant-specific service codes (copied from default or custom)
export const tenantServiceCodes = pgTable("tenant_service_codes", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTenantServiceCodeSchema = createInsertSchema(tenantServiceCodes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTenantServiceCode = z.infer<typeof insertTenantServiceCodeSchema>;
export type TenantServiceCode = typeof tenantServiceCodes.$inferSelect;

// Tenant document numbering configuration
export const tenantDocumentNumberingConfig = pgTable("tenant_document_numbering_config", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id),
  documentType: documentTypeEnum("document_type").notNull(),
  formatId: varchar("format_id", { length: 36 }).references(() => documentNumberFormats.id),
  customPrefix: text("custom_prefix"), // Tenant's custom prefix override
  currentSequence: integer("current_sequence").default(0), // Current sequence number
  lastResetYear: integer("last_reset_year"), // Year when sequence was last reset
  lastResetMonth: integer("last_reset_month"), // Month when sequence was last reset (if monthly reset)
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTenantDocumentNumberingConfigSchema = createInsertSchema(tenantDocumentNumberingConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTenantDocumentNumberingConfig = z.infer<typeof insertTenantDocumentNumberingConfigSchema>;
export type TenantDocumentNumberingConfig = typeof tenantDocumentNumberingConfig.$inferSelect;

// Default formats for document numbering
export const DOCUMENT_NUMBERING_DEFAULT_FORMATS = {
  DEVIS: [
    { code: "DV_ANNUAL_4", name: "Devis Annuel 4 chiffres", pattern: "{PREFIX}-{YEAR}-{SEQ:4}", prefix: "DV", example: "DV-2026-0001", description: "Format standard: DV-YYYY-NNNN" },
    { code: "DV_ANNUAL_5", name: "Devis Annuel 5 chiffres", pattern: "{PREFIX}-{YEAR}-{SEQ:5}", prefix: "DV", example: "DV-2026-00001", description: "Format etendu: DV-YYYY-NNNNN" },
    { code: "DV_MONTHLY", name: "Devis Mensuel", pattern: "{PREFIX}-{YEAR}-{MONTH}-{SEQ:4}", prefix: "DV", example: "DV-2026-01-0001", description: "Format mensuel: DV-YYYY-MM-NNNN" },
  ],
  COMMANDE: [
    { code: "BC_ANNUAL_4", name: "Commande Annuel 4 chiffres", pattern: "{PREFIX}-{YEAR}-{SEQ:4}", prefix: "BC", example: "BC-2026-0001", description: "Format standard: BC-YYYY-NNNN" },
    { code: "BC_ANNUAL_5", name: "Commande Annuel 5 chiffres", pattern: "{PREFIX}-{YEAR}-{SEQ:5}", prefix: "BC", example: "BC-2026-00001", description: "Format etendu: BC-YYYY-NNNNN" },
    { code: "BC_MONTHLY", name: "Commande Mensuel", pattern: "{PREFIX}-{YEAR}-{MONTH}-{SEQ:4}", prefix: "BC", example: "BC-2026-01-0001", description: "Format mensuel: BC-YYYY-MM-NNNN" },
  ],
  FACTURE: [
    { code: "FA_ANNUAL_4", name: "Facture Annuel 4 chiffres", pattern: "{PREFIX}-{YEAR}-{SEQ:4}", prefix: "FA", example: "FA-2026-0001", description: "Format standard: FA-YYYY-NNNN" },
    { code: "FA_ANNUAL_5", name: "Facture Annuel 5 chiffres", pattern: "{PREFIX}-{YEAR}-{SEQ:5}", prefix: "FA", example: "FA-2026-00001", description: "Format etendu: FA-YYYY-NNNNN" },
    { code: "FA_MONTHLY", name: "Facture Mensuel", pattern: "{PREFIX}-{YEAR}-{MONTH}-{SEQ:4}", prefix: "FA", example: "FA-2026-01-0001", description: "Format mensuel: FA-YYYY-MM-NNNN" },
  ],
  AVOIR: [
    { code: "AV_ANNUAL_4", name: "Avoir Annuel 4 chiffres", pattern: "{PREFIX}-{YEAR}-{SEQ:4}", prefix: "AV", example: "AV-2026-0001", description: "Format standard: AV-YYYY-NNNN" },
    { code: "AV_ANNUAL_5", name: "Avoir Annuel 5 chiffres", pattern: "{PREFIX}-{YEAR}-{SEQ:5}", prefix: "AV", example: "AV-2026-00001", description: "Format etendu: AV-YYYY-NNNNN" },
    { code: "AV_MONTHLY", name: "Avoir Mensuel", pattern: "{PREFIX}-{YEAR}-{MONTH}-{SEQ:4}", prefix: "AV", example: "AV-2026-01-0001", description: "Format mensuel: AV-YYYY-MM-NNNN" },
  ],
};

// Default service codes for municipalities
export const DEFAULT_SERVICE_CODES = [
  { code: "FIN", name: "Service Financier", description: "Service des finances et de la comptabilite" },
  { code: "DSI", name: "Direction des Systemes d'Information", description: "Service informatique et numerique" },
  { code: "CAB", name: "Cabinet du Maire", description: "Cabinet et secretariat du Maire" },
  { code: "SRV001", name: "Service General", description: "Service administratif general" },
];

// =====================================================
// ELECTED OFFICIAL FUNCTIONS (for mairies/EPCI)
// =====================================================
export const eluFunctions = pgTable("elu_functions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  label: text("label").notNull(),
  isDefault: boolean("is_default").default(false),
  isActive: boolean("is_active").default(true),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertEluFunctionSchema = createInsertSchema(eluFunctions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertEluFunction = z.infer<typeof insertEluFunctionSchema>;
export type EluFunction = typeof eluFunctions.$inferSelect;

// Default functions for elected officials (mairies/EPCI)
export const DEFAULT_ELU_FUNCTIONS = [
  { label: "Maire", isDefault: true, displayOrder: 1 },
  { label: "Adjoint", isDefault: true, displayOrder: 2 },
  { label: "Conseiller Delegue", isDefault: true, displayOrder: 3 },
  { label: "Conseiller", isDefault: true, displayOrder: 4 },
];

// =====================================================
// BUREAU MEMBER FUNCTIONS (for associations)
// =====================================================
export const bureauMemberFunctions = pgTable("bureau_member_functions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  label: text("label").notNull(),
  isDefault: boolean("is_default").default(false),
  isActive: boolean("is_active").default(true),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertBureauMemberFunctionSchema = createInsertSchema(bureauMemberFunctions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertBureauMemberFunction = z.infer<typeof insertBureauMemberFunctionSchema>;
export type BureauMemberFunction = typeof bureauMemberFunctions.$inferSelect;

// Default functions for bureau members (associations)
export const DEFAULT_BUREAU_MEMBER_FUNCTIONS = [
  { label: "President", isDefault: true, displayOrder: 1 },
  { label: "Vice-President", isDefault: true, displayOrder: 2 },
  { label: "Tresorier", isDefault: true, displayOrder: 3 },
  { label: "Tresorier Adjoint", isDefault: true, displayOrder: 4 },
  { label: "Secretaire", isDefault: true, displayOrder: 5 },
  { label: "Secretaire Adjoint", isDefault: true, displayOrder: 6 },
];

// =====================================================
// ACTIVITY LOGS & DEVICE TRACKING
// =====================================================
export const activityLogTypeEnum = pgEnum("activity_log_type", ["LOGIN", "LOGOUT", "PAGE_VIEW", "ACTION"]);
export const deviceTypeEnum = pgEnum("device_type", ["DESKTOP", "MOBILE", "TABLET", "UNKNOWN"]);

export const activityLogs = pgTable("activity_logs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  deviceId: text("device_id").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  deviceType: deviceTypeEnum("device_type").default("UNKNOWN"),
  browserName: text("browser_name"),
  osName: text("os_name"),
  activityType: activityLogTypeEnum("activity_type").notNull().default("LOGIN"),
  tenantId: varchar("tenant_id", { length: 36 }),
  tenantSlug: text("tenant_slug"),
  tenantName: text("tenant_name"),
  associationTenantId: varchar("association_tenant_id", { length: 36 }),
  associationSlug: text("association_slug"),
  associationName: text("association_name"),
  userId: varchar("user_id", { length: 36 }),
  userName: text("user_name"),
  userEmail: text("user_email"),
  userRole: text("user_role"),
  electedOfficialId: varchar("elected_official_id", { length: 36 }),
  electedOfficialName: text("elected_official_name"),
  bureauMemberId: varchar("bureau_member_id", { length: 36 }),
  bureauMemberName: text("bureau_member_name"),
  superadminId: varchar("superadmin_id", { length: 36 }),
  superadminEmail: text("superadmin_email"),
  actionDetails: text("action_details"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({
  id: true,
  createdAt: true,
});
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;

export const blockedDevices = pgTable("blocked_devices", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  deviceId: text("device_id").notNull().unique(),
  reason: text("reason"),
  blockedBy: varchar("blocked_by", { length: 36 }),
  blockedByEmail: text("blocked_by_email"),
  lastIpAddress: text("last_ip_address"),
  lastUserAgent: text("last_user_agent"),
  lastTenantName: text("last_tenant_name"),
  lastUserName: text("last_user_name"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertBlockedDeviceSchema = createInsertSchema(blockedDevices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertBlockedDevice = z.infer<typeof insertBlockedDeviceSchema>;
export type BlockedDevice = typeof blockedDevices.$inferSelect;
