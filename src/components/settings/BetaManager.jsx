import React, { useState } from 'react';
import { supabase } from '@/supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Shield, UserCheck, UserX, Clock, CheckCircle2 } from 'lucide-react';

export default function BetaManager() {
const queryClient = useQueryClient();

const { data: churches = [], isLoading } = useQuery({
queryKey: ['beta-churches'],
queryFn: async () => {
const { data, error } = await supabase.from('churches').select('id, name, subscription_tier, beta_start_date, beta_last_feedback, beta_suspended').order('name');
if (error) throw error;
return data;
},
});

const betaChurches = churches.filter(c => c.subscription_tier === 'beta');
const suspended = betaChurches.filter(c => c.beta_suspended);
const active = betaChurches.filter(c =>!c.beta_suspended);
const other = churches.filter(c => c.subscription_tier!== 'beta');

const assignBeta = useMutation({
mutationFn: async (churchId) => {
const { error } = await supabase.from('churches').update({
subscription_tier: 'beta',
beta_start_date: new Date().toISOString(),
beta_last_feedback: new Date().toISOString(),
beta_suspended: false,
}).eq('id', churchId);
if (error) throw error;
},
onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['beta-churches'] }); toast.success('Church assigned to beta'); },
onError: (e) => toast.error(e.message),
});

const reinstate = useMutation({
mutationFn: async (churchId) => {
const { error } = await supabase.from('churches').update({
beta_suspended: false,
beta_last_feedback: new Date().toISOString(),
}).eq('id', churchId);
if (error) throw error;
},
onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['beta-churches'] }); toast.success('Access reinstated'); },
onError: (e) => toast.error(e.message),
});

const removeBeta = useMutation({
mutationFn: async (churchId) => {
const { error } = await supabase.from('churches').update({
subscription_tier: 'free',
beta_start_date: null,
beta_last_feedback: null,
beta_suspended: false,
}).eq('id', churchId);
if (error) throw error;
},
onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['beta-churches'] }); toast.success('Removed from beta'); },
onError: (e) => toast.error(e.message),
});

const daysSince = (date) => {
if (!date) return null;
return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
};

if (isLoading) return <div className="text-center py-8">Loading churches...</div>;

return (<div className="space-y-6">
<div className="grid sm:grid-cols-3 gap-4">
<Card><CardContent className="p-4 flex items-center gap-3"><Shield className="w-8 h-8 text-blue-500" /><div><p className="text-2xl font-bold">{betaChurches.length}</p><p className="text-xs text-muted-foreground">Beta Churches</p></div></CardContent></Card>
<Card><CardContent className="p-4 flex items-center gap-3"><CheckCircle2 className="w-8 h-8 text-green-500" /><div><p className="text-2xl font-bold">{active.length}</p><p className="text-xs text-muted-foreground">Active</p></div></CardContent></Card>
<Card><CardContent className="p-4 flex items-center gap-3"><UserX className="w-8 h-8 text-red-500" /><div><p className="text-2xl font-bold">{suspended.length}</p><p className="text-xs text-muted-foreground">Suspended</p></div></CardContent></Card>
</div>

{suspended.length > 0 && (<Card className="border-red-200">
<CardHeader><CardTitle className="text-lg text-red-600">Suspended - Action Required</CardTitle></CardHeader>
<CardContent className="space-y-3">
{suspended.map(c => {
const days = daysSince(c.beta_last_feedback);
return (<div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-red-50">
<div><p className="font-medium">{c.name}</p><p className="text-xs text-muted-foreground">No feedback for {days} days</p></div>
<div className="flex gap-2">
<Button size="sm" onClick={() => reinstate.mutate(c.id)} disabled={reinstate.isPending}><UserCheck className="w-3 h-3 mr-1" />Reinstate</Button>
</div>
</div>);
})}
</CardContent>
</Card>)}

{active.length > 0 && (<Card>
<CardHeader><CardTitle className="text-lg">Active Beta Churches</CardTitle></CardHeader>
<CardContent className="space-y-3">
{active.map(c => {
const days = daysSince(c.beta_last_feedback);
const sinceStart = daysSince(c.beta_start_date);
const remaining = Math.max(0, 180 - (sinceStart || 0));
return (<div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
<div>
<p className="font-medium">{c.name}</p>
<p className="text-xs text-muted-foreground flex items-center gap-3">
<span><Clock className="w-3 h-3 inline mr-1" />{remaining} days left</span>
<span>Last feedback: {days!== null? days + ' days ago': 'never'}</span>
</p>
</div>
<Button size="sm" variant="outline" onClick={() => removeBeta.mutate(c.id)} disabled={removeBeta.isPending}>Remove</Button>
</div>);
})}
</CardContent>
</Card>)}

<Card>
<CardHeader><CardTitle className="text-lg">Put a Church on Beta</CardTitle></CardHeader>
<CardContent className="space-y-3">
<p className="text-sm text-muted-foreground">Assigning beta gives a church 6 months of free access with all features. They must submit monthly feedback or their access is automatically suspended.</p>
{other.length === 0 && <p className="text-sm text-muted-foreground">No non-beta churches found.</p>}
{other.slice(0, 20).map(c => (<div key={c.id} className="flex items-center justify-between p-3 rounded-lg border">
<div><p className="font-medium">{c.name}</p><p className="text-xs text-muted-foreground">Current: {c.subscription_tier}</p></div>
<Button size="sm" onClick={() => assignBeta.mutate(c.id)} disabled={assignBeta.isPending}><Shield className="w-3 h-3 mr-1" />Assign Beta</Button>
</div>))}
</CardContent>
</Card>
</div>);
}
