import { LectureDeckSchema } from '@hangul-route/content-schema';
import { describe, expect, it, vi } from 'vitest';
import { loadRecentState, radioAfter, recentDayLabel, removeRecent } from '../home-view';
import { RECENT_KEY, emptyRecent, parseRecent } from '../recent';

const words = { today: 'Today', yesterday: 'Yesterday' };
const now = new Date(2026, 9, 13, 15, 0);

describe('recentDayLabel (presenter home, Recent lessons)', () => {
  it('says Today and Yesterday by the local calendar day', () => {
    expect(recentDayLabel('en', words, new Date(2026, 9, 13, 0, 5).toISOString(), now)).toBe('Today');
    expect(recentDayLabel('en', words, new Date(2026, 9, 12, 23, 59).toISOString(), now)).toBe('Yesterday');
  });

  it('gives a short date beyond yesterday', () => {
    expect(recentDayLabel('en', words, new Date(2026, 9, 9, 12, 0).toISOString(), now)).toBe('Oct 9');
  });

  it('treats a saved time ahead of the clock as today and an unreadable one as blank', () => {
    expect(recentDayLabel('en', words, new Date(2026, 9, 14, 9, 0).toISOString(), now)).toBe('Today');
    expect(recentDayLabel('en', words, 'not a date', now)).toBe('');
  });
});

describe('radioAfter (D19: arrows move and select in a chip radiogroup)', () => {
  const opts = ['en', 'es', 'ko'] as const;
  it('moves with the arrows, wraps, and jumps with Home and End', () => {
    expect(radioAfter(opts, 'en', 'ArrowRight')).toBe('es');
    expect(radioAfter(opts, 'en', 'ArrowDown')).toBe('es');
    expect(radioAfter(opts, 'ko', 'ArrowRight')).toBe('en');
    expect(radioAfter(opts, 'en', 'ArrowLeft')).toBe('ko');
    expect(radioAfter(opts, 'es', 'ArrowUp')).toBe('en');
    expect(radioAfter(opts, 'es', 'Home')).toBe('en');
    expect(radioAfter(opts, 'es', 'End')).toBe('ko');
  });
  it('ignores other keys and an unknown current value', () => {
    expect(radioAfter(opts, 'en', 'b')).toBeNull();
    expect(radioAfter(opts, 'xx' as 'en', 'ArrowRight')).toBeNull();
  });
});

describe('Recent on the home: storage on, empty, corrupt and off', () => {
  const deck = LectureDeckSchema.parse({
    v: 1,
    id: 'lecture:abcdef1234',
    title: 'Week 3 letters',
    createdAt: '2026-10-11T09:00:00Z',
    seed: 1,
    blocks: [{ kind: 'quest', id: 'quest:stage1-letters-q1' }],
  });
  const stored = { v: 1, items: [{ deck, savedAt: '2026-10-11T09:00:00Z' }] };

  it('reads the saved list', async () => {
    const state = await loadRecentState({ readJson: async () => stored, writeJson: async () => undefined });
    expect(state).toEqual({ status: 'ready', list: parseRecent(stored) });
  });

  it('reads nothing stored or corrupt data as an empty list', async () => {
    expect(await loadRecentState({ readJson: async () => null, writeJson: async () => undefined })).toEqual({ status: 'ready', list: emptyRecent() });
    expect(await loadRecentState({ readJson: async () => ({ v: 9 }), writeJson: async () => undefined })).toEqual({ status: 'ready', list: emptyRecent() });
  });

  it('reports storage off when the read fails', async () => {
    const state = await loadRecentState({
      readJson: async () => {
        throw new Error('blocked');
      },
      writeJson: async () => undefined,
    });
    expect(state).toEqual({ status: 'off' });
  });

  it('removes a deck and saves the shorter list; a failed write still removes it here', async () => {
    const writeJson = vi.fn(async () => undefined);
    const list = parseRecent(stored);
    expect(await removeRecent({ readJson: async () => stored, writeJson }, list, deck.id)).toEqual({ status: 'ready', list: emptyRecent() });
    expect(writeJson).toHaveBeenCalledWith(RECENT_KEY, emptyRecent());
    const failing = await removeRecent(
      {
        readJson: async () => stored,
        writeJson: async () => {
          throw new Error('full');
        },
      },
      list,
      deck.id,
    );
    expect(failing).toEqual({ status: 'ready', list: emptyRecent() });
  });
});
