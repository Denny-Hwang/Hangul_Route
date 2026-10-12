import { JOIN_HANDOFF_KEY, JOIN_HANDOFF_MS } from '@hangul-route/content-schema';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as native from '../join-handoff';
import { takeJoinHandoff } from '../join-handoff.web';
import type { SessionArea } from '../grown-up-handoff.web';

/**
 * F-APP-001 sections 3.6 and 3.8 (A-7): the Join screen reads the family home's join hand-off
 * once (the key is removed on read), and fills the code only within 30 minutes.
 */
vi.mock('../storage', () => ({
  readJson: vi.fn(async () => null),
  readJsonStrict: vi.fn(async () => null),
  writeJson: vi.fn(async () => undefined),
  removeKey: vi.fn(async () => undefined),
}));
vi.mock('../locale', () => ({ deviceLanguages: () => [], takeLangHandoff: () => null, setDocumentLang: () => undefined }));

const NOW = 1_800_000_000_000;

function memoryArea(initial: Record<string, string> = {}): SessionArea & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('takeJoinHandoff (web)', () => {
  it('returns a fresh code once and removes it, leaving the rest of the tab alone', () => {
    const area = memoryArea({ [JOIN_HANDOFF_KEY]: JSON.stringify({ v: 1, code: 'ABCD23', at: NOW - 60_000 }), other: 'x' });
    expect(takeJoinHandoff(area, NOW)).toBe('ABCD23');
    expect(area.data.has(JOIN_HANDOFF_KEY)).toBe(false);
    expect(area.data.get('other')).toBe('x');
    expect(takeJoinHandoff(area, NOW)).toBeNull();
  });

  it('removes an expired or damaged hand-off without filling anything', () => {
    const old = memoryArea({ [JOIN_HANDOFF_KEY]: JSON.stringify({ v: 1, code: 'ABCD23', at: NOW - JOIN_HANDOFF_MS }) });
    expect(takeJoinHandoff(old, NOW)).toBeNull();
    expect(old.data.has(JOIN_HANDOFF_KEY)).toBe(false);
    const bad = memoryArea({ [JOIN_HANDOFF_KEY]: '{oops' });
    expect(takeJoinHandoff(bad, NOW)).toBeNull();
    expect(bad.data.has(JOIN_HANDOFF_KEY)).toBe(false);
  });

  it('is null with no storage, and when the browser refuses a read or a removal', () => {
    expect(takeJoinHandoff(null, NOW)).toBeNull();
    const throwing: SessionArea = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => undefined,
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    expect(takeJoinHandoff(throwing, NOW)).toBeNull();
    const refusesRemove = memoryArea({ [JOIN_HANDOFF_KEY]: JSON.stringify({ v: 1, code: 'ABCD23', at: NOW }) });
    refusesRemove.removeItem = () => {
      throw new Error('blocked');
    };
    expect(takeJoinHandoff(refusesRemove, NOW)).toBe('ABCD23');
  });

  it("reads this tab's sessionStorage and the clock by default", () => {
    const area = memoryArea({ [JOIN_HANDOFF_KEY]: JSON.stringify({ v: 1, code: 'ABCD23', at: Date.now() }) });
    vi.stubGlobal('sessionStorage', area);
    expect(takeJoinHandoff()).toBe('ABCD23');
  });
});

describe('native stub', () => {
  it('has no hand-off (the family home is on the web app host only)', () => {
    expect(native.takeJoinHandoff()).toBeNull();
  });
});
