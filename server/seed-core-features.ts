import { db } from "./db";
import { features, featureCategories } from "@shared/schema";
import { eq } from "drizzle-orm";

async function seedCoreFeatures() {
  console.log("Seeding core features...");

  const ideaBoxCategory = await db.query.featureCategories.findFirst({
    where: (c, { eq }) => eq(c.code, "IDEA_BOX"),
  });
  const incidentsCategory = await db.query.featureCategories.findFirst({
    where: (c, { eq }) => eq(c.code, "INCIDENTS"),
  });
  const eventsCategory = await db.query.featureCategories.findFirst({
    where: (c, { eq }) => eq(c.code, "EVENTS"),
  });

  if (!ideaBoxCategory || !incidentsCategory || !eventsCategory) {
    console.error("Categories not found. Please run seed-categories.ts first.");
    process.exit(1);
  }

  const coreFeatures = [
    {
      name: "Boite a idees",
      code: "IDEA_BOX_CORE",
      shortDescription: "Permet aux citoyens de proposer des idees et de voter sur les propositions de la communaute",
      categoryId: ideaBoxCategory.id,
    },
    {
      name: "Signalements",
      code: "INCIDENTS_CORE",
      shortDescription: "Permet de signaler des problemes locaux comme les degats sur la voirie, les lampadaires casses, etc.",
      categoryId: incidentsCategory.id,
    },
    {
      name: "Evenements et reunions",
      code: "EVENTS_CORE",
      shortDescription: "Calendrier des reunions publiques avec inscription des citoyens",
      categoryId: eventsCategory.id,
    },
  ];

  for (const feature of coreFeatures) {
    const existing = await db.query.features.findFirst({
      where: (f, { eq }) => eq(f.code, feature.code),
    });

    if (!existing) {
      await db.insert(features).values(feature);
      console.log(`Created feature: ${feature.name}`);
    } else {
      await db.update(features)
        .set({ categoryId: feature.categoryId })
        .where(eq(features.id, existing.id));
      console.log(`Updated feature: ${feature.name}`);
    }
  }

  console.log("Core features seeding complete!");
  process.exit(0);
}

seedCoreFeatures().catch((err) => {
  console.error("Error seeding core features:", err);
  process.exit(1);
});
