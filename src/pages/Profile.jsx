import React from 'react';
import useAppUser from '@/hooks/useAppUser';
import ProfileTab from '@/components/portal/ProfileTab';

export default function Profile() {
  const { user } = useAppUser();

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-serif font-bold">My Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your personal information and privacy settings.</p>
      </div>
      <ProfileTab user={user} />
    </div>
  );
}