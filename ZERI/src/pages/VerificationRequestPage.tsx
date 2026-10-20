import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck } from 'lucide-react';
import { dt } from '@/src/lib/dt';
import { useStore } from '../lib/store';
import { myVerificationRequest, requestVerification } from '../lib/debateApi';
import SubmissionOverlay from '../components/SubmissionOverlay';

/** A citizen asks the debate admin for the verification tick and follows the answer. */
export default function VerificationRequestPage() {
  const user = useStore(state => state.currentUser);
  const [current, setCurrent] = useState<{ status: string; note: string } | null | undefined>(undefined);
  const [reason, setReason] = useState('');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = () => myVerificationRequest().then(r => setCurrent(r.request)).catch(() => setCurrent(null));
  useEffect(() => { if (user && user.role !== 'guest') void load(); }, [user]);

  if (!user || user.role === 'guest') {
    return <main className="mx-auto max-w-xl px-4 py-16 text-center"><p>{dt('Kyçuni për të kërkuar verifikim.')}</p><Link to="/login" className="mt-4 inline-block font-bold underline">{dt('Kyçu')}</Link></main>;
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setError('');
    try { await requestVerification(reason.trim(), link.trim() || undefined); await load(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <>
      <SubmissionOverlay busy={busy} kind="verify" />
    <main className="mx-auto max-w-xl space-y-4 px-4 py-10">
      <h1 className="flex items-center gap-2 text-2xl font-black text-slate-900 dark:text-white"><BadgeCheck className="h-6 w-6 text-blue-600" aria-hidden="true" />{dt('Kërko verifikimin e llogarisë')}</h1>
      {user.isVerified && <p className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{dt('Llogaria juaj është e verifikuar.')}</p>}
      {current?.status === 'pending' && <p className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">{dt('Kërkesa juaj është në shqyrtim nga administratori i debatit.')}</p>}
      {current?.status === 'rejected' && <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-800">{dt('Kërkesa e fundit u refuzua')}: {current.note}</p>}
      {!user.isVerified && current?.status !== 'pending' && (
        <form onSubmit={submit} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
          <label className="block text-sm font-bold">{dt('Kush jeni dhe pse kërkoni verifikim? (10–600 shenja)')}
            <textarea required minLength={10} maxLength={600} rows={4} value={reason} onChange={e => setReason(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-base sm:text-sm dark:border-white/15 dark:bg-slate-950" />
          </label>
          <label className="block text-sm font-bold">{dt('Link që e vërteton (faqe zyrtare, profil publik; opsional)')}
            <input value={link} onChange={e => setLink(e.target.value)} placeholder="https://" className="mt-1 min-h-10 w-full rounded-xl border border-slate-300 px-3 dark:border-white/15 dark:bg-slate-950" />
          </label>
          {error && <p role="alert" className="text-sm font-semibold text-rose-700">{error}</p>}
          <button type="submit" disabled={busy} className="min-h-10 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white disabled:opacity-50">{busy ? dt('Duke dërguar…') : dt('Dërgo kërkesën')}</button>
        </form>
      )}
    </main>
    </>
  );
}
