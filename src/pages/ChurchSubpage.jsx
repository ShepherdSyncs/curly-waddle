import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Church, ArrowLeft, LogIn } from 'lucide-react';

// Lazy-load the actual page components
import AttendancePage from './Attendance';
import EventsPage from './Events';
import SermonArchivePage from './SermonArchive';
import MemberDirectoryPage from './MemberDirectory';
import PrayerRequestsPage from './PrayerRequests';
import GivingPage from './Giving';

function toSlug(name) {
  return name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
}

const SECTION_MAP = {
  attendance: AttendancePage,
  events: EventsPage,
  sermons: SermonArchivePage,
  directory: MemberDirectoryPage,
  prayer: PrayerRequestsPage,
  giving: GivingPage,
};

const SECTION_LABELS = {
  attendance: 'Attendance',
  events: 'Events',
  sermons: 'Sermon Archive',
  directory: 'Member Directory',
  prayer: 'Prayer Requests',
  giving: 'Giving',
};

export default function ChurchSubpage() {
  const { slug, section } = useParams();
  const navigate = useNavigate();

  const [church, setChurch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    Promise.all([loadChurch(), checkAuth()]);
  }, [slug]);

  const loadChurch = async () => {
    const churches = await base44.entities.Church.list();
    const found = churches.find(c =>
      (c.slug && c.slug === slug) ||
      toSlug(c.name) === slug
    );
    setChurch(found || null);
    setLoading(false);
  };

  const checkAuth = async () => {
    const isAuth = await base44.auth.isAuthenticated();
    setAuthed(isAuth);
    setAuthChecked(true);
    // Redirect signed-in users to the standard app route
    if (isAuth) {
      const sectionRoutes = {
        attendance: '/attendance',
        events: '/events',
        sermons: '/sermons',
        directory: '/directory',
        prayer: '/prayer',
        giving: '/giving',
      };
      const route = sectionRoutes[section];
      if (route) navigate(route, { replace: true });
    }
  };

  const handleSignIn = () => {
    const hostname = window.location.hostname;
    const isSubdomain = !['shepherdsyncs.com', 'app.shepherdsyncs.com', 'www.shepherdsyncs.com', 'localhost'].includes(hostname) && !hostname.endsWith('.base44.app') && !hostname.endsWith('.base44.link');
    if (isSubdomain) {
      base44.auth.redirectToLogin('/');
    } else {
      base44.auth.redirectToLogin(`/c/${slug}/${section}`);
    }
  };

  if (loading || !authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!church) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-3">
          <Church className="w-12 h-12 mx-auto text-muted-foreground opacity-40" />
          <h2 className="text-xl font-semibold">Church not found</h2>
          <Link to="/" className="text-sm text-primary hover:underline">Go home</Link>
        </div>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/10 px-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          {church.logo_url ? (
            <img src={church.logo_url} alt={church.name} className="w-20 h-20 rounded-2xl mx-auto object-cover shadow" />
          ) : (
            <div className="w-20 h-20 rounded-2xl mx-auto bg-primary/10 flex items-center justify-center">
              <Church className="w-10 h-10 text-primary" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-serif font-bold">{church.name}</h1>
            <p className="text-muted-foreground text-sm mt-1">Sign in to view {SECTION_LABELS[section] || section}</p>
          </div>
          <Button className="w-full gap-2" size="lg" onClick={handleSignIn}>
            <LogIn className="w-4 h-4" /> Sign In
          </Button>
          <Link to={`/c/${slug}`} className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-primary">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to {church.name}
          </Link>
        </div>
      </div>
    );
  }

  const SectionComponent = SECTION_MAP[section];

  if (!SectionComponent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-3">
          <h2 className="text-xl font-semibold">Page not found</h2>
          <Link to={`/c/${slug}`} className="text-sm text-primary hover:underline">
            ← Back to {church.name}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Church top bar */}
      <div className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to={`/c/${slug}`}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {church.name}
            </Link>
            <span className="text-muted-foreground/40">/</span>
            <span className="text-sm font-medium">{SECTION_LABELS[section] || section}</span>
          </div>
          <div className="flex items-center gap-2">
            {church.logo_url ? (
              <img src={church.logo_url} alt={church.name} className="w-6 h-6 rounded object-cover" />
            ) : (
              <Church className="w-4 h-4 text-primary" />
            )}
          </div>
        </div>
      </div>

      {/* Page content — renders the existing page component */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        <SectionComponent />
      </div>
    </div>
  );
}