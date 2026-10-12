import { browserStorage, readItem, removeItem, writeItem, type KeyValueStorage } from '../i18n/safe-storage';

/**
 * What a Clerk sign-in completed in this tab proved (F-APP-001 A-4b, section 3.9). Clerk finishes
 * a sign-in on `/signin` and then loads the router URL again, so the proof is kept in
 * `sessionStorage` (per tab, per origin) across that one navigation: the router reads it, checks
 * it names the session now signed in, and removes it. An OAuth hand-off that left this window is
 * kept the same way, so an installed PWA can say "Finish signing in here with an email code"
 * when Google finished in Safari (section 3.19). Holds a session id, a flag and a time; no name,
 * no email. Behind the guarded wrapper (`lib/i18n/safe-storage`): nothing ever throws.
 */
export const SIGNIN_RECORD_KEY = 'hr:grownup:signin';

export interface SignInProof {
  /** The Clerk session the completed sign-in created. */
  sessionId: string;
  /** Its first factor asked for a secret (password, email or SMS code, passkey). */
  secret: boolean;
}

/**
 * `proof`: a sign-in completed in this tab, for that session. `oauth`: an OAuth hand-off left this
 * window. `secret`: while still signed out, the widget verified a secret factor (the positive
 * evidence a completed sign-in needs when Clerk no longer names its first factor).
 */
export type SignInRecord = ({ v: 1; kind: 'proof'; at: number } & SignInProof) | { v: 1; kind: 'oauth' | 'secret'; at: number };

function defaultStorage(): KeyValueStorage | null {
  return browserStorage('session');
}

const isTime = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;

function parse(raw: string | null): SignInRecord | null {
  if (raw === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.v !== 1 || !isTime(record.at)) return null;
  if (record.kind === 'oauth' || record.kind === 'secret') return { v: 1, kind: record.kind, at: record.at };
  if (record.kind === 'proof' && typeof record.sessionId === 'string' && record.sessionId !== '' && typeof record.secret === 'boolean') {
    return { v: 1, kind: 'proof', sessionId: record.sessionId, secret: record.secret, at: record.at };
  }
  return null;
}

/** Lenient: corrupt or foreign values read as absent. */
export function readSignInRecord(storage: KeyValueStorage | null = defaultStorage()): SignInRecord | null {
  return parse(readItem(storage, SIGNIN_RECORD_KEY));
}

export function writeSignInProof(proof: SignInProof, now: number, storage: KeyValueStorage | null = defaultStorage()): boolean {
  const record: SignInRecord = { v: 1, kind: 'proof', sessionId: proof.sessionId, secret: proof.secret, at: now };
  return writeItem(storage, SIGNIN_RECORD_KEY, JSON.stringify(record));
}

export function writeOAuthStarted(now: number, storage: KeyValueStorage | null = defaultStorage()): boolean {
  const record: SignInRecord = { v: 1, kind: 'oauth', at: now };
  return writeItem(storage, SIGNIN_RECORD_KEY, JSON.stringify(record));
}

export function writeSecretVerified(now: number, storage: KeyValueStorage | null = defaultStorage()): boolean {
  const record: SignInRecord = { v: 1, kind: 'secret', at: now };
  return writeItem(storage, SIGNIN_RECORD_KEY, JSON.stringify(record));
}

export function clearSignInRecord(storage: KeyValueStorage | null = defaultStorage()): void {
  removeItem(storage, SIGNIN_RECORD_KEY);
}

/**
 * The adult step's tick (OD-13), kept for this tab so a Google sign-up that leaves the page, or a
 * reload during the email code, comes back to `<SignUp>` and not to the checkbox again. Holds the
 * time of the tick only. Good for `AFFIRMATION_MS`; removed once the sign-up completes or on sign-out.
 */
export const AFFIRMATION_KEY = 'hr:grownup:affirmed';

/** How long the tick stays good in this tab. */
export const AFFIRMATION_MS = 30 * 60_000;

/** The ISO time of a fresh tick in this tab, or null (absent, corrupt, stale or from the future). */
export function readAffirmation(now: number, storage: KeyValueStorage | null = defaultStorage()): string | null {
  const raw = readItem(storage, AFFIRMATION_KEY);
  if (raw === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.v !== 1 || typeof record.at !== 'string') return null;
  const at = Date.parse(record.at);
  if (!Number.isFinite(at) || now - at < 0 || now - at >= AFFIRMATION_MS) return null;
  return record.at;
}

export function writeAffirmation(at: string, storage: KeyValueStorage | null = defaultStorage()): boolean {
  return writeItem(storage, AFFIRMATION_KEY, JSON.stringify({ v: 1, at }));
}

export function clearAffirmation(storage: KeyValueStorage | null = defaultStorage()): void {
  removeItem(storage, AFFIRMATION_KEY);
}

/** Sign-out: this tab keeps no sign-in record and no adult-step tick. */
export function clearSignInTab(storage: KeyValueStorage | null = defaultStorage()): void {
  clearSignInRecord(storage);
  clearAffirmation(storage);
}
