import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const church_id = body.church_id || user.church_id;
    if (!church_id) return Response.json({ error: 'church_id required' }, { status: 400 });

    const svc = base44.asServiceRole;

    // Get the church
    const churches = await svc.entities.Church.filter({ id: church_id });
    if (!churches.length) return Response.json({ error: 'Church not found' }, { status: 404 });
    const church = churches[0];

    // Generate or get church_code
    let churchCode = church.church_code;
    if (!churchCode) {
      const words = church.name.trim().split(/\s+/).filter(w => w.length > 0);
      churchCode = words.map(w => w[0]).join('').toUpperCase().substring(0, 4);
      if (churchCode.length < 2) {
        churchCode = church.name.trim().substring(0, 3).toUpperCase();
      }
      // Ensure uniqueness across all churches
      const allChurches = await svc.entities.Church.list();
      const existingCodes = allChurches.map(c => c.church_code).filter(Boolean);
      const baseCode = churchCode;
      let suffix = 1;
      while (existingCodes.includes(churchCode)) {
        suffix++;
        churchCode = baseCode + suffix;
      }
      await svc.entities.Church.update(church.id, { church_code: churchCode });
    }

    // Find max member number for this church
    const members = await svc.entities.ChurchMember.filter({ church_id }, '-created_date', 10000);
    let maxNum = 999; // Start at 1000
    for (const m of members) {
      if (m.member_id) {
        const num = parseInt(m.member_id.replace(/\D/g, ''), 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    }

    const memberId = `${churchCode}${maxNum + 1}`;
    return Response.json({ member_id: memberId, church_code: churchCode });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}