import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_LABELS = {
  not_started: { label: 'Not Connected', variant: 'secondary' },
  pending: { label: 'Setup In Progress', variant: 'secondary' },
  active: { label: 'Active', variant: 'default' },
  restricted: { label: 'Action Needed', variant: 'destructive' },
};

export default function StripeConnectPanel({ church, onRefresh }) {
  const [loading, setLoading] = useState(false);
  const status = church?.stripe_connect_status || 'not_started';
  const statusInfo = STATUS_LABELS[status] || STATUS_LABELS.not_started;

  const handleConnect = async () => {
    setLoading(true);
    try {
      const result = await base44.functions.invoke('stripe-connect-onboard', {
        churchId: church.id,
        returnUrl: window.location.href,
      });
      if (result?.url) {
        window.location.href = result.url;
      } else if (result?.status === 'active') {
        toast.success('Stripe is connected and ready to accept gifts!');
        onRefresh?.();
      }
    } catch (err) {
      toast.error(err.message || 'Could not start Stripe setup');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <CreditCard className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold">Online Giving via Stripe</p>
              <p className="text-xs text-muted-foreground">Card, Apple Pay, Google Pay, bank transfer &amp; recurring gifts — paid directly into your church's own bank account.</p>
            </div>
          </div>
          <Badge variant={statusInfo.variant} className="flex-shrink-0 gap-1">
            {status === 'active' ? <CheckCircle2 className="w-3 h-3" /> : status === 'restricted' ? <AlertTriangle className="w-3 h-3" /> : null}
            {statusInfo.label}
          </Badge>
        </div>

        {status === 'active' ? (
          <p className="text-sm text-muted-foreground">
            Members can now give online from the <span className="font-medium">Give Now</span> tab. Manage payouts and bank details anytime in your Stripe dashboard.
          </p>
        ) : (
          <Button size="sm" className="gap-1.5" onClick={handleConnect} disabled={loading}>
            {loading ? 'Loading…' : status === 'not_started' ? 'Connect Stripe' : 'Finish Setup'}
            <ExternalLink className="w-3.5 h-3.5" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
