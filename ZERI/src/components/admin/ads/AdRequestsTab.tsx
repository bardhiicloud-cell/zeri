import { dt } from '@/src/lib/dt';
import { MessageCircle } from 'lucide-react';


import { doc, deleteDoc } from 'firebase/firestore';
import DecisionBar from '../DecisionBar';

import { db } from '../../../lib/firebase';


import { cn } from '../../../lib/utils';

import { askConfirm } from '../../../lib/dialogs';


export default function AdRequestsTab({ adRequests, startPublishFromRequest }: {
  adRequests: any[];
  startPublishFromRequest: (req: any) => void;
}) {
  return (
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
                        <span className={cn('mt-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-extrabold uppercase', statusStyle)}>{statusLabel}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {(status === 'pending' || status === 'payment_confirmed') && <button type="button" onClick={() => startPublishFromRequest(req)} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-800">{dt('Aprovo dhe ngarko kreativin')}</button>}
                        {/* Approval happens by building the campaign (above); the rest are plain decisions. */}
                        <DecisionBar kind="adRequest" id={req.id} doc={req} hideActions={['approve']} />
                        <button
                          type="button"
                          onClick={async () => {
                            if (await askConfirm(dt('A dëshironi ta fshini këtë kërkesë?'))) await deleteDoc(doc(db, 'adRequests', req.id));
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
  );
}
