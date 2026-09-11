import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, HandCoins, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import useAppUser from '@/hooks/useAppUser';

const staffNav = [
{ path: '/', label: 'Dashboard', icon: LayoutDashboard },
{ path: '/members', label: 'Members', icon: Users },
{ path: '/giving', label: 'Giving', icon: HandCoins },
{ path: '/schedule', label: 'Schedule', icon: User },
];

const userNav = [
{ path: '/my', label: 'My Church', icon: LayoutDashboard },
{ path: '/events', label: 'Events', icon: Users },
{ path: '/sermons', label: 'Sermons', icon: HandCoins },
{ path: '/schedule', label: 'Schedule', icon: User },
];

export default function MobileNav() {
 const { user } = useAppUser();
 const isRegularUser = user?.role === 'user';
 const NAV_ITEMS = isRegularUser? userNav: staffNav;
  const location = useLocation();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border flex items-stretch"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
        const isActive = location.pathname === path;
        return (
          <Link
            key={path}
            to={path}
            className={cn(
              'flex-1 flex flex-col items-center justify-center py-2 gap-1 text-[10px] font-medium transition-colors select-none',
              isActive
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className={cn('w-5 h-5', isActive && 'text-primary')} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}