/**
 * Crops original photographs into the exact frames the archive uses, so every face and landmark is framed
 * the same way on a phone and on a desktop.
 *
 *   put originals in  public/heritage/originals/<name>.(jpg|jpeg|png|webp)   (same <name> as in photos/README.md)
 *   node scripts/crop-heritage-photos.mjs            → writes public/heritage/photos/<name>.webp (+ -640.webp for phones)
 *
 * Frame by name:  adem-jashari, dheshmor-*, familja-*  → 4:5 portrait, cropped on the face (sharp "attention")
 *                 qyteti-*, every other name            → 16:10 landscape, cropped on the most detailed area
 * Override a single photo's focus in public/heritage/focus.json: { "familja-jashari": "top" } (top|centre|bottom|left|right|attention)
 * Only add photographs with a free licence or permission, and write the author where the photo is used (Photo.tsx `credit`).
 */
import { readdir, readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const SRC = 'public/heritage/originals';
const OUT = 'public/heritage/photos';
const portrait = (n) => n === 'adem-jashari' || n.startsWith('dheshmor-') || n.startsWith('familja-');

let focus = {};
try { focus = JSON.parse(await readFile('public/heritage/focus.json', 'utf8')); } catch { /* optional */ }

await mkdir(OUT, { recursive: true });
let files = [];
try { files = (await readdir(SRC)).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)); } catch { console.error(`No ${SRC} folder yet — create it and add the originals.`); process.exit(1); }

for (const file of files) {
  const name = path.parse(file).name;
  const [w, h] = portrait(name) ? [960, 1200] : [1600, 1000];
  const position = focus[name] ?? 'attention';
  const input = path.join(SRC, file);
  for (const [suffix, scale] of [['', 1], ['-640', 640 / w]]) {
    await sharp(input).rotate()
      .resize(Math.round(w * scale), Math.round(h * scale), { fit: 'cover', position, kernel: 'lanczos3' })
      .sharpen({ sigma: 0.6 })
      .webp({ quality: 82, effort: 5 })
      .toFile(path.join(OUT, `${name}${suffix}.webp`));
  }
  console.log(`✓ ${name}  ${w}×${h}  (${position})`);
}
if (!files.length) console.log('No originals found.');
