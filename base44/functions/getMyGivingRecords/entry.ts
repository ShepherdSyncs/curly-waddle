import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// GivingRecord's RLS intentionally restricts read access to admins and whoever
// personally created the record (financial data shouldn't be broadly queryable).
// That means a regular member calling GivingRecord.filter() directly gets nothing —
// even for their own gifts, since staff usually enters giving on their behalf.
// This function runs as the service role, verifies the caller's own identity itself,
// and returns ONLY that caller's own matching records — never anyone else's.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const churchId = user.church_id;

    // Find this member's own ChurchMember record(s) for a reliable match
    const memberFilter = churchId
      ? { church_id: churchId, email: user.email }
      : { email: user.email };
    const myMembers = await base44.asServiceRole.entities.ChurchMember.filter(memberFilter);
    const myMemberIds = new Set(myMembers.map(m => m.id));

    const allGiving = churchId
      ? await base44.asServiceRole.entities.GivingRecord.filter({ church_id: churchId }, '-date', 500)
      : await base44.asServiceRole.entities.GivingRecord.filter({ member_email: user.email }, '-date', 500);

    const nameLower = (user.full_name || '').trim().toLowerCase();
    const myRecords = (allGiving || []).filter(g =>
      (g.member_id && myMemberIds.has(g.member_id)) ||
      (g.member_email && g.member_email === user.email) ||
      (nameLower && g.member_name && g.member_name.trim().toLowerCase() === nameLower)
    );

    // Strip anything not relevant to "my own giving" before returning
    const records = myRecords.map(g => ({
      id: g.id,
      date: g.date,
      amount: g.amount,
      type: g.type,
      method: g.method,
      notes: g.notes,
    }));

    return Response.json({
      records,
      total: records.length,
      total_amount: records.reduce((sum, r) => sum + (r.amount || 0), 0),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});