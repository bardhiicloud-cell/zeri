/**
 * Official social-media brand marks.
 *
 * Lucide ships generic glyphs, not brand logos: its `Twitter` is the retired
 * blue bird, and X has no Lucide equivalent at all. Using those would put a
 * defunct logo in the footer of a government-facing platform. These are the
 * official paths from each platform's own brand asset, drawn on a 24×24 grid so
 * they sit on the same optical weight as the Lucide icons beside them.
 *
 * Each is a plain `currentColor` fill so a single `text-*` class controls the
 * colour, including in dark mode — the brand palettes are deliberately not baked
 * in, because several different brand colours read as decoration rather than as
 * navigation.
 */
import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

/** Facebook — the official "f" mark. */
export function FacebookIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.52 1.49-3.91 3.77-3.91 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.89h2.78l-.45 2.91h-2.33V22c4.78-.76 8.44-4.92 8.44-9.94Z" />
    </svg>
  );
}

/** Instagram — rounded frame, lens and flash. */
export function InstagramIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41-.56-.22-.96-.48-1.38-.9-.42-.42-.68-.82-.9-1.38-.16-.42-.36-1.06-.41-2.23-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41 1.27-.06 1.65-.07 4.85-.07Zm0-2.16C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63c-.79.3-1.46.72-2.13 1.38C1.35 2.68.93 3.35.63 4.14.33 4.9.13 5.78.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.3.79.72 1.46 1.38 2.13.67.66 1.34 1.08 2.13 1.38.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56.79-.3 1.46-.72 2.13-1.38.66-.67 1.08-1.34 1.38-2.13.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91-.3-.79-.72-1.46-1.38-2.13C21.32 1.35 20.65.93 19.86.63c-.76-.3-1.64-.5-2.91-.56C15.67.01 15.26 0 12 0Zm0 5.84a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32Zm0 10.16a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm7.85-10.4a1.44 1.44 0 1 1-2.88 0 1.44 1.44 0 0 1 2.88 0Z" />
    </svg>
  );
}

/** X (formerly Twitter) — the current mark. */
export function XIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.65l-5.22-6.82-5.96 6.82H1.68l7.73-8.84L1.25 2.25H8.07l4.71 6.23 5.46-6.23Zm-1.16 17.52h1.83L7.01 4.13H5.04l12.04 15.64Z" />
    </svg>
  );
}

/**
 * TikTok — the note glyph.
 *
 * Drawn as a single filled path like the others, so it inherits `currentColor`
 * and matches the optical weight of the row. The official logo is a cyan/red
 * offset pair; reproducing that here would make one tile in a row of four shout,
 * which is why the mark is monochrome like its neighbours.
 */
export function TikTokIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5 2.6 2.6 0 0 1-2.59-2.6 2.6 2.6 0 0 1 3.32-2.49V9.66a5.72 5.72 0 0 0-.73-.05A5.71 5.71 0 0 0 4.15 15.3 5.71 5.71 0 0 0 9.86 21a5.71 5.71 0 0 0 5.71-5.7V9.01a7.35 7.35 0 0 0 4.29 1.38V7.3a4.28 4.28 0 0 1-3.26-1.48Z" />
    </svg>
  );
}

/** YouTube — the play triangle is knocked out so the mark stays legible in monochrome. */
export function YouTubeIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path
        fillRule="evenodd"
        d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.6 3.6 12 3.6 12 3.6s-7.6 0-9.4.5A3 3 0 0 0 .5 6.2 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.8.5 9.4.5 9.4.5s7.6 0 9.4-.5a3 3 0 0 0 2.1-2.1A31.3 31.3 0 0 0 24 12a31.3 31.3 0 0 0-.5-5.8ZM9.6 15.6V8.4L15.8 12l-6.2 3.6Z"
      />
    </svg>
  );
}

/** Discord — the community chat mark in the same monochrome style as the other icons. */
export function DiscordIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M19.7 5.3a19.1 19.1 0 0 0-4.5-1.5l-.6 1.2a16 16 0 0 0-5.2 0l-.6-1.2a19.1 19.1 0 0 0-4.5 1.5C1.5 9.5.7 13.7 1.1 17.8a18.4 18.4 0 0 0 5.6 2.8l1.2-2a11.8 11.8 0 0 1-1.9-.9l.5-.4a13.4 13.4 0 0 0 11 0l.5.4a11.8 11.8 0 0 1-1.9.9l1.2 2a18.4 18.4 0 0 0 5.6-2.8c.5-4.8-.8-8.9-3.2-12.5ZM8.6 14.7c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Zm6.8 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Z" />
    </svg>
  );
}

/**
 * The platform's social profiles, in the order they are presented.
 *
 * One list, consumed by the footer and the mobile sheet. Keeping the URLs here
 * rather than inline in a component means a handle change is a one-line edit and
 * cannot be fixed in one surface but missed in the other.
 *
 * `rel="me"` is what lets a visitor verify that these profiles belong to this
 * domain, and `noopener noreferrer` is required on any `target="_blank"` link —
 * without `noopener` the opened page can reach back through `window.opener`.
 */
export const SOCIAL_LINKS = [
  {
    id: 'youtube',
    label: 'YouTube',
    href: 'https://www.youtube.com/channel/UCo5S3-m-vXKFt_VQlFwnumQ',
    Icon: YouTubeIcon,
  },
  {
    id: 'facebook',
    label: 'Facebook',
    href: 'https://www.facebook.com/profile.php?id=61594633246174',
    Icon: FacebookIcon,
  },
  {
    id: 'instagram',
    label: 'Instagram',
    href: 'https://www.instagram.com/zeriqytetarve/',
    Icon: InstagramIcon,
  },
  {
    id: 'x',
    label: 'X',
    href: 'https://x.com/zeriqytetarve',
    Icon: XIcon,
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    href: 'https://www.tiktok.com/@zeriqytetarve',
    Icon: TikTokIcon,
  },
  {
    id: 'discord',
    label: 'Discord',
    href: 'https://discord.gg/eSGPt5aXH',
    Icon: DiscordIcon,
  },
];

/** The shape of one profile, exported so consumers do not have to infer it. */
export type SocialLink = (typeof SOCIAL_LINKS)[number];

/**
 * The same profiles split into the two halves the search bar flanks them with.
 *
 * Declared here rather than sliced at the call site so the halves cannot drift:
 * adding a profile means deciding which side it belongs to, and the split stays
 * balanced by construction. `SOCIAL_LEFT` renders before the field and
 * `SOCIAL_RIGHT` after it, which is what gives the row its symmetrical look.
 *
 * Annotated as `SocialLink[]` rather than left to inference. With `as const` on
 * the source array, `slice()` produces two *different* readonly tuple types, and
 * a component whose prop is their union cannot map over it meaningfully — the
 * union has no common element type to iterate, so nothing renders. The explicit
 * annotation collapses both halves to one plain array type.
 */
export const SOCIAL_LEFT: SocialLink[] = SOCIAL_LINKS.slice(0, 2);
export const SOCIAL_RIGHT: SocialLink[] = SOCIAL_LINKS.slice(2);