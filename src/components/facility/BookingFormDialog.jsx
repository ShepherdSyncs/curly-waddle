import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function BookingFormDialog({ churchId, resources, booking, defaultResourceId, user, onClose }) {
  const queryClient = useQueryClient();
  const isEdit = !!booking?.id;
  const [form, setForm] = useState({
    resource_id: booking?.resource_id || defaultResourceId || (resources[0]?.id ?? ''),
    title: booking?.title || '',
    purpose: booking?.purpose || '',
    requested_by_name: booking?.requested_by_name || user?.full_name || user?.email || '',
    requested_by_email: booking?.requested_by_email || user?.email || '',
    start_time: toLocalInput(booking?.start_time) || '',
    end_time: toLocalInput(booking?.end_time) || '',
    status: booking?.status || 'approved',
    notes: booking?.notes || '',
  });
  const [confirmOverride, setConfirmOverride] = useState(false);

  const { data: allBookings = [] } = useQuery({
    queryKey: ['facility-bookings-all', churchId],
    queryFn: () => base44.entities.FacilityBooking.filter({ church_id: churchId }, 'start_time', 2000),
    enabled: !!churchId,
  });

  const conflicts = useMemo(() => {
    if (!form.resource_id || !form.start_time || !form.end_time) return [];
    const start = new Date(form.start_time).getTime();
    const end = new Date(form.end_time).getTime();
    if (!(end > start)) return [];
    return allBookings.filter(b => {
      if (b.id === booking?.id) return false;
      if (b.resource_id !== form.resource_id) return false;
      if (b.status === 'denied' || b.status === 'cancelled') return false;
      const bStart = new Date(b.start_time).getTime();
      const bEnd = new Date(b.end_time).getTime();
      return start < bEnd && end > bStart;
    });
  }, [allBookings, form.resource_id, form.start_time, form.end_time, booking?.id]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        resource_id: form.resource_id,
        title: form.title.trim(),
        purpose: form.purpose.trim() || null,
        requested_by_name: form.requested_by_name.trim() || null,
        requested_by_email: form.requested_by_email.trim() || null,
        start_time: new Date(form.start_time).toISOString(),
        end_time: new Date(form.end_time).toISOString(),
        status: form.status,
        notes: form.notes.trim() || null,
      };
      if (isEdit) return base44.entities.FacilityBooking.update(booking.id, payload);
      return base44.entities.FacilityBooking.create({ ...payload, church_id: churchId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facility-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['facility-bookings-all'] });
      toast.success(isEdit ? 'Booking updated' : 'Booking created');
      onClose();
    },
    onError: (err) => toast.error(err.message || 'Failed to save booking'),
  });

  const handleSave = () => {
    if (!form.resource_id) { toast.error('Choose a resource'); return; }
    if (!form.title.trim()) { toast.error('Enter a title'); return; }
    if (!form.start_time || !form.end_time) { toast.error('Set a start and end time'); return; }
    if (new Date(form.end_time) <= new Date(form.start_time)) { toast.error('End time must be after start time'); return; }
    if (conflicts.length > 0 && !confirmOverride) { toast.error('Resolve or confirm the conflict below before saving'); return; }
    saveMutation.mutate();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? 'Edit Booking' : 'New Booking'}</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-2">
          <div>
            <Label className="mb-1 block">Resource *</Label>
            <Select value={form.resource_id} onValueChange={(v) => { setForm({ ...form, resource_id: v }); setConfirmOverride(false); }}>
              <SelectTrigger><SelectValue placeholder="Choose a room or item…" /></SelectTrigger>
              <SelectContent>
                {resources.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block">Title / Event *</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Smith Wedding Rehearsal" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1 block">Start *</Label>
              <Input type="datetime-local" value={form.start_time} onChange={(e) => { setForm({ ...form, start_time: e.target.value }); setConfirmOverride(false); }} />
            </div>
            <div>
              <Label className="mb-1 block">End *</Label>
              <Input type="datetime-local" value={form.end_time} onChange={(e) => { setForm({ ...form, end_time: e.target.value }); setConfirmOverride(false); }} />
            </div>
          </div>

          {conflicts.length > 0 && (
            <div className="p-3 rounded-lg border border-amber-300 bg-amber-50/60 space-y-2">
              <p className="text-sm font-semibold text-amber-800 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> Overlaps with existing booking{conflicts.length > 1 ? 's' : ''}</p>
              {conflicts.map(c => (
                <p key={c.id} className="text-xs text-amber-700">
                  {c.title} — {format(new Date(c.start_time), 'MMM d, h:mm a')} to {format(new Date(c.end_time), 'h:mm a')}
                </p>
              ))}
              <label className="flex items-center gap-2 text-xs text-amber-800 pt-1">
                <input type="checkbox" checked={confirmOverride} onChange={(e) => setConfirmOverride(e.target.checked)} />
                Book anyway
              </label>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1 block">Requested By</Label>
              <Input value={form.requested_by_name} onChange={(e) => setForm({ ...form, requested_by_name: e.target.value })} />
            </div>
            <div>
              <Label className="mb-1 block">Contact Email</Label>
              <Input type="email" value={form.requested_by_email} onChange={(e) => setForm({ ...form, requested_by_email: e.target.value })} />
            </div>
          </div>
          <div>
            <Label className="mb-1 block">Purpose</Label>
            <Input value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} placeholder="Wedding, youth event, board meeting…" />
          </div>
          <div>
            <Label className="mb-1 block">Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="pending">Pending Approval</SelectItem>
                <SelectItem value="denied">Denied</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block">Notes</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Setup needs, equipment, catering, etc." />
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1" onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Booking'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
