import { SLOT_MARKER } from '@hangul-route/content-schema';
import type { FallbackReason, PlayResult } from '../audio/prompt-state';
import type { PromptKind } from '../audio/rate';
import type { SpokenForm } from '../audio/spoken';
import type { RomanizationMode } from '@hangul-route/content-schema';
import {
  joinSpoken,
  partsShown,
  soundTablePages,
  type BuildName,
  type FrameText,
  type NarrationPiece,
  type QuizPrompt,
  type RealiaSheetView,
  type SequenceStep,
  type SheetText,
} from './build-steps';
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

// --- the sentence-build slide (AMENDMENTS-LECTURE-V2 section 5.2, LV-S3) ----------------------------

/** A place on the sentence line: empty (a dashed box), a placed tile, or a particle tile showing both endings. */
export type BuildLinePlace = 'empty' | 'placed' | 'choosing';

/** A place in the bank: its tile, the dashed ghost a placed tile leaves, or a distractor set back at the whole build. */
export type BuildBankPlace = 'tile' | 'ghost' | 'set-back';

export interface SentenceBuildView {
  /** One place per tile, in sentence order. */
  line: BuildLinePlace[];
  /** One place per bank item, in bank order: nothing in the bank moves (V9). */
  bank: BuildBankPlace[];
  /** The question over the line: the next word, the ending that fits, or none at the whole build. */
  ask: 'next' | 'particle' | null;
  /** The romanization and the meaning under the line. */
  whole: boolean;
}

/**
 * Sentence build slide (slide-sentence-build.md, V9): each `tile` build moves the next tile of the
 * sentence from the bank to the line, leaving its ghost; a particle tile shows both endings until its
 * `particle` build keeps the one that fits; at `whole` the romanization and the meaning appear and the
 * distractors are set back (never marked).
 */
export function sentenceBuildView(slide: Of<'sentence-build'>, reveal: number): SentenceBuildView {
  const shown = slide.builds.slice(0, Math.max(0, reveal + 1));
  const placed = shown.filter((b) => b === 'tile').length;
  const chosen = shown.filter((b) => b === 'particle').length;
  let particles = 0;
  const line = slide.tiles.map((tile, i): BuildLinePlace => {
    if (i >= placed) return 'empty';
    if (tile.particle === undefined) return 'placed';
    particles += 1;
    return particles > chosen ? 'choosing' : 'placed';
  });
  const whole = shown.includes('whole');
  const bank = slide.bank.map((place): BuildBankPlace => ('tile' in place ? (line[place.tile] === 'empty' ? 'tile' : 'ghost') : whole ? 'set-back' : 'tile'));
  return { line, bank, ask: whole ? null : line.includes('choosing') ? 'particle' : 'next', whole };
}

/** The pixel sizes a sentence-build place is drawn with (`SentenceBuildSlide`): text sizes, a tile's side padding, the stage border, the gaps inside a particle tile and an ending box's side padding. */
export interface BuildPlaceSizes {
  tile: number;
  choice: number;
  padX: number;
  border: number;
  gap: number;
  choicePadX: number;
}

/**
 * The width of every place on the sentence line (V9 as built, LV-S3): the widest of the slide's tiles,
 * and of a particle tile while both its endings show, each character counted one em of its text (a
 * Hangul block's advance in the presenter font; punctuation is narrower), plus the tile's padding and
 * border. Every place, empty or not, takes this one width, so the line lays out the same at every
 * build (nothing under it moves, and the fit level the bank build finds holds to the end), and no
 * empty box's size gives its tile away (the learner game sizes its empty places by the widest tile too).
 */
export function buildPlaceWidth(slide: Pick<Of<'sentence-build'>, 'tiles'>, s: BuildPlaceSizes): number {
  const em = (text: string, size: number): number => [...text].length * size;
  const plain = slide.tiles.map((t) => em(t.ko, s.tile));
  const choosing = slide.tiles.map((t) =>
    t.particle === undefined
      ? 0
      : em(t.particle.stem, s.tile) + 3 * s.gap + em('/', s.choice) + t.particle.choices.reduce((n, c) => n + em(c.ko, s.choice) + 2 * (s.choicePadX + s.border), 0),
  );
  return Math.ceil(Math.max(0, ...plain, ...choosing) + 2 * (s.padX + s.border));
}

/**
 * The size of every place on the sentence line, given the line's measured width (0 before its first
 * layout) and its side padding: the one place size (`buildPlaceWidth`, the tile height), unless that
 * is wider than the line can hold (a long tile, or a fallback font with a wider advance than the one
 * em the width counts), where the place takes the line's inner width and may grow taller so its text
 * wraps inside it, never past the line's side.
 */
export function linePlaceSize(width: number, height: number, lineWidth: number, pad: number): { width: number; height?: number; minHeight?: number } {
  const inner = Math.floor(lineWidth - 2 * pad);
  if (lineWidth <= 0 || inner <= 0 || width <= inner) return { width, height };
  return { width: inner, minHeight: height };
}

/** How a tile reads aloud: its Korean, then its romanization when it has one ("Korean, romanization", as `KoreanText`). */
const tileWords = (ko: string, romanization: string): string => (romanization === '' ? ko : `${ko}, ${romanization}`);

/**
 * What one build of a sentence-build slide moved (section 10: a move is announced, politely): the
 * tile placed (a particle tile by its stem, then, at its `particle` build, the whole word), or the
 * whole sentence at the `whole` build. `null` at the bank build, which only the slide's own
 * announcement names.
 */
export function buildMove(slide: Of<'sentence-build'>, reveal: number): { placed: string } | { whole: string } | null {
  const name = slide.builds[reveal];
  if (name === 'whole') return { whole: buildWholeWords(slide) };
  if (name !== 'tile' && name !== 'particle') return null;
  const nth = slide.builds.slice(0, reveal + 1).filter((b) => b === 'tile').length - 1;
  const tile = slide.tiles[nth];
  if (tile === undefined) return null;
  return { placed: name === 'tile' && tile.particle !== undefined ? tile.particle.stem : tileWords(tile.ko, tile.romanization) };
}

// --- write together (AMENDMENTS-LECTURE-V2 sections 5.2 and 5.3, LV-S4) ------------------------------

export interface WriteView {
  /** The prompt's parts (a type prompt and its picture, a trace ghost, a frame): `false` on the name round's table builds, which replace its frame. */
  frame: boolean;
  /** A frame's word banks. */
  bank: boolean;
  /** The answer: a type target, a trace word's romanization and meaning, a frame's "For example". */
  answer: boolean;
  /** Romanization on what shows: with `romanization: 'tap'` only from the answer build; the name round's table always has it. */
  rom: boolean;
  /** The name round's sound table page on screen (`soundTablePages`), or `null` before it. */
  page: number | null;
}

/**
 * Write together slide (slide-write-together.md, V10-V12): a type or trace prompt, then the answer; a
 * frame, its banks, then the example; the name round's frame, then each page of its sound table in its
 * place. The answer comes only on the teacher's click (section 5.3), and with `romanization: 'tap'` its
 * romanization with it, so the room writes from the Hangul and the prompt.
 */
export function writeView(slide: Of<'write-together'>, reveal: number, romanization: RomanizationMode): WriteView {
  const shown = slide.builds.slice(0, Math.max(0, reveal + 1));
  const answer = shown.includes(slide.variant === 'frame' ? 'example' : 'answer');
  const tables = shown.filter((b) => b === 'table').length;
  const rom = slide.variant === 'own-name' || (slide.variant === 'frame' ? romanization === 'always' || answer : answer);
  return { frame: tables === 0, bank: shown.includes('bank'), answer, rom, page: tables === 0 ? null : tables - 1 };
}

/**
 * A type round's prompt and the cue under it (the target's meaning), as the live region and the slide
 * grid name it: "Type the price, 1,000 won"; after a prompt that ends its sentence, "Ask for water. Water, please."
 */
export function typeCue(slide: Extract<Of<'write-together'>, { variant: 'type' }>): string {
  const prompt = slide.prompt.trim();
  return /[.!?:]$/.test(prompt) ? `${prompt} ${slide.answer.gloss}` : `${prompt}, ${slide.answer.gloss}`;
}

/**
 * What one step forward on a write-together slide showed, for the live region (section 10, LV-S4): a
 * type answer its Korean and romanization (its meaning was the cue), a trace answer the word with its
 * romanization and meaning, a frame's banks their words, its example `example` ("For example") with
 * the filled line and its romanization, a sound-table page its blocks. `null` at the first build.
 */
export function writeMove(slide: Of<'write-together'>, reveal: number, example: string): string | null {
  const name = slide.builds[reveal];
  if (reveal === 0 || name === undefined) return null;
  switch (slide.variant) {
    case 'type':
      return `${slide.answer.ko}, ${slide.answer.romanization}`;
    case 'trace':
      return `${slide.word.ko}, ${slide.word.romanization}, ${slide.word.gloss}`;
    case 'frame':
      if (name === 'bank') return slide.banks.flat().map((w) => w.ko).join(', ');
      return `${example}, ${slide.example.ko}, ${slide.example.romanization}`;
    case 'own-name': {
      const page = writeView(slide, reveal, 'always').page;
      return page === null ? null : soundTablePage(slide.groups, page).flat().map((b) => b.ko).join(', ');
    }
  }
}

/** The name round's sound table page as the stage draws it: its groups, each a row of blocks. */
export function soundTablePage(groups: readonly (readonly SheetText[])[], page: number): ReadonlyArray<readonly SheetText[]> {
  return soundTablePages(groups)[page] ?? [];
}

/**
 * The words on a sentence-build slide's line at `reveal`, in sentence order: each placed tile as it
 * reads aloud (Korean, romanization), a particle tile still choosing by its stem. What the stage
 * already shows the room, so the slide's announcement can say it (`slideDetail`) without giving away
 * a tile still in the bank.
 */
export function buildLineWords(slide: Of<'sentence-build'>, reveal: number): string[] {
  const { line } = sentenceBuildView(slide, reveal);
  return slide.tiles.flatMap((tile, i): string[] => {
    const place = line[i];
    if (place === 'placed') return [tileWords(tile.ko, tile.romanization)];
    if (place === 'choosing' && tile.particle !== undefined) return [tile.particle.stem];
    return [];
  });
}

/** The whole sentence as the `whole` build says it: the Korean, its romanization and its meaning. */
export function buildWholeWords(slide: Of<'sentence-build'>): string {
  return `${slide.sentence.ko}, ${slide.sentence.romanization}, ${slide.sentence.gloss}`;
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

/**
 * A question's sound: Match Sound its carrier syllable, a meaning question its word, a story check
 * its target; a listen question its prompt at the rate the learner's game plays it, a reply
 * question the other speaker's line (the sentence rate), a realia question its key word, else its
 * sheet line by line (the word rate, as the realia page). None says an option: they are the answers.
 */
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
    case 'listen':
      return { spoken: prompt.line.spoken, kind: prompt.speech };
    case 'reply':
      return { spoken: prompt.line.spoken, kind: 'sentence' };
    case 'realia':
      return { spoken: prompt.key?.spoken ?? prompt.sheet.spoken, kind: 'word' };
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
export function frameSpoken(frame: FrameText): SpokenForm {
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
 * The question slides (LV-S2): a listen question its prompt (a letter or syllable round at the
 * sound rate), a reply question the other speaker's line, a realia question its key word or, with
 * none, its sheet (`quizSound`). A sentence build (LV-S3) its sentence, at every build. A
 * write-together slide (LV-S4) the Korean it shows, never its answer early (`writeSound`).
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
    case 'sentence-build':
      // The whole sentence at every build, as the learner's Sentence Builder plays it (Hear it) before it is built.
      return { spoken: slide.sentence.spoken, kind: 'sentence' };
    case 'write-together':
      return writeSound(slide, reveal ?? slide.builds.length - 1);
    case 'title':
    case 'story':
    case 'activity':
    case 'end':
      return undefined;
  }
}

/**
 * A write-together slide's sound (LV-S4): the Korean on screen, never ahead of it. A type prompt has
 * none until its answer (the learner's Type Hangul plays nothing before the learner types either),
 * then the target; a trace its word, at the word rate, as the learner's Trace a Word plays its block;
 * a frame its own Korean with a pause at each gap (`frameSpoken`), then its banks' words, then the
 * example; the name round its frame, then the blocks of the table page on screen, at the word rate.
 */
function writeSound(slide: Of<'write-together'>, reveal: number): SlideSound | undefined {
  const view = writeView(slide, reveal, 'always');
  const rate = (ko: string): PromptKind => (/\s/.test(ko.trim()) ? 'sentence' : 'word');
  switch (slide.variant) {
    case 'type':
      return view.answer ? { spoken: slide.answer.spoken, kind: rate(slide.answer.ko) } : undefined;
    case 'trace':
      return { spoken: slide.word.spoken, kind: 'word' };
    case 'frame':
      if (view.answer) return { spoken: slide.example.spoken, kind: 'sentence' };
      if (view.bank) return { spoken: joinSpoken(slide.banks.flat().map((w) => ({ text: w.ko, romanization: w.romanization }))), kind: 'word' };
      return { spoken: frameSpoken(slide.frame), kind: 'sentence' };
    case 'own-name':
      if (view.page === null) return { spoken: frameSpoken(slide.frame), kind: 'sentence' };
      return { spoken: joinSpoken(soundTablePage(slide.groups, view.page).flat().map((b) => ({ text: b.ko, romanization: b.romanization }))), kind: 'word' };
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

/**
 * What a finished slide sound does (section 3.7), the prompt path and a story's Read-to-me alike:
 * `blocked` is whether the browser blocked the voice (the failure the store recorded at or after
 * `startedAt`), and `flash` the chip an explicit press shows, only while the slide it was pressed on
 * (`slideIdx`) is still the one shown (`slideIdxNow`). A superseded Read-to-me chain (stopped, or a
 * newer press) does nothing: `null`. A chain that skipped its Korean before the voice check settled
 * reports `unavailable` after the English played, so it flashes by its reason (normally `no_voice`):
 * the Korean did not play, and the teacher says it.
 */
export function soundOutcome(input: {
  result: PlayResult | 'superseded';
  lastFailure: { reason: FallbackReason; at: number } | null;
  startedAt: number;
  explicit: boolean;
  slideIdx: number | undefined;
  slideIdxNow: number | undefined;
}): { blocked: boolean; flash: 'no-voice' | 'failed' | null } | null {
  const { result, lastFailure } = input;
  if (result === 'superseded') return null;
  const reason = lastFailure !== null && lastFailure.at >= input.startedAt ? lastFailure.reason : null;
  const shown = input.explicit && input.slideIdxNow !== undefined && input.slideIdxNow === input.slideIdx;
  return { blocked: result !== 'played' && reason === 'blocked', flash: shown ? soundFlashFor(result, reason) : null };
}

/** The `playPrompt` spec of a slide's sound (the presenter adds `source`). */
export function soundPrompt(sound: SlideSound): { text: string; audioRef?: string; kind: PromptKind } {
  const { text, audioRef } = sound.spoken;
  return audioRef !== undefined ? { text, audioRef, kind: sound.kind } : { text, kind: sound.kind };
}
