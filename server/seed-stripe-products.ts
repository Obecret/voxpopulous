import { getUncachableStripeClient } from './stripeClient';

async function seedStripeProducts() {
  const stripe = await getUncachableStripeClient();
  
  console.log('Creating Voxpopulous.fr pricing products...');

  const existingProducts = await stripe.products.search({ query: "name:'Voxpopulous'" });
  if (existingProducts.data.length > 0) {
    console.log('Products already exist, skipping seed');
    return;
  }

  const standardProduct = await stripe.products.create({
    name: 'Voxpopulous Standard',
    description: 'Perfect for small municipalities - Idea box, incident reporting, meeting calendar',
    metadata: {
      plan: 'STANDARD',
      features: 'ideas,incidents,meetings',
    },
  });

  const standardMonthlyPrice = await stripe.prices.create({
    product: standardProduct.id,
    unit_amount: 4900,
    currency: 'eur',
    recurring: { interval: 'month' },
    metadata: { plan: 'STANDARD', interval: 'monthly' },
  });

  const standardYearlyPrice = await stripe.prices.create({
    product: standardProduct.id,
    unit_amount: 49000,
    currency: 'eur',
    recurring: { interval: 'year' },
    metadata: { plan: 'STANDARD', interval: 'yearly' },
  });

  console.log('Standard product created:', standardProduct.id);
  console.log('  Monthly price:', standardMonthlyPrice.id, '- 49 EUR/month');
  console.log('  Yearly price:', standardYearlyPrice.id, '- 490 EUR/year');

  const premiumProduct = await stripe.products.create({
    name: 'Voxpopulous Premium',
    description: 'For larger municipalities - Everything in Standard plus analytics, priority support, and custom branding',
    metadata: {
      plan: 'PREMIUM',
      features: 'ideas,incidents,meetings,analytics,branding,priority_support',
    },
  });

  const premiumMonthlyPrice = await stripe.prices.create({
    product: premiumProduct.id,
    unit_amount: 9900,
    currency: 'eur',
    recurring: { interval: 'month' },
    metadata: { plan: 'PREMIUM', interval: 'monthly' },
  });

  const premiumYearlyPrice = await stripe.prices.create({
    product: premiumProduct.id,
    unit_amount: 99000,
    currency: 'eur',
    recurring: { interval: 'year' },
    metadata: { plan: 'PREMIUM', interval: 'yearly' },
  });

  console.log('Premium product created:', premiumProduct.id);
  console.log('  Monthly price:', premiumMonthlyPrice.id, '- 99 EUR/month');
  console.log('  Yearly price:', premiumYearlyPrice.id, '- 990 EUR/year');

  console.log('\nStripe products seeded successfully!');
  console.log('\nPrices to use in your application:');
  console.log('Standard Monthly:', standardMonthlyPrice.id);
  console.log('Standard Yearly:', standardYearlyPrice.id);
  console.log('Premium Monthly:', premiumMonthlyPrice.id);
  console.log('Premium Yearly:', premiumYearlyPrice.id);
}

seedStripeProducts()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error seeding Stripe products:', err);
    process.exit(1);
  });
