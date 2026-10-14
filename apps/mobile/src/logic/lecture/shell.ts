import { decodeDeck, type LectureDeck, type LectureDecodeFailure } from '@hangul-route/content-schema';
import type { AudioCapability } from '../audio/capability';
import { canPlayKorean } from '../audio/capability';
import type { KoLine, SlideKind } from './build-steps';
import { blockKeyOf, type ExpandedDeck, type Slide, type SkipReason } from './deck-builder';
import type { PresenterState } from './controls';
import type { RecentList } from './recent';

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
 * What `/present` opens. A deck fragment wins (a link from the console or a copied link); without
 * one, the lesson this tab had open before a reload comes back from Recent at the slide that was
 * open (`openId` is the deck id the tab's history entry holds); otherwise the presenter home.
 */
export function resolveBoot(raw: string | null, openId: string | null, recent: RecentList): BootResult {
  if (raw !== null) {
    const decoded = decodeDeck(raw);
    if (!decoded.ok) return { kind: 'invalid', reason: decoded.reason };
    return { kind: 'deck', deck: decoded.deck, source: decoded.deck.source === 'quick' ? 'quick' : 'console' };
  }
  const open = openId === null ? undefined : recent.items.find((item) => item.deck.id === openId);
  if (!open) return { kind: 'home' };
  return { kind: 'deck', deck: open.deck, source: 'recent', ...(open.lastSlideKey !== undefined ? { resumeKey: open.lastSlideKey } : {}) };
}

// --- the slides this build draws ------------------------------------------------------------------

/** Slide kinds the presenter shell draws (PR 6); PRs 7, 9 and 11 add theirs. */
export const SHELL_SLIDE_KINDS: ReadonlySet<SlideKind> = new Set<SlideKind>(['title', 'letter', 'end']);

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
  // A story title shows its cover scene (story slides, PR 11).
  return !(slide.kind === 'title' && slide.cover !== undefined);
}

/**
 * The run: the expanded slides this build can draw, in order. A slide it cannot draw yet is not
 * shown and counts as a skipped part (`unsupported-step`), consecutive slides of one block and
 * kind as one part, so the start screen's count stays honest. With nothing left but the End slide
 * the run is empty (the invalid-deck screen, section 3.3 rule 10).
 */
export function runDeck(deck: Pick<LectureDeck, 'blocks'>, expanded: ExpandedDeck, kinds: ReadonlySet<SlideKind> = SHELL_SLIDE_KINDS): RunDeck {
  const parts: SkipPart[] = expanded.skipped.map((s) => ({ blockIndex: s.blockIndex, reason: s.reason }));
  const slides: Slide[] = [];
  let minutes = expanded.minutes;
  let last: { blockIndex: number | null; kind: SlideKind } | null = null;
  for (const slide of expanded.slides) {
    if (drawable(slide, kinds)) {
      slides.push(slide);
      last = null;
      continue;
    }
    if (slide.kind === 'quiz') minutes -= 1;
    if (slide.kind === 'activity') minutes -= slide.minutes;
    const blockIndex = blockIndexOfSlide(deck, slide.key);
    if (last === null || last.blockIndex !== blockIndex || last.kind !== slide.kind) {
      parts.push({ blockIndex, reason: 'unsupported-step' });
    }
    last = { blockIndex, kind: slide.kind };
  }
  const empty = !slides.some((s) => s.kind !== 'end');
  return { slides: empty ? [] : slides, parts, minutes: Math.max(0, minutes) };
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
 * One step of the End slide's fit (README D7): the list starts with every item shown and drops
 * one at a time while the drawn rows exceed `maxRows` (the "+ n more" pill takes the rest).
 */
export function fitShown(shown: number, rowsUsed: number, maxRows: number): number {
  return rowsUsed > maxRows && shown > 0 ? shown - 1 : shown;
}

// --- accessibility -------------------------------------------------------------------------------

/** The slide's own words for the live region ("g/k" of a letter), after its kind label; '' when none. */
export function slideDetail(slide: Slide): string {
  switch (slide.kind) {
    case 'title':
      return slide.title;
    case 'letter':
      return `${slide.char}, ${slide.romanization}`;
    default:
      return '';
  }
}

// --- telemetry -----------------------------------------------------------------------------------

export interface StartPayload {
  source: StartSource;
  blocks: number;
  slides: number;
  skipped: number;
  picker: 'none' | 'names' | 'initials' | 'numbers';
  romanization: 'always' | 'tap';
  voice: 'ready' | 'none' | 'unknown';
  offlineReady: boolean;
}

export function voiceState(capability: AudioCapability): StartPayload['voice'] {
  if (canPlayKorean(capability)) return 'ready';
  return capability.tts.state === 'none' ? 'none' : 'unknown';
}

/** `lecture.start` (section 3.14): counts and modes only. `picker` is the mode the lesson runs with. */
export function startPayload(input: {
  deck: Pick<LectureDeck, 'blocks' | 'options' | 'picker'>;
  run: RunDeck;
  source: StartSource;
  pickerMode: StartPayload['picker'];
  capability: AudioCapability;
  offlineReady: boolean;
}): StartPayload {
  return {
    source: input.source,
    blocks: input.deck.blocks.length,
    slides: input.run.slides.length,
    skipped: input.run.parts.length,
    picker: input.pickerMode,
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
