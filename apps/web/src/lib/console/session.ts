import { CONSOLE_SESSION_KEY } from '@hangul-route/content-schema';
import { browserStorage, readItem, removeItem, writeItem, type KeyValueStorage } from '../i18n/safe-storage';

/**
 * Console session — F-CONSOLE-001 §3.2. Kept in sessionStorage behind the guarded
 * wrapper (`lib/i18n/safe-storage`, the web stand-in for `packages/hooks`): every
 * access is guarded, SSR and private windows simply see "signed out".
 */
export interface ConsoleSession {
  token: string;
  accountId: string;
  displayName: string;
  email?: string;
}

export type { KeyValueStorage };

/** Named once in content-schema (F-APP-001 section 3.14), so the learner app clears the same key. */
export const SESSION_KEY = CONSOLE_SESSION_KEY;

function defaultStorage(): KeyValueStorage | null {
  return browserStorage('session');
}

function isSession(value: unknown): value is ConsoleSession {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.token === 'string' && v.token.length > 0 && typeof v.accountId === 'string' && typeof v.displayName === 'string';
}

export function readSession(storage: KeyValueStorage | null = defaultStorage()): ConsoleSession | null {
  const raw = readItem(storage, SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeSession(session: ConsoleSession, storage: KeyValueStorage | null = defaultStorage()): boolean {
  return writeItem(storage, SESSION_KEY, JSON.stringify(session));
}

export function clearSession(storage: KeyValueStorage | null = defaultStorage()): void {
  removeItem(storage, SESSION_KEY);
}
