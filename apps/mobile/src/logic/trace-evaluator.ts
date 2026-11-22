/**
 * Trace Stroke evaluation gate — F-004 §3.3: a drawing is scored "on Done,
 * or after a 1.5 s idle timer past the last stroke" — the idle timer only for
 * a finished drawing (`ready`, AMENDMENTS-TRACE-IDLE §3.1).
 *
 * Both triggers feed one gate, so an attempt is evaluated exactly once.
 * Before this gate, the idle timer kept running after Done and evaluated
 * the same drawing again: two scored answers, and on a pass two advance
 * timers (a skipped round, or onFinish twice).
 *
 * Lifecycle: open → (Done | idle) → locked until the screen calls
 * `reopen()` (failed try reset) or `nextRound()`. `dispose()` on unmount.
 */
export const TRACE_IDLE_MS = 1500;

export interface TraceScheduler {
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
}

export interface TraceEvaluator {
  /** Finger down: the learner is still drawing, stop the idle countdown. */
  strokeStarted: () => void;
  /** Finger up: (re)start the idle countdown unless this attempt is scored or the drawing is not `ready()`. */
  strokeEnded: () => void;
  /** Done button. Evaluates now; returns false if this attempt was already scored. */
  done: () => boolean;
  /** Failed try has been reset — the next drawing may be evaluated. */
  reopen: () => void;
  /** Clear button: forget the countdown, keep the attempt open. */
  clear: () => void;
  /** New round: forget the countdown and open a fresh attempt. */
  nextRound: () => void;
  /** Unmount: forget the countdown; nothing evaluates afterwards. */
  dispose: () => void;
  isLocked: () => boolean;
}

const defaultScheduler: TraceScheduler = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export function createTraceEvaluator({
  idleMs,
  onEvaluate,
  ready = () => true,
  scheduler = defaultScheduler,
}: {
  idleMs: number;
  onEvaluate: () => void;
  /**
   * AMENDMENTS-TRACE-IDLE §3.1: a finger lift starts the idle countdown only when this is true
   * (the drawing is finished, `logic/trace-ready`); otherwise it cancels any running countdown, so a
   * pause never scores an unfinished drawing. Done is not gated. Default: always ready.
   */
  ready?: () => boolean;
  scheduler?: TraceScheduler;
}): TraceEvaluator {
  let idle: unknown = null;
  let locked = false;
  let disposed = false;

  const cancelIdle = (): void => {
    if (idle !== null) {
      scheduler.clearTimeout(idle);
      idle = null;
    }
  };

  const evaluateOnce = (): boolean => {
    cancelIdle();
    if (locked || disposed) return false;
    locked = true;
    onEvaluate();
    return true;
  };

  return {
    strokeStarted: cancelIdle,
    strokeEnded: () => {
      cancelIdle();
      if (locked || disposed || !ready()) return;
      idle = scheduler.setTimeout(() => {
        idle = null;
        evaluateOnce();
      }, idleMs);
    },
    done: evaluateOnce,
    reopen: () => {
      locked = false;
    },
    clear: cancelIdle,
    nextRound: () => {
      cancelIdle();
      locked = false;
    },
    dispose: () => {
      cancelIdle();
      disposed = true;
    },
    isLocked: () => locked || disposed,
  };
}

/**
 * AMENDMENTS-TOUCH 6.8 (KT-D9): the idle check follows the fingers (`logic/trace-pointers`). A finger
 * landing stops the countdown; the drawing finger lifting restarts it; a touch that never drew (a dot,
 * a graze under 4 px, a palm) leaves no ink and restarts it when ink is already there, subject to the
 * gate's `ready()` (AMENDMENTS-TRACE-IDLE §3.5): a finished drawing is still scored without the Done
 * button, an unfinished one only by Done. Stroke effects (`start`, `point`) are the screen's own.
 */
export function idleOnTouch(
  gate: Pick<TraceEvaluator, 'strokeStarted' | 'strokeEnded'> | null,
  effect: 'hold' | 'start' | 'drop' | 'point' | 'end' | 'release',
  hasInk: boolean,
): void {
  if (!gate) return;
  if (effect === 'hold') gate.strokeStarted();
  else if (effect === 'end' || (effect === 'release' && hasInk)) gate.strokeEnded();
}
