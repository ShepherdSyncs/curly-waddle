import React from 'react';
import { base44 } from '@/api/base44Client';
import { Clock, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function TrialExpired() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-6">
          <Clock className="w-10 h-10 text-amber-600" />
        </div>
        <h1 className="text-2xl font-serif font-bold text-foreground mb-2">Trial Period Ended</h1>
        <p className="text-muted-foreground mb-6 leading-relaxed">
          Your account trial is over. Please contact the developer to upgrade your account and restore full access.
        </p>
        <div className="bg-muted/60 rounded-xl p-4 mb-6 text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Need help?</p>
          <p>Reach out to your platform administrator to activate a full subscription.</p>
        </div>
        <Button
          variant="outline"
          onClick={() => base44.auth.logout()}
          className="gap-2"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}