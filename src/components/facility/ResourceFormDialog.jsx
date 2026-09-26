import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const TYPES = [
  { value: 'room', label: 'Room / Space' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'other', label: 'Other' },
];

export default function ResourceFormDialog({ churchId, resource, onClose }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: resource?.name || '',
    type: resource?.type || 'room',
    capacity: resource?.capacity || '',
    location: resource?.location || '',
    notes: resource?.notes || '',
    is_active: resource?.is_active !== false,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        capacity: form.capacity ? parseInt(form.capacity, 10) : null,
        location: form.location.trim() || null,
        notes: form.notes.trim() || null,
        is_active: form.is_active,
      };
      if (resource?.id) return base44.entities.FacilityResource.update(resource.id, payload);
      return base44.entities.FacilityResource.create({ ...payload, church_id: churchId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facility-resources', churchId] });
      toast.success(resource?.id ? 'Resource updated' : 'Resource added');
      onClose();
    },
    onError: (err) => toast.error(err.message || 'Failed to save'),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{resource?.id ? 'Edit Resource' : 'Add Resource'}</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-2">
          <div>
            <Label className="mb-1 block">Name *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Fellowship Hall" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1 block">Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block">Capacity</Label>
              <Input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} placeholder="Optional" />
            </div>
          </div>
          <div>
            <Label className="mb-1 block">Location</Label>
            <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Building B, 2nd floor" />
          </div>
          <div>
            <Label className="mb-1 block">Notes</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          {resource?.id && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              Active (available for booking)
            </label>
          )}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1" onClick={() => { if (!form.name.trim()) { toast.error('Enter a name'); return; } saveMutation.mutate(); }} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
