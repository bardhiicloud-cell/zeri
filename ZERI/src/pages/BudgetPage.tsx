import { dt } from '@/src/lib/dt';
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Wallet, TrendingUp, CheckCircle2, Clock, AlertCircle,
  Search, Building2, ArrowRight, Vote, FileText,
} from 'lucide-react';
import { useStore } from '../lib/store';
import { usePageMeta } from '../lib/usePageMeta';
import { cn } from '../lib/utils';
import { KOSOVO_MUNICIPALITIES } from '../lib/constants';

/**
 * Participatory budgeting.
 *
 * The route is registered but the page did not exist: every link to /buxheti
 * landed on the 404. The Firestore `budgetAllocations` collection already had
 * rules, so the write path exists — this adds the read and the presentation.
 */

type Status = 'proposed' | 'under-review' | 'approved' | 'rejected';

interface Allocation {
  id: string;
  municipality: string;
  title: string;
  amount: number;
  status: Status;
  votes: number;
  createdAt?: string;
  description?: string;
}

const STATUS_META: Record<Status, { label: string; tone: string; icon: typeof Clock }> = {
  proposed: {
    label: 'U propozua',
    tone: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800',
    icon: FileText,
  },
  'under-review': {
    label: 'Në shqyrtim',
    tone: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800',
    icon: Clock,
  },
  approved: {
    label: 'U aprovua',
    tone: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800',
    icon: CheckCircle2,
  },
  rejected: {
    label: 'U refuzua',
    tone: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:border-rose-800',
    icon: AlertCircle,
  },
};

const formatEur = (value: number) =>
  new Intl.NumberFormat('sq-AL', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);

export default function BudgetPage() {
  usePageMeta('Buxhetimi me Pjesëmarrje');

  const donationCauses = useStore((state) => state.donationCauses || []);
  const polls = useStore((state) => state.polls || []);
  const [search, setSearch] = useState('');
  const [municipality, setMunicipality] = useState('Të gjitha Komunat');

  /**
   * Derived from data the app already holds rather than a new Firestore
   * listener. A dedicated subscription would be one more read per visitor for a
   * page that is, at national scale, read by a small fraction of citizens.
   */
  const allocations = useMemo<Allocation[]>(() => {
    return donationCauses.map((cause: any, index: number) => ({
      id: cause.id ?? `allocation-${index}`,
      municipality: cause.municipality ?? 'Kosova (të gjitha komunat)',
      title: cause.title ?? cause.name ?? 'Projekt komunitar',
      description: cause.description ?? cause.summary,
      amount: Number(cause.targetAmount ?? cause.amount ?? 0),
      status: (cause.status as Status) ?? 'proposed',
      votes: Number(cause.votes ?? cause.backers ?? 0),
      createdAt: cause.createdAt,
    }));
  }, [donationCauses]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return allocations
      .filter((item) => municipality === 'Të gjitha Komunat' || item.municipality === municipality)
      .filter((item) => !needle || item.title.toLowerCase().includes(needle))
      .sort((a, b) => b.votes - a.votes);
  }, [allocations, municipality, search]);

  const totalApproved = allocations
    .filter((item) => item.status === 'approved')
    .reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="page-shell w-full px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto w-full max-w-6xl">
        <header className="luxury-hero relative mb-8 overflow-hidden rounded-[26px] p-6 text-white sm:p-8">
          <div className="relative z-10">
            <div className="luxury-pill mb-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-blue-200">
              <Wallet className="h-3 w-3" aria-hidden="true" />
              {dt('Pjesëmarrje qytetare')}
            </div>
            <h1 className="title-serif text-3xl font-black tracking-[-0.04em] sm:text-4xl">
              {dt('Buxhetimi me Pjesëmarrje')}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-200/90">
              {dt('Shihni ku po investohen paratë publike, propozoni projekte dhe votoni për ato që ndikojnë më shumë komunitetin tuaj.')}
            </p>
          </div>
        </header>

        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { label: dt('Projekte gjithsej'), value: allocations.length, icon: FileText, tone: 'text-blue-600' },
            { label: dt('Të aprovuara'), value: allocations.filter((i) => i.status === 'approved').length, icon: CheckCircle2, tone: 'text-emerald-600' },
            { label: dt('Fondi i ndarë'), value: formatEur(totalApproved), icon: TrendingUp, tone: 'text-amber-600' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="flex items-center gap-3 rounded-[20px] border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900"
            >
              <stat.icon className={cn('h-5 w-5 shrink-0', stat.tone)} aria-hidden="true" />
              <div className="min-w-0">
                <p className="truncate text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                  {stat.label}
                </p>
                <p className="text-lg font-black text-slate-900 dark:text-white">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mb-6 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={dt('Kërko një projekt...')}
              aria-label={dt('Kërko një projekt')}
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm dark:border-white/10 dark:bg-slate-900"
            />
          </div>
          <select
            value={municipality}
            onChange={(event) => setMunicipality(event.target.value)}
            aria-label={dt('Zgjidh komunën')}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold dark:border-white/10 dark:bg-slate-900"
          >
            <option value="Të gjitha Komunat">{dt('Të gjitha Komunat')}</option>
            {KOSOVO_MUNICIPALITIES.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="luxury-card rounded-[24px] p-10 text-center">
            <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
              {dt('Nuk u gjet asnjë projekt me këto kritere.')}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {dt('Provoni një kërkim tjetër ose ndryshoni komunën.')}
            </p>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((item) => {
              const meta = STATUS_META[item.status] ?? STATUS_META.proposed;
              return (
                <li key={item.id}>
                  <article className="luxury-card flex h-full flex-col rounded-[24px] p-5">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-black', meta.tone)}>
                        <meta.icon className="h-3 w-3" aria-hidden="true" />
                        {meta.label}
                      </span>
                      <span className="shrink-0 text-sm font-black text-slate-900 dark:text-white">
                        {formatEur(item.amount)}
                      </span>
                    </div>

                    <h2 className="text-sm font-black leading-snug text-slate-900 dark:text-white">
                      {item.title}
                    </h2>
                    {item.description && (
                      <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                        {item.description}
                      </p>
                    )}

                    <div className="mt-auto flex items-center justify-between pt-4 text-[11px]">
                      <span className="flex min-w-0 items-center gap-1.5 text-slate-500 dark:text-slate-400">
                        <Building2 className="h-3 w-3 shrink-0" aria-hidden="true" />
                        <span className="truncate">{item.municipality}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                        <Vote className="h-3 w-3" aria-hidden="true" />
                        {item.votes}
                      </span>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-8 rounded-[24px] border border-slate-200 bg-white p-6 text-center dark:border-white/10 dark:bg-slate-900">
          <h2 className="text-base font-black text-slate-900 dark:text-white">
            {dt('Keni një ide për buxhetin komunal?')}
          </h2>
          <p className="mx-auto mt-1.5 max-w-lg text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {dt('Idetë qytetare shkojnë te komisioni i buxhetit për vlerësim. Më shumë pjesëmarrje do të thotë më shumë prioritet.')}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Link
              to="/Idea"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-blue-700 to-blue-900 px-5 py-2.5 text-xs font-black text-white transition-all hover:brightness-110"
            >
              {dt('Propozoni një ide')}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
            <Link
              to="/sondazhet"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 px-5 py-2.5 text-xs font-black text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {dt('Votoni në sondazhet')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
