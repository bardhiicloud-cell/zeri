import React, { useEffect, useState } from 'react';
import { 
  X, Sparkles, 
  Send, ShieldCheck, ArrowRight, ExternalLink, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useStore } from '../lib/store';
import { KOSOVO_MUNICIPALITIES } from '../lib/constants';
import toast from 'react-hot-toast';

import { dt } from '@/src/lib/dt';
import { PaymentInstructions } from './forum/PaymentInstructions';
import { createPaymentOrder, formatEur, getPaymentConfig, type BankDetails, type PaymentConfig, type PaymentOrder } from '../lib/debateApi';
/**
 * Shared with the public Partners & Advertising page so packages are defined
 * once. `price` and `reach` are deliberately empty: the owner sets them. While
 * a price is empty nothing is shown, and the request is confirmed by the team.
 */
export const AD_PACKAGES: ReadonlyArray<{ id: '1_week' | '2_weeks' | '1_month'; name: string; price: string; reach: string; desc: string }> = [
  { id: '1_week', name: '1 Javë', price: '', reach: '', desc: 'Shfaqje në feed të qytetit dhe banner' },
  { id: '2_weeks', name: '2 Javë', price: '', reach: '', desc: 'Prioritet në algoritëm + Top Pozicion' },
  { id: '1_month', name: '1 Muaj', price: '', reach: '', desc: 'Mbulim i plotë në të gjithë Kosovën' },
];

interface AdRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPostId?: string;
  initialPostContent?: string;
}

export function AdRequestModal({ isOpen, onClose, initialPostId, initialPostContent }: AdRequestModalProps) {
  const currentUser = useStore(state => state.currentUser);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [businessName, setBusinessName] = useState(currentUser?.name || '');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState(currentUser?.email || '');
  const [targetMunicipality, setTargetMunicipality] = useState('Të gjitha Komunat');
  const [selectedPackage, setSelectedPackage] = useState<'1_week' | '2_weeks' | '1_month'>('1_week');
  const [destinationUrl, setDestinationUrl] = useState('');
  const [adNotes, setAdNotes] = useState(initialPostContent ? `Promovim për postimin ID: ${initialPostId}` : '');

  const packages = AD_PACKAGES;

  // Prices are set by the owner in the Debate admin console, not in code.
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [payment, setPayment] = useState<{ order: PaymentOrder; bank: BankDetails | null; payseraEnabled: boolean } | null>(null);
  useEffect(() => {
    if (!isOpen || !auth.currentUser) return;
    getPaymentConfig().then(setConfig).catch(() => setConfig(null));
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim() || !contactPhone.trim()) {
      toast.error(dt('Ju lutem plotësoni emrin dhe telefonin kontaktues.'));
      return;
    }

    // The adRequests create rule requires a signed-in uid, a `phone` string and a
    // server timestamp. Earlier versions sent `contactPhone` and an ISO date, so
    // every request was rejected and the user saw a generic error.
    const uid = auth.currentUser?.uid;
    if (!uid) {
      toast.error(dt('Kyçuni për të dërguar kërkesën për reklamim.'));
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedPkgObj = packages.find(p => p.id === selectedPackage);
      const requestRef = await addDoc(collection(db, 'adRequests'), {
        userId: uid,
        businessName: businessName.trim(),
        phone: contactPhone.trim(),
        contactPhone: contactPhone.trim(),
        contactEmail: contactEmail.trim(),
        targetMunicipality,
        packageId: selectedPackage,
        packageName: selectedPkgObj?.name || '1 Javë',
        packagePrice: selectedPkgObj?.price || '',
        destinationUrl: destinationUrl.trim(),
        adNotes: adNotes.trim(),
        postId: initialPostId || null,
        status: 'pending',
        paymentStatus: 'awaiting_confirmation',
        createdAt: serverTimestamp()
      });

      // Ask for a payment code when this package has a price; otherwise the team follows up.
      const priced = config?.adPackagePrices?.[selectedPackage] !== undefined && (config.methods?.iban || config.methods?.paysera);
      if (priced) {
        try {
          const result = await createPaymentOrder({ kind: 'ad-package', packageId: selectedPackage, adRequestId: requestRef.id });
          setPayment(result);
          toast.success(dt('Kërkesa u dërgua. Përfundoni pagesën me kodin më poshtë.'));
          return;
        } catch {
          // The request itself is saved; fall through to the manual follow-up message.
        }
      }
      toast.success(dt('Kërkesa u dërgua për shqyrtim. Administrata do t’ju kontaktojë për hapat e pagesës.'));
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(dt('Gabim gjatë dërgimit të kërkesës. Ju lutem provoni përsëri.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  if (payment) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/60 backdrop-blur-xs sm:items-center sm:p-4">
        <div className="max-h-[94dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl dark:bg-zinc-900">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">{dt('Pagesa e reklamës')}</h3>
            <button type="button" onClick={() => { setPayment(null); onClose(); }} aria-label={dt('Mbyll')} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800">
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <PaymentInstructions order={payment.order} bank={payment.bank} payseraEnabled={payment.payseraEnabled} />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-zinc-900 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-zinc-800 space-y-6 my-8"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-lg text-slate-900 dark:text-white">
                {initialPostId ? dt('Promovo këtë Postim') : dt('Kërkesë për Reklamë në Platformë')}
              </h3>
              <p className="text-xs text-slate-500">
                {dt('Arrij mijëra qytetarë në të gjitha komunat e Kosovës')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={dt('Mbyll')}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pricing Packages */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
            {dt('Zgjedh Paketën e Reklamës:')}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {packages.map(pkg => (
              <button
                type="button"
                key={pkg.id}
                onClick={() => setSelectedPackage(pkg.id as any)}
                className={`p-3.5 rounded-2xl border text-left transition-all ${
                  selectedPackage === pkg.id
                    ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 ring-2 ring-blue-500/20'
                    : 'border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/40 hover:border-slate-300'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-sm text-slate-900 dark:text-white">{dt(pkg.name)}</span>
                  <span className="text-sm font-black text-blue-600 dark:text-blue-400">{config?.adPackagePrices?.[pkg.id] !== undefined ? formatEur(config.adPackagePrices?.[pkg.id]) : ''}</span>
                </div>
                <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">{dt(pkg.reach)}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">{dt(pkg.desc)}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Form Inputs */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {dt('Emri i Biznesit / Personit *')}
              </label>
              <input
                type="text"
                required
                value={businessName}
                onChange={e => setBusinessName(e.target.value)}
                placeholder={dt('psh. Restorant Drenica ose Emri Juaj')}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {dt('Numri Kontaktues (Tel / WhatsApp) *')}
              </label>
              <input
                type="text"
                required
                value={contactPhone}
                onChange={e => setContactPhone(e.target.value)}
                placeholder="+383 44 123 456"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500 font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {dt('Komuna e Synuar')}
              </label>
              <select
                value={targetMunicipality}
                onChange={e => setTargetMunicipality(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500"
              >
                <option value="Të gjitha Komunat">📍 {dt('Gjithë Kosova (Të gjitha Komunat)')}</option>
                {KOSOVO_MUNICIPALITIES.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {dt('Linku i Faqes / Rrjeteve Sociale')}
              </label>
              <input
                type="url"
                value={destinationUrl}
                onChange={e => setDestinationUrl(e.target.value)}
                placeholder="https://instagram.com/biznesi_yt"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500 font-medium"
              />
            </div>
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs leading-relaxed text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200">
            {dt('Pagesa nuk kryhet në këtë formular. Administrata shqyrton kërkesën dhe ju kontakton për konfirmim.')}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {dt('Përshkrimi i Reklamës / Mesazhi')}
            </label>
            <textarea
              rows={2}
              value={adNotes}
              onChange={e => setAdNotes(e.target.value)}
              placeholder={dt('Shkruani tekstin që dëshironi të shfaqet në reklamë...')}
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500 font-medium resize-none"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            >
              {dt('Anulo')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm shadow-md shadow-blue-600/20 active:scale-95 transition-all flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>{isSubmitting ? dt('Duke dërguar...') : dt('Dërgo Kërkesën për Reklamim')}</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
