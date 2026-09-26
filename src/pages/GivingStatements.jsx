import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import useAppUser from '@/hooks/useAppUser';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, Receipt, Loader2, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { groupRecordsByDonor, generateStatementPdf } from '@/lib/givingStatement';

export default function GivingStatements() {
  const { user, isChurchAdmin, isGlobalAdmin, myChurches } = useAppUser();
  const churchId = user?.church_id;
  const isAdmin = isChurchAdmin || isGlobalAdmin;
  const church = myChurches?.find(c => c.id === churchId);
  const queryClient = useQueryClient();

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear - 1));
  const [ein, setEin] = useState('');
  const [savingEin, setSavingEin] = useState(false);
  const [downloadingKey, setDownloadingKey] = useState(null);
  const [downloadingAll, setDownloadingAll] = useState(false);

  React.useEffect(() => { if (church?.ein) setEin(church.ein); }, [church?.ein]);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['giving-records-statements', churchId, year],
    queryFn: () => base44.entities.GivingRecord.filter({ church_id: churchId }, '-date', 5000),
    enabled: !!churchId,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['members-statements', churchId],
    queryFn: () => base44.entities.ChurchMember.filter({ church_id: churchId }),
    enabled: !!churchId,
  });

  const membersById = useMemo(() => Object.fromEntries(members.map(m => [m.id, m])), [members]);

  const yearRecords = useMemo(() => records.filter(r => r.date?.startsWith(year)), [records, year]);
  const donors = useMemo(() => groupRecordsByDonor(yearRecords, membersById), [yearRecords, membersById]);

  const availableYears = useMemo(() => {
    const years = new Set(records.map(r => r.date?.slice(0, 4)).filter(Boolean));
    years.add(String(currentYear));
    years.add(String(currentYear - 1));
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [records, currentYear]);

  const churchInfo = { ...church, ein: ein || church?.ein };

  const saveEin = async () => {
    if (!churchId) return;
    setSavingEin(true);
    try {
      await base44.entities.Church.update(churchId, { ein });
      queryClient.invalidateQueries({ queryKey: ['churches'] });
      toast.success('Tax ID saved');
    } catch (err) {
      toast.error(err.message || 'Failed to save');
    }
    setSavingEin(false);
  };

  const downloadOne = (donor) => {
    setDownloadingKey(donor.key);
    try {
      generateStatementPdf({ church: churchInfo, donor, year });
    } catch (err) {
      toast.error('Failed to generate PDF');
    }
    setDownloadingKey(null);
  };

  const downloadAll = async () => {
    setDownloadingAll(true);
    for (let i = 0; i < donors.length; i++) {
      generateStatementPdf({ church: churchInfo, donor: donors[i], year });
      // Small delay between downloads so the browser doesn't block them as a popup flood.
      await new Promise(res => setTimeout(res, 400));
    }
    setDownloadingAll(false);
    toast.success(`Generated ${donors.length} statements`);
  };

  if (!churchId) return <div className="text-center py-12 text-muted-foreground">No church assigned</div>;
  if (!isAdmin) return <div className="text-center py-12 text-muted-foreground">Access restricted</div>;

  const grandTotal = donors.reduce((s, d) => s + d.total, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-serif font-bold flex items-center gap-2">
            <Receipt className="w-7 h-7 text-primary" />
            Giving Statements
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Year-end contribution statements for your donors, ready to download.</p>
        </div>
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            {availableYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Building2 className="w-4 h-4" /> Organization Tax Info</CardTitle>
          <CardDescription>Appears on every statement. Optional, but recommended for donors' tax records.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-end gap-2 flex-wrap">
          <div className="flex-1 min-w-[220px]">
            <Label className="text-xs mb-1 block">EIN / Tax ID</Label>
            <Input value={ein} onChange={(e) => setEin(e.target.value)} placeholder="12-3456789" />
          </div>
          <Button size="sm" variant="outline" onClick={saveEin} disabled={savingEin}>{savingEin ? 'Saving…' : 'Save'}</Button>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Badge variant="secondary">{donors.length} donors</Badge>
          <Badge variant="secondary">${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} total</Badge>
        </div>
        {donors.length > 0 && (
          <Button onClick={downloadAll} disabled={downloadingAll} className="gap-2">
            {downloadingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {downloadingAll ? 'Generating…' : `Download All (${donors.length})`}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : donors.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p>No completed gifts recorded for {year}.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-1.5">
          {donors.map(donor => (
            <Card key={donor.key}>
              <CardContent className="p-3.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{donor.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {donor.email || 'No email on file'} · {donor.records.length} gift{donor.records.length !== 1 ? 's' : ''}
                    {!donor.member_id && <span className="text-amber-600"> · not linked to a member record</span>}
                  </p>
                </div>
                <p className="font-bold text-sm flex-shrink-0">${donor.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                <Button
                  size="sm" variant="outline" className="gap-1.5 flex-shrink-0"
                  onClick={() => downloadOne(donor)}
                  disabled={downloadingKey === donor.key}
                >
                  <Download className="w-3.5 h-3.5" /> PDF
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
