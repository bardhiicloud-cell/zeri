/**
 * Validation of citizen submissions (news tips, donation applications), shared by
 * the server routes and the browser's direct Firestore path.
 *
 * Pure and dependency-free on purpose, so the client bundle can import it: when the
 * /api server is not reachable the page writes to Firestore itself, and the record
 * must then pass exactly the checks the server would have applied. firestore.rules
 * enforces the same bounds on that write.
 */

type Result<T> = { ok: true; value: T } | { ok: false; errors: Record<string, string> };

/** Same as server/contactMessages.ts `clean`: strip control characters, trim, cap. */
const clean = (v: unknown, max: number): string =>
  // eslint-disable-next-line no-control-regex -- stripping control characters is the point
  typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max) : '';

export const TIP_CATEGORIES = ['korrupsion', 'antipropagande', 'politike', 'ekonomi', 'siguri', 'mjedis', 'shoqeri', 'tjera'] as const;

/** The body ceiling is 1 MB, so the embedded media has to leave room for the text. */
export const TIP_MEDIA_MAX_CHARS = 700_000;
export const TIP_MEDIA_MAX_ITEMS = 3;
const MEDIA_DATA_URI = /^data:(image\/(?:jpeg|png|webp)|video\/(?:mp4|webm));base64,[A-Za-z0-9+/=]+$/;

export interface TipInput {
  title: string; body: string; category: string; municipality: string; place: string;
  anonymous: boolean; contactName: string; contactEmail: string; contactPhone: string;
  media: Array<{ type: 'image' | 'video'; url: string }>;
}


export function validateTip(body: unknown): Result<TipInput> {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const errors: Record<string, string> = {};
  const title = clean(b.title, 160);
  const text = clean(b.body, 6000);
  const category = clean(b.category, 30);
  const anonymous = b.anonymous === true;
  const contactEmail = anonymous ? '' : clean(b.contactEmail, 160);
  const rawMedia = Array.isArray(b.media) ? b.media : [];
  if (title.length < 8) errors.title = 'Titulli duhet të ketë të paktën 8 shkronja.';
  if (text.length < 40) errors.body = 'Shkruani çfarë dini (të paktën 40 shkronja): kush, çfarë, ku dhe kur.';
  if (!(TIP_CATEGORIES as readonly string[]).includes(category)) errors.category = 'Zgjidhni një kategori.';
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contactEmail)) errors.contactEmail = 'Emaili nuk është i vlefshëm.';
  if (rawMedia.length > TIP_MEDIA_MAX_ITEMS) errors.media = `Maksimumi ${TIP_MEDIA_MAX_ITEMS} foto ose video.`;
  const media: TipInput['media'] = [];
  let total = 0;
  for (const item of rawMedia.slice(0, TIP_MEDIA_MAX_ITEMS)) {
    const url = typeof item === 'string' ? item : typeof (item as { url?: unknown })?.url === 'string' ? (item as { url: string }).url : '';
    const match = MEDIA_DATA_URI.exec(url.trim());
    total += url.length;
    if (!match) { errors.media = 'Lejohen vetëm foto JPG, PNG, WebP ose video MP4, WebM.'; break; }
    media.push({ type: match[1].startsWith('video') ? 'video' : 'image', url: url.trim() });
  }
  if (total > TIP_MEDIA_MAX_CHARS) errors.media = 'Fotot dhe videoja janë shumë të mëdha; zvogëloni ose dërgoni më pak.';
  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      title, body: text, category, anonymous,
      municipality: clean(b.municipality, 80), place: clean(b.place, 200),
      contactName: anonymous ? '' : clean(b.contactName, 120), contactEmail, contactPhone: anonymous ? '' : clean(b.contactPhone, 40),
      media,
    },
  };
}

export const DONATION_CATEGORIES = ['semundje', 'shtepi', 'ushqim', 'veshmbathje', 'tjera'] as const;
/** The JSON body ceiling is 1 MB, so the embedded media has to leave room for the text fields. */
export const DONATION_MEDIA_MAX_CHARS = 880_000;

export interface DonationApplicationInput {
  title: string; description: string; category: string;
  mediaType: 'image' | 'video'; mediaUrl: string; donationUrl: string;
}

export function validateDonationApplication(body: unknown): Result<DonationApplicationInput> {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const title = clean(b.title, 140);
  const description = clean(b.description, 3000);
  const category = clean(b.category, 20);
  const donationUrlRaw = clean(b.donationUrl, 500);
  const mediaUrl = typeof b.mediaUrl === 'string' ? b.mediaUrl.trim() : '';
  const errors: Record<string, string> = {};
  if (title.length < 5) errors.title = 'Titulli duhet të ketë të paktën 5 shkronja.';
  if (description.length < 20) errors.description = 'Përshkrimi duhet të ketë të paktën 20 shkronja.';
  if (!(DONATION_CATEGORIES as readonly string[]).includes(category)) errors.category = 'Zgjidhni një kategori.';
  let donationUrl = '';
  if (donationUrlRaw) {
    try {
      const u = new URL(donationUrlRaw);
      if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('protocol');
      donationUrl = u.toString();
    } catch {
      errors.donationUrl = 'Lidhja duhet të fillojë me https://';
    }
  }
  const media = MEDIA_DATA_URI.exec(mediaUrl);
  if (!media || mediaUrl.length > DONATION_MEDIA_MAX_CHARS) errors.mediaUrl = 'Shtoni një foto (JPG, PNG, WebP) ose video të shkurtër (MP4, WebM) brenda kufirit të madhësisë.';
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { title, description, category, mediaType: media![1].startsWith('video') ? 'video' : 'image', mediaUrl, donationUrl } };
}
