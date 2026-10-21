import { decodeDeck, SLOT_MARKER, type ActivityPreset, type LectureDeck, type LectureDecodeFailure, type LecturePreset, type UiLocale } from '@hangul-route/content-schema';
import type { AudioCapability } from '../audio/capability';
import { canPlayKorean } from '../audio/capability';
import type { PlayResult } from '../audio/controller';
import type { KoLine, SlideKind } from './build-steps';
import { blockKeyOf, type ExpandedDeck, type Slide, type SkipReason } from './deck-builder';
import type { PresenterState } from './controls';
import type { RecentItem, RecentList } from './recent';
import { buildLineWords, buildMove, buildWholeWords, sentenceBuildView, typeCue, writeMove } from './slide-view';
import { SWIPE_MIN, SWIPE_RATIO, TAP_BACK_FRACTION } from './stage-constants';

/**
 * The presenter shell's pure decisions (F-TCH-004 sections 3.2, 3.3, 3.5, 3.14): what the boot
 * opens, which slides this build draws, the start screen's skipped parts, the End slide's lists,
 * the live-region detail of a slide, and the `lecture.*` telemetry payloads. No names, labels or
 * deck title ever reach a payload.
 */

// --- boot ---------------------------------------------------------------------------------------

/**
 * Where a start came from (`lecture.start` `source`, AMENDMENTS-LECTURE-V2 section 11): a link
 * (`console`, or `quick` for a deck built outside the console with `source: 'quick'`), the
 * presenter's own Customize (`quick`), Recent (`recent`), or a ready-made lesson (`preset`): one
 * the presenter resolved itself (its in-session state) or a v2 deck that names its `preset`.
 */
export type StartSource = 'console' | 'quick' | 'recent' | 'preset';

export type BootResult =
  | { kind: 'deck'; deck: LectureDeck; source: StartSource; resumeKey?: string; preset?: LecturePreset }
  | { kind: 'invalid'; reason: LectureDecodeFailure }
  | { kind: 'home' };

/**
 * What `/present` opens. `address` is the deck the tab holds: from a link (`#d=`), or kept in the
 * tab's history entry across a reload (`reloaded`). A reloaded deck that is in Recent is a Recent
 * start and resumes at its open slide, unless the teacher chose Start over (`fresh`); otherwise
 * the deck starts fresh. A deck that names its preset (v2), or a reloaded start screen of a
 * ready-made lesson this presenter resolved (`preset`, kept in its history entry), is a `preset`
 * start; any other link counts by the deck's `source` (`quick` stays `quick`, everything else is
 * `console`). No deck: the presenter home.
 */
export function resolveBoot(address: { raw: string; reloaded: boolean; fresh?: true; preset?: LecturePreset } | null, recent: RecentList): BootResult {
  if (address === null) return { kind: 'home' };
  const decoded = decodeDeck(address.raw);
  if (!decoded.ok) return { kind: 'invalid', reason: decoded.reason };
  const deck = decoded.deck;
  const preset = deck.preset ?? (address.reloaded ? address.preset : undefined);
  const known = address.reloaded ? recent.items.find((item) => item.deck.id === deck.id) : undefined;
  if (!known) {
    if (preset !== undefined) return { kind: 'deck', deck, source: 'preset', preset };
    return { kind: 'deck', deck, source: deck.source === 'quick' ? 'quick' : 'console' };
  }
  if (address.fresh || known.lastSlideKey === undefined) return { kind: 'deck', deck, source: 'recent' };
  return { kind: 'deck', deck, source: 'recent', resumeKey: known.lastSlideKey };
}

// --- the presenter home (PR 8) ---------------------------------------------------------------------

/**
 * A start from the presenter home: a Recent row's Resume or Start over, Build lesson under
 * Customize (section 3.12), or a ready-made lesson's Start (AMENDMENTS-LECTURE-V2 section 4).
 */
export type HomeChoice =
  | { kind: 'resume'; item: RecentItem }
  | { kind: 'start-over'; item: RecentItem }
  | { kind: 'quick'; deck: LectureDeck }
  | { kind: 'preset'; deck: LectureDeck; preset: LecturePreset };

/** The start screen a home choice opens; Resume carries the row's saved slide, Start over drops it; a preset keeps its id. */
export function homeStart(choice: HomeChoice): { kind: 'ready'; deck: LectureDeck; source: StartSource; resumeKey?: string; preset?: LecturePreset } {
  if (choice.kind === 'quick') return { kind: 'ready', deck: choice.deck, source: 'quick' };
  if (choice.kind === 'preset') return { kind: 'ready', deck: choice.deck, source: 'preset', preset: choice.preset };
  const { deck, lastSlideKey } = choice.item;
  if (choice.kind === 'resume' && lastSlideKey !== undefined) return { kind: 'ready', deck, source: 'recent', resumeKey: lastSlideKey };
  return { kind: 'ready', deck, source: 'recent' };
}

/**
 * The presenter's own language, for its chrome (home, start screen, bar, overlays, Exit; owner items
 * 6 and 7): the device record's language, as everywhere else on this device. The chrome never
 * follows the deck. A locale this build does not offer falls back to English.
 */
export function presenterLocale(input: { device: UiLocale; available: readonly UiLocale[] }): UiLocale {
  return input.available.includes(input.device) ? input.device : 'en';
}

/**
 * The language the slides speak: the deck's `options.uiLocale` only when the deck was given one
 * explicitly (the console's Slides language, a deck saved with one), else the presenter's own
 * language. A deck language this build does not offer is passed over.
 */
export function slideLocale(input: { deck: LectureDeck | null; device: UiLocale; available: readonly UiLocale[] }): UiLocale {
  const fromDeck = input.deck?.options.uiLocale;
  if (fromDeck !== undefined && input.available.includes(fromDeck)) return fromDeck;
  return presenterLocale(input);
}

// --- the slides this build draws ------------------------------------------------------------------

/**
 * Slide kinds the presenter draws: the shell's (PR 6), the teaching slides (PR 7), the quizzes (PR 9),
 * the story slides (PR 11), the reading slides (AMENDMENTS-LECTURE-V2 LV-S1), the sentence builds (LV-S3) and
 * the write-together slides (LV-S4).
 */
export const SHELL_SLIDE_KINDS: ReadonlySet<SlideKind> = new Set<SlideKind>([
  'title',
  'letter',
  'syllable',
  'vocab',
  'sequence',
  'card',
  'quiz',
  'activity',
  'story',
  'end',
  'sentence',
  'pattern',
  'read-along',
  'realia',
  'sentence-build',
  'write-together',
]);

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

/**
 * A sentence's picture this build can draw: a `card:` ref the art draws or a `word:` key with a
 * WordArt glyph (README D9); any other ref (a swatch beside a sentence teaches nothing) is dropped.
 */
function sentencePictureDrawn(ref: string, drawnCardIds: readonly string[], drawnWordArtKeys: readonly string[]): boolean {
  if (ref.startsWith('card:')) return drawnCardIds.includes(ref);
  if (ref.startsWith('word:')) return drawnWordArtKeys.includes(ref.slice('word:'.length));
  return false;
}

function withoutUndrawnArt(slide: Slide, drawnCardIds?: readonly string[], drawnWordArtKeys?: readonly string[]): Slide {
  if (slide.kind === 'sentence') {
    // Only a run that knows what the art draws judges a sentence's picture (as a word card's, below).
    const { picture, ...rest } = slide;
    if (picture === undefined || drawnCardIds === undefined || drawnWordArtKeys === undefined) return slide;
    if (sentencePictureDrawn(picture, drawnCardIds, drawnWordArtKeys)) return slide;
    return { ...rest, builds: slide.builds.filter((b) => b !== 'art') };
  }
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
 * It names the whole slide on arrival, builds not yet revealed included (a reading slide's meanings and
 * key words too, as a vocab slide names its gloss): the live region speaks to
 * the presenter at the device, who holds the deck, not to the room, which sees only the stage.
 * A listen or reply question is named by its question (`names.listen`, `names.reply`), a realia
 * question by its own (LV-S2); never by an option, which would be the answer. A sentence build is
 * named by the question its stage shows at `reveal` (LV-S3): the next word (`names.build`) or the
 * ending that fits (`names.particle`), after the words already on the line, so a step back is heard
 * even when the question stays the same; at the whole build, where no question shows, by the
 * sentence with its romanization and meaning, as that build's move said it. Never by a tile still
 * in the bank: each move says its tile and the whole build the sentence (`buildLive`). With no
 * `reveal`, a build is named by its first question. A write-together slide (LV-S4) is named by what its
 * first build shows: a type round by its prompt and cue (`typeCue`), a trace round by its Korean word, a
 * frame by its line (`names.frame`), the name round by its own (`names.ownName`); never by an answer.
 * Each step forward on it then says what that build showed (`writeMove`).
 */
export function slideDetail(
  slide: Slide,
  names?: { activity: (preset: ActivityPreset) => string; slot?: string; listen?: string; reply?: string; build?: string; particle?: string; frame?: string; ownName?: string },
  reveal?: number,
): string {
  switch (slide.kind) {
    case 'sentence-build': {
      if (reveal === undefined) return names?.build ?? '';
      const { ask } = sentenceBuildView(slide, reveal);
      if (ask === null) return buildWholeWords(slide);
      const question = (ask === 'particle' ? (names?.particle ?? names?.build) : names?.build) ?? '';
      return [...buildLineWords(slide, reveal), question].filter((w) => w !== '').join(', ');
    }
    case 'write-together':
      switch (slide.variant) {
        case 'type':
          return typeCue(slide);
        case 'trace':
          // The Korean only: its romanization waits for the answer build in both modes.
          return slide.word.ko;
        case 'frame':
          return names?.frame ?? '';
        case 'own-name':
          return names?.ownName ?? '';
      }
      return '';
    case 'quiz':
      switch (slide.prompt.ask) {
        case 'listen':
          return (slide.prompt.reply === true ? names?.reply : names?.listen) ?? '';
        case 'reply':
          return names?.reply ?? '';
        case 'realia':
          return slide.prompt.text;
        default:
          return '';
      }
    case 'sentence':
      return `${slide.sentence.ko}, ${slide.sentence.romanization}, ${slide.sentence.gloss}`;
    case 'pattern': {
      // Each gap says its name ("gap", `a11y.presenter.slot`), never "underscore".
      const gap = (text: string): string => text.split(SLOT_MARKER).join(` ${names?.slot ?? SLOT_MARKER} `).replace(/\s+/g, ' ').replace(/ ([.,!?])/g, '$1').trim();
      return `${gap(slide.frame.pieces.join(SLOT_MARKER))}, ${gap(slide.frame.romanization)}, ${gap(slide.frame.gloss)}`;
    }
    case 'read-along':
      return slide.lines.map((l) => `${l.speaker}, ${l.ko}, ${l.romanization}, ${l.gloss}`).join(', ');
    case 'realia':
      // The sheet's own accessible text (F-CURR-001 §3.14), then each key word as a vocab slide names it.
      return [slide.sheet.alt, ...slide.keyWords.map((w) => `${w.ko}, ${w.romanization}, ${w.gloss}`)].join(', ');
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

/** What the live region says now: the slide and build it was worked out for, and a build's own words. */
export interface BuildLive {
  key: string;
  reveal: number;
  /** A sentence-build move's or a write-together build's words; absent: the slide's own announcement. */
  words?: string;
}

/**
 * The live region on a sentence-build or write-together slide (section 10): one step forward on the
 * same slide announces what it moved or showed (a sentence build: "{word} placed", `placed`, and the
 * sentence with its romanization and meaning at the whole build; a write-together slide: `writeMove`,
 * with `example` its "For example" label); arriving on a slide or stepping back says the slide again.
 * A redraw at the same build keeps what was said, so nothing is announced twice. Every other slide
 * always has its own announcement.
 */
export function buildLive(slide: Slide, reveal: number, previous: BuildLive | null, placed: (word: string) => string, example = ''): BuildLive {
  const now = { key: slide.key, reveal };
  if (previous !== null && previous.key === slide.key && previous.reveal === reveal) return previous;
  if (previous === null || previous.key !== slide.key || reveal !== previous.reveal + 1) return now;
  if (slide.kind === 'write-together') {
    const words = writeMove(slide, reveal, example);
    return words === null ? now : { ...now, words };
  }
  if (slide.kind !== 'sentence-build') return now;
  const move = buildMove(slide, reveal);
  if (move === null) return now;
  return { ...now, words: 'placed' in move ? placed(move.placed) : move.whole };
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

/** The line under Test the sound (what it plays: `soundCheckSpec` in `content.ts`, with the taught Korean). The voice line above it keeps its own wording, and Ready never waits for this. */
export type SoundCheckOutcome = 'played' | 'muted' | 'failed';

export function soundCheckOutcome(result: PlayResult): SoundCheckOutcome {
  if (result === 'played') return 'played';
  return result === 'muted' ? 'muted' : 'failed';
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
  /** Only with `source: 'preset'` (the Worker keeps it only then, section 11). */
  preset?: LecturePreset;
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

/**
 * `lecture.start` (section 3.14): counts and modes only. `picker` is always `'none'` (LV-H). A
 * `preset` start names its preset (the presenter's in-session one, else the v2 deck's own); no
 * other start carries one (AMENDMENTS-LECTURE-V2 section 11).
 */
export function startPayload(input: {
  deck: Pick<LectureDeck, 'blocks' | 'options'> & { preset?: LecturePreset };
  run: RunDeck;
  source: StartSource;
  preset?: LecturePreset;
  capability: AudioCapability;
  offlineReady: boolean;
}): StartPayload {
  const preset = input.source === 'preset' ? (input.preset ?? input.deck.preset) : undefined;
  return {
    source: input.source,
    ...(preset !== undefined ? { preset } : {}),
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
