import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';
import Stripe from 'npm:stripe@17';

// Stripe Price IDs for ShepherdSyncs subscription tiers
const PRICE_MAP = {
  basic: { monthly: 'price_1U4SgMAzfO3rjLFcBIkmZDrg' },
  growth: { monthly: 'price_1U4SgMAzfO3rjLFc31vZMOZO', yearly: 'price_1U4SgMAzfO3rjLFcvZOARKiJ' },
};

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { churchId, tier, billingCycle, paymentMethod } = body;

    // Validate tier
    const validTiers = ['basic', 'growth'];
    if (!validTiers.includes(tier)) {
      return Response.json({ error: 'Invalid tier for checkout' }, { status: 400 });
    }
    const cycle = billingCycle === 'yearly' ? 'yearly' : 'monthly';
    const priceId = PRICE_MAP[tier]?.[cycle];
    if (!priceId) {
      return Response.json({ error: 'Price not found for this tier/cycle' }, { status: 400 });
    }

    // Fetch church
    const churches = await base44.asServiceRole.entities.Church.filter({ id: churchId });
    if (!churches?.length) {
      return Response.json({ error: 'Church not found' }, { status: 404 });
    }
    const church = churches[0];

    // Check authorization — must be a church admin or global admin
    try {
      const user = await base44.auth.me();
      const isGlobalAdmin = user.role === 'admin' || user.role === 'global_admin';
      const isChurchAdmin = church.admin_emails?.includes(user.email) || church.admin_email === user.email;
      if (!isGlobalAdmin && !isChurchAdmin) {
        return Response.json({ error: 'Only church admins can subscribe' }, { status: 403 });
      }
    } catch {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    const stripeKey = secrets.get('STRIPE_SECRET_KEY');
    const stripe = new Stripe(stripeKey);
    const appId = Deno.env.get('BASE44_APP_ID');
    const origin = req.headers.get('origin') || 'https://shepherdsync.base44.app';

    // Cancel existing subscription if switching plans
    if (church.stripe_subscription_id) {
      try {
        await stripe.subscriptions.cancel(church.stripe_subscription_id);
      } catch (err) {
        console.error('Failed to cancel old subscription:', err.message);
      }
    }

    // Build checkout session parameters
    const sessionParams = {
      mode: 'subscription' as const,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/pricing?checkout=success`,
      cancel_url: `${origin}/pricing?checkout=cancelled`,
      client_reference_id: churchId,
      metadata: {
        church_id: churchId,
        tier,
        billing_cycle: cycle,
        base44_app_id: appId,
      },
      subscription_data: {
        metadata: {
          church_id: churchId,
          tier,
          billing_cycle: cycle,
          base44_app_id: appId,
        },
      },
    };

    // Reuse existing Stripe customer if available
    if (church.stripe_customer_id) {
      (sessionParams as any).customer = church.stripe_customer_id;
    }

    // Set payment method types based on user selection
    if (paymentMethod === 'bank') {
      (sessionParams as any).payment_method_types = ['us_bank_account'];
    } else {
      (sessionParams as any).payment_method_types = ['card'];
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return Response.json({ url: session.url });
  } catch (error) {
    console.error('createCheckoutSession error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}