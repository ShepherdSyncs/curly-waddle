import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const ADMIN_PIN = '8032';

export default function DeleteChurchDialog({ church, onConfirm, onClose }) {
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);

  const handleDelete = () => {
    if (pin !== ADMIN_PIN) {
      setPinError(true);
      toast.error('Incorrect PIN');
      return;
    }
    onConfirm(church);
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Delete Church
          </DialogTitle>
          <DialogDescription className="sr-only">
            Permanently delete {church.name} after entering the global admin PIN.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            You are about to permanently delete <strong>{church.name}</strong>. This cannot be undone.
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
            />
            {pinError && <p className="text-xs text-red-500 mt-1">Incorrect PIN. Access denied.</p>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button variant="destructive" className="flex-1" onClick={handleDelete}>
              Delete Church
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
