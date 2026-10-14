import { allomorphOrBoth, fillFrame, romanize, SLOT_MARKER } from '@hangul-route/content-schema';

/**
 * What the Write Frame card draws and reads (F-CURR-001 §3.7; design/wireframes/minigame/write-frame.md):
 * the frame split into text, slots and the particle or ending after each slot, fitted to the
 * word in the slot by the allomorph helper (C-1). Before a pick, or while a name's last block is
 * unfinished, a pair shows both forms as written (`을/를`). Pure.
 */

export type FramePart =
  | { kind: 'text'; text: string }
  /** A slot: the word in it (a pick, the typed name), or null while empty. */
  | { kind: 'slot'; slot: number; word: string | null }
  /** The particle or ending after a slot: fitted to the slot's word, else both forms (`을/를`). */
  | { kind: 'ending'; slot: number; text: string; pair: boolean };

/** One slot marker and the particle or ending written right after it (the C-1 `fillFrame` rule). */
const SLOT_RE = new RegExp(`${SLOT_MARKER}([가-힣]+(?:/[가-힣]+)?)?`, 'g');

/** The frame's parts, with `words[i]` in slot i (null: empty). */
export function frameParts(frame: string, words: readonly (string | null)[]): FramePart[] {
  const parts: FramePart[] = [];
  let at = 0;
  let slot = 0;
  for (const match of frame.matchAll(SLOT_RE)) {
    const index = match.index as number;
    if (index > at) parts.push({ kind: 'text', text: frame.slice(at, index) });
    const word = words[slot] ?? null;
    parts.push({ kind: 'slot', slot, word });
    const ending = match[1];
    if (ending !== undefined) {
      parts.push({ kind: 'ending', slot, text: allomorphOrBoth(word ?? '', ending), pair: ending.includes('/') });
    }
    at = index + match[0].length;
    slot += 1;
  }
  if (at < frame.length) parts.push({ kind: 'text', text: frame.slice(at) });
  return parts;
}

/** The finished sentence: every slot filled, each ending fitted (`저는 떡볶이를 좋아해요.`). */
export function sentenceKo(frame: string, words: readonly string[]): string {
  return fillFrame(frame, words);
}

/** The finished sentence's romanization, from the converter (the frame's own line has `___`). */
export function sentenceRomanization(frame: string, words: readonly string[]): string {
  return romanize(sentenceKo(frame, words)).text;
}

/** The frame's gloss with each `___` replaced, in order, by `fills[i]` (a pick's gloss, a name's romanization). */
export function fillGloss(gloss: string, fills: readonly string[]): string {
  let i = 0;
  return gloss.replace(/_{3}/g, (blank) => fills[i++] ?? blank);
}

export interface FrameReadingWords {
  /** Said for an empty slot ("blank"). */
  blank: string;
  /** Both forms of a pair before the slot is filled ("을 or 를"). */
  either: (a: string, b: string) => string;
}

/**
 * The frame card's one accessibility label: the Korean with an empty slot said as "blank" and a
 * pair said as both forms, then the gloss with its blanks said the same way
 * ("저는, blank, 을 or 를, 좋아해요. I like blank.").
 */
export function frameReading(parts: readonly FramePart[], gloss: string, words: FrameReadingWords): string {
  const ko = parts
    .map((p) => {
      if (p.kind === 'text') return p.text.trim();
      if (p.kind === 'slot') return p.word ?? words.blank;
      if (!p.text.includes('/')) return p.text;
      const [a, b] = p.text.split('/') as [string, string];
      return words.either(a, b);
    })
    .filter((t) => t !== '');
  const glossRead = gloss.replace(/_{3}/g, words.blank);
  return `${ko.join(', ')} ${glossRead}`.trim();
}

/** After a pick fills a slot whose ending is a pair: the form chosen and the word, for the polite announcement. */
export function fittedEnding(parts: readonly FramePart[], slot: number): { particle: string; word: string } | null {
  const word = parts.find((p): p is Extract<FramePart, { kind: 'slot' }> => p.kind === 'slot' && p.slot === slot)?.word ?? null;
  const ending = parts.find((p): p is Extract<FramePart, { kind: 'ending' }> => p.kind === 'ending' && p.slot === slot);
  if (word === null || ending === undefined || !ending.pair || ending.text.includes('/')) return null;
  return { particle: ending.text, word };
}
