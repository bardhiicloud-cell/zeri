import { authHeaders } from './apiAuth';
import type { ForumPrefs } from './forumPrefs';

/** Client for server/forumPeople.ts: the social graph, computed and enforced by the server. */

export interface ForumPerson {
  id: string;
  name: string;
  avatar: string;
  /** How many accounts follow this person. */
  followers: number;
  /** `[me]` when this person follows me, otherwise empty. Never their real list. */
  followingIds: string[];
  forumPrefs: ForumPrefs;
}

export interface PeopleResponse {
  people: ForumPerson[];
  me: { followers: number; following: number };
}

export class GraphApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly code: string) {
    super(message);
    this.name = 'GraphApiError';
  }
}

async function call<T>(path: string, method = 'GET'): Promise<T> {
  const response = await fetch(path, { method, headers: await authHeaders({ 'Content-Type': 'application/json' }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new GraphApiError(typeof data?.error === 'string' ? data.error : 'Veprimi dështoi.', response.status, typeof data?.code === 'string' ? data.code : 'error');
  }
  return data as T;
}

export const fetchPeople = (query = '', limit = 300) =>
  call<PeopleResponse>(`/api/v1/forum/people?limit=${limit}${query ? `&q=${encodeURIComponent(query)}` : ''}`);

export const followApi = (uid: string) => call<{ following: boolean; changed: boolean }>(`/api/v1/forum/follow/${encodeURIComponent(uid)}`, 'PUT');
export const unfollowApi = (uid: string) => call<{ following: boolean; changed: boolean }>(`/api/v1/forum/follow/${encodeURIComponent(uid)}`, 'DELETE');

export const fetchFollowList = (uid: string, kind: 'followers' | 'following') =>
  call<{ items: { id: string; name: string; avatar: string }[] }>(`/api/v1/forum/people/${encodeURIComponent(uid)}/${kind}`);
