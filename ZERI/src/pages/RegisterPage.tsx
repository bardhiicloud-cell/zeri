import { dt } from '@/src/lib/dt';
import { BrandLockup } from '@/src/components/BrandLogo';
import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useStore } from '../lib/store';
import { UserPlus, ShieldAlert, Phone, ArrowLeft, Mail, Lock, User, CheckCircle2, Calendar } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';
import { usePageMeta } from '../lib/usePageMeta';
import { auth, db, signInWithGoogle, readGoogleRedirectResult } from '../lib/firebase';
import { createUserWithEmailAndPassword, sendEmailVerification, GoogleAuthProvider } from 'firebase/auth';
import { PROFILE_SYNC_FAILED, profileSyncError, syncOrCreateProfile } from '../lib/authSync';
import { doc, setDoc } from 'firebase/firestore';
import { cn } from '../lib/utils';
import {
  normalisePhone,
  validateDateOfBirth,
  validateEmailShape,
  validateName,
  validatePassword,
  validatePhone,
} from '../lib/validation';
import { CheckCircle2 as CheckIcon, X as XIcon } from 'lucide-react';

export default function RegisterPage() {
  usePageMeta('Regjistrohu', 'Krijo llogari qytetari në Zëri Qytetarëve — raporto probleme, ndiq përgjigjet dhe merr pjesë në debat.');
  const navigate = useNavigate();
  const { t } = useLanguage();
  const register = useStore(state => state.register);

  const [name, setName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  /** Every client-side rule is also enforced by Firebase Auth server-side. */
  const [touched, setTouched] = useState({ name: false, dob: false, email: false, phone: false, password: false });
  /** "Ridërgo emailin" cooldown so the button cannot be spammed. */
  const [resendIn, setResendIn] = useState(0);

  const passwordCheck = validatePassword(password);

  const fieldErrors = {
    name: touched.name && !validateName(name) ? 'Shkruani emrin dhe mbiemrin (të paktën dy fjalë).' : '',
    dob: touched.dob && !validateDateOfBirth(dateOfBirth)
      ? 'Shkruani datëlindjen tuaj — duhet të keni të paktën 16 vjet.'
      : '',
    email: touched.email && !validateEmailShape(email) ? 'Shkruani një adresë email të vlefshme.' : '',
    phone: touched.phone && !validatePhone(phone) ? 'Shkruani numrin tuaj, p.sh. +383 44 123 456.' : '',
    password: touched.password && !passwordCheck.ok
      ? passwordCheck.problems[0] ?? 'Fjalëkalimi nuk është i mjaftueshëm.'
      : '',
  };

  const isFormValid =
    validateName(name) && validateDateOfBirth(dateOfBirth) && validateEmailShape(email) && validatePhone(phone) && passwordCheck.ok;

  /** 60-second countdown after each resend so Firebase's rate limit is respected. */
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn(v => v - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const handleResendVerification = async () => {
    if (resendIn > 0) return;
    try {
      const user = auth.currentUser;
      if (user) await sendEmailVerification(user);
      setResendIn(60);
    } catch (e) {
      console.warn('resend failed:', e);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ name: true, dob: true, email: true, phone: true, password: true });
    setError('');

    if (!isFormValid) return;

    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;
      const token = await user.getIdToken();

      // Sync via backend API. The profile document is created server-side so
      // the role can never be chosen by the client.
      const response = await fetch('/api/v1/auth/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: name.trim(), phone: normalisePhone(phone), dateOfBirth })
      });

      if (!response.ok) {
        throw new Error('Backend sync failed');
      }

      try {
        await sendEmailVerification(user);
        setResendIn(60);
      } catch (e) {
        // A sandbox project may have email delivery disabled. The account still
        // works; the banner in-app tells the citizen the address is unverified.
        console.warn("sendEmailVerification unavailable:", e);
      }

      const resData = await response.json();
      register({
        name: name.trim(),
        email: email.trim(),
        phone: normalisePhone(phone),
        isVerified: false,
        avatar: ''
      });

      setIsVerifyingOtp(true);
    } catch (err: any) {
      if (err?.code === 'auth/email-already-in-use') {
        setError(t('register_error_email_exists'));
      } else if (err?.code === 'auth/weak-password') {
        setError('Fjalëkalimi është shumë i dobët. Zgjidhni një fjalëkalim më të gjatë dhe të ndryshëm.');
      } else if (err?.code === 'auth/too-many-requests') {
        setError('Shumë përpjekje nga ky pajisje. Provoni përsëri pas një ore.');
      } else if (err?.code === 'auth/network-request-failed') {
        setError('Nuk kemi lidhje me shërbimin. Kontrolloni internetin dhe provoni përsëri.');
      } else {
        setError(err?.message || t('register_error_failed'));
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Google registration. Same server-side sync as email registration: the
   * profile document is created by the backend so the role is never chosen by
   * the client. The user goes straight to verification-required state, which
   * this page treats as a successful signup.
   */
  const finishGoogle = async (user: import('firebase/auth').User) => {
    const sync = await syncOrCreateProfile(user, { name: user.displayName || '', avatar: user.photoURL || '' });
    if (!sync.ok) throw profileSyncError(sync);
    register({
      name: user.displayName || '',
      email: user.email || '',
      isVerified: true,
      avatar: user.photoURL || '',
    });
    // Google has already verified the address — enter the app directly.
    navigate('/');
  };

  // A redirect fallback lands back on this page; complete it here.
  useEffect(() => {
    let cancelled = false;
    readGoogleRedirectResult()
      .then(async (credential) => { if (credential && !cancelled) await finishGoogle(credential.user); })
      .catch((err) => {
        if (cancelled) return;
        if (err?.code === PROFILE_SYNC_FAILED) setError(err.message);
        else if (err?.code && err.code !== 'auth/no-auth-event') setError(`Regjistrimi me Google dështoi (${err.code}). Provoni përsëri.`);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const credential = await signInWithGoogle(provider);
      const user = credential.user;
      // Registration needs the server to create the profile; a failure is reported with its real cause.
      await finishGoogle(user);
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
        // The user closed the popup; not an error worth a banner.
      } else if (err?.code === 'auth/popup-blocked') {
        setError('Shfletësi bllokoi dritaren e Google. Lejo popup dhe provoni përsëri.');
      } else if (err?.code === 'auth/operation-not-allowed') {
        setError('Regjistrimi me Google nuk është i aktivizuar në projekt. Aktivizoje në Firebase Console → Authentication.');
      } else if (err?.code === 'auth/firebase-app-check-token-is-invalid') {
        setError('Firebase App Check është i detyrueshëm për hyrjen por ky aplikacion nuk po dërgon token të vlefshëm. Kontakto administratorin.');
      } else if (err?.code === PROFILE_SYNC_FAILED) {
        setError(err.message);
      } else {
        console.error('[REGISTER] Google sign-up failed:', err?.code, err?.message);
        setError(`Regjistrimi me Google dështoi (${[err?.name, err?.code, err?.message].filter(Boolean).join(' | ').slice(0, 200) || 'pa përshkrim nga shfletuesi'}). Provoni përsëri.`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-slate-900 text-white font-sans overflow-hidden">
      <button
        onClick={() => navigate('/login')}
        className="absolute top-6 left-6 md:top-8 md:left-8 flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-xs font-bold tracking-wide transition-all z-50 text-slate-300 hover:text-white"
      >
        <ArrowLeft className="w-4 h-4" /> <span>{t('login_back')}</span>
      </button>

      <div className="hidden lg:flex lg:w-1/2 relative bg-slate-900 items-stretch p-16 overflow-hidden">
                <img src="/cover.jpg" alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-slate-950/20"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,_rgba(59,130,246,0.15),transparent_50%)]"></div>
        <div className="relative z-10 flex h-full w-full max-w-xl flex-col justify-between">
           <BrandLockup size="lg" />
           <div>
           <div className="mb-5 h-px w-16 bg-gradient-to-r from-cyan-400 to-transparent"></div>
           <h1 className="text-4xl font-bold mb-5 tracking-tight leading-tight">{dt(`Së bashku për një Kosovë më të mirë`)}<span className="text-cyan-400">.</span></h1>
           <p className="text-lg text-slate-400 font-medium max-w-md leading-relaxed">{dt(`Krijo llogarinë tënde për të raportuar, mbështetur vizionet e komunitetit dhe ndërtuar një të ardhme më të përgjegjshme përmes platformës.`)}
           </p>
           </div>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 pt-20 sm:p-12 sm:pt-24 lg:pt-12 relative overflow-y-auto">
        <div className="w-full max-w-md relative z-10 flex flex-col items-center">

          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-2 tracking-tight text-center">
             {isVerifyingOtp ? dt('Verifikimi i Email-it') : dt('Krijo Llogarinë')}
          </h2>
          <p className="text-slate-400 font-medium mb-10 text-center text-sm">
             {isVerifyingOtp
               ? "Ndiqni udhëzimet e dërguara në email."
               : "Plotësoni të dhënat e mëposhtme për t'u bërë pjesë e platformës."}
          </p>

          {error && (
            <div className="w-full mb-8 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-bold tracking-wide flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 flex-shrink-0" />
              <div className="flex-1">{error}</div>
            </div>
          )}

          {isVerifyingOtp ? (
            <div className="w-full flex flex-col items-center justify-center space-y-6 text-center py-8">
              <div className="w-20 h-20 bg-blue-900/30 border border-blue-500/30 rounded-full flex items-center justify-center text-blue-400 mb-2">
                <Mail className="w-10 h-10" />
              </div>
              <h2 className="text-xl font-black text-white">{dt(`Verifikoni Email-in`)}</h2>
              <p className="text-slate-400 text-sm leading-relaxed px-4">{dt(`Kemi dërguar një email me lidhjen (linkun) e verifikimit në adresën:`)}<br/>
                <strong className="text-white mt-2 inline-block">{email}</strong>
              </p>
              <p className="text-xs text-blue-400 font-bold bg-blue-900/20 px-4 py-2 rounded-2xl border border-blue-500/20">{dt(`Ju lutem klikoni lidhjen në email për të aktivizuar llogarinë tuaj.`)}
              </p>
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={resendIn > 0}
                className="text-xs font-bold text-blue-400 hover:text-blue-300 disabled:text-slate-500 disabled:cursor-not-allowed underline underline-offset-4"
              >
                {resendIn > 0
                  ? dt(`Ridërgo emailin (${resendIn}s)`)
                  : dt(`Nuk e mori emailin? Ridërgoje`)}
              </button>
              <button
                onClick={() => navigate('/login')}
                className="mt-4 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors w-full"
              >{dt(`Kthehu te Hyrja`)}
              </button>
            </div>
          ) : (
            <form onSubmit={handleRegister} className="w-full space-y-4" noValidate>
              <div className="space-y-4">
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-slate-500 group-focus-within:text-blue-500 transition-colors">
                    <User className="w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    required
                    autoComplete="name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onBlur={() => setTouched(v => ({ ...v, name: true }))}
                    aria-invalid={Boolean(fieldErrors.name)}
                    aria-describedby={fieldErrors.name ? 'err-name' : undefined}
                    className={cn(
                      "w-full pl-12 pr-4 py-4 bg-white/5 border rounded-xl outline-none focus:bg-white/10 focus:border-blue-500/50 transition-all text-white placeholder-slate-500 font-medium text-sm tracking-wide",
                      fieldErrors.name ? "border-rose-500/60" : "border-white/10"
                    )}
                    placeholder={t('register_name').toUpperCase()}
                  />
                </div>
                {fieldErrors.name && (
                  <p id="err-name" role="alert" className="flex items-center gap-1.5 pl-12 -mt-2 text-[11px] font-bold text-rose-400">
                    <XIcon className="w-3 h-3 shrink-0" aria-hidden="true" />{fieldErrors.name}
                  </p>
                )}

                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-slate-500 group-focus-within:text-blue-500 transition-colors">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <input
                    type="date"
                    required
                    autoComplete="bday"
                    max={new Date().toISOString().slice(0, 10)}
                    value={dateOfBirth}
                    onChange={e => setDateOfBirth(e.target.value)}
                    onBlur={() => setTouched(v => ({ ...v, dob: true }))}
                    aria-invalid={Boolean(fieldErrors.dob)}
                    aria-describedby={fieldErrors.dob ? 'err-dob' : undefined}
                    className={cn(
                      "w-full pl-12 pr-4 py-4 bg-white/5 border rounded-xl outline-none focus:bg-white/10 focus:border-blue-500/50 transition-all text-white placeholder-slate-500 font-medium text-sm tracking-wide [color-scheme:dark]",
                      fieldErrors.dob ? "border-rose-500/60" : "border-white/10"
                    )}
                  />
                </div>
                {fieldErrors.dob && (
                  <p id="err-dob" role="alert" className="flex items-center gap-1.5 pl-12 -mt-2 text-[11px] font-bold text-rose-400">
                    <XIcon className="w-3 h-3 shrink-0" aria-hidden="true" />{fieldErrors.dob}
                  </p>
                )}

                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-slate-500 group-focus-within:text-blue-500 transition-colors">
                    <Mail className="w-5 h-5" />
                  </div>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onBlur={() => setTouched(v => ({ ...v, email: true }))}
                    aria-invalid={Boolean(fieldErrors.email)}
                    aria-describedby={fieldErrors.email ? 'err-email' : undefined}
                    className={cn(
                      "w-full pl-12 pr-4 py-4 bg-white/5 border rounded-xl outline-none focus:bg-white/10 focus:border-blue-500/50 transition-all text-white placeholder-slate-500 font-medium text-sm tracking-wide",
                      fieldErrors.email ? "border-rose-500/60" : "border-white/10"
                    )}
                    placeholder={dt(`email@shembull.com`)}
                  />
                </div>
                {fieldErrors.email && (
                  <p id="err-email" role="alert" className="flex items-center gap-1.5 pl-12 -mt-2 text-[11px] font-bold text-rose-400">
                    <XIcon className="w-3 h-3 shrink-0" aria-hidden="true" />{fieldErrors.email}
                  </p>
                )}

                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-slate-500 group-focus-within:text-blue-500 transition-colors">
                    <Phone className="w-5 h-5" />
                  </div>
                  <input
                    type="tel"
                    required
                    autoComplete="tel"
                    inputMode="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    onBlur={() => setTouched(v => ({ ...v, phone: true }))}
                    aria-invalid={Boolean(fieldErrors.phone)}
                    aria-describedby={fieldErrors.phone ? 'err-phone' : undefined}
                    className={cn(
                      "w-full pl-12 pr-4 py-4 bg-white/5 border rounded-xl outline-none focus:bg-white/10 focus:border-blue-500/50 transition-all text-white placeholder-slate-500 font-medium text-sm tracking-wide",
                      fieldErrors.phone ? "border-rose-500/60" : "border-white/10"
                    )}
                    placeholder={dt(`+383 44 XXX XXX`)}
                  />
                </div>
                {fieldErrors.phone && (
                  <p id="err-phone" role="alert" className="flex items-center gap-1.5 pl-12 -mt-2 text-[11px] font-bold text-rose-400">
                    <XIcon className="w-3 h-3 shrink-0" aria-hidden="true" />{fieldErrors.phone}
                  </p>
                )}

                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-slate-500 group-focus-within:text-blue-500 transition-colors">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    type="password"
                    required
                    autoComplete="new-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onBlur={() => setTouched(v => ({ ...v, password: true }))}
                    aria-invalid={Boolean(fieldErrors.password)}
                    aria-describedby="pwd-meter"
                    className={cn(
                      "w-full pl-12 pr-4 py-4 bg-white/5 border rounded-xl outline-none focus:bg-white/10 focus:border-blue-500/50 transition-all text-white placeholder-slate-500 font-medium text-sm tracking-wide",
                      fieldErrors.password ? "border-rose-500/60" : "border-white/10"
                    )}
                    placeholder="••••••••"
                  />
                </div>

                {/*
                  Strength meter. A citizen who is told "password too weak"
                  with no explanation picks something worse, so the bar shows
                  exactly which property is missing.
                */}
                {password.length > 0 && (
                  <div id="pwd-meter" className="pl-12 -mt-2 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="flex flex-1 gap-1" role="img" aria-label={`Fuqia e fjalëkalimit: ${passwordCheck.label}`}>
                        {[0, 1, 2, 3].map((index) => (
                          <div
                            key={index}
                            className={cn(
                              "h-1 flex-1 rounded-full transition-colors",
                              index < passwordCheck.score
                                ? passwordCheck.score <= 1 ? "bg-rose-500"
                                  : passwordCheck.score === 2 ? "bg-amber-500"
                                  : "bg-emerald-500"
                                : "bg-white/10"
                            )}
                          />
                        ))}
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        {passwordCheck.label}
                      </span>
                    </div>
                    {[...passwordCheck.problems, ...passwordCheck.suggestions].slice(0, 2).map((line) => (
                      <p key={line} className="flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-400">
                        <CheckIcon className="mt-0.5 w-3 h-3 shrink-0 text-blue-400" aria-hidden="true" />
                        {line}
                      </p>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="submit"
                disabled={loading || !isFormValid}
                className="mt-6 w-full flex items-center justify-center gap-3 bg-blue-600 border border-blue-500 text-white font-bold py-4 rounded-xl transition-all hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm tracking-wide shadow-[0_0_20px_rgba(37,99,235,0.2)] hover:shadow-[0_0_30px_rgba(37,99,235,0.4)]"
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <span>{t('register_submit')}</span>
                )}
              </button>

              <div className="mt-6 w-full">
                <div className="flex items-center my-2">
                  <div className="flex-1 border-t border-white/10"></div>
                  <span className="px-3 text-xs font-bold text-slate-500 uppercase tracking-widest">{dt('Ose')}</span>
                  <div className="flex-1 border-t border-white/10"></div>
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
                  <span>{dt(`Regjistrohu me Google`)}</span>
                </button>
              </div>
            </form>
          )}
          <div className="mt-10 border-t border-white/10 w-full pt-8 text-center text-sm font-medium text-slate-400">{dt(`Keni llogari?`)} <Link to="/login" className="text-white hover:text-blue-400 transition-colors border-b border-transparent hover:border-blue-400">{dt(`Identifikohu`)}</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
