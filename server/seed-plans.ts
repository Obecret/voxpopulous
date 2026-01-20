import { db } from "./db";
import { subscriptionPlans } from "@shared/schema";
import { eq } from "drizzle-orm";

async function seedPlans() {
  const defaultPlans = [
    {
      name: "Standard",
      code: "STANDARD",
      description: "Acces aux fonctionnalites essentielles pour les petites structures",
      monthlyPrice: 4900,
      yearlyPrice: 49000,
      hasIdeas: true,
      hasIncidents: true,
      hasMeetings: true,
      maxAdmins: 2,
      isActive: true,
    },
    {
      name: "Premium",
      code: "PREMIUM",
      description: "Acces complet avec support prioritaire pour les structures moyennes",
      monthlyPrice: 9900,
      yearlyPrice: 99000,
      hasIdeas: true,
      hasIncidents: true,
      hasMeetings: true,
      maxAdmins: 5,
      isActive: true,
    },
  ];

  for (const plan of defaultPlans) {
    const existing = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.code, plan.code));
    
    if (existing.length > 0) {
      console.log(`Plan ${plan.code} already exists, updating...`);
      await db.update(subscriptionPlans)
        .set({ ...plan, updatedAt: new Date() })
        .where(eq(subscriptionPlans.code, plan.code));
    } else {
      console.log(`Creating plan ${plan.code}...`);
      await db.insert(subscriptionPlans).values(plan);
    }
  }

  console.log("Plans seeded successfully!");
  console.log("Standard: 49 EUR/mois ou 490 EUR/an");
  console.log("Premium: 99 EUR/mois ou 990 EUR/an");
  
  process.exit(0);
}

seedPlans();
