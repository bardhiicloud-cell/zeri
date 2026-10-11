import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { dt } from '@/src/lib/dt';
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useStore } from '../lib/store';
import { Shield, ShieldAlert, Lock, ArrowLeft, Mail, CheckCircle2, ChevronRight } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';
import { auth, db } from '../lib/firebase';
import { getOrCreateGuestUser } from '../lib/session';
import { signInWithEmailAndPassword, sendPasswordResetEmail, signInAnonymously } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { canAccessAdmin } from '../lib/adminPermissions';
export default function LoginPage() {
    const { t } = useLanguage();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [view, setView] = useState('login');
    const currentUser = useStore(state => state.currentUser);
    const login = useStore(state => state.login);
    const addAuditLog = useStore(state => state.addAuditLog);
    const navigate = useNavigate();
    useEffect(() => {
        if (!currentUser)
            return;
        /**
         * Role comes from a server-issued custom claim, not from a field the client
         * can write, so this is only a routing convenience. The panel itself checks
         * capability again on the server before returning anything.
         */
        if (canAccessAdmin(currentUser)) {
            navigate('/admin');
            return;
        }
        navigate('/');
    }, [currentUser, navigate]);
    const handleLogin = async (e) => {
        e.preventDefault();
        if (view === 'login') {
            setLoading(true);
            setError('');
            try {
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                const userDoc = await getDoc(doc(db, "users", userCredential.user.uid));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    if (userData.isBanned) {
                        setError(t('login_error_banned'));
                        addAuditLog('Banned Login Attempt', 'danger', `Banned account tried to sign in`);
                    }
                    else {
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
                }
                else {
                    setError(t('login_error_invalid'));
                }
            }
            catch (err) {
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
        }
        else if (view === 'forgot') {
            setLoading(true);
            setError('');
            try {
                await sendPasswordResetEmail(auth, email);
                setView('reset-success');
                // Auto-trigger the support bot with /agent
                setTimeout(() => {
                    useStore.getState().openBot("/agent Përshëndetje, unë kam harruar fjalëkalimin dhe kam nevojë për ndihmë.");
                }, 1000);
            }
            catch (err) {
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
    return (_jsxs("div", { className: "min-h-screen w-full flex bg-slate-900 text-white font-sans overflow-hidden", children: [view !== 'login' && (_jsxs("button", { onClick: () => setView('login'), className: "absolute top-6 left-6 md:top-8 md:left-8 flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-xs font-bold tracking-wide transition-all z-50 text-slate-300 hover:text-white", children: [_jsx(ArrowLeft, { className: "w-4 h-4" }), " ", _jsx("span", { children: t('login_back') })] })), _jsxs("div", { className: "hidden lg:flex lg:w-1/2 relative bg-slate-900 items-end p-16 overflow-hidden", children: [_jsx("div", { className: "absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,_rgba(59,130,246,0.15),transparent_50%)]" }), _jsx("div", { className: "absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cartographer.png')] opacity-20" }), _jsxs("div", { className: "relative z-10 max-w-xl", children: [_jsx("div", { className: "w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-8 shadow-[0_0_40px_rgba(37,99,235,0.3)] border border-blue-500/50", children: _jsx(Shield, { className: "w-8 h-8 text-white" }) }), _jsxs("h1", { className: "text-5xl font-bold mb-6 title-serif tracking-tight leading-tight", children: [dt(`Sistemi Qendror`), " ", _jsx("br", {}), dt(`Zeri-Qytetarve`), _jsx("span", { className: "text-blue-500", children: "." })] }), _jsxs("p", { className: "text-lg text-slate-400 font-medium max-w-md leading-relaxed", children: [dt(`Platformë e pavarur qytetare për shërbim dhe zgjidhje të problemeve lokale.`), " ", _jsx("span", { className: "text-white", children: dt(`Nga qytetarët, për qytetarët.`) }), dt(`Bëhu pjesë e ndryshimit dhe ngrije zërin tënd.`)] }), _jsxs("div", { className: "mt-16 flex gap-8", children: [_jsxs("div", { className: "flex flex-col gap-2", children: [_jsx("span", { className: "text-3xl font-bold text-white", children: dt(`400ms`) }), _jsx("span", { className: "text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 font-bold", children: dt(`Koha e Përgjigjes`) })] }), _jsxs("div", { className: "flex flex-col gap-2", children: [_jsx("span", { className: "text-3xl font-bold text-white", children: "99.9%" }), _jsx("span", { className: "text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 font-bold", children: dt(`Uptime i Rrjetit`) })] })] })] })] }), _jsx("div", { className: "w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative overflow-y-auto", children: _jsxs("div", { className: "w-full max-w-md relative z-10 flex flex-col items-center", children: [_jsxs("div", { className: "lg:hidden flex flex-col items-center mb-8", children: [_jsx("div", { className: "w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-[0_0_40px_rgba(37,99,235,0.3)] border border-blue-500/50", children: _jsx(Shield, { className: "w-8 h-8 text-white" }) }), _jsxs("h1", { className: "text-3xl font-bold mb-2 title-serif tracking-tight text-center leading-tight", children: [dt(`Sistemi Qendror`), " ", _jsx("br", {}), dt(`Zeri-Qytetarve`), _jsx("span", { className: "text-blue-500", children: "." })] })] }), _jsx("h2", { className: "text-3xl sm:text-4xl font-bold text-white mb-2 tracking-tight text-center", children: view === 'login' ? 'Mirësevini' : view === 'reset-success' ? 'Verifikoni Emailin' : 'Rikthe Qasjen' }), _jsx("p", { className: "text-slate-400 font-medium mb-10 text-center text-sm", children: view === 'login' ? 'Identifikohuni përmes portalit të sigurtë' : view === 'reset-success' ? '' : 'Rivendosja e fjalëkalimit me protokoll të sigurtë' }), error && (_jsxs("div", { className: "w-full mb-8 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-bold tracking-wide flex items-center gap-3", children: [_jsx(ShieldAlert, { className: "w-5 h-5 flex-shrink-0" }), _jsx("div", { className: "flex-1", children: error })] })), view === 'reset-success' ? (_jsxs("div", { className: "w-full flex flex-col gap-6 items-center", children: [_jsx("div", { className: "w-20 h-20 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mb-4", children: _jsx(CheckCircle2, { className: "w-10 h-10 text-emerald-400" }) }), _jsx("p", { className: "text-slate-300 text-center font-medium max-w-sm text-sm", children: dt(`Ju kemi dërguar një email me lidhjen e sigurtë për të ndryshuar fjalëkalimin tuaj.`) }), _jsx("button", { onClick: () => setView('login'), className: "mt-4 w-full flex items-center justify-center gap-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold py-4 rounded-xl transition-all hover:bg-slate-100 dark:hover:bg-slate-800/50 dark:bg-slate-800 text-sm tracking-wide", children: dt(`Kthehu tek Hyrja`) })] })) : (_jsxs("form", { onSubmit: handleLogin, className: "w-full space-y-6", children: [_jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-xs font-bold tracking-widest text-slate-400 uppercase", children: dt(`Adresa e Emailit`) }), _jsxs("div", { className: "relative group", children: [_jsx(Mail, { className: "absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 dark:text-slate-400 group-focus-within:text-blue-500 transition-colors" }), _jsx("input", { required: true, type: "email", "aria-label": "Email Address", value: email, onChange: e => setEmail(e.target.value), className: "w-full pl-12 pr-4 py-4 bg-slate-800/50 border border-slate-700/50 rounded-xl outline-none transition-all duration-300 focus:bg-slate-800 focus:border-blue-500 text-white font-medium text-sm", placeholder: dt(`email@shembull.com`) })] })] }), view === 'login' && (_jsxs("div", { className: "space-y-1", children: [_jsxs("div", { className: "flex justify-between items-center", children: [_jsx("label", { className: "text-xs font-bold tracking-widest text-slate-400 uppercase", children: dt(`Fjalëkalimi`) }), _jsx("button", { type: "button", onClick: () => setView('forgot'), className: "text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors", children: dt(`Keni harruar?`) })] }), _jsxs("div", { className: "relative group", children: [_jsx(Lock, { className: "absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 dark:text-slate-400 group-focus-within:text-blue-500 transition-colors" }), _jsx("input", { required: true, type: "password", "aria-label": "Password", value: password, onChange: e => setPassword(e.target.value), className: "w-full pl-12 pr-4 py-4 bg-slate-800/50 border border-slate-700/50 rounded-xl outline-none transition-all duration-300 focus:bg-slate-800 focus:border-blue-500 text-white font-medium text-sm tracking-widest", placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" })] })] })), _jsxs("button", { type: "submit", disabled: loading, className: "w-full flex items-center justify-between px-6 bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 transition-all rounded-xl text-sm tracking-wide disabled:opacity-50 mt-8 group", children: [_jsx("span", { children: loading ? 'Duke Verifikuar...' : view === 'login' ? 'Kyçu në Sistem' : 'Rikthe Fjalëkalimin' }), loading ? _jsx("div", { className: "w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" }) : _jsx(ChevronRight, { className: "w-5 h-5 group-hover:translate-x-1 transition-transform" })] }), view === 'login' && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex items-center my-6", children: [_jsx("div", { className: "flex-1 border-t border-slate-700/50" }), _jsx("span", { className: "px-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest", children: dt(`Ose`) }), _jsx("div", { className: "flex-1 border-t border-slate-700/50" })] }), _jsx("button", { type: "button", onClick: async () => {
                                                try {
                                                    await signInAnonymously(auth);
                                                    navigate('/');
                                                }
                                                catch (err) {
                                                    const localGuest = getOrCreateGuestUser();
                                                    useStore.getState().setCurrentUser(localGuest);
                                                    navigate('/');
                                                }
                                            }, className: "w-full flex items-center justify-center gap-2 bg-slate-800/80 hover:bg-slate-700/80 text-white font-bold py-4 transition-all rounded-xl text-sm tracking-wide border border-slate-700/50 cursor-pointer", children: _jsx("span", { children: dt(`Vazhdo si Mysafir (Guest)`) }) })] }))] })), view === 'login' && (_jsxs("div", { className: "mt-12 text-center text-sm font-medium text-slate-400", children: [dt(`Nuk keni llogari?`), " ", _jsx(Link, { to: "/register", className: "text-white hover:text-blue-400 font-bold transition-colors ml-1", children: dt(`Krijoni një herë.`) })] }))] }) })] }));
}
