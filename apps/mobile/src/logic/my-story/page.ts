import type { MyStoryFrame } from '@hangul-route/content-schema';
import type { WrittenFrame } from '../write-frame/flow';
import { fillGloss, sentenceKo, sentenceRomanization } from '../write-frame/view';

/**
 * What My Story draws of the text written so far (F-CURR-002 §7.1 F8, row CM-38; design/wireframes/minigame/my-story.md):
 * "My story so far" above the current frame, and My page at the end. Pure. The lines are built from the renderer's
 * React state on each render and never cached, stored or sent (OD-13, test P-1).
 */
export interface StoryLine {
  /** The frame's place in the chain: the list key and the Hear button's test id. */
  index: number;
  ko: string;
  romanization: string;
  gloss: string;
}

/** Each written sentence: the Korean with every ending fitted, its romanization (the converter) and its meaning. */
export function storyLines(frames: readonly MyStoryFrame[], written: readonly WrittenFrame[]): StoryLine[] {
  return written.flatMap((entry) => {
    const frame = frames[entry.roundIdx];
    if (frame === undefined) return [];
    const glosses = entry.words.map((word, slot) => frame.slots[slot]?.bank.find((b) => b.ko === word)?.en ?? word);
    return [
      {
        index: entry.roundIdx,
        ko: sentenceKo(frame.frame.ko, entry.words),
        romanization: sentenceRomanization(frame.frame.ko, entry.words),
        gloss: fillGloss(frame.frame.en, glosses),
      },
    ];
  });
}

/** Hoya's line on My page: the whole story only when every frame was written; after Skip, the story so far. */
export type PageLine = 'done' | 'donePartial';
export function pageLine(written: number, total: number): PageLine {
  return written >= total ? 'done' : 'donePartial';
}

/**
 * When "My story so far" draws as its one folded line ("3 lines so far", which opens on a tap) instead of the list
 * (design/wireframes/minigame/my-story.md, states: large text folds it earlier). While the learner writes it always
 * folds. While they pick, a phone (compact width) folds it from `SO_FAR_FOLD_LINES` lines or at
 * `SO_FAR_FOLD_FONT_SCALE` text (OS text size x the chosen step), so the frame card and the bank stay in view.
 */
export const SO_FAR_FOLD_LINES = 3;
export const SO_FAR_FOLD_FONT_SCALE = 1.3;
export function soFarFolds(at: { writing: boolean; compact: boolean; lines: number; fontScale: number }): boolean {
  return at.writing || (at.compact && (at.lines >= SO_FAR_FOLD_LINES || at.fontScale >= SO_FAR_FOLD_FONT_SCALE));
}
