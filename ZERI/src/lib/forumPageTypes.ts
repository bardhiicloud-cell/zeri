import { FORUM_MUNICIPALITIES } from './constants';

/** Shapes and static lists used by the forum page, kept apart from the 2,500-line component. */
// Static forum data lives in src/lib/constants.ts on purpose: a page module that
// exports plain values alongside its component breaks Vite's React Fast Refresh
// boundary ("Could not Fast Refresh ... export is incompatible").
export const FORUM_CATEGORIES = [
  { id: 'all', name: 'Të Gjitha' },
  { id: 'infrastrukture', name: 'Infrastrukturë', color: 'bg-blue-500' },
  { id: 'mjedis', name: 'Mjedis & Pemë', color: 'bg-emerald-500' },
  { id: 'arsim', name: 'Arsim & Shkolla', color: 'bg-amber-500' },
  { id: 'transport', name: 'Transport & Trafik', color: 'bg-rose-500' },
  { id: 'kulture', name: 'Kulturë & Rini', color: 'bg-purple-500' },
  { id: 'shendetesi', name: 'Shëndetësi', color: 'bg-teal-500' },
  { id: 'siguri', name: 'Siguri Qytetare', color: 'bg-indigo-500' }
];

export const KOSOVO_MUNICIPALITIES = FORUM_MUNICIPALITIES;

export interface CommentReply {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  createdAt: string;
}

export interface ForumComment {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  createdAt: string;
  replies?: CommentReply[];
  likes?: string[];
}

export interface PostPollOption {
  id: string;
  text: string;
  votes: string[];
}

export interface PostPoll {
  question: string;
  options: PostPollOption[];
  totalVotes: number;
}

export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  authorEmail?: string;
  authorAvatar?: string;
  authorRole: string;
  authorBadge?: string;
  content: string;
  imageUrl?: string;
  category?: string;
  neighborhood?: string;
  poll?: PostPoll;
  quotedPost?: {
    id: string;
    authorName: string;
    authorAvatar?: string;
    authorBadge?: string;
    content: string;
    imageUrl?: string;
    createdAt?: any;
  };
  isApproved?: boolean;
  isHidden?: boolean;
  likes: string[];
  reposts?: string[];
  reactions?: Record<string, string[]>;
  isAd?: boolean;
  adLink?: string;
  /** Post audience: 'public' everywhere, 'followers' only to people who follow the author. Legacy posts have no field and are treated as public. */
  visibility?: 'public' | 'followers';
  comments: ForumComment[];
  aiSentiment?: {
    positivePct: number;
    negativePct: number;
    neutralPct: number;
    summaryText: string;
  };
  /** Impressions, counted server-side once per account. */
  viewCount?: number;
  /** Set by the server when the author edits the text. */
  editedAt?: any;
  /** Set by the server on soft delete; the post is hidden from the feed and restorable for 30 days. */
  deletedAt?: any;
  /** Counted by the server redirect, once per visitor per day. */
  adClicks?: number;
  createdAt: any;
}

// No placeholder institutions or topics: only real accounts and real posts are shown.
export const DEFAULT_OFFICIAL_PROFILES: any[] = [];

export const DEFAULT_TRENDS: any[] = [];
