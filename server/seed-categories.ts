import { db } from "./db";
import { featureCategories } from "@shared/schema";

async function seedCategories() {
  console.log("Seeding feature categories...");

  const categories = [
    {
      name: "Boite a idees",
      code: "IDEA_BOX",
      description: "Fonctionnalites liees a la collecte et au vote des idees citoyennes",
      displayOrder: 1,
    },
    {
      name: "Signalements",
      code: "INCIDENTS",
      description: "Fonctionnalites de signalement de problemes locaux",
      displayOrder: 2,
    },
    {
      name: "Evenements",
      code: "EVENTS",
      description: "Fonctionnalites liees aux reunions publiques et evenements",
      displayOrder: 3,
    },
  ];

  for (const category of categories) {
    const existing = await db.query.featureCategories.findFirst({
      where: (c, { eq }) => eq(c.code, category.code),
    });

    if (!existing) {
      await db.insert(featureCategories).values(category);
      console.log(`Created category: ${category.name}`);
    } else {
      console.log(`Category already exists: ${category.name}`);
    }
  }

  console.log("Feature categories seeding complete!");
  process.exit(0);
}

seedCategories().catch((err) => {
  console.error("Error seeding categories:", err);
  process.exit(1);
});
