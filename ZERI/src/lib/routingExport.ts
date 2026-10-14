import type { Report } from '../types';
import { escapeHtml } from './escapeHtml';
import { getReportTopic } from './reportTopics';
import { groupByRecipient, resolveResponsible, type Recipient, type Resolution } from './responsibility';

/**
 * Reports grouped by the body that answers them, and the documents built from that
 * grouping (CSV, and an HTML page that also prints to PDF).
 *
 * These documents go to institutions outside the platform, so they carry the report
 * and never the reporter: no name, no account, no "anonymous" marker. This is the same
 * rule the email follows (server/institutionMail.ts). The staff-only dossier export
 * (lib/exportUtils.ts) is a different document and keeps the author.
 */
export interface RoutedReport {
  report: Report;
  topicId: string | null;
  topicLabel: string;
  municipality: string;
  resolution: Resolution;
}

export interface RoutedGroup {
  key: string;
  recipient: Recipient;
  items: RoutedReport[];
  needsZone: number;
}

const ZONE_LABEL: Record<string, string> = { urban: 'Urbane', rural: 'Rurale' };

export function routeReport(report: Report): RoutedReport {
  const topic = getReportTopic(report);
  const municipality = String(report.location?.municipality ?? '');
  const zone = report.zone === 'urban' || report.zone === 'rural' ? report.zone : null;
  return {
    report,
    topicId: topic?.id ?? null,
    topicLabel: topic?.label ?? (report.category || 'Pa kategori'),
    municipality,
    resolution: resolveResponsible({ topicId: topic?.id, municipality, zone }),
  };
}

export function routeReports(reports: readonly Report[]): RoutedGroup[] {
  return groupByRecipient(reports.map(routeReport), item => item.resolution);
}

const when = (value: unknown) => {
  const time = Date.parse(String(value ?? ''));
  return Number.isFinite(time) ? new Date(time).toLocaleDateString('sq-AL') : '';
};

export const CSV_HEADERS = [
  'Marrësi', 'Niveli', 'Zyra', 'Email', 'Statusi i emailit',
  'Numri përcjellës', 'Titulli', 'Kategoria', 'Komuna', 'Adresa', 'Zona', 'Urgjenca', 'Statusi', 'Data', 'Përshkrimi',
] as const;

export function routingCsvRows(groups: readonly RoutedGroup[]): string[][] {
  return groups.flatMap(group => group.items.map(({ report, topicLabel, municipality }) => [
    group.recipient.name,
    group.recipient.level === 'central' ? 'Qendror' : 'Komunal',
    group.recipient.office,
    group.recipient.email ?? '',
    group.recipient.sendable ? 'Gati për dërgim' : 'Duhet verifikuar',
    report.trackingId || report.id,
    report.title,
    topicLabel,
    municipality,
    report.location?.address ?? '',
    report.zone ? ZONE_LABEL[report.zone] : 'Pa caktuar',
    String(report.urgency ?? ''),
    String(report.status ?? ''),
    when(report.createdAt),
    report.description ?? '',
  ]));
}

export function routingHtml(groups: readonly RoutedGroup[], subtitle: string): string {
  const total = groups.reduce((sum, group) => sum + group.items.length, 0);
  const sections = groups.map(group => {
    const contact = [group.recipient.email, group.recipient.phone].filter(Boolean).map(value => escapeHtml(String(value))).join(' · ');
    const cards = group.items.map(({ report, topicLabel, municipality }) => `
      <article class="card">
        <h3>${escapeHtml(report.trackingId || report.id)} — ${escapeHtml(report.title)}</h3>
        <table>
          <tr><th>Kategoria</th><td>${escapeHtml(topicLabel)}</td></tr>
          <tr><th>Komuna</th><td>${escapeHtml(municipality || 'Pa komunë')}</td></tr>
          <tr><th>Adresa</th><td>${escapeHtml(report.location?.address || 'Pa adresë')}</td></tr>
          <tr><th>Zona</th><td>${report.zone ? ZONE_LABEL[report.zone] : 'Pa caktuar'}</td></tr>
          <tr><th>Urgjenca</th><td>${escapeHtml(String(report.urgency ?? ''))}</td></tr>
          <tr><th>Statusi</th><td>${escapeHtml(String(report.status ?? ''))}</td></tr>
          <tr><th>Data</th><td>${escapeHtml(when(report.createdAt))}</td></tr>
        </table>
        <p class="desc">${escapeHtml(report.description || 'Nuk ka përshkrim.')}</p>
      </article>`).join('');
    return `
    <section>
      <h2>${escapeHtml(group.recipient.name)}</h2>
      <p class="meta">${escapeHtml(group.recipient.office)}${contact ? ` · ${contact}` : ''} · <strong>${group.items.length}</strong> raportime</p>
      ${cards}
    </section>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="sq">
<head>
<meta charset="UTF-8">
<title>Raportime për institucionet përgjegjëse</title>
<style>
  body { font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; margin: 32px; color: #0f172a; line-height: 1.5; }
  header { border-bottom: 3px solid #0f172a; padding-bottom: 14px; margin-bottom: 24px; }
  h1 { margin: 0 0 4px; font-size: 24px; }
  header p { margin: 0; color: #475569; font-size: 13px; }
  h2 { margin: 36px 0 4px; font-size: 19px; color: #1d4ed8; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
  .meta { margin: 0 0 14px; color: #475569; font-size: 13px; }
  .card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px 16px; margin-bottom: 12px; page-break-inside: avoid; }
  .card h3 { margin: 0 0 8px; font-size: 15px; }
  table { border-collapse: collapse; width: 100%; font-size: 12.5px; }
  th { text-align: left; width: 110px; color: #64748b; font-weight: 600; padding: 3px 0; vertical-align: top; }
  td { padding: 3px 0; }
  .desc { margin: 10px 0 0; font-size: 13px; white-space: pre-wrap; }
  footer { margin-top: 32px; color: #64748b; font-size: 12px; }
  @media print { body { margin: 14mm; } }
</style>
</head>
<body>
  <header>
    <h1>Raportime për institucionet përgjegjëse</h1>
    <p>${escapeHtml(subtitle)} · ${total} raportime · ${groups.length} marrës · gjeneruar më ${escapeHtml(new Date().toLocaleString('sq-AL'))}</p>
  </header>
  ${sections}
  <footer>Zëri i Qytetarëve. Dokumenti përmban raportimet, jo të dhënat e qytetarëve që i kanë dërguar.</footer>
</body>
</html>`;
}

/** Saves text as a file in the browser. */
export function downloadText(filename: string, content: string, mime: string): void {
  const blob = new Blob([mime.startsWith('text/csv') ? new Uint8Array([0xef, 0xbb, 0xbf]) : '', content], { type: `${mime};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function csvText(headers: readonly string[], rows: readonly string[][]): string {
  const cell = (value: string) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  return [headers, ...rows].map(row => row.map(cell).join(',')).join('\n');
}

/** Opens the print dialog on the HTML, which is how a PDF is made. */
export function printHtml(html: string): boolean {
  const win = window.open('', '', 'width=900,height=700');
  if (!win) return false;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 500);
  return true;
}
