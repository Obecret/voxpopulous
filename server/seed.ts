import { db } from "./db";
import { tenants, users, ideas, incidents, meetings } from "@shared/schema";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("Seeding database...");
  
  const existingTenant = await db.select().from(tenants).where(eq(tenants.slug, "puiseux-en-france"));
  if (existingTenant.length > 0) {
    console.log("Demo data already exists, skipping seed.");
    return;
  }

  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 15);

  const [tenant] = await db.insert(tenants).values({
    name: "Puiseux-en-France",
    slug: "puiseux-en-france",
    contactEmail: "mairie@puiseux-en-france.fr",
    contactName: "Service Communication",
    subscriptionPlan: "FREE_TRIAL",
    billingStatus: "TRIAL",
    trialEndsAt,
  }).returning();

  console.log("Created demo tenant:", tenant.name);

  const passwordHash = await bcrypt.hash("admin123", 10);
  const [adminUser] = await db.insert(users).values({
    tenantId: tenant.id,
    name: "Administrateur",
    email: "admin@puiseux.fr",
    passwordHash,
    role: "ADMIN",
  }).returning();

  console.log("Created admin user:", adminUser.email);

  await db.insert(ideas).values([
    {
      tenantId: tenant.id,
      title: "Creer une piste cyclable avenue de la Gare",
      description: "Il serait benefique pour la commune de creer une piste cyclable securisee sur l'avenue de la Gare, tres frequentee par les cyclistes qui se rendent a la station.",
      category: "Transport",
      status: "UNDER_REVIEW",
      createdByEmail: "citoyen1@email.fr",
      publicToken: randomUUID(),
      votesCount: 24,
    },
    {
      tenantId: tenant.id,
      title: "Installation de bancs place du Marche",
      description: "Les personnes agees de notre commune auraient besoin de bancs supplementaires sur la place du Marche pour se reposer lors de leurs achats.",
      category: "Urbanisme",
      status: "NEW",
      publicToken: randomUUID(),
      votesCount: 12,
    },
    {
      tenantId: tenant.id,
      title: "Marche de producteurs locaux",
      description: "Organiser un marche mensuel mettant en avant les producteurs locaux du Val d'Oise pour favoriser les circuits courts.",
      category: "Economie",
      status: "IN_PROGRESS",
      createdByEmail: "producteur@local.fr",
      publicToken: randomUUID(),
      votesCount: 45,
    },
  ]);

  console.log("Created demo ideas");

  await db.insert(incidents).values([
    {
      tenantId: tenant.id,
      title: "Lampadaire en panne rue Victor Hugo",
      description: "Le lampadaire situe au numero 15 de la rue Victor Hugo est en panne depuis plusieurs jours, creant une zone sombre dangereuse le soir.",
      category: "Eclairage",
      status: "ACKNOWLEDGED",
      locationText: "15 rue Victor Hugo",
      createdByEmail: "riverain@email.fr",
      publicToken: randomUUID(),
    },
    {
      tenantId: tenant.id,
      title: "Nid de poule avenue de la Republique",
      description: "Un important nid de poule s'est forme devant le numero 23, tres dangereux pour les deux-roues.",
      category: "Voirie",
      status: "NEW",
      locationText: "23 avenue de la Republique",
      publicToken: randomUUID(),
    },
  ]);

  console.log("Created demo incidents");

  const meetingDate1 = new Date();
  meetingDate1.setDate(meetingDate1.getDate() + 14);
  meetingDate1.setHours(18, 30, 0, 0);

  const meetingDate2 = new Date();
  meetingDate2.setDate(meetingDate2.getDate() + 30);
  meetingDate2.setHours(19, 0, 0, 0);

  await db.insert(meetings).values([
    {
      tenantId: tenant.id,
      title: "Reunion de quartier Centre-Ville",
      description: "Venez echanger avec les elus sur les projets d'amenagement du centre-ville. Plusieurs idees citoyennes seront debattues.",
      dateTime: meetingDate1,
      location: "Salle des fetes - Grande salle",
      status: "SCHEDULED",
      capacity: 50,
    },
    {
      tenantId: tenant.id,
      title: "Conseil participatif - Budget 2025",
      description: "Presentation et discussion du budget previsionnel 2025 avec les habitants. Vos avis sont les bienvenus !",
      dateTime: meetingDate2,
      location: "Mairie - Salle du conseil",
      status: "SCHEDULED",
      capacity: 30,
    },
  ]);

  console.log("Created demo meetings");
  console.log("Seed completed successfully!");
}

seed().catch(console.error).finally(() => process.exit(0));
