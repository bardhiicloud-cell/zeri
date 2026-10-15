import { serverTimestamp } from 'firebase/firestore';
import { extractHashtags } from './forumTrends';

/**
 * The document the composer writes to `forumPosts`. It lives here, not inline in the page, so a
 * rules test can replay exactly what the browser sends (tests/rules/forumComposer.rules.test.ts):
 * the Firestore rules refuse any pre-seeded counter, engagement or edit state, and a drift between
 * this object and the rules means "Posto" fails for every citizen.
 */
export interface ComposerAuthor {
  id: string;
  name: string;
  avatar?: string | null;
  role: string;
  points?: number;
}

export interface ComposerInput {
  author: ComposerAuthor;
  content: string;
  category: string;
  neighborhood: string;
  poll: unknown | null;
  imageUrls: string[];
  followersOnly: boolean;
  /** Only honoured for ads staff; the rules refuse `isAd: true` from anyone else. */
  asAd: boolean;
  adLink: string;
}

export function buildForumPost(input: ComposerInput): Record<string, unknown> {
  const { author } = input;
  const imageUrls = input.imageUrls;
  return {
    isHidden: false,
    authorId: author.id,
    authorName: author.name,
    authorAvatar: author.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(author.name)}&background=0D8ABC&color=fff`,
    authorRole: author.role,
    authorBadge: (author.points ?? 0) > 100 ? 'Përfaqësues Lagjeje' : 'Qytetar i Verifikuar',
    content: input.content,
    hashtags: extractHashtags(input.content).slice(0, 10),
    category: input.category,
    neighborhood: input.neighborhood,
    poll: input.poll,
    imageUrl: imageUrls[0] ?? '',
    imageUrls,
    visibility: input.followersOnly ? 'followers' : 'public',
    isAd: input.asAd,
    adLink: input.asAd ? input.adLink : null,
    likes: [],
    comments: [],
    reactions: {},
    createdAt: serverTimestamp(),
  };
}
