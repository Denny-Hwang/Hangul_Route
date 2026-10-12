/**
 * The storage write fence (F-BROWSE-001 section 4.10), shared by both storage
 * variants (`storage.ts`, `storage.web.ts`) so one fence covers every write
 * path. While a fence is set, `writeJson` and `removeKey` for a key it
 * rejects resolve without touching storage. Reads are never fenced.
 *
 * The All lessons root sets it at boot so that no screen it reuses can write
 * a learner's data; the learner app never sets it.
 */
export type WriteFence = (key: string) => boolean;
export type WriteFenceOp = 'write' | 'remove';
/** Told about every dropped write or remove (a test seam; production sets none). */
export type WriteFenceObserver = (key: string, op: WriteFenceOp) => void;

let fence: WriteFence | null = null;
let observer: WriteFenceObserver | null = null;

/** Allow only the keys `allow` accepts; `null` lifts the fence. */
export function setWriteFence(allow: WriteFence | null): void {
  fence = allow;
}

export function setWriteFenceObserver(next: WriteFenceObserver | null): void {
  observer = next;
}

function allowed(key: string): boolean {
  if (!fence) return true;
  try {
    return fence(key) === true;
  } catch {
    // A fence that fails keeps the write out (fail closed).
    return false;
  }
}

/** Whether a write or remove of `key` may touch storage now; tells the observer when it may not. */
export function writePasses(key: string, op: WriteFenceOp): boolean {
  if (allowed(key)) return true;
  try {
    observer?.(key, op);
  } catch {
    // An observer never turns a dropped write into an error.
  }
  return false;
}
