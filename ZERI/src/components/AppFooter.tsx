import { dt } from '@/src/lib/dt';
import { BrandLogo } from '@/src/components/BrandLogo';
import { Link } from 'react-router-dom';
import { ShieldCheck, FileText, Info, Mail, Phone, ExternalLink, Github, Heart } from 'lucide-react';
import { CookiePreferencesButton } from './CookieConsentBanner';
import { SOCIAL_LINKS } from './SocialIcons';
import { InstallAppButton } from './InstallAppPrompt';

const COLUMNS = [
  {
    title: 'Platforma',
    links: [
      { to: '/', label: 'Ballina' },
      { to: '/harta', label: 'Harta e Raporteve' },
      { to: '/detailed-registry', label: 'Regjistri i Raporteve' },
      { to: '/statistikat', label: 'Statistikat' },
    ],
  },
  {
    title: 'Pjesëmarrja',
    links: [
      { to: '/raporto', label: 'Raporto një Problem' },
      { to: '/sondazhet', label: 'Sondazhet Publike' },
      { to: '/Idea', label: 'Idetë Qytetare' },
      { to: '/donacion', label: 'Ndihma & Donacione' },
    ],
  },
  {
    title: 'Shërbimet',
    links: [
      { to: '/sherbimet', label: 'Shërbimet' },
      { to: '/kontakt-numrat', label: 'Numrat & Institucionet' },
      { to: '/komunat', label: 'Komunat' },
      { to: '/shendetesia', label: 'Regjistri Shëndetësor' },
      { to: '/ndihma', label: 'Qendra e Ndihmës' },
    ],
  },
  {
    title: 'Ligji & Transparenca',
    links: [
      { to: '/transparenca', label: 'Qendra e Transparencës' },
      { to: '/privatesia', label: 'Politika e Privatësisë' },
      { to: '/kushtet-e-perdorimit', label: 'Kushtet e Përdorimit' },
      { to: '/trackid', label: 'Gjej Raportin Tim' },
      { to: '/rreth-projektit', label: 'Rreth Projektit' },
      { to: '/partneret', label: 'Partnerët & Reklama' },
    ],
  },
];

/**
 * Site footer.
 *
 * There was none. The privacy policy, the terms of use and the cookie
 * preferences were reachable only from the sidebar's least-visible group, and a
 * citizen on mobile had no way to change their cookie choice at all after the
 * first decision — which Law 06/L-082 requires to be possible at any time.
 */
export function AppFooter() {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-white dark:border-white/5 dark:bg-slate-900">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))]">
          <div>
            <Link to="/" className="inline-flex items-center gap-2.5">
              <BrandLogo markClassName="h-10 w-10" />
            </Link>

            <p className="mt-4 max-w-xs text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              {dt('Platforma kombëtare e angazhimit qytetar. Raportoni çështjet, ndiqni zgjidhjet dhe merrni pjesë në vendimmarrjen komunale.')}
            </p>

            <div className="mt-4 space-y-0 text-sm md:space-y-1.5 md:text-xs">
              <Link
                to="/kontakt"
                className="flex min-h-10 items-center gap-2 text-slate-500 transition-colors md:min-h-0 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
              >
                <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {dt('Na shkruani (formulari i kontaktit)')}
              </Link>
              <Link
                to="/kontakt-numrat"
                className="flex min-h-10 items-center gap-2 text-slate-500 transition-colors md:min-h-0 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
              >
                <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {dt('Numrat e institucioneve')}
              </Link>
            </div>

            <InstallAppButton />

            {/*
              Official social profiles.

              Placed directly under the contact block, in the first footer
              column: it is the one column every visitor reads, and the address
              and phone number next to it establish that these are official
              channels rather than a random row of icons. The mobile sheet
              repeats the same list, because the footer is far down a long page
              and a citizen should not have to scroll to the bottom to follow.
            */}
            <div className="mt-5">
              <h2 className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                {dt('Na ndiqni')}
              </h2>
              <ul className="mt-3 flex items-center gap-2">
                {SOCIAL_LINKS.map(({ id, label, href, Icon }) => (
                  <li key={id}>
                    <a
                      href={href}
                      target="_blank"
                      rel="me noopener noreferrer"
                      aria-label={label}
                      title={label}
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:border-transparent hover:bg-slate-900 hover:text-white dark:border-white/10 dark:text-slate-400 dark:hover:bg-white dark:hover:text-slate-900"
                    >
                      <Icon className="h-4 w-4" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.title} aria-label={dt(column.title)}>
              <h2 className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                {dt(column.title)}
              </h2>
              <ul className="mt-2 md:mt-3 md:space-y-2">
                {column.links.map((link) => (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      className="inline-flex min-h-10 items-center text-sm text-slate-600 transition-colors hover:text-blue-600 md:min-h-0 md:text-xs dark:text-slate-400 dark:hover:text-blue-400"
                    >
                      {dt(link.label)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-9 flex flex-col gap-4 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between dark:border-white/5">
          <p className="text-[11px] leading-relaxed text-slate-400">
            {dt('Të dhënat përpunohen sipas Ligjit Nr. 06/L-082 për Mbrojtjen e të Dhënave Personale në Kosovë dhe GDPR-së së Bashkimit Europian.')}
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <CookiePreferencesButton />
            <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <Heart className="h-3 w-3 text-rose-500" aria-hidden="true" />
              {dt('Bërë për qytetarët e Kosovës')}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
