import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Church, MapPin, Phone, Mail, LogIn, Radio, CalendarDays,
  Mic, BookMarked, Heart, HandCoins, CalendarCheck, ExternalLink
} from 'lucide-react';
import VisitorChatWidget from '@/components/chat/VisitorChatWidget';

const SECTIONS = [
  { key: 'attendance', label: 'My Attendance', icon: CalendarCheck, description: 'View your attendance history' },
  { key: 'events', label: 'Events', icon: CalendarDays, description: 'Upcoming church events' },
  { key: 'sermons', label: 'Sermons', icon: Mic, description: 'Browse sermon archive' },
  { key: 'directory', label: 'Directory', icon: BookMarked, description: 'Member directory' },
  { key: 'prayer', label: 'Prayer Requests', icon: Heart, description: 'Submit & view prayers' },
  { key: 'giving', label: 'Giving', icon: HandCoins, description: 'Give & view history' },
  { key: 'live', label: 'Watch Live', icon: Radio, description: 'Join the live stream', external: true },
];

export default function ChurchHomeContent({ church, slug }) {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => { checkAuth(); }, []);

  const checkAuth = async () => {
    const isAuth = await base44.auth.isAuthenticated();
    if (isAuth) {
      const me = await base44.auth.me();
      setUser(me);
      setAuthed(true);
      navigate('/', { replace: true });
    }
  };

  const handleSignIn = () => {
    const hostname = window.location.hostname;
    const isSubdomain = !['shepherdsyncs.com', 'app.shepherdsyncs.com', 'www.shepherdsyncs.com', 'localhost'].includes(hostname) && !hostname.endsWith('.base44.app') && !hostname.endsWith('.base44.link');
    if (isSubdomain) {
      base44.auth.redirectToLogin('/');
    } else {
      base44.auth.redirectToLogin(`/c/${slug}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/10">
      {/* Header */}
      <div className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {church.logo_url ? (
              <img src={church.logo_url} alt={church.name} className="w-8 h-8 rounded-lg object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Church className="w-4 h-4 text-primary" />
              </div>
            )}
            <span className="font-semibold text-sm">{church.name}</span>
          </div>
          {authed ? (
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground hidden sm:block">Welcome, {user?.full_name}</span>
              <Button size="sm" variant="outline" onClick={() => base44.auth.logout()}>Sign Out</Button>
            </div>
          ) : (
            <Button size="sm" onClick={handleSignIn} className="gap-1.5">
              <LogIn className="w-3.5 h-3.5" /> Sign In
            </Button>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">
        {/* Church hero */}
        <div className="text-center space-y-4">
          {church.logo_url ? (
            <img src={church.logo_url} alt={church.name} className="w-24 h-24 rounded-3xl mx-auto object-cover shadow-lg" />
          ) : (
            <div className="w-24 h-24 rounded-3xl mx-auto bg-primary/10 flex items-center justify-center shadow-lg">
              <Church className="w-12 h-12 text-primary" />
            </div>
          )}
          <div>
            <h1 className="text-3xl font-serif font-bold">{church.name}</h1>
            {church.pastor_name && (
              <p className="text-muted-foreground mt-1">Pastor {church.pastor_name}</p>
            )}
          </div>
          <div className="flex flex-wrap justify-center gap-3 text-sm text-muted-foreground">
            {church.city && (
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-primary" />
                {church.city}{church.state ? `, ${church.state}` : ''}
              </span>
            )}
            {church.phone && (
              <span className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-primary" />
                {church.phone}
              </span>
            )}
            {church.email && (
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-primary" />
                {church.email}
              </span>
            )}
          </div>
        </div>

        {/* Not signed in CTA */}
        {!authed && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-6 text-center space-y-3">
              <p className="font-semibold">Member of {church.name}?</p>
              <p className="text-sm text-muted-foreground">Sign in to access your attendance, giving history, events, and more.</p>
              <Button onClick={handleSignIn} className="gap-2">
                <LogIn className="w-4 h-4" /> Sign In to Member Portal
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Feature grid */}
        <div>
          <h2 className="text-lg font-semibold mb-4">{authed ? 'Your Church Portal' : 'Church Features'}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {SECTIONS.map(section => {
              const Icon = section.icon;
              const isLive = section.key === 'live';
              const href = isLive
                ? `/live?church=${church.id}`
                : `/c/${slug}/${section.key}`;

              if (!authed && !isLive) {
                return (
                  <div key={section.key} className="p-5 rounded-xl border bg-card opacity-60 cursor-not-allowed">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{section.label}</p>
                        <Badge variant="outline" className="text-xs mt-0.5">Sign in required</Badge>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">{section.description}</p>
                  </div>
                );
              }

              return isLive ? (
                <a key={section.key} href={href} target="_blank" rel="noopener noreferrer"
                  className="p-5 rounded-xl border bg-card hover:shadow-md hover:border-primary/40 transition-all cursor-pointer group">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-red-500" />
                    </div>
                    <div className="flex items-center gap-1">
                      <p className="font-medium text-sm">{section.label}</p>
                      <ExternalLink className="w-3 h-3 text-muted-foreground" />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{section.description}</p>
                </a>
              ) : (
                <Link key={section.key} to={href}
                  className="p-5 rounded-xl border bg-card hover:shadow-md hover:border-primary/40 transition-all cursor-pointer group">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <p className="font-medium text-sm">{section.label}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{section.description}</p>
                </Link>
              );
            })}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Powered by <span className="font-semibold">ShepherdSyncs</span>
        </p>
      </div>

      {church.ai_chat_enabled && <VisitorChatWidget church={church} />}
    </div>
  );
}