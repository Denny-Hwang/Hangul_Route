import type { Story, StoryLevel } from '@hangul-route/content-schema';
import type { MinigameScope } from '../minigame-config';
import type { CheckView } from '../story/check-view';
import type { Rung } from './spacing';

/**
 * What a scored round asked (F-CURR-002 section 4.3, row CM-12): the games hand it to the quest run
 * with each answer, and the memory store reads the review items from it. Only the first answer of a
 * round is recorded, as only it is scored (`logic/first-try.ts`). Type only: nothing here reaches
 * the start bundle.
 */
export interface RoundAsked {
  /** The Korean the round asked, as the content writes it: a word, a block, a sentence or a dialogue line. */
  texts?: readonly string[];
  /** The symbols it asked, by jamo id (`jamo:bieup`, `jamo:bieup-batchim`). */
  jamoIds?: readonly string[];
  /** The rung it asked at; read from the game kind when the scope is given. */
  rung?: Rung;
  /** A host game (Listen & Pick, Pic-Word Match, ...): its scope and the answered round or pair id; the items are read from these. */
  scope?: MinigameScope;
  itemId?: string;
  /** A story check: the item is its Korean target and a Korean right answer, asked as reading. */
  check?: CheckView;
  /** A reader checkpoint (`cp:<id>`) of a story tier, read like a check. */
  checkpoint?: { story: Story | undefined; level: StoryLevel; roundKey: string };
  /**
   * Answered with a hint showing (Role Play's Show meanings, row CM-35; Syllable Build's Show how it sounds, row CM-32):
   * a right answer then counts as hinted.
   */
  hinted?: boolean;
}
