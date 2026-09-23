import React, { useState, useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthenticatedApp } from '@/components/AuthenticatedApp';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { ThemeProvider } from '@/lib/ThemeContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Login from '@/pages/Login';
import { supabase } from '@/supabaseClient';
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import ChurchSelector from '@/components/ChurchSelector';
import SubdomainApp from '@/components/SubdomainApp';
import AppLayout from '@/components/layout/AppLayout';
import Dashboard from '@/pages/Dashboard';
import Churches from '@/pages/Churches';
import Members from '@/pages/Members';
import Attendance from '@/pages/Attendance';
import Giving from '@/pages/Giving';
import SpiritualRecords from '@/pages/SpiritualRecords';
import BibleStudy from '@/pages/BibleStudy';
import Settings from '@/pages/Settings';
import Analytics from '@/pages/Analytics';
import LiveStreamAdmin from '@/pages/LiveStreamAdmin';
import PublicLiveStream from '@/pages/PublicLiveStream';
import PublicGiving from '@/pages/PublicGiving';
import UserPortal from '@/pages/UserPortal';
import BibleStudyGuides from '@/pages/BibleStudyGuides';
import PrayerRequests from '@/pages/PrayerRequests';
import PublicPrayer from '@/pages/PublicPrayer';
import Events from '@/pages/Events';
import SermonArchive from '@/pages/SermonArchive';
import MemberDirectory from '@/pages/MemberDirectory';
import MinistryGroups from '@/pages/MinistryGroups';
import MyMinistrySchedule from '@/pages/MyMinistrySchedule';
import ChurchPortal from '@/pages/ChurchPortal';
import PublicSignup from '@/pages/PublicSignup';
import VerifyMembers from '@/pages/VerifyMembers';
import KioskMode from '@/pages/KioskMode';
import PublicEventSignup from '@/pages/PublicEventSignup';
import UserLogs from '@/pages/UserLogs';
import FollowUpTasks from '@/pages/FollowUpTasks';
import MassTexting from '@/pages/MassTexting';
import ChurchHome from '@/pages/ChurchHome';
import ChurchSubpage from '@/pages/ChurchSubpage';
import ChurchChat from '@/pages/ChurchChat';
import BibleStudyCompanion from '@/pages/BibleStudyCompanion';
import ContactPastoral from '@/pages/ContactPastoral';
import Pricing from '@/pages/Pricing';
import ServiceSchedule from '@/pages/ServiceSchedule';
import Profile from '@/pages/Profile';
import SignUp from '@/pages/SignUp';
import { setDemoMode } from '@/api/base44Client';

const MAIN_HOSTNAMES = new Set([
'shepherdsyncs.com',
'app.shepherdsyncs.com',
'admin.shepherdsyncs.com',
'www.shepherdsyncs.com',
'curly-waddle-alpha.vercel.app',
'localhost',
]);

function isSubdomain() {
const hostname = window.location.hostname;
if (MAIN_HOSTNAMES.has(hostname)) return false;
if (hostname.endsWith('.shepherdsyncs.com')) return true;
return false;
}

function isDemoSubdomain() {
const host = window.location.hostname.split('.')[0];
return host === 'testchurch';
}

const PUBLIC_PATHS = ['/live', '/give', '/pray', '/portal', '/signup', '/get-started', '/kiosk', '/event-signup', '/login', '/forgot-password', '/reset-password'];


function DemoLoader() {
const [ready, setReady] = useState(false);
useEffect(() => {
fetch('https://nzodqfzbowhyrnuauzzr.supabase.co/functions/v1/demo-data').then(r => r.json()).then(d => {
const cache = {};
if (d.church) cache.churches = [d.church];
if (d.members) cache.church_members = d.members;
if (d.attendance) cache.attendance_records = d.attendance;
if (d.giving) cache.giving_records = d.giving;
if (d.events) cache.church_events = d.events;
if (d.groups) cache.ministry_groups = d.groups;
if (d.spiritual) cache.spiritual_records = d.spiritual;
setDemoMode(cache);
setReady(true);
}).catch(() => setReady(true));
}, []);
if (!ready) return (<div className="fixed inset-0 flex items-center justify-center"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>);
return (<ThemeProvider>
<AuthProvider>
<QueryClientProvider client={queryClientInstance}>
<Router>
<AuthenticatedApp />
</Router>
<Toaster />
</QueryClientProvider>
</AuthProvider>
</ThemeProvider>);
}

function App() {
if (isSubdomain()) {
if (isDemoSubdomain()) return <DemoLoader />;
return <SubdomainApp />;
}

return (<ThemeProvider>
<AuthProvider>
<QueryClientProvider client={queryClientInstance}>
<Router>
<AuthenticatedApp />
</Router>
<Toaster />
</QueryClientProvider>
</AuthProvider>
</ThemeProvider>)
}

export default App;
