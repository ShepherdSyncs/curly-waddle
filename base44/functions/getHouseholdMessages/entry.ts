import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const allMessages = await base44.asServiceRole.entities.PastoralMessage.list();

    const mapMessage = (m: any) => ({
      id: m.id,
      sender_name: m.sender_name,
      sender_email: m.sender_email,
      subject: m.subject,
      body: m.body,
      status: m.status,
      reply_body: m.reply_body,
      replied_by_name: m.replied_by_name,
      created_date: m.created_date,
    });

    const sortByDate = (a: any, b: any) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime();

    // Always include the user's own messages
    const myMessages = allMessages.filter(m => m.sender_email === user.email);

    // Check if user is HOH of any family group
    const myMembers = await base44.asServiceRole.entities.ChurchMember.filter({ email: user.email });
    const myMemberIds = new Set(myMembers.map(m => m.id));

    const allGroups = await base44.asServiceRole.entities.FamilyGroup.list();
    const hohGroups = allGroups.filter(g =>
      (g.head_of_household_id && myMemberIds.has(g.head_of_household_id)) ||
      g.head_of_household_email === user.email
    );

    if (hohGroups.length === 0) {
      return Response.json({
        messages: myMessages.sort(sortByDate).map(mapMessage),
        isHOH: false,
      });
    }

    // HOH: gather all family member emails
    const familyEmails = new Set<string>();
    for (const group of hohGroups) {
      if (group.head_of_household_email) familyEmails.add(group.head_of_household_email);
      for (const m of (group.members || [])) {
        if (m.member_email) familyEmails.add(m.member_email);
      }
    }

    const familyMessages = allMessages.filter(m => m.sender_email && familyEmails.has(m.sender_email));

    return Response.json({
      messages: familyMessages.sort(sortByDate).map(mapMessage),
      isHOH: true,
      familyEmails: [...familyEmails],
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}