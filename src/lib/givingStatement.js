import { jsPDF } from 'jspdf';
import { format } from 'date-fns';

const FUND_LABELS = {
  tithe: 'Tithe',
  offering: 'General Offering',
  missions: 'Missions',
  building_fund: 'Building Fund',
  benevolence: 'Benevolence',
  other: 'Other',
};

// Groups a year's worth of giving_records into one entry per donor.
// Prefers member_id as the identity key (most reliable — tied to a real
// ChurchMember row), then donor_email / member_email, then falls back to
// the free-text member_name for gifts that were never linked to a member.
export function groupRecordsByDonor(records, membersById = {}) {
  const groups = new Map();

  for (const r of records) {
    if (r.status && !['completed'].includes(r.status)) continue; // skip pending/failed/refunded

    const key = r.member_id || r.donor_email || r.member_email || `name:${(r.member_name || 'Anonymous').trim().toLowerCase()}`;
    if (!groups.has(key)) {
      const member = r.member_id ? membersById[r.member_id] : null;
      groups.set(key, {
        key,
        member_id: r.member_id || null,
        name: member ? `${member.first_name} ${member.last_name}`.trim() : (r.member_name || 'Anonymous'),
        email: member?.email || r.donor_email || r.member_email || '',
        address: member?.address || '',
        records: [],
        total: 0,
      });
    }
    const g = groups.get(key);
    g.records.push(r);
    g.total += Number(r.amount) || 0;
  }

  return Array.from(groups.values()).sort((a, b) => b.total - a.total);
}

export function generateStatementPdf({ church, donor, year }) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const margin = 56;
  let y = margin;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(church?.name || 'Church', margin, y);
  y += 20;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const churchLines = [
    [church?.address, church?.city, church?.state].filter(Boolean).join(', '),
    church?.phone,
    church?.email,
    church?.ein ? `EIN: ${church.ein}` : null,
  ].filter(Boolean);
  churchLines.forEach(line => { doc.text(line, margin, y); y += 14; });

  y += 16;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(`${year} Annual Contribution Statement`, margin, y);
  y += 24;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text('Prepared for:', margin, y);
  y += 14;
  doc.setFont('helvetica', 'bold');
  doc.text(donor.name || 'Donor', margin, y);
  doc.setFont('helvetica', 'normal');
  y += 14;
  if (donor.address) { doc.text(donor.address, margin, y); y += 14; }
  if (donor.email) { doc.text(donor.email, margin, y); y += 14; }

  y += 16;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Date', margin, y);
  doc.text('Fund', margin + 100, y);
  doc.text('Method', margin + 280, y);
  doc.text('Amount', margin + 400, y, { align: 'left' });
  y += 6;
  doc.setLineWidth(0.5);
  doc.line(margin, y, margin + 460, y);
  y += 14;

  doc.setFont('helvetica', 'normal');
  const sorted = [...donor.records].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  for (const r of sorted) {
    if (y > 700) { doc.addPage(); y = margin; }
    doc.text(r.date ? format(new Date(r.date + 'T00:00:00'), 'MM/dd/yyyy') : '—', margin, y);
    doc.text(FUND_LABELS[r.fund] || r.fund || 'Gift', margin + 100, y);
    doc.text((r.payment_method || '').replace(/_/g, ' '), margin + 280, y);
    doc.text(`$${Number(r.amount || 0).toFixed(2)}`, margin + 400, y);
    y += 16;
  }

  y += 6;
  doc.line(margin, y, margin + 460, y);
  y += 18;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`Total ${year} Contributions:`, margin, y);
  doc.text(`$${donor.total.toFixed(2)}`, margin + 400, y);
  y += 30;

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  const disclaimer = church?.ein
    ? 'This organization is recognized as tax-exempt under section 501(c)(3) of the Internal Revenue Code. No goods or services were provided in exchange for these contributions, except intangible religious benefits.'
    : 'No goods or services were provided in exchange for these contributions, except intangible religious benefits. Please consult your tax advisor regarding the deductibility of these gifts.';
  const wrapped = doc.splitTextToSize(disclaimer, 460);
  doc.text(wrapped, margin, y);
  y += wrapped.length * 12 + 20;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Statement generated ${format(new Date(), 'MMMM d, yyyy')}`, margin, y);

  const safeName = (donor.name || 'donor').replace(/[^a-z0-9]+/gi, '_');
  doc.save(`${year}_Giving_Statement_${safeName}.pdf`);
}
