export const SUPPORT_DEPARTMENTS = [
  { id: 'help', label: 'Qendra e Ndihmës', description: 'Pyetje për platformën, përdorimin dhe ndjekjen e kërkesave.' },
  { id: 'infrastructure', label: 'Infrastrukturë', description: 'Rrugë, ndriçim, kanalizime dhe hapësira publike.' },
  { id: 'municipal-services', label: 'Shërbime komunale', description: 'Shërbime lokale, pastrim, transport dhe mirëmbajtje.' },
  { id: 'health', label: 'Shëndetësi', description: 'Regjistri shëndetësor, QKMF dhe çështje të kujdesit.' },
  { id: 'safety', label: 'Siguri dhe emergjenca', description: 'Siguria publike, emergjencat dhe orientimi te institucionet.' },
  { id: 'administration', label: 'Administratë dhe dokumente', description: 'Dokumente, procedura dhe kërkesa administrative.' },
  { id: 'other', label: 'Të tjera', description: 'Kërkesa që nuk përshtaten në departamentet e mësipërme.' },
] as const;

export type SupportDepartment = (typeof SUPPORT_DEPARTMENTS)[number]['id'];
export type SupportChatStatus = 'bot' | 'waiting_agent' | 'active_agent' | 'resolved';
export type SupportMessageRole = 'user' | 'bot' | 'agent';

export interface SupportMessage {
  id: string;
  role: SupportMessageRole;
  content: string;
  createdAt: string;
}

export interface SupportChatRecord {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  status: SupportChatStatus;
  messages: SupportMessage[];
  createdAt?: string | null;
  updatedAt?: string | null;
  agentTrackId?: string;
  department?: SupportDepartment;
  assignedTo?: string | null;
  assignedAgentName?: string | null;
  agentRequestedAt?: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export const SUPPORT_STATUS_ORDER: SupportChatStatus[] = [
  'waiting_agent',
  'active_agent',
  'bot',
  'resolved',
];

export const SUPPORT_STATUS_LABELS: Record<SupportChatStatus, string> = {
  bot: 'Bot',
  waiting_agent: 'Në pritje të agjentit',
  active_agent: 'Në bisedë',
  resolved: 'E zgjidhur',
};

export function createAgentTrackId(): string {
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `AG-${Date.now().toString(36).toUpperCase()}-${suffix}`;
}

export function isSupportDepartment(value: unknown): value is SupportDepartment {
  return SUPPORT_DEPARTMENTS.some((department) => department.id === value);
}

export function toSupportDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number' || typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (value && typeof value === 'object') {
    const timestamp = value as { toDate?: () => Date; seconds?: number };
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

export function toSupportIso(value: unknown, fallback = new Date().toISOString()): string {
  return toSupportDate(value)?.toISOString() || fallback;
}

export function normalizeSupportChat(id: string, rawData: Record<string, unknown>): SupportChatRecord {
  const messages = Array.isArray(rawData.messages) ? rawData.messages : [];
  const status: SupportChatStatus = ['bot', 'waiting_agent', 'active_agent', 'resolved'].includes(String(rawData.status))
    ? (rawData.status as SupportChatStatus)
    : 'bot';

  return {
    id,
    userId: String(rawData.userId || id),
    userName: String(rawData.userName || 'Vizitor'),
    userEmail: String(rawData.userEmail || 'Nuk ka email'),
    status,
    messages: messages.map((message, index) => {
      const item = (message || {}) as Record<string, unknown>;
      const role: SupportMessageRole = ['user', 'bot', 'agent'].includes(String(item.role))
        ? (item.role as SupportMessageRole)
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

export function getSupportSortTime(chat: SupportChatRecord): number {
  return toSupportDate(chat.updatedAt)?.getTime() || toSupportDate(chat.createdAt)?.getTime() || 0;
}

export function groupSupportMessages(messages: SupportMessage[]) {
  return messages.reduce<Array<{ role: SupportMessageRole; messages: SupportMessage[] }>>((groups, message) => {
    const lastGroup = groups[groups.length - 1];
    if (lastGroup?.role === message.role) {
      lastGroup.messages.push(message);
    } else {
      groups.push({ role: message.role, messages: [message] });
    }
    return groups;
  }, []);
}
