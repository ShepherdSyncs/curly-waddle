import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Generates a new API key for the caller's own church. The raw key is
// returned exactly once in this response and never stored or shown again —
// only its SHA-256 hash is persisted (ApiKey.key_hash), matching how
// publicApi authenticates incoming requests.

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateKey() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const random = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return `sk_${random}`;
}

const VALID_SCOPES = [
  'members:read', 'members:write',
  'events:read', 'events:write',
  'attendance:read', 'attendance:write',
  'giving:read', 'giving:write',
  'sermons:read', 'sermons:write',
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const isChurchAdmin = user.role === 'church_admin';
    const isGlobalAdmin = user.role === 'global_admin' || user.role === 'admin';
    if (!isChurchAdmin && !isGlobalAdmin) {
      return Response.json({ error: 'Only church admins can create API keys' }, { status: 403 });
    }

    const { name, scopes, churchId: churchIdOverride } = await req.json();
    const churchId = (isGlobalAdmin && churchIdOverride) ? churchIdOverride : user.church_id;
    if (!churchId) {
      return Response.json({ error: 'No church associated with this account' }, { status: 400 });
    }
    if (!name || !name.trim()) {
      return Response.json({ error: 'name is required' }, { status: 400 });
    }

    const grantedScopes = (Array.isArray(scopes) ? scopes : []).filter(s => VALID_SCOPES.includes(s));
    if (grantedScopes.length === 0) {
      return Response.json({ error: 'At least one valid scope is required', valid_scopes: VALID_SCOPES }, { status: 400 });
    }

    const rawKey = generateKey();
    const keyHash = await sha256(rawKey);

    const created = await base44.asServiceRole.entities.ApiKey.create({
      church_id: churchId,
      name: name.trim(),
      key_prefix: rawKey.slice(0, 12),
      key_hash: keyHash,
      scopes: grantedScopes,
      is_active: true,
      created_by_email: user.email,
      request_count: 0,
    });

    return Response.json({
      id: created.id,
      name: created.name,
      scopes: created.scopes,
      key: rawKey,
      key_prefix: created.key_prefix,
      warning: 'Save this key now — it will not be shown again.',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
