import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { dt } from '@/src/lib/dt';
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useStore } from '../lib/store';
import { ShieldAlert, Phone, ArrowLeft, Mail, Lock, User, Shield } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';
import { auth } from '../lib/firebase';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { cn } from '../lib/utils';
import { normalisePhone, validateEmailShape, validateName, validatePassword, validatePhone, } from '../lib/validation';
import { CheckCircle2 as CheckIcon, X as XIcon } from 'lucide-react';
export default function RegisterPage() {
    const navigate = useNavigate();
    const { t } = useLanguage();
    const register = useStore(state => state.register);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
    /** Every client-side rule is also enforced by Firebase Auth server-side. */
    const [touched, setTouched] = useState({ name: false, email: false, phone: false, password: false });
    const passwordCheck = validatePassword(password);
    const fieldErrors = {
        name: touched.name && !validateName(name) ? 'Shkruani emrin dhe mbiemrin (të paktën dy fjalë).' : '',
        email: touched.email && !validateEmailShape(email) ? 'Shkruani një adresë email të vlefshme.' : '',
        phone: touched.phone && !validatePhone(phone) ? 'Shkruani numrin tuaj, p.sh. +383 44 123 456.' : '',
        password: touched.password && !passwordCheck.ok
            ? passwordCheck.problems[0] ?? 'Fjalëkalimi nuk është i mjaftueshëm.'
            : '',
    };
    const isFormValid = validateName(name) && validateEmailShape(email) && validatePhone(phone) && passwordCheck.ok;
    const handleRegister = async (e) => {
        e.preventDefault();
        setTouched({ name: true, email: true, phone: true, password: true });
        setError('');
        if (!isFormValid)
            return;
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
                body: JSON.stringify({ name: name.trim(), phone: normalisePhone(phone) })
            });
            if (!response.ok) {
                throw new Error('Backend sync failed');
            }
            try {
                await sendEmailVerification(user);
            }
            catch (e) {
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
        }
        catch (err) {
            if (err?.code === 'auth/email-already-in-use') {
                setError(t('register_error_email_exists'));
            }
            else if (err?.code === 'auth/weak-password') {
                setError('Fjalëkalimi është shumë i dobët. Zgjidhni një fjalëkalim më të gjatë dhe të ndryshëm.');
            }
            else if (err?.code === 'auth/too-many-requests') {
                setError('Shumë përpjekje nga ky pajisje. Provoni përsëri pas një ore.');
            }
            else if (err?.code === 'auth/network-request-failed') {
                setError('Nuk kemi lidhje me shërbimin. Kontrolloni internetin dhe provoni përsëri.');
            }
            else {
                setError(err?.message || t('register_error_failed'));
            }
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsxs("div", { className: "min-h-screen w-full flex bg-slate-900 text-white font-sans overflow-hidden", children: [_jsxs("button", { onClick: () => navigate('/login'), className: "absolute top-6 left-6 md:top-8 md:left-8 flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-xs font-bold tracking-wide transition-all z-50 text-slate-300 hover:text-white", children: [_jsx(ArrowLeft, { className: "w-4 h-4" }), " ", _jsx("span", { children: t('login_back') })] }), _jsxs("div", { className: "hidden lg:flex lg:w-1/2 relative bg-slate-900 items-end p-16 overflow-hidden", children: [_jsx("div", { className: "absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,_rgba(59,130,246,0.15),transparent_50%)]" }), _jsxs("div", { className: "relative z-10 max-w-xl", children: [_jsx("div", { className: "w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-8 shadow-[0_0_40px_rgba(37,99,235,0.3)] border border-blue-500/50", children: _jsx(Shield, { className: "w-8 h-8 text-white" }) }), _jsxs("h1", { className: "text-5xl font-bold mb-6 title-serif tracking-tight leading-tight", children: [dt(`Bashkohu me`), " ", _jsx("br", {}), dt(`Zërin e Qytetarëve`), _jsx("span", { className: "text-blue-500", children: "." })] }), _jsx("p", { className: "text-lg text-slate-400 font-medium max-w-md leading-relaxed", children: dt(`Krijo llogarinë tënde për të raportuar, mbështetur vizionet e komunitetit dhe ndërtuar një të ardhme më të përgjegjshme përmes platformës.`) })] })] }), _jsx("div", { className: "w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative overflow-y-auto", children: _jsxs("div", { className: "w-full max-w-md relative z-10 flex flex-col items-center", children: [_jsx("h2", { className: "text-3xl sm:text-4xl font-bold text-white mb-2 tracking-tight text-center", children: isVerifyingOtp ? "Verifikimi i Email-it" : "Krijo Llogarinë" }), _jsx("p", { className: "text-slate-400 font-medium mb-10 text-center text-sm", children: isVerifyingOtp
                                ? "Ndiqni udhëzimet e dërguara në email."
                                : "Plotësoni të dhënat e mëposhtme për t'u bërë pjesë e platformës." }), error && (_jsxs("div", { className: "w-full mb-8 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-bold tracking-wide flex items-center gap-3", children: [_jsx(ShieldAlert, { className: "w-5 h-5 flex-shrink-0" }), _jsx("div", { className: "flex-1", children: error })] })), isVerifyingOtp ? (_jsxs("div", { className: "w-full flex flex-col items-center justify-center space-y-6 text-center py-8", children: [_jsx("div", { className: "w-20 h-20 bg-blue-900/30 border border-blue-500/30 rounded-full flex items-center justify-center text-blue-400 mb-2", children: _jsx(Mail, { className: "w-10 h-10" }) }), _jsx("h2", { className: "text-xl font-black text-white", children: dt(`Verifikoni Email-in`) }), _jsxs("p", { className: "text-slate-400 text-sm leading-relaxed px-4", children: [dt(`Kemi dërguar një email me lidhjen (linkun) e verifikimit në adresën:`), _jsx("br", {}), _jsx("strong", { className: "text-white mt-2 inline-block", children: email })] }), _jsx("p", { className: "text-xs text-blue-400 font-bold bg-blue-900/20 px-4 py-2 rounded-2xl border border-blue-500/20", children: dt(`Ju lutem klikoni lidhjen në email për të aktivizuar llogarinë tuaj.`) }), _jsx("button", { onClick: () => navigate('/login'), className: "mt-4 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors w-full", children: dt(`Kthehu te Hyrja`) })] })) : (_jsxs("form", { onSubmit: handleRegister, className: "w-full space-y-4", noValidate: true, children: [_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "relative group", children: [_jsx("div", { className: "absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-slate-500 group-focus-within:text-blue-500 transition-colors", children: _jsx(User, { className: "w-5 h-5" }) }), _jsx("input", { type: "text", required: true, autoComplete: "name", value: name, onChange: e => setName(e.target.value), onBlur: () => setTouched(v => ({ ...v, name: true })), "aria-invalid": Boolean(fieldErrors.name), "aria-describedby": fieldErrors.name ? 'err-name' : undefined, className: cn("w-full pl-12 pr-4 py-4 bg-white/5 border rounded-xl outline-none focus:bg-white/10 focus:border-blue-500/50 transition-all text-white placeholder-slate-500 font-medium text-sm tracking-wide", fieldErrors.name ? "border-rose-500/60" : "border-white/10"), placeholder: t('register_name').toUpperCase() })] }), fieldErrors.name && (_jsxs("p", { id: "err-name", role: "alert", className: "flex items-center gap-1.5 pl-12 -mt-2 text-[11px] font-bold text-rose-400", children: [_jsx(XIcon, { className: "w-3 h-3 shrink-0", "aria-hidden": "true" }), fieldErrors.name] })), _jsxs("div", { className: "relative group", children: [_jsx("div", { className: "absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-slate-500 group-focus-within:text-blue-500 transition-colors", children: _jsx(Mail, { className: "w-5 h-5" }) }), _jsx("input", { type: "email", required: true, autoComplete: "email", value: email, onChange: e => setEmail(e.target.value), onBlur: () => setTouched(v => ({ ...v, email: true })), "aria-invalid": Boolean(fieldErrors.email), "aria-describedby": fieldErrors.email ? 'err-email' : undefined, className: cn("w-full pl-12 pr-4 py-4 bg-white/5 border rounded-xl outline-none focus:bg-white/10 focus:border-blue-500/50 transition-all text-white placeholder-slate-500 font-medium text-sm tracking-wide", fieldErrors.email ? "border-rose-500/60" : "border-white/10"), placeholder: dt(`email@shembull.com`) })] }), fieldErrors.email && (_jsxs("p", { id: "err-email", role: "alert", className: "flex items-center gap-1.5 pl-12 -mt-2 text-[11px] font-bold text-rose-400", children: [_jsx(XIcon, { className: "w-3 h-3 shrink-0", "aria-hidden": "true" }), fieldErrors.email] })), _jsxs("div", { className: "relative group", children: [_jsx("div", { className: "absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-slate-500 group-focus-within:text-blue-500 transition-colors", children: _jsx(Phone, { className: "w-5 h-5" }) }), _jsx("input", { type: "tel", required: true, autoComplete: "tel", inputMode: "tel", value: phone, onChange: e => setPhone(e.target.value), onBlur: () => setTouched(v => ({ ...v, phone: true })), "aria-invalid": Boolean(fieldErrors.phone), "aria-describedby": fieldErrors.phone ? 'err-phone' : undefined, className: cn("w-full pl-12 pr-4 py-4 bg-white/5 border rounded-xl outline-none focus:bg-white/10 focus:border-blue-500/50 transition-all text-white placeholder-slate-500 font-medium text-sm tracking-wide", fieldErrors.phone ? "border-rose-500/60" : "border-white/10"), placeholder: dt(`+383 44 XXX XXX`) })] }), fieldErrors.phone && (_jsxs("p", { id: "err-phone", role: "alert", className: "flex items-center gap-1.5 pl-12 -mt-2 text-[11px] font-bold text-rose-400", children: [_jsx(XIcon, { className: "w-3 h-3 shrink-0", "aria-hidden": "true" }), fieldErrors.phone] })), _jsxs("div", { className: "relative group", children: [_jsx("div", { className: "absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-slate-500 group-focus-within:text-blue-500 transition-colors", children: _jsx(Lock, { className: "w-5 h-5" }) }), _jsx("input", { type: "password", required: true, autoComplete: "new-password", value: password, onChange: e => setPassword(e.target.value), onBlur: () => setTouched(v => ({ ...v, password: true })), "aria-invalid": Boolean(fieldErrors.password), "aria-describedby": "pwd-meter", className: cn("w-full pl-12 pr-4 py-4 bg-white/5 border rounded-xl outline-none focus:bg-white/10 focus:border-blue-500/50 transition-all text-white placeholder-slate-500 font-medium text-sm tracking-wide", fieldErrors.password ? "border-rose-500/60" : "border-white/10"), placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" })] }), password.length > 0 && (_jsxs("div", { id: "pwd-meter", className: "pl-12 -mt-2 space-y-1.5", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "flex flex-1 gap-1", role: "img", "aria-label": `Fuqia e fjalëkalimit: ${passwordCheck.label}`, children: [0, 1, 2, 3].map((index) => (_jsx("div", { className: cn("h-1 flex-1 rounded-full transition-colors", index < passwordCheck.score
                                                                    ? passwordCheck.score <= 1 ? "bg-rose-500"
                                                                        : passwordCheck.score === 2 ? "bg-amber-500"
                                                                            : "bg-emerald-500"
                                                                    : "bg-white/10") }, index))) }), _jsx("span", { className: "text-[10px] font-black uppercase tracking-wider text-slate-400", children: passwordCheck.label })] }), [...passwordCheck.problems, ...passwordCheck.suggestions].slice(0, 2).map((line) => (_jsxs("p", { className: "flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-400", children: [_jsx(CheckIcon, { className: "mt-0.5 w-3 h-3 shrink-0 text-blue-400", "aria-hidden": "true" }), line] }, line)))] }))] }), _jsx("button", { type: "submit", disabled: loading || !isFormValid, className: "mt-6 w-full flex items-center justify-center gap-3 bg-blue-600 border border-blue-500 text-white font-bold py-4 rounded-xl transition-all hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm tracking-wide shadow-[0_0_20px_rgba(37,99,235,0.2)] hover:shadow-[0_0_30px_rgba(37,99,235,0.4)]", children: loading ? (_jsx("span", { className: "w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" })) : (_jsx("span", { children: t('register_submit') })) })] })), _jsxs("div", { className: "mt-10 border-t border-white/10 w-full pt-8 text-center text-sm font-medium text-slate-400", children: [dt(`Keni llogari?`), " ", _jsx(Link, { to: "/login", className: "text-white hover:text-blue-400 transition-colors border-b border-transparent hover:border-blue-400", children: dt(`Identifikohu`) })] })] }) })] }));
}
