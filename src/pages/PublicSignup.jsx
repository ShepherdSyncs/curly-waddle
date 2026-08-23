import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Church, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function PublicSignup() {
  const params = new URLSearchParams(window.location.search);
  const churchSlug = params.get('church');

  const [church, setChurch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ email: '', full_name: '' });
  const [signing, setSigning] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!churchSlug) { setLoading(false); return; }
    
    // Find church by slug
    base44.entities.Church.list()
      .then(churches => {
        const found = churches.find(c => 
          c.name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '') === churchSlug
        );
        setChurch(found || null);
      })
      .finally(() => setLoading(false));
  }, [churchSlug]);

  const handleSignup = async (e) => {
    e.preventDefault();
    if (!form.email || !form.full_name) {
      toast.error('Please fill in all fields');
      return;
    }

    setSigning(true);
    try {
      // Create a new invitation record for this signup
      const invitationCode = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
      const invitation = await base44.entities.ChurchInvitation.create({
        church_id: church.id,
        code: invitationCode,
        user_email: form.email,
        user_name: form.full_name,
        status: 'pending',
      });

      // Send notification to church admin (only if church has email configured)
      if (church.email) {
        await base44.functions.invoke('sendChurchAdminNotification', {
          churchId: church.id,
          userName: form.full_name,
          userEmail: form.email,
          invitationCode: invitationCode,
        });
      }

      setResult({ success: true });
      toast.success('Signup successful! The church admin will verify your information.');
    } catch (err) {
      setResult({ success: false, error: err.message });
      toast.error('Signup failed');
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
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
          <AlertCircle className="w-12 h-12 mx-auto text-destructive opacity-60" />
          <h2 className="text-xl font-semibold">Church Not Found</h2>
          <p className="text-sm text-muted-foreground">This signup link is invalid or the church no longer exists.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/10 flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Church branding */}
        <div className="text-center space-y-3">
          {church.logo_url ? (
            <img src={church.logo_url} alt={church.name} className="w-20 h-20 rounded-2xl mx-auto object-cover shadow" />
          ) : (
            <div className="w-20 h-20 rounded-2xl mx-auto bg-primary/10 flex items-center justify-center shadow">
              <Church className="w-10 h-10 text-primary" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-serif font-bold">Join {church.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">Create your member account</p>
          </div>
        </div>

        {result && !result.success ? (
          <Card>
            <CardContent className="py-8 text-center space-y-3">
              <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
              <p className="font-semibold">{result.error}</p>
            </CardContent>
          </Card>
        ) : result && result.success ? (
          <Card>
            <CardContent className="py-8 text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
              <p className="font-semibold">Welcome!</p>
              <p className="text-sm text-muted-foreground">
                Your signup is pending verification by {church.name}. You'll receive an email once you're approved.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6">
              <form onSubmit={handleSignup} className="space-y-4">
                <div>
                  <Label>Full Name *</Label>
                  <Input
                    value={form.full_name}
                    onChange={e => setForm({ ...form, full_name: e.target.value })}
                    placeholder="John Smith"
                  />
                </div>
                <div>
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    placeholder="john@example.com"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={signing || !form.email || !form.full_name}
                >
                  {signing ? 'Signing up...' : 'Join'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}