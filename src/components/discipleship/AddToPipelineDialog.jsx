import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, User } from 'lucide-react';
import { toast } from 'sonner';

export default function AddToPipelineDialog({ churchId, stages, existingMemberIds, onClose }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedMember, setSelectedMember] = useState(null);
  const [stageId, setStageId] = useState(stages[0]?.id || '');

  const { data: members = [] } = useQuery({
    queryKey: ['church-members-active', churchId],
    queryFn: () => base44.entities.ChurchMember.filter({ church_id: churchId, status: 'active' }, 'last_name', 2000),
    enabled: !!churchId,
  });

  const filteredMembers = search.length >= 2
    ? members.filter(m => {
        const name = (m.display_name || `${m.first_name || ''} ${m.last_name || ''}`).toLowerCase();
        return name.includes(search.toLowerCase()) && !existingMemberIds.has(m.id);
      }).slice(0, 15)
    : [];

  const addMutation = useMutation({
    mutationFn: async () => {
      return base44.entities.MemberDiscipleshipProgress.create({
        church_id: churchId,
        member_id: selectedMember.id,
        stage_id: stageId,
        status: 'in_progress',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discipleship-progress', churchId] });
      toast.success('Added to pipeline');
      onClose();
    },
    onError: (err) => toast.error(err.message || 'Failed to add — they may already be in the pipeline'),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Add to Discipleship Pipeline</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-2">
          {selectedMember ? (
            <div className="flex items-center justify-between p-2 rounded-lg border bg-slate-50">
              <span className="flex items-center gap-2 text-sm font-medium">
                <User className="w-4 h-4 text-slate-400" /> {selectedMember.display_name || `${selectedMember.first_name} ${selectedMember.last_name}`}
              </span>
              <Button variant="ghost" size="sm" onClick={() => setSelectedMember(null)}>Change</Button>
            </div>
          ) : (
            <div>
              <Label className="mb-1 block">Find Member *</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
                <Input className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name…" />
              </div>
              {search.length >= 2 && (
                <div className="mt-1 max-h-48 overflow-y-auto border rounded-lg divide-y">
                  {filteredMembers.length === 0 ? (
                    <p className="text-sm text-slate-400 p-2">No matching members found.</p>
                  ) : (
                    filteredMembers.map(m => (
                      <button
                        key={m.id}
                        className="w-full text-left p-2 text-sm hover:bg-slate-50"
                        onClick={() => { setSelectedMember(m); setSearch(''); }}
                      >
                        {m.display_name || `${m.first_name} ${m.last_name}`}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          <div>
            <Label className="mb-1 block">Starting Stage *</Label>
            <Select value={stageId} onValueChange={setStageId}>
              <SelectTrigger><SelectValue placeholder="Choose a stage…" /></SelectTrigger>
              <SelectContent>
                {stages.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button
              className="flex-1"
              disabled={!selectedMember || !stageId || addMutation.isPending}
              onClick={() => addMutation.mutate()}
            >
              {addMutation.isPending ? 'Adding…' : 'Add'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
