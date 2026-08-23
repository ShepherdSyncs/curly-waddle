import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Bot, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function AIChatConfig({ church, onSave }) {
  const [enabled, setEnabled] = useState(false);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEnabled(church.ai_chat_enabled || false);
    setDescription(church.ai_chat_description || '');
  }, [church]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        ai_chat_enabled: enabled,
        ai_chat_description: description,
      });
      toast.success('AI chat settings saved');
    } catch {
      toast.error('Failed to save settings');
    }
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Bot className="w-5 h-5 text-primary" />
          AI Visitor Chat
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-3 rounded-lg border">
          <div>
            <p className="font-medium text-sm">Enable AI Chat on Public Page</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Shows a floating chat widget on your public church page for visitors to ask questions.
            </p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        <div className="space-y-2">
          <Label>Church Information for AI</Label>
          <p className="text-xs text-muted-foreground">
            The AI assistant will use this information to answer visitor questions. Include details like service times,
            address, beliefs, ministries, events, contact info, and common questions. If the AI can't answer based on
            this information, the visitor's question will be forwarded to your Pastoral Team.
          </p>
          <Textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Example:&#10;Service Times: Sunday School 9:30 AM, Sunday Morning Worship 10:45 AM, Wednesday Bible Study 7 PM&#10;Address: 123 Main St, Dallas, TX&#10;We are a Bible-believing church focused on community outreach and spiritual growth. We offer children's ministry, youth group, and adult Bible studies.&#10;Contact: office@church.org or (555) 123-4567"
            rows={8}
            className="text-sm"
          />
        </div>

        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </CardContent>
    </Card>
  );
}