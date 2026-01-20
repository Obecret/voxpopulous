import Stripe from 'stripe';
import { db } from "./db";
import { superadminSettings } from "@shared/schema";

async function getStripeMode(): Promise<'test' | 'live'> {
  try {
    const settings = await db.select().from(superadminSettings).limit(1);
    if (settings.length > 0 && settings[0].stripeMode) {
      return settings[0].stripeMode;
    }
  } catch (error) {
    console.warn("Could not fetch Stripe mode from database, defaulting to test mode");
  }
  return 'test';
}

async function getCredentials() {
  const mode = await getStripeMode();
  
  let secretKey: string | undefined;
  let publishableKey: string | undefined;
  
  if (mode === 'live') {
    secretKey = process.env.STRIPE_SECRET_KEY_LIVE;
    publishableKey = process.env.STRIPE_PUBLISHABLE_KEY_LIVE;
  } else {
    secretKey = process.env.STRIPE_SECRET_KEY_TEST;
    publishableKey = process.env.STRIPE_PUBLISHABLE_KEY_TEST;
  }

  if (!secretKey || !publishableKey) {
    throw new Error(`Stripe ${mode} keys not configured. Please set STRIPE_SECRET_KEY_${mode.toUpperCase()} and STRIPE_PUBLISHABLE_KEY_${mode.toUpperCase()} in secrets.`);
  }

  return {
    publishableKey,
    secretKey,
    mode,
  };
}

export async function getUncachableStripeClient() {
  const { secretKey } = await getCredentials();
  return new Stripe(secretKey);
}

export async function getStripePublishableKey() {
  const { publishableKey } = await getCredentials();
  return publishableKey;
}

export async function getStripeSecretKey() {
  const { secretKey } = await getCredentials();
  return secretKey;
}

export async function getCurrentStripeMode() {
  return getStripeMode();
}

let stripeSync: any = null;

export async function getStripeSync() {
  if (!stripeSync) {
    const { StripeSync } = await import('stripe-replit-sync');
    const secretKey = await getStripeSecretKey();

    stripeSync = new StripeSync({
      poolConfig: {
        connectionString: process.env.DATABASE_URL!,
        max: 2,
      },
      stripeSecretKey: secretKey,
    });
  }
  return stripeSync;
}

export function invalidateStripeSync() {
  stripeSync = null;
}
