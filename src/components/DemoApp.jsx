import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/lib/ThemeContext';
import { base44, setDemoMode } from '@/api/base44Client';
import AppLayout from '@/components/layout/AppLayout';
import Dashboard from '@/pages/Dashboard';
import Members from '@/pages/Members';
import Attendance from '@/pages/Attendance';
import Giving from '@/pages/Giving';
import BibleStudy from '@/pages/BibleStudy';
import Settings from '@/pages/Settings';
import Analytics from '@/pages/Analytics';
import LiveStreamAdmin from '@/pages/LiveStreamAdmin';
import Events from '@/pages/Events';
import SermonArchive from '@/pages/SermonArchive';
import MemberDirectory from '@/pages/MemberDirectory';
import MinistryGroups from '@/pages/MinistryGroups';
import PrayerRequests from '@/pages/PrayerRequests';
import ChurchChat from '@/pages/ChurchChat';
import ContactPastoral from '@/pages/ContactPastoral';
import MassTexting from '@/pages/MassTexting';
import FollowUpTasks from '@/pages/FollowUpTasks';
import { Toaster } from '@/components/ui/toaster';
import { toast } from 'sonner';

const DemoAuthContext = createContext();
export const useDemoAuth = () => useContext(DemoAuthContext);

const DEMO_API = 'https://nzodqfzbowhyrnuauzzr.supabase.co/functions/v1/demo-data';

const tableMap = {
Church: 'churches', User: 'users', ChurchMember: 'church_members',
AttendanceRecord: 'attendance_records', GivingRecord: 'giving_records',
ChurchEvent: 'church_events', MinistryGroup: 'ministry_groups',
SpiritualRecord: 'spiritual_records',
};

export default function DemoApp() {
const [ready, setReady] = useState(false);
const [church, setChurch] = useState(null);

useEffect(() => {
fetch(DEMO_API).then(r => r.json()).then(d => {
const cache = {};
for (const [key, table] of Object.entries(tableMap)) {
if (d[key.toLowerCase()]) cache[table] = d[key.toLowerCase()];
}
if (d.church) cache.churches = [d.church];
if (d.members) cache.church_members = d.members;
if (d.attendance) cache.attendance_records = d.attendance;
if (d.giving) cache.giving_records = d.giving;
if (d.events) cache.church_events = d.events;
if (d.groups) cache.ministry_groups = d.groups;
if (d.spiritual) cache.spiritual_records = d.spiritual;
setDemoMode(cache);
setChurch(d.church);
setReady(true);
}).catch(() => { setReady(true); });
}, []);

if (!ready) return (<div className="fixed inset-0 flex items-center justify-center"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>);

const user = { email: 'demo@shepherdsyncs.com', full_name: 'Demo Admin', role: 'church_admin', church_id: church?.id, church_name: church?.name };

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });

return (<DemoAuthContext.Provider value={{ user, isAuthenticated: true, isLoadingAuth: false, authChecked: true, authError: null, isChurchAdmin: true, selectedChurchId: church?.id, availableChurches: [], selectChurchId: () => {}, navigateToLogin: () => {} }}>
<ThemeProvider>
<QueryClientProvider client={qc}>
<Router>
<div className="bg-primary text-primary-foreground px-6 py-2 text-center text-sm font-medium sticky top-0 z-[100]">
Demo Mode - Explore freely, nothing is saved. <a href="/login" className="underline ml-2">Sign up for real</a>
</div>
<AppLayout>
<Routes>
<Route path="/" element={<Dashboard />} />
<Route path="/members" element={<Members />} />
<Route path="/attendance" element={<Attendance />} />
<Route path="/giving" element={<Giving />} />
<Route path="/bible-study" element={<BibleStudy />} />
<Route path="/settings" element={<Settings />} />
<Route path="/analytics" element={<Analytics />} />
<Route path="/livestream" element={<LiveStreamAdmin />} />
<Route path="/events" element={<Events />} />
<Route path="/sermons" element={<SermonArchive />} />
<Route path="/directory" element={<MemberDirectory />} />
<Route path="/ministry" element={<MinistryGroups />} />
<Route path="/prayer" element={<PrayerRequests />} />
<Route path="/chat" element={<ChurchChat />} />
<Route path="/contact-pastoral" element={<ContactPastoral />} />
<Route path="/mass-texting" element={<MassTexting />} />
<Route path="/follow-up" element={<FollowUpTasks />} />
</Routes>
</AppLayout>
</Router>
<Toaster />
</QueryClientProvider>
</ThemeProvider>
</DemoAuthContext.Provider>);
}
