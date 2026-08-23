import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import ChurchPublicLanding from '@/components/church/ChurchPublicLanding';

function toSlug(name) {
  return (name || '').toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
}

export default function SubdomainApp() {
  const [church, setChurch] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    detectChurch();
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const me = await base44.auth.me();
      setUser(me || null);
    } catch {
      setUser(null);
    }
  };

  const detectChurch = async () => {
    const subdomain = window.location.hostname.split('.')[0];

    try {
      const res = await base44.functions.invoke('listPublicChurches', {});
      const list = Array.isArray(res?.data) ? res.data : [];
      const found = list.find(c =>
        (c.subdomain && c.subdomain === subdomain) ||
        (c.slug && c.slug === subdomain) ||
        toSlug(c.name) === subdomain
      );
      setChurch(found || null);
    } catch (err) {
      console.error('Subdomain church lookup failed:', err);
      setChurch(null);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-950">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!church) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center space-y-3 p-8">
          <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto">
            <span className="text-2xl">🏛️</span>
          </div>
          <h1 className="text-xl font-serif font-semibold">Church Not Found</h1>
          <p className="text-white/40 text-sm">
            We couldn't find a church at this address.
          </p>
        </div>
      </div>
    );
  }

  return <ChurchPublicLanding church={church} user={user} />;
}