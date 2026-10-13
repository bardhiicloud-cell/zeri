import { describe, expect, it } from 'vitest';
import {
  REEL_FILTERS, audioTitleFromFile, clampTrim, defaultEdit, filterById, formatClock, needsExport, outputSize,
  pickRecorderMime, trimmedDuration, validateAudioFile,
} from '../../src/lib/reelEditor';

describe('clampTrim', () => {
  it('keeps a valid range unchanged', () => {
    expect(clampTrim(2, 10, 30)).toEqual({ start: 2, end: 10 });
  });

  it('never leaves the video and keeps start before end', () => {
    expect(clampTrim(-5, 99, 30)).toEqual({ start: 0, end: 30 });
    expect(clampTrim(20, 10, 30, 'end')).toEqual({ start: 20, end: 21 });
  });

  it('enforces the 1 s minimum by moving the handle that was not dragged', () => {
    expect(clampTrim(5, 5.2, 30, 'end')).toEqual({ start: 5, end: 6 });
    expect(clampTrim(9.9, 10, 30, 'start')).toEqual({ start: 9, end: 10 });
  });

  it('enforces the 90 s maximum', () => {
    expect(clampTrim(0, 120, 200, 'end')).toEqual({ start: 0, end: 90 });
    expect(clampTrim(10, 150, 200, 'start')).toEqual({ start: 60, end: 150 });
  });

  it('handles a clip shorter than the minimum and garbage input', () => {
    expect(clampTrim(0, 0.5, 0.5)).toEqual({ start: 0, end: 0.5 });
    expect(clampTrim(NaN, NaN, 10)).toEqual({ start: 0, end: 10 });
    expect(clampTrim(1, 2, 0)).toEqual({ start: 0, end: 0 });
  });
});

describe('needsExport / defaultEdit / trimmedDuration', () => {
  it('a default edit needs no re-encode, so the original file is uploaded untouched', () => {
    expect(needsExport(defaultEdit(30), 30)).toBe(false);
  });

  it('any real change requires an export', () => {
    const base = defaultEdit(30);
    expect(needsExport({ ...base, trimStart: 2 }, 30)).toBe(true);
    expect(needsExport({ ...base, trimEnd: 20 }, 30)).toBe(true);
    expect(needsExport({ ...base, filterId: 'warm' }, 30)).toBe(true);
    expect(needsExport({ ...base, originalVolume: 0 }, 30)).toBe(true);
    expect(needsExport({ ...base, music: { file: new File([''], 'a.mp3'), offsetSec: 0, volume: 0.5 } }, 30)).toBe(true);
  });

  it('caps the default range at 90 s and reports the trimmed length', () => {
    expect(defaultEdit(200).trimEnd).toBe(90);
    expect(trimmedDuration({ ...defaultEdit(30), trimStart: 5, trimEnd: 12.5 })).toBe(7.5);
  });
});

describe('outputSize', () => {
  it('scales to a 720 px long side with even dimensions and never upscales', () => {
    expect(outputSize(1080, 1920)).toEqual({ width: 406, height: 720 });
    expect(outputSize(1920, 1080)).toEqual({ width: 720, height: 406 });
    expect(outputSize(360, 640)).toEqual({ width: 360, height: 640 });
  });

  it('returns zero for invalid sizes', () => {
    expect(outputSize(0, 100)).toEqual({ width: 0, height: 0 });
  });
});

describe('pickRecorderMime', () => {
  it('prefers VP9 then falls back', () => {
    expect(pickRecorderMime(() => true)).toBe('video/webm;codecs=vp9,opus');
    expect(pickRecorderMime((t) => t === 'video/webm')).toBe('video/webm');
    expect(pickRecorderMime(() => false)).toBeNull();
  });
});

describe('filters', () => {
  it('has the eight named presets, Original first and a no-op', () => {
    expect(REEL_FILTERS.map((f) => f.id)).toEqual(['original', 'warm', 'cool', 'cinematic', 'vintage', 'bw', 'contrast', 'soft']);
    expect(REEL_FILTERS[0].css).toBe('none');
    expect(new Set(REEL_FILTERS.map((f) => f.css)).size).toBe(REEL_FILTERS.length);
  });

  it('falls back to Original for an unknown id', () => {
    expect(filterById('nope').id).toBe('original');
  });
});

describe('audio helpers', () => {
  it('validates type and size', () => {
    expect(validateAudioFile({ type: 'audio/mpeg', size: 1_000_000 })).toBeNull();
    expect(validateAudioFile({ type: 'video/mp4', size: 10 })).toMatch(/nuk lejohet/);
    expect(validateAudioFile({ type: 'audio/wav', size: 16 * 1024 * 1024 })).toMatch(/15 MB/);
    expect(validateAudioFile(null)).toBeTruthy();
  });

  it('makes a short display title from a file name', () => {
    expect(audioTitleFromFile('my_song-demo.final.mp3')).toBe('my song demo.final');
    expect(audioTitleFromFile('.mp3')).toBe('Audio');
    expect(audioTitleFromFile('x'.repeat(200) + '.wav')).toHaveLength(80);
  });

  it('formats clock times', () => {
    expect(formatClock(75)).toBe('1:15');
    expect(formatClock(-3)).toBe('0:00');
  });
});
