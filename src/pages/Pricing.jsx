import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import useAppUser from '@/hooks/useAppUser';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Crown, Sparkles, Building2, Zap, Users } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { TIERS, getTierConfig, isTrialActive, getTrialDaysRemaining } from '@/lib/tiers';
import CheckoutDialog from '@/components/pricing/CheckoutDialog';
import IframeCheckoutNotice from '@/components/pricing/IframeCheckoutNotice';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';

export default function Pricing() {
  const { user, isChurchAdmin, isGlobalAdmin, activeChurch } = useAppUser();
  const queryClient = useQueryClient();
  const [selecting, setSelecting] = useState(null);
  const [growthYearly, setGrowthYearly] = useState(false);
  const [checkout, setCheckout] = useState(null);
  const [showIframeNotice, setShowIframeNotice] = useState(false);

  // Handle redirect back from Stripe Checkout
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('checkout');
    if (status === 'success') {
      toast.success('Payment successful! Your subscription is now active.');
      queryClient.invalidateQueries({ queryKey: ['churches'] });
      window.history.replaceState({}, '', '/pricing');
    } else if (status === 'cancelled') {
      toast.message('Checkout cancelled. Your plan was not changed.');
      window.history.replaceState({}, '', '/pricing');
    }
  }, [queryClient]);

  const churchId = user?.church_id;
  const currentTier = activeChurch?.subscription_tier || 'free';
  const trialActive = isTrialActive(activeChurch);
  const trialDaysLeft = getTrialDaysRemaining(activeChurch);

  const { data: memberCount = 0 } = useQuery({
    queryKey: ['member-count-pricing', churchId],
    queryFn: async () => {
      if (!churchId) return 0;
      const members = await base44.entities.ChurchMember.filter({ church_id: churchId });
      return members.filter(m => m.status !== 'visitor').length;
    },
    enabled: !!churchId,
  });

  const handleSelectTier = (tierId, billingCycle = 'monthly') => {
    if (tierId === 'enterprise') {
      window.location.href = 'mailto:info@shepherdsyncs.com?subject=Enterprise Plan Inquiry';
      return;
    }
    if (tierId === currentTier) return;
    if (tierId === 'free') {
      confirmTier(tierId, billingCycle, 'bank');
      return;
    }
    setCheckout({ tier: tierId, billingCycle });
  };

  const confirmTier = async (tierId, billingCycle, paymentMethod) => {
    setCheckout(null);
    setSelecting(tierId);
    try {
      if (tierId === 'free') {
        await base44.functions.invoke('updateChurchTier', { churchId, tier: tierId, billingCycle });
        await queryClient.invalidateQueries({ queryKey: ['churches'] });
        await queryClient.invalidateQueries({ queryKey: ['member-count-pricing'] });
        toast.success(`Plan updated to ${getTierConfig(tierId).name}`);
        setTimeout(() => window.location.reload(), 800);
      } else {
        const res = await base44.functions.invoke('createCheckoutSession', { churchId, tier: tierId, billingCycle, paymentMethod });
        const checkoutUrl = res?.data?.url;
        if (!checkoutUrl) throw new Error('No checkout URL returned');
        // Stripe Checkout can't load inside the preview iframe — redirect the published app instead
        if (window.self !== window.top) {
          setShowIframeNotice(true);
          setSelecting(null);
          return;
        }
        window.location.href = checkoutUrl;
      }
    } catch (err) {
      toast.error(err?.message || 'Failed to start checkout');
      setSelecting(null);
    }
  };

  if (!isChurchAdmin && !isGlobalAdmin) {
    return <div className="text-center py-12 text-muted-foreground">Access restricted to church administrators</div>;
  }

  const tierIcons = { free: Sparkles, basic: Zap, growth: Crown, enterprise: Building2 };
  const tierOrder = ['free', 'basic', 'growth', 'enterprise'];
  const currentConfig = getTierConfig(currentTier);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-serif font-bold mb-2">Choose Your Plan</h1>
        <p className="text-muted-foreground">Simple, transparent pricing for churches of every size</p>
      </div>

      {/* Current plan status */}
      {activeChurch && (
        <Card className="mb-8">
          <CardContent className="p-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge className="capitalize">{currentConfig.name}</Badge>
                  {trialActive && (
                    <Badge variant="outline" className="text-blue-600 border-blue-300">
                      {trialDaysLeft} days left in trial
                    </Badge>
                  )}
                  {currentTier === 'global_admin_override' && (
                    <Badge variant="outline" className="text-amber-600 border-amber-300">Full Access (Admin Override)</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  {memberCount} active members
                  {currentConfig.memberLimit !== -1 && ` / ${currentConfig.memberLimit} limit`}
                </p>
              </div>
              {trialActive && activeChurch.trial_end_date && (
                <p className="text-xs text-muted-foreground">
                  Trial ends {format(parseISO(activeChurch.trial_end_date), 'MMM d, yyyy')}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tier cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {tierOrder.map(tierId => {
          const tier = TIERS[tierId];
          const Icon = tierIcons[tierId];
          const isCurrent = currentTier === tierId;
          const isPopular = tierId === 'growth';
          return (
            <Card key={tierId} className={`relative ${isCurrent ? 'border-primary border-2' : ''} ${isPopular ? 'lg:scale-105 shadow-lg' : ''}`}>
              {isPopular && !isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground">Most Popular</Badge>
                </div>
              )}
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground">Current Plan</Badge>
                </div>
              )}
              <CardHeader className="pt-6">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-5 h-5 text-primary" />
                  <CardTitle className="text-lg">{tier.name}</CardTitle>
                </div>
                <div className="flex items-baseline gap-1">
                  {tier.price !== null ? (
                    tierId === 'growth' && growthYearly ? (
                      <>
                        <span className="text-3xl font-bold">${tier.price * 10}</span>
                        <span className="text-sm text-muted-foreground">/yr</span>
                      </>
                    ) : (
                      <>
                        <span className="text-3xl font-bold">${tier.price}</span>
                        <span className="text-sm text-muted-foreground">{tier.price > 0 ? '/mo' : ''}</span>
                      </>
                    )
                  ) : (
                    <span className="text-xl font-semibold">Contact Us</span>
                  )}
                </div>
                {(tierId === 'basic' || tierId === 'growth') && (
                  <p className="text-xs text-blue-600 font-medium mt-1">3-month free trial • No card required</p>
                )}
                {tierId === 'growth' && (
                  <div className="flex items-center gap-2 mt-3 p-2 rounded-lg bg-primary/5 border border-primary/15">
                    <Switch id="growth-yearly" checked={growthYearly} onCheckedChange={setGrowthYearly} />
                    <Label htmlFor="growth-yearly" className="text-xs font-medium leading-snug cursor-pointer">
                      Pay Yearly — Pay for 10 months and get 2 months free!
                    </Label>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 mb-4 min-h-[120px]">
                  {tier.featuresList.map((feat, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                  {tier.notIncluded?.map((feat, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="w-4 h-4 flex-shrink-0 mt-0.5 text-center text-xs">✕</span>
                      <span className="line-through">{feat}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={isCurrent ? 'outline' : 'default'}
                  disabled={isCurrent || selecting !== null}
                  onClick={() => handleSelectTier(tierId, tierId === 'growth' && growthYearly ? 'yearly' : 'monthly')}
                >
                  {selecting === tierId ? 'Updating…' : isCurrent ? 'Current Plan' : tierId === 'enterprise' ? 'Contact Us' : `Select ${tier.name}`}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Trial info */}
      <div className="mt-8 text-center text-sm text-muted-foreground space-y-1">
        <p>3-month free trial available for Basic and Growth tiers. No credit card required to start.</p>
        <p>Visitors are always free and don't count toward your member limit.</p>
        <p>Questions? Contact <a href="mailto:info@shepherdsyncs.com" className="text-primary hover:underline">info@shepherdsyncs.com</a></p>
      </div>

      <CheckoutDialog
        open={!!checkout}
        onOpenChange={(open) => { if (!open) setCheckout(null); }}
        tier={checkout?.tier}
        billingCycle={checkout?.billingCycle || 'monthly'}
        isPending={!!selecting}
        onConfirm={(paymentMethod) => confirmTier(checkout.tier, checkout.billingCycle || 'monthly', paymentMethod)}
      />
      <IframeCheckoutNotice open={showIframeNotice} onOpenChange={setShowIframeNotice} />
    </div>
  );
}