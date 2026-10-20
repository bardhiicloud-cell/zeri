import { dt } from '@/src/lib/dt';
import React, { useState, useMemo } from 'react';
import { useStore } from '../../lib/store';
import { Plus, Trash2, Calendar, MapPin, Edit3, X, BarChart2, Search, ChevronLeft, ChevronRight, Vote, CheckSquare, Square } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../../lib/utils';
import { KOSOVO_MUNICIPALITIES } from '../../lib/constants';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { askConfirm, askReason } from '../../lib/dialogs';

export default function AdminPolls() {
  const polls = useStore(state => state.polls);
  const createPoll = useStore(state => state.createPoll);
  const updatePoll = useStore(state => state.updatePoll);
  const deletePoll = useStore(state => state.deletePoll);
  
  const [isCreating, setIsCreating] = useState(false);
  const [editingPollId, setEditingPollId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Pagination & Multi-select
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const itemsPerPage = 6;
  
  const initialPollState = {
    question: '',
    description: '',
    image: '',
    category: '',
    municipality: '',
    expiresAt: '',
    options: [{ id: '1', text: '', votes: 0, icon: '👍' }, { id: '2', text: '', votes: 0, icon: '👎' }]
  };
  
  const [newPoll, setNewPoll] = useState(initialPollState);

  const filteredPolls = useMemo(() => {
    let result = polls;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(poll => 
        poll.question.toLowerCase().includes(q) || 
        poll.description.toLowerCase().includes(q) || 
        poll.category?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [polls, searchQuery]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredPolls.length / itemsPerPage);
  const paginatedPolls = filteredPolls.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const toggleSelectBlock = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleBulkAction = async (action: 'delete') => {
    if (!await askConfirm(`A jeni të sigurt që dëshironi të fshini ${selectedIds.size} sondazhe?`)) return;
    
    selectedIds.forEach(id => {
      deletePoll(id);
    });
    setSelectedIds(new Set());
  };

  const startEditing = (poll: any) => {
    setEditingPollId(poll.id);
    setIsCreating(true);
    // Format expiration date for datetime-local input
    let formattedDate = '';
    if (poll.expiresAt) {
      const date = new Date(poll.expiresAt);
      formattedDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    }
    setNewPoll({
      question: poll.question,
      description: poll.description,
      image: poll.image || '',
      category: poll.category || '',
      municipality: poll.municipality || '',
      expiresAt: formattedDate,
      options: poll.options.map((o: any) => ({ ...o }))
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCreateOrUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPoll.question || !newPoll.expiresAt) {
      // Avoid window.alert
      return;
    }
    
    let expDate = newPoll.expiresAt;
    try {
      expDate = new Date(newPoll.expiresAt).toISOString();
    } catch (err) {}
    
    const submittedData = {
      ...newPoll,
      expiresAt: expDate, createdAt: new Date().toISOString(),
      options: newPoll.options.filter(o => o.text.trim() !== '')
    };

    if (editingPollId) {
      updatePoll(editingPollId, submittedData);
    } else {
      createPoll(submittedData);
    }
    
    setIsCreating(false);
    setEditingPollId(null);
    setNewPoll(initialPollState);
  };

  const cancelEdit = () => {
    setIsCreating(false);
    setEditingPollId(null);
    setNewPoll(initialPollState);
  };

  return (
    <div className="max-w-full mx-auto space-y-6">
      {/* HEADER & SEARCH */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 pb-2">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight title-serif flex items-center gap-3">
             <Vote className="w-8 h-8 text-indigo-600" />{dt(`Sistemi Zgjedhor`)}
          </h2>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-2">{dt(`Menaxhimi i sondazheve dhe opinioneve publike.`)}</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto items-start xl:items-center">
          <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl">
            <div className="px-5 py-2 flex flex-col items-center min-w-[6rem]">
              <span className="text-lg font-bold title-serif leading-none text-slate-900 dark:text-white">{polls.length}</span>
              <span className="text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-400 font-bold mt-1">{dt(`Sondazhe`)}</span>
            </div>
            <div className="px-5 py-2 border-l border-slate-200/60 dark:border-white/10 flex flex-col items-center min-w-[6rem]">
              <span className="text-lg font-bold title-serif leading-none text-indigo-600">
                {polls.reduce((acc, p) => acc + Object.values(p.options || {}).reduce((sum, o: any) => sum + (o.votes || 0), 0), 0)}
              </span>
              <span className="text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-400 font-bold mt-1">{dt(`Vota`)}</span>
            </div>
          </div>
          
          <button 
            onClick={() => {
              if (isCreating) cancelEdit();
              else setIsCreating(true);
            }}
            className={cn(
              "flex items-center justify-center gap-2 px-6 py-3.5 font-bold text-sm transition rounded-xl shadow-sm dark:shadow-none hover:shadow active:scale-95 w-full sm:w-auto",
              isCreating 
                ? "bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100" 
                : "bg-slate-900 text-white hover:bg-slate-800 border border-slate-800"
            )}
          >
            {isCreating ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {isCreating ? 'Mbyll Procedurën' : 'Shto Sondazh'}
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm dark:shadow-none border border-slate-100 dark:border-white/5">
         <div className="relative w-full sm:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder={dt(`Kërko me emër ose përshkrim...`)}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-white/10 rounded-xl text-sm font-medium placeholder:text-slate-400 focus:bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition"
            />
         </div>
         {selectedIds.size > 0 && (
            <motion.div 
               initial={{ scale: 0.95, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               className="flex items-center gap-2 bg-slate-900 px-2 py-1.5 rounded-xl shadow-sm dark:shadow-none border border-slate-800 w-full sm:w-auto overflow-x-auto whitespace-nowrap scrollbar-hide"
            >
               <span className="text-white text-xs font-bold px-2">{selectedIds.size}{dt(`zgjedhur`)}</span>
               <button onClick={() => handleBulkAction('delete')} className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl text-xs font-bold transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
            </motion.div>
         )}
      </div>

      {isCreating && (
        <form onSubmit={handleCreateOrUpdate} className="bg-white dark:bg-slate-900 p-6 md:p-10 border border-slate-200/60 dark:border-white/10 shadow-sm dark:shadow-none rounded-2xl space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
           <div className="border-b border-slate-100 dark:border-white/5 pb-5 mb-6 flex items-center justify-between">
             <h3 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight title-serif">
               {editingPollId ? 'Ndrysho Sondazhin' : 'Sondazh i Ri'}
             </h3>
             <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-3 py-1 rounded-[6px] text-[11px] font-bold tracking-widest uppercase">{dt(`Formulari Zyrtar`)}</span>
           </div>
           
           <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">{dt(`Çështja (Pyetja kryesore)`)}</label>
                <input required type="text" value={newPoll.question} onChange={e => setNewPoll({...newPoll, question: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-white/10 rounded-xl text-sm outline-none focus:bg-white dark:bg-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition font-medium" placeholder={dt(`psh. Cila është gjendja e rrugëve?`)} />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">{dt(`Përshkrimi (Detajet)`)}</label>
                <textarea value={newPoll.description} onChange={e => setNewPoll({...newPoll, description: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-white/10 rounded-xl text-sm outline-none focus:bg-white dark:bg-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition font-medium min-h-[100px]" placeholder={dt(`Detaje shtesë mbi sondazhin...`)} />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">{dt(`Afati i Përfundimit`)}</label>
                  <input required type="datetime-local" value={newPoll.expiresAt} onChange={e => setNewPoll({...newPoll, expiresAt: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-white/10 rounded-xl text-sm outline-none focus:bg-white dark:bg-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition font-medium" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">{dt(`Kategoria`)}</label>
                  <input type="text" value={newPoll.category} onChange={e => setNewPoll({...newPoll, category: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-white/10 rounded-xl text-sm outline-none focus:bg-white dark:bg-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition font-medium" placeholder={dt(`psh. Infrastrukturë`)} />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                   <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">{dt(`Imazhi (URL - Opsionale)`)}</label>
                   <input type="url" value={newPoll.image} onChange={e => setNewPoll({...newPoll, image: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-white/10 rounded-xl text-sm outline-none focus:bg-white dark:bg-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition font-medium" placeholder={dt(`https://...`)} />
                </div>
                <div>
                   <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">{dt(`Targeti Lokal`)}</label>
                   <select value={newPoll.municipality} onChange={e => setNewPoll({...newPoll, municipality: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-white/10 rounded-xl text-sm outline-none focus:bg-white dark:bg-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition font-medium appearance-none">
                     <option value="">{dt(`Nacionale (E Gjithë Kosova)`)}</option>
                     {KOSOVO_MUNICIPALITIES.map(m => (
                       <option key={m} value={m}>{m}</option>
                     ))}
                   </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">{dt(`Opsionet e Zgjedhjes`)}</label>
                <div className="space-y-3 bg-slate-50 dark:bg-slate-800 p-4 border border-slate-200/60 dark:border-white/10 rounded-xl mb-4">
                  {newPoll.options.map((opt, i) => (
                    <div key={i} className="flex gap-3 relative group">
                      <input type="text" placeholder={dt(`Ikonë (psh 🚀)`)} value={opt.icon || ''} onChange={e => {
                        const newOptions = [...newPoll.options]; 
                        newOptions[i] = { ...newOptions[i], icon: e.target.value }; 
                        setNewPoll({...newPoll, options: newOptions});
                      }} className="w-16 px-2 py-3 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-xl text-center focus:outline-none focus:border-indigo-500 text-sm shadow-sm dark:shadow-none" />
                      
                      <input type="text" placeholder={`Opsioni ${i + 1}`} value={opt.text} onChange={e => {
                        const newOptions = [...newPoll.options]; 
                        newOptions[i] = { ...newOptions[i], text: e.target.value }; 
                        setNewPoll({...newPoll, options: newOptions});
                      }} className="flex-1 px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-900 dark:text-white font-medium text-sm shadow-sm dark:shadow-none" />
                      
                      {newPoll.options.length > 2 && (
                         <button type="button" onClick={() => {
                            const newOptions = [...newPoll.options];
                            newOptions.splice(i, 1);
                            setNewPoll({...newPoll, options: newOptions});
                         }} className="absolute -right-2 -top-2 w-6 h-6 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <X className="w-3.5 h-3.5" />
                         </button>
                      )}
                    </div>
                  ))}
                  
                  <button type="button" onClick={() => setNewPoll({...newPoll, options: [...newPoll.options, {id: Math.random().toString(), text: '', votes: 0, icon: '❓'}]})} className="w-full py-3 border-2 border-dashed border-slate-200/60 dark:border-white/10 rounded-xl text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50/50 dark:hover:bg-slate-800 dark:bg-slate-900 transition flex items-center justify-center gap-2">
                    <Plus className="w-4 h-4" />{dt(`Shto Opsion Tjetër`)}
                  </button>
                </div>
              </div>
           </div>

           <div className="flex justify-end pt-6 border-t border-slate-100 dark:border-white/5 gap-3">
             <button type="button" onClick={cancelEdit} className="px-6 py-3 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold border border-slate-200/60 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-slate-800/50 dark:bg-slate-800/50 transition-colors">{dt(`Anulo`)}</button>
             <button type="submit" className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-colors rounded-xl shadow-sm dark:shadow-none tracking-wide">
                {editingPollId ? 'RUAJ NDRYSHIMET' : 'DEKRETO SONDAZHIN'}
             </button>
           </div>
        </form>
      )}

      {/* CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {paginatedPolls.map((poll) => {
             const isSelected = selectedIds.has(poll.id);
             return (
            <motion.div 
               layout
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.95 }}
               key={poll.id} 
               className={cn("bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-2xl shadow-sm dark:shadow-none hover:shadow transition relative flex flex-col overflow-hidden group", isSelected && "ring-2 ring-indigo-500")}
            >
              <div className="absolute top-4 left-4 z-20">
                 <button onClick={() => toggleSelectBlock(poll.id)} className="w-8 h-8 bg-white/90 backdrop-blur-sm rounded-2xl flex items-center justify-center text-slate-400 hover:text-slate-500 dark:text-slate-400 shadow-sm dark:shadow-none border border-slate-200/60 dark:border-white/10 border border-slate-200/60 dark:border-white/10 transition-colors">
                   {isSelected ? <CheckSquare className="w-5 h-5 text-indigo-600" /> : <Square className="w-5 h-5" />}
                 </button>
              </div>
               
              <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                <button 
                  onClick={() => startEditing(poll)}
                  className="w-8 h-8 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-white/10 rounded-2xl shadow-sm dark:shadow-none flex items-center justify-center hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors"
                  title={dt(`Ndrysho`)}
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => deletePoll(poll.id)}
                  className="w-8 h-8 bg-white dark:bg-slate-900 text-rose-500 border border-slate-200/60 dark:border-white/10 rounded-2xl shadow-sm dark:shadow-none flex items-center justify-center hover:bg-rose-50 hover:border-rose-200 transition-colors"
                  title={dt(`Fshij Sondazhin`)}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              
              {poll.image && (
                <div className="h-40 bg-slate-100 dark:bg-slate-800/50 w-full relative shrink-0">
                   <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent z-10" />
                   <img src={poll.image} className="w-full h-full object-cover" alt="poll header" />
                </div>
              )}
              
              <div className={cn("p-5 flex-1 flex flex-col", !poll.image && "pt-12")}>
                <div className="flex flex-wrap gap-2 mb-4">
                   <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-[11px] uppercase font-bold tracking-widest rounded border border-indigo-100">
                     {poll.category || 'Të Përgjithshme'}
                   </span>
                   {poll.municipality && (
                      <span className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-white/10 text-slate-500 dark:text-slate-400 text-[11px] uppercase font-bold tracking-widest rounded flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {poll.municipality}
                      </span>
                   )}
                </div>
                
                 <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-snug mb-2 title-serif tracking-tight truncate-2-lines">{poll.question}</h3>
                 <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 line-clamp-2 md:line-clamp-3 leading-relaxed">{poll.description}</p>
                 
                 <div className="space-y-3 mb-6">
                   {poll.options.map(opt => {
                     const percent = poll.totalVotes && poll.totalVotes > 0 ? Math.round((opt.votes / poll.totalVotes) * 100) : 0;
                     return (
                       <div key={opt.id} className="relative group/opt">
                         <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300 z-10 relative px-3 py-2.5 items-center">
                           <span className="flex items-center gap-2 truncate pr-2 z-10 mix-blend-difference text-white">{opt.icon} <span className="drop-shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none">{opt.text}</span></span>
                           <span className="shrink-0 z-10 text-white drop-shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none">{percent}%</span>
                         </div>
                         <div className="absolute inset-0 bg-slate-100 dark:bg-slate-800/50 rounded-2xl w-full overflow-hidden">
                           <div className="absolute inset-y-0 left-0 bg-indigo-500 transition-all duration-1000" style={{ width: `${percent}%` }} />
                           <div className="absolute inset-y-0 left-0 w-full bg-slate-800 opacity-0 group-hover/opt:opacity-10 transition-opacity" />
                         </div>
                       </div>
                     );
                   })}
                 </div>
                 
                 <div className="flex items-center gap-2 text-[11px] border-t border-slate-100 dark:border-white/5 pt-4 font-bold uppercase text-slate-400 tracking-widest mt-auto">
                   <Calendar className="w-3.5 h-3.5" />{dt(`SKADON:`)} {format(new Date(poll.expiresAt), 'dd MMM yyyy')}
                 </div>
              </div>
            </motion.div>
          )})}
        </AnimatePresence>
      </div>

      {paginatedPolls.length === 0 && (
         <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-2xl p-16 text-center shadow-sm dark:shadow-none">
           <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-5 border border-slate-100 dark:border-white/5">
             <Vote className="w-10 h-10 text-slate-300" />
           </div>
           <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 title-serif">{dt(`S'ka Rezultate`)}</h3>
           <p className="text-slate-500 dark:text-slate-400 font-medium">{dt(`Nuk u gjet asnjë sondazh me këto kritere.`)}</p>
         </div>
      )}

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="px-6 py-4 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-2xl shadow-sm dark:shadow-none flex flex-col sm:flex-row gap-4 items-center justify-between">
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{dt(`Shfaqur`)} <strong className="text-slate-900 dark:text-white">{(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredPolls.length)}</strong>{dt(`nga`)} <strong className="text-slate-900 dark:text-white">{filteredPolls.length}</strong>
          </span>
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 border border-slate-200/60 dark:border-white/10 rounded-2xl hover:bg-slate-50 dark:bg-slate-800 disabled:opacity-50 text-slate-500 dark:text-slate-400 transition-colors text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >{dt(`Kthehu`)}
            </button>
            <div className="flex items-center px-4 font-bold title-serif text-slate-900 dark:text-white text-lg">
               {currentPage} / {totalPages}
            </div>
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-2 border border-slate-200/60 dark:border-white/10 rounded-2xl hover:bg-slate-50 dark:bg-slate-800 disabled:opacity-50 text-slate-500 dark:text-slate-400 transition-colors text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >{dt(`Vazhdo`)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
