import type { FallbackReason, PlayResult } from '../audio/prompt-state';
import type { PromptKind } from '../audio/rate';
import type { SpokenForm } from '../audio/spoken';
import type { BuildName, QuizPrompt, SequenceStep } from './build-steps';
import type { Slide } from './deck-builder';

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

/**
 * What Sound, S or a stage speaker plays on a slide (section 3.4 amendment 2026-10-17): the Korean
 * the slide draws. A letter's carrier syllable, a syllable and a Match Sound prompt play at the
 * sound rate; a word card its spoken form (`spokenKo` or the word, a Discover sentence at the
 * sentence rate); a heritage card its Korean chip; a word-to-meaning question its word; a story
 * check its target word; an order slide the last Korean step on screen at `reveal` (every step
 * when `reveal` is not given). A title, a story scene (Read-to-me has its own path), an activity,
 * the End slide, Odd One Out (the letters are the answer), a card without Korean and a check
 * without a target play nothing.
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
      // The steps on screen (as `sequenceView` counts them; the order question shows them all).
      const count = slide.builds.slice(0, (reveal ?? slide.builds.length - 1) + 1).filter((b) => b === 'step').length;
      const step = slide.steps.slice(0, count).filter(koStep).pop();
      return step ? { spoken: { text: step.ko, romanization: step.romanization }, kind: 'sentence' } : undefined;
    }
    case 'title':
    case 'story':
    case 'activity':
    case 'end':
      return undefined;
  }
}

/** What a Sound press, a forward `sound` build or a stage speaker does (section 3.7 amendment 2026-10-17). */
export type SoundPress = 'play' | 'unmute-then-play' | 'flash-no-sound' | 'skip';

/**
 * An explicit press (the bar's Sound, S, a stage speaker) always answers: while muted it turns the
 * device sound on and plays (the chip's Turn sound on, then the sound), and with nothing to play
 * (the slide has no sound, or the deck has sound off) it flashes "This slide has no sound.". A
 * forward `sound` build stays silent while muted (the Sound is off chip says why) and never flashes.
 */
export function soundPress(input: { hasSound: boolean; explicit: boolean; muted: boolean; deckSound: boolean }): SoundPress {
  if (!input.deckSound || !input.hasSound) return input.explicit ? 'flash-no-sound' : 'skip';
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
