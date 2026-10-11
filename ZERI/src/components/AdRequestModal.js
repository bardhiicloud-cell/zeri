import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { X, Sparkles, Building2, CreditCard, Copy, Check, Send } from 'lucide-react';
import { motion } from 'motion/react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useStore } from '../lib/store';
import { KOSOVO_MUNICIPALITIES } from '../lib/constants';
import toast from 'react-hot-toast';
export function AdRequestModal({ isOpen, onClose, initialPostId, initialPostContent }) {
    const { systemSettings, currentUser } = useStore();
    const [copiedIban, setCopiedIban] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    // Form State
    const [businessName, setBusinessName] = useState(currentUser?.name || '');
    const [contactPhone, setContactPhone] = useState('');
    const [contactEmail, setContactEmail] = useState(currentUser?.email || '');
    const [targetMunicipality, setTargetMunicipality] = useState('Të gjitha Komunat');
    const [selectedPackage, setSelectedPackage] = useState('1_week');
    const [destinationUrl, setDestinationUrl] = useState('');
    const [paymentReference, setPaymentReference] = useState('');
    const [adNotes, setAdNotes] = useState(initialPostContent ? `Promovim për postimin ID: ${initialPostId}` : '');
    const bankName = systemSettings?.adBankName || 'Banka Ekonomike';
    const accountHolder = systemSettings?.adAccountHolder || 'Platforma Qytetare Kosovë Sh.P.K.';
    const bankIban = systemSettings?.adBankIban || 'XK05 1501 0010 0123 4567';
    const bankSwift = systemSettings?.adBankSwift || 'BEKOXKPR';
    const bankInstructions = systemSettings?.adBankInstructions || 'Vendosni emrin e biznesit tuaj dhe referencën në përshkrimin e transferit bankar.';
    const packages = [
        { id: '1_week', name: '1 Javë', price: '20€', reach: '~15,000 shikime', desc: 'Shfaqje në feed të qytetit dhe banner' },
        { id: '2_weeks', name: '2 Javë', price: '35€', reach: '~35,000 shikime', desc: 'Prioritet në algoritëm + Top Pozicion' },
        { id: '1_month', name: '1 Muaj', price: '60€', reach: '~80,000+ shikime', desc: 'Mbulim i plotë në të gjithë Kosovën' }
    ];
    const handleCopyIban = () => {
        navigator.clipboard.writeText(bankIban.replace(/\s+/g, ''));
        setCopiedIban(true);
        toast.success('IBAN u kopjua me sukses!');
        setTimeout(() => setCopiedIban(false), 2500);
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!businessName.trim() || !contactPhone.trim()) {
            toast.error('Ju lutem plotësoni emrin dhe telefonin kontaktues.');
            return;
        }
        setIsSubmitting(true);
        try {
            const selectedPkgObj = packages.find(p => p.id === selectedPackage);
            await addDoc(collection(db, 'adRequests'), {
                userId: currentUser?.id || 'anonymous',
                businessName,
                contactPhone,
                contactEmail,
                targetMunicipality,
                packageId: selectedPackage,
                packageName: selectedPkgObj?.name || '1 Javë',
                packagePrice: selectedPkgObj?.price || '20€',
                destinationUrl,
                paymentReference,
                adNotes,
                postId: initialPostId || null,
                status: 'pending',
                createdAt: new Date().toISOString()
            });
            toast.success('Kërkesa për reklamim u dërgua me sukses! Do t\'ju kontaktojmë pas verifikimit të pagesës bankare.');
            onClose();
        }
        catch (err) {
            console.error(err);
            toast.error('Gabim gjatë dërgimit të kërkesës. Ju lutem provoni përsëri.');
        }
        finally {
            setIsSubmitting(false);
        }
    };
    if (!isOpen)
        return null;
    return (_jsx("div", { className: "fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto", children: _jsxs(motion.div, { initial: { opacity: 0, scale: 0.95 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.95 }, className: "bg-white dark:bg-zinc-900 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-zinc-800 space-y-6 my-8", children: [_jsxs("div", { className: "flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-4", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center", children: _jsx(Sparkles, { className: "w-5 h-5" }) }), _jsxs("div", { children: [_jsx("h3", { className: "font-black text-lg text-slate-900 dark:text-white", children: initialPostId ? 'Promovo këtë Postim' : 'Kërkesë për Reklamë në Platformë' }), _jsx("p", { className: "text-xs text-slate-500", children: "Arrij mij\u00EBra qytetar\u00EB n\u00EB t\u00EB gjitha komunat e Kosov\u00EBs" })] })] }), _jsx("button", { onClick: onClose, className: "p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800", children: _jsx(X, { className: "w-5 h-5" }) })] }), _jsxs("div", { className: "bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-5 shadow-md relative overflow-hidden", children: [_jsx("div", { className: "absolute right-3 top-3 opacity-10", children: _jsx(Building2, { className: "w-24 h-24" }) }), _jsxs("div", { className: "relative z-10 space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between text-xs text-slate-300", children: [_jsxs("span", { className: "flex items-center gap-1.5 font-bold uppercase tracking-wider text-blue-400", children: [_jsx(CreditCard, { className: "w-3.5 h-3.5" }), "T\u00EB Dh\u00EBnat e Pages\u00EBs Bankare"] }), _jsx("span", { className: "bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full text-[10px] font-bold", children: "Transfer Bankar Zyrtar" })] }), _jsxs("div", { children: [_jsx("p", { className: "text-[11px] text-slate-400", children: "Banka & P\u00EBrfituesi:" }), _jsxs("p", { className: "text-sm font-bold text-white", children: [bankName, " \u2022 ", accountHolder] })] }), _jsxs("div", { className: "bg-black/30 rounded-xl p-3 border border-white/10 flex items-center justify-between gap-2", children: [_jsxs("div", { children: [_jsx("p", { className: "text-[10px] uppercase font-bold text-slate-400", children: "Numri i Llogaris\u00EB / IBAN:" }), _jsx("p", { className: "text-sm sm:text-base font-mono font-bold text-blue-300 tracking-wider", children: bankIban })] }), _jsxs("button", { type: "button", onClick: handleCopyIban, className: "px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors", children: [copiedIban ? _jsx(Check, { className: "w-3.5 h-3.5" }) : _jsx(Copy, { className: "w-3.5 h-3.5" }), _jsx("span", { children: copiedIban ? 'Kopjuar' : 'Kopjo IBAN' })] })] }), _jsxs("div", { className: "flex items-center justify-between text-[11px] text-slate-300", children: [_jsxs("span", { children: ["SWIFT / BIC: ", _jsx("strong", { children: bankSwift })] }), _jsx("span", { className: "text-[10px] text-slate-400 max-w-xs text-right truncate", children: bankInstructions })] })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2", children: "Zgjedh Paket\u00EBn e Reklam\u00EBs:" }), _jsx("div", { className: "grid grid-cols-1 sm:grid-cols-3 gap-3", children: packages.map(pkg => (_jsxs("button", { type: "button", onClick: () => setSelectedPackage(pkg.id), className: `p-3.5 rounded-2xl border text-left transition-all ${selectedPackage === pkg.id
                                    ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 ring-2 ring-blue-500/20'
                                    : 'border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/40 hover:border-slate-300'}`, children: [_jsxs("div", { className: "flex justify-between items-center mb-1", children: [_jsx("span", { className: "font-bold text-sm text-slate-900 dark:text-white", children: pkg.name }), _jsx("span", { className: "text-sm font-black text-blue-600 dark:text-blue-400", children: pkg.price })] }), _jsx("p", { className: "text-[11px] font-bold text-emerald-600 dark:text-emerald-400", children: pkg.reach }), _jsx("p", { className: "text-[10px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-1", children: pkg.desc })] }, pkg.id))) })] }), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1", children: "Emri i Biznesit / Personit *" }), _jsx("input", { type: "text", required: true, value: businessName, onChange: e => setBusinessName(e.target.value), placeholder: "psh. Restorant Drenica ose Emri Juaj", className: "w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500 font-medium" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1", children: "Numri Kontaktues (Tel / WhatsApp) *" }), _jsx("input", { type: "text", required: true, value: contactPhone, onChange: e => setContactPhone(e.target.value), placeholder: "+383 44 123 456", className: "w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500 font-medium" })] })] }), _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1", children: "Komuna e Synuar" }), _jsxs("select", { value: targetMunicipality, onChange: e => setTargetMunicipality(e.target.value), className: "w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500", children: [_jsx("option", { value: "T\u00EB gjitha Komunat", children: "\uD83D\uDCCD Gjith\u00EB Kosova (T\u00EB gjitha Komunat)" }), KOSOVO_MUNICIPALITIES.map(m => (_jsx("option", { value: m, children: m }, m)))] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1", children: "Linku i Faqes / Rrjeteve Sociale" }), _jsx("input", { type: "url", value: destinationUrl, onChange: e => setDestinationUrl(e.target.value), placeholder: "https://instagram.com/biznesi_yt", className: "w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500 font-medium" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1", children: "Numri i D\u00EBshmis\u00EB / Referenca e Pages\u00EBs Bankare" }), _jsx("input", { type: "text", value: paymentReference, onChange: e => setPaymentReference(e.target.value), placeholder: "psh. REF-2026-9812 ose data e transferit", className: "w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500 font-medium" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1", children: "P\u00EBrshkrimi i Reklam\u00EBs / Mesazhi" }), _jsx("textarea", { rows: 2, value: adNotes, onChange: e => setAdNotes(e.target.value), placeholder: "Shkruani tekstin q\u00EB d\u00EBshironi t\u00EB shfaqet n\u00EB reklam\u00EB...", className: "w-full px-3.5 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500 font-medium resize-none" })] }), _jsxs("div", { className: "pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-end gap-3", children: [_jsx("button", { type: "button", onClick: onClose, className: "px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200", children: "Anulo" }), _jsxs("button", { type: "submit", disabled: isSubmitting, className: "px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm shadow-md shadow-blue-600/20 active:scale-95 transition-all flex items-center gap-2", children: [_jsx(Send, { className: "w-4 h-4" }), _jsx("span", { children: isSubmitting ? 'Duke dërguar...' : 'Dërgo Kërkesën për Reklamim' })] })] })] })] }) }));
}
