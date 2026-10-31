/**
 * AMENDMENTS-TOUCH 6.8 (KT-D9): which finger draws on a trace canvas.
 *
 * The canvas follows one pointer, by id, from the gesture's touch callbacks: the first pointer that
 * travels at least the activation distance (`spacing.xs`, passed in by the screen) owns the stroke, and
 * the stroke starts where that finger landed. Pointers that stay still (a resting palm, a holding thumb)
 * are ignored and cancel nothing; while a pointer owns the stroke every other pointer is ignored, and a
 * pointer still down when the stroke ends rests until it lifts. Points are the owner's own positions,
 * never an average of every finger.
 *
 * The idle check (logic/trace-evaluator) follows the fingers: `hold` when a finger lands on an idle
 * canvas, `end` when the owner lifts, and `release` when the last finger of a touch that never drew
 * lifts (a dot or a graze under the activation distance: no ink, and the check re-arms for the ink
 * already there).
 *
 * Pure: every function returns the next state and the effects for the screen to apply in order.
 */

export interface TouchPoint {
  id: number;
  x: number;
  y: number;
}

export interface CanvasPoint {
  x: number;
  y: number;
}

interface Pointer {
  /** Where the finger landed: the stroke's first point when it becomes the owner. */
  readonly start: CanvasPoint;
  /** Down when a stroke ended: ignored until it lifts. */
  readonly resting: boolean;
}

export interface TracePointers {
  readonly pointers: ReadonlyMap<number, Pointer>;
  readonly owner: number | null;
}

export type TraceTouchEffect =
  /** A finger landed on an idle canvas: stop the idle countdown. */
  | { kind: 'hold' }
  /** A finger travelled the activation distance: a new stroke from its landing point to here. */
  | { kind: 'start'; from: CanvasPoint; to: CanvasPoint }
  /** The owner moved: the stroke's next point. */
  | { kind: 'point'; at: CanvasPoint }
  /** The owner lifted: the stroke is done; the idle countdown restarts. */
  | { kind: 'end' }
  /** The last finger of a touch that never drew lifted: no ink; restart the countdown if ink is there. */
  | { kind: 'release' };

export interface TraceTouchStep {
  state: TracePointers;
  effects: TraceTouchEffect[];
}

export const NO_TRACE_POINTERS: TracePointers = { pointers: new Map(), owner: null };

/** A stroke is being drawn, or a finger is down that may still start one. */
function busy(state: TracePointers): boolean {
  if (state.owner !== null) return true;
  for (const p of state.pointers.values()) if (!p.resting) return true;
  return false;
}

const at = (t: TouchPoint): CanvasPoint => ({ x: t.x, y: t.y });

export function traceTouchesDown(state: TracePointers, touches: readonly TouchPoint[]): TraceTouchStep {
  const pointers = new Map(state.pointers);
  for (const t of touches) if (!pointers.has(t.id)) pointers.set(t.id, { start: at(t), resting: false });
  const next: TracePointers = { pointers, owner: state.owner };
  return { state: next, effects: !busy(state) && busy(next) ? [{ kind: 'hold' }] : [] };
}

export function traceTouchesMove(state: TracePointers, touches: readonly TouchPoint[], minDistance: number): TraceTouchStep {
  let owner = state.owner;
  const effects: TraceTouchEffect[] = [];
  for (const t of touches) {
    const p = state.pointers.get(t.id);
    if (!p) continue;
    if (owner === null) {
      if (!p.resting && Math.hypot(t.x - p.start.x, t.y - p.start.y) >= minDistance) {
        owner = t.id;
        effects.push({ kind: 'start', from: p.start, to: at(t) });
      }
    } else if (t.id === owner) {
      effects.push({ kind: 'point', at: at(t) });
    }
  }
  return { state: owner === state.owner ? state : { pointers: state.pointers, owner }, effects };
}

export function traceTouchesUp(state: TracePointers, touches: readonly TouchPoint[]): TraceTouchStep {
  let pointers = new Map(state.pointers);
  let owner = state.owner;
  const effects: TraceTouchEffect[] = [];
  for (const t of touches) {
    const p = pointers.get(t.id);
    if (!p) continue;
    pointers.delete(t.id);
    if (t.id === owner) {
      owner = null;
      effects.push({ kind: 'end' });
      // Every finger still down took no part in this stroke: it rests until it lifts.
      pointers = new Map([...pointers].map(([id, q]) => [id, { start: q.start, resting: true }]));
    } else if (!p.resting && !busy({ pointers, owner })) {
      effects.push({ kind: 'release' });
    }
  }
  return { state: { pointers, owner }, effects };
}

/**
 * The gesture finished (every finger up, or the system cancelled it): lifts whatever is still down,
 * the owner first. A lift that already came through `traceTouchesUp` is not repeated.
 */
export function traceTouchesEnd(state: TracePointers): TraceTouchStep {
  if (state.pointers.size === 0) return { state: NO_TRACE_POINTERS, effects: [] };
  const ids = [...state.pointers.keys()].sort((a, b) => Number(b === state.owner) - Number(a === state.owner));
  const out = traceTouchesUp(
    state,
    ids.map((id) => ({ id, x: 0, y: 0 })),
  );
  return { state: NO_TRACE_POINTERS, effects: out.effects };
}
