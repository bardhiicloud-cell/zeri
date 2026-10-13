import { authHeaders } from './apiAuth';

/**
 * Runtime fallback translator.
 *
 * `dt()` covers every string that was registered in the dictionaries. Anything
 * that was not — a new paragraph, a data table, a legal clause — used to stay in
 * Albanian on a German or Arabic page. This module closes that gap: while a
 * non-Albanian language is active it finds Albanian text that is still on the
 * page, sends it through the existing `/api/translate` endpoint, caches the
 * result, and swaps it in. Albanian is restored untouched when the visitor
 * switches back.
 *
 * What it will not touch:
 *   • anything the visitor typed (inputs, textareas, editable regions);
 *   • user-generated areas (`data-no-translate`, the forum feed, admin);
 *   • short or name-like text (municipality and person names), which would be
 *     "translated" into a different place.
 */

const SKIP_SELECTOR =
  'script,style,noscript,textarea,input,select,option,code,pre,svg,[contenteditable="true"],[data-no-translate],.notranslate';
const ATTR_SKIP_SELECTOR = 'script,style,svg,[data-no-translate],.notranslate';
const ATTRS = ['placeholder', 'aria-label', 'title', 'alt'] as const;
const CACHE_PREFIX = 'zeri-rt-v1:';
const MAX_CACHE_ENTRIES = 3000;
const CONCURRENCY = 6;

/** Common Albanian function words; two-plus letters, matched as whole words. */
const ALBANIAN_WORDS =
  /(^|[^\p{L}])(dhe|për|një|nga|ose|nuk|është|janë|të|që|në|me|tuaj|juaj|tënd|jush|ka|do|po|si|ky|kjo|këtë|këtu|çdo|pas|deri|më|mund|duhet|keni|jeni|ju|na|tek|pa)($|[^\p{L}])/iu;
const ALBANIAN_LETTERS = /[ëç]/i;

type TextRecord = { original: string; translated: string };

const textRecords = new WeakMap<Text, TextRecord>();
const attrRecords = new WeakMap<Element, Map<string, TextRecord>>();
const touchedText = new Set<WeakRef<Text>>();
const touchedAttr = new Set<WeakRef<Element>>();

const memory = new Map<string, string>();
const failedUntil = new Map<string, number>();
const inflight = new Map<string, Promise<string | null>>();

let activeLanguage = 'sq';
let applying = false;
let observer: MutationObserver | null = null;
let scheduled: number | null = null;
let queue: string[] = [];
let running = 0;

function cacheKey(language: string): string {
  return CACHE_PREFIX + language;
}

function loadCache(language: string): void {
  try {
    const raw = localStorage.getItem(cacheKey(language));
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, string>;
    for (const [k, v] of Object.entries(parsed)) memory.set(language + '\u0000' + k, v);
  } catch {
    // Blocked or corrupt storage just means a cold cache.
  }
}

let persistTimer: number | null = null;
function persistCache(language: string): void {
  if (persistTimer) return;
  persistTimer = window.setTimeout(() => {
    persistTimer = null;
    try {
      const prefix = language + '\u0000';
      const out: Record<string, string> = {};
      let n = 0;
      for (const [k, v] of memory) {
        if (!k.startsWith(prefix)) continue;
        out[k.slice(prefix.length)] = v;
        if (++n >= MAX_CACHE_ENTRIES) break;
      }
      localStorage.setItem(cacheKey(language), JSON.stringify(out));
    } catch {
      // Quota exceeded: the in-memory map still serves this session.
    }
  }, 1500);
}

function isBlockedPath(): boolean {
  const path = window.location.pathname;
  return /(^|\/)(admin|approvals|agent|monitorim|moderim|komuna-panel|komuna|forum)(\/|$)/.test(path);
}

export function looksAlbanian(text: string): boolean {
  const t = text.trim();
  if (t.length < 4 || t.length > 1200) return false;
  if (/^[\d\s.,:;()\-–—/+%€$#@*]+$/.test(t)) return false;
  if (/^https?:\/\//i.test(t) || /@\w+\.\w+/.test(t)) return false;
  if (ALBANIAN_WORDS.test(t)) return true;
  // Name-like text ("Fushë Kosovë", "Mitrovicë e Veriut") must stay as is.
  const words = t.split(/\s+/);
  if (words.length >= 3 && ALBANIAN_LETTERS.test(t) && !words.every((w) => /^[A-ZËÇ]/.test(w))) return true;
  return false;
}

async function requestTranslation(text: string, language: string): Promise<string | null> {
  const key = language + '\u0000' + text;
  const hit = memory.get(key);
  if (hit) return hit;
  if ((failedUntil.get(key) ?? 0) > Date.now()) return null;
  const pending = inflight.get(key);
  if (pending) return pending;

  const job = (async () => {
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: await authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ text, target: language, source: 'sq' }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      const out = typeof data?.text === 'string' ? data.text.trim() : '';
      if (!out) throw new Error('empty');
      memory.set(key, out);
      persistCache(language);
      return out;
    } catch {
      failedUntil.set(key, Date.now() + 60_000);
      return null;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, job);
  return job;
}

function collectTextNodes(root: ParentNode): Text[] {
  const out: Text[] = [];
  const walker = document.createTreeWalker(root as Node, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || parent.closest(SKIP_SELECTOR)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let n = walker.nextNode();
  while (n) {
    out.push(n as Text);
    n = walker.nextNode();
  }
  return out;
}

function originalFor(node: Text): string {
  const rec = textRecords.get(node);
  const current = node.nodeValue ?? '';
  // If React rewrote the node, the new value is the new original.
  if (rec && current === rec.translated) return rec.original;
  return current;
}

function applyText(node: Text, language: string): void {
  const original = originalFor(node);
  const core = original.trim();
  if (!looksAlbanian(core)) return;
  const cached = memory.get(language + '\u0000' + core);
  if (cached) {
    const lead = original.match(/^\s*/)![0];
    const trail = original.match(/\s*$/)![0];
    const next = lead + cached + trail;
    if (node.nodeValue !== next) {
      applying = true;
      node.nodeValue = next;
      applying = false;
    }
    textRecords.set(node, { original, translated: next });
    touchedText.add(new WeakRef(node));
  } else {
    textRecords.set(node, { original, translated: original });
    enqueue(core);
  }
}

function applyAttrs(el: Element, language: string): void {
  for (const attr of ATTRS) {
    const value = el.getAttribute(attr);
    if (!value) continue;
    const records = attrRecords.get(el) ?? new Map<string, TextRecord>();
    const rec = records.get(attr);
    const original = rec && value === rec.translated ? rec.original : value;
    if (!looksAlbanian(original)) continue;
    const cached = memory.get(language + '\u0000' + original.trim());
    if (cached) {
      applying = true;
      el.setAttribute(attr, cached);
      applying = false;
      records.set(attr, { original, translated: cached });
      attrRecords.set(el, records);
      touchedAttr.add(new WeakRef(el));
    } else {
      enqueue(original.trim());
    }
  }
}

function enqueue(text: string): void {
  if (!queue.includes(text)) queue.push(text);
  pump();
}

function pump(): void {
  while (running < CONCURRENCY && queue.length > 0) {
    const text = queue.shift()!;
    const language = activeLanguage;
    running++;
    requestTranslation(text, language)
      .then((result) => {
        if (result && language === activeLanguage) scheduleScan();
      })
      .finally(() => {
        running--;
        pump();
      });
  }
}

function scan(): void {
  scheduled = null;
  if (activeLanguage === 'sq' || isBlockedPath()) return;
  const language = activeLanguage;
  for (const node of collectTextNodes(document.body)) applyText(node, language);
  document.body.querySelectorAll('[placeholder],[aria-label],[title],[alt]').forEach((el) => {
    if (!el.closest(ATTR_SKIP_SELECTOR)) applyAttrs(el, language);
  });
}

function scheduleScan(): void {
  if (scheduled !== null) return;
  scheduled = window.setTimeout(scan, 250);
}

function restoreAlbanian(): void {
  applying = true;
  for (const ref of touchedText) {
    const node = ref.deref();
    const rec = node && textRecords.get(node);
    if (node && rec && node.nodeValue === rec.translated) node.nodeValue = rec.original;
  }
  for (const ref of touchedAttr) {
    const el = ref.deref();
    const records = el && attrRecords.get(el);
    if (!el || !records) continue;
    records.forEach((rec, attr) => {
      if (el.getAttribute(attr) === rec.translated) el.setAttribute(attr, rec.original);
    });
  }
  applying = false;
  touchedText.clear();
  touchedAttr.clear();
}

/** Switch the translator to a language; `sq` turns it off and restores the page. */
export function setRuntimeLanguage(language: string): void {
  if (language === activeLanguage) return;
  const previous = activeLanguage;
  activeLanguage = language;
  queue = [];
  if (previous !== 'sq') restoreAlbanian();
  if (language === 'sq') {
    observer?.disconnect();
    observer = null;
    return;
  }
  loadCache(language);
  if (!observer) {
    observer = new MutationObserver(() => {
      if (!applying) scheduleScan();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...ATTRS],
    });
  }
  scheduleScan();
}

/** Called on route changes so a newly rendered page is scanned promptly. */
export function rescanRuntimeTranslation(): void {
  if (activeLanguage !== 'sq') scheduleScan();
}
