import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Printer } from 'lucide-react';
import { format } from 'date-fns';

export default function GivingStatementDialog({ open, onClose, giving, user, churchName }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  const years = [...new Set(giving.map(g => new Date(g.date).getFullYear()))].sort((a, b) => b - a);
  if (!years.includes(currentYear)) years.unshift(currentYear);

  const yearGiving = giving.filter(g => new Date(g.date).getFullYear() === year);
  const total = yearGiving.reduce((s, g) => s + (g.amount || 0), 0);

  const handlePrint = () => {
    const w = window.open('', '_blank');
    w.document.write(`
      <html><head><title>Giving Statement ${year}</title>
      <style>body{font-family:Arial;padding:40px}h1{font-size:20px;margin:0}h2{font-size:14px;margin:4px 0 20px}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left;font-size:13px}.total{font-weight:bold;font-size:15px;margin-top:16px}</style>
      </head><body>
      <h1>${churchName || 'Church'} — Giving Statement</h1>
      <h2>Year: ${year}</h2>
      <p><strong>${user?.full_name || ''}</strong><br/>${user?.email || ''}</p>
      <table><tr><th>Date</th><th>Type</th><th>Method</th><th>Amount</th></tr>
      ${yearGiving.map(g => `<tr><td>${format(new Date(g.date), 'MMM d, yyyy')}</td><td>${g.type}</td><td>${g.method}</td><td>$${g.amount?.toFixed(2)}</td></tr>`).join('')}
      </table>
      <p class="total">Total Contributions: $${total.toFixed(2)}</p>
      <p style="margin-top:30px;font-size:11px;color:#666">This statement is provided for your records. Thank you for your generosity.</p>
      </body></html>
    `);
    w.document.close();
    w.print();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Giving Statement</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Statement Year</Label>
            <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="p-4 rounded-lg bg-muted/30 space-y-2">
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Member:</span><span className="text-sm font-medium">{user?.full_name}</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Total Contributions:</span><span className="text-sm font-bold">${total.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Number of Gifts:</span><span className="text-sm font-medium">{yearGiving.length}</span></div>
          </div>
          {yearGiving.length > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-1">
              {yearGiving.map(g => (
                <div key={g.id} className="flex justify-between text-sm py-1 border-b">
                  <span>{format(new Date(g.date), 'MMM d, yyyy')} · {g.type}</span>
                  <span>${g.amount?.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
          <Button onClick={handlePrint} className="w-full gap-2">
            <Printer className="w-4 h-4" /> Print Statement
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}