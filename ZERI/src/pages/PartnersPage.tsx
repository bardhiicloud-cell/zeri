import React, { useEffect, useMemo, useState } from 'react';
import {
  Phone, MessageCircle, Mail, Handshake, Megaphone, Landmark, Smartphone, Zap,
  GraduationCap, HeartPulse, Users, Newspaper, Store, CheckCircle2, LayoutTemplate,
  PanelTop, Newspaper as ArticleIcon, Rows3, Sidebar, MapPin, ExternalLink, Ruler,
  ShieldCheck, Languages, Send, BadgeCheck, Upload, Rocket, Film, Image as ImageIcon,
} from 'lucide-react';
import { dt } from '@/src/lib/dt';
import { useStore } from '../lib/store';
import { formatEur, getPaymentConfig, type PaymentConfig } from '../lib/debateApi';
import { AdRequestModal, AD_PACKAGES } from '../components/AdRequestModal';
import { AD_POSITION_SPECS, AD_MAX_BYTES, formatMb } from '../lib/adSpecs';

/**
 * Public "Partners & Advertising" page.
 *
 * The phone, WhatsApp and e-mail shown here come from the same system settings
 * the administrator edits under Admin → Ads, so changing the number there
 * changes it on this page and on every empty ad slot at once.
 *
 * Partner cards are campaigns the administrator marked "Shfaqe si partner".
 * Creative sizes come from src/lib/adSpecs.ts, the same table the admin upload
 * checks against, so what an advertiser reads here is what the system enforces.
 *
 * No traffic figures are invented: only facts about the platform are stated.
 */
const PLACEMENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  top: PanelTop,
  inline: Rows3,
  article: ArticleIcon,
  sidebar: Sidebar,
  banner: LayoutTemplate,
  feed: Rows3,
};

const PARTNER_TYPES = [
  { icon: Landmark, title: 'Bankat dhe financat', desc: 'Kredi, llogari dhe pagesa për qytetarët dhe bizneset lokale.' },
  { icon: Smartphone, title: 'Telekomunikacioni', desc: 'Operatorë dhe ofrues interneti që qytetarët i përdorin çdo ditë.' },
  { icon: Zap, title: 'Ndërmarrjet publike dhe shërbimet', desc: 'Uji, energjia dhe pastrimi: njoftime për shërbimet që prekin çdo shtëpi.' },
  { icon: GraduationCap, title: 'Universitetet dhe arsimi', desc: 'Programe, kurse dhe mundësi për të rinjtë.' },
  { icon: HeartPulse, title: 'Shëndetësia dhe farmacitë', desc: 'Klinika, laboratorë dhe farmaci pranë qytetarëve.' },
  { icon: Users, title: 'OJQ dhe fondacionet', desc: 'Organizata që punojnë për komunitetin dhe kërkojnë mbështetje.' },
  { icon: Newspaper, title: 'Media dhe portalet', desc: 'Shkëmbim përmbajtjeje dhe bashkëpunim editorial.' },
  { icon: Store, title: 'Bizneset lokale', desc: 'Dyqane, restorante dhe shërbime në komunën tuaj.' },
] as const;

const FACTS = [
  { icon: MapPin, value: '38', label: 'komuna të Kosovës' },
  { icon: Languages, value: '22', label: 'gjuhë të platformës' },
  { icon: LayoutTemplate, value: String(Object.keys(AD_POSITION_SPECS).length), label: 'pozicione reklamimi' },
  { icon: ShieldCheck, value: '100%', label: 'kreativë të shqyrtuar' },
] as const;

const STEPS = [
  { icon: Send, title: 'Dërgoni kërkesën', desc: 'Zgjidhni paketën, komunën dhe na lini kontaktin.' },
  { icon: BadgeCheck, title: 'Konfirmimi', desc: 'Ekipi ju kontakton për ofertën dhe konfirmimin e pagesës.' },
  { icon: Upload, title: 'Kreativi', desc: 'Dërgoni foton, GIF-in ose videon sipas specifikimeve më poshtë.' },
  { icon: Rocket, title: 'Publikimi', desc: 'Fushata shfaqet në pozicionet dhe komunat e zgjedhura.' },
] as const;

const hostOf = (url?: string) => {
  if (!url || url === '#') return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

export default function PartnersPage() {
  const systemSettings = useStore((state) => state.systemSettings);
  const ads = useStore((state) => state.ads);
  const incrementAdClick = useStore((state) => state.incrementAdClick);
  const [isModalOpen, setIsModalOpen] = useState(false);
  // Package prices are set by the owner in the Debate admin console.
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  useEffect(() => {
    getPaymentConfig().then(setConfig).catch(() => setConfig(null));
  }, []);

  const phone = systemSettings?.adContactPhone || '+383 44 123 456';
  const email = systemSettings?.adContactEmail || 'reklama@qytetari.ks';
  const whatsapp = (systemSettings?.adWhatsApp || phone).replace(/[^0-9]/g, '');
  const tel = phone.replace(/\s+/g, '');
  const waText = encodeURIComponent(dt('Përshëndetje! Jam i interesuar për reklamim në platformën Qytetari.'));

  // Partners are live campaigns the administrator explicitly marked as
  // partners (Admin → Reklamat → "Shfaqe si partner"), one card per
  // organisation. An ordinary ad campaign is not presented as a partner.
  const partners = useMemo(() => {
    const flagged = (ads || []).filter((ad: any) => ad.status === 'active' && ad.title && ad.isPartner);
    const seen = new Set<string>();
    return flagged
      .filter((ad: any) => {
        const key = String(ad.title).trim().toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 12);
  }, [ads]);

  const contactBtn =
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';
  const sectionTitle = 'title-serif text-2xl font-black tracking-tight text-slate-900 sm:text-3xl dark:text-white';
  const eyebrow = 'text-[11px] font-black uppercase tracking-[0.16em] text-blue-700 dark:text-blue-300';

  return (
    <div className="page-shell min-h-screen bg-(--color-page) px-4 py-6 text-slate-800 sm:px-6 lg:px-8 dark:bg-(--color-brand-dark) dark:text-slate-100">
      <div className="mx-auto max-w-6xl space-y-14">
        {/* Hero */}
        <section className="luxury-hero overflow-hidden rounded-[28px] p-6 text-white sm:p-10">
          <div className="relative z-10 grid gap-8 xl:grid-cols-[1.5fr_1fr] xl:items-end">
            <div className="max-w-3xl">
              <span className="luxury-pill inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-blue-200">
                <Handshake className="h-3.5 w-3.5" aria-hidden="true" />
                {dt('Partnerët & Reklama')}
              </span>
              <h1 className="title-serif mt-4 text-3xl font-black leading-tight tracking-tight sm:text-4xl xl:text-5xl">
                {dt('Bëhuni partner i platformës qytetare')}
              </h1>
              <p className="mt-4 text-sm leading-relaxed text-slate-200 sm:text-base">
                {dt('Arrini qytetarët e Kosovës ku ata informohen, raportojnë dhe marrin pjesë. Kontaktoni ekipin për partneritet ose reklamim.')}
              </p>

              <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  className={`${contactBtn} bg-white text-slate-900 hover:bg-slate-100`}
                >
                  <Megaphone className="h-4 w-4" aria-hidden="true" />
                  {dt('Apliko online')}
                </button>
                <a href={`tel:${tel}`} className={`${contactBtn} border border-white/30 text-white hover:bg-white/10`}>
                  <Phone className="h-4 w-4" aria-hidden="true" />
                  <span dir="ltr">{phone}</span>
                </a>
                <a
                  href={`https://wa.me/${whatsapp}?text=${waText}`}
                  target="_blank"
                  rel="noreferrer"
                  className={`${contactBtn} bg-emerald-500 text-white hover:bg-emerald-600`}
                >
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  {dt('WhatsApp')}
                </a>
              </div>
            </div>

            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-2">
              {FACTS.map(({ icon: Icon, value, label }) => (
                <li key={label} className="rounded-2xl border border-white/15 bg-white/5 p-4 backdrop-blur-sm">
                  <Icon className="h-4 w-4 text-blue-200" aria-hidden="true" />
                  <p className="mt-2 text-2xl font-black tracking-tight">{value}</p>
                  <p className="text-xs text-slate-300">{dt(label)}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Current partners */}
        <section aria-labelledby="partners-heading">
          <p className={eyebrow}>{dt('Bashkëpunëtorët tanë')}</p>
          <h2 id="partners-heading" className={`${sectionTitle} mt-1`}>
            {dt('Partnerët aktualë')}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
            {dt('Organizatat që mbështesin platformën dhe u shërbejnë qytetarëve në komunat e tyre.')}
          </p>

          {partners.length > 0 ? (
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {partners.map((ad: any) => {
                const host = hostOf(ad.targetUrl);
                const isImage = (ad.mediaType === 'image' || ad.mediaType === 'gif') && ad.mediaUrl;
                const isVideo = ad.mediaType === 'video' && ad.mediaUrl;
                return (
                  <li
                    key={ad.id}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-lg dark:border-white/10 dark:bg-slate-900"
                  >
                    <div className="relative aspect-[16/9] overflow-hidden bg-slate-50 dark:bg-slate-800">
                      {isImage ? (
                        // Logos and banner creatives come in every proportion, so the
                        // image is contained, never cropped.
                        <img
                          src={ad.mediaUrl}
                          alt={ad.title}
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-contain p-4"
                        />
                      ) : isVideo ? (
                        <video src={ad.mediaUrl} muted playsInline autoPlay loop preload="metadata" aria-hidden="true" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center p-6 text-center text-xl font-black text-slate-700 dark:text-slate-200">
                          {ad.title}
                        </div>
                      )}
                      <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-800 shadow-sm rtl:left-auto rtl:right-3">
                        <BadgeCheck className="h-3 w-3 text-blue-600" aria-hidden="true" />
                        {dt('Partner zyrtar')}
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <h3 className="text-base font-black text-slate-900 dark:text-white">{ad.title}</h3>
                      <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                        <MapPin className="h-3 w-3" aria-hidden="true" />
                        {ad.target === 'Nacionale' ? dt('E gjithë Kosova') : ad.target}
                      </p>
                      <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                        {ad.partnerDescription}
                      </p>
                      {host && (
                        <a
                          href={ad.targetUrl}
                          target="_blank"
                          rel="noopener noreferrer sponsored"
                          onClick={() => incrementAdClick(ad.id)}
                          className="mt-4 inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-800 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-white/10 dark:text-slate-100 dark:hover:bg-blue-950/40"
                        >
                          {dt('Vizito')} {host}
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        </a>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-white/15">
              <Handshake className="h-8 w-8 text-slate-400" aria-hidden="true" />
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {dt('Vendi i partnerit të parë është i lirë. Kontaktoni ekipin.')}
              </p>
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-700"
              >
                <Megaphone className="h-4 w-4" aria-hidden="true" />
                {dt('Bëhu partneri i parë')}
              </button>
            </div>
          )}
        </section>

        {/* Process */}
        <section aria-labelledby="process-heading">
          <p className={eyebrow}>{dt('Si funksionon')}</p>
          <h2 id="process-heading" className={`${sectionTitle} mt-1`}>{dt('Nga kërkesa te publikimi në katër hapa')}</h2>
          <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ icon: Icon, title, desc }, index) => (
              <li key={title} className="relative rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900">
                <span className="absolute right-4 top-4 text-3xl font-black text-slate-100 rtl:left-4 rtl:right-auto dark:text-slate-800" aria-hidden="true">
                  {index + 1}
                </span>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-3 text-sm font-black text-slate-900 dark:text-white">{dt(title)}</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{dt(desc)}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Packages */}
        <section aria-labelledby="packages-heading">
          <p className={eyebrow}>{dt('Paketat')}</p>
          <h2 id="packages-heading" className={`${sectionTitle} mt-1`}>
            {dt('Paketat e reklamimit')}
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {dt('Pagesa nuk kryhet në këtë faqe. Administrata shqyrton kërkesën dhe ju kontakton për konfirmim.')}
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {AD_PACKAGES.map((pkg, index) => (
              <div
                key={pkg.id}
                className={`relative flex flex-col rounded-2xl border p-6 shadow-sm ${
                  index === 1
                    ? 'border-blue-500 bg-blue-50/60 ring-1 ring-blue-500/20 dark:border-blue-400 dark:bg-blue-950/30'
                    : 'border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900'
                }`}
              >
                {index === 1 && (
                  <span className="absolute -top-2.5 right-4 rounded-full bg-blue-600 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white rtl:left-4 rtl:right-auto">
                    {dt('Më i zgjedhuri')}
                  </span>
                )}
                <div className="text-sm font-bold text-slate-600 dark:text-slate-300">{dt(pkg.name)}</div>
                <div className="mt-1 text-3xl font-black text-slate-900 dark:text-white">
                  {config?.adPackagePrices[pkg.id] !== undefined ? formatEur(config.adPackagePrices[pkg.id]) : <span className="text-lg">{dt('Çmimi sipas ofertës')}</span>}
                </div>
                {pkg.reach && (
                  <div className="mt-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">{dt(pkg.reach)}</div>
                )}
                <p className="mt-3 flex-1 text-sm text-slate-600 dark:text-slate-300">{dt(pkg.desc)}</p>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  {dt('Zgjidh paketën')}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Placements & creative specifications */}
        <section aria-labelledby="specs-heading">
          <p className={eyebrow}>{dt('Specifikimet teknike')}</p>
          <h2 id="specs-heading" className={`${sectionTitle} mt-1`}>
            {dt('Ku shfaqet reklama juaj dhe çfarë dimensionesh duhen')}
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
            {dt('Përgatitni kreativin në madhësinë ideale: ajo është dyfishi i madhësisë në ekran, që reklama të duket e qartë edhe në ekranet retina. Mbani logon dhe tekstin në qendër, sepse në telefon skajet anësore priten.')}
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(AD_POSITION_SPECS).map(([key, spec]) => {
              const Icon = PLACEMENT_ICONS[key] || LayoutTemplate;
              const ratio = spec.ideal.w / spec.ideal.h;
              return (
                <article key={key} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                      <h3 className="text-sm font-black text-slate-900 dark:text-white">{dt(spec.label)}</h3>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{dt(spec.where)}</p>
                    </div>
                  </div>
                  {/* Scaled proportion preview of the slot */}
                  <div className="mt-4 flex h-16 items-center justify-center rounded-lg bg-slate-50 p-2 dark:bg-slate-800/60" aria-hidden="true">
                    <div
                      className="max-h-full max-w-full rounded border-2 border-dashed border-blue-300 bg-blue-100/50 dark:border-blue-700 dark:bg-blue-900/30"
                      style={ratio >= 1 ? { width: '100%', aspectRatio: `${spec.ideal.w} / ${spec.ideal.h}` } : { height: '100%', aspectRatio: `${spec.ideal.w} / ${spec.ideal.h}` }}
                    />
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800/60">
                      <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{dt('Ideale')}</dt>
                      <dd className="whitespace-nowrap font-mono text-[11px] font-bold text-slate-900 dark:text-white" dir="ltr">{spec.ideal.w} × {spec.ideal.h} px</dd>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800/60">
                      <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{dt('Minimumi')}</dt>
                      <dd className="whitespace-nowrap font-mono text-[11px] font-bold text-slate-900 dark:text-white" dir="ltr">{spec.min.w} × {spec.min.h} px</dd>
                    </div>
                  </dl>
                </article>
              );
            })}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {[
              { icon: ImageIcon, title: 'Foto', formats: 'JPG, PNG, WebP', max: AD_MAX_BYTES.image, note: '' },
              { icon: ImageIcon, title: 'GIF e animuar', formats: 'GIF', max: AD_MAX_BYTES.gif, note: '' },
              { icon: Film, title: 'Video', formats: 'MP4 (H.264), WebM', max: AD_MAX_BYTES.video, note: 'Luhet pa zë, deri në 30 sekonda' },
            ].map(({ icon: Icon, title, formats, max, note }) => (
              <div key={title} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-300" aria-hidden="true" />
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">{dt(title)}</h3>
                  <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                    <span dir="ltr">{formats}</span> · {dt('maks.')} <span dir="ltr">{formatMb(max)}</span>
                    {note && <> · {dt(note)}</>}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <Ruler className="h-3.5 w-3.5" aria-hidden="true" />
            {dt('Sistemi i kontrollon dimensionet automatikisht gjatë ngarkimit dhe refuzon skedarët më të vegjël se minimumi.')}
          </p>
        </section>

        {/* Strategic partner types */}
        <section aria-labelledby="types-heading">
          <p className={eyebrow}>{dt('Sektorët')}</p>
          <h2 id="types-heading" className={`${sectionTitle} mt-1`}>
            {dt('Partnerët që kërkojmë')}
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {dt('Bashkëpunojmë me organizata që i shërbejnë qytetarëve dhe e forcojnë platformën.')}
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {PARTNER_TYPES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-3 text-sm font-black text-slate-900 dark:text-white">{dt(title)}</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{dt(desc)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Closing call to action */}
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 sm:p-10 dark:border-white/10 dark:bg-slate-900">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <h2 className={sectionTitle}>{dt('Le të flasim për partneritetin tuaj')}</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {dt('Ekipi ynë ju ndihmon të zgjidhni pozicionin, komunën dhe formatin që i përshtatet organizatës suaj.')}
              </p>
            </div>
            <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className={`${contactBtn} bg-blue-600 text-white hover:bg-blue-700`}
              >
                <Megaphone className="h-4 w-4" aria-hidden="true" />
                {dt('Apliko online')}
              </button>
              <a href={`mailto:${email}`} className={`${contactBtn} border border-slate-200 text-slate-800 hover:bg-slate-50 dark:border-white/15 dark:text-white dark:hover:bg-white/5`}>
                <Mail className="h-4 w-4" aria-hidden="true" />
                <span dir="ltr">{email}</span>
              </a>
              <a href={`tel:${tel}`} className={`${contactBtn} border border-slate-200 text-slate-800 hover:bg-slate-50 dark:border-white/15 dark:text-white dark:hover:bg-white/5`}>
                <Phone className="h-4 w-4" aria-hidden="true" />
                <span dir="ltr">{phone}</span>
              </a>
            </div>
          </div>
        </section>
      </div>

      <AdRequestModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
