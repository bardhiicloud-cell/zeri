/**
 * Single source of truth for ad creative sizes.
 *
 * Every placement renders the creative with `object-cover` at a fixed display
 * size (see AdBanner.tsx). The "ideal" size below is 2× that display size, so
 * it stays sharp on retina screens. The "minimum" is 1× and is the smallest
 * file that still looks acceptable. Admin uploads and the public Partners page
 * both read from here, so advertisers and staff always see the same numbers.
 */

export type AdMediaKind = 'image' | 'gif' | 'video';

export interface AdPositionSpec {
  label: string;
  /** Where the placement appears on the site, for advertisers. */
  where: string;
  /** Rendered size on desktop, in CSS pixels (width × height). */
  display: { w: number; h: number };
  /** Recommended upload size (2× the display size). */
  ideal: { w: number; h: number };
  /** Smallest upload accepted (1× the display size). */
  min: { w: number; h: number };
}

export const AD_POSITION_SPECS: Record<string, AdPositionSpec> = {
  top: {
    label: 'Baneri i sipërm',
    where: 'Nën navigimin kryesor, në krye të faqes',
    display: { w: 896, h: 76 },
    ideal: { w: 1792, h: 152 },
    min: { w: 896, h: 76 },
  },
  banner: {
    label: 'Baneri i fundit',
    where: 'Në fund të faqeve strategjike (Donacionet, Idetë, Lajmet)',
    display: { w: 896, h: 120 },
    ideal: { w: 1792, h: 240 },
    min: { w: 896, h: 120 },
  },
  article: {
    label: 'Brenda artikullit',
    where: 'Brenda faqes së lajmit, pas përmbajtjes hyrëse',
    display: { w: 896, h: 224 },
    ideal: { w: 1792, h: 448 },
    min: { w: 896, h: 224 },
  },
  inline: {
    label: 'Mes seksioneve',
    where: 'Mes seksioneve të ballinës, sondazheve dhe statistikave',
    display: { w: 800, h: 200 },
    ideal: { w: 1600, h: 400 },
    min: { w: 800, h: 200 },
  },
  feed: {
    label: 'Mes kartave në rrjedhë',
    where: 'Mes kartave të rezultateve dhe përmbajtjes',
    display: { w: 760, h: 96 },
    ideal: { w: 1520, h: 192 },
    min: { w: 760, h: 96 },
  },
  sidebar: {
    label: 'Kolona anësore',
    where: 'Kolona anësore në desktop (lajme, sondazhe)',
    display: { w: 320, h: 200 },
    ideal: { w: 640, h: 400 },
    min: { w: 320, h: 200 },
  },
};

/** Maximum file size per media kind. Video is the only large format. */
export const AD_MAX_BYTES: Record<AdMediaKind, number> = {
  image: 5 * 1024 * 1024,
  gif: 3 * 1024 * 1024,
  video: 10 * 1024 * 1024,
};

export const AD_VIDEO_MAX_SECONDS = 30;
/** Tolerated difference between the upload's ratio and the placement's ratio. */
const RATIO_TOLERANCE = 0.1;

export const AD_ACCEPT: Record<AdMediaKind, string> = {
  image: 'image/jpeg,image/png,image/webp',
  gif: 'image/gif',
  video: 'video/mp4,video/webm',
};

export const formatMb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(0)} MB`;

/** Human-readable guide shown next to the upload field. */
export function describeAdSpec(position: string, kind: AdMediaKind): string {
  const spec = AD_POSITION_SPECS[position];
  if (!spec) return 'Përzgjidhni një pozicion për të parë madhësinë e rekomanduar.';
  const size = `${spec.ideal.w} × ${spec.ideal.h} px`;
  const min = `minimumi ${spec.min.w} × ${spec.min.h} px`;
  const kindText =
    kind === 'video'
      ? `Video MP4 ose WebM, maks. ${AD_VIDEO_MAX_SECONDS} sekonda, maks. ${formatMb(AD_MAX_BYTES.video)}, pa zë të domosdoshëm.`
      : kind === 'gif'
        ? `GIF e animuar, maks. ${formatMb(AD_MAX_BYTES.gif)}.`
        : `JPG, PNG ose WebP, maks. ${formatMb(AD_MAX_BYTES.image)}.`;
  return `Madhësia ideale: ${size} (${min}). ${kindText}`;
}

export interface AdFileCheck {
  ok: boolean;
  errors: string[];
  warnings: string[];
  width?: number;
  height?: number;
  durationSeconds?: number;
}

/** Reads a local image or video and checks it against the placement. */
export function checkAdFile(file: File, position: string, kind: AdMediaKind): Promise<AdFileCheck> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const spec = AD_POSITION_SPECS[position];

  if (file.size > AD_MAX_BYTES[kind]) {
    errors.push(`Skedari është ${formatMb(file.size)}, por limiti për ${kind === 'video' ? 'video' : kind === 'gif' ? 'GIF' : 'foto'} është ${formatMb(AD_MAX_BYTES[kind])}.`);
  }
  if (!spec) {
    errors.push('Zgjidhni një pozicion para ngarkimit, që të kontrollohen dimensionet.');
  }

  const url = URL.createObjectURL(file);
  const finish = (partial: Partial<AdFileCheck>) => {
    URL.revokeObjectURL(url);
    const result: AdFileCheck = { ok: errors.length === 0, errors, warnings, ...partial };
    result.ok = errors.length === 0;
    return result;
  };

  const compare = (width: number, height: number) => {
    if (!spec) return;
    if (width < spec.min.w || height < spec.min.h) {
      errors.push(`Dimensioni ${width} × ${height} px është më i vogël se minimumi ${spec.min.w} × ${spec.min.h} px.`);
    }
    const ratio = width / height;
    const idealRatio = spec.ideal.w / spec.ideal.h;
    if (Math.abs(ratio - idealRatio) / idealRatio > RATIO_TOLERANCE) {
      warnings.push(`Raporti ${width}:${height} ndryshon nga ai i rekomanduar (${spec.ideal.w}:${spec.ideal.h}). Një pjesë e imazhit do të priten.`);
    }
  };

  return new Promise((resolve) => {
    if (kind === 'video') {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        const durationSeconds = Math.round(video.duration);
        if (durationSeconds > AD_VIDEO_MAX_SECONDS) {
          errors.push(`Videoja zgjat ${durationSeconds} sekonda; maksimumi është ${AD_VIDEO_MAX_SECONDS} sekonda.`);
        }
        compare(video.videoWidth, video.videoHeight);
        resolve(finish({ width: video.videoWidth, height: video.videoHeight, durationSeconds }));
      };
      video.onerror = () => {
        errors.push('Videoja nuk mund të lexohet. Përdorni MP4 (H.264) ose WebM.');
        resolve(finish({}));
      };
      video.src = url;
      return;
    }

    const img = new Image();
    img.onload = () => {
      compare(img.naturalWidth, img.naturalHeight);
      resolve(finish({ width: img.naturalWidth, height: img.naturalHeight }));
    };
    img.onerror = () => {
      errors.push('Skedari nuk është imazh i vlefshëm.');
      resolve(finish({}));
    };
    img.src = url;
  });
}
