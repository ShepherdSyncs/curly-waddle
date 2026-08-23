import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Save, Clock, MapPin, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

// readOnly = attendance leader can VIEW but editing is done via canEdit (group leader / admin)
export default function TakeAttendanceDialog({ schedule, group, onClose, readOnly = false }) {
  const queryClient = useQueryClient();
  const [attendance, setAttendance] = useState({}); // { member_id: true/false }
  const [initialized, setInitialized] = useState(false);

  const { data: members = [] } = useQuery({
    queryKey: ['ministry-members', group.id],
    queryFn: () => base44.entities.MinistryGroupMember.filter({ group_id: group.id }),
  });

  const { data: existing = [] } = useQuery({
    queryKey: ['ministry-attendance', schedule.id],
    queryFn: () => base44.entities.MinistryAttendance.filter({ schedule_id: schedule.id }),
  });

  useEffect(() => {
    if (!initialized && members.length > 0) {
      const map = {};
      members.forEach(m => {
        const rec = existing.find(e => e.member_id === m.id);
        // Default: present (true) only if no existing record. If record exists, use it.
        map[m.id] = rec ? rec.present : true;
      });
      setAttendance(map);
      setInitialized(true);
    }
  }, [members, existing, initialized]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      for (const member of members) {
        const isPresent = attendance[member.id] ?? true;
        const existing_rec = existing.find(e => e.member_id === member.id);
        if (existing_rec) {
          await base44.entities.MinistryAttendance.update(existing_rec.id, { present: isPresent });
        } else {
          await base44.entities.MinistryAttendance.create({
            schedule_id: schedule.id,
            group_id: group.id,
            church_id: group.church_id,
            member_id: member.id,
            member_name: member.member_name,
            member_email: member.member_email || '',
            date: schedule.date,
            present: isPresent,
          });
        }
      }
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['ministry-attendance'] });
      queryClient.invalidateQueries({ queryKey: ['ministry-attendance-all'] });
      toast.success('Attendance saved');

      // Trigger absence follow-up email if anyone is absent
      const absentCount = Object.values(attendance).filter(v => v === false).length;
      if (absentCount > 0) {
        base44.functions.invoke('absenceFollowUp', {
          schedule_id: schedule.id,
          group_id: group.id,
          church_id: group.church_id,
        }).catch(() => {}); // fire-and-forget
      }

      onClose();
    },
  });

  const presentCount = Object.values(attendance).filter(Boolean).length;
  const totalCount = members.length;

  const markAll = (val) => {
    const map = {};
    members.forEach(m => { map[m.id] = val; });
    setAttendance(map);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {readOnly ? <Eye className="w-4 h-4 text-muted-foreground" /> : null}
            {readOnly ? 'View Attendance' : 'Take Attendance'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-1">
          {/* Schedule info */}
          <div className="p-3 rounded-lg bg-muted/50 border space-y-1">
            <p className="font-semibold text-sm">{schedule.title}</p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              <span>{format(new Date(schedule.date + 'T00:00:00'), 'EEEE, MMMM d, yyyy')}</span>
              {schedule.time && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{schedule.time}</span>}
              {schedule.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{schedule.location}</span>}
            </div>
          </div>

          {/* Summary bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-sm">
              <span className="flex items-center gap-1.5 text-green-600 font-medium">
                <CheckCircle2 className="w-4 h-4" /> {presentCount} present
              </span>
              <span className="flex items-center gap-1.5 text-red-500 font-medium">
                <XCircle className="w-4 h-4" /> {totalCount - presentCount} absent
              </span>
            </div>
            {!readOnly && (
              <div className="flex gap-1.5">
                <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => markAll(true)}>All Present</Button>
                <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => markAll(false)}>All Absent</Button>
              </div>
            )}
          </div>

          {/* Member list */}
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No members in this group.</p>
          ) : (
            <div className="space-y-2">
              {members.map(member => {
                const isPresent = attendance[member.id] ?? true;
                return (
                  <div key={member.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${isPresent ? 'bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-800' : 'bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-800'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${isPresent ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {member.member_name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{member.member_name}</p>
                      {member.role_in_group && <p className="text-xs text-muted-foreground">{member.role_in_group}</p>}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {readOnly ? (
                        <Badge className={isPresent ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-600 border-red-200'}>
                          {isPresent ? 'Present' : 'Absent'}
                        </Badge>
                      ) : (
                        <>
                          <button
                            onClick={() => setAttendance(prev => ({ ...prev, [member.id]: true }))}
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${isPresent ? 'bg-green-500 text-white border-green-500' : 'bg-white text-green-600 border-green-300 hover:bg-green-50'}`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Present
                          </button>
                          <button
                            onClick={() => setAttendance(prev => ({ ...prev, [member.id]: false }))}
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${!isPresent ? 'bg-red-500 text-white border-red-500' : 'bg-white text-red-500 border-red-300 hover:bg-red-50'}`}
                          >
                            <XCircle className="w-3.5 h-3.5" /> Absent
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {readOnly ? (
            <Button variant="outline" className="w-full" onClick={onClose}>Close</Button>
          ) : (
            <Button className="w-full gap-2" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || members.length === 0}>
              <Save className="w-4 h-4" />
              {saveMutation.isPending ? 'Saving…' : 'Save Attendance'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}