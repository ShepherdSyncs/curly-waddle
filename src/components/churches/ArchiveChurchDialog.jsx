import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Archive } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/supabaseClient';

export default function ArchiveChurchDialog({ church, onConfirm, onClose }) {
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleArchive = async () => {
    setSubmitting(true);
    setPinError(false);
    const { error } = await supabase.rpc('archive_church', {
      p_church_id: church.id,
      p_pin: pin,
    });
    setSubmitting(false);

    if (error) {
      if (error.message?.toLowerCase().includes('pin')) {
        setPinError(true);
        toast.error('Incorrect PIN');
      } else {
        toast.error('Failed to archive church: ' + error.message);
      }
      return;
    }

    toast.success(`${church.name} archived`);
    onConfirm?.(church);
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <Archive className="w-5 h-5" />
            Archive Church
          </DialogTitle>
          <DialogDescription className="sr-only">
            Archive {church.name} after entering the global admin PIN. This can be undone from Archived Churches.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
            <strong>{church.name}</strong> will be moved to Archived Churches and hidden from the active list.
            No data is deleted — you can restore it anytime from the Archived Churches menu.
          </div>
          <div>
            <Label>Enter Global Admin PIN to confirm</Label>
            <Input
              type="password"
              value={pin}
              onChange={e => { setPin(e.target.value); setPinError(false); }}
              placeholder="••••"
              className={pinError ? 'border-red-500' : ''}
              maxLength={8}
              onKeyDown={e => { if (e.key === 'Enter' && !submitting) handleArchive(); }}
            />
            {pinError && <p className="text-xs text-red-500 mt-1">Incorrect PIN. Access denied.</p>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={submitting}>Cancel</Button>
            <Button className="flex-1 bg-amber-600 hover:bg-amber-700" onClick={handleArchive} disabled={submitting || !pin}>
              {submitting ? 'Archiving...' : 'Archive Church'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
