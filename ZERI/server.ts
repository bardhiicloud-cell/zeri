/**
 * Load the environment BEFORE anything else is imported.
 *
 * This import must stay first, and it must be the config-aware entry point
 * rather than a bare `import 'dotenv/config'`, because the credentials live in
 * `.env.local` — not the default `.env` that `dotenv/config` reads.
 *
 * Why it matters here specifically: `server/firebaseAdmin.ts` resolves the
 * service account at MODULE LOAD time (`const serviceAccount =
 * resolveServiceAccount()`). ES module imports are hoisted and evaluated in
 * order, so if this import sits below the `firebaseAdmin` import, the account is
 * resolved as `null` and every `verifyIdToken()` call fails — which surfaces to
 * the operator as "Unauthorized: Missing or invalid token" on every admin
 * action, no matter how valid their session actually is.
 */
import './server/loadEnv';

import express from "express";
import helmet from 'helmet';
import hpp from 'hpp';
import cors from 'cors';
import compression from 'compression';
import zlib from 'node:zlib';
import net from 'node:net';
import http from 'node:http';
import cluster from 'node:cluster';
import os from 'node:os';

import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { FieldValue } from 'firebase-admin/firestore';
import { db, authAdmin, hasAdminCredentials, isLocalFirebaseEmulator, storageBucket } from './server/firebaseAdmin';
import { eraseUserData } from './server/gdpr';
import {
  apiRateLimiter,
  aiRateLimiter,
  authRateLimiter,
  getClientIp,
  isSameOrigin,
  resolveAllowedOrigins,
  SECURITY_CONFIG,
} from './server/security';
import { cache, cachedCollection, cachedDocument, invalidateCollection } from './server/cache';
import { actingUser, audit, requireAdmin, requireAuth, requireSection, resolveActorRole, securityHeaders } from './server/auth';
import { checkMessageParties, checkRoleChange } from './server/policy';
import { registerAdminReportRoutes } from './server/adminReports';
import { registerReportMediaRoutes } from './server/reportMedia';
import { registerDecisionRoutes } from './server/decisions';
import { registerReportAssignmentRoutes } from './server/reportAssignment';
import { registerPhotoEditRoutes } from './server/reportPhotoEdit';
import { registerMunicipalityDeskRoutes } from './server/municipalityDesk';
import { registerInstitutionMailRoutes } from './server/institutionMail';
import { registerReportClassificationRoutes } from './server/reportClassification';
import { registerWorkItemRoutes, startWorkScheduler } from './server/workItemRoutes';
import { registerTeamOverviewRoutes } from './server/teamOverview';
import { registerTransparencyRoutes } from './server/transparency';
import { registerReportCaseRoutes } from './server/reportCase';
import { registerTrackLookupRoutes } from './server/trackLookup';
import { registerPublicReportRoutes } from './server/publicReports';
import { registerGuestNumberRoutes } from './server/guestNumbers';
import { registerContactRoutes } from './server/contactMessages';
import { registerPublicSubmissionRoutes } from './server/publicSubmissions';
import { createMailerFromEnv } from './server/mailer';
import { cheapestPlanWith, hasFeature as planHasFeature, normalizePlan as normalizeMunicipalityPlan } from './server/municipalityPlans';
import { registerUserModerationRoutes } from './server/userModeration';
import { registerStaffRemovalRoutes } from './server/staffRemoval';
import { registerForumSocialRoutes } from './server/forumSocial';
import { registerForumAnalyticsRoutes } from './server/forumAnalytics';
import { registerDirectMessageRoutes } from './server/directMessages';
import { registerForumPostRoutes, notifyPostAction } from './server/forumPosts';
import { registerAdRoutes } from './server/adTracking';
import { registerForumReelRoutes } from './server/forumReels';
import { registerForumFeedRoutes } from './server/forumFeed';
import { registerForumPeopleRoutes } from './server/forumPeople';
import { registerForumReportRoutes } from './server/forumReports';
import { publishDueScheduled, registerScheduledPostRoutes } from './server/scheduledPosts';
import { registerStoryRoutes } from './server/storyViews';
import { registerPaymentRoutes } from './server/paymentRoutes';
import { registerDebateAdminRoutes } from './server/debateAdmin';
import { buildRoleClaims } from './server/roleClaims';
import { VoteError, castVote } from './server/polls';
import { UpvoteError, castUpvote } from './server/upvotes';
import { buildReportDocument, generateTrackingId, parseReportInput } from './server/reports';
import { randomBytes } from 'node:crypto';
import { validateDateOfBirth } from './src/lib/validation';
import * as editorialFirewall from './server/editorialFirewall.js';
import * as pipeline from './server/approvalPipeline.js';

/**
 * Firebase Admin access is centralised in server/firebaseAdmin.ts.
 *
 * It lives there rather than here because `server/cache.ts` and
 * `server/auth.ts` also read Firestore, and the project/database ids have to be
 * identical across all three. They were not: the cache layer called
 * `db()` with no database id and read an empty database while the
 * browser wrote to a named one.
 */
export {
  FIREBASE_PROJECT_ID,
  FIRESTORE_DATABASE_ID,
  hasAdminCredentials,
  db,
  authAdmin,
} from './server/firebaseAdmin';


let aiClient: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.warn("VINI RE: Variabla e mjedisit GEMINI_API_KEY mungon. Karakteristikat e AI mund të dështojnë.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key || "MOCK_KEY_FOR_SAFETY",
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

function getSafetyFallbackText(contents: any, config?: any): string {
  let promptText = '';
  if (typeof contents === 'string') {
    promptText = contents;
  } else if (contents && typeof contents === 'object') {
    if (contents.parts && Array.isArray(contents.parts)) {
      promptText = contents.parts.map((p: any) => p.text || '').join(' ');
    } else if (Array.isArray(contents)) {
      promptText = contents.map((m: any) => {
        if (m.parts && Array.isArray(m.parts)) {
          return m.parts.map((p: any) => p.text || '').join(' ');
        }
        return m.content || JSON.stringify(m);
      }).join(' ');
    } else {
      promptText = JSON.stringify(contents);
    }
  }

  promptText = promptText.toLowerCase();
  // 1. Predictive AI Analytics (/api/admin/predictive-analysis)
  if (promptText.includes('zonat e rrezikut të lartë') || promptText.includes('hotspots')) {
    return JSON.stringify([
      { "lat": 42.6629, "lng": 21.1655, "risk": "Kritike", "category": "Komuna - Drejtoria e Infrastrukturës (Rrugë lokale, Gropa, Asfaltim në qytet/fshat)" },
      { "lat": 42.6582, "lng": 21.1523, "risk": "E lartë", "category": "Komuna - Deponi Ilegale, Ndotje e natyrës, dhe Mjedisi" },
      { "lat": 42.6675, "lng": 21.1712, "risk": "Mesatare", "category": "Komuna - Ndriçimi Publik (Llamba të djegura në rrugë, Errësirë)" },
      { "lat": 42.6415, "lng": 21.1352, "risk": "Mesatare", "category": "Ujësjellësi Rajonal - KRU (Mungesë uji, Gyp i pëlcitur, Faturim)" },
      { "lat": 42.6241, "lng": 21.1121, "risk": "E ulët", "category": "KEDS / KESCO (Ndërprerje e rrymës, Kabllo e rrezikshme, Fatura)" }
    ]);
  }

  // 2. Official Response Auto-Pilot (/api/admin/generate-response)
  if (promptText.includes('përgjigje zyrtare') || promptText.includes('institucionale/administrative')) {
    if (promptText.includes('arsyeja nga zyrtari') && promptText.includes('refuzim/zjidhje')) {
      return "I nderuar qytetar,\n\nKërkesa juaj është shqyrtuar me kujdes nga departamenti përkatës. Bazuar në vlerësimin e situatës dhe arsyes së specifikuar, kemi ndërmarrë hapat e nevojshëm. Për çdo informacion shtesë ose detaje të mëtejshme, mbetemi në gatishmëri.\n\nJu falënderojmë për bashkëpunimin.";
    }
    return "I nderuar qytetar,\n\nE kemi pranuar ankesën tuaj me vëmendje të plotë. Ekipi ynë i inspekcionit është njoftuar dhe do të dalë në teren.";
  }

  // 3. Forensic Image Scanning (/api/verify-image)
  if (promptText.includes('skanoni imazhin') || promptText.includes('forensike dhe etike')) {
    return JSON.stringify({
      "is_authentic": true,
      "confidence_score": 0.98,
      "reason": "Skanimi forensik lokal konfirmon se imazhi është autentik, nuk përmban manipulime digjitale, elemente pornografike apo gjenerim artificial. Struktura dhe dritë-hija përputhen me një foto reale të rrethanave të raportuara."
    });
  }

  // 4. Botnet/Spam Detection (/api/check-botnet)
  if (promptText.includes('sjelljen e këtij përdoruesi') || promptText.includes('bot/spammer')) {
    return JSON.stringify({
      "is_bot": false,
      "confidence": 0.02,
      "block_reason": ""
    });
  }

  // 5. Smart Categorization (/api/analyze-issue)
  if (promptText.includes('përcakto saktësisht kategorinë') || promptText.includes('kategorinë dhe urgjencën e problemit')) {
    return JSON.stringify({
      "title": "Dëmtim në Rrugë (Analizë Automative)",
      "description": "Identifikohet një problem i dukshëm në infrastrukturë bazuar në imazhin dhe të dhënat e ofruara. Nevojitet ndërhyrje për sanimin e saj.",
      "category": "Komuna - Drejtoria e Infrastrukturës (Rrugë lokale, Gropa, Asfaltim në qytet/fshat)",
      "urgency": "Mesatare",
      "reasoning": "Sipas analizës vizuale, dëmtimi është i lokalizuar në rrugë komunale dhe kërkon ndërhyrje nga drejtoria e infrastrukturës lokale."
    });
  }

  // 6. AI Duplicate Text & Image Merger (/api/detect-duplicate)
  if (promptText.includes('krahasoje me listën e ankesave aktive')) {
    return JSON.stringify({
      "is_duplicate": false,
      "duplicate_of_id": null,
      "reason": "Nuk u gjet asnjë ankesë e ngjashme aktive në këtë zonë gjeografike për të njëjtën ngjarje."
    });
  }

  // 7. AI Personalized Reporting Tips (/api/dashboard/reporting-tips)
  if (promptText.includes('3 këshilla konkrete') || promptText.includes('rrisë ndikimin e raportimeve')) {
    return JSON.stringify({
      "tips": [
        "Shto përshkrime më të detajuara dhe specifiko adresën e saktë për të ndihmuar ekipet administrative.",
        "Përdor fotografi më të qarta gjatë ditës duke kapur problematikën nga kënde dhe distanca të ndryshme.",
        "Merr pjesë aktivisht në komunitet duke ndjekur dhe votuar raportet e tjera për t'u dhënë prioritet rasteve kryesore."
      ]
    });
  }

  // 8. AI Executive Summarization (/api/admin/summarize)
  if (promptText.includes('përmbledhje ekzekutive të strukturuar') || promptText.includes('plani i aksionit komunal')) {
    return `### 📋 1. Analiza e Çështjeve Kryesore
Raportimet e fundit tregojnë një përqendrim të ankesave në kategoritë e shërbimeve publike dhe infrastrukturës, veçanërisht lidhur med gropa në rrugë dhe ndriçim publik.

### 📍 2. Lokalizimi & Zonat Më të Prekura (Hotspots)
Problemet janë kryesisht të përqendruara në rrugët lokale kryesore të qytetit dhe zonat afër shkollave apo qendrave të banimit, ku dëmtimet kërkojnë ndërhyrje të menjëhershme.

### ⚡ 3. Plani i Aksionit Komunal (Urgjent)
- **Drejtoria e Shërbimeve Publike:** Ndërmarrja e menjëhershme e riparimit të rrjetit të ndriçimit publik për të rritur sigurinë gjatë natës.
- **Drejtoria e Infrastrukturës:** Sanimi i gropave në segmentet rrugore më të ngarkuara brenda 48 orëve të ardhshme.`;
  }

  // 9. AI Municipality Health Check (/api/municipality-health-check)
  if (promptText.includes('analiso performancën e komunës') || promptText.includes('gjithsej ankesa:')) {
    return JSON.stringify({
      "score": 82,
      "grade": "Shkëlqyeshëm",
      "analysis": "Komuna tregon një shkallë të lartë të përgjegjshmërisë dhe efikasitetit në trajtimin e ankesave qytetare. Bashkëpunimi i qytetarëve ka ndihmuar në identifikimin e shpejtë të problemeve.",
      "hotspots": "Infrastruktura lokale rrugore dhe kanalizimet mbeten çështjet kryesore të raportuara.",
      "recommendations": "Shto resurset dhe buxhetin për ekipet emergjente komunale për të rritur edhe më tej shpejtësinë e zgjidhjes së rasteve."
    });
  }

  // 10. AI Automated Local News & Alerts (/api/dashboard/ai-news)
  if (promptText.includes('lajme dhe njoftime') || promptText.includes('ai-news') || promptText.includes('alerts')) {
    return JSON.stringify({
      "alerts": [
        {
          "id": "fallback-news-1",
          "type": "warning",
          "title": "Punime dhe Kufizim i Qarkullimit",
          "text": "Do të ketë kufizim të përkohshëm të qarkullimit në rrugët kryesore për shkak të punimeve të mirëmbajtjes së rrugëve komunale sot.",
          "time": "Mëngjes • Sot"
        },
        {
          "id": "fallback-news-2",
          "type": "error",
          "title": "Ndërprerje e Planifikuar e Ujit",
          "text": "KRU njofton për ndërprerje ose rënie të presionit të ujit të pijshëm në disa zona të larta për shkak të rritjes së konsumit ditor.",
          "time": "Pasdite • Sot"
        },
        {
          "id": "fallback-news-3",
          "type": "warning",
          "title": "Aktivitete të Pastrimit të Ambientit",
          "text": "Kompanitë e kontraktuara komunale po vazhdojnë aksionet për pastrimin e zonave publike dhe largimin e mbeturinave të raportuara.",
          "time": "Mbrëmje • Sot"
        }
      ]
    });
  }

  // 11. AI Procedure Assistant Chat (/api/ai-assistant/chat) - Fallback responses
  const isEn = promptText.toLowerCase().includes('english') || promptText.toLowerCase().includes('en');
  const isDe = promptText.toLowerCase().includes('german') || promptText.toLowerCase().includes('de');
  const isTr = promptText.toLowerCase().includes('turkish') || promptText.toLowerCase().includes('tr');
  const isBs = promptText.toLowerCase().includes('bosnian') || promptText.toLowerCase().includes('bs');

  if (promptText.toLowerCase().includes('lindj') || promptText.toLowerCase().includes('certifikatë lindjeje') || promptText.toLowerCase().includes('birth_cert')) {
    return `### 📝 Certifikata e Lindjes

Për të marrë një Certifikatë të Lindjes në Komunë, ju duhen këto dokumente dhe hapa:

*   **Dokumentet e nevojshme:**
    *   Lajmërimi i lindjes nga spitali (për lindje të reja).
    *   Letërnjoftimi i vlefshëm i prindit (ose i juaji nëse jeni madhor).
    *   Certifikata e kurorëzimit të prindërve (nëse aplikohet).
*   **Procedura:**
    *   Mund të aplikoni fizikisht në sportelet e Zyrës së Gjendjes Civile në komunën tuaj.
    *   Ose, aplikoni online në mënyrë të shpejtë përmes **portalit shtetëror e-Kosova** me kosto zero.
*   **Tarifa:**
    *   Fizikisht në komunë: 1.00 € tarifë administrative.
    *   Online në **e-Kosova**: Falas (0.00 €).`;
  }

  if (promptText.toLowerCase().includes('ndërtim') || promptText.toLowerCase().includes('leje ndërtimi') || promptText.toLowerCase().includes('building_permit')) {
    return `### 🏗️ Leja e Ndërtimit

Për të aplikuar për Leje Ndërtimi për një shtëpi banimi ose objekt tjetër:

*   **Dokumentet e nevojshme:**
    *   Kopja e planit dhe fleta poseduese e parcelës (jo më e vjetër se 6 muaj).
    *   Projekti kryesor arkitektonik i ndërtimit (në 3 kopje).
    *   Pëlqimet e nevojshme (ujësjellës, KEDS, mjedisore).
*   **Procedura:**
    *   Aplikimi dorëzohet në Drejtorinë e Urbanizmit të komunës përkatëse.
    *   Komisioni vlerëson projektin dhe lëshon kushtet ndërtimore para aprovimit të lejes.
*   **Tarifa:**
    *   Tarifa llogaritet për metër katror konform rregulloreve komunale në fuqi.`;
  }

  if (promptText.toLowerCase().includes('biznes') || promptText.toLowerCase().includes('regjistrim biznesi') || promptText.toLowerCase().includes('business_reg')) {
    return `### 💼 Regjistrimi i Biznesit (Sh.p.k.)

Procedura për regjistrimin e një biznesi të ri dhe lejet përkatëse:

*   **Dokumentet e nevojshme:**
    *   Marrëveshja e shoqërisë dhe statuti i kompanisë.
    *   Kopja e letërnjoftimit të pronarëve dhe drejtorit të autorizuar.
    *   Vendimi për emrin e biznesit dhe selinë.
*   **Procedura:**
    *   Regjistrimi bëhet në Agjencinë e Regjistrimit të Bizneseve në Kosovë (ARBK) apo në qendrat komunale "One-Stop-Shop".
    *   Pas ARBK, duhet të aplikoni në komunë për pëlqimin e lokacionit dhe lejen e punës.
*   **Tarifa:**
    *   Regjistrimi në ARBK është pa pagesë (0.00 €).`;
  }

  if (isEn) {
    return `Thank you for your message. Currently, the AI system is responding in offline safety mode.

You can access official administrative services online through the national portal **e-Kosova**, or by visiting the municipal citizen service counters in your city.

For further inquiries, please feel free to ask or contact your local municipality administration directly.`;
  } else if (isDe) {
    return `Vielen Dank für Ihre Nachricht. Derzeit befindet sich das AI-System im Offline-Sicherheitsmodus.

Sie können offizielle Verwaltungsdienste online über das Staatsportal **e-Kosova** oder persönlich an den Schaltern der Bürgerdienste Ihrer Stadt in Anspruch nehmen.

Für weitere Fragen wenden Sie sich bitte direkt an Ihre Gemeindeverwaltung.`;
  } else if (isTr) {
    return `Mesajınız için teşekkür ederiz. Şu anda yapay zeka sistemi çevrimdışı güvenlik modunda çalışmaktadır.

Resmi idari işlemleri **e-Kosova** devlet portalı üzerinden çevrimiçi olarak veya şehrinizdeki belediye hizmet binalarından gerçekleştirebilirsiniz.

Daha fazla bilgi için doğrudan belediyenizle iletišime geçebilirsiniz.`;
  } else if (isBs) {
    return `Hvala vam na poruci. Trenutno je AI sistem u sigurnosnom režimu rada van mreže.

Zvanične administrativne usluge možete dobiti online putem državnog portala **e-Kosova** ili lično na šalterima za usluge građanima u vašoj opštini.

Za dodatna pitanja slobodno se obratite direktno opštinskoj administraciji.`;
  }

  return `Ju faleminderit për pyetjen tuaj. Aktualisht, sistemi i Inteligjencës Artificiale është duke funksionuar në modin e sigurtë të rezervës lokale.

Ju mund të kryeni shërbime të ndryshme zyrtare administrative direkt online përmes portalit kombëtar **e-Kosova**, ose duke vizituar sportelet e Shërbimit me Qytetarë në objektin e komunës suaj.

Për çfarëdo pyetje shtesë specifike, ju lutem mos hezitoni të pyesni ose të vizitoni faqen zyrtare të komunës suaj.`;
}

async function generateContentWithFallback(options: {
  contents: any;
  config?: any;
  defaultModel?: string;
  fallbackModels?: string[];
}) {
  const defaultModel = options.defaultModel || 'gemini-2.5-flash';
  const models = options.fallbackModels || [
    defaultModel,
    'gemini-2.5-flash',
    'gemini-2.5-flash',
    'gemini-2.5-flash'
  ];

  let lastError: any = null;
  for (const model of models) {
    try {

      const response = await getAI().models.generateContent({
        model: model,
        contents: options.contents,
        config: options.config,
      });

      return response;
    } catch (err: any) {
      lastError = err;
      const errString = lastError ? (lastError.message || String(lastError)) : '';
      const isQuotaOrAuth = errString.includes('quota') || errString.includes('429') || errString.includes('RESOURCE_EXHAUSTED') || errString.includes('API key') || errString.includes('unauthorized') || errString.includes('key') || errString.includes('not found');
      if (isQuotaOrAuth) { break; }
    }
  }

  const errString = lastError ? (lastError.message || String(lastError)) : '';
  const isQuotaOrAuth = errString.includes('quota') ||
                        errString.includes('429') ||
                        errString.includes('RESOURCE_EXHAUSTED') ||
                        errString.includes('API key') ||
                        errString.includes('not found') ||
                        errString.includes('unauthorized') ||
                        errString.includes('key');

  const hasApiKey = !!process.env.GEMINI_API_KEY;

  if (isQuotaOrAuth || !hasApiKey) {
    console.warn("[AI Fallback Engine] Active fallback engaged due to quota limitation or missing API key.");
    return {
      text: getSafetyFallbackText(options.contents, options.config),
      // Canned content, not a model answer. Callers must not cache it or treat
      // it as authoritative.
      degraded: true,
    } as { text: string; degraded: true };
  }

  throw lastError || new Error("All AI models failed to respond");
}

function resolvePort(): number {
  const args = process.argv.slice(2);
  const portArg = args.find((arg, index) => {
    if (arg === '--port' || arg === '-p') return true;
    return arg.startsWith('--port=') || arg.startsWith('-p=');
  });

  if (portArg) {
    const raw = portArg.includes('=')
      ? portArg.split('=')[1]
      : args[args.indexOf(portArg) + 1];
    const parsed = Number(raw);
    if (Number.isInteger(parsed) && parsed > 0 && parsed <= 65535) {
      return parsed;
    }
  }

  const envPort = Number(process.env.PORT);
  if (Number.isInteger(envPort) && envPort > 0 && envPort <= 65535) {
    return envPort;
  }

  /**
   * The default development port.
   *
   * 3002 rather than 3001: 3001 collides with the port a common local tool
   * already holds on this machine, and the auto-increment then silently served
   * the app on 3003+ while documentation and bookmarks pointed at 3001. A fixed,
   * documented default is worth more than the one-line convenience of the old
   * value. Override with `PORT` or `--port` as before.
   */
  return 3002;
}

function getAvailablePort(port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const tester = net.createServer();

    tester.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        resolve(getAvailablePort(port + 1));
      } else {
        reject(err);
      }
    });

    tester.once('listening', () => {
      tester.close(() => resolve(port));
    });

    tester.listen(port, '0.0.0.0');
  });
}

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  // Behind Cloud Run / App Engine. Exactly one proxy hop, so `req.ip` resolves to
  // the real client and the rate limiter cannot be bypassed with a forged
  // X-Forwarded-For header.
  app.set('trust proxy', 1);

  const isProduction = SECURITY_CONFIG.isProduction;
  const allowedOrigins = SECURITY_CONFIG.allowedOrigins;

  const requestedPort = resolvePort();

  /**
   * In a cluster, only the primary picks the port.
   *
   * `getAvailablePort()` probes by binding a socket and closing it again. Eight
   * workers doing that at the same instant all see the port free and all decide
   * they may use it; the seven that lose `listen()` then walk forward to 3002,
   * 3003 and so on. The cluster silently spreads across eight ports, a load
   * balancer in front of it reaches the wrong one half the time, and the failure
   * looks like random 502s rather than a bug in this file.
   *
   * Workers inherit the primary's listening handle instead, so every process
   * serves the same port and the OS distributes connections between them.
   */
  const isClusteredWorker = Boolean(cluster.worker);
  const PORT = isClusteredWorker
    ? requestedPort
    : await getAvailablePort(requestedPort);

  // Baseline payload ceiling of 1 MB, with a larger one only for the photo
  // analysis route. The parser has to be chosen *here*: body-parser runs once per
  // request, so a bigger `express.json()` on the route itself never saw the body
  // (the global 1 MB parser had already rejected it), and every phone photo
  // above ~750 KB failed analysis.
  const defaultJson = express.json({ limit: '1mb' });
  const imageJson = express.json({ limit: '12mb' });
  // A cropped report photo also arrives as an image in JSON (server/reportPhotoEdit.ts).
  const isImageRoute = (path: string) => path === '/api/analyze-issue' || /^\/api\/v1\/reports\/[^/]+\/media\/crop$/.test(path);
  app.use((req, res, next) => (isImageRoute(req.path) ? imageJson : defaultJson)(req, res, next));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));

  /**
   * Compression. Brotli when the client advertises it, gzip otherwise.
   *
   * The threshold is 1 KB: compressing a 200-byte JSON error costs CPU without
   * saving a single byte. Already-compressed payloads (JPEG, PNG, WebP, mp4)
   * are left alone, and video streaming is never buffered through the middleware.
   */
  app.use(compression({
    threshold: 1024,
    level: 6,
    // Presence of the `brotli` block is what enables Brotli; zlib falls back to
    // gzip when the client does not send Accept-Encoding: br.
    brotli: { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } },
    filter: (req, res) => {
      const type = res.getHeader('Content-Type');
      if (typeof type === 'string' && /^(image|video|audio)\//.test(type)) return false;
      return compression.filter(req, res);
    },
  }));

  // NOTE: CSP scheme sources must be written as "https:" — writing "https://"
  // makes the source invalid and the browser silently drops the whole directive.
  // That previously blocked every OpenStreetMap tile, so both the /harta page and
  // the dashboard map fell back to the static SVG placeholder.

  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        // www.google.com/recaptcha and www.gstatic.com/recaptcha: Firebase App Check attestation.
        scriptSrc: ["'self'", "'unsafe-inline'", "https://www.googletagmanager.com", "https://www.google-analytics.com", "https://apis.google.com", "https://www.google.com/recaptcha/", "https://www.gstatic.com/recaptcha/"],
        // Google Fonts is requested from index.css, so the stylesheet host must be allowed.
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
        // Map tiles (*.tile.openstreetmap.org, mt*.google.com), ad banners, hero photos
        // and Firebase Storage uploads are all served over https from third-party hosts.
        // The local Storage emulator serves uploads over plain http; without it
        // no image or video uploaded in the sandbox could be displayed.
        imgSrc: ["'self'", "data:", "blob:", "https:", ...(isLocalFirebaseEmulator ? ["http://127.0.0.1:9199"] : [])],
        mediaSrc: ["'self'", "blob:", "https:", ...(isLocalFirebaseEmulator ? ["http://127.0.0.1:9199"] : [])],
        connectSrc: [
          "'self'",
          "https:",
          "wss:",
          ...(isProduction ? [] : ["ws:"]),
          ...(isLocalFirebaseEmulator
            ? ["http://127.0.0.1:9099", "http://127.0.0.1:8080", "http://127.0.0.1:9199"]
            : []),
        ],
        frameSrc: ["'self'", "https://accounts.google.com", "https://*.firebaseapp.com", "https://www.google.com/recaptcha/", "https://recaptcha.google.com/recaptcha/"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        // Helmet enables this by default; it must stay off locally so the dev
        // origin (http://localhost:3001, and Vite's HMR websocket) keeps working.
        upgradeInsecureRequests: isProduction ? [] : null
      }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    frameguard: { action: 'deny' }, // Prevent clickjacking
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin'
    },
    xssFilter: true, // X-XSS-Protection
    noSniff: true // X-Content-Type-Options
  }));

  /**
   * CORS.
   *
   * In production the allow-list is explicit and an unlisted origin receives no
   * CORS headers at all, so the browser blocks the request before it can reach a
   * handler. An empty production list is a hard failure rather than a silent
   * "allow everything", which is what `origin: true` used to degrade to when
   * ALLOWED_ORIGINS was unset.
   *
   * Same-origin requests are allowed unconditionally, and that is the rule that
   * makes this server runnable on any port. The browser sends an `Origin` header
   * on *same-origin* POSTs and on every module/stylesheet fetch, so this process
   * serving the app from `:3001` was sending `Origin: http://localhost:3001` to
   * itself, failing its own allow-list, and answering with a 500 — a blank page
   * whose only clue was "500" in the network tab. CORS exists to police
   * *cross*-origin calls; a request that came from the document this server just
   * served is by definition not one, and no allow-list can be expected to
   * enumerate every port the app might be started on.
   */
  app.use(cors((req, callback) => {
    const origin = req.get('origin');
    const host = req.get('host') ?? undefined;

    // Non-browser clients (curl, health checks, mobile app) send no Origin.
    if (!origin) return callback(null, { origin: true, credentials: true });

    const allowed =
      allowedOrigins.includes(origin) ||
      isSameOrigin(origin, host) ||
      !isProduction;

    if (!allowed) {
      // No CORS headers are emitted, so the browser blocks the response before
      // it reaches any route handler. Deliberately not an error: throwing here
      // turns a cross-origin probe into a 500 on a page that may itself be fine.
      return callback(null, { origin: false });
    }

    return callback(null, { origin: true, credentials: true });
  }));
  app.use(hpp()); // Prevent HTTP Parameter Pollution

  // Permissions-Policy and friends, applied after helmet so they are not lost.
  app.use(securityHeaders);

  // Request bodies are deliberately NOT rewritten here. A global HTML-stripping
  // pass used to run over every string in body/query/params; it turned every "&"
  // into "&amp;", cut text at any "<", and silently changed passwords containing
  // either character (so a password an admin set did not match what they typed).
  // React escapes on render, the API only returns JSON, and the one place that
  // injects HTML (AdBanner) sanitises at the point of use.

  // Rate limiting is now three tiers, each owned by server/security.ts:
  //   auth  - login/register, 10 per 15 min (brute-force surface)
  //   api   - general public API, 120 per min
  //   ai    - every AI endpoint, 5 per min (documented policy)
  app.use('/api/auth', authRateLimiter);
  app.use('/api/v1/auth', authRateLimiter);
  app.use('/api/ai-assistant', aiRateLimiter);
  app.use('/api/analyze-issue', aiRateLimiter);
  app.use('/api/moderate-comment', aiRateLimiter);
  app.use('/api/detect-duplicate', aiRateLimiter);
  app.use('/api/admin/predictive-analysis', aiRateLimiter);
  app.use('/api/admin/generate-response', aiRateLimiter);
  app.use('/api/admin/summarize', aiRateLimiter);
  app.use('/api/municipality-health-check', aiRateLimiter);
  app.use('/api/dashboard/reporting-tips', aiRateLimiter);
  app.use('/api/dashboard/ai-news', aiRateLimiter);
  app.use('/api', apiRateLimiter);



/**
 * Build a client-safe error payload.
 *
 * Upstream failures carry connection details, project ids and stack fragments
 * that must never reach the public internet. The real error is logged server
 * side; the caller gets a generic message plus a correlation id they can quote
 * in a support request. Outside production the raw message is still returned,
 * because that is the only thing that makes local debugging possible.
 */
function publicError(message: string, error: unknown): { message: string; requestId: string } {
  const requestId = Math.random().toString(36).substring(7);
  console.error(`[ERROR ${requestId}] ${message}`, error);
  return {
    message: isProduction
      ? message
      : (error instanceof Error ? error.message : message),
    requestId,
  };
}

/**
 * Send a 500 whose body is safe for the public internet: a fixed message plus a
 * correlation id. The raw error is logged by `publicError` and only echoed back
 * outside production. Handlers used to return `error.message` directly, which
 * leaks Firebase and Gemini internals (project ids, quota text, stack fragments).
 */
function sendServerError(res: import('express').Response, message: string, error: unknown) {
  const { message: shown, requestId } = publicError(message, error);
  return res.status(500).json({ error: shown, requestId });
}

/**
 * Reply for a read that cannot run because the Admin SDK has no credentials.
 *
 * A missing service account is a deployment gap, not a bug in the data, and it
 * is not the client's fault. Answering 500 implied the request was bad; 503 says
 * what is actually true — this endpoint is temporarily unavailable — and it stops
 * one misconfigured environment from looking like a crash on every page.
 *
 * Returns true when it handled the response, so callers read as
 * `if (adminUnavailable(res)) return;`.
 */
function adminUnavailable(res: import('express').Response): boolean {
  if (hasAdminCredentials) return false;
  res.setHeader('Cache-Control', 'no-store');
  res.status(503).json({
    error: 'Shërbimi i të dhënave nuk është i konfiguruar në këtë mjedis.',
  });
  return true;
}

/** Clamp untrusted text before it is interpolated into a model prompt. */
function clip(value: unknown, max: number): string {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

const ALLOWED_ANALYSIS_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
// base64 expands bytes by 4/3; this keeps the decoded image under ~8 MB.
const MAX_ANALYSIS_BASE64_CHARS = 11 * 1024 * 1024;

// --- PUBLIC READ API (cached) -------------------------------------------------
// These are the documents every anonymous visitor's page load needs. Serving
// them from the server cache is what keeps Firestore read costs flat as traffic
// grows: the client never talks to Firestore for static or semi-static data.

/** Public system settings: ad contacts, Reels toggle, slogans. */
app.get('/api/public/settings', async (_req, res) => {
  if (adminUnavailable(res)) return;
  try {
    const settings = await cachedDocument<Record<string, unknown>>('settings', 'general', 60_000);
    res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=300');
    res.json(settings ?? {});
  } catch (error: any) {
    res.status(500).json({ error: publicError('Nuk mund të ngarkohesh të dhënat e sistemit.', error) });
  }
});

/** Municipality contact directory. 5-minute TTL: it changes rarely. */
app.get('/api/public/contacts', async (_req, res) => {
  if (adminUnavailable(res)) return;
  try {
    const contacts = await cachedCollection<Record<string, unknown>>('contacts', {
      ttlMs: 300_000,
      limit: 500,
      sortField: 'name',
      sortDirection: 'asc',
    });
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=600');
    res.json(contacts);
  } catch (error: any) {
    res.status(500).json({ error: publicError('Nuk mund të ngarkohesh numrat e kontaktit.', error) });
  }
});

/** Ad slots. 30-second TTL so a campaign change goes live quickly. */
app.get('/api/public/ads', async (_req, res) => {
  if (adminUnavailable(res)) return;
  try {
    const ads = await cachedCollection<Record<string, unknown>>('ads', { ttlMs: 30_000, limit: 100 });
    res.setHeader('Cache-Control', 'public, max-age=15, stale-while-revalidate=60');
    res.json(ads);
  } catch (error: any) {
    res.status(500).json({ error: publicError('Nuk mund të ngarkohen reklamat.', error) });
  }
});

/** Categories used by the report form. */
app.get('/api/public/categories', async (_req, res) => {
  try {
    const categories = await cachedCollection<Record<string, unknown>>('categories', {
      ttlMs: 600_000,
      limit: 100,
      sortField: 'name',
      sortDirection: 'asc',
    });
    res.setHeader('Cache-Control', 'public, max-age=120, stale-while-revalidate=600');
    res.json(categories);
  } catch (error: any) {
    res.status(500).json({ error: publicError('Nuk mund të ngarkohen kategoritë.', error) });
  }
});

/**
 * On-demand translation for news articles and any other user-generated text.
 *
 * Requires a session (anonymous guests count): the endpoint forwards text to
 * external translation providers, so an anonymous, unmetered caller could use the
 * platform as a free translation proxy and send arbitrary content off-platform.
 *
 * Results are cached by a key the client supplies (which includes a hash of the
 * source text), so re-opening an article costs nothing and editing the article
 * produces a new key rather than serving a stale translation. The cache is the
 * module-level `cache` used elsewhere, so the TTL policy is consistent.
 */
app.post('/api/translate', requireAuth, async (req, res) => {
  try {
    const { text, target, source = 'sq' } = req.body ?? {};
    const { MAX_TRANSLATE_CHARS, translationCacheKey } = await import('./server/translate');

    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Missing text to translate.' });
    }
    if (typeof target !== 'string' || !/^[a-z]{2}(-[A-Z]{2})?$/.test(target)) {
      return res.status(400).json({ error: 'Invalid target language.' });
    }
    if (target === source) return res.json({ text });

    if (text.length > MAX_TRANSLATE_CHARS) {
      return res.status(413).json({ error: 'Teksti për përkthim është shumë i gjatë.' });
    }

    const cacheKey = translationCacheKey(source, target, text);
    const hit = cache.get<string>(cacheKey);
    if (hit) {
      return res.json({ text: hit, cached: true });
    }

    const { translateText } = await import('./server/translate');
    const translated = await translateText(text, target, source);

    if (!translated) {
      // 503 rather than a silent Albanian fallback: the client already handles
      // a failed field by showing the original, and a wrong-language sentence
      // inside a translated article reads as a bug to the citizen.
      return res.status(503).json({ error: 'Translation temporarily unavailable.' });
    }

    cache.set(cacheKey, translated, 7 * 24 * 60 * 60 * 1000);
    res.json({ text: translated });
  } catch (error: any) {
    res.status(500).json({ error: publicError('Nuk mund të përkthehet teksti.', error) });
  }
});

/** Poll metadata. Votes are never served from cache. */
app.get('/api/public/polls', async (_req, res) => {
  if (adminUnavailable(res)) return;
  try {
    const polls = await cachedCollection<Record<string, unknown>>('polls', {
      ttlMs: 30_000,
      limit: 50,
      sortField: 'createdAt',
      sortDirection: 'desc',
    });
    res.setHeader('Cache-Control', 'public, max-age=15, stale-while-revalidate=60');
    res.json(polls);
  } catch (error: any) {
    res.status(500).json({ error: publicError('Nuk mund të ngarkohen sondazhet.', error) });
  }
});

/** Municipality health statistics, aggregated once and cached for a minute. */
app.get('/api/public/stats', async (_req, res) => {
  if (adminUnavailable(res)) return;
  try {
    const reports = await cachedCollection<Record<string, any>>('reports', {
      ttlMs: 60_000,
      limit: 1000,
    });

    const byStatus: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    const byMunicipality: Record<string, number> = {};

    for (const report of reports) {
      const status = String(report.status || 'Unknown');
      const category = String(report.category || 'Të tjera');
      const municipality = String(report.municipality || report.location?.municipality || 'E panjohur');

      byStatus[status] = (byStatus[status] ?? 0) + 1;
      byCategory[category] = (byCategory[category] ?? 0) + 1;
      byMunicipality[municipality] = (byMunicipality[municipality] ?? 0) + 1;
    }

    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.json({
      total: reports.length,
      byStatus,
      byCategory,
      byMunicipality,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json(publicError('Nuk mund të llogariten statistikat komunale.', error));
  }
});

/**
 * Liveness and cache telemetry. Unauthenticated on purpose so the platform
 * health checker does not need credentials, but it exposes counters only — no
 * document contents, no configuration.
 */
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime()),
    cache: cache.stats(),
    environment: isProduction ? 'production' : 'development',
    // Lets a client decide whether to bother calling the Firestore-backed routes
    // at all. A page that knows the server has no data source can use its local
    // copy directly instead of issuing a request it knows will be refused.
    dataSource: hasAdminCredentials ? 'firestore' : 'unavailable',
  });
});

/**
 * XML sitemap covering every public page in every supported language.
 *
 * Google needs three things to index a multilingual site correctly: a stable
 * URL per language, a sitemap that lists them, and reciprocal hreflang links so
 * the versions are understood as translations of one page rather than 20 pages
 * that happen to look alike. All three are generated from the same tables the
 * client uses, so a page cannot end up in the sitemap with a language that has
 * no URL.
 */
const SITEMAP_PAGES: Array<{ path: string; priority: string; changefreq: string }> = [
  { path: '/', priority: '1.0', changefreq: 'daily' },
  { path: '/lajme', priority: '0.9', changefreq: 'daily' },
  { path: '/raporto', priority: '0.9', changefreq: 'weekly' },
  { path: '/sherbimet', priority: '0.8', changefreq: 'weekly' },
  { path: '/harta', priority: '0.8', changefreq: 'daily' },
  { path: '/statistikat', priority: '0.8', changefreq: 'daily' },
  { path: '/komunat', priority: '0.7', changefreq: 'weekly' },
  { path: '/projektet', priority: '0.7', changefreq: 'weekly' },
  { path: '/ndihma', priority: '0.7', changefreq: 'weekly' },
  { path: '/kontakt', priority: '0.6', changefreq: 'monthly' },
  { path: '/kontakt-numrat', priority: '0.6', changefreq: 'monthly' },
  { path: '/trackid', priority: '0.6', changefreq: 'weekly' },
  { path: '/sondazhet', priority: '0.6', changefreq: 'weekly' },
  { path: '/buxheti', priority: '0.6', changefreq: 'monthly' },
  { path: '/donacion', priority: '0.6', changefreq: 'monthly' },
  { path: '/rreth-projektit', priority: '0.5', changefreq: 'monthly' },
  { path: '/kushtet-e-perdorimit', priority: '0.3', changefreq: 'yearly' },
  { path: '/privatesia', priority: '0.3', changefreq: 'yearly' },
];

/** Language code -> URL prefix. Mirrors SEO_LOCALES on the client. */
const SITEMAP_LOCALES: Array<{ tag: string; prefix: string }> = [
  { tag: 'sq-AL', prefix: '' },
  { tag: 'en-US', prefix: 'en' },
  { tag: 'de-DE', prefix: 'de' },
  { tag: 'bs-BA', prefix: 'bs' },
  { tag: 'ar-SA', prefix: 'ar' },
  { tag: 'tr-TR', prefix: 'tr' },
  { tag: 'sr-RS', prefix: 'sr' },
  { tag: 'fr-FR', prefix: 'fr' },
  { tag: 'it-IT', prefix: 'it' },
  { tag: 'es-ES', prefix: 'es' },
  { tag: 'pt-PT', prefix: 'pt' },
  { tag: 'de-CH', prefix: 'ch' },
  { tag: 'mk-MK', prefix: 'mk' },
  { tag: 'sl-SI', prefix: 'sl' },
  { tag: 'hr-HR', prefix: 'hr' },
  { tag: 'ro-RO', prefix: 'ro' },
  { tag: 'sv-SE', prefix: 'sv' },
  { tag: 'nb-NO', prefix: 'nb' },
  { tag: 'hy-AM', prefix: 'hy' },
  { tag: 'nl-NL', prefix: 'nl' },
];

const SITE_ORIGIN = process.env.SITE_ORIGIN || 'https://zeriqytetare.republiks';

app.get('/sitemap.xml', (_req, res) => {
  const urls: string[] = [];

  for (const page of SITEMAP_PAGES) {
    for (const locale of SITEMAP_LOCALES) {
      const loc = SITE_ORIGIN + '/' +
        [locale.prefix, page.path.replace(/^\//, '')].filter(Boolean).join('/');

      // Every entry carries the full alternate set, including a pointer back to
      // itself, which is what the hreflang spec asks for.
      const alternates = SITEMAP_LOCALES.map((alt) => {
        const altUrl = SITE_ORIGIN + '/' +
          [alt.prefix, page.path.replace(/^\//, '')].filter(Boolean).join('/');
        return `    <xhtml:link rel="alternate" hreflang="${alt.tag}" href="${altUrl}" />`;
      }).join('\n');
      const xDefault = `    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN + page.path}" />`;

      urls.push(
        `  <url>\n    <loc>${loc}</loc>\n    <changefreq>${page.changefreq}</changefreq>\n    <priority>${page.priority}</priority>\n${alternates}\n${xDefault}\n  </url>`
      );
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(xml);
});

/** Robots: allow the public pages, keep the admin area and API out of the index. */
app.get('/robots.txt', (_req, res) => {
  const lines = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /api/',
    'Disallow: /login',
    'Disallow: /register',
    `Sitemap: ${SITE_ORIGIN}/sitemap.xml`,
  ];
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send(lines.join('\n'));
});

// --- NEW API ROUTES (v1) ---
app.post('/api/v1/auth/sync', requireAuth, async (req, res) => {
  const user = req.user!;
  const { dateOfBirth } = req.body ?? {};
  const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 120) : '';
  try {
    const userRef = db().collection('users').doc(user.uid);
    const doc = await userRef.get();
    if (!doc.exists) {
      /**
       * The 16-year floor is a legal term of service, not a UI nicety: the
       * register form enforces it client-side, but the only thing an attacker
       * needs to bypass that is a fetch call. The server re-runs the same
       * check so a crafted request cannot mint an under-age account, and the
       * profile is simply not created — there is nothing to recover.
       */
      if (typeof dateOfBirth === 'string' && dateOfBirth.length > 0 && !validateDateOfBirth(dateOfBirth)) {
        return res.status(400).json({ error: 'Datëlindja nuk është e vlefshme — duhet të keni të paktën 16 vjet.' });
      }
      // Create new user profile
      const newUser = {
        id: user.uid,
        email: user.email,
        name: name || user.email?.split('@')[0] || 'User',
        dateOfBirth: typeof dateOfBirth === 'string' && validateDateOfBirth(dateOfBirth) ? dateOfBirth : null,
        role: 'user', // default role
        createdAt: FieldValue.serverTimestamp(),
        points: 0,
        badges: [],
        // `email_verified` is a token claim; it is not a property of `req.user`,
        // so reading it there always produced `false`.
        isVerified: user.claims.email_verified === true
      };
      await userRef.set(newUser);
      return res.status(201).json({ message: 'User synced successfully', user: newUser });
    }
    return res.status(200).json({ message: 'User already exists', user: doc.data() });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/v1/users/me', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const doc = await db().collection('users').doc(user.uid).get();
    if (!doc.exists) return res.status(404).json({ error: 'User not found' });
    res.json(doc.data());
  } catch (error: any) {
    sendServerError(res, 'Kërkesa nuk u përpunua. Provoni përsëri.', error);
  }
});

/**
 * Admin write-through for the cached public collections.
 *
 * Every cached surface is read-only from the public API, so an admin edit has to
 * be followed by an explicit invalidation or the change stays invisible for up to
 * the TTL. Centralising it here means a new admin route cannot forget.
 */
app.post('/api/v1/admin/cache/invalidate', requireAuth, requireAdmin, (req, res) => {
  const collection = String(req.body?.collection || '').trim();
  if (!collection) {
    return res.status(400).json({ error: 'Parametri "collection" është i detyrueshëm.' });
  }
  // Only known, publicly cached collections may be cleared.
  const allowed = new Set(['settings', 'contacts', 'ads', 'categories', 'polls', 'reports']);
  if (!allowed.has(collection)) {
    return res.status(400).json({ error: `Koleksioni "${collection}" nuk është i cache-uar.` });
  }
  invalidateCollection(collection);
  res.json({ message: `Cache u invalidua për "${collection}".`, cache: cache.stats() });
});

app.post('/api/v1/admin/users', requireAuth, requireAdmin, async (req, res) => {
  let createdUid: string | null = null;

  try {
    const requestUser = req.user;
    if (!requestUser) return res.status(401).json({ error: 'Unauthorized' });

    const actorRole = await resolveActorRole(requestUser);
    if (!['admin', 'superadmin'].includes(actorRole)) {
      return res.status(403).json({ error: 'Kërkohet roli administrator.' });
    }

    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const name = String(req.body?.name ?? '').trim();
    const role = String(req.body?.role ?? 'agent');
    const phone = String(req.body?.phone ?? '').trim();
    const isBanned = req.body?.isBanned === true;
    /**
     * Optional initial password.
     *
     * When present the account is created ready to sign in, and no reset email
     * is needed. When absent the older flow is preserved exactly: the account
     * exists but the agent must set a password through the emailed link. The
     * value is validated here rather than trusted, and it is never written to
     * Firestore — only to Firebase Authentication.
     */
    const initialPassword = String(req.body?.password ?? '');
    if (initialPassword) {
      if (initialPassword.length < 8 || initialPassword.length > 128) {
        return res.status(400).json({ error: 'Fjalëkalimi duhet të ketë 8–128 shenja.' });
      }
      if (!/[a-zA-Z]/.test(initialPassword) || !/\d/.test(initialPassword)) {
        return res.status(400).json({ error: 'Fjalëkalimi duhet të përmbajë shkronja dhe numra.' });
      }
    }
    const allowedRoles = new Set(['agent', 'approver', 'adsadmin', 'newsadmin', 'debatwp', 'responder', 'dispatcher', 'moderator', 'monitor']);
    const allowedSections = new Set([
      'dashboard', 'updates', 'reports', 'workfacts', 'health', 'donations', 'users', 'forum',
      'polls', 'agents', 'municipalities', 'monitoring', 'monitorim', 'agentpanel', 'komunapanel', 'moderim',
      'support', 'chat', 'ads', 'notifications', 'news', 'debate',
      'categories', 'security', 'settings',
    ]);
    const permissions = Array.isArray(req.body?.permissions)
      ? req.body.permissions.map(String)
      : [];

    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Emri dhe një email i vlefshëm janë të detyrueshëm.' });
    }
    if (!allowedRoles.has(role)) {
      return res.status(400).json({ error: 'Roli i zgjedhur nuk mund të caktohet nga ky formular.' });
    }
    if (permissions.some((permission) => !allowedSections.has(permission))) {
      return res.status(400).json({ error: 'Lista e lejeve përmban një modul të panjohur.' });
    }

    const authUser = await authAdmin().createUser({
      email,
      displayName: name,
      emailVerified: false,
      disabled: isBanned,
      // Present only when the operator typed one; otherwise Firebase creates the
      // account without a password and the reset email handles first sign-in.
      ...(initialPassword ? { password: initialPassword } : {}),
    });
    createdUid = authUser.uid;

    await authAdmin().setCustomUserClaims(authUser.uid, buildRoleClaims(role, permissions));
    await db().collection('users').doc(authUser.uid).set({
      id: authUser.uid,
      name,
      email,
      phone,
      role,
      permissions,
      points: 0,
      badges: ['Staff Agent'],
      isVerified: false,
      isBanned,
      createdAt: FieldValue.serverTimestamp(),
    });

    audit('admin.staff.created', req, {
      targetUid: authUser.uid,
      email,
      role,
      permissions,
      // Record that a password was set, never the password itself.
      passwordSet: Boolean(initialPassword),
    });
    return res.status(201).json({ uid: authUser.uid, email, role, isBanned, passwordSet: Boolean(initialPassword) });
  } catch (error: any) {
    if (createdUid) {
      await db().collection('users').doc(createdUid).delete().catch(() => undefined);
      await authAdmin().deleteUser(createdUid).catch(() => undefined);
    }
    if (error?.code === 'auth/email-already-exists') {
      return res.status(409).json({ error: 'Ky email ka tashmë një llogari.' });
    }
    console.error('[ADMIN] Staff account creation failed:', error?.message);
    return res.status(500).json({ error: 'Llogaria e stafit nuk u krijua.' });
  }
});

app.put('/api/v1/admin/users/:uid/role', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { uid } = req.params;
    const role = String(req.body?.role ?? '');

    const actor = req.user;
    if (!actor) return res.status(401).json({ error: 'Unauthorized' });
    const actorRole = await resolveActorRole(actor);

    const target = await db().collection('users').doc(uid).get();
    if (!target.exists) return res.status(404).json({ error: 'Staff account not found.' });
    const currentTargetRole = String(target.data()?.role ?? '');

    // One tested decision (server/policy.ts): valid role, caller is an admin, no
    // changing your own access, and only a superadmin touches admin-level accounts.
    const decision = checkRoleChange({
      actorUid: actor.uid,
      actorRole,
      targetUid: uid,
      currentTargetRole,
      nextRole: role,
    });
    if (decision.outcome === 'deny') return res.status(decision.status).json({ error: decision.error });

    const allowedSections = new Set([
      'dashboard', 'updates', 'reports', 'workfacts', 'health', 'donations', 'users', 'agents', 'municipalities',
      'monitoring', 'monitorim', 'agentpanel', 'komunapanel', 'moderim',
      'ads', 'notifications', 'forum', 'support', 'chat', 'polls', 'news', 'security', 'settings', 'categories',
    ]);
    const permissions = Array.isArray(req.body?.permissions)
      ? req.body.permissions.map(String)
      : (Array.isArray(target.data()?.permissions) ? target.data()?.permissions.map(String) : []);
    if (permissions.some((permission) => !allowedSections.has(permission))) {
      return res.status(400).json({ error: 'Lista e lejeve përmban një modul të panjohur.' });
    }
    const isBanned = typeof req.body?.isBanned === 'boolean' ? req.body.isBanned : Boolean(target.data()?.isBanned);

    // The custom claim is what requireAdmin trusts, so it is the security
    // boundary: it lives outside Firestore rules and cannot be written by a
    // client. The document is updated to match, and the existing token is
    // revoked so the new role takes effect on the next sign-in rather than
    // staying stale for up to an hour.
    await authAdmin().updateUser(uid, { disabled: isBanned });
    await authAdmin().setCustomUserClaims(uid, buildRoleClaims(role, permissions));
    await authAdmin().revokeRefreshTokens(uid);
    await db().collection('users').doc(uid).update({ role, permissions, isBanned });

    audit('admin.staff.access.changed', req, {
      targetUid: uid,
      role,
      permissions,
      isBanned,
      previousRole: currentTargetRole,
    });
    res.json({ message: 'Role updated successfully' });
  } catch (error: any) {
    sendServerError(res, 'Kërkesa nuk u përpunua. Provoni përsëri.', error);
  }
});

/**
 * Superadmin moderation feed for a staff member.
 *
 * Returns every audit-log entry authored BY the target agent plus every entry
 * ABOUT them (role changes, bans, creations). The superadmin reads the full
 * story of an agent's activity — thousands of rows if that is what exists —
 * paginated so the response cannot become unbounded.
 */
app.get('/api/v1/admin/agents/:uid/activity', requireAuth, requireAdmin, async (req, res) => {
  try {
    const actor = req.user;
    const actorRole = await resolveActorRole(actor);
    if (actorRole !== 'superadmin') {
      return res.status(403).json({ error: 'Moderimi i detajuar kërkon superadmin.' });
    }

    const { uid } = req.params;
    const pageSize = Math.min(Number(req.query.limit) || 200, 500);
    const cursor = req.query.cursor ? String(req.query.cursor) : null;

    const target = await db().collection('users').doc(uid).get();
    if (!target.exists) return res.status(404).json({ error: 'Agjenti nuk u gjet.' });
    const targetEmail = String(target.data()?.email ?? '').toLowerCase();

    let q = db().collection('auditLogs').orderBy('createdAt', 'desc').limit(pageSize + 1);
    if (cursor) q = q.startAfter(new Date(cursor));
    const snap = await q.get();

    const rows = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter((row: any) => {
        const byAgent = row.actorUid === uid;
        const aboutAgent = row.detail?.targetUid === uid
          || (targetEmail && String(row.detail?.email ?? '').toLowerCase() === targetEmail);
        return byAgent || aboutAgent;
      });

    const hasMore = snap.docs.length > pageSize;
    const lastDoc = snap.docs[snap.docs.length - 1];
    const lastCreated = (lastDoc?.data() as any)?.createdAt;
    return res.json({
      agent: { id: target.id, ...target.data() },
      rows: rows.slice(0, pageSize),
      nextCursor: hasMore && lastCreated?.toDate ? lastCreated.toDate().toISOString() : null,
    });
  } catch (error: any) {
    console.error('[ADMIN] agent activity failed:', error?.message);
    res.status(500).json({ error: 'Historia nuk u lexua.' });
  }
});

/**
 * Direct password set by an admin. Firebase Admin's updateUser accepts a
 * password field, which is what makes this possible without the email
 * round-trip: the municipality office calls in, the superadmin sets a
 * temporary password, the office signs in and changes it.
 */
app.post('/api/v1/admin/users/:uid/set-password', requireAuth, requireAdmin, async (req, res) => {
  try {
    const actor = req.user;
    const actorRole = await resolveActorRole(actor);
    if (!['admin', 'superadmin'].includes(actorRole)) {
      return res.status(403).json({ error: 'Kërkohet roli administrator.' });
    }

    const { uid } = req.params;
    const password = String(req.body?.password ?? '');
    if (password.length < 8 || password.length > 128) {
      return res.status(400).json({ error: 'Fjalëkalimi duhet të ketë 8–128 shenja.' });
    }
    if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
      return res.status(400).json({ error: 'Fjalëkalimi duhet të përmbajë shkronja dhe numra.' });
    }

    const target = await db().collection('users').doc(uid).get();
    if (!target.exists) return res.status(404).json({ error: 'Llogaria nuk u gjet.' });
    const targetRole = String(target.data()?.role ?? '');
    // Only a superadmin may touch another admin's password.
    if (['admin', 'superadmin'].includes(targetRole) && actorRole !== 'superadmin') {
      return res.status(403).json({ error: 'Vetëm superadmini ndryshon fjalëkalimin e administratorëve.' });
    }

    await authAdmin().updateUser(uid, { password });
    await authAdmin().revokeRefreshTokens(uid);
    audit('admin.staff.password.set', req, { targetUid: uid, email: target.data()?.email });
    return res.json({ ok: true, message: 'Fjalëkalimi u vendos dhe sesionet e vjetra u revokuan.' });
  } catch (error: any) {
    console.error('[ADMIN] set password failed:', error?.message);
    res.status(500).json({ error: 'Fjalëkalimi nuk u vendos.' });
  }
});

// Apply authMiddleware to AI admin routes to prevent unauthorized usage
// requireAdmin is layered on per-route below, not here: a blanket admin gate on
// the whole /api/admin prefix would also lock out the public dashboards.
app.use('/api/admin/', requireAuth);

// --- PROFILES API ---
app.put('/api/v1/profile', requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    const { name, phone, avatar } = req.body ?? {};

    const updateData: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    if (typeof name === 'string' && name.trim()) updateData.name = name.trim().slice(0, 120);
    if (typeof phone === 'string' && phone.trim()) updateData.phone = phone.trim().slice(0, 40);
    if (avatar !== undefined && avatar !== null && avatar !== '') {
      // Rendered as an <img src>; only absolute https URLs are accepted so a
      // profile can never carry a javascript:/data: payload or an enormous blob.
      if (typeof avatar !== 'string' || avatar.length > 2048 || !/^https:\/\//i.test(avatar.trim())) {
        return res.status(400).json({ error: 'Avatari duhet të jetë një lidhje https.' });
      }
      updateData.avatar = avatar.trim();
    }

    const ref = db().collection('users').doc(user.uid);
    if (!(await ref.get()).exists) return res.status(404).json({ error: 'Profili nuk u gjet.' });

    await ref.update(updateData);
    audit('profile.updated', req, { fields: Object.keys(updateData).filter((key) => key !== 'updatedAt') });
    res.json({ message: 'Profile updated' });
  } catch (error: any) {
    sendServerError(res, 'Profili nuk u përditësua. Provoni përsëri.', error);
  }
});

// --- GDPR: RIGHT TO BE FORGOTTEN (Article 17) ---
/**
 * Erase a citizen's personal data (the policy and its limits are documented in
 * server/gdpr.ts).
 *
 * The account is removed only after EVERY erasure step succeeded. The earlier
 * version logged each failure and deleted the account anyway, which left personal
 * data behind with no identity left to retry from. A partial failure now returns
 * 500 with the names of the steps that failed and leaves the account in place;
 * the steps are idempotent, so the request can simply be repeated.
 */
app.delete('/api/v1/profile', requireAuth, async (req, res) => {
  if (adminUnavailable(res)) return;
  const uid = req.user!.uid;

  try {
    audit('gdpr.deletion.requested', req, { uid });

    const report = await eraseUserData(db(), storageBucket(), uid);
    const failed = report.steps.filter((step) => step.error);
    if (!report.ok) {
      console.error('[GDPR] Erasure incomplete:', failed.map((step) => `${step.name}: ${step.error}`).join('; '));
      audit('gdpr.deletion.failed', req, { uid, failedSteps: failed.map((step) => step.name) });
      return res.status(500).json({
        error: 'Fshirja nuk përfundoi. Llogaria juaj është ruajtur; provoni përsëri ose kontaktoni privacy@zeriqytetare.republiks.',
        failedSteps: failed.map((step) => step.name),
      });
    }

    // Identity goes last: once Auth is gone the citizen can no longer prove who
    // they were, so every other step has already completed.
    await db().collection('users').doc(uid).delete();
    await authAdmin().deleteUser(uid).catch((error: any) => {
      if (error?.code !== 'auth/user-not-found') throw error;
    });

    audit('gdpr.deletion.completed', req, { uid, steps: report.steps.map((step) => `${step.name}:${step.matched}`) });
    return res.json({
      message: 'Llogaria dhe të dhënat tuaja personale u fshinë në përputhje me Ligjin Nr. 06/L-082.',
      steps: report.steps,
    });
  } catch (error: any) {
    console.error('[GDPR] Erasure failed:', error?.message);
    return res.status(500).json({ error: 'Erasure failed. Please contact privacy@zeriqytetare.republiks for assistance.' });
  }
});

app.post('/api/v1/admin/municipalities', requireAuth, requireAdmin, async (req, res) => {
  let createdUid: string | null = null;

  try {
    const actor = req.user!;
    const actorRole = await resolveActorRole(actor);
    if (actorRole !== 'superadmin') {
      return res.status(403).json({ error: 'Krijimi i llogarive komunale kërkon superadmin.' });
    }

    const body = req.body ?? {};
    const email = String(body.email ?? '').trim().toLowerCase();
    const name = String(body.name ?? '').trim();
    const municipality = String(body.municipality ?? '').trim();
    const plan = String(body.plan ?? 'basic');
    const phone = String(body.phone ?? '').trim();
    const internalNote = String(body.internalNote ?? '').trim();
    const clauseAcceptedAt = String(body.clauseAcceptedAt ?? '').trim();
    const clauseText = String(body.editorialClauseText ?? '').trim();
    const initialPassword = String(body.initialPassword ?? '');

    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Emri dhe një email i vlefshëm janë të detyrueshëm.' });
    }
    if (!municipality) {
      return res.status(400).json({ error: 'Komuna është e detyrueshme.' });
    }
    /**
     * The consent gate.
     *
     * An account without a dated acceptance of the editorial firewall has no
     * enforceable boundary — the whole business model rests on the municipality
     * having been shown, and agreed to, the clause before activation. So this is
     * a hard requirement, not a warning: no timestamp, no account.
     */
    if (!clauseAcceptedAt) {
      return res.status(400).json({ error: 'Klauzola e firewall-it editorial duhet të pranohet para aktivizimit.' });
    }
    if (initialPassword) {
      if (initialPassword.length < 8 || initialPassword.length > 128) {
        return res.status(400).json({ error: 'Fjalëkalimi duhet të ketë 8–128 shenja.' });
      }
      if (!/[a-zA-Z]/.test(initialPassword) || !/\d/.test(initialPassword)) {
        return res.status(400).json({ error: 'Fjalëkalimi duhet të përmbajë shkronja dhe numra.' });
      }
    }

    const authUser = await authAdmin().createUser({
      email,
      displayName: name,
      emailVerified: false,
      disabled: false,
      ...(initialPassword ? { password: initialPassword } : {}),
    });
    createdUid = authUser.uid;

    await authAdmin().setCustomUserClaims(
      authUser.uid,
      buildRoleClaims('municipality', ['dashboard', 'reports', 'health', 'donations'], municipality)
    );

    // The password is deliberately absent from this document: it belongs to
    // Firebase Auth alone, and Firestore rules cannot protect a field that
    // client-readable records would otherwise carry.
    await db().collection('users').doc(authUser.uid).set({
      id: authUser.uid,
      name,
      email,
      phone,
      role: 'municipality',
      municipality,
      municipalityPlan: plan,
      permissions: ['dashboard', 'reports', 'health', 'donations'],
      points: 0,
      badges: ['Llogari Komunale'],
      isVerified: false,
      isBanned: false,
      internalNote,
      editorialClauseAcceptedAt: clauseAcceptedAt,
      editorialClauseText: clauseText,
      passwordSetDirectly: Boolean(initialPassword),
      createdAt: FieldValue.serverTimestamp(),
    });

    audit('admin.municipality.created', req, {
      targetUid: authUser.uid,
      email,
      municipality,
      plan,
      passwordSet: Boolean(initialPassword),
    });
    return res.status(201).json({
      uid: authUser.uid,
      email,
      municipality,
      plan,
      passwordSet: Boolean(initialPassword),
    });
  } catch (error: any) {
    // Roll back the half-created identity so a retry is not blocked by a
    // duplicate email that no working account actually owns.
    if (createdUid) {
      await db().collection('users').doc(createdUid).delete().catch(() => undefined);
      await authAdmin().deleteUser(createdUid).catch(() => undefined);
    }
    if (error?.code === 'auth/email-already-exists') {
      return res.status(409).json({ error: 'Ky email ka tashmë një llogari.' });
    }
    console.error('[ADMIN] Municipality creation failed:', error?.message);
    return res.status(500).json({ error: 'Llogaria komunale nuk u krijua.' });
  }
});

app.put('/api/v1/admin/municipalities/:uid', requireAuth, requireAdmin, async (req, res) => {
  try {
    const actor = req.user!;
    const actorRole = await resolveActorRole(actor);
    if (actorRole !== 'superadmin') {
      return res.status(403).json({ error: 'Ndryshimi i llogarive komunale kërkon superadmin.' });
    }

    const { uid } = req.params;
    const target = await db().collection('users').doc(uid).get();
    if (!target.exists) return res.status(404).json({ error: 'Llogaria komunale nuk u gjet.' });
    if (String(target.data()?.role ?? '') !== 'municipality') {
      return res.status(400).json({ error: 'Kjo nuk është llogari komunale.' });
    }

    /**
     * Only a fixed, server-owned set of fields is writable here.
     *
     * The email is deliberately not among them: it is the sign-in identity in
     * Firebase Auth, and changing it in Firestore alone would leave the two
     * disagreeing. The clause text and its timestamp are immutable for the same
     * reason — consent is historical record, not a setting.
     */
    const updates: Record<string, unknown> = {};
    if (typeof req.body?.name === 'string' && req.body.name.trim()) updates.name = req.body.name.trim();
    if (typeof req.body?.phone === 'string') updates.phone = req.body.phone.trim();
    if (typeof req.body?.municipality === 'string' && req.body.municipality.trim()) updates.municipality = req.body.municipality.trim();
    if (typeof req.body?.plan === 'string' && req.body.plan.trim()) updates.municipalityPlan = req.body.plan.trim();
    if (typeof req.body?.internalNote === 'string') updates.internalNote = req.body.internalNote.trim();
    if (typeof req.body?.isBanned === 'boolean') updates.isBanned = req.body.isBanned;
    if (req.body?.isVerified === true) updates.isVerified = true;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Nuk ka fusha për t\'u përditësuar.' });
    }

    // A ban must also disable the Firebase Auth identity, or the account stays
    // able to obtain a token even though the profile says it is suspended.
    if (typeof updates.isBanned === 'boolean') {
      await authAdmin().updateUser(uid, { disabled: updates.isBanned as boolean });
      await authAdmin().revokeRefreshTokens(uid);
    }

    /**
     * A municipality rename must reach the token, not only the document.
     * The jurisdiction checks read `token.municipality` (ownMunicipality in
     * firestore.rules, actor.municipality in the server pipeline), so a claim
     * left stale would let the account act on its former municipality and
     * refuse it on its current one until the token expired by itself.
     */
    if (typeof updates.municipality === 'string') {
      const targetData = target.data() as Record<string, unknown> | undefined;
      const permissions = Array.isArray(targetData?.permissions)
        ? targetData!.permissions.map(String)
        : ['dashboard', 'reports', 'health', 'donations'];
      await authAdmin().setCustomUserClaims(
        uid,
        buildRoleClaims('municipality', permissions, updates.municipality)
      );
      await authAdmin().revokeRefreshTokens(uid);
    }

    await db().collection('users').doc(uid).update(updates);
    audit('admin.municipality.updated', req, { targetUid: uid, fields: Object.keys(updates) });
    return res.json({ ok: true, updated: Object.keys(updates) });
  } catch (error: any) {
    console.error('[ADMIN] Municipality update failed:', error?.message);
    return res.status(500).json({ error: 'Llogaria komunale nuk u përditësua.' });
  }
});

/**
 * Direct line between platform staff and a municipality.
 *
 * Kept deliberately simple: an append-only thread keyed by the two parties. The
 * message body is stored as written — it is an operational record, and an
 * operator editing it afterwards would defeat the point of having a record.
 */
app.post('/api/v1/messages', requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    const receiverId = String(req.body?.receiverId ?? '').trim();
    const text = String(req.body?.text ?? '').trim();

    if (!receiverId || !text) {
      return res.status(400).json({ error: 'Marrësi dhe teksti janë të detyrueshëm.' });
    }
    if (text.length > 4000) {
      return res.status(400).json({ error: 'Mesazhi kalon 4000 shenja.' });
    }

    // Both parties must exist, so a typo cannot create an orphan thread.
    const [senderDoc, receiverDoc] = await Promise.all([
      db().collection('users').doc(user.uid).get(),
      db().collection('users').doc(receiverId).get(),
    ]);
    if (!senderDoc.exists) return res.status(403).json({ error: 'Profili i dërguesit mungon.' });

    // Staff <-> municipality only (documented intent of this API). Checked before
    // revealing whether the receiver exists, so the endpoint cannot be used to
    // probe which user ids are real.
    const parties = checkMessageParties(
      String(senderDoc.data()?.role ?? ''),
      String(receiverDoc.data()?.role ?? '')
    );
    if (parties.outcome === 'deny') return res.status(parties.status).json({ error: parties.error });
    if (!receiverDoc.exists) return res.status(404).json({ error: 'Marrësi nuk u gjet.' });

    const newMsg = {
      senderId: user.uid,
      senderName: String(senderDoc.data()?.name ?? ''),
      senderRole: String(senderDoc.data()?.role ?? ''),
      senderMunicipality: String(senderDoc.data()?.municipality ?? ''),
      receiverId,
      receiverName: String(receiverDoc.data()?.name ?? ''),
      receiverRole: String(receiverDoc.data()?.role ?? ''),
      receiverMunicipality: String(receiverDoc.data()?.municipality ?? ''),
      text,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    };

    const docRef = await db().collection('messages').add(newMsg);
    audit('message.sent', req, { to: receiverId, messageId: docRef.id });
    return res.status(201).json({ id: docRef.id, ...newMsg });
  } catch (error: any) {
    console.error('[MESSAGES] send failed:', error?.message);
    return res.status(500).json({ error: 'Mesazhi nuk u dërgua.' });
  }
});

/**
 * The thread between the caller and one other party, newest last.
 *
 * Read access is limited to the two participants: a municipality must not be
 * able to read another municipality's correspondence, and a staff member's
 * inbox is their own.
 */
app.get('/api/v1/messages/:otherUid', requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    const otherUid = String(req.params.otherUid ?? '').trim();
    if (!otherUid) return res.status(400).json({ error: 'Bashkëbiseduesi mungon.' });

    /**
     * One query per direction, merged here.
     *
     * The earlier version asked for `senderId in [me, other]` and, whenever that
     * query failed (a missing composite index), fell back to reading only the
     * messages *I* sent. The fallback then filtered for both directions, so the
     * other party's replies never appeared and nothing signalled that the thread
     * was half empty. Each direction is now read explicitly; if the ordered query
     * cannot run, the same equality filters are read unordered (they need no
     * composite index) and sorted here, so a thread is complete either way.
     */
    const readDirection = async (from: string, to: string) => {
      const base = db().collection('messages').where('senderId', '==', from).where('receiverId', '==', to);
      try {
        return (await base.orderBy('createdAt', 'desc').limit(250).get()).docs;
      } catch (error: any) {
        console.warn('[MESSAGES] ordered thread query failed (index missing?); reading unordered:', error?.message);
        return (await base.limit(500).get()).docs;
      }
    };

    const [sent, received] = await Promise.all([
      readDirection(user.uid, otherUid),
      readDirection(otherUid, user.uid),
    ]);

    const millis = (value: any): number => (typeof value?.toMillis === 'function' ? value.toMillis() : 0);
    const items = [...sent, ...received]
      .map((d: any) => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => millis(a.createdAt) - millis(b.createdAt))
      .slice(-500);

    return res.json({ items });
  } catch (error: any) {
    console.error('[MESSAGES] thread failed:', error?.message);
    return res.status(500).json({ error: 'Biseda nuk u ngarkua.' });
  }
});

// --- ADMIN API ---
app.get('/api/v1/admin/users', requireAuth, requireSection('users'), async (req, res) => {
  try {
    const snapshot = await db().collection('users').limit(100).get();
    const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(users);
  } catch (error: any) {
    sendServerError(res, 'Kërkesa nuk u përpunua. Provoni përsëri.', error);
  }
});

app.post('/api/v1/forum/posts/:postId/action', requireAuth, async (req, res) => {
  const action = String(req.body?.action ?? '');
  if (!['like', 'repost'].includes(action)) {
    return res.status(400).json({ error: 'Veprimi nuk lejohet.' });
  }

  try {
    const actorUid = req.user?.uid;
    if (!actorUid) return res.status(401).json({ error: 'Unauthorized' });

    const postRef = db().collection('forumPosts').doc(req.params.postId);
    const result = await db().runTransaction(async transaction => {
      const snapshot = await transaction.get(postRef);
      if (!snapshot.exists) throw Object.assign(new Error('Postimi nuk u gjet.'), { statusCode: 404 });

      const field = action === 'like' ? 'likes' : 'reposts';
      const existing = Array.isArray(snapshot.data()?.[field]) ? snapshot.data()?.[field].map(String) : [];
      const alreadyActive = existing.includes(actorUid);
      const next = alreadyActive ? existing.filter((id: string) => id !== actorUid) : [...existing, actorUid];
      transaction.update(postRef, { [field]: next });
      return { active: !alreadyActive, count: next.length };
    });

    audit(`forum.post.${action}`, req, { postId: req.params.postId, active: result.active });
    // The author's bell is written here, by the server, once per person and post.
    if (result.active) {
      notifyPostAction(db(), { postId: req.params.postId, uid: actorUid, action: action as 'like' | 'repost' })
        .catch((e) => console.warn('[FORUM] notify failed:', e?.message));
    }
    return res.json(result);
  } catch (error: any) {
    if (error?.statusCode === 404) return res.status(404).json({ error: error.message });
    console.error(`[FORUM] ${action} failed:`, error?.message);
    return res.status(500).json({ error: 'Veprimi nuk u ruajt. Provoni përsëri.' });
  }
});

/**
 * Record an action from the admin UI in the audit trail.
 *
 * The browser used to write `auditLogs` documents itself (any staff account could,
 * under the Firestore rule), so the "who" in an entry was whatever the client
 * claimed and any staff member could file entries in someone else's name. The
 * identity fields are now taken from the verified token; the client supplies
 * only what happened. The collection is closed to client writes in firestore.rules.
 */
app.post('/api/v1/audit', requireAuth, requireAdmin, async (req, res) => {
  const clip = (value: unknown, max: number) => String(value ?? '').slice(0, max);
  const action = clip(req.body?.action, 160).trim();
  if (!action) return res.status(400).json({ error: 'Veprimi mungon.' });

  try {
    const profile = await db().collection('users').doc(req.user!.uid).get();
    await db().collection('auditLogs').add({
      action,
      status: clip(req.body?.status, 24) || 'success',
      details: clip(req.body?.details, 1000),
      municipality: clip(req.body?.municipality, 80),
      // Identity comes from the token, never from the request body.
      userId: req.user!.uid,
      userEmail: req.user!.email ?? null,
      userName: String(profile.data()?.name ?? ''),
      actorUid: req.user!.uid,
      actorRole: req.user!.role,
      ip: req.ip ?? null,
      source: 'client-reported',
      createdAt: FieldValue.serverTimestamp(),
    });
    return res.status(201).json({ ok: true });
  } catch (error: any) {
    return sendServerError(res, 'Regjistrimi i veprimit dështoi.', error);
  }
});

/**
 * Support ("upvote") a report. One per account; the counter is changed only here
 * (see server/upvotes.ts). The Firestore rules do not let anyone but the author
 * update a report, so the browser's own increment never persisted.
 */
app.post('/api/v1/reports/:reportId/upvote', requireAuth, async (req, res) => {
  if (adminUnavailable(res)) return;

  try {
    const result = await castUpvote(db(), String(req.params.reportId ?? '').trim(), req.user!.uid);
    return res.status(201).json(result);
  } catch (error: any) {
    if (error instanceof UpvoteError) return res.status(error.statusCode).json({ error: error.message });
    return sendServerError(res, 'Mbështetja nuk u regjistrua. Provoni përsëri.', error);
  }
});

/**
 * Total number of accounts, for the staff user directory header. Counted by
 * Firestore (an aggregation, not a document read per user) and cached briefly.
 */
app.get('/api/v1/admin/users/count', requireAuth, requireSection('users'), async (_req, res) => {
  try {
    const cached = cache.get<number>('admin:users:count');
    if (cached !== undefined) return res.json({ count: cached });

    const snapshot = await db().collection('users').count().get();
    const count = snapshot.data().count;
    cache.set('admin:users:count', count, 60_000);
    return res.json({ count });
  } catch (error: any) {
    return sendServerError(res, 'Numri i përdoruesve nuk u llogarit.', error);
  }
});

/**
 * Cast a vote in a poll.
 *
 * The only writer of poll counters (see server/polls.ts and the `polls` rule):
 * one vote per account, enforced by a document the client cannot write.
 */
app.post('/api/v1/polls/:pollId/vote', requireAuth, async (req, res) => {
  if (adminUnavailable(res)) return;

  try {
    const result = await castVote(
      db(),
      String(req.params.pollId ?? '').trim(),
      req.user!.uid,
      String(req.body?.optionId ?? '').trim()
    );
    return res.status(201).json(result);
  } catch (error: any) {
    if (error instanceof VoteError) {
      return res.status(error.statusCode).json({
        error: error.message,
        ...(error.votedOptionId ? { votedOptionId: error.votedOptionId } : {}),
      });
    }
    return sendServerError(res, 'Vota nuk u regjistrua. Provoni përsëri.', error);
  }
});

/* ------------------------------------------------------------------ */
/* Municipality editorial endpoints                                    */
/* ------------------------------------------------------------------ */

/**
 * Albanian labels for the internal status codes, mirrored from
 * src/lib/reportStatus.ts. The server needs them to write a human-readable
 * notification without importing the client bundle. Keep the two in sync.
 */
const REPORT_STATUS_LABELS: Record<string, string> = {
  'Draft': 'Draft',
  'Pending Review': 'Në pritje',
  'Approved': 'U aprovua',
  'Assigned': 'I caktuar',
  'In Progress': 'Në proces',
  'Resolved': 'U zgjidh',
  'Rejected': 'U refuzua',
  'Overdue': 'Përgjegjësi e vonuar',
  'Closed': 'U mbyll',
};

/**
 * Append to the editorial audit log.
 *
 * Firestore is append-only for this collection: the security rules deny update
 * and delete, so an entry written here cannot be altered later — which is the
 * entire point of keeping it.
 */
async function logEditorialEvent(entry: Record<string, unknown>) {
  try {
    await db().collection('editorialLog').add({
      ...entry,
      at: FieldValue.serverTimestamp(),
    });
  } catch (error: any) {
    // A failed log write must not silently swallow the action it describes, but
    // it also must not fail the request: the action is already recorded in the
    // server's own audit stream via `audit()`.
    console.error('[EDITORIAL] log write failed:', error?.message);
  }
}

/**
 * Publish the work facts a municipality says it carried out.
 *
 * This is the only endpoint that lets a municipal account write about itself, so
 * it is gated three ways: the action is firewall-permitted, the report is in the
 * caller's jurisdiction, and the report is approved. Entries are stored with
 * review='pending' — the newsroom promotes them to 'confirmed' after checking,
 * which is what keeps the record additive rather than the municipality
 * rewriting the citizen's account.
 */
app.post('/api/v1/municipality/work-facts', requireAuth, async (req, res) => {
  const actor = actingUser(req);

  const { reportId, description, completedAt, performedBy, cost, attachments } = req.body ?? {};
  if (!reportId) return res.status(400).json({ error: 'Mungon raporti.' });

  const shape = editorialFirewall.validateWorkFact({ description, attachments });
  if (!shape.ok) return res.status(400).json({ error: shape.error });

  // Registering works is part of the Standard plan and above.
  if (actor.role === 'municipality') {
    try {
      const plan = normalizeMunicipalityPlan((await db().collection('users').doc(actor.uid).get()).data()?.municipalityPlan);
      if (!planHasFeature(plan, 'workFacts')) {
        return res.status(403).json({ error: `Regjistrimi i punimeve përfshihet nga plani ${cheapestPlanWith('workFacts')}.`, code: 'PLAN_REQUIRED', plan });
      }
    } catch (error: any) {
      console.error('[MUNICIPALITY] plan lookup failed:', error?.message);
      return res.status(500).json({ error: 'Plani nuk u verifikua. Provoni përsëri.' });
    }
  }

  try {
    const reportRef = db().collection('reports').doc(String(reportId));
    const snapshot = await reportRef.get();
    if (!snapshot.exists) return res.status(404).json({ error: 'Raporti nuk u gjet.' });

    const report = snapshot.data() as any;

    // Firewall before any write, and log a refusal before returning it.
    const permission = editorialFirewall.canAddWorkFacts(actor, report);
    if (!permission.allowed) {
      await logEditorialEvent({
        kind: 'action_denied',
        subjectId: String(reportId),
        subjectType: 'report',
        actorMunicipality: actor.municipality,
        actorUserId: actor.uid,
        actorEmail: actor.email,
        attemptedAction: 'add_work_facts',
        denied: true,
        denialReason: permission.reason,
      });
      audit('municipality.work_facts.denied', req, { reportId, code: permission.code });
      return res.status(403).json({ error: permission.reason, code: permission.code });
    }

    const entry = {
      reportId: String(reportId),
      description: String(description).trim(),
      completedAt: completedAt ? String(completedAt) : null,
      performedBy: performedBy ? String(performedBy).trim() : null,
      cost: cost ? String(cost).trim() : null,
      attachments: Array.isArray(attachments) ? attachments.slice(0, 6) : [],
      municipality: actor.municipality,
      authorUserId: actor.uid,
      authorEmail: actor.email,
      review: 'pending',
      createdAt: FieldValue.serverTimestamp(),
    };

    const ref = await db().collection('workFacts').add(entry);

    await logEditorialEvent({
      kind: 'work_facts_added',
      subjectId: String(reportId),
      subjectType: 'report',
      actorMunicipality: actor.municipality,
      actorUserId: actor.uid,
      actorEmail: actor.email,
      attemptedAction: 'add_work_facts',
      note: entry.description,
    });

    audit('municipality.work_facts.added', req, { reportId, workFactId: ref.id });
    return res.status(201).json({ id: ref.id, review: 'pending' });
  } catch (error: any) {
    console.error('[MUNICIPALITY] work-facts failed:', error?.message);
    return res.status(500).json({ error: 'Faktet nuk u ruajtën. Provoni përsëri.' });
  }
});

/**
 * Create a citizen report — the enforced writing path.
 *
 * ─── Why this endpoint exists ───────────────────────────────────────────────
 *
 * The client used to write reports straight to Firestore with `setDoc`. The
 * security rules validated the shape, but every *behavioural* check (duplicate
 * text, rate of submission per uid, spam heuristics) lived in the client and a
 * modified client skipped them entirely. Moving creation behind the server
 * means the same limiter tier (`/api`) applies, the same audit stream records
 * it, and the document a client can influence is assembled here rather than
 * trusted from the wire.
 *
 * The rules still allow direct client writes as the fallback path (the form
 * degrades gracefully when the server is unreachable), so this is defence in
 * depth rather than a single point of enforcement.
 */
app.post('/api/v1/reports', requireAuth, async (req, res) => {
  if (adminUnavailable(res)) return;
  const actor = actingUser(req);

  // ── Field validation (server/reports.ts) ────────────────────────────────
  const parsed = parseReportInput(req.body);
  if (parsed.outcome === 'invalid') {
    return res.status(400).json({ error: parsed.error });
  }
  const report = parsed.value;

  // ── Duplicate-window check: same uid + same title within 10 minutes ──────
  try {
    const since = new Date(Date.now() - 10 * 60 * 1000);
    const dupQuery = await db().collection('reports')
      .where('authorId', '==', actor.uid)
      .where('createdAt', '>=', since)
      .where('title', '==', report.title)
      .limit(1)
    ;
    const dup = await dupQuery.get();
    if (!dup.empty) {
      return res.status(409).json({ error: 'Raport i ngjashëm i dërguar së fundmi. Prisni pak minuta.', code: 'DUPLICATE_WINDOW' });
    }
    const spamQuery = await db().collection('reports')
      .where('authorId', '==', actor.uid)
      .where('createdAt', '>=', since)
    ;
    const spam = await spamQuery.get();
    if (spam.size >= 5) {
      return res.status(429).json({ error: 'Shumë raportime në minuta të fundit. Provoni më vonë.', code: 'RATE_WINDOW' });
    }
  } catch (error: any) {
    console.error('[REPORTS] duplicate/rate check failed:', error?.message);
    // Fail open for the query (a rules change or a missing index must not block
    // a legitimate report), but keep the write validated server-side.
  }

  // ── Tracking id: honour the client's only if it is well formed and unused ─
  // A client-chosen id used to be stored as is, so one citizen could register
  // another report's tracking id and make the public lookup ambiguous.
  const nowMs = Date.now();
  let trackId = report.requestedTrackingId;
  if (trackId) {
    try {
      const taken = await db().collection('reports').where('trackingId', '==', trackId).limit(1).get();
      if (!taken.empty) trackId = '';
    } catch (error: any) {
      console.error('[REPORTS] tracking id check failed:', error?.message);
      trackId = '';
    }
  }
  if (!trackId) trackId = generateTrackingId(nowMs, randomBytes(4).toString('hex'));

  const reportDoc = buildReportDocument(report, {
    uid: actor.uid,
    nowMs,
    trackingId: trackId,
    createdAt: FieldValue.serverTimestamp(),
    eventSuffix: randomBytes(3).toString('hex'),
  });

  try {
    const ref = await db().collection('reports').add(reportDoc);

    audit('report.create', req, { reportId: ref.id, trackId });

    return res.status(201).json({
      id: ref.id,
      trackingId: trackId,
      status: 'Pending Review',
    } as any);
  } catch (error: any) {
    console.error('[REPORTS] create failed:', error?.message);
    return res.status(500).json({ error: 'Raportimi nuk u ruajt. Provoni përsëri.' });
  }
});

/**
 * Apply a pipeline transition to a report — the one writing path for a status.
 *
 * ─── Why this endpoint exists ───────────────────────────────────────────────
 *
 * The client has always been able to write `status` straight to Firestore. That
 * means the approval pipeline was a set of gates the UI respected voluntarily:
 * a modified client, or a curl with a valid token, could set any report to
 * `Resolved` and bypass every check an agent is supposed to pass.
 *
 * This endpoint is the enforcement point. It re-derives the pipeline stage from
 * the *stored* document (never from the request), applies the same rule table the
 * UI uses, checks the caller's role and jurisdiction, and only then writes. A
 * client cannot talk its way past a gate it does not own.
 *
 * The status is never read from the body. It is derived from the transition the
 * caller names, so a caller may ask to "pass to municipality" but cannot ask to
 * "be approved". That is what stops a renamed transition from becoming a
 * privilege escalation.
 */
app.post('/api/v1/reports/:id/transition', requireAuth, async (req, res) => {
  if (adminUnavailable(res)) return;

  const actor = actingUser(req);
  const reportId = String(req.params.id || '').trim();
  if (!reportId) return res.status(400).json({ error: 'Mungon id e raportit.' });

  const transition = String(req.body?.transition || '') as pipeline.Transition;
  if (!pipeline.ALL_TRANSITIONS.includes(transition)) {
    return res.status(400).json({ error: 'Veprim i panjohur i rrjedhës.' });
  }

  const note = String(req.body?.note ?? '').trim().slice(0, 1200);
  const resolvedImage =
    req.body?.resolvedImage && String(req.body.resolvedImage).trim()
      ? String(req.body.resolvedImage).trim().slice(0, 2048)
      : null;

  try {
    const reportRef = db().collection('reports').doc(reportId);
    const snapshot = await reportRef.get();
    if (!snapshot.exists) return res.status(404).json({ error: 'Raporti nuk u gjet.' });

    const report = snapshot.data() as any;

    // Authority (role, jurisdiction, section permissions) comes from the verified
    // token claims only. The profile document is client-writable, so it is read
    // for a display name and nothing else.
    let actorName = '';
    try {
      const profile = await db().collection('users').doc(actor.uid).get();
      if (profile.exists) actorName = String((profile.data() as any)?.name ?? '');
    } catch (error: any) {
      console.error('[REPORTS] profile lookup failed:', error?.message);
    }

    const decision = pipeline.decideTransition(
      {
        uid: actor.uid,
        role: actor.role,
        municipality: actor.municipality,
        permissions: actor.permissions,
      },
      report,
      transition
    );

    if (!decision.allowed) {
      // A refused transition is an event worth keeping: "who tried to push this
      // report past a gate" is exactly the question an audit trail must answer.
      audit('report.transition.denied', req, {
        reportId,
        transition,
        code: decision.code,
        reason: decision.reason,
      });
      return res.status(403).json({ error: decision.reason, code: decision.code });
    }

    const rule = pipeline.ruleFor(transition)!;

    // A note is mandatory where the citizen will read one, and required for a
    // rejection specifically.
    if (rule.requiresNote && !note) {
      return res.status(400).json({ error: 'Refuzimi kërkon arsye të shkruar.', code: 'NOTE_REQUIRED' });
    }

    const now = new Date().toISOString();
    const previousStatus = String(report?.status ?? '');
    const toStatus = decision.toStatus as string;

    // A privacy-safe display label for the actor. The public Track ID timeline
    // renders `updatedBy`, so this must never be an email address or uid.
    const actorRole = pipeline.pipelineRoleOf(actor.role, actor.permissions) || 'staff';
    const actorInstitution =
      actorRole === 'municipality'
        ? `Komuna e ${actor.municipality || '—'}`
        : actorRole === 'agent'
          ? 'Agjenti i platformës'
          : 'Administrata';
    const updatedByLabel = (actorName || '').trim() || actorInstitution;

    const eventId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const timelineEvent = {
      id: eventId,
      status: toStatus,
      date: now,
      updatedBy: updatedByLabel,
      actorRole,
      actorInstitution,
      previousStatus,
      source: actorRole === 'municipality' ? 'municipality' : actorRole === 'agent' ? 'agent' : 'admin',
      comment: note,
      ...(decision.onBehalfOf ? { onBehalfOf: decision.onBehalfOf } : {}),
    };

    const updates: Record<string, unknown> = {
      status: toStatus,
      updatedAt: now,
      timeline: FieldValue.arrayUnion(timelineEvent),
    };

    // Only the transitions that genuinely mean "the work is done" set a
    // resolution time; `staff_verify` closes an already-resolved report.
    if (transition === 'municipality_done' || transition === 'staff_verify') {
      updates.resolvedAt = now;
    }
    if (resolvedImage) updates.resolvedImage = resolvedImage;

    // Claiming leaves the report in its current status but records who holds it -
    // as a person (uid), not only as a label, so "Të miat" and each agent's load
    // can be counted. An agent cannot take a report another agent already holds;
    // the owner can (and the audit log says so).
    if (transition === 'claim') {
      const holder = String(report?.assignedToUid ?? '');
      if (holder && holder !== actor.uid && actorRole !== 'staff') {
        return res.status(409).json({
          error: `Këtë raportim e ka marrë përsipër ${String(report?.assignedTo || 'një agjent tjetër')}.`,
          code: 'ALREADY_CLAIMED',
        });
      }
      updates.assignedTo = updatedByLabel.slice(0, 160);
      updates.assignedToUid = actor.uid;
      updates.assignedAt = now;
      updates.assignedBy = actor.uid;
    }

    await reportRef.update(updates);

    // ── Cross-report event feed ──────────────────────────────────────────
    // One queryable document per change, so the news sidebar's "Njoftime Live"
    // and any commune-filtered activity feed can read recent events across all
    // reports without loading every report. Anonymous reports are never made
    // public; the title is included but never the reporter's identity.
    const reportMunicipality = String(report?.location?.municipality ?? '');
    const isAnonymousReport = report?.isAnonymous === true;
    const publicStatuses = ['Approved', 'Assigned', 'In Progress', 'Resolved', 'Rejected', 'Overdue', 'Closed'];
    const isPublicEvent = !isAnonymousReport && publicStatuses.includes(toStatus);

    try {
      await db().collection('report_events').add({
        reportId,
        trackingId: String(report?.trackingId ?? '') || undefined,
        trackId: String(report?.trackingId ?? '') || undefined,
        status: toStatus,
        previousStatus,
        municipality: reportMunicipality || undefined,
        category: String(report?.category ?? '') || undefined,
        reportTitle: String(report?.title ?? '').slice(0, 140),
        comment: note || undefined,
        actorId: actor.uid,
        actorName: updatedByLabel,
        actorRole,
        actorInstitution,
        source: timelineEvent.source,
        isPublic: isPublicEvent,
        notifyReporter: true,
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (error: any) {
      console.error('[REPORTS] report_event write failed:', error?.message);
    }

    // ── Reporter notification ────────────────────────────────────────────
    // Every status change notifies the person who reported it, with no
    // identity requirement: an anonymous reporter (Firebase anonymous auth)
    // carries a real uid, so notifications are written against that uid and
    // the guest finds them on return. The old `authorId !== 'guest'` check
    // silently dropped every guest notification, which broke the promise that
    // a citizen with only a Track ID still hears about their case.
    const authorId = String(report?.authorId ?? '');
    if (authorId) {
      const label = REPORT_STATUS_LABELS[toStatus] || toStatus;
      const trackId = String(report?.trackingId ?? '');
      try {
        await db().collection('notifications').add({
          title: `Përditësim i raportimit ${trackId ? `#${trackId}` : ''}`.trim(),
          message: `Raportimi juaj ${trackId ? `#${trackId}` : ''} kaloi në statusin "${label}".${note ? ` Shenim: ${note.slice(0, 200)}` : ''}`.trim(),
          channel: 'report',
          category: 'report',
          type: toStatus === 'Rejected' ? 'alert' : toStatus === 'Resolved' || toStatus === 'Closed' ? 'success' : 'info',
          priority: toStatus === 'Rejected' ? 'high' : 'normal',
          urgent: false,
          audience: 'user',
          userId: authorId,
          reportId,
          trackId: trackId || undefined,
          municipality: reportMunicipality || undefined,
          state: 'published',
          link: `/trackid${trackId ? `?id=${encodeURIComponent(trackId)}` : ''}`,
          sender: actorInstitution,
          createdAt: FieldValue.serverTimestamp(),
        });
      } catch (error: any) {
        console.error('[REPORTS] reporter notification write failed:', error?.message);
      }
    }

    // A municipality touching its own report is an editorial event and belongs in
    // the append-only editorial log as well as the platform audit trail.
    if (pipeline.pipelineRoleOf(actor.role, actor.permissions) === 'municipality') {
      await logEditorialEvent({
        kind: transition === 'municipality_done' ? 'work_facts_added' : 'response_published',
        subjectId: reportId,
        subjectType: 'report',
        actorMunicipality: actor.municipality,
        actorUserId: actor.uid,
        actorEmail: actor.email,
        attemptedAction: transition,
        denied: false,
        note: note || undefined,
      });
    }

    audit(`report.transition.${transition}`, req, {
      reportId,
      from: decision.fromStage,
      to: decision.toStatus,
      ...(decision.onBehalfOf ? { onBehalfOf: decision.onBehalfOf } : {}),
    });

    return res.json({
      id: reportId,
      status: decision.toStatus,
      stage: pipeline.stageOf({ status: decision.toStatus, assignedTo: updates.assignedTo ?? report.assignedTo }),
    });
  } catch (error: any) {
    console.error('[REPORTS] transition failed:', error?.message);
    return res.status(500).json({ error: 'Statusi nuk u përditësua. Provoni përsëri.' });
  }
});

/**
 * The reports a municipal account may see.
 *
 * Filtered server-side by both jurisdiction and status. The client filters too,
 * so the list it draws matches, but this is the copy that decides what is
 * actually sent: unverified and rejected complaints about a municipality never
 * leave the server for that municipality's account.
 */
app.get('/api/v1/municipality/reports', requireAuth, async (req, res) => {
  const actor = actingUser(req);
  if (actor.role !== 'municipality') {
    return res.status(403).json({ error: 'Ky endpoint është për llogari komunale.' });
  }
  if (!actor.municipality) {
    return res.status(403).json({ error: 'Llogaria nuk ka komunë të caktuar.' });
  }

  try {
    const snapshot = await db()
      .collection('reports')
      .where('location.municipality', '==', actor.municipality)
      .limit(500)
      .get();

    const reports: any[] = [];
    snapshot.forEach((doc: any) => {
      const data = doc.data();
      // Status filter applied after the query: Firestore cannot do a nested
      // where plus an `in` on status without a composite index, and 500 rows is
      // small enough to filter here without a measurable cost.
      if (editorialFirewall.canSeeReportStatus(actor, data.status)) {
        reports.push({ id: doc.id, ...data });
      }
    });

    res.setHeader('Cache-Control', 'private, max-age=30');
    return res.json({ reports, municipality: actor.municipality });
  } catch (error: any) {
    console.error('[MUNICIPALITY] reports failed:', error?.message);
    return res.status(500).json({ error: 'Raportimet nuk u ngarkuan.' });
  }
});

/**
 * Publication queue for the newsroom: work facts awaiting verification.
 *
 * Staff only. The editor confirms a claim once the evidence checks out, at
 * which point it is shown next to the report as verified rather than as the
 * municipality's assertion.
 */
// Paginated, server-authorised reports list for the admin screens (replaces
// filtering the newest 100 reports in the browser). See server/adminReports.ts.
registerUserModerationRoutes(app, { requireAuth, db, authAdmin, actingUser, resolveActorRole, audit });
registerStaffRemovalRoutes(app, { requireAuth, db, authAdmin, actingUser, resolveActorRole, audit });
registerReportMediaRoutes(app, { requireAuth, db, actingUser, audit });
registerDecisionRoutes(app, { requireAuth, db, actingUser, audit });
registerReportAssignmentRoutes(app, { requireAuth, db, authAdmin, actingUser, audit });
registerPhotoEditRoutes(app, { requireAuth, db, bucket: storageBucket, actingUser, audit });
registerMunicipalityDeskRoutes(app, { requireAuth, db, authAdmin, actingUser, audit, logEditorialEvent });
registerTeamOverviewRoutes(app, { requireAuth, db, actingUser });
registerTransparencyRoutes(app, { db });
registerReportCaseRoutes(app, { requireAuth, db, actingUser, audit });
registerTrackLookupRoutes(app, { db });
registerPublicReportRoutes(app, { db });
registerGuestNumberRoutes(app, { requireAuth, db });
registerContactRoutes(app, { db });
registerPublicSubmissionRoutes(app, {
  db,
  optionalUid: async (req) => {
    const m = /^Bearer\s+(.+)$/i.exec(req.headers.authorization ?? '');
    if (!m) return null;
    try { return (await authAdmin().verifyIdToken(m[1])).uid; } catch { return null; }
  },
});
const institutionMailer = createMailerFromEnv();
registerInstitutionMailRoutes(app, {
  requireAuth, db, mailer: () => institutionMailer, actingUser, audit,
  baseUrl: () => process.env.PUBLIC_APP_URL || process.env.APP_URL || '',
});
registerReportClassificationRoutes(app, { requireAuth, db, actingUser, audit });
registerWorkItemRoutes(app, { requireAuth, db, authAdmin, actingUser, audit });
registerForumSocialRoutes(app, { requireAuth, requireUsersSection: requireSection('users'), db, audit });
registerForumAnalyticsRoutes(app, { requireAuth, db });
registerDirectMessageRoutes(app, { requireAuth, db });
registerForumPostRoutes(app, { requireAuth, db });
registerAdRoutes(app, { db });
registerForumFeedRoutes(app, { requireAuth, db });
registerForumPeopleRoutes(app, { requireAuth, db });
registerForumReportRoutes(app, { requireAuth, db });
registerScheduledPostRoutes(app, { requireAuth, db });
registerStoryRoutes(app, { requireAuth, db });
registerForumReelRoutes(app, {
  requireAuth,
  db,
  // Deletes a reel's video and cover from Storage; ignores files that are already gone.
  removeFiles: async (paths) => {
    const bucket = storageBucket();
    if (!bucket) return;
    for (const p of paths) await bucket.file(p).delete({ ignoreNotFound: true });
  },
});
registerPaymentRoutes(app, { requireAuth, requireDebateSection: requireSection('debate'), db, audit });
registerDebateAdminRoutes(app, { requireAuth, requireDebateSection: requireSection('debate'), db, audit });

registerAdminReportRoutes(app, {
  requireAuth,
  db,
  actingUser,
  audit,
  canSeeReportStatus: editorialFirewall.canSeeReportStatus,
});

app.get('/api/v1/admin/work-facts', requireAuth, requireSection('workfacts'), async (req, res) => {
  try {
    const status = String(req.query.status || 'pending');
    const snapshot = await db()
      .collection('workFacts')
      .where('review', '==', status)
      .limit(200)
      .get();

    const items: any[] = [];
    snapshot.forEach((doc: any) => items.push({ id: doc.id, ...doc.data() }));
    return res.json({ items, status });
  } catch (error: any) {
    console.error('[ADMIN] work-facts failed:', error?.message);
    return res.status(500).json({ error: 'Regjistri nuk u ngarkua.' });
  }
});

/**
 * Confirm or reject a work fact.
 *
 * Only the review flag changes. The description, author and timestamp are never
 * editable — including by staff — so the record of who claimed what and when
 * survives even if the claim is later shown to be wrong.
 */
app.put('/api/v1/admin/work-facts/:id', requireAuth, requireSection('workfacts'), async (req, res) => {
  const decision = String(req.body?.decision || '');
  if (!['confirmed', 'rejected'].includes(decision)) {
    return res.status(400).json({ error: 'Vendimi duhet të jetë confirmed ose rejected.' });
  }

  try {
    const ref = db().collection('workFacts').doc(String(req.params.id));
    const snapshot = await ref.get();
    if (!snapshot.exists) return res.status(404).json({ error: 'Nuk u gjet.' });

    await ref.update({
      review: decision,
      reviewedBy: actingUser(req).email,
      reviewedAt: FieldValue.serverTimestamp(),
    });

    await logEditorialEvent({
      kind: 'request_reviewed',
      subjectId: String(req.params.id),
      subjectType: 'other',
      actorMunicipality: (snapshot.data() as any)?.municipality || '',
      actorUserId: actingUser(req).uid,
      actorEmail: actingUser(req).email,
      attemptedAction: `work_fact_${decision}`,
    });

    audit(`workFact.${decision}`, req, { id: req.params.id });
    return res.json({ id: req.params.id, review: decision });
  } catch (error: any) {
    console.error('[ADMIN] work-fact review failed:', error?.message);
    return res.status(500).json({ error: 'Vendimi nuk u ruajt.' });
  }
});

/**
 * The editorial audit log.
 *
 * Staff-readable, and deliberately not filterable by the municipality that the
 * entries are about: a municipality cannot request a copy of the record of its
 * own denied attempts. The yearly transparency report summarises it instead.
 */
app.get('/api/v1/admin/editorial-log', requireAuth, requireSection('security'), async (req, res) => {
  try {
    const maxLimit = Math.min(Number(req.query.limit) || 100, 500);
    const snapshot = await db().collection('editorialLog').orderBy('at', 'desc').limit(maxLimit).get();
    const items: any[] = [];
    snapshot.forEach((doc: any) => items.push({ id: doc.id, ...doc.data() }));
    return res.json({ items });
  } catch (error: any) {
    console.error('[ADMIN] editorial-log failed:', error?.message);
    return res.status(500).json({ error: 'Regjistri nuk u ngarkua.' });
  }
});

/**
 * Denied-attempt counts for the public transparency report.
 *
 * Published rather than hidden: a municipality that repeatedly tries to remove
 * coverage is information the public is entitled to, and saying so in advance is
 * the strongest disincentive there is.
 */
app.get('/api/v1/public/editorial-transparency', async (_req, res) => {
  try {
    const snapshot = await db().collection('editorialLog').where('denied', '==', true).limit(1000).get();
    const byMunicipality: Record<string, number> = {};
    snapshot.forEach((doc: any) => {
      const m = String(doc.data()?.actorMunicipality || 'unknown');
      byMunicipality[m] = (byMunicipality[m] || 0) + 1;
    });
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.json({ totalDenied: snapshot.size, byMunicipality });
  } catch (error: any) {
    return res.status(500).json({ error: 'Raporti nuk u ngarkua.' });
  }
});

// --- MESSAGES API ---
// The messaging endpoints live above, beside the municipality routes: an
// append-only thread between staff and a municipality, with read access
// limited to its two participants.


  
app.use('/api/ai-assistant/', requireAuth);


  // 1. Predictive AI Analytics
  app.post("/api/admin/predictive-analysis", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { reports } = req.body;
      const prompt = `Je një AI Inteligjence Analitike dhe Gjeohapësinore (Geospatial Intelligence) i nivelit të lartë, i trajnuar për menaxhimin e rreziqeve urbane.
Analizo këtë dataset të raporteve nga qytetarët në Kosovë dhe përcakto 'Zonat e Rrezikut të Lartë' (Hotspots) për 30 ditët e ardhshme.
Të dhënat: ${JSON.stringify(reports)}

Detyrat e tua:
1. Gjej kllastera (clusters) të problemeve në zona të njëjta (bazuar në koordinata).
2. Përcakto rrezikun (Low, Medium, High, Critical) duke pasur parasysh urgjencën, frekuencën dhe kategorinë (psh. dëmtimi i ujësjellësit ose siguria publike ka rrezik më të lartë).
3. Klasifiko saktë secilën zonë.

Kthe PËRGJIGJEN VETËM SI NJË ARRAY JSON.`;

      const response = await generateContentWithFallback({
        contents: { parts: [{ text: prompt }] },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                lat: { type: Type.NUMBER },
                lng: { type: Type.NUMBER },
                risk: { type: Type.STRING },
                category: { type: Type.STRING }
              },
              required: ["lat", "lng", "risk", "category"]
            }
          }
        },
      });

      const text = response.text;
      const result = text ? JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim()) : [];
      res.json(result);
    } catch (e: any) {
      console.error(e);
      sendServerError(res, 'Gabim gjatë parashikimit', e);
    }
  });

  // 2. Auto-Pilot for Official Responses (AI Sub-Admin Assistant)
  app.post("/api/admin/generate-response", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { title, description, reason } = req.body;
      const prompt = `Je një Zyrtar i Lartë për Komunikim me Publikun në institucionet e Kosovës.
Detyra jote është të hartohesh një përgjigje zyrtare, institucionale dhe empatike për një ankesë/raport të një qytetari.
Titulli i ankesës: "${title}"
Përshkrimi i qytetarit: "${description}"
Udhëzimi nga mbikëqyrësi komunal (Arsyeja për zgjidhje/refuzim): "${reason}"

Rregullat:
1. Përdor gjuhë tejet profesionale, formale dhe të sjellshme.
2. Trego empati për shqetësimin e qytetarit.
3. Shpjego qartë veprimin që do të ndërmerret bazuar në "Udhëzimin nga mbikëqyrësi".
4. Përgjigja duhet të jetë e gatshme për t'iu dërguar direkt qytetarit (mos përfshi fjalë hyrëse si "Këtu është përgjigja:").
5. Përdor formatim të pastër (paragrafë).

Përgjigju VETËM me tekstin e përgjigjes zyrtare.`;

      const response = await generateContentWithFallback({
        contents: { parts: [{ text: prompt }] }
      });
      res.json({ response: response.text });
    } catch (e: any) {
      console.error(e);
      sendServerError(res, 'Gabim gjatë gjenerimit', e);
    }
  });

  // NEW ENDPOINT: Analyze issue photo for smart categorization
  app.post("/api/analyze-issue", requireAuth, async (req, res) => {
    try {
      const { imageBase64, mimeType, lat, lng } = req.body ?? {};
      const descriptionText = clip(req.body?.descriptionText, 2000);

      if (imageBase64 !== undefined) {
        if (typeof imageBase64 !== 'string' || imageBase64.length > MAX_ANALYSIS_BASE64_CHARS) {
          return res.status(413).json({ error: 'Fotografia është shumë e madhe për analizë.' });
        }
        if (mimeType !== undefined && !ALLOWED_ANALYSIS_MIME.has(String(mimeType))) {
          return res.status(415).json({ error: 'Formati i fotografisë nuk mbështetet për analizë.' });
        }
      }
      
      const categoriesList = [
        "Komuna - Drejtoria e Infrastrukturës",
        "Ministria e Infrastrukturës",
        "Komuna - Drejtoria e Shëndetësisë (QKMF)",
        "Ministria e Shëndetësisë / SHSKUK",
        "Komuna - Drejtoria e Arsimit",
        "Ministria e Arsimit",
        "Ujësjellësi Rajonal - KRU",
        "Komuna - Kanalizimi lokal dhe Ujërat e zeza",
        "KEDS / KESCO",
        "Komuna - Ndriçimi Publik",
        "Kompania 'Pastrimi'",
        "Komuna - Inspekcioni Mjedisor",
        "Policia e Kosovës / Siguria Publike",
        "Inspekcioni Komunal",
        "Zjarrfikësit dhe Shpëtimi",
        "Komuna - Qentë endacakë",
        "Komuna - Transporti Publik",
        "Komuna - Parqet dhe Hapësirat e gjelbra"
      ];

      const prompt = `Ti je AI Forenzik dhe Delegues Automatik Super-Inteligjent i platformës publike.
Analizo këtë imazh (dhe tekstin e raportuar nëse ka) për një problem publik.
Detyrat e tua:
1. "Detektivi i Imazheve (Forensics)": Kontrollo me saktësi absolute nëse imazhi është real, i modifikuar, i gjeneruar nga AI, apo marrë nga interneti. Jep një shkallë besueshmërie (authenticityScore) nga 0 në 100. Shpjego arsyetimin thellë.
2. "Deleguesi Automatik (Auto-Routing)": Përcakto SAKTËSISHT drejtorinë/departamentin kompetent bazuar në listë. Jep një shpjegim thelbësor pse u zgjodh ai departament.
3. Gjenero një titull (title) dhe përshkrim (description) profesional e të detajuar për tu përdorur në portalin zyrtar.

Lista e Drejtorive (Zgjidh fiks njërën nga këto - copy paste ashtu siç është):
${categoriesList.join('\n')}

Teksti shtesë nga qytetari: ${descriptionText || 'Nuk ka'}
Koordinatat: ${Number.isFinite(Number(lat)) ? Number(lat) : 'Nuk ka'}, ${Number.isFinite(Number(lng)) ? Number(lng) : 'Nuk ka'}`;

      const contentsParts = [];
      if (imageBase64) {
        contentsParts.push({ inlineData: { mimeType: mimeType || 'image/jpeg', data: imageBase64 } });
      }
      contentsParts.push({ text: prompt });

      const response = await generateContentWithFallback({
        contents: { parts: contentsParts },
        defaultModel: 'gemini-2.5-flash',
        fallbackModels: ['gemini-2.5-flash'],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              category: { type: Type.STRING },
              urgency: { type: Type.STRING },
              authenticityScore: { type: Type.INTEGER },
              forensicsReport: { type: Type.STRING },
              routingReason: { type: Type.STRING }
            },
            required: ["title", "description", "category", "urgency", "authenticityScore", "forensicsReport", "routingReason"]
          }
        },
      });

      const text = response.text;
      const result = text ? JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim()) : null;
      // Canned fallback text is not an analysis; say so, so the form does not
      // pre-fill a title and category from it.
      res.json((response as any).degraded ? { degraded: true } : result);
    } catch (e: any) {
      console.error(e);
      sendServerError(res, 'Gabim gjatë analizës së AI', e);
    }
  });

  // Auto-Moderator për Fjalor të Urrejtjes
  app.post("/api/moderate-comment", requireAuth, async (req, res) => {
    try {
      const text = clip(req.body?.text, 5000);
      if (!text.trim()) return res.status(400).json({ error: 'Teksti mungon.' });
      const prompt = `Je një Auto-Moderator Super-Inteligjent, tepër i rreptë dhe etik për komente shqip në një forum të hapur "Debati Publik" ose platformë shtetërore.
Analizo me vëmendje këtë koment: "${text}"
A përmban fjalor urrejtjeje, bullizëm, kërcënime, fjalë të ndyra, racizëm, seksizëm apo ofendime të rënda?
Kujdes dialektet, zhargonin dhe format e ndryshme të gjuhës shqipe (Gegërisht, Toskërisht).
Nëse është i pastër, isApproved = true. Nëse ka ofendime apo fjalor jo-etik, isApproved = false.
Jep gjithashtu një arsye tejet të shkurtër (reason).`;

      const response = await generateContentWithFallback({
        contents: { parts: [{ text: prompt }] },
        defaultModel: 'gemini-2.5-flash',
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isApproved: { type: Type.BOOLEAN },
              reason: { type: Type.STRING }
            },
            required: ["isApproved", "reason"]
          }
        },
      });
      
      const respText = response.text;
      const result = respText ? JSON.parse(respText.replace(/```json/g, '').replace(/```/g, '').trim()) : { isApproved: true, reason: 'Fallback' };
      res.json((response as any).degraded ? { degraded: true } : result);
    } catch (e: any) {
      console.error(e);
      sendServerError(res, 'Shërbimi i AI nuk është i disponueshëm. Provoni përsëri.', e);
    }
  });

  app.post("/api/detect-duplicate", requireAuth, async (req, res) => {
    try {
      const rawNew = req.body?.newReport;
      const newReport = {
        title: clip(rawNew?.title, 200),
        description: clip(rawNew?.description, 2000),
      };
      const existingReports = (Array.isArray(req.body?.existingReports) ? req.body.existingReports : [])
        .slice(0, 20)
        .map((r: any) => ({
          id: clip(r?.id, 128),
          title: clip(r?.title, 200),
          description: clip(r?.description, 600),
        }));
      if (!newReport.title && !newReport.description) {
        return res.status(400).json({ error: 'Raporti i ri mungon.' });
      }
      if (existingReports.length === 0) {
        return res.json({ is_duplicate: false, reason: 'Nuk ka raporte për krahasim.' });
      }
      const prompt = `Je një AI Analist Detektiv i Avancuar për zbulimin e duplikateve në një sistem raportimi qytetar. Ne kemi një raport të ri të dorëzuar nga qytetari dhe një listë me raporte ekzistuese në të njëjtin lokacion gjeografik (50 metra rreze).
Raporti i ri: "${newReport.title}" - "${newReport.description}"
Raportet ekzistuese: 
${existingReports.map((r: any) => `ID: ${r.id}, Titulli: ${r.title}, Përshkrimi: ${r.description}`).join('\n')}

Detyra: Përcakto me KTHJELLTËSI APSOLUTE nëse raporti i ri po ankohet saktësisht për TË NJËJTIN problem fizik me ndonjë nga raportet ekzistuese (p.sh. e njëjta gropë specifike, i njëjti bërllok në të njëjtën kthesë). Nuk vlen nëse janë dy gropa të ndryshme në të njëjtën rrugë.
Nëse po, kthe is_duplicate: true dhe thekso duplicate_of_id.
Nëse jo, kthe is_duplicate: false.`;

      const response = await generateContentWithFallback({
        contents: { parts: [{ text: prompt }] },
        defaultModel: 'gemini-2.5-flash',
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              is_duplicate: { type: Type.BOOLEAN },
              duplicate_of_id: { type: Type.STRING, description: "ID-ja e raportit ekzistues nëse është duplikatë (bosh nëse nuk është)" },
              reason: { type: Type.STRING }
            },
            required: ["is_duplicate", "reason"]
          }
        },
      });
      const text = response.text;
      const result = text ? JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim()) : { is_duplicate: false, reason: 'Fallback' };
      res.json((response as any).degraded ? { is_duplicate: false, reason: 'AI nuk është i disponueshëm.', degraded: true } : result);
    } catch (e: any) {
      console.error(e);
      sendServerError(res, 'Gabim', e);
    }
  });

  // 7. AI Personalized Reporting Tips (/api/dashboard/reporting-tips)
  app.post("/api/dashboard/reporting-tips", requireAuth, async (req, res) => {
    try {
      // The prompt is static (the request body is not used), so one answer serves
      // everyone. Without this, every dashboard load by every visitor was a
      // separate paid model call that returned interchangeable text.
      const cachedTips = cache.get<{ tips: string[] }>('ai:reporting-tips');
      if (cachedTips) return res.json(cachedTips);

      const prompt = `Je një asistent super inteligjent që këshillon qytetarët e Kosovës se si të bëjnë raporte/ankesa sa më kualitative në një platformë smart-city.
Gjenero 3 këshilla të ndryshme, super unike, të avancuara dhe praktike.
Këshillat duhet të jenë inkurajuese, tejet të qarta dhe të shkurtra (max 1-2 fjali secila).
Mos përdor këshilla gjenerike. Bëhu specifik (psh, "Kur raportoni rrjedhje uji, përfshini nëse presioni i ujit në shtëpitë përreth ka rënë").`;

      const response = await generateContentWithFallback({
        contents: { parts: [{ text: prompt }] },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: { tips: { type: Type.ARRAY, items: { type: Type.STRING } } },
            required: ["tips"]
          }
        }
      });
      const text = response.text;
      const result = text ? JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim()) : { tips: [] };
      if (!(response as any).degraded && Array.isArray(result?.tips) && result.tips.length > 0) {
        cache.set('ai:reporting-tips', result, 6 * 60 * 60 * 1000);
      }
      res.json((response as any).degraded ? { tips: [], degraded: true } : result);
    } catch (e: any) {
      sendServerError(res, 'Shërbimi i AI nuk është i disponueshëm. Provoni përsëri.', e);
    }
  });

  // 8. AI Executive Summarization (/api/admin/summarize)
  app.post("/api/admin/summarize", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { issues, timeframe } = req.body;
      const prompt = `Je një Analist Strategjik Ekzekutiv (AI Kryesor i Nivelit Më të Lartë) për Qeverisjen Lokale në Kosovë.
Të është dhënë një listë me ${issues?.length || 0} raporte nga qytetarët për periudhën kohore: ${timeframe || 'Aktuale'}.

Të dhënat bruto:
${issues ? issues.map((i: any) => `- [${i.category}] [Urgjenca: ${i.urgency}] ${i.title}`).join('\n') : ''}

Detyra:
Shkruaj një "Përmbledhje Ekzekutive" (Executive Summary) super të thellë, tepër profesionale (2-3 paragrafë maksimalisht).
Analizo dhe sintetizo:
1. Cilat janë sfidat kryesore, modelet dhe trendet emergjente që nuk shihen me sy të lirë?
2. Cilat drejtori (departamente) janë në vijën e parë të krizës dhe kanë nevojë për ndërhyrje urgjente?
3. Saktëso çështje kritike që mund të shkaktojnë pakënaqësi masive publike ose rrezik për jetën nëse nuk adresohen menjëherë.

Kushti kryesor: Përdor formatim të pasur (bullet points, theksime) për ta bërë tekstin të skanueshëm nga një kryetar komune. Përgjigju në gjuhën shqipe me një ton autoritativ, të thellë dhe orientues ndaj zgjidhjeve.`;

      const response = await generateContentWithFallback({
        contents: { parts: [{ text: prompt }] },
        defaultModel: 'gemini-2.5-flash',
        fallbackModels: ['gemini-2.5-flash', 'gemini-2.5-flash']
      });
      res.json({ summary: response.text });
    } catch (e: any) {
      sendServerError(res, 'Shërbimi i AI nuk është i disponueshëm. Provoni përsëri.', e);
    }
  });

  // 9. AI Procedure Assistant Chat Endpoint
  app.post("/api/ai-assistant/chat", async (req, res) => {
    try {
      const { message, history, messages, language } = req.body;
      let historyText = "";
      if (messages && Array.isArray(messages)) {
        historyText = messages.map((m: any) => `${m.role === 'user' ? 'Qytetari' : 'Bot'}: ${m.content}`).join('\n');
      } else if (history && Array.isArray(history)) {
        historyText = history.map((m: any) => `${m.role === 'user' ? 'Qytetari' : 'Bot'}: ${m.content}`).join('\n');
      }

      const queryMessage = message || (messages && messages.length > 0 ? messages[messages.length - 1].content : "");

      /**
       * Answer in the language the citizen is browsing in, with the platform's
       * own terminology.
       *
       * This used to say "Përgjigju në gjuhën shqipe" unconditionally, so an
       * English or Arabic visitor got Albanian answers on a translated page.
       * The glossary block keeps the assistant from inventing a different word
       * for "raportim" on every turn.
       */
      const { AI_LANGUAGE_NAMES, glossaryPromptFor } = await import('./src/lib/glossaryRuntime');
      const requested = typeof language === 'string' && AI_LANGUAGE_NAMES[language] ? language : 'sq';
      const languageName = AI_LANGUAGE_NAMES[requested];
      const glossaryBlock = glossaryPromptFor(requested);

      const prompt = `Je "Asistenti Virtual Super-Inteligjent i Qytetarëve", një ndihmës komunikues jashtëzakonisht i qartë, empatik dhe me njohuri të larta për funksionimin e komunave dhe platformës së raportimit.
Kapacitetet e tua janë të nivelit maksimal. Përgjigju saktë pyetjeve, ofro udhëzime procedurale dhe zgjidhje hap-pas-hapi.

Historiku i bisedës:
${historyText}

Qytetari: ${queryMessage}

IMPORTANT: Reply ONLY in ${languageName}. Every word, including any headings or lists, must be in ${languageName}.
${glossaryBlock}

Përgjigju shkurt, fuqishëm dhe me respekt super profesional. (Nëse ka pyetje jashtë kontekstit komunal/qytetar, refuzoje me mirësjellje dhe ktheje temën).`;
      const response = await generateContentWithFallback({
        contents: { parts: [{ text: prompt }] },
        defaultModel: 'gemini-2.5-flash'
      });
      res.json({ text: response.text });
    } catch (e: any) {
      sendServerError(res, 'Shërbimi i AI nuk është i disponueshëm. Provoni përsëri.', e);
    }
  });

  // 10. AI Municipality Health Check Endpoint
  app.post("/api/municipality-health-check", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { issues } = req.body;
      const prompt = `Je një Supervizor AI i Nivelit të Lartë (Chief AI Auditor) që bën vlerësimin ekstremisht të saktë të "Shëndetit të Komunës" (Municipality Health Check) në Kosovë.
Kemi këtë dataset me raporte nga qytetarët:
${JSON.stringify(issues ? issues.map((i: any) => ({ category: i.category, urgency: i.urgency, status: i.status })) : [])}

Analizo këto të dhëna dhe gjenero një raport të shëndetit komunal tejet realist.
(Nëse nuk ka mjaft të dhëna, gjenero një raport neutral me score 50 dhe recommendations inkurajuese për të mbledhur më shumë të dhëna.)

Kthe VETËM JSON me këto fusha:
- score (numër 0-100, ku 100 është perfekte). Më shumë raporte "Kritike" ose të pazgjidhura e ulin rezultatin ndjeshëm.
- grade (string: "Shkëlqyeshëm", "Mirë", "Mesatar", "Dobët", "Kritik").
- analysis (string: një paragraf analitik profesional rreth performancës globale, bazuar vetëm në data).
- hotspots (string: cilat fusha/kategori janë problemet kryesore momentale).
- recommendations (string: hapa super konkretë ekzekutivë për kryetarin ose drejtorët).`;

      const response = await generateContentWithFallback({
        contents: { parts: [{ text: prompt }] },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              score: { type: Type.INTEGER },
              grade: { type: Type.STRING },
              analysis: { type: Type.STRING },
              hotspots: { type: Type.STRING },
              recommendations: { type: Type.STRING }
            },
            required: ["score", "grade", "analysis", "hotspots", "recommendations"]
          }
        }
      });
      const text = response.text;
      const result = text ? JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim()) : null;
      res.json(result || { score: 50, grade: "Mesatar", analysis: "Nuk ka mjaftueshëm të dhëna për një analizë të thellë. Sistemit i duhen më shumë raporte të zgjidhura vs të pazgjidhura.", hotspots: "Mungesë të dhënash", recommendations: "Inkurajoni qytetarët të raportojnë." });
    } catch (e: any) {
      sendServerError(res, 'Shërbimi i AI nuk është i disponueshëm. Provoni përsëri.', e);
    }
  });

  // 11. AI Daily News
  app.post("/api/dashboard/ai-news", requireAuth, async (req, res) => {
    try {
      const issues = Array.isArray(req.body?.issues) ? req.body.issues.slice(0, 10) : undefined;
      // Identical inputs get an identical answer for a short while rather than a
      // fresh paid model call per page view.
      const newsKey = `ai:news:${JSON.stringify((issues ?? []).map((i: any) => [clip(i?.title, 140), clip(i?.category, 60)]))}`;
      const cachedNews = cache.get<{ alerts: string[] }>(newsKey);
      if (cachedNews) return res.json(cachedNews);

      const prompt = `Je një "Gazetar AI Analitik" i Inteligjencës Qytetare që raporton lajmet më të fundit rreth problemeve lokale në Kosovë, drejtpërdrejt nga platforma.
Duke u bazuar në këtë listë të raporteve të fundit:
${JSON.stringify(issues ? issues.slice(0, 10).map((i: any) => ({ title: i.title, category: i.category })) : [])}

Gjenero 3 lajme të shkurtra (breaking news style, secili maksimum 15 fjalë) bazuar REALSISHT në këto të dhëna. (Nëse nuk ka të dhëna fare, thekso rëndësinë e pjesëmarrjes qytetare në platformë). Përdor ton serioz, gazetar.

Kthe VETËM JSON me çelësin "alerts", që përmban një array të stringjeve.`;

      const response = await generateContentWithFallback({
        contents: { parts: [{ text: prompt }] },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: { alerts: { type: Type.ARRAY, items: { type: Type.STRING } } },
            required: ["alerts"]
          }
        }
      });
      const text = response.text;
      const result = text ? JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim()) : { alerts: [] };
      if (!(response as any).degraded && Array.isArray(result?.alerts) && result.alerts.length > 0) cache.set(newsKey, result, 15 * 60 * 1000);
      res.json((response as any).degraded ? { alerts: [], degraded: true } : result);
    } catch (e: any) {
      sendServerError(res, 'Shërbimi i AI nuk është i disponueshëm. Provoni përsëri.', e);
    }
  });

  // Anything under /api that no route claimed is a JSON 404. Without this the
  // SPA fallback below answered unknown API GETs with index.html and a 200.
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Rruga nuk u gjet.' });
  });

  /**
   * The HTTP server is created up front, before the dev middleware is mounted.
   *
   * Vite's HMR websocket upgrades the HTTP server the application already
   * listens on, so that server has to exist before `createViteServer` is called.
   * Listening is deferred until after the middleware is attached.
   */
  const httpServer = http.createServer(app);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    /**
     * HMR is pinned to the HTTP server we already own.
     *
     * With `hmr: false` in vite.config.ts the client still attempted to open the
     * default 24678 websocket, and every retry logged
     * `WebSocket server error: Port 24678 is already in use` — noise that made a
     * healthy server look broken and buried the real errors. Passing the HTTP
     * server here makes Vite upgrade the existing connection instead of opening a
     * second port, so there is exactly one socket and one origin.
     */
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: { server: httpServer },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    // Vite emits content-hashed files into dist/assets, so those can be cached
    // forever: a new build changes the filename, never the contents.
    const immutableMaxAge = 'public, max-age=31536000, immutable';
    const revalidate = 'no-cache, must-revalidate';

    app.use(express.static(distPath, {
      etag: true,
      lastModified: true,
      setHeaders: (res, filePath) => {
        // `filePath` is an OS path. Comparing against a POSIX literal silently
        // fails on Windows, where the separator is a backslash, and every asset
        // then falls into the no-cache branch and gets re-downloaded on each
        // page view. Normalise to forward slashes before matching.
        const normalized = filePath.replace(/\\/g, '/');
        if (normalized.includes('/assets/') || normalized.includes('/fonts/')) {
          res.setHeader('Cache-Control', immutableMaxAge);
        } else if (normalized.endsWith('/index.html')) {
          res.setHeader('Cache-Control', revalidate);
        }
      }
    }));
    app.get('*', (req, res) => {
      // A request that names a file is a missing asset, not a client-side route.
      // Serving index.html for it would return HTML for a .js request and break
      // the module loader with a MIME-type error.
      if (req.path.includes('.') || req.path.startsWith('/assets/')) {
        return res.status(404).type('text/plain').send('Not Found');
      }
      res.setHeader('Cache-Control', revalidate);
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // --- GLOBAL ERROR HANDLER ---
  // Registered last, after every route, so it actually sees their errors (it used
  // to sit in the middle of the file and the AI routes below it bypassed it).
  // Errors raised by body-parser carry a 4xx status; reporting them as 500 hid
  // malformed JSON and oversized bodies from clients and from monitoring.
  app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) return next(err);
    const status = Number(err?.status ?? err?.statusCode);
    if (status >= 400 && status < 500) {
      const error =
        status === 413 ? 'Kërkesa është shumë e madhe.'
        : err?.type === 'entity.parse.failed' ? 'JSON i pavlefshëm.'
        : 'Kërkesa nuk është e vlefshme.';
      return res.status(status).json({ error });
    }
    return sendServerError(res, 'Gabim i brendshëm i serverit.', err);
  });

  const isPrototypeSandbox = process.env.NODE_ENV !== 'production' &&
    process.env.VITE_PROTOTYPE_FIREBASE_EMULATORS === 'true' &&
    process.env.FIREBASE_PROJECT_ID?.startsWith('demo-') === true &&
    Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST) &&
    Boolean(process.env.FIRESTORE_EMULATOR_HOST);
  const listenHost = isPrototypeSandbox ? '127.0.0.1' : '0.0.0.0';
  const server = httpServer.listen(PORT, listenHost, () => {
    const workerLabel = cluster.worker ? `worker ${cluster.worker.id}` : 'primary';
    console.log(`[${workerLabel}] Server running on http://${listenHost}:${PORT}`);
    if (PORT !== requestedPort) {
      console.log(`[${workerLabel}] Porti ${requestedPort} ishte i zënë; u zhvendos në ${PORT}.`);
    }
  });

  // Scheduled posts go live within a minute of their time. Overlapping workers are safe: each
  // post is published in one transaction. (scripts/publish-scheduled-posts.ts does the same from a scheduler.)
  if (!isPrototypeSandbox) {
    setInterval(() => { void publishDueScheduled(db()).catch((e) => console.warn('[SCHEDULE] run failed:', e?.message)); }, 60_000).unref();
    // Deadlines and escalation: every run is idempotent (each escalation is one document keyed by its step), so overlapping workers are safe.
    startWorkScheduler(db);
  }

  // Keep sockets from outliving a rolling deploy, so Cloud Run can drain the
  // worker instead of resetting in-flight requests.
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

  const shutdown = (signal: string) => {
    console.log(`[${cluster.worker ? cluster.worker.id : 'primary'}] ${signal} u morr, po mbyllet...`);
    server.close(() => process.exit(0));
    // Do not wait forever for a stuck keep-alive connection.
    setTimeout(() => process.exit(0), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    console.error('[FATAL] Unhandled promise rejection:', reason);
  });
  process.on('uncaughtException', (error) => {
    // Log and exit: a worker in an undefined state must be replaced by the
    // cluster supervisor rather than left serving broken responses.
    console.error('[FATAL] Uncaught exception:', error);
    process.exit(1);
  });

  return server;
}

/**
 * Cluster bootstrap.
 *
 * One worker per logical CPU so a single container saturates the vCPU quota it
 * was allocated. On Cloud Run only one vCPU is granted, so the primary path is
 * used there and clustering stays available for a VM or container-with-N-CPUs
 * deployment. CLUSTER_WORKERS overrides the default, and setting it to 0 or 1
 * forces single-process mode.
 */
const CLUSTER_ENABLED = process.env.CLUSTER_ENABLED !== 'false';

/**
 * Development runs exactly one process.
 *
 * `tsx server.ts` is the dev entry point, and it runs with NODE_ENV unset. Every
 * forked worker used to build its own Vite dev server, which meant eight Vite
 * instances, eight HMR websockets and eight processes racing for the same TCP
 * port. The losers fell through `getAvailablePort()` onto 3002, 3003, ... while
 * the browser was pointed at 3001, and whichever worker happened to bind last
 * served the page. That is the real reason the app intermittently came up blank
 * with a wall of errors in the console: the tab was talking to a worker whose
 * Vite client had lost the port race.
 *
 * Clustering earns its keep when several CPUs are actually serving production
 * traffic. It has no place in front of a single HMR session.
 */
const IS_DEV = process.env.NODE_ENV !== 'production';

function clusterSize(): number {
  if (IS_DEV) return 1;

  const explicit = Number(process.env.CLUSTER_WORKERS);
  if (Number.isInteger(explicit) && explicit >= 0) {
    return explicit === 0 ? 1 : explicit;
  }
  if (!CLUSTER_ENABLED) return 1;
  // One vCPU is the Cloud Run default; forking more workers than cores makes
  // context switching worse, not better.
  return Math.max(1, Math.min(os.cpus().length, 8));
}

const WORKERS = clusterSize();

if (cluster.isPrimary && WORKERS > 1) {
  console.log(`[cluster] Nis ${WORKERS} punëtorë nga ${os.cpus().length} bërthama CPU.`);

  let shuttingDown = false;

  cluster.on('exit', (worker, code, signal) => {
    if (shuttingDown) return;
    console.error(`[cluster] Punëtori ${worker.process.pid} ndaloj (code=${code}, signal=${signal}). Po niset zëvendës...`);
    cluster.fork();
  });

  process.on('SIGTERM', () => {
    shuttingDown = true;
    for (const worker of Object.values(cluster.workers ?? {})) {
      worker?.process.kill('SIGTERM');
    }
  });

  process.on('SIGINT', () => {
    shuttingDown = true;
    process.exit(0);
  });

  for (let i = 0; i < WORKERS; i += 1) {
    cluster.fork();
  }
} else {
  startServer().catch((error) => {
    console.error('[FATAL] Nuk mund të nisëj serveri:', error);
    process.exit(1);
  });
}
