import type { HiddenHeritageRound, HiddenHeritageSpot, KoText } from '@hangul-route/content-schema';
import { HIDDEN_HERITAGE_SPOT } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import type { MinigameScope } from './minigame-config';
import { shuffleSeeded } from './story/seeded-order';

/**
 * Hidden Heritage (F-CURR-002 §7.1 F7, row CM-36; design/wireframes/minigame/hidden-heritage.md): the pure rules of
 * the game. Hoya names one thing in Korean (written with romanization, and heard); the learner taps it in the scene.
 * A right tap rings it, plays its word and shows its meaning, then the next word comes; a tap on another thing is a soft
 * amber nudge that ends nothing; after two misses the right spot gets a "look here" ring. The first tap on a spot for a
 * word scores that word (`w<n>`, `first-try.ts`); later taps are retries. Nothing here is timed: the two delays only
 * clear a ring and show the meaning before the next word. The screen (`HiddenHeritageGame.tsx`, in the lazy chunk)
 * renders these views and runs the effects; it is the only importer, so this file is in that chunk too.
 */

/** How long a miss ring stays, and how long a found word's meaning shows before the next word (wireframe "States"). */
export const MISS_RING_MS = 600;
export const FOUND_ADVANCE_MS = 700;
/** Misses on one word before its spot gets the look-here ring. */
export const HINT_AFTER_MISSES = 2;
/** The smallest scene, in dp: 75 canvas units are 48 dp there (style guide H-1). Narrower, the step plays Pic-Word Match. */
export const MIN_SCENE_WIDTH = 256;
/** The scene canvas (scene-art 400 x 300). */
export const SCENE_UNITS = { width: 400, height: 300 } as const;

export type RingKind = 'found' | 'miss' | 'hint';

export interface FlowState {
  status: 'empty' | 'playing' | 'end' | 'done';
  roundIdx: number;
  /** Per round, the target ids in the order they are asked (shuffled per mount). */
  order: string[][];
  /** Index into `order[roundIdx]` of the word being asked. */
  at: number;
  /** Target ids found in this round, in the order they were found. */
  found: string[];
  /** Taps on another thing, per target id of this round. */
  misses: Record<string, number>;
  /** The spot with the amber miss ring, while it shows. */
  flash: string | null;
  /** A word just found: its meaning shows until the next word comes. */
  pending: string | null;
  /** Answers given so far (Skip shows after the first). */
  answered: number;
  /** What the live region says now. */
  live: 'found' | 'miss' | null;
}

export type FlowEvent =
  | { type: 'start' }
  | { type: 'hear' }
  | { type: 'tap'; id: string }
  | { type: 'clear-flash' }
  | { type: 'advance' }
  | { type: 'continue' }
  | { type: 'skip' };

export type FlowEffect =
  | { type: 'answer'; roundKey: string; correct: boolean; itemId: string }
  | { type: 'play'; targetId: string }
  | { type: 'haptic'; kind: 'success' | 'nudge' }
  | { type: 'schedule-clear'; ms: number }
  | { type: 'cancel-clear' }
  | { type: 'schedule-advance'; ms: number }
  | { type: 'cancel-advance' }
  | { type: 'complete' };

/** The rounds a scope can play: each with 3 or more targets, every one with its Korean and romanization. */
export function validRounds(scope: Pick<MinigameScope, 'hiddenHeritage'>): HiddenHeritageRound[] {
  const ok = (w: KoText): boolean => w.ko.trim() !== '' && w.romanization.trim() !== '';
  return (scope.hiddenHeritage?.rounds ?? []).filter((r) => r.targets.length >= 3 && r.targets.every((t) => ok(t.word)));
}

export function startFlow(rounds: readonly HiddenHeritageRound[], seed: number): FlowState {
  const order = rounds.map((r, i) => shuffleSeeded(r.targets.map((t) => t.id), seed + i));
  return { status: rounds.length === 0 ? 'empty' : 'playing', roundIdx: 0, order, at: 0, found: [], misses: {}, flash: null, pending: null, answered: 0, live: null };
}

/** The id of the word being asked, or null. */
export const askedId = (state: FlowState): string | null => (state.status === 'playing' ? state.order[state.roundIdx]?.[state.at] ?? null : null);

/** `w<n>`: the word's place among every target of the scope, in content order, so a key never changes with the shuffle. */
export function roundKeyOf(rounds: readonly HiddenHeritageRound[], roundIdx: number, targetId: string): string {
  const before = rounds.slice(0, roundIdx).reduce((n, r) => n + r.targets.length, 0);
  return `w${before + (rounds[roundIdx]?.targets.findIndex((t) => t.id === targetId) ?? 0)}`;
}

export function stepFlow(state: FlowState, event: FlowEvent, rounds: readonly HiddenHeritageRound[]): { state: FlowState; effects: FlowEffect[] } {
  const same = { state, effects: [] as FlowEffect[] };
  const asked = askedId(state);
  switch (event.type) {
    case 'start':
    case 'hear':
      return asked === null ? same : { state, effects: [{ type: 'play', targetId: state.pending ?? asked }] };
    case 'tap': {
      // Only taps on spots are answers; a found spot, or any tap while a found word shows, does nothing.
      if (asked === null || state.pending !== null || state.found.includes(event.id)) return same;
      const roundKey = roundKeyOf(rounds, state.roundIdx, asked);
      if (event.id === asked) {
        return {
          state: { ...state, found: [...state.found, asked], pending: asked, flash: null, answered: state.answered + 1, live: 'found' },
          effects: [
            { type: 'cancel-clear' },
            { type: 'answer', roundKey, correct: true, itemId: asked },
            { type: 'haptic', kind: 'success' },
            { type: 'play', targetId: asked },
            { type: 'schedule-advance', ms: FOUND_ADVANCE_MS },
          ],
        };
      }
      return {
        state: { ...state, misses: { ...state.misses, [asked]: (state.misses[asked] ?? 0) + 1 }, flash: event.id, answered: state.answered + 1, live: 'miss' },
        effects: [{ type: 'cancel-clear' }, { type: 'answer', roundKey, correct: false, itemId: asked }, { type: 'haptic', kind: 'nudge' }, { type: 'schedule-clear', ms: MISS_RING_MS }],
      };
    }
    case 'clear-flash':
      return state.flash === null ? same : { state: { ...state, flash: null }, effects: [] };
    case 'advance': {
      // Only while playing: a Skip inside the found word's delay ends the step, and a late timer changes nothing.
      if (state.status !== 'playing' || state.pending === null) return same;
      const at = state.at + 1;
      if (at >= (state.order[state.roundIdx]?.length ?? 0)) return { state: { ...state, pending: null, status: 'end', live: null }, effects: [] };
      const next = { ...state, at, pending: null, live: null };
      return { state: next, effects: [{ type: 'play', targetId: next.order[state.roundIdx]![at]! }] };
    }
    case 'continue': {
      if (state.status !== 'end') return same;
      const roundIdx = state.roundIdx + 1;
      if (roundIdx >= rounds.length) return { state: { ...state, status: 'done' }, effects: [{ type: 'complete' }] };
      const next: FlowState = { ...state, status: 'playing', roundIdx, at: 0, found: [], misses: {}, flash: null, pending: null, live: null };
      return { state: next, effects: [{ type: 'play', targetId: next.order[roundIdx]![0]! }] };
    }
    case 'skip':
      // Ends the step without marking the words not found (the shell's Skip), and drops a found word's pending advance.
      return state.status === 'playing' || state.status === 'end'
        ? { state: { ...state, status: 'done', pending: null }, effects: [{ type: 'cancel-clear' }, { type: 'cancel-advance' }, { type: 'complete' }] }
        : same;
  }
}

export const canSkip = (state: FlowState): boolean => state.status === 'playing' && state.answered > 0;

/** The fill-only bar: every word found so far over every word of the scope, and its "n / m" pill. */
export function headerView(state: FlowState, rounds: readonly HiddenHeritageRound[], copy: Messages['learner']['minigame']): { value: number; max: number; label: string } {
  const max = rounds.reduce((n, r) => n + r.targets.length, 0);
  const before = rounds.slice(0, state.roundIdx).reduce((n, r) => n + r.targets.length, 0);
  const value = Math.min(max, state.status === 'done' ? max : before + state.found.length);
  return { value, max, label: copy.progress.pill(value, max) };
}

/** The meaning a thing is named by; null in the Korean UI when the gloss is the word itself (it is not said twice). */
export const meaningOf = (word: KoText): string | null => (word.en.trim() === '' || word.en === word.ko ? null : word.en);

export interface SpotView {
  id: string;
  spot: HiddenHeritageSpot;
  /** Its accessible name: the thing's meaning (or its word), and "found" once found. */
  label: string;
  ring: RingKind | null;
  found: boolean;
}

/**
 * Every thing's spot in reading order (top to bottom by rows one spot tall, then left to right), so tabbing shows where
 * things are, never which one is the answer. A found spot keeps its ring; the miss ring flashes on the tapped spot;
 * the look-here ring sits on the asked word's spot after two misses.
 */
export function spotViews(round: HiddenHeritageRound, state: FlowState, a11y: Messages['a11y']['hiddenHeritage']): SpotView[] {
  const asked = askedId(state);
  const hint = asked !== null && state.pending === null && (state.misses[asked] ?? 0) >= HINT_AFTER_MISSES ? asked : null;
  const row = (s: HiddenHeritageSpot): number => Math.floor((s.y + s.h / 2) / HIDDEN_HERITAGE_SPOT.min);
  return [...round.targets, ...round.others]
    .map((thing) => {
      const name = meaningOf(thing.word) ?? thing.word.ko;
      const found = state.found.includes(thing.id);
      const ring: RingKind | null = found ? 'found' : state.flash === thing.id ? 'miss' : hint === thing.id ? 'hint' : null;
      return { id: thing.id, spot: thing.spot, label: found ? a11y.spotFound(name) : name, ring, found };
    })
    .sort((a, b) => row(a.spot) - row(b.spot) || a.spot.x - b.spot.x);
}

/** The word being asked, and its meaning once it is found (it shows under the word until the next word). */
export function promptView(round: HiddenHeritageRound, state: FlowState): { word: KoText; meaning: string | null } | null {
  const id = state.pending ?? askedId(state);
  const target = round.targets.find((t) => t.id === id);
  if (!target) return null;
  return { word: target.word, meaning: state.pending !== null ? meaningOf(target.word) : null };
}

/** One slot per target: a found word fills the next slot, with its romanization under it. */
export function slotViews(round: HiddenHeritageRound, state: FlowState): Array<{ key: string; word: KoText | null }> {
  return round.targets.map((_, i) => {
    const id = state.found[i];
    const target = round.targets.find((t) => t.id === id);
    return { key: `slot-${i}`, word: target ? target.word : null };
  });
}

/** What the live region says: "Found: soup" after a right tap (the word in the Korean UI's case), "Look again" after a miss. */
export function liveText(round: HiddenHeritageRound, state: FlowState, a11y: Messages['a11y']['hiddenHeritage'], copy: Messages['learner']['hiddenHeritage']): string {
  if (state.live === 'miss') return copy.again;
  const target = round.targets.find((t) => t.id === state.pending);
  return state.live === 'found' && target ? a11y.foundLive(meaningOf(target.word) ?? target.word.ko) : '';
}

/** Hoya's "Look again" shows while the asked word has a miss and is not yet found. */
export const showsHoya = (state: FlowState): boolean => {
  const asked = askedId(state);
  return asked !== null && state.pending === null && (state.misses[asked] ?? 0) > 0;
};

/** The end panel: every word of the scene with its romanization and its meaning (none when the meaning is the word). */
export const endView = (round: HiddenHeritageRound): Array<{ id: string; word: KoText; meaning: string | null }> =>
  round.targets.map((t) => ({ id: t.id, word: t.word, meaning: meaningOf(t.word) }));

export interface SceneLayout {
  arrangement: 'stack' | 'beside';
  sceneWidth: number;
}

/**
 * Where the scene goes (wireframe "Box diagram C"): across the content width up to the reading width; on a landscape
 * phone (`short`) beside the prompt column, as tall as the window lets it, unless that leaves it under 256 dp; null when
 * even the content width is under 256 dp, and the step plays Pic-Word Match instead ("States").
 */
export function sceneLayout(input: { contentWidth: number; maxWidth: number; short: boolean; heightForScene: number; columnMin: number; gap: number }): SceneLayout | null {
  const stacked = Math.min(input.contentWidth, input.maxWidth);
  if (!(stacked >= MIN_SCENE_WIDTH)) return null;
  if (input.short) {
    const beside = Math.min((input.heightForScene * SCENE_UNITS.width) / SCENE_UNITS.height, input.contentWidth - input.columnMin - input.gap, input.maxWidth);
    if (beside >= MIN_SCENE_WIDTH) return { arrangement: 'beside', sceneWidth: Math.floor(beside) };
  }
  return { arrangement: 'stack', sceneWidth: Math.floor(stacked) };
}

/** A spot's box in dp on a scene drawn `sceneWidth` wide. */
export function spotRect(spot: HiddenHeritageSpot, sceneWidth: number): { left: number; top: number; width: number; height: number } {
  const k = sceneWidth / SCENE_UNITS.width;
  return { left: spot.x * k, top: spot.y * k, width: spot.w * k, height: spot.h * k };
}
