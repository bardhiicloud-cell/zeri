/**
 * Origin of a notification, which decides where it appears in the bell.
 *
 * `general` is the broadcast channel (platform/admin/municipality/public/
 * maintenance/feature notices); `report` is the citizen's own report activity,
 * always tied to a Track ID. The bell renders these as two separate tabs.
 */
export type NotificationCategory =
  | 'platform'
  | 'administration'
  | 'municipality'
  | 'public'
  | 'urgent'
  | 'maintenance'
  | 'feature'
  | 'report';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

/** Lifecycle of a broadcast, so an admin can publish/archive/deactivate. */
export type NotificationState = 'draft' | 'published' | 'archived' | 'disabled';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  /** ISO timestamp; the bell derives both the date and the clock time from it. */
  createdAt: string;
  isRead: boolean;
  type?: 'info' | 'alert' | 'success';
  sender?: string;
  /** Which bell tab this belongs to. Defaults to 'general' for legacy docs. */
  channel?: 'general' | 'report';
  category?: NotificationCategory;
  priority?: NotificationPriority;
  /** True when the bell should show a red urgency indicator. */
  urgent?: boolean;
  /** Where a broadcast appears besides the bell: banner, popup, news strip (see lib/notificationPlacements.ts). */
  placements?: Array<'bell' | 'banner' | 'popup' | 'news'>;
  /** ISO time after which a broadcast stops appearing anywhere. */
  expiresAt?: string | null;
  /** In-app route the notification deep-links to when clicked. */
  link?: string;
  /**
   * Delivery scope. `all` is a public broadcast; `user` targets one recipient;
   * `municipality` targets every reporter in a commune; `role` targets staff.
   */
  audience?: 'all' | 'user' | 'municipality' | 'role';
  /** Recipient uid when audience === 'user'. */
  userId?: string;
  /** Report this notification concerns; drives the "Raportimet e mia" tab. */
  reportId?: string;
  /** Track ID shown in the notification and used for guest targeting. */
  trackId?: string;
  municipality?: string;
  /** Admin broadcast lifecycle. Absent on legacy/personal docs = published. */
  state?: NotificationState;
  /** Icon key the bell maps to a Lucide icon. */
  icon?: string;
  /** Author uid of a broadcast, for the admin audit trail. */
  createdBy?: string;
}

/**
 * The sections a staff member can be granted access to.
 *
 * This used to be a second, independent permission vocabulary
 * (`'ai_calls' | 'gis' | 'discussions' | ...`) that had drifted away from the
 * admin panel's actual section ids (`'categories'`, and so on). Two lists
 * describing the same thing guaranteed that granting a permission somewhere had
 * no effect somewhere else, which is the worst possible failure mode for an
 * access-control system: silent, and in the permissive direction.
 *
 * The canonical list now lives in src/lib/adminPermissions.ts as AdminSection.
 * It is re-exported here so existing `User['permissions']` annotations keep
 * working, and the obsolete names are kept as deprecated aliases so a stored
 * document using them still resolves rather than failing to type-check.
 *
 * @deprecated Import AdminSection from lib/adminPermissions instead.
 */
export type StaffPermission =
  | 'reports' | 'ai_calls' | 'donations' | 'health' | 'ads' | 'polls'
  | 'notifications' | 'forum' | 'discussions' | 'support' | 'news' | 'users'
  | 'gis' | 'security' | 'settings';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  /**
   * 'municipality' is a paying customer account, not platform staff.
   *
   * It exists so a municipality can answer reports and correct facts about
   * itself, and it is deliberately subject to the editorial firewall in
   * lib/editorialFirewall.ts: it can add context, never remove content.
   */
  role: 'citizen' | 'admin' | 'superadmin' | 'agent' | 'responder' | 'dispatcher' | 'monitor' | 'approver' | 'newsadmin' | 'adsadmin' | 'debatwp' | 'municipality' | 'guest';
  /**
   * The municipality this account represents or is scoped to.
   * For a municipality account this is the jurisdiction it may act within, and
   * the firewall refuses any action outside it.
   */
  municipality?: string;
  /**
   * Subscription tier for a municipality account. Recorded for billing and for
   * the panel header; it grants NO additional editorial power, by design.
   */
  municipalityPlan?: 'basic' | 'standard' | 'pro';
  /** ISO timestamp of when the editorial firewall clause was accepted. */
  editorialClauseAcceptedAt?: string;
  points: number;
  badges: string[];
  avatar?: string;
  /** Short public bio shown on the Debati Publik profile (max 160 chars). */
  bio?: string;
  /** Debati Publik privacy / notification choices; see lib/forumPrefs.ts. */
  forumPrefs?: import('./lib/forumPrefs').ForumPrefs;
  isBanned?: boolean;
  isVerified?: boolean;
  trustScore?: number;
  votedPolls?: string[];
  claimedRewards?: string[];
  /**
   * Section grants for staff. Typed as the canonical AdminSection union so a
   * value written by the admin panel is always one the panel can render.
   */
  permissions?: import('./lib/adminPermissions').AdminSection[];
  notes?: string;
}

export interface HealthCase {
  id: string;
  trackingId?: string;
  expiresAt?: string;
  fullName: string;
  age: number;
  gender: 'Mashkull' | 'Femër' | 'Tjetër';
  municipality: string;
  neighborhood: string;
  category: 'Kancer / Onkologji' | 'Sëmundje të Zemrës' | 'Sëmundje të Mushkërive' | 'Sëmundje të Veshkave & Dializë' | 'Diabet me Komplikime' | 'Sëmundje Neurologjike' | 'Sëmundje e Rrallë' | 'Tjetër';
  diagnosis: string;
  diagnosedYear: number;
  urgency: 'Urgjente' | 'Mesatare' | 'Kronike e Stabilizuar';
  needs: string[];
  description: string;
  contactPhone?: string;
  contactName?: string;
  isAnonymous: boolean;
  consentToProcessing?: boolean;
  /** Contact data is visible only to authorized health administrators, never on the public registry. */
  contactVisibility?: 'admin_only';
  /**
   * When a health administrator converted the record into an anonymous one.
   *
   * A case is submitted with the real identity so that staff can verify it is
   * genuine; `anonymizedAt` is the audit mark left when that identity is then
   * redacted from every public view. "Who hid this patient's name, and when"
   * is a question a health registry has to be able to answer.
   */
  anonymizedAt?: string;
  /** Instruction supplied to the hospital when a case is submitted anonymously. */
  hospitalPrivacyNotice?: string;
  supportAmountNeeded?: number;
  supportAmountRaised?: number;
  donationUrl?: string;
  imageUrl?: string;
  documentType?: 'image' | 'pdf';
  documentName?: string;
  hospitalNotified?: boolean;
  hospitalNotifiedAt?: string;
  hospitalTarget?: string;
  statusUpdatedAt?: string;
  statusNote?: string;
  authorId?: string;
  status: 'verified' | 'pending' | 'rejected' | 'resolved';
  createdAt: string;
}

export type IssueStatus = 'Draft' | 'Pending Review' | 'Approved' | 'Assigned' | 'In Progress' | 'Resolved' | 'Rejected' | 'Overdue' | 'Closed';

export type UrgentLevel = 'E ulët' | 'Mesatare' | 'E lartë' | 'Kritike';

export interface Location {
  lat: number;
  lng: number;
  address?: string;
  municipality?: string;
  /**
   * The neighbourhood or quarter, where the citizen supplied one.
   *
   * `municipalityScope.recordMatchesScope` already reads this field when
   * deciding whether a record belongs to the active scope, and the review screen
   * shows it as a routing hint — but it was never declared here, so every reader
   * had to cast around it.
   */
  neighborhood?: string;
  districtMapId?: string; // GIS Overlay Reference
}

export interface ReportTimelineEvent {
  id: string;
  status: IssueStatus;
  date: string;
  comment?: string;
  /**
   * Display label of whoever made the change. Never an email address: the
   * timeline is rendered on the public Track ID page, so a staff email here
   * would leak PII. Use the actor's name/role/institution instead.
   */
  updatedBy: string;
  /** Role of the actor at the time of the change (agent/municipality/staff/system). */
  actorRole?: string;
  /** Institution the actor represents, shown on the public timeline. */
  actorInstitution?: string;
  /** Status before this change, for the before/after view. */
  previousStatus?: IssueStatus;
  /** Where the change came from. */
  source?: 'admin' | 'municipality' | 'agent' | 'system' | 'citizen';
  /** Photos/documents/videos attached to this specific event. */
  attachments?: MediaItem[];
}

/**
 * A single, queryable report lifecycle event.
 *
 * The embedded `Report.timeline` array is fast to read with one report but
 * cannot be queried across reports. This collection is the source of truth for
 * cross-report feeds: the news sidebar's "Njoftime Live" (recent public
 * municipality responses, filterable by commune) and per-report history both
 * read it. The server transition endpoint writes one of these per change.
 */
export interface ReportEvent {
  id: string;
  reportId: string;
  /** Track ID denormalized so the live feed can link without a second read. */
  trackId?: string;
  status: IssueStatus;
  previousStatus?: IssueStatus;
  /** Albanian, human-readable status label captured at write time. */
  statusLabel?: string;
  municipality?: string;
  category?: string;
  /** Short, privacy-safe summary of the report for public feeds. */
  reportTitle?: string;
  comment?: string;
  actorId?: string;
  actorName?: string;
  actorRole?: string;
  actorInstitution?: string;
  source?: 'admin' | 'municipality' | 'agent' | 'system' | 'citizen';
  attachments?: MediaItem[];
  /** Safe to show in the public live feed (never exposes reporter identity). */
  isPublic: boolean;
  /** Whether this change should notify the reporter. */
  notifyReporter: boolean;
  createdAt: string;
}

export interface Comment {
  id: string;
  authorId: string;
  aiCategoryScore?: number;
  aiRoutingReason?: string;
  aiForensicsReport?: string;
  authorName: string;
  content: string;
  createdAt: string;
  authorAvatar?: string;
}

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
  votes: string[]; // userIds who voted for this option
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
  isApproved?: boolean;
  isHidden?: boolean;
  category?: string;
  neighborhood?: string;
  poll?: PostPoll;
  likes: string[];
  reactions?: Record<string, string[]>; 
  isAd?: boolean;
  adLink?: string;
  /**
   * Post audience. 'public' (default) is visible to everyone; 'followers' is
   * visible only to the author and to people who follow the author. Legacy
   * posts have no field and are treated as public.
   */
  visibility?: 'public' | 'followers';
  comments: ForumComment[];
  aiSentiment?: {
    positivePct: number;
    negativePct: number;
    neutralPct: number;
    summaryText: string;
  };
  createdAt: any;
}

export interface MediaItem {
  id?: string;
  url: string;
  /** `document` covers PDF/office files; `audio` covers voice notes. */
  type: 'image' | 'video' | 'document' | 'audio';
  /** Original filename, shown for documents/audio which have no visual preview. */
  name?: string;
  sizeBytes?: number;
  mimeType?: string;
}

export interface Report {
  id: string;
  trackingId?: string;
  responsibleInstitution?: string;
  responsibleLevel?: 'Komunale' | 'Qendrore' | 'Publike' | 'Siguri' | 'Lokal';
  responsibleOffice?: string;
  responseDueAt?: string;
  accountabilityStatus?: 'Në pritje' | 'Në shqyrtim' | 'Në trajtim' | 'Përgjegjësi e vonuar' | 'E zgjidhur';
  title: string;
  description: string;
  category: string;
  topicCategory?: string;
  /** Urban or rural place, set by staff; decides whether the municipality or the state answers. */
  zone?: 'urban' | 'rural';
  urgency: UrgentLevel;
  location: Location;
  images: string[];
  resolvedImage?: string;
  resolvedAt?: string;
  media?: MediaItem[];
  status: IssueStatus;
  createdAt: string;
  /** Set when an administrator last changed the status; used to compute resolution time. */
  updatedAt?: string;
  upvotes: number;
  commentsCount: number;
  comments?: Comment[];
  authorId: string;
  authorName: string;
  isAnonymous: boolean;
  isAd?: boolean;
  adLink?: string;
  assignedTo?: string; // e.g. "Drejtoria e Infrastrukturës"
  /** The person holding the report while it is checked (server-written). */
  assignedToUid?: string;
  assignedAt?: string;
  timeline: ReportTimelineEvent[];
  aiSeverity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; 
  aiTags?: string[]; 
  aiSummary?: string; 
}

export interface ChatMessage {
  id: string;
  sender: 'ai' | 'user' | 'agent';
  text: string;
  time: string;
}

export interface ChatSession {
  id: string;
  userId: string;
  userName: string;
  status: 'active' | 'closed';
  rating?: number;
  messages: ChatMessage[];
  updatedAt: string;
}

export interface LiveMessage {
  id: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
  ip: string;
}

export interface Category {
  id: string;
  name: string;
  group?: string;
}

export interface Poll {
  id: string;
  question: string;
  description?: string;
  image?: string;
  options: { id: string; text: string; votes: number; icon?: string }[];
  totalVotes: number;
  createdAt: string;
  expiresAt: string;
  createdBy: string;
  category?: string;
  municipality?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  userId: string;
  userEmail: string;
  details?: string;
  ip?: string;
  status: 'success' | 'warning' | 'danger';
  createdAt: string;
  /**
   * The display name of the actor, captured at the time of the action.
   *
   * Without it the log can only be joined to a person by their email address, so
   * the per-agent monitoring view had to re-derive the name from the users
   * collection and every renamed or deleted account silently lost its history.
   */
  userName?: string;
  /**
   * The municipality the action was taken in — the admin's active scope at that
   * moment. This is the field that makes "which agent did what, where" a single
   * query instead of a guess, and it is stored on the record rather than looked
   * up later because the scope at the time of the action is not recoverable
   * afterwards.
   */
  municipality?: string;
}

export type NewsStatus = 'Draft' | 'Pending' | 'In Review' | 'Approved' | 'Published' | 'Rejected' | 'Archived';

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  content: string;
  featuredImage?: string;
  gallery?: string[];
  uploadedVideos?: string[];
  youtubeVideoUrl?: string;
  referrerUrl?: string; // e.g. Burimi
  category: string;
  tags?: string[];
  authorId: string;
  authorName: string;
  publishedAt: string;
  updatedAt?: string;
  views: number;
  shares?: number;
  likes?: number;
  status: NewsStatus;
  isTicker?: boolean; // Ticker breaking news flag
  comments?: Comment[];
  inArticleAdUrl?: string;
  inArticleAdTarget?: string;
}

/**
 * Ad positions a campaign can target.
 *
 * `Banner` is the platform's own strategic slot — the long-form card placed at
 * the foot of the dashboard, the report registry, the polls page, the donations
 * page and the health registry. It is a fixed-height, non-intrusive surface:
 * it never overlays content, never interrupts a reading flow, and renders
 * nothing at all when unsold, so an empty slot can never look like a broken
 * module or a "your ad here" bait box.
 */
export type AdPosition =
  | 'Top Banner'
  | 'Mid Article Banner'
  | 'Inline Banner'
  | 'Sidebar Left'
  | 'Sidebar Right'
  | 'Bottom Banner'
  | 'Sticky Banner'
  | 'Floating Banner'
  | 'Banner';

export type AdType = 'Image' | 'Video' | 'GIF' | 'HTML Banner' | 'JavaScript Banner' | 'Sponsor Card' | 'Popup' | 'Floating Ad';

export interface Advertisement {
  id: string;
  title: string;
  section: string; // The specific section in the website, e.g. 'News', 'Dashboard', 'Reports', etc.
  position: AdPosition;
  type: AdType;
  mediaUrl: string; // Used for Image/Video/GIF
  htmlContent?: string; // Used for HTML/JS
  targetUrl: string; // Where it redirects
  targeting?: {
    country?: string;
    city?: string;
    device?: 'Mobile' | 'Desktop' | 'Tablet' | 'All';
    category?: string;
  };
  startDate: string;
  endDate: string;
  maxClicks?: number;
  maxImpressions?: number;
  priority: number;
  status: 'active' | 'paused' | 'expired';
  stats: {
    impressions: number;
    clicks: number;
    ctr: number;
    revenue: number;
  };
  createdBy: string;
  createdAt: string;
}


export interface OfficialProfile {
  id: string;
  name: string;
  handle: string;
  verified: boolean;
  followers: string;
  initials: string;
  color: string;
  createdAt?: any;
}

/**
 * A citizen-reported medicine shortage ("mungesë ilaçi").
 *
 * Greenfield collection `medicineShortages`. Kept separate from `healthRegistry`
 * because a shortage is a public, aggregate signal (which drug is missing where)
 * while a health case is private personal data. Only aggregate, non-identifying
 * fields are ever surfaced publicly.
 */
export interface MedicineShortage {
  id: string;
  medicineName: string;
  dose?: string;
  /** e.g. tablet, syrup, injection. */
  form?: string;
  /** Pharmacy or institution where the shortage was observed. */
  institution?: string;
  municipality: string;
  location?: Location;
  reportedDate: string;
  photoUrl?: string;
  comment?: string;
  /** Reporter's own assessment of how much is available, if known. */
  quantityStatus?: 'Ka mungesë totale' | 'Sasi e kufizuar' | 'Pjesërisht e disponueshme' | 'E panjohur';
  status: 'pending' | 'verified' | 'resolved' | 'rejected';
  isAnonymous: boolean;
  authorId?: string;
  createdAt: string;
  updatedAt?: string;
  statusNote?: string;
  verifiedBy?: string;
  verifiedAt?: string;
}
