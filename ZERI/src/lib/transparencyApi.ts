/** The public Transparency Center's data; see server/transparency.ts for what each figure means. */

export interface TransparencySummary {
  received: number;
  awaitingReview: number;
  published: number;
  inProgress: number;
  resolved: number;
  rejected: number;
  overdue: number;
  rates: { acceptanceRate: number | null; resolutionRate: number | null; overdueShare: number | null };
}

export interface TransparencyData {
  generatedAt: string;
  cacheSeconds: number;
  period: { from: string | null; to: string | null };
  filters: { municipality: string | null; category: string | null };
  summary: TransparencySummary;
  counts: Record<string, number>;
  resolutionTime: { sampleSize: number; averageHours: number | null; medianHours: number | null };
  monthly: Array<{ month: string; received: number }>;
  byMunicipality: Array<{ municipality: string; received: number; resolved: number; resolutionRate: number | null }>;
  recentOutcomes: Array<{ trackingId: string; title: string; category: string; municipality: string; resolvedAt: string | null; officialResponse: string | null }>;
  definitions: Record<string, string>;
}

export interface TransparencyFilters {
  from: string;
  to: string;
  municipality: string;
  category: string;
}

export async function fetchTransparency(filters: TransparencyFilters, signal?: AbortSignal): Promise<TransparencyData> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
  const response = await fetch(`/api/v1/public/transparency${query.size ? `?${query}` : ''}`, { signal });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : 'Statistikat nuk u ngarkuan.');
  return body as TransparencyData;
}

const csvCell = (value: unknown) => {
  const text = String(value ?? '');
  // A cell that starts like a formula would run in a spreadsheet; neutralise it.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** The figures as a CSV, with the period, the filters and when it was made, so the file explains itself. */
export function transparencyCsv(data: TransparencyData): string {
  const rows: unknown[][] = [
    ['Zëri i Qytetarëve: Qendra e Transparencës'],
    ['Krijuar më', data.generatedAt],
    ['Periudha', `${data.period.from ?? 'fillimi'} deri ${data.period.to ?? 'sot'}`],
    ['Komuna', data.filters.municipality ?? 'Të gjitha'],
    ['Kategoria', data.filters.category ?? 'Të gjitha'],
    [],
    ['Treguesi', 'Vlera'],
    ['Raportime të regjistruara', data.summary.received],
    ['Presin shqyrtimin', data.summary.awaitingReview],
    ['Të pranuara', data.summary.published],
    ['Në trajtim', data.summary.inProgress],
    ['Të zgjidhura', data.summary.resolved],
    ['Të refuzuara', data.summary.rejected],
    ['Të vonuara', data.summary.overdue],
    ['Përqindja e pranimit (%)', data.summary.rates.acceptanceRate ?? 'pa të dhëna'],
    ['Përqindja e zgjidhjes (%)', data.summary.rates.resolutionRate ?? 'pa të dhëna'],
    ['Koha mesatare e zgjidhjes (orë)', data.resolutionTime.averageHours ?? 'pa të dhëna'],
    ['Mostra për kohën (raportime)', data.resolutionTime.sampleSize],
    [],
    ['Muaji', 'Të regjistruara'],
    ...data.monthly.map(row => [row.month, row.received]),
  ];
  if (data.byMunicipality.length) {
    rows.push([], ['Komuna', 'Të regjistruara', 'Të zgjidhura', 'Përqindja e zgjidhjes (%)']);
    rows.push(...data.byMunicipality.map(row => [row.municipality, row.received, row.resolved, row.resolutionRate ?? 'pa të dhëna']));
  }
  rows.push([], ['Përkufizimet'], ...Object.entries(data.definitions).map(([key, text]) => [key, text]));
  return `﻿${rows.map(row => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}
