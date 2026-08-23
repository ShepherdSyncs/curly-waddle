import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Plus, Copy, Trash2, ExternalLink, Webhook, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const SOURCES = [
  { value: 'google_forms', label: 'Google Forms' },
  { value: 'typeform', label: 'Typeform' },
  { value: 'jotform', label: 'JotForm' },
  { value: 'other', label: 'Other' },
];

const MEMBER_FIELDS = ['first_name', 'last_name', 'email', 'phone', 'address'];

function generateToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(18)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

const emptyForm = {
  name: '',
  source: 'other',
  field_map: { first_name: '', last_name: '', email: '', phone: '', address: '' },
  create_follow_up: true,
  is_active: true,
};

export default function FormIntegrationsTab({ churchId }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [webhookUrl, setWebhookUrl] = useState(null);

  const { data: integrations = [], isLoading } = useQuery({
    queryKey: ['form-integrations', churchId],
    queryFn: () => base44.entities.FormIntegration.filter({ church_id: churchId }),
    enabled: !!churchId,
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (editId) return base44.entities.FormIntegration.update(editId, data);
      return base44.entities.FormIntegration.create({ ...data, church_id: churchId, webhook_token: generateToken() });
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['form-integrations', churchId] });
      toast.success(editId ? 'Integration updated' : 'Integration created');
      // Show webhook URL on first create
      if (!editId) {
        setWebhookUrl(buildWebhookUrl(saved));
      }
      setOpen(false);
      setForm(emptyForm);
      setEditId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.FormIntegration.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form-integrations', churchId] });
      toast.success('Integration deleted');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }) => base44.entities.FormIntegration.update(id, { is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['form-integrations', churchId] }),
  });

  function buildWebhookUrl(integration) {
    const appId = base44.appId || window.__BASE44_APP_ID__ || '';
    return `https://api.base44.com/api/apps/${appId}/functions/formWebhook`;
  }

  function buildPayloadHint(integration) {
    return JSON.stringify({
      integration_id: integration.id,
      token: integration.webhook_token,
      first_name: '{{first_name_field}}',
      last_name: '{{last_name_field}}',
    }, null, 2);
  }

  function openEdit(integration) {
    setEditId(integration.id);
    setForm({
      name: integration.name,
      source: integration.source || 'other',
      field_map: integration.field_map || emptyForm.field_map,
      create_follow_up: integration.create_follow_up !== false,
      is_active: integration.is_active !== false,
    });
    setOpen(true);
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  }

  const sourceLabel = (src) => SOURCES.find(s => s.value === src)?.label || src;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Form Integrations</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Connect Google Forms, Typeform, JotForm, or any tool that supports webhooks. Submissions automatically create a visitor record and follow-up task.
          </p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => { setEditId(null); setForm(emptyForm); setOpen(true); }}>
          <Plus className="w-4 h-4" /> Add Integration
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!isLoading && integrations.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-muted-foreground">
            <Webhook className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No form integrations yet. Add one to start capturing visitor submissions.</p>
          </CardContent>
        </Card>
      )}

      {integrations.map(intg => (
        <Card key={intg.id}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">{intg.name}</CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">{sourceLabel(intg.source)}</Badge>
                  {intg.total_submissions > 0 && (
                    <span className="text-xs text-muted-foreground">{intg.total_submissions} submission{intg.total_submissions !== 1 ? 's' : ''}</span>
                  )}
                  {intg.last_received_at && (
                    <span className="text-xs text-muted-foreground">Last: {new Date(intg.last_received_at).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Switch
                  checked={intg.is_active !== false}
                  onCheckedChange={(v) => toggleMutation.mutate({ id: intg.id, is_active: v })}
                />
                <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => openEdit(intg)}>
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="w-7 h-7 text-destructive"
                  onClick={() => { if (window.confirm('Delete this integration?')) deleteMutation.mutate(intg.id); }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Webhook Endpoint</p>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
                  {buildWebhookUrl(intg)}
                </code>
                <Button size="icon" variant="ghost" className="w-7 h-7 shrink-0" onClick={() => copyToClipboard(buildWebhookUrl(intg))}>
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Required Payload (include in webhook body)</p>
              <div className="relative">
                <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">{buildPayloadHint(intg)}</pre>
                <Button size="icon" variant="ghost" className="absolute top-1 right-1 w-6 h-6"
                  onClick={() => copyToClipboard(buildPayloadHint(intg))}>
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Webhook URL after first create */}
      {webhookUrl && (
        <Card className="border-primary/40">
          <CardContent className="py-4 space-y-2">
            <p className="text-sm font-semibold text-primary flex items-center gap-2">
              <ExternalLink className="w-4 h-4" /> Integration Created — Copy your Webhook URL
            </p>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">{webhookUrl}</code>
              <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={() => copyToClipboard(webhookUrl)}>
                <Copy className="w-3.5 h-3.5" /> Copy
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Paste this URL into your form tool's webhook settings. Include <code>integration_id</code> and <code>token</code> in the payload.</p>
            <Button size="sm" variant="ghost" className="text-xs" onClick={() => setWebhookUrl(null)}>Dismiss</Button>
          </CardContent>
        </Card>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditId(null); setForm(emptyForm); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Integration' : 'New Form Integration'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Integration Name *</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Sunday Visitor Card" />
              </div>
              <div className="col-span-2">
                <Label>Form Source</Label>
                <Select value={form.source} onValueChange={v => setForm({ ...form, source: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SOURCES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Field Mapping</p>
              <p className="text-xs text-muted-foreground mb-3">
                Enter the exact field name your form tool sends for each field. Leave blank to use default auto-detection.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {MEMBER_FIELDS.map(f => (
                  <div key={f}>
                    <Label className="text-xs capitalize">{f.replace('_', ' ')}</Label>
                    <Input
                      className="h-8 text-xs"
                      placeholder={`form field name`}
                      value={form.field_map?.[f] || ''}
                      onChange={e => setForm({ ...form, field_map: { ...form.field_map, [f]: e.target.value } })}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={form.create_follow_up}
                onCheckedChange={v => setForm({ ...form, create_follow_up: v })}
              />
              <Label className="cursor-pointer">Auto-create follow-up task for each submission</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              disabled={!form.name || saveMutation.isPending}
              onClick={() => saveMutation.mutate(form)}
            >
              {saveMutation.isPending ? 'Saving…' : editId ? 'Save Changes' : 'Create Integration'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}