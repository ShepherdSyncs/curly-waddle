import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import useAppUser from '@/hooks/useAppUser';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Footprints, Plus, Pencil, Trash2, ArrowRight, CheckCircle2, GripVertical, User } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import StageFormDialog from '@/components/discipleship/StageFormDialog';
import AddToPipelineDialog from '@/components/discipleship/AddToPipelineDialog';

const DEFAULT_STAGES = [
  { name: 'New Member Class', description: 'Introduces new members to the church’s beliefs, history, and expectations.' },
  { name: 'Small Group', description: 'Connects the member into a small group or Bible study for community and growth.' },
  { name: 'Serving', description: 'The member takes on a regular serving role or ministry team assignment.' },
  { name: 'Leadership', description: 'The member is developed and equipped for a leadership role.' },
];

export default function DiscipleshipTracking() {
  const { user, isChurchAdmin, isGlobalAdmin, isStaff } = useAppUser();
  const churchId = user?.church_id;
  const canManage = isChurchAdmin || isGlobalAdmin || isStaff;
  const queryClient = useQueryClient();

  const [tab, setTab] = useState('pipeline');
  const [showStageDialog, setShowStageDialog] = useState(false);
  const [editingStage, setEditingStage] = useState(null);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const { data: stages = [], isLoading: loadingStages } = useQuery({
    queryKey: ['discipleship-stages', churchId],
    queryFn: () => base44.entities.DiscipleshipStage.filter({ church_id: churchId }, 'sort_order', 100),
    enabled: !!churchId,
  });

  const { data: progress = [], isLoading: loadingProgress } = useQuery({
    queryKey: ['discipleship-progress', churchId],
    queryFn: () => base44.entities.MemberDiscipleshipProgress.filter({ church_id: churchId }, '-created_at', 5000),
    enabled: !!churchId,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['church-members-active', churchId],
    queryFn: () => base44.entities.ChurchMember.filter({ church_id: churchId, status: 'active' }, 'last_name', 2000),
    enabled: !!churchId,
  });

  const memberById = useMemo(() => {
    const map = {};
    members.forEach(m => { map[m.id] = m; });
    return map;
  }, [members]);

  const sortedStages = useMemo(() => [...stages].sort((a, b) => a.sort_order - b.sort_order), [stages]);

  // Everyone currently "in_progress" somewhere in the pipeline — the member's
  // active card lives in whichever stage column that row belongs to.
  const inProgressByStage = useMemo(() => {
    const map = {};
    sortedStages.forEach(s => { map[s.id] = []; });
    progress.filter(p => p.status === 'in_progress').forEach(p => {
      if (!map[p.stage_id]) map[p.stage_id] = [];
      map[p.stage_id].push(p);
    });
    return map;
  }, [progress, sortedStages]);

  const existingMemberIds = useMemo(
    () => new Set(progress.filter(p => p.status === 'in_progress').map(p => p.member_id)),
    [progress]
  );

  const memberHistory = useMemo(() => {
    const map = {};
    progress.forEach(p => {
      if (!map[p.member_id]) map[p.member_id] = [];
      map[p.member_id].push(p);
    });
    return map;
  }, [progress]);

  const seedDefaultsMutation = useMutation({
    mutationFn: async () => {
      for (let i = 0; i < DEFAULT_STAGES.length; i++) {
        await base44.entities.DiscipleshipStage.create({ ...DEFAULT_STAGES[i], church_id: churchId, sort_order: i });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discipleship-stages', churchId] });
      toast.success('Default pipeline created');
    },
    onError: (err) => toast.error(err.message || 'Failed to create default stages'),
  });

  const advanceMutation = useMutation({
    mutationFn: async ({ entry, nextStage }) => {
      await base44.entities.MemberDiscipleshipProgress.update(entry.id, {
        status: 'completed',
        completed_at: new Date().toISOString().slice(0, 10),
      });
      if (nextStage) {
        const existing = (memberHistory[entry.member_id] || []).find(p => p.stage_id === nextStage.id);
        if (existing) {
          await base44.entities.MemberDiscipleshipProgress.update(existing.id, { status: 'in_progress', completed_at: null });
        } else {
          await base44.entities.MemberDiscipleshipProgress.create({
            church_id: churchId,
            member_id: entry.member_id,
            stage_id: nextStage.id,
            status: 'in_progress',
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discipleship-progress', churchId] });
      toast.success('Progress updated');
    },
    onError: (err) => toast.error(err.message || 'Failed to advance member'),
  });

  const removeMutation = useMutation({
    mutationFn: (entry) => base44.entities.MemberDiscipleshipProgress.delete(entry.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discipleship-progress', churchId] });
      toast.success('Removed from pipeline');
    },
    onError: (err) => toast.error(err.message || 'Failed to remove'),
  });

  const deleteStageMutation = useMutation({
    mutationFn: (id) => base44.entities.DiscipleshipStage.delete(id),
    onSuccess: () => {
      toast.success('Stage deleted');
      queryClient.invalidateQueries({ queryKey: ['discipleship-stages', churchId] });
      queryClient.invalidateQueries({ queryKey: ['discipleship-progress', churchId] });
    },
    onError: (err) => toast.error(err.message || 'Failed to delete stage'),
  });

  const moveStageMutation = useMutation({
    mutationFn: async ({ stage, direction }) => {
      const idx = sortedStages.findIndex(s => s.id === stage.id);
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= sortedStages.length) return;
      const swapWith = sortedStages[swapIdx];
      await Promise.all([
        base44.entities.DiscipleshipStage.update(stage.id, { sort_order: swapWith.sort_order }),
        base44.entities.DiscipleshipStage.update(swapWith.id, { sort_order: stage.sort_order }),
      ]);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['discipleship-stages', churchId] }),
    onError: (err) => toast.error(err.message || 'Failed to reorder'),
  });

  const memberName = (id) => {
    const m = memberById[id];
    if (!m) return 'Unknown member';
    return m.display_name || `${m.first_name || ''} ${m.last_name || ''}`.trim();
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Footprints className="w-6 h-6 text-indigo-600" /> Discipleship Tracking
          </h1>
          <p className="text-slate-500 text-sm">Walk members through your growth pipeline, from new member class to leadership.</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="stages">Stages ({stages.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="space-y-4 mt-4">
          {loadingStages || loadingProgress ? (
            <p className="text-slate-400 text-sm">Loading…</p>
          ) : sortedStages.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center space-y-3">
                <p className="text-slate-500">No pipeline stages set up yet.</p>
                <Button onClick={() => seedDefaultsMutation.mutate()} disabled={seedDefaultsMutation.isPending}>
                  {seedDefaultsMutation.isPending ? 'Creating…' : 'Add Default Pipeline (New Member Class → Small Group → Serving → Leadership)'}
                </Button>
                {canManage && <p className="text-xs text-slate-400">Or switch to the Stages tab to build your own.</p>}
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex justify-end">
                {canManage && (
                  <Button onClick={() => setShowAddDialog(true)}>
                    <Plus className="w-4 h-4 mr-1.5" /> Add to Pipeline
                  </Button>
                )}
              </div>
              <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${sortedStages.length}, minmax(220px, 1fr))` }}>
                {sortedStages.map((stage, idx) => {
                  const entries = inProgressByStage[stage.id] || [];
                  const nextStage = sortedStages[idx + 1];
                  return (
                    <div key={stage.id} className="space-y-2 min-w-[220px]">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-sm text-slate-700">{stage.name}</h3>
                        <Badge variant="outline">{entries.length}</Badge>
                      </div>
                      <div className="space-y-2">
                        {entries.length === 0 ? (
                          <p className="text-xs text-slate-400 italic p-2">No one here right now.</p>
                        ) : (
                          entries.map(entry => (
                            <Card key={entry.id}>
                              <CardContent className="p-3 space-y-1.5">
                                <p className="text-sm font-medium flex items-center gap-1.5">
                                  <User className="w-3.5 h-3.5 text-slate-400" /> {memberName(entry.member_id)}
                                </p>
                                <p className="text-xs text-slate-400">Started {format(new Date(entry.started_at), 'MMM d, yyyy')}</p>
                                {canManage && (
                                  <div className="flex items-center gap-1 pt-1">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs px-2"
                                      onClick={() => advanceMutation.mutate({ entry, nextStage })}
                                      disabled={advanceMutation.isPending}
                                    >
                                      {nextStage ? <>Advance <ArrowRight className="w-3 h-3 ml-1" /></> : <>Complete <CheckCircle2 className="w-3 h-3 ml-1" /></>}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 text-xs px-2 text-red-500 hover:text-red-600"
                                      onClick={() => { if (confirm(`Remove ${memberName(entry.member_id)} from the pipeline?`)) removeMutation.mutate(entry); }}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="stages" className="space-y-4 mt-4">
          <div className="flex items-center justify-end">
            {canManage && (
              <Button onClick={() => { setEditingStage(null); setShowStageDialog(true); }}>
                <Plus className="w-4 h-4 mr-1.5" /> Add Stage
              </Button>
            )}
          </div>
          {loadingStages ? (
            <p className="text-slate-400 text-sm">Loading…</p>
          ) : sortedStages.length === 0 ? (
            <p className="text-sm text-slate-400">No stages defined yet. Add one, or use the Pipeline tab's default-pipeline shortcut.</p>
          ) : (
            <div className="space-y-2">
              {sortedStages.map((stage, idx) => (
                <Card key={stage.id}>
                  <CardContent className="p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <GripVertical className="w-4 h-4 text-slate-300 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{idx + 1}. {stage.name}</p>
                        {stage.description && <p className="text-sm text-slate-500 truncate">{stage.description}</p>}
                      </div>
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="icon" variant="ghost" disabled={idx === 0} onClick={() => moveStageMutation.mutate({ stage, direction: 'up' })}>
                          <ArrowRight className="w-4 h-4 -rotate-90" />
                        </Button>
                        <Button size="icon" variant="ghost" disabled={idx === sortedStages.length - 1} onClick={() => moveStageMutation.mutate({ stage, direction: 'down' })}>
                          <ArrowRight className="w-4 h-4 rotate-90" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => { setEditingStage(stage); setShowStageDialog(true); }}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-red-500 hover:text-red-600"
                          onClick={() => { if (confirm(`Delete "${stage.name}"? Members currently in this stage will lose that progress record.`)) deleteStageMutation.mutate(stage.id); }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {showStageDialog && (
        <StageFormDialog
          churchId={churchId}
          stage={editingStage}
          nextSortOrder={sortedStages.length}
          onClose={() => { setShowStageDialog(false); setEditingStage(null); }}
        />
      )}
      {showAddDialog && (
        <AddToPipelineDialog
          churchId={churchId}
          stages={sortedStages}
          existingMemberIds={existingMemberIds}
          onClose={() => setShowAddDialog(false)}
        />
      )}
    </div>
  );
}
