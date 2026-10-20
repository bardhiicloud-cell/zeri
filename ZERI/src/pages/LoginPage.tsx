import { dt } from '@/src/lib/dt';
import { AuthShell, AuthField, AuthError, AuthDivider, GoogleIcon, authPrimaryBtn, authGoogleBtn, authGhostBtn } from '@/src/components/auth/AuthShell';
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useStore } from '../lib/store';
import { Lock, Mail, CheckCircle2, ChevronRight } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';
import { usePageMeta } from '../lib/usePageMeta';
import { auth, db, signInWithGoogle, readGoogleRedirectResult, getUserRole } from '../lib/firebase';
import { PROFILE_SYNC_FAILED, profileSyncError, syncOrCreateProfile } from '../lib/authSync';
import toast from 'react-hot-toast';
import { signInAsGuest } from '../lib/guestSession';
import { signInWithEmailAndPassword, sendPasswordResetEmail, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { canAccessAdmin } from '../lib/adminPermissions';
import { homeForRole } from '../lib/roleHome';
import SubmissionOverlay from '../components/SubmissionOverlay';

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
        const sync = await syncOrCreateProfile(user, { name: user.displayName || '', avatar: user.photoURL || '' });
        if (!sync.ok) throw profileSyncError(sync);
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.exists() ? userDoc.data() : {};
        login({
          id: user.uid,
          name: userData.name || user.displayName || '',
          email: user.email || '',
          role: userData.role || (await getUserRole()) || 'citizen',
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
        if (!cancelled && err?.code === PROFILE_SYNC_FAILED) {
          setError(err.message);
        } else if (!cancelled && err?.code && err.code !== 'auth/no-auth-event') {
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
      const sync = await syncOrCreateProfile(user, { name: user.displayName || '', avatar: user.photoURL || '' });

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
        role: userData.role || (await getUserRole()) || 'citizen',
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
        setError(`Hyrja me Google dështoi (${[err?.name, err?.code, err?.message].filter(Boolean).join(' | ').slice(0, 200) || 'pa përshkrim nga shfletuesi'}). Provoni përsëri.`);
      }
    } finally {
      setLoading(false);
    }
  };

  const isLogin = view === 'login';
  return (
    <>
      <SubmissionOverlay busy={loading} kind="login" />
    <AuthShell
      title={dt(isLogin ? 'Mirësevini' : view === 'reset-success' ? 'Verifikoni Emailin' : 'Rikthe Qasjen')}
      subtitle={isLogin ? dt('Identifikohuni për të vazhduar në platformë.') : view === 'reset-success' ? undefined : dt('Do t\'ju dërgojmë një lidhje të sigurt për fjalëkalimin e ri.')}
      onBack={view !== 'login' ? () => setView('login') : undefined}
      backLabel={t('login_back')}
      footer={isLogin ? <>{dt(`Nuk keni llogari?`)} <Link to="/register" className="ml-1 font-bold text-cyan-300 hover:text-cyan-200">{dt(`Krijoni llogari`)}</Link></> : undefined}
    >
      {error && <AuthError>{error}</AuthError>}

      {view === 'reset-success' ? (
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500/10">
            <CheckCircle2 className="h-8 w-8 text-emerald-400" />
          </div>
          <p className="text-sm leading-relaxed text-slate-300">{dt(`Ju kemi dërguar një email me lidhjen e sigurtë për të ndryshuar fjalëkalimin tuaj.`)}</p>
          <button type="button" onClick={() => setView('login')} className={authGhostBtn}>{dt(`Kthehu tek Hyrja`)}</button>
        </div>
      ) : (
        <form onSubmit={handleLogin} className="space-y-4">
          <AuthField
            label={dt(`Adresa e Emailit`)}
            icon={Mail}
            required
            type="email"
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder={dt(`email@shembull.com`)}
          />
          {isLogin && (
            <AuthField
              label={dt(`Fjalëkalimi`)}
              icon={Lock}
              required
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              action={<button type="button" onClick={() => setView('forgot')} className="text-xs font-bold text-cyan-300 hover:text-cyan-200">{dt(`Keni harruar?`)}</button>}
            />
          )}

          <button type="submit" disabled={loading} className={`${authPrimaryBtn} mt-2`}>
            {loading
              ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              : <><span>{dt(isLogin ? 'Kyçu në Sistem' : 'Rikthe Fjalëkalimin')}</span><ChevronRight className="h-4 w-4" /></>}
          </button>

          {isLogin && (
            <>
              <AuthDivider>{dt(`Ose`)}</AuthDivider>
              <button type="button" onClick={handleGoogle} disabled={loading} className={authGoogleBtn}>
                <GoogleIcon /><span>{dt(`Vazhdo me Google`)}</span>
              </button>
              <button
                type="button"
                onClick={async () => {
                  const guest = await signInAsGuest();
                  if (guest.ok === false) {
                    toast.error(guest.reason);
                    return;
                  }
                  navigate('/');
                }}
                className={`${authGhostBtn} mt-3`}
              >
                {dt(`Vazhdo si Mysafir (Guest)`)}
              </button>
            </>
          )}
        </form>
      )}
    </AuthShell>
    </>
  );
}
