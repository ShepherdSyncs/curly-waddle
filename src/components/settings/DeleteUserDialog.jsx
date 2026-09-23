import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/supabaseClient';

export default function DeleteUserDialog({ targetUser, onConfirm, onClose }) {
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleDelete = async () => {
    setSubmitting(true);
    setPinError(false);
    const { error } = await supabase.rpc('delete_global_user', {
      p_user_id: targetUser.id,
      p_pin: pin,
    });
    setSubmitting(false);

    if (error) {
      if (error.message?.toLowerCase().includes('pin')) {
        setPinError(true);
        toast.error('Incorrect PIN');
      } else {
        toast.error('Failed to delete user: ' + error.message);
      }
      return;
    }

    toast.success(`${targetUser.full_name || targetUser.email} removed`);
    onConfirm?.(targetUser);
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="w-5 h-5" />
            Delete User
          </DialogTitle>
          <DialogDescription className="sr-only">
            Permanently delete {targetUser.full_name || targetUser.email} after entering the global admin PIN. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
            <strong>{targetUser.full_name || targetUser.email}</strong> will be permanently removed. This cannot be undone.
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
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter' && !submitting) handleDelete(); }}
            />
            {pinError && <p className="text-xs text-red-500 mt-1">Incorrect PIN. Access denied.</p>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={submitting}>Cancel</Button>
            <Button variant="destructive" className="flex-1" onClick={handleDelete} disabled={submitting || !pin}>
              {submitting ? 'Deleting...' : 'Delete User'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
