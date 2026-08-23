import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend } from 'recharts';
import { TrendingUp, Users, CheckCircle2, Calendar } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

export default function MinistryAttendanceAnalytics({ groups, churchId }) {
  const [selectedGroupId, setSelectedGroupId] = useState('all');

  const { data: allAttendance = [] } = useQuery({
    queryKey: ['ministry-attendance-all', churchId],
    queryFn: () => base44.entities.MinistryAttendance.filter({ church_id: churchId }, '-date', 1000),
    enabled: !!churchId,
  });

  const { data: schedules = [] } = useQuery({
    queryKey: ['ministry-schedules', churchId],
    queryFn: () => base44.entities.MinistrySchedule.filter({ church_id: churchId }, '-date', 200),
    enabled: !!churchId,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['ministry-member-counts', churchId],
    queryFn: () => base44.entities.MinistryGroupMember.filter({ church_id: churchId }),
    enabled: !!churchId,
  });

  const groupById = useMemo(() => Object.fromEntries(groups.map(g => [g.id, g])), [groups]);

  const filteredAttendance = useMemo(() =>
    selectedGroupId === 'all'
      ? allAttendance
      : allAttendance.filter(a => a.group_id === selectedGroupId),
    [allAttendance, selectedGroupId]
  );

  const filteredSchedules = useMemo(() =>
    selectedGroupId === 'all'
      ? schedules
      : schedules.filter(s => s.group_id === selectedGroupId),
    [schedules, selectedGroupId]
  );

  // Overall stats
  const totalRecords = filteredAttendance.length;
  const presentCount = filteredAttendance.filter(a => a.present).length;
  const overallRate = totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100) : 0;
  const eventsTracked = new Set(filteredAttendance.map(a => a.schedule_id)).size;

  // Monthly trend (last 6 months)
  const monthlyData = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const label = format(d, 'MMM');
      const start = format(startOfMonth(d), 'yyyy-MM-dd');
      const end = format(endOfMonth(d), 'yyyy-MM-dd');
      const recs = filteredAttendance.filter(a => a.date >= start && a.date <= end);
      const present = recs.filter(a => a.present).length;
      const total = recs.length;
      months.push({ month: label, present, absent: total - present, rate: total > 0 ? Math.round((present / total) * 100) : 0 });
    }
    return months;
  }, [filteredAttendance]);

  // Per-group breakdown (when viewing all)
  const groupBreakdown = useMemo(() => {
    if (selectedGroupId !== 'all') return [];
    return groups.map(g => {
      const recs = allAttendance.filter(a => a.group_id === g.id);
      const present = recs.filter(a => a.present).length;
      const total = recs.length;
      return {
        name: g.name.length > 15 ? g.name.slice(0, 14) + '…' : g.name,
        fullName: g.name,
        rate: total > 0 ? Math.round((present / total) * 100) : 0,
        present,
        total,
        color: g.color || '#6366f1',
      };
    }).filter(g => g.total > 0).sort((a, b) => b.rate - a.rate);
  }, [groups, allAttendance, selectedGroupId]);

  // Per-member breakdown for selected group
  const memberBreakdown = useMemo(() => {
    if (selectedGroupId === 'all') return [];
    const groupMembers = members.filter(m => m.group_id === selectedGroupId);
    return groupMembers.map(m => {
      const recs = filteredAttendance.filter(a => a.member_id === m.id);
      const present = recs.filter(a => a.present).length;
      const total = recs.length;
      return { name: m.member_name, rate: total > 0 ? Math.round((present / total) * 100) : 0, present, total };
    }).filter(m => m.total > 0).sort((a, b) => b.rate - a.rate);
  }, [selectedGroupId, members, filteredAttendance]);

  // Recent events with attendance summary
  const recentEvents = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return filteredSchedules
      .filter(s => s.date <= today)
      .slice(0, 8)
      .map(s => {
        const recs = allAttendance.filter(a => a.schedule_id === s.id);
        const present = recs.filter(a => a.present).length;
        const grp = groupById[s.group_id];
        return { ...s, presentCount: present, totalCount: recs.length, group: grp };
      })
      .filter(s => s.totalCount > 0);
  }, [filteredSchedules, allAttendance, groupById]);

  return (
    <div className="space-y-6">
      {/* Filter */}
      <div className="flex items-center gap-3">
        <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="All Groups" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Groups</SelectItem>
            {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {selectedGroupId !== 'all' && (
          <Badge variant="secondary" style={{ backgroundColor: (groupById[selectedGroupId]?.color || '#6366f1') + '22', color: groupById[selectedGroupId]?.color || '#6366f1' }}>
            {groupById[selectedGroupId]?.name}
          </Badge>
        )}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: CheckCircle2, label: 'Attendance Rate', value: `${overallRate}%`, color: 'text-green-600', bg: 'bg-green-100' },
          { icon: Users, label: 'Present (total)', value: presentCount.toLocaleString(), color: 'text-primary', bg: 'bg-primary/10' },
          { icon: Calendar, label: 'Events Tracked', value: eventsTracked, color: 'text-secondary', bg: 'bg-secondary/20' },
          { icon: TrendingUp, label: 'Records', value: totalRecords.toLocaleString(), color: 'text-purple-600', bg: 'bg-purple-100' },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div>
                <p className="text-xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {totalRecords === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No attendance data yet. Start taking attendance for scheduled events.</p>
        </div>
      ) : (
        <>
          {/* Monthly trend chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Monthly Attendance Trend (Last 6 Months)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthlyData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="present" name="Present" fill="#22c55e" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="absent" name="Absent" fill="#f87171" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Attendance rate line chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Attendance Rate % Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={monthlyData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
                  <Tooltip formatter={(v) => `${v}%`} />
                  <Line type="monotone" dataKey="rate" name="Rate" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Group breakdown OR member breakdown */}
          {selectedGroupId === 'all' && groupBreakdown.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Attendance Rate by Group</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {groupBreakdown.map(g => (
                  <div key={g.fullName} className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: g.color }} />
                    <p className="text-sm w-36 flex-shrink-0 truncate" title={g.fullName}>{g.fullName}</p>
                    <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${g.rate}%`, backgroundColor: g.color }} />
                    </div>
                    <p className="text-sm font-semibold w-12 text-right flex-shrink-0">{g.rate}%</p>
                    <p className="text-xs text-muted-foreground w-16 text-right flex-shrink-0">{g.present}/{g.total}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {selectedGroupId !== 'all' && memberBreakdown.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Attendance by Member</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {memberBreakdown.map(m => (
                  <div key={m.name} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">{m.name[0]}</div>
                    <p className="text-sm w-32 flex-shrink-0 truncate">{m.name}</p>
                    <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${m.rate}%` }} />
                    </div>
                    <p className="text-sm font-semibold w-12 text-right flex-shrink-0">{m.rate}%</p>
                    <p className="text-xs text-muted-foreground w-16 text-right flex-shrink-0">{m.present}/{m.total}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Recent events */}
          {recentEvents.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Recent Events</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {recentEvents.map(s => {
                  const rate = s.totalCount > 0 ? Math.round((s.presentCount / s.totalCount) * 100) : 0;
                  return (
                    <div key={s.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/40">
                      <div className="text-xs text-muted-foreground w-20 flex-shrink-0">{format(new Date(s.date + 'T00:00:00'), 'MMM d')}</div>
                      <p className="text-sm flex-1 truncate">{s.title}</p>
                      {s.group && <Badge variant="secondary" className="text-xs flex-shrink-0" style={{ backgroundColor: (s.group.color || '#6366f1') + '22', color: s.group.color || '#6366f1' }}>{s.group.name}</Badge>}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <p className="text-xs text-muted-foreground">{s.presentCount}/{s.totalCount}</p>
                        <Badge variant="outline" className={`text-xs ${rate >= 80 ? 'text-green-600' : rate >= 50 ? 'text-yellow-600' : 'text-red-500'}`}>{rate}%</Badge>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}