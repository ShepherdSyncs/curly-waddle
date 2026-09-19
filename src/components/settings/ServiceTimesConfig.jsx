import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Clock } from 'lucide-react';

const DAYS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

const DEFAULT_WINDOW = { day: 0, start: '08:00', end: '13:00' };

// church: the church record (uses church.service_times, a jsonb array of {day,start,end})
// onSave: async (data) => void, called with { service_times: [...] }
export default function ServiceTimesConfig({ church, onSave }) {
  const [windows, setWindows] = useState(church?.service_times?.length ? church.service_times : []);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setWindows(church?.service_times?.length ? church.service_times : []);
  }, [church?.id]);

  const addWindow = () => setWindows(prev => [...prev, { ...DEFAULT_WINDOW }]);
  const removeWindow = (idx) => setWindows(prev => prev.filter((_, i) => i !== idx));
  const updateWindow = (idx, field, value) => {
    setWindows(prev => prev.map((w, i) => (i === idx ? { ...w, [field]: value } : w)));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ service_times: windows });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Automated prompts (like surveys) will avoid popping up during these windows. If none are
        set, we default to Sunday 8:00 AM–1:00 PM.
      </p>

      {windows.length === 0 && (
        <p className="text-xs text-muted-foreground italic">Using default: Sunday 8:00 AM–1:00 PM</p>
      )}

      <div className="space-y-2">
        {windows.map((w, idx) => (
          <div key={idx} className="flex items-center gap-2 flex-wrap">
            <Select value={String(w.day)} onValueChange={(v) => updateWindow(idx, 'day', Number(v))}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAYS.map(d => (
                  <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="time"
              value={w.start}
              onChange={e => updateWindow(idx, 'start', e.target.value)}
              className="w-32"
            />
            <span className="text-sm text-muted-foreground">to</span>
            <Input
              type="time"
              value={w.end}
              onChange={e => updateWindow(idx, 'end', e.target.value)}
              className="w-32"
            />
            <Button variant="ghost" size="icon" onClick={() => removeWindow(idx)}>
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={addWindow}>
          <Plus className="w-4 h-4 mr-1.5" />
          Add Service Time
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          <Clock className="w-4 h-4 mr-1.5" />
          {saving ? 'Saving...' : 'Save Service Times'}
        </Button>
      </div>
    </div>
  );
}
