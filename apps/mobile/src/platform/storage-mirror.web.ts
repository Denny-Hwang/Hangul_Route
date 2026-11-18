import { writePasses } from './storage-fence';

/**
 * Part of the storage wrapper (CLAUDE.md section 8, beside `storage.web.ts` and `storage-fence.ts`): a small
 * synchronous copy in `localStorage` (`hr:` + key) of a value the HTML shell must read before any app script runs.
 * Today only the device record's language, for the static splash (AMENDMENTS-FINISH-2026-11 FN-2,
 * `UI_LOCALE_MIRROR_KEY`). Never the source of truth, so it is best effort: blocked storage, a full
 * quota and a key the write fence rejects change nothing and never throw. The learner app's only `localStorage` write.
 */
const KEY_PREFIX = 'hr:';

export function writeMirror(key: string, value: string): void {
  if (!writePasses(key, 'write')) return;
  try {
    (globalThis as { localStorage?: Storage }).localStorage?.setItem(KEY_PREFIX + key, value);
  } catch {
    // Private windows, blocked storage, a full quota: the splash then detects the language instead.
  }
}
