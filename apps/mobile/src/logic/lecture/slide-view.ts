import type { SpokenForm } from '../audio/spoken';
import type { BuildName, SequenceStep } from './build-steps';
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

/**
 * A word's picture (section 3.4 `vocab`): the heritage card art when the word names a card the art
 * draws; none means the slide is text only. (A topic word's WordArt arrives with PR 12, README D9.)
 */
export function vocabArtId(slide: Of<'vocab'>, supportedCardIds: readonly string[]): string | undefined {
  return slide.cardId !== undefined && supportedCardIds.includes(slide.cardId) ? slide.cardId : undefined;
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

/** What the speaker plays on a slide: a letter's carrier syllable, a syllable itself; nothing elsewhere. */
export function slideSound(slide: Slide | undefined): SpokenForm | undefined {
  if (slide?.kind === 'letter' || slide?.kind === 'syllable') return slide.spoken;
  return undefined;
}
