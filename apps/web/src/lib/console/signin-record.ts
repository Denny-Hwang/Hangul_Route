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

export type SignInRecord = ({ v: 1; kind: 'proof'; at: number } & SignInProof) | { v: 1; kind: 'oauth'; at: number };

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
  if (record.kind === 'oauth') return { v: 1, kind: 'oauth', at: record.at };
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

export function clearSignInRecord(storage: KeyValueStorage | null = defaultStorage()): void {
  removeItem(storage, SIGNIN_RECORD_KEY);
}
