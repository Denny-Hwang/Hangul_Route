/**
 * Inline-literal scanner (F-CNT-002 §3.4 source class C). Finds Korean/romanization
 * pairs in TypeScript or TSX source text without importing it:
 *   - `ko: '…'` and `romanization: '…'` at the top level of one object literal
 *     (single-line or multi-line, either order);
 *   - the middot pattern in JSX text: `한글 · romanized · gloss`;
 *   - prose pairs: `romanized (한글)` and `한글 (romanized)`.
 * Comments are ignored. Pure and Hermes-safe (no look-behind, no Unicode property escapes).
 */

export interface ExtractedPair {
  file: string;
  /** 1-based line of the Korean string. */
  line: number;
  ko: string;
  romanization: string;
  kind: 'object' | 'middot' | 'prose';
}

export interface ProsePair {
  ko: string;
  romanization: string;
  /** Offset of the pair in the scanned text. */
  index: number;
}

const HANGUL_SYLLABLE = /[가-힣]/;

/** A single- or double-quoted string (one line) or a template literal. */
const STRING_BODY = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\[\s\S])*`/.source;

/** Replace every comment with spaces (newlines kept) so offsets and lines survive. */
function maskComments(source: string): string {
  const token = new RegExp(`//[^\\n]*|/\\*[\\s\\S]*?\\*/|${STRING_BODY}`, 'g');
  return source.replace(token, (m) => (m.charAt(0) === '/' ? m.replace(/[^\n]/g, ' ') : m));
}

function lineAt(text: string, index: number): number {
  return text.slice(0, index).split('\n').length;
}

function unquote(literal: string): string {
  return literal.slice(1, -1).replace(/\\(.)/g, '$1');
}

interface Frame {
  ko?: { value: string; index: number };
  romanization?: string;
}

function objectPairs(masked: string, file: string): ExtractedPair[] {
  const token = new RegExp(
    `["']?\\b(ko|romanization)["']?\\s*:\\s*(${STRING_BODY})|${STRING_BODY}|[{}]`,
    'g',
  );
  const pairs: ExtractedPair[] = [];
  const stack: Frame[] = [];
  for (let m = token.exec(masked); m !== null; m = token.exec(masked)) {
    const frame = stack[stack.length - 1];
    if (m[1] !== undefined && frame !== undefined) {
      const value = unquote(m[2] as string);
      if (m[1] === 'ko') {
        if (frame.ko === undefined) frame.ko = { value, index: m.index };
      } else if (frame.romanization === undefined) {
        frame.romanization = value;
      }
    } else if (m[0] === '{') {
      stack.push({});
    } else if (m[0] === '}') {
      const done = stack.pop();
      if (done !== undefined && done.ko !== undefined && done.romanization !== undefined && HANGUL_SYLLABLE.test(done.ko.value)) {
        pairs.push({
          file,
          line: lineAt(masked, done.ko.index),
          ko: done.ko.value,
          romanization: done.romanization,
          kind: 'object',
        });
      }
    }
  }
  return pairs;
}

function middotPairs(masked: string, file: string): ExtractedPair[] {
  const re = /([가-힣][가-힣 !?.,~]*) · ([A-Za-z][^·<>{}\n]*?) · [^·<>{}\n]+/g;
  const pairs: ExtractedPair[] = [];
  for (let m = re.exec(masked); m !== null; m = re.exec(masked)) {
    pairs.push({
      file,
      line: lineAt(masked, m.index),
      ko: m[1] as string,
      romanization: m[2] as string,
      kind: 'middot',
    });
  }
  return pairs;
}

/** `romanized (한글)` and `한글 (romanized)` pairs in English prose. */
export function extractProsePairs(text: string): ProsePair[] {
  const pairs: ProsePair[] = [];
  const before = /(^|[^A-Za-z-])([A-Za-z][A-Za-z-]*) \(([가-힣][가-힣 ]*)\)/g;
  for (let m = before.exec(text); m !== null; m = before.exec(text)) {
    pairs.push({ ko: m[3] as string, romanization: m[2] as string, index: m.index + (m[1] as string).length });
  }
  const after = /([가-힣][가-힣 ]*) \(([A-Za-z][A-Za-z -]*)\)/g;
  for (let m = after.exec(text); m !== null; m = after.exec(text)) {
    pairs.push({ ko: m[1] as string, romanization: m[2] as string, index: m.index });
  }
  return pairs;
}

/** All Korean/romanization pairs found in `source`, ordered by line. `file` is only a label. */
export function extractKoreanPairs(source: string, file: string): ExtractedPair[] {
  const masked = maskComments(source);
  const prose: ExtractedPair[] = extractProsePairs(masked).map((p) => ({
    file,
    line: lineAt(masked, p.index),
    ko: p.ko,
    romanization: p.romanization,
    kind: 'prose' as const,
  }));
  return [...objectPairs(masked, file), ...middotPairs(masked, file), ...prose].sort(
    (a, b) => a.line - b.line,
  );
}
