import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Paperclip, Upload, Trash2, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function DocumentAttachments({ documents = [], onUpdate, canEdit = false }) {
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('File must be under 10MB'); return; }

    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const newDoc = { name: file.name, url: file_url, uploaded_at: new Date().toISOString() };
    onUpdate([...documents, newDoc]);
    setUploading(false);
    toast.success('Document uploaded');
    e.target.value = '';
  };

  const handleDelete = (idx) => {
    onUpdate(documents.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Paperclip className="w-4 h-4 text-muted-foreground" />
          Documents ({documents.length})
        </h4>
        {canEdit && (
          <label className="cursor-pointer">
            <input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" className="hidden" onChange={handleFileChange} disabled={uploading} />
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" asChild>
              <span>
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {uploading ? 'Uploading...' : 'Attach File'}
              </span>
            </Button>
          </label>
        )}
      </div>

      {documents.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No documents attached</p>
      ) : (
        <ul className="space-y-2">
          {documents.map((doc, idx) => (
            <li key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border">
              <FileText className="w-4 h-4 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium truncate hover:underline block">{doc.name}</a>
                {doc.uploaded_at && (
                  <p className="text-xs text-muted-foreground">{format(new Date(doc.uploaded_at), 'MMM d, yyyy')}</p>
                )}
              </div>
              {canEdit && (
                <Button size="icon" variant="ghost" className="w-7 h-7 text-destructive hover:text-destructive flex-shrink-0" onClick={() => handleDelete(idx)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}