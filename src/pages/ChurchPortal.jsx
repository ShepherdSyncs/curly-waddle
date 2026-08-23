import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Church, MapPin, Phone, Mail, LogIn } from 'lucide-react';

export default function ChurchPortal() {
  const params = new URLSearchParams(window.location.search);
  const churchId = params.get('id');
  const churchSlug = params.get('church');

  const [church, setChurch] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!churchId) { setLoading(false); return; }
    base44.entities.Church.list('name', 200)
      .then(churches => {
        const found = churches.find(c => c.id === churchId) || null;
        setChurch(found);
      })
      .catch(() => setChurch(null))
      .finally(() => setLoading(false));
  }, [churchId]);

  const handleSignIn = () => {
    base44.auth.redirectToLogin(`/?church=${churchSlug}&id=${churchId}`);
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
          <Church className="w-12 h-12 mx-auto text-muted-foreground opacity-40" />
          <h2 className="text-xl font-semibold">Church not found</h2>
          <p className="text-sm text-muted-foreground">This portal link may be invalid or the church may no longer be active.</p>
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
            <h1 className="text-2xl font-serif font-bold">Welcome to {church.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">hosted by ShepherdSyncs</p>
            {church.pastor_name && (
              <p className="text-xs text-muted-foreground mt-0.5">Pastor {church.pastor_name}</p>
            )}
          </div>
        </div>

        {/* Info card */}
        <Card>
          <CardContent className="p-5 space-y-2">
            {church.city && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="w-4 h-4 text-primary" />
                {church.city}{church.state ? `, ${church.state}` : ''}
              </p>
            )}
            {church.phone && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="w-4 h-4 text-primary" />
                {church.phone}
              </p>
            )}
            {church.email && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="w-4 h-4 text-primary" />
                {church.email}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Sign in */}
        <div className="space-y-3">
          <Button className="w-full gap-2" size="lg" onClick={handleSignIn}>
            <LogIn className="w-4 h-4" />
            Sign In to Member Portal
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Members of {church.name} can sign in to access their ShepherdSyncs portal.
          </p>
        </div>
      </div>
    </div>
  );
}