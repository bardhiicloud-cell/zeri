import { useEffect, useMemo, useState } from 'react';
import { Globe, Mail, Phone, Search, X } from 'lucide-react';
import { dt } from '@/src/lib/dt';
import { cn } from '../../lib/utils';
import { CENTRAL_BODIES, CONTACTS_CHECKED_ON, EMERGENCY_NUMBERS, MUNICIPAL_CONTACTS, type ContactPoint, type EmailStatus } from '../../data/institutionContacts';

/**
 * Every institution a citizen's problem can end up with, and how to reach it: the
 * ministries and public bodies, the emergency numbers and the 38 municipalities.
 * Read-only; the values come from data/institutionContacts.ts, which says where each one
 * was read and how far it can be trusted.
 */
const STATUS: Record<EmailStatus, { label: string; tone: string }> = {
  general: { label: 'Email i verifikuar', tone: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200' },
  role: { label: 'Kuti zyre (konfirmoni)', tone: 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200' },
  personal: { label: 'Email personal', tone: 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200' },
  external: { label: 'Adresë e jashtme', tone: 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200' },
  placeholder: { label: 'Pa email (shabllon)', tone: 'bg-rose-50 text-rose-800 dark:bg-rose-500/15 dark:text-rose-200' },
  missing: { label: 'Pa email', tone: 'bg-rose-50 text-rose-800 dark:bg-rose-500/15 dark:text-rose-200' },
};

interface Entry { key: string; name: string; group: 'central' | 'municipal'; contact: ContactPoint }

const fold = (value: string) => value.toLocaleLowerCase('sq-AL').normalize('NFD').replace(/[̀-ͯ]/g, '');

const ENTRIES: readonly Entry[] = [
  ...Object.values(CENTRAL_BODIES).map(body => ({ key: `c:${body.id}`, name: body.name, group: 'central' as const, contact: body.contact })),
  ...Object.entries(MUNICIPAL_CONTACTS).map(([name, contact]) => ({ key: `m:${name}`, name: `Komuna ${name}`, group: 'municipal' as const, contact })),
];

export default function ContactsDirectory({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'central' | 'municipal'>('central');

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const shown = useMemo(() => {
    const words = fold(query).split(/\s+/).filter(Boolean);
    return ENTRIES.filter(entry => entry.group === tab && words.every(word => fold(`${entry.name} ${entry.contact.email ?? ''} ${entry.contact.phone ?? ''}`).includes(word)));
  }, [query, tab]);

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label={dt('Kontaktet e institucioneve')}>
      <button type="button" aria-label={dt('Mbyll')} onClick={onClose} className="absolute inset-0 bg-slate-950/60" />
      <div className="absolute inset-x-0 bottom-0 top-10 mx-auto flex w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl dark:bg-slate-900 sm:inset-y-8 sm:rounded-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-white/10">
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-white">{dt('Kontaktet e institucioneve')}</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{dt('Të lexuara nga faqet zyrtare më')} {CONTACTS_CHECKED_ON}. {dt('Verifikojini para përdorimit.')}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={dt('Mbyll')} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-white/10"><X className="h-5 w-5" aria-hidden="true" /></button>
        </div>

        <div className="shrink-0 space-y-3 border-b border-slate-200 p-3 dark:border-white/10">
          <div className="grid grid-cols-4 gap-1.5" aria-label={dt('Numrat e urgjencës')}>
            {EMERGENCY_NUMBERS.map(item => (
              <a key={item.number} href={`tel:${item.number}`} className="rounded-xl bg-rose-50 px-2 py-2 text-center text-rose-800 dark:bg-rose-500/15 dark:text-rose-100">
                <span className="block text-lg font-black leading-none">{item.number}</span>
                <span className="mt-1 block text-[10px] font-bold leading-tight">{dt(item.label)}</span>
              </a>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-white/10" role="tablist">
              {([['central', 'Ministri & institucione'], ['municipal', 'Komunat (38)']] as const).map(([id, label]) => (
                <button key={id} role="tab" aria-selected={tab === id} type="button" onClick={() => setTab(id)} className={cn('min-h-9 rounded-lg px-3 text-xs font-bold', tab === id ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-600 dark:text-slate-300')}>{dt(label)}</button>
              ))}
            </div>
            <label className="relative min-w-0 flex-1 basis-48">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input value={query} onChange={event => setQuery(event.target.value)} placeholder={dt('Kërko institucion, email ose numër…')} className="min-h-10 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-2.5 text-sm dark:border-white/10 dark:bg-slate-800 dark:text-white" />
            </label>
          </div>
        </div>

        <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          {shown.length === 0 && <li className="p-6 text-center text-sm text-slate-500">{dt('Nuk u gjet asgjë.')}</li>}
          {shown.map(entry => {
            const { contact } = entry;
            const state = STATUS[contact.status];
            return (
              <li key={entry.key} className="rounded-xl border border-slate-200 p-3 dark:border-white/10">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="min-w-0 text-sm font-black text-slate-900 dark:text-white">{entry.name}</p>
                  <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold', state.tone)}>{dt(state.label)}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
                  {contact.email && <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-1 break-all font-semibold text-blue-700 hover:underline dark:text-blue-300"><Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{contact.email}</a>}
                  {contact.phone && <a href={`tel:${contact.phone.replace(/\s+/g, '')}`} className="inline-flex items-center gap-1 font-semibold hover:underline"><Phone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{contact.phone}</a>}
                  {contact.site && <a href={contact.site} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline"><Globe className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{contact.site.replace(/^https?:\/\//, '')}</a>}
                </div>
                {contact.note && <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">{contact.note}</p>}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
