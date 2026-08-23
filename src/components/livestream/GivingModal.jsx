import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Heart, X, CheckCircle2 } from 'lucide-react';
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

export default function GivingModal({ churchId, churchName, onClose }) {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', amount: '', type: 'offering', notes: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.amount || parseFloat(form.amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    setSubmitting(true);
    await base44.entities.GivingRecord.create({
      church_id: churchId,
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

  return (
    // Backdrop — clicking outside closes
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onClick={onClose}
    >
      {/* Modal card — stop propagation so clicks inside don't close it */}
      <div
        className="relative w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl shadow-2xl text-white overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-primary" />
            <h2 className="font-serif font-bold text-lg">{churchName ? `Give to ${churchName}` : 'Online Giving'}</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 transition-colors">
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>

        <div className="px-6 py-5">
          {!submitted ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Quick amounts */}
              <div>
                <Label className="text-white/70 text-xs mb-2 block">Amount *</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {QUICK_AMOUNTS.map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setForm({ ...form, amount: String(amt) })}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                        form.amount === String(amt)
                          ? 'bg-primary text-white border-primary'
                          : 'border-white/20 text-white/80 hover:bg-white/10'
                      }`}
                    >
                      ${amt}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 font-medium">$</span>
                  <Input
                    type="number"
                    min="1"
                    step="0.01"
                    value={form.amount}
                    onChange={e => setForm({ ...form, amount: e.target.value })}
                    placeholder="Other amount"
                    className="pl-7 bg-white/5 border-white/20 text-white placeholder:text-white/30 focus-visible:ring-primary"
                  />
                </div>
              </div>

              {/* Giving type */}
              <div>
                <Label className="text-white/70 text-xs mb-1 block">Giving Type</Label>
                <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                  <SelectTrigger className="bg-white/5 border-white/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GIVING_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Name & email */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-white/70 text-xs mb-1 block">Your Name (optional)</Label>
                  <Input
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="Anonymous"
                    className="bg-white/5 border-white/20 text-white placeholder:text-white/30"
                  />
                </div>
                <div>
                  <Label className="text-white/70 text-xs mb-1 block">Email (optional)</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    placeholder="your@email.com"
                    className="bg-white/5 border-white/20 text-white placeholder:text-white/30"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full gap-2 h-11 bg-primary hover:bg-primary/90"
                disabled={submitting || !form.amount}
              >
                <Heart className="w-4 h-4" />
                {submitting ? 'Processing...' : `Give${form.amount ? ` $${parseFloat(form.amount || 0).toFixed(2)}` : ''}`}
              </Button>
              <p className="text-xs text-center text-white/30">Your giving is securely recorded.</p>
            </form>
          ) : (
            <div className="py-6 text-center space-y-3">
              <CheckCircle2 className="w-14 h-14 text-green-400 mx-auto" />
              <p className="text-xl font-serif font-bold">Thank You!</p>
              <p className="text-white/60 text-sm">
                Your gift of <span className="font-bold text-white">${parseFloat(form.amount).toFixed(2)}</span> has been recorded.
              </p>
              <Button variant="outline" className="border-white/20 text-white hover:bg-white/10" onClick={onClose}>
                Close & Continue Watching
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}