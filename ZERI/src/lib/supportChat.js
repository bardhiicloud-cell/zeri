export const SUPPORT_DEPARTMENTS = [
    { id: 'help', label: 'Qendra e Ndihmës', description: 'Pyetje për platformën, përdorimin dhe ndjekjen e kërkesave.' },
    { id: 'infrastructure', label: 'Infrastrukturë', description: 'Rrugë, ndriçim, kanalizime dhe hapësira publike.' },
    { id: 'municipal-services', label: 'Shërbime komunale', description: 'Shërbime lokale, pastrim, transport dhe mirëmbajtje.' },
    { id: 'health', label: 'Shëndetësi', description: 'Regjistri shëndetësor, QKMF dhe çështje të kujdesit.' },
    { id: 'safety', label: 'Siguri dhe emergjenca', description: 'Siguria publike, emergjencat dhe orientimi te institucionet.' },
    { id: 'administration', label: 'Administratë dhe dokumente', description: 'Dokumente, procedura dhe kërkesa administrative.' },
    { id: 'other', label: 'Të tjera', description: 'Kërkesa që nuk përshtaten në departamentet e mësipërme.' },
];
export const SUPPORT_STATUS_ORDER = [
    'waiting_agent',
    'active_agent',
    'bot',
    'resolved',
];
export const SUPPORT_STATUS_LABELS = {
    bot: 'Bot',
    waiting_agent: 'Në pritje të agjentit',
    active_agent: 'Në bisedë',
    resolved: 'E zgjidhur',
};
export function createAgentTrackId() {
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `AG-${Date.now().toString(36).toUpperCase()}-${suffix}`;
}
export function isSupportDepartment(value) {
    return SUPPORT_DEPARTMENTS.some((department) => department.id === value);
}
export function toSupportDate(value) {
    if (value instanceof Date)
        return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value === 'number' || typeof value === 'string') {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    if (value && typeof value === 'object') {
        const timestamp = value;
        if (typeof timestamp.toDate === 'function') {
            const date = timestamp.toDate();
            return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
        }
        if (typeof timestamp.seconds === 'number') {
            const date = new Date(timestamp.seconds * 1000);
            return Number.isNaN(date.getTime()) ? null : date;
        }
    }
    return null;
}
export function toSupportIso(value, fallback = new Date().toISOString()) {
    return toSupportDate(value)?.toISOString() || fallback;
}
export function normalizeSupportChat(id, rawData) {
    const messages = Array.isArray(rawData.messages) ? rawData.messages : [];
    const status = ['bot', 'waiting_agent', 'active_agent', 'resolved'].includes(String(rawData.status))
        ? rawData.status
        : 'bot';
    return {
        id,
        userId: String(rawData.userId || id),
        userName: String(rawData.userName || 'Vizitor'),
        userEmail: String(rawData.userEmail || 'Nuk ka email'),
        status,
        messages: messages.map((message, index) => {
            const item = (message || {});
            const role = ['user', 'bot', 'agent'].includes(String(item.role))
                ? item.role
                : 'bot';
            return {
                id: String(item.id || `${id}-message-${index}`),
                role,
                content: String(item.content || ''),
                createdAt: toSupportIso(item.createdAt),
            };
        }),
        createdAt: rawData.createdAt ? toSupportIso(rawData.createdAt) : null,
        updatedAt: rawData.updatedAt ? toSupportIso(rawData.updatedAt) : null,
        agentTrackId: rawData.agentTrackId ? String(rawData.agentTrackId) : undefined,
        department: isSupportDepartment(rawData.department) ? rawData.department : 'help',
        assignedTo: rawData.assignedTo ? String(rawData.assignedTo) : null,
        assignedAgentName: rawData.assignedAgentName ? String(rawData.assignedAgentName) : null,
        agentRequestedAt: rawData.agentRequestedAt ? toSupportIso(rawData.agentRequestedAt) : undefined,
        resolvedAt: rawData.resolvedAt ? toSupportIso(rawData.resolvedAt) : undefined,
        resolvedBy: rawData.resolvedBy ? String(rawData.resolvedBy) : undefined,
    };
}
export function getSupportSortTime(chat) {
    return toSupportDate(chat.updatedAt)?.getTime() || toSupportDate(chat.createdAt)?.getTime() || 0;
}
export function groupSupportMessages(messages) {
    return messages.reduce((groups, message) => {
        const lastGroup = groups[groups.length - 1];
        if (lastGroup?.role === message.role) {
            lastGroup.messages.push(message);
        }
        else {
            groups.push({ role: message.role, messages: [message] });
        }
        return groups;
    }, []);
}
