import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Upload, RefreshCw, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { toast } from 'sonner';

// Fields we can sync from Planning Center → ChurchMember
const PC_FIELD_MAP = {
  first_name:    ['First Name', 'first_name', 'FirstName'],
  last_name:     ['Last Name', 'last_name', 'LastName', 'Surname'],
  email:         ['Email', 'email', 'Email Address', 'Primary Email'],
  phone:         ['Phone', 'phone', 'Mobile', 'Cell Phone', 'Home Phone', 'Primary Phone'],
  address:       ['Address', 'address', 'Street Address', 'Home Address'],
  date_of_birth: ['Birthdate', 'date_of_birth', 'Birth Date', 'Birthday', 'Date of Birth'],
  join_date:     ['Membership Date', 'join_date', 'Member Since', 'Joined', 'Anniversary'],
  status:        ['Status', 'status', 'Membership Status'],
};

// Normalize a Planning Center status value to our enum
function normalizeStatus(val) {
  if (!val) return null;
  const v = val.toLowerCase();
  if (v.includes('active') || v.includes('member')) return 'active';
  if (v.includes('inactive') || v.includes('former')) return 'inactive';
  if (v.includes('visitor') || v.includes('guest')) return 'visitor';
  return null;
}

// Try to find the value for a ShepherdSyncs field from a CSV row
function extractField(row, fieldName) {
  const candidates = PC_FIELD_MAP[fieldName] || [];
  for (const key of candidates) {
    if (row[key] !== undefined && row[key] !== '') return row[key];
  }
  return null;
}

// Parse a simple CSV string into array of objects
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    // Handle quoted fields with commas inside
    const values = [];
    let inQuote = false, cur = '';
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === ',' && !inQuote) { values.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    values.push(cur.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (values[i] || '').replace(/^"|"$/g, ''); });
    return obj;
  });
}

export default function PlanningCenterImport({ churchId, existingMembers, onDone }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(null); // { matched, unmatched, new }
  const [rawRows, setRawRows] = useState([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const rows = parseCSV(text);
    if (rows.length === 0) { toast.error('Could not parse CSV — check the file format'); return; }

    setRawRows(rows);

    // Match each PC row to an existing member by email (primary) or first+last name (fallback)
    const matched = [];
    const newMembers = [];

    for (const row of rows) {
      const pcEmail = extractField(row, 'email')?.toLowerCase().trim();
      const pcFirst = extractField(row, 'first_name')?.trim().toLowerCase();
      const pcLast  = extractField(row, 'last_name')?.trim().toLowerCase();

      let found = null;
      if (pcEmail) {
        found = existingMembers.find(m => m.email?.toLowerCase().trim() === pcEmail);
      }
      if (!found && pcFirst && pcLast) {
        found = existingMembers.find(m =>
          m.first_name?.toLowerCase().trim() === pcFirst &&
          m.last_name?.toLowerCase().trim() === pcLast
        );
      }

      // Build the fields that would be updated
      const updates = {};
      for (const field of ['email','phone','address','date_of_birth','join_date']) {
        const val = extractField(row, field);
        if (val) updates[field] = val;
      }
      const status = normalizeStatus(extractField(row, 'status'));
      if (status) updates.status = status;

      if (found) {
        matched.push({ member: found, updates, row });
      } else {
        newMembers.push({ row, updates });
      }
    }

    setPreview({ matched, new: newMembers });
  };

  const handleImport = async () => {
    if (!preview) return;
    setImporting(true);

    let updated = 0;
    let skipped = 0;

    for (const { member, updates } of preview.matched) {
      if (Object.keys(updates).length === 0) { skipped++; continue; }
      await base44.entities.ChurchMember.update(member.id, updates);
      updated++;
    }

    setResult({ updated, skipped, newCount: preview.new.length });
    setImporting(false);
    toast.success(`Updated ${updated} member${updated !== 1 ? 's' : ''}`);
    onDone?.();
  };

  const reset = () => {
    setPreview(null);
    setRawRows([]);
    setResult(null);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Sync from Planning Center
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-primary" /> Planning Center CSV Sync
          </DialogTitle>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4 mt-2">
            {/* Instructions */}
            <div className="flex gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                Export your people list from Planning Center Online: <strong>People → Export → CSV</strong>.
                This will match records by email or name and fill in missing/updated info without creating duplicates.
              </div>
            </div>

            <div>
              <Input type="file" accept=".csv" onChange={handleFile} />
            </div>

            {preview && (
              <div className="space-y-3">
                {/* Summary badges */}
                <div className="flex flex-wrap gap-2">
                  <Badge className="bg-green-100 text-green-700 gap-1">
                    <CheckCircle2 className="w-3 h-3" /> {preview.matched.length} matched
                  </Badge>
                  <Badge className="bg-gray-100 text-gray-600 gap-1">
                    {preview.new.length} not found in ShepherdSyncs
                  </Badge>
                </div>

                {/* Matched preview */}
                {preview.matched.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Will be updated</p>
                    <div className="border rounded-lg divide-y max-h-52 overflow-y-auto">
                      {preview.matched.map(({ member, updates }, i) => (
                        <div key={i} className="flex items-center gap-3 px-3 py-2">
                          <div className="w-7 h-7 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {member.first_name?.[0]}{member.last_name?.[0]}
                          </div>
                          <span className="flex-1 text-sm font-medium">{member.first_name} {member.last_name}</span>
                          <div className="flex flex-wrap gap-1">
                            {Object.keys(updates).map(k => (
                              <Badge key={k} variant="outline" className="text-xs py-0 px-1.5">{k.replace(/_/g, ' ')}</Badge>
                            ))}
                            {Object.keys(updates).length === 0 && (
                              <span className="text-xs text-muted-foreground">no changes</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Unmatched */}
                {preview.new.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                      Not found (will be skipped — add manually if needed)
                    </p>
                    <div className="border border-dashed rounded-lg divide-y max-h-32 overflow-y-auto">
                      {preview.new.map(({ row }, i) => {
                        const fn = extractField(row, 'first_name') || '?';
                        const ln = extractField(row, 'last_name') || '?';
                        return (
                          <div key={i} className="flex items-center gap-3 px-3 py-2">
                            <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-xs font-bold flex-shrink-0">
                              {fn[0]}{ln[0]}
                            </div>
                            <span className="text-sm text-muted-foreground">{fn} {ln}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <Button
                  className="w-full"
                  onClick={handleImport}
                  disabled={importing || preview.matched.filter(m => Object.keys(m.updates).length > 0).length === 0}
                >
                  {importing
                    ? 'Updating...'
                    : `Update ${preview.matched.filter(m => Object.keys(m.updates).length > 0).length} Member${preview.matched.filter(m => Object.keys(m.updates).length > 0).length !== 1 ? 's' : ''}`}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="py-8 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
            <p className="text-lg font-semibold">Sync Complete</p>
            <div className="flex justify-center gap-3 flex-wrap">
              <Badge className="bg-green-100 text-green-700">{result.updated} updated</Badge>
              {result.skipped > 0 && <Badge className="bg-gray-100 text-gray-600">{result.skipped} already up to date</Badge>}
              {result.newCount > 0 && <Badge className="bg-yellow-100 text-yellow-700">{result.newCount} not found (skipped)</Badge>}
            </div>
            <Button variant="outline" size="sm" onClick={reset}>Import Another File</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}