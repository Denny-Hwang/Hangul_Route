import type { ApiResult } from './api';
import { classTransferEnabled, type ConsoleEnv } from './config';

/**
 * Class moves' release lock as the console sees it (F-SPACE-002 section 4.8 "Flag handling", T15): the entry points
 * render only when `NEXT_PUBLIC_CLASS_TRANSFER` is set, and the first `422 transfers_locked` from any transfer call
 * hides them for the rest of the session. Held in memory only (never storage, `lib/console/session.ts`): a reload
 * asks the Worker again, so unsetting the Worker var is a rollback that needs no console build.
 */

let locked = false;
const listeners = new Set<() => void>();

/** Looks at one transfer answer; the first `422 transfers_locked` locks the session and tells each subscriber once. */
export function noteTransferResult(result: ApiResult<unknown>): void {
  if (locked || result.ok || result.status !== 422 || result.code !== 'transfers_locked') return;
  locked = true;
  for (const listener of [...listeners]) listener();
}

export function transfersLockedThisSession(): boolean {
  return locked;
}

/** For `useSyncExternalStore`: called once when the session locks; returns the unsubscribe. */
export function subscribeTransferLock(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Whether the class-move entry points render: the build flag on, and no `transfers_locked` seen this session. */
export function transfersShown(env?: ConsoleEnv): boolean {
  return classTransferEnabled(env) && !locked;
}

/** Tests only: a fresh session. */
export function resetTransferLockForTests(): void {
  locked = false;
  listeners.clear();
}
