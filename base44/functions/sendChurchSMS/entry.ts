import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { churchId, message, recipients, fromNumberOverride } = body;

    if (!churchId || !message || !Array.isArray(recipients)) {
      return Response.json({ error: 'Missing required fields: churchId, message, recipients' }, { status: 400 });
    }

    // Verify the user is authorized for this church (admin or staff)
    const userRole = user.role;
    const isAdmin = userRole === 'global_admin' || userRole === 'admin' ||
                    userRole === 'church_admin' || userRole === 'ministry_staff' || userRole === 'church_staff';
    if (!isAdmin) {
      return Response.json({ error: 'Insufficient permissions to send mass texts' }, { status: 403 });
    }

    if (user.church_id && user.church_id !== churchId && userRole !== 'global_admin' && userRole !== 'admin') {
      return Response.json({ error: 'You can only send texts for your own church' }, { status: 403 });
    }

    // Fetch the church's own SMS credentials from the locked-down credentials entity
    // (never stored on the publicly-readable Church record)
    const church = await base44.asServiceRole.entities.Church.get(churchId);
    if (!church) return Response.json({ error: 'Church not found' }, { status: 404 });

    const credsList = await base44.asServiceRole.entities.ChurchSmsCredentials.filter({ church_id: churchId });
    const creds = credsList?.[0];

    if (!creds?.sms_enabled) {
      return Response.json({ error: 'SMS is not enabled for this church. Configure it in Settings.' }, { status: 400 });
    }

    const accountSid = creds.twilio_account_sid;
    const authToken = creds.twilio_auth_token;
    const fromNumber = fromNumberOverride || creds.twilio_from_number;

    if (!accountSid || !authToken || !fromNumber) {
      return Response.json({ error: 'Twilio credentials not fully configured' }, { status: 400 });
    }

    // Normalize phone numbers to E.164 (ensure leading +)
    const normalizePhone = (p) => {
      if (!p) return null;
      let cleaned = String(p).replace(/[^+0-9]/g, '');
      if (!cleaned) return null;
      if (!cleaned.startsWith('+')) {
        cleaned = '+' + cleaned;
      }
      // Basic validation: should be 11-15 digits with the +
      if (cleaned.length < 11 || cleaned.length > 16) return null;
      return cleaned;
    };

    const validRecipients = recipients
      .map(r => {
        const phone = typeof r === 'string' ? r : r.phone;
        const name = typeof r === 'string' ? '' : (r.name || '');
        return { phone: normalizePhone(phone), name };
      })
      .filter(r => r.phone);

    if (validRecipients.length === 0) {
      return Response.json({ error: 'No valid phone numbers found' }, { status: 400 });
    }

    // Twilio REST API — uses the church's own account, not platform credits
    const authHeader = 'Basic ' + btoa(`${accountSid}:${authToken}`);
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    const results = {
      total: validRecipients.length,
      sent: 0,
      failed: 0,
      errors: [] as Array<{ phone: string; error: string }>,
    };

    // Send sequentially to respect rate limits and track individual results
    for (const recipient of validRecipients) {
      try {
        const formData = new URLSearchParams();
        formData.append('From', fromNumber);
        formData.append('To', recipient.phone);
        formData.append('Body', message);

        const twilioRes = await fetch(twilioUrl, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData.toString(),
        });

        if (twilioRes.ok) {
          results.sent++;
        } else {
          const errBody = await twilioRes.text();
          let errMsg = `HTTP ${twilioRes.status}`;
          try {
            const errJson = JSON.parse(errBody);
            errMsg = errJson.message || errMsg;
          } catch { /* keep default */ }
          results.failed++;
          results.errors.push({ phone: recipient.phone, error: errMsg });
        }
      } catch (err) {
        results.failed++;
        results.errors.push({ phone: recipient.phone, error: err.message || 'Network error' });
      }
    }

    return Response.json({
      success: true,
      ...results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});