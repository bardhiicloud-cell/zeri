import { describe, expect, it } from 'vitest';
import {
  evaluateFileMetadataHeuristics,
  extractTrackingIdsFromText,
  normalizeScannerVerdict,
} from '../../server/aiMediaScanner.ts';

describe('AI Media & Track-ID Scanner (Kosovo Authenticity, Anti-AI & Legal Compliance)', () => {
  it('blocks and flags deletion for AI-generated filenames (Midjourney, DALL-E, Stable Diffusion)', () => {
    const res = evaluateFileMetadataHeuristics(
      { name: 'midjourney_pothole_road_v6.png', mimeType: 'image/png' },
      'gallery',
    );
    expect(res.immediateReject).toBe(true);
    expect(res.rejectionCode).toBe('AI_GENERATED');
    expect(res.reasonSq).toContain('Inteligjenca Artificiale');
  });

  it('blocks and flags deletion for stock photos or screenshots downloaded from the web', () => {
    const res = evaluateFileMetadataHeuristics(
      { name: 'shutterstock_19283746_broken_street.jpg', mimeType: 'image/jpeg' },
      'gallery',
    );
    expect(res.immediateReject).toBe(true);
    expect(res.rejectionCode).toBe('STOCK_OR_SCREENSHOT');
  });

  it('blocks and flags deletion for photos from foreign countries (e.g., China, India, USA)', () => {
    const res = evaluateFileMetadataHeuristics(
      { name: 'beijing_road_damage_china.jpg', mimeType: 'image/jpeg' },
      'gallery',
    );
    expect(res.immediateReject).toBe(true);
    expect(res.rejectionCode).toBe('FOREIGN_LOCATION');
    expect(res.reasonSq).toContain('jashtë Kosovës');
  });

  it('allows normal gallery or camera filenames from citizens in Kosovo to proceed to Gemini Vision analysis', () => {
    const galleryRes = evaluateFileMetadataHeuristics(
      { name: 'IMG_20261028_142210.jpg', mimeType: 'image/jpeg' },
      'gallery',
    );
    expect(galleryRes.immediateReject).toBe(false);

    const cameraRes = evaluateFileMetadataHeuristics(
      { name: 'camera_capture_01.jpg', mimeType: 'image/jpeg', lastModified: Date.now() },
      'camera',
    );
    expect(cameraRes.immediateReject).toBe(false);
    expect(cameraRes.liveCaptureLikely).toBe(true);
  });

  it('normalizes Gemini verdict to reject and delete AI-generated images', () => {
    const cleanHeuristics = evaluateFileMetadataHeuristics({ name: 'photo.jpg' }, 'gallery');
    const verdict = normalizeScannerVerdict(
      {
        isAiGenerated: true,
        isForeignOrStock: false,
        isLegallyCompliant: true,
        isRelevantCivicIssue: true,
        authenticityScore: 10,
      },
      'gallery',
      cleanHeuristics,
    );
    expect(verdict.approved).toBe(false);
    expect(verdict.shouldDelete).toBe(true);
    expect(verdict.isAiGenerated).toBe(true);
    expect(verdict.rejectionCode).toBe('AI_GENERATED');
  });

  it('normalizes Gemini verdict to reject and delete foreign images (e.g., China street signs) uploaded from gallery', () => {
    const cleanHeuristics = evaluateFileMetadataHeuristics({ name: 'photo.jpg' }, 'gallery');
    const verdict = normalizeScannerVerdict(
      {
        isAiGenerated: false,
        isForeignOrStock: true,
        rejectionCode: 'FOREIGN_LOCATION',
        detectedCountryOrContext: 'Kinë (China)',
        reasonSq: 'Fotoja u refuzua: mbishkrime rrugore në gjuhën kineze (Kinë) jashtë Kosovës.',
        isLegallyCompliant: true,
      },
      'gallery',
      cleanHeuristics,
    );
    expect(verdict.approved).toBe(false);
    expect(verdict.shouldDelete).toBe(true);
    expect(verdict.isForeignOrStock).toBe(true);
    expect(verdict.reasonSq).toContain('Kinë');
  });

  it('normalizes Gemini verdict to reject and delete media violating Kosovo Law 06/L-082 (exposed personal ID/bank card)', () => {
    const cleanHeuristics = evaluateFileMetadataHeuristics({ name: 'doc.jpg' }, 'gallery');
    const verdict = normalizeScannerVerdict(
      {
        isAiGenerated: false,
        isForeignOrStock: false,
        isLegallyCompliant: false,
        rejectionCode: 'PRIVACY_VIOLATION',
      },
      'gallery',
      cleanHeuristics,
    );
    expect(verdict.approved).toBe(false);
    expect(verdict.shouldDelete).toBe(true);
    expect(verdict.isLegallyCompliant).toBe(false);
    expect(verdict.reasonSq).toContain('06/L-082');
  });

  it('approves genuine civic infrastructure photos from Kosovo (both live camera and citizen gallery)', () => {
    const cleanHeuristics = evaluateFileMetadataHeuristics({ name: 'prishtina_rruga.jpg' }, 'gallery');
    const galleryVerdict = normalizeScannerVerdict(
      {
        isAiGenerated: false,
        isForeignOrStock: false,
        detectedCountryOrContext: 'Kosovë',
        isLegallyCompliant: true,
        isRelevantCivicIssue: true,
        suggestedCategory: 'Komuna - Drejtoria e Infrastrukturës',
        suggestedUrgency: 'E lartë',
        authenticityScore: 95,
      },
      'gallery',
      cleanHeuristics,
    );
    expect(galleryVerdict.approved).toBe(true);
    expect(galleryVerdict.shouldDelete).toBe(false);
    expect(galleryVerdict.captureSource).toBe('gallery');
  });

  it('extracts valid Zëri Track IDs (ZQ-, LJ-, DN-, HC-) from OCR text', () => {
    const sampleText = `
      Konfirmim i raportimit qytetar
      Kodi juaj: ZQ-20261103-AB12CD34
      Gjithashtu keni një lajmërim: LJ-9F8E7D6C dhe rast shëndetësor HC-202611-99AA
    `;
    const ids = extractTrackingIdsFromText(sampleText);
    expect(ids).toContain('ZQ-20261103-AB12CD34');
    expect(ids).toContain('LJ-9F8E7D6C');
    expect(ids).toContain('HC-202611-99AA');
  });
});
