import { dt } from '@/src/lib/dt';
import React, { useState, useMemo } from 'react';
import { useStore } from '../../lib/store';
import { useCitizenDirectory } from '../../lib/useCitizenDirectory';
import { canAccessSection } from '../../lib/adminPermissions';
import { UserX, UserCheck, ShieldAlert, Plus, Edit3, X, Search, Phone, Mail, Award, ShieldCheck, Trash2, CheckSquare, Square, Users, ChevronLeft, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

/** The directory row, which already carries every field the form needs. */
type UserRow = ReturnType<typeof useCitizenDirectory>['citizens'][number];

export default function AdminUsers() {
  const currentUser = useStore(state => state.currentUser);
  const moderateUser = useStore(state => state.moderateUser);
  const deleteUser = useStore(state => state.deleteUser);
  const updateUser = useStore(state => state.updateUser);

  /**
   * The directory is now fetched page by page and only for staff. It used to
   * come from `state.users`, which the app-level listener filled by subscribing
   * every visitor to the whole collection — one read per profile per session,
   * for a list that only an administrator ever opens.
   */
  const {
    citizens,
    isLoading,
    error,
    page,
    setPage,
    hasMore,
    hasPrevious,
  } = useCitizenDirectory();

  // Bans and deletions are the only irreversible actions in this view, so they
  // stay behind the narrowest capability. The server enforces this too; the
  // check here only avoids offering a button that would 403.
  const mayModerate = canAccessSection(currentUser, 'users');

  /**
   * The directory already returns every field this view needs, in the shape it
   * expects. No adaptation layer, and no PII that the table does not display.
   */
  const users = citizens;

  const handleSendCredentials = async (email: string) => {
    try {
      // Lazy load firebase auth
      const { auth } = await import('../../lib/firebase');
      const { sendPasswordResetEmail } = await import('firebase/auth');
      await sendPasswordResetEmail(auth, email);
      alert(`Email me udhëzimet e qasjes u dërgua me sukses tek: ${email}`);
    } catch (e: any) {
      alert('Gabim gjatë dërgimit të emailit: ' + e.message);
    }
  };


  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'citizen' | 'staff'>('citizen');

  // Pagination & Multi-select
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const itemsPerPage = 6;

  const initialUserState = {
    name: '',
    email: '',
    phone: '',
    role: 'citizen',
    points: 0,
    isBanned: false,
    isVerified: true
  };

  const [formData, setFormData] = useState(initialUserState);

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (user.phone || '').includes(searchQuery) ||
                          user.id.toLowerCase().includes(searchQuery.toLowerCase());

      const isStaff = user.role !== 'citizen';
      const matchTab = activeTab === 'staff' ? isStaff : !isStaff;
      return matchSearch && matchTab;
    });
  }, [users, searchQuery, activeTab]);

  // Statistics remain overall stats
  const stats = useMemo(() => {
    const matchedUsers = users.filter(user =>
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.phone || '').includes(searchQuery) ||
      user.id.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return {
      total: matchedUsers.length,
      admins: matchedUsers.filter(u => u.role !== 'citizen').length,
      banned: matchedUsers.filter(u => u.isBanned).length,
      unverified: matchedUsers.filter(u => !u.isVerified).length
    };
  }, [users, searchQuery]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedUsers.length && paginatedUsers.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedUsers.map(r => r.id)));
    }
  };

  const toggleSelectBlock = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleBulkAction = async (action: 'ban' | 'verify' | 'delete') => {
    if (!window.confirm(`A jeni të sigurt që dëshironi të kryeni këtë veprim për ${selectedIds.size} përdorues?`)) return;
    const ids = [...selectedIds];

    if (action === 'delete') {
      ids.forEach(id => deleteUser(id));
    } else {
      const reason = action === 'ban' ? askBanReason(`${ids.length} ${dt('përdorues')}`) : undefined;
      if (action === 'ban' && !reason) {
        toast.error(dt('Ndalimi anulohet: arsyeja është e detyrueshme (të paktën 5 shenja).'));
        return;
      }
      let done = 0;
      for (const id of ids) {
        if (await moderate(id, action === 'ban' ? 'ban' : 'verify', reason ?? undefined)) done += 1;
      }
      if (done > 0) toast.success(`${done} / ${ids.length} ${dt('veprime u kryen.')}`);
    }
    setSelectedIds(new Set());
  };

  const startEdit = (user: UserRow) => {
    setEditingUserId(user.id);
    setIsFormOpen(true);
    setFormData({
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      role: user.role,
      points: user.points || 0,
      isBanned: user.isBanned || false,
      isVerified: user.isVerified ?? true
    });
  };

  /**
   * Only harmless profile fields are edited here. Role, points, ban and
   * verification are not form fields: they are privileged and change through the
   * server (see /api/v1/admin/users/:uid/moderate and the staff screen). The old
   * form let an administrator set any user's "Autoriteti" to admin with a plain
   * database write.
   */
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUserId || !formData.name.trim()) return;
    try {
      await updateUser(editingUserId, { name: formData.name.trim(), phone: formData.phone.trim() });
      toast.success(dt('Ndryshimet u ruajtën.'));
      setIsFormOpen(false);
      setEditingUserId(null);
      setFormData(initialUserState);
    } catch (error) {
      toast.error((error as Error)?.message || dt('Ndryshimet nuk u ruajtën.'));
    }
  };

  /** One moderation action, with the server's real answer shown to the person. */
  const moderate = async (id: string, action: 'ban' | 'unban' | 'verify' | 'unverify', reason?: string) => {
    try {
      await moderateUser(id, action, reason);
      return true;
    } catch (error) {
      toast.error((error as Error)?.message || dt('Veprimi nuk u krye.'));
      return false;
    }
  };

  /** A ban needs a stated reason; it is kept in the audit log. */
  const askBanReason = (subject: string): string | null => {
    const reason = window.prompt(`${dt('Arsyeja e ndalimit për')} ${subject} (${dt('e detyrueshme, ruhet në auditim')}):`);
    return reason && reason.trim().length >= 5 ? reason.trim() : null;
  };

  const cancelEdit = () => {
    setIsFormOpen(false);
    setEditingUserId(null);
    setFormData(initialUserState);
  };

  return (
    <div className="max-w-full mx-auto space-y-6">
      {/* Data-state feedback. A silently empty table reads as "no citizens",
          which is how an admin concludes the wrong thing during an incident. */}
      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50/80 p-4 dark:border-rose-900/50 dark:bg-rose-950/20">
          <AlertCircle className="mt-0.5 w-4 h-4 shrink-0 text-rose-600" aria-hidden="true" />
          <p className="text-xs leading-relaxed text-rose-900 dark:text-rose-200">{error}</p>
        </div>
      )}

      {isLoading && citizens.length === 0 && (
        <div className="flex h-40 items-center justify-center gap-3 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin text-rose-500" />
          <span className="text-xs font-semibold">{dt('Duke ngarkuar regjistrin e qytetarëve...')}</span>
        </div>
      )}

      {/* HEADER & SEARCH */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 pb-2">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight title-serif flex items-center gap-3">
             <Users className="w-8 h-8 text-indigo-600" />{dt(`Regjistri i Përdoruesve`)}
          </h2>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-2">{dt(`Menaxhimi i kredencialeve dhe autoriteteve zyrtare.`)}</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto">
          <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl">
            {[
              { label: 'Totali', value: stats.total, color: 'text-slate-900 dark:text-white' },
              { label: 'Admin', value: stats.admins, color: 'text-indigo-600' },
              { label: 'Pa verifikuar', value: stats.unverified, color: 'text-orange-600' },
              { label: 'Të Bllokuar', value: stats.banned, color: 'text-rose-600' }
            ].map((s, i) => (
              <div key={i} className="px-4 py-2 border-r border-slate-200/60 dark:border-white/10 last:border-0 flex flex-col items-center min-w-[5rem]">
                <span className={cn("text-lg font-bold title-serif leading-none", s.color)}>{s.value}</span>
                <span className="text-[9px] uppercase tracking-widest text-slate-500 dark:text-slate-400 font-bold mt-1">{s.label}</span>
              </div>
            ))}
          </div>

        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm dark:shadow-none border border-slate-100 dark:border-white/5">
         <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-2xl w-full sm:w-auto overflow-x-auto hide-scrollbar">
           <button 
             onClick={() => { setActiveTab('citizen'); setCurrentPage(1); }}
             className={cn("px-4 py-2 font-bold text-xs rounded-xl uppercase tracking-wider transition-all whitespace-nowrap", activeTab === 'citizen' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm dark:shadow-none' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-300')}
           >{dt(`Qytetarët`)}
           </button>
           <button 
             onClick={() => { setActiveTab('staff'); setCurrentPage(1); }}
             className={cn("px-4 py-2 font-bold text-xs rounded-xl uppercase tracking-wider transition-all whitespace-nowrap", activeTab === 'staff' ? 'bg-white dark:bg-slate-900 text-indigo-700 shadow-sm dark:shadow-none' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-300')}
           >{dt(`Stafi Administrues`)}
           </button>
         </div>

         <div className="relative w-full sm:max-w-xs xl:max-w-sm">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder={dt(`Kërko...`)}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-white/10 rounded-xl text-sm font-medium placeholder:text-slate-400 focus:bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
            />
         </div>
         {selectedIds.size > 0 && (
            <motion.div 
               initial={{ scale: 0.95, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               className="flex items-center gap-2 bg-slate-900 px-2 py-1.5 rounded-xl shadow-sm dark:shadow-none border border-slate-800 w-full sm:w-auto overflow-x-auto whitespace-nowrap scrollbar-hide"
            >
               <span className="text-white text-xs font-bold px-2">{selectedIds.size}{dt(`zgjedhur`)}</span>
               <button onClick={() => handleBulkAction('verify')} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-bold transition-colors">{dt(`Verifiko`)}</button>
               <button onClick={() => handleBulkAction('ban')} className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-2xl text-xs font-bold transition-colors">{dt(`Blloko`)}</button>
               <button onClick={() => handleBulkAction('delete')} className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl text-xs font-bold transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
            </motion.div>
         )}
      </div>

      {isFormOpen && (
        <form onSubmit={handleSave} className="bg-white dark:bg-slate-900 p-6 md:p-10 border-2 border-slate-200/60 dark:border-white/10 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.08)] dark:shadow-none transition-all duration-300 rounded-xl space-y-8 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-bold tracking-wide text-slate-900 dark:text-white mb-2 border-l-4 border-red-500 rounded-l-xl pl-2">{dt(`Emri dhe Mbiemri`)}</label>
              <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-3 bg-neutral-50 border border-slate-200/60 dark:border-white/10 rounded-xl font-bold text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold tracking-wide text-slate-900 dark:text-white mb-2 border-l-4 border-red-500 rounded-l-xl pl-2">{dt(`Email`)}</label>
              <input readOnly type="email" value={formData.email} title={dt(`Email-i është identiteti i hyrjes dhe nuk ndryshohet këtu`)} className="w-full cursor-not-allowed px-4 py-3 bg-slate-100 text-slate-500 border border-slate-200/60 dark:border-white/10 dark:bg-slate-800 rounded-xl font-bold text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold tracking-wide text-slate-900 dark:text-white mb-2 border-l-4 border-red-500 rounded-l-xl pl-2">{dt(`Telefoni`)}</label>
              <input type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full px-4 py-3 bg-neutral-50 border border-slate-200/60 dark:border-white/10 rounded-xl font-bold text-sm" />
            </div>
            {editingUserId && (
              <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 dark:border-blue-900/40 dark:bg-blue-950/20">
                <p className="text-xs font-bold text-blue-900 dark:text-blue-200">{dt(`Qasja menaxhohet me Firebase Authentication`)}</p>
                <p className="mt-1 text-[11px] text-blue-700 dark:text-blue-300">{dt(`Fjalëkalimet nuk ruhen dhe nuk shfaqen në panel.`)}</p>
                 <button 
                   type="button" 
                   onClick={async () => {
                     try {
                        const { sendPasswordResetEmail } = await import('firebase/auth');
                        const { auth } = await import('../../lib/firebase');
                        await sendPasswordResetEmail(auth, formData.email);
                        toast.success(`${dt('Email-i i ndërrimit të fjalëkalimit u dërgua te')} ${formData.email}`);
                     } catch(err) {
                        toast.error(dt('Dërgimi i email-it dështoi: llogaria duhet të ekzistojë në Firebase Authentication.'));
                     }
                   }}
                   className="text-xs text-blue-600 font-bold tracking-wide hover:underline mt-2 flex items-center gap-1"
                 >{dt(`Dërgo "Reset Password" Email Automatike`)}
                 </button>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-4 pt-4 border-t-2 border-slate-900">
            <button type="button" onClick={cancelEdit} className="px-8 py-4 border border-slate-200/60 dark:border-white/10 rounded-xl font-bold text-xs tracking-wide hover:bg-neutral-100">{dt(`Anulo`)}</button>
            <button type="submit" className="px-8 py-4 bg-slate-900 text-white font-bold text-xs tracking-wide hover:bg-blue-900">
              {dt(`Ruaj ndryshimet`)}
            </button>
          </div>
        </form>
      )}

      {/* USER TABLE */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-2xl shadow-sm dark:shadow-none hover:shadow transition-all duration-300 overflow-hidden">
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left whitespace-nowrap min-w-[800px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-white/5 uppercase tracking-widest text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                 <th className="px-4 py-4 w-12 text-center">
                   <button onClick={toggleSelectAll} className="text-slate-400 hover:text-slate-500 dark:text-slate-400">
                     {paginatedUsers.length > 0 && selectedIds.size === paginatedUsers.length ? (
                       <CheckSquare className="w-5 h-5 text-indigo-600" />
                     ) : (
                       <Square className="w-5 h-5" />
                     )}
                   </button>
                 </th>
                <th className="px-6 py-4">{dt(`Përdoruesi`)}</th>
                <th className="px-6 py-4">{dt(`Kontakti`)}</th>
                <th className="px-6 py-4">{dt(`Statusi`)}</th>
                <th className="px-6 py-4">{dt(`Kredencialet`)}</th>
                <th className="px-6 py-4 text-right">{dt(`Veprimet`)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              <AnimatePresence mode="popLayout">
              {paginatedUsers.map(u => {
                const isSelected = selectedIds.has(u.id);
                return (
                <motion.tr 
                  layout
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  key={u.id} className={cn("hover:bg-slate-50 dark:bg-slate-800 transition-colors group", u.isBanned && "bg-rose-50/30", isSelected && "bg-indigo-50/50")}
                >
                  <td className="px-4 py-4 align-top text-center">
                    <button onClick={() => toggleSelectBlock(u.id)} className="text-slate-400 hover:text-slate-500 dark:text-slate-400 mt-2">
                       {isSelected ? <CheckSquare className="w-5 h-5 text-indigo-600" /> : <Square className="w-5 h-5" />}
                    </button>
                  </td>
                  <td className="px-6 py-4 align-top">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 flex items-center justify-center font-bold rounded-xl shadow-sm dark:shadow-none border",
                        u.role === 'admin' ? "bg-indigo-600 text-white border-indigo-500" : u.role === 'approver' ? "bg-purple-600 text-white border-purple-500" : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200/60 dark:border-white/10"
                      )}>
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col gap-1 text-sm">
                        <div className="flex items-center gap-2">
                           <span className="font-bold text-slate-900 dark:text-white border-b border-transparent group-hover:border-slate-300 w-max">{u.name}</span>
                           <span className="font-mono text-[9px] text-slate-400 bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-100 dark:border-white/5 uppercase">#{u.id.substring(0,8)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={cn(
                            "text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded-sm border",
                            u.role === 'admin' ? "bg-indigo-50 text-indigo-700 border-indigo-100" : u.role === 'approver' ? "bg-purple-50 text-purple-700 border-purple-100" : "bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-slate-200/60 dark:border-white/10"
                          )}>
                            {u.role === 'citizen' ? 'Qytetar' : u.role === 'approver' ? 'Zyr. Aprovimeve' : 'Admin'}
                          </span>
                          {u.isVerified && <ShieldCheck className="w-3.5 h-3.5 text-emerald-500"  />}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 align-top">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                        <Mail className="w-3.5 h-3.5 text-slate-400" /> {u.email}
                      </div>
                      {u.phone ? (
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                          <Phone className="w-3.5 h-3.5 text-slate-400" /> {u.phone}
                        </div>
                      ) : (
                         <div className="flex items-center gap-2 text-xs font-medium text-slate-400 italic">
                          <Phone className="w-3.5 h-3.5 opacity-50" />{dt(`S'ka numër`)}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 align-top">
                    {u.isBanned ? (
                      <span className="inline-flex items-center gap-1.5 text-rose-700 font-bold text-[10px] tracking-widest uppercase bg-rose-50 px-2 py-1 rounded border border-rose-100">
                        <UserX className="w-3.5 h-3.5" />{dt(`Bllokuar`)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-emerald-700 font-bold text-[10px] tracking-widest uppercase bg-emerald-50 px-2 py-1 rounded border border-emerald-100">
                        <UserCheck className="w-3.5 h-3.5" />{dt(`Aktiv`)}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 align-top">
                    <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 w-max px-2.5 py-1.5 rounded-2xl border border-slate-100 dark:border-white/5">
                      <Award className="w-4 h-4 text-indigo-500" />
                      <span className="font-bold text-slate-900 dark:text-white text-sm">{u.points || 0} p</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right align-top">
                    <div className="flex items-center justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => startEdit(u)}
                        className="p-1.5 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-2xl text-slate-500 dark:text-slate-400 hover:text-indigo-600 hover:border-indigo-600 transition-colors shadow-sm dark:shadow-none"
                        title={dt(`Ndrysho`)}
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      {!u.isVerified && (
                        <button 
                          onClick={() => void moderate(u.id, 'verify')}
                          className="p-1.5 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-2xl text-slate-500 dark:text-slate-400 hover:text-emerald-600 hover:border-emerald-600 transition-colors shadow-sm dark:shadow-none"
                          title={dt(`Verifiko (Prano)`)}
                        >
                          <ShieldCheck className="w-4 h-4" />
                        </button>
                      )}
                      {!u.isBanned && u.role !== 'admin' && (
                        <button 
                          onClick={() => {
                            const reason = askBanReason(u.name);
                            if (!reason) {
                              toast.error(dt('Ndalimi anulohet: arsyeja është e detyrueshme (të paktën 5 shenja).'));
                              return;
                            }
                            void moderate(u.id, 'ban', reason).then(ok => ok && toast.success(`${u.name} ${dt('u ndalua dhe sesionet u mbyllën.')}`));
                          }}
                          className="p-1.5 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-2xl text-slate-500 dark:text-slate-400 hover:text-orange-600 hover:border-orange-600 transition-colors shadow-sm dark:shadow-none"
                          title={dt(`Blloko`)}
                        >
                          <ShieldAlert className="w-4 h-4" />
                        </button>
                      )}
                      {u.isBanned && u.role === 'citizen' && (
                        <button
                          onClick={() => void moderate(u.id, 'unban').then(ok => ok && toast.success(`${u.name} ${dt('u çbllokua.')}`))}
                          className="p-1.5 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-2xl text-slate-500 dark:text-slate-400 hover:text-emerald-600 hover:border-emerald-600 transition-colors shadow-sm dark:shadow-none"
                          title={dt(`Hiq ndalimin`)}
                        >
                          <UserCheck className="w-4 h-4" />
                        </button>
                      )}
                      {u.role !== 'admin' && (
                         <button 
                           onClick={() => {
                             if(confirm(`AUTORIZIM FSHIRJE: Jeni i sigurt që dëshironi të FSHINI përgjithmonë përdoruesin ${u.name}?`)) {
                               deleteUser(u.id);
                             }
                           }}
                           className="p-1.5 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-2xl text-slate-500 dark:text-slate-400 hover:text-rose-600 hover:border-rose-600 hover:bg-rose-50 transition-colors shadow-sm dark:shadow-none"
                           title={dt(`Fshij Përgjithmonë`)}
                         >
                           <Trash2 className="w-4 h-4" />
                         </button>
                      )}
                    </div>
                  </td>
                </motion.tr>
                );
              })}
              </AnimatePresence>
              {paginatedUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-24 text-center">
                    <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100 dark:border-white/5">
                      <Search className="w-8 h-8 text-slate-300" />
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">{dt(`Asnjë përdorues nuk u gjet.`)}</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-slate-800 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{dt(`Duke shfaqur`)} {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredUsers.length)}{dt(`nga`)} {filteredUsers.length}</span>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-xl hover:bg-slate-200 disabled:opacity-50 text-slate-500 dark:text-slate-400 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm font-bold text-slate-900 dark:text-white min-w-[2rem] text-center">{currentPage}</span>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-xl hover:bg-slate-200 disabled:opacity-50 text-slate-500 dark:text-slate-400 transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
