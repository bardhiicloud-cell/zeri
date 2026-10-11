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
/** Categories the visitor can actually toggle. Essential is always on. */
export const OPTIONAL_CATEGORIES = ['analytics', 'marketing'];
export const CATEGORY_LABELS = {
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
export function readConsent() {
    if (typeof window === 'undefined')
        return null;
    let raw = null;
    try {
        raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    }
    catch {
        // Storage blocked (private mode, strict cookie settings). Treat as undecided.
        return null;
    }
    if (!raw)
        return null;
    try {
        const parsed = JSON.parse(raw);
        if (typeof parsed?.analytics === 'boolean' &&
            typeof parsed?.marketing === 'boolean' &&
            parsed.version === CONSENT_VERSION) {
            return {
                version: CONSENT_VERSION,
                essential: true,
                analytics: parsed.analytics,
                marketing: parsed.marketing,
                decidedAt: typeof parsed.decidedAt === 'string' ? parsed.decidedAt : new Date().toISOString(),
            };
        }
    }
    catch {
        // Corrupted value: fall through and re-ask.
    }
    return null;
}
export function writeConsent(next) {
    const state = {
        version: CONSENT_VERSION,
        essential: true,
        analytics: next.analytics,
        marketing: next.marketing,
        decidedAt: new Date().toISOString(),
    };
    try {
        window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(state));
    }
    catch {
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
export function hasAnalyticsConsent() {
    return readConsent()?.analytics === true;
}
export function hasMarketingConsent() {
    return readConsent()?.marketing === true;
}
/** True once the citizen has answered, in either direction. */
export function hasDecided() {
    return readConsent() !== null;
}
/** Revoke everything optional. Used by "clear my data" and the settings page. */
export function revokeConsent() {
    try {
        window.localStorage.removeItem(CONSENT_STORAGE_KEY);
    }
    catch {
        // Nothing to remove when storage is unavailable.
    }
}
/**
 * Listeners for consent changes so long-lived singletons (the gtag queue, the
 * ad rotator) can react without polling localStorage.
 */
export const CONSENT_EVENT = 'zeri:consent-changed';
export function announceConsentChange(state) {
    if (typeof window === 'undefined')
        return;
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: state }));
}
export function onConsentChange(listener) {
    if (typeof window === 'undefined')
        return () => { };
    const handler = (event) => {
        listener(event.detail ?? null);
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
    client_storage: 'none',
    cookie_flags: 'SameSite=None; Secure',
};
