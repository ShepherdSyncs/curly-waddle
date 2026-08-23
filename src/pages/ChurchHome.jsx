import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Church } from 'lucide-react';
import ChurchHomeContent from '@/components/ChurchHomeContent';

function toSlug(name) {
  return name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
}

export default function ChurchHome() {
  const { slug } = useParams();
  const [church, setChurch] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadChurch(); }, [slug]);

  const loadChurch = async () => {
    const churches = await base44.entities.Church.list();
    const found = churches.find(c =>
      (c.slug && c.slug === slug) ||
      toSlug(c.name) === slug
    );
    setChurch(found || null);
    setLoading(false);
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
          <p className="text-sm text-muted-foreground">
            No church found at <span className="font-mono text-primary">/c/{slug}</span>
          </p>
        </div>
      </div>
    );
  }

  return <ChurchHomeContent church={church} slug={slug} />;
}