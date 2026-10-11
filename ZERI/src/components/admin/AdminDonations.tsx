import { dt } from '@/src/lib/dt';
import React, { useState } from 'react';
import { useStore, DonationCause } from '../../lib/store';
import { Heart, Plus, Trash2, Link as LinkIcon, Image, Type, CheckCircle, Edit3, XCircle, Download } from 'lucide-react';

export default function AdminDonations({ extended }: { extended?: boolean }) {
  const donationCauses = useStore(state => state.donationCauses);
  const addDonationCause = useStore(state => state.addDonationCause);
  const deleteDonationCause = useStore(state => state.deleteDonationCause);
  const updateDonationCause = useStore(state => state.updateDonationCause);

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

  const handleApprove = (id: string) => {
    if (window.confirm("A jeni i sigurt që dëshironi të aprovoni këtë kërkesë?")) {
      updateDonationCause(id, { status: 'approved' });
    }
  };

  const handleReject = (id: string) => {
    if (window.confirm("A jeni i sigurt që dëshironi të refuzoni këtë kërkesë përgjithmonë?")) {
      deleteDonationCause(id);
    }
  };

  const filteredDonations = donationCauses.filter(c => 
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.id.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const pendingCauses = filteredDonations.filter(c => c.status === 'pending');
  const approvedCauses = filteredDonations.filter(c => c.status === 'approved');

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

      {pendingCauses.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">{dt(`Aplikimet në Pritje`)} <span className="bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full text-xs">{pendingCauses.length}</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pendingCauses.map(cause => (
              <div key={cause.id} className="bg-amber-50 rounded-xl border border-amber-200 overflow-hidden shadow-sm dark:shadow-none flex flex-col">
                <div className="p-4 border-b border-amber-200 bg-amber-100/50 flex justify-between items-center">
                  <span className="text-xs font-bold text-amber-800 uppercase bg-amber-200 px-2 py-1 rounded">{dt(`NË PRITJE`)}</span>
                  <span className="text-xs text-amber-800 font-medium">{dt(`Kat:`)} {cause.category}</span>
                </div>
                <div className="h-48 w-full relative bg-slate-100 dark:bg-slate-800">
                  {cause.mediaType === 'video' ? (
                    <video src={cause.mediaUrl} className="w-full h-full object-cover" controls muted />
                  ) : (
                    <img src={cause.mediaUrl} alt={cause.title} className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <h3 className="font-bold text-slate-900 dark:text-white mb-2">{cause.title}</h3>
                  <span className="font-mono text-[10px] text-slate-400 bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-100 dark:border-white/5 mb-2 inline-block">#{cause.id.substring(0,8)}</span>
                  <p className="text-sm text-neutral-600 dark:text-slate-400 mb-4 line-clamp-3">{cause.description}</p>

                  {extended && (
                    <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-white/10 rounded p-3 mb-4 text-xs font-mono space-y-1">
                      <div className="flex justify-between border-b border-slate-200/60 dark:border-white/10 pb-1 text-slate-500 dark:text-slate-400"><span className="font-bold">{dt(`Verifikimi i Subjektit:`)}</span> <span className="text-emerald-600">{dt(`Kompletuar`)}</span></div>
                      <div className="flex justify-between border-b border-slate-200/60 dark:border-white/10 pb-1 pt-1 text-slate-500 dark:text-slate-400"><span className="font-bold">{dt(`Dokumentacion Mjek./Komunal:`)}</span> <span className="text-amber-600">{dt(`Në Shqyrtim`)}</span></div>
                      <div className="flex justify-between pt-1 text-slate-500 dark:text-slate-400"><span className="font-bold">{dt(`Faktori i Prioritetit (AI):`)}</span> <span className="text-rose-600 text-sm">9.8/10</span></div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 mt-auto pt-4">
                    <button onClick={() => handleApprove(cause.id)} className="flex items-center justify-center gap-1 py-2 bg-emerald-600 text-white rounded-2xl text-sm font-bold hover:bg-emerald-700 transition">
                      <CheckCircle className="w-4 h-4" />{dt(`Aprovo`)} {extended && "Kërkesën"}
                    </button>
                    <button onClick={() => handleReject(cause.id)} className="flex items-center justify-center gap-1 py-2 bg-rose-600 text-white rounded-2xl text-sm font-bold hover:bg-rose-700 transition">
                      <XCircle className="w-4 h-4" />{dt(`Refuzo`)} {extended && "Kërkesën"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">{dt(`Fushatat Aktive`)}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {approvedCauses.map(cause => (
            <div key={cause.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-white/10 overflow-hidden shadow-sm dark:shadow-none flex flex-col">
              <div className="h-48 w-full relative bg-slate-100 dark:bg-slate-800">
                {cause.mediaType === 'video' ? (
                  <video src={cause.mediaUrl} className="w-full h-full object-cover" controls muted />
                ) : (
                  <img src={cause.mediaUrl} alt={cause.title} className="w-full h-full object-cover" />
                )}
                <div className="absolute top-2 right-2 flex gap-2">
                  <button 
                    onClick={() => handleEdit(cause)}
                    className="p-1.5 bg-slate-900/90 text-white rounded hover:bg-slate-900 transition"
                    title={dt(`Ndrysho`)}
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => { if(window.confirm("Jeni i sigurt?")) deleteDonationCause(cause.id) }}
                    className="p-1.5 bg-red-600/90 text-white rounded hover:bg-red-600 transition"
                    title={dt(`Fshi`)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="absolute top-2 left-2 flex gap-2">
                  <span className="bg-white/90 text-slate-900 dark:text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm dark:shadow-none">
                    {cause.category}
                  </span>
                </div>
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <h3 className="font-bold text-slate-900 dark:text-white mb-2">{cause.title}</h3>
                <span className="font-mono text-[10px] text-slate-400 bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-100 dark:border-white/5 mb-2 w-max">#{cause.id.substring(0,8)}</span>
                <p className="text-sm text-neutral-600 dark:text-slate-400 mb-4 line-clamp-3">{cause.description}</p>
                <div className="mt-auto pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                  <span className="text-xs text-slate-400">{new Date(cause.createdAt).toLocaleDateString('sq-AL')}</span>
                  {cause.donationUrl && (
                    <a 
                      href={cause.donationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold text-rose-600 flex items-center gap-1 hover:underline"
                    >
                      <LinkIcon className="w-3 h-3" />{dt(`Shih Linkun`)}
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
          {approvedCauses.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-500 dark:text-slate-400 border-2 border-dashed border-slate-200/60 dark:border-white/10 rounded-xl">{dt(`Nuk ka raste të regjistruara për donacion.`)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
