const fs = require('fs');
const lines = fs.readFileSync('src/pages/Churches.jsx', 'utf8').split('\n'
const startLine = 170;
let endLine = -1;
for (let i = startLine; i < lines.length; i++) {
if (lines[i].includes('</DialogContent>')) { endLine = i; break; }
}
if (endLine === -1) { console.log('Could not find </DialogContent>'); process.exit(1); }
const newSection = ` <div>
<Label>Custom Subdomain (DNS)</Label>
<div className="flex items-center mt-1">
<Input
value={form.subdomain}
onChange={e => setForm({...form, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
placeholder="livinghope"
/>
<span className="text-xs text-muted-foreground bg-muted border border-l-0 rounded-r-md px-2 h-9 flex items-center whitespace-nowrap">.shepherdsyncs.com</span>
</div>
<p className="text-xs text-muted-foreground mt-1">Set your DNS CNAME record from this subdomain to the app.</p>
</div>
<div>
<Label>Custom Domain (optional)</Label>
<Input
value={form.custom_domain}
onChange={e => setForm({...form, custom_domain: e.target.value.toLowerCase().replace(/[^a-z0-9.-]/g, '') })}
placeholder="giving.yourchurch.com"
/>
<p className="text-xs text-muted-foreground mt-1">Your own domain replaces the subdomain. Both URLs will work.</p>
</div>
<Button className="w-full" onClick={() => createMutation.mutate(form)} disabled={!form.name || createMutation.isPending}>
{createMutation.isPending? 'Creating...': 'Create Church'}
</Button>
</div>
</DialogContent>`;
lines.splice(startLine, endLine - startLine + 1,...newSection.split('\n'));
fs.writeFileSync('src/pages/Churches.jsx', lines.join('\n'));
console.log('Fixed lines ' + (startLine+1) + ' to ' + (endLine+1));
