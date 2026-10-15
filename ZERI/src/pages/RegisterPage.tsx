import { dt } from '@/src/lib/dt';
import { AuthShell, AuthField, AuthError, AuthDivider, GoogleIcon, authPrimaryBtn, authGoogleBtn, authGhostBtn } from '@/src/components/auth/AuthShell';
import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useStore } from '../lib/store';
import { UserPlus, ShieldAlert, Phone, ArrowLeft, Mail, Lock, User, CheckCircle2, Calendar } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';
import { usePageMeta } from '../lib/usePageMeta';
import { auth, db, signInWithGoogle } from '../lib/firebase';
import { createUserWithEmailAndPassword, sendEmailVerification, GoogleAuthProvider } from 'firebase/auth';
import { PROFILE_SYNC_FAILED, profileSyncError, syncProfile } from '../lib/authSync';
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
  const handleGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const credential = await signInWithGoogle(provider);
      const user = credential.user;
      // Registration needs the server to create the profile; a failure is reported with its real cause.
      const sync = await syncProfile(user, { name: user.displayName || '', avatar: user.photoURL || '' });
      if (!sync.ok) throw profileSyncError(sync);

      register({
        name: user.displayName || '',
        email: user.email || '',
        isVerified: true,
        avatar: user.photoURL || '',
      });
      // Google has already verified the address — no email round-trip is
      // needed, so skip the "check your inbox" screen and enter the app.
      navigate('/');
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
        setError(`Regjistrimi me Google dështoi (${err?.code || err?.message || 'pa përshkrim nga shfletuesi'}). Provoni përsëri.`);
      }
    } finally {
      setLoading(false);
    }
  };

  const strengthColor = passwordCheck.score <= 1 ? 'bg-rose-400' : passwordCheck.score === 2 ? 'bg-amber-400' : 'bg-emerald-400';
  return (
    <AuthShell
      title={isVerifyingOtp ? dt('Verifikimi i Email-it') : dt('Krijo Llogarinë')}
      subtitle={isVerifyingOtp ? dt('Ndiqni udhëzimet e dërguara në email.') : dt("Plotësoni të dhënat për t'u bërë pjesë e platformës.")}
      onBack={() => navigate('/login')}
      backLabel={t('login_back')}
      footer={<>{dt(`Keni llogari?`)} <Link to="/login" className="ml-1 font-bold text-cyan-300 hover:text-cyan-200">{dt(`Identifikohu`)}</Link></>}
    >
      {error && <AuthError>{error}</AuthError>}

      {isVerifyingOtp ? (
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-400/10 text-cyan-300">
            <Mail className="h-8 w-8" />
          </div>
          <p className="text-sm leading-relaxed text-slate-300">{dt(`Kemi dërguar një email me lidhjen (linkun) e verifikimit në adresën:`)}<br />
            <strong className="mt-2 inline-block break-all text-white">{email}</strong>
          </p>
          <p className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs font-semibold text-cyan-200">{dt(`Ju lutem klikoni lidhjen në email për të aktivizuar llogarinë tuaj.`)}</p>
          <button
            type="button"
            onClick={handleResendVerification}
            disabled={resendIn > 0}
            className="text-xs font-bold text-cyan-300 underline underline-offset-4 hover:text-cyan-200 disabled:cursor-not-allowed disabled:text-slate-500"
          >
            {resendIn > 0 ? dt(`Ridërgo emailin (${resendIn}s)`) : dt(`Nuk e mori emailin? Ridërgoje`)}
          </button>
          <button type="button" onClick={() => navigate('/login')} className={authPrimaryBtn}>{dt(`Kthehu te Hyrja`)}</button>
        </div>
      ) : (
        <form onSubmit={handleRegister} className="space-y-4" noValidate>
          <AuthField
            label={t('register_name')}
            icon={User}
            type="text"
            required
            autoComplete="name"
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={() => setTouched(v => ({ ...v, name: true }))}
            error={fieldErrors.name}
            placeholder={dt(`Emri dhe mbiemri`)}
          />
          <AuthField
            label={dt(`Data e lindjes`)}
            icon={Calendar}
            type="date"
            required
            autoComplete="bday"
            max={new Date().toISOString().slice(0, 10)}
            value={dateOfBirth}
            onChange={e => setDateOfBirth(e.target.value)}
            onBlur={() => setTouched(v => ({ ...v, dob: true }))}
            error={fieldErrors.dob}
          />
          <AuthField
            label={dt(`Adresa e Emailit`)}
            icon={Mail}
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onBlur={() => setTouched(v => ({ ...v, email: true }))}
            error={fieldErrors.email}
            placeholder={dt(`email@shembull.com`)}
          />
          <AuthField
            label={dt(`Numri i telefonit`)}
            icon={Phone}
            type="tel"
            required
            autoComplete="tel"
            inputMode="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            onBlur={() => setTouched(v => ({ ...v, phone: true }))}
            error={fieldErrors.phone}
            placeholder={dt(`+383 44 XXX XXX`)}
          />
          <AuthField
            label={dt(`Fjalëkalimi`)}
            icon={Lock}
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onBlur={() => setTouched(v => ({ ...v, password: true }))}
            error={fieldErrors.password}
            placeholder="••••••••"
            hint={password.length > 0 ? (
              /* Strength meter: shows which property is missing so a citizen does not settle for something weaker. */
              <div id="pwd-meter" className="mt-2 space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="flex flex-1 gap-1" role="img" aria-label={`Fuqia e fjalëkalimit: ${passwordCheck.label}`}>
                    {[0, 1, 2, 3].map((index) => (
                      <div key={index} className={cn('h-1 flex-1 rounded-full transition-colors', index < passwordCheck.score ? strengthColor : 'bg-white/10')} />
                    ))}
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-300">{passwordCheck.label}</span>
                </div>
                {[...passwordCheck.problems, ...passwordCheck.suggestions].slice(0, 2).map((line) => (
                  <p key={line} className="flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-400">
                    <CheckIcon className="mt-0.5 h-3 w-3 shrink-0 text-cyan-300" aria-hidden="true" />{line}
                  </p>
                ))}
              </div>
            ) : undefined}
          />

          <button type="submit" disabled={loading || !isFormValid} className={`${authPrimaryBtn} mt-2`}>
            {loading ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <span>{t('register_submit')}</span>}
          </button>

          <AuthDivider>{dt('Ose')}</AuthDivider>
          <button type="button" onClick={handleGoogle} disabled={loading} className={authGoogleBtn}>
            <GoogleIcon /><span>{dt(`Regjistrohu me Google`)}</span>
          </button>
        </form>
      )}
    </AuthShell>
  );
}
