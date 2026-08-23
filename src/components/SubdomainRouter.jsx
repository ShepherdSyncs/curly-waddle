import React, { useState, useEffect } from 'react';
import ChurchPublicLanding from '@/components/church/ChurchPublicLanding';

// Known main-app hostnames — everything else is treated as a church subdomain
const MAIN_HOSTNAMES = new Set([
  'shepherdsyncs.com',
  'app.shepherdsyncs.com',
  'admin.shepherdsyncs.com',
  'www.shepherdsyncs.com',
  'base44.app',
  'localhost',
]);

function isMainHostname(hostname) {
  if (MAIN_HOSTNAMES.has(hostname)) return true;
  if (hostname.endsWith('.base44.app')) return true;
  if (hostname.endsWith('.base44.link')) return true;
  return false;
}

function toSlug(name) {
  return (name || '').toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
}

export default function SubdomainRouter({ children }) {
  const [mode, setMode] = useState('loading');
  const [church, setChurch] = useState(null);

  useEffect(() => {
    detectChurch();
  }, []);

  const detectChurch = async () => {
    const hostname = window.location.hostname;

    if (isMainHostname(hostname)) {
      setMode('main');
      return;
    }

    const subdomain = hostname.split('.')[0];

    try {
      // Use raw fetch to avoid SDK auth layer — this function uses service role
      const res = await fetch('/api/functions/v2/prod/listPublicChurches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!res.ok) throw new Error('Failed to load churches');

      const churches = await res.json();
      const found = churches.find(c =>
        (c.subdomain && c.subdomain === subdomain) ||
        (c.slug && c.slug === subdomain) ||
        toSlug(c.name) === subdomain
      );

      if (found) {
        setChurch(found);
        setMode('church');
      } else {
        setMode('main');
      }
    } catch {
      setMode('main');
    }
  };

  if (mode === 'loading') {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  if (mode === 'church' && church) {
    return <ChurchPublicLanding church={church} />;
  }

  return children;
}