import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  LayoutDashboard, Users, CalendarCheck, HandCoins, Droplets, BookOpen,
  Heart, CalendarDays, Mic, BookMarked, UsersRound, MessageSquare,
  BarChart2, Settings, Radio, ClipboardList, Sparkles, CalendarRange,
  ChevronRight, ChevronLeft, Mail, CreditCard, X
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Mirrors the Sidebar's navItems — staff+ navigation. `path` is the real route
// the tour navigates to for that step, so the person sees the actual page.
const STAFF_TOUR_STEPS = [
  { key: 'dashboard', path: '/', title: 'Dashboard', icon: LayoutDashboard, minRole: 'attendance_tracker', description: "Get a bird's-eye view of your church — attendance trends, giving summaries, upcoming events, and recent activity all in one place." },
  { key: 'members', path: '/members', title: 'Members', icon: Users, minRole: 'church_staff', permission: 'manage_members', description: "Manage your church members — add, edit, and view full member profiles, family groups, the member directory, and contact information." },
  { key: 'attendance', path: '/attendance', title: 'Attendance', icon: CalendarCheck, minRole: 'attendance_tracker', description: "Track who's here! Take attendance by service, monitor trends, and automatically flag members who've been absent." },
  { key: 'giving', path: '/giving', title: 'Giving', icon: HandCoins, minRole: 'church_staff', permission: 'view_giving', description: "Record tithes and offerings, view giving history, and generate reports for your church's financial records." },
  { key: 'spiritual', path: '/spiritual', title: 'Spiritual Records', icon: Droplets, minRole: 'church_staff', permission: 'view_spiritual', description: "Track baptisms, salvation decisions, and Holy Ghost milestones — keep a permanent record of each member's spiritual journey." },
  { key: 'bible-study', path: '/bible-study', title: 'Bible Study', icon: BookOpen, minRole: 'attendance_tracker', permission: 'access_bible_study', description: "Plan and document Bible study sessions, create and share study guides, and chat with an AI companion that uses your church's study history for personalized reflections." },
  { key: 'prayer', path: '/prayer', title: 'Prayer Requests', icon: Heart, minRole: 'attendance_tracker', description: "Receive and manage prayer requests from your congregation — categorize, add staff notes, and mark answered prayers." },
  { key: 'events', path: '/events', title: 'Events', icon: CalendarDays, minRole: 'attendance_tracker', description: "Create and publish church events with RSVP tracking, signup forms, and automatic reminders." },
  { key: 'sermons', path: '/sermons', title: 'Sermon Archive', icon: Mic, minRole: 'attendance_tracker', description: "Build a searchable library of past sermons — upload audio/video, add notes, and let members revisit messages anytime. Church admins can also manage live streaming from the Live Stream tab here." },
  { key: 'ministry', path: '/ministry', title: 'Ministry Groups', icon: UsersRound, minRole: 'attendance_tracker', description: "Organize ministry teams — assign leaders, schedule volunteers, take group attendance, and send announcements." },
  { key: 'chat', path: '/chat', title: 'Communication', icon: MessageSquare, minRole: 'attendance_tracker', permission: 'access_church_chat', description: "Stay connected — chat with your church family in general channels or ministry group conversations. Church admins can also send bulk SMS messages to the congregation." },
  { key: 'contact-pastoral', path: '/contact-pastoral', title: 'Contact Pastoral Team', icon: Mail, minRole: 'attendance_tracker', description: "Send a private message to your church's pastoral team — always available, even without chat access." },
  { key: 'follow-up', path: '/follow-up', title: 'Follow-Up Tasks', icon: ClipboardList, minRole: 'church_admin', description: "Never miss a visitor — track follow-up tasks, assign them to staff, and monitor completion. Found under Admin Features in the sidebar." },
  { key: 'livestream', path: '/livestream', title: 'Live Stream', icon: Radio, minRole: 'church_admin', requiresLivestream: true, description: "Broadcast your services live — manage stream keys, simulcast to YouTube and Facebook, and archive recordings. Find it under the Live Stream tab in Sermon Archive." },
  { key: 'analytics', path: '/analytics', title: 'Analytics', icon: BarChart2, minRole: 'church_admin', permission: 'view_analytics', description: "Deep-dive into your church data — attendance trends, giving analytics, member growth, and more. Found under Admin Features in the sidebar." },
  { key: 'pricing', path: '/pricing', title: 'Pricing & Plan', icon: CreditCard, minRole: 'church_admin', description: "Manage your subscription tier, view plan features, and upgrade or downgrade your plan. Found under Admin Features in the sidebar." },
  { key: 'settings', path: '/settings', title: 'Settings', icon: Settings, minRole: 'church_admin', description: "Manage your church profile, invite users, configure roles, set up mass texting, and customize your platform." },
];

// Mirrors the Sidebar's userNavItems — regular user navigation
const USER_TOUR_STEPS = [
  { key: 'my', path: '/my', title: 'My Church', icon: LayoutDashboard, description: "Your personal church hub — view your attendance, giving history, upcoming events, and prayer requests all in one place." },
  { key: 'events', path: '/events', title: 'Events', icon: CalendarDays, description: "See upcoming church events, sign up to attend, and add them to your calendar." },
  { key: 'sermons', path: '/sermons', title: 'Sermon Archive', icon: Mic, description: "Browse and revisit past sermons — listen to audio, watch video, and read sermon notes anytime." },
  { key: 'directory', path: '/directory', title: 'Member Directory', icon: BookMarked, description: "Browse your church family — search members and view contact info." },
  { key: 'my-schedule', path: '/my-schedule', title: 'My Schedule', icon: CalendarRange, description: "View your ministry volunteer schedule — see when you're serving, what role you have, and get reminders." },
  { key: 'contact-pastoral', path: '/contact-pastoral', title: 'Contact Pastoral Team', icon: Mail, description: "Send a private message to your church's pastoral team — always available to all members." },
];

const roleHierarchy = {
  global_admin: 4,
  church_admin: 3,
  ministry_staff: 2.5,
  church_staff: 2,
  attendance_tracker: 1,
};

export default function TourDialog({ open, onOpen, user, churchName, livestreamEnabled = false }) {
  const [step, setStep] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const navigate = useNavigate();
  const returnPathRef = useRef(null);

  const isGlobalAdmin = user?.role === 'global_admin' || user?.role === 'admin';
  const isChurchAdmin = user?.role === 'church_admin' || isGlobalAdmin;
  const isRegularUser = user?.role === 'user';
  const userLevel = roleHierarchy[user?.role] || (isGlobalAdmin ? 4 : 0);

  const hasPermission = (perm) => {
    if (isGlobalAdmin || isChurchAdmin) return true;
    return (user?.extra_permissions || []).includes(perm);
  };

  const tourSteps = useMemo(() => {
    const steps = [{
      title: 'Welcome to the Tour!',
      icon: Sparkles,
      description: `Let's take a walk through ShepherdSyncs${churchName ? ` at ${churchName}` : ''}. We'll take you to each page you have access to and explain what it does as we go — click "Next" whenever you're ready to move on.`,
    }];

    if (isRegularUser) {
      // Regular user: show user nav items + any extra-permission staff items
      USER_TOUR_STEPS.forEach(s => steps.push(s));
      STAFF_TOUR_STEPS.forEach(item => {
        if (!item.permission) return;
        if (item.requiresLivestream && !livestreamEnabled) return;
        if (userLevel < (roleHierarchy[item.minRole] || 0) && hasPermission(item.permission)) {
          steps.push(item);
        }
      });
    } else {
      // Staff+: mirror Sidebar's filteredNav logic exactly
      STAFF_TOUR_STEPS.forEach(item => {
        if (item.requiresLivestream && !livestreamEnabled) return;
        if (userLevel >= (roleHierarchy[item.minRole] || 0)) { steps.push(item); return; }
        if (item.permission && hasPermission(item.permission)) { steps.push(item); return; }
      });
    }

    return steps;
  }, [user, churchName, livestreamEnabled, isGlobalAdmin, isChurchAdmin, isRegularUser, userLevel]);

  // Remember where the person was before the tour started, so we can send them back.
  useEffect(() => {
    if (open && returnPathRef.current === null) {
      returnPathRef.current = window.location.pathname;
    }
    if (!open) {
      returnPathRef.current = null;
    }
  }, [open]);

  // Navigate to each step's real page as the tour advances.
  useEffect(() => {
    if (!open) return;
    const currentStep = tourSteps[step];
    if (currentStep?.path) {
      navigate(currentStep.path);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step]);

  const handleClose = () => {
    if (dontShowAgain && user?.id) {
      localStorage.setItem(`ss_tour_disabled_${user.id}`, 'true');
    }
    if (returnPathRef.current) {
      navigate(returnPathRef.current);
    }
    setStep(0);
    setDontShowAgain(false);
    onOpen(false);
  };

  const handleNext = () => {
    if (step < tourSteps.length - 1) {
      setStep(step + 1);
    } else {
      handleClose();
    }
  };

  const handlePrev = () => {
    if (step > 0) setStep(step - 1);
  };

  if (!open || tourSteps.length <= 1) return null;

  const currentStep = tourSteps[step];
  const isLastStep = step === tourSteps.length - 1;
  const isWelcomeStep = step === 0;
  const Icon = currentStep.icon;

  return (
    <>
      {/* Light scrim so the real page is still visible and legible underneath */}
      <div className="fixed inset-0 z-[90] bg-black/10 pointer-events-none" />

      <div
        className={cn(
          'fixed z-[100] w-[calc(100%-2rem)] sm:w-96 bg-card border border-border rounded-2xl shadow-2xl',
          'bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6'
        )}
      >
        <button
          onClick={handleClose}
          className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close tour"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-5">
          <div className="flex items-center gap-3 pr-6">
            <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-lg font-serif font-semibold leading-tight">{currentStep.title}</h3>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed mt-3">
            {currentStep.description}
          </p>

          {!isWelcomeStep && (
            <p className="text-xs text-primary/80 mt-2 flex items-center gap-1">
              You're looking at this page right now — take a look around before continuing.
            </p>
          )}

          {/* Progress dots */}
          <div className="flex items-center gap-1.5 py-3">
            {tourSteps.map((_, i) => (
              <div
                key={i}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  i === step ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/30'
                )}
              />
            ))}
          </div>

          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={dontShowAgain} onCheckedChange={setDontShowAgain} />
              <span className="text-xs text-muted-foreground">Don't show again</span>
            </label>
            <div className="flex gap-2">
              {step > 0 && (
                <Button variant="outline" size="sm" onClick={handlePrev} className="gap-1">
                  <ChevronLeft className="w-4 h-4" /> Back
                </Button>
              )}
              <Button size="sm" onClick={handleNext} className="gap-1">
                {isLastStep ? 'Finish' : 'Next'}
                {!isLastStep && <ChevronRight className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
