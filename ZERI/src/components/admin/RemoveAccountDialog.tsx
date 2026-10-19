import { useState } from 'react';
import toast from 'react-hot-toast';
import { dt } from '../../lib/dt';
import { requireAdminToken, describeApiFailure } from '../../lib/adminApi';

/**
 * Confirmation for removing a staff or municipal account.
 *
 * The server does the work (DELETE /api/v1/admin/users/:uid): it ends the sign-in
 * and sessions, then the profile, and keeps everything the person did attributed
 * to them. This dialog asks for a reason and for the account's email to be typed,
 * so a click on the wrong row cannot remove someone.
 */
export interface RemoveAccountTarget {
  id: string;
  email: string;
  name: string;
}

interface Props {
  target: RemoveAccountTarget;
  onClose: () => void;
  onRemoved: () => void;
}

export default function RemoveAccountDialog({ target, onClose, onRemoved }: Props) {
  const [reason, setReason] = useState('');
  const [typedEmail, setTypedEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const ready = reason.trim().length >= 5 && typedEmail.trim().toLowerCase() === target.email.trim().toLowerCase();

  const confirm = async () => {
    setBusy(true);
    try {
      const token = await requireAdminToken();
      const response = await fetch(`/api/v1/admin/users/${encodeURIComponent(target.id)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason, confirmEmail: typedEmail }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(describeApiFailure(response.status, result));
      if (result.releaseIncomplete) {
        // The account is gone, but some of its reports may still name it: say so rather than imply all is tidy.
        toast.error(dt('Llogaria u hoq, por raportimet e saj nuk u kthyen të gjitha në radhën e përbashkët. Kontrolloni "Të miat" të panjohura.'), { duration: 10000 });
      } else {
        toast.success(Number(result.releasedReports) > 0
          ? dt('Llogaria u hoq. Raportimet që mbante u kthyen në radhën e përbashkët.')
          : dt('Llogaria u hoq. Puna e saj mbetet e regjistruar.'));
      }
      onRemoved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dt('Llogaria nuk u hoq.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center bg-slate-950/60 p-4 md:backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={dt('Hiq llogarinë')}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{dt('Hiq llogarinë e')} {target.name}</h3>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {dt('Hyrja dhe sesionet e saj mbyllen menjëherë dhe profili fshihet. Raportet, veprimet dhe historiku i saj mbeten të regjistruara me emër.')}
        </p>
        <label className="mt-4 block text-xs font-bold uppercase tracking-wider text-slate-500">{dt('Arsyeja')}</label>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={2}
          maxLength={300}
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm dark:border-white/10 dark:bg-slate-800 dark:text-white"
          placeholder={dt('p.sh. Ka lënë punën')}
        />
        <label className="mt-3 block text-xs font-bold uppercase tracking-wider text-slate-500">
          {dt('Shkruani emailin për ta konfirmuar')}: <span className="font-mono normal-case">{target.email}</span>
        </label>
        <input
          value={typedEmail}
          onChange={e => setTypedEmail(e.target.value)}
          autoComplete="off"
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm dark:border-white/10 dark:bg-slate-800 dark:text-white"
        />
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800">
            {dt('Anulo')}
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={busy || !ready}
            className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? dt('Duke hequr…') : dt('Hiq llogarinë')}
          </button>
        </div>
      </div>
    </div>
  );
}
