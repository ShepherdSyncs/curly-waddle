import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import useAppUser from '@/hooks/useAppUser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Droplets, Flame, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const TYPES = [
  { value: 'baptism', label: 'Baptism', icon: Droplets, color: 'bg-blue-100 text-blue-700' },
  { value: 'holy_ghost', label: 'Holy Ghost', icon: Flame, color: 'bg-orange-100 text-orange-700' },
  { value: 'rededication', label: 'Rededication', icon: RotateCcw, color: 'bg-purple-100 text-purple-700' },
];

export default function SpiritualRecords() {
  const { user, isStaff, isGlobalAdmin } = useAppUser();
  const churchId = user?.church_id;
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ member_name: '', type: 'baptism', date: format(new Date(), 'yyyy-MM-dd'), officiant: '', witnesses: '', notes: '' });
  const queryClient = useQueryClient();

  const { data: records = [] } = useQuery({
    queryKey: ['spiritual', churchId],
    queryFn: () => churchId
      ? base44.entities.SpiritualRecord.filter({ church_id: churchId }, '-date', 200)
      : isGlobalAdmin ? base44.entities.SpiritualRecord.list('-date', 200) : [],
    enabled: !!user,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['members', churchId],
    queryFn: () => churchId ? base44.entities.ChurchMember.filter({ church_id: churchId }) : [],
    enabled: !!churchId,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.SpiritualRecord.create({ ...data, church_id: churchId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spiritual'] });
      setOpen(false);
      setForm({ member_name: '', type: 'baptism', date: format(new Date(), 'yyyy-MM-dd'), officiant: '', witnesses: '', notes: '' });
      toast.success('Record saved');
    },
  });

  if (!isStaff) return <div className="text-center py-12 text-muted-foreground">Access restricted</div>;

  const counts = TYPES.map(t => ({
    ...t,
    count: records.filter(r => r.type === t.value).length,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-serif font-bold">Spiritual Records</h1>
          <p className="text-sm text-muted-foreground mt-1">Baptisms, Holy Ghost, & rededications</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Add Record</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Spiritual Record</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label>Type *</Label>
                <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Member</Label>
                <Select value={form.member_name} onValueChange={v => setForm({ ...form, member_name: v })}>
                  <SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger>
                  <SelectContent>{members.map(m => <SelectItem key={m.id} value={`${m.first_name} ${m.last_name}`}>{m.first_name} {m.last_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Date *</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
              <div><Label>Officiant</Label><Input value={form.officiant} onChange={e => setForm({ ...form, officiant: e.target.value })} placeholder="Who performed the ceremony" /></div>
              <div><Label>Witnesses</Label><Input value={form.witnesses} onChange={e => setForm({ ...form, witnesses: e.target.value })} placeholder="Names of witnesses" /></div>
              <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Additional notes" /></div>
              <Button className="w-full" onClick={() => createMutation.mutate(form)} disabled={!form.date || createMutation.isPending}>
                {createMutation.isPending ? 'Saving...' : 'Save Record'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {counts.map(t => (
          <Card key={t.value} className="p-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${t.color}`}>
                <t.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{t.count}</p>
                <p className="text-xs text-muted-foreground">{t.label}s</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="space-y-3">
        {records.map(r => {
          const typeInfo = TYPES.find(t => t.value === r.type) || TYPES[0];
          return (
            <Card key={r.id}>
              <CardContent className="p-4 flex items-start gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${typeInfo.color}`}>
                  <typeInfo.icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold">{r.member_name || 'Unknown'}</p>
                    <Badge variant="secondary" className={typeInfo.color}>{typeInfo.label}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{format(new Date(r.date), 'MMMM d, yyyy')}</p>
                  {r.officiant && <p className="text-sm text-muted-foreground">Officiant: {r.officiant}</p>}
                  {r.notes && <p className="text-sm mt-1">{r.notes}</p>}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {records.length === 0 && <Card><CardContent className="py-8 text-center text-muted-foreground">No spiritual records yet</CardContent></Card>}
      </div>
    </div>
  );
}