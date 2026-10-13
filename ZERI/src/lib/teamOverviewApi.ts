import { describeApiFailure, requireAdminToken } from './adminApi';

/** The manager's team view; see server/teamOverview.ts. */
export interface TeamAgent {
  uid: string;
  name: string;
  email: string;
  role: string;
  holding: number;
  actions24h: number;
  actions7d: number;
  lastActionAt: string | null;
  dormant: boolean;
  sharePercent: number;
}

export interface TeamOverview {
  generatedAt: string;
  queue: { pending: number; unassigned: number; overdue: number; oldestPendingAt: string | null };
  team: { totalHeld: number; dormantHolders: number; imbalance: number; agents: number };
  agents: TeamAgent[];
}

export async function loadTeamOverview(fresh = false): Promise<TeamOverview> {
  const token = await requireAdminToken();
  const response = await fetch(`/api/v1/admin/team-overview${fresh ? '?fresh=1' : ''}`, { headers: { Authorization: `Bearer ${token}` } });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(describeApiFailure(response.status, result));
  return result as TeamOverview;
}
