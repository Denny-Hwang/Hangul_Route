import { LectureDeckSchema, type LectureDeck } from '@hangul-route/content-schema';
import { describe, expect, it, vi } from 'vitest';
import {
  RECENT_KEY,
  RECENT_MAX,
  emptyRecent,
  forgetDeck,
  loadRecent,
  parseRecent,
  rememberDeck,
  saveRecent,
  readRecent,
  commitRecent,
  setLastSlide,
  type RecentList,
  type RecentStore,
} from '../recent';

const deck = (n: number, over: Partial<LectureDeck> = {}): LectureDeck =>
  LectureDeckSchema.parse({
    v: 1,
    id: `lecture:deck${String(n).padStart(3, '0')}`,
    title: `Lesson ${n}`,
    createdAt: '2026-10-11T09:00:00Z',
    seed: n,
    blocks: [{ kind: 'quest', id: 'quest:stage1-letters-q1' }],
    picker: { mode: 'names', count: 12 },
    ...over,
  });

const at = (minute: number): string => `2026-10-11T10:${String(minute).padStart(2, '0')}:00Z`;

describe('Recent lessons (F-TCH-004 §3.12)', () => {
  it('stores under lecture:recent, at most 10 decks', () => {
    expect(RECENT_KEY).toBe('lecture:recent');
    expect(RECENT_MAX).toBe(10);
  });

  it('remembers a deck newest first and keeps at most 10', () => {
    let list = emptyRecent();
    for (let i = 1; i <= 12; i += 1) list = rememberDeck(list, deck(i), at(i));
    expect(list.items).toHaveLength(10);
    expect(list.items[0]!.deck.id).toBe('lecture:deck012');
    expect(list.items[9]!.deck.id).toBe('lecture:deck003');
  });

  it('a deck saved again moves to the front once and starts over (no stale slide)', () => {
    let list = rememberDeck(emptyRecent(), deck(1), at(1));
    list = rememberDeck(list, deck(2), at(2));
    list = setLastSlide(list, 'lecture:deck001', 'quest:stage1-letters-q1/s2/jamo:giyeok');
    list = rememberDeck(list, deck(1), at(3));
    expect(list.items.map((i) => i.deck.id)).toEqual(['lecture:deck001', 'lecture:deck002']);
    expect(list.items[0]).toEqual({ deck: deck(1), savedAt: at(3) });
  });

  it('records the open slide for Resume, and ignores an unknown deck', () => {
    const list = rememberDeck(emptyRecent(), deck(1), at(1));
    const resumed = setLastSlide(list, 'lecture:deck001', 'quest:stage1-letters-q1/title');
    expect(resumed.items[0]!.lastSlideKey).toBe('quest:stage1-letters-q1/title');
    expect(setLastSlide(list, 'lecture:nope00', 'x')).toBe(list);
  });

  it('removes a deck', () => {
    let list = rememberDeck(emptyRecent(), deck(1), at(1));
    list = rememberDeck(list, deck(2), at(2));
    expect(forgetDeck(list, 'lecture:deck002').items.map((i) => i.deck.id)).toEqual(['lecture:deck001']);
  });

  it('parses what it wrote', () => {
    let list = rememberDeck(emptyRecent(), deck(1), at(1));
    list = setLastSlide(list, 'lecture:deck001', 'end');
    expect(parseRecent(JSON.parse(JSON.stringify(list)))).toEqual(list);
  });

  it('corrupt storage is an empty list', () => {
    for (const raw of [null, undefined, 'x', 42, [], {}, { v: 2, items: [] }, { v: 1, items: 'no' }, { v: 1, items: [], extra: 1 }]) {
      expect(parseRecent(raw)).toEqual(emptyRecent());
    }
  });

  it('drops a broken item, a duplicate deck and anything past 10, keeping the rest', () => {
    const good = { deck: deck(1), savedAt: at(1) };
    const items = [
      good,
      { deck: { ...deck(2), title: '' }, savedAt: at(2) },
      { deck: deck(3), savedAt: 'yesterday' },
      { deck: deck(1), savedAt: at(4) },
      ...Array.from({ length: 12 }, (_, i) => ({ deck: deck(10 + i), savedAt: at(10 + i) })),
    ];
    const parsed = parseRecent({ v: 1, items });
    expect(parsed.items).toHaveLength(10);
    expect(parsed.items[0]).toEqual(good);
    expect(parsed.items.filter((i) => i.deck.id === 'lecture:deck001')).toHaveLength(1);
  });

  it('a saved item has no field that could hold a label (D12, §3.10)', () => {
    const withLabels = { deck: { ...deck(1), picker: { mode: 'names', count: 2, labels: ['Mina', 'Jun'] } }, savedAt: at(1) };
    expect(parseRecent({ v: 1, items: [withLabels] })).toEqual(emptyRecent());
    const extraField = { deck: deck(1), savedAt: at(1), labels: ['Mina'] };
    expect(parseRecent({ v: 1, items: [extraField] })).toEqual(emptyRecent());
    const item = rememberDeck(emptyRecent(), deck(1), at(1)).items[0]!;
    expect(Object.keys(item).sort()).toEqual(['deck', 'savedAt']);
    expect(Object.keys(item.deck.picker ?? {}).sort()).toEqual(['count', 'mode']);
  });

  it('loads and saves through an injected store, never throwing', async () => {
    const written: Record<string, unknown> = {};
    const store: RecentStore = {
      readJson: vi.fn(async (key: string) => written[key] ?? null),
      writeJson: vi.fn(async (key: string, value: unknown) => {
        written[key] = value;
      }),
    };
    expect(await loadRecent(store)).toEqual(emptyRecent());
    const list: RecentList = rememberDeck(emptyRecent(), deck(1), at(1));
    await saveRecent(store, list);
    expect(store.writeJson).toHaveBeenCalledWith('lecture:recent', list);
    expect(await loadRecent(store)).toEqual(list);

    const broken: RecentStore = {
      readJson: vi.fn(async () => {
        throw new Error('idb down');
      }),
      writeJson: vi.fn(async () => {
        throw new Error('quota');
      }),
    };
    expect(await loadRecent(broken)).toEqual(emptyRecent());
    await expect(saveRecent(broken, list)).resolves.toBe(false);
    await expect(saveRecent(store, list)).resolves.toBe(true);
  });

  it('never stores a slide key or a save time that would drop the deck on the next load', () => {
    const list = rememberDeck(emptyRecent(), deck(1), at(1));
    expect(setLastSlide(list, 'lecture:deck001', '')).toBe(list);
    expect(setLastSlide(list, 'lecture:deck001', 'k'.repeat(257))).toBe(list);
    expect(setLastSlide(list, 'lecture:deck001', 'k'.repeat(256)).items[0]!.lastSlideKey).toHaveLength(256);
    expect(rememberDeck(list, deck(2), 'yesterday')).toBe(list);
  });

  it('keeps a deck whose only fault is a bad slide key, without the key', () => {
    const items = [{ deck: deck(1), savedAt: at(1), lastSlideKey: 'k'.repeat(300) }];
    expect(parseRecent({ v: 1, items })).toEqual({ v: 1, items: [{ deck: deck(1), savedAt: at(1) }] });
    const labelled = [{ deck: deck(1), savedAt: at(1), lastSlideKey: '', labels: ['Mina'] }];
    expect(parseRecent({ v: 1, items: labelled })).toEqual(emptyRecent());
  });
});

describe('readRecent and commitRecent (a failed read never overwrites Recent)', () => {
  const memory = (initial: unknown): RecentStore & { writeJson: ReturnType<typeof vi.fn> } => {
    let value: unknown = initial;
    return {
      readJson: vi.fn(async () => value),
      writeJson: vi.fn(async (_key: string, next: unknown) => {
        value = next;
      }),
    };
  };

  it('a read that throws gives an empty list that is never written', async () => {
    const store: RecentStore & { writeJson: ReturnType<typeof vi.fn> } = {
      readJson: vi.fn(async () => {
        throw new Error('idb down');
      }),
      writeJson: vi.fn(async () => undefined),
    };
    const loaded = await readRecent(store);
    expect(loaded).toEqual({ list: emptyRecent(), writable: false });
    const after = await commitRecent(store, loaded, (list) => rememberDeck(list, deck(1), at(1)));
    expect(after.list.items).toHaveLength(1);
    expect(store.writeJson).not.toHaveBeenCalled();
  });

  it('stored data that is not a Recent list is never written over', async () => {
    const store = memory({ v: 9, something: 'else' });
    const loaded = await readRecent(store);
    expect(loaded.writable).toBe(false);
    await commitRecent(store, loaded, (list) => rememberDeck(list, deck(1), at(1)));
    expect(store.writeJson).not.toHaveBeenCalled();
  });

  it('nothing stored, or a readable list, is written on a change and not on a no-op', async () => {
    const empty = memory(null);
    const loaded = await readRecent(empty);
    expect(loaded).toEqual({ list: emptyRecent(), writable: true });
    const saved = await commitRecent(empty, loaded, (list) => rememberDeck(list, deck(1), at(1)));
    expect(empty.writeJson).toHaveBeenCalledTimes(1);
    const same = await commitRecent(empty, saved, (list) => list);
    expect(same.list).toBe(saved.list);
    expect(empty.writeJson).toHaveBeenCalledTimes(1);

    const kept = memory(rememberDeck(emptyRecent(), deck(2), at(2)));
    const read = await readRecent(kept);
    expect(read.writable).toBe(true);
    expect(read.list.items[0]!.deck.id).toBe('lecture:deck002');
    expect(await loadRecent(kept)).toEqual(read.list);
  });
});
