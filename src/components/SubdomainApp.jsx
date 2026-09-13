import React, { useState, useEffect } from 'react';
import { supabase } from '@/supabaseClient';
import ChurchPublicLanding from '@/components/church/ChurchPublicLanding';\nimport { setDemoMode } from '@/api/base44Client';

function toSlug(name) {
return (name || '').toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
}

export default function SubdomainApp() {
const [church, setChurch] = useState(null);
const [user, setUser] = useState(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
detectChurch();
loadUser();
}, []);

const loadUser = async () => {
try {
const { data: { session } } = await supabase.auth.getSession();
if (session) {
const { data: u } = await supabase.from('users').select('*').eq('email', session.user.email).maybeSingle();
setUser(u || null);
} else {
setUser(null);
}
} catch {
setUser(null);
}
};

const detectChurch = async () => {
const subdomain = window.location.hostname.split('.')[0];
try {
const res = await fetch('https://nzodqfzbowhyrnuauzzr.supabase.co/functions/v1/list-public-churches');
const list = await res.json();
const found = Array.isArray(list)? list.find(c =>
(c.subdomain && c.subdomain === subdomain) ||
(c.slug && c.slug === subdomain) ||
toSlug(c.name) === subdomain): null;
setChurch(found || null);
} catch (err) {
console.error('Subdomain church lookup failed:', err);
setChurch(null);
}
setLoading(false);
};

if (loading) {
return (<div className="fixed inset-0 flex items-center justify-center bg-slate-950">
<div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
</div>);
}

if (church && toSlug(church.name) === 'testchurch') {\n const DEMO_API = 'https://nzodqfzbowhyrnuauzzr.supabase.co/functions/v1/demo-data';\n fetch(DEMO_API).then(r => r.json()).then(d => {\n const cache = {};\n if (d.church) cache.churches = [d.church];\n if (d.members) cache.church_members = d.members;\n if (d.attendance) cache.attendance_records = d.attendance;\n if (d.giving) cache.giving_records = d.giving;\n if (d.events) cache.church_events = d.events;\n if (d.groups) cache.ministry_groups = d.groups;\n if (d.spiritual) cache.spiritual_records = d.spiritual;\n setDemoMode(cache);\n window.location.href = '/';\n });\n return (<div className='fixed inset-0 flex items-center justify-center'><div className='w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin' /></div>);\n}\nif (!church) {
return (<div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
<div className="text-center space-y-3 p-8">
<div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto">
<span className="text-2xl">🏛️</span>
</div>
<h1 className="text-xl font-serif font-semibold">Church Not Found</h1>
<p className="text-white/40 text-sm">
We couldn't find a church at this address.
</p>
</div>
</div>);
}

return <ChurchPublicLanding church={church} user={user} />;
}
