import type { Slide } from './deck-builder';
import { SWIPE_MIN, SWIPE_RATIO, type StageInsets } from './stage-constants';
import type { NavLayout } from './stage-scale';

/**
 * Taps, clicks and swipes on the lecture stage (AMENDMENTS-PRESENTER-NAV sections 6 and 7), pure.
 * There are no hidden tap zones: a touch tap on the stage never steps, a tap or click on a content
 * target never steps, and a mouse click steps forward only on a slide with no content targets.
 * A horizontal swipe steps on every window. This replaces the thirds (`gestureCommand`) and the
 * phone bar's strip (`inBarStrip`).
 *
 * Like `stage-scale.ts`, it imports no design-system runtime: the token values are named here and
 * a test holds them to the tokens (`TAP_SLOP` = `spacing.xl`, `EDGE_GUARD_MIN` = `spacing.xl`,
 * `EDGE_GUARD_PAD` = `spacing.sm`).
 */

/**
 * A tap moves less than this on both axes, in window px (`spacing.xl`; AMENDMENTS-TOUCH section 6.10 raised it
 * from `spacing.md`, so a fingertip that rolls or grazes still taps). Between a tap and a swipe is nothing.
 */
export const TAP_SLOP = 24;
/** A touch swipe never starts this close to the window's left or right edge: the system's own back and forward gestures own it (`spacing.xl`). */
export const EDGE_GUARD_MIN = 24;
/** Past a safe-area inset the guard reaches this much further (`spacing.sm`). */
export const EDGE_GUARD_PAD = 8;
/** How long Next shows its ring after a touch tap on empty stage area (`'nudge-next'`). */
export const NUDGE_MS = 1000;

/** What the gesture started on: nothing pointable, an answer option (1 to 4), or another content target. */
export type StageTarget = { kind: 'none' } | { kind: 'option'; index: number } | { kind: 'other' };

/** What a gesture asks for; null: nothing. A tap never gives `'prev'`. */
export type StageCommand = 'next' | 'prev' | 'toggle-bar' | 'close-more' | 'nudge-next' | { point: number } | null;

/** The pointer a gesture was made with: a pen counts as touch. */
export type GesturePointer = 'mouse' | 'touch';

/** What covers the stage: the More sheet, another covering overlay (the grid, Help, Blank, pause, the full timer), or nothing. */
export type StageCovering = 'none' | 'more' | 'other';

export interface StageGesture {
  /** The gesture's own pointer (the grant event's type, a pen as touch). */
  pointer: GesturePointer;
  /** Travel of the touch tracked from the grant, in window px. */
  dx: number;
  dy: number;
  /** Where the gesture started, in window px from the left edge (for the edge guard). */
  startX: number;
  windowWidth: number;
  /** `edgeGuard(insets)`. */
  edgeGuard: { left: number; right: number };
  /** The most touches down at once during the gesture. */
  touches: number;
  /** What the gesture started on (`parseStageTarget`). */
  target: StageTarget;
  /** `slideHasTargets(slide)`. */
  slideHasTargets: boolean;
  layout: NavLayout;
  covering: StageCovering;
  /** A tap on an option points at it (owner choice O2, row PN-5); false: the tap is swallowed. */
  pointing: boolean;
}

/** The edge guard per side: `EDGE_GUARD_MIN`, or the side's safe-area inset plus `EDGE_GUARD_PAD` when that is larger. */
export function edgeGuard(insets: Pick<StageInsets, 'left' | 'right'>): { left: number; right: number } {
  const side = (inset: number): number => Math.max(EDGE_GUARD_MIN, (Number.isFinite(inset) ? Math.max(0, inset) : 0) + EDGE_GUARD_PAD);
  return { left: side(insets.left), right: side(insets.right) };
}

/** A swipe: at least `SWIPE_MIN` across and at least `SWIPE_RATIO` times more across than down. */
export function isSwipe(dx: number, dy: number): boolean {
  const ax = Math.abs(dx);
  return ax >= SWIPE_MIN && ax >= SWIPE_RATIO * Math.abs(dy);
}

function isTap(dx: number, dy: number): boolean {
  return Math.abs(dx) < TAP_SLOP && Math.abs(dy) < TAP_SLOP;
}

/**
 * The rule of section 7.2, in order:
 * 0. covering another overlay: nothing; covering More: a tap closes it, anything else nothing;
 * 1. two or more touches at any time: nothing;
 * 2. a swipe: left next, right previous; a touch swipe that starts in either edge guard: nothing;
 * 3. not a tap: nothing;
 * 4. a tap on an option points at it (when pointing), on any other target nothing;
 * 5. a tap on empty area: a mouse on a target-free slide next; a touch in the overlay layout shows or
 *    hides the bar; any other touch rings Next (no step); a mouse on a target slide nothing.
 */
export function stageGesture(g: StageGesture): StageCommand {
  const tap = isTap(g.dx, g.dy);
  if (g.covering === 'other') return null;
  if (g.covering === 'more') return tap ? 'close-more' : null;
  if (g.touches > 1) return null;
  if (isSwipe(g.dx, g.dy)) {
    if (g.pointer === 'touch' && (g.startX < g.edgeGuard.left || g.windowWidth - g.startX < g.edgeGuard.right)) return null;
    return g.dx < 0 ? 'next' : 'prev';
  }
  if (!tap) return null;
  if (g.target.kind === 'option') return g.pointing ? { point: g.target.index } : null;
  if (g.target.kind === 'other') return null;
  if (g.pointer === 'mouse') return g.slideHasTargets ? null : 'next';
  return g.layout === 'overlay' ? 'toggle-bar' : 'nudge-next';
}

/** Where a step from the stage came from, for `lecture.complete` (AMENDMENTS-PRESENTER-NAV section 12). */
export type StageStepSource = 'swipe' | 'click';

/**
 * The source of a step `stageGesture` gave: a tap that stepped is a mouse click (a touch tap never
 * steps); anything else that stepped is a swipe, a touch or a mouse drag.
 */
export function stageStepSource(g: Pick<StageGesture, 'dx' | 'dy'>): StageStepSource {
  return isTap(g.dx, g.dy) ? 'click' : 'swipe';
}

/**
 * The `data-stage-target` marker of the node a gesture started on (`closest('[data-stage-target]')`),
 * read: `option:1` to `option:4` an option with its number, `step`, `tile` and `chip` another target,
 * none (or an unknown marker) nothing pointable.
 */
export function parseStageTarget(marker: string | null | undefined): StageTarget {
  if (marker === null || marker === undefined) return { kind: 'none' };
  const option = /^option:([1-9])$/.exec(marker);
  if (option) return { kind: 'option', index: Number(option[1]) };
  return STAGE_TARGET_KINDS.has(marker) ? { kind: 'other' } : { kind: 'none' };
}

/** The markers of section 7.1 other than options. */
export const STAGE_TARGET_KINDS: ReadonlySet<string> = new Set(['step', 'tile', 'chip']);

/** The marker an option carries: `option:n`, n from 1. */
export function optionTarget(index: number): string {
  return `option:${index + 1}`;
}

/**
 * A slide the room points at (section 7.1): every quiz (quiz, story check, listen and reply
 * questions, realia questions), sequence, sentence build and write-together slide, and every
 * Role Play turn (its replies are the quiz's option rows), whatever the build. Title, letter,
 * syllable, vocab, card, story, sentence, pattern, read along, realia, Hidden Heritage (a scene
 * the room points at in the room), activity and end slides have none (their speaker and Start
 * timer are stage buttons).
 */
export function slideHasTargets(slide: Pick<Slide, 'kind'>): boolean {
  return TARGET_SLIDE_KINDS.has(slide.kind);
}

const TARGET_SLIDE_KINDS: ReadonlySet<Slide['kind']> = new Set<Slide['kind']>(['quiz', 'sequence', 'sentence-build', 'write-together', 'role-play']);

/**
 * The gesture's own pointer (section 4): a touch event is touch; a mouse event is touch too when
 * the last `pointerdown` was a touch or a pen (Windows Chrome sends pen input as mouse events), else
 * a mouse.
 */
export function gesturePointer(eventType: string | undefined, lastPointerDown: GesturePointer | null): GesturePointer {
  if (eventType !== undefined && eventType.startsWith('touch')) return 'touch';
  return lastPointerDown === 'touch' ? 'touch' : 'mouse';
}

/**
 * After a touch ends, a browser may still send its compatibility `mousedown` and `mouseup` for the
 * same tap (react-native-web stops dropping them once the finger moved at all), within this many ms.
 */
export const COMPAT_MOUSE_MS = 800;

/** A mouse-type grant this soon after the stage's last touch ended is the same tap again: dropped, so a bar toggle never runs twice. */
export function isCompatMouse(eventType: string | undefined, msSinceTouchEnd: number): boolean {
  return eventType !== undefined && eventType.startsWith('mouse') && msSinceTouchEnd >= 0 && msSinceTouchEnd < COMPAT_MOUSE_MS;
}
