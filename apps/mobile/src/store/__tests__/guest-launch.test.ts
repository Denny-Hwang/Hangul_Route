import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON sections 6.1 to 6.4 and 12, CS-G3, CS-G4 (row GU-3, section 19): the launch's
 * guest step, Welcome's Back to my quest, the first letter, quest 1 done and the leave. Storage is an in-memory map;
 * the boot intent and the guest switch are set per test.
 */
const disk = vi.hoisted(() => new Map<string, string>());
const failing = vi.hoisted(() => ({ write: false }));
const parse = (key: string): unknown => (disk.has(key) ? JSON.parse(disk.get(key)!) : null);
vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async (key: string) => parse(key)),
  readJsonStrict: vi.fn(async (key: string) => parse(key)),
  readJsonExact: vi.fn(async (key: string) => parse(key)),
  writeJson: vi.fn(async (key: string, value: unknown) => {
    if (failing.write && key === 'guest') throw new Error('QuotaExceededError');
    disk.set(key, JSON.stringify(value));
  }),
  removeKey: vi.fn(async (key: string) => void disk.delete(key)),
  listKeys: vi.fn(async () => [...disk.keys()]),
}));
vi.mock('../../platform/profiles-channel', () => ({ postProfilesChanged: () => undefined, subscribeProfilesChanged: () => () => undefined }));
vi.mock('../../platform/grown-up-tab', () => ({ endGrownUpTab: vi.fn() }));
vi.mock('../../platform/locale', () => ({ deviceLanguages: () => [], takeLangHandoff: () => null, setDocumentLang: vi.fn() }));
vi.mock('../../platform/device', () => ({ getDeviceId: vi.fn(async () => 'device-test') }));
vi.mock('../../platform/app-visibility', () => ({ subscribeAppVisibility: () => () => undefined }));
vi.mock('../../platform/device-uses', () => ({ readDeviceUses: async () => [] }));
const boot = vi.hoisted(() => ({ intent: null as unknown, consumed: 0 }));
vi.mock('../../platform/app-root', () => ({
  peekBootIntent: () => boot.intent,
  consumeBootIntent: () => {
    boot.intent = null;
    boot.consumed += 1;
  },
}));
const handoff = vi.hoisted(() => ({ waiting: false }));
vi.mock('../../platform/join-handoff', () => ({ takeJoinHandoff: () => null, hasJoinHandoff: () => handoff.waiting }));
const sent = vi.hoisted(() => [] as Array<{ name: string; payload?: unknown; profileId?: string }>);
vi.mock('../../platform/telemetry', () => ({
  track: vi.fn(async (event: { name: string; payload?: unknown; profileId?: string }) => {
    sent.push(event);
    return true;
  }),
}));
const switches = vi.hoisted(() => ({ guest: true, chooser: true }));
vi.mock('../../config/flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../config/flags')>();
  return {
    ...actual,
    flags: new Proxy(actual.flags, {
      get: (target, key) => (key === 'guestLessonEnabled' ? switches.guest : key === 'whoChooserEnabled' ? switches.chooser : Reflect.get(target, key)),
    }),
  };
});

import { GUEST_REOPEN_MS, type GuestRecord, type Profile } from '@hangul-route/content-schema';
import { endGrownUpTab } from '../../platform/grown-up-tab';
import { endGuestRunTo, guestFirstQuest, guestRouteFor, noteGuestQuestDone, noteGuestStep, resumeGuestFromWelcome, takeGuestLaunch } from '../guest-launch';
import { useGuestStore } from '../guest-store';
import { useProfileStore } from '../profile-store';
import { useUiStore } from '../ui-store';
import { holdJoin, takeHeldJoin } from '../who-chooser';

const T0 = Date.parse('2026-10-22T10:00:00.000Z');
const iso = (ms: number): string => new Date(ms).toISOString();
const record = (patch: Partial<GuestRecord> = {}): GuestRecord => ({ v: 1, id: 'profile:guest001', startedAt: iso(T0), lastAt: iso(T0), via: 'site', questDone: false, ...patch });
const mina: Profile = { id: 'profile:mina0001', displayName: 'Mina', ageGroup: '8-9', avatar: 'hoya-blue', role: 'learner', createdAt: '2026-10-01T00:00:00.000Z' };
const stored = (): GuestRecord | null => parse('guest') as GuestRecord | null;
const named = (name: string) => sent.filter((e) => e.name === name);

const locks = { request: vi.fn(async <T>(_name: string, step: () => Promise<T>): Promise<T> => step()) };

beforeEach(() => {
  disk.clear();
  sent.length = 0;
  failing.write = false;
  boot.intent = null;
  boot.consumed = 0;
  handoff.waiting = false;
  switches.guest = true;
  switches.chooser = true;
  takeHeldJoin();
  vi.stubGlobal('navigator', { locks });
  vi.mocked(endGrownUpTab).mockClear();
  useGuestStore.setState({ record: null, running: false, hydrated: true, memoryOnly: false });
  useProfileStore.setState({ profiles: [], activeId: null, hydrated: true });
  useUiStore.setState({ parentGateOpenedAt: null, lastPinVerifiedAt: null });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const quest = (): { questId: string; episodeId: string } => guestFirstQuest()!;

describe('guestFirstQuest (GU-D4)', () => {
  it('is Stage 1 quest 1, the quest of the first-run preview', () => {
    expect(quest()).toEqual({ questId: expect.any(String), episodeId: expect.any(String) });
    expect(guestRouteFor(record(), quest())).toEqual({ screen: 'QuestPlayer', params: quest() });
    expect(guestRouteFor(record({ questDone: true }), quest())).toEqual({ screen: 'GuestLater' });
  });
});

describe('takeGuestLaunch on a device with no learner profile (6.1)', () => {
  it('try=1, no guest: a new run at quest 1 step 1, guest.started { site, resumed: false }, try taken', async () => {
    boot.intent = { kind: 'try' };
    expect(await takeGuestLaunch(T0)).toEqual({ screen: 'QuestPlayer', params: quest() });
    expect(boot.consumed).toBe(1);
    expect(useGuestStore.getState().running).toBe(true);
    expect(stored()).toMatchObject({ via: 'site', questDone: false, startedAt: iso(T0) });
    expect(named('guest.started')).toEqual([{ name: 'guest.started', payload: { via: 'site', resumed: false } }]);
  });

  it('try=1 with a grown-up session open: the session is closed before the run (CS-G3)', async () => {
    boot.intent = { kind: 'try' };
    useUiStore.setState({ parentGateOpenedAt: T0, lastPinVerifiedAt: T0 });
    await takeGuestLaunch(T0);
    expect(useUiStore.getState().parentGateOpenedAt).toBeNull();
    expect(useUiStore.getState().lastPinVerifiedAt).toBeNull();
    expect(endGrownUpTab).toHaveBeenCalled();
  });

  it('try=1, a live guest not done: resumed at quest 1; done: the Not now card; both resumed: true', async () => {
    disk.set('guest', JSON.stringify(record()));
    useGuestStore.setState({ record: record() });
    boot.intent = { kind: 'try' };
    expect(await takeGuestLaunch(T0 + 5 * GUEST_REOPEN_MS)).toEqual({ screen: 'QuestPlayer', params: quest() });
    expect(stored()!.id).toBe('profile:guest001');
    expect(named('guest.started')).toEqual([{ name: 'guest.started', payload: { via: 'site', resumed: true } }]);

    sent.length = 0;
    disk.set('guest', JSON.stringify(record({ questDone: true })));
    useGuestStore.setState({ record: record({ questDone: true }), running: false });
    boot.intent = { kind: 'try' };
    expect(await takeGuestLaunch(T0)).toEqual({ screen: 'GuestLater' });
    expect(named('guest.started')).toEqual([{ name: 'guest.started', payload: { via: 'site', resumed: true } }]);
  });

  it('the switch off: try is taken and dropped, no run, the live record kept', async () => {
    switches.guest = false;
    disk.set('guest', JSON.stringify(record()));
    useGuestStore.setState({ record: record() });
    boot.intent = { kind: 'try' };
    expect(await takeGuestLaunch(T0)).toBeNull();
    expect(boot.consumed).toBe(1);
    expect(useGuestStore.getState().running).toBe(false);
    expect(stored()).toEqual(record());
    expect(sent).toEqual([]);
  });

  it('a join code held in memory or handed over by the family home wins (OA-D20)', async () => {
    boot.intent = { kind: 'try' };
    holdJoin('ABC234', T0);
    expect(await takeGuestLaunch(T0)).toBeNull();
    takeHeldJoin();
    boot.intent = { kind: 'try' };
    handoff.waiting = true;
    expect(await takeGuestLaunch(T0)).toBeNull();
    expect(useGuestStore.getState().running).toBe(false);
    expect(stored()).toBeNull();
  });

  it('a gate intent stays for the hook: nothing starts, nothing is taken', async () => {
    boot.intent = { kind: 'browse' };
    disk.set('guest', JSON.stringify(record()));
    useGuestStore.setState({ record: record() });
    expect(await takeGuestLaunch(T0)).toBeNull();
    expect(boot.consumed).toBe(0);
    expect(useGuestStore.getState().running).toBe(false);
  });
});

describe('takeGuestLaunch on a device with learner profiles (CS-G4)', () => {
  it('never starts a guest and never selects a profile; try is taken (row GU-5 opens the chooser)', async () => {
    useProfileStore.setState({ profiles: [mina], activeId: mina.id });
    boot.intent = { kind: 'try' };
    expect(await takeGuestLaunch(T0)).toBeNull();
    expect(boot.consumed).toBe(1);
    expect(useGuestStore.getState().running).toBe(false);
    expect(useProfileStore.getState().activeId).toBe(mina.id);
    expect(stored()).toBeNull();
    switches.chooser = false;
    boot.intent = { kind: 'try' };
    expect(await takeGuestLaunch(T0)).toBeNull();
    expect(stored()).toBeNull();
  });
});

describe('reload and return (6.4, GU-D12)', () => {
  it('within 30 minutes the live run reopens where it was, with no new guest.started', async () => {
    disk.set('guest', JSON.stringify(record()));
    useGuestStore.setState({ record: record() });
    expect(await takeGuestLaunch(T0 + GUEST_REOPEN_MS - 1)).toEqual({ screen: 'QuestPlayer', params: quest() });
    expect(useGuestStore.getState().running).toBe(true);
    expect(named('guest.started')).toEqual([]);
  });

  it('a reopen of a done quest opens the Not now card; past 30 minutes nothing reopens (Welcome shows the card)', async () => {
    disk.set('guest', JSON.stringify(record({ questDone: true })));
    useGuestStore.setState({ record: record({ questDone: true }) });
    expect(await takeGuestLaunch(T0 + 60_000)).toEqual({ screen: 'GuestLater' });
    useGuestStore.setState({ running: false, record: record() });
    disk.set('guest', JSON.stringify(record()));
    expect(await takeGuestLaunch(T0 + GUEST_REOPEN_MS + 1)).toBeNull();
    expect(useGuestStore.getState().running).toBe(false);
  });
});

describe('resumeGuestFromWelcome (6.3)', () => {
  it('Back to my quest: the run again, guest.started { welcome, resumed: true }, the grown-up session closed (CS-G3)', async () => {
    disk.set('guest', JSON.stringify(record()));
    useGuestStore.setState({ record: record() });
    useUiStore.setState({ parentGateOpenedAt: T0, lastPinVerifiedAt: T0 });
    expect(await resumeGuestFromWelcome(T0 + 3 * GUEST_REOPEN_MS)).toEqual({ screen: 'QuestPlayer', params: quest() });
    expect(useUiStore.getState().parentGateOpenedAt).toBeNull();
    expect(useUiStore.getState().lastPinVerifiedAt).toBeNull();
    expect(named('guest.started')).toEqual([{ name: 'guest.started', payload: { via: 'welcome', resumed: true } }]);
  });

  it('the switch off: nothing starts', async () => {
    switches.guest = false;
    expect(await resumeGuestFromWelcome(T0)).toBeNull();
    expect(sent).toEqual([]);
  });
});

describe('noteGuestStep and the first letter (6.2, section 12)', () => {
  const steps = [{ kind: 'intro' }, { kind: 'discover' }, { kind: 'minigame' }];

  it('a new run sends guest.first_letter once, on the first Discover step, bucketed from the run\'s start', async () => {
    boot.intent = { kind: 'try' };
    await takeGuestLaunch(T0);
    noteGuestStep(steps, 0, T0 + 2_000);
    expect(named('guest.first_letter')).toEqual([]);
    noteGuestStep(steps, 1, T0 + 20_000);
    noteGuestStep(steps, 1, T0 + 25_000);
    expect(named('guest.first_letter')).toEqual([{ name: 'guest.first_letter', payload: { secondsIn: '15-30' } }]);
    await vi.waitFor(() => expect(stored()!.lastAt).toBe(iso(T0 + 25_000)));
  });

  it('a resumed or reopened run never sends it again (one per record); nothing outside a run', async () => {
    disk.set('guest', JSON.stringify(record()));
    useGuestStore.setState({ record: record() });
    noteGuestStep(steps, 1, T0);
    expect(sent).toEqual([]);
    await takeGuestLaunch(T0 + 1_000);
    noteGuestStep(steps, 1, T0 + 2_000);
    expect(named('guest.first_letter')).toEqual([]);
  });
});

describe('noteGuestQuestDone (7.1)', () => {
  it('writes questDone and sends guest.quest_done { stars }; nothing outside a run', async () => {
    noteGuestQuestDone(3, T0);
    expect(sent).toEqual([]);
    boot.intent = { kind: 'try' };
    await takeGuestLaunch(T0);
    noteGuestQuestDone(2, T0 + 60_000);
    expect(named('guest.quest_done')).toEqual([{ name: 'guest.quest_done', payload: { stars: 2 } }]);
    await vi.waitFor(() => expect(stored()!.questDone).toBe(true));
  });
});

describe('endGuestRunTo (6.4)', () => {
  it('Close or leave in the quest: guest.left { quest }, the run ends, the record stays, Welcome next (no profile)', async () => {
    boot.intent = { kind: 'try' };
    await takeGuestLaunch(T0);
    expect(endGuestRunTo('quest')).toBe('welcome');
    expect(useGuestStore.getState().running).toBe(false);
    expect(stored()).not.toBeNull();
    expect(named('guest.left')).toEqual([{ name: 'guest.left', payload: { at: 'quest' } }]);
  });

  it('a device with profiles: the chooser while it is on, else Home; no event without an at', () => {
    useProfileStore.setState({ profiles: [mina], activeId: mina.id });
    expect(endGuestRunTo(null)).toBe('chooser');
    switches.chooser = false;
    expect(endGuestRunTo(null)).toBe('home');
    expect(named('guest.left')).toEqual([]);
  });
});
