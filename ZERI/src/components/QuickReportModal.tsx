import { dt } from '@/src/lib/dt';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Camera, MapPin, Loader2, Send } from 'lucide-react';
import { useStore } from '../lib/store';
import { uploadFileToStorage } from '../lib/firebase';
import { authHeaders } from '../lib/apiAuth';
import { fetchWithTimeout, isJsonResponse } from '../lib/timeouts';
import { saveGuestReportHistory } from '../lib/session';
import { isSpecificScope } from '../lib/municipalityScope';
import { useNavigate } from 'react-router-dom';
import { getReportTopicValueLabel, REPORT_TOPICS } from '../lib/reportTopics';

interface QuickReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function QuickReportModal({ isOpen, onClose }: QuickReportModalProps) {
  const currentUser = useStore(state => state.currentUser);
  const municipality = useStore(state => state.userMunicipality);
  const navigate = useNavigate();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Infrastrukturë');
  const [topicCategory, setTopicCategory] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  
  if (!isOpen) return null;
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      alert("Ju lutem kyçuni për të raportuar.");
      return;
    }
    
    // The server needs a municipality to route the report; this form has no
    // location picker, so it uses the one the citizen already chose.
    if (!isSpecificScope(municipality)) {
      alert("Zgjidhni komunën tuaj nga menyja e komunave para se të dërgoni një raportim të shpejtë.");
      return;
    }

    setIsSubmitting(true);
    try {
      let imageUrl = '';
      if (imageFile) {
        imageUrl = await uploadFileToStorage(imageFile, 'reports', { scope: 'quick' });
      }

      /*
       * Goes through the server like the full report form. This used to write
       * straight to Firestore with `status: 'Approved'`, which published the
       * report with no review at all; the rules (rightly) refuse that, so the
       * button only ever ended in an error. It also auto-created a public reel
       * from the unreviewed text, which was the same bypass by another route.
       */
      const response = await fetchWithTimeout('/api/v1/reports', {
        method: 'POST',
        headers: await authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          title,
          description,
          category,
          topicCategory,
          urgency: 'Mesatare',
          location: { municipality, address: '' },
          media: imageUrl ? [{ type: 'image', url: imageUrl }] : [],
          isAnonymous: false,
          authorName: currentUser.name,
        }),
      }, 35000);
      // Success means a stored report with a Track ID, nothing less: a static host
      // without the /api forward answers 200 with HTML.
      const body = isJsonResponse(response)
        ? await response.json().catch(() => null) as { id?: string; trackingId?: string; error?: string } | null
        : null;
      if (!response.ok || !body?.trackingId) {
        throw new Error(body?.error || 'Raportimi nuk u ruajt dhe nuk u krijua Track ID. Provoni përsëri ose përdorni formularin e plotë të raportimit.');
      }
      const trackingId = body.trackingId;
      saveGuestReportHistory({
        id: body.id || trackingId,
        trackingId,
        title,
        description,
        category,
        topicCategory,
        status: 'Pending Review',
        municipality,
        createdAt: new Date().toISOString(),
      });

      alert(`Raportimi u dërgua me sukses! Track ID: ${trackingId}\nRuajeni për ta ndjekur statusin.`);
      onClose();
      // Reset form
      setTitle('');
      setDescription('');
      setImageFile(null);
      setCategory('Infrastrukturë');
      setTopicCategory('');
      navigate(`/trackid?id=${encodeURIComponent(trackingId)}`);
    } catch (error) {
      console.error(error);
      alert(error instanceof Error && error.message ? error.message : "Pati një gabim gjatë dërgimit.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 md:backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={e => e.stopPropagation()}
          className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col"
        >
          <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-slate-800/50">
            <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-600" />{dt(`Raportim i Shpejtë`)}
            </h3>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-500 dark:text-slate-400 hover:bg-slate-200 rounded-xl transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[70vh]">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">{dt(`Titulli`)}</label>
                <input 
                  type="text" 
                  required 
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-white/10 focus:bg-white dark:bg-slate-900 focus:border-blue-500 rounded-xl px-4 py-2.5 outline-none transition"
                  placeholder={dt(`Çfarë problemi keni hasur?`)}
                />
              </div>
              
              <div>
                <label htmlFor="quick-report-topic" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">{dt('Kategoria e raportimit')}</label>
                <select
                  id="quick-report-topic"
                  required
                  value={topicCategory}
                  onChange={e => setTopicCategory(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-white/10 focus:bg-white dark:bg-slate-900 focus:border-blue-500 rounded-xl px-4 py-2.5 outline-none transition"
                >
                  <option value="">{dt('Zgjidhni temën kryesore')}</option>
                  {REPORT_TOPICS.map(topic => <option key={topic.id} value={topic.id}>{getReportTopicValueLabel(topic.id)}</option>)}
                </select>
              </div>

              <div>
                  <label htmlFor="quick-report-sector" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">{dt('Sektori / institucioni')}</label>
                  <select
                    id="quick-report-sector"
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-white/10 focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 rounded-xl px-4 py-2.5 outline-none transition"
                  >
                    <option>{dt('Infrastrukturë')}</option>
                    <option>{dt('Mbeturina')}</option>
                    <option>{dt('Trafik')}</option>
                    <option>{dt('Mjedis')}</option>
                    <option>{dt('Siguri')}</option>
                    <option>{dt('Tjetër')}</option>
                  </select>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">{dt(`Përshkrimi`)}</label>
                <textarea 
                  required 
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-white/10 focus:bg-white dark:bg-slate-900 focus:border-blue-500 rounded-xl px-4 py-2.5 outline-none transition resize-none"
                  placeholder={dt(`Jepni më shumë detaje...`)}
                ></textarea>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">{dt(`Foto (Opsionale)`)}</label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center justify-center gap-2 w-full h-12 bg-blue-50 border border-blue-200 border-dashed rounded-xl cursor-pointer hover:bg-blue-100 transition-colors">
                    <Camera className="w-5 h-5 text-blue-600" />
                    <span className="text-sm font-semibold text-blue-700">
                      {imageFile ? imageFile.name : 'Ngarko Foto'}
                    </span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={e => setImageFile(e.target.files?.[0] || null)}
                    />
                  </label>
                </div>
              </div>
              
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 p-3 rounded-xl">
                <MapPin className="w-4 h-4 shrink-0" />
                <span>{dt(`Për të shtuar lokacionin e saktë në hartë dhe më shumë detaje, përdorni formën e plotë të raportimit.`)}</span>
              </div>
            </div>
            
            <div className="mt-6 pt-5 border-t border-slate-100 dark:border-white/5 flex items-center justify-end gap-3">
              <button 
                type="button" 
                onClick={() => { onClose(); navigate('/raporto'); }}
                className="px-5 py-2.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50 dark:bg-slate-800 font-bold rounded-xl transition-colors text-sm"
              >{dt(`Forma e plotë`)}
              </button>
              <button 
                type="submit" 
                disabled={isSubmitting || !title || !description}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none text-sm"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}{dt(`Dërgo Raportin`)}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
