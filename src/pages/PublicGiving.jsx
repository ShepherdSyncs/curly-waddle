import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Heart, Cross, CheckCircle2, HandCoins } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const GIVING_TYPES = [
  { value: 'tithe', label: 'Tithe' },
  { value: 'offering', label: 'General Offering' },
  { value: 'missions', label: 'Missions' },
  { value: 'building_fund', label: 'Building Fund' },
  { value: 'benevolence', label: 'Benevolence' },
  { value: 'other', label: 'Other' },
];

const QUICK_AMOUNTS = [25, 50, 100, 250, 500];

function getChurchId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('church');
}

export default function PublicGiving() {
  const churchId = getChurchId();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    amount: '',
    type: 'tithe',
    notes: '',
  });

  const { data: churches = [] } = useQuery({
    queryKey: ['churches-public', churchId],
    queryFn: () => churchId
      ? base44.entities.Church.filter({ id: churchId })
      : base44.entities.Church.list('-created_date', 1),
  });

  const church = churches[0];
  const effectiveChurchId = church?.id || churchId;

  const PLATFORM_LABELS = {
    planning_center: 'Planning Center',
    elvanto: 'Elvanto',
    elexio: 'Elexio',
    churchcenter: 'Church Center',
    pushpay: 'PushPay',
    tithely: 'Tithe.ly',
    paypal: 'PayPal',
    venmo: 'Venmo',
    cash_app: 'Cash App',
    custom: 'Give Online',
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.amount || parseFloat(form.amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    if (!effectiveChurchId) {
      toast.error('No church found');
      return;
    }

    setSubmitting(true);
    await base44.entities.GivingRecord.create({
      church_id: effectiveChurchId,
      member_name: form.name || 'Anonymous',
      date: format(new Date(), 'yyyy-MM-dd'),
      amount: parseFloat(form.amount),
      type: form.type,
      method: 'online',
      notes: form.notes || (form.email ? `Email: ${form.email}` : ''),
    });
    setSubmitted(true);
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-primary/20 to-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center p-8">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-serif font-bold mb-2">Thank You!</h2>
          <p className="text-muted-foreground mb-2">
            Your gift of <span className="font-bold text-foreground">${parseFloat(form.amount).toFixed(2)}</span> has been recorded.
          </p>
          {church && <p className="text-sm text-muted-foreground">God bless you, {church.name}!</p>}
          <Button className="mt-6 w-full" variant="outline" onClick={() => { setSubmitted(false); setForm({ name: '', email: '', amount: '', type: 'tithe', notes: '' }); }}>
            Give Again
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-primary/20 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-sidebar-primary flex items-center justify-center mx-auto mb-4">
            <Cross className="w-7 h-7 text-white" />
          </div>
          {church ? (
            <>
              <h1 className="text-2xl font-serif font-bold text-white">{church.name}</h1>
              <p className="text-white/60 text-sm mt-1">Online Giving</p>
            </>
          ) : (
            <h1 className="text-2xl font-serif font-bold text-white">Online Giving</h1>
          )}
        </div>

        {/* External giving platform or no-platform message */}
        {church && !church.online_giving_url ? (
          <div className="p-6 rounded-xl border border-white/20 bg-white/5 text-center">
            <HandCoins className="w-10 h-10 text-white/60 mx-auto mb-3" />
            <p className="text-sm text-white/80 leading-relaxed">
              Thank you for supporting the ministry! To give electronically, simply scan the QR code on the announcement screen during one of our in-person services. You can also give cash or check during any service.
            </p>
          </div>
        ) : (
          <>
            {church?.online_giving_url && (
              <div className="mb-4 p-4 rounded-xl border border-primary/40 bg-primary/10 text-center space-y-3">
                <p className="text-sm text-white/80">Give electronically via {church.name}'s giving platform</p>
                <a
                  href={church.online_giving_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors"
                >
                  <Heart className="w-4 h-4" />
                  Give on {PLATFORM_LABELS[church.online_giving_platform] || 'External Platform'}
                </a>
                <p className="text-xs text-white/40">Or record a cash / check gift below</p>
              </div>
            )}

            <Card>
              <CardContent className="p-6">
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Amount *</Label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {QUICK_AMOUNTS.map(amt => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setForm({ ...form, amount: String(amt) })}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                            form.amount === String(amt)
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'border-border hover:bg-muted'
                          }`}
                        >
                          ${amt}
                        </button>
                      ))}
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
                      <Input
                        type="number"
                        min="1"
                        step="0.01"
                        value={form.amount}
                        onChange={e => setForm({ ...form, amount: e.target.value })}
                        placeholder="Other amount"
                        className="pl-7"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Giving Type</Label>
                    <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {GIVING_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Your Name (optional)</Label>
                    <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Anonymous" />
                  </div>
                  <div>
                    <Label>Email (optional — for receipt)</Label>
                    <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="your@email.com" />
                  </div>
                  <div>
                    <Label>Note (optional)</Label>
                    <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="e.g. Building fund dedication" />
                  </div>
                  <Button type="submit" className="w-full gap-2 h-11" disabled={submitting || !form.amount}>
                    <Heart className="w-4 h-4" />
                    {submitting ? 'Processing...' : `Give${form.amount ? ` $${parseFloat(form.amount || 0).toFixed(2)}` : ''}`}
                  </Button>
                  <p className="text-xs text-center text-muted-foreground">
                    Your giving record is securely saved. For payment processing, contact your church admin.
                  </p>
                </form>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}