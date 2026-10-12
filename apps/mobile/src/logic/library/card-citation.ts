import type { HeritageCard } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import { hasHangul } from '../story/source-link';

type CitationMessages = Messages['learner']['cardDetail']['citation'];

/** A piece of a line; `korean` pieces are marked `lang="ko"` so a screen reader reads them in Korean. */
export interface TextRun {
  text: string;
  korean: boolean;
}

export interface CardCitationView {
  /** "Source: <publisher>, <title>": shown on at most two lines, and in full as the accessible label. */
  line: string;
  /** The same line in pieces, with the publisher and the title marked when they are in Korean. */
  runs: TextRun[];
  /** "and N more sources", or null when the fact has no other source. */
  more: string | null;
}

/**
 * Splits `line` around `parts` (each found once, left to right, never over
 * characters another part already took), so every part can be its own text
 * node. A part the line does not contain is skipped; the runs always join
 * back to `line`.
 */
export function citationRuns(line: string, parts: readonly string[], isKorean: (text: string) => boolean): TextRun[] {
  const taken: Array<{ start: number; end: number; korean: boolean }> = [];
  for (const part of parts) {
    if (part === '') continue;
    let at = line.indexOf(part);
    while (at !== -1 && taken.some((r) => at < r.end && at + part.length > r.start)) at = line.indexOf(part, at + 1);
    if (at !== -1) taken.push({ start: at, end: at + part.length, korean: isKorean(part) });
  }
  taken.sort((a, b) => a.start - b.start);
  const runs: TextRun[] = [];
  let cursor = 0;
  for (const r of taken) {
    if (r.start > cursor) runs.push({ text: line.slice(cursor, r.start), korean: false });
    runs.push({ text: line.slice(r.start, r.end), korean: r.korean });
    cursor = r.end;
  }
  if (cursor < line.length) runs.push({ text: line.slice(cursor), korean: false });
  return runs;
}

/**
 * The source line under a story card's fact on its back face (F-STORY-006
 * §3.8, wireframe library/card-back-citation G): the fact's first source as
 * printed (publisher and title may be Korean) and how many others it has.
 * Never a URL and never a link: the grown-up Sources screen lists them all.
 * Null for a card without a citation, whose back face is unchanged.
 */
export function cardCitationView(card: Pick<HeritageCard, 'citation'>, m: CitationMessages): CardCitationView | null {
  const { citation } = card;
  if (!citation) return null;
  const line = m.source(citation.publisher, citation.title);
  return {
    line,
    runs: citationRuns(line, [citation.publisher, citation.title], hasHangul),
    more: citation.more > 0 ? m.more(citation.more) : null,
  };
}
