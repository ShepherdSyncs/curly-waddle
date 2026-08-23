import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import useAppUser from '@/hooks/useAppUser';
import StatCard from '@/components/dashboard/StatCard';
import AnniversaryWidget from '@/components/dashboard/AnniversaryWidget';
import AdminGivingOverview from '@/components/dashboard/AdminGivingOverview';
import AdminAttendanceOverview from '@/components/dashboard/AdminAttendanceOverview';
import AdminSpiritualOverview from '@/components/dashboard/AdminSpiritualOverview';
import AdminBibleStudyOverview from '@/components/dashboard/AdminBibleStudyOverview';
import MemberDashboard from '@/components/dashboard/MemberDashboard';
import { Users, HandCoins, Droplets, BookOpen } from 'lucide-react';

export default function Dashboard() {
  const { user, isGlobalAdmin, isChurchAdmin, isChurchUser } = useAppUser();
  const churchId = user?.church_id;

  const { data: members = [] } = useQuery({
    queryKey: ['members', churchId],
    queryFn: () => churchId
      ? base44.entities.ChurchMember.filter({ church_id: churchId })
      : isGlobalAdmin ? base44.entities.ChurchMember.list() : [],
    enabled: !!user,
  });

  const { data: giving = [] } = useQuery({
    queryKey: ['giving', churchId],
    queryFn: () => churchId ? base44.entities.GivingRecord.filter({ church_id: churchId }, '-date', 100) : [],
    enabled: !!user && isChurchAdmin && !isGlobalAdmin,
  });

  const { data: spiritual = [] } = useQuery({
    queryKey: ['spiritual', churchId],
    queryFn: () => churchId
      ? base44.entities.SpiritualRecord.filter({ church_id: churchId }, '-date', 100)
      : isGlobalAdmin ? base44.entities.SpiritualRecord.list('-date', 100) : [],
    enabled: !!user && isChurchAdmin,
  });

  const { data: studies = [] } = useQuery({
    queryKey: ['studies', churchId],
    queryFn: () => churchId
      ? base44.entities.BibleStudy.filter({ church_id: churchId }, '-date', 50)
      : isGlobalAdmin ? base44.entities.BibleStudy.list('-date', 50) : [],
    enabled: !!user && isChurchAdmin,
  });

  const totalGiving = giving.reduce((sum, g) => sum + (g.amount || 0), 0);
  const baptisms = spiritual.filter(s => s.type === 'baptism').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-serif font-bold text-foreground">
          {isGlobalAdmin
            ? 'Dashboard'
            : `Welcome${user?.church_name ? ` to ${user.church_name}` : ''}, ${user?.full_name?.split(' ')[0] || 'there'}!`}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isGlobalAdmin ? 'Global overview across all churches' : "Here's your church at a glance"}
        </p>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Members" value={members.length} icon={Users} />
        {isChurchAdmin && !isGlobalAdmin && (
          <StatCard title="Total Giving" value={`$${totalGiving.toLocaleString()}`} icon={HandCoins} />
        )}
        {isChurchAdmin && <StatCard title="Baptisms" value={baptisms} icon={Droplets} />}
        {isChurchAdmin && <StatCard title="Bible Studies" value={studies.length} icon={BookOpen} />}
      </div>

      {/* Church Admin view */}
      {isChurchAdmin && churchId && (
        <>
          <div className="grid md:grid-cols-2 gap-4">
            <AdminGivingOverview churchId={churchId} />
            <AdminAttendanceOverview churchId={churchId} />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <AdminSpiritualOverview churchId={churchId} />
            <AdminBibleStudyOverview churchId={churchId} />
          </div>
          <AnniversaryWidget churchId={churchId} churchName={user?.church_name} />
        </>
      )}

      {/* Regular member view */}
      {!isChurchAdmin && churchId && (
        <MemberDashboard churchId={churchId} user={user} />
      )}
    </div>
  );
}