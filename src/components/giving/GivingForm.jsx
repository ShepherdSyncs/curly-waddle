import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { HandCoins } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const GIVING_TYPES = ['tithe', 'offering', 'missions', 'building_fund', 'benevolence', 'other'];
const AMOUNTS = [25, 50, 100, 200, 500];

export default function GivingForm({ user, churchId, onSuccess }) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('tithe');
  const [method, setMethod] = useState('online');
  const [notes, setNotes] = useState('');

  const giveMutation = useMutation({
    mutationFn: () => base44.entities.GivingRecord.create({
      church_id: churchId,
      member_name: user.full_name || user.email,
      member_email: user.email,
      date: format(new Date(), 'yyyy-MM-dd'),
      amount: parseFloat(amount),
      type,
      method,
      notes,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['giving'] });
      setAmount(''); setNotes('');
      toast.success('Gift recorded — thank you!');
      onSuccess?.();
    },
  });

  const handleSubmit = () => {
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    giveMutation.mutate();
  };

  return (
    <div className="space-y-4">
      {/* Quick amounts */}
      <div>
        <Label>Amount</Label>
        <div className="flex gap-2 mt-1 flex-wrap">
          {AMOUNTS.map(a => (
            <button
              key={a}
              onClick={() => setAmount(String(a))}
              className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${amount === String(a) ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}
            >
              ${a}
            </button>
          ))}
        </div>
        <Input
          type="number"
          className="mt-2"
          placeholder="Or enter custom amount"
          value={amount}
          onChange={e => setAmount(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {GIVING_TYPES.map(t => (
                <SelectItem key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Method</Label>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="online">Online</SelectItem>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="check">Check</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Note (optional)</Label>
        <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. In memory of..." rows={2} className="mt-1" />
      </div>

      <Button className="w-full gap-2" onClick={handleSubmit} disabled={giveMutation.isPending}>
        <HandCoins className="w-4 h-4" />
        {giveMutation.isPending ? 'Recording…' : `Give${amount ? ` $${parseFloat(amount).toFixed(2)}` : ''}`}
      </Button>
    </div>
  );
}