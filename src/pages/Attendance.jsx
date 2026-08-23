import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import useAppUser from '@/hooks/useAppUser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarCheck, Trash2, MonitorCheck, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AttendanceTaker from '@/components/attendance/AttendanceTaker';
import FollowUpTasksPanel from '@/components/attendance/FollowUpTasksPanel';

const SERVICE_TYPES = [
  { value: 'sunday_morning', label: 'Sunday Morning' },
  { value: 'sunday_evening', label: 'Sunday Evening' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'bible_study', label: 'Bible Study' },
  { value: 'special_event', label: 'Special Event' },
  { value: 'other', label: 'Other' },
];

const AGE_GROUP_LABELS = {
  infants: 'Infants (0–2)',
  littles: 'Littles (2–8)',
  young: 'Young (8–17)',
  adults: 'Adults (18+)',
};

const AGE_GROUP_COLORS = {
  infants: 'bg-pink-100 text-pink-700',
  littles: 'bg-yellow-100 text-yellow-700',
  young: 'bg-blue-100 text-blue-700',
  adults: 'bg-teal-100 text-teal-700',
};

export default function Attendance() {
  const { user, isTracker, isGlobalAdmin, isChurchAdmin, isMinistryStaff } = useAppUser();
  const churchId = user?.church_id;
  const canTakeAttendance = isTracker || isChurchAdmin || isGlobalAdmin;
  const canViewHistory = isChurchAdmin || isGlobalAdmin;
  const queryClient = useQueryClient();

  const { data: records = [], refetch: refetchRecords } = useQuery({
    queryKey: ['attendance', churchId],
    queryFn: () => churchId
      ? base44.entities.AttendanceRecord.filter({ church_id: churchId }, '-date', 500)
      : isGlobalAdmin ? base44.entities.AttendanceRecord.list('-date', 500) : [],
    enabled: !!user,
    staleTime: 0,
  });

  const { data: churchData = [] } = useQuery({
    queryKey: ['church-info', churchId],
    queryFn: () => base44.entities.Church.filter({ id: churchId }),
    enabled: !!churchId,
  });
  const church = churchData[0];

  const deleteRecordMutation = useMutation({
    mutationFn: (id) => base44.entities.AttendanceRecord.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      toast.success('Record deleted');
    },
  });

  // Recent records grouped by date + service_type
  const recentGroups = [];
  const seenKeys = new Set();
  for (const r of records) {
    const key = `${r.date}||${r.service_type}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      recentGroups.push({ date: r.date, service_type: r.service_type });
      if (recentGroups.length >= 10) break;
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-serif font-bold">Attendance</h1>
        <p className="text-sm text-muted-foreground mt-1">Track service attendance by age group · updates sync live</p>
      </div>

      {(churchId || isChurchAdmin || isGlobalAdmin) && (
        <Tabs defaultValue={canTakeAttendance ? 'take' : 'history'} className="space-y-4">
          <TabsList>
            {canTakeAttendance && <TabsTrigger value="take">Take Attendance</TabsTrigger>}
            {canViewHistory && <TabsTrigger value="history">Attendance History</TabsTrigger>}
            <TabsTrigger value="kiosk">Kiosk Mode</TabsTrigger>
          </TabsList>

          {canTakeAttendance && (
            <TabsContent value="take" className="space-y-4">
              <AttendanceTaker
                churchId={churchId}
                user={user}
                isChurchAdmin={isChurchAdmin}
                isMinistryStaff={isMinistryStaff}
                church={church}
              />
              {churchId && <FollowUpTasksPanel churchId={churchId} isAdmin={isChurchAdmin || isGlobalAdmin} />}
            </TabsContent>
          )}

          {canViewHistory && (
            <TabsContent value="history">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg">Prior Attendance</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => refetchRecords()}>Refresh</Button>
                </CardHeader>
                <CardContent>
                  {recentGroups.length === 0 ? (
                    <p className="text-muted-foreground text-center py-6">No attendance records yet</p>
                  ) : (
                    <div className="space-y-4">
                      {recentGroups.map(({ date: d, service_type: stype }) => {
                        const dayRecords = records.filter(r => r.date === d && r.service_type === stype);
                        const presentRecs = dayRecords.filter(r => r.present !== false);
                        const absentRecs = dayRecords.filter(r => r.present === false);
                        const serviceLabel = SERVICE_TYPES.find(s => s.value === stype)?.label || stype;

                        // Build age group breakdown for present
                        const ageBreakdown = {};
                        presentRecs.forEach(r => {
                          const g = r.age_group || 'adults';
                          ageBreakdown[g] = (ageBreakdown[g] || 0) + 1;
                        });

                        return (
                          <div key={`${d}-${stype}`} className="border rounded-lg p-4 space-y-3">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div>
                                <p className="font-medium">{format(parseISO(d), 'EEEE, MMMM d, yyyy')}</p>
                                <p className="text-xs text-muted-foreground">{serviceLabel}</p>
                              </div>
                              <div className="flex flex-wrap gap-2 items-center">
                                <Badge className="bg-green-100 text-green-700">{presentRecs.length} present</Badge>
                                {absentRecs.length > 0 && <Badge className="bg-red-100 text-red-600">{absentRecs.length} absent</Badge>}
                                {/* Age group breakdown */}
                                {Object.entries(ageBreakdown).map(([g, cnt]) => (
                                  <Badge key={g} className={`${AGE_GROUP_COLORS[g] || 'bg-gray-100 text-gray-600'} text-xs`}>
                                    {AGE_GROUP_LABELS[g] || g}: {cnt}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            {presentRecs.length > 0 && (
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Present:</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {presentRecs.map(r => (
                                    <div key={r.id} className={`flex items-center gap-1 text-xs border px-2 py-0.5 rounded-full ${AGE_GROUP_COLORS[r.age_group] || 'bg-green-50 border-green-200 text-green-700'}`}>
                                      {r.member_name || 'Unknown'}
                                      {isChurchAdmin && (
                                        <button onClick={() => deleteRecordMutation.mutate(r.id)} className="ml-1 hover:opacity-60">
                                          <Trash2 className="w-2.5 h-2.5" />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {absentRecs.length > 0 && (
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Absent:</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {absentRecs.map(r => (
                                    <div key={r.id} className="flex items-center gap-1 text-xs bg-red-50 border border-red-200 text-red-600 px-2 py-0.5 rounded-full">
                                      {r.member_name || 'Unknown'}
                                      {isChurchAdmin && (
                                        <button onClick={() => deleteRecordMutation.mutate(r.id)} className="ml-1 hover:text-red-700">
                                          <Trash2 className="w-2.5 h-2.5" />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          <TabsContent value="kiosk">
            <Card>
              <CardContent className="py-12 text-center">
                <MonitorCheck className="w-12 h-12 mx-auto mb-3 text-primary" />
                <h3 className="font-semibold text-lg mb-2">Kiosk Check-In Mode</h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                  Launch a full-screen check-in kiosk for volunteers to quickly check in children and attendees on a dedicated device.
                </p>
                <Button asChild>
                  <a href={`/kiosk${user?.church_id ? `?church_id=${user.church_id}` : ''}`} target="_blank" rel="noopener noreferrer" className="gap-2">
                    <ExternalLink className="w-4 h-4" /> Launch Kiosk
                  </a>
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {!canTakeAttendance && !canViewHistory && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <CalendarCheck className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>You don't have permission to access attendance features.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}