import { describe, expect, it } from 'vitest';
import { parseImageDataUrl, pathFromDownloadUrl, photosOf, storagePathOf } from '../../server/reportPhotoEdit';

const BUCKET = 'zeri.appspot.com';
const url = (path: string, bucket = BUCKET, host = 'https://firebasestorage.googleapis.com') =>
  `${host}/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media&token=t`;

describe('storagePathOf - the server reads only our own report photos', () => {
  it('reads a report photo by its stored path or its download URL', () => {
    expect(storagePathOf({ path: 'reports/u1/r1/a.jpg' }, BUCKET)).toBe('reports/u1/r1/a.jpg');
    expect(storagePathOf({ url: url('reports/u1/r1/a.jpg') }, BUCKET)).toBe('reports/u1/r1/a.jpg');
    expect(storagePathOf({ url: url('reports/u1/r1/a.jpg', BUCKET, 'http://127.0.0.1:9199') }, BUCKET)).toBe('reports/u1/r1/a.jpg');
  });

  it('refuses anything outside reports/: health documents, messages, avatars', () => {
    expect(storagePathOf({ path: 'health/u1/h1/doc.pdf' }, BUCKET)).toBeNull();
    expect(storagePathOf({ url: url('forum_dms/u1/x.jpg') }, BUCKET)).toBeNull();
    expect(storagePathOf({ path: 'reports/../health/u1/doc.pdf' }, BUCKET)).toBeNull();
  });

  it('refuses another bucket and any foreign address (no server-side fetching)', () => {
    expect(storagePathOf({ url: url('reports/u1/r1/a.jpg', 'someone-else') }, BUCKET)).toBeNull();
    expect(storagePathOf({ url: 'http://169.254.169.254/latest/meta-data' }, BUCKET)).toBeNull();
    expect(storagePathOf({ url: 'https://example.com/a.jpg' }, BUCKET)).toBeNull();
    expect(pathFromDownloadUrl('not a url', BUCKET)).toBeNull();
  });
});

describe('parseImageDataUrl - checked by real bytes', () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);

  it('accepts a JPEG and a PNG whose bytes match their label', () => {
    expect(parseImageDataUrl(`data:image/jpeg;base64,${jpeg.toString('base64')}`)).toMatchObject({ ok: true, ext: 'jpg' });
    expect(parseImageDataUrl(`data:image/png;base64,${png.toString('base64')}`)).toMatchObject({ ok: true, ext: 'png' });
  });

  it('refuses a label that lies about the content, other types, and junk', () => {
    expect(parseImageDataUrl(`data:image/png;base64,${jpeg.toString('base64')}`)).toMatchObject({ ok: false });
    expect(parseImageDataUrl(`data:image/svg+xml;base64,${Buffer.from('<svg/>').toString('base64')}`)).toMatchObject({ ok: false });
    expect(parseImageDataUrl(`data:text/html;base64,${Buffer.from('<script>').toString('base64')}`)).toMatchObject({ ok: false });
    expect(parseImageDataUrl(42)).toMatchObject({ ok: false });
    expect(parseImageDataUrl('data:image/jpeg;base64,')).toMatchObject({ ok: false });
  });

  it('refuses an image above 6 MB', () => {
    const big = Buffer.concat([jpeg, Buffer.alloc(6 * 1024 * 1024)]);
    expect(parseImageDataUrl(`data:image/jpeg;base64,${big.toString('base64')}`)).toMatchObject({ ok: false });
  });
});

describe('photosOf', () => {
  it('reads media, or falls back to the images list of older reports', () => {
    expect(photosOf({ media: [{ type: 'image', url: 'a' }] })).toEqual([{ type: 'image', url: 'a' }]);
    expect(photosOf({ images: ['b', 3] })).toEqual([{ type: 'image', url: 'b' }]);
    expect(photosOf({})).toEqual([]);
  });
});
