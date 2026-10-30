import type { BlockParts, SyllableZone } from '@hangul-route/content-schema';

/**
 * One Syllable Build round as a pure reducer (F-CURR-002 section 7.1 F3, row CM-32; design/wireframes/minigame/syllable-build.md,
 * Interaction points). The screen renders the state and runs the effects.
 *
 * - A tile fills its own zone, whatever the order; a second tile of the same row replaces the first. A tap on a filled
 *   zone empties it. A fixed zone (a symbol item at the produce rung) is filled from the start and never changes.
 * - The block is checked as soon as every zone holds a tile (No final counts). The first full block is the scored
 *   answer; a later full block is a retry and is never scored.
 * - Right: the block is said and the round ends. A zone that does not fit is marked (amber, never red) and the zones
 *   that fit stay; the sound replays after 0.8 s; changing a marked zone checks again. A second miss on the same zone
 *   rings the right tile of that row ("This one goes here.").
 * - Show how it sounds reveals the romanization; used before the scored answer, the answer is recorded as hinted (no
 *   promotion, no demotion, section 4.3). With no device voice the romanization shows from the start and is not a hint.
 */

/** The final zone's value when the learner picked No final. */
export const NO_FINAL = '';
/** The pause before the sound replays after a miss. */
export const REPLAY_AFTER_MS = 800;

export type Zones = Record<SyllableZone, string | null>;

export interface BuildState {
  zones: Zones;
  fixed: SyllableZone | null;
  status: 'building' | 'marked' | 'right';
  /** The zones that did not fit at the last check. */
  marked: SyllableZone[];
  /** Misses per zone, for the second-miss ring. */
  misses: Record<SyllableZone, number>;
  /** The zone whose right tile is ringed after a second miss on it. */
  ring: SyllableZone | null;
  /** The first full block has been answered. */
  scored: boolean;
  /** Show how it sounds was used. */
  revealed: boolean;
}

export type BuildEvent =
  | { type: 'tile'; zone: SyllableZone; letter: string }
  | { type: 'clear'; zone: SyllableZone }
  | { type: 'reveal' }
  | { type: 'replay-due' };

export type BuildEffect =
  | { type: 'answer'; correct: boolean; hinted: boolean }
  | { type: 'play'; why: 'replay' | 'right' }
  | { type: 'schedule-replay'; ms: number }
  | { type: 'cancel-replay' }
  | { type: 'haptic'; kind: 'success' | 'nudge' }
  | { type: 'solved' };

export interface BuildContext {
  target: BlockParts;
  /** The device can say Korean: without it the romanization is shown from the start, so a reveal is no hint. */
  voice: boolean;
}

const ZONES: readonly SyllableZone[] = ['first', 'vowel', 'final'];
const want = (target: BlockParts, zone: SyllableZone): string => (zone === 'final' ? target.final ?? NO_FINAL : target[zone]);

export function startBuild(target: BlockParts, fixed: SyllableZone | null = null): BuildState {
  const zones: Zones = { first: null, vowel: null, final: null };
  if (fixed !== null) zones[fixed] = want(target, fixed);
  return { zones, fixed, status: 'building', marked: [], misses: { first: 0, vowel: 0, final: 0 }, ring: null, scored: false, revealed: false };
}

const full = (zones: Zones): boolean => ZONES.every((z) => zones[z] !== null);

function check(state: BuildState, ctx: BuildContext): { state: BuildState; effects: BuildEffect[] } {
  const wrong = ZONES.filter((z) => state.zones[z] !== want(ctx.target, z));
  const first = !state.scored;
  const hinted = state.revealed && ctx.voice;
  if (wrong.length === 0) {
    const effects: BuildEffect[] = [{ type: 'cancel-replay' }];
    if (first) effects.push({ type: 'answer', correct: true, hinted });
    effects.push({ type: 'haptic', kind: 'success' }, { type: 'play', why: 'right' }, { type: 'solved' });
    return { state: { ...state, status: 'right', marked: [], ring: null, scored: true }, effects };
  }
  const misses = { ...state.misses };
  for (const z of wrong) misses[z] += 1;
  const ring = state.ring !== null && wrong.includes(state.ring) ? state.ring : wrong.find((z) => misses[z] >= 2) ?? null;
  const effects: BuildEffect[] = [];
  if (first) effects.push({ type: 'answer', correct: false, hinted });
  effects.push({ type: 'haptic', kind: 'nudge' }, { type: 'cancel-replay' }, { type: 'schedule-replay', ms: REPLAY_AFTER_MS });
  return { state: { ...state, status: 'marked', marked: wrong, misses, ring, scored: true }, effects };
}

export function stepBuild(state: BuildState, event: BuildEvent, ctx: BuildContext): { state: BuildState; effects: BuildEffect[] } {
  if (state.status === 'right') return { state, effects: [] };
  switch (event.type) {
    case 'tile': {
      if (event.zone === state.fixed || state.zones[event.zone] === event.letter) return { state, effects: [] };
      const marked = state.marked.filter((z) => z !== event.zone);
      const next: BuildState = {
        ...state,
        zones: { ...state.zones, [event.zone]: event.letter },
        marked,
        status: marked.length > 0 ? 'marked' : 'building',
        ring: state.ring === event.zone && event.letter === want(ctx.target, event.zone) ? null : state.ring,
      };
      return full(next.zones) ? check(next, ctx) : { state: next, effects: [{ type: 'cancel-replay' }] };
    }
    case 'clear': {
      if (event.zone === state.fixed || state.zones[event.zone] === null) return { state, effects: [] };
      const marked = state.marked.filter((z) => z !== event.zone);
      const next: BuildState = { ...state, zones: { ...state.zones, [event.zone]: null }, marked, status: marked.length > 0 ? 'marked' : 'building' };
      return { state: next, effects: [{ type: 'cancel-replay' }] };
    }
    case 'reveal':
      return state.revealed ? { state, effects: [] } : { state: { ...state, revealed: true }, effects: [] };
    case 'replay-due':
      return state.status === 'marked' ? { state, effects: [{ type: 'play', why: 'replay' }] } : { state, effects: [] };
  }
}

/**
 * Hoya's line for the state: where to listen after a miss (by zone; the final zone with No final picked where there is
 * a final, or a final where there is none, asks "is there a final sound?"), the look-here line once a tile is ringed,
 * and the built line when it is right. `null` while building.
 */
export type HoyaLine = 'first' | 'vowel' | 'final' | 'finalOrNone' | 'lookHere' | 'built';

export function hoyaLine(state: BuildState, target: BlockParts): HoyaLine | null {
  if (state.status === 'right') return 'built';
  if (state.status !== 'marked' || state.marked.length === 0) return null;
  if (state.ring !== null) return 'lookHere';
  const zone = ZONES.find((z) => state.marked.includes(z)) as SyllableZone;
  if (zone === 'final') {
    const picked = state.zones.final;
    if ((target.final === null) !== (picked === NO_FINAL)) return 'finalOrNone';
  }
  return zone;
}

/** The letter a zone wants (No final is `NO_FINAL`), for the ring and the tests. */
export const wantedLetter = want;
