import {
  localize,
  type AssessmentQuestion,
  type Overlays,
  type PlacementEvent,
  type PlacementMode,
  type UiLocale,
} from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';

/**
 * View models for one question of the level check (F-PLC-001 section 3.1
 * step 5, section 3.2, wireframe placement E and E2). They decide what the
 * item screen draws and says; the screen only renders them. No clock, no
 * device: the caller passes the run's settings, the test language and its
 * messages (`getMessages(testLocale)`).
 */

export type AssessmentFormat = AssessmentQuestion['format'];
type InstructionKey = keyof Messages['learner']['placement']['instruction'];

const INSTRUCTION_KEY: Readonly<Record<AssessmentFormat, InstructionKey>> = {
  'shape-odd-one-out': 'shapeOddOneOut',
  'hear-pick-written': 'hearPickWritten',
  'see-pick-sound': 'seePickSound',
  'build-syllable': 'buildSyllable',
  'hear-pick-picture': 'hearPickPicture',
  'read-pick-picture': 'readPickPicture',
  'reply-pick': 'replyPick',
};

/**
 * The formats that test letter forms or sounds (test T-leak, section 3.2): with
 * Korean as the test language their instruction is spoken and shown as icons
 * only, because a written Korean sentence would show the very letter forms
 * being tested. The word and sentence formats may show it.
 */
export const KO_SPOKEN_ONLY_FORMATS: readonly AssessmentFormat[] = [
  'shape-odd-one-out',
  'hear-pick-written',
  'see-pick-sound',
  'build-syllable',
];

export interface Instruction {
  /** The written line, or null when it is spoken only. */
  visible: string | null;
  /** What the instruction voice says (in the test language). */
  spoken: string;
}

export function instructionFor(m: Messages, format: AssessmentFormat, testLocale: UiLocale): Instruction {
  const line = m.learner.placement.instruction[INSTRUCTION_KEY[format]];
  const spokenOnly = testLocale === 'ko' && KO_SPOKEN_ONLY_FORMATS.includes(format);
  return { visible: spokenOnly ? null : line, spoken: line };
}

/** Formats whose prompt is heard (a speaker), not read. */
const HEARD: readonly AssessmentFormat[] = ['hear-pick-written', 'build-syllable', 'hear-pick-picture', 'reply-pick'];

export type PromptView =
  /** Shapes: the instruction is the whole prompt. */
  | { kind: 'none' }
  /** A large speaker; `text` is what the Korean voice says (`spokenKo` wins over `promptKo`). */
  | { kind: 'speaker'; text: string; audioRef?: string }
  /** Hangul drawn with `KoreanText`; the romanization only once revealed (empty string: no line). */
  | { kind: 'written'; ko: string; romanization: string };

export function promptView(question: AssessmentQuestion, revealed: boolean): PromptView {
  if (HEARD.includes(question.format)) {
    const text = question.spokenKo ?? question.promptKo ?? '';
    return question.audioRef === undefined ? { kind: 'speaker', text } : { kind: 'speaker', text, audioRef: question.audioRef };
  }
  if (question.promptKo === undefined) return { kind: 'none' };
  return { kind: 'written', ko: question.promptKo, romanization: revealed ? (question.promptRomanization ?? '') : '' };
}

/**
 * When a heard prompt cannot play mid-run (section 3.11): the words and the
 * reply line may be read instead ("No sound? Read it here."), because the
 * tested element is the meaning; a heard letter or syllable would be the
 * answer itself, so that question is recorded "not sure" and the run moves on.
 */
export function audioFallback(format: AssessmentFormat): 'text' | 'skip' {
  return format === 'hear-pick-picture' || format === 'reply-pick' ? 'text' : 'skip';
}

/**
 * What the item does once its heard prompt reports (section 3.11). `muted`
 * (sound switched off) and `unavailable` are handled alike mid-run: the words
 * or the reply are shown as text at once. A heard letter or syllable, which
 * would be the answer, is never skipped on a first failure (a slow voice start
 * reports `unavailable` too): the speaker asks for a tap (`retry`), and only a
 * second failure (`priorFailures` >= 1) skips the question.
 */
export function promptOutcome(
  result: 'played' | 'muted' | 'unavailable',
  format: AssessmentFormat,
  priorFailures: number,
): 'played' | 'text' | 'retry' | 'skip' {
  if (result === 'played') return 'played';
  if (audioFallback(format) === 'text') return 'text';
  return priorFailures >= 1 ? 'skip' : 'retry';
}

/** A prompt that cannot play: recorded skipped with `noSound` (kept out of scoring), never a "not sure" of the learner. */
export const NO_SOUND_SKIP: PlacementEvent = { type: 'notSure', cause: 'no-sound' };

/**
 * What is said before the Korean prompt when the speaker is tapped. With a
 * screen reader on nothing auto-plays, so an instruction that is spoken only
 * (Korean as the test language, letter formats) is heard on the tap; a written
 * one the screen reader reads itself. The first tap after a resume replaces
 * playing on open, so it says the instruction that playing on open would have
 * said (Short shows none written).
 */
export function instructionOnTap(instruction: Instruction, input: { screenReader: boolean; needsGesture: boolean }): string | null {
  if (input.screenReader) return instruction.visible === null ? instruction.spoken : null;
  return input.needsGesture ? instruction.spoken : null;
}

/**
 * The romanization under the text fallback ("No sound? Read it here."): taught
 * Korean shows it (CLAUDE.md section 1), except on a prompt whose romanization
 * would give the answer away (`leaks`), which keeps it until "Show how it
 * sounds" unless the run always shows the guide (section 3.2).
 */
export function fallbackRomanization(
  question: Pick<AssessmentQuestion, 'leaks' | 'promptRomanization'>,
  input: { revealMode: 'tap' | 'always'; revealed: boolean },
): string {
  const shown = !question.leaks || input.revealMode === 'always' || input.revealed;
  return shown ? (question.promptRomanization ?? '') : '';
}

export interface OptionView {
  id: string;
  kind: 'picture' | 'korean' | 'sound';
  ko?: string;
  /** Empty string: no romanization line (hidden until "Show how it sounds", never in Short). */
  romanization: string;
  pictureRef?: string;
  /** A Latin sound chip: language-neutral, never translated. */
  sound?: string;
  /** The accessible name, in the test language. */
  label: string;
}

export interface OptionViewInput {
  revealed: boolean;
  mode: PlacementMode;
  testLocale: UiLocale;
  /** `getMessages(testLocale)`. */
  m: Messages;
  /** Defaults to the generated overlays (tests pass their own). */
  overlays?: Overlays;
}

/**
 * The 2 to 4 choice cards. A picture's accessible name is its meaning in the
 * test language (`options.<id>.gloss` of the `pitem:` overlay), except with
 * Korean as the test language, where it would equal the answer (section 3.2):
 * then it is only "Picture 2". The gloss is never drawn on the item.
 */
export function optionViews(question: AssessmentQuestion, input: OptionViewInput): OptionView[] {
  const localized =
    input.overlays === undefined
      ? localize(question, question.id, input.testLocale)
      : localize(question, question.id, input.testLocale, input.overlays);
  const showRomanization = input.revealed && input.mode !== 'short';
  return localized.options.map((option, index): OptionView => {
    if (option.pictureRef !== undefined) {
      const label =
        input.testLocale === 'ko' || option.en === undefined ? input.m.learner.placement.item.pictureChoice(index + 1) : option.en;
      return { id: option.id, kind: 'picture', romanization: '', pictureRef: option.pictureRef, label };
    }
    if (option.ko !== undefined) {
      const romanization = showRomanization ? (option.romanization ?? '') : '';
      return { id: option.id, kind: 'korean', ko: option.ko, romanization, label: romanization === '' ? option.ko : `${option.ko}, ${romanization}` };
    }
    const sound = option.sound ?? option.id;
    return { id: option.id, kind: 'sound', romanization: '', sound, label: sound };
  });
}

/**
 * "Show how it sounds" (section 3.2): only when the run hides the sound guide
 * until tap, never in Short (P19), and only on an item whose romanization
 * would give the answer away and that has one to show.
 */
export function revealAvailable(question: AssessmentQuestion, config: { mode: PlacementMode; revealMode: 'tap' | 'always' }): boolean {
  if (config.mode === 'short' || config.revealMode !== 'tap' || !question.leaks) return false;
  return question.promptRomanization !== undefined || question.options.some((o) => o.romanization !== undefined);
}

/** "Question, 4 choices": what a screen reader announces as focus lands on the prompt. */
export function questionLabel(m: Messages, question: AssessmentQuestion): string {
  return m.learner.placement.item.questionLabel(question.options.length);
}

const PROMPT_BASE_MS = 600;
const PROMPT_PER_CHAR_MS = 350;

/** A spoken prompt's estimated length, for the Short fallback delay (`choicesFallbackMs`). */
export function estimatedPromptMs(text: string): number {
  return PROMPT_BASE_MS + PROMPT_PER_CHAR_MS * [...text.replace(/\s+/g, '')].length;
}

/**
 * The Short item layout (wireframe E2, AM-21): portrait keeps the 2 x 2 grid
 * without scrolling; landscape uses two columns, and at a text size above the
 * default the grid scrolls while the prompt and "I am not sure" stay pinned.
 */
export function shortLayout(window: { width: number; height: number }, fontScale: number): 'portrait' | 'landscape' | 'landscape-scroll' {
  if (window.width <= window.height) return 'portrait';
  return fontScale > 1 ? 'landscape-scroll' : 'landscape';
}

/** Content narrower than this, or text above this scale, stacks the cards of Standard and Deep in one column. */
export const TWO_COLUMN_MIN_WIDTH = 280;
export const TWO_COLUMN_MAX_FONT_SCALE = 1.3;

/** Short keeps its 2 x 2 grid; Standard and Deep stack on a narrow window or at a large text size. */
export function choiceColumns(input: { mode: PlacementMode; contentWidth: number; fontScale: number }): 1 | 2 {
  if (input.mode === 'short') return 2;
  return input.contentWidth >= TWO_COLUMN_MIN_WIDTH && input.fontScale <= TWO_COLUMN_MAX_FONT_SCALE ? 2 : 1;
}
