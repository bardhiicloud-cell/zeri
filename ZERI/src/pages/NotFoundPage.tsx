import { dt } from '@/src/lib/dt';
import { useNavigate, Link } from 'react-router-dom';
import { Home, Search, MapPin, MessageSquare, FileText, ArrowLeft, Compass } from 'lucide-react';
import { usePageMeta } from '../lib/usePageMeta';

/**
 * 404 for the browser router.
 *
 * There was no catch-all route, so any mistyped or stale link rendered a blank
 * screen below the sidebar. At national scale, with links shared on social media
 * and printed on municipal notices, that is a predictable and very common path.
 */
export default function NotFoundPage() {
  const navigate = useNavigate();
  usePageMeta('Faqja nuk u gjet');

  const suggestions = [
    { to: '/', label: 'Ballina', icon: Home, hint: 'Numrat e ditës dhe aktiviteti' },
    { to: '/raporto', label: 'Raporto një problem', icon: FileText, hint: 'Njofti institucionin përgjegjës' },
    { to: '/harta', label: 'Harta e raporteve', icon: MapPin, hint: 'Shiko çfarë po ndodh rreth teje' },
    { to: '/forum', label: 'Debati Publik', icon: MessageSquare, hint: 'Bisedo me qytetarët' },
  ];

  return (
    <div className="page-shell flex min-h-[70vh] w-full flex-col items-center justify-center px-4 py-16 text-center">
      <div className="w-full max-w-2xl">
        <div className="mb-6 inline-flex items-center gap-2.5 rounded-full bg-blue-50 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
          <Compass className="h-3.5 w-3.5" aria-hidden="true" />
          {dt('Gabim 404')}
        </div>

        <h1 className="title-serif text-6xl font-black tracking-tight text-slate-900 sm:text-7xl dark:text-white">
          404
        </h1>

        <h2 className="title-serif mt-3 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl dark:text-white">
          {dt('Kjo faqe nuk u gjet')}
        </h2>

        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          {dt('Adresa që kërkuat nuk ekziston ose është zhvendosur. Mund të jetë një lidhje e vjetruar ose një gabim shkrimi.')}
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-700 to-blue-900 px-5 py-2.5 text-xs font-black text-white transition-all hover:brightness-110 sm:w-auto"
          >
            <Home className="h-4 w-4" aria-hidden="true" />
            {dt('Kthehu te Ballina')}
          </button>

          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 px-5 py-2.5 text-xs font-black text-slate-700 transition-colors hover:bg-slate-50 sm:w-auto dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {dt('Kthehu mbrapa')}
          </button>
        </div>

        <div className="mt-10">
          <p className="mb-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
            {dt('Ndoshta keni kërkuar')}
          </p>
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {suggestions.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className="luxury-card group flex min-h-[64px] items-center gap-3 rounded-2xl px-4 py-3 text-left transition-transform duration-300 hover:-translate-y-0.5"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 transition-colors group-hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300">
                    <item.icon className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <span className="min-w-0">
                    <span className="block text-xs font-black text-slate-900 dark:text-white">
                      {item.label}
                    </span>
                    <span className="block truncate text-[10px] text-slate-500 dark:text-slate-400">
                      {item.hint}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
