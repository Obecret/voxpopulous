import { db } from "./db";
import { planAddonAccess, addons, subscriptionPlans } from "@shared/schema";
import { eq } from "drizzle-orm";

async function seedUnitPricing() {
  console.log("Seeding unit pricing for plan addons...");

  const allAddons = await db.select().from(addons);
  const allPlans = await db.select().from(subscriptionPlans);

  console.log(`Found ${allAddons.length} addons and ${allPlans.length} plans`);

  const addonPricing: Record<string, { monthlyUnit: number; yearlyUnit: number }> = {
    "ASSOCIATIONS": { monthlyUnit: 25, yearlyUnit: 250 },
    "ADMIN": { monthlyUnit: 15, yearlyUnit: 150 },
    "MAIRIES": { monthlyUnit: 50, yearlyUnit: 500 },
  };

  for (const plan of allPlans) {
    const accessRecords = await db.select().from(planAddonAccess)
      .where(eq(planAddonAccess.planId, plan.id));

    for (const access of accessRecords) {
      const addon = allAddons.find(a => a.id === access.addonId);
      if (!addon) continue;

      const pricing = addonPricing[addon.code.toUpperCase()];
      if (!pricing) continue;

      await db.update(planAddonAccess)
        .set({
          unitMonthlyPrice: pricing.monthlyUnit,
          unitYearlyPrice: pricing.yearlyUnit,
        })
        .where(eq(planAddonAccess.id, access.id));

      console.log(`Updated ${plan.name} - ${addon.name}: ${pricing.monthlyUnit}€/mois, ${pricing.yearlyUnit}€/an`);
    }
  }

  console.log("Unit pricing seeded successfully!");
  process.exit(0);
}

seedUnitPricing().catch(err => {
  console.error("Error seeding unit pricing:", err);
  process.exit(1);
});
