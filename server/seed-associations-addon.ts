import { db } from "./db";
import { addons, addonTiers } from "@shared/schema";
import { eq } from "drizzle-orm";

async function seedAssociationsAddon() {
  console.log("Seeding Associations addon...");

  const existingAddon = await db.select().from(addons).where(eq(addons.code, "ASSOCIATIONS"));
  
  if (existingAddon.length > 0) {
    console.log("Associations addon already exists, skipping...");
    return;
  }

  const [addon] = await db.insert(addons).values({
    name: "Associations",
    code: "ASSOCIATIONS",
    description: "Gestion des associations locales avec espace dedie",
    isActive: true,
  }).returning();

  console.log(`Created addon: ${addon.name} (${addon.id})`);

  const tiers = [
    {
      name: "Moins de 5 associations",
      minQuantity: 1,
      maxQuantity: 5,
      monthlyPrice: 1500,
      yearlyPrice: 15000,
      displayOrder: 1,
    },
    {
      name: "Entre 6 et 20 associations",
      minQuantity: 6,
      maxQuantity: 20,
      monthlyPrice: 3000,
      yearlyPrice: 30000,
      displayOrder: 2,
    },
    {
      name: "Entre 21 et 50 associations",
      minQuantity: 21,
      maxQuantity: 50,
      monthlyPrice: 5000,
      yearlyPrice: 50000,
      displayOrder: 3,
    },
    {
      name: "Entre 51 et 100 associations",
      minQuantity: 51,
      maxQuantity: 100,
      monthlyPrice: 8000,
      yearlyPrice: 80000,
      displayOrder: 4,
    },
    {
      name: "Plus de 100 associations",
      minQuantity: 101,
      maxQuantity: null,
      monthlyPrice: 12000,
      yearlyPrice: 120000,
      displayOrder: 5,
    },
  ];

  for (const tier of tiers) {
    const [newTier] = await db.insert(addonTiers).values({
      addonId: addon.id,
      ...tier,
    }).returning();
    console.log(`  Created tier: ${newTier.name}`);
  }

  console.log("Associations addon seeded successfully!");
}

seedAssociationsAddon()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error seeding associations addon:", error);
    process.exit(1);
  });
