import { decodeDeck, type ActivityPreset, type LectureDeck, type LectureDecodeFailure, type UiLocale } from '@hangul-route/content-schema';
import type { AudioCapability } from '../audio/capability';
import { canPlayKorean } from '../audio/capability';
import type { KoLine, SlideKind } from './build-steps';
import { blockKeyOf, type ExpandedDeck, type Slide, type SkipReason } from './deck-builder';
import type { PresenterState } from './controls';
import type { RecentItem, RecentList } from './recent';
import { SWIPE_MIN, SWIPE_RATIO, TAP_BACK_FRACTION } from './stage-constants';

/**
 * The presenter shell's pure decisions (F-TCH-004 sections 3.2, 3.3, 3.5, 3.14): what the boot
 * opens, which slides this build draws, the start screen's skipped parts, the End slide's lists,
 * the live-region detail of a slide, and the `lecture.*` telemetry payloads. No names, labels or
 * deck title ever reach a payload.
 */

// --- boot ---------------------------------------------------------------------------------------

export type StartSource = 'console' | 'quick' | 'recent';

export type BootResult =
  | { kind: 'deck'; deck: LectureDeck; source: StartSource; resumeKey?: string }
  | { kind: 'invalid'; reason: LectureDecodeFailure }
  | { kind: 'home' };

/**
 * What `/present` opens. `address` is the deck the tab holds: from a link (`#d=`), or kept in the
 * tab's history entry across a reload (`reloaded`). A reloaded deck that is in Recent is a Recent
 * start and resumes at its open slide, unless the teacher chose Start over (`fresh`); otherwise
 * the deck starts fresh. No deck: the presenter home.
 */
export function resolveBoot(address: { raw: string; reloaded: boolean; fresh?: true } | null, recent: RecentList): BootResult {
  if (address === null) return { kind: 'home' };
  const decoded = decodeDeck(address.raw);
  if (!decoded.ok) return { kind: 'invalid', reason: decoded.reason };
  const deck = decoded.deck;
  const linked: StartSource = deck.source === 'quick' ? 'quick' : 'console';
  const known = address.reloaded ? recent.items.find((item) => item.deck.id === deck.id) : undefined;
  if (!known) return { kind: 'deck', deck, source: linked };
  if (address.fresh || known.lastSlideKey === undefined) return { kind: 'deck', deck, source: 'recent' };
  return { kind: 'deck', deck, source: 'recent', resumeKey: known.lastSlideKey };
}

// --- the presenter home (PR 8) ---------------------------------------------------------------------

/** A start from the presenter home: a Recent row's Resume or Start over, or Build lesson (section 3.12). */
export type HomeChoice = { kind: 'resume'; item: RecentItem } | { kind: 'start-over'; item: RecentItem } | { kind: 'quick'; deck: LectureDeck };

/** The start screen a home choice opens; Resume carries the row's saved slide, Start over drops it. */
export function homeStart(choice: HomeChoice): { kind: 'ready'; deck: LectureDeck; source: StartSource; resumeKey?: string } {
  if (choice.kind === 'quick') return { kind: 'ready', deck: choice.deck, source: 'quick' };
  const { deck, lastSlideKey } = choice.item;
  if (choice.kind === 'resume' && lastSlideKey !== undefined) return { kind: 'ready', deck, source: 'recent', resumeKey: lastSlideKey };
  return { kind: 'ready', deck, source: 'recent' };
}

/**
 * The presenter's language (sections 3.12 and 3.13): a language chip chosen in this session
 * (memory only, the device locale is never written), else the deck's `options.uiLocale`, else
 * the device locale. A locale this build does not offer is passed over at every step.
 */
export function presenterLocale(input: { deck: LectureDeck | null; session: UiLocale | null; device: UiLocale; available: readonly UiLocale[] }): UiLocale {
  if (input.session !== null && input.available.includes(input.session)) return input.session;
  const fromDeck = input.deck?.options.uiLocale;
  if (fromDeck !== undefined && input.available.includes(fromDeck)) return fromDeck;
  return input.device;
}

// --- the slides this build draws ------------------------------------------------------------------

/** Slide kinds the presenter draws: the shell's (PR 6), the teaching slides (PR 7), the quizzes (PR 9) and the story slides (PR 11). */
export const SHELL_SLIDE_KINDS: ReadonlySet<SlideKind> = new Set<SlideKind>(['title', 'letter', 'syllable', 'vocab', 'sequence', 'card', 'quiz', 'activity', 'story', 'end']);

/** One line of the start screen's "not shown as slides" list: the block that holds it and why. */
export interface SkipPart {
  /** Index into `deck.blocks`; null for a part outside any block. */
  blockIndex: number | null;
  reason: SkipReason;
}

export interface RunDeck {
  slides: Slide[];
  parts: SkipPart[];
  minutes: number;
}

/** The block a slide came from: its key starts with the block key (`<blockKey>/<path>`, `#n` when repeated). */
export function blockIndexOfSlide(deck: Pick<LectureDeck, 'blocks'>, slideKey: string): number | null {
  const head = slideKey.split('/')[0]!;
  const seen = new Map<string, number>();
  for (let i = 0; i < deck.blocks.length; i += 1) {
    const base = blockKeyOf(deck.blocks[i]!);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    if ((n === 1 ? base : `${base}#${n}`) === head) return i;
  }
  return null;
}

function drawable(slide: Slide, kinds: ReadonlySet<SlideKind>): boolean {
  if (!kinds.has(slide.kind)) return false;
  if (slide.kind !== 'quiz' || slide.prompt.ask !== 'check') return true;
  // A story check is drawn by PR 11's StoryCheckSlide when its options are words; a check whose
  // options are pictures stays one "not shown as slides" part.
  return slide.options.every((o) => o.art === undefined);
}

/**
 * The run: the expanded slides this build can draw, in order. A slide it cannot draw yet is not
 * shown and counts as a skipped part (`unsupported-step`), consecutive slides of one block and
 * kind as one part, so the start screen's count stays honest. With nothing left but the End slide
 * the run is empty (the invalid-deck screen, section 3.3 rule 10). With `drawnCardIds` (the design
 * system's `supportedCardIds`), a word whose card the art cannot draw drops its `cardId` and so its
 * `art` build: the slide is text only and no press reveals nothing (also after the live
 * romanization flip, which recomputes builds from the slide). With `drawnWordArtKeys` (the design
 * system's `WORD_ART_KEYS`), a topic word whose WordArt key has no glyph drops its `wordArt` the
 * same way (README D9).
 */
export function runDeck(
  deck: Pick<LectureDeck, 'blocks'>,
  expanded: ExpandedDeck,
  kinds: ReadonlySet<SlideKind> = SHELL_SLIDE_KINDS,
  drawnCardIds?: readonly string[],
  drawnWordArtKeys?: readonly string[],
): RunDeck {
  const parts: SkipPart[] = expanded.skipped.map((s) => ({ blockIndex: s.blockIndex, reason: s.reason }));
  const slides: Slide[] = [];
  let minutes = expanded.minutes;
  // Only a quiz slide that counted a minute gives it back (rule 12): a quest's or story's own quiz
  // and check slides are inside its catalogue minutes.
  const timed = expanded.timedQuizKeys === undefined ? null : new Set(expanded.timedQuizKeys);
  let last: { blockIndex: number | null; kind: SlideKind } | null = null;
  for (const slide of expanded.slides) {
    if (drawable(slide, kinds)) {
      slides.push(withoutUndrawnArt(slide, drawnCardIds, drawnWordArtKeys));
      last = null;
      continue;
    }
    if (slide.kind === 'quiz' && (timed === null || timed.has(slide.key))) minutes -= 1;
    if (slide.kind === 'activity') minutes -= slide.minutes;
    const blockIndex = blockIndexOfSlide(deck, slide.key);
    if (last === null || last.blockIndex !== blockIndex || last.kind !== slide.kind) {
      parts.push({ blockIndex, reason: 'unsupported-step' });
    }
    last = { blockIndex, kind: slide.kind };
  }
  const empty = !slides.some((s) => s.kind !== 'end');
  // A run that has slides is never "about 0 minutes" (rule 12 as amended, LV-M1).
  return { slides: empty ? [] : slides, parts, minutes: empty ? 0 : Math.max(1, minutes) };
}

function withoutUndrawnArt(slide: Slide, drawnCardIds?: readonly string[], drawnWordArtKeys?: readonly string[]): Slide {
  if (slide.kind !== 'vocab') return slide;
  const cardUndrawn = drawnCardIds !== undefined && slide.cardId !== undefined && !drawnCardIds.includes(slide.cardId);
  const wordUndrawn = drawnWordArtKeys !== undefined && slide.wordArt !== undefined && !drawnWordArtKeys.includes(slide.wordArt);
  if (!cardUndrawn && !wordUndrawn) return slide;
  const { cardId, wordArt, ...rest } = slide;
  const kept = { ...rest, ...(cardId !== undefined && !cardUndrawn ? { cardId } : {}), ...(wordArt !== undefined && !wordUndrawn ? { wordArt } : {}) };
  const art = kept.cardId !== undefined || kept.wordArt !== undefined;
  return { ...kept, builds: art ? slide.builds : slide.builds.filter((b) => b !== 'art') };
}

/** The start screen's list: one line per lesson and reason (a lesson with four listening steps reads once; the count still counts parts). */
export function distinctParts(parts: readonly SkipPart[]): SkipPart[] {
  const out: SkipPart[] = [];
  for (const part of parts) if (!out.some((p) => p.blockIndex === part.blockIndex && p.reason === part.reason)) out.push(part);
  return out;
}

// --- the End slide -----------------------------------------------------------------------------

/**
 * Letters met in the lesson, one item per character: a letter taught twice (g/k as an initial,
 * k as a final) is one item with the reading it was first met with (README "Content
 * observations").
 */
export function endLetters(letters: readonly KoLine[]): KoLine[] {
  const out: KoLine[] = [];
  for (const letter of letters) if (!out.some((l) => l.ko === letter.ko)) out.push(letter);
  return out;
}

/**
 * Rows of a wrapping line of boxes (`y`, `height` from layout): a box that starts below the
 * bottom of the row so far opens a new row. Baseline alignment moves boxes of one row a few
 * pixels apart, so overlap, not equal tops, decides.
 */
export function countRows(boxes: readonly { y: number; height: number }[]): number {
  const sorted = [...boxes].sort((a, b) => a.y - b.y);
  let rows = 0;
  let bottom = -Infinity;
  for (const box of sorted) {
    if (box.y >= bottom) {
      rows += 1;
      bottom = box.y + box.height;
    } else {
      bottom = Math.max(bottom, box.y + box.height);
    }
  }
  return rows;
}

/**
 * One step of the End slide's fit (README D7): the list starts with every item shown and drops
 * one at a time while the drawn rows exceed `maxRows` (the "+ n more" pill takes the rest).
 */
export function fitShown(shown: number, rowsUsed: number, maxRows: number): number {
  return rowsUsed > maxRows && shown > 0 ? shown - 1 : shown;
}

// --- touch and mouse on the stage ------------------------------------------------------------------

/**
 * A pointer that went down and up on the stage (section 3.5): a horizontal swipe of at least
 * `SWIPE_MIN` with |dx| >= `SWIPE_RATIO` |dy| goes forward (to the left) or back; otherwise it is a
 * tap: the left third goes back, the rest forward. Anything else (a vertical drag) does nothing.
 */
export function gestureCommand(g: { x: number; width: number; dx: number; dy: number }): 'next' | 'prev' | null {
  const ax = Math.abs(g.dx);
  const ay = Math.abs(g.dy);
  if (ax >= SWIPE_MIN && ax >= SWIPE_RATIO * ay) return g.dx < 0 ? 'next' : 'prev';
  if (ax >= SWIPE_MIN || ay >= SWIPE_MIN || !(g.width > 0)) return null;
  return g.x < g.width * TAP_BACK_FRACTION ? 'prev' : 'next';
}

/**
 * A tap in the compact bar's strip at the bottom of a phone stage (F-TCH-004 section 3.6): it shows
 * the bar (or hides it while it shows) instead of stepping, so the bar is never brought up by a
 * step and a tap on a hidden bar presses nothing. A swipe that starts there still moves. `strip`:
 * the strip's height on the stage, in stage pixels (0: none).
 */
export function inBarStrip(g: { y: number; height: number; strip: number; dx: number; dy: number }): boolean {
  if (!(g.strip > 0) || !(g.height > 0)) return false;
  const swipe = Math.abs(g.dx) >= SWIPE_MIN || Math.abs(g.dy) >= SWIPE_MIN;
  return !swipe && g.y >= g.height - g.strip;
}

/** How much of the stage the bar's strip of `barHeight` covers: the strip sits on the window bottom, the stage `insetBottom + offsetY` above it. */
export function barOverlap(barHeight: number, insetBottom: number, offsetY: number): number {
  return Math.max(0, barHeight - Math.max(0, insetBottom) - Math.max(0, offsetY));
}

// --- accessibility -------------------------------------------------------------------------------

/**
 * The slide's own words for the live region ("g/k" of a letter), after its kind label; '' when none.
 * An activity is named by its preset, a catalogue string the caller passes (`names.activity`).
 * It names the whole slide on arrival, builds not yet revealed included: the live region speaks to
 * the presenter at the device, who holds the deck, not to the room, which sees only the stage.
 */
export function slideDetail(slide: Slide, names?: { activity: (preset: ActivityPreset) => string }): string {
  switch (slide.kind) {
    case 'title':
      return slide.title;
    case 'letter':
      return `${slide.char}, ${slide.romanization}`;
    case 'syllable':
      return `${slide.ko}, ${slide.romanization}`;
    case 'vocab':
      return `${slide.word.ko}, ${slide.word.romanization}, ${slide.word.gloss}`;
    case 'card':
      return slide.title;
    case 'activity':
      return names?.activity(slide.preset) ?? '';
    case 'story':
      // The scene caption: the art's accessible name (README D8).
      return slide.caption ?? '';
    default:
      return '';
  }
}

// --- start screen and stage ---------------------------------------------------------------------

/** The start screen's Korean voice line. `clips` is bundled audio with no named voice. */
export type VoiceCheck =
  | { kind: 'checking' }
  | { kind: 'local' | 'network'; name: string }
  | { kind: 'clips' }
  | { kind: 'needs-internet' }
  | { kind: 'none' };

/** `checked`: the first capability check finished, so an unknown voice now reads as none. */
export function voiceCheck(capability: AudioCapability, checked: boolean): VoiceCheck {
  const tts = capability.tts;
  if (tts.state === 'ready') return { kind: tts.local ? 'local' : 'network', name: tts.voiceName };
  if (capability.clips) return { kind: 'clips' };
  if (tts.state === 'none') return tts.reason === 'offline_network_only' ? { kind: 'needs-internet' } : { kind: 'none' };
  return checked ? { kind: 'none' } : { kind: 'checking' };
}

/**
 * The stroke guide that plays on the open slide (spec section 3.5 amendment point 2): it plays
 * only on a forward stroke reveal or a replay, and any other slide change drops it, so going
 * back to a complete slide is silent. `token` grows on every play, so a replay restarts it.
 */
export interface StrokePlay {
  slideKey: string;
  token: number;
}

export function nextStrokePlay(current: StrokePlay | null, change: { slideKey: string; play: boolean }): StrokePlay | null {
  if (change.play) return { slideKey: change.slideKey, token: (current?.token ?? 0) + 1 };
  return current !== null && current.slideKey === change.slideKey ? current : null;
}

/** The play token the slide gets: 0 (no guide mounted) unless the guide was played on it. */
export function strokeTokenFor(play: StrokePlay | null, slideKey: string | undefined): number {
  return play !== null && slideKey !== undefined && play.slideKey === slideKey ? play.token : 0;
}

// --- telemetry -----------------------------------------------------------------------------------

export interface StartPayload {
  source: StartSource;
  blocks: number;
  slides: number;
  skipped: number;
  /** Always `'none'`: the helper picker is gone (LV-H); the field stays for the Worker's payload rule. */
  picker: 'none';
  romanization: 'always' | 'tap';
  voice: 'ready' | 'none' | 'unknown';
  offlineReady: boolean;
}

export function voiceState(capability: AudioCapability): StartPayload['voice'] {
  if (canPlayKorean(capability)) return 'ready';
  return capability.tts.state === 'none' ? 'none' : 'unknown';
}

/** `lecture.start` (section 3.14): counts and modes only. `picker` is always `'none'` (LV-H). */
export function startPayload(input: {
  deck: Pick<LectureDeck, 'blocks' | 'options'>;
  run: RunDeck;
  source: StartSource;
  capability: AudioCapability;
  offlineReady: boolean;
}): StartPayload {
  return {
    source: input.source,
    blocks: input.deck.blocks.length,
    slides: input.run.slides.length,
    skipped: input.run.parts.length,
    picker: 'none',
    romanization: input.deck.options.romanization,
    voice: voiceState(input.capability),
    offlineReady: input.offlineReady,
  };
}

/** Slides seen and reveals made in this run, for `lecture.complete`. */
export interface RunTally {
  startedAt: number;
  shown: ReadonlySet<string>;
  reveals: number;
}

export function startTally(now: number, firstKey: string | undefined): RunTally {
  return { startedAt: now, shown: new Set(firstKey === undefined ? [] : [firstKey]), reveals: 0 };
}

/** Counts a move: a new slide joins `shown`; a later build of the same slide is one reveal. */
export function tallyStep(
  tally: RunTally,
  before: Pick<PresenterState, 'slideIdx' | 'reveal'>,
  after: Pick<PresenterState, 'slideIdx' | 'reveal'>,
  slides: readonly Pick<Slide, 'key'>[],
): RunTally {
  if (after.slideIdx !== before.slideIdx) {
    const key = slides[after.slideIdx]?.key;
    if (key === undefined || tally.shown.has(key)) return tally;
    return { ...tally, shown: new Set([...tally.shown, key]) };
  }
  return after.reveal > before.reveal ? { ...tally, reveals: tally.reveals + 1 } : tally;
}

/** `lecture.complete` (section 3.14): whole minutes since Start, never negative. */
export function completePayload(tally: RunTally, now: number): { slidesShown: number; minutes: number; reveals: number } {
  return { slidesShown: tally.shown.size, minutes: Math.max(0, Math.round((now - tally.startedAt) / 60_000)), reveals: tally.reveals };
}
