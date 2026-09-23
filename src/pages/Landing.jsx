import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  Users, CalendarCheck, HandCoins, Radio, BookOpen, MessageSquare,
  Heart, ClipboardList, BarChart2, CheckCircle2, ArrowRight, Cross,
} from 'lucide-react';

const STOP_WORDS = new Set(['the', 'a', 'an', 'of', 'and', 'for', 'in', 'at', 'on']);

function abbreviateSubdomain(name) {
  const clean = (name || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const words = clean.split(/\s+/).filter(Boolean);
  const significant = words.filter(w => !STOP_WORDS.has(w));
  const initials = significant.map(w => w[0]).join('');
  if (initials.length >= 3) return initials;
  return clean.replace(/\s+/g, '').slice(0, 20) || 'church';
}

const FEATURES = [
  { icon: Users, title: 'Member Management', description: 'Family groups, directories, and full member profiles in one place.' },
  { icon: CalendarCheck, title: 'Attendance Tracking', description: 'Take attendance by service and automatically flag members who drift away.' },
  { icon: HandCoins, title: 'Giving & Records', description: 'Track tithes and offerings and generate reports for your financial records.' },
  { icon: Radio, title: 'Live Streaming', description: 'Broadcast services live and simulcast to YouTube and Facebook.' },
  { icon: BookOpen, title: 'Bible Study Tools', description: 'Plan sessions, share guides, and chat with an AI study companion.' },
  { icon: MessageSquare, title: 'Church Communication', description: 'Chat, mass texting, and pastoral messaging to stay connected.' },
  { icon: Heart, title: 'Prayer Requests', description: 'Collect and manage prayer requests from your whole congregation.' },
  { icon: ClipboardList, title: 'Events & Follow-Up', description: 'RSVP-tracked events and follow-up tasks so no visitor is missed.' },
  { icon: BarChart2, title: 'Analytics', description: 'See attendance trends, giving analytics, and growth at a glance.' },
];

export default function Landing() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [form, setForm] = useState({ churchName: '', adminName: '', adminEmail: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (isAuthenticated) {
    navigate('/');
    return null;
  }

  const subdomainPreview = form.churchName ? abbreviateSubdomain(form.churchName) : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.churchName || !form.adminName || !form.adminEmail || !form.password) {
      toast.error('Please fill in all fields');
      return;
    }
    if (form.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('https://nzodqfzbowhyrnuauzzr.supabase.co/functions/v1/create-church-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || 'Something went wrong. Please try again.');
        setSubmitting(false);
        return;
      }
      // Sign the new admin straight in and land them on their dashboard.
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: form.adminEmail,
        password: form.password,
      });
      if (signInErr) {
        toast.success('Your church is set up! Please log in.');
        navigate('/login');
        return;
      }
      toast.success(`${form.churchName} is live! Welcome to ShepherdSyncs.`);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border sticky top-0 z-20 bg-background/90 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
              <Cross className="w-4 h-4 text-primary" />
            </div>
            <span className="font-serif font-bold text-lg">ShepherdSyncs</span>
          </div>
          <Button variant="outline" onClick={() => navigate('/login')} className="gap-1.5">
            Log In
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-14 sm:pt-24 sm:pb-20 text-center">
        <h1 className="text-3xl sm:text-5xl font-serif font-bold leading-tight max-w-3xl mx-auto">
          Church management, simplified.
        </h1>
        <p className="text-muted-foreground text-base sm:text-lg mt-5 max-w-xl mx-auto">
          Members, attendance, giving, live streaming, and communication — everything your church needs, in one place. Set up your church's account in minutes.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" className="gap-2" onClick={() => document.getElementById('signup')?.scrollIntoView({ behavior: 'smooth' })}>
            Start Your Free Trial <ArrowRight className="w-4 h-4" />
          </Button>
          <Button size="lg" variant="outline" onClick={() => navigate('/login')}>
            Log In
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-3">14-day free trial. No credit card required.</p>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(f => {
            const Icon = f.icon;
            return (
              <Card key={f.title} className="border-border">
                <CardContent className="p-5 space-y-2.5">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-semibold">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Signup */}
      <section id="signup" className="border-t border-border bg-muted/30">
        <div className="max-w-md mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-serif font-bold">Create Your Church's Account</h2>
            <p className="text-muted-foreground text-sm mt-2">Start your 14-day free trial — no credit card needed.</p>
          </div>
          <Card>
            <CardContent className="p-6">
              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive mb-4">
                  {error}
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="churchName">Church Name</Label>
                  <Input
                    id="churchName"
                    value={form.churchName}
                    onChange={e => setForm({ ...form, churchName: e.target.value })}
                    placeholder="Grace Community Church"
                    required
                  />
                  {subdomainPreview && (
                    <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-primary" />
                      Your church page: <span className="font-mono">{subdomainPreview}.shepherdsyncs.com</span>
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="adminName">Your Name</Label>
                  <Input
                    id="adminName"
                    value={form.adminName}
                    onChange={e => setForm({ ...form, adminName: e.target.value })}
                    placeholder="Pastor John Smith"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="adminEmail">Email</Label>
                  <Input
                    id="adminEmail"
                    type="email"
                    value={form.adminEmail}
                    onChange={e => setForm({ ...form, adminEmail: e.target.value })}
                    placeholder="pastor@church.org"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    placeholder="Choose a password"
                    minLength={6}
                    required
                  />
                </div>
                <Button type="submit" className="w-full gap-2" size="lg" disabled={submitting}>
                  {submitting ? 'Creating your church...' : 'Create Church Account'}
                  {!submitting && <ArrowRight className="w-4 h-4" />}
                </Button>
              </form>
              <p className="text-xs text-muted-foreground text-center mt-4">
                Already have an account? <button onClick={() => navigate('/login')} className="text-primary underline">Log in</button>
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center py-8 text-xs text-muted-foreground">
        <span>© {new Date().getFullYear()} ShepherdSyncs. ShepherdSyncs™ is a trademark of ShepherdSyncs.</span>
      </footer>
    </div>
  );
}
