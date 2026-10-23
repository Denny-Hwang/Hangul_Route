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
