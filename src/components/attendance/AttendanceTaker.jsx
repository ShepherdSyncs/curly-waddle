import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarCheck, UserPlus, CheckCircle2, XCircle, Users, AlertTriangle, Wifi } from 'lucide-react';
import { toast } from 'sonner';
import { format, differenceInYears, parseISO } from 'date-fns';
import AddVisitorDialog from '@/components/attendance/AddVisitorDialog';

const SERVICE_TYPES = [
  { value: 'sunday_morning', label: 'Sunday Morning' },
  { value: 'sunday_evening', label: 'Sunday Evening' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'bible_study', label: 'Bible Study' },
  { value: 'special_event', label: 'Special Event' },
  { value: 'other', label: 'Other' },
];

const AGE_GROUPS = [
  { key: 'infants', label: 'Infants', range: '0–2', color: 'bg-pink-100 text-pink-700 border-pink-200' },
  { key: 'littles', label: 'Littles', range: '2–8', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { key: 'young',   label: 'Young',   range: '8–17', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { key: 'adults',  label: 'Adults',  range: '18+', color: 'bg-teal-100 text-teal-700 border-teal-200' },
];

function getAgeGroup(dob) {
  if (!dob) return 'adults'; // default if no DOB
  const age = differenceInYears(new Date(), new Date(dob + 'T00:00:00'));
  if (age < 2) return 'infants';
  if (age < 8) return 'littles';
  if (age < 18) return 'young';
  return 'adults';
}

export default function AttendanceTaker({ churchId, user, isChurchAdmin, isMinistryStaff, church }) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [date, setDate] = useState(today);
  const [serviceType, setServiceType] = useState('sunday_morning');
  const [attendance, setAttendance] = useState({}); // { memberId: boolean }
  const [saving, setSaving] = useState(false);
  const [showAddVisitor, setShowAddVisitor] = useState(false);
  const [liveCount, setLiveCount] = useState(0); // count of live record updates
  const queryClient = useQueryClient();

  // ── members ────────────────────────────────────────────────────────────────
  const { data: allMembers = [] } = useQuery({
    queryKey: ['members', churchId],
    queryFn: () => base44.entities.ChurchMember.filter({ church_id: churchId }),
    enabled: !!churchId,
  });

  const members = useMemo(() =>
    [...allMembers]
      .filter(m => m.status === 'active' || m.status === 'inactive')
      .sort((a, b) => (a.last_name || '').localeCompare(b.last_name || '') || (a.first_name || '').localeCompare(b.first_name || '')),
    [allMembers]
  );

  // ── existing records for this date/service (for pre-loading & live sync) ──
  const { data: existingRecords = [], refetch: refetchRecords } = useQuery({
    queryKey: ['attendance-live', churchId, date, serviceType],
    queryFn: () => base44.entities.AttendanceRecord.filter({
      church_id: churchId, date, service_type: serviceType,
    }),
    enabled: !!churchId,
    staleTime: 0,
  });

  // Pre-load attendance state from existing records whenever date/service changes
  useEffect(() => {
    const map = {};
    members.forEach(m => { map[m.id] = false; });
    existingRecords.forEach(r => { if (r.member_id) map[r.member_id] = r.present ?? false; });
    setAttendance(map);
  }, [existingRecords, members]);

  // ── Real-time subscription ─────────────────────────────────────────────────
  useEffect(() => {
    const unsub = base44.entities.AttendanceRecord.subscribe((event) => {
      // Only react to records for this church/date/service
      const r = event.data;
      if (!r || r.church_id !== churchId) return;
      if (r.date !== date || r.service_type !== serviceType) return;

      if (event.type === 'create' || event.type === 'update') {
        setAttendance(prev => {
          if (r.member_id && prev[r.member_id] === r.present) return prev; // no change
          setLiveCount(c => c + 1);
          return r.member_id ? { ...prev, [r.member_id]: r.present ?? false } : prev;
        });
      }
    });
    return () => unsub();
  }, [churchId, date, serviceType]);

  // ── Assign members to age groups ──────────────────────────────────────────
  const grouped = useMemo(() => {
    const groups = { infants: [], littles: [], young: [], adults: [] };
    members.forEach(m => {
      const g = getAgeGroup(m.date_of_birth);
      groups[g].push(m);
    });
    return groups;
  }, [members]);

  // ── Mark a single member present/absent (upsert immediately) ─────────────
  const toggleMember = useCallback(async (member) => {
    const newVal = !attendance[member.id];
    setAttendance(prev => ({ ...prev, [member.id]: newVal }));

    // Find existing record for this session
    const existing = existingRecords.find(r => r.member_id === member.id);
    const ageGroup = getAgeGroup(member.date_of_birth);
    const payload = {
      church_id: churchId,
      member_id: member.id,
      member_email: member.email || '',
      member_name: `${member.first_name} ${member.last_name}`,
      date,
      service_type: serviceType,
      present: newVal,
      age_group: ageGroup,
    };

    if (existing) {
      await base44.entities.AttendanceRecord.update(existing.id, { present: newVal, age_group: ageGroup });
    } else {
      await base44.entities.AttendanceRecord.create(payload);
    }
    // Silently refetch so other users stay in sync via subscription
    refetchRecords();
  }, [attendance, existingRecords, churchId, date, serviceType, refetchRecords]);

  const markAllGroup = useCallback(async (groupKey, val) => {
    const groupMembers = grouped[groupKey] || [];
    const updates = groupMembers.map(m => toggleMember(m));
    await Promise.all(updates.filter((_, i) => attendance[groupMembers[i].id] !== val));
    // Actually just set all
    for (const m of groupMembers) {
      if (attendance[m.id] !== val) await toggleMember(m);
    }
  }, [grouped, attendance, toggleMember]);

  const markAll = useCallback(async (val) => {
    for (const m of members) {
      if (attendance[m.id] !== val) {
        // Optimistically set first
        setAttendance(prev => ({ ...prev, [m.id]: val }));
      }
    }
    // Bulk save
    const toSave = members.map(m => {
      const existing = existingRecords.find(r => r.member_id === m.id);
      const ageGroup = getAgeGroup(m.date_of_birth);
      if (existing) {
        return base44.entities.AttendanceRecord.update(existing.id, { present: val, age_group: ageGroup });
      } else {
        return base44.entities.AttendanceRecord.create({
          church_id: churchId, member_id: m.id,
          member_email: m.email || '',
          member_name: `${m.first_name} ${m.last_name}`,
          date, service_type: serviceType, present: val, age_group: ageGroup,
        });
      }
    });
    await Promise.all(toSave);
    refetchRecords();
    toast.success(val ? 'All marked present' : 'All cleared');
  }, [members, attendance, existingRecords, churchId, date, serviceType, refetchRecords]);

  const totalPresent = members.filter(m => attendance[m.id] === true).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-primary" />
            Record Attendance — {format(parseISO(date), 'MMMM d, yyyy')}
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
              <Wifi className="w-3.5 h-3.5" />
              Live
            </div>
            <Button variant="outline" size="sm" className="gap-2 text-sm" onClick={() => setShowAddVisitor(true)}>
              <UserPlus className="w-4 h-4" /> Add Member / Guest
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Date + Service selectors */}
        <div className="flex flex-wrap gap-4">
          {isMinistryStaff && (
            <div className="flex-1 min-w-[160px] max-w-xs">
              <Label>Service Date</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-1" />
            </div>
          )}
          <div className="flex-1 min-w-[160px] max-w-xs">
            <Label>Service Type</Label>
            <Select value={serviceType} onValueChange={setServiceType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SERVICE_TYPES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Summary row */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5 text-green-600 font-medium">
              <CheckCircle2 className="w-4 h-4" /> {totalPresent} present
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <XCircle className="w-4 h-4" /> {members.length - totalPresent} absent
            </span>
            {/* Per-group counts */}
            {AGE_GROUPS.map(g => {
              const cnt = (grouped[g.key] || []).filter(m => attendance[m.id] === true).length;
              return cnt > 0 ? (
                <span key={g.key} className={`text-xs px-2 py-0.5 rounded-full border font-medium ${g.color}`}>
                  {g.label}: {cnt}
                </span>
              ) : null;
            })}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => markAll(true)}>All Present</Button>
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => markAll(false)}>Clear All</Button>
          </div>
        </div>

        {/* Age group tabs */}
        <Tabs defaultValue="adults" className="w-full">
          <TabsList className="flex w-full overflow-x-auto gap-1">
            {AGE_GROUPS.map(g => {
              const total = (grouped[g.key] || []).length;
              const present = (grouped[g.key] || []).filter(m => attendance[m.id] === true).length;
              return (
                <TabsTrigger key={g.key} value={g.key} className="flex-1 min-w-[80px] gap-1.5">
                  {g.label}
                  <span className="text-xs opacity-70">{g.range}</span>
                  <Badge variant="secondary" className="ml-1 text-xs px-1.5 h-4">{present}/{total}</Badge>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {AGE_GROUPS.map(g => (
            <TabsContent key={g.key} value={g.key} className="mt-3">
              <div className="flex justify-between items-center mb-2">
                <p className="text-xs text-muted-foreground">
                  {g.label} ({g.range} yrs) — {(grouped[g.key] || []).filter(m => attendance[m.id] === true).length} of {(grouped[g.key] || []).length} present
                </p>
                <div className="flex gap-1.5">
                  <Button variant="outline" size="sm" className="h-6 text-xs"
                    onClick={async () => {
                      for (const m of (grouped[g.key] || [])) {
                        if (!attendance[m.id]) await toggleMember(m);
                      }
                    }}>
                    All Present
                  </Button>
                  <Button variant="outline" size="sm" className="h-6 text-xs"
                    onClick={async () => {
                      for (const m of (grouped[g.key] || [])) {
                        if (attendance[m.id]) await toggleMember(m);
                      }
                    }}>
                    Clear
                  </Button>
                </div>
              </div>
              <div className="border rounded-lg divide-y max-h-96 overflow-y-auto">
                {(grouped[g.key] || []).length === 0 && (
                  <p className="text-center text-muted-foreground py-6 text-sm">
                    No members in this age group
                    {g.key !== 'adults' && <span className="block text-xs mt-1">Members without a date of birth are placed in Adults</span>}
                  </p>
                )}
                {(grouped[g.key] || []).map(m => {
                  const isPresent = attendance[m.id] === true;
                  return (
                    <div
                      key={m.id}
                      className={`flex items-center gap-3 px-3 py-2.5 transition-colors cursor-pointer select-none ${isPresent ? 'bg-green-50/60' : 'bg-background hover:bg-muted/30'}`}
                      onClick={() => toggleMember(m)}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${isPresent ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                        {m.first_name?.[0]}{m.last_name?.[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{m.first_name} {m.last_name}</p>
                        {m.date_of_birth && (
                          <p className="text-xs text-muted-foreground">
                            Age {differenceInYears(new Date(), new Date(m.date_of_birth + 'T00:00:00'))}
                          </p>
                        )}
                      </div>
                      <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all flex-shrink-0 ${isPresent ? 'bg-green-500 text-white border-green-500' : 'bg-background text-green-600 border-green-300'}`}>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {isPresent ? 'Present' : 'Absent'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>

      {showAddVisitor && (
        <AddVisitorDialog
          churchId={churchId}
          churchAdminEmail={church?.email || user?.email}
          user={user}
          serviceDate={date}
          onClose={() => setShowAddVisitor(false)}
          onAdded={() => refetchRecords()}
        />
      )}
    </Card>
  );
}