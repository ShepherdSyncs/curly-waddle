import React, { useState, useEffect } from 'react';
import { supabase } from '@/supabaseClient';
import ChurchPublicLanding from '@/components/church/ChurchPublicLanding';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter as Router } from 'react-router-dom';
import { AuthProvider } from '@/lib/AuthContext';
import { ThemeProvider } from '@/lib/ThemeContext';
import { AuthenticatedApp } from '@/components/AuthenticatedApp';
import { Toaster } from '@/components/ui/toaster';

function toSlug(name) {
return (name || '').toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
}

export default function SubdomainApp() {
const [church, setChurch] = useState(null);
const [user, setUser] = useState(null);
const [loading, setLoading] = useState(true);
const [demoLoggingIn, setDemoLoggingIn] = useState(false);
const [demoReady, setDemoReady] = useState(false);

const subdomain = window.location.hostname.split('.')[0];

useEffect(() => {
if (subdomain === 'testchurch') {
setDemoLoggingIn(true);
supabase.auth.signInWithPassword({
email: 'demo@shepherdsyncs.com',
password: 'demo2024',
}).then(({ error }) => {
if (error) { setDemoLoggingIn(false); detectChurch(); }
else setDemoReady(true);
}).catch(() => { setDemoLoggingIn(false); detectChurch(); });
return;
}
detectChurch();
loadUser();
}, []);

const loadUser = async () => {
try {
const { data: { session } } = await supabase.auth.getSession();
if (session) {
const { data: u } = await supabase.from('users').select('*').eq('email', session.user.email).maybeSingle();
setUser(u || null);
} else { setUser(null); }
} catch { setUser(null); }
};

const detectChurch = async () => {
try {
const res = await fetch('https://nzodqfzbowhyrnuauzzr.supabase.co/functions/v1/list-public-churches');
const list = await res.json();
const found = Array.isArray(list)? list.find(c =>
(c.subdomain && c.subdomain === subdomain) ||
(c.slug && c.slug === subdomain) ||
toSlug(c.name) === subdomain): null;
setChurch(found || null);
} catch { setChurch(null); }
setLoading(false);
};

if (subdomain === 'testchurch' && demoReady) {
return (<ThemeProvider>
<AuthProvider>
<QueryClientProvider client={queryClientInstance}>
<Router>
<AuthenticatedApp />
</Router>
<Toaster />
</QueryClientProvider>
</AuthProvider>
</ThemeProvider>);
}

if (demoLoggingIn || loading) {
return (<div className="fixed inset-0 flex items-center justify-center bg-slate-950">
<div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
</div>);
}

if (!church) {
return (<div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
<div className="text-center space-y-3 p-8">
<div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto">
<span className="text-2xl">&#x1F3DB;</span>
</div>
<h1 className="text-xl font-serif font-semibold">Church Not Found</h1>
<p className="text-white/40 text-sm">We couldn't find a church at this address.</p>
</div>
</div>);
}

return <ChurchPublicLanding church={church} user={user} />;
}
