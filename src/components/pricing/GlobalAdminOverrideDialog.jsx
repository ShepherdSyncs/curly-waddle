import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { base44 } from '@/api/base44Client';
import { ShieldCheck, Lock } from 'lucide-react';
import { toast } from 'sonner';

export default function GlobalAdminOverrideDialog({ church, open, onOpenChange, onDone }) {
  const [pin, setPin] = useState('');
  const [saving, setSaving] = useState(false);

  const handleApply = async () => {
    if (!pin.trim()) {
      toast.error('Please enter your admin pin code');
      return;
    }
    setSaving(true);
    try {
      await base44.functions.invoke('updateChurchTier', {
        churchId: church.id,
        tier: 'global_admin_override',
        pinCode: pin.trim(),
      });
      toast.success(`Full access granted to ${church.name}`);
      setPin('');
      onOpenChange(false);
      onDone?.();
    } catch (err) {
      toast.error(err?.message || 'Failed to apply override');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Global Admin Override
          </DialogTitle>
          <DialogDescription>
            Grant full access to {church?.name} without a paid subscription. This requires your global admin pin code.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
            <p className="text-xs text-amber-700 dark:text-amber-400">
              This will give {church?.name} unlimited members, full chat, mass texting, and all features at no cost.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pin" className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" /> Global Admin Pin Code
            </Label>
            <Input
              id="pin"
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Enter your pin code"
              onKeyDown={(e) => e.key === 'Enter' && handleApply()}
              disabled={saving}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleApply} disabled={saving || !pin.trim()} className="gap-2">
            <ShieldCheck className="w-4 h-4" />
            {saving ? 'Applying…' : 'Apply Override'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}