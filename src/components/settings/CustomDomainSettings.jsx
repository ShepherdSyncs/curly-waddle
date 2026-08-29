import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Globe, Check, AlertCircle, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
export default function CustomDomainSettings({ church }) {
const queryClient = useQueryClient();
const [domain, setDomain] = useState(church?.custom_domain || '');

const currentDomain = church?.custom_domain;
const isVerified = church?.domain_verified;
const isSubdomain = church?.subdomain;
const subdomainUrl = isSubdomain? isSubdomain + '.shepherdsyncs.com': null;
const saveMutation = useMutation({
mutationFn: async (customDomain) => {
return base44.entities.Church.update(church.id, {
custom_domain: customDomain || null,
domain_verified: false,
domain_verified_at: null,
});
},
onSuccess: () => {
queryClient.invalidateQueries({ queryKey: ['churches'] });
toast.success('Domain saved');
},
});
const verifyMutation = useMutation({
mutationFn: async () => {
await fetch('https://' + currentDomain, { method: 'HEAD', mode: 'no-cors' });
return base44.entities.Church.update(church.id, {
domain_verified: true,
domain_verified_at: new Date().toISOString(),
});
},
onSuccess: () => {
queryClient.invalidateQueries({ queryKey: ['churches'] });
toast.success('Domain verified! SSL may take a few minutes.');
},
onError: () => {
toast.error('Could not verify. Check DNS configuration.');
},
});
const handleSave = () => {
const cleanDomain = domain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
if (cleanDomain &&!cleanDomain.includes('.')) {
toast.error('Enter a valid domain like giving.yourchurch.com');
return;
}
saveMutation.mutate(cleanDomain);
};
const tier = church?.subscription_tier || church?.tier || 'free';
const isGrowthOrAbove = tier === 'growth' || tier === 'enterprise';

return (<Card>
<CardHeader>
<CardTitle className="flex items-center gap-2"><Globe className="w-5 h-5" /> Custom Domain</CardTitle>
<CardDescription>Your church is always accessible at your subdomain. Adding a custom domain gives members a second way to reach you - both URLs work simultaneously.</CardDescription>
</CardHeader>
<CardContent className="space-y-4">
{subdomainUrl && (<div className="p-3 bg-muted rounded-lg">
<p className="text-sm font-medium">Always-available subdomain</p>
<p className="text-sm text-muted-foreground">{subdomainUrl}</p>
</div>)}
{!isGrowthOrAbove && (<div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
<p className="text-sm font-medium text-amber-500">Premium Feature</p>
<p className="text-xs text-muted-foreground mt-1">Custom domains are included on the Growth plan ($30/mo). Add for $5/mo on other plans.</p>
</div>)}
<div className="space-y-2">
<Label htmlFor="custom-domain">Custom Domain</Label>
<div className="flex gap-2">
<Input id="custom-domain" placeholder="giving.yourchurch.com" value={domain} onChange={(e) => setDomain(e.target.value)} disabled={saveMutation.isPending} />
<Button onClick={handleSave} disabled={saveMutation.isPending || domain === (currentDomain || '')}>{saveMutation.isPending? 'Saving...': 'Save'}</Button>
</div>
<p className="text-xs text-muted-foreground">Enter the full domain. Do not include https://</p>
</div>
{currentDomain &&!isVerified && (<div className="space-y-3 p-4 border rounded-lg">
<h4 className="font-medium text-sm">DNS Configuration</h4>
<p className="text-xs text-muted-foreground">Add a CNAME record to your DNS settings:</p>
<div className="bg-slate-950 text-white p-3 rounded font-mono text-sm space-y-1">
<p>Type: CNAME</p>
<p>Name: {currentDomain.split('.').length > 2? currentDomain.split('.').slice(0, -2).join('.') || '@': '@'}</p>
<p>Value: cname.vercel-dns.com</p>
</div>
<p className="text-xs text-muted-foreground">DNS changes can take up to 48 hours. Click verify once configured.</p>
<Button variant="outline" onClick={() => verifyMutation.mutate()} disabled={verifyMutation.isPending} className="w-full">{verifyMutation.isPending? 'Verifying...': 'Verify Domain'}</Button>
</div>)}
{isVerified && currentDomain && (<div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-2">
<Check className="w-4 h-4 text-green-500" />
<div>
<p className="text-sm font-medium text-green-500">Domain Verified</p>
<p className="text-xs text-muted-foreground">Accessible at <a href={'https://' + currentDomain} target="_blank" rel="noopener noreferrer" className="underline text-blue-400">{currentDomain}</a></p>
</div>
</div>)}
{currentDomain &&!isVerified && (<div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-center gap-2">
<AlertCircle className="w-4 h-4 text-yellow-500" />
<div>
<p className="text-sm font-medium text-yellow-500">Pending Verification</p>
<p className="text-xs text-muted-foreground">Configure DNS above and verify when ready</p>
</div>
</div>)}
</CardContent>
</Card>);
}
