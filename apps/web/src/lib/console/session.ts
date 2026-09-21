/**
 * Console session — F-CONSOLE-001 §3.2. Kept in sessionStorage behind this
 * wrapper (the web stand-in for `packages/hooks`): every access is guarded,
 * SSR and private windows simply see "signed out".
 */
export interface ConsoleSession {
  token: string;
  accountId: string;
  displayName: string;
  email?: string;
}

export interface KeyValueStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export const SESSION_KEY = 'hr:console:session';

function defaultStorage(): KeyValueStorage | null {
  try {
    return typeof window !== 'undefined' && window.sessionStorage ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

function isSession(value: unknown): value is ConsoleSession {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.token === 'string' && v.token.length > 0 && typeof v.accountId === 'string' && typeof v.displayName === 'string';
}

export function readSession(storage: KeyValueStorage | null = defaultStorage()): ConsoleSession | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeSession(session: ConsoleSession, storage: KeyValueStorage | null = defaultStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(SESSION_KEY, JSON.stringify(session));
    return true;
  } catch {
    return false;
  }
}

export function clearSession(storage: KeyValueStorage | null = defaultStorage()): void {
  try {
    storage?.removeItem(SESSION_KEY);
  } catch {
    // nothing to clear
  }
}
