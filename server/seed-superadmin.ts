import { db } from "./db";
import { superadmins } from "@shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

async function seedSuperadmin() {
  const email = process.env.SUPERADMIN_EMAIL;
  const password = process.env.SUPERADMIN_PASSWORD;
  const name = process.env.SUPERADMIN_NAME || "Super Administrateur";

  if (!email || !password) {
    console.error("Error: SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD environment variables are required");
    console.error("Please set these secrets before running the seed script.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const existing = await db.select().from(superadmins).where(eq(superadmins.email, email));
    
    if (existing.length > 0) {
      console.log("Superadmin already exists:", email);
      process.exit(0);
    }

    await db.insert(superadmins).values({
      email,
      passwordHash,
      name,
    });

    console.log("Superadmin created successfully!");
    console.log("Email:", email);
    console.log("\n*** IMPORTANT: Changez le mot de passe apres la premiere connexion! ***");
  } catch (error: any) {
    if (error.code === "23505") {
      console.log("Superadmin already exists:", email);
    } else {
      console.error("Error creating superadmin:", error);
      throw error;
    }
  }

  process.exit(0);
}

seedSuperadmin();
