import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

const EST_TZ = 'America/New_York';

function formatEST(dateInput, fmt) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d)) return '';
  // For date+time format
  if (fmt === 'datetime') {
    return d.toLocaleString('en-US', {
      timeZone: EST_TZ,
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true
    });
  }
  // For date-only format
  return d.toLocaleString('en-US', {
    timeZone: EST_TZ,
    month: 'short', day: 'numeric', year: 'numeric'
  });
}
import {
  UserPlus, CalendarCheck, HandCoins, Droplets,
  Users, Heart, CalendarDays,
  ShieldCheck, Info, Activity, ClipboardCheck
} from 'lucide-react';

function TimelineEvent({ icon: Icon, color, title, detail, date }) {
  return (
    <div className="flex gap-3">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 pb-4 border-b border-border/40 last:border-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <p className="text-sm font-medium">{title}</p>
          {date && <span className="text-xs text-muted-foreground flex-shrink-0">{formatEST(date, 'datetime')} EST</span>}
        </div>
        {detail && <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>}
      </div>
    </div>
  );
}

export default function UserActivityTimeline({ user, churchMap }) {
  const { data: invitations = [] } = useQuery({
    queryKey: ['user-invites', user.email],
    queryFn: () => base44.entities.ChurchInvitation.filter({ user_email: user.email }, '-created_date', 100),
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ['user-attendance', user.email],
    queryFn: () => base44.entities.AttendanceRecord.filter({ church_id: user.church_id }, '-date', 200),
    enabled: !!user.church_id,
  });

  const { data: giving = [] } = useQuery({
    queryKey: ['user-giving', user.email],
    queryFn: () => base44.entities.GivingRecord.filter({ church_id: user.church_id }, '-date', 200),
    enabled: !!user.church_id,
  });

  const { data: spiritual = [] } = useQuery({
    queryKey: ['user-spiritual', user.email],
    queryFn: () => base44.entities.SpiritualRecord.filter({ church_id: user.church_id }, '-date', 100),
    enabled: !!user.church_id,
  });

  const { data: prayerRequests = [] } = useQuery({
    queryKey: ['user-prayer', user.email],
    queryFn: () => base44.entities.PrayerRequest.filter({ email: user.email }, '-created_date', 100),
  });

  const { data: ministryMemberships = [] } = useQuery({
    queryKey: ['user-ministry', user.email],
    queryFn: () => base44.entities.MinistryGroupMember.filter({ member_email: user.email }, '-created_date', 100),
  });

  const { data: ministryGroups = [] } = useQuery({
    queryKey: ['ministry-groups-for-logs'],
    queryFn: () => base44.entities.MinistryGroup.list('-created_date', 200),
  });

  const { data: rsvps = [] } = useQuery({
    queryKey: ['user-rsvps', user.email],
    queryFn: () => base44.entities.EventRSVP.filter({ member_email: user.email }, '-created_date', 100),
  });

  // Attendance records THIS user submitted (as staff/tracker) — grouped by date+service_type
  const { data: attendanceTaken = [] } = useQuery({
    queryKey: ['user-attendance-taken', user.id],
    queryFn: () => base44.entities.AttendanceRecord.filter({ created_by_id: user.id }, '-created_date', 500),
    enabled: !!user.id,
  });

  // Ministry attendance taken by this user
  const { data: ministryAttendanceTaken = [] } = useQuery({
    queryKey: ['user-ministry-attendance-taken', user.id],
    queryFn: () => base44.entities.MinistryAttendance.filter({ created_by_id: user.id }, '-created_date', 500),
    enabled: !!user.id,
  });

  const { data: events = [] } = useQuery({
    queryKey: ['events-for-logs', user.church_id],
    queryFn: () => base44.entities.ChurchEvent.filter({ church_id: user.church_id }, '-date', 200),
    enabled: !!user.church_id,
  });

  const groupMap = Object.fromEntries(ministryGroups.map(g => [g.id, g.name]));
  const eventMap = Object.fromEntries(events.map(e => [e.id, e.title]));

  // Find attendance records for this user by member_name match (since attendance uses member_name not email)
  const memberName = user.full_name;
  const userAttendance = memberName
    ? attendance.filter(a => a.member_name === memberName && a.present)
    : [];

  // Build timeline events
  const timeline = [];

  // Account creation
  if (user.created_date) {
    timeline.push({
      date: user.created_date,
      icon: UserPlus,
      color: 'bg-green-100 text-green-700',
      title: 'Account created',
      detail: `Role: ${user.role?.replace(/_/g, ' ') || 'user'}`,
    });
  }

  // Church invitations
  invitations.forEach(inv => {
    timeline.push({
      date: inv.created_date,
      icon: ShieldCheck,
      color: inv.status === 'verified' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700',
      title: `Church signup — ${churchMap[inv.church_id] || inv.church_id}`,
      detail: `Status: ${inv.status}${inv.verified_at ? ` · Verified ${formatEST(inv.verified_at, 'date')}` : ''}`,
    });
  });

  // Ministry memberships
  ministryMemberships.forEach(m => {
    timeline.push({
      date: m.created_date,
      icon: Users,
      color: 'bg-indigo-100 text-indigo-700',
      title: `Added to ministry group`,
      detail: groupMap[m.group_id] || m.group_id,
    });
  });

  // Event RSVPs
  rsvps.forEach(r => {
    timeline.push({
      date: r.created_date,
      icon: CalendarDays,
      color: 'bg-pink-100 text-pink-700',
      title: `RSVP — ${eventMap[r.event_id] || 'Event'}`,
      detail: `Status: ${r.status}`,
    });
  });

  // Attendance this member personally attended
  userAttendance.forEach(a => {
    timeline.push({
      date: a.date + 'T00:00:00',
      icon: CalendarCheck,
      color: 'bg-teal-100 text-teal-700',
      title: 'Attended service',
      detail: a.service_type?.replace(/_/g, ' '),
    });
  });

  // Attendance sessions this user RECORDED (as staff/tracker) — group by date+service_type
  const attendanceSessionMap = {};
  attendanceTaken.forEach(a => {
    const key = `${a.date}__${a.service_type}`;
    if (!attendanceSessionMap[key]) {
      attendanceSessionMap[key] = { date: a.date, service_type: a.service_type, count: 0, submitted_at: a.created_date };
    }
    attendanceSessionMap[key].count++;
    // keep earliest created_date as the "submitted" time for this session
    if (a.created_date < attendanceSessionMap[key].submitted_at) {
      attendanceSessionMap[key].submitted_at = a.created_date;
    }
  });
  Object.values(attendanceSessionMap).forEach(session => {
    timeline.push({
      date: session.submitted_at,
      icon: ClipboardCheck,
      color: 'bg-orange-100 text-orange-700',
      title: `Took attendance — ${session.service_type?.replace(/_/g, ' ') || 'Service'}`,
      detail: `${formatEST(session.date + 'T00:00:00', 'date')} · ${session.count} member${session.count !== 1 ? 's' : ''} recorded`,
    });
  });

  // Ministry attendance sessions this user recorded
  const ministryAttendanceSessionMap = {};
  ministryAttendanceTaken.forEach(a => {
    const key = `${a.group_id}__${a.date}`;
    if (!ministryAttendanceSessionMap[key]) {
      ministryAttendanceSessionMap[key] = { group_id: a.group_id, date: a.date, count: 0, submitted_at: a.created_date };
    }
    ministryAttendanceSessionMap[key].count++;
    if (a.created_date < ministryAttendanceSessionMap[key].submitted_at) {
      ministryAttendanceSessionMap[key].submitted_at = a.created_date;
    }
  });
  Object.values(ministryAttendanceSessionMap).forEach(session => {
    timeline.push({
      date: session.submitted_at,
      icon: ClipboardCheck,
      color: 'bg-violet-100 text-violet-700',
      title: `Took ministry attendance — ${groupMap[session.group_id] || 'Group'}`,
      detail: `${formatEST(session.date + 'T00:00:00', 'date')} · ${session.count} member${session.count !== 1 ? 's' : ''} recorded`,
    });
  });

  // Spiritual records
  spiritual.filter(s => s.member_name === memberName || !memberName).forEach(s => {
    timeline.push({
      date: s.date + 'T00:00:00',
      icon: Droplets,
      color: 'bg-cyan-100 text-cyan-700',
      title: `Spiritual milestone — ${s.type?.replace(/_/g, ' ')}`,
      detail: s.officiant ? `Officiant: ${s.officiant}` : undefined,
    });
  });

  // Prayer requests
  prayerRequests.forEach(p => {
    timeline.push({
      date: p.created_date,
      icon: Heart,
      color: 'bg-rose-100 text-rose-700',
      title: `Prayer request submitted`,
      detail: p.category ? `Category: ${p.category}` : undefined,
    });
  });

  // Giving (match by name)
  giving.filter(g => g.member_name === memberName).forEach(g => {
    timeline.push({
      date: g.date + 'T00:00:00',
      icon: HandCoins,
      color: 'bg-yellow-100 text-yellow-700',
      title: `Giving record — $${g.amount}`,
      detail: `${g.type} · ${g.method}`,
    });
  });

  // Sort newest first
  timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Stats
  const totalAttendance = userAttendance.length;
  const totalGiving = giving.filter(g => g.member_name === memberName).reduce((s, g) => s + (g.amount || 0), 0);
  const totalMinistry = ministryMemberships.length;
  const totalAttendanceSessions = Object.keys(attendanceSessionMap).length + Object.keys(ministryAttendanceSessionMap).length;

  return (
    <div className="space-y-6">
      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{totalAttendance}</p>
          <p className="text-xs text-muted-foreground">Services Attended</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{totalAttendanceSessions}</p>
          <p className="text-xs text-muted-foreground">Attendance Taken</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{totalMinistry}</p>
          <p className="text-xs text-muted-foreground">Ministry Groups</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{rsvps.length}</p>
          <p className="text-xs text-muted-foreground">Event RSVPs</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">${totalGiving.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Total Giving</p>
        </CardContent></Card>
      </div>

      {/* Account info */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Account Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Email</p>
            <p className="font-medium break-all">{user.email}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Role</p>
            <p className="font-medium capitalize">{user.role?.replace(/_/g, ' ') || 'user'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Registered</p>
            <p className="font-medium">{user.created_date ? formatEST(user.created_date, 'date') : '—'}</p>
          </div>
          {user.church_id && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Church</p>
              <p className="font-medium">{churchMap[user.church_id] || user.church_id}</p>
            </div>
          )}
          {user.phone && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Phone</p>
              <p className="font-medium">{user.phone}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Activity Timeline
            <Badge variant="secondary" className="ml-auto">{timeline.length} events</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {timeline.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Info className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No activity recorded yet.</p>
            </div>
          ) : (
            <div className="space-y-3 mt-2">
              {timeline.map((event, i) => (
                <TimelineEvent key={i} {...event} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}