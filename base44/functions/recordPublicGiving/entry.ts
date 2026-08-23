import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // Intentionally public/anonymous — this is called from the logged-out giving
    // tab on a church's public landing page, so most callers won't have a session.
    // We still attach the user's email/name if they happen to be logged in.
    const user = await base44.auth.me().catch(() => null);

    const { churchId, memberName, email, amount, type, notes } = await req.json();

    if (!churchId) {
      return Response.json({ error: 'churchId is required' }, { status: 400 });
    }

    // Validate the church actually exists, so this can't be used to write
    // arbitrary financial-looking records under a made-up churchId
    const churches = await base44.asServiceRole.entities.Church.filter({ id: churchId });
    if (!churches?.length) {
      return Response.json({ error: 'Church not found' }, { status: 404 });
    }

    // Validate amount is a positive number
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0 || parsedAmount > 1000000) {
      return Response.json({ error: 'Invalid amount' }, { status: 400 });
    }

    // Cap free-text field lengths from an anonymous, unauthenticated caller
    const safeName = (memberName || user?.full_name || 'Anonymous').toString().slice(0, 200);
    const safeNotes = (notes || (email ? `Email: ${email}` : '')).toString().slice(0, 500);

    const record = await base44.asServiceRole.entities.GivingRecord.create({
      church_id: churchId,
      member_name: safeName,
      date: new Date().toISOString().split('T')[0],
      amount: parsedAmount,
      type: type || 'offering',
      method: 'online',
      notes: safeNotes,
    });

    return Response.json(record);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
