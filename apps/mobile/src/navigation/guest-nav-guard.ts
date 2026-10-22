/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON section 7.1, CS-G1 (row GU-4 review): the save's two learner screens,
 * `CreateProfile` and `PinEntry`, are shared with the root stack and name many routes outside the `Guest` stack
 * (Paywall, the Grown-up area, Join a class, the level check). Only their guest branches run here, but an action the
 * nested stack does not handle would bubble up to the root, so the `Guest` stack hands them a guarded `navigation`:
 * - a move (`navigate`, `replace`, `push`) reaches only a route of this stack, and `PinEntry` only as
 *   `{ next: 'SaveGuest' }` (never a setup, a reset or another destination, CS-G10);
 * - `reset` and `dispatch` of the stack itself are dropped;
 * - its parent (the root) takes one action only: the reset to Home of the saved learner (`{ index: 0, routes:
 *   [{ name: 'Main' }] }`, section 8.4), once the save has ended the run;
 * - every other method that could move (`navigateDeprecated`, `preload`, `popTo`, ...) is dropped; what only reads or
 *   listens (`goBack`, `setOptions`, `addListener`, `getState`, ...) passes through.
 * Whatever is dropped does nothing. `guest-stack.test.ts` runs every route either screen names through this guard.
 */

/** What passes through unguarded: reads, listeners, options and the stack's own back. */
const PASS = new Set(['goBack', 'canGoBack', 'setOptions', 'setParams', 'addListener', 'removeListener', 'getState', 'getId', 'isFocused', 'pop', 'popToTop']);
const MOVES = new Set(['navigate', 'replace', 'push']);

/** A move inside the `Guest` stack: one of its routes; `PinEntry` only as the save's verify-only PIN. */
export function guestStackMoveAllowed(routes: readonly string[], name: unknown, params: unknown): boolean {
  if (typeof name !== 'string' || !routes.includes(name)) return false;
  if (name !== 'PinEntry') return true;
  if (typeof params !== 'object' || params === null) return false;
  const keys = Object.keys(params);
  return keys.length === 1 && (params as { next?: unknown }).next === 'SaveGuest';
}

/** Section 8.4: the one root state the save's screens may set: Home of the saved learner, alone. */
export function guestRootResetAllowed(state: unknown): boolean {
  if (typeof state !== 'object' || state === null) return false;
  const { index, routes } = state as { index?: unknown; routes?: unknown };
  if (index !== 0 || !Array.isArray(routes) || routes.length !== 1) return false;
  const only = routes[0] as unknown;
  return typeof only === 'object' && only !== null && Object.keys(only).length === 1 && (only as { name?: unknown }).name === 'Main';
}

type Blocked = (what: string) => void;

const silent: Blocked = () => undefined;

/** A move's name and params, also in the object form (`navigate({ name, params })`). */
function moveOf(args: unknown[]): { name: unknown; params: unknown } {
  const [first, second] = args;
  if (typeof first === 'object' && first !== null) return { name: (first as { name?: unknown }).name, params: (first as { params?: unknown }).params };
  return { name: first, params: second };
}

function guardRoot<T extends object>(root: T, onBlocked: Blocked): T {
  const target = root;
  // A fresh object as the proxy's target: no invariant of the real object (a frozen method) can bind the answers.
  return new Proxy({} as T, {
    get(_shell, prop) {
      const value: unknown = Reflect.get(target, prop);
      if (typeof value !== 'function') return value;
      const call = value as (...args: unknown[]) => unknown;
      if (prop === 'reset') {
        return (state: unknown) => (guestRootResetAllowed(state) ? call.call(target, state) : onBlocked('root.reset'));
      }
      if (prop === 'dispatch') {
        return (action: unknown) => {
          const a = action as { type?: unknown; payload?: unknown } | null;
          if (typeof a === 'object' && a !== null && a.type === 'RESET' && guestRootResetAllowed(a.payload)) return call.call(target, action);
          return onBlocked('root.dispatch');
        };
      }
      if (prop === 'getState' || prop === 'isFocused' || prop === 'getId') return call.bind(target);
      return () => onBlocked(`root.${String(prop)}`);
    },
  });
}

/**
 * The `navigation` the `Guest` stack gives a shared learner screen (`CreateProfile`, `PinEntry`). `routes`: the
 * stack's routes (`GUEST_STACK_ROUTES`). `onBlocked` hears every dropped action (tests).
 */
export function guardGuestNavigation<T extends object>(navigation: T, routes: readonly string[], onBlocked: Blocked = silent): T {
  const target = navigation;
  return new Proxy({} as T, {
    get(_shell, prop) {
      const value: unknown = Reflect.get(target, prop);
      if (typeof value !== 'function') return value;
      const call = value as (...args: unknown[]) => unknown;
      const key = String(prop);
      if (PASS.has(key)) return call.bind(target);
      if (MOVES.has(key)) {
        return (...args: unknown[]) => {
          const { name, params } = moveOf(args);
          return guestStackMoveAllowed(routes, name, params) ? call.apply(target, args) : onBlocked(`${key}(${String(name)})`);
        };
      }
      if (key === 'getParent') {
        return (...args: unknown[]) => {
          const parent = call.apply(target, args);
          return typeof parent === 'object' && parent !== null ? guardRoot(parent, onBlocked) : parent;
        };
      }
      return () => onBlocked(key);
    },
  });
}
