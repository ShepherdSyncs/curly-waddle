import { jsPDF } from 'jspdf';
import { format } from 'date-fns';

const SERVICE_TYPE_LABELS = {
  sunday_morning: 'Sunday Morning',
  sunday_evening: 'Sunday Evening',
  wednesday: 'Wednesday',
  special_event: 'Special Event',
  other: 'Service',
};

// Renders a single service plan (order of service: songs + announcements)
// as a one-page-friendly printable PDF for the worship team / ushers.
export function generateServicePlanPdf({ church, plan, meta, songs = [], announcements = [] }) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const margin = 56;
  const pageBottom = 730;
  let y = margin;

  const ensureRoom = (needed = 16) => {
    if (y + needed > pageBottom) { doc.addPage(); y = margin; }
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(church?.name || 'Service Plan', margin, y);
  y += 22;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  const dateStr = meta?.service_date ? format(new Date(meta.service_date + 'T00:00:00'), 'EEEE, MMMM d, yyyy') : '';
  doc.text([meta?.title, dateStr].filter(Boolean).join(' — '), margin, y);
  y += 16;
  if (meta?.service_type) {
    doc.setTextColor(110);
    doc.text(SERVICE_TYPE_LABELS[meta.service_type] || meta.service_type, margin, y);
    doc.setTextColor(0);
    y += 16;
  }
  if (meta?.notes) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    const wrapped = doc.splitTextToSize(meta.notes, 480);
    doc.text(wrapped, margin, y);
    y += wrapped.length * 13;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
  }

  y += 12;
  doc.setLineWidth(0.75);
  doc.line(margin, y, margin + 480, y);
  y += 22;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Song Set', margin, y);
  y += 20;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  if (songs.length === 0) {
    doc.setTextColor(130);
    doc.text('No songs added yet.', margin, y);
    doc.setTextColor(0);
    y += 18;
  } else {
    songs.forEach((s, i) => {
      ensureRoom(20);
      doc.setFont('helvetica', 'bold');
      doc.text(`${i + 1}.`, margin, y);
      doc.text(s.title || 'Untitled', margin + 20, y);
      doc.setFont('helvetica', 'normal');
      const meta2 = [s.artist, s.key ? `Key: ${s.key}` : null].filter(Boolean).join('  •  ');
      if (meta2) {
        doc.setTextColor(110);
        doc.text(meta2, margin + 300, y);
        doc.setTextColor(0);
      }
      y += 20;
    });
  }

  y += 16;
  ensureRoom(30);
  doc.setLineWidth(0.75);
  doc.line(margin, y, margin + 480, y);
  y += 22;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Announcements', margin, y);
  y += 20;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  if (announcements.length === 0) {
    doc.setTextColor(130);
    doc.text('No announcements added.', margin, y);
    doc.setTextColor(0);
    y += 18;
  } else {
    announcements.forEach((a) => {
      const wrapped = doc.splitTextToSize(`•  ${a.text}`, 480);
      ensureRoom(wrapped.length * 15 + 6);
      doc.text(wrapped, margin, y);
      y += wrapped.length * 15 + 6;
    });
  }

  y += 20;
  ensureRoom(16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`Generated ${format(new Date(), 'MMMM d, yyyy h:mm a')}`, margin, y);

  const safeTitle = (meta?.title || 'service_plan').replace(/[^a-z0-9]+/gi, '_');
  const safeDate = meta?.service_date || format(new Date(), 'yyyy-MM-dd');
  doc.save(`${safeDate}_${safeTitle}.pdf`);
}
