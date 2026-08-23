import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Church } from 'lucide-react';

export default function WelcomeDialog({ open, onOpen, churchName, onClose }) {
  return (
    <Dialog open={open} onOpenChange={(v) => {
      onOpen(v);
      if (!v && onClose) onClose();
    }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
              <Church className="w-5 h-5 text-primary" />
            </div>
            Welcome to ShepherdSyncs
          </DialogTitle>
          <DialogDescription className="text-base pt-3 leading-relaxed">
            {churchName ? (
              <>
                Welcome to ShepherdSyncs utilized by <strong className="text-foreground">{churchName}</strong>!
                If you have any questions about this platform, please see your church admins for help.
              </>
            ) : (
              <>
                Welcome to ShepherdSyncs!
                If you have any questions about this platform, please see your church admins for help.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={() => { onOpen(false); if (onClose) onClose(); }} className="w-full">
            Get Started
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}