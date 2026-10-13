import { decideTransition } from './approvalPipeline';
import { decide as decideDecision } from '../src/lib/decisionRules';
import { decideAssignment } from './reportAssignment';
import { decideMediaChange } from './reportMedia';
import { decideEscalation, decideNote, decideRequestInfo } from './reportCase';
import { decideInstitutionEmail } from './institutionMail';
import { decideMunicipalityRequest } from './municipalityDesk';
import { decideModeration } from './userModeration';
import { decideStaffRemoval } from './staffRemoval';
import { decidePlanChange, featuresFor } from './municipalityPlans';
import { mayViewTeam } from './teamOverview';
import { checkRoleChange, mayUseSection } from './policy';

/**
 * Who may do what, computed from the real decision functions.
 *
 * The permissions matrix used to be a document someone wrote by hand and nobody
 * could check. This one is produced by asking each rule the actual question for each
 * kind of account, so it cannot drift from the code that enforces it, and a test
 * fails if docs/PERMISSIONS_MATRIX.md differs from what the code now says.
 *
 * Reading a cell: "yes" the action is allowed; "own" allowed only on the account's
 * own municipality; "plan" allowed on the plans that include it; "no" refused. A
 * cell is "yes" only if the decision function returned allow for a representative
 * case; the cases are in `CASES` so they can be inspected and argued with.
 */

export interface Persona {
  id: string;
  label: string;
  actor: { uid: string; role: string; municipality: string; permissions: string[]; plan?: string };
}

export const PERSONAS: readonly Persona[] = [
  { id: 'superadmin', label: 'Superadmin', actor: { uid: 'owner', role: 'superadmin', municipality: '', permissions: [] } },
  { id: 'admin', label: 'Administrator', actor: { uid: 'admin', role: 'admin', municipality: '', permissions: [] } },
  { id: 'agent', label: 'Agjent', actor: { uid: 'agent', role: 'agent', municipality: '', permissions: [] } },
  { id: 'agentGrant', label: 'Agjent me fusha të dhëna', actor: { uid: 'agent2', role: 'agent', municipality: '', permissions: ['donations', 'health', 'news', 'ads'] } },
  { id: 'dispatcher', label: 'Dispatcher', actor: { uid: 'dispatcher', role: 'dispatcher', municipality: '', permissions: [] } },
  { id: 'monitor', label: 'Menaxher (monitorim)', actor: { uid: 'monitor', role: 'monitor', municipality: '', permissions: [] } },
  { id: 'municipalityBasic', label: 'Komunë (Bazë)', actor: { uid: 'muni', role: 'municipality', municipality: 'Pejë', permissions: [], plan: 'basic' } },
  { id: 'municipalityPro', label: 'Komunë (Pro)', actor: { uid: 'muni', role: 'municipality', municipality: 'Pejë', permissions: [], plan: 'pro' } },
  { id: 'citizen', label: 'Qytetar', actor: { uid: 'citizen', role: 'citizen', municipality: '', permissions: [] } },
];

type Cell = boolean;
export interface Row {
  group: string;
  capability: string;
  /** persona id -> allowed */
  allowed: Record<string, Cell>;
}

const complete = {
  status: 'Pending Review', assignedTo: 'Agjenti', title: 'Gropë', description: 'Gropë e thellë në rrugë, rrezik për automjetet.',
  category: 'Rrugë', location: { municipality: 'Pejë', address: 'Rr. Bajram Curri', lat: 42.6, lng: 20.3 }, images: ['https://x/a.jpg'],
  media: [{ type: 'image', url: 'https://x/a.jpg' }], urgency: 'E lartë', responsibleInstitution: 'Drejtoria e Infrastrukturës', authorId: 'citizen-9',
};
const approved = { ...complete, status: 'Approved' };
const working = { ...approved, status: 'In Progress', timeline: [{ status: 'In Progress', comment: 'Ekipi rrugor po punon.' }] };

type Test = (persona: Persona) => boolean;
const allowOutcome = (r: { outcome?: string; allowed?: boolean }) => r.outcome === 'allow' || r.allowed === true;

export const CASES: ReadonlyArray<{ group: string; capability: string; test: Test }> = [
  // ── Reports ──
  { group: 'Raportimet', capability: 'Hap listën e raportimeve', test: p => mayUseSection({ role: p.actor.role, permissions: p.actor.permissions }, 'reports') },
  { group: 'Raportimet', capability: 'Merr përsipër një raport të ri (claim)', test: p => allowOutcome(decideTransition(p.actor, complete, 'claim')) },
  { group: 'Raportimet', capability: 'Aprovon dhe e dërgon te komuna', test: p => allowOutcome(decideTransition(p.actor, complete, 'pass_to_municipality')) },
  { group: 'Raportimet', capability: 'Refuzon (me arsye)', test: p => allowOutcome(decideTransition(p.actor, complete, 'reject')) },
  { group: 'Raportimet', capability: 'Kërkon informacion nga qytetari', test: p => allowOutcome(decideRequestInfo(p.actor, complete, 'A mund të dërgoni një foto më të qartë?')) },
  { group: 'Raportimet', capability: 'Shënim i brendshëm', test: p => allowOutcome(decideNote(p.actor, complete, 'Duket autentike, kontrolloni adresën.')) },
  { group: 'Raportimet', capability: 'Eskalon te administratori', test: p => allowOutcome(decideEscalation(p.actor, complete, 'escalate', 'Rrezik për kalimtarët pranë shkollës.')) },
  { group: 'Raportimet', capability: 'Mbyll një eskalim', test: p => allowOutcome(decideEscalation(p.actor, { ...complete, escalated: true }, 'resolve', 'Ekipi u nis në terren.')) },
  { group: 'Raportimet', capability: 'Ia cakton raportin një agjenti tjetër', test: p => allowOutcome(decideAssignment({ actor: p.actor, report: complete, target: { uid: 'other', role: 'agent', permissions: [], disabled: false }, release: false })) },
  { group: 'Raportimet', capability: 'Prit ose heq një foto', test: p => allowOutcome(decideMediaChange({ actor: p.actor, report: complete, removed: [], action: 'remove', url: 'https://x/a.jpg', reason: 'Shfaqet fytyra e një personi' })) },
  // ── Municipality work ──
  { group: 'Puna e komunës', capability: 'Merr përsipër punën (komuna e vet)', test: p => allowOutcome(decideTransition(p.actor, approved, 'municipality_accept')) },
  { group: 'Puna e komunës', capability: 'Shënon punimet të kryera (komuna e vet)', test: p => allowOutcome(decideTransition(p.actor, working, 'municipality_done')) },
  { group: 'Puna e komunës', capability: 'Përgjigje zyrtare publike', test: p => allowOutcome(decideMunicipalityRequest({ actor: p.actor, report: approved, kind: 'respond', note: 'Ekipi del nesër në terren.' })) },
  { group: 'Puna e komunës', capability: 'Kërkon korrigjim ose kundërshton', test: p => allowOutcome(decideMunicipalityRequest({ actor: p.actor, report: approved, kind: 'dispute', note: 'Adresa nuk është në komunën tonë.' })) },
  { group: 'Puna e komunës', capability: 'Dërgon raportin me email te institucioni', test: p => allowOutcome(decideInstitutionEmail({
    actor: { ...p.actor, plan: p.actor.plan ?? 'pro' }, report: approved,
    contact: { municipality: 'Pejë', institution: 'Drejtoria', name: 'Z. Hoxha', email: 'hoxha@peja.test' }, note: '', recent: [], nowMs: Date.now(),
  })) },
  // ── Approval of other content ──
  { group: 'Përmbajtja', capability: 'Aprovon ose refuzon një donacion', test: p => allowOutcome(decideDecision({ actor: { ...p.actor, features: p.actor.role === 'municipality' ? [...featuresFor(p.actor.plan)] : undefined }, kind: 'donation', action: 'approve', reason: '', doc: { status: 'pending' } })) },
  { group: 'Përmbajtja', capability: 'Verifikon një rast shëndetësor', test: p => allowOutcome(decideDecision({ actor: { ...p.actor, features: p.actor.role === 'municipality' ? [...featuresFor(p.actor.plan)] : undefined }, kind: 'health', action: 'approve', reason: '', doc: { status: 'pending', municipality: 'Pejë' } })) },
  { group: 'Përmbajtja', capability: 'Publikon një lajm', test: p => allowOutcome(decideDecision({ actor: p.actor, kind: 'news', action: 'publish', reason: '', doc: { published: false, status: 'Draft' } })) },
  { group: 'Përmbajtja', capability: 'Aprovon një kërkesë reklame', test: p => allowOutcome(decideDecision({ actor: p.actor, kind: 'adRequest', action: 'approve', reason: '', doc: { status: 'pending' } })) },
  { group: 'Përmbajtja', capability: 'Fsheh një postim në forum (me arsye)', test: p => allowOutcome(decideDecision({ actor: p.actor, kind: 'forum', action: 'hide', reason: 'Gjuhë urrejtjeje', doc: {} })) },
  // ── People and system ──
  { group: 'Njerëzit dhe sistemi', capability: 'Ndalon një llogari qytetari', test: p => allowOutcome(decideModeration({ actor: p.actor, targetUid: 'c1', targetRole: '', action: 'ban', reason: 'Spam i përsëritur' })) },
  { group: 'Njerëzit dhe sistemi', capability: 'Cakton ose ndryshon rolin e stafit', test: p => allowOutcome(checkRoleChange({ actorUid: p.actor.uid, actorRole: p.actor.role, targetUid: 'staff-1', currentTargetRole: 'agent', nextRole: 'monitor' })) },
  { group: 'Njerëzit dhe sistemi', capability: 'Heq një llogari stafi ose komune', test: p => allowOutcome(decideStaffRemoval({ actor: { uid: p.actor.uid, role: p.actor.role }, targetUid: 'staff-1', targetRole: 'agent', targetEmail: 'a@z.test', reason: 'Ka lënë punën', confirmEmail: 'a@z.test' })) },
  { group: 'Njerëzit dhe sistemi', capability: 'Cakton planin e një komune', test: p => allowOutcome(decidePlanChange({ actor: { uid: p.actor.uid, role: p.actor.role }, targetUid: 'm1', targetRole: 'municipality', plan: 'pro' })) },
  { group: 'Njerëzit dhe sistemi', capability: 'Sheh ngarkesën e ekipit të agjentëve', test: p => mayViewTeam({ role: p.actor.role, permissions: p.actor.permissions }) },
  { group: 'Njerëzit dhe sistemi', capability: 'Hap Cilësimet e sistemit', test: p => mayUseSection({ role: p.actor.role, permissions: p.actor.permissions }, 'settings') },
  { group: 'Njerëzit dhe sistemi', capability: 'Hap Sigurinë dhe Auditimin', test: p => mayUseSection({ role: p.actor.role, permissions: p.actor.permissions }, 'security') },
];

export function buildMatrix(): Row[] {
  return CASES.map(({ group, capability, test }) => ({
    group, capability,
    allowed: Object.fromEntries(PERSONAS.map(persona => [persona.id, Boolean(test(persona))])),
  }));
}

/** The matrix as the markdown document that lives in docs/. */
export function renderMatrix(rows: readonly Row[] = buildMatrix()): string {
  const head = `| Veprimi | ${PERSONAS.map(p => p.label).join(' | ')} |`;
  const rule = `|---|${PERSONAS.map(() => ':---:').join('|')}|`;
  const lines: string[] = [];
  let group = '';
  for (const row of rows) {
    if (row.group !== group) {
      group = row.group;
      lines.push(`| **${group}** |${PERSONAS.map(() => '').join('|')}|`);
    }
    lines.push(`| ${row.capability} | ${PERSONAS.map(p => (row.allowed[p.id] ? '✓' : '·')).join(' | ')} |`);
  }
  return [
    '# Matrica e lejeve',
    '',
    'Gjeneruar nga rregullat e vërteta të serverit (`server/permissionsMatrix.ts`), jo e shkruar me dorë. Një test dështon nëse ky skedar ndryshon nga ajo që thotë kodi. Rigjenerohet me `npm run matrix:write`.',
    '',
    '`✓` lejohet për rastin përfaqësues; `·` refuzohet. Veprimet e komunës vlejnë vetëm për komunën e vet (një komunë tjetër merr "nuk u gjet"). "Agjent me fusha të dhëna" ka Donacione, Shëndetësi, Lajme dhe Reklama. Komuna Bazë nuk ka shëndetësi, fakte punimesh as email; Pro i ka të gjitha.',
    '',
    'Rasti përfaqësues për çdo rresht është te `CASES` në skedarin e mësipërm.',
    '',
    head,
    rule,
    ...lines,
    '',
    'Çdo qelizë `·` është refuzim i zbatuar nga serveri (jo vetëm buton i fshehur). Çdo refuzim regjistrohet në auditim.',
    '',
  ].join('\n');
}
