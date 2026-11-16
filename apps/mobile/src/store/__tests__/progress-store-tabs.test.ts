import type { ProgressSnapshot } from '@hangul-route/content-schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * [AU] AMENDMENTS-AUDIT-2026-11 row AU-11 (audit FUNC-1): two tabs (or the installed app's window and a browser tab)
 * do not write over each other's progress. Each "tab" here is its own copy of the store's modules (`openTab`); they
 * share one IndexedDB stand-in (raw strings, through the real `storage.web.ts`) and one BroadcastChannel stand-in
 * (through the real `progress-channel.web.ts`, each tab with its own channel, as each browser tab has).
 */
const shared = vi.hoisted(() => ({
  mem: new Map<string, string>(),
  /** Storage transactions run (`idb-keyval`'s `update`), per key. */
  transactions: [] as string[],
  /** Storage writes that landed, per key. */
  writes: [] as string[],
  /** Messages posted on a channel, by name. */
  posted: [] as string[],
  channels: [] as { name: string; onmessage: ((event: { data: unknown }) => void) | null }[],
  /** A browser without BroadcastChannel: no tab hears another; only the write itself merges. */
  noChannel: false,
}));
vi.mock('idb-keyval', () => ({
  get: vi.fn(async (k: string) => shared.mem.get(k)),
  set: vi.fn(async (k: string, v: string) => {
    shared.mem.set(k, v);
    shared.writes.push(k);
  }),
  del: vi.fn(async (k: string) => {
    shared.mem.delete(k);
  }),
  keys: vi.fn(async () => [...shared.mem.keys()]),
  clear: vi.fn(async () => shared.mem.clear()),
  createStore: vi.fn(),
  // One readwrite transaction: the read and the write with nothing in between; a throw from the callback writes nothing.
  update: vi.fn(async (k: string, next: (old: string | undefined) => string) => {
    await Promise.resolve();
    shared.transactions.push(k);
    const value = next(shared.mem.get(k));
    shared.mem.set(k, value);
    shared.writes.push(k);
  }),
}));
vi.mock('../../platform/storage', async () => await import('../../platform/storage.web'));
vi.mock('../../platform/telemetry', () => ({ track: vi.fn(async () => true) }));

/** A BroadcastChannel: a message reaches every other open channel of the same name, never the one that posted it. */
class FakeBroadcastChannel {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  constructor(readonly name: string) {
    shared.channels.push(this);
  }
  postMessage(data: unknown): void {
    shared.posted.push(this.name);
    for (const other of shared.channels) {
      if (other !== this && other.name === this.name) queueMicrotask(() => other.onmessage?.({ data }));
    }
  }
  close(): void {}
}

const ID = 'profile:two-tabs';
const KEY = `hr:progress:${ID}`;

const saved = (over: Partial<ProgressSnapshot> = {}): ProgressSnapshot => ({
  profileId: ID,
  updatedAt: '2026-11-01T09:00:00.000Z',
  episodes: [],
  quests: [{ questId: 'quest:a', episodeId: 'episode:e', startedAt: '2026-11-01T09:00:00.000Z', completedAt: '2026-11-01T09:05:00.000Z', stars: 1, attempts: 1, accuracy: 0.4 }],
  cards: [{ cardId: 'card:book', unlockedAt: '2026-11-01T09:05:00.000Z', newSinceLastView: false }],
  sessions: [],
  homework: [],
  reviews: [],
  streakDays: 0,
  questDoneAt: { 'quest:a': '2026-11-01T09:05:00.000Z' },
  ...over,
});
const homework = (id: string): ProgressSnapshot['homework'][number] => ({
  id,
  profileId: ID,
  questId: `quest:${id}`,
  episodeId: 'episode:e',
  assignedBy: 'system',
  assignedAt: '2026-11-01T00:00:00.000Z',
  targetDate: '2026-11-20',
});

/** One tab: its own store, its own channel, bound as App.tsx binds it. */
async function openTab() {
  vi.resetModules();
  vi.doMock('../../platform/progress-channel', async () => {
    const web = await vi.importActual<typeof import('../../platform/progress-channel.web')>('../../platform/progress-channel.web');
    const { createPrefsHub } = await vi.importActual<typeof import('../../platform/prefs-channel.web')>('../../platform/prefs-channel.web');
    const env = { hub: createPrefsHub(() => (shared.noChannel ? null : new FakeBroadcastChannel(web.PROGRESS_CHANNEL))), win: null, doc: null };
    return {
      postProgressChanged: () => web.postProgressChanged(env),
      subscribeProgressChanged: (onChange: () => void) => web.subscribeProgressChanged(onChange, env),
    };
  });
  const { useProgressStore, followProgressChanges } = await import('../progress-store');
  const { setProgressPersistListener } = await import('../../logic/sync/persist-hook');
  const { notifyProfileRemoved } = await import('../profile-removal');
  const notified: string[] = [];
  setProgressPersistListener((id) => notified.push(id));
  const unfollow = followProgressChanges();
  const store = useProgressStore;
  return {
    store,
    notified,
    unfollow,
    removeLearner: () => notifyProfileRemoved(ID),
    hydrate: () => store.getState().hydrate(ID),
    held: () => store.getState().byProfile[ID],
    quests: () => (store.getState().byProfile[ID]?.quests ?? []).map((q) => q.questId).sort(),
    cards: () => (store.getState().byProfile[ID]?.cards ?? []).map((c) => c.cardId).sort(),
    finish: (questId: string, stars: 0 | 1 | 2 | 3 = 2) => store.getState().recordQuestComplete(ID, { questId, episodeId: 'episode:e', stars, accuracy: stars / 3, attempts: 1 }),
    unlock: (cardId: string) => store.getState().unlockCards(ID, [{ cardId }]),
  };
}

const stored = (): ProgressSnapshot => JSON.parse(shared.mem.get(KEY) as string) as ProgressSnapshot;
const storedQuests = (): string[] => stored().quests.map((q) => q.questId).sort();
const storedCards = (): string[] => stored().cards.map((c) => c.cardId).sort();

/** Let the storage transactions and the channel messages in flight land. */
async function settle(): Promise<void> {
  for (let i = 0; i < 80; i += 1) await Promise.resolve();
}

beforeEach(() => {
  shared.mem.clear();
  shared.transactions.length = 0;
  shared.writes.length = 0;
  shared.posted.length = 0;
  shared.channels.length = 0;
  shared.noChannel = false;
});

afterEach(() => {
  vi.doUnmock('../../platform/progress-channel');
});

describe('[AU] two tabs, one learner (row AU-11)', () => {
  it('each tab finishes a different quest and earns a different card: the stored snapshot holds both, and so does each tab', async () => {
    shared.mem.set(KEY, JSON.stringify(saved()));
    const a = await openTab();
    const b = await openTab();
    await Promise.all([a.hydrate(), b.hydrate()]);

    // The same tick in both tabs: neither has heard of the other's write.
    a.finish('quest:b');
    a.unlock('card:rice');
    b.finish('quest:c');
    b.unlock('card:moon');
    await settle();

    expect(storedQuests()).toEqual(['quest:a', 'quest:b', 'quest:c']);
    expect(storedCards()).toEqual(['card:book', 'card:moon', 'card:rice']);
    expect(a.quests()).toEqual(['quest:a', 'quest:b', 'quest:c']);
    expect(b.quests()).toEqual(['quest:a', 'quest:b', 'quest:c']);
    expect(a.cards()).toEqual(['card:book', 'card:moon', 'card:rice']);
    expect(b.cards()).toEqual(['card:book', 'card:moon', 'card:rice']);
    // Both tabs hold exactly what is stored: nothing is left to write, and nobody keeps posting.
    expect(JSON.stringify(a.held())).toBe(shared.mem.get(KEY));
    expect(JSON.stringify(b.held())).toBe(shared.mem.get(KEY));
    const posted = shared.posted.length;
    await settle();
    expect(shared.posted.length).toBe(posted);
  });

  it('a broadcast makes the other tab read again: it shows what was earned without writing anything itself', async () => {
    shared.mem.set(KEY, JSON.stringify(saved()));
    const a = await openTab();
    const b = await openTab();
    await Promise.all([a.hydrate(), b.hydrate()]);
    shared.writes.length = 0;
    shared.posted.length = 0;

    a.finish('quest:b', 3);
    await settle();

    expect(b.quests()).toEqual(['quest:a', 'quest:b']);
    expect(b.held()?.quests.find((q) => q.questId === 'quest:b')?.stars).toBe(3);
    // One write (tab A's) and one message (tab A's): tab B only read.
    expect(shared.writes).toEqual([KEY]);
    expect(shared.posted).toEqual(['hr-progress']);
    // Sync in tab B is not asked to upload what tab A already announced.
    expect(b.notified).toEqual([]);
    expect(a.notified).toEqual([ID]);
  });

  it('with no BroadcastChannel the write itself merges: the tab that writes second keeps what the first stored', async () => {
    shared.noChannel = true;
    shared.mem.set(KEY, JSON.stringify(saved()));
    const a = await openTab();
    const b = await openTab();
    await Promise.all([a.hydrate(), b.hydrate()]);

    a.finish('quest:b');
    a.unlock('card:rice');
    await settle();
    // Tab B never heard of it.
    expect(b.quests()).toEqual(['quest:a']);
    b.finish('quest:c');
    await settle();

    expect(storedQuests()).toEqual(['quest:a', 'quest:b', 'quest:c']);
    expect(storedCards()).toEqual(['card:book', 'card:rice']);
    // Memory in tab B takes the merged result, and its sync is told there is more to upload.
    expect(b.quests()).toEqual(['quest:a', 'quest:b', 'quest:c']);
    expect(b.cards()).toEqual(['card:book', 'card:rice']);
    expect(b.notified.length).toBeGreaterThanOrEqual(2);
    // Tab A catches up at its next write, and loses nothing of its own.
    a.finish('quest:d');
    await settle();
    expect(storedQuests()).toEqual(['quest:a', 'quest:b', 'quest:c', 'quest:d']);
    expect(a.quests()).toEqual(['quest:a', 'quest:b', 'quest:c', 'quest:d']);
  });

  it('stars never go down: the same quest replayed in both tabs keeps the better run, and each attempt counts once', async () => {
    shared.noChannel = true;
    shared.mem.set(KEY, JSON.stringify(saved()));
    const a = await openTab();
    const b = await openTab();
    await Promise.all([a.hydrate(), b.hydrate()]);

    a.finish('quest:a', 3);
    await settle();
    expect(stored().quests[0]?.stars).toBe(3);
    // Tab B still holds the 1-star run and replays it at 2 stars.
    b.finish('quest:a', 2);
    await settle();

    const quest = stored().quests.find((q) => q.questId === 'quest:a');
    expect(quest?.stars).toBe(3);
    // 1 in the saved copy, 1 more in each tab.
    expect(quest?.attempts).toBe(3);
    expect(b.held()?.quests.find((q) => q.questId === 'quest:a')?.stars).toBe(3);
    // The first finish is never moved later.
    expect(stored().questDoneAt?.['quest:a']).toBe('2026-11-01T09:05:00.000Z');
  });

  it('a card seen in one tab stays seen, and a card earned in the other stays earned', async () => {
    shared.noChannel = true;
    shared.mem.set(KEY, JSON.stringify(saved({ cards: [{ cardId: 'card:book', unlockedAt: '2026-11-01T09:05:00.000Z', newSinceLastView: true }] })));
    const a = await openTab();
    const b = await openTab();
    await Promise.all([a.hydrate(), b.hydrate()]);
    a.store.getState().markCardsSeen(ID, ['card:book']);
    await settle();
    b.unlock('card:moon');
    await settle();
    expect(stored().cards.map((c) => [c.cardId, c.newSinceLastView])).toEqual([
      ['card:book', false],
      ['card:moon', true],
    ]);
  });

  it('two first records (a new learner or a guest opened in two tabs) are merged too', async () => {
    shared.noChannel = true;
    const a = await openTab();
    const b = await openTab();
    await Promise.all([a.hydrate(), b.hydrate()]);
    a.finish('quest:a');
    await settle();
    b.finish('quest:b');
    await settle();
    expect(storedQuests()).toEqual(['quest:a', 'quest:b']);
    expect(b.quests()).toEqual(['quest:a', 'quest:b']);
  });

  it('a write made while the transaction is in flight is not lost when the transaction brings in the other tab', async () => {
    shared.noChannel = true;
    shared.mem.set(KEY, JSON.stringify(saved()));
    const a = await openTab();
    const b = await openTab();
    await Promise.all([a.hydrate(), b.hydrate()]);
    a.finish('quest:b');
    await settle();

    b.finish('quest:c');
    // The transaction has been asked for, not run; the learner earns a card meanwhile.
    b.unlock('card:moon');
    await Promise.resolve();
    b.finish('quest:d');
    await settle();

    expect(storedQuests()).toEqual(['quest:a', 'quest:b', 'quest:c', 'quest:d']);
    expect(storedCards()).toEqual(['card:book', 'card:moon']);
    expect(b.quests()).toEqual(['quest:a', 'quest:b', 'quest:c', 'quest:d']);
  });
});

describe('[AU] writes stay cheap and end (row AU-11)', () => {
  it('many saves in one tick are stored by at most two transactions, and a read-again with nothing new writes nothing', async () => {
    shared.mem.set(KEY, JSON.stringify(saved()));
    const a = await openTab();
    const b = await openTab();
    await Promise.all([a.hydrate(), b.hydrate()]);
    shared.transactions.length = 0;
    shared.writes.length = 0;

    for (let i = 0; i < 10; i += 1) a.finish(`quest:n${i}`);
    await settle();
    expect(stored().quests).toHaveLength(11);
    // Tab A: the transaction in flight and one waiting behind it. Tab B: one read-again per message.
    const writesByA = shared.writes.length;
    expect(writesByA).toBeGreaterThanOrEqual(1);
    expect(writesByA).toBeLessThanOrEqual(2);
    expect(b.quests()).toHaveLength(11);

    // Back in front with nothing new anywhere: a transaction that reads, no write, no message.
    shared.writes.length = 0;
    shared.posted.length = 0;
    for (const channel of shared.channels) channel.onmessage?.({ data: { v: 1, kind: 'changed' } });
    await settle();
    expect(shared.writes).toEqual([]);
    expect(shared.posted).toEqual([]);
  });

  it('a merge that latches or reconciles is saved once and does not start another merge', async () => {
    shared.noChannel = true;
    shared.mem.set(KEY, JSON.stringify(saved()));
    const a = await openTab();
    const b = await openTab();
    await Promise.all([a.hydrate(), b.hydrate()]);
    a.finish('quest:b');
    await settle();
    shared.transactions.length = 0;
    b.finish('quest:c');
    await settle();
    await settle();
    // The merge, and at most the follow-ups it asked for (each finds the stored record as this tab left it).
    expect(shared.transactions.length).toBeLessThanOrEqual(3);
    expect(JSON.stringify(b.held())).toBe(shared.mem.get(KEY));
  });
});

describe('[AU] what a tab does on purpose is not undone by the merge (row AU-11)', () => {
  it('a homework item the plan reconcile dropped (replaceSnapshot) stays dropped while the other tab\'s card is kept', async () => {
    shared.noChannel = true;
    shared.mem.set(KEY, JSON.stringify(saved({ homework: [homework('h1'), homework('h2')] })));
    const a = await openTab();
    const b = await openTab();
    await Promise.all([a.hydrate(), b.hydrate()]);

    a.unlock('card:rice');
    await settle();
    // Tab B's plans changed: its reconcile hands back the snapshot without h1.
    const held = b.held() as ProgressSnapshot;
    b.store.getState().replaceSnapshot(ID, { ...held, homework: held.homework.filter((h) => h.id !== 'h1'), updatedAt: '2026-11-16T10:00:00.000Z' });
    await settle();

    expect(stored().homework.map((h) => h.id)).toEqual(['h2']);
    expect(storedCards()).toEqual(['card:book', 'card:rice']);
    expect(b.held()?.homework.map((h) => h.id)).toEqual(['h2']);
    // And tab A, which still held h1, does not bring it back with its next write.
    a.finish('quest:b');
    await settle();
    expect(stored().homework.map((h) => h.id)).toEqual(['h2']);
    expect(storedQuests()).toEqual(['quest:a', 'quest:b']);
  });

  it('with no other tab writing, a replacement is stored exactly as it is (a server snapshot replaces, it is not unioned back)', async () => {
    shared.mem.set(KEY, JSON.stringify(saved({ homework: [homework('h1')] })));
    const a = await openTab();
    await a.hydrate();
    const replacement = saved({ homework: [], cards: [], updatedAt: '2026-11-16T10:00:00.000Z' });
    a.store.getState().replaceSnapshot(ID, replacement);
    await settle();
    expect(stored().homework).toEqual([]);
    expect(stored().cards).toEqual([]);
  });

  it('reset clears even when the other tab wrote meanwhile, and the other tab follows', async () => {
    shared.mem.set(KEY, JSON.stringify(saved()));
    const a = await openTab();
    const b = await openTab();
    await Promise.all([a.hydrate(), b.hydrate()]);
    b.finish('quest:b');
    a.store.getState().reset(ID);
    await settle();
    expect(stored().quests).toEqual([]);
    expect(stored().cards).toEqual([]);
    expect(a.quests()).toEqual([]);
    expect(b.quests()).toEqual([]);
  });

  it('a learner removed in this tab stays removed: no late write, and a message from another tab reads nothing back', async () => {
    shared.mem.set(KEY, JSON.stringify(saved()));
    const a = await openTab();
    const b = await openTab();
    await Promise.all([a.hydrate(), b.hydrate()]);

    b.finish('quest:late');
    b.removeLearner();
    await settle();
    expect(shared.mem.has(KEY)).toBe(false);
    expect(b.held()).toBeUndefined();

    // Tab A has not heard of the removal yet and writes once more; tab B hears the message.
    a.finish('quest:b');
    await settle();
    expect(b.held()).toBeUndefined();
    b.finish('quest:again');
    b.store.getState().replaceSnapshot(ID, saved());
    await settle();
    expect(storedQuests()).toEqual(['quest:a', 'quest:b']);
    expect(shared.posted.length).toBe(1);
  });

  it('a profile this tab has not read is not read by a message either (hydrate reads it, once)', async () => {
    shared.mem.set(KEY, JSON.stringify(saved()));
    const a = await openTab();
    const b = await openTab();
    await a.hydrate();
    shared.transactions.length = 0;
    a.finish('quest:b');
    await settle();
    expect(b.held()).toBeUndefined();
    // Tab A's write only.
    expect(shared.transactions).toEqual([KEY]);
    await b.hydrate();
    expect(b.quests()).toEqual(['quest:a', 'quest:b']);
  });
});
