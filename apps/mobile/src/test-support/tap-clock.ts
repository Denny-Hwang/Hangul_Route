/**
 * The tap clock of the screen render tests (docs/specs/AMENDMENTS-TOUCH.md section 4.4, row KT-2). Every guarded press
 * (Button, a ChoiceCard or Tile outside a board) drops a repeat within `TAP_LOCK_MS` and reads the boards' clock
 * (`tapNow`). A render test taps far faster than a person, so `render-setup.ts` runs that clock here: the platform's
 * clock plus an offset, and `passTapLock()` moves it past every lock it has handed out. `press()` calls it before each
 * tap, so a press in a render test is a deliberate tap; a test of the bounce rules drives the clock itself (fake timers)
 * and taps through the host's handlers without `passTapLock()`. No design-system import here: `render-setup.ts` loads
 * this module while it stands in for the design system's clock, so the lock length comes from the caller.
 */
let offset = 0;
let last = Number.NEGATIVE_INFINITY;
let lastBase = 0;

/** The tap clock now, from the platform's clock `base`. */
export function tapClockNow(base: number): number {
  const now = base + offset;
  lastBase = base;
  if (now > last) last = now;
  return now;
}

/** Moves the tap clock to at least `lockMs` (`TAP_LOCK_MS`) after the latest time it has read, so the next press is never a bounce. */
export function passTapLock(lockMs: number): void {
  if (last === Number.NEGATIVE_INFINITY) return;
  const needed = last + lockMs - lastBase;
  if (needed > offset) offset = needed;
}
