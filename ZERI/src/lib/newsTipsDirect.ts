/**
 * The newsroom's tip list read and moved straight from the database, for when the
 * API server (server/newsTips.ts) is not reachable. Same stages and actions as the
 * server; the database rules let only the newsroom (newsadmin/admin) read tips.
 */
import { collection, doc, getCountFromServer, getDoc, getDocs, limit, query, updateDoc, where } from 'firebase/firestore';
import { auth, db } from './firebase';

const STAGES = ['submitted', 'accepted', 'in_editing', 'published', 'rejected'] as const;
const STAGE_LABEL: Record<string, string> = { submitted: 'Në pritje', accepted: 'U pranua', in_editing: 'Në përpunim', published: 'U publikua', rejected: 'Të refuzuara' };
const ACTIONS: Record<string, string[]> = { submitted: ['accept', 'reject'], accepted: ['mark_published', 'reject'], in_editing: ['mark_published', 'reject'], published: [], rejected: [] };
const TARGET: Record<string, string> = { accept: 'accepted', reject: 'rejected', create_draft: 'in_editing', mark_published: 'published' };

const iso = (v: unknown): string | null => {
  if (!v) return null;
  if (typeof v === 'string') return v;
  const t = v as { toDate?: () => Date };
  return typeof t.toDate === 'function' ? t.toDate().toISOString() : null;
};

function row(id: string, d: Record<string, any>) {
  const status = STAGES.includes(d.status) ? d.status : 'submitted';
  return {
    id,
    reference: String(d.reference ?? ''),
    title: String(d.title ?? ''),
    category: String(d.category ?? ''),
    municipality: String(d.municipality ?? ''),
    status,
    anonymous: d.anonymous === true,
    mediaCount: Array.isArray(d.media) ? d.media.length : 0,
    articleId: d.articleId ?? null,
    createdAt: iso(d.createdAt),
    actions: ACTIONS[status] ?? [],
  };
}

export async function listTipsDirect(stage: string) {
  const counts: Record<string, number> = {};
  await Promise.all(STAGES.map(async (s) => {
    counts[s] = (await getCountFromServer(query(collection(db, 'newsTips'), where('status', '==', s)))).data().count;
  }));
  const snap = await getDocs(query(collection(db, 'newsTips'), where('status', '==', stage), limit(200)));
  const items = snap.docs.map(d => row(d.id, d.data())).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return { counts, items };
}

export async function getTipDirect(id: string) {
  const snap = await getDoc(doc(db, 'newsTips', id));
  if (!snap.exists()) throw new Error('Lajmi nuk u gjet.');
  const d = snap.data();
  const base = row(snap.id, d);
  return {
    ...base,
    body: String(d.body ?? ''),
    categoryLabel: base.category,
    place: String(d.place ?? ''),
    stageLabel: STAGE_LABEL[base.status] ?? base.status,
    contactName: String(d.contactName ?? ''),
    contactEmail: String(d.contactEmail ?? ''),
    contactPhone: String(d.contactPhone ?? ''),
    media: Array.isArray(d.media) ? d.media : [],
    rejectionReason: String(d.rejectionReason ?? ''),
    history: [],
  };
}

export async function actOnTipDirect(id: string, action: string, reason: string) {
  const to = TARGET[action];
  if (!to) throw new Error('Veprim i panjohur.');
  if (action === 'reject' && reason.trim().length < 5) throw new Error('Shkruani arsyen e refuzimit.');
  const now = new Date().toISOString();
  try {
    await updateDoc(doc(db, 'newsTips', id), {
      status: to,
      updatedAt: now,
      ...(action === 'reject' ? { rejectionReason: reason.trim() } : {}),
      lastActionBy: auth.currentUser?.uid ?? '',
    });
  } catch (error) {
    if ((error as { code?: string })?.code === 'permission-denied') throw new Error('Kjo llogari nuk ka qasje te lajmet e qytetarëve.');
    throw error;
  }
  return { label: STAGE_LABEL[to] };
}
