/**
 * Municipality account manager — the super admin's running view of the accounts
 * created by the provisioning agent.
 *
 * Provisioning and management are different jobs. Creating an account is a
 * four-step, once-per-municipality task; running one is a recurring, many-times
 * job: the office changes hands, a plan is upgraded, a login is forgotten, an
 * official needs to be reached. This panel is that second job.
 *
 * Three things it deliberately does NOT do:
 *   • It never shows or stores a password. A forgotten one is replaced through
 *     the same set-password endpoint the staff console uses, which revokes the
 *     old sessions as a side effect.
 *   • It never lets the email be changed from here. The email is the sign-in
 *     identity in Firebase Auth; editing it in one place only would leave the
 *     profile and the credential disagreeing.
 *   • It never edits the editorial clause or its timestamp. Consent is a
 *     historical record, not a setting.
 */
import { useMemo, useState } from 'react';
import { dt } from '../../lib/dt';
import { requireAdminToken, describeApiFailure } from '../../lib/adminApi';
import { useCitizenDirectory } from '../../lib/useCitizenDirectory';
import { KOSOVO_MUNICIPALITIES } from '../../lib/constants';
import {
  Building2, Search, Mail, KeyRound, Ban, CheckCircle2,
  Send, ShieldCheck, RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';

/** A message in the thread with one municipality. */
interface ThreadMessage {
  id: string;
  senderId: string;
  senderName?: string;
  receiverId: string;
  text: string;
  createdAt?: { seconds?: number } | string;
}

const PLANS = ['basic', 'standard', 'pro'] as const;

function formatWhen(value: ThreadMessage['createdAt']): string {
  if (!value) return '—';
  if (typeof value === 'string') return new Date(value).toLocaleString('sq-AL');
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000).toLocaleString('sq-AL');
  return '—';
}

/** Bearer header, or an error explaining that the session is not a staff one. */
async function adminHeaders(): Promise<Record<string, string>> {
  const token = await requireAdminToken();
  return { Authorization: `Bearer ${token}` };
}

export default function MunicipalityAccountManager() {
  const { citizens, isLoading } = useCitizenDirectory();

  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  // Editable fields, held separately from the directory row so a rejected save
  // does not silently alter what the table shows.
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editMunicipality, setEditMunicipality] = useState('');
  const [editPlan, setEditPlan] = useState<string>('basic');
  const [editNote, setEditNote] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [thread, setThread] = useState<ThreadMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [isThreadLoading, setIsThreadLoading] = useState(false);

  /**
   * Only municipal accounts, filtered by the search box.
   *
   * The directory already pages at 50 rows and carries the contact details for
   * staff records only — which is exactly what this table needs, since a
   * municipality account is staff-shaped.
   */
  const municipalities = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return citizens
      .filter((c) => c.role === 'municipality')
      .filter((c) => {
        if (!needle) return true;
        return (
          c.name.toLowerCase().includes(needle) ||
          c.email.toLowerCase().includes(needle)
        );
      });
  }, [citizens, query]);

  const selected = municipalities.find((m) => m.id === selectedId) ?? null;

  /** Load the row's current values into the editor. */
  const select = (id: string) => {
    const row = municipalities.find((m) => m.id === id);
    if (!row) return;
    setSelectedId(id);
    setEditName(row.name);
    setEditPhone(row.phone || '');
    // The directory does not expose the jurisdiction, so it starts blank and is
    // filled from the saved response; the operator sets it explicitly.
    setEditMunicipality('');
    setEditPlan('basic');
    setEditNote(row.notes || '');
    setNewPassword('');
    setThread([]);
    void loadThread(id);
  };

  const loadThread = async (otherUid: string) => {
    setIsThreadLoading(true);
    try {
      const headers = await adminHeaders();
      const response = await fetch(`/api/v1/messages/${encodeURIComponent(otherUid)}`, { headers });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setThread(Array.isArray(data.items) ? data.items : []);
    } catch {
      // A missing thread is not an error worth interrupting the operator for.
      setThread([]);
    } finally {
      setIsThreadLoading(false);
    }
  };

  /** Save the editable fields through the superadmin-only endpoint. */
  const save = async () => {
    if (!selected) return;
    setIsBusy(true);
    try {
      const headers = await adminHeaders();
      const response = await fetch(`/api/v1/admin/municipalities/${encodeURIComponent(selected.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          name: editName.trim(),
          phone: editPhone.trim(),
          municipality: editMunicipality.trim() || undefined,
          plan: editPlan,
          internalNote: editNote,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(describeApiFailure(response.status, result));
      toast.success(dt('Llogaria komunale u përditësua.'));
    } catch (error) {
      toast.error(error.message || dt('Ndryshimet nuk u ruajtën.'));
    } finally {
      setIsBusy(false);
    }
  };

  /** Suspend or restore the account, in both Auth and the profile. */
  const toggleBan = async () => {
    if (!selected) return;
    const nextBanned = !selected.isBanned;
    setIsBusy(true);
    try {
      const headers = await adminHeaders();
      const response = await fetch(`/api/v1/admin/municipalities/${encodeURIComponent(selected.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ isBanned: nextBanned }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(describeApiFailure(response.status, result));
      toast.success(nextBanned ? dt('Llogaria u pezullua.') : dt('Llogaria u riaktivizua.'));
    } catch (error) {
      toast.error(error.message || dt('Statusi nuk u ndryshua.'));
    } finally {
      setIsBusy(false);
    }
  };

  /**
   * Replace the password.
   *
   * The same endpoint the staff console uses, and for the same reason: it lives
   * on the server, touches Firebase Auth only, and revokes existing sessions so
   * a compromised password stops working immediately.
   */
  const setPassword = async () => {
    if (!selected || newPassword.length < 8) return;
    setIsBusy(true);
    try {
      const headers = await adminHeaders();
      const response = await fetch(`/api/v1/admin/users/${encodeURIComponent(selected.id)}/set-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ password: newPassword }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(describeApiFailure(response.status, result));
      toast.success(dt('Fjalëkalimi u vendos dhe sesionet e vjetra u revokuan.'));
      setNewPassword('');
    } catch (error) {
      toast.error(error.message || dt('Fjalëkalimi nuk u vendos.'));
    } finally {
      setIsBusy(false);
    }
  };

  /** Send a message to the municipality's account holder. */
  const sendMessage = async () => {
    if (!selected || !messageText.trim()) return;
    setIsBusy(true);
    try {
      const headers = await adminHeaders();
      const response = await fetch('/api/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ receiverId: selected.id, text: messageText.trim() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(describeApiFailure(response.status, result));
      setMessageText('');
      await loadThread(selected.id);
      toast.success(dt('Mesazhi u dërgua.'));
    } catch (error) {
      toast.error(error.message || dt('Mesazhi nuk u dërgua.'));
    } finally {
      setIsBusy(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 p-10 text-slate-400">
        <RefreshCw className="h-4 w-4 animate-spin" />
        <span className="text-xs font-bold">{dt('Ngarkimi i llogarive…')}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={dt('Kërko komunë sipas emrit ose email-it…')}
          className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 dark:border-white/10 dark:bg-slate-950 dark:text-white"
        />
      </div>

      {municipalities.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-white/10">
          {dt('Nuk ka llogari komunale. Krijoni një nga skeda "Krijo llogari të re".')}
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
          {/* Account list */}
          <div className="space-y-2">
            {municipalities.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => select(m.id)}
                aria-pressed={selectedId === m.id}
                className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors ${selectedId === m.id
                    ? 'border-blue-400 bg-blue-50/60 dark:border-blue-500/40 dark:bg-blue-500/10'
                    : 'border-slate-200 bg-white hover:border-slate-300 dark:border-white/10 dark:bg-slate-900'
                  }`}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-700 text-white">
                    <Building2 className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-bold text-slate-900 dark:text-white">{m.name}</span>
                    <span className="block truncate text-[11px] text-slate-500">{m.email || dt('Pa email')}</span>
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {m.isVerified && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                      <CheckCircle2 className="h-3 w-3" /> {dt('Aktiv')}
                    </span>
                  )}
                  {m.isBanned && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-700">
                      <Ban className="h-3 w-3" /> {dt('Pezulluar')}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>

          {/* Detail panel */}
          <aside className="space-y-3">
            {!selected ? (
              <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500 dark:border-white/10">
                {dt("Zgjidhni një llogari për ta shikuar, ndryshuar ose për t'i dërguar mesazh.")}
              </p>
            ) : (
              <>
                <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
                    {dt('Të dhënat e llogarisë')}
                  </h3>

                  <label className="block">
                    <span className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-300">{dt('Emri i zyrtarit')}</span>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-blue-500 dark:border-white/10 dark:bg-slate-950 dark:text-white"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-300">{dt('Email (identiteti i hyrjes — nuk ndryshohet këtu)')}</span>
                    <input
                      value={selected.email || '—'}
                      readOnly
                      className="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1.5 text-xs text-slate-500 dark:border-white/10 dark:bg-slate-800 dark:text-slate-400"
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-300">{dt('Telefoni')}</span>
                      <input
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-blue-500 dark:border-white/10 dark:bg-slate-950 dark:text-white"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-300">{dt('Komuna')}</span>
                      <select
                        value={editMunicipality}
                        onChange={(e) => setEditMunicipality(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-blue-500 dark:border-white/10 dark:bg-slate-950 dark:text-white"
                      >
                        <option value="">{dt('Pa ndryshim')}</option>
                        {KOSOVO_MUNICIPALITIES.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </label>
                  </div>

                  <label className="block">
                    <span className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-300">{dt('Plani i abonimit')}</span>
                    <select
                      value={editPlan}
                      onChange={(e) => setEditPlan(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-blue-500 dark:border-white/10 dark:bg-slate-950 dark:text-white"
                    >
                      {PLANS.map((p) => <option key={p} value={p}>{dt(`Plani ${p}`)}</option>)}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-300">{dt('Shënim i brendshëm')}</span>
                    <textarea
                      value={editNote}
                      onChange={(e) => setEditNote(e.target.value)}
                      rows={2}
                      maxLength={500}
                      className="w-full resize-none rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-blue-500 dark:border-white/10 dark:bg-slate-950 dark:text-white"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={save}
                    disabled={isBusy}
                    className="w-full rounded-lg bg-blue-700 px-4 py-2 text-xs font-black text-white transition-colors hover:bg-blue-800 disabled:opacity-40"
                  >
                    {isBusy ? dt('Po ruhet…') : dt('Ruaj ndryshimet')}
                  </button>
                </div>

                {/* Credentials */}
                <div className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-500/20 dark:bg-indigo-500/[0.06]">
                  <h3 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-indigo-800 dark:text-indigo-300">
                    <KeyRound className="h-3.5 w-3.5" /> {dt('Fjalëkalimi')}
                  </h3>
                  <p className="text-[11px] leading-relaxed text-slate-500">
                    {dt('Fjalëkalimi nuk shfaqet kurrë. Vendosni një të ri; sesionet e vjetra revokohen menjëherë.')}
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder={dt('min. 8 shenja, shkronja + numra')}
                      autoComplete="new-password"
                      className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-indigo-500 dark:border-white/10 dark:bg-slate-950 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={setPassword}
                      disabled={isBusy || newPassword.length < 8}
                      className="shrink-0 rounded-lg bg-indigo-700 px-3 py-1.5 text-xs font-black text-white transition-colors hover:bg-indigo-800 disabled:opacity-40"
                    >
                      {dt('Vendos')}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={toggleBan}
                    disabled={isBusy}
                    className={`inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black transition-colors disabled:opacity-40 ${selected.isBanned
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                        : 'bg-rose-600 text-white hover:bg-rose-700'
                      }`}
                  >
                    {selected.isBanned ? (
                      <><CheckCircle2 className="h-3.5 w-3.5" /> {dt('Riaktivizo llogarinë')}</>
                    ) : (
                      <><Ban className="h-3.5 w-3.5" /> {dt('Pezullo llogarinë')}</>
                    )}
                  </button>
                </div>

                {/* Direct line to the super admin */}
                <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
                  <h3 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-500">
                    <Mail className="h-3.5 w-3.5" /> {dt('Mesazhe me komunën')}
                  </h3>

                  {isThreadLoading ? (
                    <p className="text-[11px] text-slate-400">{dt('Po ngarkohet biseda…')}</p>
                  ) : thread.length === 0 ? (
                    <p className="text-[11px] text-slate-400">{dt('Nuk ka mesazhe akoma.')}</p>
                  ) : (
                    <ul className="max-h-64 space-y-2 overflow-y-auto">
                      {thread.map((m) => (
                        <li
                          key={m.id}
                          className={`rounded-lg p-2.5 text-[11px] leading-relaxed ${m.senderId === selected.id
                              ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                              : 'bg-blue-50 text-blue-900 dark:bg-blue-500/10 dark:text-blue-200'
                            }`}
                        >
                          <p>{m.text}</p>
                          <p className="mt-1 text-[11px] opacity-60">{formatWhen(m.createdAt)}</p>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="flex gap-2">
                    <textarea
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      rows={2}
                      maxLength={4000}
                      placeholder={dt('Shkruani mesazhin…')}
                      className="min-w-0 flex-1 resize-none rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-blue-500 dark:border-white/10 dark:bg-slate-950 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={sendMessage}
                      disabled={isBusy || !messageText.trim()}
                      className="shrink-0 self-end rounded-lg bg-blue-700 px-3 py-2 text-xs font-black text-white transition-colors hover:bg-blue-800 disabled:opacity-40"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-400">
                  <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0" />
                  {dt('Vetëm Super Admini menaxhon llogaritë komunale. Çdo ndryshim regjistrohet në audit log.')}
                </p>
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
