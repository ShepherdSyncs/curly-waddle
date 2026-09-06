import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { Bell, BellOff, Send } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

function urlBase64ToUint8Array(base64) {
const padding = '='.repeat((4 - (base64.length % 4)) % 4);
const b = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
const raw = window.atob(b);
const arr = new Uint8Array(raw.length);
for (let i = 0; i < raw.length; ++i) arr[i] = raw.charCodeAt(i);
return arr;
}

export default function PushNotificationManager() {
const [subscribed, setSubscribed] = useState(false);
const [loading, setLoading] = useState(false);
const [testing, setTesting] = useState(false);
const [supported, setSupported] = useState(true);

useEffect(() => {
if (!('serviceWorker' in navigator) ||!('PushManager' in window)) {
setSupported(false);
return;
}
navigator.serviceWorker.register('/sw.js').then(async (reg) => {
const sub = await reg.pushManager.getSubscription();
setSubscribed(!!sub);
}).catch(() => {});
}, []);

const subscribe = async () => {
setLoading(true);
try {
const perm = await Notification.requestPermission();
if (perm!== 'granted') { toast.error('Notification permission denied'); setLoading(false); return; }
const reg = await navigator.serviceWorker.ready;
const key = import.meta.env.VITE_VAPID_PUBLIC_KEY;
if (!key) { toast.error('Push not configured'); setLoading(false); return; }
const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
const p256dh = btoa(String.fromCharCode(...new Uint8Array(sub.getKey('p256dh'))));
const auth = btoa(String.fromCharCode(...new Uint8Array(sub.getKey('auth'))));
const { data: { user } } = await supabase.auth.getUser();
if (!user) { toast.error('Not signed in'); setLoading(false); return; }
const { error } = await supabase.from('push_subscriptions').upsert({ user_id: user.id, endpoint: sub.endpoint, p256dh, auth }, { onConflict: 'endpoint' });
if (error) throw error;
setSubscribed(true);
toast.success('Notifications enabled');
} catch (err) { toast.error(err.message || 'Failed'); }
setLoading(false);
};

const sendTest = async () => {
setTesting(true);
try {
const { data: { session } } = await supabase.auth.getSession();
if (!session) { toast.error('Not signed in'); setTesting(false); return; }
const res = await fetch('https://nzodqfzbowhyrnuauzzr.supabase.co/functions/v1/send-push', {
method: 'POST',
headers: { 'Authorization': 'Bearer ' + session.access_token, 'Content-Type': 'application/json' },
body: JSON.stringify({ userId: session.user.id, title: 'ShepherdSyncs', body: 'Test notification - push is working!', url: '/settings' })
});
const data = await res.json();
if (data.success) toast.success('Notification sent to ' + data.sent + ' device(s)');
else toast.error(data.error || data.message || 'Failed');
} catch (err) { toast.error('Request failed'); }
setTesting(false);
};

if (!supported) return null;

return (<Card>
<CardHeader>
<div className="flex items-center gap-2">{subscribed? <Bell className="w-5 h-5 text-primary" />: <BellOff className="w-5 h-5 text-muted-foreground" />}<CardTitle className="text-lg">Push Notifications</CardTitle></div>
<CardDescription>Get reminders and updates sent to your device, even when you're not in the app.</CardDescription>
</CardHeader>
<CardContent>
{subscribed? (<div className="space-y-2">
<p className="text-sm text-green-600">Notifications are enabled on this device.</p>
<Button variant="outline" size="sm" onClick={sendTest} disabled={testing} className="gap-1"><Send className="w-3 h-3" />{testing? 'Sending...': 'Send Test'}</Button>
</div>): <Button onClick={subscribe} disabled={loading}>{loading? 'Enabling...': 'Enable Notifications'}</Button>}
</CardContent>
</Card>);
}
