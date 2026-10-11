import type { KoText, SpeechLang, Story, StoryLevel } from '@hangul-route/content-schema';
import { romanizationShown, type Messages, type RomanizationMode, type UiLocale } from '@hangul-route/i18n';
import type { PlaySpec, PromptKind } from '../audio/controller';
import { HIGHLIGHT_AFTER_WRONG, type CheckState } from './check-player';
import { buildCheckView, type CheckView, type OptionView } from './check-view';

/**
 * View-models and small rules of the story check screen (F-STORY-003 §3.4,
 * §3.9, §3.10). `StoryCheckGame` only paints what these return and runs the
 * effects of `reduceCheck`; everything with a branch lives here so it is
 * unit-tested without a renderer. Words come in as the
 * `learner.story.check` subtree (F-I18N-001 PR 7b).
 */
export type CheckCopy = Messages['learner']['story']['check'];

/** Surface id of every prompt this screen plays (F-AUDIO-004 telemetry, `audio.fallback_shown`). */
export const STORY_CHECK_AUDIO_SOURCE = 'story-check';

/**
 * The items of one check step, in display form: every check of the tier in
 * authored order, or the scope's `checkIds` (subset and order override;
 * unknown ids are skipped). Empty without a story or for a level the story
 * lacks, which the screen turns into its one-line Continue state.
 */
export function checkGameItems(story: Story | undefined, level: StoryLevel, checkIds?: readonly string[]): CheckView[] {
  const tier = story?.tiers.find((t) => t.level === level);
  if (!story || !tier) return [];
  const checks = checkIds
    ? checkIds.flatMap((id) => tier.checks.find((c) => c.id === id) ?? [])
    : tier.checks;
  return checks.map((c) => buildCheckView(c, story.id));
}

// --- Speech ---------------------------------------------------------------

const SPEECH_LANG: Record<UiLocale, SpeechLang> = { en: 'en-US', es: 'es-US', ko: 'ko-KR' };

/** The voice of the UI locale (F-I18N-001 `LOCALE_META[locale].speechLang`). */
export function uiSpeechLang(locale: UiLocale): SpeechLang {
  return SPEECH_LANG[locale];
}

/**
 * The voice of a check string as shown: the UI voice when a locale overlay
 * replaced the English source, else English. An untranslated sentence is never
 * read in another language's voice (same rule as the reader's narration).
 */
export function speechLangOf(shown: string, source: string | undefined, ui: SpeechLang): SpeechLang {
  return source !== undefined && shown !== source ? ui : 'en-US';
}

/** A chunk worth speaking has a letter or a digit (not just "?" after a token). */
const SAYABLE = /[\p{L}\p{N}]/u;

function step(text: string, language: SpeechLang, kind: PromptKind, audioRef?: string): PlaySpec {
  const spec: PlaySpec = { text, language, kind, source: STORY_CHECK_AUDIO_SOURCE };
  if (audioRef) spec.audioRef = audioRef;
  return spec;
}

function koreanStep(text: Pick<KoText, 'ko' | 'spokenKo' | 'audioRef'>): PlaySpec {
  return step(text.spokenKo ?? text.ko, 'ko-KR', 'word', text.audioRef);
}

function promptText(item: CheckView): string {
  return item.promptParts.map((p) => ('text' in p ? p.text : '{target}')).join('');
}

export interface CheckSpeech {
  /** The prompt (the speaker, and "Read to me" when an item opens): English parts, the target in Korean. */
  question: PlaySpec[];
  /** The options in display order (the speaker reads them after the question). */
  options: PlaySpec[];
  /** The target's own speaker: its clip, else Korean TTS. */
  target: PlaySpec | null;
}

/**
 * What the check speakers say, as F-AUDIO-004 `PlaySpec`s for one chain
 * (`createAudioRunner`). `source` is the same item before the locale overlay,
 * which tells a translated string from an English one.
 */
export function checkSpeech(item: CheckView, source: CheckView | undefined, ui: SpeechLang): CheckSpeech {
  const promptLang = speechLangOf(promptText(item), source ? promptText(source) : undefined, ui);
  const question = item.promptParts.flatMap((part) => {
    if ('target' in part) return [koreanStep(part.target)];
    return SAYABLE.test(part.text) ? [step(part.text, promptLang, 'sentence')] : [];
  });
  if (item.target && !item.targetInline) question.push(koreanStep(item.target));

  const options = item.options.flatMap((o) => {
    const out: PlaySpec[] = [];
    if (o.ko !== undefined) out.push(step(o.ko, 'ko-KR', 'word'));
    if (o.en !== undefined) {
      const original = source?.options.find((s) => s.id === o.id)?.en;
      out.push(step(o.en, speechLangOf(o.en, original, ui), 'sentence'));
    }
    return out;
  });

  return { question, options, target: item.target ? koreanStep(item.target) : null };
}

// --- Options ----------------------------------------------------------------

export type OptionCardState = 'idle' | 'correct' | 'wrong' | 'hint' | 'disabled';

const resolved = (state: CheckState): boolean => state.phase !== 'answering';

/**
 * The `ChoiceCard` state of an option. Answering: a wrong tap locks that card
 * amber; after `HIGHLIGHT_AFTER_WRONG` misses the correct one gets the ring.
 * Resolved: the correct card shows its check, every other card disables.
 */
export function optionCardState(item: CheckView, optionId: string, state: CheckState): OptionCardState {
  const isCorrect = optionId === item.correctOptionId;
  if (resolved(state)) return isCorrect ? 'correct' : 'disabled';
  if (state.wrong.includes(optionId)) return 'wrong';
  if (isCorrect && state.wrong.length >= HIGHLIGHT_AFTER_WRONG) return 'hint';
  return 'idle';
}

export interface RomanizationContext {
  romanizationMode: RomanizationMode;
  /** The learner tapped "Show how to say it" on this item. */
  revealed: boolean;
}

export interface OptionCardView {
  id: string;
  state: OptionCardState;
  label?: string;
  ko?: string;
  /** '' draws no romanization line (hidden until tap, D2). */
  romanization: string;
  gloss?: string;
  /** Art ref (`card:…`); the screen draws it only when it resolves, else the label alone. */
  art?: string;
  /** The outcome written next to the card, so colour is never the only cue. */
  status: 'tryAnother' | 'correct' | null;
  accessibilityLabel: string;
}

function optionBase(o: OptionView, romanization: string, copy: CheckCopy): string {
  if (o.ko !== undefined) {
    const korean = romanization === '' ? o.ko : `${o.ko}, ${romanization}`;
    return o.en === undefined ? korean : `${korean}. ${o.en}`;
  }
  if (o.art !== undefined) return copy.pictureOptionLabel(o.en ?? '');
  return o.en ?? '';
}

/** Everything one option card draws, with its accessible name naming the outcome. */
export function optionCardView(
  item: CheckView,
  option: OptionView,
  state: CheckState,
  ctx: RomanizationContext & { copy: CheckCopy },
): OptionCardView {
  const cardState = optionCardState(item, option.id, state);
  const romanization =
    option.ko !== undefined && option.romanization !== undefined && romanizationShown(ctx.romanizationMode, ctx.revealed || resolved(state))
      ? option.romanization
      : '';
  const view: OptionCardView = { id: option.id, state: cardState, romanization, status: null, accessibilityLabel: '' };
  if (option.ko !== undefined) {
    view.ko = option.ko;
    if (option.en !== undefined) view.gloss = option.en;
  } else if (option.en !== undefined) {
    view.label = option.en;
  }
  if (option.art !== undefined) view.art = option.art;

  const base = optionBase(option, romanization, ctx.copy);
  if (cardState === 'wrong') {
    view.status = 'tryAnother';
    view.accessibilityLabel = `${base}. ${ctx.copy.tryAnother}`;
  } else if (cardState === 'correct') {
    view.status = 'correct';
    view.accessibilityLabel = `${base}. ${ctx.copy.correct}`;
  } else if (cardState === 'hint') {
    view.accessibilityLabel = `${base}. ${ctx.copy.lookHere}`;
  } else {
    view.accessibilityLabel = base;
  }
  return view;
}

/** Picture options sit in two columns (art ≥ 96 dp each); text and Korean options stack. */
export function checkOptionColumns(item: CheckView): 1 | 2 {
  return item.options.length > 0 && item.options.every((o) => o.art !== undefined) ? 2 : 1;
}

// --- Target and romanization -----------------------------------------------

export interface TargetView {
  ko: string;
  romanization: string;
  /** Absent while it would give the answer away (pick-meaning, fill-word, before the item resolves). */
  gloss?: string;
  /** The prompt holds the `{target}` token (else the target is a word card above the options). */
  inline: boolean;
}

/** The Korean the question is about, or null. */
export function targetView(item: CheckView, state: CheckState, ctx: RomanizationContext): TargetView | null {
  if (!item.target) return null;
  const done = resolved(state);
  const view: TargetView = {
    ko: item.target.ko,
    romanization: romanizationShown(ctx.romanizationMode, ctx.revealed || done) ? item.target.romanization : '',
    inline: item.targetInline,
  };
  if (!item.hideTargetGloss || done) view.gloss = item.target.en;
  return view;
}

/** Whether the item draws any taught Korean (a target or a Korean option). */
export function checkHasKorean(item: CheckView): boolean {
  return item.target !== undefined || item.options.some((o) => o.ko !== undefined);
}

/** "Show how to say it" is offered while Korean on the item still hides its romanization (D2 `tap`). */
export function revealNeeded(item: CheckView, state: CheckState, ctx: RomanizationContext): boolean {
  return checkHasKorean(item) && !romanizationShown(ctx.romanizationMode, ctx.revealed || resolved(state));
}

// --- Hoya, progress ----------------------------------------------------------

export interface CheckBubble {
  tone: 'cheering' | 'thinking';
  message: string;
}

/**
 * Hoya's line: nothing before the first tap; after a miss the hint (or the
 * default line), after the highlight a pointer to the ring; once resolved the
 * explanation (none when the check has no `explainEn`).
 */
export function checkBubble(item: CheckView, state: CheckState, copy: CheckCopy): CheckBubble | null {
  if (resolved(state)) return item.explainEn ? { tone: 'cheering', message: item.explainEn } : null;
  if (state.wrong.length === 0) return null;
  if (state.wrong.length >= HIGHLIGHT_AFTER_WRONG) return { tone: 'thinking', message: copy.lookHere };
  return { tone: 'thinking', message: item.hintEn ?? copy.defaultHint };
}

/** Fill-only progress: `value` grows when an item resolves and never drops; `position` is the item shown (1-based). */
export function checkProgress(state: CheckState, total: number): { value: number; position: number } {
  if (total === 0) return { value: 0, position: 0 };
  const value = Math.min(total, state.index + (resolved(state) ? 1 : 0));
  return { value, position: Math.min(total, state.index + 1) };
}

// --- Telemetry (§3.9: ids and counts only) ---------------------------------

export interface CheckIds {
  storyId: string | null;
  level: StoryLevel | null;
}

export interface CheckTally {
  /** Items answered right on the first tap. */
  firstTryCorrect: number;
  /** Taps after the first, across items. */
  retries: number;
}

export const EMPTY_CHECK_TALLY: CheckTally = Object.freeze({ firstTryCorrect: 0, retries: 0 });

export function tallyResolved(tally: CheckTally, e: { firstTry: boolean; taps: number }): CheckTally {
  return {
    firstTryCorrect: tally.firstTryCorrect + (e.firstTry ? 1 : 0),
    retries: tally.retries + Math.max(0, e.taps - 1),
  };
}

/** `story.check.answered`, when an item resolves. */
export function checkAnsweredPayload(
  ids: CheckIds,
  item: CheckView,
  e: { firstTry: boolean; taps: number },
): Record<string, unknown> {
  return { storyId: ids.storyId, level: ids.level, checkId: item.checkId, kind: item.kind, firstTry: e.firstTry, taps: e.taps };
}

/** `story.check.finished`, when the step ends (also with `items: 0` for an empty step). */
export function checkFinishedPayload(ids: CheckIds, items: number, tally: CheckTally): Record<string, unknown> {
  return { storyId: ids.storyId, level: ids.level, items, ...tally };
}
