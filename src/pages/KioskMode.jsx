import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Printer, CheckCircle2, ChevronLeft, Users, X } from 'lucide-react';

// --- Name Tag Print Component (rendered off-screen, then printed) ---
function NameTagPrint({ child, group, ref: fwdRef }) {
  return (
    <div
      ref={fwdRef}
      id="name-tag-print"
      style={{ display: 'none' }}
    >
      <style>{`
        @media print {
          body > *:not(#name-tag-wrapper) { display: none !important; }
          #name-tag-wrapper { display: flex !important; }
          @page { size: 4in 2in; margin: 0; }
        }
      `}</style>
      <div id="name-tag-wrapper" style={{
        display: 'none',
        width: '4in', height: '2in',
        border: '3px solid #1F7A8C',
        borderRadius: 8,
        padding: '12px 16px',
        fontFamily: 'Arial, sans-serif',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: '#ffffff',
        boxSizing: 'border-box',
      }}>
        <div style={{ fontSize: 10, color: '#1F7A8C', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
          ShepherdSyncs · Check-In
        </div>
        <div>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#071920', lineHeight: 1.1 }}>
            {child.first_name} {child.last_name}
          </div>
          {group && (
            <div style={{ fontSize: 13, color: '#1F7A8C', marginTop: 4, fontWeight: 600 }}>
              {group.name}
            </div>
          )}
        </div>
        <div style={{ fontSize: 10, color: '#888' }}>
          {new Date().toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}

export default function KioskMode() {
  const urlParams = new URLSearchParams(window.location.search);
  const churchIdParam = urlParams.get('church_id');

  const [step, setStep] = useState('search'); // search | selectGroup | confirmed
  const [search, setSearch] = useState('');
  const [selectedMember, setSelectedMember] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [checkedIn, setCheckedIn] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const printRef = useRef(null);

  const { data: churches = [] } = useQuery({
    queryKey: ['kiosk-churches'],
    queryFn: () => base44.entities.Church.filter({ status: 'active' }),
    enabled: !churchIdParam,
  });

  const churchId = churchIdParam || (churches[0]?.id ?? null);

  const { data: church } = useQuery({
    queryKey: ['kiosk-church', churchId],
    queryFn: () => base44.entities.Church.filter({ id: churchId }).then(r => r[0]),
    enabled: !!churchId,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['kiosk-members', churchId],
    queryFn: () => base44.entities.ChurchMember.filter({ church_id: churchId, status: 'active' }),
    enabled: !!churchId,
  });

  const { data: groups = [] } = useQuery({
    queryKey: ['kiosk-groups', churchId],
    queryFn: () => base44.entities.MinistryGroup.filter({ church_id: churchId, is_active: true }),
    enabled: !!churchId,
  });

  const filteredMembers = search.length >= 2
    ? members.filter(m =>
        `${m.first_name} ${m.last_name}`.toLowerCase().includes(search.toLowerCase())
      ).slice(0, 8)
    : [];

  const handleSelectMember = (member) => {
    setSelectedMember(member);
    setSearch('');
    setStep('selectGroup');
  };

  const handleCheckIn = async (group) => {
    setSelectedGroup(group);
    setCheckingIn(true);
    // Create a ministry attendance record
    const today = new Date().toISOString().slice(0, 10);
    await base44.entities.MinistryAttendance.create({
      schedule_id: `kiosk-${today}`,
      group_id: group.id,
      church_id: churchId,
      member_name: `${selectedMember.first_name} ${selectedMember.last_name}`,
      member_email: selectedMember.email || '',
      date: today,
      present: true,
      notes: 'Checked in via Kiosk',
    });
    setCheckingIn(false);
    setCheckedIn(true);
    setStep('confirmed');
  };

  const printNameTag = () => {
    // Show the hidden tag and print
    const wrapper = document.getElementById('name-tag-wrapper');
    if (wrapper) wrapper.style.display = 'flex';
    window.print();
    if (wrapper) wrapper.style.display = 'none';
  };

  const resetKiosk = () => {
    setStep('search');
    setSearch('');
    setSelectedMember(null);
    setSelectedGroup(null);
    setCheckedIn(false);
  };

  const groupColors = {
    worship: 'bg-purple-500',
    youth: 'bg-yellow-500',
    greeters: 'bg-green-500',
    pastoral: 'bg-blue-500',
    prayer: 'bg-indigo-500',
    media: 'bg-pink-500',
    hospitality: 'bg-orange-500',
    outreach: 'bg-teal-500',
    other: 'bg-gray-500',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#071920] to-[#0B2A33] flex flex-col items-center justify-start p-6 pt-10">
      {/* Hidden name tag for printing */}
      <div id="name-tag-print">
        <style>{`
          @media print {
            body > *:not(#name-tag-print) { display: none !important; }
            #name-tag-print { display: block !important; }
            #name-tag-wrapper { display: flex !important; width: 4in; height: 2in; }
            @page { size: 4in 2in; margin: 0; }
          }
        `}</style>
        <div id="name-tag-wrapper" style={{
          display: 'none',
          width: '4in', height: '2in',
          border: '3px solid #1F7A8C',
          borderRadius: 8,
          padding: '12px 16px',
          fontFamily: 'Arial, sans-serif',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: '#ffffff',
          boxSizing: 'border-box',
        }}>
          <div style={{ fontSize: 10, color: '#1F7A8C', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
            ShepherdSyncs · Check-In
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#071920', lineHeight: 1.1 }}>
              {selectedMember ? `${selectedMember.first_name} ${selectedMember.last_name}` : ''}
            </div>
            {selectedGroup && (
              <div style={{ fontSize: 13, color: '#1F7A8C', marginTop: 4, fontWeight: 600 }}>
                {selectedGroup.name}
              </div>
            )}
          </div>
          <div style={{ fontSize: 10, color: '#888' }}>
            {new Date().toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight">
          {church?.name || 'Church Check-In'}
        </h1>
        <p className="text-[#9DA7AC] mt-1 text-lg">Welcome! Let's get you checked in.</p>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-2xl bg-white/10 backdrop-blur-sm border border-white/10 rounded-2xl p-8 shadow-2xl">

        {/* STEP: Search */}
        {step === 'search' && (
          <div className="space-y-6">
            <div className="text-center">
              <p className="text-white/80 text-xl font-medium mb-6">Search by name to check in</p>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                <Input
                  autoFocus
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Type first or last name..."
                  className="pl-12 h-14 text-lg bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-[#2FA4B5] focus:ring-[#2FA4B5]"
                />
              </div>
            </div>

            {search.length >= 2 && (
              <div className="space-y-2">
                {filteredMembers.length === 0 ? (
                  <p className="text-center text-white/50 py-4">No members found for "{search}"</p>
                ) : (
                  filteredMembers.map(member => (
                    <button
                      key={member.id}
                      onClick={() => handleSelectMember(member)}
                      className="w-full flex items-center gap-4 p-4 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 hover:border-[#2FA4B5] transition-all text-left group"
                    >
                      <div className="w-12 h-12 rounded-full bg-[#1F7A8C] flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                        {member.first_name[0]}{member.last_name[0]}
                      </div>
                      <div>
                        <p className="text-white font-semibold text-lg">{member.first_name} {member.last_name}</p>
                        {member.email && <p className="text-white/50 text-sm">{member.email}</p>}
                      </div>
                      <div className="ml-auto text-white/30 group-hover:text-[#2FA4B5] text-2xl">→</div>
                    </button>
                  ))
                )}
              </div>
            )}

            {search.length < 2 && (
              <p className="text-center text-white/30 text-sm pt-2">Type at least 2 characters to search</p>
            )}
          </div>
        )}

        {/* STEP: Select Group */}
        {step === 'selectGroup' && selectedMember && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <button onClick={resetKiosk} className="text-white/50 hover:text-white transition-colors">
                <ChevronLeft className="w-6 h-6" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#1F7A8C] flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                  {selectedMember.first_name[0]}{selectedMember.last_name[0]}
                </div>
                <div>
                  <p className="text-white font-bold text-xl">{selectedMember.first_name} {selectedMember.last_name}</p>
                  <p className="text-white/50 text-sm">Select a ministry group to check into</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {groups.map(group => (
                <button
                  key={group.id}
                  onClick={() => handleCheckIn(group)}
                  disabled={checkingIn}
                  className="flex items-center gap-3 p-4 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 hover:border-[#2FA4B5] transition-all text-left disabled:opacity-50"
                >
                  <div className={`w-10 h-10 rounded-lg ${groupColors[group.category] || groupColors.other} flex items-center justify-center flex-shrink-0`}>
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">{group.name}</p>
                    {group.category && <p className="text-white/50 text-xs capitalize">{group.category}</p>}
                  </div>
                </button>
              ))}
              {groups.length === 0 && (
                <p className="col-span-2 text-center text-white/40 py-4">No active ministry groups found</p>
              )}
            </div>
          </div>
        )}

        {/* STEP: Confirmed */}
        {step === 'confirmed' && selectedMember && selectedGroup && (
          <div className="text-center space-y-6 py-4">
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-green-500/20 border-2 border-green-400 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-green-400" />
              </div>
            </div>
            <div>
              <p className="text-white text-3xl font-bold">{selectedMember.first_name}!</p>
              <p className="text-white/70 text-lg mt-2">
                You're checked into <span className="text-[#2FA4B5] font-semibold">{selectedGroup.name}</span>
              </p>
              <p className="text-white/40 text-sm mt-1">
                {new Date().toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={printNameTag}
                variant="outline"
                className="gap-2 border-white/20 text-white hover:bg-white/10 h-12 px-6"
              >
                <Printer className="w-5 h-5" />
                Print Name Tag
              </Button>
              <Button
                onClick={resetKiosk}
                className="gap-2 bg-[#1F7A8C] hover:bg-[#2FA4B5] h-12 px-6"
              >
                Check In Next Person
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-8 flex flex-col items-center gap-3">
        <button
          onClick={() => { window.close(); window.location.href = '/'; }}
          className="text-white/20 hover:text-white/50 text-xs transition-colors flex items-center gap-1.5"
        >
          <X className="w-3 h-3" /> Exit Kiosk
        </button>
        <p className="text-white/20 text-xs">
          Powered by ShepherdSyncs · Kiosk Mode
          {churchIdParam ? '' : ' · Add ?church_id=YOUR_ID to URL to lock to a specific church'}
        </p>
      </div>
    </div>
  );
}