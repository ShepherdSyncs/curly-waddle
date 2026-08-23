import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Phone, Key, ShieldCheck, ExternalLink, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function SMSConfigTab({ church, onSaved }) {
  const [creds, setCreds] = useState(null);
  const [loadingCreds, setLoadingCreds] = useState(true);
  const [form, setForm] = useState({
    sms_enabled: false,
    sms_provider: 'twilio',
    twilio_account_sid: '',
    twilio_auth_token: '',
    twilio_from_number: '',
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testPhone, setTestPhone] = useState('');

  useEffect(() => {
    if (!church?.id) return;
    (async () => {
      setLoadingCreds(true);
      try {
        const list = await base44.entities.ChurchSmsCredentials.filter({ church_id: church.id });
        const existing = list?.[0] || null;
        setCreds(existing);
        if (existing) {
          setForm({
            sms_enabled: existing.sms_enabled || false,
            sms_provider: existing.sms_provider || 'twilio',
            twilio_account_sid: existing.twilio_account_sid || '',
            twilio_auth_token: existing.twilio_auth_token || '',
            twilio_from_number: existing.twilio_from_number || '',
          });
        }
      } catch (err) {
        // No credentials configured yet, or not authorized — fine, just start blank
      }
      setLoadingCreds(false);
    })();
  }, [church?.id]);

  const handleSave = async () => {
    if (form.sms_enabled && (!form.twilio_account_sid || !form.twilio_auth_token || !form.twilio_from_number)) {
      toast.error('Please fill in all Twilio credentials before enabling SMS');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        church_id: church.id,
        sms_enabled: form.sms_enabled,
        sms_provider: form.sms_provider,
        twilio_account_sid: form.twilio_account_sid,
        twilio_auth_token: form.twilio_auth_token,
        twilio_from_number: form.twilio_from_number,
        admin_emails: church.admin_emails || (church.admin_email ? [church.admin_email] : []),
      };
      if (creds?.id) {
        await base44.entities.ChurchSmsCredentials.update(creds.id, payload);
      } else {
        const created = await base44.entities.ChurchSmsCredentials.create(payload);
        setCreds(created);
      }
      toast.success('SMS configuration saved');
      if (onSaved) onSaved();
    } catch (err) {
      toast.error(err.message || 'Failed to save SMS config');
    }
    setSaving(false);
  };

  const handleTest = async () => {
    if (!testPhone) {
      toast.error('Enter a test phone number');
      return;
    }
    setTesting(true);
    try {
      const res = await base44.functions.invoke('sendChurchSMS', {
        churchId: church.id,
        message: 'Test message from ShepherdSyncs — your SMS platform is working!',
        recipients: [testPhone],
      });
      if (res.data?.error) {
        toast.error(res.data.error);
      } else if (res.data?.sent > 0) {
        toast.success('Test SMS sent successfully!');
      } else {
        toast.error(res.data?.errors?.[0]?.error || 'Test SMS failed');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to send test');
    }
    setTesting(false);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            Mass Texting Platform
          </CardTitle>
          <CardDescription>
            Connect your own Twilio account to send mass text messages to your members.
            All messages use <strong>your</strong> Twilio credits and API — ShepherdSyncs does not charge or control your texting.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Enable toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
            <div>
              <p className="font-medium text-sm flex items-center gap-2">
                Enable Mass Texting
                {form.sms_enabled && <Badge className="bg-emerald-500/20 text-emerald-600 border-emerald-500/30">Active</Badge>}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Turn on to use the Mass Texting page</p>
            </div>
            <Switch
              checked={form.sms_enabled}
              onCheckedChange={(v) => setForm({ ...form, sms_enabled: v })}
            />
          </div>

          {/* Credentials */}
          <div className="space-y-4">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
              <ShieldCheck className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground">
                Your Twilio credentials are stored securely and only used to send messages on your behalf.
                Get your credentials at{' '}
                <a href="https://console.twilio.com" target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">
                  console.twilio.com <ExternalLink className="w-3 h-3" />
                </a>
              </p>
            </div>

            <div>
              <Label className="flex items-center gap-1.5 text-sm mb-1.5">
                <Key className="w-3.5 h-3.5" /> Twilio Account SID
              </Label>
              <Input
                value={form.twilio_account_sid}
                onChange={(e) => setForm({ ...form, twilio_account_sid: e.target.value })}
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                className="font-mono text-sm"
              />
            </div>

            <div>
              <Label className="flex items-center gap-1.5 text-sm mb-1.5">
                <Key className="w-3.5 h-3.5" /> Twilio Auth Token
              </Label>
              <Input
                type="password"
                value={form.twilio_auth_token}
                onChange={(e) => setForm({ ...form, twilio_auth_token: e.target.value })}
                placeholder="Your Twilio auth token"
                className="font-mono text-sm"
              />
            </div>

            <div>
              <Label className="flex items-center gap-1.5 text-sm mb-1.5">
                <Phone className="w-3.5 h-3.5" /> Twilio From Number
              </Label>
              <Input
                value={form.twilio_from_number}
                onChange={(e) => setForm({ ...form, twilio_from_number: e.target.value })}
                placeholder="+12345678900"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">Must be in E.164 format with country code (e.g. +1...)</p>
            </div>
          </div>

          {/* Save */}
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save Configuration'}
          </Button>

          {/* Test SMS */}
          {form.sms_enabled && (creds?.twilio_account_sid || form.twilio_account_sid) && (
            <div className="pt-4 border-t space-y-3">
              <div>
                <p className="text-sm font-medium">Send a Test SMS</p>
                <p className="text-xs text-muted-foreground mt-0.5">Verify your credentials work before sending to your whole congregation</p>
              </div>
              <div className="flex gap-2">
                <Input
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="+12345678900"
                  className="font-mono text-sm flex-1"
                />
                <Button onClick={handleTest} disabled={testing} variant="outline" className="gap-2 flex-shrink-0">
                  {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                  {testing ? 'Sending...' : 'Send Test'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}