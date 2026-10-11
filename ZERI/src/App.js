import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useEffect, useState, Suspense } from 'react';
import ReactGA from 'react-ga4';
import { useLocation } from 'react-router-dom';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { usePageMeta } from './lib/usePageMeta';
import { Toaster } from 'react-hot-toast';
import FloatingSupportBot from './components/FloatingSupportBot';
import { AppLayout } from './components/layout/AppLayout';
import CookieConsentBanner from './components/CookieConsentBanner';
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const DetailedRegistryPage = React.lazy(() => import('./pages/DetailedRegistryPage'));
const TrackIdPage = React.lazy(() => import('./pages/TrackIdPage'));
const CitizenHelpCenterPage = React.lazy(() => import('./pages/CitizenHelpCenterPage'));
const ReportIssue = React.lazy(() => import('./pages/ReportIssue'));
const MapPage = React.lazy(() => import('./pages/MapPage'));
const ForumPage = React.lazy(() => import('./pages/ForumPage'));
const ContactNumbersPage = React.lazy(() => import('./pages/ContactNumbersPage'));
const DonationsPage = React.lazy(() => import('./pages/DonationsPage'));
const PollsPage = React.lazy(() => import('./pages/PollsPage'));
const StatisticsPage = React.lazy(() => import('./pages/StatisticsPage'));
const HealthRegistryPage = React.lazy(() => import('./pages/HealthRegistryPage'));
const InstitutionalUpdatesPage = React.lazy(() => import('./pages/InstitutionalUpdatesPage'));
const KomunatPage = React.lazy(() => import('./pages/KomunatPage'));
const SherbimetPage = React.lazy(() => import('./pages/SherbimetPage'));
const IdeaPage = React.lazy(() => import('./pages/IdeaPage'));
const ProjektetPage = React.lazy(() => import('./pages/ProjektetPage'));
const LajmePage = React.lazy(() => import('./pages/LajmePage'));
const KontaktPage = React.lazy(() => import('./pages/KontaktPage'));
const RrethProjektitPage = React.lazy(() => import('./pages/RrethProjektitPage'));
const TermsOfServicePage = React.lazy(() => import('./pages/TermsOfServicePage'));
const PrivacyPolicyPage = React.lazy(() => import('./pages/PrivacyPolicyPage'));
const BudgetPage = React.lazy(() => import('./pages/BudgetPage'));
const NotFoundPage = React.lazy(() => import('./pages/NotFoundPage'));
const AdminPanel = React.lazy(() => import('./pages/AdminPanel'));
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import { useStore, DEMO_REPORTS } from './lib/store';
import { LanguageProvider } from './lib/LanguageContext';
import { GuestGuard } from './components/GuestGuard';
import { ErrorBoundary } from './components/ErrorBoundary';
import ScrollToTop from './components/ScrollToTop';
import { GlobalAlert } from './components/GlobalAlert';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { doc, getDoc, collection, onSnapshot, query, orderBy, setDoc, getDocs, limit } from 'firebase/firestore';
import { getOrCreateGuestUser } from './lib/session';
import { GA_CONFIG, hasAnalyticsConsent, onConsentChange } from './lib/consent';
/**
 * Google Analytics 4 bootstrap, gated on consent.
 *
 * The measurement ID is a public build constant (it is not a secret), but the
 * script itself must never load without a positive answer under Law 06/L-082.
 * `hasAnalyticsConsent()` returns false while the citizen is undecided, so a
 * first-time visitor never causes a single gtag request.
 */
function useAnalyticsConsent() {
    const [consented, setConsented] = useState(() => hasAnalyticsConsent());
    useEffect(() => {
        // The visitor may answer the banner after the app has already mounted.
        return onConsentChange(() => setConsented(hasAnalyticsConsent()));
    }, []);
    return consented;
}
function AnalyticsTracker({ enabled }) {
    const location = useLocation();
    useEffect(() => {
        if (!enabled)
            return;
        if (!import.meta.env.VITE_GA_MEASUREMENT_ID)
            return;
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
const ROUTE_TITLES = {
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
    '/perditesimet': 'Përditësimet nga Institucionet',
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
        if (!analyticsConsented || !measurementId)
            return;
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
        const seedDatabaseIfEmpty = async (firebaseUser) => {
            if (!firebaseUser || !firebaseUser.email || firebaseUser.email !== 'bardhiicloud@gmail.com')
                return;
            // 2. Donation Causes
            try {
                const donationSnap = await getDocs(collection(db, "donationCauses"));
                if (donationSnap.empty && initialDonationCauses.length > 0) {
                    console.log("Seeding donationCauses...");
                    initialDonationCauses.forEach(async (cause) => {
                        try {
                            await setDoc(doc(db, "donationCauses", cause.id), cause);
                        }
                        catch (e) {
                            console.error("Error seeding donation cause", cause.id, e);
                        }
                    });
                }
            }
            catch (e) {
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
                        }
                        catch (e) {
                            console.error("Error seeding ad", ad.id, e);
                        }
                    });
                }
            }
            catch (e) {
                console.error("Error checking/seeding ads", e);
            }
        };
        // Every Firestore write (report creation, votes, comments) requires an
        // authenticated uid, so visitors are upgraded to an anonymous session.
        // When the Anonymous provider is disabled in the Firebase project this
        // fails silently and the citizen is asked to sign in at submit time.
        const startGuestSession = async () => {
            try {
                if (!auth.currentUser) {
                    await signInAnonymously(auth);
                }
            }
            catch (error) {
                const code = error?.code || '';
                const fallbackGuest = getOrCreateGuestUser();
                setCurrentUser(fallbackGuest);
                if (code === 'auth/operation-not-allowed' || code === 'auth/admin-restricted-operation') {
                    console.warn('Anonymous Auth është i çaktivizuar në këtë projekt Firebase. Sistemi vazhdon me sesion lokal mysafir për raportime dhe ndjekje.');
                }
                else {
                    console.warn('Nuk u krijua sesion mysafir në Firebase, u përdor sesioni lokal:', error?.message || error);
                }
            }
        };
        startGuestSession();
        // Auth Listener
        const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
            try {
                if (firebaseUser) {
                    try {
                        const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
                        let userData;
                        if (userDoc.exists()) {
                            userData = userDoc.data();
                            setCurrentUser(userData);
                        }
                        else {
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
                    }
                    catch (e) {
                        console.error("Gabim gjatë leximit të përdoruesit", e);
                    }
                }
                else if (!auth.currentUser) {
                    setCurrentUser(getOrCreateGuestUser());
                }
                else {
                    setCurrentUser(null);
                }
            }
            finally {
                setAuthInitialized(true);
            }
        });
        // Reports Listener
        let prevReports = [];
        setReportsStatus('loading');
        const q = query(collection(db, "reports"), orderBy("createdAt", "desc"), limit(100)); // P2: Limit queries for scale
        const unsubscribeReports = onSnapshot(q, (snapshot) => {
            if (snapshot.empty) {
                setReports(DEMO_REPORTS);
                setReportsStatus('ready');
                return;
            }
            const liveReports = snapshot.docs.map(doc => {
                const data = doc.data();
                let createdAt = data.createdAt;
                if (createdAt && typeof createdAt.toDate === 'function') {
                    createdAt = createdAt.toDate().toISOString();
                }
                else if (createdAt && typeof createdAt === 'object' && createdAt.seconds) {
                    createdAt = new Date(createdAt.seconds * 1000).toISOString();
                }
                let resolvedAt = data.resolvedAt;
                if (resolvedAt && typeof resolvedAt.toDate === 'function') {
                    resolvedAt = resolvedAt.toDate().toISOString();
                }
                else if (resolvedAt && typeof resolvedAt === 'object' && resolvedAt.seconds) {
                    resolvedAt = new Date(resolvedAt.seconds * 1000).toISOString();
                }
                const timeline = Array.isArray(data.timeline)
                    ? data.timeline.map((event) => {
                        let eventDate = event.date;
                        if (eventDate && typeof eventDate.toDate === 'function') {
                            eventDate = eventDate.toDate().toISOString();
                        }
                        else if (eventDate && typeof eventDate === 'object' && eventDate.seconds) {
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
            });
            // Browser push notification when an administrator changes a report status
            if (prevReports.length > 0 && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'modified') {
                        const data = change.doc.data();
                        let createdAt = data.createdAt;
                        if (createdAt && typeof createdAt.toDate === 'function') {
                            createdAt = createdAt.toDate().toISOString();
                        }
                        else if (createdAt && typeof createdAt === 'object' && createdAt.seconds) {
                            createdAt = new Date(createdAt.seconds * 1000).toISOString();
                        }
                        const newDoc = { ...data, id: change.doc.id, createdAt: createdAt || new Date().toISOString() };
                        const oldDoc = prevReports.find(r => r.id === newDoc.id);
                        if (oldDoc && oldDoc.status !== newDoc.status) {
                            let statusText = newDoc.status;
                            if (newDoc.status === 'Approved')
                                statusText = 'I Aprovuar';
                            else if (newDoc.status === 'Resolved')
                                statusText = 'I Zgjidhur';
                            else if (newDoc.status === 'Rejected')
                                statusText = 'I Refuzuar';
                            else if (newDoc.status === 'Pending Review')
                                statusText = 'Në Shqyrtim';
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
                }
                else {
                    useStoreAPI.setHasMoreReports(true);
                }
            }
        }, (error) => {
            console.error("Gabim me rikthimin e raporteve", error);
            const fallbackReports = DEMO_REPORTS;
            setReports(fallbackReports);
            setReportsStatus('ready');
        });
        // Donation Causes Listener
        const qDonations = query(collection(db, "donationCauses"), orderBy("createdAt", "desc"));
        const unsubscribeDonations = onSnapshot(qDonations, (snapshot) => {
            if (!snapshot.empty) {
                const liveCauses = snapshot.docs.map(doc => {
                    const data = doc.data();
                    let createdAt = data.createdAt;
                    if (createdAt && typeof createdAt.toDate === 'function') {
                        createdAt = createdAt.toDate().toISOString();
                    }
                    else if (createdAt && typeof createdAt === 'object' && createdAt.seconds) {
                        createdAt = new Date(createdAt.seconds * 1000).toISOString();
                    }
                    return {
                        ...data,
                        id: doc.id,
                        createdAt: createdAt || new Date().toISOString()
                    };
                });
                setDonationCauses(liveCauses);
            }
        }, (error) => {
            console.error("Gabim me rikthimin e donacioneve", error);
        });
        // Ads Listener
        const qAds = query(collection(db, "ads"));
        const unsubscribeAds = onSnapshot(qAds, (snapshot) => {
            if (!snapshot.empty) {
                const liveAds = snapshot.docs.map(doc => ({
                    ...doc.data(),
                    id: doc.id
                }));
                setAds(liveAds);
            }
        }, (error) => {
            console.error("Gabim me rikthimin e reklamave", error);
        });
        // Notifications Listener
        const qNotifications = query(collection(db, "notifications"), orderBy("createdAt", "desc"));
        const unsubscribeSettings = onSnapshot(doc(db, 'settings', 'general'), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                useStore.getState().setSystemSettings({
                    showReels: data.showReels !== false,
                    adContactPhone: data.adContactPhone || '+383 44 123 456',
                    adContactEmail: data.adContactEmail || 'reklama@qytetari.ks',
                    adContactCompanyName: data.adContactCompanyName || 'Platforma Qytetare Ad-Tech',
                    adSlogan: data.adSlogan || 'Arritni mijëra qytetarë dhe klientë potencialë në komunën tuaj',
                    adWhatsApp: data.adWhatsApp || '+38344123456',
                });
            }
        });
        const unsubscribeNotifications = onSnapshot(qNotifications, (snapshot) => {
            if (!snapshot.empty) {
                const currentNotifs = useStore.getState().notifications;
                const readIds = new Set(currentNotifs.filter(n => n.isRead).map(n => n.id));
                const liveNotifs = snapshot.docs.map(doc => ({
                    ...doc.data(),
                    id: doc.id,
                    isRead: readIds.has(doc.id)
                }));
                setNotifications(liveNotifs);
            }
            else {
                setNotifications([]);
            }
        }, (error) => {
            console.error("Gabim me rikthimin e njoftimeve", error);
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
        // Polls Listener
        const qPolls = query(collection(db, "polls"));
        const unsubscribePolls = onSnapshot(qPolls, (snapshot) => {
            if (snapshot.empty) {
                // Preserve the default active seed so the public survey page stays populated
                // until admins create live poll records in Firestore.
                return;
            }
            const livePolls = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setPolls(livePolls);
        }, (error) => console.error("Gabim me rikthimin e polls", error));
        // Categories Listener
        const qCategories = query(collection(db, "categories"));
        const unsubscribeCategories = onSnapshot(qCategories, (snapshot) => {
            const liveCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
            unsubscribeNotifications();
            unsubscribePolls();
            unsubscribeCategories();
        };
    }, [initialize, checkSLAs, setCurrentUser, setReports, setReportsStatus, setDonationCauses, setPolls, setAds, setNotifications]);
    if (!authInitialized) {
        return (_jsx("div", { className: "min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4", children: _jsxs("div", { className: "relative flex flex-col items-center", children: [_jsx("div", { className: "w-16 h-16 border-4 border-rose-500/20 border-t-rose-600 rounded-full animate-spin mb-4" }), _jsxs("span", { className: "text-xl font-bold tracking-widest text-white uppercase font-sans", children: ["KOSOVA BASHK\u00CB", _jsx("span", { className: "text-rose-600", children: "." })] }), _jsx("span", { className: "text-xs font-medium text-slate-400 mt-2 tracking-wide uppercase", children: "Duke ngarkuar platform\u00EBn..." })] }) }));
    }
    return (_jsxs(LanguageProvider, { children: [_jsx(GlobalAlert, {}), _jsxs(ErrorBoundary, { children: [_jsx(Toaster, { position: "top-right" }), _jsxs(HashRouter, { children: [_jsx(AnalyticsTracker, { enabled: analyticsConsented }), _jsx(RouteTitle, {}), _jsx(ScrollToTop, {}), _jsx(Suspense, { fallback: _jsx("div", { className: "h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-900", children: _jsx("div", { className: "animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600" }) }), children: _jsxs(Routes, { children: [_jsx(Route, { path: "/login", element: _jsx(LoginPage, {}) }), _jsx(Route, { path: "/register", element: _jsx(RegisterPage, {}) }), _jsxs(Route, { element: _jsx(AppLayout, {}), children: [_jsx(Route, { path: "/", element: _jsx(Dashboard, {}) }), _jsx(Route, { path: "/forum", element: _jsx(GuestGuard, { children: _jsx(ForumPage, {}) }) }), _jsx(Route, { path: "/detailed-registry", element: _jsx(DetailedRegistryPage, {}) }), _jsx(Route, { path: "/trackid", element: _jsx(TrackIdPage, {}) }), _jsx(Route, { path: "/ndihma", element: _jsx(CitizenHelpCenterPage, {}) }), _jsx(Route, { path: "/regjistri", element: _jsx(DetailedRegistryPage, {}) }), _jsx(Route, { path: "/registry", element: _jsx(DetailedRegistryPage, {}) }), _jsx(Route, { path: "/raporto", element: _jsx(ReportIssue, {}) }), _jsx(Route, { path: "/harta", element: _jsx(MapPage, {}) }), _jsx(Route, { path: "/statistikat", element: _jsx(StatisticsPage, {}) }), _jsx(Route, { path: "/shendetesia", element: _jsx(HealthRegistryPage, {}) }), _jsx(Route, { path: "/semundjet", element: _jsx(HealthRegistryPage, {}) }), _jsx(Route, { path: "/sondazhet", element: _jsx(PollsPage, {}) }), _jsx(Route, { path: "/sondazhe", element: _jsx(PollsPage, {}) }), _jsx(Route, { path: "/buxheti", element: _jsx(BudgetPage, {}) }), _jsx(Route, { path: "/komunat", element: _jsx(KomunatPage, {}) }), _jsx(Route, { path: "/sherbimet", element: _jsx(SherbimetPage, {}) }), _jsx(Route, { path: "/Idea", element: _jsx(IdeaPage, {}) }), _jsx(Route, { path: "/projektet", element: _jsx(ProjektetPage, {}) }), _jsx(Route, { path: "/lajme", element: _jsx(LajmePage, {}) }), _jsx(Route, { path: "/lajmet", element: _jsx(LajmePage, {}) }), _jsx(Route, { path: "/kontakt", element: _jsx(KontaktPage, {}) }), _jsx(Route, { path: "/kontakte", element: _jsx(KontaktPage, {}) }), _jsx(Route, { path: "/kontakt-numrat", element: _jsx(ContactNumbersPage, {}) }), _jsx(Route, { path: "/rreth-projektit", element: _jsx(RrethProjektitPage, {}) }), _jsx(Route, { path: "/rreth-nesh", element: _jsx(RrethProjektitPage, {}) }), _jsx(Route, { path: "/kushtet-e-perdorimit", element: _jsx(TermsOfServicePage, {}) }), _jsx(Route, { path: "/terms", element: _jsx(TermsOfServicePage, {}) }), _jsx(Route, { path: "/privatesia", element: _jsx(PrivacyPolicyPage, {}) }), _jsx(Route, { path: "/politika-e-priveritetit", element: _jsx(PrivacyPolicyPage, {}) }), _jsx(Route, { path: "/politika-e-cookies", element: _jsx(PrivacyPolicyPage, {}) }), _jsx(Route, { path: "/donacion", element: _jsx(DonationsPage, {}) }), _jsx(Route, { path: "/perditesimet", element: _jsx(InstitutionalUpdatesPage, {}) })] }), _jsx(Route, { path: "/admin", element: _jsx(AdminPanel, {}) }), _jsx(Route, { path: "/approvals", element: _jsx(AdminPanel, {}) }), _jsx(Route, { path: "*", element: _jsx(NotFoundPage, {}) })] }) }), _jsx(FloatingSupportBot, {})] }), _jsx(CookieConsentBanner, {})] })] }));
}
