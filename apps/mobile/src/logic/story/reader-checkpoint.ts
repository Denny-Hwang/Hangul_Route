import type { SpeechLang, Story, StoryTier } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import type { PlaySpec } from '../audio/controller';
import { checkSpeech, type CheckSpeech } from './check-game';
import { initCheckState, reduceCheck, type CheckPlayerView, type CheckState } from './check-player';
import { buildCheckView, type CheckView } from './check-view';
import type { ReaderMode } from './reader-effects';
import type { ReaderAction } from './reader-state';
import { STORY_READER_AUDIO_SOURCE } from './scene-audio';

/**
 * The inline checkpoint card of the story reader (F-STORY-002 §3.7, PR 2.9;
 * wireframe design/wireframes/story/reader.md G2). A checkpoint is a story
 * check (`StoryCheckSchema`) shown after its scene, drawn with F-STORY-003's
 * shared pieces: `buildCheckView`, `reduceCheck` (first try, amber "Try
 * another" that locks a card, the ring on the right card after
 * `HIGHLIGHT_AFTER_WRONG` misses, resolve only on the right card) and
 * `ChoiceCard`. Pure: `StoryReaderView` keeps the cards and runs what these
 * return.
 *
 * Scoring goes through the reader's own state machine, never around it: a miss
 * is reported at once (`resolveCheckpoint(false)`, the card stays open), and a
 * right answer when the learner turns the page (`resolveCheckpoint(true)`, so
 * the effects are `scene-changed` then `answer`). The quest run keeps only the
 * first answer of each `cp:<id>` key, so a miss followed by the right card
 * scores the miss. The reader reports answers in quest mode only; a replay's
 * card is the unscored "Try it".
 */

type ReaderCopy = Messages['learner']['story']['reader'];

/** One check state per checkpoint id, for the life of the reader (cleared by Read again). */
export type CheckpointCards = Readonly<Record<string, CheckState>>;

export const NO_CHECKPOINT_CARDS: CheckpointCards = Object.freeze({});

/** The open checkpoint as a check view (options ordered by the story id seed), or null. */
export function checkpointItem(
  story: Pick<Story, 'id'>,
  tier: Pick<StoryTier, 'checkpoints'>,
  checkpointId: string | null,
): CheckView | null {
  if (checkpointId === null) return null;
  const check = tier.checkpoints.find((c) => c.id === checkpointId);
  return check ? buildCheckView(check, story.id) : null;
}

function playerView(item: CheckView): CheckPlayerView {
  return { items: [item], hasRecap: false };
}

/** The state of a checkpoint's card: as the learner left it, or fresh. */
export function checkpointCard(cards: CheckpointCards, item: CheckView): CheckState {
  return cards[item.checkId] ?? initCheckState(playerView(item));
}

/** The right card was found: the explanation shows and Next carries on. */
export function checkpointAnswered(cards: CheckpointCards, item: CheckView): boolean {
  return checkpointCard(cards, item).phase !== 'answering';
}

export interface CheckpointTap {
  cards: CheckpointCards;
  /** What the reader runs now: a miss is reported at once; a right answer waits for the page turn. */
  reader: ReaderAction | null;
  /** Feedback for the screen (haptics, announcement); null when the tap changed nothing. */
  outcome: 'correct' | 'wrong' | null;
}

/** A tap on an option of the open checkpoint card. */
export function tapCheckpoint(cards: CheckpointCards, item: CheckView, optionId: string): CheckpointTap {
  const before = checkpointCard(cards, item);
  const step = reduceCheck(before, { type: 'choose', optionId }, playerView(item));
  const answer = step.effects.find((e) => e.type === 'answer');
  if (!answer || answer.type !== 'answer') return { cards, reader: null, outcome: null };
  const next: CheckpointCards = { ...cards, [item.checkId]: step.state };
  if (answer.correct) return { cards: next, reader: null, outcome: 'correct' };
  return { cards: next, reader: { type: 'resolveCheckpoint', correct: false }, outcome: 'wrong' };
}

/** Next on the bottom bar while the card is open: only once it is answered; it reports the answer and turns the page. */
export function checkpointNext(cards: CheckpointCards, item: CheckView): ReaderAction | null {
  return checkpointAnswered(cards, item) ? { type: 'resolveCheckpoint', correct: true } : null;
}

/**
 * Skip, always on the card so a learner is never stuck. Before the right card
 * is found it records nothing; after, it carries the answer already given on,
 * exactly like Next (the tap was the answer; Skip adds nothing to it).
 */
export function checkpointSkip(cards: CheckpointCards, item: CheckView): ReaderAction {
  return checkpointNext(cards, item) ?? { type: 'skipCheckpoint' };
}

/** A fresh read (Read again) asks every checkpoint again; any other action keeps the cards. */
export function cardsAfterReader(cards: CheckpointCards, action: ReaderAction): CheckpointCards {
  return action.type === 'restart' ? NO_CHECKPOINT_CARDS : cards;
}

/** "Quick question" in a quest; in a replay the unscored "Try it" (§3.6). */
export function checkpointHeading(mode: ReaderMode, copy: ReaderCopy): string {
  return mode === 'quest' ? copy.checkpoint.quickQuestion : copy.checkpoint.tryIt;
}

/** What a screen reader hears when the card opens: the heading, then the question (its Korean as written). */
export function checkpointAnnouncement(heading: string, item: CheckView): string {
  const prompt = item.promptParts.map((p) => ('text' in p ? p.text : p.target.ko)).join('');
  return `${heading}. ${prompt}`;
}

/** The reader-state `revealed` id of a card's romanization (hide-until-tap), apart from the scene's items. */
export function checkpointRevealId(checkpointId: string): string {
  return `cp:${checkpointId}`;
}

const asReader = (spec: PlaySpec): PlaySpec => ({ ...spec, source: STORY_READER_AUDIO_SOURCE });

/**
 * What the card's speakers say: F-STORY-003's `checkSpeech` (the question with
 * its Korean in a Korean voice, then the options; a translated string in the UI
 * voice, English in English), played as the reader surface so its sound state
 * and fallback reports stay the reader's (§3.4).
 *
 * @param source the same checkpoint before the locale overlay (undefined: read as English)
 */
export function checkpointSpeech(item: CheckView, source: CheckView | undefined, ui: SpeechLang): CheckSpeech {
  const speech = checkSpeech(item, source, ui);
  return {
    question: speech.question.map(asReader),
    options: speech.options.map(asReader),
    target: speech.target ? asReader(speech.target) : null,
  };
}
