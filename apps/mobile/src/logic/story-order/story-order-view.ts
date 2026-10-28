import { romanize, storyOrderPictures, type KoText, type StoryOrderRound } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import type { WidthClass } from '@hangul-route/design-system';
import type { PlaySpec } from '../audio/controller';
import { koSpeech } from '../audio/ko-speech';
import type { StoryOrderCard } from './story-order-player';

/**
 * View-models of the Story Order screen (F-CURR-002 row CM-34; design/wireframes/minigame/story-order.md):
 * every branch the screen paints lives here, so it is tested without a renderer.
 */

export interface StoryOrderCopy {
  storyOrder: Messages['learner']['storyOrder'];
  sequence: Messages['learner']['story']['sequence'];
}

/** The surface id of Story Order's sound for the audio telemetry (`audio.fallback_shown { source }`). */
export const STORY_ORDER_AUDIO_SOURCE = 'story-order';

/** A round told by its captions reads "Put the lines in order"; an illustrated one is Story Sequence's heading and hint. */
export function storyOrderHeading(round: StoryOrderRound, copy: StoryOrderCopy): { title: string; hint: string } {
  return storyOrderPictures(round) ? { title: copy.sequence.title, hint: copy.sequence.hint } : { title: copy.storyOrder.title, hint: copy.storyOrder.hint };
}

const SENTENCE_MARK = /[.?!,…~]+$/u;

/**
 * What a filled slot shows: its line's first word with that word's romanization under it (`geudaeume` for the line "Next, I wash my face"). The
 * content's romanization when it splits one word per Korean word, else that word romanized by rr.ts.
 */
export function slotFace(line: KoText): { ko: string; romanization: string } {
  const words = line.ko.trim().split(/\s+/u);
  const first = (words[0] ?? '').replace(SENTENCE_MARK, '');
  const roman = line.romanization.trim().split(/\s+/u);
  const romanization = roman.length === words.length ? (roman[0] ?? '').replace(SENTENCE_MARK, '') : romanize(first).text;
  return { ko: first, romanization };
}

/** A card's name for a screen reader: its line and romanization, its meaning once shown, and a miss or ring in words. */
export function storyOrderCardLabel(card: StoryOrderCard, romanization: string, meaning: boolean, outcome: 'wrong' | 'hint' | null, copy: StoryOrderCopy): string {
  const korean = romanization === '' ? card.line.ko : `${card.line.ko}, ${romanization}`;
  const base = meaning ? `${korean}. ${card.line.en}` : korean;
  if (outcome === 'wrong') return `${base}. ${copy.sequence.tryAnother}`;
  if (outcome === 'hint') return `${base}. ${copy.sequence.lookHere}`;
  return base;
}

/** Card columns: captions one column on a phone, two from regular; pictures one at 320, two from 360, four from regular. */
export function storyOrderColumns(width: WidthClass, windowWidth: number, pictures: boolean): 1 | 2 | 4 {
  if (width !== 'compact') return pictures ? 4 : 2;
  return pictures && windowWidth >= 360 ? 2 : 1;
}

/** The effective text scale (OS size x the app's step) from which a phone's slots stack one per row: 200 %. */
export const STORY_ORDER_STACK_SLOTS_AT = 2;

/**
 * Slots per row: 2 x 2 on a phone (half the column each), every slot in one row from regular. At very large text
 * (`fontScale` from `STORY_ORDER_STACK_SLOTS_AT`) a phone's slots no longer fit two across, so they stack one per row
 * (design/wireframes/minigame/story-order.md, large text); at 150 % they stay two across, never narrower than half the column.
 */
export function storyOrderSlotsPerRow(width: WidthClass, total: number, fontScale = 1): number {
  if (width !== 'compact') return Math.max(1, total);
  return fontScale >= STORY_ORDER_STACK_SLOTS_AT ? 1 : 2;
}

/** What a placed card or a replayed line says: the line at the sentence rate, its clip when it has one. */
export function lineSpeech(line: KoText): PlaySpec {
  return koSpeech(line, 'sentence', STORY_ORDER_AUDIO_SOURCE);
}
