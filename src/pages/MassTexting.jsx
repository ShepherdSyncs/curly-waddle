import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import useAppUser from '@/hooks/useAppUser';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { MessageSquare, Send, Users, Phone, AlertTriangle, CheckCircle2, XCircle, Search, Loader2, Settings as SettingsIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

const MAX_SMS_LENGTH = 1600;

export default function MassTexting() {
  const { user, isChurchAdmin, isChurchStaff, myChurches } = useAppUser();
  const queryClient = useQueryClient();
  const churchId = user?.church_id;
  const church = myChurches?.find(c => c.id === churchId);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState(null);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['mass-texting-members', churchId],
    queryFn: () => base44.entities.ChurchMember.filter({ church_id: churchId }),
    enabled: !!churchId,
  });

  const { data: smsCreds } = useQuery({
    queryKey: ['church-sms-credentials', churchId],
    queryFn: async () => {
      const list = await base44.entities.ChurchSmsCredentials.filter({ church_id: churchId });
      return list?.[0] || null;
    },
    enabled: !!churchId,
  });

  const membersWithPhones = useMemo(() => {
    return members.filter(m => m.status === 'active' && m.phone && m.phone.trim());
  }, [members]);

  const filteredMembers = useMemo(() => {
    if (!search) return membersWithPhones;
    const q = search.toLowerCase();
    return membersWithPhones.filter(m =>
      `${m.first_name} ${m.last_name}`.toLowerCase().includes(q) ||
      m.phone?.includes(q)
    );
  }, [membersWithPhones, search]);

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedIds(new Set(filteredMembers.map(m => m.id)));
  };

  const selectAllActive = () => {
    setSelectedIds(new Set(membersWithPhones.map(m => m.id)));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const selectedMembers = membersWithPhones.filter(m => selectedIds.has(m.id));

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error('Please enter a message');
      return;
    }
    if (selectedMembers.length === 0) {
      toast.error('Please select at least one recipient');
      return;
    }
    setSending(true);
    setResults(null);
    try {
      const recipients = selectedMembers.map(m => ({
        phone: m.phone,
        name: `${m.first_name} ${m.last_name}`,
      }));
      const res = await base44.functions.invoke('sendChurchSMS', {
        churchId,
        message: message.trim(),
        recipients,
      });
      const data = res.data;
      if (data?.error) {
        toast.error(data.error);
        setResults({ error: data.error });
      } else {
        toast.success(`Sent ${data.sent} of ${data.total} messages`);
        setResults(data);
        if (data.sent > 0) {
          setMessage('');
          clearSelection();
        }
      }
    } catch (err) {
      toast.error(err.message || 'Failed to send messages');
      setResults({ error: err.message });
    }
    setSending(false);
  };

  if (!isChurchAdmin && !isChurchStaff) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center space-y-3">
            <AlertTriangle className="w-10 h-10 mx-auto text-amber-500" />
            <h2 className="text-lg font-semibold">Access Restricted</h2>
            <p className="text-sm text-muted-foreground">Only church staff and admins can access mass texting.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!smsCreds?.sms_enabled) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <MessageSquare className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Mass Texting Not Enabled</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Configure your Twilio account in Settings to enable mass texting.
              </p>
            </div>
            <Button asChild className="gap-2">
              <Link to="/settings">
                <SettingsIcon className="w-4 h-4" /> Go to Settings
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-serif font-bold flex items-center gap-2">
            <MessageSquare className="w-7 h-7 text-primary" />
            Mass Texting
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Send text messages to your congregation using your own Twilio account
          </p>
        </div>
        <Badge variant="outline" className="gap-1.5">
          <Phone className="w-3.5 h-3.5" />
          {church?.twilio_from_number || 'Not configured'}
        </Badge>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recipient selection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Recipients
              <Badge variant="secondary">{selectedMembers.length} selected</Badge>
            </CardTitle>
            <CardDescription>
              {membersWithPhones.length} active members with phone numbers
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search members..."
                  className="pl-8"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Button size="sm" variant="outline" onClick={selectAllFiltered}>Select Filtered</Button>
              <Button size="sm" variant="outline" onClick={selectAllActive}>Select All Active</Button>
              <Button size="sm" variant="ghost" onClick={clearSelection}>Clear</Button>
            </div>
            <Separator />
            <div className="max-h-[400px] overflow-y-auto space-y-1.5">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredMembers.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">No members found</p>
              ) : (
                filteredMembers.map(member => (
                  <label
                    key={member.id}
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={selectedIds.has(member.id)}
                      onCheckedChange={() => toggleSelect(member.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {member.first_name} {member.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">{member.phone}</p>
                    </div>
                  </label>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Compose & send */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Send className="w-5 h-5 text-primary" />
              Compose Message
            </CardTitle>
            <CardDescription>Messages are sent from your church's Twilio number</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label>Message</Label>
                <span className={`text-xs ${message.length > MAX_SMS_LENGTH ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {message.length} / {MAX_SMS_LENGTH}
                </span>
              </div>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message here..."
                rows={6}
                maxLength={MAX_SMS_LENGTH}
              />
            </div>

            {/* Cost estimate */}
            <div className="p-3 rounded-lg bg-muted/30 border text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Recipients</span>
                <span className="font-medium">{selectedMembers.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Messages to send</span>
                <span className="font-medium">{selectedMembers.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Billed to</span>
                <span className="font-medium">Your Twilio account</span>
              </div>
            </div>

            <Button
              onClick={handleSend}
              disabled={sending || !message.trim() || selectedMembers.length === 0}
              className="w-full gap-2 h-11"
              size="lg"
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending {selectedMembers.length} messages...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send to {selectedMembers.length} {selectedMembers.length === 1 ? 'person' : 'people'}
                </>
              )}
            </Button>

            {/* Results */}
            {results && !results.error && (
              <div className="p-4 rounded-lg border space-y-3 bg-emerald-500/5 border-emerald-500/20">
                <div className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-medium">Sending Complete</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-2 rounded-lg bg-emerald-500/10">
                    <p className="text-2xl font-bold text-emerald-600">{results.sent}</p>
                    <p className="text-xs text-muted-foreground">Sent</p>
                  </div>
                  {results.failed > 0 && (
                    <div className="text-center p-2 rounded-lg bg-red-500/10">
                      <p className="text-2xl font-bold text-red-500">{results.failed}</p>
                      <p className="text-xs text-muted-foreground">Failed</p>
                    </div>
                  )}
                </div>
                {results.errors?.length > 0 && (
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {results.errors.map((err, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-red-500">
                        <XCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                        <span className="font-mono">{err.phone}</span>
                        <span className="text-muted-foreground">— {err.error}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {results?.error && (
              <div className="p-4 rounded-lg border bg-red-500/5 border-red-500/20 flex items-start gap-2 text-red-500">
                <XCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Failed to send</p>
                  <p className="text-sm text-muted-foreground">{results.error}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}