import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

export default function StageFormDialog({ churchId, stage, nextSortOrder, onClose }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: stage?.name || '',
    description: stage?.description || '',
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
      };
      if (stage?.id) return base44.entities.DiscipleshipStage.update(stage.id, payload);
      return base44.entities.DiscipleshipStage.create({ ...payload, church_id: churchId, sort_order: nextSortOrder ?? 0 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discipleship-stages', churchId] });
      toast.success(stage?.id ? 'Stage updated' : 'Stage added');
      onClose();
    },
    onError: (err) => toast.error(err.message || 'Failed to save stage'),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{stage?.id ? 'Edit Stage' : 'Add Stage'}</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-2">
          <div>
            <Label className="mb-1 block">Stage Name *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="New Member Class" />
          </div>
          <div>
            <Label className="mb-1 block">Description</Label>
            <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What does this stage involve?" />
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1" onClick={() => { if (!form.name.trim()) { toast.error('Enter a stage name'); return; } saveMutation.mutate(); }} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
