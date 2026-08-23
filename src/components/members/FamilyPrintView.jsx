import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Printer, Mail, List } from 'lucide-react';

function MailingLabels({ groups, memberMap }) {
  return (
    <div id="mailing-labels-content" style={{ fontFamily: 'Arial, sans-serif' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', padding: '16px' }}>
        {groups.map(group => {
          const head = memberMap[group.head_of_household_id];
          const address = head?.address || '';
          if (!address) return null;
          const cityStateZip = [head?.city, head?.state].filter(Boolean).join(', ');
          return (
            <div key={group.id} style={{
              border: '1px solid #ccc',
              borderRadius: '4px',
              padding: '12px 14px',
              minHeight: '80px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}>
              <div style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '2px' }}>{group.family_name}</div>
              <div style={{ fontSize: '12px' }}>{address}</div>
              {cityStateZip && <div style={{ fontSize: '12px' }}>{cityStateZip}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GeneralDirectory({ groups, memberMap }) {
  return (
    <div id="general-directory-content" style={{ fontFamily: 'Arial, sans-serif', padding: '24px' }}>
      <h2 style={{ textAlign: 'center', fontSize: '20px', fontWeight: 'bold', marginBottom: '24px', color: '#1e293b' }}>
        Church Family Directory
      </h2>
      {groups.map(group => {
        const head = memberMap[group.head_of_household_id];
        const familyMembers = (group.members || []).map(fm => memberMap[fm.member_id]).filter(Boolean);
        const allMembers = [{ member: head, isHead: true }, ...familyMembers.map(m => ({ member: m, isHead: false }))];

        return (
          <div key={group.id} style={{
            marginBottom: '20px',
            padding: '14px 16px',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            pageBreakInside: 'avoid',
          }}>
            <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#0f172a', marginBottom: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
              {group.family_name}
            </div>
            {allMembers.map(({ member, isHead }, i) => {
              if (!member) return null;
              return (
                <div key={member.id || i} style={{ display: 'flex', gap: '16px', marginBottom: '4px', fontSize: '13px', alignItems: 'flex-start' }}>
                  <div style={{ minWidth: '160px', fontWeight: isHead ? '600' : '400', color: '#1e293b' }}>
                    {member.first_name} {member.last_name}
                    {isHead && <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '4px' }}>(HH)</span>}
                  </div>
                  <div style={{ minWidth: '180px', color: '#475569' }}>{member.address || '—'}</div>
                  <div style={{ color: '#475569' }}>{member.phone || '—'}</div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export default function FamilyPrintView({ groups, memberMap }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('directory'); // 'labels' | 'directory'

  const handlePrint = () => {
    const contentId = mode === 'labels' ? 'mailing-labels-content' : 'general-directory-content';
    const content = document.getElementById(contentId);
    if (!content) return;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>${mode === 'labels' ? 'Mailing Labels' : 'Family Directory'}</title>
          <style>
            body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
            @media print {
              @page { margin: 0.5in; }
              button { display: none !important; }
            }
          </style>
        </head>
        <body>${content.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const groupsWithAddress = groups.filter(g => {
    const head = memberMap[g.head_of_household_id];
    return !!head?.address;
  });

  return (
    <>
      <Button size="sm" variant="outline" className="gap-2" onClick={() => setOpen(true)}>
        <Printer className="w-4 h-4" /> Print / Export
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Print Family List</DialogTitle>
          </DialogHeader>

          {/* Mode toggle */}
          <div className="flex gap-2 border-b pb-3">
            <Button
              size="sm"
              variant={mode === 'directory' ? 'default' : 'outline'}
              className="gap-2"
              onClick={() => setMode('directory')}
            >
              <List className="w-4 h-4" /> General Directory
            </Button>
            <Button
              size="sm"
              variant={mode === 'labels' ? 'default' : 'outline'}
              className="gap-2"
              onClick={() => setMode('labels')}
            >
              <Mail className="w-4 h-4" /> Mailing Labels
            </Button>
            <div className="ml-auto">
              <Button size="sm" className="gap-2" onClick={handlePrint}>
                <Printer className="w-4 h-4" /> Print / Save as PDF
              </Button>
            </div>
          </div>

          {mode === 'labels' && groupsWithAddress.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No family heads have addresses on file. Add addresses to member records to generate mailing labels.
            </p>
          )}

          {/* Preview */}
          <div className="flex-1 overflow-auto bg-white rounded border text-foreground" style={{ color: '#000' }}>
            {mode === 'labels' ? (
              <MailingLabels groups={groupsWithAddress} memberMap={memberMap} />
            ) : (
              <GeneralDirectory groups={groups} memberMap={memberMap} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}