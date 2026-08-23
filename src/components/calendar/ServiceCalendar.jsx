import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, Users, Check, X } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay } from 'date-fns';
import { toast } from 'sonner';

const SERVICE_TYPES = [
  { value: 'sunday_morning', label: 'Sunday Morning Worship' },
  { value: 'sunday_evening', label: 'Sunday Evening Worship' },
  { value: 'wednesday', label: 'Wednesday Night' },
  { value: 'special_event', label: 'Special Event' },
  { value: 'bible_study', label: 'Bible Study' },
];

export default function ServiceCalendar({ churchId, isAdmin }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [form, setForm] = useState({
    title: '',
    serviceType: 'sunday_morning',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '10:00',
    location: '',
    capacity: 0,
  });
  const queryClient = useQueryClient();

  const { data: events = [] } = useQuery({
    queryKey: ['church-events', churchId],
    queryFn: () => churchId ? base44.entities.ChurchEvent.filter({ church_id: churchId }, '-date', 100) : [],
    enabled: !!churchId,
  });

  const { data: userRsvps = [] } = useQuery({
    queryKey: ['my-rsvps', churchId],
    queryFn: () => churchId ? base44.entities.EventRSVP.filter({ church_id: churchId }) : [],
    enabled: !!churchId,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ChurchEvent.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['church-events'] });
      setShowCreateDialog(false);
      setForm({
        title: '',
        serviceType: 'sunday_morning',
        date: format(new Date(), 'yyyy-MM-dd'),
        time: '10:00',
        location: '',
        capacity: 0,
      });
      toast.success('Service scheduled');
    },
  });

  const rsvpMutation = useMutation({
    mutationFn: (data) => {
      const existing = userRsvps.find(r => r.event_id === data.event_id);
      if (existing) {
        return base44.entities.EventRSVP.update(existing.id, { status: data.status });
      }
      return base44.entities.ChurchEvent.update(data.event_id, { rsvp_count: (data.newCount || 0) + 1 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-rsvps'] });
      queryClient.invalidateQueries({ queryKey: ['church-events'] });
      toast.success('RSVP updated');
    },
  });

  const handleCreateEvent = () => {
    if (!form.title || !form.date) {
      toast.error('Title and date are required');
      return;
    }
    createMutation.mutate({
      church_id: churchId,
      title: form.title,
      description: form.serviceType,
      date: form.date,
      time: form.time,
      location: form.location,
      capacity: form.capacity ? parseInt(form.capacity) : 0,
      is_published: true,
    });
  };

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate),
  });

  // Parse date strings as local dates to avoid UTC offset shifting day
  const parseLocalDate = (dateStr) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  const monthEvents = events.filter(e =>
    daysInMonth.some(day => isSameDay(parseLocalDate(e.date), day))
  );

  const getEventsForDay = (day) =>
    monthEvents.filter(e => isSameDay(parseLocalDate(e.date), day));

  const handleRsvp = (event, attending) => {
    rsvpMutation.mutate({
      event_id: event.id,
      status: attending ? 'attending' : 'not_attending',
      newCount: event.rsvp_count,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-serif font-bold flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          {format(currentDate, 'MMMM yyyy')}
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}>←</Button>
          <Button variant="outline" onClick={() => setCurrentDate(new Date())}>Today</Button>
          <Button variant="outline" onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}>→</Button>
          {isAdmin && (
            <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
              <Calendar className="w-4 h-4" /> Schedule Service
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-7 gap-2 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-xs font-semibold text-muted-foreground py-2">
                {day}
              </div>
            ))}
            {daysInMonth.map(day => {
              const dayEvents = getEventsForDay(day);
              const isCurrentMonth = isSameMonth(day, currentDate);
              return (
                <div
                  key={day.toString()}
                  className={`min-h-24 p-2 border rounded-lg ${
                    isCurrentMonth ? 'bg-background' : 'bg-muted/30'
                  }`}
                >
                  <p className={`text-xs font-semibold mb-1 ${!isCurrentMonth ? 'text-muted-foreground' : ''}`}>
                    {format(day, 'd')}
                  </p>
                  <div className="space-y-1">
                    {dayEvents.map(event => (
                      <button
                        key={event.id}
                        onClick={() => setSelectedEvent(event)}
                        className="w-full text-xs bg-primary/10 hover:bg-primary/20 text-primary rounded px-1 py-0.5 truncate text-left transition-colors"
                      >
                        {event.title}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Event Details Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={v => !v && setSelectedEvent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedEvent?.title}</DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4 mt-4">
              <div>
                <Label className="text-xs text-muted-foreground">Date & Time</Label>
                <p className="font-semibold">{format(parseLocalDate(selectedEvent.date), 'EEEE, MMMM d, yyyy')} {selectedEvent.time}</p>
              </div>
              {selectedEvent.location && (
                <div>
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" /> Location
                  </Label>
                  <p>{selectedEvent.location}</p>
                </div>
              )}
              <div>
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" /> RSVPs
                </Label>
                <p>{selectedEvent.rsvp_count || 0} attending {selectedEvent.capacity > 0 && `of ${selectedEvent.capacity}`}</p>
              </div>
              <div className="flex gap-2 pt-4">
                <Button
                  onClick={() => handleRsvp(selectedEvent, true)}
                  className="flex-1 gap-2"
                  variant={userRsvps.find(r => r.event_id === selectedEvent.id)?.status === 'attending' ? 'default' : 'outline'}
                >
                  <Check className="w-4 h-4" /> Attending
                </Button>
                <Button
                  onClick={() => handleRsvp(selectedEvent, false)}
                  variant={userRsvps.find(r => r.event_id === selectedEvent.id)?.status === 'not_attending' ? 'destructive' : 'outline'}
                  className="flex-1 gap-2"
                >
                  <X className="w-4 h-4" /> Not Attending
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Service Dialog */}
      {isAdmin && (
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Schedule Service</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label>Service Title *</Label>
                <Input
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g., Sunday Morning Worship"
                />
              </div>
              <div>
                <Label>Service Type</Label>
                <Select value={form.serviceType} onValueChange={v => setForm({ ...form, serviceType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SERVICE_TYPES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Date *</Label>
                  <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
                </div>
                <div>
                  <Label>Time</Label>
                  <Input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Location</Label>
                <Input
                  value={form.location}
                  onChange={e => setForm({ ...form, location: e.target.value })}
                  placeholder="e.g., Main Sanctuary"
                />
              </div>
              <div>
                <Label>Capacity (0 = unlimited)</Label>
                <Input
                  type="number"
                  value={form.capacity}
                  onChange={e => setForm({ ...form, capacity: e.target.value })}
                  min="0"
                />
              </div>
              <Button onClick={handleCreateEvent} disabled={createMutation.isPending} className="w-full">
                {createMutation.isPending ? 'Scheduling...' : 'Schedule Service'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}