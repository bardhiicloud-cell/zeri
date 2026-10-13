import { useEffect, useMemo, useState } from 'react';
import { AtSign, BarChart3, Bell, Briefcase, Check, Eye, Lock, MessageCircle, Save, ShieldCheck, UserCircle2 } from 'lucide-react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { dt } from '@/src/lib/dt';
import { db } from '../../lib/firebase';
import { useStore } from '../../lib/store';
import { cn } from '../../lib/utils';
import { setDmPrivacy, type DmPrivacy } from '../../lib/directMessagesApi';
import {
  BUSINESS_CATEGORIES, DEFAULT_FORUM_PREFS, normalizeForumPrefs, normalizeWebsite, prefsOf,
  type AccountType, type Audience, type BusinessProfile, type ForumNotifyPrefs, type ForumPrefs, type ProfileVisibility,
} from '../../lib/forumPrefs';

const BIO_MAX = 160;

function Section({ icon: Icon, title, hint, children }: { icon: typeof Eye; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:p-5">
      <div className="mb-3 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
        <div>
          <h3 className="text-sm font-black text-slate-900 dark:text-white">{title}</h3>
          {hint && <p className="mt-0.5 text-xs leading-snug text-slate-500 dark:text-slate-400">{hint}</p>}
        </div>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-zinc-800">{children}</div>
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <p className="text-[13px] font-bold text-slate-800 dark:text-slate-100">{label}</p>
        {hint && <p className="mt-0.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600',
        checked ? 'bg-blue-600' : 'bg-slate-300 dark:bg-zinc-700'
      )}
    >
      <span className={cn('inline-block h-5 w-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[22px]' : 'translate-x-0.5')} />
    </button>
  );
}

function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { id: T; label: string }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl bg-slate-100 p-0.5 dark:bg-zinc-800">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            'min-h-8 rounded-[10px] px-3 text-[11px] font-bold transition-colors',
            value === o.id ? 'bg-white text-blue-700 shadow-sm dark:bg-zinc-700 dark:text-blue-200' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const VISIBILITY_OPTIONS: { id: ProfileVisibility; label: string }[] = [
  { id: 'public', label: 'Publik' },
  { id: 'followers', label: 'Vetëm ndjekësit' },
  { id: 'private', label: 'Privat' },
];
const AUDIENCE_OPTIONS: { id: Audience; label: string }[] = [
  { id: 'everyone', label: 'Të gjithë' },
  { id: 'followers', label: 'Ndjekësit' },
  { id: 'nobody', label: 'Askush' },
];
const VISIBILITY_HELP: Record<ProfileVisibility, string> = {
  public: 'Çdokush mund të hapë profilin tënd, postimet, reels dhe bio-n.',
  followers: 'Vetëm njerëzit që të ndjekin e hapin profilin e plotë. Të tjerët shohin vetëm emrin dhe foton.',
  private: 'Askush përveç teje nuk e hap profilin e plotë. Emri dhe fotoja shfaqen te postimet e tua publike.',
};
const NOTIFY_ROWS: { id: keyof ForumNotifyPrefs; label: string; hint: string }[] = [
  { id: 'likes', label: 'Pëlqime', hint: 'Dikush pëlqen postimin tënd.' },
  { id: 'comments', label: 'Komente', hint: 'Dikush komenton diskutimin tënd.' },
  { id: 'replies', label: 'Përgjigje', hint: 'Dikush i përgjigjet komentit tënd.' },
  { id: 'mentions', label: 'Përmendje (@)', hint: 'Dikush të përmend me @emri.' },
  { id: 'follows', label: 'Ndjekës të rinj', hint: 'Dikush fillon të të ndjekë.' },
  { id: 'reposts', label: 'Riposto dhe citime', hint: 'Dikush ripostoi ose citoi postimin tënd.' },
];

/**
 * The citizen's own Debati Publik settings: bio, profile privacy, who can interact,
 * and which notifications they receive. Saved on `users/{id}`; direct-message
 * privacy uses the server API because the server enforces it.
 */
export function ForumSettingsPanel() {
  const currentUser = useStore((s) => s.currentUser);
  const setCurrentUser = useStore((s) => s.setCurrentUser);
  const registered = Boolean(currentUser && currentUser.role !== 'guest');

  const saved = useMemo(() => prefsOf(currentUser), [currentUser?.forumPrefs]);
  const [prefs, setPrefs] = useState<ForumPrefs>(saved);
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [saving, setSaving] = useState(false);
  const [dmPrivacy, setDmPrivacyState] = useState<DmPrivacy>('everyone');

  useEffect(() => { setPrefs(saved); }, [saved]);

  useEffect(() => {
    if (!currentUser || !registered) return;
    getDoc(doc(db, 'forum_dm_settings', currentUser.id))
      .then((snap) => setDmPrivacyState(snap.data()?.privacy === 'following' ? 'following' : 'everyone'))
      .catch(() => setDmPrivacyState('everyone'));
  }, [currentUser?.id, registered]);

  const dirty = JSON.stringify(prefs) !== JSON.stringify(saved) || bio.trim() !== (currentUser?.bio || '');

  const patch = (next: Partial<ForumPrefs>) => setPrefs((p) => ({ ...p, ...next }));
  const patchBusiness = (next: Partial<BusinessProfile>) => setPrefs((p) => ({ ...p, business: { ...p.business, ...next } }));
  const patchNotify = (key: keyof ForumNotifyPrefs, value: boolean) =>
    setPrefs((p) => ({ ...p, notify: { ...p.notify, [key]: value } }));

  if (!currentUser || !registered) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 py-14 text-center text-slate-500 dark:border-zinc-700">
        <Lock className="h-6 w-6 text-blue-500" aria-hidden="true" />
        <p className="text-sm font-bold">{dt('Kyçu me një llogari për të ndryshuar cilësimet.')}</p>
      </div>
    );
  }

  const save = async () => {
    setSaving(true);
    try {
      const clean = normalizeForumPrefs(prefs);
      const nextBio = bio.trim().slice(0, BIO_MAX);
      await updateDoc(doc(db, 'users', currentUser.id), { forumPrefs: clean, bio: nextBio });
      setCurrentUser({ ...currentUser, forumPrefs: clean, bio: nextBio });
      toast.success(dt('Cilësimet u ruajtën.'));
    } catch (error) {
      console.error('Cilësimet e debatit nuk u ruajtën:', error);
      toast.error(dt('Cilësimet nuk u ruajtën. Provo përsëri.'));
    } finally {
      setSaving(false);
    }
  };

  const changeDm = async (next: DmPrivacy) => {
    const previous = dmPrivacy;
    setDmPrivacyState(next);
    try {
      await setDmPrivacy(next);
      toast.success(dt('Privatësia e mesazheve u ruajt.'));
    } catch {
      setDmPrivacyState(previous);
      toast.error(dt('Privatësia e mesazheve nuk u ruajt.'));
    }
  };

  return (
    <div className="space-y-3 pb-20">
      <Section icon={UserCircle2} title={dt('Profili im')} hint={dt('Çfarë shohin të tjerët kur e hapin profilin tënd.')}>
        <div className="pb-3">
          <label htmlFor="forum-bio" className="text-[13px] font-bold text-slate-800 dark:text-slate-100">{dt('Bio')}</label>
          <textarea
            id="forum-bio"
            value={bio}
            maxLength={BIO_MAX}
            rows={3}
            onChange={(e) => setBio(e.target.value)}
            placeholder={dt('Shkruaj diçka për veten, çështjet që të interesojnë…')}
            className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          />
          <p className="mt-1 text-right text-[10px] text-slate-400">{bio.length}/{BIO_MAX}</p>
        </div>
        <Row label={dt('Shfaq ndjekësit dhe ndjekjet')} hint={dt('Numrat e ndjekësve dhe të ndjekurve janë të dukshëm për të tjerët.')}>
          <Toggle checked={prefs.showFollowLists} onChange={(v) => patch({ showFollowLists: v })} label={dt('Shfaq ndjekësit dhe ndjekjet')} />
        </Row>
      </Section>

      <Section icon={Briefcase} title={dt('Lloji i llogarisë')} hint={dt('Llogaria e biznesit shton butona kontakti në profil dhe statistika të detajuara.')}>
        <div className="grid gap-2 pb-3 sm:grid-cols-2" role="radiogroup" aria-label={dt('Lloji i llogarisë')}>
          {([
            { id: 'personal' as AccountType, title: 'Llogari personale', text: 'Për qytetarë: ndaj ide, ndiq çështje dhe merr pjesë në debate.', Icon: UserCircle2 },
            { id: 'business' as AccountType, title: 'Llogari biznesi', text: 'Për biznese, organizata dhe institucione: kontakt publik dhe statistika.', Icon: Briefcase },
          ]).map(({ id, title, text, Icon }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={prefs.accountType === id}
              onClick={() => patch({ accountType: id })}
              className={cn(
                'flex items-start gap-3 rounded-2xl border p-3 text-left transition-colors',
                prefs.accountType === id ? 'border-blue-500 bg-blue-50 dark:border-blue-600 dark:bg-blue-950/30' : 'border-slate-200 hover:border-slate-300 dark:border-zinc-700'
              )}
            >
              <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', prefs.accountType === id ? 'text-blue-600' : 'text-slate-400')} aria-hidden="true" />
              <span>
                <span className="block text-[13px] font-black text-slate-900 dark:text-white">{dt(title)}</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-slate-500 dark:text-slate-400">{dt(text)}</span>
              </span>
            </button>
          ))}
        </div>

        {prefs.accountType === 'business' && (
          <div className="space-y-3 pt-3">
            <div>
              <label htmlFor="biz-category" className="text-[13px] font-bold text-slate-800 dark:text-slate-100">{dt('Kategoria')}</label>
              <select
                id="biz-category"
                value={prefs.business.category}
                onChange={(e) => patchBusiness({ category: e.target.value })}
                className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-blue-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              >
                {BUSINESS_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {([
                { key: 'email' as const, label: 'Email i kontaktit', type: 'email', placeholder: 'info@biznesi.com', max: 120 },
                { key: 'phone' as const, label: 'Telefoni', type: 'tel', placeholder: '+383 44 000 000', max: 30 },
                { key: 'website' as const, label: 'Faqja e internetit', type: 'text', placeholder: 'www.biznesi.com', max: 200 },
                { key: 'address' as const, label: 'Adresa', type: 'text', placeholder: 'Rruga, Qyteti', max: 140 },
              ]).map((f) => (
                <div key={f.key}>
                  <label htmlFor={`biz-${f.key}`} className="text-[13px] font-bold text-slate-800 dark:text-slate-100">{dt(f.label)}</label>
                  <input
                    id={`biz-${f.key}`}
                    type={f.type}
                    value={prefs.business[f.key]}
                    maxLength={f.max}
                    placeholder={f.placeholder}
                    onChange={(e) => patchBusiness({ [f.key]: e.target.value } as Partial<BusinessProfile>)}
                    onBlur={f.key === 'website' ? (e) => patchBusiness({ website: normalizeWebsite(e.target.value) }) : undefined}
                    className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-blue-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  />
                </div>
              ))}
            </div>
            <p className="flex items-start gap-1.5 rounded-xl bg-slate-50 p-3 text-[11px] leading-snug text-slate-600 dark:bg-zinc-800 dark:text-slate-300">
              <BarChart3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600" aria-hidden="true" />
              {dt('Email-i, telefoni dhe faqja shfaqen publikisht te profili juaj dhe klikimet mbi to numërohen në statistikat e biznesit. Mund ta ktheni llogarinë në personale kurdo.')}
            </p>
          </div>
        )}
      </Section>

      <Section icon={Eye} title={dt('Privatësia e profilit')} hint={dt('Kush mund ta hapë profilin tënd të plotë.')}>
        <div className="pb-1">
          <Segmented value={prefs.profileVisibility} onChange={(v) => patch({ profileVisibility: v })} options={VISIBILITY_OPTIONS.map(o => ({ ...o, label: dt(o.label) }))} label={dt('Privatësia e profilit')} />
          <p className="mt-2 text-[11px] leading-snug text-slate-500 dark:text-slate-400">{dt(VISIBILITY_HELP[prefs.profileVisibility])}</p>
        </div>
        <Row label={dt('Kush mund t’i shohë Reels-et e mia')} hint={dt('Vlen për profilin dhe për rrjedhën e Reels.')}>
          <Segmented value={prefs.reelsVisibility} onChange={(v) => patch({ reelsVisibility: v })} options={VISIBILITY_OPTIONS.map(o => ({ ...o, label: dt(o.id === 'private' ? 'Vetëm unë' : o.label) }))} label={dt('Kush mund t’i shohë Reels-et e mia')} />
        </Row>
      </Section>

      <Section icon={MessageCircle} title={dt('Kush mund të ndërveprojë me mua')}>
        <Row label={dt('Kush mund të komentojë postimet e mia')}>
          <Segmented value={prefs.whoCanComment} onChange={(v) => patch({ whoCanComment: v })} options={AUDIENCE_OPTIONS.map(o => ({ ...o, label: dt(o.label) }))} label={dt('Kush mund të komentojë')} />
        </Row>
        <Row label={dt('Kush mund të më përmendë (@)')}>
          <Segmented value={prefs.whoCanMention} onChange={(v) => patch({ whoCanMention: v })} options={AUDIENCE_OPTIONS.map(o => ({ ...o, label: dt(o.label) }))} label={dt('Kush mund të më përmendë')} />
        </Row>
        <Row label={dt('Lejo riposto dhe citime')} hint={dt('Të tjerët mund t’i ripostojnë postimet e tua.')}>
          <Toggle checked={prefs.allowReposts} onChange={(v) => patch({ allowReposts: v })} label={dt('Lejo riposto dhe citime')} />
        </Row>
        <Row label={dt('Kush mund të më dërgojë mesazhe')} hint={dt('Zbatohet menjëherë nga serveri. Të tjerët shkojnë te kërkesat.')}>
          <Segmented<DmPrivacy>
            value={dmPrivacy}
            onChange={changeDm}
            options={[{ id: 'everyone', label: dt('Të gjithë') }, { id: 'following', label: dt('Ata që ndjek') }]}
            label={dt('Kush mund të më dërgojë mesazhe')}
          />
        </Row>
      </Section>

      <Section icon={Bell} title={dt('Njoftimet')} hint={dt('Zgjidh për çfarë dëshiron të njoftohesh te zilja.')}>
        {NOTIFY_ROWS.map((row) => (
          <Row key={row.id} label={dt(row.label)} hint={dt(row.hint)}>
            <Toggle checked={prefs.notify[row.id]} onChange={(v) => patchNotify(row.id, v)} label={dt(row.label)} />
          </Row>
        ))}
      </Section>

      <Section icon={ShieldCheck} title={dt('Siguria')} hint={dt('Bllokimi i përdoruesve bëhet nga profili i tyre ose nga mesazhet.')}>
        <Row label={dt('Rivendos të gjitha cilësimet')} hint={dt('Kthen privatësinë dhe njoftimet në vlerat fillestare.')}>
          <button
            type="button"
            onClick={() => setPrefs(DEFAULT_FORUM_PREFS)}
            className="min-h-9 rounded-xl border border-slate-300 px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50 dark:border-zinc-700 dark:text-slate-200 dark:hover:bg-zinc-800"
          >
            {dt('Rivendos')}
          </button>
        </Row>
      </Section>

      <div
        className={cn(
          'sticky bottom-3 z-10 flex items-center justify-between gap-3 rounded-2xl border bg-white/95 p-3 shadow-lg backdrop-blur transition-all dark:bg-zinc-900/95',
          dirty ? 'border-blue-300 dark:border-blue-800' : 'border-slate-200 opacity-80 dark:border-zinc-800'
        )}
      >
        <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
          {dirty ? <AtSign className="h-4 w-4 text-blue-600" aria-hidden="true" /> : <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />}
          {dirty ? dt('Ke ndryshime të paruajtura.') : dt('Të gjitha ndryshimet janë ruajtur.')}
        </p>
        <div className="flex gap-2">
          {dirty && (
            <button
              type="button"
              onClick={() => { setPrefs(saved); setBio(currentUser.bio || ''); }}
              className="min-h-9 rounded-xl px-3 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-zinc-800"
            >
              {dt('Anulo')}
            </button>
          )}
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-blue-700 px-4 text-xs font-black text-white transition hover:bg-blue-800 disabled:opacity-50"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            {saving ? dt('Duke ruajtur…') : dt('Ruaj')}
          </button>
        </div>
      </div>
    </div>
  );
}
