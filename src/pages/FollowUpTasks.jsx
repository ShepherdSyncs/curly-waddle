import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ClipboardList, User, CheckCircle2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import useAppUser from '@/hooks/useAppUser';

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
};

export default function FollowUpTasks() {
  const { user, isChurchAdmin } = useAppUser();
  const churchId = user?.church_id;
  const queryClient = useQueryClient();
  const [assigning, setAssigning] = useState(null);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [search, setSearch] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['followup-tasks', churchId],
    queryFn: () => base44.entities.FollowUpTask.filter({ church_id: churchId }, '-created_date', 200),
    enabled: !!churchId,
  });

  // Load ministry groups to find Deacon / Ministry Staff groups
  const { data: ministryGroups = [] } = useQuery({
    queryKey: ['ministry-groups-deacon', churchId],
    queryFn: () => base44.entities.MinistryGroup.filter({ church_id: churchId }),
    enabled: !!churchId && isChurchAdmin,
  });

  const deaconGroupIds = ministryGroups
    .filter(g => g.name?.toLowerCase().includes('deacon') || g.name?.toLowerCase().includes('ministry staff') || g.name?.toLowerCase().includes('pastoral'))
    .map(g => g.id);

  const { data: allGroupMembers = [] } = useQuery({
    queryKey: ['ministry-group-members-deacon', churchId],
    queryFn: () => base44.entities.MinistryGroupMember.filter({ church_id: churchId }),
    enabled: !!churchId && isChurchAdmin && ministryGroups.length > 0,
  });

  const leaderOptions = allGroupMembers
    .filter(m => deaconGroupIds.includes(m.group_id) && m.member_email)
    .reduce((acc, m) => {
      if (!acc.find(x => x.member_email === m.member_email)) acc.push(m);
      return acc;
    }, []);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.FollowUpTask.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followup-tasks'] });
      setAssigning(null);
      setSelectedMemberId('');
      toast.success('Task updated');
    },
  });

  const handleAssign = async (task) => {
    const member = leaderOptions.find(m => m.id === selectedMemberId);
    if (!member) { toast.error('Please select a leader'); return; }

    updateMutation.mutate({
      id: task.id,
      data: { assigned_to_email: member.member_email, assigned_to_name: member.member_name, status: 'in_progress' },
    });

    base44.functions.invoke('sendFollowUpAssignmentEmail', {
      assignee_name: member.member_name,
      assignee_email: member.member_email,
      visitor_name: task.visitor_name,
      church_id: churchId,
    }).catch(() => {});
  };

  const filtered = tasks.filter(t =>
    t.visitor_name?.toLowerCase().includes(search.toLowerCase()) ||
    t.visitor_email?.toLowerCase().includes(search.toLowerCase())
  );

  const pendingTasks = filtered.filter(t => t.status !== 'completed');
  const completedTasks = filtered.filter(t => t.status === 'completed');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-serif font-bold text-foreground flex items-center gap-2">
          <ClipboardList className="w-7 h-7 text-primary" />
          Follow-Up Tasks
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Track visitor and new member follow-ups</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Badge className="bg-yellow-100 text-yellow-700">{pendingTasks.length} pending</Badge>
        <Badge className="bg-green-100 text-green-700">{completedTasks.length} completed</Badge>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : pendingTasks.length === 0 && completedTasks.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>No follow-up tasks yet. New visitors added from attendance will appear here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {pendingTasks.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Needs Follow-Up</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {pendingTasks.map(task => (
                  <div key={task.id} className="p-3 rounded-lg border bg-muted/30 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm">{task.visitor_name}</p>
                        {task.visitor_email && <p className="text-xs text-muted-foreground">{task.visitor_email}</p>}
                        {task.visitor_phone && <p className="text-xs text-muted-foreground">{task.visitor_phone}</p>}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Added {task.date_added ? format(new Date(task.date_added + 'T00:00:00'), 'MMM d, yyyy') : '—'} by {task.added_by_name || 'Staff'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge className={STATUS_COLORS[task.status]}>{task.status.replace('_', ' ')}</Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-green-600 text-xs"
                          onClick={() => updateMutation.mutate({ id: task.id, data: { status: 'completed' } })}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Done
                        </Button>
                      </div>
                    </div>

                    {task.assigned_to_name && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <User className="w-3 h-3" /> Assigned to: {task.assigned_to_name} ({task.assigned_to_email})
                      </p>
                    )}

                    {isChurchAdmin && (
                      <>
                        {assigning === task.id ? (
                          <div className="flex gap-2 items-center flex-wrap">
                            <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                              <SelectTrigger className="h-8 text-xs flex-1 min-w-[200px]">
                                <SelectValue placeholder="Select a leader to assign..." />
                              </SelectTrigger>
                              <SelectContent>
                                {leaderOptions.length === 0 ? (
                                  <SelectItem value="_none" disabled>No Deacon/Staff members found</SelectItem>
                                ) : (
                                  leaderOptions.map(m => (
                                    <SelectItem key={m.id} value={m.id}>
                                      {m.member_name} — {m.member_email}
                                    </SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                            <Button size="sm" className="h-8 text-xs" onClick={() => handleAssign(task)} disabled={updateMutation.isPending}>
                              Assign &amp; Notify
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setAssigning(null); setSelectedMemberId(''); }}>
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setAssigning(task.id); setSelectedMemberId(''); }}>
                            {task.assigned_to_email ? 'Reassign' : 'Assign to Leader'}
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {completedTasks.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base text-muted-foreground">Completed ({completedTasks.length})</CardTitle>
                  <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setShowCompleted(v => !v)}>
                    {showCompleted ? 'Hide' : 'Show'}
                  </Button>
                </div>
              </CardHeader>
              {showCompleted && (
                <CardContent className="space-y-2">
                  {completedTasks.map(t => (
                    <div key={t.id} className="flex items-center gap-2 p-2 rounded bg-muted/30">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                      <span className="text-sm">{t.visitor_name}</span>
                      {t.assigned_to_name && <span className="text-xs text-muted-foreground">→ {t.assigned_to_name}</span>}
                      {t.date_added && <span className="text-xs text-muted-foreground ml-auto">{format(new Date(t.date_added + 'T00:00:00'), 'MMM d')}</span>}
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}