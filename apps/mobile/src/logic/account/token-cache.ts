/**
 * F-AUTH-004 section 6.2 (row NS-2; CS-N7): the token cache Clerk's Expo SDK writes its items through. Pure: the
 * SecureStore calls come in through `SecureItemPort` (`platform/clerk-token-cache.native.ts` binds them to the
 * keychain service `hr.clerk`, `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, no `requireAuthentication`).
 *
 * - **Two storages, one rule** (ND-9): `memory` holds Clerk's items for this run only; `secure` writes them to
 *   SecureStore. The caller chooses `secure` only on a device whose gate state is `pin`; it starts as `memory`, so
 *   nothing is ever kept by default.
 * - **Key index**: SecureStore reads, writes and deletes by key and cannot list a service, so every key written is
 *   first added to the index item `hr.clerk.index` (a JSON list of keys). A key that cannot be indexed (a bad name, a
 *   failed index read or write) is never written to SecureStore: it is held in memory for this run instead.
 * - **Wipe** (sign-out, the install sweep, a gate state that is not `pin`): every indexed key, every key the pinned
 *   Clerk version is known to use (`CLERK_NAMED_KEYS`), then the index; true only when every delete answered.
 * - **Unreadable items**: a read that throws (an Android decrypt error after a restore, a damaged item) deletes that
 *   item and the index and reads as signed out.
 *
 * Every SecureStore call runs one at a time, so two saves never read the same index and lose a key.
 */

/** The keychain service (iOS) and key alias (Android) of every Clerk item; never `hr.biometric` (OA-9). */
export const CLERK_KEYCHAIN_SERVICE = 'hr.clerk';

/** The index item: the keys this adapter wrote, so a wipe can find them. */
export const CLERK_INDEX_KEY = 'hr.clerk.index';

/**
 * The keys `@clerk/clerk-expo` 2.20.2 (the pinned version) writes through the token cache: its client token
 * (`__clerk_client_jwt`, `provider/singleton/createClerkInstance.js`). A wipe deletes them by name too, so an item
 * written before the index existed, or missing from a damaged index, still goes. Check this list when the pin moves.
 */
export const CLERK_NAMED_KEYS: readonly string[] = ['__clerk_client_jwt'];

/** SecureStore keys may hold letters, digits, `.`, `-` and `_` only. */
const KEY_RE = /^[A-Za-z0-9._-]{1,200}$/;

export function isStorableKey(key: string): boolean {
  return KEY_RE.test(key) && key !== CLERK_INDEX_KEY;
}

/** What the adapter needs of SecureStore, bound to the `hr.clerk` service. A missing key reads as null. */
export interface SecureItemPort {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
  remove: (key: string) => Promise<void>;
}

/** Clerk's `TokenCache` (`@clerk/clerk-expo`): the shape the provider's `tokenCache` prop takes. */
export interface ClerkTokenCache {
  getToken: (key: string) => Promise<string | null | undefined>;
  saveToken: (key: string, token: string) => Promise<void>;
  clearToken?: (key: string) => void;
}

export type TokenStorage = 'memory' | 'secure';

export interface TokenCacheController {
  /** The object handed to `ClerkProvider`. */
  cache: ClerkTokenCache;
  storage: () => TokenStorage;
  /**
   * Keep Clerk's items from now on (a `pin` device): moves this run's items into SecureStore, index first. Resolves to
   * false when one could not be kept (it stays in memory for this run).
   */
  useSecure: () => Promise<boolean>;
  /**
   * Keep nothing from now on (a device whose gate state is not `pin`): deletes every kept item (`wipe` of SecureStore
   * only); this run's memory items stay until `endMemorySession` or `wipe`. Resolves to whether every delete answered.
   */
  useMemory: () => Promise<boolean>;
  /** Forgets this run's memory items (the session close on a device with no PIN, ND-9). */
  endMemorySession: () => void;
  /** Deletes every Clerk item, kept and in memory (sign-out, the install sweep). True when every delete answered. */
  wipe: () => Promise<boolean>;
}

/**
 * What the token storage does for a gate state (section 6.2, ND-9; the gate state of section 7.2):
 *
 * | Phase    | Gate state      | Step                                                                          |
 * | `mount`  | `pin`           | `use_secure`: read the kept session (a memory item from a non-PIN run is dropped) |
 * | `mount`  | `open`, `nopin` | `use_memory`: delete every kept item; this run's items stay in memory only      |
 * | `change` | `open`, `nopin` | `wipe` when items are kept (the PIN went: the kept session ends), else `keep`   |
 * | `change` | `pin`           | `keep`: a session made before the PIN existed is not kept (7.3: sign in again)  |
 * | any      | `unknown`       | `keep`: nothing is decided, and Clerk does not mount on `unknown`               |
 */
export type TokenStep = 'keep' | 'use_secure' | 'use_memory' | 'wipe';

export function tokenStepFor(gate: 'unknown' | 'nopin' | 'open' | 'pin', phase: 'mount' | 'change', storage: TokenStorage): TokenStep {
  if (gate === 'unknown') return 'keep';
  if (phase === 'mount') return gate === 'pin' ? 'use_secure' : 'use_memory';
  if (gate === 'pin') return 'keep';
  return storage === 'secure' ? 'wipe' : 'keep';
}

/** The stored index, strictly: a JSON list of storable keys; anything else is damaged. */
export function indexKeysOf(raw: string | null): string[] | 'damaged' {
  if (raw === null) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return 'damaged';
  }
  if (!Array.isArray(parsed) || !parsed.every((k): k is string => typeof k === 'string' && isStorableKey(k))) return 'damaged';
  return [...new Set(parsed)];
}

export function createTokenCache(port: SecureItemPort): TokenCacheController {
  let mode: TokenStorage = 'memory';
  /** This run's items: every item in `memory` mode, and in `secure` mode the ones that could not be kept. */
  const memory = new Map<string, string>();
  let queue: Promise<unknown> = Promise.resolve();

  /** Runs `task` after every SecureStore call queued before it. */
  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(task, task);
    queue = run.catch(() => undefined);
    return run;
  };

  /** The index as stored; `null` when the read failed. A damaged index is deleted and reads as empty. */
  const readIndex = async (): Promise<string[] | null> => {
    let raw: string | null;
    try {
      raw = await port.get(CLERK_INDEX_KEY);
    } catch {
      return null;
    }
    const keys = indexKeysOf(raw);
    if (keys !== 'damaged') return keys;
    try {
      await port.remove(CLERK_INDEX_KEY);
    } catch {
      return null;
    }
    return [];
  };

  /** Writes one item to SecureStore, index first; false when it could not be indexed or written. */
  const keep = async (key: string, value: string): Promise<boolean> => {
    if (!isStorableKey(key)) return false;
    const keys = await readIndex();
    if (keys === null) return false;
    if (!keys.includes(key)) {
      try {
        await port.set(CLERK_INDEX_KEY, JSON.stringify([...keys, key]));
      } catch {
        return false;
      }
    }
    try {
      await port.set(key, value);
      return true;
    } catch {
      return false;
    }
  };

  /** Deletes every kept item and then the index; true when every delete answered and the index could be read. */
  const wipeKept = async (): Promise<boolean> => {
    const indexed = await readIndex();
    let ok = indexed !== null;
    for (const key of new Set([...(indexed ?? []), ...CLERK_NAMED_KEYS])) {
      try {
        await port.remove(key);
      } catch {
        ok = false;
      }
    }
    try {
      await port.remove(CLERK_INDEX_KEY);
    } catch {
      ok = false;
    }
    return ok;
  };

  const cache: ClerkTokenCache = {
    getToken: async (key) => {
      const held = memory.get(key);
      if (held !== undefined || mode === 'memory') return held ?? null;
      if (!isStorableKey(key)) return null;
      return serial(async () => {
        try {
          return await port.get(key);
        } catch {
          // An item that cannot be read is gone for good: delete it and the index, and read as signed out.
          await port.remove(key).catch(() => undefined);
          await port.remove(CLERK_INDEX_KEY).catch(() => undefined);
          return null;
        }
      });
    },
    saveToken: async (key, token) => {
      if (mode === 'memory') {
        memory.set(key, token);
        return;
      }
      const kept = await serial(() => keep(key, token));
      // Not kept: this run still signs in, and nothing of it outlives the run.
      if (kept) memory.delete(key);
      else memory.set(key, token);
    },
    clearToken: (key) => {
      memory.delete(key);
      if (isStorableKey(key)) void serial(() => port.remove(key)).catch(() => undefined);
    },
  };

  return {
    cache,
    storage: () => mode,
    useSecure: async () => {
      mode = 'secure';
      let all = true;
      for (const [key, value] of [...memory]) {
        if (await serial(() => keep(key, value))) memory.delete(key);
        else all = false;
      }
      return all;
    },
    useMemory: async () => {
      mode = 'memory';
      return serial(wipeKept);
    },
    endMemorySession: () => {
      memory.clear();
    },
    wipe: async () => {
      memory.clear();
      return serial(wipeKept);
    },
  };
}
