import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import useAppUser from '@/hooks/useAppUser';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Calendar, MapPin, Clock, Users, CheckCircle2, XCircle, Edit2, Trash2, ClipboardList, ExternalLink, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO, isFuture, isToday } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ServiceCalendar from '@/components/calendar/ServiceCalendar';
import { Switch } from '@/components/ui/switch';

const CATEGORIES = [
  { value: 'service', label: 'Service', color: 'bg-blue-100 text-blue-700' },
  { value: 'bible_study', label: 'Bible Study', color: 'bg-purple-100 text-purple-700' },
  { value: 'youth', label: 'Youth', color: 'bg-green-100 text-green-700' },
  { value: 'outreach', label: 'Outreach', color: 'bg-orange-100 text-orange-700' },
  { value: 'fellowship', label: 'Fellowship', color: 'bg-pink-100 text-pink-700' },
  { value: 'conference', label: 'Conference', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'other', label: 'Other', color: 'bg-gray-100 text-gray-600' },
];

const emptyForm = {
  title: '', description: '', date: '', time: '', end_time: '',
  location: '', address: '', category: 'service', capacity: '', image_url: '',
  enable_signup_form: false, signup_form_note: '', notify_email: '',
};

export default function Events() {
  const { user, isChurchAdmin, isStaff } = useAppUser();
  const churchId = user?.church_id;
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editEvent, setEditEvent] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [signupViewEvent, setSignupViewEvent] = useState(null);

  const { data: events = [] } = useQuery({
    queryKey: ['events', churchId],
    queryFn: () => churchId
      ? base44.entities.ChurchEvent.filter({ church_id: churchId, is_published: true }, 'date', 100)
      : [],
    enabled: !!churchId,
  });

  // Check URL param for direct signup view link from dashboard
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const viewId = p.get('view_signups');
    if (viewId && events.length > 0 && !signupViewEvent) {
      const found = events.find(e => e.id === viewId);
      if (found) setSignupViewEvent(found);
    }
  }, [events]);

  const { data: myRsvps = [] } = useQuery({
    queryKey: ['my-rsvps', user?.email],
    queryFn: () => base44.entities.EventRSVP.filter({ member_email: user.email }, '-created_date', 200),
    enabled: !!user?.email,
  });

  const { data: eventRsvps = [] } = useQuery({
    queryKey: ['event-rsvps', selectedEvent?.id],
    queryFn: () => base44.entities.EventRSVP.filter({ event_id: selectedEvent.id }, '-created_date', 200),
    enabled: !!selectedEvent?.id,
  });

  const { data: signupViewSignups = [] } = useQuery({
    queryKey: ['signup-view', signupViewEvent?.id],
    queryFn: () => base44.entities.EventSignup.filter({ event_id: signupViewEvent.id }),
    enabled: !!signupViewEvent?.id,
  });

  const saveMutation = useMutation({
    mutationFn: (data) => editEvent
      ? base44.entities.ChurchEvent.update(editEvent.id, data)
      : base44.entities.ChurchEvent.create({ ...data, church_id: churchId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setFormOpen(false);
      setEditEvent(null);
      setForm(emptyForm);
      toast.success(editEvent ? 'Event updated' : 'Event created');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ChurchEvent.update(id, { is_published: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Event removed');
    },
  });

  const rsvpMutation = useMutation({
    mutationFn: async ({ event, status }) => {
      const existing = myRsvps.find(r => r.event_id === event.id);
      if (existing) {
        return base44.entities.EventRSVP.update(existing.id, { status });
      }
      return base44.entities.EventRSVP.create({
        event_id: event.id,
        church_id: event.church_id,
        member_email: user.email,
        member_name: user.full_name || '',
        status,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-rsvps'] });
      queryClient.invalidateQueries({ queryKey: ['event-rsvps'] });
      toast.success('RSVP saved!');
    },
  });

  const openCreate = () => { setEditEvent(null); setForm(emptyForm); setFormOpen(true); };
  const openEdit = (event) => {
    setEditEvent(event);
    setForm({
      title: event.title || '', description: event.description || '',
      date: event.date || '', time: event.time || '', end_time: event.end_time || '',
      location: event.location || '', address: event.address || '',
      category: event.category || 'service', capacity: event.capacity || '',
      image_url: event.image_url || '',
      enable_signup_form: event.enable_signup_form || false,
      signup_form_note: event.signup_form_note || '',
      notify_email: event.notify_email || '',
    });
    setFormOpen(true);
  };

  const getSignupLink = (eventId) =>
    `${window.location.origin}/event-signup?event_id=${eventId}`;

  const myRsvpFor = (eventId) => myRsvps.find(r => r.event_id === eventId);

  const upcoming = events.filter(e => isFuture(parseISO(e.date)) || isToday(parseISO(e.date)));
  const past = events.filter(e => !isFuture(parseISO(e.date)) && !isToday(parseISO(e.date)));

  const catInfo = (cat) => CATEGORIES.find(c => c.value === cat) || CATEGORIES[6];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-serif font-bold">Events & Services</h1>
          <p className="text-sm text-muted-foreground mt-1">Schedule and manage church activities</p>
        </div>
      </div>

      <Tabs defaultValue="list" className="space-y-4">
        <TabsList>
          <TabsTrigger value="list">Event List</TabsTrigger>
          <TabsTrigger value="calendar">Calendar View</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-6">
          <div className="flex justify-end">
            {isStaff && (
              <Button onClick={openCreate} className="gap-2">
                <Plus className="w-4 h-4" /> Add Event
              </Button>
            )}
          </div>

      {/* Upcoming */}
      <div className="space-y-3">
        {upcoming.length === 0 && (
          <Card><CardContent className="py-10 text-center text-muted-foreground">No upcoming events</CardContent></Card>
        )}
        {upcoming.map(event => {
          const rsvp = myRsvpFor(event.id);
          const cat = catInfo(event.category);
          return (
            <Card key={event.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedEvent(event)}>
              <CardContent className="p-4">
                <div className="flex gap-4">
                  {/* Date block */}
                  <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-primary/10 flex flex-col items-center justify-center text-center">
                    <p className="text-xs font-medium text-primary uppercase">{format(parseISO(event.date), 'MMM')}</p>
                    <p className="text-2xl font-bold text-primary leading-none">{format(parseISO(event.date), 'd')}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <h3 className="font-semibold">{event.title}</h3>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <Badge className={`text-xs ${cat.color} border-0`}>{cat.label}</Badge>
                          {event.time && <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{event.time}{event.end_time ? ` – ${event.end_time}` : ''}</span>}
                          {event.location && <span className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" />{event.location}</span>}
                          {event.rsvp_count > 0 && <span className="text-xs text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" />{event.rsvp_count} going</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        {rsvp?.status === 'attending' ? (
                          <Button size="sm" variant="outline" className="text-xs text-green-600 border-green-300 gap-1" onClick={() => rsvpMutation.mutate({ event, status: 'not_attending' })}>
                            <CheckCircle2 className="w-3.5 h-3.5" /> Going
                          </Button>
                        ) : (
                          <Button size="sm" className="text-xs gap-1" onClick={() => rsvpMutation.mutate({ event, status: 'attending' })}>
                            RSVP
                          </Button>
                        )}
                        {isStaff && (
                          <>
                            {event.enable_signup_form && (
                              <Button size="sm" variant="outline" className="text-xs gap-1 h-7" onClick={() => setSignupViewEvent(event)}>
                                <ClipboardList className="w-3.5 h-3.5" /> Signups
                              </Button>
                            )}
                            <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => openEdit(event)}><Edit2 className="w-3.5 h-3.5" /></Button>
                            <Button size="icon" variant="ghost" className="w-7 h-7 text-destructive" onClick={() => deleteMutation.mutate(event.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                          </>
                        )}
                      </div>
                    </div>
                    {event.description && <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2">{event.description}</p>}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Past events */}
      {past.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Past Events</h2>
          <div className="space-y-2">
            {past.slice(0, 5).map(event => (
              <Card key={event.id} className="opacity-60">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="flex-shrink-0 text-center w-10">
                    <p className="text-xs text-muted-foreground">{format(parseISO(event.date), 'MMM d')}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{event.title}</p>
                    {event.location && <p className="text-xs text-muted-foreground">{event.location}</p>}
                  </div>
                  {isStaff && (
                    <Button size="icon" variant="ghost" className="w-7 h-7 text-destructive" onClick={() => deleteMutation.mutate(event.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
        )}
        </TabsContent>

        <TabsContent value="calendar">
         {churchId && <ServiceCalendar churchId={churchId} isAdmin={isChurchAdmin} />}
        </TabsContent>
        </Tabs>

        {/* Event Detail Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={v => !v && setSelectedEvent(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {selectedEvent && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedEvent.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                {selectedEvent.image_url && (
                  <img src={selectedEvent.image_url} alt="" className="w-full h-40 object-cover rounded-lg" />
                )}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    {format(parseISO(selectedEvent.date), 'EEEE, MMMM d, yyyy')}
                  </div>
                  {selectedEvent.time && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      {selectedEvent.time}{selectedEvent.end_time ? ` – ${selectedEvent.end_time}` : ''}
                    </div>
                  )}
                  {selectedEvent.location && (
                    <div className="flex items-center gap-2 text-muted-foreground col-span-2">
                      <MapPin className="w-4 h-4" />
                      {selectedEvent.location}{selectedEvent.address ? ` — ${selectedEvent.address}` : ''}
                    </div>
                  )}
                </div>
                {selectedEvent.description && <p className="text-sm">{selectedEvent.description}</p>}

                {/* RSVP */}
                <div className="flex gap-3 pt-2 border-t">
                  {myRsvpFor(selectedEvent.id)?.status === 'attending' ? (
                    <Button variant="outline" className="flex-1 gap-2 text-green-600 border-green-300"
                      onClick={() => rsvpMutation.mutate({ event: selectedEvent, status: 'not_attending' })}>
                      <CheckCircle2 className="w-4 h-4" /> You're Going — Cancel RSVP
                    </Button>
                  ) : (
                    <Button className="flex-1 gap-2"
                      onClick={() => rsvpMutation.mutate({ event: selectedEvent, status: 'attending' })}>
                      RSVP — I'm Attending
                    </Button>
                  )}
                </div>

                {/* Attendee list (staff only) */}
                {isStaff && eventRsvps.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      Attendees ({eventRsvps.filter(r => r.status === 'attending').length})
                    </p>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {eventRsvps.filter(r => r.status === 'attending').map(r => (
                        <div key={r.id} className="flex items-center gap-2 text-sm">
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                            {(r.member_name || r.member_email)[0].toUpperCase()}
                          </div>
                          <span>{r.member_name || r.member_email}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Signup Viewer Dialog */}
      <Dialog open={!!signupViewEvent} onOpenChange={v => !v && setSignupViewEvent(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {signupViewEvent && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-primary" />
                  Signups — {signupViewEvent.title}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="space-y-0.5">
                    <p className="text-sm text-muted-foreground">{format(parseISO(signupViewEvent.date), 'EEEE, MMMM d, yyyy')}</p>
                    <p className="text-lg font-bold text-primary">
                      {signupViewSignups.length} signed up · {signupViewSignups.reduce((s, r) => s + 1 + (r.guest_count || 0), 0)} total attendees
                    </p>
                  </div>
                  <Button size="sm" variant="outline" className="gap-2" onClick={() => { navigator.clipboard.writeText(getSignupLink(signupViewEvent.id)); toast.success('Signup link copied!'); }}>
                    <Copy className="w-4 h-4" /> Copy Signup Link
                  </Button>
                </div>

                {signupViewSignups.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p>No signups yet.</p>
                    <p className="text-xs mt-1">Share the signup link with your congregation.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {signupViewSignups.map((s, i) => (
                      <div key={s.id} className="p-3 rounded-lg border bg-muted/30 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-sm">{s.name}</p>
                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-0.5">
                              {s.email && <span>{s.email}</span>}
                              {s.phone && <span>{s.phone}</span>}
                            </div>
                          </div>
                          <div className="text-right text-xs text-muted-foreground flex-shrink-0">
                            <span className="font-medium text-foreground">{1 + (s.guest_count || 0)} total</span>
                            {s.guest_count > 0 && <p>+{s.guest_count} guest{s.guest_count !== 1 ? 's' : ''}</p>}
                          </div>
                        </div>
                        {s.guest_names && <p className="text-xs text-muted-foreground">Guests: {s.guest_names}</p>}
                        {s.notes && <p className="text-xs text-muted-foreground italic">Note: {s.notes}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create / Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={v => { if (!v) { setFormOpen(false); setEditEvent(null); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editEvent ? 'Edit Event' : 'New Event'}</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div><Label>Title *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Event title" /></div>
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Date *</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
              <div><Label>Start Time</Label><Input value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} placeholder="10:00 AM" /></div>
              <div><Label>End Time</Label><Input value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} placeholder="12:00 PM" /></div>
              <div><Label>Capacity</Label><Input type="number" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} placeholder="0 = unlimited" /></div>
            </div>
            <div><Label>Location / Venue</Label><Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Main Sanctuary" /></div>
            <div><Label>Address</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="123 Main St, City, State" /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} /></div>
            <div><Label>Image URL</Label><Input value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." /></div>

            {/* Signup Form */}
            <div className="pt-2 border-t space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium flex items-center gap-2"><ClipboardList className="w-4 h-4 text-primary" /> Enable Signup Form</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Generates a public link people can use to sign up</p>
                </div>
                <Switch
                  checked={form.enable_signup_form}
                  onCheckedChange={v => setForm({ ...form, enable_signup_form: v })}
                />
              </div>
              {form.enable_signup_form && (
                <>
                  <div>
                    <Label>Signup Form Note (optional)</Label>
                    <Input value={form.signup_form_note} onChange={e => setForm({ ...form, signup_form_note: e.target.value })} placeholder="e.g. Please sign up by Friday!" />
                  </div>
                  <div>
                    <Label>Notify Email (optional)</Label>
                    <Input type="email" value={form.notify_email} onChange={e => setForm({ ...form, notify_email: e.target.value })} placeholder="Defaults to church admin email" />
                    <p className="text-xs text-muted-foreground mt-1">Receives daily signup digest emails. Church admins are always notified.</p>
                  </div>
                  {editEvent && (
                    <div className="p-3 rounded-lg bg-muted/50 border space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Signup Form Link</p>
                      <p className="text-xs text-foreground/80 break-all">{getSignupLink(editEvent.id)}</p>
                      <Button size="sm" variant="outline" className="gap-2 h-7 text-xs" onClick={() => { navigator.clipboard.writeText(getSignupLink(editEvent.id)); toast.success('Link copied!'); }}>
                        <Copy className="w-3 h-3" /> Copy Link
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>

            <Button className="w-full" onClick={() => saveMutation.mutate({ ...form, capacity: parseInt(form.capacity) || 0 })} disabled={!form.title || !form.date || saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving…' : editEvent ? 'Update Event' : 'Create Event'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}