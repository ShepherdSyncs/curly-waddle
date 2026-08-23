import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import useAppUser from '@/hooks/useAppUser';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Search, Users, Shield, UserCircle } from 'lucide-react';
import { toast } from 'sonner';
import MemberProfileCard from '@/components/directory/MemberProfileCard';
import EditProfileDialog from '@/components/directory/EditProfileDialog';
import MemberDetailDialog from '@/components/directory/MemberDetailDialog';

export default function MemberDirectory() {
  const { user, isChurchAdmin } = useAppUser();
  const churchId = user?.church_id;
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [viewMember, setViewMember] = useState(null);

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['member-profiles', churchId],
    queryFn: () => isChurchAdmin
      ? base44.entities.MemberProfile.filter({ church_id: churchId }, 'display_name', 200)
      : base44.entities.MemberProfile.filter({ church_id: churchId, show_in_directory: true }, 'display_name', 200),
    enabled: !!churchId && isChurchAdmin !== undefined,
  });

  const { data: myProfile } = useQuery({
    queryKey: ['my-profile', user?.email],
    queryFn: () => base44.entities.MemberProfile.filter({ church_id: churchId, user_email: user.email }, 'display_name', 1),
    enabled: !!user?.email && !!churchId,
    select: data => data[0] || null,
  });

  const saveMutation = useMutation({
    mutationFn: (data) => myProfile
      ? base44.entities.MemberProfile.update(myProfile.id, data)
      : base44.entities.MemberProfile.create({ ...data, church_id: churchId, user_email: user.email }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['member-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['my-profile'] });
      setEditOpen(false);
      toast.success('Profile saved');
    },
  });

  const filtered = profiles.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.display_name?.toLowerCase().includes(q) || p.bio?.toLowerCase().includes(q) || (p.ministry_roles || []).some(r => r.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-serif font-bold flex items-center gap-3">
            <Users className="w-6 h-6 text-primary" /> Member Directory
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{filtered.length} members in directory</p>
        </div>
        <Button onClick={() => setEditOpen(true)} className="gap-2">
          <UserCircle className="w-4 h-4" /> {myProfile ? 'Edit My Profile' : 'Create My Profile'}
        </Button>
      </div>

      <Tabs defaultValue="directory">
        <TabsList>
          <TabsTrigger value="directory">Directory</TabsTrigger>
          <TabsTrigger value="my-profile">My Profile</TabsTrigger>
        </TabsList>

        <TabsContent value="directory" className="space-y-4 mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search members, roles…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {isLoading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1,2,3,4,5,6].map(i => <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No members found{search ? ' matching your search' : '. Be the first to create a profile!'}.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(profile => (
                <MemberProfileCard
                  key={profile.id}
                  profile={profile}
                  isOwn={profile.user_email === user?.email}
                  onClick={() => setViewMember(profile)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="my-profile" className="mt-4">
          {myProfile ? (
            <div className="max-w-lg space-y-4">
              <Card>
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center gap-4">
                    {myProfile.profile_photo_url ? (
                      <img src={myProfile.profile_photo_url} alt="" className="w-16 h-16 rounded-full object-cover" />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
                        {myProfile.display_name?.[0] || user?.full_name?.[0] || '?'}
                      </div>
                    )}
                    <div>
                      <h2 className="text-lg font-semibold">{myProfile.display_name || user?.full_name}</h2>
                      {myProfile.ministry_roles?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {myProfile.ministry_roles.map(r => <Badge key={r} variant="secondary" className="text-xs">{r}</Badge>)}
                        </div>
                      )}
                    </div>
                  </div>

                  {myProfile.bio && <p className="text-sm text-muted-foreground">{myProfile.bio}</p>}

                  <div className="p-3 rounded-lg bg-muted/50 border space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5" /> Privacy Settings
                    </p>
                    {[
                      { label: 'Email', key: 'privacy_email' },
                      { label: 'Phone', key: 'privacy_phone' },
                      { label: 'Address', key: 'privacy_address' },
                      { label: 'Birthday', key: 'privacy_birthday' },
                    ].map(({ label, key }) => (
                      <div key={key} className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{label}</span>
                        <Badge variant="outline" className="text-xs capitalize">{(myProfile[key] || 'members_only').replace(/_/g, ' ')}</Badge>
                      </div>
                    ))}
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Show in directory</span>
                      <Badge variant="outline" className={`text-xs ${myProfile.show_in_directory ? 'text-green-600' : 'text-red-500'}`}>
                        {myProfile.show_in_directory ? 'Yes' : 'Hidden'}
                      </Badge>
                    </div>
                  </div>

                  <Button onClick={() => setEditOpen(true)} variant="outline" className="w-full">Edit Profile</Button>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <UserCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>You haven't created a profile yet.</p>
              <Button className="mt-4" onClick={() => setEditOpen(true)}>Create My Profile</Button>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {editOpen && (
        <EditProfileDialog
          profile={myProfile}
          user={user}
          onSave={(data) => saveMutation.mutate(data)}
          onClose={() => setEditOpen(false)}
          isSaving={saveMutation.isPending}
        />
      )}

      {viewMember && (
        <MemberDetailDialog
          profile={viewMember}
          isOwn={viewMember.user_email === user?.email}
          isAdmin={isChurchAdmin}
          onEdit={() => { setViewMember(null); setEditOpen(true); }}
          onClose={() => setViewMember(null)}
        />
      )}
    </div>
  );
}