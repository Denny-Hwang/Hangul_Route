/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS OA-D19: a read, change and write of shared state run inside
 * `navigator.locks.request(name)`, so every tab of the PWA sees one truth (the PIN attempt count). Where Web Locks
 * are missing (native builds, older browsers), the step runs at once and is told so (`locked: false`), so it can
 * re-read the stored state and merge it with its own instead. A lock request that throws falls back the same way.
 */
interface LockManagerLike {
  request: <T>(name: string, callback: () => Promise<T>) => Promise<T>;
}

/** The PIN attempt state's lock (`account:pinAttempts` and `account:rescueAttempts`). */
export const PIN_ATTEMPTS_LOCK = 'hr:pin-attempts';

function browserLocks(): LockManagerLike | null {
  try {
    const locks = (globalThis as { navigator?: { locks?: Partial<LockManagerLike> } }).navigator?.locks;
    return typeof locks?.request === 'function' ? (locks as LockManagerLike) : null;
  } catch {
    return null;
  }
}

export async function withTabLock<T>(
  name: string,
  step: (locked: boolean) => Promise<T>,
  locks: LockManagerLike | null = browserLocks(),
): Promise<T> {
  if (locks === null) return step(false);
  let entered = false;
  try {
    return await locks.request(name, () => {
      entered = true;
      return step(true);
    });
  } catch (error) {
    // A step that ran and threw is the step's error; a lock that could not be taken falls back.
    if (entered) throw error;
    return step(false);
  }
}
