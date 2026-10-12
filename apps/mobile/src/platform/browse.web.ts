import { BROWSE_PASS_SESSION_KEY, BrowsePassSchema, type BrowsePass } from '@hangul-route/content-schema';

/**
 * The browse pass in `sessionStorage['hr:browse:pass']` on the app origin
 * (F-BROWSE-001 section 4.3): written by the console's `openBrowse` or the
 * learner app's gate hand-off, read by the browse root synchronously before
 * first paint. Per tab: it survives a reload and dies with the tab. This
 * module is the only place Browse touches `sessionStorage`, and only this
 * key. Every access is guarded: blocked or missing storage reads as no pass,
 * a write reports `false`, and nothing throws.
 */
interface SessionArea {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

function sessionArea(): SessionArea | null {
  try {
    return (globalThis as { sessionStorage?: SessionArea }).sessionStorage ?? null;
  } catch {
    // Blocked site data: the getter itself throws.
    return null;
  }
}

/** Removes the pass; a storage that refuses is left as it is. */
export function removeSessionPass(): void {
  try {
    sessionArea()?.removeItem(BROWSE_PASS_SESSION_KEY);
  } catch {
    // Nothing more to do: the next read ignores an invalid value again.
  }
}

/**
 * The tab's pass, or `null`. A value that is not a valid `BrowsePass`
 * (corrupt JSON, a wrong shape, an extra field such as an account or
 * learner id) is ignored silently and removed. A valid pass stays for
 * reloads; whether it is still active is `passActive`'s call. Removing an
 * unparsable value is safe only because the v1 shape is frozen
 * (`BrowsePassSchema`): a newer writer never changes it.
 */
export function readSessionPass(): BrowsePass | null {
  let raw: string | null;
  try {
    raw = sessionArea()?.getItem(BROWSE_PASS_SESSION_KEY) ?? null;
  } catch {
    return null;
  }
  if (raw === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    removeSessionPass();
    return null;
  }
  const parsed = BrowsePassSchema.safeParse(value);
  if (!parsed.success) {
    removeSessionPass();
    return null;
  }
  return parsed.data;
}

/** Stores a valid pass (for example with a refreshed `seen`); `false` when it is not one or the browser refuses. */
export function writeSessionPass(pass: BrowsePass): boolean {
  const parsed = BrowsePassSchema.safeParse(pass);
  if (!parsed.success) return false;
  const area = sessionArea();
  if (!area) return false;
  try {
    area.setItem(BROWSE_PASS_SESSION_KEY, JSON.stringify(parsed.data));
    return true;
  } catch {
    return false;
  }
}
