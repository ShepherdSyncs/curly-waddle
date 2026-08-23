import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bell, Calendar, User, ChevronRight, Send, Clock } from 'lucide-react';
import { format, addDays, isTomorrow, isToday } from 'date-fns';
import { toast } from 'sonner';

export default function VolunteerRolesPanel({ groups, churchId, isAdmin }) {
  const [filterGroup, setFilterGroup] = useState('all');
  const queryClient = useQueryClient();

  const { data: schedules = [], isLoading } = useQuery({
    queryKey: ['volunteer-schedules', churchId],
    queryFn: () => base44.entities.MinistrySchedule.filter({ church_id: churchId }, 'date', 300),
    enabled: !!churchId,
  });

  const sendReminderMutation = useMutation({
    mutationFn: (scheduleId) => base44.functions.invoke('ministryMailer', { schedule_id: scheduleId }),
    onSuccess: () => {
      toast.success('Reminders sent!');
      queryClient.invalidateQueries({ queryKey: ['volunteer-schedules'] });
    },
    onError: () => toast.error('Failed to send reminders'),
  });

  const today = format(new Date(), 'yyyy-MM-dd');
  const groupById = Object.fromEntries(groups.map(g => [g.id, g]));

  // Only show schedules with assignees, upcoming (including today)
  const upcoming = schedules
    .filter(s => s.date >= today && s.assignees?.length > 0)
    .filter(s => filterGroup === 'all' || s.group_id === filterGroup)
    .slice(0, 50);

  // Build a flat list of volunteer assignments
  const assignments = upcoming.flatMap(s => {
    const group = groupById[s.group_id];
    return (s.assignees || []).map(a => ({
      ...a,
      scheduleId: s.id,
      scheduleTitle: s.title,
      date: s.date,
      time: s.time,
      group,
      reminder_sent: s.reminder_sent,
    }));
  });

  // Group by volunteer name
  const byVolunteer = {};
  assignments.forEach(a => {
    const key = a.member_name;
    if (!byVolunteer[key]) byVolunteer[key] = { name: a.member_name, email: a.member_email, assignments: [] };
    byVolunteer[key].assignments.push(a);
  });
  const volunteers = Object.values(byVolunteer).sort((a, b) => a.name.localeCompare(b.name));

  // Summary stats
  const totalVolunteers = volunteers.length;
  const scheduledThisWeek = upcoming.filter(s => {
    const diff = (new Date(s.date) - new Date(today)) / (1000 * 60 * 60 * 24);
    return diff <= 7;
  }).length;
  const pendingReminders = upcoming.filter(s => !s.reminder_sent && s.assignees?.length > 0).length;

  const getDateLabel = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    if (isToday(d)) return <span className="text-green-600 font-semibold">Today</span>;
    if (isTomorrow(d)) return <span className="text-orange-500 font-semibold">Tomorrow</span>;
    return <span>{format(d, 'EEE, MMM d')}</span>;
  };

  return (
    <div className="space-y-5">
      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{totalVolunteers}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Volunteers Scheduled</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-500">{scheduledThisWeek}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Services This Week</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-orange-500">{pendingReminders}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Pending Reminders</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter + Info */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Select value={filterGroup} onValueChange={setFilterGroup}>
            <SelectTrigger className="w-44 text-xs h-8">
              <SelectValue placeholder="All Groups" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Groups</SelectItem>
              {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{assignments.length} upcoming assignments</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Bell className="w-3.5 h-3.5" />
          <span>24h email reminders are sent automatically</span>
        </div>
      </div>

      {/* Upcoming Schedules with Assignees */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Upcoming Service Assignments</h3>
        {isLoading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}</div>
        ) : upcoming.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">
            <Calendar className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">No upcoming volunteer assignments found.</p>
            <p className="text-xs mt-1">Add assignees to schedules in the Schedules tab.</p>
          </CardContent></Card>
        ) : (
          <div className="space-y-3">
            {upcoming.map(s => {
              const group = groupById[s.group_id];
              return (
                <Card key={s.id} className="overflow-hidden">
                  <CardContent className="p-0">
                    <div className="flex items-stretch">
                      {/* Color bar */}
                      <div className="w-1 flex-shrink-0" style={{ backgroundColor: group?.color || '#6366f1' }} />
                      <div className="flex-1 p-4">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-sm">{s.title}</p>
                              {group && <Badge variant="secondary" className="text-xs" style={{ backgroundColor: group.color + '22', color: group.color }}>{group.name}</Badge>}
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{getDateLabel(s.date)}</span>
                              {s.time && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{s.time}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {s.reminder_sent
                              ? <Badge className="text-xs bg-green-100 text-green-700 border-green-200">✓ Reminded</Badge>
                              : <Badge className="text-xs bg-orange-100 text-orange-700 border-orange-200">Reminder pending</Badge>
                            }
                            {isAdmin && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-7 gap-1"
                                onClick={() => sendReminderMutation.mutate(s.id)}
                                disabled={sendReminderMutation.isPending}
                              >
                                <Send className="w-3 h-3" /> Send Now
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1.5 mt-3 flex-wrap">
                          {s.assignees.map(a => (
                            <div key={a.member_name} className="flex items-center gap-1.5 bg-muted/50 border rounded-lg px-2.5 py-1">
                              <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">
                                {a.member_name?.[0]}
                              </div>
                              <span className="text-xs font-medium">{a.member_name}</span>
                              {a.role && <span className="text-xs text-muted-foreground">· {a.role}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* By Volunteer View */}
      {volunteers.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">By Volunteer</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {volunteers.map(v => (
              <Card key={v.name}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary flex-shrink-0">
                      {v.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{v.name}</p>
                      {v.email && <p className="text-xs text-muted-foreground truncate">{v.email}</p>}
                    </div>
                    <Badge variant="outline" className="text-xs flex-shrink-0">{v.assignments.length} scheduled</Badge>
                  </div>
                  <div className="space-y-1.5">
                    {v.assignments.slice(0, 4).map((a, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                        <span className="flex-1 truncate">{a.scheduleTitle}</span>
                        {a.role && <Badge variant="secondary" className="text-[10px] py-0">{a.role}</Badge>}
                        <span className="text-muted-foreground flex-shrink-0">{getDateLabel(a.date)}</span>
                      </div>
                    ))}
                    {v.assignments.length > 4 && (
                      <p className="text-xs text-muted-foreground pl-5">+{v.assignments.length - 4} more</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}