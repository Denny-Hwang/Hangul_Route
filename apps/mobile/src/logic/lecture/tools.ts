import type { RomanizationMode } from '@hangul-route/content-schema';
import type { UiLocale } from '@hangul-route/i18n';
import type { LanguageOption } from '../locale/language-picker';
import type { QuizOption, SlideKind } from './build-steps';
import type { PresenterEvent, PresenterState } from './controls';
import type { Slide } from './deck-builder';
import { TIMER_PRESETS_MS, formatRemaining, ringFraction, type TimerState } from './timer';

/**
 * The class tools of F-TCH-004 PR 9 (spec sections 3.5, 3.7, 3.8, 3.14; design/screens/presenter/
 * overlays.md, slide-quiz.md, stage-and-bar.md): pure decisions the overlays, the quiz slide and
 * the control bar draw. Teacher tools only (TD5): nothing here counts, ranks or remembers a
 * learner, and the telemetry names carry the tool and nothing else.
 */

// --- lecture.tool_used --------------------------------------------------------------------------

/**
 * The `tool` values this presenter sends in `lecture.tool_used` (section 3.14). The helper picker
 * is gone (LV-H): `picker` stays on the Worker's allow-list for presenters a device still has
 * cached, and this build never sends it.
 */
export const TOOL_NAMES = ['timer', 'blank', 'pause', 'grid', 'fullscreen'] as const;
export type LectureTool = (typeof TOOL_NAMES)[number];

const OVERLAY_TOOLS: ReadonlySet<string> = new Set<LectureTool>(['blank', 'pause', 'grid']);

type ToolState = Pick<PresenterState, 'overlay' | 'timerOpen'>;

/** The class tools a step opened: a covering tool that is now open and was not, and the timer coming on screen. */
export function toolsOpened(before: ToolState, after: ToolState): LectureTool[] {
  const out: LectureTool[] = [];
  if (after.overlay !== null && after.overlay !== before.overlay && OVERLAY_TOOLS.has(after.overlay)) out.push(after.overlay as LectureTool);
  if (after.timerOpen && !before.timerOpen) out.push('timer');
  return out;
}

/** Each tool is reported on its first use in a lecture only. */
export function firstUses(used: ReadonlySet<LectureTool>, tools: readonly LectureTool[]): { used: ReadonlySet<LectureTool>; fresh: LectureTool[] } {
  const fresh = tools.filter((tool, i) => !used.has(tool) && tools.indexOf(tool) === i);
  if (fresh.length === 0) return { used, fresh };
  return { used: new Set([...used, ...fresh]), fresh };
}

// --- voice fallbacks ------------------------------------------------------------------------------

/**
 * The teacher-says text ("Say it:", the spoken syllable and its romanization) replaces the speaker
 * when the room cannot hear the Korean (section 3.7): no Korean voice, the deck's sound off, the
 * device muted, or a slide the builder already marked `textPrompt`.
 */
export function sayItShown(input: { textPrompt: boolean; canPlay: boolean; muted: boolean; sound: boolean }): boolean {
  return input.textPrompt || !input.canPlay || input.muted || !input.sound;
}

/**
 * Quiz options' romanization, for every quiz slide and story check alike (D2; slide-quiz.md):
 * visible by default, with the question; with the teacher's `tap` setting it waits for the answer
 * build.
 */
export function optionRomShown(romanization: RomanizationMode, revealed: boolean): boolean {
  return romanization === 'always' || revealed;
}

/** What one option card draws, and at which presenter size (slide-quiz.md "Options"). */
export interface OptionContent {
  ko: { text: string; romanization?: string; size: 'display' | 'prompt' } | null;
  gloss: { text: string; size: 'prompt' | 'body' } | null;
}

/**
 * A letter or word at `presenter.size.display` with its romanization, or a gloss at
 * `presenter.size.prompt`. A story check's word option keeps its gloss under it, so the word drops
 * to prompt size and the gloss to body size, and both fit the card.
 */
export function optionContent(option: QuizOption): OptionContent {
  const withGloss = option.ko !== undefined && option.gloss !== undefined;
  const ko =
    option.ko === undefined
      ? null
      : { text: option.ko, ...(option.romanization !== undefined ? { romanization: option.romanization } : {}), size: withGloss ? ('prompt' as const) : ('display' as const) };
  const gloss = option.gloss === undefined ? null : { text: option.gloss, size: withGloss ? ('body' as const) : ('prompt' as const) };
  return { ko, gloss };
}

/**
 * Full screen (F or the bar's button): enter when not in it, leave when in it. Both directions are
 * a use of the tool; Start already entered full screen, so a first press usually leaves it.
 */
export function fullscreenToggle(isFull: boolean): { action: 'enter' | 'exit'; tools: LectureTool[] } {
  return { action: isFull ? 'exit' : 'enter', tools: ['fullscreen'] };
}

/** The Help overlay's Presenter language chips (section 3.12): drawn only when the build offers two or more locales. */
export function helpLanguageChips(languages: readonly LanguageOption[]): { value: UiLocale; label: string; lang: string }[] | null {
  if (languages.length < 2) return null;
  return languages.map((o) => ({ value: o.locale, label: o.endonym, lang: o.htmlLang }));
}

/** The control bar's status chips (stage-and-bar.md); nothing about a learner ever shows there. */
export type StatusChip = 'sound-off' | 'no-voice' | 'offline' | 'update';

export function statusChips(input: { voice: 'ready' | 'none' | 'unknown'; muted: boolean; online: boolean; updateWaiting: boolean }): StatusChip[] {
  const out: StatusChip[] = [];
  if (input.muted) out.push('sound-off');
  // Muted, the one sound chip reads "Sound is off" (section 3.7); the no-voice chip follows once sound is on.
  if (input.voice === 'none' && !input.muted) out.push('no-voice');
  if (!input.online) out.push('offline');
  if (input.updateWaiting) out.push('update');
  return out;
}

// --- the slide grid --------------------------------------------------------------------------------

export interface GridItem {
  /** Index into the run's slides (the `goto` target). */
  idx: number;
  /** The slide number shown (1-based). */
  n: number;
  key: string;
  kind: SlideKind;
  /** UI-language text only: no Korean, no names, no notes; nothing for a quiz (it would give the answer). */
  title: string;
  now: boolean;
  hidden: boolean;
  /** The End slide always stays (section 3.5 amendment point 4). */
  canHide: boolean;
}

function gridTitle(slide: Slide, names: { activity: (preset: Extract<Slide, { kind: 'activity' }>['preset']) => string }): string {
  switch (slide.kind) {
    case 'title':
    case 'card':
      return slide.title;
    case 'letter':
    case 'syllable':
      return slide.romanization;
    case 'vocab':
      return slide.word.gloss;
    case 'sequence':
      return slide.steps[0]?.gloss ?? '';
    case 'activity':
      return names.activity(slide.preset);
    case 'story':
      return slide.caption ?? '';
    default:
      return '';
  }
}

export function gridItems(
  slides: readonly Slide[],
  state: Pick<PresenterState, 'slideIdx' | 'skipped'>,
  names: { activity: (preset: Extract<Slide, { kind: 'activity' }>['preset']) => string },
): GridItem[] {
  return slides.map((slide, idx) => ({
    idx,
    n: idx + 1,
    key: slide.key,
    kind: slide.kind,
    title: gridTitle(slide, names),
    now: idx === state.slideIdx,
    hidden: state.skipped.has(slide.key),
    canHide: idx !== slides.length - 1,
  }));
}

// --- the class timer ------------------------------------------------------------------------------

export interface TimerView {
  /** m:ss left. */
  text: string;
  /** 0..1, only grows (TD5). */
  fraction: number;
  running: boolean;
  done: boolean;
  /** The preset this run is (outlined in the full timer); null after +30 s or none. */
  preset: number | null;
}

export function timerView(state: TimerState): TimerView {
  const preset = (TIMER_PRESETS_MS as readonly number[]).includes(state.totalMs) ? state.totalMs : null;
  return {
    text: formatRemaining(state.remainingMs),
    fraction: ringFraction(state),
    running: state.status === 'running',
    done: state.status === 'done',
    preset,
  };
}

/**
 * What T (or the bar's Timer) asks the reducer for: a timer that has no time yet opens full
 * screen, where the presets are; otherwise T toggles the timer in its own mode (section 3.5).
 */
export function timerOpenEvent(state: Pick<PresenterState, 'timerOpen'>, timer: Pick<TimerState, 'totalMs'>): PresenterEvent {
  return !state.timerOpen && timer.totalMs === 0 ? { timerMode: 'full' } : { overlay: 'timer' };
}

/**
 * Whether a story's Read-to-me stops at this step: it never runs on into the next slide, nor under
 * a covering overlay, nor under the full-screen timer (which covers the slide with no overlay set,
 * as when T opens a timer with no time yet). The corner timer leaves the slide in view, so it plays on.
 */
export function narrationStops(
  before: Pick<PresenterState, 'slideIdx' | 'overlay' | 'timerOpen' | 'timerMode'>,
  state: Pick<PresenterState, 'slideIdx' | 'overlay' | 'timerOpen' | 'timerMode'>,
): boolean {
  const fullBefore = before.timerOpen && before.timerMode === 'full';
  const fullNow = state.timerOpen && state.timerMode === 'full';
  return state.slideIdx !== before.slideIdx || (state.overlay !== null && before.overlay === null) || (fullNow && !fullBefore);
}

/** A preset's label: "30 s" or "3 min" (the catalogue strings take the number). */
export function presetLabel(ms: number): { unit: 's' | 'min'; n: number } {
  return ms < 60_000 ? { unit: 's', n: Math.round(ms / 1000) } : { unit: 'min', n: Math.round(ms / 60_000) };
}

// --- chip groups -----------------------------------------------------------------------------------

/**
 * A radiogroup's arrow keys (README D19): arrows move the selection and wrap, Home and End jump.
 * Null for any other key, which keeps its presenter meaning.
 */
export function radioMove<T>(options: readonly T[], selected: T, key: string): T | null {
  if (options.length === 0) return null;
  const at = Math.max(0, options.indexOf(selected));
  const from = options.indexOf(selected) === -1 ? -1 : at;
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return options[(from + 1) % options.length]!;
    case 'ArrowLeft':
    case 'ArrowUp':
      return options[(at - 1 + options.length) % options.length]!;
    case 'Home':
      return options[0]!;
    case 'End':
      return options[options.length - 1]!;
    default:
      return null;
  }
}
