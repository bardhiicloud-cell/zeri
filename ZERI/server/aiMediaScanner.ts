import type { Express, Request, RequestHandler, Response } from 'express';
import { Type } from '@google/genai';
import { createIpRateLimiter } from './security';
import { normalizeTrackingId, TRACKING_ID_PATTERN } from './trackView';

/**
 * Super-Intelligent Gemini AI Media, Video, Document & Track-ID Forensic Scanner.
 *
 * Responsibilities:
 *  1. Inspects citizen report photos, video keyframes, and document photos with Gemini Vision.
 *  2. Blocks and deletes AI-generated / synthetic images (Midjourney, DALL-E, Stable Diffusion, deepfakes).
 *  3. Differentiates between live Camera captures (`camera`) and Gallery uploads (`gallery`):
 *     - Gallery uploads are allowed when they are genuine photos from Kosovo,
 *       but scrutinized strictly to block downloaded photos from foreign countries
 *       (e.g., China, India, USA, Russia) or stock websites (Shutterstock, Getty, Google Images).
 *  4. Enforces Kosovo legal compliance (Law No. 06/L-082 on Personal Data Protection,
 *     prohibition of NSFW, violence, hate speech, defamation, or exposed private IDs/bank cards).
 *  5. Scans photos/screenshots/documents on `/trackid` to extract Track IDs (`ZQ-`, `LJ-`, `DN-`, `HC-`)
 *     while verifying legal compliance of the uploaded image.
 */

export type CaptureSource = 'camera' | 'gallery';
export type ScannedMediaType = 'image' | 'video' | 'document' | 'audio';
export type RejectionCode =
  | 'NONE'
  | 'AI_GENERATED'
  | 'FOREIGN_LOCATION'
  | 'STOCK_OR_SCREENSHOT'
  | 'ILLEGAL_CONTENT'
  | 'PRIVACY_VIOLATION'
  | 'IRRELEVANT_OR_FAKE';

export interface FileMetaInput {
  name?: string;
  sizeBytes?: number;
  lastModified?: number;
  width?: number;
  height?: number;
  mimeType?: string;
}

export interface HeuristicEvaluation {
  immediateReject: boolean;
  rejectionCode: RejectionCode;
  reasonSq: string;
  suspicionLevel: 'low' | 'medium' | 'high';
  signals: string[];
  liveCaptureLikely: boolean;
}

export interface MediaVerificationResult {
  approved: boolean;
  shouldDelete: boolean;
  verdict: 'approved' | 'rejected';
  rejectionCode: RejectionCode;
  isAiGenerated: boolean;
  isForeignOrStock: boolean;
  isLegallyCompliant: boolean;
  isRelevantCivicIssue: boolean;
  authenticityScore: number;
  captureSource: CaptureSource;
  detectedCountryOrContext: string;
  reasonSq: string;
  forensicsSummary: string;
  suggestedTitle?: string;
  suggestedDescription?: string;
  suggestedCategory?: string;
  suggestedTopicId?: string;
  suggestedUrgency?: 'E ulët' | 'Mesatare' | 'E lartë' | 'Kritike';
  degraded?: boolean;
}

const AI_FILENAME_PATTERNS = [
  /(?:^|[^a-z0-9])midjourney(?:$|[^a-z0-9])/i,
  /(?:^|[^a-z0-9])dall[-_]?e(?:$|[^a-z0-9])/i,
  /(?:^|[^a-z0-9])stable[-_]?diffusion(?:$|[^a-z0-9])/i,
  /(?:^|[^a-z0-9])sdxl(?:$|[^a-z0-9])/i,
  /(?:^|[^a-z0-9])flux[-_]?dev(?:$|[^a-z0-9])/i,
  /(?:^|[^a-z0-9])chatgpt[-_]?image(?:$|[^a-z0-9])/i,
  /(?:^|[^a-z0-9])firefly[-_]?ai(?:$|[^a-z0-9])/i,
  /(?:^|[^a-z0-9])ai[-_]?generated(?:$|[^a-z0-9])/i,
  /(?:^|[^a-z0-9])synthetic[-_]?image(?:$|[^a-z0-9])/i,
  /(?:^|[^a-z0-9])deepfake(?:$|[^a-z0-9])/i,
];

const STOCK_FILENAME_PATTERNS = [
  /(?:^|[^a-z0-9])shutterstock(?:$|[^a-z0-9])/i,
  /(?:^|[^a-z0-9])gettyimages(?:$|[^a-z0-9])/i,
  /(?:^|[^a-z0-9])istockphoto(?:$|[^a-z0-9])/i,
  /(?:^|[^a-z0-9])adobestock(?:$|[^a-z0-9])/i,
  /(?:^|[^a-z0-9])123rf(?:$|[^a-z0-9])/i,
  /(?:^|[^a-z0-9])depositphotos(?:$|[^a-z0-9])/i,
  /(?:^|[^a-z0-9])alamy(?:$|[^a-z0-9])/i,
  /(?:^|[^a-z0-9])dreamstime(?:$|[^a-z0-9])/i,
];

const FOREIGN_FILENAME_PATTERNS = [
  /(?:^|[^a-z0-9])(china|beijing|shanghai|shenzhen|guangzhou|india|mumbai|delhi|bangalore|pakistan|karachi|bangladesh|dhaka|indonesia|jakarta|philippines|manila|vietnam|thailand|bangkok|nigeria|lagos|kenya|egypt|cairo|new[-_]?york|california|texas|chicago|florida|toronto|sydney|melbourne|london|manchester|moscow|petersburg|tokyo|osaka|brazil|sao[-_]?paulo|mexico|argentina|colombia|peru|chile)(?:$|[^a-z0-9])/i,
  /(?:[\u4E00-\u9FFF]|[\u3040-\u30FF]|[\uAC00-\uD7AF]|[\u0900-\u097F]|[\u0E00-\u0E7F])/u, // Foreign scripts (CJK, Devanagari, Thai) in filename
];

const SCREENSHOT_SOCIAL_PATTERNS = [
  /^screenshot/i,
  /(?:^|[^a-z0-9])screenshot(?:$|[^a-z0-9])/i,
  /^fb_img_/i,
  /(?:^|[^a-z0-9])tiktok(?:$|[^a-z0-9])/i,
  /(?:^|[^a-z0-9])snapinsta(?:$|[^a-z0-9])/i,
  /(?:^|[^a-z0-9])pinterest(?:$|[^a-z0-9])/i,
  /(?:^|[^a-z0-9])reddit(?:$|[^a-z0-9])/i,
];

const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const SECTOR_CATEGORIES = [
  'Komuna - Drejtoria e Infrastrukturës',
  'Ministria e Infrastrukturës',
  'Komuna - Drejtoria e Shëndetësisë (QKMF)',
  'Ministria e Shëndetësisë / SHSKUK',
  'Komuna - Drejtoria e Arsimit',
  'Ministria e Arsimit',
  'Ujësjellësi Rajonal - KRU',
  'Komuna - Kanalizimi lokal dhe Ujërat e zeza',
  'KEDS / KESCO',
  'Komuna - Ndriçimi Publik',
  "Kompania 'Pastrimi'",
  'Komuna - Inspekcioni Mjedisor',
  'Policia e Kosovës / Siguria Publike',
  'Inspekcioni Komunal',
  'Zjarrfikësit dhe Shpëtimi',
  'Komuna - Qentë endacakë',
  'Komuna - Transporti Publik',
  'Komuna - Parqet dhe Hapësirat e gjelbra',
];

/**
 * Pure metadata & filename forensics check before or alongside Gemini Vision.
 */
export function evaluateFileMetadataHeuristics(
  fileMeta: FileMetaInput,
  captureSource: CaptureSource,
  nowMs: number = Date.now(),
): HeuristicEvaluation {
  const name = String(fileMeta.name ?? '').trim();
  const signals: string[] = [];

  for (const pat of AI_FILENAME_PATTERNS) {
    if (pat.test(name)) {
      return {
        immediateReject: true,
        rejectionCode: 'AI_GENERATED',
        reasonSq: 'Skedari u refuzua dhe u fshi automatikisht: U detektua si imazh i gjeneruar nga Inteligjenca Artificiale (AI). Lejohen vetëm foto dhe video reale nga terreni.',
        suspicionLevel: 'high',
        signals: ['ai_filename_match'],
        liveCaptureLikely: false,
      };
    }
  }

  for (const pat of STOCK_FILENAME_PATTERNS) {
    if (pat.test(name)) {
      return {
        immediateReject: true,
        rejectionCode: 'STOCK_OR_SCREENSHOT',
        reasonSq: 'Skedari u refuzua dhe u fshi automatikisht: Fotoja vjen nga faqe të fotove të gatshme (Stock Photo) në internet. Ngarkoni vetëm dëshmi reale nga Kosova.',
        suspicionLevel: 'high',
        signals: ['stock_filename_match'],
        liveCaptureLikely: false,
      };
    }
  }

  for (const pat of FOREIGN_FILENAME_PATTERNS) {
    if (pat.test(name)) {
      return {
        immediateReject: true,
        rejectionCode: 'FOREIGN_LOCATION',
        reasonSq: 'Skedari u refuzua dhe u fshi automatikisht: Emërtimi ose metadada tregon se skedari i përket një shteti të huaj jashtë Kosovës.',
        suspicionLevel: 'high',
        signals: ['foreign_filename_match'],
        liveCaptureLikely: false,
      };
    }
  }

  const ageMs = typeof fileMeta.lastModified === 'number' && fileMeta.lastModified > 0
    ? Math.max(0, nowMs - fileMeta.lastModified)
    : null;

  const liveCaptureLikely = captureSource === 'camera' && (ageMs === null || ageMs < 10 * 60 * 1000);

  if (captureSource === 'gallery') {
    signals.push('uploaded_from_gallery');
  }
  if (ageMs !== null && ageMs > 180 * 24 * 3600 * 1000) {
    signals.push('file_older_than_6_months');
  }
  for (const pat of SCREENSHOT_SOCIAL_PATTERNS) {
    if (pat.test(name)) {
      signals.push('screenshot_or_social_filename');
      break;
    }
  }

  const suspicionLevel: 'low' | 'medium' | 'high' =
    signals.includes('screenshot_or_social_filename') || signals.includes('file_older_than_6_months')
      ? 'high'
      : captureSource === 'gallery'
        ? 'medium'
        : 'low';

  return {
    immediateReject: false,
    rejectionCode: 'NONE',
    reasonSq: '',
    suspicionLevel,
    signals,
    liveCaptureLikely,
  };
}

/**
 * Normalizes the raw JSON response from Gemini Vision into a strict, deterministic decision.
 */
export function normalizeScannerVerdict(
  raw: Record<string, unknown> | null | undefined,
  captureSource: CaptureSource,
  heuristics: HeuristicEvaluation,
): MediaVerificationResult {
  if (heuristics.immediateReject) {
    return {
      approved: false,
      shouldDelete: true,
      verdict: 'rejected',
      rejectionCode: heuristics.rejectionCode,
      isAiGenerated: heuristics.rejectionCode === 'AI_GENERATED',
      isForeignOrStock: heuristics.rejectionCode === 'FOREIGN_LOCATION' || heuristics.rejectionCode === 'STOCK_OR_SCREENSHOT',
      isLegallyCompliant: heuristics.rejectionCode !== 'ILLEGAL_CONTENT' && heuristics.rejectionCode !== 'PRIVACY_VIOLATION',
      isRelevantCivicIssue: false,
      authenticityScore: 0,
      captureSource,
      detectedCountryOrContext: 'Refuzuar nga filtri forenzik',
      reasonSq: heuristics.reasonSq,
      forensicsSummary: heuristics.reasonSq,
    };
  }

  const isAiGenerated = raw?.isAiGenerated === true;
  const isForeignOrStock = raw?.isForeignOrStock === true;
  const isLegallyCompliant = raw?.isLegallyCompliant !== false;
  const isRelevantCivicIssue = raw?.isRelevantCivicIssue !== false;
  const rawScore = Number(raw?.authenticityScore);
  // Gallery uploads require a slightly higher authenticity threshold than live camera captures
  const minThreshold = captureSource === 'gallery' ? 50 : 40;
  const authenticityScore = Number.isFinite(rawScore) ? Math.max(0, Math.min(100, Math.round(rawScore))) : 80;

  let rejectionCode: RejectionCode = 'NONE';
  if (isAiGenerated) {
    rejectionCode = 'AI_GENERATED';
  } else if (!isLegallyCompliant) {
    rejectionCode = String(raw?.rejectionCode) === 'PRIVACY_VIOLATION' ? 'PRIVACY_VIOLATION' : 'ILLEGAL_CONTENT';
  } else if (isForeignOrStock) {
    rejectionCode = String(raw?.rejectionCode) === 'STOCK_OR_SCREENSHOT' ? 'STOCK_OR_SCREENSHOT' : 'FOREIGN_LOCATION';
  } else if (!isRelevantCivicIssue || authenticityScore < minThreshold) {
    const code = String(raw?.rejectionCode ?? '');
    if (
      code === 'AI_GENERATED' ||
      code === 'FOREIGN_LOCATION' ||
      code === 'STOCK_OR_SCREENSHOT' ||
      code === 'ILLEGAL_CONTENT' ||
      code === 'PRIVACY_VIOLATION' ||
      code === 'IRRELEVANT_OR_FAKE'
    ) {
      rejectionCode = code;
    } else {
      rejectionCode = 'IRRELEVANT_OR_FAKE';
    }
  }

  const approved =
    rejectionCode === 'NONE' &&
    !isAiGenerated &&
    !isForeignOrStock &&
    isLegallyCompliant &&
    isRelevantCivicIssue &&
    authenticityScore >= minThreshold;

  const defaultRejectionReasons: Record<RejectionCode, string> = {
    NONE: 'Dëshmia u verifikua me sukses nga Gemini AI.',
    AI_GENERATED: 'Fotoja/videoja u fshi automatikisht: U detektua si e gjeneruar ose e manipuluar me Inteligjencë Artificiale (AI). Lejohen vetëm pamje reale.',
    FOREIGN_LOCATION: 'Fotoja/videoja u fshi automatikisht: Pamja tregon shenja të qarta se është nga një shtet tjetër jashtë Kosovës (p.sh. mbishkrime të huaja, targa ose infrastrukturë e huaj).',
    STOCK_OR_SCREENSHOT: 'Fotoja/videoja u fshi automatikisht: Duket e shkarkuar nga interneti, rrjete sociale ose faqe Stock Photo. Ngarkoni vetëm foto reale të problemit në Kosovë.',
    ILLEGAL_CONTENT: 'Skedari u fshi automatikisht: Përmbajtja bie ndesh me ligjet në fuqi dhe rregullat e sigurisë publike.',
    PRIVACY_VIOLATION: 'Skedari u fshi automatikisht: Ekspozon të dhëna personale të ndjeshme (dokument identiteti privat, kartelë bankare ose fytyra private) në kundërshtim me Ligjin Nr. 06/L-082 për Mbrojtjen e të Dhënave Personale.',
    IRRELEVANT_OR_FAKE: 'Skedari u fshi automatikisht: Nuk paraqet një problem real qytetar/komunal ose dokument të vlefshëm për raportim.',
  };

  const reasonSq = typeof raw?.reasonSq === 'string' && raw.reasonSq.trim().length > 5
    ? raw.reasonSq.trim()
    : defaultRejectionReasons[rejectionCode];

  const urgencyRaw = String(raw?.suggestedUrgency ?? 'Mesatare');
  const suggestedUrgency: 'E ulët' | 'Mesatare' | 'E lartë' | 'Kritike' =
    urgencyRaw === 'E ulët' || urgencyRaw === 'Mesatare' || urgencyRaw === 'E lartë' || urgencyRaw === 'Kritike'
      ? urgencyRaw
      : 'Mesatare';

  return {
    approved,
    shouldDelete: !approved,
    verdict: approved ? 'approved' : 'rejected',
    rejectionCode,
    isAiGenerated,
    isForeignOrStock,
    isLegallyCompliant,
    isRelevantCivicIssue,
    authenticityScore,
    captureSource,
    detectedCountryOrContext: typeof raw?.detectedCountryOrContext === 'string' && raw.detectedCountryOrContext.trim()
      ? raw.detectedCountryOrContext.trim()
      : (approved ? 'Kosovë' : 'E pavlefshme'),
    reasonSq,
    forensicsSummary: typeof raw?.forensicsSummary === 'string' && raw.forensicsSummary.trim()
      ? raw.forensicsSummary.trim()
      : reasonSq,
    suggestedTitle: typeof raw?.suggestedTitle === 'string' ? raw.suggestedTitle.trim() : undefined,
    suggestedDescription: typeof raw?.suggestedDescription === 'string' ? raw.suggestedDescription.trim() : undefined,
    suggestedCategory: typeof raw?.suggestedCategory === 'string' ? raw.suggestedCategory.trim() : undefined,
    suggestedTopicId: typeof raw?.suggestedTopicId === 'string' ? raw.suggestedTopicId.trim() : undefined,
    suggestedUrgency,
  };
}

const SECTOR_TRACK_REGEX = /\b(?:ZQ|LJ|DN|HC)-[A-Z0-9]{4,14}(?:-[A-Z0-9]{2,12})?\b/gi;

/**
 * Extracts valid platform Track IDs (`ZQ-...`, `LJ-...`, `DN-...`, `HC-...`) from OCR text.
 */
export function extractTrackingIdsFromText(text: string): string[] {
  if (!text || typeof text !== 'string') return [];
  const matches = text.toUpperCase().match(SECTOR_TRACK_REGEX) ?? [];
  const valid: string[] = [];
  const seen = new Set<string>();
  for (const m of matches) {
    const normalized = normalizeTrackingId(m);
    if (!normalized || seen.has(normalized)) continue;
    if (
      /^(LJ|DN|HC)-[A-Z0-9]{4,12}(-[A-Z0-9]{2,8})?$/.test(normalized) ||
      TRACKING_ID_PATTERN.test(normalized)
    ) {
      seen.add(normalized);
      valid.push(normalized);
    }
  }
  return valid;
}

export interface AiScannerDeps {
  generateContent: (options: {
    contents: unknown;
    config?: unknown;
    defaultModel?: string;
    fallbackModels?: string[];
  }) => Promise<{ text?: string; degraded?: boolean }>;
  optionalAuth?: RequestHandler;
  limiter?: RequestHandler;
}

export function registerAiMediaScannerRoutes(app: Express, deps: AiScannerDeps): void {
  const limiter = deps.limiter ?? createIpRateLimiter({
    windowMs: 10 * 60_000,
    max: 45,
    floodFactor: 3,
    banMs: 15 * 60_000,
    message: 'Shumë skanime AI në kohë të shkurtër. Provoni përsëri pas pak minutash.',
    code: 'AI_SCAN_RATE_LIMIT',
  });

  /**
   * 1. Deep Forensic, Geo-Authenticity (Kosovo vs Foreign/Stock) & Legal Media Verification
   *    Handles photos, video keyframes, and document scans.
   */
  app.post('/api/v1/ai/verify-media', limiter, async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const captureSource: CaptureSource = body.captureSource === 'camera' ? 'camera' : 'gallery';
      const mediaType: ScannedMediaType =
        body.mediaType === 'video' || body.mediaType === 'document' || body.mediaType === 'audio'
          ? body.mediaType
          : 'image';

      const fileMeta: FileMetaInput = (body.fileMeta && typeof body.fileMeta === 'object' ? body.fileMeta : {}) as FileMetaInput;
      const context = (body.context && typeof body.context === 'object' ? body.context : {}) as Record<string, unknown>;

      // Run fast deterministic metadata & filename forensics first
      const heuristics = evaluateFileMetadataHeuristics(fileMeta, captureSource);
      if (heuristics.immediateReject) {
        return res.status(200).json(normalizeScannerVerdict(null, captureSource, heuristics));
      }

      // Collect up to 3 image frames (1 for photo/document, up to 3 keyframes for video)
      const rawFrames = Array.isArray(body.frames) ? body.frames.slice(0, 3) : [];
      const inlineParts: Array<{ inlineData: { mimeType: string; data: string } }> = [];

      for (const frame of rawFrames) {
        if (!frame || typeof frame !== 'object') continue;
        const f = frame as { data?: unknown; mimeType?: unknown };
        const dataStr = typeof f.data === 'string' ? f.data.replace(/^data:[^,]+,/, '').trim() : '';
        const mime = typeof f.mimeType === 'string' && ALLOWED_IMAGE_MIMES.has(f.mimeType.toLowerCase())
          ? f.mimeType.toLowerCase()
          : 'image/jpeg';
        if (!dataStr) continue;
        if (dataStr.length > 6_500_000) {
          return res.status(413).json({ error: 'Skedari është shumë i madh për skanim AI.' });
        }
        inlineParts.push({ inlineData: { mimeType: mime, data: dataStr } });
      }

      if (inlineParts.length === 0 && typeof body.imageBase64 === 'string' && body.imageBase64.trim()) {
        const cleanData = body.imageBase64.replace(/^data:[^,]+,/, '').trim();
        const mime = typeof body.mimeType === 'string' && ALLOWED_IMAGE_MIMES.has(body.mimeType.toLowerCase())
          ? body.mimeType.toLowerCase()
          : 'image/jpeg';
        inlineParts.push({ inlineData: { mimeType: mime, data: cleanData } });
      }

      if (inlineParts.length === 0) {
        return res.status(400).json({ error: 'Mungojnë pamjet (foto/video/dokument) për skanim nga Gemini AI.' });
      }

      const municipality = String(context.municipality ?? '').slice(0, 80);
      const userTitle = String(context.title ?? '').slice(0, 200);
      const userDesc = String(context.description ?? '').slice(0, 1000);
      const coordsText = Number.isFinite(Number(context.lat)) && Number.isFinite(Number(context.lng))
        ? `${Number(context.lat).toFixed(5)}, ${Number(context.lng).toFixed(5)}`
        : 'Pa koordinata';

      const prompt = `Ti je Sistemi Qendror i Inteligjencës Forenzike, Gjeo-Autenticitetit dhe Përputhshmërisë Ligjore i platformës "Zëri i Qytetarëve" në Republikën e Kosovës.

Po analizon një ${mediaType === 'video' ? 'VIDEO (përmes kuadrove kryesore të saj)' : mediaType === 'document' ? 'DOKUMENT / FOTO DOKUMENTI' : 'FOTOGRAFI'} të ngarkuar nga një qytetar.

TË DHËNAT E BURIMIT (PROVENANCE):
- Burimi i ngarkimit: ${captureSource === 'camera' ? 'KAMERË DIREKTE (Bërë live nga telefoni)' : 'GALERIA E PAJISJES (Zgjidhur nga galeria — KËRKON KUJDES MAKSIMAL!)'}
- Niveli i dyshimit nga metadata: ${heuristics.suspicionLevel.toUpperCase()} (${heuristics.signals.join(', ') || 'normal'})
- Emri i skedarit: "${String(fileMeta.name ?? 'pa-emer').slice(0, 120)}"
- Komuna e deklaruar: "${municipality || 'E papërcaktuar'}" (${coordsText})
- Konteksti nga qytetari: "${userTitle} ${userDesc}"

RREGULLAT STRIKTE TË INSPEKTIMIT (ZERO TOLERANCË NDAJ MASHTRIMEVE):
1. DETEKTIMI I AI (isAiGenerated):
   - Kontrollo nëse fotoja/videoja është e gjeneruar ose e manipuluar me Inteligjencë Artificiale (Midjourney, DALL-E, Stable Diffusion, Flux, Deepfake, tekstura sintetike, shkronja të shtrembëruara artificialisht, dritë/hije joreale).
   - Nëse është me AI -> isAiGenerated = true, verdict = "rejected", rejectionCode = "AI_GENERATED".

2. DETEKTIMI I FOTOVE NGA SHTETE TË HUAJA OSE INTERNETI (isForeignOrStock):
   - SHUMË E RËNDËSISHME: Edhe kur qytetari e merr foton nga Galeria, ajo MUND të jetë foto e saktë që e ka shkrepur vetë më herët në Kosovë, POR dikush mund të shkarkojë foto të gropave/përmbytjeve/mbeturinave nga KINA, INDIA, SHBA, RUSIA, ose Google Images / Stock Photos dhe ta paraqesë si problem në Kosovë!
   - Kontrollo me vëmendje çdo tregues vizual:
     a) Alfabetet dhe mbishkrimet në tabela rrugore/dyqane: Karakteret Kineze/Aziatike (漢字), Hindi, Arabe, tabela rrugore tipike amerikane ("Speed Limit", semaforë dhe shirita të verdhë amerikanë), ose cirilike ruse jashtë kontekstit ballkanik. Në Kosovë tabelat janë në Shqip (dhe serbisht/anglisht sipas standardit të RKS).
     b) Targat e veturave: Nëse shihen targa të huaja të largëta (p.sh. targa blu kineze, targa amerikane pa shirit evropian, targa aziatike/afrikane) në vend të targave RKS / evropiane.
     c) Trafiku në krahun e majtë (UK, Indi, Japoni, Australi), palma tropikale, rrokaqiej aziatikë/amerikanë, uniforma ose mjete policie/zjarrfikëse të shteteve të huaja.
     d) Watermarks nga Shutterstock, Getty, iStock, Alamy, ose korniza screenshot-esh nga TikTok, Instagram, Facebook, Google Images.
   - Nëse fotoja është nga shtet i huaj (si Kina, SHBA, India etj.) ose e marrë nga interneti/stock -> isForeignOrStock = true, verdict = "rejected", rejectionCode = "FOREIGN_LOCATION" (ose "STOCK_OR_SCREENSHOT").
   - Nëse fotoja është nga Galeria POR tregon mjedis normal që përputhet plotësisht me Kosovën/rajonin dhe nuk ka shenja të huaja apo stock -> PRANOJE (isForeignOrStock = false).

3. PËRPUTHSHMËRIA ME LIGJET E KOSOVËS (isLegallyCompliant):
   - Kontrollo sipas Ligjit Nr. 06/L-082 për Mbrojtjen e të Dhënave Personale dhe Kodit Penal të Republikës së Kosovës:
     a) Ndalohet ekspozimi keqdashës i letërnjoftimeve personale, pasaportave, kartelave bankare të personave të tretë -> rejectionCode = "PRIVACY_VIOLATION".
     b) Ndalohet përmbajtja pornografike/NSFW, dhuna ekstreme, simbolet e urrejtjes -> rejectionCode = "ILLEGAL_CONTENT".
   - Dokumentet zyrtare komunale, faturat publike, shkresat institucionale ose dëshmitë e problemeve publike LEJOHEN nëse nuk shkelin privatësinë e palëve të treta.

4. RELEVANCA QYTETARE DHE KLASIFIKIMI (isRelevantCivicIssue):
   - A tregon një problem real (infrastrukturë, rrugë, gropa, mbeturina, ujë, rrymë, ndriçim, shëndetësi, arsim, siguri, ambient, qen endacakë, ose dokument dëshmues)?
   - Nëse është selfie, meme, foto tavanesh/dyshemeje pa kuptim ose objekt pa asnjë lidhje me raportim publik -> isRelevantCivicIssue = false, rejectionCode = "IRRELEVANT_OR_FAKE".
   - Nëse pranohet, sugjero titullin, përshkrimin dhe kategorinë e saktë nga kjo listë:
${SECTOR_CATEGORIES.join('\n')}`;

      const response = await deps.generateContent({
        contents: {
          parts: [
            ...inlineParts,
            { text: prompt },
          ],
        },
        defaultModel: 'gemini-2.5-flash',
        fallbackModels: ['gemini-2.5-flash'],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              verdict: { type: Type.STRING },
              rejectionCode: { type: Type.STRING },
              isAiGenerated: { type: Type.BOOLEAN },
              isForeignOrStock: { type: Type.BOOLEAN },
              isLegallyCompliant: { type: Type.BOOLEAN },
              isRelevantCivicIssue: { type: Type.BOOLEAN },
              authenticityScore: { type: Type.INTEGER },
              detectedCountryOrContext: { type: Type.STRING },
              reasonSq: { type: Type.STRING },
              forensicsSummary: { type: Type.STRING },
              suggestedTitle: { type: Type.STRING },
              suggestedDescription: { type: Type.STRING },
              suggestedCategory: { type: Type.STRING },
              suggestedTopicId: { type: Type.STRING },
              suggestedUrgency: { type: Type.STRING },
            },
            required: [
              'verdict',
              'rejectionCode',
              'isAiGenerated',
              'isForeignOrStock',
              'isLegallyCompliant',
              'isRelevantCivicIssue',
              'authenticityScore',
              'detectedCountryOrContext',
              'reasonSq',
              'forensicsSummary',
            ],
          },
        },
      });

      if (response.degraded) {
        const fallback = normalizeScannerVerdict(
          {
            verdict: 'approved',
            rejectionCode: 'NONE',
            isAiGenerated: false,
            isForeignOrStock: false,
            isLegallyCompliant: true,
            isRelevantCivicIssue: true,
            authenticityScore: 80,
            detectedCountryOrContext: 'Kosovë (Kontroll bazik)',
            reasonSq: 'Skedari kaloi kontrollin bazik të sigurisë.',
            forensicsSummary: 'Skedari kaloi kontrollin e metadatave.',
          },
          captureSource,
          heuristics,
        );
        return res.json({ ...fallback, degraded: true });
      }

      const rawText = String(response.text ?? '').replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : null;
      const result = normalizeScannerVerdict(parsed, captureSource, heuristics);
      return res.json(result);
    } catch (error: unknown) {
      console.error('[AI_MEDIA_SCANNER] verify-media failed:', (error as Error)?.message || error);
      return res.status(500).json({ error: 'Gabim gjatë skanimit me Gemini AI. Ju lutem provoni përsëri.' });
    }
  });

  /**
   * 2. Track ID Photo / Screenshot / Document Scanner with Legal & Authenticity Check
   *    Reads a photo of a receipt, screenshot, or document to extract `ZQ-...`, `LJ-...`, `DN-...`, `HC-...`
   */
  app.post('/api/v1/ai/scan-trackid', limiter, async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as { imageBase64?: unknown; mimeType?: unknown; fileName?: unknown };
      const rawData = typeof body.imageBase64 === 'string' ? body.imageBase64.replace(/^data:[^,]+,/, '').trim() : '';
      if (!rawData) {
        return res.status(400).json({ ok: false, error: 'Ju lutem ngarkoni një foto ose screenshot që përmban Track ID-në.' });
      }
      if (rawData.length > 6_500_000) {
        return res.status(413).json({ ok: false, error: 'Fotoja është shumë e madhe (maksimumi 5MB).' });
      }
      const mimeType = typeof body.mimeType === 'string' && ALLOWED_IMAGE_MIMES.has(body.mimeType.toLowerCase())
        ? body.mimeType.toLowerCase()
        : 'image/jpeg';

      const prompt = `Ti je Skaneri Zyrtar i Track ID dhe Verifikuesi Ligjor i platformës "Zëri i Qytetarëve" në Kosovë.
Detyra jote:
1. Kontrollo që imazhi i ngarkuar të jetë në përputhje me ligjin (jo përmbajtje e paligjshme, pornografike, e dhunshme ose abuzive). Nëse shkel ligjin, kthe isLegallyCompliant = false.
2. Lexo me saktësi maksimale (OCR inteligjent) çdo kod gjurmimi (Track ID / Kod Reference) që ndodhet në këtë foto, screenshot, fletëpalosje apo dokument.
   Formatet e Track ID në platformë janë:
   - ZQ-YYYYMMDD-XXXXXXXX (p.sh. ZQ-20261016-AB12CD34 ose ZQ-...)
   - LJ-XXXXXXXX (për lajme)
   - DN-XXXXXXXX (për donacione)
   - HC-XXXXXXXX-XXXX (për raste shëndetësore)
3. Kthe kodin e saktë në fushën "trackingId" dhe të gjithë tekstin relevant ku u gjet kodi në "extractedText". Nëse nuk ka asnjë Track ID në foto, lëre "trackingId" bosh dhe shpjego arsye në "reasonSq".`;

      const response = await deps.generateContent({
        contents: {
          parts: [
            { inlineData: { mimeType, data: rawData } },
            { text: prompt },
          ],
        },
        defaultModel: 'gemini-2.5-flash',
        fallbackModels: ['gemini-2.5-flash'],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isLegallyCompliant: { type: Type.BOOLEAN },
              trackingId: { type: Type.STRING },
              extractedText: { type: Type.STRING },
              documentType: { type: Type.STRING },
              reasonSq: { type: Type.STRING },
            },
            required: ['isLegallyCompliant', 'trackingId', 'extractedText', 'reasonSq'],
          },
        },
      });

      if (response.degraded) {
        return res.status(503).json({
          ok: false,
          degraded: true,
          error: 'Skaneri Gemini AI nuk është i disponueshëm për momentin. Shkruani Track ID-në manualisht.',
        });
      }

      const rawText = String(response.text ?? '').replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : {};

      if (parsed.isLegallyCompliant === false) {
        return res.status(422).json({
          ok: false,
          code: 'ILLEGAL_CONTENT',
          error: String(parsed.reasonSq || 'Fotoja e ngarkuar bie ndesh me rregullat ligjore të platformës dhe u refuzua.'),
        });
      }

      const candidateText = `${String(parsed.trackingId ?? '')} ${String(parsed.extractedText ?? '')}`;
      const foundIds = extractTrackingIdsFromText(candidateText);
      const directNormalized = normalizeTrackingId(String(parsed.trackingId ?? ''));
      const bestId = foundIds[0] ?? (directNormalized && TRACKING_ID_PATTERN.test(directNormalized) ? directNormalized : '');

      if (!bestId) {
        return res.status(404).json({
          ok: false,
          code: 'TRACK_ID_NOT_FOUND_IN_IMAGE',
          error: String(parsed.reasonSq || 'Në këtë foto nuk u gjet asnjë kod i vlefshëm Track ID (p.sh. ZQ-..., LJ-..., DN-..., HC-...). Sigurohuni që kodi të jetë i lexueshëm.'),
        });
      }

      return res.json({
        ok: true,
        trackingId: bestId,
        allFound: foundIds.length > 0 ? foundIds : [bestId],
        documentType: String(parsed.documentType || 'Dëshmi / Screenshot'),
        reasonSq: String(parsed.reasonSq || `Track ID (${bestId}) u lexua dhe u verifikua me sukses nga Gemini AI.`),
      });
    } catch (error: unknown) {
      console.error('[AI_MEDIA_SCANNER] scan-trackid failed:', (error as Error)?.message || error);
      return res.status(500).json({
        ok: false,
        error: 'Skanimi i fotos nuk u krye. Provoni përsëri ose shkruani kodin manualisht.',
      });
    }
  });
}
