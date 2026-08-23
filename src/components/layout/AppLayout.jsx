import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import { Button } from '@/components/ui/button';
import { Menu, ChevronLeft } from 'lucide-react';
import useAppUser from '@/hooks/useAppUser';
import TrialExpired from '@/components/TrialExpired';
import WelcomeDialog from '@/components/onboarding/WelcomeDialog';
import TourDialog from '@/components/onboarding/TourDialog';
import PastoralMessagesWidget from '@/components/pastoral/PastoralMessagesWidget';
import UserMenu from './UserMenu';
import { base44 } from '@/api/base44Client';
import { differenceInDays, addDays, parseISO } from 'date-fns';

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [trialExpired, setTrialExpired] = useState(false);
  const [churchData, setChurchData] = useState(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const { user, loading, isGlobalAdmin, myChurches, switchChurch } = useAppUser();
  const location = useLocation();
  const navigate = useNavigate();
  const isRootDashboard = location.pathname === '/';

  useEffect(() => {
    if (!user?.id || loading) return;
    const welcomed = localStorage.getItem(`ss_welcomed_${user.id}`);
    const tourDisabled = localStorage.getItem(`ss_tour_disabled_${user.id}`);
    if (!welcomed) {
      setShowWelcome(true);
    } else if (!tourDisabled) {
      setShowTour(true);
    }
  }, [user?.id, loading]);

  useEffect(() => {
    if (!user || isGlobalAdmin) return;
    const churchId = user.church_id;
    if (!churchId) return;

    base44.entities.Church.filter({ id: churchId }).then(results => {
      const church = results[0];
      if (!church) return;
      setChurchData(church);
      if (church.status !== 'trial' || !church.trial_start_date) return;
      const start = parseISO(church.trial_start_date);
      const days = church.trial_days || 3;
      const expiry = addDays(start, days);
      const remaining = differenceInDays(expiry, new Date());
      if (remaining < 0) setTrialExpired(true);
    });
  }, [user, isGlobalAdmin]);

  const handleWelcomeClose = () => {
    setShowWelcome(false);
    if (user?.id) {
      localStorage.setItem(`ss_welcomed_${user.id}`, 'true');
    }
    const tourDisabled = localStorage.getItem(`ss_tour_disabled_${user.id}`);
    if (!tourDisabled) {
      setShowTour(true);
    }
  };

  if (trialExpired) return <TrialExpired />;

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar user={user} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} myChurches={myChurches} switchChurch={switchChurch} livestreamEnabled={isGlobalAdmin || !!churchData?.livestream_enabled} churchTier={churchData?.subscription_tier || 'free'} />

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-card border-b border-border px-4 py-3 flex items-center gap-3"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
        {isRootDashboard ? (
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>
        ) : (
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
        )}
        <img src="https://media.base44.com/images/public/69f3e8b4f71d75bce21820e3/b353f16b7_ShepherdSyncsAppLogo.png" alt="ShepherdSyncs" className="w-7 h-7 object-contain" />
        <h1 className="font-serif text-lg font-semibold">ShepherdSyncs</h1>
        <div className="ml-auto">
          <UserMenu user={user} />
        </div>
      </div>

      {/* Desktop header */}
      <header className="hidden lg:flex fixed top-0 right-0 z-30 h-14 items-center justify-end px-6 border-b border-border bg-card/80 backdrop-blur" style={{ left: '16rem' }}>
        <UserMenu user={user} />
      </header>

      {/* Main content */}
      <main className="lg:ml-64 min-h-screen pt-14 lg:pt-14 flex flex-col">
        <div className="flex-1 p-4 md:p-6 lg:p-8 pb-4 lg:pb-6">
          <Outlet />
        </div>
        <footer className="lg:block text-center text-xs text-muted-foreground py-4 px-6 border-t border-border hidden">
          © 2026 ShepherdSyncs. ShepherdSyncs™ is a trademark of ShepherdSyncs.
        </footer>
      </main>

      <MobileNav />

      <PastoralMessagesWidget />

      <WelcomeDialog
        open={showWelcome}
        onOpen={setShowWelcome}
        churchName={user?.church_name || churchData?.name}
        onClose={handleWelcomeClose}
      />
      <TourDialog
        open={showTour}
        onOpen={setShowTour}
        user={user}
        churchName={user?.church_name || churchData?.name}
        livestreamEnabled={isGlobalAdmin || !!churchData?.livestream_enabled}
      />
    </div>
  );
}