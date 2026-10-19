import { useEffect } from 'react';
import { ArrowRight, BookOpen, X } from 'lucide-react';
import { dt } from '@/src/lib/dt';
import { GLOBAL_TIPS, SECTION_GUIDES, roleNote } from '../../lib/adminGuides';
import { NAV_BY_ID } from './nav/navConfig';
import type { AdminSection } from '../../lib/adminPermissions';

/**
 * "Si punon": the guide of the section you are in, as a side panel.
 *
 * Opens from the header, closes with Esc. It never replaces the section; it
 * explains it, and links to the section the work usually continues in.
 */
export interface SectionGuidePanelProps {
  sectionId: AdminSection;
  role: string;
  onClose: () => void;
  onGo: (id: AdminSection) => void;
  /** Sections the viewer may open; "next" links to others are not shown. */
  openable: ReadonlySet<string>;
}

export default function SectionGuidePanel({ sectionId, role, onClose, onGo, openable }: SectionGuidePanelProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const section = NAV_BY_ID.get(sectionId);
  const guide = SECTION_GUIDES[sectionId];
  const note = roleNote(sectionId, role);

  return (
    <div className="fixed inset-0 z-[540]" role="dialog" aria-modal="true" aria-label={dt('Si punon')}>
      <button type="button" aria-label={dt('Mbyll')} onClick={onClose} className="absolute inset-0 bg-slate-950/50 md:backdrop-blur-[2px]" />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl dark:bg-slate-900">
        <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 px-5 py-4 dark:border-white/10">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-600 text-white"><BookOpen className="h-4 w-4" aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{dt('Si punon')}</p>
            <h2 className="truncate text-base font-bold text-slate-900 dark:text-white">{section?.label ?? sectionId}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label={dt('Mbyll')} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
        </header>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 text-sm">
          {guide ? (
            <>
              <section>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{dt('Për çfarë shërben')}</h3>
                <p className="mt-1.5 leading-relaxed text-slate-800 dark:text-slate-100">{dt(guide.purpose)}</p>
                {note && <p className="mt-2 rounded-lg bg-indigo-50 p-2.5 text-xs leading-relaxed text-indigo-900 dark:bg-indigo-500/10 dark:text-indigo-200">{dt(note)}</p>}
              </section>

              <section>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{dt('Si punohet, hap pas hapi')}</h3>
                <ol className="mt-2 space-y-2">
                  {guide.steps.map((step, index) => (
                    <li key={step} className="flex gap-2.5">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-slate-900 text-[10px] font-bold text-white dark:bg-white dark:text-slate-900">{index + 1}</span>
                      <span className="leading-relaxed text-slate-700 dark:text-slate-200">{dt(step)}</span>
                    </li>
                  ))}
                </ol>
              </section>

              <section>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{dt('Rregullat')}</h3>
                <ul className="mt-2 space-y-1.5">
                  {guide.rules.map(rule => (
                    <li key={rule} className="flex gap-2 leading-relaxed text-slate-700 dark:text-slate-200"><span className="text-emerald-600">✓</span><span>{dt(rule)}</span></li>
                  ))}
                </ul>
              </section>

              {guide.next && guide.next.some(item => openable.has(item.id)) && (
                <section>
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{dt('Vazhdon te')}</h3>
                  <ul className="mt-2 space-y-1.5">
                    {guide.next.filter(item => openable.has(item.id)).map(item => (
                      <li key={item.id}>
                        <button type="button" onClick={() => { onGo(item.id as AdminSection); onClose(); }} className="flex w-full items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-slate-800">
                          <ArrowRight className="h-3.5 w-3.5 text-indigo-600" aria-hidden="true" />
                          <span>{NAV_BY_ID.get(item.id as AdminSection)?.nav ?? item.id}</span>
                          <span className="ml-auto font-normal text-slate-400">{dt(item.why)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          ) : (
            <p className="text-slate-500">{dt('Për këtë fushë nuk ka ende udhëzues.')}</p>
          )}

          <section className="rounded-xl border border-slate-200 p-4 dark:border-white/10">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{dt('Kudo në panel')}</h3>
            <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              {GLOBAL_TIPS.map(tip => <li key={tip}>• {dt(tip)}</li>)}
            </ul>
          </section>
        </div>
      </aside>
    </div>
  );
}
