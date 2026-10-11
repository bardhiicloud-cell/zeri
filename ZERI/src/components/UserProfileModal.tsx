import { dt } from '@/src/lib/dt';
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Camera, Save, User as UserIcon, Loader2, MapPin, Check, Phone, Mail } from 'lucide-react';
import { useRef } from 'react';

import { updateDoc, doc } from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth, db, uploadFileToStorage } from '../lib/firebase';
import { useStore } from '../lib/store';
import { cn } from '../lib/utils';
import { ALL_MUNICIPALITIES, ALL_SCOPE, isSpecificScope, scopeKey, searchMunicipalities } from '../lib/municipalityScope';

export function UserProfileModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const currentUser = useStore(state => state.currentUser);
  const setCurrentUser = useStore(state => state.setCurrentUser);
  const addAuditLog = useStore(state => state.addAuditLog);
  const userMunicipality = useStore(state => state.userMunicipality);
  const setUserMunicipality = useStore(state => state.setUserMunicipality);

  const [name, setName] = useState(currentUser?.name || '');
  const [avatar, setPhotoUrl] = useState(currentUser?.avatar || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Municipality editing.
   *
   * The city was read-only on a phone: the switcher lives in the left sidebar,
   * which is desktop-only, so a citizen on a phone had no way to see or change
   * the scope the whole platform was filtered to — the single most common
   * "my app is stuck on the wrong city" support case. The same control is now
   * reachable from the profile, which is where a citizen looks for their own
   * settings.
   */
  const [isPickingMunicipality, setIsPickingMunicipality] = useState(false);
  const [muniQuery, setMuniQuery] = useState('');
  const municipalityResults = useMemo(() => searchMunicipalities(muniQuery), [muniQuery]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Ju lutem zgjidhni një fotografi.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Fotografia është shumë e madhe. Maksimumi është 5MB.');
      return;
    }
    setIsUploading(true);
    try {
      const url = await uploadFileToStorage(file, 'avatars');
      setPhotoUrl(url);
    } catch (err) {
      console.error("Gabim gjatë ngarkimit të fotografisë:", err);
      alert("Nuk arritëm të ngarkojmë fotografinë. Ju lutem provoni përsëri.");
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen || !currentUser) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updates = { name, avatar };
      if (currentUser.role !== 'guest') {
        await updateDoc(doc(db, 'users', currentUser.id), updates);
      }
      setCurrentUser({ ...currentUser, ...updates });
      addAuditLog('Përditësim Profili', 'success', `Përdoruesi ${currentUser.email} përditësoi profilin.`);
      onClose();
    } catch (e) {
      console.error(e);
      alert('Gabim gjatë ruajtjes së profilit.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!currentUser.email || currentUser.role === 'guest') {
      alert('Kyçuni me një llogari të regjistruar për të ndryshuar fjalëkalimin.');
      return;
    }
    setIsSendingReset(true);
    try {
      await sendPasswordResetEmail(auth, currentUser.email);
      alert(`U dërgua linku për ndryshimin e fjalëkalimit te ${currentUser.email}.`);
    } catch (error) {
      console.error('Gabim gjatë dërgimit të linkut të fjalëkalimit:', error);
      alert('Linku nuk u dërgua. Kontrolloni emailin ose provoni përsëri.');
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 bg-slate-900/60 dark:bg-black/60 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-md max-h-[92dvh] overflow-y-auto overscroll-contain rounded-[1.25rem] border border-slate-200/60 bg-white/95 shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/95 dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)]"
          >
            <div className="flex items-center justify-between p-6 border-b border-slate-200/60 dark:border-white/10">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{dt(`Profili Im`)}</h2>
              <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 dark:bg-slate-800 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="flex flex-col items-center">
                <div className="relative">
                  {avatar ? (
                    <img src={avatar} alt={name} className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] dark:shadow-[0_4px_20px_-2px_rgba(0,0,0,0.3)]" />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center border-4 border-white shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] dark:shadow-[0_4px_20px_-2px_rgba(0,0,0,0.3)] text-slate-400">
                      <UserIcon className="w-10 h-10" />
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                  />
                  <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="absolute bottom-0 right-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] dark:shadow-[0_4px_20px_-2px_rgba(0,0,0,0.3)] hover:bg-blue-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed">
                    {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                  </button>
                </div>
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400 font-medium">{currentUser.email}</p>
                <div className="mt-1 px-3 py-1 bg-emerald-50 text-emerald-600 font-bold text-xs rounded-full border border-emerald-200">{dt(`Roli:`)} {currentUser.role}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">{dt(`Emri dhe Mbiemri`)}</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-white/10 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-[1rem] px-4 py-2.5 text-sm outline-none transition-all"
                  />
                </div>

                {/* Email is shown but not editable: changing it is a Firebase
                    Auth operation with its own verification flow, not a
                    Firestore field write. */}
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">{dt(`Email`)}</label>
                  <div className="flex items-center gap-2.5 rounded-[1rem] border border-slate-200/60 bg-slate-100 px-4 py-2.5 dark:border-white/10 dark:bg-slate-800/40">
                    <Mail className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-600 dark:text-slate-300">
                      {currentUser.email || dt('Nuk ka email')}
                    </span>
                    <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {dt('Fiks')}
                    </span>
                  </div>
                </div>

                {currentUser.phone && (
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">{dt(`Telefoni`)}</label>
                    <div className="flex items-center gap-2.5 rounded-[1rem] border border-slate-200/60 bg-slate-100 px-4 py-2.5 dark:border-white/10 dark:bg-slate-800/40">
                      <Phone className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                      <span className="text-sm text-slate-600 dark:text-slate-300">{currentUser.phone}</span>
                    </div>
                  </div>
                )}

                {/*
                  The city. This is the control a phone user could not reach:
                  the sidebar switcher is desktop-only, so the scope the whole
                  platform filters on had no mobile entry point at all.
                */}
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-300">
                    <MapPin className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                    {dt(`Qyteti / Komuna ime`)}
                  </label>

                  <button
                    type="button"
                    onClick={() => setIsPickingMunicipality((value) => !value)}
                    aria-expanded={isPickingMunicipality}
                    className="flex w-full items-center justify-between gap-2 rounded-[1rem] border border-slate-200/60 bg-slate-50 px-4 py-2.5 text-left transition-colors hover:border-blue-300 dark:border-white/10 dark:bg-slate-800/50"
                  >
                    <span className="min-w-0 truncate text-sm font-bold text-slate-800 dark:text-slate-100">
                      {isSpecificScope(userMunicipality) ? scopeKey(userMunicipality) : dt('Kosova — të gjitha 38 komunat')}
                    </span>
                    <Check className={cn('h-4 w-4 shrink-0', isSpecificScope(userMunicipality) ? 'text-blue-600' : 'text-slate-300 dark:text-slate-600')} aria-hidden="true" />
                  </button>

                  {isPickingMunicipality && (
                    <div className="mt-2 overflow-hidden rounded-[1rem] border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900">
                      <div className="border-b border-slate-100 p-2 dark:border-white/5">
                        <input
                          value={muniQuery}
                          onChange={(event) => setMuniQuery(event.target.value)}
                          placeholder={dt('Kërko në 38 komuna...')}
                          aria-label={dt('Kërko komunën')}
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-slate-800 dark:text-slate-100"
                        />
                      </div>
                      <ul className="max-h-52 overflow-y-auto overscroll-contain p-1.5 [scrollbar-width:thin]">
                        <li>
                          <button
                            type="button"
                            onClick={() => {
                              setUserMunicipality(ALL_SCOPE);
                              setIsPickingMunicipality(false);
                              setMuniQuery('');
                            }}
                            className={cn(
                              'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold transition-colors',
                              !isSpecificScope(userMunicipality)
                                ? 'bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200'
                                : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
                            )}
                          >
                            {dt('Kosova — të gjitha 38 komunat')}
                          </button>
                        </li>
                        {municipalityResults.map((municipality) => (
                          <li key={municipality}>
                            <button
                              type="button"
                              onClick={() => {
                                setUserMunicipality(municipality);
                                setIsPickingMunicipality(false);
                                setMuniQuery('');
                              }}
                              className={cn(
                                'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold transition-colors',
                                scopeKey(userMunicipality) === municipality
                                  ? 'bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200'
                                  : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
                              )}
                            >
                              {municipality}
                            </button>
                          </li>
                        ))}
                        {municipalityResults.length === 0 && (
                          <li className="px-3 py-4 text-center text-[11px] font-semibold text-slate-400">
                            {dt('Nuk u gjet asnjë komunë.')}
                          </li>
                        )}
                      </ul>
                      <p className="border-t border-slate-100 px-3 py-2 text-[10px] leading-snug text-slate-400 dark:border-white/5">
                        {dt('Kjo përcakton raportimet, lajmet dhe sondazhet që shihni në të gjithë platformën.')}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-800/60 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-white">{dt('Fjalëkalimi')}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {currentUser.role === 'guest'
                        ? dt('Regjistrohuni për të vendosur një fjalëkalim.')
                        : dt('Dërgo një link të sigurt për ta ndryshuar përmes emailit.')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handlePasswordReset}
                    disabled={isSendingReset || currentUser.role === 'guest'}
                    className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {isSendingReset ? dt('Duke dërguar…') : dt('Ndrysho fjalëkalimin')}
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200/60 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
              <button onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-200 bg-slate-100 dark:bg-slate-800 rounded-[1rem] transition-colors">{dt(`Anulo`)}
              </button>
              <button onClick={handleSave} disabled={isSaving || !name.trim()} className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-[1rem] transition-colors disabled:opacity-50">
                <Save className="w-4 h-4" />
                {isSaving ? 'Duke ruajtur...' : 'Ruaj'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
