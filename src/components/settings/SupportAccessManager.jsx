import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import useAppUser from '@/hooks/useAppUser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Lock, Unlock, Shield } from 'lucide-react';
import { toast } from 'sonner';

export default function SupportAccessManager() {
const { user, isGlobalAdmin } = useAppUser();
const [churches, setChurches] = useState([]);
const [lockouts, setLockouts] = useState([]);
const [codeInput, setCodeInput] = useState('');
const [loading, setLoading] = useState(true);
const [unlocking, setUnlocking] = useState(false);

useEffect(() => {
if (!isGlobalAdmin) return;
loadData();
}, [isGlobalAdmin]);

const loadData = async () => {
setLoading(true);
try {
const [churchData, lockoutData] = await Promise.all([
base44.entities.Church.filter({}, 'name'),
base44.entities.AdminLockout.filter({ admin_email: user?.email })
]);
setChurches(churchData);
setLockouts(lockoutData);
} catch (err) {
toast.error('Failed to load');
}
setLoading(false);
};

const lockOut = async (churchId) => {
try {
await base44.entities.AdminLockout.create({ admin_email: user.email, church_id: churchId });
toast.success('Locked out');
loadData();
} catch (err) { toast.error('Failed'); }
};

const unlockWithCode = async () => {
if (!codeInput.trim()) return;
setUnlocking(true);
try {
const codes = await base44.entities.ChurchAccessCode.filter({ code: codeInput.trim() });
if (!codes.length) { toast.error('Invalid code'); setUnlocking(false); return; }
const churchId = codes[0].church_id;
for (const l of lockouts.filter(l => l.church_id === churchId)) {
await base44.entities.AdminLockout.delete(l.id);
}
toast.success('Access restored');
setCodeInput(''); loadData();
} catch (err) { toast.error('Failed'); }
setUnlocking(false);
};

if (loading) return null;
const isLocked = (id) => lockouts.some(l => l.church_id === id);

return (<Card>
<CardHeader>
<div className="flex items-center gap-2"><Shield className="w-5 h-5 text-primary" /><CardTitle>Support Access</CardTitle></div>
<CardDescription>Lock yourself out of a church to restrict access. Unlock with a code from the church.</CardDescription>
</CardHeader>
<CardContent className="space-y-4">
<div className="space-y-2">
{churches.map(c => (<div key={c.id} className="flex items-center justify-between p-3 rounded-lg border">
<div><p className="font-medium">{c.name}</p><p className="text-xs text-muted-foreground">{c.city}, {c.state}</p></div>
{isLocked(c.id)? <span className="text-xs text-amber-600 flex items-center gap-1"><Lock className="w-3 h-3" />Locked</span>: <Button variant="outline" size="sm" onClick={() => lockOut(c.id)} className="gap-1"><Lock className="w-3 h-3" />Lock Out</Button>}
</div>))}
</div>
<div className="border-t pt-4">
<Label className="mb-2 block">Enter Access Code</Label>
<div className="flex gap-2">
<Input value={codeInput} onChange={e => setCodeInput(e.target.value)} placeholder="Code from church" />
<Button onClick={unlockWithCode} disabled={unlocking ||!codeInput.trim()} className="gap-1"><Unlock className="w-3 h-3" />{unlocking? '...': 'Unlock'}</Button>
</div>
<p className="text-xs text-muted-foreground mt-1">Ask the church admin for their support access code.</p>
</div>
</CardContent>
</Card>);
}
