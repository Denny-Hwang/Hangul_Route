import { LastPersonaSchema, SHELL_DB, SHELL_KEYS, SHELL_STORE, parseLenient, type AdultPersona } from '@hangul-route/content-schema';
import { createStore, get, type UseStore } from 'idb-keyval';

/**
 * The learner app's only window on the shell store (F-APP-001 sections 3.5 and 3.14): the
 * console's own IndexedDB database `hr-shell`, store `kv`, outside the learner `hr:` namespace.
 * The learner app reads one key, `lastPersona`, and never writes there; Welcome's "Continue as …"
 * (A-7) uses it. A convenience: a missing IndexedDB, a store that cannot open, a failed read or
 * a value that is not `{ v: 1, persona }` all read as "none".
 */
export interface ShellReader {
  get: (key: string) => Promise<unknown>;
}

let shellDb: UseStore | null = null;

function indexedDbAvailable(): boolean {
  try {
    return typeof (globalThis as { indexedDB?: unknown }).indexedDB !== 'undefined';
  } catch {
    // Blocked site data: touching the API throws.
    return false;
  }
}

/**
 * `hr-shell` / `kv`, opened once per page and opened again after a failed read (a connection the
 * browser closed stays failed otherwise); null where the browser has no IndexedDB.
 */
function defaultReader(): ShellReader | null {
  if (!indexedDbAvailable()) return null;
  const store = (shellDb ??= createStore(SHELL_DB, SHELL_STORE));
  return {
    get: (key) =>
      get(key, store).catch((error: unknown) => {
        if (shellDb === store) shellDb = null;
        throw error;
      }),
  };
}

export async function readLastPersona(open: () => ShellReader | null = defaultReader): Promise<AdultPersona | null> {
  try {
    const reader = open();
    if (!reader) return null;
    return parseLenient(LastPersonaSchema, await reader.get(SHELL_KEYS.lastPersona))?.persona ?? null;
  } catch {
    return null;
  }
}
