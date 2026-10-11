import { dt } from '@/src/lib/dt';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, Suspense } from 'react';
import ReactGA from 'react-ga4';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { usePageMeta } from './lib/usePageMeta';
import { Toaster } from 'react-hot-toast';
import FloatingSupportBot from './components/FloatingSupportBot';
import { AppLayout } from './components/layout/AppLayout.tsx';
import { AppFooter } from './components/AppFooter';
import CookieConsentBanner, { CookiePreferencesButton } from './components/CookieConsentBanner.tsx';
const Dashboard = React.lazy(() => import('./pages/Dashboard.tsx'));
const DetailedRegistryPage = React.lazy(() => import('./pages/DetailedRegistryPage.tsx'));
const TrackIdPage = React.lazy(() => import('./pages/TrackIdPage'));
const CitizenHelpCenterPage = React.lazy(() => import('./pages/CitizenHelpCenterPage.tsx'));
const ReportIssue = React.lazy(() => import('./pages/ReportIssue'));
const MapPage = React.lazy(() => import('./pages/MapPage.tsx'));
const ForumPage = React.lazy(() => import('./pages/ForumPage.tsx'));
const ContactNumbersPage = React.lazy(() => import('./pages/ContactNumbersPage'));
const DonationsPage = React.lazy(() => import('./pages/DonationsPage.tsx'));
const PollsPage = React.lazy(() => import('./pages/PollsPage.tsx'));
const StatisticsPage = React.lazy(() => import('./pages/StatisticsPage.tsx'));
const HealthRegistryPage = React.lazy(() => import('./pages/HealthRegistryPage.tsx'));
const KomunatPage = React.lazy(() => import('./pages/KomunatPage'));
const SherbimetPage = React.lazy(() => import('./pages/SherbimetPage'));
const IdeaPage = React.lazy(() => import('./pages/IdeaPage'));
const ProjektetPage = React.lazy(() => import('./pages/ProjektetPage'));
const MunicipalityPanel = React.lazy(() => import('./pages/MunicipalityPanel.tsx'));
const LajmePage = React.lazy(() => import('./pages/LajmePage.tsx'));
const KontaktPage = React.lazy(() => import('./pages/KontaktPage'));
const RrethProjektitPage = React.lazy(() => import('./pages/RrethProjektitPage'));
const TermsOfServicePage = React.lazy(() => import('./pages/TermsOfServicePage'));
const PrivacyPolicyPage = React.lazy(() => import('./pages/PrivacyPolicyPage'));
const BudgetPage = React.lazy(() => import('./pages/BudgetPage'));
const NotFoundPage = React.lazy(() => import('./pages/NotFoundPage'));
const AdminPanel = React.lazy(() => import('./pages/AdminPanel.tsx'));
const ModerationCenterPage = React.lazy(() => import('./pages/ModerationCenterPage.tsx'));
const MunicipalityPanelPage = React.lazy(() => import('./pages/MunicipalityPanelPage.tsx'));
const AgentPanelPage = React.lazy(() => import('./pages/AgentPanelPage.tsx'));
const MonitoringPage = React.lazy(() => import('./pages/MonitoringPage.tsx'));
import LoginPage from './pages/LoginPage.tsx';
import RegisterPage from './pages/RegisterPage.tsx';
import { useStore, DEMO_REPORTS } from './lib/store';
import { PUBLIC_LIMITS, STAFF_LIMITS } from './lib/loadLimits';
import { canAccessAdmin } from './lib/adminPermissions';
import { LanguageProvider } from './lib/LanguageContext';
import { LanguageUrlSync } from './lib/LanguageUrlSync';
import { SeoHead } from './lib/SeoHead';
import { GuestGuard } from './components/GuestGuard';
import { ErrorBoundary } from './components/ErrorBoundary';
import ScrollToTop from './components/ScrollToTop';
import { GlobalAlert } from './components/GlobalAlert';
import { SeriousAnnouncementPopup } from './components/SeriousAnnouncementPopup';

import { auth, db } from './lib/firebase';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { doc, getDoc, collection, onSnapshot, query, orderBy, setDoc, getDocs, limit, where } from 'firebase/firestore';
import { createGuestUser, getOrCreateGuestUser } from './lib/session';
import { GA_CONFIG, hasAnalyticsConsent, onConsentChange } from './lib/consent';

/**
 * Module-level memo for the anonymous-auth warning.
 *
 * It has to outlive the component: StrictMode remounts the effect, so a ref
 * would be reset and the warning would print twice anyway. A module flag is the
 * only scope that survives the remount and still resets on a real page reload.
 */
let warnedAnonymousDisabled = false;

/**
 * Single-flight promise for the guest session upgrade.
 *
 * StrictMode invokes the mount effect twice, so without this the second call
 * starts a *second* `accounts:signUp` request before the first has settled. The
 * in-flight promise is shared, so the network sees one attempt per page load and
 * both callers resolve from the same result. It is module-scoped rather than a
 * ref for the same reason as the flag above: refs do not survive a remount.
 */
let guestSessionPromise: Promise<void> | null = null;

/**
 * Google Analytics 4 bootstrap, gated on consent.
 *
 * The measurement ID is a public build constant (it is not a secret), but the
 * script itself must never load without a positive answer under Law 06/L-082.
 * `hasAnalyticsConsent()` returns false while the citizen is undecided, so a
 * first-time visitor never causes a single gtag request.
 */
function useAnalyticsConsent(): boolean {
  const [consented, setConsented] = useState<boolean>(() => hasAnalyticsConsent());

  useEffect(() => {
    // The visitor may answer the banner after the app has already mounted.
    return onConsentChange(() => setConsented(hasAnalyticsConsent()));
  }, []);

  return consented;
}

function AnalyticsTracker({ enabled }: { enabled: boolean }) {
  const location = useLocation();

  useEffect(() => {
    if (!enabled) return;
    if (!import.meta.env.VITE_GA_MEASUREMENT_ID) return;
    ReactGA.send({ hitType: 'pageview', page: location.pathname + location.search });
  }, [enabled, location]);

  return null;
}

/**
 * Route-aware document title.
 *
 * Declaring the title per page means updating 27 files every time a label
 * changes, and forgetting one leaves a stale name in the browser tab and in the
 * shared link. The route table here is the single list, and a page can still
 * override it by calling usePageMeta directly.
 */
const ROUTE_TITLES: Record<string, string> = {
  '/': 'Ballina',
  '/forum': 'Debati Publik',
  '/detailed-registry': 'Regjistri i Raporteve',
  '/regjistri': 'Regjistri i Raporteve',
  '/registry': 'Regjistri i Raporteve',
  '/trackid': 'Gjej Raportin Tim',
  '/ndihma': 'Qendra e Ndihmës',
  '/raporto': 'Raporto një Problem',
  '/harta': 'Harta e Raporteve',
  '/statistikat': 'Statistikat',
  '/shendetesia': 'Regjistri Shëndetësor',
  '/semundjet': 'Regjistri Shëndetësor',
  '/sondazhet': 'Sondazhet Publike',
  '/komunat': 'Komunat',
  '/sherbimet': 'Shërbimet',
  '/Idea': 'Idetë Qytetare',
  '/projektet': 'Projektet Qytetare',
  '/lajme': 'Lajmet',
  '/lajmet': 'Lajmet',
  '/kontakt': 'Kontakt',
  '/kontakte': 'Kontakt',
  '/kontakt-numrat': 'Numrat & Institucionet',
  '/rreth-projektit': 'Rreth Projektit',
  '/rreth-nesh': 'Rreth Projektit',
  '/kushtet-e-perdorimit': 'Kushtet e Përdorimit',
  '/terms': 'Kushtet e Përdorimit',
  '/privatesia': 'Politika e Privatësisë',
  '/donacion': 'Ndihma & Donacione',
  '/login': 'Hyrja',
  '/register': 'Regjistrohu',
};

export function RouteTitle() {
  const { pathname } = useLocation();
  const title = ROUTE_TITLES[pathname];
  usePageMeta(title ?? 'Faqja nuk u gjet');
  return null;
}

export default function App() {
  const analyticsConsented = useAnalyticsConsent();

  /**
   * Initialise GA4 only after a positive consent decision.
   *
   * `anonymize_ip` plus the disabled Google Signals and ad-personalisation
   * signals mean the analytics property never holds data that could be joined
   * back to a citizen, which is the point at which the processing stops being
   * personal data under Article 4(1) of Law 06/L-082.
   */
  useEffect(() => {
    const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;
    if (!analyticsConsented || !measurementId) return;

    if (!ReactGA.isInitialized) {
      ReactGA.initialize(measurementId, {
        testMode: import.meta.env.DEV === true,
        gaOptions: {
          anonymize_ip: GA_CONFIG.anonymize_ip,
          allow_google_signals: GA_CONFIG.allow_google_signals,
          allow_ad_personalization_signals: GA_CONFIG.allow_ad_personalization_signals,
        },
      });
    }
  }, [analyticsConsented]);

  // Withdrawing consent must stop collection, not just prevent it from starting.
  useEffect(() => {
    if (!analyticsConsented && ReactGA.isInitialized) {
      ReactGA.gtag('consent', 'update', {
        analytics_storage: 'denied',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
      });
    }
  }, [analyticsConsented]);

  const [authInitialized, setAuthInitialized] = useState(false);
  const initialize = useStore(state => state.initialize);
  const checkSLAs = useStore(state => state.checkSLAs);
  const setCurrentUser = useStore(state => state.setCurrentUser);
  const setReports = useStore(state => state.setReports);
  const setReportsStatus = useStore(state => state.setReportsStatus);
  const setDonationCauses = useStore(state => state.setDonationCauses);
  const setPolls = useStore(state => state.setPolls);
  const setAds = useStore(state => state.setAds);
  const setNotifications = useStore(state => state.setNotifications);
  const setAuditLogs = useStore(state => state.setAuditLogs);

  useEffect(() => {
    // Failsafe timer: Ensure app renders fast within 1.5s regardless of network delays
    const timer = setTimeout(() => {
      setAuthInitialized(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    initialize();
    checkSLAs();

    // Capture initial mock lists from store state
    const initialDonationCauses = useStore.getState().donationCauses;
    const initialPolls = useStore.getState().polls;
    const initialAds = useStore.getState().ads;

    const seedDatabaseIfEmpty = async (firebaseUser: any) => {
      if (!firebaseUser || !firebaseUser.email || firebaseUser.email !== 'bardhiicloud@gmail.com') return;

      // 2. Donation Causes
      try {
        const donationSnap = await getDocs(collection(db, "donationCauses"));
        if (donationSnap.empty && initialDonationCauses.length > 0) {
          console.log("Seeding donationCauses...");
          initialDonationCauses.forEach(async (cause) => {
            try {
              await setDoc(doc(db, "donationCauses", cause.id), cause);
            } catch (e) {
              console.error("Error seeding donation cause", cause.id, e);
            }
          });
        }
      } catch (e) {
        console.error("Error checking/seeding donations", e);
      }

      // 4. Ads
      try {
        const adsSnap = await getDocs(collection(db, "ads"));
        if (adsSnap.empty && initialAds.length > 0) {
          console.log("Seeding ads...");
          initialAds.forEach(async (ad) => {
            try {
              await setDoc(doc(db, "ads", ad.id), ad);
            } catch (e) {
              console.error("Error seeding ad", ad.id, e);
            }
          });
        }
      } catch (e) {
        console.error("Error checking/seeding ads", e);
      }
    };

    // Every Firestore write (report creation, votes, comments) requires an
    // authenticated uid, so visitors are upgraded to an anonymous session.
    //
    // When the Anonymous provider is disabled in the Firebase project this fails
    // with a 400 from identitytoolkit, and the citizen simply keeps the local
    // guest session. Two things had to change here:
    //
    //   - The attempt is single-flight. React 19 StrictMode mounts effects twice
    //     in development, so this used to fire two `accounts:signUp` requests and
    //     log two console errors for one page load — which is exactly the kind of
    //     noise that hides a real failure.
    //   - The disabled-provider outcome is remembered, so it is reported once per
    //     session instead of on every mount.
    //
    // The browser still prints one "Failed to load resource: 400" line for the
    // rejected request itself. That line is emitted by the network stack and
    // cannot be suppressed from application code; it is the signal that the
    // provider is off, not a bug in the page.
    const startGuestSession = async () => {
      if (guestSessionPromise) return guestSessionPromise;

      guestSessionPromise = (async () => {
        try {
          if (!auth.currentUser) {
            await signInAnonymously(auth);
          }
        } catch (error: any) {
          const code: string = error?.code || '';
          // A signed-in user must never be downgraded to guest: this catch can
          // fire after onAuthStateChanged has already restored a real account
          // (e.g. a slow anonymous sign-up racing the session restore).
          if (!useStore.getState().currentUser) {
            setCurrentUser(getOrCreateGuestUser());
          } else if (useStore.getState().currentUser.role !== 'guest') {
            // Real account already present — leave it alone.
            return;
          } else {
            setCurrentUser(getOrCreateGuestUser());
          }

          const providerDisabled =
            code === 'auth/operation-not-allowed' || code === 'auth/admin-restricted-operation';

          if (providerDisabled) {
            if (!warnedAnonymousDisabled) {
              warnedAnonymousDisabled = true;
              console.warn(
                'Anonymous Auth është i çaktivizuar në këtë projekt Firebase. Sistemi vazhdon me ' +
                  'sesion lokal mysafir për raportime dhe ndjekje.'
              );
            }
          } else {
            console.warn('Nuk u krijua sesion mysafir në Firebase, u përdor sesioni lokal:', error?.message || error);
          }
        }
      })();

      return guestSessionPromise;
    };

    void startGuestSession();

    let publicNotifications: any[] = [];
    let personalNotifications: any[] = [];
    let unsubscribePersonalNotifications: (() => void) | undefined;
    let unsubscribeAuditLogs: (() => void) | undefined;
    const syncNotifications = () => {
      const currentNotifs = useStore.getState().notifications;
      const readIds = new Set(currentNotifs.filter(notification => notification.isRead).map(notification => notification.id));
      const merged = new Map([...publicNotifications, ...personalNotifications].map(notification => [
        notification.id,
        { ...notification, isRead: readIds.has(notification.id) },
      ]));
      setNotifications(
        Array.from(merged.values()).sort(
          (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
        )
      );
    };

    // Auth Listener
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      unsubscribePersonalNotifications?.();
      unsubscribePersonalNotifications = undefined;
      personalNotifications = [];
      syncNotifications();

      if (firebaseUser) {
        const qPersonalNotifications = query(
          collection(db, 'notifications'),
          where('userId', '==', firebaseUser.uid)
        );
        unsubscribePersonalNotifications = onSnapshot(qPersonalNotifications, snapshot => {
          personalNotifications = snapshot.docs.map(notificationDoc => {
            const data = notificationDoc.data();
            const createdAt = data.createdAt?.toDate
              ? data.createdAt.toDate().toISOString()
              : typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString();
            return { ...data, id: notificationDoc.id, createdAt };
          });
          syncNotifications();
        }, error => {
          console.error('Njoftimet personale nuk u ngarkuan:', error);
        });
      }

       try {
        if (firebaseUser) {
          unsubscribeAuditLogs?.();
          unsubscribeAuditLogs = undefined;
          try {
            const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
            let userData: any;
            if (userDoc.exists()) {
              userData = userDoc.data();
              setCurrentUser(userData);
            } else {
              // Create profile for new users (including anonymous/guest)
              userData = {
                id: firebaseUser.uid,
                name: firebaseUser.displayName || 'Përdorues i Panjohur',
                email: firebaseUser.email || '',
                role: firebaseUser.isAnonymous ? 'guest' : 'citizen',
                points: 0,
                badges: [],
                isVerified: firebaseUser.emailVerified || false,
                createdAt: new Date().toISOString()
              };
              await setDoc(doc(db, "users", firebaseUser.uid), userData);
              setCurrentUser(userData);
            }
            if (userData?.role === 'admin') {
              await seedDatabaseIfEmpty(firebaseUser);
            }
            if (canAccessAdmin(userData)) {
              /**
               * Bounded audit feed.
               *
               * Staff-only, so it costs nothing for citizens — but a staff
               * member who leaves the admin panel open holds a listener that
               * re-reads on every write the platform makes. The limit is the
               * page a supervisor reviews; anything older is fetched by filter
               * in the monitoring view rather than streamed to every session.
               */
              const qAuditLogs = query(
                collection(db, 'auditLogs'),
                orderBy('createdAt', 'desc'),
                limit(STAFF_LIMITS.auditLogs)
              );
              unsubscribeAuditLogs = onSnapshot(qAuditLogs, snapshot => {
                const logs = snapshot.docs.map(auditDoc => {
                  const data = auditDoc.data();
                  const createdAt = data.createdAt?.toDate
                    ? data.createdAt.toDate().toISOString()
                    : typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString();
                  return { ...data, id: auditDoc.id, createdAt };
                });
                setAuditLogs(logs as any);
              }, error => {
                console.warn('Regjistri i auditimit nuk u ngarkua:', error);
              });
            }
          } catch (e) {
            console.error("Gabim gjatë leximit të përdoruesit", e);
          }
        } else if (!auth.currentUser) {
          // No signed-in session at all (neither real nor anonymous) —
          // only now is a guest session appropriate.
          setCurrentUser(getOrCreateGuestUser());
        } else {
          // There IS a currentUser in Firebase but onAuthStateChanged delivered
          // null: this happens transiently during a token refresh. Never wipe
          // the profile to guest here — the next callback restores it.
        }
      } finally {
        setAuthInitialized(true);
      }
    });

    // Reports Listener
    let prevReports: any[] = [];
    setReportsStatus('loading');
    const q = query(collection(db, "reports"), orderBy("createdAt", "desc"), limit(100)); // P2: Limit queries for scale
    const unsubscribeReports = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        // Only a development build falls back to demo data; production renders
        // the real (empty) state rather than fake reports that look live.
        setReports(import.meta.env.DEV ? DEMO_REPORTS : []);
        setReportsStatus('ready');
        return;
      }

      const liveReports = snapshot.docs.map(doc => {
        const data = doc.data();
        let createdAt = data.createdAt;
        if (createdAt && typeof createdAt.toDate === 'function') {
          createdAt = createdAt.toDate().toISOString();
        } else if (createdAt && typeof createdAt === 'object' && createdAt.seconds) {
          createdAt = new Date(createdAt.seconds * 1000).toISOString();
        }

        let resolvedAt = data.resolvedAt;
        if (resolvedAt && typeof resolvedAt.toDate === 'function') {
          resolvedAt = resolvedAt.toDate().toISOString();
        } else if (resolvedAt && typeof resolvedAt === 'object' && resolvedAt.seconds) {
          resolvedAt = new Date(resolvedAt.seconds * 1000).toISOString();
        }

        const timeline = Array.isArray(data.timeline)
          ? data.timeline.map((event: any) => {
              let eventDate = event.date;
              if (eventDate && typeof eventDate.toDate === 'function') {
                eventDate = eventDate.toDate().toISOString();
              } else if (eventDate && typeof eventDate === 'object' && eventDate.seconds) {
                eventDate = new Date(eventDate.seconds * 1000).toISOString();
              }
              return { ...event, date: eventDate || new Date().toISOString() };
            })
          : [];

        return {
          ...data,
          id: doc.id,
          createdAt: createdAt || new Date().toISOString(),
          resolvedAt,
          timeline
        };
      }) as any;

      // Browser push notification when an administrator changes a report status
      if (prevReports.length > 0 && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'modified') {
            const data = change.doc.data();
            let createdAt = data.createdAt;
            if (createdAt && typeof createdAt.toDate === 'function') {
              createdAt = createdAt.toDate().toISOString();
            } else if (createdAt && typeof createdAt === 'object' && createdAt.seconds) {
              createdAt = new Date(createdAt.seconds * 1000).toISOString();
            }
            const newDoc = { ...data, id: change.doc.id, createdAt: createdAt || new Date().toISOString() } as any;
            const oldDoc = prevReports.find(r => r.id === newDoc.id);
            if (oldDoc && oldDoc.status !== newDoc.status) {
              let statusText = newDoc.status;
              if (newDoc.status === 'Approved') statusText = 'I Aprovuar';
              else if (newDoc.status === 'Resolved') statusText = 'I Zgjidhur';
              else if (newDoc.status === 'Rejected') statusText = 'I Refuzuar';
              else if (newDoc.status === 'Pending Review') statusText = 'Në Shqyrtim';

              new Notification("Përditësim i Statusit të Raportit", {
                body: `Raporti "${newDoc.title}" ka ndryshuar statusin në "${statusText}".`,
                icon: '/favicon.ico'
              });
            }
          }
        });
      }

      prevReports = liveReports;
      setReports(liveReports);
      setReportsStatus('ready');

      const useStoreAPI = useStore.getState();
      if (snapshot.docs.length > 0) {
        useStoreAPI.setLastVisibleReport(snapshot.docs[snapshot.docs.length - 1]);
        if (snapshot.docs.length < 100) {
          useStoreAPI.setHasMoreReports(false);
        } else {
          useStoreAPI.setHasMoreReports(true);
        }
      }
    }, (error) => {
      console.error("Gabim me rikthimin e raporteve", error);
      setReports(import.meta.env.DEV ? DEMO_REPORTS : []);
      setReportsStatus('ready');
    });

    // Donation Causes Listener.
    //
    // Bounded: an appeal page renders a handful of active causes, so reading the
    // entire historical collection on every visitor's page load buys nothing and
    // costs a read per document per session.
    const qDonations = query(
      collection(db, "donationCauses"),
      orderBy("createdAt", "desc"),
      limit(PUBLIC_LIMITS.donationCauses)
    );
    const unsubscribeDonations = onSnapshot(qDonations, (snapshot) => {
      if (!snapshot.empty) {
        const liveCauses = snapshot.docs.map(doc => {
          const data = doc.data();
          let createdAt = data.createdAt;
          if (createdAt && typeof createdAt.toDate === 'function') {
            createdAt = createdAt.toDate().toISOString();
          } else if (createdAt && typeof createdAt === 'object' && createdAt.seconds) {
            createdAt = new Date(createdAt.seconds * 1000).toISOString();
          }
          return {
            ...data,
            id: doc.id,
            createdAt: createdAt || new Date().toISOString()
          };
        }) as any;
        setDonationCauses(liveCauses);
      }
    }, (error) => {
      console.error("Gabim me rikthimin e donacioneve", error);
    });

    // Ads Listener.
    //
    // The single most expensive query in the application: every visitor used to
    // read every ad ever created, so the cost grew with the archive rather than
    // with traffic. Bounded to what a page can display.
    const qAds = query(collection(db, "ads"), limit(PUBLIC_LIMITS.ads));
    const unsubscribeAds = onSnapshot(qAds, (snapshot) => {
      if (!snapshot.empty) {
        const liveAds = snapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id
        })) as any;
        setAds(liveAds);
      }
    }, (error) => {
      console.error("Gabim me rikthimin e reklamave", error);
    });

    // Public broadcasts are queried separately from recipient-only messages so
    // Firestore rules can authorize each result set without exposing private notices.
    const qPublicNotifications = query(
      collection(db, 'notifications'),
      where('audience', '==', 'all')
    );
    const unsubscribeSettings = onSnapshot(doc(db, 'settings', 'general'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        useStore.getState().setSystemSettings({
          showReels: data.showReels !== false,
          adContactPhone: data.adContactPhone || '+383 44 123 456',
          adContactEmail: data.adContactEmail || 'reklama@qytetari.ks',
          adContactCompanyName: data.adContactCompanyName || 'Platforma Qytetare Ad-Tech',
          adSlogan: data.adSlogan || 'Zgjidhni hapësirën e përshtatshme dhe promovoni shërbimet tuaja në platformë.',
          adWhatsApp: data.adWhatsApp || '+38344123456',
        });
      }
    });

    /**
     * AdSense credentials, for staff only.
     *
     * These live in a separate document because the public settings document is
     * world-readable and a publisher id plus ad slot is enough to serve or spoof
     * the platform's ads. Subscribing only for a superadmin avoids issuing a
     * read that every citizen would be denied, which would otherwise show up as
     * a permission error in the console on every page load.
     */
    const unsubscribePrivateSettings = canAccessAdmin(useStore.getState().currentUser)
      ? onSnapshot(doc(db, 'settings', 'ads-private'), (docSnap) => {
          if (!docSnap.exists()) return;
          const data = docSnap.data();
          useStore.getState().setSystemSettings({
            ...useStore.getState().systemSettings,
            adSenseEnabled: data.adSenseEnabled ?? false,
            adSenseClientId: data.adSenseClientId || '',
            adSenseSlot: data.adSenseSlot || '',
            adSenseCode: data.adSenseCode || '',
          });
        }, () => {
          // A non-superadmin staffer is denied this read by design; the panel
          // simply shows the fields empty for them.
        })
      : () => {};

    const unsubscribePublicNotifications = onSnapshot(qPublicNotifications, snapshot => {
      publicNotifications = snapshot.docs.map(notificationDoc => {
        const data = notificationDoc.data();
        const createdAt = data.createdAt?.toDate
          ? data.createdAt.toDate().toISOString()
          : typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString();
        return { ...data, id: notificationDoc.id, createdAt };
      });
      syncNotifications();
    }, (error) => {
      console.error('Njoftimet publike nuk u ngarkuan:', error);
    });

    /**
     * Users Listener — STAFF ONLY.
     *
     * This used to be `onSnapshot(query(collection(db, "users")))`, which
     * subscribed every anonymous visitor to the entire users collection and
     * downloaded every profile in the country on first paint. At national scale
     * that is the single largest line item in the Firestore bill, and it also
     * leaked emails and phone numbers to the browser before the rules file was
     * tightened. The directory is only ever needed by staff inside the admin
     * panel, so it is loaded on demand there and nowhere else.
     */
    // Polls Listener.
    //
    // Bounded and ordered: the survey page shows current polls, and an
    // unordered read of an ever-growing collection would both cost more each
    // month and return an arbitrary subset once it exceeded the limit.
    const qPolls = query(
      collection(db, "polls"),
      orderBy("createdAt", "desc"),
      limit(PUBLIC_LIMITS.polls)
    );
    const unsubscribePolls = onSnapshot(qPolls, (snapshot) => {
      if (snapshot.empty) {
        // Preserve the default active seed so the public survey page stays populated
        // until admins create live poll records in Firestore.
        return;
      }

      const livePolls = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      setPolls(livePolls);
    }, (error) => console.error("Gabim me rikthimin e polls", error));

    // Categories Listener.
    //
    // Near-static and small, but not provably so — a seeding bug once wrote the
    // same category repeatedly, and an unbounded listener turns that into a
    // per-visitor cost. The cap is generous enough to be invisible in normal
    // operation.
    const qCategories = query(collection(db, "categories"), limit(PUBLIC_LIMITS.categories));
    const unsubscribeCategories = onSnapshot(qCategories, (snapshot) => {
      const liveCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      useStore.setState({ categories: liveCategories });
    }, (error) => console.error("Gabim me rikthimin e categories", error));

    // Re-check SLAs every 5 minutes
    const interval = setInterval(() => {
      checkSLAs();
    }, 5 * 60 * 1000);

    return () => {
      clearInterval(interval);
      unsubscribeAuth();
      unsubscribeReports();
      unsubscribeDonations();
      unsubscribeAds();
      unsubscribeSettings();
      unsubscribePrivateSettings();
      unsubscribePublicNotifications();
      unsubscribePersonalNotifications?.();
      unsubscribeAuditLogs?.();
      unsubscribePolls();
      unsubscribeCategories();
    };
  }, [initialize, checkSLAs, setCurrentUser, setReports, setReportsStatus, setDonationCauses, setPolls, setAds, setNotifications]);

  if (!authInitialized) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="relative flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-rose-500/20 border-t-rose-600 rounded-full animate-spin mb-4"></div>
          <span className="text-xl font-bold tracking-widest text-white uppercase font-sans">KOSOVA BASHKË<span className="text-rose-600">.</span></span>
          <span className="text-xs font-medium text-slate-400 mt-2 tracking-wide uppercase">Duke ngarkuar platformën...</span>
        </div>
      </div>
    );
  }

  return (
    <LanguageProvider>
      <GlobalAlert />
      <SeriousAnnouncementPopup />
      <ErrorBoundary>
        <Toaster position="top-right" />
        <BrowserRouter>
            <LanguageUrlSync />
            <AnalyticsTracker enabled={analyticsConsented} />
            <RouteTitle />
          <ScrollToTop />
          <Suspense fallback={<div className="h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-900"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div></div>}>
              <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/forum" element={<GuestGuard><ForumPage /></GuestGuard>} />
              <Route path="/detailed-registry" element={<DetailedRegistryPage />} />
              <Route path="/trackid" element={<TrackIdPage />} />
              <Route path="/ndihma" element={<CitizenHelpCenterPage />} />
              <Route path="/regjistri" element={<DetailedRegistryPage />} />
              <Route path="/registry" element={<DetailedRegistryPage />} />
              <Route path="/raporto" element={<ReportIssue />} />
              <Route path="/harta" element={<MapPage />} />
              <Route path="/statistikat" element={<StatisticsPage />} />
              <Route path="/shendetesia" element={<HealthRegistryPage />} />
              <Route path="/semundjet" element={<HealthRegistryPage />} />
              <Route path="/sondazhet" element={<PollsPage />} />
              <Route path="/sondazhe" element={<PollsPage />} />
              <Route path="/buxheti" element={<BudgetPage />} />
              <Route path="/komunat" element={<KomunatPage />} />
              <Route path="/sherbimet" element={<SherbimetPage />} />
              <Route path="/Idea" element={<IdeaPage />} />
              <Route path="/projektet" element={<ProjektetPage />} />
              <Route path="/lajme" element={<LajmePage />} />
              <Route path="/lajmet" element={<LajmePage />} />
              <Route path="/kontakt" element={<KontaktPage />} />
              <Route path="/kontakte" element={<KontaktPage />} />
              <Route path="/kontakt-numrat" element={<ContactNumbersPage />} />
              <Route path="/rreth-projektit" element={<RrethProjektitPage />} />
              <Route path="/rreth-nesh" element={<RrethProjektitPage />} />
              <Route path="/kushtet-e-perdorimit" element={<TermsOfServicePage />} />
              <Route path="/terms" element={<TermsOfServicePage />} />
              <Route path="/privatesia" element={<PrivacyPolicyPage />} />
              <Route path="/politika-e-priveritetit" element={<PrivacyPolicyPage />} />
              <Route path="/politika-e-cookies" element={<PrivacyPolicyPage />} />
              <Route path="/donacion" element={<DonationsPage />} />
            </Route>
            {}
            {/*
              Language-prefixed mirrors of every public route.

              /en/sherbimet and /de/sherbimet render the same components as the
              unprefixed Albanian paths, because the language lives in the URL
              prefix and the provider reads it from there. Declaring them under
              a :lang parameter keeps the route table in one place; the parameter
              is validated by LanguageUrlSync, and an unknown prefix falls through
              to the catch-all rather than rendering a half-translated page.
            */}
            <Route path="/:lang" element={<AppLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="forum" element={<GuestGuard><ForumPage /></GuestGuard>} />
              <Route path="detailed-registry" element={<DetailedRegistryPage />} />
              <Route path="trackid" element={<TrackIdPage />} />
              <Route path="ndihma" element={<CitizenHelpCenterPage />} />
              <Route path="regjistri" element={<DetailedRegistryPage />} />
              <Route path="registry" element={<DetailedRegistryPage />} />
              <Route path="raporto" element={<ReportIssue />} />
              <Route path="harta" element={<MapPage />} />
              <Route path="statistikat" element={<StatisticsPage />} />
              <Route path="shendetesia" element={<HealthRegistryPage />} />
              <Route path="semundjet" element={<HealthRegistryPage />} />
              <Route path="sondazhet" element={<PollsPage />} />
              <Route path="buxheti" element={<BudgetPage />} />
              <Route path="komunat" element={<KomunatPage />} />
              <Route path="sherbimet" element={<SherbimetPage />} />
              <Route path="Idea" element={<IdeaPage />} />
              <Route path="projektet" element={<ProjektetPage />} />
              <Route path="lajme" element={<LajmePage />} />
              <Route path="kontakt" element={<KontaktPage />} />
              <Route path="kontakt-numrat" element={<ContactNumbersPage />} />
              <Route path="rreth-projektit" element={<RrethProjektitPage />} />
              <Route path="kushtet-e-perdorimit" element={<TermsOfServicePage />} />
              <Route path="privatesia" element={<PrivacyPolicyPage />} />
              <Route path="donacion" element={<DonationsPage />} />
            </Route>
            <Route path="/komuna-panel" element={<MunicipalityPanel />} />
            <Route path="/komuna" element={<MunicipalityPanelPage />} />
            <Route path="/agent" element={<AgentPanelPage />} />
            <Route path="/monitorim" element={<MonitoringPage />} />
            <Route path="/moderim" element={<ModerationCenterPage />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="/approvals" element={<AdminPanel />} />
            {/*
              Catch-all. Without it any stale or mistyped link rendered a blank
              pane below the sidebar, which is the most common support ticket a
              platform with printed and shared links will generate.
            */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
            </Suspense>
          <FloatingSupportBot />
        </BrowserRouter>
        <CookieConsentBanner />
      </ErrorBoundary>
    </LanguageProvider>
  );
}
