import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, DollarSign, Edit2, Trash2 } from 'lucide-react';

const TYPE_COLORS = {
  tithe: 'bg-blue-500/15 text-blue-400',
  offering: 'bg-green-500/15 text-green-400',
  missions: 'bg-purple-500/15 text-purple-400',
  building_fund: 'bg-orange-500/15 text-orange-400',
  benevolence: 'bg-pink-500/15 text-pink-400',
  other: 'bg-muted text-muted-foreground',
};

export default function MemberGivingHistory({ memberName, records, onBack, onEdit, onDelete }) {
  const total = records.reduce((s, r) => s + (r.amount || 0), 0);
  const thisYear = new Date().getFullYear().toString();
  const yearTotal = records.filter(r => r.date?.startsWith(thisYear)).reduce((s, r) => s + (r.amount || 0), 0);

  const byType = records.reduce((acc, r) => {
    acc[r.type] = (acc[r.type] || 0) + (r.amount || 0);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
        )}
        <h2 className="text-lg font-semibold">{memberName}'s Giving</h2>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">All Time</p>
          <p className="text-xl font-bold mt-1">${total.toLocaleString()}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">{thisYear}</p>
          <p className="text-xl font-bold mt-1">${yearTotal.toLocaleString()}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total Records</p>
          <p className="text-xl font-bold mt-1">{records.length}</p>
        </Card>
      </div>

      {Object.keys(byType).length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">By Category</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(byType).map(([type, amt]) => (
              <div key={type} className="flex items-center justify-between">
                <Badge className={TYPE_COLORS[type] || TYPE_COLORS.other}>{type.replace(/_/g, ' ')}</Badge>
                <span className="font-semibold text-sm">${amt.toLocaleString()}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-sm">Transaction History</CardTitle></CardHeader>
        <CardContent className="p-0">
          {records.length === 0 ? (
            <p className="text-center text-muted-foreground py-6 text-sm">No records found</p>
          ) : (
            <div className="divide-y">
              {records.map(r => (
                <div key={r.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium capitalize">{r.type?.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-muted-foreground">{r.date} · {r.method}</p>
                    {r.notes && <p className="text-xs text-muted-foreground italic">{r.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-primary">${(r.amount || 0).toLocaleString()}</span>
                    {onEdit && <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => onEdit(r)}><Edit2 className="w-3.5 h-3.5" /></Button>}
                    {onDelete && <Button size="icon" variant="ghost" className="w-7 h-7 text-destructive" onClick={() => onDelete(r.id)}><Trash2 className="w-3.5 h-3.5" /></Button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}