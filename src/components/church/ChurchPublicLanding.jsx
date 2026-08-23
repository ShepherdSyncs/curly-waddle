import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import HLSPlayer from '@/components/HLSPlayer';
import {
  MapPin, Phone, Mail, Radio, CalendarDays, Heart, CheckCircle2,
  Clock, Play, Cross, HandCoins, ChevronDown, Menu, X, User, LogOut
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import VisitorChatWidget from '@/components/chat/VisitorChatWidget';

const QUICK_AMOUNTS = [25, 50, 100, 250, 500];
const GIVING_TYPES = [
  { value: 'tithe', label: 'Tithe' },
  { value: 'offering', label: 'General Offering' },
  { value: 'missions', label: 'Missions' },
  { value: 'building_fund', label: 'Building Fund' },
  { value: 'benevolence', label: 'Benevolence' },
  { value: 'other', label: 'Other' },
];

const API = {
  async call(name, body = {}) {
    const res = await fetch(`/api/functions/v2/prod/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json();
  },
};

function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-500 text-white animate-pulse">
      <span className="w-2 h-2 rounded-full bg-white" />
      LIVE
    </span>
  );
}

const SECTIONS = [
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'livestream', label: 'Livestream', icon: Radio },
  { id: 'giving', label: 'Giving', icon: HandCoins },
];

const ACCOUNT_SECTION = { id: 'account', label: 'My Account', icon: User };

const ROLE_LABELS = {
  global_admin: 'Global Admin',
  admin: 'Admin',
  church_admin: 'Church Admin',
  ministry_staff: 'Ministry Staff',
  church_staff: 'Church Staff',
  attendance_tracker: 'Attendance Tracker',
  user: 'Member',
};

const STAFF_ROLES = new Set(['global_admin', 'admin', 'church_admin', 'ministry_staff', 'church_staff', 'attendance_tracker']);

export default function ChurchPublicLanding({ church, user }) {
  const [activeSection, setActiveSection] = useState('calendar');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [givingSubmitted, setGivingSubmitted] = useState(false);
  const [givingSubmitting, setGivingSubmitting] = useState(false);
  const [givingForm, setGivingForm] = useState({ name: '', email: '', amount: '', type: 'offering', notes: '' });
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [streams, setStreams] = useState([]);
  const [selectedStreamId, setSelectedStreamId] = useState(null);
  const [events, setEvents] = useState([]);
  const [streamsLoading, setStreamsLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [myGiving, setMyGiving] = useState([]);
  const [myAttendance, setMyAttendance] = useState([]);
  const [myScheduleGroups, setMyScheduleGroups] = useState([]);
  const [myUpcomingAssignments, setMyUpcomingAssignments] = useState([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);

  const fetchStreams = useCallback(async () => {
    try {
      const data = await API.call('getChurchStreams', { churchId: church.id });
      setStreams(Array.isArray(data) ? data : []);
    } catch {}
    setStreamsLoading(false);
  }, [church.id]);

  const fetchEvents = useCallback(async () => {
    try {
      const data = await API.call('getChurchEvents', { churchId: church.id });
      setEvents(Array.isArray(data) ? data : []);
    } catch {}
    setEventsLoading(false);
  }, [church.id]);

  useEffect(() => {
    fetchStreams();
    fetchEvents();
  }, [fetchStreams, fetchEvents]);

  // Signed-in members land straight on their dashboard
  useEffect(() => {
    if (user) setActiveSection('account');
  }, [user]);

  const loadDashboard = useCallback(async () => {
    if (!user?.email || !church?.id) return;
    setDashboardLoading(true);
    try {
      const [givingResult, attendance, groups, memberships, schedules, myMemberRecords] = await Promise.all([
        base44.functions.invoke('getMyGivingRecords', {}),
        base44.entities.AttendanceRecord.filter({ church_id: church.id }, '-date', 200),
        base44.entities.MinistryGroup.filter({ church_id: church.id, is_active: true }),
        base44.entities.MinistryGroupMember.filter({ church_id: church.id, member_email: user.email }),
        base44.entities.MinistrySchedule.filter({ church_id: church.id }, 'date', 300),
        base44.entities.ChurchMember.filter({ church_id: church.id, email: user.email }),
      ]);

      setMyGiving(givingResult?.data?.records || []);
      const myMemberIds = new Set((myMemberRecords || []).map(m => m.id));
      setMyAttendance((attendance || []).filter(a => myMemberIds.has(a.member_id) || a.created_by === user.email));

      const myGroupIds = new Set((memberships || []).map(m => m.group_id));
      setMyScheduleGroups((groups || []).filter(g => myGroupIds.has(g.id)));

      const today = format(new Date(), 'yyyy-MM-dd');
      const mySchedules = (schedules || []).filter(s =>
        myGroupIds.has(s.group_id) &&
        (s.assignees || []).some(a => a.member_email === user.email || a.member_name === user.full_name)
      );
      setMyUpcomingAssignments(mySchedules.filter(s => s.date >= today));
    } catch (err) {
      console.error('Dashboard load failed:', err);
    }
    setDashboardLoading(false);
  }, [user?.email, user?.full_name, church?.id]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const interval = setInterval(fetchStreams, 30000);
    return () => clearInterval(interval);
  }, [fetchStreams]);

  const liveStream = streams.find(s => s.status === 'live');
  const pastStreams = streams.filter(s => s.status !== 'live');
  const selectedStream = streams.find(s => s.id === selectedStreamId);
  const activeStream = selectedStream || liveStream || pastStreams[0];
  const upcomingEvents = events.filter(e => {
    if (!e.date) return false;
    const eventDate = parseISO(typeof e.date === 'string' ? e.date : e.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return eventDate >= today;
  });

  const handleGivingSubmit = async (e) => {
    e.preventDefault();
    if (!givingForm.amount || parseFloat(givingForm.amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    setGivingSubmitting(true);
    try {
      await API.call('recordPublicGiving', {
        churchId: church.id,
        memberName: givingForm.name || 'Anonymous',
        email: givingForm.email,
        amount: givingForm.amount,
        type: givingForm.type,
        notes: givingForm.notes,
      });
      setGivingSubmitted(true);
    } catch {
      toast.error('Something went wrong. Please try again.');
    }
    setGivingSubmitting(false);
  };

  // Filter sections based on what's available; add the account tab for signed-in members
  const visibleSections = [
    ...(user ? [ACCOUNT_SECTION] : []),
    ...SECTIONS.filter(s => {
      if (s.id === 'livestream' && !church.livestream_enabled) return false;
      return true;
    }),
  ];

  const renderCalendar = () => (
    <div className="space-y-4">
      {eventsLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      ) : upcomingEvents.length > 0 ? (
        <>
          <div className="space-y-3">
            {(showAllEvents ? upcomingEvents : upcomingEvents.slice(0, 5)).map(event => (
              <Card key={event.id} className="border-white/10 bg-white/5 hover:bg-white/[0.07] transition-colors">
                <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-primary/10 flex flex-col items-center justify-center text-center">
                    <span className="text-xs text-primary font-semibold uppercase">
                      {format(parseISO(event.date), 'MMM')}
                    </span>
                    <span className="text-xl font-bold text-white">
                      {format(parseISO(event.date), 'd')}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <h3 className="font-semibold text-white">{event.title}</h3>
                    {event.description && (
                      <p className="text-sm text-white/50 line-clamp-2">{event.description}</p>
                    )}
                    <div className="flex flex-wrap gap-3 text-xs text-white/40">
                      {event.time && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {event.time}{event.end_time ? ` – ${event.end_time}` : ''}
                        </span>
                      )}
                      {event.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {event.location}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <Badge variant="outline" className="border-white/20 text-white/60 capitalize">
                      {event.category?.replace(/_/g, ' ') || 'Event'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          {upcomingEvents.length > 5 && !showAllEvents && (
            <button
              onClick={() => setShowAllEvents(true)}
              className="w-full py-3 text-sm text-primary hover:text-primary/80 flex items-center justify-center gap-1.5 transition-colors"
            >
              View all {upcomingEvents.length} events <ChevronDown className="w-4 h-4" />
            </button>
          )}
        </>
      ) : (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
            <CalendarDays className="w-8 h-8 text-white/20" />
          </div>
          <p className="text-white/40 text-lg">No upcoming events</p>
          <p className="text-white/25 text-sm mt-1">Check back soon for new events</p>
        </div>
      )}
    </div>
  );

  const renderLivestream = () => (
    <div className="space-y-6">
      {streamsLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      ) : activeStream ? (
        <Card className="border-white/10 bg-white/5 overflow-hidden">
          <CardContent className="p-0">
            <div className="relative w-full bg-black" style={{ aspectRatio: '16/9' }}>
              {activeStream.playback_url ? (
                <HLSPlayer
                  src={activeStream.playback_url}
                  autoPlay={activeStream.status === 'live' || !!selectedStreamId}
                  poster={activeStream.thumbnail_url}
                  className="absolute inset-0 w-full h-full"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white/30">
                  <Radio className="w-12 h-12 mb-3 animate-pulse" />
                  <p className="text-sm">
                    {activeStream.status === 'live' ? 'Live stream starting soon...' : 'No playback URL available'}
                  </p>
                </div>
              )}
              {activeStream.status === 'live' && (
                <div className="absolute top-4 left-4">
                  <LiveBadge />
                </div>
              )}
            </div>
            <div className="p-4">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{activeStream.title}</h3>
                {activeStream.status === 'live' && <LiveBadge />}
              </div>
              {activeStream.description && (
                <p className="text-sm text-white/60 mt-1">{activeStream.description}</p>
              )}
              {activeStream.started_at && (
                <p className="text-xs text-white/40 mt-1.5">
                  {format(new Date(activeStream.started_at), 'MMM d, yyyy')}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
            <Radio className="w-8 h-8 text-white/20" />
          </div>
          <p className="text-white/40 text-lg">No streams available</p>
          <p className="text-white/25 text-sm mt-1">Check back during service times</p>
        </div>
      )}

      {pastStreams.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-wider text-white/30">
            {liveStream ? 'Past Services' : 'All Services'}
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {pastStreams.map(stream => {
              const isActive = activeStream?.id === stream.id;
              return (
                <button
                  key={stream.id}
                  onClick={() => setSelectedStreamId(stream.id)}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                    isActive
                      ? 'border-primary bg-primary/10'
                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className="w-16 h-10 rounded-lg bg-slate-800 flex-shrink-0 flex items-center justify-center overflow-hidden">
                    {stream.thumbnail_url
                      ? <img src={stream.thumbnail_url} alt="" className="w-full h-full object-cover" />
                      : <Play className="w-4 h-4 text-white/30" />
                    }
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{stream.title}</p>
                    {stream.started_at && (
                      <p className="text-xs text-white/40">{format(new Date(stream.started_at), 'MMM d, yyyy')}</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  const PLATFORM_LABELS = {
    planning_center: 'Planning Center',
    elvanto: 'Elvanto',
    elexio: 'Elexio',
    churchcenter: 'Church Center',
    pushpay: 'PushPay',
    tithely: 'Tithe.ly',
    paypal: 'PayPal',
    venmo: 'Venmo',
    cash_app: 'Cash App',
    custom: 'Give Online',
  };

  const renderGiving = () => (
    <Card className="border-white/10 bg-white/5">
      <CardContent className="p-6 sm:p-8">
        {!church.online_giving_url ? (
          <div className="max-w-md mx-auto text-center space-y-3">
            <Heart className="w-10 h-10 text-primary/60 mx-auto" />
            <p className="text-sm text-white/70 leading-relaxed">
              Thank you for supporting the ministry! To give electronically, simply scan the QR code on the announcement screen during one of our in-person services. You can also give cash or check during any service.
            </p>
          </div>
        ) : (
          <div className="max-w-md mx-auto text-center space-y-4">
            <p className="text-sm text-white/70">Give electronically via {church.name}'s giving platform</p>
            <a
              href={church.online_giving_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors"
            >
              <Heart className="w-4 h-4" />
              Give on {PLATFORM_LABELS[church.online_giving_platform] || 'External Platform'}
            </a>
            <p className="text-xs text-white/30">Opens {PLATFORM_LABELS[church.online_giving_platform] || 'external site'} — secure payment</p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderAccount = () => {
    const totalGiven = myGiving.reduce((s, g) => s + (g.amount || 0), 0);
    const presentCount = myAttendance.filter(a => a.present).length;

    return (
      <div className="space-y-6">
        {/* Profile summary */}
        <Card className="border-white/10 bg-white/5">
          <CardContent className="p-6 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center flex-shrink-0">
                <User className="w-7 h-7 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-lg text-white">{user?.full_name || user?.email}</p>
                <p className="text-sm text-white/50">{user?.email}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="outline" className="border-primary/40 text-primary">
                    {ROLE_LABELS[user?.role] || user?.role || 'Member'}
                  </Badge>
                  {(user?.extra_permissions || []).map(p => (
                    <Badge key={p} variant="outline" className="border-white/20 text-white/60 capitalize">
                      {p.replace(/_/g, ' ')}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-white/20 text-white/70 hover:text-white bg-transparent hover:bg-white/5"
              onClick={() => base44.auth.logout(window.location.href)}
            >
              <LogOut className="w-4 h-4" /> Log Out
            </Button>
          </CardContent>
        </Card>

        {/* Church info */}
        <Card className="border-white/10 bg-white/5">
          <CardContent className="p-6 space-y-3">
            <p className="text-xs uppercase tracking-wider text-white/30">Church Info</p>
            <div className="flex items-center gap-3">
              {church.logo_url ? (
                <img src={church.logo_url} alt={church.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Cross className="w-5 h-5 text-primary" />
                </div>
              )}
              <div>
                <p className="font-semibold text-white">{church.name}</p>
                {church.pastor_name && <p className="text-xs text-white/40">Pastor {church.pastor_name}</p>}
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-2 text-sm text-white/60 pt-2 border-t border-white/10">
              {church.address && (
                <span className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-primary/60 flex-shrink-0" />
                  {church.address}{church.city ? `, ${church.city}` : ''}{church.state ? `, ${church.state}` : ''}
                </span>
              )}
              {church.phone && (
                <span className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-primary/60 flex-shrink-0" />
                  {church.phone}
                </span>
              )}
              {church.email && (
                <span className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-primary/60 flex-shrink-0" />
                  {church.email}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {dashboardLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid sm:grid-cols-2 gap-4">
              <Card className="border-white/10 bg-white/5">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center">
                    <HandCoins className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-white/40">My Total Giving</p>
                    <p className="text-xl font-bold text-white">${totalGiven.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-white/10 bg-white/5">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-green-500/15 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-xs text-white/40">Services Attended</p>
                    <p className="text-xl font-bold text-white">{presentCount}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Serving schedule */}
            <div>
              <p className="text-xs uppercase tracking-wider text-white/30 mb-3">My Serving Schedule</p>
              {myScheduleGroups.length === 0 ? (
                <p className="text-sm text-white/40">Not assigned to any ministry group yet.</p>
              ) : myUpcomingAssignments.length === 0 ? (
                <p className="text-sm text-white/40">No upcoming serving assignments scheduled.</p>
              ) : (
                <div className="space-y-3">
                  {myUpcomingAssignments.map(s => (
                    <Card key={s.id} className="border-white/10 bg-white/5">
                      <CardContent className="p-4">
                        <p className="font-medium text-white truncate">{s.title}</p>
                        <div className="flex flex-wrap gap-3 text-xs text-white/40 mt-1.5">
                          <span className="flex items-center gap-1">
                            <CalendarDays className="w-3 h-3" />
                            {format(parseISO(s.date), 'MMM d, yyyy')}
                          </span>
                          {s.time && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {s.time}{s.end_time ? ` – ${s.end_time}` : ''}
                            </span>
                          )}
                          {s.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {s.location}
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Recent giving */}
            <div>
              <p className="text-xs uppercase tracking-wider text-white/30 mb-3">Recent Giving</p>
              {myGiving.length === 0 ? (
                <p className="text-sm text-white/40">No giving records found for your account.</p>
              ) : (
                <div className="space-y-2">
                  {myGiving.slice(0, 5).map(g => (
                    <Card key={g.id} className="border-white/10 bg-white/5">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <p className="text-sm text-white">{format(new Date(g.date), 'MMM d, yyyy')}</p>
                          <p className="text-xs text-white/40 capitalize">{g.type?.replace(/_/g, ' ')}</p>
                        </div>
                        <p className="font-semibold text-white">${g.amount?.toFixed(2)}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Recent attendance */}
            <div>
              <p className="text-xs uppercase tracking-wider text-white/30 mb-3">Recent Attendance</p>
              {myAttendance.length === 0 ? (
                <p className="text-sm text-white/40">No attendance records found.</p>
              ) : (
                <div className="space-y-2">
                  {myAttendance.slice(0, 5).map(a => (
                    <Card key={a.id} className="border-white/10 bg-white/5">
                      <CardContent className="p-4 flex items-center justify-between">
                        <p className="text-sm text-white">{format(new Date(a.date), 'MMM d, yyyy')}</p>
                        <Badge variant="outline" className={a.present ? 'border-green-500/40 text-green-400' : 'border-white/20 text-white/50'}>
                          {a.present ? 'Present' : 'Absent'}
                        </Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  };

  const sectionContent = {
    calendar: renderCalendar,
    livestream: renderLivestream,
    giving: renderGiving,
    account: renderAccount,
  };

  const firstName = (user?.full_name || user?.email || '').trim().split(/\s+/)[0];

  const handleLogoClick = () => {
    if (!user) return;
    if (STAFF_ROLES.has(user.role)) {
      // Staff/admin roles manage the church from the full admin dashboard
      window.location.href = 'https://shepherdsyncs.com/';
    } else {
      setActiveSection('account');
      setSidebarOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-white flex flex-col">
      {/* Top bar with welcome message */}
      <header className="border-b border-white/10 bg-slate-950/90 backdrop-blur-sm sticky top-0 z-20">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {user ? (
              <button
                onClick={handleLogoClick}
                className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
              >
                {church.logo_url ? (
                  <img src={church.logo_url} alt={church.name} className="w-8 h-8 rounded-lg object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                    <Cross className="w-4 h-4 text-primary" />
                  </div>
                )}
                <span className="font-serif font-semibold text-sm">{church.name}</span>
              </button>
            ) : (
              <>
                {church.logo_url ? (
                  <img src={church.logo_url} alt={church.name} className="w-8 h-8 rounded-lg object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                    <Cross className="w-4 h-4 text-primary" />
                  </div>
                )}
                <span className="font-serif font-semibold text-sm">{church.name}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors border border-white/20 rounded-lg px-3 py-1.5 hover:border-white/40">
                    <User className="w-3.5 h-3.5" />
                    {firstName}
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => { setActiveSection('account'); setSidebarOpen(false); }}>
                    <User className="w-4 h-4 mr-2" /> Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => base44.auth.logout(window.location.href)}>
                    <LogOut className="w-4 h-4 mr-2" /> Log Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <button
                onClick={() => {
                  const hostname = window.location.hostname;
                  const mainHosts = ['shepherdsyncs.com', 'app.shepherdsyncs.com', 'www.shepherdsyncs.com', 'admin.shepherdsyncs.com', 'localhost'];
                  const isSub = !mainHosts.includes(hostname) && !hostname.endsWith('.base44.app') && !hostname.endsWith('.base44.link');
                  if (isSub && hostname.endsWith('.shepherdsyncs.com')) {
                    // On a subdomain — redirect to main app domain where authenticated routes live
                    window.location.href = `https://shepherdsyncs.com/`;
                  } else {
                    base44.auth.redirectToLogin(`/portal?id=${church.id}&church=${church.subdomain || church.name.toLowerCase().replace(/\s+/g, '-')}`);
                  }
                }}
                className="text-sm text-white/60 hover:text-white transition-colors border border-white/20 rounded-lg px-3 py-1.5 hover:border-white/40"
              >
                Members Login
              </button>
            )}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-white/10"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-white/5">
        <div className="px-4 py-8 sm:py-10">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-bold">
            Welcome to {church.name}
          </h1>
          {church.pastor_name && (
            <p className="text-white/50 text-sm sm:text-base mt-1.5">Pastor {church.pastor_name}</p>
          )}
          <div className="flex flex-wrap gap-3 mt-3 text-xs sm:text-sm text-white/40">
            {church.city && (
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-primary/60" />
                {church.city}{church.state ? `, ${church.state}` : ''}
              </span>
            )}
            {church.phone && (
              <span className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-primary/60" />
                {church.phone}
              </span>
            )}
            {church.email && (
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-primary/60" />
                {church.email}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main layout: sidebar + content */}
      <div className="flex flex-1">
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/60 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar navigation */}
        <aside className={`
          fixed lg:sticky top-[57px] z-40
          w-56 h-[calc(100vh-57px)] 
          border-r border-white/10 bg-slate-950/95 backdrop-blur-sm
          transition-transform duration-200
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          flex-shrink-0
        `}>
          <nav className="p-3 space-y-1">
            {visibleSections.map(section => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => {
                    setActiveSection(section.id);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-primary/15 text-primary shadow-sm shadow-primary/10'
                      : 'text-white/50 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {section.label}
                  {section.id === 'livestream' && liveStream && (
                    <span className="ml-auto">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse block" />
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Contact info in sidebar footer */}
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10">
            <div className="space-y-1.5 text-xs text-white/30">
              {church.address && <p>{church.address}</p>}
              {church.city && <p>{church.city}{church.state ? `, ${church.state}` : ''}</p>}
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">
          <div className="max-w-4xl">
            <h2 className="text-lg font-semibold text-white/80 mb-4">
              {visibleSections.find(s => s.id === activeSection)?.label || 'Calendar'}
            </h2>
            {sectionContent[activeSection]()}
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className="text-center py-4 border-t border-white/10">
        <div className="flex items-center justify-center gap-2 text-xs text-white/25">
          <Cross className="w-3.5 h-3.5" />
          <span>
            Powered by <span className="font-semibold text-white/40">ShepherdSyncs</span>
          </span>
        </div>
      </footer>

      {church.ai_chat_enabled && <VisitorChatWidget church={church} />}
    </div>
  );
}