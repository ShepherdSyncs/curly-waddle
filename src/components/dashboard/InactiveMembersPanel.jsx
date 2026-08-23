import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserX, CheckCircle2, Phone, Mail, Clock, RefreshCw, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function InactiveMembersPanel({ churchId }) {
  const queryClient = useQueryClient();
  const [running, setRunning] = useState(false);
  const [sendingAlert, setSendingAlert] = useState(false);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['inactive-tasks', churchId],
    queryFn: () => base44.entities.FollowUpTask.filter(
      { church_id: churchId, type: 'inactive_member' },
      '-date_added',
      100
    ),
    enabled: !!churchId,
  });

  // Fetch members and attendance to compute 4-week warning list
  const { data: members = [] } = useQuery({
    queryKey: ['members-panel', churchId],
    queryFn: () => base44.entities.ChurchMember.filter({ church_id: churchId, status: 'active' }),
    enabled: !!churchId,
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ['attendance-panel', churchId],
    queryFn: () => base44.entities.AttendanceRecord.filter({ church_id: churchId }, '-date', 2000),
    enabled: !!churchId,
  });

  // Compute members absent 4-6 weeks
  const fourWeekAbsent = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const cutoff4w = new Date(); cutoff4w.setDate(cutoff4w.getDate() - 28);
    const cutoff6w = new Date(); cutoff6w.setDate(cutoff6w.getDate() - 42);
    const c4 = cutoff4w.toISOString().split('T')[0];
    const c6 = cutoff6w.toISOString().split('T')[0];

    const lastAttendedMap = {};
    for (const r of attendance) {
      if (r.present === false) continue;
      if (!lastAttendedMap[r.member_id] || r.date > lastAttendedMap[r.member_id]) {
        lastAttendedMap[r.member_id] = r.date;
      }
    }

    return members
      .filter(m => {
        const last = lastAttendedMap[m.id];
        return last && last < c4 && last >= c6;
      })
      .map(m => ({
        ...m,
        lastDate: lastAttendedMap[m.id],
        weeksAbsent: Math.floor((new Date(todayStr) - new Date(lastAttendedMap[m.id])) / (7 * 24 * 60 * 60 * 1000)),
      }));
  }, [members, attendance]);

  const handleSendAlert = async () => {
    setSendingAlert(true);
    const res = await base44.functions.invoke('fourWeekAbsenceAlert', {});
    setSendingAlert(false);
    const count = res.data?.total_alerted || 0;
    toast.success(count > 0 ? `Alert sent for ${count} member${count !== 1 ? 's' : ''}` : 'No members in 4-week window');
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.FollowUpTask.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inactive-tasks'] });
      toast.success('Task updated');
    },
  });

  const handleRunScan = async () => {
    setRunning(true);
    const res = await base44.functions.invoke('flagInactiveMembers', {});
    setRunning(false);
    const count = res.data?.total_flagged || 0;
    if (count > 0) {
      toast.success(`Flagged ${count} inactive member${count !== 1 ? 's' : ''}`);
      queryClient.invalidateQueries({ queryKey: ['inactive-tasks'] });
    } else {
      toast.info('No new inactive members found');
    }
  };

  const pending = tasks.filter(t => t.status !== 'completed');
  const completed = tasks.filter(t => t.status === 'completed');

  if (isLoading) return null;
  if (tasks.length === 0 && !running) return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <UserX className="w-5 h-5 text-orange-500" />
          Inactive Members
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-3">No inactive member tasks yet. Run a scan to find members who haven't attended in 4+ weeks.</p>
        <Button variant="outline" size="sm" className="gap-2" onClick={handleRunScan} disabled={running}>
          <RefreshCw className={`w-3.5 h-3.5 ${running ? 'animate-spin' : ''}`} />
          {running ? 'Scanning...' : 'Scan Now'}
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <UserX className="w-5 h-5 text-orange-500" />
            Inactive Members
            {pending.length > 0 && (
              <Badge className="bg-orange-100 text-orange-700">{pending.length} need follow-up</Badge>
            )}
          </CardTitle>
          <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={handleRunScan} disabled={running}>
            <RefreshCw className={`w-3.5 h-3.5 ${running ? 'animate-spin' : ''}`} />
            {running ? 'Scanning...' : 'Rescan'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* 4-week warning section */}
        {fourWeekAbsent.length > 0 && (
          <div className="rounded-lg border border-amber-300 bg-amber-50/50 p-3 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-semibold text-amber-800">
                  {fourWeekAbsent.length} member{fourWeekAbsent.length !== 1 ? 's' : ''} absent 4+ weeks
                </span>
              </div>
              <Button
                size="sm" variant="outline"
                className="h-7 text-xs border-amber-400 text-amber-700 hover:bg-amber-100 gap-1"
                onClick={handleSendAlert}
                disabled={sendingAlert}
              >
                <Mail className="w-3 h-3" />
                {sendingAlert ? 'Sending...' : 'Email Reminder'}
              </Button>
            </div>
            <div className="space-y-1">
              {fourWeekAbsent.map(m => (
                <div key={m.id} className="flex items-center justify-between text-xs text-amber-900 py-0.5">
                  <span className="font-medium">{m.first_name} {m.last_name}</span>
                  <span className="text-amber-600">{m.weeksAbsent}w absent · last {format(new Date(m.lastDate + 'T00:00:00'), 'MMM d')}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {pending.map(task => (
          <div key={task.id} className="p-3 rounded-lg border bg-orange-50/40 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-sm">{task.visitor_name}</p>
                <div className="flex flex-wrap gap-3 mt-1">
                  {task.visitor_email && (
                    <a href={`mailto:${task.visitor_email}`} className="flex items-center gap-1 text-xs text-primary hover:underline">
                      <Mail className="w-3 h-3" /> {task.visitor_email}
                    </a>
                  )}
                  {task.visitor_phone && (
                    <a href={`tel:${task.visitor_phone}`} className="flex items-center gap-1 text-xs text-primary hover:underline">
                      <Phone className="w-3 h-3" /> {task.visitor_phone}
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <Clock className="w-3 h-3 text-orange-500" />
                  <span className="text-xs text-orange-600 font-medium">
                    {task.weeks_absent ? `${task.weeks_absent} weeks absent` : 'Never recorded'}
                    {task.last_attended ? ` · Last: ${format(new Date(task.last_attended + 'T00:00:00'), 'MMM d, yyyy')}` : ''}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge className={task.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}>
                  {task.status.replace('_', ' ')}
                </Badge>
                <Button
                  size="sm" variant="ghost" className="h-7 text-green-600 text-xs gap-1"
                  onClick={() => updateMutation.mutate({ id: task.id, data: { status: 'completed' } })}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Done
                </Button>
              </div>
            </div>
            {task.status === 'pending' && (
              <Button
                size="sm" variant="outline" className="h-7 text-xs"
                onClick={() => updateMutation.mutate({ id: task.id, data: { status: 'in_progress' } })}
              >
                Mark In Progress
              </Button>
            )}
          </div>
        ))}

        {completed.length > 0 && (
          <details className="text-xs text-muted-foreground cursor-pointer">
            <summary className="py-1">{completed.length} completed</summary>
            <div className="space-y-1 mt-2">
              {completed.map(t => (
                <div key={t.id} className="flex items-center gap-2 p-2 rounded bg-muted/30">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                  <span>{t.visitor_name}</span>
                  {t.weeks_absent && <span className="text-muted-foreground">· {t.weeks_absent}w absent</span>}
                </div>
              ))}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}