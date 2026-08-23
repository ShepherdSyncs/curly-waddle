import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';

const GIVING_TYPES = ['tithe', 'offering', 'missions', 'building_fund', 'benevolence', 'other'];
const PAYMENT_METHODS = ['cash', 'check', 'online', 'other'];

const emptyForm = { date: format(new Date(), 'yyyy-MM-dd'), amount: '', type: 'tithe', method: 'cash', notes: '', member_name: '', member_id: '', member_email: '' };

export default function RecordGivingDialog({ open, onOpenChange, onSave, members = [], isSaving, initialData }) {
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (open) {
      setForm(initialData
        ? { date: initialData.date || '', amount: String(initialData.amount || ''), type: initialData.type || 'tithe', method: initialData.method || 'cash', notes: initialData.notes || '', member_name: initialData.member_name || '', member_id: initialData.member_id || '', member_email: initialData.member_email || '' }
        : emptyForm
      );
    }
  }, [open, initialData]);

  const handleMemberChange = (memberId) => {
    const member = members.find(m => m.id === memberId);
    setForm(f => ({ ...f, member_id: memberId, member_name: member ? `${member.first_name} ${member.last_name}` : '', member_email: member?.email || '' }));
  };

  const handleSave = () => {
    onSave({ ...form, amount: parseFloat(form.amount) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{initialData ? 'Edit Giving Record' : 'Record Giving'}</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Date *</Label>
              <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
            </div>
            <div>
              <Label>Amount *</Label>
              <Input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
            </div>
          </div>

          <div>
            <Label>Member</Label>
            <Select value={form.member_id} onValueChange={handleMemberChange}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select member…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="guest">Guest / Anonymous</SelectItem>
                {members.map(m => (
                  <SelectItem key={m.id} value={m.id}>{m.first_name} {m.last_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(!form.member_id || form.member_id === 'guest') && (
              <Input className="mt-2" value={form.member_name} onChange={e => setForm({ ...form, member_name: e.target.value })} placeholder="Donor name (if not a member)" />
            )}
          </div>

          <div>
            <Label>Type</Label>
            <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>{GIVING_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div>
            <Label>Payment Method</Label>
            <Select value={form.method} onValueChange={v => setForm({ ...form, method: v })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div>
            <Label>Notes</Label>
            <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes" />
          </div>

          <Button className="w-full" onClick={handleSave} disabled={!form.amount || !form.date || isSaving}>
            {isSaving ? 'Saving…' : initialData ? 'Update Record' : 'Save Record'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}