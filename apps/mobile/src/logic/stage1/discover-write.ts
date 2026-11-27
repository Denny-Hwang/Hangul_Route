import type { DiscoverPage } from '@hangul-route/content-schema';
import { strokeFormsForJamo } from '../../content/jamo-strokes';
import type { DiscoverPageView } from './discover-flow';

/**
 * The trace page of Discover (AMENDMENTS-STAGE1-TRACE-COVERAGE §3.5, row TC-1a): "Trace the new letters", one extra page after
 * the last letter page, where each new letter is traced once, unscored. Pure rules only; `discover-flow.ts` builds the page
 * and holds its state, and (row TC-1b) `DiscoverTracePad` draws it and runs the timers.
 */

/**
 * How long, after a finished letter, the canvas takes no ink and Next letter is disabled before the next letter comes up
 * (§3.3: the clean pass beat of Trace Stroke, 1100 ms).
 */
export const WRITE_ADVANCE_MS = 1100;

/** The jamo id of a built item's key: a repeated item's key carries `#n` (`discover-flow` `uniqueKey`). */
export function jamoIdOfKey(key: string): string {
  return key.replace(/#\d+$/, '');
}

/** A jamo with stroke data can be traced (`strokeFormsForJamo`): the 24 letters and the 6 finals, no upper-stage letter. */
const hasStrokes = (jamoId: string): boolean => strokeFormsForJamo(jamoId) !== undefined;

/**
 * The letters of a Discover step's trace page: the content items' `jamoId`s that have stroke data, in page order, each
 * once. A word, an exchange, a sentence and a letter with no stroke data are not traced.
 */
export function writeLetters(pages: readonly DiscoverPage[]): string[] {
  const ids: string[] = [];
  for (const page of pages) {
    for (const item of page.items) {
      if (item.type === 'jamo' && hasStrokes(item.jamoId) && !ids.includes(item.jamoId)) ids.push(item.jamoId);
    }
  }
  return ids;
}

/**
 * Where the trace page goes: right after the last built page that holds a letter card with stroke data. `-1` when no
 * built page does (the step has nothing to trace, so it gets no trace page).
 */
export function writePageIndex(built: readonly DiscoverPageView[]): number {
  let last = -1;
  built.forEach((page, index) => {
    if (page.items.some((item) => item.kind === 'symbol' && hasStrokes(jamoIdOfKey(item.key)))) last = index;
  });
  return last < 0 ? -1 : last + 1;
}

/** The line in Hoya's strip on the trace page. */
export type WriteStripLine = 'praise' | 'keepGoing' | 'keepGoingLast' | 'shapeGuide' | 'idle';

/**
 * Which line the strip shows (§3.3): praise wins, then "Keep going" (naming Next letter, or Continue on the last letter),
 * then the shape guide while Show me is up, else the idle line.
 */
export function writeStripLine(input: { traced: boolean; keepGoing: boolean; hintUp: boolean; last: boolean }): WriteStripLine {
  if (input.traced) return 'praise';
  if (input.keepGoing) return input.last ? 'keepGoingLast' : 'keepGoing';
  if (input.hintUp) return 'shapeGuide';
  return 'idle';
}
