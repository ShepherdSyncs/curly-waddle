import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { Bell, BellOff, Send } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

function urlBase64ToUint8Array(base64) {
const padding = '='.repeat((4 - (base64.length % 4)) % 4);
const b = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
const raw = window.atob(b);
const arr = new Uint8Array(raw.length);
for (let i = 0; i < raw.length; ++i) arr[i] = raw.charCodeAt(i);
return arr;
}

export default function PushNotificationManager() {
const [status, setStatus] = useState('Checking...');
const [subscribed, setSubscribed] = useState(false);
const [error, setError] = useState('');
const [testing, setTesting] = useState(false);

useEffect(() => {
if (!('serviceWorker' in navigator) ||!('PushManager' in window)) {
setStatus('Not supported in this browser');
return;
}
setStatus('Registering service worker...');
navigator.serviceWorker.register('/sw.js').then(async (reg) => {
setStatus('Service worker registered');
const sub = await reg.pushManager.getSubscription();
if (sub) { setSubscribed(true); setStatus('Already subscribed'); }
else { setStatus('Ready - click to enable'); }
}).catch(err => setStatus('SW failed: ' + err.message));
}, []);

const subscribe = async () => {
setError('');
try {
setStatus('Requesting permission...');
const perm = await Notification.requestPermission();
if (perm!== 'granted') { setStatus('Permission denied'); return; }
setStatus('Getting subscription...');
const reg = await navigator.serviceWorker.ready;
const key = import.meta.env.VITE_VAPID_PUBLIC_KEY;
if (!key) { setError('VAPID key missing - check Vercel env var'); setStatus('Config missing'); return; }
const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
setStatus('Saving subscription...');
const p256dh = btoa(String.fromCharCode(...new Uint8Array(sub.getKey('p256dh'))));
const auth = btoa(String.fromCharCode(...new Uint8Array(sub.getKey('auth'))));
const { data: { user } } = await supabase.auth.getUser();
if (!user) { setError('Not signed in'); return; }
const { error } = await supabase.from('push_subscriptions').upsert({ user_id: user.id, endpoint: sub.endpoint, p256dh, auth }, { onConflict: 'endpoint' });
if (error) { setError(error.message); return; }
setSubscribed(true);
setStatus('Notifications enabled');
} catch (err) { setError(err.message || String(err)); setStatus('Failed'); }
};

const sendTest = async () => {
setTesting(true);
setError('');
try {
const { data: { session } } = await supabase.auth.getSession();
if (!session) { setError('Not signed in'); setTesting(false); return; }
const res = await fetch('https://nzodqfzbowhyrnuauzzr.supabase.co/functions/v1/send-push', {
method: 'POST',
headers: { 'Authorization': 'Bearer ' + session.access_token, 'Content-Type': 'application/json' },
body: JSON.stringify({ userId: session.user.id, title: 'ShepherdSyncs', body: 'Push is working!', url: '/settings' })
});
const data = await res.json();
if (data.success) setStatus('Sent to ' + data.sent + ' device(s)');
else setError(JSON.stringify(data));
} catch (err) { setError(err.message); }
setTesting(false);
};

return (<Card>
<CardHeader>
<div className="flex items-center gap-2"><Bell className="w-5 h-5 text-primary" /><CardTitle className="text-lg">Push Notifications</CardTitle></div>
<CardDescription>Get reminders and updates on your device.</CardDescription>
</CardHeader>
<CardContent className="space-y-2">
<p className="text-sm">{status}</p>
{error && <p className="text-sm text-red-600">{error}</p>}
{subscribed? (<Button variant="outline" size="sm" onClick={sendTest} disabled={testing}>{testing? 'Sending...': 'Send Test Notification'}</Button>): status.startsWith('Ready') || status.startsWith('Already')? null:!status.includes('Not supported') &&!status.includes('failed') &&!status.includes('denied') &&!status.includes('missing')? (<Button onClick={subscribe} size="sm">Enable Notifications</Button>): null}
</CardContent>
</Card>);
}
