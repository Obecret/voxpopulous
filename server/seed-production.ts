import { db } from "./db";
import { subscriptionPlans, addons, addonTiers, features, planAddonAccess, planFeatureAssignments } from "@shared/schema";
import { eq } from "drizzle-orm";

async function seedProduction() {
  console.log("=== Seeding Production Database ===\n");

  // 1. Seed Subscription Plans
  console.log("1. Seeding subscription plans...");
  const plansData = [
    {
      name: "Essai Gratuit",
      code: "FREE_TRIAL",
      description: "Essai gratuit de 30 jours avec toutes les fonctionnalités",
      monthlyPrice: 0,
      yearlyPrice: 0,
      hasIdeas: true,
      hasIncidents: true,
      hasMeetings: true,
      maxAdmins: 1,
      associationsIncluded: 0,
      communesIncluded: 0,
      isActive: true,
      isFree: true,
      isBestValue: false,
      hasPromo: false,
      promoPercent: 0,
      displayOrder: 0,
      targetTenantTypes: ["MAIRIE", "EPCI", "ASSOCIATION"] as ("MAIRIE" | "EPCI" | "ASSOCIATION")[],
    },
    {
      name: "Association",
      code: "ASSO",
      description: "Forfait spécial pour les associations intégrant toutes les fonctionnalités",
      monthlyPrice: 39,
      yearlyPrice: 390,
      hasIdeas: true,
      hasIncidents: true,
      hasMeetings: true,
      maxAdmins: 1,
      associationsIncluded: 0,
      communesIncluded: 0,
      isActive: true,
      isFree: false,
      isBestValue: true,
      hasPromo: false,
      promoPercent: 0,
      displayOrder: 1,
      targetTenantTypes: ["ASSOCIATION"] as ("MAIRIE" | "EPCI" | "ASSOCIATION")[],
    },
    {
      name: "Essentiel",
      code: "ESSENTIEL",
      description: "Forfait avec les options essentiels pour petite Structure (Mairie/Association)",
      monthlyPrice: 19,
      yearlyPrice: 190,
      hasIdeas: true,
      hasIncidents: true,
      hasMeetings: true,
      maxAdmins: 1,
      associationsIncluded: 0,
      communesIncluded: 0,
      isActive: true,
      isFree: false,
      isBestValue: false,
      hasPromo: false,
      promoPercent: 0,
      displayOrder: 2,
      targetTenantTypes: ["MAIRIE"] as ("MAIRIE" | "EPCI" | "ASSOCIATION")[],
    },
    {
      name: "Standard",
      code: "STANDARD",
      description: "Forfait avec accès aux fonctionnalités standard pour les moyennes structures. Hébergement jusqu'à 5 associations et 2 Administrateurs actifs",
      monthlyPrice: 29,
      yearlyPrice: 290,
      hasIdeas: true,
      hasIncidents: false,
      hasMeetings: false,
      maxAdmins: 1,
      associationsIncluded: 0,
      communesIncluded: 0,
      isActive: true,
      isFree: false,
      isBestValue: false,
      hasPromo: false,
      promoPercent: 0,
      displayOrder: 3,
      targetTenantTypes: ["MAIRIE"] as ("MAIRIE" | "EPCI" | "ASSOCIATION")[],
    },
    {
      name: "Pro",
      code: "PRO",
      description: "Accès à l'ensemble des fonctionnalités. hébergement jusqu'à 20 associations et 5 administrateurs actifs",
      monthlyPrice: 39,
      yearlyPrice: 390,
      hasIdeas: true,
      hasIncidents: true,
      hasMeetings: false,
      maxAdmins: 2,
      associationsIncluded: 0,
      communesIncluded: 0,
      isActive: true,
      isFree: false,
      isBestValue: true,
      hasPromo: false,
      promoPercent: 0,
      displayOrder: 4,
      targetTenantTypes: ["MAIRIE"] as ("MAIRIE" | "EPCI" | "ASSOCIATION")[],
    },
    {
      name: "Premium",
      code: "PREMIUM",
      description: "Accès à l'ensemble de toutes les fonctionnalités avec jusqu'à 100 associations hébergées et 10 administrateurs actifs",
      monthlyPrice: 49,
      yearlyPrice: 490,
      hasIdeas: true,
      hasIncidents: true,
      hasMeetings: true,
      maxAdmins: 1,
      associationsIncluded: 0,
      communesIncluded: 0,
      isActive: true,
      isFree: false,
      isBestValue: false,
      hasPromo: false,
      promoPercent: 0,
      displayOrder: 5,
      targetTenantTypes: ["MAIRIE"] as ("MAIRIE" | "EPCI" | "ASSOCIATION")[],
    },
    {
      name: "Établissement Public de Coopération Intercommunale",
      code: "EPCI",
      description: "Ce forfait regroupe une Intercommunalité intégrant plusieurs communes avec leurs associations rejoignant l'EPCI",
      monthlyPrice: 199,
      yearlyPrice: 1990,
      hasIdeas: true,
      hasIncidents: true,
      hasMeetings: true,
      maxAdmins: 1,
      associationsIncluded: 0,
      communesIncluded: 0,
      isActive: true,
      isFree: false,
      isBestValue: true,
      hasPromo: false,
      promoPercent: 0,
      displayOrder: 6,
      targetTenantTypes: ["EPCI"] as ("MAIRIE" | "EPCI" | "ASSOCIATION")[],
    },
  ];

  const planIdMap: Record<string, string> = {};

  for (const plan of plansData) {
    const existing = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.code, plan.code));
    
    if (existing.length > 0) {
      console.log(`  - Plan ${plan.code} already exists, updating...`);
      await db.update(subscriptionPlans)
        .set({ ...plan, updatedAt: new Date() })
        .where(eq(subscriptionPlans.code, plan.code));
      planIdMap[plan.code] = existing[0].id;
    } else {
      console.log(`  - Creating plan ${plan.code}...`);
      const [inserted] = await db.insert(subscriptionPlans).values(plan).returning();
      planIdMap[plan.code] = inserted.id;
    }
  }

  // 2. Seed Addons
  console.log("\n2. Seeding addons...");
  const addonsData = [
    {
      name: "Associations",
      code: "ASSOCIATIONS",
      description: "Gestion des associations locales avec espace dédié",
      isActive: true,
    },
    {
      name: "Administrateur",
      code: "ADMIN",
      description: "Administrateur du site",
      isActive: true,
    },
    {
      name: "Mairie",
      code: "MAIRIES",
      description: "Mairies faisant partie de la communauté de commune",
      isActive: true,
    },
  ];

  const addonIdMap: Record<string, string> = {};

  for (const addon of addonsData) {
    const existing = await db.select().from(addons).where(eq(addons.code, addon.code));
    
    if (existing.length > 0) {
      console.log(`  - Addon ${addon.code} already exists, updating...`);
      await db.update(addons)
        .set({ ...addon, updatedAt: new Date() })
        .where(eq(addons.code, addon.code));
      addonIdMap[addon.code] = existing[0].id;
    } else {
      console.log(`  - Creating addon ${addon.code}...`);
      const [inserted] = await db.insert(addons).values(addon).returning();
      addonIdMap[addon.code] = inserted.id;
    }
  }

  // 3. Seed Addon Tiers
  console.log("\n3. Seeding addon tiers...");
  const tiersData = [
    // ASSOCIATIONS tiers
    { addonCode: "ASSOCIATIONS", name: "Moins de 5 associations", minQuantity: 1, maxQuantity: 5, monthlyPrice: 15, yearlyPrice: 150, displayOrder: 1 },
    { addonCode: "ASSOCIATIONS", name: "Entre 6 et 20 associations", minQuantity: 6, maxQuantity: 20, monthlyPrice: 30, yearlyPrice: 300, displayOrder: 2 },
    { addonCode: "ASSOCIATIONS", name: "Entre 21 et 50 associations", minQuantity: 21, maxQuantity: 50, monthlyPrice: 60, yearlyPrice: 600, displayOrder: 3 },
    { addonCode: "ASSOCIATIONS", name: "Entre 51 et 100 associations", minQuantity: 51, maxQuantity: 100, monthlyPrice: 120, yearlyPrice: 1200, displayOrder: 4 },
    { addonCode: "ASSOCIATIONS", name: "Entre 101 et 200 associations", minQuantity: 101, maxQuantity: 200, monthlyPrice: 150, yearlyPrice: 1500, displayOrder: 5 },
    { addonCode: "ASSOCIATIONS", name: "Entre 201 et 500 associations", minQuantity: 201, maxQuantity: 500, monthlyPrice: 300, yearlyPrice: 3000, displayOrder: 6 },
    { addonCode: "ASSOCIATIONS", name: "Plus de 500 associations", minQuantity: 501, maxQuantity: null, monthlyPrice: 600, yearlyPrice: 6000, displayOrder: 7 },
    // ADMIN tiers
    { addonCode: "ADMIN", name: "Basique", minQuantity: 1, maxQuantity: 2, monthlyPrice: 0, yearlyPrice: 0, displayOrder: 1 },
    { addonCode: "ADMIN", name: "Standard", minQuantity: 3, maxQuantity: 10, monthlyPrice: 5, yearlyPrice: 50, displayOrder: 2 },
    { addonCode: "ADMIN", name: "Pro", minQuantity: 21, maxQuantity: 30, monthlyPrice: 15, yearlyPrice: 150, displayOrder: 3 },
    // MAIRIES tiers
    { addonCode: "MAIRIES", name: "Petite communauté de commune", minQuantity: 0, maxQuantity: 20, monthlyPrice: 199, yearlyPrice: 1990, displayOrder: 1 },
    { addonCode: "MAIRIES", name: "Communauté de communes intermédiaire", minQuantity: 21, maxQuantity: 40, monthlyPrice: 399, yearlyPrice: 3990, displayOrder: 2 },
    { addonCode: "MAIRIES", name: "Grande communauté de communes", minQuantity: 41, maxQuantity: 100, monthlyPrice: 799, yearlyPrice: 7990, displayOrder: 3 },
    { addonCode: "MAIRIES", name: "Très grande communauté de communes", minQuantity: 101, maxQuantity: null, monthlyPrice: 1599, yearlyPrice: 15990, displayOrder: 4 },
  ];

  for (const tier of tiersData) {
    const addonId = addonIdMap[tier.addonCode];
    if (!addonId) {
      console.log(`  - Skipping tier ${tier.name} - addon ${tier.addonCode} not found`);
      continue;
    }

    const existing = await db.select().from(addonTiers)
      .where(eq(addonTiers.addonId, addonId));
    
    const existingTier = existing.find(t => t.name === tier.name);
    
    if (existingTier) {
      console.log(`  - Tier ${tier.name} already exists for ${tier.addonCode}, updating...`);
      await db.update(addonTiers)
        .set({
          minQuantity: tier.minQuantity,
          maxQuantity: tier.maxQuantity,
          monthlyPrice: tier.monthlyPrice,
          yearlyPrice: tier.yearlyPrice,
          displayOrder: tier.displayOrder,
        })
        .where(eq(addonTiers.id, existingTier.id));
    } else {
      console.log(`  - Creating tier ${tier.name} for ${tier.addonCode}...`);
      await db.insert(addonTiers).values({
        addonId,
        name: tier.name,
        minQuantity: tier.minQuantity,
        maxQuantity: tier.maxQuantity,
        monthlyPrice: tier.monthlyPrice,
        yearlyPrice: tier.yearlyPrice,
        displayOrder: tier.displayOrder,
      });
    }
  }

  // 4. Seed Features
  console.log("\n4. Seeding features...");
  const featuresData = [
    { name: "Boite à idées", code: "IDEA_BOX_CORE", description: null, displayOrder: 1 },
    { name: "Signalements", code: "INCIDENTS_CORE", description: null, displayOrder: 2 },
    { name: "Evènements et réunions", code: "EVENTS_CORE", description: "L'ECPI, la commune ou l'association communique sur ses réunions et événements à venir (Conseil inter communal, communal, match, spectacle...)", displayOrder: 3 },
  ];

  const featureIdMap: Record<string, string> = {};

  for (const feature of featuresData) {
    const existing = await db.select().from(features).where(eq(features.code, feature.code));
    
    if (existing.length > 0) {
      console.log(`  - Feature ${feature.code} already exists, updating...`);
      await db.update(features)
        .set({ ...feature, updatedAt: new Date() })
        .where(eq(features.code, feature.code));
      featureIdMap[feature.code] = existing[0].id;
    } else {
      console.log(`  - Creating feature ${feature.code}...`);
      const [inserted] = await db.insert(features).values(feature).returning();
      featureIdMap[feature.code] = inserted.id;
    }
  }

  // 5. Seed Plan Addon Access
  console.log("\n5. Seeding plan addon access...");
  const planAddonAccessData = [
    // FREE_TRIAL
    { planCode: "FREE_TRIAL", addonCode: "ADMIN", isEnabled: true, quantity: 5 },
    { planCode: "FREE_TRIAL", addonCode: "ASSOCIATIONS", isEnabled: true, quantity: 20 },
    // ASSO
    { planCode: "ASSO", addonCode: "ADMIN", isEnabled: true, quantity: 1 },
    { planCode: "ASSO", addonCode: "ASSOCIATIONS", isEnabled: false, quantity: null },
    // ESSENTIEL
    { planCode: "ESSENTIEL", addonCode: "ADMIN", isEnabled: true, quantity: 1 },
    { planCode: "ESSENTIEL", addonCode: "ASSOCIATIONS", isEnabled: false, quantity: null },
    // STANDARD
    { planCode: "STANDARD", addonCode: "ADMIN", isEnabled: true, quantity: 2 },
    { planCode: "STANDARD", addonCode: "ASSOCIATIONS", isEnabled: true, quantity: 5 },
    // PRO
    { planCode: "PRO", addonCode: "ADMIN", isEnabled: true, quantity: 5 },
    { planCode: "PRO", addonCode: "ASSOCIATIONS", isEnabled: true, quantity: 20 },
    // PREMIUM
    { planCode: "PREMIUM", addonCode: "ADMIN", isEnabled: true, quantity: 10 },
    { planCode: "PREMIUM", addonCode: "ASSOCIATIONS", isEnabled: true, quantity: 100 },
    // EPCI
    { planCode: "EPCI", addonCode: "ADMIN", isEnabled: true, quantity: 1 },
    { planCode: "EPCI", addonCode: "ASSOCIATIONS", isEnabled: true, quantity: 20 },
    { planCode: "EPCI", addonCode: "MAIRIES", isEnabled: true, quantity: 10 },
  ];

  for (const access of planAddonAccessData) {
    const planId = planIdMap[access.planCode];
    const addonId = addonIdMap[access.addonCode];
    
    if (!planId || !addonId) {
      console.log(`  - Skipping access ${access.planCode} - ${access.addonCode} - missing IDs`);
      continue;
    }

    const existing = await db.select().from(planAddonAccess)
      .where(eq(planAddonAccess.planId, planId));
    
    const existingAccess = existing.find(a => a.addonId === addonId);
    
    if (existingAccess) {
      console.log(`  - Access ${access.planCode}-${access.addonCode} already exists, updating...`);
      await db.update(planAddonAccess)
        .set({ isEnabled: access.isEnabled, quantity: access.quantity })
        .where(eq(planAddonAccess.id, existingAccess.id));
    } else {
      console.log(`  - Creating access ${access.planCode}-${access.addonCode}...`);
      await db.insert(planAddonAccess).values({
        planId,
        addonId,
        isEnabled: access.isEnabled,
        quantity: access.quantity,
      });
    }
  }

  // 6. Seed Plan Feature Assignments
  console.log("\n6. Seeding plan feature assignments...");
  const planFeatureData = [
    // FREE_TRIAL - all features
    { planCode: "FREE_TRIAL", featureCodes: ["IDEA_BOX_CORE", "INCIDENTS_CORE", "EVENTS_CORE"] },
    // ASSO - all features
    { planCode: "ASSO", featureCodes: ["IDEA_BOX_CORE", "INCIDENTS_CORE", "EVENTS_CORE"] },
    // ESSENTIEL - only ideas
    { planCode: "ESSENTIEL", featureCodes: ["IDEA_BOX_CORE"] },
    // STANDARD - ideas and incidents
    { planCode: "STANDARD", featureCodes: ["IDEA_BOX_CORE", "INCIDENTS_CORE"] },
    // PRO - all features
    { planCode: "PRO", featureCodes: ["IDEA_BOX_CORE", "INCIDENTS_CORE", "EVENTS_CORE"] },
    // PREMIUM - all features
    { planCode: "PREMIUM", featureCodes: ["IDEA_BOX_CORE", "INCIDENTS_CORE", "EVENTS_CORE"] },
    // EPCI - all features
    { planCode: "EPCI", featureCodes: ["IDEA_BOX_CORE", "INCIDENTS_CORE", "EVENTS_CORE"] },
  ];

  for (const assignment of planFeatureData) {
    const planId = planIdMap[assignment.planCode];
    if (!planId) {
      console.log(`  - Skipping features for ${assignment.planCode} - plan not found`);
      continue;
    }

    for (const featureCode of assignment.featureCodes) {
      const featureId = featureIdMap[featureCode];
      if (!featureId) {
        console.log(`  - Skipping feature ${featureCode} for ${assignment.planCode} - feature not found`);
        continue;
      }

      const existing = await db.select().from(planFeatureAssignments)
        .where(eq(planFeatureAssignments.planId, planId));
      
      const existingAssignment = existing.find(a => a.featureId === featureId);
      
      if (!existingAssignment) {
        console.log(`  - Assigning feature ${featureCode} to plan ${assignment.planCode}...`);
        await db.insert(planFeatureAssignments).values({
          planId,
          featureId,
        });
      } else {
        console.log(`  - Feature ${featureCode} already assigned to ${assignment.planCode}`);
      }
    }
  }

  console.log("\n=== Production database seeding complete! ===");
  console.log("\nPlans created:");
  for (const plan of plansData) {
    console.log(`  - ${plan.name}: ${plan.monthlyPrice}€/mois, ${plan.yearlyPrice}€/an`);
  }
  
  process.exit(0);
}

seedProduction().catch((err) => {
  console.error("Error seeding production database:", err);
  process.exit(1);
});
