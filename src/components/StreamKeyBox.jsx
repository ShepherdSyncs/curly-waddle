import React from 'react';
import { Button } from '@/components/ui/button';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';

export default function StreamKeyBox({ label, value }) {
  const copy = () => {
    navigator.clipboard.writeText(value);
    toast.success(`${label} copied!`);
  };
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-muted border font-mono text-xs break-all">
      <span className="flex-1">{value || '—'}</span>
      {value && (
        <Button size="icon" variant="ghost" className="w-7 h-7 flex-shrink-0" onClick={copy}>
          <Copy className="w-3.5 h-3.5" />
        </Button>
      )}
    </div>
  );
}