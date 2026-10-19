/**
 * Shrink a phone photo before it is uploaded.
 *
 * A modern phone photo is 3–12 MB. Over 4G that upload took minutes, the citizen sat
 * on "Duke ngarkuar 1 foto…" and often gave up, or the report went in without its
 * photo. A 1600 px JPEG at quality 0.82 is ~250–600 KB and still shows every pothole,
 * so the upload takes seconds. iPhone HEIC photos are converted to JPEG on the way
 * (Safari decodes HEIC), which the storage rules accept.
 *
 * Never fatal: if the browser cannot decode the file, the original is returned.
 */
const MAX_SIDE = 1600;
const QUALITY = 0.82;
/** Below this a photo is already small enough to send as it is (unless it is HEIC). */
const SMALL_ENOUGH = 700 * 1024;

const RASTER_OK = new Set(['image/jpeg', 'image/png', 'image/webp']);

function isHeic(file: File): boolean {
  return /image\/hei[cf]/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
}

export function looksLikeImage(file: File): boolean {
  return file.type.startsWith('image/') || isHeic(file);
}

async function decode(file: File): Promise<{ width: number; height: number; draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void; close: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
      return { width: bitmap.width, height: bitmap.height, draw: (ctx, w, h) => ctx.drawImage(bitmap, 0, 0, w, h), close: () => bitmap.close() };
    } catch { /* fall through to <img>, which Safari uses for HEIC */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('decode'));
      el.src = url;
    });
    return { width: img.naturalWidth, height: img.naturalHeight, draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h), close: () => URL.revokeObjectURL(url) };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

export async function compressImage(file: File): Promise<File> {
  if (file.type === 'image/gif') return file; // may be animated
  if (!isHeic(file) && RASTER_OK.has(file.type) && file.size <= SMALL_ENOUGH) return file;
  if (typeof document === 'undefined') return file;
  try {
    const source = await decode(file);
    try {
      const scale = Math.min(1, MAX_SIDE / Math.max(source.width, source.height));
      const w = Math.max(1, Math.round(source.width * scale));
      const h = Math.max(1, Math.round(source.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return file;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      source.draw(ctx, w, h);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
      if (!blob) return file;
      // Keep the original when "compressing" made it bigger (an already-tiny JPEG).
      if (!isHeic(file) && RASTER_OK.has(file.type) && blob.size >= file.size) return file;
      const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
      return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() });
    } finally {
      source.close();
    }
  } catch {
    return file;
  }
}
