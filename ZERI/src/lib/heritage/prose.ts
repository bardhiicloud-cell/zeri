/**
 * Tiny markdown subset for entry bodies: paragraphs, `- ` lists, `> ` quotes, `**bold**`,
 * and `[text](/internal-path | https://…)` links. Produces a plain tree, never HTML, so a
 * body can never inject markup into the page.
 */
export type Inline =
  | { t: 'text'; v: string }
  | { t: 'bold'; v: string }
  | { t: 'link'; v: string; href: string; external: boolean };

export type Block =
  | { t: 'p'; inline: Inline[] }
  | { t: 'ul'; items: Inline[][] }
  | { t: 'quote'; inline: Inline[] };

/**
 * Internal paths start with exactly one slash: `//host` is a protocol-relative URL that would send the
 * reader to another site while looking like part of ours.
 */
const SAFE_HREF = /^(\/(?!\/)[A-Za-z0-9_\-./?=&%#]*|https:\/\/[^\s)]+)$/;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ t: 'text', v: text.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ t: 'bold', v: m[1] });
    else if (SAFE_HREF.test(m[3])) out.push({ t: 'link', v: m[2], href: m[3], external: m[3].startsWith('https://') });
    else out.push({ t: 'text', v: m[2] });
    last = re.lastIndex;
  }
  if (last < text.length) out.push({ t: 'text', v: text.slice(last) });
  return out;
}

export function parseProse(text: string): Block[] {
  const blocks: Block[] = [];
  const chunks = (text ?? '').replace(/\r\n/g, '\n').split(/\n{2,}/);
  for (const raw of chunks) {
    const chunk = raw.trim();
    if (!chunk) continue;
    const lines = chunk.split('\n');
    if (lines.every((l) => /^\s*-\s+/.test(l))) {
      blocks.push({ t: 'ul', items: lines.map((l) => parseInline(l.replace(/^\s*-\s+/, ''))) });
    } else if (lines.every((l) => /^>\s?/.test(l))) {
      blocks.push({ t: 'quote', inline: parseInline(lines.map((l) => l.replace(/^>\s?/, '')).join(' ')) });
    } else if (lines.some((l) => /^\s*-\s+/.test(l))) {
      // A paragraph followed directly by a list: split it so the list still renders as a list.
      const head: string[] = [];
      const items: string[] = [];
      for (const l of lines) (/^\s*-\s+/.test(l) ? items : head).push(l.replace(/^\s*-\s+/, ''));
      if (head.length) blocks.push({ t: 'p', inline: parseInline(head.join(' ')) });
      blocks.push({ t: 'ul', items: items.map(parseInline) });
    } else {
      blocks.push({ t: 'p', inline: parseInline(lines.join(' ')) });
    }
  }
  return blocks;
}
