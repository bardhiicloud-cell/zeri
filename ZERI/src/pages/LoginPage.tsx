import { dt } from '@/src/lib/dt';
import { BrandLockup } from '@/src/components/BrandLogo';
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useStore } from '../lib/store';
import { ShieldAlert, LogIn, Lock, ArrowLeft, Mail, KeyRound, CheckCircle2, ChevronRight } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';
import { usePageMeta } from '../lib/usePageMeta';
import { auth, db, signInWithGoogle, readGoogleRedirectResult } from '../lib/firebase';
import { getOrCreateGuestUser } from '../lib/session';
import { PROFILE_SYNC_FAILED, profileSyncError, syncProfile } from '../lib/authSync';
import { signInWithEmailAndPassword, sendPasswordResetEmail, signInAnonymously, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { canAccessAdmin } from '../lib/adminPermissions';
import { homeForRole } from '../lib/roleHome';

export default function LoginPage() {
  const { t } = useLanguage();
  usePageMeta('Hyrja', 'Hyr në platformën Zëri Qytetarëve me email dhe fjalëkalim ose me Google.');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'login' | 'forgot' | 'reset-success'>('login');

  const currentUser = useStore(state => state.currentUser);
  const login = useStore(state => state.login);
  const addAuditLog = useStore(state => state.addAuditLog);
  const navigate = useNavigate();

  useEffect(() => {
    // A redirect Google sign-in lands back on this page with the result
    // waiting in the auth session. Complete it here, then run the same
    // backend sync and login the popup path performs.
    let cancelled = false;
    readGoogleRedirectResult()
      .then(async (credential) => {
        if (!credential || cancelled) return;
        const user = credential.user;
        const token = await user.getIdToken();
        const response = await fetch('/api/v1/auth/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: user.displayName || '',
            avatar: user.photoURL || '',
          }),
        });
        if (!response.ok) throw new Error('Backend sync failed');
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.exists() ? userDoc.data() : {};
        login({
          id: user.uid,
          name: userData.name || user.displayName || '',
          email: user.email || '',
          role: userData.role || 'citizen',
          points: userData.points || 0,
          badges: userData.badges || [],
          isVerified: true,
          phone: userData.phone,
          avatar: userData.avatar || user.photoURL || '',
          trustScore: userData.trustScore,
          permissions: userData.permissions,
          isBanned: userData.isBanned,
        });
      })
      .catch((err) => {
        if (!cancelled && err?.code && err.code !== 'auth/no-auth-event') {
          console.error('[LOGIN] Google redirect sign-in failed:', err?.code, err?.message);
          setError(`Hyrja me Google dështoi (${err?.code}). Provoni përsëri.`);
        }
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    // The app creates an anonymous guest session on first load. Keep guests on
    // the login form instead of redirecting them before they can choose an account.
    if (!currentUser || currentUser.role === 'guest') return;

    /**
     * Send each role to the console it actually uses.
     *
     * Every staff role used to land on `/admin`, including an agent whose job is
     * field work — so an agent signing in arrived at a screen built for
     * administrators, with sections they cannot open, and had to find their own
     * panel from a menu. The desti nation below is the role's home.
     *
     * A grant is honoured too: an agent given the moderation centre by an
     * administrator is sent there rather than to a console they may not use.
     */
    const granted = (name: string) => (currentUser.permissions ?? []).includes(name as never);

    const home = homeForRole(currentUser.role);
    // An agent given monitoring by an administrator works in the manager's place.
    if (home === '/agent' && (granted('monitorim') || granted('monitoring'))) {
      navigate('/menagjer');
      return;
    }
    if (home !== '/') {
      navigate(home);
      return;
    }

    // A citizen carrying a grant still reaches the work they were given.
    if (canAccessAdmin(currentUser)) {
      navigate('/agent');
      return;
    }

    navigate('/');
  }, [currentUser, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (view === 'login') {
      setLoading(true);
      setError('');

      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const userDoc = await getDoc(doc(db, "users", userCredential.user.uid));

        if (userDoc.exists()) {
          const userData = userDoc.data() as any;
          if (userData.isBanned) {
            setError(t('login_error_banned'));
            addAuditLog('Banned Login Attempt', 'danger', `Banned account tried to sign in`);
          } else {
            login({
              id: userCredential.user.uid,
              name: userData.name || '',
              email: userCredential.user.email || '',
              role: userData.role || 'citizen',
              points: userData.points || 0,
              badges: userData.badges || [],
              isVerified: userCredential.user.emailVerified || userData.isVerified,
              phone: userData.phone,
              avatar: userData.avatar,
              trustScore: userData.trustScore,
              permissions: userData.permissions,
              isBanned: userData.isBanned,
            });
          }
        } else {
          setError(t('login_error_invalid'));
        }
      } catch (err: any) {
        /**
         * One generic message for every failure mode.
         *
         * Distinguishing "wrong password" from "no such account" is a
         * user-enumeration oracle: an attacker walks a list of emails and learns
         * which are registered, which is the first step of a credential-stuffing
         * run against a national platform. The real cause is logged server-side.
         */
        setError(t('login_error_invalid'));
        addAuditLog('Failed Login', 'danger', 'Invalid credentials');
      }
      setLoading(false);
    } else if (view === 'forgot') {
      setLoading(true);
      setError('');

      try {
        await sendPasswordResetEmail(auth, email);
        setView('reset-success');

        // Auto-trigger the support bot with /agent
        setTimeout(() => {
          useStore.getState().openBot("/agent Përshëndetje, unë kam harruar fjalëkalimin dhe kam nevojë për ndihmë.");
        }, 1000);

      } catch(err: any) {
        /**
         * The reset request is acknowledged either way, so a caller cannot use
         * this endpoint to learn which addresses have accounts. The support bot
         * is started in both cases as the fallback path.
         */
        setTimeout(() => {
          useStore.getState().openBot("/agent Përshëndetje, unë kam harruar fjalëkalimin dhe kam nevojë për ndihmë.");
        }, 1000);
        setError("Kontrolloni emailin tuaj, ose prisni derisa agjenti t'ju përgjigjet.");
      }
      setLoading(false);
    }
  };

  /**
   * Google sign-in. Firebase returns the profile (name, email, photo), and the
   * backend sync creates the Firestore document server-side so the role is
   * never chosen by the client — the same flow as email registration.
   */
  const handleGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const credential = await signInWithGoogle(provider);
      const user = credential.user;
      const sync = await syncProfile(user, { name: user.displayName || '', avatar: user.photoURL || '' });

      // The login effect below reads currentUser and routes: staff to /admin,
      // everyone else to /. If the document does not exist yet the sync call
      // above just created it, so re-reading it here keeps the role fresh.
      const userDoc = await getDoc(doc(db, 'users', user.uid)).catch(() => null);
      // An existing profile (every administrator has one) is enough to continue: the sync only
      // creates first-time profiles. Without a profile and without a sync there is no account.
      if (!userDoc?.exists() && !sync.ok) throw profileSyncError(sync);
      if (!sync.ok) console.warn('[LOGIN] profile sync failed but the profile exists; continuing.', sync.status, sync.serverMessage);
      const userData = userDoc?.exists() ? userDoc.data() : {};
      login({
        id: user.uid,
        name: userData.name || user.displayName || '',
        email: user.email || '',
        role: userData.role || 'citizen',
        points: userData.points || 0,
        badges: userData.badges || [],
        isVerified: true,
        phone: userData.phone,
        avatar: userData.avatar || user.photoURL || '',
        trustScore: userData.trustScore,
        permissions: userData.permissions,
        isBanned: userData.isBanned,
      });
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
        // The citizen closed the window themselves; not an error worth a banner.
      } else if (err?.code === 'auth/popup-blocked') {
        setError('Shfletësi bllokoi dritaren e Google. Lejo popup dhe provoni përsëri.');
      } else if (err?.code === 'auth/operation-not-allowed') {
        setError('Hyrja me Google nuk është e aktivizuar në projekt. Aktivizoje në Firebase Console → Authentication.');
      } else if (err?.code === 'auth/unauthorized-domain') {
        setError('Ky domain nuk është i autorizuar. Shtoje në Firebase Console → Authentication → Settings → Authorized domains.');
      } else if (err?.code === 'auth/network-request-failed') {
        setError('Problem me rrjetin. Kontrollo internetin dhe provo përsëri.');
      } else if (err?.code === 'auth/firebase-app-check-token-is-invalid') {
        console.error('[LOGIN] App Check is enforced for Authentication but no valid token was sent. Set VITE_FIREBASE_APPCHECK_SITE_KEY (and register the debug token on localhost) or unenforce Authentication in Firebase Console → App Check.');
        setError('Firebase App Check është i detyrueshëm për hyrjen por ky aplikacion nuk po dërgon token të vlefshëm. Kontakto administratorin.');
      } else if (err?.code === 'auth/configuration-not-found' || err?.code === 'auth/invalid-api-key') {
        setError('Konfigurimi i Firebase mungon ose është i gabuar — kontakto administratorin.');
      } else if (err?.code === PROFILE_SYNC_FAILED) {
        setError(err.message);
      } else {
        console.error('[LOGIN] Google sign-in failed:', err?.code, err?.message);
        // Never "unknown": say what the browser was told.
        setError(`Hyrja me Google dështoi (${err?.code || err?.message || 'pa përshkrim nga shfletuesi'}). Provoni përsëri.`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-slate-900 text-white font-sans overflow-hidden">

      {/* Back Button */}
      {view !== 'login' && (
        <button
          onClick={() => setView('login')}
          className="absolute top-6 left-6 md:top-8 md:left-8 flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-xs font-bold tracking-wide transition-all z-50 text-slate-300 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" /> <span>{t('login_back')}</span>
        </button>
      )}

      {/* Left Pane - Visual & Brand context */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-slate-900 items-stretch p-16 overflow-hidden">
        {/* Subtle background abstract shapes */}
                <img src="/cover.jpg" alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-slate-950/20"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,_rgba(59,130,246,0.15),transparent_50%)]"></div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cartographer.png')] opacity-20"></div>

        <div className="relative z-10 flex h-full w-full max-w-xl flex-col justify-between">
           <BrandLockup size="lg" />
           <div>
           <div className="mb-5 h-px w-16 bg-gradient-to-r from-cyan-400 to-transparent"></div>
           <h1 className="text-4xl font-bold mb-5 tracking-tight leading-tight">{dt(`Së bashku për një Kosovë më të mirë`)}<span className="text-cyan-400">.</span></h1>
           <p className="text-lg text-slate-400 font-medium max-w-md leading-relaxed">{dt(`Platformë e pavarur qytetare për shërbim dhe zgjidhje të problemeve lokale.`)} <span className="text-white">{dt(`Nga qytetarët, për qytetarët.`)}</span>{dt(`Bëhu pjesë e ndryshimit dhe ngrije zërin tënd.`)}
           </p>
           </div>

           {/* The two "400ms" and "99.9% uptime" figures that stood here were not measured
               anywhere. Nothing is shown in their place: a number on a login page is
               either true and sourced, or it is not there. */}
        </div>
      </div>

      {/* Right Pane - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative overflow-y-auto">
        <div className="w-full max-w-md relative z-10 flex flex-col items-center">

          {/* Mobile Branding */}
          <div className="lg:hidden flex flex-col items-center mb-8">
            <BrandLockup size="md" />
          </div>

          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-2 tracking-tight text-center">
            {dt(view === 'login' ? 'Mirësevini' : view === 'reset-success' ? 'Verifikoni Emailin' : 'Rikthe Qasjen')}
          </h2>
          <p className="text-slate-400 font-medium mb-10 text-center text-sm">
            {dt(view === 'login' ? 'Identifikohuni përmes portalit të sigurtë' : view === 'reset-success' ? '' : 'Rivendosja e fjalëkalimit me protokoll të sigurtë')}
          </p>

          {error && (
            <div className="w-full mb-8 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-bold tracking-wide flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 flex-shrink-0" />
              <div className="flex-1">{error}</div>
            </div>
          )}

          {view === 'reset-success' ? (
            <div className="w-full flex flex-col gap-6 items-center">
              <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mb-4">
                 <CheckCircle2 className="w-10 h-10 text-emerald-400" />
              </div>
              <p className="text-slate-300 text-center font-medium max-w-sm text-sm">{dt(`Ju kemi dërguar një email me lidhjen e sigurtë për të ndryshuar fjalëkalimin tuaj.`)}
              </p>
              <button
                onClick={() => setView('login')}
                className="mt-4 w-full flex items-center justify-center gap-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold py-4 rounded-xl transition-all hover:bg-slate-100 dark:hover:bg-slate-800/50 dark:bg-slate-800 text-sm tracking-wide"
              >{dt(`Kthehu tek Hyrja`)}
              </button>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="w-full space-y-6">
              <div className="space-y-1">
                <label className="text-xs font-bold tracking-widest text-slate-400 uppercase">{dt(`Adresa e Emailit`)}
                </label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 dark:text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                  <input
                      required
                      type="email"
                      aria-label="Email Address"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-slate-800/50 border border-slate-700/50 rounded-xl outline-none transition-all duration-300 focus:bg-slate-800 focus:border-blue-500 text-white font-medium text-sm"
                    placeholder={dt(`email@shembull.com`)}
                  />
                </div>
              </div>

              {view === 'login' && (
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold tracking-widest text-slate-400 uppercase">{dt(`Fjalëkalimi`)}
                    </label>
                    <button
                      type="button"
                      onClick={() => setView('forgot')}
                      className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors"
                    >{dt(`Keni harruar?`)}
                    </button>
                  </div>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 dark:text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                    <input
                      required
                      type="password"
                      aria-label="Password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-slate-800/50 border border-slate-700/50 rounded-xl outline-none transition-all duration-300 focus:bg-slate-800 focus:border-blue-500 text-white font-medium text-sm tracking-widest"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-between px-6 bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 transition-all rounded-xl text-sm tracking-wide disabled:opacity-50 mt-8 group"
              >
                <span>{dt(loading ? 'Duke Verifikuar...' : view === 'login' ? 'Kyçu në Sistem' : 'Rikthe Fjalëkalimin')}</span>
                {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
              </button>

              {view === 'login' && (
                <>
                  <div className="flex items-center my-6">
                    <div className="flex-1 border-t border-slate-700/50"></div>
                    <span className="px-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{dt(`Ose`)}</span>
                    <div className="flex-1 border-t border-slate-700/50"></div>
                  </div>

                   <button
                     type="button"
                     onClick={handleGoogle}
                     disabled={loading}
                     className="w-full flex items-center justify-center gap-2 bg-white text-slate-900 hover:bg-slate-100 font-bold py-4 transition-all rounded-xl text-sm tracking-wide border border-slate-200 cursor-pointer disabled:opacity-50"
                   >
                     <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                       <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.46a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.56-5.17 3.56-8.82Z" />
                       <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3c-1.08.72-2.46 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.1A12 12 0 0 0 12 24Z" />
                       <path fill="#FBBC05" d="M5.28 14.29A7.2 7.2 0 0 1 4.9 12c0-.8.14-1.57.38-2.29v-3.1H1.27a12 12 0 0 0 0 10.78l4.01-3.1Z" />
                       <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.27 6.61l4.01 3.1C6.22 6.86 8.87 4.75 12 4.75Z" />
                     </svg>
                     <span>{dt(`Vazhdo me Google`)}</span>
                   </button>

                   <button
                     type="button"
                     onClick={async () => {
                       try {
                         await signInAnonymously(auth);
                         navigate('/');
                       } catch (err: any) {
                         const localGuest = getOrCreateGuestUser();
                         useStore.getState().setCurrentUser(localGuest);
                         navigate('/');
                       }
                     }}
                     className="w-full flex items-center justify-center gap-2 bg-slate-800/80 hover:bg-slate-700/80 text-white font-bold py-4 transition-all rounded-xl text-sm tracking-wide border border-slate-700/50 cursor-pointer"
                   >
                     <span>{dt(`Vazhdo si Mysafir (Guest)`)}</span>
                   </button>
                </>
              )}

            </form>
          )}

          {view === 'login' && (
            <div className="mt-12 text-center text-sm font-medium text-slate-400">{dt(`Nuk keni llogari?`)} <Link to="/register" className="text-white hover:text-blue-400 font-bold transition-colors ml-1">{dt(`Krijoni një herë.`)}</Link>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
