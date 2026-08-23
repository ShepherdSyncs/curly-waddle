import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import useAppUser from '@/hooks/useAppUser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HandCoins, CalendarCheck, BookOpen, Radio, ExternalLink, DollarSign, Calendar, ChevronRight, User, Droplets, Flame, Users, MessageSquare, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import GivingForm from '@/components/giving/GivingForm';
import ProfileTab from '@/components/portal/ProfileTab';
import FamilyTab from '@/components/portal/FamilyTab';
import HouseholdMessagesTab from '@/components/portal/HouseholdMessagesTab';
import GivingStatementDialog from '@/components/portal/GivingStatementDialog';
import { toast } from 'sonner';

export default function UserPortal() {
  const { user, activeChurch } = useAppUser();
  const churchId = user?.church_id;
  const isChurchMember = user?.role === 'user';
  const defaultTab = isChurchMember ? 'give' : 'profile';
  const queryClient = useQueryClient();
  const [selectedGuide, setSelectedGuide] = useState(null);
  const [showStatement, setShowStatement] = useState(false);
  const [profileForm, setProfileForm] = useState({ display_name: '', phone: '', address: '' });
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const { data: myProfiles = [] } = useQuery({
    queryKey: ['my-member-profile', user?.email],
    queryFn: () => base44.entities.MemberProfile.filter({ user_email: user.email }),
    enabled: !!user?.email,
  });

  const myProfile = myProfiles[0];

  useEffect(() => {
    if (!profileLoaded && myProfile) {
      setProfileForm({
        display_name: myProfile.display_name || user?.full_name || '',
        phone: myProfile.phone || '',
        address: myProfile.address || '',
      });
      setProfileLoaded(true);
    } else if (!profileLoaded && user && myProfiles.length === 0) {
      setProfileForm({ display_name: user.full_name || '', phone: '', address: '' });
      setProfileLoaded(true);
    }
  }, [myProfile, user, profileLoaded, myProfiles.length]);

  const { data: spiritualRecords = [] } = useQuery({
    queryKey: ['my-spiritual', user?.email, churchId],
    queryFn: () => base44.entities.SpiritualRecord.filter({ church_id: churchId }, '-date', 100),
    enabled: !!churchId,
  });

  const baptismRecord = spiritualRecords.find(r => r.type === 'baptism');
  const holyGhostRecord = spiritualRecords.find(r => r.type === 'holy_ghost');

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    if (myProfile) {
      await base44.entities.MemberProfile.update(myProfile.id, profileForm);
    } else {
      await base44.entities.MemberProfile.create({
        ...profileForm,
        church_id: churchId || '',
        user_email: user.email,
      });
    }
    // Also update the base44 user display name
    if (profileForm.display_name && profileForm.display_name !== user?.full_name) {
      await base44.auth.updateMe({ full_name: profileForm.display_name });
    }
    queryClient.invalidateQueries({ queryKey: ['my-member-profile'] });
    toast.success('Profile updated');
    setSavingProfile(false);
  };

  const { data: givingResult } = useQuery({
    queryKey: ['my-giving', user?.email],
    queryFn: () => base44.functions.invoke('getMyGivingRecords', {}),
    enabled: !!user?.email,
  });
  const giving = givingResult?.data?.records || [];

  const { data: attendance = [] } = useQuery({
    queryKey: ['my-attendance', user?.email, churchId],
    queryFn: () => base44.entities.AttendanceRecord.filter(churchId ? { church_id: churchId } : { member_email: user.email }, '-date', 200),
    enabled: !!user?.email,
  });

  const { data: myMemberRecords = [] } = useQuery({
    queryKey: ['my-member-record', user?.email, churchId],
    queryFn: () => base44.entities.ChurchMember.filter(churchId ? { church_id: churchId, email: user?.email } : { email: user?.email }),
    enabled: !!user?.email,
  });

  const { data: guides = [] } = useQuery({
    queryKey: ['guides-approved', churchId],
    queryFn: () => base44.entities.BibleStudyGuide.filter({ church_id: churchId, status: 'approved' }, '-created_date', 100),
    enabled: !!churchId,
  });

  const myGiving = giving;
  const myMemberIds = new Set(myMemberRecords.map(m => m.id));
  const myAttendance = attendance.filter(a => myMemberIds.has(a.member_id) || a.member_email === user?.email || a.created_by === user?.email);

  const totalGiven = myGiving.reduce((s, g) => s + (g.amount || 0), 0);
  const presentCount = myAttendance.filter(a => a.present).length;

  const typeColors = {
    tithe: 'bg-primary/10 text-primary',
    offering: 'bg-secondary/20 text-secondary-foreground',
    missions: 'bg-green-100 text-green-700',
    building_fund: 'bg-blue-100 text-blue-700',
    benevolence: 'bg-purple-100 text-purple-700',
    other: 'bg-gray-100 text-gray-600',
  };

  const serviceLabels = {
    sunday_morning: 'Sunday Morning',
    sunday_evening: 'Sunday Evening',
    wednesday: 'Wednesday',
    bible_study: 'Bible Study',
    special_event: 'Special Event',
    other: 'Other',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-serif font-bold">My Church</h1>
          <p className="text-sm text-muted-foreground mt-1">Welcome back, {user?.full_name}</p>
        </div>
        {churchId && (
          <a href={`/live?church=${churchId}`} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" className="gap-2">
              <Radio className="w-4 h-4 text-red-500" /> Watch Live
            </Button>
          </a>
        )}
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList className="flex w-full max-w-3xl overflow-x-auto">
          {!isChurchMember && (
            <TabsTrigger value="profile" className="flex-1"><User className="w-4 h-4 mr-1.5" />Profile</TabsTrigger>
          )}
          <TabsTrigger value="give" className="flex-1"><HandCoins className="w-4 h-4 mr-1.5" />Give</TabsTrigger>
          <TabsTrigger value="giving" className="flex-1"><DollarSign className="w-4 h-4 mr-1.5" />History</TabsTrigger>
          <TabsTrigger value="attendance" className="flex-1"><CalendarCheck className="w-4 h-4 mr-1.5" />Attendance</TabsTrigger>
          <TabsTrigger value="family" className="flex-1"><Users className="w-4 h-4 mr-1.5" />Family</TabsTrigger>
          <TabsTrigger value="messages" className="flex-1"><MessageSquare className="w-4 h-4 mr-1.5" />Messages</TabsTrigger>
          <TabsTrigger value="studies" className="flex-1"><BookOpen className="w-4 h-4 mr-1.5" />Studies</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        {!isChurchMember && (
          <TabsContent value="profile" className="mt-4">
            <ProfileTab user={user} />
          </TabsContent>
        )}

        {/* Give Tab */}
        <TabsContent value="give" className="space-y-4 mt-4">
          <Card>
            <CardContent className="p-5">
              <h2 className="font-semibold text-lg mb-1">Make a Gift</h2>
              <p className="text-sm text-muted-foreground mb-4">Your giving supports the ministry and community.</p>
              <GivingForm user={user} churchId={churchId} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Giving History Tab */}
        <TabsContent value="giving" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowStatement(true)} className="gap-2">
              <FileText className="w-4 h-4" /> Request Statement
            </Button>
          </div>
          <Card className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm opacity-75">My Total Giving</p>
                <p className="text-2xl font-bold">${totalGiven.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
              </div>
            </CardContent>
          </Card>
          <div className="space-y-2">
            {myGiving.length === 0 && (
              <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">No giving records found for your account</CardContent></Card>
            )}
            {myGiving.map(g => (
              <Card key={g.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{format(new Date(g.date), 'MMM d, yyyy')}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className={typeColors[g.type]}>{g.type?.replace(/_/g, ' ')}</Badge>
                      <span className="text-xs text-muted-foreground capitalize">{g.method}</span>
                    </div>
                  </div>
                  <p className="text-lg font-bold">${g.amount?.toFixed(2)}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Attendance Tab */}
        <TabsContent value="attendance" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                  <CalendarCheck className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xl font-bold">{presentCount}</p>
                  <p className="text-xs text-muted-foreground">Services Attended</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xl font-bold">{myAttendance.length}</p>
                  <p className="text-xs text-muted-foreground">Total Records</p>
                </div>
              </div>
            </Card>
          </div>
          <div className="space-y-2">
            {myAttendance.length === 0 && (
              <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">No attendance records found</CardContent></Card>
            )}
            {myAttendance.map(a => (
              <Card key={a.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{format(new Date(a.date), 'MMM d, yyyy')}</p>
                    <p className="text-sm text-muted-foreground">{serviceLabels[a.service_type] || a.service_type}</p>
                  </div>
                  <Badge variant={a.present ? 'default' : 'secondary'} className={a.present ? 'bg-green-100 text-green-700' : ''}>
                    {a.present ? 'Present' : 'Absent'}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Family Tab */}
        <TabsContent value="family" className="mt-4">
          <FamilyTab user={user} />
        </TabsContent>

        {/* Household Messages Tab */}
        <TabsContent value="messages" className="mt-4">
          <HouseholdMessagesTab user={user} />
        </TabsContent>

        {/* Bible Studies Tab */}
        <TabsContent value="studies" className="space-y-4 mt-4">
          {selectedGuide ? (
            <div className="space-y-4">
              <Button variant="outline" size="sm" onClick={() => setSelectedGuide(null)}>← Back to Guides</Button>
              <Card>
                <CardHeader>
                  <CardTitle>{selectedGuide.title}</CardTitle>
                  {selectedGuide.scripture_references && (
                    <p className="text-sm text-muted-foreground">{selectedGuide.scripture_references}</p>
                  )}
                </CardHeader>
                <CardContent>
                  {selectedGuide.file_url && (
                    <a href={selectedGuide.file_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm" className="mb-4 gap-2">
                        <ExternalLink className="w-4 h-4" /> Download File
                      </Button>
                    </a>
                  )}
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown>{selectedGuide.content}</ReactMarkdown>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="space-y-3">
              {guides.length === 0 && (
                <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">No Bible study guides available yet</CardContent></Card>
              )}
              {guides.map(g => (
                <Card key={g.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedGuide(g)}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <BookOpen className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">{g.title}</p>
                        {g.topic && <p className="text-sm text-muted-foreground">{g.topic}</p>}
                        {g.scripture_references && <p className="text-xs text-muted-foreground mt-0.5">{g.scripture_references}</p>}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <GivingStatementDialog open={showStatement} onClose={() => setShowStatement(false)} giving={myGiving} user={user} churchName={activeChurch?.name} />
    </div>
  );
}