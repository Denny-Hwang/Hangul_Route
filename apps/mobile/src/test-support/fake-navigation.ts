import { vi } from 'vitest';
import type { BackGuardNavigation } from '../screens/use-back-guard';

type Listener = Parameters<BackGuardNavigation['addListener']>[1];

/**
 * The fake navigation of the route-level back tests (AMENDMENTS-DISPLAY-NAV section 7.1, AMENDMENTS-QUEST-LEAVE-RESUME
 * section 6): `@react-navigation/native` has no build that loads in Node, so a route's `beforeRemove` listeners are
 * these. `fire(type)` runs them with an event that carries `defaultPrevented` as React Navigation's does, and answers
 * whether the back was held; `listenerCount` says how many guards the route holds. What the stack shows after a back
 * is left to e2e.
 */
export function fakeNavigation(): BackGuardNavigation & {
  fire: (type: string) => boolean;
  setOptions: ReturnType<typeof vi.fn>;
  listenerCount: () => number;
} {
  const listeners: Listener[] = [];
  return {
    addListener: (_type, listener) => {
      listeners.push(listener);
      return () => listeners.splice(listeners.indexOf(listener), 1);
    },
    setOptions: vi.fn(),
    listenerCount: () => listeners.length,
    fire: (type) => {
      const event = {
        data: { action: { type } },
        defaultPrevented: false,
        preventDefault: () => {
          event.defaultPrevented = true;
        },
      };
      for (const listener of [...listeners]) listener(event);
      return event.defaultPrevented;
    },
  };
}
