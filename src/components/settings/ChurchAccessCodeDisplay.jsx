import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import useAppUser from '@/hooks/useAppUser';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Key, Copy } from 'lucide-react';
import { toast } from 'sonner';

export default function ChurchAccessCodeDisplay() {
const { user } = useAppUser();
const [code, setCode] = useState(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
if (!user?.church_id) return;
loadCode();
}, [user?.church_id]);

const loadCode = async () => {
setLoading(true);
try {
const codes = await base44.entities.ChurchAccessCode.filter({ church_id: user.church_id });
setCode(codes[0]?.code || null);
} catch (err) {}
setLoading(false);
};

const copyCode = () => {
if (code) {
navigator.clipboard.writeText(code);
toast.success('Copied');
}
};

if (loading ||!code) return null;

return (<Card>
<CardHeader>
<div className="flex items-center gap-2"><Key className="w-5 h-5 text-primary" /><CardTitle className="text-lg">Support Access Code</CardTitle></div>
<CardDescription>Share this code with the ShepherdSyncs team when they need to help with your account.</CardDescription>
</CardHeader>
<CardContent>
<div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
<code className="text-lg font-mono tracking-widest">{code}</code>
<button onClick={copyCode} className="text-muted-foreground hover:text-foreground"><Copy className="w-4 h-4" /></button>
</div>
<p className="text-xs text-muted-foreground mt-2">Treat this like a password. Only share with trusted support personnel.</p>
</CardContent>
</Card>);
}
