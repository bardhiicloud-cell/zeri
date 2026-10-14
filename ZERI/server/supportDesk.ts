import type { Express, Request, RequestHandler, Response } from 'express';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import type { Auth } from 'firebase-admin/auth';
import { mayUseSection } from './policy';
import { permissionsFromClaims } from './auth';

/**
 * The support desk: a citizen asks for a person, and exactly one agent takes the conversation.
 *
 *   waiting_agent  the citizen asked for an agent. Every support agent sees it in the queue
 *                  (and gets an alert on screen) until one of them accepts it.
 *   active_agent   accepted. From now on the conversation belongs to that agent alone:
 *                  only they (and an administrator) see it and write in it. The others no
 *                  longer see it at all (firestore.rules, `supportChats`).
 *   resolved       closed by the agent or an administrator.
 *
 * Accepting is a transaction, so two agents pressing "Prano" at the same moment cannot both
 * get it: the second is told who has it. Every step leaves a line in
 * `supportChats/{id}/events` (who, what, when, why) for the audit trail and the manager.
 * Agents never write the chat document from the browser any more; they go through here.
 */
export type ChatStatus = 'bot' | 'waiting_agent' | 'active_agent' | 'resolved';
export type DeskAction = 'accept' | 'reply' | 'release' | 'transfer' | 'resolve' | 'department';

export const MAX_REPLY = 4000;
export const MIN_REASON = 5;
export const MAX_REASON = 300;
export const DEPARTMENTS = ['help', 'infrastructure', 'municipal-services', 'health', 'safety', 'administration', 'other'] as const;

export interface DeskActor { uid: string; role: string; permissions: readonly string[] }
export interface ChatFacts { status: ChatStatus; assignedTo: string | null }

export const isDeskAdmin = (actor: DeskActor) => actor.role === 'admin' || actor.role === 'superadmin';
export const isSupportAgent = (actor: DeskActor) => mayUseSection(actor, 'support');

export type DeskDecision =
  | { outcome: 'allow'; override: boolean }
  | { outcome: 'deny'; status: 400 | 403 | 404 | 409; code: string; error: string };

const deny = (status: 400 | 403 | 404 | 409, code: string, error: string): DeskDecision => ({ outcome: 'deny', status, code, error });

/** Pure: may this agent take this step on this conversation now? */
export function decideDesk(actor: DeskActor, chat: ChatFacts | null, action: DeskAction, input: { reason?: string } = {}): DeskDecision {
  if (!isSupportAgent(actor)) return deny(403, 'WRONG_ROLE', 'Roli juaj nuk punon në qendrën e mbështetjes.');
  if (!chat) return deny(404, 'NOT_FOUND', 'Biseda nuk u gjet.');
  const admin = isDeskAdmin(actor);
  const mine = chat.assignedTo === actor.uid;
  // Somebody else's conversation is invisible to an ordinary agent: "not found", not "forbidden".
  if (chat.assignedTo && !mine && !admin && action !== 'accept') return deny(404, 'NOT_FOUND', 'Biseda nuk u gjet.');

  switch (action) {
    case 'accept':
      if (chat.status !== 'waiting_agent') return deny(409, chat.status === 'active_agent' ? 'ALREADY_TAKEN' : 'WRONG_STATE', chat.status === 'active_agent' ? 'Këtë bisedë e pranoi tashmë një agjent tjetër.' : 'Qytetari nuk po pret agjent në këtë bisedë.');
      if (chat.assignedTo && !mine) return deny(409, 'ALREADY_TAKEN', 'Këtë bisedë e pranoi tashmë një agjent tjetër.');
      return { outcome: 'allow', override: false };
    case 'reply':
    case 'department':
      if (chat.status !== 'active_agent') return deny(409, 'NOT_ACCEPTED', chat.status === 'waiting_agent' ? 'Pranojeni bisedën para se të shkruani.' : 'Biseda nuk është aktive.');
      if (!mine && !admin) return deny(404, 'NOT_FOUND', 'Biseda nuk u gjet.');
      return { outcome: 'allow', override: !mine };
    case 'release':
    case 'transfer':
    case 'resolve': {
      if (action === 'resolve' ? chat.status === 'resolved' || chat.status === 'bot' : chat.status !== 'active_agent') {
        return deny(409, 'WRONG_STATE', action === 'resolve' ? 'Biseda është mbyllur tashmë.' : 'Vetëm një bisedë aktive lëshohet ose transferohet.');
      }
      if (!mine && !admin) return deny(404, 'NOT_FOUND', 'Biseda nuk u gjet.');
      const override = !mine && Boolean(chat.assignedTo);
      // Taking work away from a colleague is accountable: say why.
      const reason = (input.reason ?? '').trim();
      if (override && (reason.length < MIN_REASON || reason.length > MAX_REASON)) return deny(400, 'REASON_REQUIRED', `Kjo bisedë është e një agjenti tjetër: shkruani arsyen (${MIN_REASON}-${MAX_REASON} shenja).`);
      return { outcome: 'allow', override };
    }
    default:
      return deny(400, 'UNKNOWN_ACTION', 'Veprimi nuk njihet.');
  }
}

export interface SupportDeskDeps {
  requireAuth: RequestHandler;
  db: () => Firestore;
  authAdmin: () => Auth;
  actingUser: (req: Request) => { uid: string; role: string; permissions: string[] };
  audit: (action: string, req: Request, detail?: Record<string, unknown>) => void;
}

const isSafeId = (value: string) => value.length > 0 && value.length <= 160 && !value.includes('/');
const message = (role: 'agent' | 'bot', content: string) => ({
  id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, role, content, createdAt: new Date().toISOString(),
});

export function registerSupportDeskRoutes(app: Express, deps: SupportDeskDeps): void {
  const chats = () => deps.db().collection('supportChats');

  async function nameOf(uid: string): Promise<string> {
    try { return String((await deps.db().collection('users').doc(uid).get()).data()?.name ?? '').slice(0, 120); } catch { return ''; }
  }

  app.post('/api/v1/support/chats/:id/:action', deps.requireAuth, async (req: Request, res: Response) => {
    const actor = deps.actingUser(req);
    const id = String(req.params.id ?? '');
    const action = String(req.params.action ?? '') as DeskAction;
    if (!isSafeId(id)) return res.status(400).json({ error: 'Biseda nuk është e vlefshme.' });
    if (!['accept', 'reply', 'release', 'transfer', 'resolve', 'department'].includes(action)) return res.status(404).json({ error: 'Veprimi nuk njihet.' });
    const body = (req.body ?? {}) as Record<string, unknown>;
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, MAX_REASON + 1) : '';
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (action === 'reply' && (text.length < 1 || text.length > MAX_REPLY)) return res.status(400).json({ error: `Mesazhi duhet të ketë 1-${MAX_REPLY} shenja.`, code: 'BAD_TEXT' });
    const department = typeof body.department === 'string' ? body.department : '';
    if (action === 'department' && !(DEPARTMENTS as readonly string[]).includes(department)) return res.status(400).json({ error: 'Departamenti nuk njihet.' });

    try {
      // A transfer goes to another support agent, checked against their verified claims.
      let target: { uid: string; name: string } | null = null;
      if (action === 'transfer') {
        const targetUid = typeof body.uid === 'string' ? body.uid.trim() : '';
        // An administrator may take a conversation over (a transfer to themselves); an agent hands it to someone else.
        if (!targetUid || (targetUid === actor.uid && !isDeskAdmin(actor))) return res.status(400).json({ error: 'Zgjidhni agjentin tjetër.' });
        try {
          const user = await deps.authAdmin().getUser(targetUid);
          const claims = (user.customClaims ?? {}) as Record<string, unknown>;
          const targetActor = { uid: user.uid, role: String(claims.role ?? ''), permissions: permissionsFromClaims(claims) };
          if (user.disabled || !isSupportAgent(targetActor)) return res.status(409).json({ error: 'Ky person nuk punon në mbështetje.', code: 'BAD_TARGET' });
          target = { uid: user.uid, name: (await nameOf(user.uid)) || user.displayName || 'Agjent' };
        } catch (error) {
          if ((error as { code?: string })?.code === 'auth/user-not-found') return res.status(404).json({ error: 'Agjenti nuk u gjet.' });
          throw error;
        }
      }
      const actorName = (await nameOf(actor.uid)) || 'Agjenti i mbështetjes';

      const result = await deps.db().runTransaction(async tx => {
        const ref = chats().doc(id);
        const snap = await tx.get(ref);
        const data = snap.data() as Record<string, unknown> | undefined;
        const facts: ChatFacts | null = snap.exists ? { status: (data?.status as ChatStatus) ?? 'bot', assignedTo: (data?.assignedTo as string) || null } : null;
        const decision = decideDesk(actor, facts, action, { reason });
        if (decision.outcome === 'deny') {
          const holder = action === 'accept' && facts?.assignedTo ? String(data?.assignedAgentName ?? '') : '';
          return { ...decision, error: holder ? `Këtë bisedë e pranoi ${holder}.` : decision.error };
        }
        const now = FieldValue.serverTimestamp();
        const patch: Record<string, unknown> = { updatedAt: now };
        let event: Record<string, unknown> = { action, byUid: actor.uid, byName: actorName, at: new Date().toISOString(), override: decision.override, ...(reason ? { reason } : {}) };

        if (action === 'accept') {
          patch.status = 'active_agent';
          patch.assignedTo = actor.uid;
          patch.assignedAgentName = actorName;
          patch.acceptedAt = new Date().toISOString();
          patch.messages = FieldValue.arrayUnion(message('bot', `${actorName} e pranoi bisedën dhe do t'ju përgjigjet këtu.`));
        } else if (action === 'reply') {
          patch.messages = FieldValue.arrayUnion(message('agent', text));
          if (!data?.firstResponseAt) patch.firstResponseAt = new Date().toISOString();
          event = { ...event, length: text.length };
        } else if (action === 'department') {
          patch.department = department;
          event = { ...event, department };
        } else if (action === 'release') {
          patch.status = 'waiting_agent';
          patch.assignedTo = null;
          patch.assignedAgentName = null;
          patch.messages = FieldValue.arrayUnion(message('bot', 'Biseda po i kalon një agjenti tjetër. Ju lutem prisni pak.'));
        } else if (action === 'transfer') {
          patch.assignedTo = target!.uid;
          patch.assignedAgentName = target!.name;
          patch.messages = FieldValue.arrayUnion(message('bot', `Biseda u transferua te ${target!.name}.`));
          event = { ...event, toUid: target!.uid, toName: target!.name };
          tx.set(deps.db().collection('notifications').doc(), {
            title: 'Ju u transferua një bisedë mbështetjeje', message: reason || `Nga ${actorName}`, channel: 'support', category: 'support',
            type: 'info', priority: 'normal', urgent: false, audience: 'user', userId: target!.uid, state: 'published',
            link: `/admin#support?open=${encodeURIComponent(id)}`, sender: 'Zëri i Qytetarëve', createdAt: now,
          });
        } else if (action === 'resolve') {
          patch.status = 'resolved';
          patch.resolvedAt = new Date().toISOString();
          patch.resolvedBy = actor.uid;
          patch.messages = FieldValue.arrayUnion(message('bot', 'Biseda u mbyll. Nëse keni nevojë sërish, shkruani këtu.'));
        }
        tx.update(ref, patch);
        tx.create(ref.collection('events').doc(), event);
        return { outcome: 'allow' as const, status: patch.status ?? facts!.status, assignedTo: 'assignedTo' in patch ? patch.assignedTo : facts!.assignedTo };
      });

      if (result.outcome === 'deny') {
        if (result.code !== 'NOT_FOUND') deps.audit(`support.${action}.denied`, req, { id, code: result.code });
        return res.status(result.status).json({ error: result.error, code: result.code });
      }
      // Replies are not audited one by one (they are the conversation itself); every change of hands is.
      if (action !== 'reply') deps.audit(`support.${action}`, req, { id, ...(target ? { toUid: target.uid } : {}), ...(reason ? { reason } : {}) });
      return res.json({ ok: true, status: result.status, assignedTo: result.assignedTo ?? null });
    } catch (error) {
      console.error('[SUPPORT] action failed:', (error as Error)?.message);
      return res.status(500).json({ error: 'Veprimi nuk u krye. Provoni përsëri.' });
    }
  });

  /** Who can take a transferred conversation: support agents only, names only. */
  app.get('/api/v1/support/agents', deps.requireAuth, async (req: Request, res: Response) => {
    const actor = deps.actingUser(req);
    if (!isSupportAgent(actor)) return res.status(403).json({ error: 'Roli juaj nuk punon në qendrën e mbështetjes.' });
    try {
      const snap = await deps.db().collection('users').where('role', 'in', ['agent', 'responder', 'dispatcher', 'approver', 'admin', 'superadmin']).limit(300).get();
      const agents = snap.docs
        .map(doc => ({ uid: doc.id, name: String(doc.data().name ?? ''), role: String(doc.data().role ?? ''), permissions: Array.isArray(doc.data().permissions) ? doc.data().permissions : [] }))
        .filter(person => person.uid !== actor.uid && isSupportAgent(person))
        .map(({ uid, name, role }) => ({ uid, name, role }));
      return res.json({ agents });
    } catch (error) {
      console.error('[SUPPORT] agents failed:', (error as Error)?.message);
      return res.status(500).json({ error: 'Lista nuk u ngarkua.' });
    }
  });
}
