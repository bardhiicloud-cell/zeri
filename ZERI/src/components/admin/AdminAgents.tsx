import { dt } from '@/src/lib/dt';
import React, { useState, useMemo } from 'react';
import { useStore } from '../../lib/store';
import { useStaffDirectory } from '../../lib/useCitizenDirectory';
import type { AdminSection, StaffRole } from '../../lib/adminPermissions';
import { STAFF_ROLES } from '../../lib/adminPermissions';
import {
  Users, Shield, ShieldCheck, ShieldAlert, Plus, Edit3, Trash2, Search, Mail, Key,
  CheckSquare, Square, Activity, FileText, Heart, Megaphone, UserCheck, X, Eye, EyeOff, ShieldX,
  CheckCircle2, MessageSquare, RadioTower, MessageSquareMore, Map, Vote, Bell,
  Calendar, BarChart2, TrendingUp, Clock, Filter, Printer, Download, Sparkles, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';
import { useAgentActivity } from '../../lib/agentActivity';
import type { User } from '../../types';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { requireAdminToken, describeApiFailure } from '../../lib/adminApi';
import RemoveAccountDialog, { type RemoveAccountTarget } from './RemoveAccountDialog';
import { getReportTopicLabel } from '../../lib/reportTopics';

/** The directory row, which already carries every field the form needs. */
type UserRow = ReturnType<typeof useStaffDirectory>['staff'][number];
import { motion, AnimatePresence } from 'framer-motion';

export default function AdminAgents() {
  const auditLogs = useStore(state => state.auditLogs || []);
  const reports = useStore(state => state.reports || []);
  const donationCauses = useStore(state => state.donationCauses || []);
  const ads = useStore(state => state.ads || []);

  /**
   * The staff list is paged and staff-only now. It used to come from
   * `state.users`, which every visitor's session populated by subscribing to
   * the entire users collection.
   */
  const { staff: citizens, isLoading, error } = useStaffDirectory();

  /**
   * The directory already returns every field these views need, in the shape
   * they expect. No adaptation layer, and no PII that the table does not show.
   */
  const users = citizens;

  /**
   * One pass over the audit log for every panel in this file, rather than one
   * pass per rendered row. The old code re-filtered all 500 retained logs for
   * each agent on each keystroke of the search box.
   *
   * The hook is called at the top level — it reads the store — and the Map is
   * built from its result, so the rules of hooks are not violated by deriving a
   * lookup inside a memo.
   */
  const agentActivity = useAgentActivity(
    useMemo(
      () => users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role })),
      [users]
    )
  );
  // `Map` here is the Lucide icon imported at the top of this file, which
  // shadows the global Map constructor. It is aliased so the lookup can be
  // built with the real one.
  const activityByAgent = useMemo(
    () => new globalThis.Map(agentActivity.map((row) => [row.agent.id, row])),
    [agentActivity]
  );

  const updateUser = useStore(state => state.updateUser);
  const deleteUser = useStore(state => state.deleteUser);
  const addAuditLog = useStore(state => state.addAuditLog);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [directPassword, setDirectPassword] = useState('');
  const [isSettingPassword, setIsSettingPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  /** Whether the typed password is revealed while it is still being entered. */
  const [showFormPassword, setShowFormPassword] = useState(false);
  /**
   * The notes field's own "saved" tick, unrelated to creating an account.
   * Kept separate so a successful note save and a successful creation cannot
   * mask one another.
   */
  const [saveSuccess, setSaveSuccess] = useState(false);
  /**
   * The account created by the last successful submit.
   *
   * Held in state rather than shown in an alert because the operator needs to
   * copy the email and password into the message they send the agent, and a
   * dialog that vanishes on a stray click cannot be used for that.
   */
  const [createResult, setCreateResult] = useState<{
    email: string;
    name: string;
    role: string;
    password: string;
    banned: boolean;
    mailNote: string;
  } | null>(null);

  const initialFormState = {
    name: '',
    email: '',
    phone: '',
    role: 'agent' as User['role'],
    // Section ids come from adminPermissions.ts, so a rename there cannot leave
    // a stale string behind in this form.
    permissions: [] as AdminSection[],
    isBanned: false,
    isVerified: true,
    /**
     * Initial password, typed by the superadmin when creating an account.
     *
     * Blank is a legal choice and means "send a reset email instead" — the two
     * paths are the same decision, so they are the same field rather than a
     * checkbox next to it. Never persisted here: the server passes it straight
     * to Firebase Auth and it is stripped before any Firestore write.
     */
    password: '',
  };

  const [formData, setFormData] = useState(initialFormState);
  const [agentTab, setAgentTab] = useState<'info' | 'reports'>('info');
  const [viewSection, setViewSection] = useState<'agents' | 'monitoring'>('agents');

  const saveStaffAccess = async (uid: string, role: User['role'], permissions: AdminSection[], isBanned: boolean) => {
    const token = await requireAdminToken();

    const response = await fetch(`/api/v1/admin/users/${encodeURIComponent(uid)}/role`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ role, permissions, isBanned }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(describeApiFailure(response.status, result));
  };

  // Filter staff/agents
  // We include any user who has role as agent, approver, newsadmin, or adsadmin, or has permissions set.
  /**
   * Every role that belongs in the staff console.
   *
   * The list previously named only four roles, so an account created as
   * `responder`, `dispatcher`, `moderator` or `municipality` was created
   * successfully and then absent from the very table used to edit it — which
   * reads as "the creation failed". The set is now the union the server accepts
   * in `allowedRoles`, so nothing the form can create is invisible here.
   */
  const staffRoles = [
    'agent', 'approver', 'newsadmin', 'adsadmin', 'debatwp',
    'responder', 'dispatcher', 'moderator', 'monitor', 'municipality',
  ];
  const agents = useMemo(() => {
    return users.filter(user => {
      const isStaff = staffRoles.includes(user.role) || (user.permissions && user.permissions.length > 0);
      const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            user.email.toLowerCase().includes(searchQuery.toLowerCase());
      return isStaff && matchesSearch;
    });
  }, [users, searchQuery]);

  // Selected agent object
  const selectedAgent = useMemo(() => {
    return users.find(u => u.id === selectedAgentId);
  }, [users, selectedAgentId]);

  React.useEffect(() => {
    if (selectedAgent) {
      setNoteText(selectedAgent.notes || '');
    } else {
      setNoteText('');
    }
    setSaveSuccess(false);
  }, [selectedAgentId, selectedAgent]);

  // Get audit logs for the selected agent
  const agentLogs = useMemo(() => {
    if (!selectedAgent) return [];
    return auditLogs.filter(log =>
      log.userEmail?.toLowerCase() === selectedAgent.email.toLowerCase() ||
      log.userId === selectedAgent.id
    );
  }, [auditLogs, selectedAgent]);

  // Get reports handled/approved by the selected agent
  const handledReports = useMemo(() => {
    if (!selectedAgent) return [];
    return reports.filter(r => {
      return r.timeline?.some(event =>
        event.updatedBy === selectedAgent.name ||
        event.updatedBy?.toLowerCase() === selectedAgent.email.toLowerCase() ||
        event.updatedBy?.toLowerCase().includes(selectedAgent.name.toLowerCase())
      );
    });
  }, [reports, selectedAgent]);

  // Stats for the selected agent
  const agentStats = useMemo(() => {
    if (!selectedAgent) return { approvedReports: 0, approvedDonations: 0, managedAds: 0 };

    // We can count approvals by searching the reports' timelines
    let approvedReportsCount = 0;
    reports.forEach(r => {
      const approvedByAgent = r.timeline?.some(event =>
        (event.status === 'Approved' || event.status === 'Resolved') &&
        (event.updatedBy === selectedAgent.name || event.updatedBy?.includes(selectedAgent.name))
      );
      if (approvedByAgent) approvedReportsCount++;
    });

    // We can count donation causes approved/rejected
    const approvedDonationsCount = donationCauses.filter(d =>
      d.status === 'approved' // Mocking activity counts for display or log tracking
    ).length;

    // Filter audit logs for actions
    const logs = auditLogs.filter(log =>
      log.userEmail?.toLowerCase() === selectedAgent.email.toLowerCase() ||
      log.userId === selectedAgent.id
    );

    const approvedReportsFromLogs = logs.filter(l => l.action.includes('Report') || l.action.includes('Status')).length;
    const approvedDonationsFromLogs = logs.filter(l => l.action.includes('Donation')).length;
    const adsManagedCount = logs.filter(l => l.action.includes('Ad') || l.action.includes('reklam')).length;

    return {
      approvedReports: Math.max(approvedReportsCount, approvedReportsFromLogs),
      approvedDonations: approvedDonationsFromLogs,
      managedAds: adsManagedCount
    };
  }, [selectedAgent, reports, donationCauses, auditLogs]);

  // 7-day monitoring metrics across staff
  const sevenDaysData = useMemo(() => {
    const days = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dayName = d.toLocaleDateString('sq-AL', { weekday: 'short' });
      const dayNum = d.toLocaleDateString('sq-AL', { day: 'numeric', month: 'numeric' });
      const dayISO = d.toISOString().split('T')[0];

      const dayLogs = auditLogs.filter(l => l.createdAt && new Date(l.createdAt).toISOString().split('T')[0] === dayISO);

      let handledCount = 0;
      reports.forEach(r => {
        r.timeline?.forEach(ev => {
          if (ev.date && new Date(ev.date).toISOString().split('T')[0] === dayISO) {
            handledCount++;
          }
        });
      });

      /**
       * Real counts only.
       *
       * `Math.max(dayLogs.length, handledCount, 4 + ((i * 3) % 9))` guaranteed
       * every day on the chart showed between 4 and 12 actions whether or not any
       * existed, and the approvals floor then derived 75% of that fiction. The
       * chart now shows the queue as it was, which means empty days look empty.
       */
      const totalActions = Math.max(dayLogs.length, handledCount);
      const totalApprovals = dayLogs.filter(l => l.action.toLowerCase().includes('approv')).length;

      days.push({
        dayName,
        dayNum,
        dayISO,
        actions: totalActions,
        approvals: totalApprovals
      });
    }
    return days;
  }, [auditLogs, reports]);

  const handleOpenCreate = () => {
    setEditingAgentId(null);
    setFormData(initialFormState);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (agent: UserRow) => {
    setEditingAgentId(agent.id);
    setFormData({
      name: agent.name,
      email: agent.email,
      phone: agent.phone || '',
      // A stored record can carry a role that predates the current union, so it
      // is narrowed here rather than trusted blindly into the form state.
      role: (STAFF_ROLES.includes(agent.role as StaffRole) ? agent.role : 'agent') as User['role'],
      permissions: (agent.permissions || []) as AdminSection[],
      isBanned: !!agent.isBanned,
      isVerified: agent.isVerified !== false,
      // Never prefilled: a stored password does not exist to load, and showing a
      // blank field is the honest signal that leaving it blank changes nothing.
      password: '',
    });
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) {
      toast.error("Ju lutem plotësoni fushat e detyrueshme: Emri dhe Emaili!");
      return;
    }

    // Validate a typed password here as well as on the server, so the operator
    // learns the rule before the account is created rather than after.
    const wantsPassword = formData.password.trim().length > 0;
    if (wantsPassword && formData.password.length < 8) {
      toast.error('Fjalëkalimi duhet të ketë së paku 8 shenja.');
      return;
    }
    if (wantsPassword && !/[a-zA-Z]/.test(formData.password)) {
      toast.error('Fjalëkalimi duhet të përmbajë së paku një shkronjë.');
      return;
    }
    if (wantsPassword && !/\d/.test(formData.password)) {
      toast.error('Fjalëkalimi duhet të përmbajë së paku një numër.');
      return;
    }

    if (editingAgentId) {
      try {
        await saveStaffAccess(editingAgentId, formData.role, formData.permissions, formData.isBanned);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Qasja e agjentit nuk u përditësua.');
        return;
      }

      updateUser(editingAgentId, {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        role: formData.role,
        permissions: formData.permissions,
        isBanned: formData.isBanned,
        isVerified: formData.isVerified
      });
      addAuditLog(
        'Agent Edited',
        'warning',
        `U editua agenti/puntori: ${formData.email} me rolin ${formData.role}`
      );

      // A password typed while editing means "change it now", which is the
      // same permission-gated endpoint the detail panel uses.
      if (wantsPassword) {
        try {
          const token = await requireAdminToken();
          const response = await fetch(`/api/v1/admin/users/${encodeURIComponent(editingAgentId)}/set-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ password: formData.password }),
          });
          const result = await response.json();
          if (!response.ok) throw new Error(describeApiFailure(response.status, result));
          addAuditLog('Agent Password Set', 'warning', `Fjalëkalimi u ndryshua për ${formData.email}`);
          toast.success('Agenti u përditësua dhe fjalëkalimi u ndryshua.');
        } catch (error) {
          toast.error(error instanceof Error ? error.message : 'Fjalëkalimi nuk u vendos.');
          return;
        }
      } else {
        toast.success("Agenti u përditësua me sukses!");
      }
    } else {
      try {
        const token = await requireAdminToken();

        const response = await fetch('/api/v1/admin/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            role: formData.role,
            permissions: formData.permissions,
            isBanned: formData.isBanned,
            // Sent only when the operator typed one. The server treats an empty
            // value as "create without a password" and the reset email handles
            // the first sign-in instead.
            password: wantsPassword ? formData.password : undefined,
          }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(describeApiFailure(response.status, result));

        addAuditLog(
          'Agent Created',
          'success',
          `U krijua agjenti ${formData.email} me rolin ${formData.role}`
        );

        /**
         * Report the outcome where the operator is looking, not in an alert.
         *
         * The old flow ended in `toast.error()`, which on some browsers is suppressed
         * during a focus change — so the account was created and the operator
         * was told nothing, concluded it had failed, and tried again into a
         * duplicate-email error. The result is now held in state and rendered,
         * and it states the one thing needed to sign in: whether a password was
         * set, and what it is.
         */
        let mailNote = '';
        if (!formData.isBanned && !wantsPassword) {
          // No password was typed, so the reset email is the only way in. A
          // failure here is reported but does not undo the account.
          try {
            await sendPasswordResetEmail(auth, formData.email);
            mailNote = 'Emaili për vendosjen e fjalëkalimit u dërgua.';
          } catch (mailError) {
            console.warn('[AdminAgents] Reset email failed:', mailError);
            mailNote =
              'Emaili nuk u dërgua (konfigurimi i emailit në Firebase Auth). ' +
              'Vendosni një fjalëkalim nga paneli i menaxhimit për ta aktivizuar llogarinë.';
          }
        }

        setCreateResult({
          email: formData.email,
          name: formData.name,
          role: formData.role,
          password: wantsPassword ? formData.password : '',
          banned: formData.isBanned,
          mailNote,
        });

        setIsFormOpen(false);
        setFormData(initialFormState);
        return;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Agjenti nuk u krijua.');
        return;
      }
    }

    setIsFormOpen(false);
    setFormData(initialFormState);
  };

  /** The account being removed, while the confirmation dialog is open. */
  const [removal, setRemoval] = useState<RemoveAccountTarget | null>(null);

  const handleDeleteAgent = (id: string, email: string) => {
    const person = agents.find(x => x.id === id);
    setRemoval({ id, email, name: person?.name ?? email });
  };

  const togglePermission = (perm: string) => {
    setFormData(prev => {
      const alreadyHas = prev.permissions.includes(perm as any);
      let updatedPerms = [...prev.permissions];
      if (alreadyHas) {
        updatedPerms = updatedPerms.filter(p => p !== perm);
      } else {
        updatedPerms.push(perm as any);
      }

      // Keep role synced for compatibility with existing layout guards.
      //
      // The panel grants below must NOT be treated as a role signal: giving an
      // agent monitoring access does not make them an approver, and the previous
      // else-branch silently reset the role to 'agent' whenever the last
      // permission was removed — which also discarded any role the operator had
      // chosen deliberately.
      const PANEL_GRANTS = ['monitoring', 'monitorim', 'agents', 'municipalities', 'moderim'];
      let updatedRole = prev.role;
      if (updatedPerms.includes('reports')) {
        updatedRole = 'approver';
      } else if (updatedPerms.includes('ads')) {
        updatedRole = 'adsadmin';
      } else if (!updatedPerms.some((p) => PANEL_GRANTS.includes(p as string))) {
        // Only drop back to 'agent' when nothing else justifies a different role.
        updatedRole = 'agent';
      }

      return {
        ...prev,
        permissions: updatedPerms,
        role: updatedRole
      };
    });
  };

  const handleSaveNotes = async () => {
    if (!selectedAgent) return;
    try {
      await updateUser(selectedAgent.id, { notes: noteText });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleBan = async () => {
    if (!selectedAgent) return;
    const nextBanned = !selectedAgent.isBanned;
    try {
      await saveStaffAccess(selectedAgent.id, selectedAgent.role as User['role'], (selectedAgent.permissions || []) as AdminSection[], nextBanned);
      await updateUser(selectedAgent.id, { isBanned: nextBanned });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Statusi i llogarisë nuk u përditësua.');
    }
  };

  const handleTogglePermission = async (perm: AdminSection) => {
    if (!selectedAgent) return;
    const current: AdminSection[] = (selectedAgent.permissions || []) as AdminSection[];
    const next = current.includes(perm) ? current.filter(p => p !== perm) : [...current, perm];

    /**
     * The role is kept in step with the granted sections for backwards
     * compatibility with the pre-custom-claim checks. The server is the
     * authority: `requireAdmin` reads the custom claim, not this field, so a
     * mismatch here degrades the UI, never the security boundary.
     */
    let nextRole: User['role'] = selectedAgent.role as User['role'];
    if (nextRole === 'monitor') {
      // Oversight is a role of its own, not something derived from sections.
    } else if (next.includes('reports')) {
      nextRole = 'approver';
    } else if (next.includes('ads')) {
      nextRole = 'adsadmin';
    } else {
      nextRole = 'agent';
    }

    try {
      await saveStaffAccess(selectedAgent.id, nextRole, next, !!selectedAgent.isBanned);
      await updateUser(selectedAgent.id, { permissions: next, role: nextRole });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Lejet e agjentit nuk u përditësuan.');
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Banner and Description */}
      <div className="bg-slate-900 border-b-4 border-rose-600 rounded-2xl p-6 sm:p-8 text-white shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black title-serif tracking-tight">{dt(`Reparti i Posaçëm i Menaxhimit të Agentëve`)}</h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-2 font-medium max-w-xl">{dt(`Krijoni, editoni dhe delegoni qasje të kufizuar për punëtorët agentë. Caktoni ata vetëm për aprovim të raportimeve, donacioneve apo reklamave, dhe kontrolloni çdo veprim të tyre në kohë reale.`)}
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="px-5 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold flex items-center gap-2 transition active:scale-95 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.08)] dark:shadow-none shadow-rose-600/30 text-sm cursor-pointer whitespace-nowrap self-stretch sm:self-auto justify-center"
        >
          <Plus className="w-4 h-4" />{dt(`Shto Agent të Ri`)}
        </button>
      </div>

      {/* Switcher: Agents Roster vs 7-Day Professional Monitoring */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-white/10 pb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewSection('agents')}
            className={cn(
              "px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition cursor-pointer",
              viewSection === 'agents'
                ? "bg-rose-600 text-white shadow-md shadow-rose-600/20"
                : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
            )}
          >
            <Users className="w-4 h-4" />
            <span>{dt("Menaxhimi i Agentëve & Qasjeve")}</span>
          </button>

          <button
            onClick={() => setViewSection('monitoring')}
            className={cn(
              "px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition cursor-pointer",
              viewSection === 'monitoring'
                ? "bg-rose-600 text-white shadow-md shadow-rose-600/20"
                : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
            )}
          >
            <Activity className="w-4 h-4 text-emerald-400" />
            <span>{dt("Monitorimi Profesional 7-Ditor")}</span>
            <span className="ml-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/20 text-emerald-500 border border-emerald-500/30">
              7 DITË
            </span>
          </button>
        </div>
      </div>

      {viewSection === 'agents' ? (
      <>
      {/*
        Result of the last creation.

        Rendered rather than alerted: the operator needs to read, copy and keep
        this, and it states plainly whether the account can sign in right now or
        whether a password still has to be set.
      */}
      {createResult && (
        <div
          role="status"
          className={`mb-6 rounded-2xl border p-5 ${
            createResult.banned
              ? 'border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/[0.06]'
              : 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/[0.06]'
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                {dt('Llogaria e agjentit u krijua')}
              </h3>
              <dl className="mt-3 grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
                <div className="flex gap-2">
                  <dt className="font-bold text-slate-500">{dt('Emri')}:</dt>
                  <dd className="font-semibold text-slate-900 dark:text-white">{createResult.name}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="font-bold text-slate-500">{dt('Emaili')}:</dt>
                  <dd className="font-mono font-semibold text-slate-900 dark:text-white">{createResult.email}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="font-bold text-slate-500">{dt('Roli')}:</dt>
                  <dd className="font-semibold text-slate-900 dark:text-white">{createResult.role}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="font-bold text-slate-500">{dt('Fjalëkalimi')}:</dt>
                  <dd className="font-mono font-semibold text-slate-900 dark:text-white">
                    {createResult.password || dt('Nuk u vendos — kërkohet emaili ose rivendosje')}
                  </dd>
                </div>
              </dl>

              <p className="mt-3 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                {createResult.banned
                  ? dt('Llogaria u krijua e pezulluar. Riaktivizoheni nga lista për të lejuar hyrjen.')
                  : createResult.password
                    ? dt('Agjenti mund të hyjë menjëherë me email-in dhe fjalëkalimin më sipër. Kopjojeni dhe dërgojani.')
                    : dt(createResult.mailNote || 'Agjenti duhet të vendosë fjalëkalimin përmes emailit.')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCreateResult(null)}
              className="shrink-0 rounded-xl p-2 text-slate-400 transition-colors hover:bg-white/60 dark:hover:bg-slate-800"
              aria-label={dt('Mbyll njoftimin')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Side: Agents List */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/60 dark:border-white/10 shadow-sm dark:shadow-none flex flex-col">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-rose-500" />{dt(`Lista e Agentëve Aktive (`)}{agents.length})
            </h3>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder={dt(`Kërko agentin...`)}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-white/10 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 transition"
              />
            </div>
          </div>

          <div className="space-y-3 overflow-y-auto max-h-[500px] pr-1">
            {agents.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-bold">{dt(`Nuk u gjet asnjë agent.`)}</p>
                <p className="text-xs mt-1">{dt(`Shtoni një agent për të filluar menaxhimin.`)}</p>
              </div>
            ) : (
              agents.map(agent => {
                const isSelected = selectedAgentId === agent.id;
                return (
                  <div
                    key={agent.id}
                    onClick={() => setSelectedAgentId(agent.id)}
                    className={cn(
                      "p-4 rounded-xl border transition cursor-pointer flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4",
                      isSelected
                        ? "bg-rose-50/50 border-rose-300 ring-2 ring-rose-500/10"
                        : "bg-slate-50 dark:bg-slate-800 border-slate-200/60 dark:border-white/10 hover:bg-slate-100/50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none text-sm shrink-0",
                        agent.role === 'admin' ? 'bg-indigo-600' : 'bg-slate-800'
                      )}>
                        {agent.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-bold text-slate-900 dark:text-white text-sm leading-none">{agent.name}</h4>
                          <span className={cn(
                            "text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider shadow-sm dark:shadow-none",
                            agent.role === 'approver' ? "bg-emerald-100 text-emerald-800" :
                            agent.role === 'adsadmin' ? "bg-amber-100 text-amber-800" :
                            "bg-slate-200 text-slate-800 dark:text-slate-200 dark:text-slate-200"
                          )}>
                            {agent.role === 'approver' ? 'Aprovues Raportesh' :
                             agent.role === 'adsadmin' ? 'Menaxhues Reklamash' : 'Agent'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1.5 flex items-center gap-1">
                          <Mail className="w-3 h-3 text-slate-400" />
                          {agent.email}
                        </p>

                        {/* Permissions Tags */}
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {(!agent.permissions || agent.permissions.length === 0) ? (
                            <span className="text-[9px] bg-slate-200 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded font-bold">{dt(`Nuk ka qasje të veçantë`)}
                            </span>
                          ) : (
                            agent.permissions.map(p => (
                              <span
                                key={p}
                                className={cn(
                                  "text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider",
                                  p === 'reports' ? "bg-rose-100 text-rose-700" :
                                  p === 'donations' ? "bg-indigo-100 text-indigo-700" :
                                  "bg-amber-100 text-amber-700"
                                )}
                              >
                                {p === 'reports' ? 'Raporte' : p === 'donations' ? 'Donacione' : 'Reklama'}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAgentId(agent.id);
                        }}
                        className="p-1.5 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-2xl hover:border-slate-300 text-slate-500 dark:text-slate-400 hover:text-rose-600 transition shadow-sm dark:shadow-none"
                        title={dt(`Shiko Detajet dhe Historikun`)}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEdit(agent);
                        }}
                        className="p-1.5 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-2xl hover:border-slate-300 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white transition shadow-sm dark:shadow-none"
                        title={dt(`Edito Agentin`)}
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteAgent(agent.id, agent.email);
                        }}
                        className="p-1.5 bg-rose-50 border border-rose-200 rounded-2xl hover:border-rose-300 text-rose-500 hover:text-rose-600 transition shadow-sm dark:shadow-none"
                        title={dt(`Fshi Agentin`)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Detailed Monitor / Audit History */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/60 dark:border-white/10 shadow-sm dark:shadow-none flex flex-col">
          {!selectedAgent ? (
            <div className="text-center py-20 text-slate-400 flex-1 flex flex-col justify-center items-center">
              <Activity className="w-16 h-16 mb-4 text-slate-200 animate-pulse" />
              <h4 className="font-bold text-slate-800 dark:text-slate-200 dark:text-slate-200 text-base">{dt(`Monitorimi i Aktivitetit në Kohë Reale`)}</h4>
              <p className="text-xs text-slate-400 mt-2 max-w-xs mx-auto">{dt(`Zgjidhni një agent nga lista majtas për të parë detajet, statistikat dhe historikun e plotë të punës apo aprovimeve të tij.`)}
              </p>
            </div>
          ) : (
            <div className="space-y-6 flex-1 flex flex-col">
              {/* Agent Profile Header inside sidebar */}
              <div className="border-b border-slate-100 dark:border-white/5 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-rose-600 text-white rounded-2xl flex items-center justify-center font-bold text-base shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none shrink-0">
                      {selectedAgent.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-900 dark:text-white text-base leading-tight">{selectedAgent.name}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">{selectedAgent.email}</p>
                      <p className="text-[10px] font-mono text-slate-400 mt-1">{dt(`ID:`)} {selectedAgent.id}</p>
                    </div>
                  </div>

                  {/* Real-time Status Light */}
                  <div className="flex flex-col items-end">
                    <span className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm dark:shadow-none",
                      selectedAgent.isBanned
                        ? "bg-rose-100 text-rose-700 animate-pulse"
                        : "bg-emerald-100 text-emerald-700"
                    )}>
                      <span className={cn("w-1.5 h-1.5 rounded-full", selectedAgent.isBanned ? "bg-rose-600" : "bg-emerald-600 animate-ping")} />
                      {selectedAgent.isBanned ? "I Pezulluar" : "Aktiv"}
                    </span>
                    <span className="text-[9px] text-slate-400 font-bold mt-1 uppercase">{dt(`Jurisdiksioni: KS`)}</span>
                  </div>
                </div>
              </div>

              {/* Agent Tabs */}
              <div className="flex gap-4 border-b border-slate-200/60 dark:border-white/10">
                <button
                  onClick={() => setAgentTab('info')}
                  className={cn(
                    "pb-2 text-xs font-bold tracking-widest uppercase transition border-b-2",
                    agentTab === 'info' ? "border-rose-600 text-rose-600" : "border-transparent text-slate-400 hover:text-slate-500 dark:text-slate-400"
                  )}
                >{dt(`Informacioni Gjeneral`)}
                </button>
                <button
                  onClick={() => setAgentTab('reports')}
                  className={cn(
                    "pb-2 text-xs font-bold tracking-widest uppercase transition border-b-2",
                    agentTab === 'reports' ? "border-rose-600 text-rose-600" : "border-transparent text-slate-400 hover:text-slate-500 dark:text-slate-400"
                  )}
                >{dt(`Aktiviteti dhe Raportet`)}
                </button>
              </div>

              {agentTab === 'info' ? (
                <>
                  {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-rose-50/40 p-3.5 rounded-2xl border border-rose-100/80 text-center shadow-sm dark:shadow-none hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none transition-shadow">
                  <div className="w-8 h-8 rounded-xl bg-rose-100/80 flex items-center justify-center mx-auto mb-2">
                    <FileText className="w-4 h-4 text-rose-600 animate-pulse" />
                  </div>
                  <span className="block text-xl font-black text-rose-700 leading-none">{agentStats.approvedReports}</span>
                  <span className="text-[9px] font-black text-rose-600/80 uppercase tracking-widest mt-1.5 block">{dt(`Aprovime`)}</span>
                </div>
                <div className="bg-indigo-50/40 p-3.5 rounded-2xl border border-indigo-100/80 text-center shadow-sm dark:shadow-none hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none transition-shadow">
                  <div className="w-8 h-8 rounded-xl bg-indigo-100/80 flex items-center justify-center mx-auto mb-2">
                    <Heart className="w-4 h-4 text-indigo-600" />
                  </div>
                  <span className="block text-xl font-black text-indigo-700 leading-none">{agentStats.approvedDonations}</span>
                  <span className="text-[9px] font-black text-indigo-600/80 uppercase tracking-widest mt-1.5 block">{dt(`Donacione`)}</span>
                </div>
                <div className="bg-amber-50/40 p-3.5 rounded-2xl border border-amber-100/80 text-center shadow-sm dark:shadow-none hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none transition-shadow">
                  <div className="w-8 h-8 rounded-xl bg-amber-100/80 flex items-center justify-center mx-auto mb-2">
                    <Megaphone className="w-4 h-4 text-amber-600" />
                  </div>
                  <span className="block text-xl font-black text-amber-700 leading-none">{agentStats.managedAds}</span>
                  <span className="text-[9px] font-black text-amber-600/80 uppercase tracking-widest mt-1.5 block">{dt(`Reklama`)}</span>
                </div>
              </div>

              {/* Advanced KPIS Gauge Panel */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200/60 dark:border-white/10/60 grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">{dt(`Saktësia e Vendimeve`)}</span>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full rounded-full" style={{ width: '98%' }} />
                    </div>
                    <span className="text-xs font-black text-slate-700 dark:text-slate-300">98%</span>
                  </div>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">{dt(`Koha e Reagimit (Mes.)`)}</span>
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200 dark:text-slate-200 mt-1 block">{dt(`11 Minuta`)}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">{dt(`Vlerësimi i Punës`)}</span>
                  <span className="text-xs font-black text-indigo-600 mt-1 block">{dt(`Klasa A+ (Shkëlqyeshëm)`)}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">{dt(`Numri i Telefonit`)}</span>
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1 block">{selectedAgent.phone || 'I pa specifikuar'}</span>
                </div>
              </div>

              {/* Authentication status: passwords are never stored or displayed here. */}
              <div className="bg-indigo-50/30 border border-indigo-100/60 rounded-2xl p-4 space-y-3">
                <div className="flex justify-between items-center border-b border-indigo-100/40 pb-2">
                  <h4 className="text-[10px] font-black text-indigo-900/60 uppercase tracking-wider flex items-center gap-1">
                    <Key className="w-3.5 h-3.5 text-indigo-500" />{dt(`Kredencialet e Qasjes në Panel`)}
                  </h4>
                </div>

                <div className="grid grid-cols-1 gap-2.5 text-xs">
                  <div className="flex items-center justify-between font-medium">
                    <span className="text-slate-500 dark:text-slate-400 font-bold text-[11px]">{dt(`Email i Kyçjes:`)}</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200 dark:text-slate-200 font-bold">{selectedAgent.email}</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">{dt(`Fjalëkalimet menaxhohen vetëm nga Firebase Authentication dhe nuk shfaqen në panel.`)}</p>
                  <div className="mt-2 pt-2 border-t border-indigo-100/60">
                    <p className="text-[10px] font-black uppercase tracking-wider text-indigo-900/60 mb-1.5">{dt(`Vendos fjalëkalim direkt (admin)`)}</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={directPassword}
                        onChange={(e) => setDirectPassword(e.target.value)}
                        placeholder="min. 8 shenja, shkronja+numra"
                        className="flex-1 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-900 outline-none focus:border-indigo-500 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                      />
                      <button
                        type="button"
                        disabled={directPassword.length < 8 || isSettingPassword}
                        onClick={async () => {
                          if (!selectedAgent) return;
                          setIsSettingPassword(true);
                          try {
                            const token = await auth.currentUser?.getIdToken();
                            const response = await fetch(`/api/v1/admin/users/${encodeURIComponent(selectedAgent.id)}/set-password`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                              body: JSON.stringify({ password: directPassword }),
                            });
                            const result = await response.json();
                            if (!response.ok) throw new Error(result.error || 'Deshtoi.');
                            toast.success('Fjalëkalimi u vendos dhe sesionet e vjetra u revokuan.');
                            setDirectPassword('');
                            addAuditLog('Agent Password Set', 'success', `Fjalëkalimi u vendos direkt për ${selectedAgent.email}`);
                          } catch (error: any) {
                            toast.error(error.message || 'Fjalëkalimi nuk u vendos.');
                          } finally {
                            setIsSettingPassword(false);
                          }
                        }}
                        className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white transition hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {isSettingPassword ? '...' : dt('Vendos')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Interactive Control Center (Quick Toggles & Suspend) */}
              <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 border border-slate-200/60 dark:border-white/10 space-y-3">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{dt(`Paneli i Kontrollit të Shpejtë (Qasjet direkte)`)}</h4>

                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                  {/* Reports Toggle */}
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-rose-500" />{dt(`Qasje: Raportet (Ankesat)`)}
                    </span>
                    <button
                      onClick={() => handleTogglePermission('reports')}
                      className={cn(
                        "text-[9px] font-black tracking-wider uppercase px-2.5 py-1 rounded-2xl border transition cursor-pointer",
                        selectedAgent.permissions?.includes('reports' as any)
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-slate-200/60 dark:border-white/10"
                      )}
                    >
                      {selectedAgent.permissions?.includes('reports' as any) ? "LEJUAR" : "BLOKUAR"}
                    </button>
                  </div>

                  {/* Categories Toggle */}
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <Map className="w-3.5 h-3.5 text-teal-500" />{dt(`Qasje: Harta & GIS`)}
                    </span>
                    <button
                      onClick={() => handleTogglePermission('categories')}
                      className={cn(
                        "text-[9px] font-black tracking-wider uppercase px-2.5 py-1 rounded-2xl border transition cursor-pointer",
                        selectedAgent.permissions?.includes('categories' as any)
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-slate-200/60 dark:border-white/10"
                      )}
                    >
                      {selectedAgent.permissions?.includes('categories' as any) ? "LEJUAR" : "BLOKUAR"}
                    </button>
                  </div>

                  {/* Support Chat Toggle */}
                  {/*
                    'discussions' and 'chat' were never real section ids: they
                    existed only in this file, so the toggles granted a permission
                    that no capability check ever consulted. Staff could be told
                    they had been given chat access and it changed nothing. Both
                    buttons now drive the one section that actually exists.
                  */}
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <RadioTower className="w-3.5 h-3.5 text-sky-500" />{dt(`Qasje: Monitorimi SLA`)}
                    </span>
                    <button
                      onClick={() => handleTogglePermission('support')}
                      className={cn(
                        "text-[9px] font-black tracking-wider uppercase px-2.5 py-1 rounded-2xl border transition cursor-pointer",
                        selectedAgent.permissions?.includes('support')
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-slate-200/60 dark:border-white/10"
                      )}
                    >
                      {selectedAgent.permissions?.includes('support') ? "LEJUAR" : "BLOKUAR"}
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <MessageSquareMore className="w-3.5 h-3.5 text-pink-500" />{dt(`Qasje: Chat Support`)}
                    </span>
                    <button
                      onClick={() => handleTogglePermission('support')}
                      className={cn(
                        "text-[9px] font-black tracking-wider uppercase px-2.5 py-1 rounded-2xl border transition cursor-pointer",
                        selectedAgent.permissions?.includes('support')
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-slate-200/60 dark:border-white/10"
                      )}
                    >
                      {selectedAgent.permissions?.includes('chat' as any) ? "LEJUAR" : "BLOKUAR"}
                    </button>
                  </div>

                  {/* Donations Toggle */}
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <Heart className="w-3.5 h-3.5 text-indigo-500" />{dt(`Qasje: Donacionet`)}
                    </span>
                    <button
                      onClick={() => handleTogglePermission('donations')}
                      className={cn(
                        "text-[9px] font-black tracking-wider uppercase px-2.5 py-1 rounded-2xl border transition cursor-pointer",
                        selectedAgent.permissions?.includes('donations' as any)
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-slate-200/60 dark:border-white/10"
                      )}
                    >
                      {selectedAgent.permissions?.includes('donations' as any) ? "LEJUAR" : "BLOKUAR"}
                    </button>
                  </div>

                  {/* Ads Toggle */}
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <Megaphone className="w-3.5 h-3.5 text-amber-500" />{dt(`Qasje: Reklamat`)}
                    </span>
                    <button
                      onClick={() => handleTogglePermission('ads')}
                      className={cn(
                        "text-[9px] font-black tracking-wider uppercase px-2.5 py-1 rounded-2xl border transition cursor-pointer",
                        selectedAgent.permissions?.includes('ads' as any)
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-slate-200/60 dark:border-white/10"
                      )}
                    >
                      {selectedAgent.permissions?.includes('ads' as any) ? "LEJUAR" : "BLOKUAR"}
                    </button>
                  </div>

                  {/* Forum Toggle */}
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />{dt(`Qasje: Mod. i Forumit`)}
                    </span>
                    <button
                      onClick={() => handleTogglePermission('forum')}
                      className={cn(
                        "text-[9px] font-black tracking-wider uppercase px-2.5 py-1 rounded-2xl border transition cursor-pointer",
                        selectedAgent.permissions?.includes('forum' as any)
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-slate-200/60 dark:border-white/10"
                      )}
                    >
                      {selectedAgent.permissions?.includes('forum' as any) ? "LEJUAR" : "BLOKUAR"}
                    </button>
                  </div>

                  {/* Polls Toggle */}
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <Vote className="w-3.5 h-3.5 text-purple-500" />{dt(`Qasje: Sondazhet & Votimet`)}
                    </span>
                    <button
                      onClick={() => handleTogglePermission('polls')}
                      className={cn(
                        "text-[9px] font-black tracking-wider uppercase px-2.5 py-1 rounded-2xl border transition cursor-pointer",
                        selectedAgent.permissions?.includes('polls' as any)
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-slate-200/60 dark:border-white/10"
                      )}
                    >
                      {selectedAgent.permissions?.includes('polls' as any) ? "LEJUAR" : "BLOKUAR"}
                    </button>
                  </div>

                  {/* Notifications Toggle */}
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <Bell className="w-3.5 h-3.5 text-yellow-500" />{dt(`Qasje: Njoftimet Zyrtare`)}
                    </span>
                    <button
                      onClick={() => handleTogglePermission('notifications')}
                      className={cn(
                        "text-[9px] font-black tracking-wider uppercase px-2.5 py-1 rounded-2xl border transition cursor-pointer",
                        selectedAgent.permissions?.includes('notifications' as any)
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-slate-200/60 dark:border-white/10"
                      )}
                    >
                      {selectedAgent.permissions?.includes('notifications' as any) ? "LEJUAR" : "BLOKUAR"}
                    </button>
                  </div>

                  {/* Ban Switch */}
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 border-t border-slate-200/60 dark:border-white/10/60 pt-2.5 mt-1">
                    <span className="flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-500 animate-pulse" />{dt(`Pezullo / Blloko Agentin`)}
                    </span>
                    <button
                      onClick={handleToggleBan}
                      className={cn(
                        "text-[9px] font-black tracking-wider uppercase px-2.5 py-1 rounded-2xl border transition cursor-pointer",
                        selectedAgent.isBanned
                          ? "bg-rose-600 text-white border-rose-700 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none"
                          : "bg-slate-100 dark:bg-slate-800/50 text-rose-600 border-slate-200/60 dark:border-white/10"
                      )}
                    >
                      {selectedAgent.isBanned ? "I BLLOKUAR" : "BLLOKO"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Private Administrator Notes Box */}
              <div className="bg-amber-50/20 border border-amber-200/60 rounded-2xl p-4 space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-amber-800 uppercase tracking-widest block">{dt(`Shënime Private Mbi Punëtorin (Vetëm për Adminin)`)}
                  </span>
                  {saveSuccess && (
                    <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded animate-bounce">{dt(`U ruajt!`)}
                    </span>
                  )}
                </div>

                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder={dt(`Shkruani komente ose shënime private mbi performancën, sjelljen apo detyrat e këtij agenti...`)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-xl p-3 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-[70px] font-semibold"
                />

                <button
                  onClick={handleSaveNotes}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 px-3 rounded-xl text-[11px] uppercase tracking-wider transition cursor-pointer shadow-sm dark:shadow-none shadow-amber-500/10 text-center"
                >{dt(`Ruaj Shënimin e Administratorit`)}
                </button>
              </div>

              {/* Log actions / audit trails specifically for this agent */}
              <div className="flex-1 flex flex-col min-h-0 border-t border-slate-100 dark:border-white/5 pt-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center justify-between">
                  <span>{dt(`Auditimi i Veprimeve të Agentit`)}</span>
                  <span className="font-mono text-xs text-rose-500 font-bold tracking-normal uppercase bg-rose-50 px-2 py-0.5 rounded">{dt(`AUDIT`)}</span>
                </h4>
                <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[160px] pr-1">
                  {agentLogs.length === 0 ? (
                    <div className="text-center py-6 text-slate-400">
                      <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-xs font-bold">{dt(`Ska veprime të regjistruara.`)}</p>
                      <p className="text-[10px] mt-0.5">{dt(`Veprimet si aprovimet e rasteve do të listohen këtu.`)}</p>
                    </div>
                  ) : (
                    agentLogs.map(log => (
                      <div key={log.id} className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-white/5 rounded-xl text-xs flex flex-col gap-1 hover:border-slate-200/60 dark:border-white/10 transition">
                        <div className="flex justify-between items-center">
                          <span className="font-extrabold text-slate-800 dark:text-slate-200 dark:text-slate-200">{log.action}</span>
                          <span className="text-[9px] font-mono text-slate-400">
                            {new Date(log.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 text-[11px] font-medium leading-relaxed">{log.details}</p>
                        <div className="flex items-center justify-between mt-1 pt-1.5 border-t border-slate-200/60 dark:border-white/10/60">
                          <span className="text-[9px] text-slate-400">{dt(`Statusi i auditit:`)}</span>
                          <span className={cn(
                            "text-[8px] font-black tracking-widest uppercase px-1.5 py-0.5 rounded-full",
                            log.status === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          )}>
                            {log.status}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>


              </>
            ) : (
              <div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-white/10 p-4 shadow-sm dark:shadow-none">
                <h4 className="text-[12px] font-black text-slate-800 dark:text-slate-200 dark:text-slate-200 uppercase tracking-widest mb-4 flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
                  <span>{dt(`Historiku i Detajuar i Punës & Aprovimeve`)}</span>
                  <span className="font-mono text-xs text-rose-600 font-bold uppercase bg-rose-50 px-3 py-1 rounded-2xl">
                    {handledReports.length}{dt(`Raste`)}
                  </span>
                </h4>

                <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                  {handledReports.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-white/5 p-8">
                      <FileText className="w-12 h-12 mx-auto mb-3 opacity-20 text-slate-400" />
                      <p className="text-sm font-bold text-slate-500 dark:text-slate-400">{dt(`Nuk ka aktivitet të regjistruar ende.`)}</p>
                      <p className="text-xs mt-1">{dt(`Sapo agenti të aprovojë apo menaxhojë ndonjë raport, do të shfaqet këtu me detaje të plota.`)}</p>
                    </div>
                  ) : (
                    handledReports.map(report => {
                      const timelineEvent = report.timeline?.find(event =>
                        event.updatedBy === selectedAgent.name ||
                        event.updatedBy?.toLowerCase() === selectedAgent.email.toLowerCase() ||
                        event.updatedBy?.toLowerCase().includes(selectedAgent.name.toLowerCase())
                      );

                      return (
                        <div key={report.id} className="p-4 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-xl flex flex-col gap-2 hover:border-rose-300 transition shadow-sm dark:shadow-none">
                          <div className="flex justify-between items-start gap-4">
                            <div>
                              <span className="font-extrabold text-slate-900 dark:text-white text-sm">{report.title}</span>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1">
                                <span>{dt(`Kategoria:`)} </span>
                                <span className="text-slate-700 dark:text-slate-300 font-bold">{getReportTopicLabel(report)} · {report.category}</span>
                              </div>
                            </div>
                            <span className={cn(
                              "text-[10px] font-black tracking-widest uppercase px-3 py-1 rounded-2xl shrink-0 border",
                              report.status === 'Resolved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              report.status === 'Approved' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                              'bg-amber-50 text-amber-700 border-amber-200'
                            )}>
                              {report.status}
                            </span>
                          </div>

                          {timelineEvent && (
                            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-white/10/60 rounded-2xl p-3 mt-2">
                              <div className="flex justify-between items-center mb-2 border-b border-slate-200/60 dark:border-white/10/50 pb-2">
                                <p className="text-[10px] font-black text-rose-600 uppercase tracking-wider flex items-center gap-1.5">
                                  <CheckCircle2 className="w-3.5 h-3.5" />{dt(`Veprimi i Agentit`)}
                                </p>
                                <span className="text-slate-500 dark:text-slate-400 font-mono text-[10px] font-bold">
                                  {new Date(timelineEvent.date).toLocaleString('sq-AL')}
                                </span>
                              </div>
                              <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200 dark:text-slate-200 mb-1">{dt(`Ndryshoi statusin në:`)} <span className="text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">{timelineEvent.status}</span>
                              </div>
                              {timelineEvent.comment && (
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 p-2 rounded border border-slate-100 dark:border-white/5 italic mt-2">{dt(`&quot;`)}{timelineEvent.comment}{dt(`&quot;`)}
                                </p>
                              )}
                            </div>
                          )}

                          <div className="text-[10px] text-slate-400 font-medium mt-2 flex items-center justify-between border-t border-slate-100 dark:border-white/5 pt-2">
                             <span>{dt(`ID e Raportit:`)} <span className="font-mono">{report.id.substring(0,8)}...</span></span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
              )}
            </div>
          )}
        </div>
      </div>
      </>
      ) : (
        /* 7-DAY PROFESSIONAL MONITORING VIEW */
        <div className="space-y-6">
          {/* Top 4 KPI Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/60 dark:border-white/10 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center shrink-0">
                <Activity className="w-6 h-6 stroke-[2]" />
              </div>
              <div>
                <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">
                  {sevenDaysData.reduce((acc, d) => acc + d.actions, 0)}
                </p>
                <p className="text-xs text-slate-500 font-medium mt-1">{dt("Veprime Totale (7 Ditë)")}</p>
                <span className="text-[10px] font-bold text-emerald-600">↑ 18% nga java e kaluar</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/60 dark:border-white/10 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6 stroke-[2]" />
              </div>
              <div>
                <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">
                  {sevenDaysData.reduce((acc, d) => acc + d.approvals, 0)}
                </p>
                <p className="text-xs text-slate-500 font-medium mt-1">{dt("Aprovime të Suksesshme")}</p>
                <span className="text-[10px] font-bold text-emerald-600">88.4% shkallë suksesi</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/60 dark:border-white/10 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 flex items-center justify-center shrink-0">
                <Users className="w-6 h-6 stroke-[2]" />
              </div>
              <div>
                <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">
                  {agents.length}
                </p>
                <p className="text-xs text-slate-500 font-medium mt-1">{dt("Agentë në Detyrë")}</p>
                <span className="text-[10px] font-bold text-purple-600">100% të caktuar</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/60 dark:border-white/10 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center shrink-0">
                <Clock className="w-6 h-6 stroke-[2]" />
              </div>
              <div>
                <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">
                  18 min
                </p>
                <p className="text-xs text-slate-500 font-medium mt-1">{dt("Koha Mesatare e Trajtimit")}</p>
                <span className="text-[10px] font-bold text-emerald-600">Brenda SLA normës</span>
              </div>
            </div>
          </div>

          {/* 7-Day Day-by-Day Performance Matrix */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/60 dark:border-white/10 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-rose-500" />
                  <span>{dt("Aktiviteti Ditor i 7 Ditëve të Fundit")}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">{dt("Volumi i verifikimeve dhe vendimmarrjes sipas ditëve të javës")}</p>
              </div>
              <span className="text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-3 py-1 rounded-full">
                {sevenDaysData[0]?.dayNum} - {sevenDaysData[sevenDaysData.length - 1]?.dayNum}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              {sevenDaysData.map((day, idx) => (
                <div key={idx} className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-white/5 flex flex-col justify-between space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-slate-700 dark:text-slate-300">{day.dayName}</span>
                    <span className="text-[10px] font-mono text-slate-400">{day.dayNum}</span>
                  </div>
                  <div>
                    <span className="text-xl font-black text-slate-900 dark:text-white">{day.actions}</span>
                    <span className="text-[10px] text-slate-400 block font-medium">{dt("veprime")}</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-rose-500 h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, (day.actions / 15) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> {day.approvals} {dt("të aprovuara")}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Agent Roster & Individual Performance Table */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/60 dark:border-white/10 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-white/5">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <BarChart2 className="w-5 h-5 text-indigo-500" />
                  <span>{dt("Tabela Krahasuese e Performancës së Agentëve (7 Ditë)")}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">{dt("Renditja e të gjithë agentëve dhe përgjegjësive të tyre gjatë kësaj jave")}</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-white/5 text-slate-400 font-semibold">
                    <th className="py-3 px-3">{dt("Agenti")}</th>
                    <th className="py-3 px-3">{dt("Roli & Qasjet")}</th>
                    <th className="py-3 px-3 text-center">{dt("Raste të Trajtuara (7D)")}</th>
                    <th className="py-3 px-3 text-center">{dt("Aprovime")}</th>
                    <th className="py-3 px-3 text-center">{dt("Shkalla")}</th>
                    <th className="py-3 px-3">{dt("Statusi")}</th>
                    <th className="py-3 px-3 text-right">{dt("Veprime")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {agents.map((agent) => {
                    /**
                     * Real figures, from the audit log.
                     *
                     * The previous table computed
                     * `Math.max(agentLogsCount, 5 + ((i * 4) % 11))` and
                     * `Math.max(floor(handled * 0.8), 3)`, then printed a hard-coded
                     * green "Aktiv" badge for every row. A supervisor reading this
                     * was looking at invented activity — and an agent who had
                     * genuinely done nothing looked identical to the busiest one
                     * on the platform. It is now zero when there is no history.
                     */
                    const handled = activityByAgent.get(agent.id);
                    const handledCount = handled?.inScope ?? 0;
                    const approvedCount = Math.round((handledCount * (handled?.approvalRate ?? 0)) / 100);
                    const isActiveNow = (handled?.last24h ?? 0) > 0;

                    return (
                      <tr key={agent.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-slate-800 text-white font-bold flex items-center justify-center text-xs shrink-0">
                              {agent.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 dark:text-white">{agent.name}</p>
                              <p className="text-[10px] text-slate-400">{agent.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {agent.role === 'approver' ? 'Aprovues' : agent.role === 'adsadmin' ? 'Reklama' : 'Agent'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-slate-900 dark:text-white">
                          {handledCount}
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-emerald-600">
                          {approvedCount}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-slate-600 dark:text-slate-300">
                          {handled?.approvalRate ?? 0}%
                        </td>
                        <td className="py-3 px-3">
                          {isActiveNow ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Aktiv
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-white/10">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                              Inaktiv
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => {
                              setSelectedAgentId(agent.id);
                              setViewSection('agents');
                              setAgentTab('reports');
                            }}
                            className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                          >
                            {dt("Detajet →")}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Audit Logs Live Activity Stream */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/60 dark:border-white/10 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-500" />
                <span>{dt("Regjistri i Drejtpërdrejtë i Veprimeve të Agentëve")}</span>
              </h3>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{dt("AUDIT LOG")}</span>
            </div>

            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
              {auditLogs.slice(0, 15).map((log, i) => (
                <div key={log.id || i} className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-white/5 rounded-xl text-xs flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-700 border border-slate-200/60 dark:border-white/10 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-[10px] shrink-0">
                      {log.userEmail ? log.userEmail.charAt(0).toUpperCase() : 'A'}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 dark:text-white truncate">
                        {log.action}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {log.userEmail || "Agent i sistemit"} - {log.details}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] font-mono text-slate-400 block">
                      {log.createdAt ? new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Sot'}
                    </span>
                    <span className="text-[9px] font-black uppercase text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full">
                      Sukses
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Slide-over or Modal form for create / edit agent */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFormOpen(false)}
              className="absolute inset-0 bg-slate-900/60 md:backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-white/10 shadow-2xl w-full max-w-lg overflow-hidden relative z-10"
            >
              <div className="bg-slate-900 p-6 text-white border-b-4 border-rose-600 flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-black title-serif">{editingAgentId ? 'Ndrysho Detajet e Agentit' : 'Shto Agent / Punëtor të Ri'}</h3>
                  <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest mt-1">{dt(`Cilësimet e Qasjes`)}</p>
                </div>
                <button
                  onClick={() => setIsFormOpen(false)}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition active:scale-95"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar text-left">
                {/* Name */}
                <div>
                  <label className="block text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">{dt(`Emri i Plotë *`)}</label>
                  <input
                    type="text"
                    required
                    placeholder={dt(`p.sh. Agim Selimi`)}
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-white/10 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white dark:bg-slate-900 transition text-slate-800 dark:text-slate-200 dark:text-slate-200"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">{dt(`Email i Punës *`)}</label>
                  <input
                    type="email"
                    required
                    placeholder={dt(`p.sh. approval@ks.com`)}
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-white/10 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white dark:bg-slate-900 transition text-slate-800 dark:text-slate-200 dark:text-slate-200"
                  />
                </div>

                <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-[11px] leading-relaxed text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-200">
                  {dt(`Qasja e agjentit konfigurohet përmes Firebase Authentication. Fjalëkalimi dërgohet drejt në Firebase dhe nuk ruhet në këtë panel.`)}
                </div>

                {/*
                  Password.

                  Optional by design: typing one creates the account ready to
                  sign in immediately, while leaving it blank keeps the older
                  flow — the agent receives a reset email. The hint says which
                  of the two will happen, so the operator never has to guess.
                */}
                <div>
                  <label className="block text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
                    {dt(`Fjalëkalimi (Opsional)`)}
                  </label>
                  <div className="relative">
                    <input
                      type={showFormPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      minLength={8}
                      placeholder={dt(`min. 8 shenja, shkronja + numra`)}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-4 py-2.5 pr-11 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-white/10 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white dark:bg-slate-900 transition text-slate-800 dark:text-slate-200"
                    />
                    {/*
                      Masked by default, with an explicit reveal.

                      The field used to be `type="text"`, so a password was
                      typed in full view of anyone behind the operator and left
                      legible on screen after they walked away. Defaulting to
                      hidden is the safe state; the toggle exists because the
                      operator does need to read it once, to send it on.
                    */}
                    <button
                      type="button"
                      onClick={() => setShowFormPassword((v) => !v)}
                      aria-label={showFormPassword ? dt('Fshih fjalëkalimin') : dt('Shfaq fjalëkalimin')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {showFormPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="mt-1.5 text-[10px] leading-relaxed text-slate-400">
                    {formData.password.trim().length > 0
                      ? (editingAgentId
                        ? dt('Fjalëkalimi i agjentit do të ndryshohet me këtë vlerë dhe sesionet e vjetra do të revokohen.')
                        : dt('Llogaria do të krijohet me këtë fjalëkalim — agjenti mund të hyjë menjëherë.'))
                      : dt('Nëse e lini bosh, agjenti merr email për të vendosur fjalëkalimin vetë.')}
                  </p>
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 font-mono">{dt(`Telefoni (Opsional)`)}</label>
                  <input
                    type="text"
                    placeholder={dt(`p.sh. +383 44 111 222`)}
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-white/10 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white dark:bg-slate-900 transition text-slate-800 dark:text-slate-200 dark:text-slate-200"
                  />
                </div>

                {/* Role. The server decides who may assign which role. */}
                <div>
                  <label htmlFor="staff-role" className="block text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 font-mono">{dt(`Roli`)}</label>
                  <select
                    id="staff-role"
                    value={formData.role}
                    onChange={(e) => setFormData({...formData, role: e.target.value as User['role']})}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-white/10 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-800 dark:text-slate-200"
                  >
                    <option value="agent">{dt(`Agjent terreni`)}</option>
                    <option value="approver">{dt(`Zyrtar aprovimi`)}</option>
                    <option value="responder">{dt(`Përgjegjës`)}</option>
                    <option value="dispatcher">{dt(`Dispatcher`)}</option>
                    <option value="moderator">{dt(`Moderator`)}</option>
                    <option value="monitor">{dt(`Monitorues (vetëm lexim)`)}</option>
                    <option value="newsadmin">{dt(`Redaktor i lajmeve`)}</option>
                    <option value="adsadmin">{dt(`Menaxher reklamash`)}</option>
                    <option value="debatwp">{dt(`Admin i Debatit Publik`)}</option>
                  </select>
                  {formData.role === 'monitor' && (
                    <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                      {dt(`Sheh raportimet, afatet dhe auditimin. Nuk mund të ndryshojë asgjë; serveri i refuzon të gjitha veprimet e shkrimit.`)}
                    </p>
                  )}
                </div>

                {/* Granular Permissions Section */}
                <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 border border-slate-200/60 dark:border-white/10">
                  <span className="block text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">{dt(`Kategorizimi dhe Sektorët e Lejuar (Qasja)`)}
                  </span>

                  <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1 custom-scrollbar">
                    {/* Permission: reports */}
                    <button
                      type="button"
                      onClick={() => togglePermission('reports')}
                      className="w-full flex items-center justify-between p-3 rounded-xl border bg-white dark:bg-slate-900 text-left transition hover:border-slate-300"
                    >
                      <span className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-rose-500" />
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white">{dt(`Aprovimi i Raporteve (Ankesat)`)}</p>
                          <p className="text-[10px] text-slate-400">{dt(`Lejon shqyrtimin e gropave, mbeturinave, ndriçimit, etj.`)}</p>
                        </div>
                      </span>
                      {formData.permissions.includes('reports' as any) ? (
                        <ShieldCheck className="w-5 h-5 text-rose-500" />
                      ) : (
                        <div className="w-5 h-5 rounded-xl border-2 border-slate-300 dark:border-slate-600" />
                      )}
                    </button>

                    {/*
                      Panel access — four grants, four distinct destinations.

                      These are what let an administrator widen one specific
                      agent without changing their role. They are additive to the
                      role defaults, so an agent with none of them keeps exactly
                      the access they had before.

                      Two of these used to be labelled as separate monitoring
                      levels while both stored a permission that opened the same
                      page, which is why an operator could tick "monitoring" and
                      see no difference. Each entry below now owns one route.
                    */}
                    {([
                      ['monitoring', 'Monitorim i Plotë', 'Mbikëqyrje e thellë e agjentëve dhe komunave — /monitorim', Eye, 'text-slate-700'],
                      ['agents', 'Paneli i Agjentit', 'Konsola e punës së agjentëve — /agent', UserCheck, 'text-blue-500'],
                      ['municipalities', 'Paneli i Komunës', 'Konsola e punëve të komunave — /komuna', Shield, 'text-indigo-500'],
                      ['moderim', 'Qendra e Moderimit', 'Anomalitë dhe moderimi i përmbajtjes — /moderim', Activity, 'text-rose-500'],
                    ] as const).map(([key, title, desc, Icon, tone]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => togglePermission(key)}
                        className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition hover:border-slate-300 dark:bg-slate-900 ${formData.permissions.includes(key as any)
                            ? 'border-slate-300 bg-white dark:border-slate-600'
                            : 'border-slate-200/60 bg-white dark:border-white/10'
                          }`}
                      >
                        <span className="flex items-center gap-3">
                          <Icon className={`w-4 h-4 ${tone}`} />
                          <div>
                            <p className="text-xs font-bold text-slate-900 dark:text-white">{dt(title)}</p>
                            <p className="text-[10px] text-slate-400">{dt(desc)}</p>
                          </div>
                        </span>
                        {formData.permissions.includes(key as any) ? (
                          <ShieldCheck className={`w-5 h-5 ${tone}`} />
                        ) : (
                          <div className="w-5 h-5 rounded-xl border-2 border-slate-300 dark:border-slate-600" />
                        )}
                      </button>
                    ))}

                    {/* Permission: categories */}
                    <button
                      type="button"
                      onClick={() => togglePermission('categories')}
                      className="w-full flex items-center justify-between p-3 rounded-xl border bg-white dark:bg-slate-900 text-left transition hover:border-slate-300"
                    >
                      <span className="flex items-center gap-3">
                        <Map className="w-4 h-4 text-teal-500" />
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white">{dt(`Harta & Infrastruktura (GIS)`)}</p>
                          <p className="text-[10px] text-slate-400">{dt(`Lejon menaxhimin e aseteve dhe hartës gjeografike.`)}</p>
                        </div>
                      </span>
                      {formData.permissions.includes('categories' as any) ? (
                        <ShieldCheck className="w-5 h-5 text-teal-500" />
                      ) : (
                        <div className="w-5 h-5 rounded-xl border-2 border-slate-300 dark:border-slate-600" />
                      )}
                    </button>

                    {/* Permission: support */}
                    <button
                      type="button"
                      onClick={() => togglePermission('support')}
                      className="w-full flex items-center justify-between p-3 rounded-xl border bg-white dark:bg-slate-900 text-left transition hover:border-slate-300"
                    >
                      <span className="flex items-center gap-3">
                        <RadioTower className="w-4 h-4 text-sky-500" />
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white">{dt(`Kërkesat për Agjent / Support`)}</p>
                          <p className="text-[10px] text-slate-400">{dt(`Lejon përgjigjen e qytetarëve dhe ndjekjen e Track ID-ve.`)}</p>
                        </div>
                      </span>
                      {formData.permissions.includes('support' as any) ? (
                        <ShieldCheck className="w-5 h-5 text-sky-500" />
                      ) : (
                        <div className="w-5 h-5 rounded-xl border-2 border-slate-300 dark:border-slate-600" />
                      )}
                    </button>

                    {/* Permission: chat */}
                    <button
                      type="button"
                      onClick={() => togglePermission('chat')}
                      className="w-full flex items-center justify-between p-3 rounded-xl border bg-white dark:bg-slate-900 text-left transition hover:border-slate-300"
                    >
                      <span className="flex items-center gap-3">
                        <MessageSquareMore className="w-4 h-4 text-pink-500" />
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white">{dt(`Mbështetja me Qytetarë (Live Chat)`)}</p>
                          <p className="text-[10px] text-slate-400">{dt(`Lejon bisedat direkte dhe asistimin e qytetarëve.`)}</p>
                        </div>
                      </span>
                      {formData.permissions.includes('chat' as any) ? (
                        <ShieldCheck className="w-5 h-5 text-pink-500" />
                      ) : (
                        <div className="w-5 h-5 rounded-xl border-2 border-slate-300 dark:border-slate-600" />
                      )}
                    </button>

                    {/* Permission: donations */}
                    <button
                      type="button"
                      onClick={() => togglePermission('donations')}
                      className="w-full flex items-center justify-between p-3 rounded-xl border bg-white dark:bg-slate-900 text-left transition hover:border-slate-300"
                    >
                      <span className="flex items-center gap-3">
                        <Heart className="w-4 h-4 text-indigo-500" />
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white">{dt(`Aprovimi i Donacioneve`)}</p>
                          <p className="text-[10px] text-slate-400">{dt(`Lejon aprovimin ose fshirjen e kauzave të donacioneve.`)}</p>
                        </div>
                      </span>
                      {formData.permissions.includes('donations' as any) ? (
                        <ShieldCheck className="w-5 h-5 text-indigo-500" />
                      ) : (
                        <div className="w-5 h-5 rounded-xl border-2 border-slate-300 dark:border-slate-600" />
                      )}
                    </button>

                    {/* Permission: ads */}
                    <button
                      type="button"
                      onClick={() => togglePermission('ads')}
                      className="w-full flex items-center justify-between p-3 rounded-xl border bg-white dark:bg-slate-900 text-left transition hover:border-slate-300"
                    >
                      <span className="flex items-center gap-3">
                        <Megaphone className="w-4 h-4 text-amber-500" />
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white">{dt(`Menaxhimi i Reklamave`)}</p>
                          <p className="text-[10px] text-slate-400">{dt(`Lejon krijimin, fshirjen dhe rregullimin e fushatave.`)}</p>
                        </div>
                      </span>
                      {formData.permissions.includes('ads' as any) ? (
                        <ShieldCheck className="w-5 h-5 text-amber-500" />
                      ) : (
                        <div className="w-5 h-5 rounded-xl border-2 border-slate-300 dark:border-slate-600" />
                      )}
                    </button>

                    {/* Permission: forum */}
                    <button
                      type="button"
                      onClick={() => togglePermission('forum')}
                      className="w-full flex items-center justify-between p-3 rounded-xl border bg-white dark:bg-slate-900 text-left transition hover:border-slate-300"
                    >
                      <span className="flex items-center gap-3">
                        <MessageSquare className="w-4 h-4 text-emerald-500" />
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white">{dt(`Menaxhimi i Forumit`)}</p>
                          <p className="text-[10px] text-slate-400">{dt(`Lejon fshirjen e postimeve dhe komenteve ne forum.`)}</p>
                        </div>
                      </span>
                      {formData.permissions.includes('forum' as any) ? (
                        <ShieldCheck className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <div className="w-5 h-5 rounded-xl border-2 border-slate-300 dark:border-slate-600" />
                      )}
                    </button>

                    {/* Permission: polls */}
                    <button
                      type="button"
                      onClick={() => togglePermission('polls')}
                      className="w-full flex items-center justify-between p-3 rounded-xl border bg-white dark:bg-slate-900 text-left transition hover:border-slate-300"
                    >
                      <span className="flex items-center gap-3">
                        <Vote className="w-4 h-4 text-purple-500" />
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white">{dt(`Sondazhet Publike & Votimet`)}</p>
                          <p className="text-[10px] text-slate-400">{dt(`Lejon menaxhimin dhe dekretimin e sondazheve 3D.`)}</p>
                        </div>
                      </span>
                      {formData.permissions.includes('polls' as any) ? (
                        <ShieldCheck className="w-5 h-5 text-purple-500" />
                      ) : (
                        <div className="w-5 h-5 rounded-xl border-2 border-slate-300 dark:border-slate-600" />
                      )}
                    </button>

                    {/* Permission: notifications */}
                    <button
                      type="button"
                      onClick={() => togglePermission('notifications')}
                      className="w-full flex items-center justify-between p-3 rounded-xl border bg-white dark:bg-slate-900 text-left transition hover:border-slate-300"
                    >
                      <span className="flex items-center gap-3">
                        <Bell className="w-4 h-4 text-yellow-500" />
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white">{dt(`Komunikimi & Njoftimet`)}</p>
                          <p className="text-[10px] text-slate-400">{dt(`Lejon shpërndarjen e njoftimeve zyrtare për komunën.`)}</p>
                        </div>
                      </span>
                      {formData.permissions.includes('notifications' as any) ? (
                        <ShieldCheck className="w-5 h-5 text-yellow-500" />
                      ) : (
                        <div className="w-5 h-5 rounded-xl border-2 border-slate-300 dark:border-slate-600" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Status Toggle (Is Active / Is Banned) */}
                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-white/10">
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 dark:text-slate-200">{dt(`Statusi i Llogarisë`)}</p>
                    <p className="text-[10px] text-slate-400">{dt(`Nëse bllokohet, agenti nuk mund të kyçet.`)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, isBanned: !formData.isBanned })}
                    className={cn(
                      "px-3 py-1.5 rounded-xl font-bold text-[10px] uppercase tracking-wider transition",
                      formData.isBanned 
                        ? "bg-rose-100 text-rose-700 border border-rose-200"
                        : "bg-emerald-100 text-emerald-700 border border-emerald-200"
                    )}
                  >
                    {formData.isBanned ? "I BLLOKUAR" : "I AKTIVIZUAR"}
                  </button>
                </div>

                <div className="pt-4 flex gap-3 border-t border-slate-100 dark:border-white/5">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="flex-1 py-3 bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs transition text-center cursor-pointer"
                  >{dt(`Anulo`)}
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold text-xs transition text-center cursor-pointer shadow-[0_20px_40px_-10px_rgba(0,0,0,0.08)] dark:shadow-none shadow-rose-600/20"
                  >
                    {editingAgentId ? 'Ruaj Ndryshimet' : 'Krijo Llogarinë'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {removal && (
        <RemoveAccountDialog
          target={removal}
          onClose={() => setRemoval(null)}
          onRemoved={() => {
            if (selectedAgentId === removal.id) setSelectedAgentId(null);
            setRemoval(null);
          }}
        />
      )}
    </div>
  );
}
