import { LectureDeckSchema } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { radioAfter, recentDayLabel, recentView } from '../home-view';
import { commitRecent, emptyRecent, forgetDeck, parseRecent, readRecent } from '../recent';

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

describe('recentView (Recent on the home: loading, a list, and storage off)', () => {
  const deck = LectureDeckSchema.parse({
    v: 1,
    id: 'lecture:abcdef1234',
    title: 'Week 3 letters',
    createdAt: '2026-10-11T09:00:00Z',
    seed: 1,
    blocks: [{ kind: 'quest', id: 'quest:stage1-letters-q1' }],
  });
  const stored = { v: 1, items: [{ deck, savedAt: '2026-10-11T09:00:00Z' }] };
  const store = (read: () => Promise<unknown>) => ({ readJson: read, writeJson: async () => undefined });

  it('is loading until the boot read lands', () => {
    expect(recentView(null)).toEqual({ status: 'loading' });
  });

  it('shows the saved list', async () => {
    const loaded = await readRecent(store(async () => stored));
    expect(recentView(loaded)).toEqual({ status: 'ready', list: parseRecent(stored) });
  });

  it('shows nothing stored or corrupt data as an empty list', async () => {
    expect(recentView(await readRecent(store(async () => null)))).toEqual({ status: 'ready', list: emptyRecent() });
    expect(recentView(await readRecent(store(async () => ({ v: 9 }))))).toEqual({ status: 'ready', list: emptyRecent() });
  });

  it('shows storage off when the read failed, also after a later change', async () => {
    const failing = store(async () => {
      throw new Error('blocked');
    });
    const loaded = await readRecent(failing);
    expect(recentView(loaded)).toEqual({ status: 'off' });
    const after = await commitRecent(failing, loaded, (list) => forgetDeck(list, deck.id));
    expect(recentView(after)).toEqual({ status: 'off' });
  });
});
