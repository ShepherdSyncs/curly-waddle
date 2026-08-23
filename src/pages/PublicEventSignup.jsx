import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, MapPin, Clock, CheckCircle2, Users } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';

export default function PublicEventSignup() {
  const params = new URLSearchParams(window.location.search);
  const eventId = params.get('event_id');

  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '', email: '', phone: '',
    guest_count: '0', guest_names: '', notes: '',
  });

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['public-event', eventId],
    queryFn: () => base44.entities.ChurchEvent.filter({ id: eventId, is_published: true }),
    enabled: !!eventId,
  });

  const event = events[0];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Please enter your name'); return; }
    setSubmitting(true);
    await base44.entities.EventSignup.create({
      event_id: eventId,
      church_id: event.church_id,
      event_title: event.title,
      event_date: event.date,
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      guest_count: parseInt(form.guest_count) || 0,
      guest_names: form.guest_names.trim(),
      notes: form.notes.trim(),
    });
    setSubmitted(true);
    setSubmitting(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!event || !event.enable_signup_form) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full text-center">
          <CardContent className="py-12 text-muted-foreground">
            <Calendar className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-semibold">Event not found</p>
            <p className="text-sm mt-1">This signup form is not available.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-4">
        {/* Event info header */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xl font-serif">{event.title}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              {format(parseISO(event.date), 'EEEE, MMMM d, yyyy')}
            </div>
            {event.time && (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                {event.time}{event.end_time ? ` – ${event.end_time}` : ''}
              </div>
            )}
            {event.location && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                {event.location}{event.address ? ` — ${event.address}` : ''}
              </div>
            )}
            {event.description && <p className="pt-1">{event.description}</p>}
            {event.signup_form_note && (
              <p className="pt-1 italic text-foreground/70">{event.signup_form_note}</p>
            )}
          </CardContent>
        </Card>

        {/* Signup form */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Sign Up to Attend
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!submitted ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Your Name *</Label>
                  <Input
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="Full name"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Email (optional)</Label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={e => setForm({ ...form, email: e.target.value })}
                      placeholder="your@email.com"
                    />
                  </div>
                  <div>
                    <Label>Phone (optional)</Label>
                    <Input
                      value={form.phone}
                      onChange={e => setForm({ ...form, phone: e.target.value })}
                      placeholder="(555) 000-0000"
                    />
                  </div>
                </div>
                <div>
                  <Label>How many guests are you bringing?</Label>
                  <Input
                    type="number"
                    min="0"
                    max="20"
                    value={form.guest_count}
                    onChange={e => setForm({ ...form, guest_count: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Enter 0 if coming alone</p>
                </div>
                {parseInt(form.guest_count) > 0 && (
                  <div>
                    <Label>Guest Names (optional)</Label>
                    <Textarea
                      value={form.guest_names}
                      onChange={e => setForm({ ...form, guest_names: e.target.value })}
                      placeholder="e.g. Jane Doe, John Smith"
                      rows={2}
                    />
                  </div>
                )}
                <div>
                  <Label>Any notes? (optional)</Label>
                  <Textarea
                    value={form.notes}
                    onChange={e => setForm({ ...form, notes: e.target.value })}
                    placeholder="Dietary needs, accessibility requests, etc."
                    rows={2}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={submitting || !form.name.trim()}>
                  {submitting ? 'Submitting…' : 'Submit Sign Up'}
                </Button>
              </form>
            ) : (
              <div className="py-6 text-center space-y-3">
                <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto" />
                <p className="text-xl font-serif font-bold">You're signed up!</p>
                <p className="text-sm text-muted-foreground">
                  We look forward to seeing you at <strong>{event.title}</strong> on{' '}
                  {format(parseISO(event.date), 'MMMM d, yyyy')}.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}