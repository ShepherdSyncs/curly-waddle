import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { churchId, tier, pinCode } = body;

    // Church admins may only self-downgrade to 'free' through this endpoint.
    // Paid tiers (basic/growth/enterprise) must go through real Stripe checkout
    // (createCheckoutSession + stripeWebhook) — this endpoint used to allow any
    // church admin to directly grant themselves a paid tier as a "trial" with no
    // one-time-use guard, meaning it could be called repeatedly to indefinitely
    // avoid ever paying. That capability has been removed.
    const validTiers = ['free', 'global_admin_override'];
    if (!validTiers.includes(tier)) {
      return Response.json({ error: 'This endpoint only supports switching to the free tier. Paid plans are handled through checkout.' }, { status: 400 });
    }

    const isGlobalAdmin = user.role === 'admin' || user.role === 'global_admin';

    // Fetch church up front — needed for the current tier (email notification) and admin check
    const churches = await base44.asServiceRole.entities.Church.filter({ id: churchId });
    if (!churches?.length) {
      return Response.json({ error: 'Church not found' }, { status: 404 });
    }
    const church = churches[0];

    // For global_admin_override, require global admin + pin code
    if (tier === 'global_admin_override') {
      if (!isGlobalAdmin) {
        return Response.json({ error: 'Global admin required for this override' }, { status: 403 });
      }
      const adminPin = secrets.get("GLOBAL_ADMIN_PIN");
      if (!adminPin || pinCode !== adminPin) {
        return Response.json({ error: 'Invalid pin code' }, { status: 403 });
      }
    } else {
      // Church admins can set free/basic/growth for their own church
      const isChurchAdmin = (church.admin_emails?.includes(user.email) || church.admin_email === user.email);
      if (!isGlobalAdmin && !isChurchAdmin) {
        return Response.json({ error: 'Only church admins can change the plan' }, { status: 403 });
      }
    }

    // Build update data
    const updateData = { subscription_tier: tier };
    if (tier === 'free') {
      updateData.subscription_status = 'none';
      updateData.trial_end_date = null;
      updateData.billing_cycle = 'monthly';
    } else if (tier === 'global_admin_override') {
      updateData.subscription_status = 'active';
      updateData.trial_end_date = null;
    }

    await base44.asServiceRole.entities.Church.update(churchId, updateData);

    return Response.json({ success: true, tier, ...updateData });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}