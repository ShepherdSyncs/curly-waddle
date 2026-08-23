import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ExternalLink, ShieldAlert } from 'lucide-react';

export default function IframeCheckoutNotice({ open, onOpenChange }) {
  const publishedUrl = 'https://shepherdsync.base44.app/pricing';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert className="w-5 h-5 text-amber-500" />
            <DialogTitle className="text-lg">Checkout requires the published app</DialogTitle>
          </div>
          <DialogDescription className="text-sm">
            For your security, Stripe checkout can't open inside the app preview. Please open the published app to complete your subscription.
          </DialogDescription>
        </DialogHeader>
        <Button asChild className="w-full">
          <a href={publishedUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="w-4 h-4" />
            Open published app
          </a>
        </Button>
      </DialogContent>
    </Dialog>
  );
}