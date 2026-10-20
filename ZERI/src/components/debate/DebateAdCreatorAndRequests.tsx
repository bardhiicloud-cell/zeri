import { useState } from 'react';
import toast from 'react-hot-toast';
import { dt } from '@/src/lib/dt';
import { cn } from '../../lib/utils';
import { createAdPost, decideVerification, formatWhen, verificationRequests } from '../../lib/debateApi';
import { Badge, Empty, ErrorNote, Panel, Spinner, btn, inputClass, useLoad } from './ui';
import { askReason } from '../../lib/dialogs';

/** Publish a sponsored post straight into the public debate, with a preview of how it reads. */
export function DebateAdCreator({ onCreated }: { onCreated?: () => void }) {
  const [form, setForm] = useState({ sponsorName: '', content: '', imageUrl: '', adLink: '', days: '7' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [key]: e.target.value });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      await createAdPost({ sponsorName: form.sponsorName.trim(), content: form.content.trim(), imageUrl: form.imageUrl.trim() || undefined, adLink: form.adLink.trim() || undefined, days: Number(form.days) });
      toast.success(dt('Reklama u publikua në debat.'));
      setForm({ sponsorName: '', content: '', imageUrl: '', adLink: '', days: '7' });
      onCreated?.();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <Panel>
      <h2 className="text-base font-black text-slate-900 dark:text-white">{dt('Krijo reklamë në debat')}</h2>
      <p className="mt-1 text-xs text-slate-500">{dt('Publikohet si postim i shënuar "Sponsorizuar" dhe ndalet vetë pas ditëve të caktuara.')}</p>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <form onSubmit={submit} className="space-y-3">
          <label className="block text-sm font-bold">{dt('Sponsori')}<input required value={form.sponsorName} onChange={set('sponsorName')} maxLength={120} className={cn(inputClass, 'mt-1')} /></label>
          <label className="block text-sm font-bold">{dt('Teksti')}<textarea required value={form.content} onChange={set('content')} maxLength={2000} rows={4} className={cn(inputClass, 'mt-1 py-2')} /></label>
          <label className="block text-sm font-bold">{dt('Imazhi (link https://, opsional)')}<input value={form.imageUrl} onChange={set('imageUrl')} className={cn(inputClass, 'mt-1')} /></label>
          <label className="block text-sm font-bold">{dt('Linku i reklamës (https://, opsional)')}<input value={form.adLink} onChange={set('adLink')} className={cn(inputClass, 'mt-1')} /></label>
          <label className="block text-sm font-bold">{dt('Kohëzgjatja (ditë, 1–90)')}<input type="number" min={1} max={90} required value={form.days} onChange={set('days')} className={cn(inputClass, 'mt-1 w-32')} /></label>
          <ErrorNote message={error} />
          <button type="submit" disabled={busy} className={btn.primary}>{busy ? <Spinner /> : null}{dt('Publiko reklamën')}</button>
        </form>
        <div aria-label={dt('Parapamja')} className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
          <p className="text-[11px] font-black uppercase tracking-wider text-amber-600">{dt('Sponsorizuar')}</p>
          <p className="mt-1 font-black text-slate-900 dark:text-white">{form.sponsorName || dt('Emri i sponsorit')}</p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{form.content || dt('Teksti i reklamës shfaqet këtu.')}</p>
          {form.imageUrl.startsWith('https://') && <img src={form.imageUrl} alt="" className="mt-3 max-h-56 w-full rounded-xl object-cover" />}
          {form.adLink && <p className="mt-3 truncate text-xs font-bold text-blue-600">{form.adLink}</p>}
        </div>
      </div>
    </Panel>
  );
}

/** People asking for the tick. Approve gives 30 days (renewable in "Verifikimet"); reject tells them why. */
export function DebateVerificationRequests() {
  const [status, setStatus] = useState('pending');
  const { data, error, loading, reload } = useLoad(() => verificationRequests(status), [status]);
  const [busy, setBusy] = useState('');

  const decide = async (uid: string, decision: 'approve' | 'reject') => {
    const note = decision === 'reject' ? await askReason(dt('Arsyeja e refuzimit (e lexon personi):')) ?? '' : '';
    if (decision === 'reject' && note.trim().length < 5) return;
    setBusy(uid);
    try {
      await decideVerification(uid, decision, note.trim() || undefined);
      toast.success(decision === 'approve' ? dt('Llogaria u verifikua.') : dt('Kërkesa u refuzua.'));
      await reload();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(''); }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {[['pending', 'Në pritje'], ['approved', 'Të aprovuara'], ['rejected', 'Të refuzuara']].map(([id, label]) => (
          <button key={id} type="button" aria-pressed={status === id} onClick={() => setStatus(id)} className={cn('min-h-9 rounded-full px-3 text-sm font-bold', status === id ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-white text-slate-600 dark:bg-slate-900 dark:text-slate-300')}>{dt(label)}</button>
        ))}
      </div>
      <ErrorNote message={error} />
      {loading && <Spinner />}
      {!loading && (data ?? []).length === 0 && <Panel><Empty>{dt('Nuk ka kërkesa këtu.')}</Empty></Panel>}
      {(data ?? []).map((item) => (
        <Panel key={item.uid}>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-black text-slate-900 dark:text-white">{item.name || item.uid}</p>
            <Badge tone={item.status === 'pending' ? 'amber' : item.status === 'approved' ? 'emerald' : 'rose'}>{dt(item.status === 'pending' ? 'Në pritje' : item.status === 'approved' ? 'Aprovuar' : 'Refuzuar')}</Badge>
            <span className="ml-auto text-xs text-slate-500">{formatWhen(item.createdAtMs)}</span>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{item.reason}</p>
          {item.link && <a href={item.link} target="_blank" rel="noopener noreferrer" className="mt-1 block truncate text-xs font-bold text-blue-600 underline">{item.link}</a>}
          {item.note && <p className="mt-1 text-xs text-slate-500">{dt('Shënim')}: {item.note}</p>}
          {item.status === 'pending' && (
            <div className="mt-3 flex gap-2">
              <button type="button" disabled={busy === item.uid} onClick={() => void decide(item.uid, 'approve')} className={btn.success}>{dt('Verifiko')}</button>
              <button type="button" disabled={busy === item.uid} onClick={() => void decide(item.uid, 'reject')} className={btn.ghost}>{dt('Refuzo')}</button>
            </div>
          )}
        </Panel>
      ))}
    </div>
  );
}
