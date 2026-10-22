/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON sections 6.2, 6.4 and 12 (row GU-3, fix stage): two per-tab marks of the guest
 * run, kept in this tab's `sessionStorage` so a reload of the tab keeps them, and in module memory where the browser
 * has none or refuses it (a native build never runs a guest). Each mark names the guest record it belongs to, so a
 * mark of an earlier record never applies to a new one. Nothing here leaves the device (no URL, no telemetry).
 *
 * - `left`: the run was ended in this tab (Close or Leave, section 6.4). A reload of Welcome then stays on Welcome
 *   with its waiting card instead of reopening quest 1; the next start of the run clears it.
 * - `letter`: a new run whose first letter is still to come (`guest.first_letter` once per record, section 12), with
 *   the run's start, so a reload before Discover page 1 still sends it once.
 */
interface SessionArea {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export const GUEST_LEFT_SESSION_KEY = 'hr:guest:left';
export const GUEST_LETTER_SESSION_KEY = 'hr:guest:letter';

const memory = new Map<string, string>();

function sessionArea(): SessionArea | null {
  try {
    return (globalThis as { sessionStorage?: SessionArea }).sessionStorage ?? null;
  } catch {
    // Blocked site data: the getter itself throws.
    return null;
  }
}

function read(key: string): string | null {
  const area = sessionArea();
  if (area !== null) {
    try {
      return area.getItem(key);
    } catch {
      // A refusing storage: the memory copy below.
    }
  }
  return memory.get(key) ?? null;
}

function write(key: string, value: string | null): void {
  if (value === null) memory.delete(key);
  else memory.set(key, value);
  const area = sessionArea();
  if (area === null) return;
  try {
    if (value === null) area.removeItem(key);
    else area.setItem(key, value);
  } catch {
    // A refusing storage keeps the memory copy only.
  }
}

/** Section 6.4: the run of record `id` ended in this tab. */
export function markGuestLeft(id: string): void {
  write(GUEST_LEFT_SESSION_KEY, id);
}

/** Whether the run of record `id` was ended in this tab (and not started again since). */
export function guestLeftHere(id: string): boolean {
  return read(GUEST_LEFT_SESSION_KEY) === id;
}

/** The run started again: the leave mark is gone. */
export function clearGuestLeft(): void {
  write(GUEST_LEFT_SESSION_KEY, null);
}

/** Section 12: record `id` began a new run at `startedAt` (ms); its first letter is still to come. */
export function markFirstLetterDue(id: string, startedAt: number): void {
  write(GUEST_LETTER_SESSION_KEY, JSON.stringify({ id, startedAt }));
}

/** The start (ms) of record `id`'s new run whose first letter is still to come, or null (sent, or none). */
export function firstLetterDueFor(id: string): number | null {
  const raw = read(GUEST_LETTER_SESSION_KEY);
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as { id?: unknown; startedAt?: unknown };
    return parsed.id === id && typeof parsed.startedAt === 'number' && Number.isFinite(parsed.startedAt) ? parsed.startedAt : null;
  } catch {
    return null;
  }
}

/** The first letter was sent (or its record is gone). */
export function clearFirstLetterDue(): void {
  write(GUEST_LETTER_SESSION_KEY, null);
}
