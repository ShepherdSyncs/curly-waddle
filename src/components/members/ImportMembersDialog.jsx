import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ImportMembersDialog({ churchId, onImportSuccess }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [fieldMap, setFieldMap] = useState({
    first_name: 'first_name',
    last_name: 'last_name',
    email: 'email',
    phone: 'phone',
    address: 'address',
  });
  const [allRecords, setAllRecords] = useState([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  const handleFileSelect = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;

    setFile(f);
    setResult(null);
    toast.loading('Processing file...', { id: 'file' });

    try {
      const uploadRes = await base44.integrations.Core.UploadFile({ file: f });
      const extractRes = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url: uploadRes.file_url,
        json_schema: {
          type: 'object',
          properties: {
            first_name: { type: 'string' },
            last_name: { type: 'string' },
            email: { type: 'string' },
            phone: { type: 'string' },
            address: { type: 'string' },
            date_of_birth: { type: 'string' },
          },
        },
      });

      toast.dismiss('file');

      if (extractRes.status !== 'success' || !extractRes.output) {
        toast.error('Failed to parse file');
        setFile(null);
        return;
      }

      const records = Array.isArray(extractRes.output) ? extractRes.output : [extractRes.output];
      const fileFields = records.length > 0 ? Object.keys(records[0]) : [];

      setAllRecords(records);
      setPreview(records.slice(0, 5));
      setFieldMap({
        first_name: fileFields.find(f => /first.?name|firstname/i.test(f)) || fileFields[0] || 'first_name',
        last_name: fileFields.find(f => /last.?name|lastname|surname/i.test(f)) || fileFields[1] || 'last_name',
        email: fileFields.find(f => /email/i.test(f)) || fileFields.find(f => /e.?mail/i.test(f)) || '',
        phone: fileFields.find(f => /phone|mobile|cell/i.test(f)) || '',
        address: fileFields.find(f => /address|addr/i.test(f)) || '',
      });
    } catch (err) {
      toast.dismiss('file');
      toast.error('File processing failed');
      setFile(null);
    }
  };

  const handleImport = async () => {
    if (allRecords.length === 0) return;

    setImporting(true);
    try {
      // Map fields and create members using already-extracted records
      const mappedRecords = allRecords.map(r => ({
        church_id: churchId,
        first_name: r[fieldMap.first_name] || '',
        last_name: r[fieldMap.last_name] || '',
        email: r[fieldMap.email] || '',
        phone: r[fieldMap.phone] || '',
        address: r[fieldMap.address] || '',
        date_of_birth: r[fieldMap.date_of_birth] || '',
        status: 'active',
      })).filter(m => m.first_name && m.last_name);

      if (mappedRecords.length === 0) {
        toast.error('No valid members to import');
        setImporting(false);
        return;
      }

      const createRes = await base44.entities.ChurchMember.bulkCreate(mappedRecords);
      setResult({ success: true, count: mappedRecords.length });
      toast.success(`Imported ${mappedRecords.length} members`);
      onImportSuccess?.();

      setTimeout(() => {
        setOpen(false);
        setFile(null);
        setPreview([]);
        setAllRecords([]);
        setResult(null);
      }, 2000);
    } catch (err) {
      setResult({ success: false, error: err.message });
      toast.error('Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Upload className="w-4 h-4" />
          Import from File
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Members</DialogTitle>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4 mt-4">
            <div>
              <Label className="text-base">Upload CSV, Excel, or JSON</Label>
              <p className="text-xs text-muted-foreground mt-1">Supports .csv, .xlsx, .json files with member data</p>
              <Input
                type="file"
                accept=".csv,.xlsx,.json"
                onChange={handleFileSelect}
                disabled={importing}
                className="mt-2"
              />
            </div>

            {preview.length > 0 && (
              <>
                <div className="space-y-2">
                  <Label>Map Fields</Label>
                  <p className="text-xs text-muted-foreground">Select which columns correspond to member fields</p>
                  <div className="grid grid-cols-2 gap-3">
                    {['first_name', 'last_name', 'email', 'phone', 'address'].map(field => (
                      <div key={field}>
                        <Label className="text-xs">{field.replace('_', ' ')}</Label>
                        <Select value={fieldMap[field]} onValueChange={v => setFieldMap(prev => ({ ...prev, [field]: v }))}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.keys(preview[0]).map(col => (
                              <SelectItem key={col} value={col} className="text-xs">
                                {col}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>

                <Card className="p-3 bg-muted/40">
                  <Label className="text-xs mb-2 block">Preview (first 5 rows)</Label>
                  <div className="text-xs space-y-1 max-h-40 overflow-y-auto">
                    {preview.map((row, idx) => (
                      <div key={idx} className="flex gap-2 py-1 border-b pb-1 last:border-b-0">
                        <span className="font-medium min-w-fit">{idx + 1}.</span>
                        <span className="text-foreground">{row[fieldMap.first_name] || '?'} {row[fieldMap.last_name] || '?'}</span>
                        {row[fieldMap.email] && <span className="text-muted-foreground">{row[fieldMap.email]}</span>}
                      </div>
                    ))}
                  </div>
                </Card>

                <Button
                  onClick={handleImport}
                  disabled={importing}
                  className="w-full"
                >
                  {importing ? 'Importing...' : `Import ${allRecords.length} Member${allRecords.length !== 1 ? 's' : ''}`}
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="py-6 text-center space-y-3">
            {result.success ? (
              <>
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
                <p className="text-lg font-semibold">Success!</p>
                <p className="text-sm text-muted-foreground">{result.count} members imported</p>
              </>
            ) : (
              <>
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
                <p className="text-lg font-semibold">Import Failed</p>
                <p className="text-sm text-muted-foreground">{result.error}</p>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}