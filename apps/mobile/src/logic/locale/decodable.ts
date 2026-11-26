import { symbolsOf } from '../stage1/hangul';

/**
 * Decodable text (AMENDMENTS-ROMANIZATION-FADE section 3.4), in a file of its own that reaches no course content: the
 * locale store reads the resolver (`romanization-mode.ts`), and the web start must not reach the episodes, quests or
 * stories before the shelf is in (`content/__tests__/story-shelf-boot.test.ts`). The phase and the snapshot reading, which
 * do read the course, are in `romanization-fade.ts`, which re-exports both names below.
 */

/** What the learner has met: letters (quests 1 to 10), reading (the 30 symbols met), all (Word Builder complete). */
export type FadePhase = 'letters' | 'reading' | 'all';

/** What a taught text may hold besides Hangul syllable blocks: white space and these marks (straight or curly quotes). */
const DECODABLE_MARKS = new Set<string>(['.', ',', '!', '?', '~', '…', '·', "'", '"', '‘', '’', '“', '”', '(', ')', '-']);

const isBlock = (char: string): boolean => {
  const code = char.codePointAt(0)!;
  return code >= 0xac00 && code <= 0xd7a3;
};

/**
 * Whether the learner can read `text` with the symbols they have met (section 3.4): at least one syllable block, nothing
 * else but white space and the marks above, and every block built only from met symbols (no tense or compound letter, no
 * final outside the six taught). An isolated letter is not a block, so it is never decodable.
 */
export function isDecodable(text: string, met: ReadonlySet<string>): boolean {
  let blocks = 0;
  for (const char of text) {
    if (isBlock(char)) {
      const symbols = symbolsOf(char);
      if (symbols === null || !symbols.every((id) => met.has(id))) return false;
      blocks += 1;
    } else if (!/\s/.test(char) && !DECODABLE_MARKS.has(char)) {
      return false;
    }
  }
  return blocks > 0;
}
