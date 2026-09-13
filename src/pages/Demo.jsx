import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const API = 'https://nzodqfzbowhyrnuauzzr.supabase.co/functions/v1/demo-data';

export default function Demo() {
const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);
useEffect(() => {
fetch(API).then(r => r.json()).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
}, []);
if (loading) return (<div className="fixed inset-0 flex items-center justify-center"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>);
const { church, members, attendance, giving, events, groups } = data || {};
const totalGiving = (giving || []).reduce((s, g) => s + (parseFloat(g.amount) || 0), 0);
const avgAttendance = attendance && attendance.length? Math.round(attendance.reduce((s, a) => s + (parseInt(a.count) || 0), 0) / attendance.length): 0;
return (<div className="min-h-screen bg-background">
<div className="bg-primary text-primary-foreground px-6 py-3 text-center text-sm font-medium">Demo Mode - Explore ShepherdSyncs freely. No data is saved.</div>
<div className="max-w-6xl mx-auto px-4 py-8">
<div className="text-center mb-8">
<h1 className="text-3xl font-bold">{church?.name || 'ShepherdSyncs Demo'}</h1>
{church?.city && church?.state && <p className="text-muted-foreground mt-1">{church.city}, {church.state}</p>}
<p className="text-sm text-muted-foreground mt-2">Live data from a real church, shown read-only.</p>
</div>
<div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
<div className="bg-card border rounded-lg p-4 text-center"><p className="text-3xl font-bold">{members?.length || 0}</p><p className="text-xs text-muted-foreground mt-1">Members</p></div>
<div className="bg-card border rounded-lg p-4 text-center"><p className="text-3xl font-bold">{avgAttendance}</p><p className="text-xs text-muted-foreground mt-1">Avg Attendance</p></div>
<div className="bg-card border rounded-lg p-4 text-center"><p className="text-3xl font-bold">${totalGiving.toLocaleString()}</p><p className="text-xs text-muted-foreground mt-1">Total Giving</p></div>
<div className="bg-card border rounded-lg p-4 text-center"><p className="text-3xl font-bold">{events?.length || 0}</p><p className="text-xs text-muted-foreground mt-1">Events</p></div>
</div>
<Tabs defaultValue="members" className="w-full">
<TabsList className="w-full flex flex-wrap"><TabsTrigger value="members">Members</TabsTrigger><TabsTrigger value="attendance">Attendance</TabsTrigger><TabsTrigger value="giving">Giving</TabsTrigger><TabsTrigger value="events">Events</TabsTrigger><TabsTrigger value="ministry">Ministry</TabsTrigger></TabsList>
<TabsContent value="members" className="mt-4"><div className="bg-card border rounded-lg overflow-hidden"><div className="px-4 py-3 border-b font-semibold">Church Members</div><div className="divide-y">{members?.map(m => (<div key={m.id} className="px-4 py-3 flex justify-between items-center"><div><p className="font-medium">{m.full_name || 'Unknown'}</p><p className="text-xs text-muted-foreground">{m.email || ''}</p></div><span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">{m.role || 'Member'}</span></div>))}{!members?.length && <p className="px-4 py-6 text-center text-muted-foreground">No members yet</p>}</div></div></TabsContent>
<TabsContent value="attendance" className="mt-4"><div className="bg-card border rounded-lg overflow-hidden"><div className="px-4 py-3 border-b font-semibold">Attendance Records</div><div className="divide-y">{attendance?.map(a => (<div key={a.id} className="px-4 py-3 flex justify-between items-center"><p className="font-medium">{a.service_type || 'Service'}</p><div className="text-right"><p className="font-semibold">{a.count || 0}</p><p className="text-xs text-muted-foreground">{a.created_date? new Date(a.created_date).toLocaleDateString(): ''}</p></div></div>))}{!attendance?.length && <p className="px-4 py-6 text-center text-muted-foreground">No records</p>}</div></div></TabsContent>
<TabsContent value="giving" className="mt-4"><div className="bg-card border rounded-lg overflow-hidden"><div className="px-4 py-3 border-b font-semibold">Giving</div><div className="divide-y">{giving?.map(g => (<div key={g.id} className="px-4 py-3 flex justify-between items-center"><div><p className="font-medium">{g.donor_name || g.type || 'Donation'}</p><p className="text-xs text-muted-foreground">{g.created_date? new Date(g.created_date).toLocaleDateString(): ''}</p></div><p className="font-semibold text-emerald-600">${parseFloat(g.amount || 0).toFixed(2)}</p></div>))}{!giving?.length && <p className="px-4 py-6 text-center text-muted-foreground">No giving records</p>}</div></div></TabsContent>
<TabsContent value="events" className="mt-4"><div className="bg-card border rounded-lg overflow-hidden"><div className="px-4 py-3 border-b font-semibold">Events</div><div className="divide-y">{events?.map(e => (<div key={e.id} className="px-4 py-3"><p className="font-medium">{e.title || e.name || 'Event'}</p><p className="text-xs text-muted-foreground mt-1">{e.description || ''} {e.event_date? ' - ' + new Date(e.event_date).toLocaleDateString(): ''}</p></div>))}{!events?.length && <p className="px-4 py-6 text-center text-muted-foreground">No events</p>}</div></div></TabsContent>
<TabsContent value="ministry" className="mt-4"><div className="bg-card border rounded-lg overflow-hidden"><div className="px-4 py-3 border-b font-semibold">Ministry Groups</div><div className="divide-y">{groups?.map(g => (<div key={g.id} className="px-4 py-3"><p className="font-medium">{g.name || 'Group'}</p><p className="text-xs text-muted-foreground mt-1">{g.description || ''}</p></div>))}{!groups?.length && <p className="px-4 py-6 text-center text-muted-foreground">No groups</p>}</div></div></TabsContent>
</Tabs>
<div className="mt-10 text-center bg-card border rounded-lg p-8">
<h2 className="text-xl font-bold mb-2">Ready for your church?</h2>
<p className="text-muted-foreground mb-4">Member management, attendance, giving, live streaming, and more all in one place.</p>
<a href="/login" className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:opacity-90">Get Started</a>
</div>
</div>
</div>);
}
