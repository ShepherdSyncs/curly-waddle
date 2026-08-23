import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Link, Copy, RefreshCw, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

export default function ChurchSignupLinks({ church }) {
  const [copied, setCopied] = useState(false);

  const generateSignupUrl = () => {
    const slug = church.name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
    return `${window.location.origin}/signup?church=${slug}`;
  };

  const copyToClipboard = (url) => {
    navigator.clipboard.writeText(url);
    toast.success('Link copied to clipboard');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const signupUrl = generateSignupUrl();
  const slug = church.name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Link className="w-5 h-5 text-primary" />
          Signup Link
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Share this link with new members who want to join {church.name}. They can sign up directly using this URL.
        </p>

        <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/40">
          <code className="flex-1 font-mono text-sm text-foreground truncate">{signupUrl}</code>
          <button
            onClick={() => copyToClipboard(signupUrl)}
            className={`flex-shrink-0 p-2 rounded transition-colors ${
              copied
                ? 'bg-green-100 text-green-700'
                : 'text-muted-foreground hover:text-primary'
            }`}
            title="Copy link"
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>

        <Button variant="outline" size="sm" asChild className="w-full gap-2">
          <a href={`/verify-members?church=${church.id}`} target="_blank">
            <ExternalLink className="w-3.5 h-3.5" />
            Review Signups
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}