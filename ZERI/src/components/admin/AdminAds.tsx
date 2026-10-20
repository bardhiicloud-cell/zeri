import { dt } from '@/src/lib/dt';
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Megaphone, Target, BarChart2, Plus, Globe, MapPin, Eye, MousePointerClick, 
  TrendingUp, X, Search, CheckSquare, Square, ChevronLeft, ChevronRight, 
  Pause, Play, Trash2, Edit3, Check, Phone, Mail, MessageCircle, 
  Building2, Sparkles, DollarSign, Sliders, ExternalLink, Save, ArrowRight,
  Code, CheckCircle2, AlertCircle, Ruler, Handshake, Upload
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  AD_POSITION_SPECS, AD_MAX_BYTES, AD_ACCEPT, checkAdFile, formatMb,
  type AdFileCheck, type AdMediaKind,
} from '../../lib/adSpecs';
import { KOSOVO_MUNICIPALITIES } from '../../lib/constants';
import { collection, query, orderBy, onSnapshot, updateDoc, doc, deleteDoc, limit } from 'firebase/firestore';
import DecisionBar from './DecisionBar';
import { takeDecision } from '../../lib/decisionsApi';
import { db, uploadFileToStorage } from '../../lib/firebase';
import { useStore, AdCampaign } from '../../lib/store';
import { STAFF_LIMITS } from '../../lib/loadLimits';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

const AD_POSITION_LABELS: Record<string, string> = {
  top: 'Nën navigimin kryesor',
  article: 'Brenda artikullit',
  inline: 'Mes seksioneve të përmbajtjes',
  feed: 'Mes kartave në rrjedhë',
  sidebar: 'Kolona anësore',
  bottom: 'Kartë strategjike në fund të faqes',
  banner: 'Kartë strategjike në fund të faqes',
  floating: 'Kolona anësore (fushatë e vjetër)',
};

const AD_POSITION_HELP: Record<string, string> = {
  top: 'Shfaqet nën navigimin kryesor; ruhet si kartë e ulët dhe jo-penguese.',
  article: 'Shfaqet brenda faqes së lajmit, pas përmbajtjes hyrëse.',
  inline: 'Shfaqet mes seksioneve të faqes si kartë, pa mbivendosje.',
  feed: 'Shfaqet mes kartave ose rezultateve në rrjedhën kryesore.',
  sidebar: 'Shfaqet në kolonën anësore të desktopit; në faqe pa kolonë përdoret kartë në rrjedhë.',
  banner: 'Shfaqet si kartë strategjike në fund të faqeve që e kanë këtë hapësirë.',
};

const getAdPositionLabel = (position: string) => dt(AD_POSITION_LABELS[position] || position);

const EMPTY_FORM = {
  title: '',
  section: 'ballina',
  target: 'Nacionale',
  position: 'top' as string,
  mediaType: 'image' as 'image' | 'video' | 'html' | 'gif',
  mediaUrl: '',
  targetUrl: '',
  budget: '€100.00 / €500.00',
  intervalMinutes: 10,
  isPartner: false,
  partnerDescription: '',
};

/** Recommended sizes for one placement, shown beside every upload field. */
function AdSpecGuide({ position, mediaType }: { position: string; mediaType: string }) {
  const spec = AD_POSITION_SPECS[position];
  const kind: AdMediaKind = mediaType === 'gif' ? 'gif' : mediaType === 'video' ? 'video' : 'image';
  if (!spec) return null;
  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 text-xs text-blue-950 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-100">
      <div className="flex items-center gap-1.5 font-black uppercase tracking-wider text-[10px] text-blue-700 dark:text-blue-300">
        <Ruler className="h-3.5 w-3.5" aria-hidden="true" />
        {dt('Specifikimet e kreativit')}
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
        <div><dt className="text-[10px] text-blue-700/80 dark:text-blue-300/80">{dt('Ideale')}</dt><dd className="font-mono font-bold">{spec.ideal.w} × {spec.ideal.h} px</dd></div>
        <div><dt className="text-[10px] text-blue-700/80 dark:text-blue-300/80">{dt('Minimumi')}</dt><dd className="font-mono font-bold">{spec.min.w} × {spec.min.h} px</dd></div>
        <div><dt className="text-[10px] text-blue-700/80 dark:text-blue-300/80">{dt('Madhësia maks.')}</dt><dd className="font-mono font-bold">{formatMb(AD_MAX_BYTES[kind])}</dd></div>
        <div><dt className="text-[10px] text-blue-700/80 dark:text-blue-300/80">{dt('Formati')}</dt><dd className="font-bold">{kind === 'video' ? 'MP4 / WebM' : kind === 'gif' ? 'GIF' : 'JPG / PNG / WebP'}</dd></div>
      </dl>
      <p className="mt-2 leading-relaxed text-blue-900/80 dark:text-blue-200/80">
        {dt(spec.where)}. {kind === 'video'
          ? dt('Videoja luhet pa zë dhe priten skajet, prandaj mbani logon dhe tekstin në qendër. Maksimumi 30 sekonda.')
          : dt('Mbani logon dhe tekstin në qendër: në telefon skajet anësore priten automatikisht.')}
      </p>
    </div>
  );
}

export default function AdminAds() {
  const [activeTab, setActiveTab] = useState<'active' | 'create' | 'settings' | 'requests'>('active');
  const [adRequests, setAdRequests] = useState<any[]>([]);

  useEffect(() => {
    // Bounded: ad requests are unbounded by nature (every enquiry ever sent), so
    // the tab shows the most recent page rather than the whole archive.
    const q = query(
      collection(db, 'adRequests'),
      orderBy('createdAt', 'desc'),
      limit(STAFF_LIMITS.adRequests)
    );
    const unsub = onSnapshot(q, (snap) => {
      setAdRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.error("Error fetching ad requests:", err);
    });
    return unsub;
  }, []);

  const ads = useStore(state => state.ads);
  const createAd = useStore(state => state.createAd);
  const updateAd = useStore(state => state.updateAd);
  const deleteAd = useStore(state => state.deleteAd);
  const updateAdStatus = useStore(state => state.updateAdStatus);
  const systemSettings = useStore(state => state.systemSettings);
  const updateSystemSettings = useStore(state => state.updateSystemSettings);
  const currentUser = useStore(state => state.currentUser);

  const isReklamaAdmin = currentUser?.role === 'adsadmin' || currentUser?.role === 'admin';

  // Search & Municipality Targeting Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMunicipalityFilter, setSelectedMunicipalityFilter] = useState<string>('all');
  const [selectedSectionFilter, setSelectedSectionFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'active' | 'paused'>('all');

  // Pagination & Multi-select
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const itemsPerPage = 8;

  // Edit Ad Modal State
  const [editingAd, setEditingAd] = useState<AdCampaign | null>(null);

  // Settings for contact, free slot and AdSense.
  const [contactForm, setContactForm] = useState({
    adContactPhone: systemSettings?.adContactPhone || '+383 44 123 456',
    adWhatsApp: systemSettings?.adWhatsApp || '+38344123456',
    adContactEmail: systemSettings?.adContactEmail || 'reklama@qytetari.ks',
    adContactCompanyName: systemSettings?.adContactCompanyName || 'Platforma Qytetare Reklama',
    adSlogan: systemSettings?.adSlogan || 'Promovoni shërbimet tuaja në hapësirat e përshtatshme.',
    adSenseEnabled: systemSettings?.adSenseEnabled ?? false,
    adSenseClientId: systemSettings?.adSenseClientId || '',
    adSenseSlot: systemSettings?.adSenseSlot || '',
    adSenseCode: systemSettings?.adSenseCode || '',
    adFrequencyPosts: systemSettings?.adFrequencyPosts || 4,
    adFeedAlgorithm: systemSettings?.adFeedAlgorithm || 'smart'
  });

  const [settingsSaved, setSettingsSaved] = useState(false);

  useEffect(() => {
    if (systemSettings) {
      setContactForm({
        adContactPhone: systemSettings.adContactPhone || '+383 44 123 456',
        adWhatsApp: systemSettings.adWhatsApp || '+38344123456',
        adContactEmail: systemSettings.adContactEmail || 'reklama@qytetari.ks',
        adContactCompanyName: systemSettings.adContactCompanyName || 'Platforma Qytetare Reklama',
        adSlogan: systemSettings.adSlogan || 'Promovoni shërbimet tuaja në hapësirat e përshtatshme.',
        adSenseEnabled: systemSettings.adSenseEnabled ?? false,
        adSenseClientId: systemSettings.adSenseClientId || '',
        adSenseSlot: systemSettings.adSenseSlot || '',
        adSenseCode: systemSettings.adSenseCode || '',
        adFrequencyPosts: systemSettings.adFrequencyPosts || 4,
        adFeedAlgorithm: systemSettings.adFeedAlgorithm || 'smart'
      });
    }
  }, [systemSettings]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateSystemSettings(contactForm);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 3000);
  };

  // Create Form State
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [fileCheck, setFileCheck] = useState<AdFileCheck | null>(null);
  const [pendingRequest, setPendingRequest] = useState<{ id: string; businessName: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.mediaType !== 'html' && !formData.mediaUrl) {
      toast.error(dt('Ngarkoni një foto, GIF ose video përpara publikimit.'));
      return;
    }
    if (fileCheck && !fileCheck.ok) {
      toast.error(dt('Skedari nuk plotëson specifikimet e pozicionit. Ngarkoni një skedar tjetër.'));
      return;
    }

    // Firestore rejects `undefined` fields, so optional keys are only added when set.
    const payload: Omit<AdCampaign, 'id' | 'views' | 'clicks'> = {
      title: formData.title.trim(),
      section: formData.section,
      target: formData.target,
      position: formData.position,
      mediaType: formData.mediaType,
      mediaUrl: formData.mediaUrl,
      targetUrl: formData.targetUrl.trim() || '#',
      budget: formData.budget,
      status: 'active',
      isPartner: formData.isPartner,
      ...(formData.isPartner && formData.partnerDescription.trim()
        ? { partnerDescription: formData.partnerDescription.trim() }
        : {}),
      ...(formData.position === 'discussion' ? { intervalMinutes: formData.intervalMinutes } : {}),
      ...(pendingRequest ? { requestId: pendingRequest.id } : {}),
    };

    setSaving(true);
    const newId = await createAd(payload);
    setSaving(false);
    if (!newId) {
      toast.error(dt('Reklama nuk u publikua. Kontrolloni lidhjen dhe të drejtat e llogarisë.'));
      return;
    }

    if (pendingRequest) {
      // Closing the loop: the advertiser's request now points at the live campaign,
      // recorded as an approval decision with its author.
      try {
        await takeDecision('adRequest', pendingRequest.id, 'approve', { campaignId: newId });
      } catch (error) {
        toast.error(`${dt('Reklama u publikua, por kërkesa nuk u shënua e aprovuar:')} ${(error as Error).message}`);
      }
    }

    toast.success(dt('Reklama u publikua me sukses.'));
    setPendingRequest(null);
    setFileCheck(null);
    setFormData(EMPTY_FORM);
    setActiveTab('active');
  };

  /** Opens the create form pre-filled from an advertiser's request. */
  const startPublishFromRequest = (req: any) => {
    setPendingRequest({ id: req.id, businessName: req.businessName || req.name || 'Biznes' });
    setFormData({
      ...EMPTY_FORM,
      title: req.businessName || req.name || '',
      target: req.targetMunicipality && req.targetMunicipality !== 'Të gjitha Komunat' ? req.targetMunicipality : 'Nacionale',
      targetUrl: req.destinationUrl || '',
      partnerDescription: req.adNotes || '',
      isPartner: true,
    });
    setFileCheck(null);
    setActiveTab('create');
  };

  /** Checks the chosen file against the placement before anything is uploaded. */
  const handleFileChosen = async (file: File) => {
    const kind: AdMediaKind = formData.mediaType === 'gif' ? 'gif' : formData.mediaType === 'video' ? 'video' : 'image';
    const check = await checkAdFile(file, formData.position, kind);
    setFileCheck(check);
    if (!check.ok) {
      toast.error(check.errors[0]);
      return;
    }
    const tId = toast.loading(dt('Po ngarkohet skedari...'));
    try {
      const url = await uploadFileToStorage(file, 'reports', { scope: 'ads' });
      toast.dismiss(tId);
      toast.success(dt('U ngarkua me sukses.'));
      setFormData(prev => ({ ...prev, mediaUrl: url }));
    } catch (err) {
      toast.dismiss(tId);
      toast.error(err?.message || dt('Gabim gjatë ngarkimit të skedarit.'));
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAd) return;

    await updateAd(editingAd.id, {
      title: editingAd.title,
      section: editingAd.section,
      target: editingAd.target,
      position: editingAd.position,
      mediaType: editingAd.mediaType,
      mediaUrl: editingAd.mediaUrl,
      targetUrl: editingAd.targetUrl || '#',
      budget: editingAd.budget,
      status: editingAd.status,
      isPartner: Boolean(editingAd.isPartner),
      partnerDescription: (editingAd.partnerDescription || '').trim(),
    });

    toast.success(dt('Ndryshimet u ruajtën.'));
    setEditingAd(null);
  };

  // Count ads per municipality
  const municipalityCounts = useMemo(() => {
    const counts: Record<string, number> = { all: ads.length, Nacionale: 0 };
    KOSOVO_MUNICIPALITIES.forEach(m => { counts[m] = 0; });
    ads.forEach(ad => {
      if (ad.target === 'Nacionale') {
        counts.Nacionale = (counts.Nacionale || 0) + 1;
      } else if (counts[ad.target] !== undefined) {
        counts[ad.target] = (counts[ad.target] || 0) + 1;
      }
    });
    return counts;
  }, [ads]);

  // Filtered Ads with Municipality Granularity
  const filteredAds = useMemo(() => {
    let result = ads;
    
    if (isReklamaAdmin) {
      result = result.filter(ad => ad.section !== 'news');
    }

    // Filter by Municipality
    if (selectedMunicipalityFilter !== 'all') {
      result = result.filter(ad => ad.target === selectedMunicipalityFilter);
    }

    // Filter by Section
    if (selectedSectionFilter !== 'all') {
      result = result.filter(ad => ad.section === selectedSectionFilter);
    }

    // Filter by Status
    if (selectedStatusFilter !== 'all') {
      result = result.filter(ad => ad.status === selectedStatusFilter);
    }

    // Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(ad => 
        ad.title.toLowerCase().includes(q) || 
        ad.target.toLowerCase().includes(q) || 
        ad.position.toLowerCase().includes(q) ||
        (ad.section && ad.section.toLowerCase().includes(q))
      );
    }

    return result;
  }, [ads, selectedMunicipalityFilter, selectedSectionFilter, selectedStatusFilter, searchQuery, isReklamaAdmin]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredAds.length / itemsPerPage);
  const paginatedAds = filteredAds.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedAds.length && paginatedAds.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedAds.map(r => r.id)));
    }
  };

  const toggleSelectBlock = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleBulkAction = (action: 'active' | 'paused' | 'delete') => {
    if (!window.confirm(`A jeni të sigurt që dëshironi të kryeni këtë veprim për ${selectedIds.size} fushata?`)) return;
    
    selectedIds.forEach(id => {
      if (action === 'delete') {
        deleteAd(id);
      } else {
        updateAdStatus(id, action);
      }
    });
    setSelectedIds(new Set());
  };

  const totalViews = ads.reduce((acc, ad) => acc + (ad.views || 0), 0);
  const totalClicks = ads.reduce((acc, ad) => acc + (ad.clicks || 0), 0);
  const activeCount = ads.filter(a => a.status === 'active').length;

  return (
    <div className="space-y-6 max-w-full mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight title-serif flex items-center gap-3">
             <Megaphone className="w-8 h-8 text-rose-600 shrink-0" />
             <span>{dt(`Qendra e Menaxhimit të Reklamave (Ad-Tech)`)}</span>
          </h2>
          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
            {dt(`Menaxhoni fushatat sipas secilës komunë ndaras, krijoni lloje të reja reklamash dhe konfiguroni kontaktin e hapësirave të lira.`)}
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 w-full xl:w-auto">
          <button 
            onClick={() => setActiveTab('active')}
            className={cn(
              "flex-1 xl:flex-none px-4 py-2.5 text-xs sm:text-sm font-bold transition rounded-xl shadow-sm flex items-center justify-center gap-2", 
              activeTab === 'active' 
                ? "bg-slate-900 text-white dark:bg-rose-600" 
                : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-slate-800"
            )}
          >
            <BarChart2 className="w-4 h-4" />
            <span>{dt(`Fushatat (${ads.length})`)}</span>
          </button>

          <button 
            onClick={() => setActiveTab('create')}
            className={cn(
              "flex-1 xl:flex-none flex items-center justify-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold transition rounded-xl shadow-sm", 
              activeTab === 'create' 
                ? "bg-rose-600 text-white" 
                : "bg-white dark:bg-slate-900 text-rose-600 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/40"
            )}
          >
            <Plus className="w-4 h-4" />
            <span>{dt(`Krijo Reklamë`)}</span>
          </button>

          <button 
            onClick={() => setActiveTab('settings')}
            className={cn(
              "flex-1 xl:flex-none flex items-center justify-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold transition rounded-xl shadow-sm", 
              activeTab === 'settings' 
                ? "bg-slate-900 text-white dark:bg-rose-600" 
                : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-slate-800"
            )}
          >
            <Phone className="w-4 h-4 text-rose-500" />
            <span>{dt(`Kontakti & Hapësirat e Lira`)}</span>
          </button>

          <button 
            onClick={() => setActiveTab('requests')}
            className={cn(
              "flex-1 xl:flex-none flex items-center justify-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold transition rounded-xl shadow-sm", 
              activeTab === 'requests' 
                ? "bg-slate-900 text-white dark:bg-rose-600" 
                : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-slate-800"
            )}
          >
            <MessageCircle className="w-4 h-4" />
            <span>{dt(`Kërkesat (${adRequests.length})`)}</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'Shikime Totale', value: totalViews > 1000 ? `${(totalViews / 1000).toFixed(1)}K` : totalViews, icon: Eye, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/40', border: 'border-blue-200 dark:border-blue-900/40' },
          { label: 'Klikime Totale', value: totalClicks > 1000 ? `${(totalClicks / 1000).toFixed(1)}K` : totalClicks, icon: MousePointerClick, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/40', border: 'border-emerald-200 dark:border-emerald-900/40' },
          { label: 'Fushata Aktive', value: activeCount, icon: Megaphone, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-950/40', border: 'border-rose-200 dark:border-rose-900/40' },
          { label: 'Komuna me Reklama', value: Object.values(municipalityCounts).filter(c => c > 0).length, icon: MapPin, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-950/40', border: 'border-indigo-200 dark:border-indigo-900/40' },
        ].map((stat, i) => (
          <div key={i} className={cn("rounded-2xl p-4 sm:p-5 flex flex-col gap-1.5 shadow-sm border", stat.bg, stat.border)}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-black text-slate-500 dark:text-slate-400 tracking-wider">{dt(stat.label)}</span>
              <stat.icon className={cn("w-4 h-4", stat.color)} />
            </div>
            <p className={cn("text-xl sm:text-2xl font-black title-serif mt-1", stat.color)}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* TAB 1: ACTIVE ADS & MUNICIPALITY-SPECIFIC VIEW */}
      {activeTab === 'active' && (
        <div className="space-y-6">
          {/* Municipality Selector Ribbon */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/60 dark:border-white/10 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-rose-600" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  {dt(`Zgjidh Komunën për të filtruar reklamat ndaras:`)}
                </span>
              </div>
              <span className="text-[11px] font-bold text-slate-400">
                {selectedMunicipalityFilter === 'all' ? 'Të gjitha komunat' : selectedMunicipalityFilter} ({filteredAds.length} fushata)
              </span>
            </div>

            {/* Scrollable Municipality Badges */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 pt-1 hide-scrollbar">
              <button
                onClick={() => { setSelectedMunicipalityFilter('all'); setCurrentPage(1); }}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 shrink-0",
                  selectedMunicipalityFilter === 'all'
                    ? "bg-slate-900 text-white dark:bg-rose-600"
                    : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 text-slate-700"
                )}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>{dt(`Të Gjitha`)}</span>
                <span className="text-[10px] opacity-75 px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/10">{ads.length}</span>
              </button>

              <button
                onClick={() => { setSelectedMunicipalityFilter('Nacionale'); setCurrentPage(1); }}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 shrink-0",
                  selectedMunicipalityFilter === 'Nacionale'
                    ? "bg-rose-600 text-white"
                    : "bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 text-rose-700 border border-rose-200 dark:border-rose-900/40"
                )}
              >
                <span>{dt(`Nacionale (Kosovë)`)}</span>
                <span className="text-[10px] opacity-75 px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/10">
                  {municipalityCounts['Nacionale'] || 0}
                </span>
              </button>

              {KOSOVO_MUNICIPALITIES.map(m => {
                const count = municipalityCounts[m] || 0;
                const isSelected = selectedMunicipalityFilter === m;
                return (
                  <button
                    key={m}
                    onClick={() => { setSelectedMunicipalityFilter(m); setCurrentPage(1); }}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 shrink-0",
                      isSelected
                        ? "bg-rose-600 text-white shadow-sm"
                        : count > 0 
                          ? "bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200/80"
                          : "bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/60 dark:text-slate-400 text-slate-600 border border-slate-200/50 dark:border-white/5"
                    )}
                  >
                    <span>{m}</span>
                    {count > 0 && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-200/60 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-200 font-extrabold">
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search, Filter Bar & Bulk Actions */}
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-200/60 dark:border-white/10">
             <div className="relative w-full md:w-80">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder={dt(`Kërko fushata sipas titullit ose komunës...`)}
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-xs sm:text-sm outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-slate-900 dark:text-white"
                />
             </div>

             <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
               <select
                 value={selectedSectionFilter}
                 onChange={e => { setSelectedSectionFilter(e.target.value); setCurrentPage(1); }}
                 className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 outline-none"
               >
                 <option value="all">{dt(`Të gjitha Seksionet`)}</option>
                 <option value="ballina">{dt(`Ballina`)}</option>
                 <option value="raporto">{dt(`Raporto`)}</option>
                 <option value="raportimet">{dt(`Raportimet`)}</option>
                 <option value="harta">{dt(`Harta`)}</option>
                 <option value="sondazhet">{dt(`Sondazhet`)}</option>
                 <option value="numrat">{dt(`Numrat Kontaktues`)}</option>
                 <option value="donacione">{dt(`Donacionet`)}</option>
                 <option value="forum">{dt(`Debati Publik`)}</option>
                 <option value="idea">{dt(`Banka e Ideve`)}</option>
                 <option value="lajme">{dt(`Lajmet`)}</option>
                 <option value="shendetesia">{dt(`Regjistri Shëndetësor`)}</option>
                 <option value="statistikat">{dt(`Statistikat`)}</option>
                 <option value="komunat">{dt(`Komunat`)}</option>
                 <option value="sherbimet">{dt(`Shërbimet`)}</option>
                 <option value="ndihma">{dt(`Qendra e Ndihmës`)}</option>
                 <option value="rreth-projektit">{dt(`Rreth Projektit`)}</option>
                 <option value="kontakt">{dt(`Kontakt`)}</option>
               </select>

               <select
                 value={selectedStatusFilter}
                 onChange={e => { setSelectedStatusFilter(e.target.value as any); setCurrentPage(1); }}
                 className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 outline-none"
               >
                 <option value="all">{dt(`Gjendja: Të gjitha`)}</option>
                 <option value="active">{dt(`Vetëm Aktive`)}</option>
                 <option value="paused">{dt(`Vetëm Në Pauzë`)}</option>
               </select>

               {selectedIds.size > 0 && (
                 <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200 dark:border-white/10">
                   <button
                     onClick={() => handleBulkAction('active')}
                     className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold transition-colors"
                     title="Aktivizo të zgjedhurat"
                   >
                     <Play className="w-3.5 h-3.5 inline mr-1" />{dt(`Aktivizo`)}
                   </button>
                   <button
                     onClick={() => handleBulkAction('paused')}
                     className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-xs font-bold transition-colors"
                     title="Pauzo të zgjedhurat"
                   >
                     <Pause className="w-3.5 h-3.5 inline mr-1" />{dt(`Pauzo`)}
                   </button>
                   <button
                     onClick={() => handleBulkAction('delete')}
                     className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold transition-colors"
                     title="Fshi të zgjedhurat"
                   >
                     <Trash2 className="w-3.5 h-3.5 inline mr-1" />{dt(`Fshi`)}
                   </button>
                 </div>
               )}
             </div>
          </div>

          {/* Ads Data Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
                <thead className="bg-slate-50 dark:bg-slate-800 text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200/60 dark:border-white/10">
                  <tr>
                    <th className="px-4 py-3.5 w-10">
                      <button onClick={toggleSelectAll} className="flex items-center text-slate-400 hover:text-slate-600">
                        {selectedIds.size > 0 && selectedIds.size === paginatedAds.length ? (
                          <CheckSquare className="w-4 h-4 text-rose-600" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3.5">{dt(`Reklama & Titulli`)}</th>
                    <th className="px-4 py-3.5">{dt(`Komuna (Targetimi)`)}</th>
                    <th className="px-4 py-3.5">{dt(`Pozicioni & Rubrika`)}</th>
                    <th className="px-4 py-3.5">{dt(`Statistika`)}</th>
                    <th className="px-4 py-3.5">{dt(`Statusi`)}</th>
                    <th className="px-4 py-3.5 text-right">{dt(`Veprime`)}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  <AnimatePresence>
                    {paginatedAds.map((ad) => {
                      const isSelected = selectedIds.has(ad.id);
                      return (
                        <motion.tr
                          key={ad.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className={cn("hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors", isSelected && "bg-rose-50/40 dark:bg-rose-950/20")}
                        >
                          <td className="px-4 py-3 align-middle">
                            <button onClick={() => toggleSelectBlock(ad.id)} className="flex items-center text-slate-400 hover:text-slate-600">
                              {isSelected ? <CheckSquare className="w-4 h-4 text-rose-600" /> : <Square className="w-4 h-4" />}
                            </button>
                          </td>

                          {/* Ad Preview & Info */}
                          <td className="px-4 py-3 align-middle">
                            <div className="flex items-center gap-3">
                              <div className="w-16 h-10 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 border border-slate-200/60 dark:border-white/10 relative">
                                {(ad.mediaType === 'image' || ad.mediaType === 'gif') && (
                                  <img src={ad.mediaUrl} alt={ad.title} className="w-full h-full object-cover" />
                                )}
                                {ad.mediaType === 'video' && (
                                  <video src={ad.mediaUrl} className="w-full h-full object-cover" muted />
                                )}
                                {ad.mediaType === 'html' && (
                                  <div className="w-full h-full flex items-center justify-center text-[9px] font-mono text-slate-400 font-bold">HTML</div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate max-w-xs leading-tight">
                                  {ad.title}
                                  {ad.isPartner && (
                                    <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 align-middle text-[9px] font-black uppercase text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                      <Handshake className="h-2.5 w-2.5" aria-hidden="true" />{dt('Partner')}
                                    </span>
                                  )}
                                </h4>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10px] text-slate-400 font-mono">ID: {ad.id}</span>
                                  {ad.targetUrl && (
                                    <a href={ad.targetUrl} target="_blank" rel="noreferrer" className="text-[10px] text-rose-600 hover:underline flex items-center gap-0.5">
                                      <ExternalLink className="w-2.5 h-2.5" />{dt(`Linku`)}
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Municipality Target */}
                          <td className="px-4 py-3 align-middle">
                            <span className={cn(
                              "inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-xl",
                              ad.target === 'Nacionale'
                                ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200/80"
                                : "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/80"
                            )}>
                              <MapPin className="w-3 h-3" />
                              <span>{ad.target}</span>
                            </span>
                          </td>

                          {/* Position & Section */}
                          <td className="px-4 py-3 align-middle">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 capitalize">
                                {getAdPositionLabel(ad.position)}
                              </span>
                              <span className="text-[11px] text-slate-400 font-medium">
                                Rubrika: {ad.section || 'global'}
                              </span>
                            </div>
                          </td>

                          {/* Stats */}
                          <td className="px-4 py-3 align-middle">
                            <div className="flex items-center gap-3 text-xs">
                              <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300 font-semibold" title="Shikime">
                                <Eye className="w-3.5 h-3.5 text-slate-400" />
                                {ad.views || 0}
                              </span>
                              <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300 font-semibold" title="Klikime">
                                <MousePointerClick className="w-3.5 h-3.5 text-slate-400" />
                                {ad.clicks || 0}
                              </span>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3 align-middle">
                            <span className={cn(
                              "text-[10px] font-black uppercase px-2 py-0.5 rounded-full inline-flex items-center gap-1",
                              ad.status === 'active'
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                            )}>
                              <span className={cn("w-1.5 h-1.5 rounded-full", ad.status === 'active' ? "bg-emerald-600" : "bg-amber-600")} />
                              {ad.status === 'active' ? 'Aktive' : 'Në Pauzë'}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3 text-right align-middle">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Edit Button */}
                              <button
                                onClick={() => setEditingAd(ad)}
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-slate-600 dark:text-slate-300 transition-colors"
                                title={dt(`Ndrysho Detajet e Reklamës`)}
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              {/* Toggle Active/Paused */}
                              {ad.status === 'active' ? (
                                <button
                                  onClick={() => updateAdStatus(ad.id, 'paused')}
                                  className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-xl transition-colors"
                                  title={dt(`Pauzo`)}
                                >
                                  <Pause className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => updateAdStatus(ad.id, 'active')}
                                  className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-xl transition-colors"
                                  title={dt(`Aktivizo`)}
                                >
                                  <Play className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Delete */}
                              <button
                                onClick={() => { if (confirm('A jeni të sigurt që dëshironi ta fshini këtë reklamë?')) deleteAd(ad.id); }}
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-colors"
                                title={dt(`Fshi`)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>

                  {paginatedAds.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-16 text-center">
                        <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                          <Megaphone className="w-6 h-6 text-slate-400" />
                        </div>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{dt(`Nuk u gjet asnjë reklamë për këtë filtër.`)}</p>
                        <p className="text-xs text-slate-400 mt-1">{dt(`Provoni të zgjidhni një komunë tjetër ose krijoni një reklamë të re.`)}</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="px-6 py-3.5 border-t border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-slate-800 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">
                  {dt(`Duke shfaqur`)} {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredAds.length)} {dt(`nga`)} {filteredAds.length}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-200 disabled:opacity-40 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-bold text-slate-900 dark:text-white px-2">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-200 disabled:opacity-40 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: CREATE AD WITH RICH TYPES & MUNICIPALITY SELECTION */}
      {activeTab === 'create' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-2xl p-6 sm:p-8 shadow-sm max-w-4xl mx-auto">
          <div className="border-b border-slate-100 dark:border-white/5 pb-4 mb-6">
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight title-serif flex items-center gap-2">
              <Plus className="w-6 h-6 text-rose-600" />
              <span>{dt(`Krijo Reklamë të Re me Shënjestrim Komunal`)}</span>
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              {dt(`Përcaktoni saktësisht në cilën komunë do të shfaqet reklama, pozicionin në faqe dhe formatin e medias.`)}
            </p>
          </div>

          {pendingRequest && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <p>
                <strong>{dt('Po aprovoni kërkesën e')} {pendingRequest.businessName}.</strong>{' '}
                {dt('Ngarkoni kreativin sipas dimensioneve më poshtë. Pas publikimit kërkesa shënohet si e aprovuar.')}
              </p>
            </div>
          )}

          <form onSubmit={handleCreateSubmit} className="space-y-6">
            {/* Step 1: Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  {dt(`1. Titulli i Fushatës / Emri i Biznesit *`)}
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder={dt(`psh. Auto Servis Prishtina - Ofertë Speciale`)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-sm outline-none focus:border-rose-500 focus:bg-white text-slate-900 dark:text-white transition font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  {dt(`2. Linku i Drejtimit (Target URL)`)}
                </label>
                <input
                  type="url"
                  value={formData.targetUrl}
                  onChange={e => setFormData({ ...formData, targetUrl: e.target.value })}
                  placeholder={dt(`https://biznesi-juaj.com ose linku i rrjeteve sociale`)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-sm outline-none focus:border-rose-500 focus:bg-white text-slate-900 dark:text-white transition font-medium"
                />
              </div>
            </div>

            {/* Step 2: Municipality Targeting & Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-rose-600" />
                  <span>{dt(`3. Shënjestrimi Komunal (Ku do të shfaqet) *`)}</span>
                </label>
                <select
                  value={formData.target}
                  onChange={e => setFormData({ ...formData, target: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-sm outline-none focus:border-rose-500 text-slate-900 dark:text-white transition font-medium"
                >
                  <option value="Nacionale">{dt(`⭐ Shtrirje Nacionale (Të gjitha Komunat)`)}</option>
                  <optgroup label={dt(`Komunat Specifike të Kosovës:`)}>
                    {KOSOVO_MUNICIPALITIES.map(m => (
                       <option key={m} value={m}>{m}</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  {dt(`4. Rubrika / Faqja në Website *`)}
                </label>
                <select
                  value={formData.section}
                  onChange={e => setFormData({ ...formData, section: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-sm outline-none focus:border-rose-500 text-slate-900 dark:text-white transition font-medium"
                >
                  <option value="all">{dt(`🌐 Në të gjithë Website (Global)`)}</option>
                  <option value="ballina">{dt(`Ballina (Kreu Kryesor)`)}</option>
                  <option value="raporto">{dt(`Faqja e Raportimit`)}</option>
                  <option value="raportimet">{dt(`Regjistri i Raportimeve`)}</option>
                  <option value="harta">{dt(`Harta e Qytetit`)}</option>
                  <option value="sondazhet">{dt(`Sondazhet Qytetare`)}</option>
                  <option value="numrat">{dt(`Numrat Kontaktues & Urgjenca`)}</option>
                  <option value="donacione">{dt(`Fushata e Donacioneve`)}</option>
                  <option value="shendetesia">{dt(`Regjistri Shëndetësor`)}</option>
                  <option value="lajme">{dt(`Lajmet & Njoftimet`)}</option>
                  <option value="forum">{dt(`Debati Publik`)}</option>
                  <option value="idea">{dt(`Banka e Ideve`)}</option>
                  <option value="statistikat">{dt(`Statistikat & Analiza`)}</option>
                  <option value="komunat">{dt(`Komunat e Kosovës`)}</option>
                  <option value="sherbimet">{dt(`Shërbimet Publike`)}</option>
                  <option value="ndihma">{dt(`Qendra e Ndihmës`)}</option>
                  <option value="rreth-projektit">{dt(`Rreth Projektit`)}</option>
                  <option value="kontakt">{dt(`Kontakt`)}</option>
                </select>
                <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                  {dt('Fushata shfaqet vetëm në rubrikën e zgjedhur. Zgjidhni Global për ta vendosur në të gjitha rubrikat ku ka hapësirë përkatëse.')}
                </p>
              </div>
            </div>

            {/* Step 3: Position & Media Format */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  {dt(`5. Pozicioni Vizual i Reklamës *`)}
                </label>
                <select 
                  value={formData.position} 
                  onChange={e => { setFormData({ ...formData, position: e.target.value as any }); setFileCheck(null); }} 
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-sm outline-none focus:border-rose-500 text-slate-900 dark:text-white transition font-medium"
                >
                  <option value="top">{getAdPositionLabel('top')}</option>
                  <option value="article">{getAdPositionLabel('article')}</option>
                  <option value="inline">{getAdPositionLabel('inline')}</option>
                  <option value="feed">{getAdPositionLabel('feed')}</option>
                  <option value="sidebar">{getAdPositionLabel('sidebar')}</option>
                  <option value="banner">{getAdPositionLabel('banner')}</option>
                </select>
                <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{dt(AD_POSITION_HELP[formData.position] || '')}</p>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  {dt(`6. Formati i Medias *`)}
                </label>
                <select
                  value={formData.mediaType}
                  onChange={e => { setFormData({ ...formData, mediaType: e.target.value as any, mediaUrl: '' }); setFileCheck(null); }}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-sm outline-none focus:border-rose-500 text-slate-900 dark:text-white transition font-medium"
                >
                  <option value="image">{dt(`Imazh (JPG / PNG / WebP)`)}</option>
                  <option value="video">{dt(`Video (MP4 / WebM)`)}</option>
                  <option value="gif">{dt(`GIF e animuar`)}</option>
                  <option value="html">{dt(`HTML / JavaScript Banner Custom`)}</option>
                </select>
              </div>
            </div>

            {/* Media Upload & URL Input */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                {dt(`7. Skedari i Reklamës (Ngarko Foto/Video ose Vendos URL) *`)}
              </label>

              <div className="space-y-3">
                {formData.mediaType !== 'html' && (
                  <AdSpecGuide position={formData.position} mediaType={formData.mediaType} />
                )}

                {formData.mediaType !== 'html' && (
                  <label className="relative block border-2 border-dashed border-slate-200 dark:border-white/10 rounded-xl p-6 text-center bg-slate-50 dark:bg-slate-800/50 hover:border-rose-300 hover:bg-rose-50/40 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                    <input
                      type="file"
                      accept={AD_ACCEPT[formData.mediaType === 'gif' ? 'gif' : formData.mediaType === 'video' ? 'video' : 'image']}
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleFileChosen(file);
                        e.target.value = '';
                      }}
                    />
                    <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center mx-auto mb-2">
                      <Upload className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                      {formData.mediaType === 'video' ? dt('Ngarko videon nga pajisja') : formData.mediaType === 'gif' ? dt('Ngarko GIF-in nga pajisja') : dt('Ngarko foton nga pajisja')}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 block">
                      {dt('Dimensionet kontrollohen automatikisht para ngarkimit.')}
                    </span>
                  </label>
                )}

                {fileCheck && (fileCheck.errors.length > 0 || fileCheck.warnings.length > 0 || fileCheck.width) && (
                  <div
                    className={cn(
                      'rounded-xl border p-3 text-xs',
                      fileCheck.ok
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200'
                        : 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200'
                    )}
                    role="status"
                  >
                    {fileCheck.width && (
                      <p className="font-bold">
                        {fileCheck.ok ? <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" /> : <AlertCircle className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />}
                        {dt('Skedari')}: {fileCheck.width} × {fileCheck.height} px{fileCheck.durationSeconds ? ` · ${fileCheck.durationSeconds}s` : ''}
                      </p>
                    )}
                    {[...fileCheck.errors, ...fileCheck.warnings].map((msg) => (
                      <p key={msg} className="mt-1">{dt(msg)}</p>
                    ))}
                  </div>
                )}

                {formData.mediaUrl && formData.mediaType !== 'html' && (
                  <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
                    <div className="bg-slate-100 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      {dt('Parapamja')}
                    </div>
                    {formData.mediaType === 'video' ? (
                      <video src={formData.mediaUrl} muted playsInline controls className="max-h-56 w-full bg-black object-contain" />
                    ) : (
                      <img src={formData.mediaUrl} alt="" className="max-h-56 w-full bg-slate-50 object-contain dark:bg-slate-900" />
                    )}
                  </div>
                )}

                <details className="text-xs text-slate-500 dark:text-slate-400">
                  <summary className="cursor-pointer font-bold">{formData.mediaType === 'html' ? dt('Kodi HTML i banerit') : dt('Ose vendos një URL ekzistuese')}</summary>
                  <input
                    type="text"
                    value={formData.mediaUrl}
                    onChange={e => setFormData({ ...formData, mediaUrl: e.target.value })}
                    placeholder={formData.mediaType === 'html' ? dt(`<div>... kodi HTML këtu ...</div>`) : 'https://'}
                    className="mt-2 w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl outline-none focus:border-rose-500 text-slate-900 dark:text-white font-mono text-xs"
                  />
                </details>
              </div>
            </div>

            {/* Partner listing */}
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={formData.isPartner}
                  onChange={e => setFormData({ ...formData, isPartner: e.target.checked })}
                  className="mt-0.5 h-4 w-4 accent-amber-600"
                />
                <span>
                  <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-amber-900 dark:text-amber-200">
                    <Handshake className="h-4 w-4" aria-hidden="true" />
                    {dt('8. Shfaqe si partner në faqen "Partnerët"')}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-amber-800/80 dark:text-amber-300/80">
                    {dt('Partneri merr një kartë me logo, përshkrim dhe link në faqen publike të partnerëve.')}
                  </span>
                </span>
              </label>
              {formData.isPartner && (
                <div className="mt-3">
                  <textarea
                    rows={3}
                    maxLength={280}
                    value={formData.partnerDescription}
                    onChange={e => setFormData({ ...formData, partnerDescription: e.target.value })}
                    placeholder={dt('Përshkrim i shkurtër profesional i partnerit: çfarë ofron dhe si u shërben qytetarëve.')}
                    className="w-full rounded-xl border border-amber-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-amber-500 dark:border-amber-900/50 dark:bg-slate-900 dark:text-white"
                  />
                  <p className="mt-1 text-right text-[10px] text-amber-800/70 dark:text-amber-300/70">{formData.partnerDescription.length}/280</p>
                </div>
              )}
            </div>

            {/* Submit & Cancel */}
            <div className="pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => { setActiveTab('active'); setPendingRequest(null); setFileCheck(null); setFormData(EMPTY_FORM); }}
                className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                {dt(`Anulo`)}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-black tracking-wide uppercase shadow-sm transition active:scale-95"
              >
                {saving ? dt('Po publikohet...') : pendingRequest ? dt('Aprovo dhe publiko') : dt(`Publiko Reklamën`)}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: CONTACT INFO & FREE AD SLOTS SETTINGS (The user's direct request) */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Settings Form */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="border-b border-slate-100 dark:border-white/5 pb-4">
              <div className="flex items-center gap-2 text-rose-600 text-xs font-black uppercase tracking-wider mb-1">
                <Sparkles className="w-4 h-4" />
                <span>{dt(`Konfigurimi i Hapësirave Reklamuese të Lira`)}</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white title-serif tracking-tight">
                {dt(`Kontakti i Firmës / Adminit në Hapësirat e Lira`)}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                {dt(`Kur nuk ka reklamë aktive në një pozicion, sistemi shfaq automatikisht hapësirën reklamuese me të dhënat tuaja të kontaktit, në mënyrë që bizneset të dinë se është e lirë dhe t'ju kontaktojnë menjëherë.`)}
              </p>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-rose-600" />
                  <span>{dt(`Numri i Telefonit të Firmës / Adminit *`)}</span>
                </label>
                <input
                  type="text"
                  required
                  value={contactForm.adContactPhone}
                  onChange={e => setContactForm({ ...contactForm, adContactPhone: e.target.value })}
                  placeholder={dt(`psh. +383 44 123 456`)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-sm outline-none focus:border-rose-500 text-slate-900 dark:text-white font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{dt(`Numri i WhatsApp për Porosi të Shpejta *`)}</span>
                </label>
                <input
                  type="text"
                  required
                  value={contactForm.adWhatsApp}
                  onChange={e => setContactForm({ ...contactForm, adWhatsApp: e.target.value })}
                  placeholder={dt(`psh. +383 44 123 456`)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-sm outline-none focus:border-rose-500 text-slate-900 dark:text-white font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-blue-600" />
                  <span>{dt(`Email për Marketing / Reklama *`)}</span>
                </label>
                <input
                  type="email"
                  required
                  value={contactForm.adContactEmail}
                  onChange={e => setContactForm({ ...contactForm, adContactEmail: e.target.value })}
                  placeholder={dt(`psh. reklama@qytetari.ks`)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-sm outline-none focus:border-rose-500 text-slate-900 dark:text-white font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-700 dark:text-slate-300" />
                  <span>{dt(`Emri i Firmës / Zyrës së Reklamave *`)}</span>
                </label>
                <input
                  type="text"
                  required
                  value={contactForm.adContactCompanyName}
                  onChange={e => setContactForm({ ...contactForm, adContactCompanyName: e.target.value })}
                  placeholder={dt(`psh. Zyra e Marketingut & Reklamave Digjitale`)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-sm outline-none focus:border-rose-500 text-slate-900 dark:text-white font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-rose-600" />
                  <span>{dt(`Slogani Promovues / Mesazhi për Bizneset e Interesuara *`)}</span>
                </label>
                <textarea
                  rows={2}
                  value={contactForm.adSlogan}
                  onChange={e => setContactForm({ ...contactForm, adSlogan: e.target.value })}
                  placeholder={dt(`psh. Arritni mijëra qytetarë dhe konsumatorë aktivë në komunën tuaj me shikueshmëri maksimale`)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-sm outline-none focus:border-rose-500 text-slate-900 dark:text-white font-medium"
                />
              </div>

              {/* GOOGLE ADSENSE & SCRIPT ADS */}
              <div className="pt-4 border-t border-slate-200 dark:border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Code className="w-4 h-4 text-blue-600" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                      {dt(`Google AdSense & Reklama me Skript`)}
                    </h4>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      {contactForm.adSenseEnabled ? dt('E Aktivizuar') : dt('E Çaktivizuar')}
                    </span>
                    <input
                      type="checkbox"
                      checked={contactForm.adSenseEnabled}
                      onChange={e => setContactForm({ ...contactForm, adSenseEnabled: e.target.checked })}
                      className="w-4 h-4 accent-blue-600 rounded"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                      {dt(`AdSense Client ID (ca-pub-...)`)}
                    </label>
                    <input
                      type="text"
                      value={contactForm.adSenseClientId}
                      onChange={e => setContactForm({ ...contactForm, adSenseClientId: e.target.value })}
                      placeholder="ca-pub-1234567890123456"
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-mono outline-none focus:border-blue-500 text-slate-900 dark:text-white font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                      {dt(`Ad Slot ID`)}
                    </label>
                    <input
                      type="text"
                      value={contactForm.adSenseSlot}
                      onChange={e => setContactForm({ ...contactForm, adSenseSlot: e.target.value })}
                      placeholder="9876543210"
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-mono outline-none focus:border-blue-500 text-slate-900 dark:text-white font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    {dt(`Kodi Skript AdSense / HTML i Personalizuar (Opsionale)`)}
                  </label>
                  <textarea
                    rows={2}
                    value={contactForm.adSenseCode}
                    onChange={e => setContactForm({ ...contactForm, adSenseCode: e.target.value })}
                    placeholder="<script async src='https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js'></script>..."
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-mono outline-none focus:border-blue-500 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                      {dt(`Frekuenca në Feed të Debatit Publik`)}
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">{dt(`Shfaq reklamë çdo`)}</span>
                      <input
                        type="number"
                        min={2}
                        max={20}
                        value={contactForm.adFrequencyPosts}
                        onChange={e => setContactForm({ ...contactForm, adFrequencyPosts: parseInt(e.target.value) || 4 })}
                        className="w-20 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-center font-bold text-slate-900 dark:text-white"
                      />
                      <span className="text-xs text-slate-500">{dt(`postime`)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between">
                {settingsSaved ? (
                  <span className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
                    <Check className="w-4 h-4" />
                    {dt(`Cilësimet u ruajtën me sukses!`)}
                  </span>
                ) : <div />}

                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-rose-600 text-white text-xs font-black tracking-wider uppercase transition shadow-sm flex items-center gap-2 active:scale-95"
                >
                  <Save className="w-4 h-4" />
                  <span>{dt(`Ruaj Ndryshimet`)}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Live Preview Panel */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-slate-100 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/80 dark:border-white/10">
              <div className="flex items-center gap-2 mb-3">
                <Eye className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  {dt(`Parapamje e Drejtpërdrejtë e Hapësirës së Lirë:`)}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4">
                {dt(`Kështu shfaqet për qytetarët kur ky vend është i lirë për rezervim:`)}
              </p>

              {/* Mock Ad Banner Fallback Render */}
              <div className="border border-slate-200 dark:border-white/10 bg-slate-900 text-white rounded-2xl p-5 relative overflow-hidden shadow-lg">
                <div className="absolute top-0 right-0 bg-rose-600 text-white px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-bl-xl flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-rose-200" />
                  <span>{dt(`Hapësirë e Lirë Reklamuese`)}</span>
                </div>

                <div className="flex items-start gap-3 pt-2">
                  <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 text-rose-400 flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-extrabold text-rose-400 uppercase tracking-widest block">
                      {dt(`VENDI I REKLAMËS SUAJ`)}
                    </span>
                    <h4 className="text-sm font-black text-white tracking-tight leading-snug mt-0.5">
                      {contactForm.adContactCompanyName}
                    </h4>
                    <p className="text-xs text-slate-300 font-medium mt-1">
                      {contactForm.adSlogan}
                    </p>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <a
                        href={`tel:${contactForm.adContactPhone.replace(/\s+/g, '')}`}
                        className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm"
                      >
                        <Phone className="w-3.5 h-3.5 text-white" />
                        <span>{contactForm.adContactPhone}</span>
                      </a>
                      <span className="px-3 py-2 bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5">
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                        <span>WhatsApp</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Tips */}
            <div className="bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 p-4 rounded-2xl">
              <h4 className="text-xs font-black uppercase tracking-wider text-amber-800 dark:text-amber-300 mb-1.5 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>{dt(`Si Funksionon Shënjestrimi?`)}</span>
              </h4>
              <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed font-medium">
                {dt(`Kur një qytetar zgjedh komunën e tij në faqe (psh. Prishtinë), sistemi automatikisht kërkon nëse ka ndonjë reklamë të dedikuar për Prishtinë. Nëse po, shfaqet reklama e Prishtinës. Nëse jo, shfaqen reklamat Nacionale, ose kjo hapësirë e lirë me numrin tuaj të telefonit.`)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: AD REQUESTS FROM CITIZENS */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/60 dark:border-white/10 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                {dt(`Kërkesat për Reklamim nga Përdoruesit & Bizneset`)}
              </h3>
              <span className="text-xs font-bold text-slate-500">
                {adRequests.length} {dt(`kërkesa gjithsej`)}
              </span>
            </div>

            <div className="space-y-3">
              {adRequests.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="font-bold text-sm">{dt(`Nuk ka kërkesa të reja për reklamim.`)}</p>
                </div>
              ) : (
                adRequests.map(req => {
                  const status = req.status || 'pending';
                  const statusLabel = status === 'payment_confirmed' ? 'Pagesa e konfirmuar'
                    : status === 'approved' ? 'Aprovuar'
                    : status === 'rejected' ? 'Refuzuar'
                    : status === 'completed' ? 'Përfunduar'
                    : 'Në shqyrtim';
                  const statusStyle = status === 'approved' || status === 'completed'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : status === 'payment_confirmed'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
                      : status === 'rejected'
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300';
                  return (
                    <div key={req.id} className="p-4 border border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-slate-900 dark:text-white">
                          {req.businessName || req.userName || [req.name, req.surname].filter(Boolean).join(' ') || 'Biznes i paregjistruar'}
                          <span className="text-xs font-normal text-slate-500 dark:text-slate-400 ml-2">
                            ({req.contactEmail || req.userEmail || 'Pa email'} • {req.contactPhone || req.userPhone || req.phone || 'Pa telefon'})
                          </span>
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                          {req.packageName || 'Kërkesë promovimi'} · {req.packagePrice || ''} · {req.targetMunicipality || 'Kosova'} · {dt('Postimi:')} <strong>{req.postId || req.targetAuthorName || 'I përgjithshëm'}</strong>
                        </p>
                        <span className={cn('mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase', statusStyle)}>{statusLabel}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {(status === 'pending' || status === 'payment_confirmed') && <button type="button" onClick={() => startPublishFromRequest(req)} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-800">{dt('Aprovo dhe ngarko kreativin')}</button>}
                        {/* Approval happens by building the campaign (above); the rest are plain decisions. */}
                        <DecisionBar kind="adRequest" id={req.id} doc={req} hideActions={['approve']} />
                        <button
                          type="button"
                          onClick={async () => {
                            if (confirm('A dëshironi ta fshini këtë kërkesë?')) await deleteDoc(doc(db, 'adRequests', req.id));
                          }}
                          className="rounded-lg px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700"
                        >Fshi</button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL FOR QUICK CHANGES */}
      {editingAd && (
        <div className="fixed inset-0 z-50 bg-black/60 md:backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 dark:border-white/10 space-y-5 my-8"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
              <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-rose-600" />
                <span>{dt(`Ndrysho Reklamën`)} ({editingAd.id})</span>
              </h3>
              <button onClick={() => setEditingAd(null)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  {dt(`Titulli i Reklamës`)}
                </label>
                <input
                  type="text"
                  required
                  value={editingAd.title}
                  onChange={e => setEditingAd({ ...editingAd, title: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-medium text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    {dt(`Targetimi Komunal`)}
                  </label>
                  <select
                    value={editingAd.target}
                    onChange={e => setEditingAd({ ...editingAd, target: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                  >
                    <option value="Nacionale">{dt(`Nacionale (Të gjitha)`)}</option>
                    {KOSOVO_MUNICIPALITIES.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    {dt(`Pozicioni`)}
                  </label>
                  <select
                    value={editingAd.position}
                    onChange={e => setEditingAd({ ...editingAd, position: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                  >
                    <option value="top">{getAdPositionLabel('top')}</option>
                    <option value="article">{getAdPositionLabel('article')}</option>
                    <option value="inline">{getAdPositionLabel('inline')}</option>
                    <option value="feed">{getAdPositionLabel('feed')}</option>
                    <option value="sidebar">{getAdPositionLabel('sidebar')}</option>
                    <option value="banner">{getAdPositionLabel('banner')}</option>
                    {editingAd.position === 'bottom' && <option value="bottom">{dt('Pozicion i vjetër, shfaqet si kartë strategjike')}</option>}
                    {editingAd.position === 'floating' && <option value="floating">{dt('Fushatë e vjetër, shfaqet në kolonën anësore')}</option>}
                  </select>
                  <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">{dt(AD_POSITION_HELP[editingAd.position] || 'Ky pozicion i vjetër do të shfaqet në hapësirën anësore të faqes.')}</p>
                </div>
              </div>

              {editingAd.mediaType !== 'html' && (
                <AdSpecGuide position={editingAd.position} mediaType={editingAd.mediaType} />
              )}

              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
                <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-200">
                  <input
                    type="checkbox"
                    checked={Boolean(editingAd.isPartner)}
                    onChange={e => setEditingAd({ ...editingAd, isPartner: e.target.checked })}
                    className="h-4 w-4 accent-amber-600"
                  />
                  <Handshake className="h-4 w-4" aria-hidden="true" />
                  {dt('Shfaqe si partner në faqen "Partnerët"')}
                </label>
                {editingAd.isPartner && (
                  <textarea
                    rows={3}
                    maxLength={280}
                    value={editingAd.partnerDescription || ''}
                    onChange={e => setEditingAd({ ...editingAd, partnerDescription: e.target.value })}
                    placeholder={dt('Përshkrim i shkurtër profesional i partnerit')}
                    className="mt-2 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs text-slate-900 dark:border-amber-900/50 dark:bg-slate-900 dark:text-white"
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  {dt(`URL e Medias (Foto / Video)`)}
                </label>
                <input 
                  type="text" 
                  value={editingAd.mediaUrl} 
                  onChange={e => setEditingAd({ ...editingAd, mediaUrl: e.target.value })} 
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-mono text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  {dt(`Linku i Drejtimit (Target URL)`)}
                </label>
                <input 
                  type="text" 
                  value={editingAd.targetUrl || ''} 
                  onChange={e => setEditingAd({ ...editingAd, targetUrl: e.target.value })} 
                  placeholder="https://..."
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-mono text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-white/5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{dt(`Statusi:`)}</span>
                  <select 
                    value={editingAd.status} 
                    onChange={e => setEditingAd({ ...editingAd, status: e.target.value as any })}
                    className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-bold"
                  >
                    <option value="active">{dt(`Aktive`)}</option>
                    <option value="paused">{dt(`Në Pauzë`)}</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    type="button" 
                    onClick={() => setEditingAd(null)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    {dt(`Anulo`)}
                  </button>
                  <button 
                    type="submit" 
                    className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm"
                  >
                    {dt(`Ruaj Ndryshimet`)}
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
