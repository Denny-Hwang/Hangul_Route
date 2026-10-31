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
 * One exception, for a palm that drifts: while the owner has travelled less than the hand-over distance
 * (`spacing.sm`, passed in by the screen), another finger that travels the activation distance and
 * farther than the owner takes the stroke. The owner's few points are dropped (`drop`, then `start`) and
 * the old owner rests until it lifts. A stroke that has travelled the hand-over distance is never taken.
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
  /** How far the owner has travelled from where it landed, at most (0 with no owner). */
  readonly ownerFar: number;
}

export type TraceTouchEffect =
  /** A finger landed on an idle canvas: stop the idle countdown. */
  | { kind: 'hold' }
  /** A finger travelled the activation distance: a new stroke from its landing point to here. */
  | { kind: 'start'; from: CanvasPoint; to: CanvasPoint }
  /** A finger took the stroke from an owner that had barely moved (a drifting palm): remove its stroke. */
  | { kind: 'drop' }
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

export const NO_TRACE_POINTERS: TracePointers = { pointers: new Map(), owner: null, ownerFar: 0 };

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
  const next: TracePointers = { pointers, owner: state.owner, ownerFar: state.ownerFar };
  return { state: next, effects: !busy(state) && busy(next) ? [{ kind: 'hold' }] : [] };
}

/**
 * `minDistance`: how far a finger travels before it draws (`spacing.xs`). `handoverWithin`: while the
 * owner has travelled less than this (`spacing.sm`), a finger that travels `minDistance` and farther than
 * the owner takes the stroke.
 */
export function traceTouchesMove(
  state: TracePointers,
  touches: readonly TouchPoint[],
  minDistance: number,
  handoverWithin: number,
): TraceTouchStep {
  let { pointers, owner, ownerFar } = state;
  const effects: TraceTouchEffect[] = [];
  for (const t of touches) {
    const p = pointers.get(t.id);
    if (!p || p.resting) continue;
    const travel = Math.hypot(t.x - p.start.x, t.y - p.start.y);
    if (t.id === owner) {
      ownerFar = Math.max(ownerFar, travel);
      effects.push({ kind: 'point', at: at(t) });
    } else if (owner === null && travel >= minDistance) {
      owner = t.id;
      ownerFar = travel;
      effects.push({ kind: 'start', from: p.start, to: at(t) });
    } else if (owner !== null && travel >= minDistance && travel > ownerFar && ownerFar < handoverWithin) {
      // A drifting palm took the stroke before the drawing finger moved: the finger takes it back.
      const old = pointers.get(owner);
      const handed = new Map(pointers);
      if (old) handed.set(owner, { start: old.start, resting: true });
      pointers = handed;
      owner = t.id;
      ownerFar = travel;
      effects.push({ kind: 'drop' }, { kind: 'start', from: p.start, to: at(t) });
    }
  }
  const same = owner === state.owner && ownerFar === state.ownerFar && pointers === state.pointers;
  return { state: same ? state : { pointers, owner, ownerFar }, effects };
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
    } else if (!p.resting && !busy({ pointers, owner, ownerFar: 0 })) {
      effects.push({ kind: 'release' });
    }
  }
  return { state: { pointers, owner, ownerFar: owner === null ? 0 : state.ownerFar }, effects };
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
