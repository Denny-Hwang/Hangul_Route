import { SLOT_MARKER } from '@hangul-route/content-schema';
import type { FallbackReason, PlayResult } from '../audio/prompt-state';
import type { PromptKind } from '../audio/rate';
import type { SpokenForm } from '../audio/spoken';
import { joinSpoken, partsShown, type BuildName, type NarrationPiece, type QuizPrompt, type RealiaSheetView, type SequenceStep } from './build-steps';
import type { Slide } from './deck-builder';
import { SHEET_CARDS_W, SHEET_MAX_W, SHEET_ROOMY_LINES, SHEET_W } from './stage-constants';

/**
 * What the slides of F-TCH-004 PR 7 show at each build (section 3.4; design/screens/presenter/
 * slide-syllable.md, slide-vocab.md, slide-sequence.md, slide-card.md, slide-activity.md). Pure:
 * the slide components in `screens/presenter/slides/` draw these decisions and hold none of their
 * own. A build that is not reached keeps its space on the stage, so nothing shifts when it arrives;
 * the syllable's parts and the sequence's order question replace what was there (README D5).
 */

type Of<K extends Slide['kind']> = Extract<Slide, { kind: K }>;

/** The builds on screen: build 0 to the current reveal. */
export function shownBuilds(builds: readonly BuildName[], reveal: number): ReadonlySet<BuildName> {
  return new Set<BuildName>(builds.slice(0, reveal + 1));
}

/**
 * Romanization of the Korean revealed at `base`: with `romanization: 'tap'` it has a build of its
 * own (`rom`), otherwise it arrives with the Korean (owner decision D2, section 3.4).
 */
export function romShown(builds: readonly BuildName[], shown: ReadonlySet<BuildName>, base: BuildName): boolean {
  return builds.includes('rom') ? shown.has('rom') : shown.has(base);
}

export interface SyllableView {
  /** From `join`: the block at `presenter.size.glyph`, the parts small beside it (README D5). */
  joined: boolean;
  rom: boolean;
  sound: boolean;
}

export function syllableView(slide: Of<'syllable'>, reveal: number): SyllableView {
  const shown = shownBuilds(slide.builds, reveal);
  return { joined: shown.has('join'), rom: shown.has('rom'), sound: shown.has('sound') };
}

export type SequenceView =
  /** The steps in their true order, the first `count` of them on screen. */
  | { mode: 'steps'; count: number; rom: boolean }
  /** "What comes first?" over the builder's shuffled order (markers instead of numbers). */
  | { mode: 'order'; steps: SequenceStep[] };

export function sequenceView(slide: Of<'sequence'>, reveal: number): SequenceView {
  const shown = slide.builds.slice(0, reveal + 1);
  if (shown.includes('order')) {
    const byId = new Map(slide.steps.map((step) => [step.id, step]));
    const steps = slide.shuffled.map((id) => byId.get(id)).filter((step): step is SequenceStep => step !== undefined);
    return { mode: 'order', steps };
  }
  const count = shown.filter((b) => b === 'step').length;
  return { mode: 'steps', count, rom: romShown(slide.builds, new Set(shown), 'step') };
}

export interface CardView {
  /** The Korean chip's romanization (its own build with `tap`). */
  rom: boolean;
  fact: boolean;
}

export function cardView(slide: Of<'card'>, reveal: number): CardView {
  const shown = shownBuilds(slide.builds, reveal);
  return { rom: romShown(slide.builds, shown, 'art'), fact: shown.has('fact') };
}

/** A word's picture: a heritage card or a WordArt glyph (F-VOC-002). */
export type VocabArt = { kind: 'card'; cardId: string } | { kind: 'word'; key: string };

/**
 * A word's picture (section 3.4 `vocab`): the heritage card art when the word names a card the art
 * draws, else a topic word's WordArt when the glyph exists (README D9); none means the slide is
 * text only.
 */
export function vocabArt(slide: Of<'vocab'>, supportedCardIds: readonly string[], wordArtKeys: readonly string[]): VocabArt | undefined {
  if (slide.cardId !== undefined && supportedCardIds.includes(slide.cardId)) return { kind: 'card', cardId: slide.cardId };
  if (slide.wordArt !== undefined && wordArtKeys.includes(slide.wordArt)) return { kind: 'word', key: slide.wordArt };
  return undefined;
}

/**
 * The shape and number marker of position `index` (section 3.4: circle 1, triangle 2, square 3,
 * star 4), so the room answers "triangle, 2" and colour is never the only cue. Past four the
 * shapes repeat while the number keeps counting.
 */
export function markerFor<S extends string>(index: number, shapes: readonly S[]): { shape: S; n: number } {
  return { shape: shapes[index % shapes.length]!, n: index + 1 };
}

// --- the reading slides (AMENDMENTS-LECTURE-V2 section 5.2, LV-S1) ------------------------------

/** A part of a reading slide: on screen, and its romanization with it (`tap`: one build later). */
export interface PartView {
  shown: boolean;
  rom: boolean;
}

const HIDDEN: PartView = { shown: false, rom: false };

/** The `n`th shown part built by `name` (0-based), or hidden. */
function nthPart(builds: readonly BuildName[], reveal: number, name: BuildName, n = 0): PartView {
  const part = partsShown(builds, reveal).filter((p) => p.name === name)[n];
  return part ? { shown: true, rom: part.rom } : HIDDEN;
}

export interface SentenceView {
  /** The romanization under the Korean (its own build with `tap`). */
  rom: boolean;
  gloss: boolean;
  art: boolean;
}

/** Sentence slide (slide-sentence.md): the Korean at build 0, then the meaning, then the picture. */
export function sentenceView(slide: Of<'sentence'>, reveal: number): SentenceView {
  return { rom: nthPart(slide.builds, reveal, 'ko').rom, gloss: nthPart(slide.builds, reveal, 'gloss').shown, art: nthPart(slide.builds, reveal, 'art').shown };
}

export interface PatternView {
  frame: PartView;
  note: PartView;
  examples: PartView[];
}

/** Sentence pattern slide (slide-pattern.md): the frame, the note, then one example per build. */
export function patternView(slide: Of<'pattern'>, reveal: number): PatternView {
  return {
    frame: nthPart(slide.builds, reveal, 'frame'),
    note: nthPart(slide.builds, reveal, 'note'),
    examples: slide.examples.map((_, i) => nthPart(slide.builds, reveal, 'example', i)),
  };
}

export interface ReadAlongView {
  lines: PartView[];
  /**
   * The line Sound plays and lights: the last one on screen (V6). `null` when every line shows
   * together (no Korean voice, section 5.1): no line is lit, and Sound reads them all in order.
   */
  current: number | null;
}

/**
 * Read along slide (slide-read-along.md): one line per build; the current line is the last shown.
 * With no Korean voice (`together`) every line shows at the one `line` build.
 */
export function readAlongView(slide: Of<'read-along'>, reveal: number): ReadAlongView {
  if (slide.together === true) return { lines: slide.lines.map(() => nthPart(slide.builds, reveal, 'line')), current: null };
  const lines = slide.lines.map((_, i) => nthPart(slide.builds, reveal, 'line', i));
  return { lines, current: Math.max(0, lines.filter((l) => l.shown).length - 1) };
}

export interface RealiaView {
  /** The sheet's and the caption's romanization (one build after the sheet with `tap`). */
  sheetRom: boolean;
  words: boolean;
  wordsRom: boolean;
}

/** Realia slide (slide-realia.md): the sheet with its caption, then the key words as chips. */
export function realiaView(slide: Of<'realia'>, reveal: number): RealiaView {
  const words = nthPart(slide.builds, reveal, 'words');
  return { sheetRom: nthPart(slide.builds, reveal, 'sheet').rom, words: words.shown, wordsRom: words.rom };
}

/**
 * A realia sheet's lines on the stage: each line's romanization under its Korean (roomy), or, on a
 * sheet of more than `SHEET_ROOMY_LINES` lines, beside it, so the sheet fits the content area.
 */
export function sheetRoomy(sheet: Pick<RealiaSheetView, 'entries'>): boolean {
  return sheet.entries.length <= SHEET_ROOMY_LINES;
}

/**
 * A reading slide that fits itself (as the End slide measures its rows, README D7): drawn at level
 * 0, it steps one level more compact while its content is taller than the room the stage gives it
 * (a pixel of rounding allowed), up to `max`; it never steps back, so it cannot flicker. A level
 * makes long examples, lines and notes smaller, never below the stage text floor.
 */
export function nextFitLevel(input: { room: number; content: number; level: number; max: number }): number {
  const { room, content, level, max } = input;
  if (!(room > 0) || !(content > 0)) return level;
  return content > room + 1 && level < max ? level + 1 : level;
}

/**
 * The sheet's width on the stage, in units: price cards side by side take more room than a menu,
 * ticket or sign. `textScale` is how much bigger than its units the stage draws the sheet's small
 * text (the 18 px floor on a small phone, `presenter.size.caption` there): the sheet grows with it,
 * so its lines keep their layout, up to `SHEET_MAX_W`.
 */
export function sheetUnits(sheet: Pick<RealiaSheetView, 'kind'>, textScale = 1): number {
  const base = sheet.kind === 'price-card' ? SHEET_CARDS_W : SHEET_W;
  return Math.min(Math.max(base, SHEET_MAX_W), Math.round(base * Math.max(1, textScale)));
}

/** [ Start timer ] opens the class timer with the slide's minutes; it never starts by itself (TD5). */
export function activityTimerMs(slide: Of<'activity'>): number {
  return slide.minutes * 60_000;
}

/** What Sound plays on a slide and the speech rate it plays at (F-AUDIO-004 `RATE_BASE`). */
export interface SlideSound {
  spoken: SpokenForm;
  kind: PromptKind;
}

const wordSound = (ko: string, romanization: string): SlideSound => ({ spoken: { text: ko, romanization }, kind: 'word' });

const koStep = (step: SequenceStep): step is SequenceStep & { ko: string; romanization: string } => step.ko !== undefined && step.romanization !== undefined;

/** A question's sound: Match Sound its carrier syllable, a meaning question its word, a story check its target. */
function quizSound(prompt: QuizPrompt): SlideSound | undefined {
  switch (prompt.ask) {
    case 'sound':
      return { spoken: prompt.spoken, kind: 'sound' };
    case 'meaning':
      return wordSound(prompt.ko, prompt.romanization);
    case 'check':
      return prompt.target ? wordSound(prompt.target.ko, prompt.target.romanization) : undefined;
    case 'odd-one-out':
      // Its letters are the answer.
      return undefined;
  }
}

/** The Korean chips of a note or caption, in order, each once. */
function chipsSpoken(pieces: readonly NarrationPiece[]): SpokenForm[] {
  const seen = new Set<string>();
  const out: SpokenForm[] = [];
  for (const piece of pieces) {
    if (!('ko' in piece) || seen.has(piece.ko)) continue;
    seen.add(piece.ko);
    out.push({ text: piece.ko, romanization: piece.romanization });
  }
  return out;
}

/** A frame's text read aloud: its gaps and the `/` between two particles become pauses; a piece of only punctuation is dropped. */
function frameRead(text: string): string {
  return text
    .split(SLOT_MARKER)
    .flatMap((piece) => piece.split('/'))
    .map((piece) => piece.trim())
    .filter((piece) => /[^\s.,!?]/.test(piece))
    .join(', ');
}

/**
 * A pattern's frame as Sound reads it before any example shows: its own Korean, with a pause at each
 * gap and between two particles (a frame `___eul/reul meogeoyo` says eul, reul meogeoyo), and the same
 * for its romanization.
 */
export function frameSpoken(frame: Of<'pattern'>['frame']): SpokenForm {
  return { text: frameRead(frame.pieces.join(SLOT_MARKER)), romanization: frameRead(frame.romanization) };
}

/**
 * What Sound, S or a stage speaker plays on a slide (section 3.4 amendment 2026-10-17): the Korean
 * the slide draws. A letter's carrier syllable, a syllable and a Match Sound prompt play at the
 * sound rate; a word card its spoken form (`spokenKo` or the word, a Discover sentence at the
 * sentence rate); a heritage card its Korean chip; a word-to-meaning question its word; a story
 * check its target word; an order slide the last Korean step on screen at `reveal`, in the order
 * drawn (the shuffled order at the order question; the full reveal when `reveal` is not given).
 * A title, a story scene (Read-to-me has its own path, `readToMePlan`), an activity,
 * the End slide, Odd One Out (the letters are the answer), a card without Korean and a check
 * without a target play nothing. The reading slides (LV-S1): a sentence its sentence; a pattern
 * the last Korean part on screen (the last example, else the note's Korean chips at the word rate,
 * else the frame's own Korean with a pause at each gap); a read along its current line, or every
 * line in order when they show together (each at the sentence rate); a realia page its sheet line
 * by line and its caption's Korean chips and, once they show, its key words (at the word rate).
 */
export function slideSound(slide: Slide | undefined, reveal?: number): SlideSound | undefined {
  if (slide === undefined) return undefined;
  switch (slide.kind) {
    case 'letter':
    case 'syllable':
      return { spoken: slide.spoken, kind: 'sound' };
    case 'vocab':
      return { spoken: slide.spoken, kind: slide.speech };
    case 'card':
      return slide.ko !== undefined && slide.romanization !== undefined ? wordSound(slide.ko, slide.romanization) : undefined;
    case 'quiz':
      return quizSound(slide.prompt);
    case 'sequence': {
      // The steps on screen, in the order drawn (`sequenceView`): the story order while they build,
      // the shuffled order at the order question, so the sound never hints at the answer.
      const view = sequenceView(slide, reveal ?? slide.builds.length - 1);
      const steps = view.mode === 'order' ? view.steps : slide.steps.slice(0, view.count);
      const step = steps.filter(koStep).pop();
      return step ? { spoken: { text: step.ko, romanization: step.romanization }, kind: 'sentence' } : undefined;
    }
    case 'sentence':
      return { spoken: slide.sentence.spoken, kind: 'sentence' };
    case 'pattern': {
      // The last Korean part on screen: an example, else the note's Korean chips, else the frame's own Korean.
      const view = patternView(slide, reveal ?? slide.builds.length - 1);
      const example = slide.examples[view.examples.filter((e) => e.shown).length - 1];
      if (example) return { spoken: example.spoken, kind: 'sentence' };
      const chips = view.note.shown ? chipsSpoken(slide.note ?? []) : [];
      if (chips.length > 0) return { spoken: joinSpoken(chips), kind: 'word' };
      return { spoken: frameSpoken(slide.frame), kind: 'sentence' };
    }
    case 'read-along': {
      const { current } = readAlongView(slide, reveal ?? slide.builds.length - 1);
      return { spoken: current === null ? joinSpoken(slide.lines.map((l) => l.spoken)) : slide.lines[current]!.spoken, kind: 'sentence' };
    }
    case 'realia':
      // The sheet read line by line and then its caption's Korean chips; once they show, the key words in order.
      return realiaView(slide, reveal ?? slide.builds.length - 1).words
        ? { spoken: joinSpoken(slide.keyWords.map((w) => w.spoken)), kind: 'word' }
        : { spoken: joinSpoken([slide.sheet.spoken, ...chipsSpoken(slide.caption ?? [])]), kind: 'word' };
    case 'title':
    case 'story':
    case 'activity':
    case 'end':
      return undefined;
  }
}

/** What a Sound press, a forward `sound` build or a stage speaker does (section 3.7 amendment 2026-10-17). */
export type SoundPress = 'play' | 'unmute-then-play' | 'flash-no-sound' | 'flash-deck-sound-off' | 'skip';

/**
 * An explicit press (the bar's Sound, S, a stage speaker) always answers: while muted it turns the
 * device sound on and plays (the chip's Turn sound on, then the sound); in a deck set up with sound
 * off it flashes "Sound is off for this lesson."; on a slide with nothing to play it flashes "This
 * slide has no sound.". A forward `sound` build stays silent while muted (the Sound is off chip
 * says why) and never flashes.
 */
export function soundPress(input: { hasSound: boolean; explicit: boolean; muted: boolean; deckSound: boolean }): SoundPress {
  if (!input.deckSound) return input.explicit ? 'flash-deck-sound-off' : 'skip';
  if (!input.hasSound) return input.explicit ? 'flash-no-sound' : 'skip';
  if (input.muted) return input.explicit ? 'unmute-then-play' : 'skip';
  return 'play';
}

/**
 * The flash after an explicit press that did not play: no Korean voice shows the no-voice chip's
 * words; a blocked or failed voice "The sound did not play. You say it!". A played or muted result
 * flashes nothing (the Sound is off chip already shows).
 */
export function soundFlashFor(result: PlayResult, failureReason: FallbackReason | null): 'no-voice' | 'failed' | null {
  if (result === 'played' || result === 'muted') return null;
  return failureReason === 'no_voice' ? 'no-voice' : 'failed';
}

/** The `playPrompt` spec of a slide's sound (the presenter adds `source`). */
export function soundPrompt(sound: SlideSound): { text: string; audioRef?: string; kind: PromptKind } {
  const { text, audioRef } = sound.spoken;
  return audioRef !== undefined ? { text, audioRef, kind: sound.kind } : { text, kind: sound.kind };
}
