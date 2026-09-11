import React, { useState } from 'react';
import { supabase } from '@/supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import useAppUser from '@/hooks/useAppUser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Phone } from 'lucide-react';

export default function TwilioConfig() {
const { user } = useAppUser();
const queryClient = useQueryClient();
const [sid, setSid] = useState('');
const [token, setToken] = useState('');
const [from, setFrom] = useState('');
const [saving, setSaving] = useState(false);

const { data: configured } = useQuery({
queryKey: ['twilio-configured'],
queryFn: async () => {
const { count } = await supabase.from('church_sms_credentials').select('*', { count: 'exact', head: true }).eq('church_id', user?.church_id);
return (count || 0) > 0;
},
enabled:!!user?.church_id,
});

const save = async () => {
if (!sid ||!token ||!from) { toast.error('All three fields are required'); return; }
setSaving(true);
const { error } = await supabase.from('church_sms_credentials').upsert({
church_id: user.church_id, twilio_account_sid: sid, twilio_auth_token: token, twilio_from_number: from,
}, { onConflict: 'church_id' });
setSaving(false);
if (error) { toast.error(error.message); return; }
toast.success('Twilio credentials saved. SMS is now active.');
setSid(''); setToken(''); setFrom('');
queryClient.invalidateQueries({ queryKey: ['twilio-configured'] });
};

return (<Card>
<CardHeader><CardTitle className="text-lg flex items-center gap-2"><Phone className="w-5 h-5 text-primary" />Twilio SMS Setup</CardTitle></CardHeader>
<CardContent className="space-y-3">
<p className="text-sm text-muted-foreground">To send mass texts, your church needs a Twilio account. Once you have one, enter your credentials below. They are encrypted and never visible to anyone after saving.</p>
{configured && <p className="text-sm text-green-600 font-medium">Twilio is configured and active.</p>}
<div className="space-y-3">
<div><Label>Account SID</Label><Input value={sid} onChange={e => setSid(e.target.value)} placeholder="ACxxxxxxxxxxxxxxxxxxxxx" /></div>
<div><Label>Auth Token</Label><Input value={token} onChange={e => setToken(e.target.value)} type="password" placeholder="Your auth token" /></div>
<div><Label>From Number</Label><Input value={from} onChange={e => setFrom(e.target.value)} placeholder="+1XXXXXXXXXX" /></div>
</div>
<Button onClick={save} disabled={saving}>{saving? 'Saving...': 'Save Credentials'}</Button>
<p className="text-xs text-muted-foreground">Don't have Twilio? Sign up at twilio.com. You get a free number with trial credits.</p>
</CardContent>
</Card>);
}
