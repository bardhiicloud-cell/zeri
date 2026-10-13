import { dt } from '@/src/lib/dt';
import React, { useState } from 'react';
import { useStore, DonationCause } from '../../lib/store';
import { Heart, Plus, Trash2, Link as LinkIcon, Image, Type, Edit3, Download } from 'lucide-react';
import DecisionBar from './DecisionBar';

export default function AdminDonations({ extended }: { extended?: boolean }) {
  const donationCauses = useStore(state => state.donationCauses);
  const addDonationCause = useStore(state => state.addDonationCause);
  const deleteDonationCause = useStore(state => state.deleteDonationCause);
  const updateDonationCause = useStore(state => state.updateDonationCause);
  const setDonationCauses = useStore(state => state.setDonationCauses);

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [newCause, setNewCause] = useState<Omit<DonationCause, 'id' | 'createdAt'>>({ title: '', description: '', category: 'shtepi', status: 'approved', mediaType: 'image', mediaUrl: '', donationUrl: '' });

  const handleDownloadCSV = () => {
    const headers = ['ID', 'Titulli', 'Përshkrimi', 'Statusi', 'Kategoria', 'URL Donacionit', 'Data e Krijimit'];
    const csvRows = [headers.join(',')];
    
    donationCauses.forEach(c => {
      const row = [
        c.id,
        `"${c.title.replace(/"/g, '""')}"`,
        `"${c.description.replace(/"/g, '""')}"`,
        c.status,
        c.category,
        c.donationUrl,
        c.createdAt
      ];
      csvRows.push(row.join(','));
    });
    
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Regjistri_Aplikimeve_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAdd = () => {
    if (!newCause.title || !newCause.description || !newCause.mediaUrl) {
      alert("Të gjitha fushat janë të detyrueshme!");
      return;
    }
    
    if (editingId) {
      updateDonationCause(editingId, newCause);
      setEditingId(null);
    } else {
      addDonationCause({ ...newCause, status: 'approved' });
    }
    
    setNewCause({ title: '', description: '', category: 'shtepi', status: 'approved', mediaType: 'image', mediaUrl: '', donationUrl: '' });
    setIsAdding(false);
  };

  const handleEdit = (cause: DonationCause) => {
    setNewCause(cause);
    setEditingId(cause.id);
    setIsAdding(true);
  };

  const cancelEdit = () => {
    setIsAdding(false);
    setEditingId(null);
    setNewCause({ title: '', description: '', category: 'shtepi', status: 'approved', mediaType: 'image', mediaUrl: '', donationUrl: '' });
  };

  /** Which pile is open. Rejected appeals are kept and visible, never silently deleted. */
  const [view, setView] = useState<'pending' | 'approved' | 'rejected'>('pending');

  const filteredDonations = donationCauses.filter(c =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pendingCauses = filteredDonations.filter(c => (c.status ?? 'pending') === 'pending');
  const approvedCauses = filteredDonations.filter(c => c.status === 'approved');
  const rejectedCauses = filteredDonations.filter(c => c.status === 'rejected');
  const piles = { pending: pendingCauses, approved: approvedCauses, rejected: rejectedCauses };
  const shown = piles[view];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200/60 dark:border-white/10 gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Heart className="w-6 h-6 text-rose-600" />
            {extended ? 'Menaxhimi i Miratimeve & Aplikimeve' : 'Menaxhimi i Donacioneve'}
          </h2>
          <p className="text-sm text-neutral-500 dark:text-slate-400 mt-1">{extended ? 'Analizë e detajuar e kërkesave për ndihmë nga qytetarët.' : 'Menaxho rastet aktive dhe aprovo/refuzo aplikimet e reja nga qytetarët.'}</p>
        </div>
        <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
          <input 
            type="text" 
            placeholder={dt(`Kërko Titull ose ID...`)}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full md:w-64 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-white/10 rounded-2xl text-sm font-medium focus:bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
          />
          <div className="flex gap-2">
            {!isAdding && (
              <button 
                onClick={() => setIsAdding(true)}
                className="bg-rose-600 text-white px-4 py-2 rounded-2xl font-bold text-sm tracking-wide flex items-center gap-2 hover:bg-rose-700 transition"
              >
                <Plus className="w-4 h-4" />{dt(`Shto Rast të Ri`)}
              </button>
            )}
            <button 
              onClick={handleDownloadCSV}
              className="bg-emerald-600 text-white px-4 py-2 rounded-2xl font-bold text-sm tracking-wide flex items-center gap-2 hover:bg-emerald-700 transition whitespace-nowrap"
            >
              <Download className="w-4 h-4" />{dt(`Eksporto CSV`)}
            </button>
          </div>
        </div>
      </div>

      {isAdding && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200/60 dark:border-white/10 shadow-sm dark:shadow-none">
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 border-b border-slate-100 dark:border-white/5 pb-2">{editingId ? 'Ndrysho Rastin' : 'Shto Rast të Ri'}</h3>
          <div className="grid gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1"><Type className="w-3 h-3" />{dt(`Titulli`)}</label>
                <input type="text" value={newCause.title} onChange={e => setNewCause({...newCause, title: e.target.value})} className="w-full border border-slate-200/60 dark:border-white/10 rounded-2xl p-2.5 text-sm focus:border-rose-600 outline-none" placeholder={dt(`psh. Ndihmë për familjen...`)} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1"><Type className="w-3 h-3" />{dt(`Kategoria`)}</label>
                <select value={newCause.category} onChange={e => setNewCause({...newCause, category: e.target.value as any})} className="w-full border border-slate-200/60 dark:border-white/10 rounded-2xl p-2.5 text-sm focus:border-rose-600 outline-none bg-white dark:bg-slate-900">
                  <option value="shtepi">{dt(`Shtëpi`)}</option>
                  <option value="semundje">{dt(`Sëmundje dhe trajtim`)}</option>
                  <option value="ushqim">{dt(`Ushqim`)}</option>
                  <option value="veshmbathje">{dt(`Veshmbathje`)}</option>
                  <option value="tjera">{dt(`Të Tjera`)}</option>
                </select>
              </div>
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1"><Type className="w-3 h-3" />{dt(`Përshkrimi`)}</label>
              <textarea value={newCause.description} onChange={e => setNewCause({...newCause, description: e.target.value})} className="w-full border border-slate-200/60 dark:border-white/10 rounded-2xl p-2.5 text-sm focus:border-rose-600 outline-none min-h-[100px]" placeholder={dt(`Detajet e rastit...`)}></textarea>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1"><Image className="w-3 h-3" />{dt(`Lloj i Medias`)}</label>
                <select value={newCause.mediaType} onChange={e => setNewCause({...newCause, mediaType: e.target.value as 'image' | 'video'})} className="w-full border border-slate-200/60 dark:border-white/10 rounded-2xl p-2.5 text-sm focus:border-rose-600 outline-none bg-white dark:bg-slate-900">
                  <option value="image">{dt(`Fotografi`)}</option>
                  <option value="video">{dt(`Video (MP4, etj)`)}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1"><Image className="w-3 h-3" />{dt(`URL e Medias (Foto/Video)`)}</label>
                <input type="url" value={newCause.mediaUrl} onChange={e => setNewCause({...newCause, mediaUrl: e.target.value})} className="w-full border border-slate-200/60 dark:border-white/10 rounded-2xl p-2.5 text-sm focus:border-rose-600 outline-none" placeholder={dt(`https://...`)} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1"><LinkIcon className="w-3 h-3" />{dt(`URL për Donacion (Opsionale)`)}</label>
                <input type="url" value={newCause.donationUrl} onChange={e => setNewCause({...newCause, donationUrl: e.target.value})} className="w-full border border-slate-200/60 dark:border-white/10 rounded-2xl p-2.5 text-sm focus:border-rose-600 outline-none" placeholder={dt(`https://...`)} />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={cancelEdit} className="px-5 py-2 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50 dark:bg-slate-800/50 rounded-2xl transition">{dt(`Anulo`)}</button>
              <button onClick={handleAdd} className="px-5 py-2 text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-2xl transition">{editingId ? 'Përditëso Rastin' : 'Ruaj Rastin'}</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2" role="tablist" aria-label={dt('Gjendja e kauzave')}>
        {([
          ['pending', 'Në pritje', pendingCauses.length],
          ['approved', 'Aktive', approvedCauses.length],
          ['rejected', 'Të refuzuara', rejectedCauses.length],
        ] as const).map(([id, label, count]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={view === id}
            onClick={() => setView(id)}
            className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-colors ${view === id ? 'bg-slate-900 text-white dark:bg-rose-600' : 'border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800'}`}
          >
            {dt(label)} <span className="ml-1 tabular-nums opacity-70">{count}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {shown.map(cause => (
          <div key={cause.id} className="flex flex-col overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900 dark:shadow-none">
            <div className="relative h-48 w-full bg-slate-100 dark:bg-slate-800">
              {cause.mediaType === 'video' ? (
                <video src={cause.mediaUrl} className="h-full w-full object-cover" controls muted />
              ) : (
                <img src={cause.mediaUrl} alt={cause.title} className="h-full w-full object-cover" />
              )}
              <span className="absolute left-2 top-2 rounded bg-white/90 px-2 py-1 text-[10px] font-bold text-slate-900">{cause.category}</span>
              <div className="absolute right-2 top-2 flex gap-2">
                <button onClick={() => handleEdit(cause)} className="rounded bg-slate-900/90 p-1.5 text-white transition hover:bg-slate-900" title={dt(`Ndrysho`)}>
                  <Edit3 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => { if (window.confirm(dt('Të fshihet përgjithmonë kjo kauzë? Për ta hequr nga publiku mjafton "Refuzo".'))) deleteDonationCause(cause.id); }}
                  className="rounded bg-red-600/90 p-1.5 text-white transition hover:bg-red-600"
                  title={dt(`Fshi përgjithmonë`)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex flex-1 flex-col p-5">
              <h3 className="mb-2 font-bold text-slate-900 dark:text-white">{cause.title}</h3>
              <span className="mb-2 w-max rounded border border-slate-100 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-400 dark:border-white/5 dark:bg-slate-800">#{cause.id.substring(0, 8)}</span>
              <p className="mb-4 line-clamp-3 text-sm text-neutral-600 dark:text-slate-400">{cause.description}</p>
              <div className="mb-3 flex items-center justify-between text-xs text-slate-400">
                <span>{new Date(cause.createdAt).toLocaleDateString('sq-AL')}</span>
                {cause.donationUrl && (
                  <a href={cause.donationUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 font-bold text-rose-600 hover:underline">
                    <LinkIcon className="h-3 w-3" />{dt(`Shih Linkun`)}
                  </a>
                )}
              </div>
              <DecisionBar
                kind="donation"
                id={cause.id}
                doc={cause}
                className="mt-auto border-t border-slate-100 pt-3 dark:border-white/5"
                onDecided={state => setDonationCauses(useStore.getState().donationCauses.map(c => c.id === cause.id ? { ...c, status: state as DonationCause['status'] } : c))}
              />
            </div>
          </div>
        ))}
        {shown.length === 0 && (
          <div className="col-span-full rounded-xl border-2 border-dashed border-slate-200/60 py-12 text-center text-slate-500 dark:border-white/10 dark:text-slate-400">
            {view === 'pending' ? dt('Asnjë aplikim në pritje.') : view === 'approved' ? dt('Nuk ka kauza aktive.') : dt('Asnjë kauzë e refuzuar.')}
          </div>
        )}
      </div>
    </div>
  );
}
