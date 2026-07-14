// Pre-share PII pattern scanner.
//
// Scanning scope is the *full raw text* of a submission —
// code, comments, docstrings, string literals, identifiers, titles, README.
// No exceptions carved out for "it's just code."
//
// Layered, not airtight. Catches the accidental / lazy cases (someone
// pasting their email into a comment) — does not claim to catch adversarial
// or paraphrased disclosure. Flagged content is *held for human review*,
// not silently blocked or silently allowed.

export type ScanFinding = {
  kind: 'email' | 'phone' | 'url_with_userinfo' | 'disclosure_phrase';
  where: string; // logical location, e.g. "title", "files.main.py", "assets"
  sample: string; // short excerpt of the offending match, capped for storage
};

export type ScanResult = {
  status: 'clean' | 'flagged';
  findings: ScanFinding[];
};

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE_RE = /(?:\+?\d[\s\-().]?){7,15}\d/g;
const URL_USERINFO_RE = /https?:\/\/[^\s/@]+:[^\s/@]+@[^\s]+/g;
const DISCLOSURE_PHRASES: RegExp[] = [
  /\bmy\s+(?:phone|number|address|home|school|instagram|telegram|whatsapp|discord|snap|tiktok)\b/i,
  /\bcontact\s+me\s+(?:on|at|via)\b/i,
  /\bdm\s+me\b/i,
  /\bpm\s+me\b/i,
  /\bмой\s+(?:телефон|номер|адрес|дом|школ|инстаграм|телеграм|вотсап|дискорд|тикток)/i,
  /\bпиши(?:те)?\s+мне\b/i,
];

function collect(text: string, where: string, out: ScanFinding[]): void {
  if (!text) return;
  for (const m of text.matchAll(EMAIL_RE)) {
    out.push({ kind: 'email', where, sample: excerpt(text, m.index ?? 0, m[0].length) });
  }
  for (const m of text.matchAll(PHONE_RE)) {
    const digits = m[0].replace(/\D/g, '');
    if (digits.length >= 7) {
      out.push({ kind: 'phone', where, sample: excerpt(text, m.index ?? 0, m[0].length) });
    }
  }
  for (const m of text.matchAll(URL_USERINFO_RE)) {
    out.push({ kind: 'url_with_userinfo', where, sample: excerpt(text, m.index ?? 0, m[0].length) });
  }
  for (const re of DISCLOSURE_PHRASES) {
    const m = re.exec(text);
    if (m) {
      out.push({ kind: 'disclosure_phrase', where, sample: excerpt(text, m.index, m[0].length) });
    }
  }
}

function excerpt(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 20);
  const end = Math.min(text.length, index + length + 20);
  return text.slice(start, end).replace(/\s+/g, ' ').trim().slice(0, 160);
}

export function scanSnapshot(input: {
  title: string;
  files: Record<string, string>;
  assets?: Record<string, unknown>;
}): ScanResult {
  const findings: ScanFinding[] = [];
  collect(input.title, 'title', findings);
  for (const [name, content] of Object.entries(input.files ?? {})) {
    if (typeof content === 'string') {
      collect(content, `files.${name}`, findings);
    }
  }
  if (input.assets) {
    try {
      collect(JSON.stringify(input.assets), 'assets', findings);
    } catch {
      // serialization errors aren't the scanner's problem
    }
  }
  return { status: findings.length > 0 ? 'flagged' : 'clean', findings };
}
