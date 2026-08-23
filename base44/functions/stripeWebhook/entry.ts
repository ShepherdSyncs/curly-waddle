import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';
import Stripe from 'npm:stripe@17';

export default async function(req) {
  try {
    const stripeKey = secrets.get('STRIPE_SECRET_KEY');
    const webhookSecret = secrets.get('STRIPE_WEBHOOK_SECRET');
    const stripe = new Stripe(stripeKey);

    const rawBody = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature || !webhookSecret) {
      console.error('stripeWebhook: missing signature or webhook secret');
      return Response.json({ error: 'Missing signature or webhook secret' }, { status: 400 });
    }

    // Verify the webhook signature
    let event;
    try {
      event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
    } catch (err) {
      console.error('stripeWebhook: signature verification failed:', err.message);
      return Response.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        const churchId = session.metadata?.church_id;
        const tier = session.metadata?.tier;
        const billingCycle = session.metadata?.billing_cycle;

        if (churchId && tier) {
          const churches = await base44.asServiceRole.entities.Church.filter({ id: churchId });
          const church = churches?.[0];
          const previousTier = church?.subscription_tier || 'free';

          await base44.asServiceRole.entities.Church.update(churchId, {
            subscription_tier: tier,
            subscription_status: 'active',
            billing_cycle: billingCycle || 'monthly',
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription,
            subscription_started_at: new Date().toISOString(),
            trial_end_date: null,
          });
          console.log(`stripeWebhook: church ${churchId} subscribed to ${tier} (${billingCycle})`);

          // Notify on any real, paid upgrade (free→paid or paid→paid)
          if (church) {
            const tierRank = { free: 0, basic: 1, growth: 2, enterprise: 3 };
            const isUpgrade = (tierRank[tier] ?? -1) > (tierRank[previousTier] ?? -1);
            if (isUpgrade) {
              const tierLabel = (t) => t.charAt(0).toUpperCase() + t.slice(1);
              base44.asServiceRole.integrations.Core.SendEmail({
                to: 'brad@shepherdsyncs.com',
                subject: `${church.name} upgraded — ${tierLabel(previousTier)} → ${tierLabel(tier)}`,
                body: `${church.name} is interested in upgrading their plan from ${tierLabel(previousTier)} to ${tierLabel(tier)}. Send an email to the pastor to check to see how they are liking the platform and if they have any questions.`,
                from_name: 'ShepherdSyncs',
              }).catch((err) => console.error('Upgrade notification email failed:', err));
            }
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as any;
        const churchId = sub.metadata?.church_id;
        if (churchId) {
          const statusMap = {
            active: 'active',
            past_due: 'past_due',
            canceled: 'cancelled',
            unpaid: 'past_due',
            incomplete: 'past_due',
          };
          const newStatus = statusMap[sub.status] || 'active';
          await base44.asServiceRole.entities.Church.update(churchId, {
            subscription_status: newStatus,
            stripe_subscription_id: sub.id,
          });
          console.log(`stripeWebhook: church ${churchId} subscription updated to ${newStatus}`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as any;
        const churchId = sub.metadata?.church_id;
        if (churchId) {
          await base44.asServiceRole.entities.Church.update(churchId, {
            subscription_tier: 'free',
            subscription_status: 'none',
            billing_cycle: null,
            stripe_subscription_id: null,
          });
          console.log(`stripeWebhook: church ${churchId} subscription deleted — downgraded to free`);
        }
        break;
      }

      default:
        // Unhandled event type — no action needed
        break;
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('stripeWebhook error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}