import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const PLATFORMS = [
  { value: '__none__', label: 'None — hide external button' },
  { value: 'planning_center', label: 'Planning Center' },
  { value: 'elvanto', label: 'Elvanto' },
  { value: 'elexio', label: 'Elexio' },
  { value: 'churchcenter', label: 'Church Center' },
  { value: 'pushpay', label: 'PushPay' },
  { value: 'tithely', label: 'Tithe.ly' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'venmo', label: 'Venmo' },
  { value: 'cash_app', label: 'Cash App' },
  { value: 'custom', label: 'Other / Custom' },
];

export default function OnlineGivingConfig({ church, onSave }) {
  const [platform, setPlatform] = useState(church?.online_giving_platform || '__none__');
  const [url, setUrl] = useState(church?.online_giving_url || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPlatform(church?.online_giving_platform || '__none__');
    setUrl(church?.online_giving_url || '');
  }, [church?.id]);

  const handleSave = async () => {
    setSaving(true);
    await onSave({
      online_giving_platform: platform === '__none__' ? null : platform,
      online_giving_url: url,
    });
    toast.success('Giving platform saved');
    setSaving(false);
  };

  return (
    <div className="space-y-3">
      <div>
        <Label>Platform</Label>
        <Select value={platform} onValueChange={setPlatform}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {PLATFORMS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {platform !== '__none__' && (
        <div>
          <Label>Giving URL</Label>
          <Input
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://give.planningcenteronline.com/..."
            type="url"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Paste your church's giving link here. It will appear as a button on your public giving page.
          </p>
        </div>
      )}
      <Button size="sm" onClick={handleSave} disabled={saving || (platform !== '__none__' && !url)}>
        {saving ? 'Saving…' : 'Save'}
      </Button>
    </div>
  );
}