/**
 * Access control for one actor — view, grant, revoke, suspend.
 *
 * ─── The problem this solves ────────────────────────────────────────────────
 *
 * An administrator auditing a person needs three things on one screen, in this
 * order: who is this, what can they currently do, and stop them if necessary.
 * Previously those lived in three places — the staff table showed the role, the
 * permission checkboxes lived in a modal, and the "suspend" button was in
 * neither. Answering "can this agent delete reports?" meant opening a form and
 * reading a checkbox, which is not a question a checkbox answers well.
 *
 * So this renders the *effective* access, not the stored configuration: every
 * role default is expanded into a concrete list, the per-account grants are
 * marked as such, and anything the role cannot do is absent rather than shown
 * greyed. An administrator reading it should never have to know what a
 * "dispatcher" is to know what this particular account can open.
 */
import { useMemo, useState } from 'react';
import { dt } from '../../lib/dt';
import { requireAdminToken, describeApiFailure } from '../../lib/adminApi';
import {
  canAccessSection,
  roleLabel,
  STAFF_ROLES,
  type AdminSection,
  type StaffRole,
} from '../../lib/adminPermissions';
import type { User } from '../../types';
import {
  Shield, ShieldCheck, KeyRound, Eye, EyeOff, Ban, CheckCircle2,
  AlertTriangle, Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';
import RemoveAccountDialog from './RemoveAccountDialog';
import { MUNICIPALITY_PLANS } from '../../lib/municipalityProvisioning';

/** Every section the console knows, with the label shown to the operator. */
const SECTION_LABELS: Array<[AdminSection, string]> = [
  ['dashboard', 'Paneli i Përgjithshëm'],
  ['updates', 'Përditësimet e Adminit'],
  ['reports', 'Inspektimi i Raporteve'],
  ['workfacts', 'Faktet e Komunave'],
  ['health', 'Regjistri Shëndetësor'],
  ['donations', 'Aprovimi i Donacioneve'],
  ['users', 'Regjistri i Qytetarëve'],
  ['agents', 'Menaxhimi i Stafit'],
  ['municipalities', 'Llogaritë e Komunave'],
  ['monitoring', 'Monitorimi i Agjentëve'],
  ['monitorim', 'Monitorim i Plotë'],
  ['agentpanel', 'Paneli i Agjentëve'],
  ['komunapanel', 'Paneli i Komunave'],
  ['moderim', 'Qendra e Moderimit'],
  ['forum', 'Moderimi i Debatit'],
  ['support', 'Kërkesat për Agjent'],
  ['polls', 'Sondazhet'],
  ['news', 'Lajmet'],
  ['heritage', 'Arkivi i Kosovës'],
  ['ads', 'Reklamat'],
  ['notifications', 'Njoftimet'],
  ['categories', 'Harta & GIS'],
  ['security', 'Siguria dhe Auditimi'],
  ['settings', 'Konfigurimet'],
];

interface Props {
  /**
   * The account being inspected.
   *
   * `permissions` is `string[]` rather than the narrower `AdminSection[]`
   * because the paged staff directory — the source every console now reads from
   * — carries stored grants as plain strings, and a record can hold a section id
   * that predates the current union. The component already narrows against
   * SECTION_LABELS before rendering, so accepting the wider type here is honest
   * and removes a cast at every call site.
   */
  account: Pick<User, 'id' | 'name' | 'email' | 'role' | 'isBanned'> & {
    permissions?: readonly string[];
    /** The plan of a municipal account, so the selector starts on the stored value. */
    municipalityPlan?: string;
  };
  /** Called after a successful write so the caller can refresh its data. */
  onChanged?: () => void;
}

export default function ActorAccessControl({ account, onChanged }: Props) {
  const [isBusy, setIsBusy] = useState(false);
  const [showPasswordField, setShowPasswordField] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [plan, setPlan] = useState<string>(account.municipalityPlan || 'basic');

  /**
   * The grants held directly by this account, as distinct from those implied by
   * its role. The two are shown separately because they are edited separately:
   * a role default cannot be revoked per account without changing the role, and
   * presenting them as one list would imply otherwise.
   */
  const directGrants = useMemo(
    () => new Set((account.permissions ?? []).map(String)),
    [account.permissions]
  );

  /** Sections reachable because of the role alone. */
  const roleSections = useMemo(() => {
    const out = new Set<AdminSection>();
    if (!STAFF_ROLES.includes(account.role as StaffRole)) return out;
    for (const [section] of SECTION_LABELS) {
      if (canAccessSection({ role: account.role, email: account.email ?? '' }, section)) {
        // Exclude those that are only reachable via the direct grant, so the
        // two columns stay disjoint and the operator can see what a revocation
        // would actually take away.
        if (!directGrants.has(section)) out.add(section);
      }
    }
    return out;
  }, [account.role, account.email, directGrants]);

  /** What the account can open right now, role and grant combined. */
  const effective = useMemo(() => {
    const out: Array<{ section: AdminSection; viaGrant: boolean }> = [];
    for (const [section] of SECTION_LABELS) {
      if (canAccessSection({ role: account.role, email: account.email ?? '', permissions: account.permissions }, section)) {
        out.push({ section, viaGrant: directGrants.has(section) });
      }
    }
    return out;
  }, [account.role, account.email, account.permissions, directGrants]);

  /** Write the full permission list back. Idempotent, so a revoke is a set-difference. */
  const savePermissions = async (next: string[], label: string) => {
    setIsBusy(true);
    try {
      const token = await requireAdminToken();
      const response = await fetch(`/api/v1/admin/users/${encodeURIComponent(account.id)}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          role: account.role,
          permissions: next,
          isBanned: Boolean(account.isBanned),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(describeApiFailure(response.status, result));
      toast.success(label);
      onChanged?.();
    } catch (error) {
      toast.error(error.message || dt('Ndryshimi nuk u ruajt.'));
    } finally {
      setIsBusy(false);
    }
  };

  const grant = (section: AdminSection) => {
    if (directGrants.has(section)) return;
    void savePermissions([...(account.permissions ?? []), section], dt('Qasja u shtua.'));
  };

  const revoke = (section: AdminSection) => {
    void savePermissions(
      (account.permissions ?? []).filter((p) => p !== section),
      dt('Qasja u hoq.')
    );
  };

  /**
   * Suspend or restore.
   *
   * Disables the Firebase Auth identity as well as flagging the profile, because
   * a profile flag alone leaves the account able to obtain a token — the
   * difference between "suspended" and "actually stopped".
   */
  const toggleBan = async () => {
    const nextBanned = !account.isBanned;
    setIsBusy(true);
    try {
      const token = await requireAdminToken();
      const response = await fetch(`/api/v1/admin/municipalities/${encodeURIComponent(account.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isBanned: nextBanned }),
      });
      // A municipality route will not accept a non-municipal id; fall back to the
      // staff route, which handles every staff role.
      if (!response.ok && response.status !== 403) {
        const result = await response.json().catch(() => ({}));
        throw new Error(describeApiFailure(response.status, result));
      }
      if (!response.ok) {
        const staffRes = await fetch(`/api/v1/admin/users/${encodeURIComponent(account.id)}/role`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            role: account.role,
            permissions: account.permissions ?? [],
            isBanned: nextBanned,
          }),
        });
        const staffResult = await staffRes.json().catch(() => ({}));
        if (!staffRes.ok) throw new Error(describeApiFailure(staffRes.status, staffResult));
      }
      toast.success(nextBanned ? dt('Llogaria u pezullua.') : dt('Llogaria u riaktivizua.'));
      onChanged?.();
    } catch (error) {
      toast.error(error.message || dt('Statusi nuk u ndryshua.'));
    } finally {
      setIsBusy(false);
    }
  };

  /** Replace the password. Server-side only; sessions are revoked as a side effect. */
  const setPassword = async () => {
    if (newPassword.length < 8) return;
    setIsBusy(true);
    try {
      const token = await requireAdminToken();
      const response = await fetch(`/api/v1/admin/users/${encodeURIComponent(account.id)}/set-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ password: newPassword }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(describeApiFailure(response.status, result));
      toast.success(dt('Fjalëkalimi u vendos; sesionet e vjetra u revokuan.'));
      setNewPassword('');
      setShowPasswordField(false);
    } catch (error) {
      toast.error(error.message || dt('Fjalëkalimi nuk u vendos.'));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Who + current state */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-black text-slate-900 dark:text-white">{account.name}</h3>
            <p className="truncate text-xs text-slate-500">{account.email}</p>
            <p className="mt-0.5 text-[11px] font-bold text-indigo-600 dark:text-indigo-300">
              {roleLabel({ role: account.role, name: account.name }, 'sq')} · {account.role}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-black ${account.isBanned
                ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
              }`}
          >
            {account.isBanned ? dt('Pezulluar') : dt('Aktiv')}
          </span>
        </div>
      </div>

      {/* Effective access, expanded from the role so no legend is needed. */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
        <h4 className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5" /> {dt('Qasja aktuale')} ({effective.length})
        </h4>
        {effective.length === 0 ? (
          <p className="mt-2 text-[11px] text-slate-400">{dt('Kjo llogari nuk hap asnjë seksion.')}</p>
        ) : (
          <div className="mt-2 space-y-1.5">
            {effective.map(({ section, viaGrant }) => {
              const label = SECTION_LABELS.find(([s]) => s === section)?.[1] ?? section;
              return (
                <div
                  key={section}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2 dark:border-white/5 dark:bg-slate-800/60"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[11px] font-bold text-slate-800 dark:text-slate-200">
                      {dt(label)}
                    </span>
                    <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                      {viaGrant ? dt('e dhënë posaçërisht') : dt('nga roli')}
                    </span>
                  </span>
                  {viaGrant ? (
                    <button
                      type="button"
                      onClick={() => revoke(section)}
                      disabled={isBusy}
                      className="shrink-0 rounded-lg bg-rose-600 px-2.5 py-1 text-[11px] font-black text-white transition-colors hover:bg-rose-700 disabled:opacity-40"
                    >
                      {dt('Hiq')}
                    </button>
                  ) : (
                    <span className="shrink-0 text-[11px] font-bold uppercase text-slate-400">
                      {dt('ndrysho rolin')}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Grantable sections, so a revocation is one click away. */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
        <h4 className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-500">
          <Shield className="h-3.5 w-3.5" /> {dt('Shto qasje')}
        </h4>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {SECTION_LABELS.filter(([s]) => !effective.some((e) => e.section === s)).map(([section, label]) => (
            <button
              key={section}
              type="button"
              onClick={() => grant(section)}
              disabled={isBusy}
              className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600 transition-colors hover:bg-emerald-100 hover:text-emerald-800 disabled:opacity-40 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-emerald-500/20 dark:hover:text-emerald-200"
            >
              + {dt(label)}
            </button>
          ))}
          {SECTION_LABELS.every(([s]) => effective.some((e) => e.section === s)) && (
            <p className="text-[11px] text-slate-400">{dt('Kjo llogari i ka të gjitha seksionet.')}</p>
          )}
        </div>
        {roleSections.size > 0 && (
          <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
            {dt('Seksionet që vijnë nga roli nuk hiqen këtu — ato kërkojnë ndryshim roli.')}
          </p>
        )}
      </div>

      {/* Credentials and suspension */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
        <h4 className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-500">
          <KeyRound className="h-3.5 w-3.5" /> {dt('Kredencialet dhe statusi')}
        </h4>

        {!showPasswordField ? (
          <button
            type="button"
            onClick={() => setShowPasswordField(true)}
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-bold text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {dt('Vendos fjalëkalim të ri')}
          </button>
        ) : (
          <div className="mt-2 space-y-2">
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={dt('min. 8 shenja, shkronja + numra')}
                autoComplete="new-password"
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 pr-10 text-xs outline-none focus:border-indigo-500 dark:border-white/10 dark:bg-slate-950 dark:text-white"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? dt('Fshih') : dt('Shfaq')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={setPassword}
                disabled={isBusy || newPassword.length < 8}
                className="flex-1 rounded-lg bg-indigo-700 px-3 py-1.5 text-[11px] font-black text-white transition-colors hover:bg-indigo-800 disabled:opacity-40"
              >
                {isBusy ? <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" /> : dt('Ruaj fjalëkalimin')}
              </button>
              <button
                type="button"
                onClick={() => { setShowPasswordField(false); setNewPassword(''); }}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-600 dark:border-white/10 dark:text-slate-300"
              >
                {dt('Anulo')}
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={toggleBan}
          disabled={isBusy}
          className={`mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-black text-white transition-colors disabled:opacity-40 ${account.isBanned ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
            }`}
        >
          {account.isBanned ? (
            <><CheckCircle2 className="h-3.5 w-3.5" /> {dt('Riaktivizo llogarinë')}</>
          ) : (
            <><Ban className="h-3.5 w-3.5" /> {dt('Pezullo menjëherë')}</>
          )}
        </button>

        <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-400">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          {dt('Pezullimi çaktivizon identitetin në Firebase Auth dhe revokon sesionet — llogaria ndalon menjëherë.')}
        </p>

        {account.role === 'municipality' && (
          <div className="mt-3 rounded-lg border border-slate-200 p-3 dark:border-white/10">
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500">{dt('Plani i komunës')}</label>
            <div className="mt-1.5 flex gap-2">
              <select value={plan} onChange={event => setPlan(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-white/10 dark:bg-slate-800 dark:text-white">
                {MUNICIPALITY_PLANS.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
              </select>
              <button
                type="button"
                disabled={isBusy}
                onClick={async () => {
                  setIsBusy(true);
                  try {
                    const token = await requireAdminToken();
                    const response = await fetch(`/api/v1/admin/users/${encodeURIComponent(account.id)}/plan`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ plan }),
                    });
                    const result = await response.json().catch(() => ({}));
                    if (!response.ok) throw new Error(describeApiFailure(response.status, result));
                    toast.success(dt('Plani u ruajt.'));
                    onChanged?.();
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : dt('Plani nuk u ruajt.'));
                  } finally {
                    setIsBusy(false);
                  }
                }}
                className="rounded-lg bg-indigo-700 px-3 py-1.5 text-[11px] font-black text-white hover:bg-indigo-800 disabled:opacity-40"
              >
                {dt('Ruaj')}
              </button>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">{dt('Bazë: përgjigje dhe kërkesa. Standard: + shëndetësia, faktet, eksporti. Pro: + email te institucionet.')}</p>
          </div>
        )}

        <button
          type="button"
          onClick={() => setRemoving(true)}
          disabled={isBusy}
          className="mt-3 w-full rounded-lg border border-rose-300 px-3 py-2 text-[11px] font-black text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-40 dark:border-rose-500/40 dark:hover:bg-rose-500/10"
        >
          {dt('Hiq llogarinë përgjithmonë…')}
        </button>
        {removing && (
          <RemoveAccountDialog
            target={{ id: account.id, email: account.email ?? '', name: account.name }}
            onClose={() => setRemoving(false)}
            onRemoved={() => { setRemoving(false); onChanged?.(); }}
          />
        )}
      </div>
    </div>
  );
}
