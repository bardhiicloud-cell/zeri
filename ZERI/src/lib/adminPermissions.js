/** Sections an administrator or superadmin may open. */
const FULL_ACCESS = [
    'dashboard', 'updates', 'reports', 'workfacts', 'health', 'donations', 'users',
    'agents', 'municipalities', 'monitoring', 'ads', 'notifications', 'forum',
    'support', 'polls', 'news', 'security', 'settings', 'categories',
];
/** Least-privilege grants per role. Keys mirror the User['role'] union. */
const BY_ROLE = {
    admin: FULL_ACCESS,
    superadmin: FULL_ACCESS,
    // Municipal approver: works the incoming queue, not the platform settings.
    approver: ['dashboard', 'reports', 'health', 'donations', 'notifications', 'forum', 'polls', 'categories', 'support'],
    // Commercial: ad inventory and the campaigns it appears in. Nothing else.
    adsadmin: ['dashboard', 'ads', 'notifications'],
    // Editorial: publishes news and moderates the public debate.
    newsadmin: ['dashboard', 'notifications', 'news', 'forum', 'polls'],
    // Frontline staff: handle the queue and citizen support chats, change nothing.
    agent: ['dashboard', 'reports', 'support'],
    responder: ['dashboard', 'reports', 'support'],
    dispatcher: ['dashboard', 'reports', 'support'],
    municipality: ['dashboard', 'reports', 'health', 'donations'],
};
export const STAFF_ROLES = [
    'admin', 'superadmin', 'approver', 'adsadmin', 'newsadmin',
    'agent', 'responder', 'dispatcher', 'municipality',
];
export const isStaffRole = (role) => typeof role === 'string' && STAFF_ROLES.includes(role);
/**
 * Accounts that predate the custom-claim system.
 *
 * Previously this list also contained a hard-coded `admin@kosova.com` that
 * granted full access from a Firestore field — meaning anyone able to write
 * that document could promote themselves. The list is now empty by design and
 * kept only as a migration seam: add an entry, deploy, then remove it.
 */
const LEGACY_FULL_ACCESS_EMAILS = [];
export function canAccessAdmin(user) {
    if (!user)
        return false;
    if (isStaffRole(user.role))
        return true;
    return LEGACY_FULL_ACCESS_EMAILS.includes(user.email ?? '');
}
export function canAccessSection(user, section) {
    if (!user)
        return false;
    // A full admin always has every section.
    if (user.role === 'admin' || user.role === 'superadmin')
        return true;
    if (LEGACY_FULL_ACCESS_EMAILS.includes(user.email ?? ''))
        return true;
    // An explicit per-section grant from the backend wins over the role defaults,
    // so an administrator can widen a single staffer's access without inventing
    // a new role.
    if (Array.isArray(user.permissions) && user.permissions.includes(section)) {
        return true;
    }
    if (!isStaffRole(user.role))
        return false;
    return (BY_ROLE[user.role] ?? []).includes(section);
}
/** Human-readable role label for the header. */
export function roleLabel(user, language) {
    if (!user)
        return '';
    const english = language !== 'sq';
    switch (user.role) {
        case 'superadmin': return english ? 'Super Administrator' : 'Super Administrator';
        case 'admin': return english ? 'Administrator' : 'Administrator';
        case 'approver': return english ? 'Approval Officer' : 'Zyrtar Aprovimi';
        case 'adsadmin': return english ? 'Ads Manager' : 'Menaxher Reklamash';
        case 'newsadmin': return english ? 'News Editor' : 'Redaktor i Lajmeve';
        case 'agent': return english ? 'Field Agent' : 'Agjent Terreni';
        case 'responder': return english ? 'Responder' : 'Përgjegjës';
        case 'dispatcher': return english ? 'Dispatcher' : 'Dispatcher';
        default: return english ? 'Staff' : 'Staf';
    }
}
