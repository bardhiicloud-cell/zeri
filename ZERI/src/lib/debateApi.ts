import { authHeaders } from './apiAuth';

/** Client for the payment and debate-admin endpoints (server/paymentRoutes.ts, server/debateAdmin.ts). */

async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const response = await fetch(path, {
    method: init.method ?? 'GET',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Kërkesa dështoi.');
  return data as T;
}

/* ---------------------------------------------------------------- types */

export type PaymentKind = 'verification' | 'ad-package';
export type PaymentStatus = 'awaiting' | 'paid' | 'cancelled';

export interface PaymentOrder {
  code: string;
  kind: PaymentKind;
  packageId: string | null;
  amountEur: number;
  currency: 'EUR';
  status: PaymentStatus;
  expired: boolean;
  description: string;
  createdAtMs: number;
  expiresAtMs: number;
  paidAtMs: number | null;
  method: 'iban' | 'paysera' | null;
  name?: string;
  confirmedBy?: string | null;
}

export interface BankDetails {
  iban: string;
  beneficiary: string;
  bank: string;
  bic: string;
  note: string;
}

export interface PaymentConfig {
  verificationPriceEur: number | null;
  adPackagePrices: Record<string, number>;
  methods: { iban: boolean; paysera: boolean };
}

export interface PaymentSettings {
  iban: string;
  beneficiary: string;
  bank: string;
  bic: string;
  note: string;
  verificationPriceEur: number | null;
  adPackagePrices: Record<string, number>;
}

export type StatementOutcome = 'match' | 'amount_mismatch' | 'amount_unknown' | 'already_paid' | 'cancelled' | 'unknown_code';

export interface StatementEntry {
  line: string;
  code: string;
  amounts: number[];
  outcome: StatementOutcome;
  orderAmountEur?: number;
  name: string | null;
  kind: PaymentKind | null;
}

export interface PostRow {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  category: string | null;
  imageUrl: string | null;
  likes: number;
  comments: number;
  reposts: number;
  viewCount: number;
  reportCount: number;
  isHidden: boolean;
  isAd: boolean;
  promotedUntilMs: number | null;
  createdAtMs: number;
}

export type PostFilter = 'all' | 'reported' | 'hidden' | 'promoted' | 'visible';
export type BulkAction = 'hide' | 'unhide' | 'delete' | 'clear_reports' | 'unpromote';

export interface AdRequestRow {
  id: string;
  name: string;
  businessName: string;
  phone: string;
  email: string;
  packageName: string;
  packageId: string;
  notes: string;
  postId: string;
  status: 'pending' | 'contacted' | 'approved' | 'active' | 'completed' | 'rejected';
  paymentStatus: 'paid' | 'unpaid';
  paymentCode: string;
  createdAtMs: number;
}

export interface DebateStats {
  posts: number;
  reported: number;
  hidden: number;
  verifiedAccounts: number;
  paymentsAwaiting: number;
  paidLast30Days: { count: number; sumEur: number };
}

/* ------------------------------------------------------------ payers */

export const getPaymentConfig = () => call<PaymentConfig>('/api/v1/payments/config');

export const createPaymentOrder = (body: { kind: PaymentKind; packageId?: string; adRequestId?: string }) =>
  call<{ order: PaymentOrder; bank: BankDetails | null; payseraEnabled: boolean }>('/api/v1/payments/orders', { method: 'POST', body });

export const getMyOrders = () => call<{ orders: PaymentOrder[]; bank: BankDetails | null }>('/api/v1/payments/orders/mine');

export const startPaysera = (code: string) => call<{ url: string }>(`/api/v1/payments/orders/${encodeURIComponent(code)}/paysera`, { method: 'POST', body: {} });

/* ------------------------------------------------------------- admin */

export const adminPayments = (status: PaymentStatus | 'all') =>
  call<{ orders: PaymentOrder[]; totals: Record<PaymentStatus, { count: number; sumEur: number }> }>(`/api/v1/debate/payments?status=${status}`);

export const confirmPayment = (code: string, body: { bankReference?: string; amountEur?: number; acceptAnyAmount?: boolean } = {}) =>
  call<{ ok: true }>(`/api/v1/debate/payments/${encodeURIComponent(code)}/confirm`, { method: 'POST', body });

export const cancelPayment = (code: string, reason = '') =>
  call<{ ok: true }>(`/api/v1/debate/payments/${encodeURIComponent(code)}/cancel`, { method: 'POST', body: { reason } });

export const analyzeStatement = (text: string) =>
  call<{ entries: StatementEntry[]; summary: { lines: number; matched: number } }>('/api/v1/debate/payments/statement', { method: 'POST', body: { text } });

export const applyStatement = (text: string, codes: string[]) =>
  call<{ results: Array<{ code: string; result: string }> }>('/api/v1/debate/payments/statement/apply', { method: 'POST', body: { text, codes } });

export const getPaymentSettings = () =>
  call<{ settings: PaymentSettings; paysera: { enabled: boolean; test: boolean } }>('/api/v1/debate/payments/settings');

export const savePaymentSettings = (settings: PaymentSettings) =>
  call<{ ok: true; settings: PaymentSettings }>('/api/v1/debate/payments/settings', { method: 'PUT', body: settings });

export const debateStats = () => call<DebateStats>('/api/v1/debate/stats');

export const debatePosts = (filter: PostFilter, q: string) =>
  call<{ posts: PostRow[]; counts: { all: number; reported: number; hidden: number; promoted: number } }>(
    `/api/v1/debate/posts?filter=${filter}&q=${encodeURIComponent(q)}`
  );

export const bulkPosts = (action: BulkAction, ids: string[], confirm = false) =>
  call<{ results: Array<{ id: string; result: 'done' | 'missing' }> }>('/api/v1/debate/posts/bulk', { method: 'POST', body: { action, ids, confirm } });

export const promotePost = (id: string, days: number, adLink: string) =>
  call<{ ok: true }>(`/api/v1/debate/posts/${encodeURIComponent(id)}/promote`, { method: 'POST', body: { days, adLink } });

export const postReports = (id: string) =>
  call<{ reports: Array<{ reason: string; note: string; atMs: number }> }>(`/api/v1/debate/posts/${encodeURIComponent(id)}/reports`);

export const reportPost = (id: string, reason: string, note = '') =>
  call<{ ok: true }>(`/api/v1/forum/posts/${encodeURIComponent(id)}/report`, { method: 'POST', body: { reason, note } });

export const adRequests = () => call<{ items: AdRequestRow[] }>('/api/v1/debate/ad-requests');

export const setAdRequestStatus = (id: string, status: AdRequestRow['status'], note = '') =>
  call<{ ok: true }>(`/api/v1/debate/ad-requests/${encodeURIComponent(id)}/status`, { method: 'POST', body: { status, note } });

export const verifiedAccounts = () => call<{ items: Array<{ uid: string; name: string; untilMs: number | null }> }>('/api/v1/debate/verified');

export const verifiedAction = (uid: string, action: 'revoke' | 'extend') =>
  call<{ ok: true }>(`/api/v1/debate/verified/${encodeURIComponent(uid)}`, { method: 'POST', body: { action } });

/* ---------------------------------------------------------- formatting */

export const formatEur = (value: number): string => `${value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

export const formatWhen = (ms: number | null | undefined): string =>
  ms ? new Date(ms).toLocaleString('sq-AL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export const KIND_LABELS: Record<PaymentKind, string> = {
  verification: 'Verifikim (tick)',
  'ad-package': 'Paketë reklame',
};
