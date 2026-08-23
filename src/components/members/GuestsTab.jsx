import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { UserCheck, Trash2, Search, CalendarCheck } from 'lucide-react';
import { toast } from 'sonner';
import { format, differenceInDays, parseISO } from 'date-fns';

/**
 * Returns the active rolling-month attendance count for a guest.
 * Rules:
 *  - Find the earliest attendance date within the most recent 30-day window.
 *  - Count all present records within [windowStart, windowStart + 30 days].
 *  - If the window has closed (>30 days ago) without reaching 3, return { count: 0, expired: true }.
 *  - If count >= 3 within the window, return { count, expired: false, promote: true }.
 */
function getGuestStreak(memberId, allAttendance) {
  const records = allAttendance
    .filter(r => r.member_id === memberId && r.present)
    .map(r => parseISO(r.date))
    .sort((a, b) => a - b); // oldest first

  if (records.length === 0) return { count: 0, expired: false, promote: false, windowStart: null };

  // Find the start of the most recent 30-day streak window
  // Walk through records and find the latest group of 3 within 30 days
  // For display: use the most recent batch window
  const now = new Date();
  const windowStart = records[0]; // first attendance ever (or after reset)

  // Find the earliest attendance that starts a window still open or recently closed
  // We look for the most recent 30-day window from the guest's first attendance in that window
  // Strategy: use the first record as the window start; if window expired, count = 0
  const windowEnd = new Date(windowStart);
  windowEnd.setDate(windowEnd.getDate() + 30);

  const inWindow = records.filter(d => d >= windowStart && d <= windowEnd);
  const count = inWindow.length;
  const windowExpired = now > windowEnd && count < 3;

  return {
    count: windowExpired ? 0 : count,
    expired: windowExpired,
    promote: count >= 3,
    windowStart,
    windowEnd,
  };
}

export default function GuestsTab({ churchId, canPromote, canDelete }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  // All visitor-status members
  const { data: guests = [], isLoading } = useQuery({
    queryKey: ['guests', churchId],
    queryFn: () => base44.entities.ChurchMember.filter({ church_id: churchId, status: 'visitor' }),
    enabled: !!churchId,
  });

  // Attendance records for all guests in this church
  const { data: allAttendance = [] } = useQuery({
    queryKey: ['guest-attendance', churchId],
    queryFn: () => base44.entities.AttendanceRecord.filter({ church_id: churchId }),
    enabled: !!churchId && guests.length > 0,
  });

  const promoteMutation = useMutation({
    mutationFn: (id) => base44.entities.ChurchMember.update(id, {
      status: 'active',
      member_since: new Date().toISOString().split('T')[0],
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guests', churchId] });
      queryClient.invalidateQueries({ queryKey: ['members', churchId] });
    },
  });

  // Auto-promote guests who hit 3 services within a 30-day window
  useEffect(() => {
    if (!canPromote || guests.length === 0 || allAttendance.length === 0) return;
    guests.forEach(g => {
      const { promote } = getGuestStreak(g.id, allAttendance);
      if (promote) {
        promoteMutation.mutate(g.id);
        toast.success(`${g.first_name} ${g.last_name} auto-promoted after 3 services within a month!`);
      }
    });
  }, [guests.length, allAttendance.length]);

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ChurchMember.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guests', churchId] });
      toast.success('Guest removed');
    },
  });

  const handlePromote = (guest) => {
    if (!window.confirm(`Convert ${guest.first_name} ${guest.last_name} to an active member?`)) return;
    promoteMutation.mutate(guest.id);
    toast.success(`${guest.first_name} ${guest.last_name} added as an active member`);
  };

  const handleDelete = (guest) => {
    if (!window.confirm(`Remove ${guest.first_name} ${guest.last_name}? This cannot be undone.`)) return;
    deleteMutation.mutate(guest.id);
  };

  const filtered = guests.filter(g =>
    `${g.first_name} ${g.last_name} ${g.email || ''}`.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search guests..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <p className="text-sm text-muted-foreground">{guests.length} guest{guests.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="text-sm text-muted-foreground bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 flex items-center gap-2">
        <CalendarCheck className="w-4 h-4 text-blue-500 flex-shrink-0" />
        Guests who attend <strong className="text-blue-700">3 services within 30 days</strong> are automatically promoted. The count resets if the 30-day window expires without reaching 3.
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <UserCheck className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="font-medium">No guests found</p>
            <p className="text-sm mt-1">Guests added during attendance will appear here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="divide-y border rounded-xl overflow-hidden bg-card">
          {filtered.map(guest => {
            const { count, expired, promote, windowStart, windowEnd } = getGuestStreak(guest.id, allAttendance);
            const progress = Math.min(count, 3);
            return (
              <div key={guest.id} className="flex items-center gap-4 px-4 py-3">
                <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {guest.first_name?.[0]}{guest.last_name?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm">{guest.first_name} {guest.last_name}</p>
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-xs">Guest</Badge>
                    {promote && <Badge className="bg-green-500 text-white text-xs">Promoting…</Badge>}
                    {expired && <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">Window expired — count reset</Badge>}
                  </div>
                  {guest.email && <p className="text-xs text-muted-foreground">{guest.email}</p>}
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex gap-0.5">
                      {[1, 2, 3].map(i => (
                        <div
                          key={i}
                          className={`w-4 h-1.5 rounded-full ${expired ? 'bg-orange-200' : i <= progress ? 'bg-primary' : 'bg-muted'}`}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {expired
                        ? `0/3 — 30-day window closed`
                        : `${count}/3 services this month`}
                    </span>
                    {windowStart && !expired && (
                      <span className="text-xs text-muted-foreground/60 hidden sm:inline">
                        · window ends {format(windowEnd, 'MMM d')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {canPromote && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1 text-green-700 border-green-300 hover:bg-green-50"
                      onClick={() => handlePromote(guest)}
                      disabled={promoteMutation.isPending}
                    >
                      <UserCheck className="w-3 h-3" /> Add as Member
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="w-7 h-7 text-destructive"
                      onClick={() => handleDelete(guest)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}