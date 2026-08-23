import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Building2, CreditCard, Check, ShieldCheck } from 'lucide-react';

export default function CheckoutDialog({ open, onOpenChange, tier, billingCycle, onConfirm, isPending }) {
  const [paymentMethod, setPaymentMethod] = useState('bank');

  if (!tier || tier === 'free' || tier === 'enterprise') return null;

  const isGrowth = tier === 'growth';
  const isYearly = billingCycle === 'yearly';
  const price = isGrowth ? (isYearly ? 300 : 30) : 15;
  const period = isYearly ? 'year' : 'month';
  const yearlyNote = isYearly ? ' — Pay for 10 months, get 2 free' : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Choose Your Payment Method</DialogTitle>
          <DialogDescription className="text-sm space-y-2">
            <span className="block font-semibold text-foreground">Our Commitment to Your Church</span>
            At ShepherdSyncs, we believe your church should get the most from every dollar you invest in ministry. That's why we cover all subscription payment processing fees. Your church pays only the advertised subscription price—never an added processing fee.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Bank Account */}
          <button
            onClick={() => setPaymentMethod('bank')}
            className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
              paymentMethod === 'bank' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            }`}
          >
            <div className="flex items-start gap-3">
              <Building2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Bank Account</span>
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">Recommended</span>
                </div>
                <p className="text-lg font-bold mt-1">${price.toFixed(2)}/{period}{yearlyNote}</p>
                <p className="text-xs text-muted-foreground mt-1.5">
                  We recommend this option — lower processing fees mean more of your payment goes directly to supporting your church.
                </p>
              </div>
              {paymentMethod === 'bank' && <Check className="w-5 h-5 text-primary flex-shrink-0" />}
            </div>
          </button>

          {/* Credit/Debit Card */}
          <button
            onClick={() => setPaymentMethod('card')}
            className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
              paymentMethod === 'card' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            }`}
          >
            <div className="flex items-start gap-3">
              <CreditCard className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold">Credit or Debit Card</span>
                <p className="text-lg font-bold mt-1">${price.toFixed(2)}/{period}{yearlyNote}</p>
                <p className="text-xs text-muted-foreground mt-1.5">
                  We cover all processing fees, so your church pays nothing beyond the subscription price.
                </p>
              </div>
              {paymentMethod === 'card' && <Check className="w-5 h-5 text-primary flex-shrink-0" />}
            </div>
          </button>
        </div>

        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Secure payment processing. Cancel anytime.</span>
          </div>
          <p className="text-center text-sm font-medium text-foreground">
            No surprise fees. No added processing charges. Just one simple subscription price.
          </p>
        </div>

        <Button
          className="w-full"
          onClick={() => onConfirm(paymentMethod)}
          disabled={isPending}
        >
          {isPending ? 'Processing…' : `Continue with ${paymentMethod === 'bank' ? 'Bank Account' : 'Card'}`}
        </Button>
      </DialogContent>
    </Dialog>
  );
}