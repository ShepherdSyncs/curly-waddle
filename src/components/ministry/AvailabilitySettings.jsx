import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, CalendarOff, CalendarClock } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { DAYS_OF_WEEK } from '@/lib/availability';

export default function AvailabilitySettings({ user, churchId }) {
  const queryClient = useQueryClient();
  const memberEmail = user?.email;

  const { data: weeklyRules = [] } = useQuery({
    queryKey: ['my-weekly-availability', memberEmail],
    queryFn: () => base44.entities.MemberWeeklyAvailability.filter({ church_id: churchId, member_email: memberEmail }),
    enabled: !!memberEmail && !!churchId,
  });

  const { data: exceptions = [] } = useQuery({
    queryKey: ['my-availability-exceptions', memberEmail],
    queryFn: () => base44.entities.MemberAvailabilityException.filter({ church_id: churchId, member_email: memberEmail }, '-start_date', 100),
    enabled: !!memberEmail && !!churchId,
  });

  const ruleByDay = Object.fromEntries(weeklyRules.map(r => [r.day_of_week, r]));

  const toggleDayMutation = useMutation({
    mutationFn: async ({ day, isAvailable }) => {
      const existing = ruleByDay[day];
      if (existing) {
        return base44.entities.MemberWeeklyAvailability.update(existing.id, { is_available: isAvailable });
      }
      return base44.entities.MemberWeeklyAvailability.create({
        church_id: churchId,
        member_email: memberEmail,
        day_of_week: day,
        is_available: isAvailable,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-weekly-availability', memberEmail] }),
    onError: () => toast.error('Could not update availability'),
  });

  const [newException, setNewException] = useState({ start_date: '', end_date: '', reason: '' });

  const addExceptionMutation = useMutation({
    mutationFn: () => base44.entities.MemberAvailabilityException.create({
      church_id: churchId,
      member_email: memberEmail,
      start_date: newException.start_date,
      end_date: newException.end_date || newException.start_date,
      is_available: false,
      reason: newException.reason || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-availability-exceptions', memberEmail] });
      setNewException({ start_date: '', end_date: '', reason: '' });
      toast.success('Marked unavailable');
    },
    onError: () => toast.error('Could not save — check your dates'),
  });

  const removeExceptionMutation = useMutation({
    mutationFn: (id) => base44.entities.MemberAvailabilityException.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-availability-exceptions', memberEmail] });
      toast.success('Removed');
    },
  });

  const today = format(new Date(), 'yyyy-MM-dd');
  const upcomingExceptions = exceptions.filter(e => e.end_date >= today);

  if (!memberEmail || !churchId) return null;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-2">
          <CalendarClock className="w-4 h-4" /> Weekly Availability
        </h3>
        <p className="text-xs text-muted-foreground mb-3">Turn off any day you're generally not available. Group leaders will see this when assigning workers.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {DAYS_OF_WEEK.map(d => {
            const rule = ruleByDay[d.value];
            const isAvailable = rule ? rule.is_available !== false : true;
            return (
              <div key={d.value} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                <span className="text-sm font-medium">{d.label}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${isAvailable ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {isAvailable ? 'Available' : 'Unavailable'}
                  </span>
                  <Switch checked={isAvailable} onCheckedChange={(v) => toggleDayMutation.mutate({ day: d.value, isAvailable: v })} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-2">
          <CalendarOff className="w-4 h-4" /> Dates You're Unavailable
        </h3>
        <p className="text-xs text-muted-foreground mb-3">Add specific dates (vacation, travel, etc.) — this overrides your weekly pattern above.</p>

        {upcomingExceptions.length > 0 && (
          <div className="space-y-2 mb-3">
            {upcomingExceptions.map(e => (
              <div key={e.id} className="flex items-center gap-3 p-2.5 rounded-lg border bg-muted/30">
                <Badge variant="secondary" className="text-xs flex-shrink-0">
                  {e.start_date === e.end_date
                    ? format(new Date(e.start_date + 'T00:00:00'), 'MMM d, yyyy')
                    : `${format(new Date(e.start_date + 'T00:00:00'), 'MMM d')} – ${format(new Date(e.end_date + 'T00:00:00'), 'MMM d, yyyy')}`}
                </Badge>
                {e.reason && <span className="text-xs text-muted-foreground flex-1 truncate">{e.reason}</span>}
                <Button size="icon" variant="ghost" className="w-7 h-7 text-destructive flex-shrink-0" onClick={() => removeExceptionMutation.mutate(e.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
          <div>
            <Label className="text-xs">From</Label>
            <Input type="date" className="mt-1" value={newException.start_date} onChange={e => setNewException({ ...newException, start_date: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <Input type="date" className="mt-1" value={newException.end_date} onChange={e => setNewException({ ...newException, end_date: e.target.value })} />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Label className="text-xs">Reason (optional)</Label>
            <Input className="mt-1" placeholder="Vacation" value={newException.reason} onChange={e => setNewException({ ...newException, reason: e.target.value })} />
          </div>
          <Button size="sm" className="gap-1.5" disabled={!newException.start_date || addExceptionMutation.isPending} onClick={() => addExceptionMutation.mutate()}>
            <Plus className="w-3.5 h-3.5" /> Add
          </Button>
        </div>
      </div>
    </div>
  );
}
