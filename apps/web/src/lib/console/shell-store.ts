import { DeviceUsesSchema, LastPersonaSchema, PinOwnerSchema, SHELL_DB, SHELL_KEYS, SHELL_STORE, parseLenient, type AdultPersona, type DeviceUses, type LastPersona, type PinOwner } from '@hangul-route/content-schema';
import { createStore, del, get, set, type UseStore } from 'idb-keyval';
import { indexedDbAvailable } from '../i18n/safe-storage';

/**
 * The shell store (F-APP-001 sections 3.5, 3.9, 3.14): its own IndexedDB database `hr-shell`,
 * store `kv`, outside the learner `hr:` namespace, so learner backups and key listings never
 * see it. It holds the last persona (`{ v: 1, persona }`) and the trusted PIN epoch (a number,
 * never `0`). A convenience, not a source of truth: every access is guarded, unreadable means
 * "none" and a refused write reports false.
 */
export interface ShellStore {
  get: (key: string) => Promise<unknown>;
  set: (key: string, value: unknown) => Promise<void>;
  del: (key: string) => Promise<void>;
}

let shellDb: UseStore | null = null;

/** `hr-shell` / `kv`, opened once per page; null where the browser has no IndexedDB. */
function defaultShellStore(): ShellStore | null {
  if (!indexedDbAvailable()) return null;
  const store = (shellDb ??= createStore(SHELL_DB, SHELL_STORE));
  return {
    get: (key) => get(key, store),
    set: (key, value) => set(key, value, store),
    del: (key) => del(key, store),
  };
}

function isRealEpoch(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export async function readLastPersona(store: ShellStore | null = defaultShellStore()): Promise<AdultPersona | null> {
  if (!store) return null;
  try {
    return parseLenient(LastPersonaSchema, await store.get(SHELL_KEYS.lastPersona))?.persona ?? null;
  } catch {
    return null;
  }
}

/** Written by the adult frame whenever a persona home renders with that persona held. */
export async function writeLastPersona(persona: AdultPersona, store: ShellStore | null = defaultShellStore()): Promise<boolean> {
  if (!store) return false;
  const record: LastPersona = { v: 1, persona };
  try {
    await store.set(SHELL_KEYS.lastPersona, record);
    return true;
  } catch {
    return false;
  }
}

/** The marker epoch confirmed by the last secret-proving sign-in in this browser; `0` and junk read as none. */
export async function readTrustedEpoch(store: ShellStore | null = defaultShellStore()): Promise<number | null> {
  if (!store) return null;
  try {
    const raw = await store.get(SHELL_KEYS.pinEpoch);
    return isRealEpoch(raw) ? raw : null;
  } catch {
    return null;
  }
}

/**
 * After a secret-proving sign-in: stores `trustableEpoch(marker)`, or forgets any earlier
 * epoch when there is none (`null`, and `0`, which is never trusted).
 */
export async function writeTrustedEpoch(epoch: number | null, store: ShellStore | null = defaultShellStore()): Promise<boolean> {
  if (!store) return false;
  try {
    if (isRealEpoch(epoch)) await store.set(SHELL_KEYS.pinEpoch, epoch);
    else await store.del(SHELL_KEYS.pinEpoch);
    return true;
  } catch {
    return false;
  }
}

// ---- [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS sections 7.1, 7.2 and 7.6 (row OA-3) ----

/** Writes `value` under `key`; false when there is no store or the write is refused. */
async function put(key: string, value: unknown, store: ShellStore | null): Promise<boolean> {
  if (!store) return false;
  try {
    await store.set(key, value);
    return true;
  } catch {
    return false;
  }
}

/** [OA] `deviceUses` (`DeviceUsesSchema`): written by the adult frame on every persona home; a record that does not parse is never written. */
export async function writeDeviceUses(record: DeviceUses, store: ShellStore | null = defaultShellStore()): Promise<boolean> {
  const parsed = DeviceUsesSchema.safeParse(record);
  return parsed.success ? put(SHELL_KEYS.deviceUses, parsed.data, store) : false;
}

/** [OA] Sign out deletes `deviceUses` (section 7.1). */
export async function deleteDeviceUses(store: ShellStore | null = defaultShellStore()): Promise<boolean> {
  if (!store) return false;
  try {
    await store.del(SHELL_KEYS.deviceUses);
    return true;
  } catch {
    return false;
  }
}

/** [OA] `pinOwner` (`PinOwnerSchema`); unreadable or junk reads as none. */
export async function readPinOwner(store: ShellStore | null = defaultShellStore()): Promise<PinOwner | null> {
  if (!store) return null;
  try {
    return parseLenient(PinOwnerSchema, await store.get(SHELL_KEYS.pinOwner));
  } catch {
    return null;
  }
}

/** [OA] Writes `pinOwner`; a record that does not parse (epoch `0`, a bad fingerprint) is never written. */
export async function writePinOwner(record: PinOwner, store: ShellStore | null = defaultShellStore()): Promise<boolean> {
  const parsed = PinOwnerSchema.safeParse(record);
  return parsed.success ? put(SHELL_KEYS.pinOwner, parsed.data, store) : false;
}

/** [OA] `pinPromptSeen`: true once the set-a-PIN card showed; null when the store cannot be read (the card then stays away). */
export async function readPinPromptSeen(store: ShellStore | null = defaultShellStore()): Promise<boolean | null> {
  if (!store) return null;
  try {
    return (await store.get(SHELL_KEYS.pinPromptSeen)) === true;
  } catch {
    return null;
  }
}

/** [OA] Marks the set-a-PIN card seen: `true`, no other data. */
export async function writePinPromptSeen(store: ShellStore | null = defaultShellStore()): Promise<boolean> {
  return put(SHELL_KEYS.pinPromptSeen, true, store);
}
