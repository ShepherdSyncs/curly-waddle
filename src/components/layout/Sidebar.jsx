import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Church,
  Users,
  CalendarCheck,
  HandCoins,
  Droplets,
  BookOpen,
  Settings,
  LogOut,
  X,
  Cross,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  BarChart2,
  Radio,
  Heart,
  CalendarDays,
  Mic,
  BookMarked,
  UsersRound,
  CalendarRange,
  Activity,
  MonitorCheck,
  ClipboardList,
  MessageSquare,
  Sparkles,
  Mail,
  CreditCard,
  CalendarClock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { hasTierFeature } from '@/lib/tiers';

// User-role nav (role === 'user')
const userNavItems = [
  { path: '/my', label: 'My Church', icon: LayoutDashboard },
  { path: '/events', label: 'Events', icon: CalendarDays },
  { path: '/sermons', label: 'Sermon Archive', icon: Mic },
  { path: '/directory', label: 'Member Directory', icon: BookMarked },
  { path: '/schedule', label: 'Schedule', icon: CalendarClock },
  { path: '/contact-pastoral', label: 'Contact Pastoral Team', icon: Mail },
];

// Staff+ nav
const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, minRole: 'attendance_tracker' },
  { path: '/churches', label: 'Churches', icon: Church, minRole: 'global_admin' },
  { path: '/members', label: 'Members', icon: Users, minRole: 'church_staff', permission: 'manage_members' },
  { path: '/attendance', label: 'Attendance', icon: CalendarCheck, minRole: 'attendance_tracker' },
  { path: '/giving', label: 'Giving', icon: HandCoins, minRole: 'church_staff', permission: 'view_giving' },
  { path: '/spiritual', label: 'Spiritual Records', icon: Droplets, minRole: 'church_staff', permission: 'view_spiritual' },
  { path: '/bible-study', label: 'Bible Study', icon: BookOpen, minRole: 'attendance_tracker', permission: 'access_bible_study' },
  { path: '/prayer', label: 'Prayer Requests', icon: Heart, minRole: 'attendance_tracker' },
  { path: '/events', label: 'Events', icon: CalendarDays, minRole: 'attendance_tracker' },
  { path: '/sermons', label: 'Sermon Archive', icon: Mic, minRole: 'attendance_tracker' },
  { path: '/schedule', label: 'Schedule', icon: CalendarClock, minRole: 'attendance_tracker' },
  { path: '/ministry', label: 'Ministry Groups', icon: UsersRound, minRole: 'attendance_tracker' },
  { path: '/chat', label: 'Church Chat', icon: MessageSquare, isCommunication: true },
  { path: '/contact-pastoral', label: 'Contact Pastoral Team', icon: Mail, minRole: 'attendance_tracker' },
  { path: '/settings', label: 'Settings', icon: Settings, minRole: 'church_admin' },
];

const roleHierarchy = {
  global_admin: 4,
  church_admin: 3,
  ministry_staff: 2.5,
  church_staff: 2,
  attendance_tracker: 1,
};

const globalAdminLinks = [
  { path: '/churches', label: 'Manage Churches', icon: Church },
  { path: '/settings', label: 'Settings & Users', icon: Settings },
  { path: '/user-logs', label: 'User Logs', icon: Activity },
];

const adminFeatureLinks = [
  { path: '/follow-up', label: 'Follow-Up Tasks', icon: ClipboardList },
  { path: '/analytics', label: 'Analytics', icon: BarChart2 },
  { path: '/pricing', label: 'Pricing & Plan', icon: CreditCard },
];

export default function Sidebar({ user, mobileOpen, setMobileOpen, myChurches = [], switchChurch, livestreamEnabled = false, churchTier = 'free' }) {
  const location = useLocation();
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [adminFeaturesOpen, setAdminFeaturesOpen] = useState(false);
  const [churchMenuOpen, setChurchMenuOpen] = useState(false);
  const isGlobalAdmin = user?.role === 'global_admin' || user?.role === 'admin';
  const isRegularUser = user?.role === 'user';
  const userLevel = roleHierarchy[user?.role] || (isGlobalAdmin ? 4 : 0);
  const hasExtraPermission = (perm) => {
    if (isGlobalAdmin) return true;
    return (user?.extra_permissions || []).includes(perm);
  };

  // For user role, also show live stream link if church_id exists
  const userExtraLinks = user?.church_id ? [
    { href: `/live?church=${user.church_id}`, label: 'Watch Live', icon: Radio, external: true },
  ] : [];

  const tierHasFeature = (feature) => isGlobalAdmin || hasTierFeature(churchTier, feature);
  const hasChatAccess = tierHasFeature('fullChat') && (userLevel >= roleHierarchy['attendance_tracker'] || hasExtraPermission('access_church_chat'));
  const hasMassTextAccess = tierHasFeature('massTexting') && userLevel >= roleHierarchy['church_admin'];
  const commLabel = hasChatAccess && hasMassTextAccess ? 'Communication' : 'Church Chat';
  const filteredNav = isRegularUser
    ? [
        ...userNavItems,
        ...navItems.filter(item => {
          if (item.isCommunication) return tierHasFeature('fullChat') && hasExtraPermission('access_church_chat');
          return item.permission &&
            hasExtraPermission(item.permission) &&
            userLevel < roleHierarchy[item.minRole] &&
            !(item.path === '/livestream' && !livestreamEnabled) &&
            !(item.requiresTierFeature && !tierHasFeature(item.requiresTierFeature));
        }),
      ]
    : navItems.filter(item => {
        if (item.path === '/livestream' && !livestreamEnabled) return false;
        if (item.isCommunication) return hasChatAccess || hasMassTextAccess;
        if (item.requiresTierFeature && !tierHasFeature(item.requiresTierFeature)) return false;
        if (userLevel >= roleHierarchy[item.minRole]) return true;
        if (item.permission && hasExtraPermission(item.permission)) return true;
        return false;
      });

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={cn(
        "fixed top-0 left-0 z-50 h-full w-64 bg-sidebar text-sidebar-foreground flex flex-col transition-transform duration-300",
        "lg:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo */}
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="https://media.base44.com/images/public/69f3e8b4f71d75bce21820e3/b353f16b7_ShepherdSyncsAppLogo.png" alt="ShepherdSyncs" className="w-10 h-10 object-contain" />
              <div>
                <h1 className="font-serif text-lg font-semibold tracking-tight">ShepherdSyncs</h1>
                <p className="text-xs text-sidebar-foreground/60">Church Management</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-sidebar-foreground"
              onClick={() => setMobileOpen(false)}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Church name / switcher */}
        {user?.church_name && (
          <div className="px-4 py-3 border-b border-sidebar-border">
            {myChurches.length > 1 && isGlobalAdmin ? (
              <div className="relative">
                <p className="text-xs text-sidebar-foreground/50 uppercase tracking-wider mb-1">Church</p>
                <button
                  onClick={() => setChurchMenuOpen(v => !v)}
                  className="w-full flex items-center justify-between gap-2 text-sm font-medium rounded-lg px-2 py-1.5 hover:bg-sidebar-accent/50 transition-colors"
                >
                  <span className="truncate flex-1 text-left">{user.church_name}</span>
                  <ChevronDown className={cn("w-3.5 h-3.5 flex-shrink-0 transition-transform", churchMenuOpen && "rotate-180")} />
                </button>
                {churchMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-[99]" onClick={() => setChurchMenuOpen(false)} />
                    <div className="absolute left-0 right-0 top-full mt-1 z-[100] bg-popover border border-border rounded-lg shadow-xl overflow-hidden">
                      {myChurches.map(church => (
                        <button
                          key={church.id}
                          onClick={() => { switchChurch(church); setChurchMenuOpen(false); }}
                          className={cn(
                            "w-full text-left px-3 py-2.5 text-sm transition-colors flex items-center gap-2",
                            church.id === user.church_id
                              ? "bg-primary/20 text-primary font-semibold"
                              : "hover:bg-muted text-foreground"
                          )}
                        >
                          <Church className="w-3.5 h-3.5 flex-shrink-0 opacity-60" />
                          <span className="truncate">{church.name}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <>
                <p className="text-xs text-sidebar-foreground/50 uppercase tracking-wider">Church</p>
                <p className="text-sm font-medium truncate">{user.church_name}</p>
              </>
            )}
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <div className="space-y-1">
            {filteredNav.map(item => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-primary"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon className="w-4.5 h-4.5 flex-shrink-0" />
                  {item.isCommunication ? commLabel : item.label}
                </Link>
              );
            })}
            {/* Extra links for regular users */}
            {isRegularUser && userExtraLinks.map(item => (
              <a
                key={item.href}
                href={item.href}
                target={item.external ? '_blank' : undefined}
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              >
                <item.icon className="w-4.5 h-4.5 flex-shrink-0 text-red-400" />
                {item.label}
              </a>
            ))}
          </div>

          {/* Admin Features Menu */}
          {!isRegularUser && userLevel >= roleHierarchy['church_admin'] && (
            <div className="mt-4 pt-4 border-t border-sidebar-border">
              <button
                onClick={() => setAdminFeaturesOpen(v => !v)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-primary bg-sidebar-accent/60 hover:bg-sidebar-accent transition-colors"
              >
                <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 text-left">Admin Features</span>
                {adminFeaturesOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              {adminFeaturesOpen && (
                <div className="mt-1 ml-3 space-y-1 border-l-2 border-sidebar-primary/30 pl-3">
                  {adminFeatureLinks.map(item => {
                    const isActive = location.pathname === item.path;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                          isActive
                            ? "bg-sidebar-accent text-sidebar-primary"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                        )}
                      >
                        <item.icon className="w-4 h-4 flex-shrink-0" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Global Admin Menu */}
          {isGlobalAdmin && (
            <div className="mt-4 pt-4 border-t border-sidebar-border">
              <button
                onClick={() => setAdminMenuOpen(v => !v)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-primary bg-sidebar-accent/60 hover:bg-sidebar-accent transition-colors"
              >
                <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 text-left">Global Admin</span>
                {adminMenuOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              {adminMenuOpen && (
                <div className="mt-1 ml-3 space-y-1 border-l-2 border-sidebar-primary/30 pl-3">
                  {globalAdminLinks.map(item => {
                    const isActive = location.pathname === item.path;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                          isActive
                            ? "bg-sidebar-accent text-sidebar-primary"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                        )}
                      >
                        <item.icon className="w-4 h-4 flex-shrink-0" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-semibold">
              {user?.full_name?.[0] || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.full_name || 'User'}</p>
              <p className="text-xs text-sidebar-foreground/50 capitalize">{user?.role?.replace(/_/g, ' ') || 'Member'}</p>
            </div>
          </div>

        </div>
      </aside>
    </>
  );
}