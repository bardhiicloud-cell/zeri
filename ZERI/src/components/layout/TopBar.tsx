import React from 'react';
import { useLocation } from 'react-router-dom';
import { UserRound, FileText, PenSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../lib/LanguageContext';

import { dt } from '@/src/lib/dt';
export function TopBar() {
  const location = useLocation();
  const { t } = useLanguage();

  const hiddenRoutes = ['/login', '/register', '/admin'];
  if (hiddenRoutes.includes(location.pathname)) {
    return null;
  }

  const links = [
    ['Komunat', '/komunat'],
    ['Shërbimet', '/sherbimet'],
    ['Projektet', '/projektet'],
    ['Lajme', '/lajme'],
    ['Kontakt', '/kontakt'],
    ['Rreth Projektit', '/rreth-projektit']
  ];

  return (
    <header className="hidden md:block sticky top-0 z-[1000] w-full bg-(--color-surface-elevated)/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-(--color-border-soft) dark:border-white/10 text-slate-900 dark:text-white shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-5">
        <Link to="/" className="flex items-center gap-2 shrink-0" aria-label={dt('Zëri Qytetarëve')}>
          <div className="w-8 h-8 rounded-lg bg-(--color-brand-navy) text-white flex items-center justify-center font-black">Z</div>
          <span className="hidden sm:block text-sm font-black text-(--color-brand-navy) dark:text-white whitespace-nowrap">{dt('Zëri Qytetarëve')}</span>
        </Link>
        <nav className="flex items-center gap-4 sm:gap-6 text-xs font-bold overflow-x-auto hide-scrollbar flex-1" aria-label="Navigimi publik">
          {links.map(([label, href]) => (
            <Link key={href} to={href} className={`whitespace-nowrap py-1.5 transition-colors ${location.pathname.startsWith(href) ? 'text-(--color-brand-primary) border-b-2 border-(--color-brand-primary)' : 'text-slate-600 dark:text-slate-300 hover:text-(--color-brand-primary)'}`}>
              {label}
            </Link>
          ))}
        </nav>
        <Link to="/trackid" className="hidden lg:inline-flex items-center gap-1.5 shrink-0 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-(--color-brand-primary)" aria-label={dt('Track ID')}>
          <FileText className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{dt('Track ID')}</span>
        </Link>
        <Link to="/raporto" className="inline-flex items-center gap-1.5 shrink-0 rounded-lg bg-(--color-action-report) px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-(--color-action-report-hover)" aria-label={dt('Raporto')}>
          <PenSquare className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{dt('Raporto')}</span>
        </Link>
        <Link to="/login" className="shrink-0 text-(--color-brand-primary) hover:text-(--color-brand-navy)" aria-label={t('login')}>
          <UserRound className="w-4 h-4" aria-hidden="true" />
        </Link>
      </div>
    </header>
  );
}
