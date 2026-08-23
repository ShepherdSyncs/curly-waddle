import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  LayoutDashboard, Users, CalendarCheck, HandCoins, Droplets, BookOpen,
  Heart, CalendarDays, Mic, BookMarked, UsersRound, MessageSquare,
  BarChart2, Settings, Radio, ClipboardList, Sparkles, CalendarRange, Megaphone,
  ChevronRight, ChevronLeft, Mail, CreditCard
} from 'lucide-react';

// Mirrors the Sidebar's navItems — staff+ navigation
const STAFF_TOUR_STEPS = [
  { key: 'dashboard', title: 'Dashboard', icon: LayoutDashboard, minRole: 'attendance_tracker', description: "Get a bird's-eye view of your church — attendance trends, giving summaries, upcoming events, and recent activity all in one place." },
  { key: 'members', title: 'Members', icon: Users, minRole: 'church_staff', permission: 'manage_members', description: "Manage your church members — add, edit, and view full member profiles, family groups, the member directory, and contact information." },
  { key: 'attendance', title: 'Attendance', icon: CalendarCheck, minRole: 'attendance_tracker', description: "Track who's here! Take attendance by service, monitor trends, and automatically flag members who've been absent." },
  { key: 'giving', title: 'Giving', icon: HandCoins, minRole: 'church_staff', permission: 'view_giving', description: "Record tithes and offerings, view giving history, and generate reports for your church's financial records." },
  { key: 'spiritual', title: 'Spiritual Records', icon: Droplets, minRole: 'church_staff', permission: 'view_spiritual', description: "Track baptisms, salvation decisions, and Holy Ghost milestones — keep a permanent record of each member's spiritual journey." },
  { key: 'bible-study', title: 'Bible Study', icon: BookOpen, minRole: 'attendance_tracker', permission: 'access_bible_study', description: "Plan and document Bible study sessions, create and share study guides, and chat with an AI companion that uses your church's study history for personalized reflections." },
  { key: 'prayer', title: 'Prayer Requests', icon: Heart, minRole: 'attendance_tracker', description: "Receive and manage prayer requests from your congregation — categorize, add staff notes, and mark answered prayers." },
  { key: 'events', title: 'Events', icon: CalendarDays, minRole: 'attendance_tracker', description: "Create and publish church events with RSVP tracking, signup forms, and automatic reminders." },
  { key: 'sermons', title: 'Sermon Archive', icon: Mic, minRole: 'attendance_tracker', description: "Build a searchable library of past sermons — upload audio/video, add notes, and let members revisit messages anytime. Church admins can also manage live streaming from the Live Stream tab here." },
  { key: 'ministry', title: 'Ministry Groups', icon: UsersRound, minRole: 'attendance_tracker', description: "Organize ministry teams — assign leaders, schedule volunteers, take group attendance, and send announcements." },
  { key: 'chat', title: 'Communication', icon: MessageSquare, minRole: 'attendance_tracker', permission: 'access_church_chat', description: "Stay connected — chat with your church family in general channels or ministry group conversations. Church admins can also send bulk SMS messages to the congregation." },
  { key: 'contact-pastoral', title: 'Contact Pastoral Team', icon: Mail, minRole: 'attendance_tracker', description: "Send a private message to your church's pastoral team — always available, even without chat access." },
  { key: 'follow-up', title: 'Follow-Up Tasks', icon: ClipboardList, minRole: 'church_admin', description: "Never miss a visitor — track follow-up tasks, assign them to staff, and monitor completion. Found under Admin Features in the sidebar." },
  { key: 'livestream', title: 'Live Stream', icon: Radio, minRole: 'church_admin', requiresLivestream: true, description: "Broadcast your services live — manage stream keys, simulcast to YouTube and Facebook, and archive recordings. Find it under the Live Stream tab in Sermon Archive." },
  { key: 'analytics', title: 'Analytics', icon: BarChart2, minRole: 'church_admin', permission: 'view_analytics', description: "Deep-dive into your church data — attendance trends, giving analytics, member growth, and more. Found under Admin Features in the sidebar." },
  { key: 'pricing', title: 'Pricing & Plan', icon: CreditCard, minRole: 'church_admin', description: "Manage your subscription tier, view plan features, and upgrade or downgrade your plan. Found under Admin Features in the sidebar." },
  { key: 'settings', title: 'Settings', icon: Settings, minRole: 'church_admin', description: "Manage your church profile, invite users, configure roles, set up mass texting, and customize your platform." },
];

// Mirrors the Sidebar's userNavItems — regular user navigation
const USER_TOUR_STEPS = [
  { key: 'my', title: 'My Church', icon: LayoutDashboard, description: "Your personal church hub — view your attendance, giving history, upcoming events, and prayer requests all in one place." },
  { key: 'events', title: 'Events', icon: CalendarDays, description: "See upcoming church events, sign up to attend, and add them to your calendar." },
  { key: 'sermons', title: 'Sermon Archive', icon: Mic, description: "Browse and revisit past sermons — listen to audio, watch video, and read sermon notes anytime." },
  { key: 'directory', title: 'Member Directory', icon: BookMarked, description: "Browse your church family — search members and view contact info." },
  { key: 'my-schedule', title: 'My Schedule', icon: CalendarRange, description: "View your ministry volunteer schedule — see when you're serving, what role you have, and get reminders." },
  { key: 'contact-pastoral', title: 'Contact Pastoral Team', icon: Mail, description: "Send a private message to your church's pastoral team — always available to all members." },
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
      description: `Let's take a quick tour of ShepherdSyncs${churchName ? ` at ${churchName}` : ''}. We'll show you the key features you have access to based on your role and permissions.`,
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

  const handleClose = () => {
    if (dontShowAgain && user?.id) {
      localStorage.setItem(`ss_tour_disabled_${user.id}`, 'true');
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
  const Icon = currentStep.icon;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            {currentStep.title}
          </DialogTitle>
          <DialogDescription className="text-base pt-3 leading-relaxed">
            {currentStep.description}
          </DialogDescription>
        </DialogHeader>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 py-2">
          {tourSteps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/30'}`}
            />
          ))}
        </div>

        <DialogFooter className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={dontShowAgain}
              onCheckedChange={setDontShowAgain}
            />
            <span className="text-sm text-muted-foreground">
              Don't show this tour again
            </span>
          </label>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" onClick={handlePrev} className="gap-1">
                <ChevronLeft className="w-4 h-4" /> Back
              </Button>
            )}
            <Button onClick={handleNext} className="gap-1">
              {isLastStep ? 'Finish' : 'Next'}
              {!isLastStep && <ChevronRight className="w-4 h-4" />}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}