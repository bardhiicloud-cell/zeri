/**
 * Cookie consent and privacy-preference state.
 *
 * Legal basis: Ligji Nr. 06/L-082 për Mbrojtjen e të Dhënave Personale në
 * Kosovë (harmonizuar me GDPR), neni 9 dhe neni 22 — çdo Cookies jo-esenciale
 * dhe çdo gjurmim i lokacionit kërkon pëlqim paraprak, të qartë dhe të lirë.
 * Pëlqimi është përpunim i veçantë nga ai i domosdoshëm, prandaj nuk mund të
 * prezumohet: mungesa e pëlqimit është e barabartë me "jo".
 *
 * Nothing in this module reads or writes a cookie itself. Firebase Auth keeps its
 * own session in IndexedDB/localStorage, which is a strictly necessary transfer of
 * data to a third party and therefore exempt from consent under Article 6(1)(f).
 */

export const CONSENT_STORAGE_KEY = 'zeri_cookie_consent_v1';

/** Bump when the category list changes, so old consents are re-asked. */
export const CONSENT_VERSION = 1;

export type ConsentCategory = 'essential' | 'analytics' | 'marketing';

export interface ConsentState {
  version: number;
  essential: true;
  analytics: boolean;
  marketing: boolean;
  /** ISO timestamp of when the citizen made the choice. */
  decidedAt: string;
}

/** Categories the visitor can actually toggle. Essential is always on. */
export const OPTIONAL_CATEGORIES: readonly ConsentCategory[] = ['analytics', 'marketing'];

export const CATEGORY_LABELS: Record<ConsentCategory, { sq: string; en: string; descriptionSq: string; descriptionEn: string }> = {
  essential: {
    sq: 'Të domosdoshme',
    en: 'Strictly necessary',
    descriptionSq: 'Kërkohen për të mbajtur sesionin, hyrjen në llogari dhe punëzimin e platformës. Nuk mund të çaktivizohen.',
    descriptionEn: 'Required to keep your session, sign-in and the platform working. These cannot be switched off.',
  },
  analytics: {
    sq: 'Analitike dhe statistikore',
    en: 'Analytics',
    descriptionSq: 'Google Analytics 4 mat vizitat dhe përdorimin e faqeve për të përmirësuar shërbimin. Nuk përmban reklama.',
    descriptionEn: 'Google Analytics 4 measures visits and page usage to improve the service. It contains no advertising.',
  },
  marketing: {
    sq: 'Marketingu dhe reklamat',
    en: 'Marketing and advertising',
    descriptionSq: 'Lejon shfaqjen e reklamave të personalizuara dhe matjen e tyre në platformën AdminAds.',
    descriptionEn: 'Enables personalised ads and measures their performance on the AdminAds platform.',
  },
};

/**
 * Read the persisted choice.
 *
 * Returns a "not decided" state — not a default-grant — when nothing valid is
 * stored, so the banner shows and every optional category stays off.
 */
export function readConsent(): ConsentState | null {
  if (typeof window === 'undefined') return null;

  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
  } catch {
    // Storage blocked (private mode, strict cookie settings). Treat as undecided.
    return null;
  }
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<ConsentState>;
    if (
      typeof parsed?.analytics === 'boolean' &&
      typeof parsed?.marketing === 'boolean' &&
      parsed.version === CONSENT_VERSION
    ) {
      return {
        version: CONSENT_VERSION,
        essential: true,
        analytics: parsed.analytics,
        marketing: parsed.marketing,
        decidedAt: typeof parsed.decidedAt === 'string' ? parsed.decidedAt : new Date().toISOString(),
      };
    }
  } catch {
    // Corrupted value: fall through and re-ask.
  }
  return null;
}

export function writeConsent(next: { analytics: boolean; marketing: boolean }): ConsentState {
  const state: ConsentState = {
    version: CONSENT_VERSION,
    essential: true,
    analytics: next.analytics,
    marketing: next.marketing,
    decidedAt: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Without storage the choice lasts for this page view only; the banner will
    // ask again rather than silently keeping the old answer.
  }
  return state;
}

/**
 * A single synchronous flag for the Google Analytics bootstrap.
 *
 * Returns false when nothing has been decided, which is what keeps gtag.js from
 * being loaded at all for a visitor who never opted in.
 */
export function hasAnalyticsConsent(): boolean {
  return readConsent()?.analytics === true;
}

export function hasMarketingConsent(): boolean {
  return readConsent()?.marketing === true;
}

/** True once the citizen has answered, in either direction. */
export function hasDecided(): boolean {
  return readConsent() !== null;
}

/** Revoke everything optional. Used by "clear my data" and the settings page. */
export function revokeConsent(): void {
  try {
    window.localStorage.removeItem(CONSENT_STORAGE_KEY);
  } catch {
    // Nothing to remove when storage is unavailable.
  }
}

/**
 * Listeners for consent changes so long-lived singletons (the gtag queue, the
 * ad rotator) can react without polling localStorage.
 */
export const CONSENT_EVENT = 'zeri:consent-changed';

export function announceConsentChange(state: ConsentState): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<ConsentState>(CONSENT_EVENT, { detail: state }));
}

export function onConsentChange(listener: (state: ConsentState | null) => void): () => void {
  if (typeof window === 'undefined') return () => { };
  const handler = (event: Event) => {
    listener((event as CustomEvent<ConsentState>).detail ?? null);
  };
  window.addEventListener(CONSENT_EVENT, handler);
  return () => window.removeEventListener(CONSENT_EVENT, handler);
}

/**
 * Google Analytics 4 with IP anonymisation and ad storage disabled.
 *
 * Both settings are required by Law 06/L-082 even when analytics *is* consented
 * to: the visitor's full IP address and cross-site advertising identifiers are
 * never collected, so the analytics data cannot be joined back to a person.
 */
export const GA_CONFIG = {
  anonymize_ip: true,
  allow_google_signals: false,
  allow_ad_personalization_signals: false,
  client_storage: 'none' as const,
  cookie_flags: 'SameSite=None; Secure',
};

/* ------------------------------------------------------------------ first-visit gates */

export const AGE_VERIFICATION_KEY = 'zeri_age_verified_v1';
export const AGE_EVENT = 'zeri:age-verified';

/** True once the visitor has passed the 16+ question (only the fact is stored, never the age). */
export function ageGatePassed(): boolean {
  try {
    return window.localStorage.getItem(AGE_VERIFICATION_KEY) === 'passed';
  } catch {
    return false;
  }
}

export function announceAgeVerified(): void {
  window.dispatchEvent(new Event(AGE_EVENT));
}

/**
 * The two legal prompts (age, then cookie consent) come before everything else.
 * Optional prompts, such as the municipality picker, must wait until both are
 * answered so a first-time visitor never faces stacked dialogs.
 */
export function legalGatesCleared(): boolean {
  return ageGatePassed() && hasDecided();
}

export function onLegalGatesChange(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => { };
  window.addEventListener(AGE_EVENT, listener);
  window.addEventListener(CONSENT_EVENT, listener);
  return () => {
    window.removeEventListener(AGE_EVENT, listener);
    window.removeEventListener(CONSENT_EVENT, listener);
  };
}
