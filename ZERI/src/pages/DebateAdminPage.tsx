import { useNavigate } from 'react-router-dom';
import { ArrowLeft, LogOut, ShieldAlert } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { dt } from '@/src/lib/dt';
import { auth } from '../lib/firebase';
import { useStore } from '../lib/store';
import { canAccessSection, roleLabel } from '../lib/adminPermissions';
import { DebateConsole } from '../components/debate/DebateConsole';

/** `/debatwp` — the public-debate administrator's own place. */
export default function DebateAdminPage() {
  const navigate = useNavigate();
  const currentUser = useStore((s) => s.currentUser);
  const logout = useStore((s) => s.logout);
  const allowed = canAccessSection(currentUser as any, 'debate');

  const leave = async () => {
    try {
      await signOut(auth);
    } catch {
      /* the local session is cleared regardless */
    }
    logout();
    navigate('/login');
  };

  if (!allowed) {
    return (
      <main className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <ShieldAlert className="h-10 w-10 text-rose-500" aria-hidden="true" />
        <h1 className="text-xl font-black text-slate-900 dark:text-white">{dt('Nuk keni qasje në këtë faqe')}</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">{dt('Kjo është konsola e adminit të Debatit Publik. Hyni me një llogari që ka këtë rol.')}</p>
        <button type="button" onClick={() => navigate(currentUser ? '/' : '/login')} className="min-h-11 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white">
          {currentUser ? dt('Kthehu në ballinë') : dt('Hyr')}
        </button>
      </main>
    );
  }

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur dark:border-white/10 dark:bg-slate-900/95">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <button type="button" onClick={() => navigate('/forum')} aria-label={dt('Kthehu te Debati')} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-white/10">
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black">{dt('Debati Publik')} · Admin</p>
            <p className="truncate text-[11px] text-slate-500">{currentUser?.name} · {roleLabel(currentUser as any, 'sq')}</p>
          </div>
          <button type="button" onClick={() => void leave()} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-300 px-3 text-xs font-bold hover:bg-slate-50 dark:border-white/15 dark:hover:bg-white/5">
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">{dt('Dil')}</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-5">
        <DebateConsole />
      </main>
    </div>
  );
}
