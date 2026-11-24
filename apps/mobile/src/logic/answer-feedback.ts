import type { Messages } from '@hangul-route/i18n';
import type { KoTokenPart } from './ko-tokens';

/**
 * F-A11Y-001 (answer feedback you can see without colour, and hear once), row AF-1: every rule of §3.2 to §3.4 that can
 * be a function. The answer announcer (`screens/minigames/answer-announcer.tsx`) and its hook
 * (`use-answer-announcement.ts`) only wire these to the platform calls. Pure.
 *
 * - A result is said once, as one line built from `a11y.answer.*` (§3.2). No line carries taught-Korean Hangul
 *   (OD-AF5 (a)): a Korean answer is named by romanization and gloss (`answerItem`), a jamo by its sound value.
 * - The line comes as segments (`{ text, lang? }`), so WO-40's LP-3 can add a Korean-voiced segment without changing a
 *   caller. Today every segment is UI language.
 * - A sighted learner sees the mark for at least `RESULT_MARK_MIN_MS` before the round moves on (OD-AF2 (b)).
 * - With a screen reader on, a right answer shows Next and waits for it (OD-AF9 (b)); the web takes that path when the
 *   device flag says so (OD-AF3 (d)).
 */

export type AnswerA11y = Messages['a11y'];

/** One piece of an announced line. `lang` is unset for UI language (the only kind this spec emits). */
export interface AnswerSegment {
  text: string;
  lang?: string;
}

/** A game's result, as §3.2's table names its kinds. */
export type AnswerResult =
  | { kind: 'right'; item: string }
  | { kind: 'miss'; item: string }
  /** A miss in a game whose prompt is a sound (Match Sound, Listen & Pick, Syllable Build). */
  | { kind: 'missListen'; item: string }
  /** A miss with the game's own hint line, or the look-here line when the miss turns the hint on. */
  | { kind: 'missHint'; item: string; hint: string }
  /** Card Match: a pair that does not match. */
  | { kind: 'notMatched'; word: string; meaning: string }
  /** A whole dictionary line used as is (Build a Letter's `notQuite`, where no single option was picked). */
  | { kind: 'line'; text: string };

/** A Korean answer's spoken name: "{romanization}, {gloss}", or the romanization alone (no gloss, or an empty one). */
export function answerItem(a11y: AnswerA11y, romanization: string, gloss?: string): string {
  return a11y.answer.item(romanization, gloss);
}

/** The line a result is announced with (§3.2, §3.7). */
export function answerAnnouncement(result: AnswerResult, a11y: AnswerA11y): AnswerSegment[] {
  const t = a11y.answer;
  switch (result.kind) {
    case 'right':
      return [{ text: t.right(result.item) }];
    case 'miss':
      return [{ text: t.miss(result.item) }];
    case 'missListen':
      return [{ text: t.missListen(result.item) }];
    case 'missHint':
      return [{ text: t.missHint(result.item, result.hint) }];
    case 'notMatched':
      return [{ text: t.notMatched(result.word, result.meaning) }];
    case 'line':
      return [{ text: result.text }];
  }
}

/** The plain string of a line: what the iOS call says (it takes one string, with no language for any part of it). */
export function segmentsText(segments: readonly AnswerSegment[]): string {
  return segments.map((s) => s.text).join('');
}

/**
 * A line with `{ko:}` tokens as it is said (§3.2): each token by its romanization only, never its Hangul. A token that
 * could not be romanized is left out. `partsText` (`logic/role-play/view.ts`) keeps Hangul plus romanization for the
 * visible line.
 */
export function spokenParts(parts: readonly KoTokenPart[]): string {
  return parts.map((p) => ('text' in p ? p.text : p.romanization)).join('');
}

/** An answer option's state, as its accessible name tells it (§3.2). */
export type AnswerOptionState = 'idle' | 'correct' | 'wrong' | 'hint';

/** An answered option's accessible name starts with its state; `base` is its name before the answer (OD-AF4 (a)). */
export function answerOptionLabel(state: AnswerOptionState, base: string, option: AnswerA11y['minigame']['option']): string {
  switch (state) {
    case 'correct':
      return option.correct(base);
    case 'wrong':
      return option.wrong(base);
    case 'hint':
      return option.hint(base);
    case 'idle':
      return base;
  }
}

/** OD-AF2 (b): a right answer's mark shows at least this long before the round moves on (reader off). */
export const RESULT_MARK_MIN_MS = 1000;

/**
 * The least wait after a right answer: the game's own (its QS-4 constant) or the floor, whichever is longer. The floor
 * also covers Read Pick's reduced-motion 0: reduced motion asks for less motion, not less time to see the mark.
 */
export function resultLeastWait(gameMinMs: number): number {
  return Math.max(gameMinMs, RESULT_MARK_MIN_MS);
}

export type ReaderPath = 'reader' | 'plain';

/**
 * Which path a result takes (§3.4). Native reads the platform's screen reader (VoiceOver, TalkBack); the web cannot
 * tell (`screen-reader.web.ts`), so it follows the device flag "I use a screen reader" (OD-AF3 (d)).
 */
export function readerPath(input: { platform: string; nativeReader: boolean; webFlag: boolean }): ReaderPath {
  const on = input.platform === 'web' ? input.webFlag : input.nativeReader;
  return on ? 'reader' : 'plain';
}

/** The least and most time Android and the web give a line to be read (they cannot tell when the reader is done). */
export const ANNOUNCE_WAIT_MIN_MS = 1200;
export const ANNOUNCE_WAIT_MAX_MS = 8000;
/** Per letter, and per Hangul syllable of the Korean UI's own words (said slower). Tuned on a device (§3.8). */
const MS_PER_LETTER = 70;
const MS_PER_SYLLABLE = 160;
const SYLLABLE = /[가-힯]/;

/**
 * How long a line takes to be said, for the platforms with no "finished" event (Android, and the web under OD-AF3 (d)):
 * it scales with the line's length and stays within `ANNOUNCE_WAIT_MIN_MS` and `ANNOUNCE_WAIT_MAX_MS`. A wrong guess
 * only lets the answer's sound overlap the line's end; with Next (OD-AF9 (b)) nothing moves on by it. The rates are
 * provisional until the TalkBack check at its slowest default rate (§3.8).
 */
export function announceWaitMs(text: string): number {
  let ms = 0;
  for (const ch of text) ms += SYLLABLE.test(ch) ? MS_PER_SYLLABLE : MS_PER_LETTER;
  return Math.min(ANNOUNCE_WAIT_MAX_MS, Math.max(ANNOUNCE_WAIT_MIN_MS, ms));
}

export interface AfterRightAnswer {
  /** The reader path is on (`readerPath`). */
  readerOn: boolean;
  /** The game's own least wait before the floor (its QS-4 constant). */
  gameMinMs: number;
  /** Says the line (the hook's `announce`); settles once it has been said. */
  announce: () => Promise<void>;
  /** The answer's own sound, where the game plays one (Tap & Respond's reply, Listen & Pick's clip). */
  play?: () => void;
  /** Reader on: show Next below the answers and move focus to it. */
  showNext: () => void;
  /** Reader off: the game's own wait (`afterSound` or `pacing.after`) with this least wait, then the advance. */
  waitThenAdvance: (minMs: number) => void;
}

/**
 * What follows a right answer (§3.4). Reader off: the line, the answer's sound, then the game's wait with the floor and
 * the advance. Reader on (OD-AF9 (b)): Next takes focus first, the line is queued after the focus move, the answer's
 * sound starts once the line has been said, and the round moves on only when Next is pressed. Resolves when this is
 * done (reader on: after the sound has started).
 */
export async function afterRightAnswer(steps: AfterRightAnswer): Promise<void> {
  if (!steps.readerOn) {
    void steps.announce();
    steps.play?.();
    steps.waitThenAdvance(resultLeastWait(steps.gameMinMs));
    return;
  }
  steps.showNext();
  await steps.announce();
  steps.play?.();
}

/**
 * What follows a miss (§3.4): the line; the sound a game would play by itself after a miss (Match Sound's replay, Listen
 * & Pick's, Syllable Build's) only with the reader off. With a reader the learner taps Hear it.
 */
export function afterMiss(steps: { readerOn: boolean; announce: () => unknown; replay?: () => void }): void {
  void steps.announce();
  if (!steps.readerOn) steps.replay?.();
}
