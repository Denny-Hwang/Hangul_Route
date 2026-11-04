import { describe, expect, it } from 'vitest';
import type { RelinkView } from '../api';
import { RELINK_REMIND_MS, RELINK_REMINDED_KEY, RELINK_SHOWN_KEY, addId, nextRelinkPopup, readIds, titleWithCount } from '../relink-popup';
import type { KeyValueStorage } from '@/lib/i18n/safe-storage';

/**
 * AMENDMENTS-GROWNUP-UX GX-2 section 5.3: which re-link request opens the pop-up (once per request per tab session, once
 * more at 2 minutes left after Later, never a third time), the ids-only session sets, and the tab title's count (5.4).
 */
const NOW = new Date('2026-10-31T12:00:00.000Z');
const at = (minutes: number): string => new Date(NOW.getTime() + minutes * 60_000).toISOString();
const relink = (id: string, minutesLeft: number, over: Partial<RelinkView> = {}): RelinkView => ({
  id,
  learnerId: `profile:${id}`,
  learnerName: id,
  deviceId: 'device:new',
  platform: 'ios',
  requestedAt: at(-1),
  expiresAt: at(minutesLeft),
  status: 'pending',
  ...over,
});

function memoryStorage(seed: Record<string, string> = {}): KeyValueStorage & { data: Record<string, string> } {
  const data = { ...seed };
  return {
    data,
    getItem: (k) => (k in data ? (data[k] as string) : null),
    setItem: (k, v) => {
      data[k] = v;
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
}

describe('nextRelinkPopup', () => {
  it('a request this tab has not shown opens the pop-up; the soonest-closing one first', () => {
    const pick = nextRelinkPopup([relink('b', 9), relink('a', 4)], new Set(), new Set(), NOW);
    expect(pick?.request.id).toBe('a');
    expect(pick?.reminder).toBe(false);
  });

  it('a shown request opens nothing until 2 minutes or less are left, then once as the reminder', () => {
    const shown = new Set(['a']);
    expect(nextRelinkPopup([relink('a', 3)], shown, new Set(), NOW)).toBeNull();
    const pick = nextRelinkPopup([relink('a', RELINK_REMIND_MS / 60_000)], shown, new Set(), NOW);
    expect(pick).toEqual({ request: expect.objectContaining({ id: 'a' }), reminder: true });
    expect(nextRelinkPopup([relink('a', 1)], shown, new Set(['a']), NOW)).toBeNull();
  });

  it('expired, answered and unread lists open nothing', () => {
    expect(nextRelinkPopup([relink('a', -1)], new Set(), new Set(), NOW)).toBeNull();
    expect(nextRelinkPopup([relink('a', 5, { status: 'approved' })], new Set(), new Set(), NOW)).toBeNull();
    expect(nextRelinkPopup(null, new Set(), new Set(), NOW)).toBeNull();
    expect(nextRelinkPopup([relink('a', 5, { expiresAt: 'not a date' })], new Set(), new Set(), NOW)).toBeNull();
  });

  it('a new request is picked before a reminder that closes later', () => {
    const pick = nextRelinkPopup([relink('old', 1.5), relink('new', 8)], new Set(['old']), new Set(), NOW);
    expect(pick?.request.id).toBe('old');
    expect(pick?.reminder).toBe(true);
    expect(nextRelinkPopup([relink('old', 1.5), relink('new', 8)], new Set(['old']), new Set(['old']), NOW)?.request.id).toBe('new');
  });
});

describe('the session sets hold request ids only', () => {
  it('reads what it wrote, de-duplicated, and nothing but strings', () => {
    const storage = memoryStorage();
    addId(storage, RELINK_SHOWN_KEY, 'relink:1');
    addId(storage, RELINK_SHOWN_KEY, 'relink:2');
    addId(storage, RELINK_SHOWN_KEY, 'relink:1');
    expect([...readIds(storage, RELINK_SHOWN_KEY)]).toEqual(['relink:2', 'relink:1']);
    expect(storage.data[RELINK_SHOWN_KEY]).toBe('["relink:2","relink:1"]');
    expect(readIds(storage, RELINK_REMINDED_KEY).size).toBe(0);
  });

  it('an unreadable value, a foreign shape or no storage read as none and never throw', () => {
    expect(readIds(memoryStorage({ [RELINK_SHOWN_KEY]: '{oops' }), RELINK_SHOWN_KEY).size).toBe(0);
    expect([...readIds(memoryStorage({ [RELINK_SHOWN_KEY]: '[1,"a",null]' }), RELINK_SHOWN_KEY)]).toEqual(['a']);
    expect(readIds(memoryStorage({ [RELINK_SHOWN_KEY]: '"a"' }), RELINK_SHOWN_KEY).size).toBe(0);
    expect(readIds(null, RELINK_SHOWN_KEY).size).toBe(0);
    expect(() => addId(null, RELINK_SHOWN_KEY, 'a')).not.toThrow();
  });

  it('keeps at most the newest 200 ids', () => {
    const storage = memoryStorage();
    for (let i = 0; i < 205; i += 1) addId(storage, RELINK_SHOWN_KEY, `relink:${i}`);
    const ids = [...readIds(storage, RELINK_SHOWN_KEY)];
    expect(ids).toHaveLength(200);
    expect(ids[0]).toBe('relink:5');
  });
});

describe('titleWithCount (section 5.4: a count only, never a name)', () => {
  it('puts "(n) " in front while n is above 0, replaces an old count and takes it off at 0', () => {
    expect(titleWithCount('Hangul Route for teachers', 3)).toBe('(3) Hangul Route for teachers');
    expect(titleWithCount('(3) Hangul Route for teachers', 1)).toBe('(1) Hangul Route for teachers');
    expect(titleWithCount('(3) Hangul Route for teachers', 0)).toBe('Hangul Route for teachers');
    expect(titleWithCount('Hangul Route for teachers', 0)).toBe('Hangul Route for teachers');
    expect(titleWithCount('Hangul Route for teachers', 120)).toBe('(99+) Hangul Route for teachers');
    expect(titleWithCount('(99+) Hangul Route for teachers', 0)).toBe('Hangul Route for teachers');
  });
});
