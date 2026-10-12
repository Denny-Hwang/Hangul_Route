import { withoutWebAddresses, type HeritageCard } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';

type CitationMessages = Messages['learner']['cardDetail']['citation'];

/** A piece of a line; `korean` pieces are marked `lang="ko"` so a screen reader reads them in Korean. */
export interface TextRun {
  text: string;
  korean: boolean;
}

export interface CardCitationView {
  /** "Source: <publisher>, <title>": shown on at most two lines. */
  line: string;
  /** The same line in pieces, each Korean span (and only the Korean) marked. */
  runs: TextRun[];
  /** "and N more sources", or null when the fact has no other source. */
  more: string | null;
}

// Hangul syllables, jamo and compatibility jamo (the range of `hasHangul` in story/source-link.ts), and
// the CJK ideographs with their compatibility forms: a Korean source often gives its title in Hanja too,
// which a Korean voice reads and an English voice skips or spells out.
const HANGUL = '[\\u1100-\\u11ff\\u3130-\\u318f\\uac00-\\ud7a3\\u4e00-\\u9fff\\uf900-\\ufaff]';
// A Korean span: Hangul (or Hanja) words with only spaces between them, so a Korean phrase is read as one piece.
// The capture group makes `split` keep the spans, at the odd indices.
const KOREAN_SPAN = new RegExp(`(${HANGUL}+(?:\\s+${HANGUL}+)*)`);

/**
 * Splits `text` at the edges of its Korean spans, so only the Hangul is
 * marked: in a publisher written as its Korean name followed by
 * "(National Hangeul Museum)", the English gloss is read in the page's
 * language. Works on the whole formatted line, so the
 * order of the parts in a translated template never matters and nothing is
 * searched for. The runs always join back to `text`.
 */
export function hangulRuns(text: string): TextRun[] {
  return text
    .split(KOREAN_SPAN)
    .map((piece, i) => ({ text: piece, korean: i % 2 === 1 }))
    .filter((run) => run.text !== '');
}

/**
 * The source line under a story card's fact (F-STORY-006 §3.8, wireframe
 * library/card-back-citation G): the fact's first source as printed
 * (publisher and title may be Korean) and how many others it has. Never a
 * URL and never a link: a web address in the publisher or title is dropped
 * (`withoutWebAddresses`), and the grown-up Sources screen lists every source
 * with its address. Null for
 * a card without a citation, whose back face is unchanged.
 */
export function cardCitationView(card: Pick<HeritageCard, 'citation'>, m: CitationMessages): CardCitationView | null {
  const { citation } = card;
  if (!citation) return null;
  // Never a web address on a learner surface (story lint keeps a name to print).
  const line = m.source(withoutWebAddresses(citation.publisher), withoutWebAddresses(citation.title));
  return {
    line,
    runs: hangulRuns(line),
    more: citation.more > 0 ? m.more(citation.more) : null,
  };
}
