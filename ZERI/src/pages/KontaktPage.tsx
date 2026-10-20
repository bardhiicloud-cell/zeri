import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Phone, Send, ShieldAlert, CheckCircle2, AlertTriangle, Loader2, Copy, Search, BookOpen, FileText,
  ArrowDown, ArrowUpRight,
} from 'lucide-react';
import { AuraPage, AuraHero, AuraSection, AuraNote, AuraOrbit } from '../components/aura/Aura';
import { KOSOVO_MUNICIPALITIES } from '../lib/constants';
import toast from 'react-hot-toast';

import { dt } from '@/src/lib/dt';

const TOPICS = [
  'Pyetje për platformën',
  'Problem teknik (hyrje, ngarkim, hartë)',
  'Sugjerim për përmirësim',
  'Pyetje për një raport ekzistues',
  'Të dhënat personale dhe privatësia',
  'Bashkëpunim dhe media',
  'Tjetër',
];

const LIMITS = { name: 120, email: 254, phone: 40, subject: 160, message: 4000 };

type Fields = 'name' | 'email' | 'phone' | 'municipality' | 'topic' | 'subject' | 'message';
type Form = Record<Fields, string>;
const EMPTY: Form = { name: '', email: '', phone: '', municipality: '', topic: TOPICS[0], subject: '', message: '' };

/** Same rules as server/contactMessages.ts, so most mistakes are caught before a request is sent. */
function validate(f: Form): Partial<Record<Fields, string>> {
  const e: Partial<Record<Fields, string>> = {};
  if (f.name.trim().length < 2) e.name = 'Shkruani emrin tuaj.';
  if (f.subject.trim().length < 3) e.subject = 'Shkruani një subjekt të shkurtër.';
  if (f.message.trim().length < 10) e.message = 'Mesazhi duhet të ketë të paktën 10 shkronja.';
  if (f.email.trim() && !/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/.test(f.email.trim())) e.email = 'Adresa e emailit nuk duket e saktë.';
  if (f.phone.trim() && !/^[+\d][\d\s()./-]{5,}$/.test(f.phone.trim())) e.phone = 'Numri i telefonit nuk duket i saktë.';
  return e;
}

const inputCls = (invalid: boolean) =>
  `w-full min-h-11 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
    invalid ? 'border-red-400 dark:border-red-500/70' : 'border-slate-200 dark:border-white/10'
  }`;

export default function KontaktPage() {
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<Fields, string>>>({});
  const [honeypot, setHoneypot] = useState('');
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);


  const set = (k: Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [k]: e.target.value }));
    if (errors[k]) setErrors(prev => ({ ...prev, [k]: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    setFailure(null);
    const found = validate(form);
    setErrors(found);
    const first = (Object.keys(found) as Fields[])[0];
    if (first) {
      formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/v1/public/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, website: honeypot }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 400 && data?.fields) {
        setErrors(data.fields);
        setFailure(data.error || 'Kontrolloni fushat e shënuara.');
        return;
      }
      if (res.status === 429) {
        setFailure(data?.error || 'Keni dërguar shumë mesazhe. Provoni përsëri pas pak.');
        return;
      }
      if (!res.ok || !data?.ok) {
        setFailure(data?.error || 'Mesazhi nuk u dërgua. Teksti juaj është ruajtur në faqe; provoni përsëri.');
        return;
      }
      setReference(data.reference || '');
      setForm(EMPTY);
    } catch {
      setFailure('Nuk u arrit lidhja me serverin. Teksti juaj është ruajtur në faqe; kontrolloni internetin dhe provoni përsëri.');
    } finally {
      setSending(false);
    }
  };

  const copyReference = async () => {
    if (!reference) return;
    try {
      await navigator.clipboard.writeText(reference);
      toast.success(dt('Referenca u kopjua.'));
    } catch {
      toast.error(dt('Kopjimi nuk u realizua. Shënojeni referencën me dorë.'));
    }
  };

  const err = (k: Fields) => errors[k];
  const describedBy = (k: Fields) => (err(k) ? `${k}-error` : undefined);

  return (
    <AuraPage>
      <AuraHero
        visual={<AuraOrbit core={Phone} />}
        tone="teal"
        eyebrow={dt('Kontakt')}
        icon={Phone}
        title={dt('Na shkruani')}
        subtitle={dt('Pyetje për platformën, probleme teknike ose sugjerime? Dërgoni një mesazh ekipit. Për një problem në qytetin tuaj përdorni “Raporto problem”.')}
        actions={<a href="#forma" className="au-btn au-btn-light">{dt('Dërgo mesazh')} <ArrowDown className="h-4 w-4" aria-hidden="true" /></a>}
      />

      {/* Emergency numbers: compact, always first. */}
      <section aria-labelledby="emergency-title" className="au-tile p-4 sm:p-5">
        <h2 id="emergency-title" className="flex items-center gap-2 text-[13px] font-semibold text-rose-700 dark:text-rose-400">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" /> {dt('Në rrezik? Telefononi menjëherë, mos shkruani këtu.')}
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { num: '112', title: 'Emergjenca qendrore' },
            { num: '192', title: 'Policia' },
            { num: '193', title: 'Zjarrfikësit' },
            { num: '194', title: 'Ndihma e shpejtë' },
          ].map(c => (
            <a key={c.num} href={`tel:${c.num}`} aria-label={`${dt('Telefono')} ${c.num} — ${dt(c.title)}`}
              className="au-tile-link flex items-center gap-3 rounded-xl border border-[var(--au-line)] bg-[var(--au-card-2)] px-3 py-2.5">
              <span className="text-[20px] font-semibold tabular-nums text-rose-700 dark:text-rose-400">{c.num}</span>
              <span className="text-[12px] leading-tight au-sub">{dt(c.title)}</span>
            </a>
          ))}
        </div>
      </section>

      <AuraSection id="route" title={dt('Zgjidhni rrugën e duhur')}>
        <div className="grid gap-2.5 sm:grid-cols-3">
          {[
            { to: '/raporto', icon: FileText, title: 'Kam një problem në qytet', text: 'Raportoni rrugë, ndriçim, mbeturina e të tjera.' },
            { to: '/trackid', icon: Search, title: 'Dua të ndjek një raport', text: 'Shkruani Track ID-në për statusin publik.' },
            { to: '/ndihma', icon: BookOpen, title: 'Kam një pyetje të shpejtë', text: 'Udhëzime hap pas hapi në Qendrën e Ndihmës.' },
          ].map(({ to, icon: Icon, title, text }) => (
            <Link key={to} to={to} className="au-tile au-tile-link flex items-start gap-3 p-4">
              <span className="au-ico"><Icon className="h-[18px] w-[18px]" aria-hidden="true" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">{dt(title)}</span>
                <span className="au-sub mt-0.5 block text-[13px] leading-snug">{dt(text)}</span>
              </span>
              <ArrowUpRight className="h-4 w-4 shrink-0 opacity-40" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </AuraSection>

      <section id="forma" aria-labelledby="form-title" className="scroll-mt-20 grid gap-4 lg:grid-cols-[18rem_1fr] lg:gap-6">
        <div className="space-y-4">
          <h2 id="form-title" className="text-[20px] font-semibold sm:text-[24px]">{dt('Dërgoni një mesazh')}</h2>
          <AuraNote icon={ShieldAlert}>
            {dt('Mesazhi ruhet në sistemin e platformës dhe nuk publikohet. Pa email ose telefon nuk mund t’ju përgjigjemi. Mos shkruani fjalëkalime, numra kartelash ose të dhëna shëndetësore.')}{' '}
            <Link to="/privatesia" className="font-semibold text-[var(--au-accent)] underline">{dt('Privatësia')}</Link>
          </AuraNote>
        </div>

        <div className="au-tile p-4 sm:p-6">
          {reference !== null ? (
            <div role="status" className="space-y-4 py-6 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-500/15 text-emerald-600"><CheckCircle2 className="h-6 w-6" aria-hidden="true" /></div>
              <h3 className="text-[20px] font-semibold">{dt('Mesazhi u pranua dhe u ruajt')}</h3>
              {reference && <p className="mx-auto inline-block rounded-xl bg-[var(--au-card-2)] px-4 py-2 font-mono text-[16px] font-semibold tracking-wider">{reference}</p>}
              <p className="au-sub mx-auto max-w-md text-[13px] leading-relaxed">
                {dt('Ekipi e lexon mesazhin manualisht. Nuk ka afat përgjigjeje të garantuar dhe nuk u dërgua email konfirmimi. Nëse keni lënë email ose telefon, mund t’ju kontaktojmë aty.')}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {reference && <button type="button" onClick={copyReference} className="au-btn au-btn-soft"><Copy className="h-4 w-4" aria-hidden="true" /> {dt('Kopjo referencën')}</button>}
                <button type="button" onClick={() => setReference(null)} className="au-btn au-btn-primary">{dt('Dërgo një mesazh tjetër')}</button>
              </div>
            </div>
          ) : (
            <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-4" aria-busy={sending}>
              {failure && (
                <div role="alert" className="flex items-start gap-2 rounded-xl bg-red-500/10 p-3 text-[13px] font-medium text-red-700 dark:text-red-300">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> <span>{failure}</span>
                </div>
              )}
              <p className="au-sub text-[12px]">{dt('Fushat me * janë të detyrueshme.')}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="ct-name" className="au-label">{dt('Emri dhe mbiemri')} *</label>
                  <input id="ct-name" name="name" type="text" autoComplete="name" maxLength={LIMITS.name} value={form.name} onChange={set('name')} aria-invalid={!!err('name')} aria-describedby={describedBy('name')} className="au-input" />
                  {err('name') && <p id="name-error" className="mt-1 text-[12px] font-medium text-red-600">{err('name')}</p>}
                </div>
                <div>
                  <label htmlFor="ct-email" className="au-label">{dt('Emaili (opsional)')}</label>
                  <input id="ct-email" name="email" type="email" autoComplete="email" inputMode="email" maxLength={LIMITS.email} value={form.email} onChange={set('email')} aria-invalid={!!err('email')} aria-describedby={describedBy('email')} className="au-input" />
                  {err('email') && <p id="email-error" className="mt-1 text-[12px] font-medium text-red-600">{err('email')}</p>}
                </div>
                <div>
                  <label htmlFor="ct-phone" className="au-label">{dt('Telefoni (opsional)')}</label>
                  <input id="ct-phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" maxLength={LIMITS.phone} value={form.phone} onChange={set('phone')} aria-invalid={!!err('phone')} aria-describedby={describedBy('phone')} className="au-input" />
                  {err('phone') && <p id="phone-error" className="mt-1 text-[12px] font-medium text-red-600">{err('phone')}</p>}
                </div>
                <div>
                  <label htmlFor="ct-muni" className="au-label">{dt('Komuna (opsionale)')}</label>
                  <select id="ct-muni" name="municipality" value={form.municipality} onChange={set('municipality')} className="au-input">
                    <option value="">{dt('— Pa zgjedhur —')}</option>
                    {KOSOVO_MUNICIPALITIES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="ct-topic" className="au-label">{dt('Tema')}</label>
                <select id="ct-topic" name="topic" value={form.topic} onChange={set('topic')} className="au-input">
                  {TOPICS.map(t => <option key={t} value={t}>{dt(t)}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="ct-subject" className="au-label">{dt('Subjekti')} *</label>
                <input id="ct-subject" name="subject" type="text" maxLength={LIMITS.subject} value={form.subject} onChange={set('subject')} placeholder={dt('Përmbledhje e shkurtër')} aria-invalid={!!err('subject')} aria-describedby={describedBy('subject')} className="au-input" />
                {err('subject') && <p id="subject-error" className="mt-1 text-[12px] font-medium text-red-600">{err('subject')}</p>}
              </div>
              <div>
                <label htmlFor="ct-message" className="au-label">{dt('Mesazhi')} *</label>
                <textarea id="ct-message" name="message" rows={5} maxLength={LIMITS.message} value={form.message} onChange={set('message')} aria-invalid={!!err('message')} aria-describedby={`${describedBy('message') ?? ''} ct-count`.trim()} className="au-input" />
                <div className="mt-1 flex justify-between gap-2">
                  <span>{err('message') && <span id="message-error" className="text-[12px] font-medium text-red-600">{err('message')}</span>}</span>
                  <span id="ct-count" className="au-sub text-[11px] tabular-nums">{form.message.length}/{LIMITS.message}</span>
                </div>
              </div>
              <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                <label>Website <input type="text" tabIndex={-1} autoComplete="off" value={honeypot} onChange={e => setHoneypot(e.target.value)} /></label>
              </div>
              <button type="submit" disabled={sending} className="au-btn au-btn-primary w-full !h-12">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
                <span>{sending ? dt('Po dërgohet…') : dt('Dërgo mesazhin')}</span>
              </button>
            </form>
          )}
        </div>
      </section>

      <p className="au-sub text-center text-[13px]">
        {dt('Kërkoni udhëzime?')} <Link to="/ndihma" className="font-semibold text-[var(--au-accent)]">{dt('Hapni Qendrën e ndihmës')}</Link>
      </p>
    </AuraPage>
  );
}
