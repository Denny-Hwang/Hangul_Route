import type { Profile } from '@hangul-route/content-schema';
import { ConfirmSheet, LayoutProvider, layoutClassFor, type ConfirmSheetProps } from '@hangul-route/design-system';
import { getMessages } from '@hangul-route/i18n';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StageCheckDeps } from '../../../logic/reviews/stage-check-api';
import { useProfileStore } from '../../../store/profile-store';
import { useProgressStore } from '../../../store/progress-store';
import { resetRemoteConfigForTests } from '../../../store/remote-config-store';
import { buttonsNamed, byTestId, cleanup, passTapLock, press, render, resetPlatform, screenTexts } from '../../../test-support/render';

/**
 * AMENDMENTS-QUEST-LEAVE-RESUME row LR-3b (test 23): the Stage Check goes on after an interruption. The api is the real
 * `createStageCheckApi` over fake stores (its resume rules, its stored value and its once-per-plan finish are what is
 * under test beside the screen); the plan is a fixed one of 7 rounds, and a round is a stub that answers on a tap and
 * solves. Storage is a memory map.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const rig = vi.hoisted(() => ({
  right: true,
  failRemove: false,
  mem: new Map<string, unknown>(),
  stall: null as Promise<void> | null,
  /** What a read answers after the stall, instead of the stored value (a late read of a value that is gone by then). */
  readOverride: undefined as unknown,
  rounds: 7,
  /** Holds each recording started after it is set until the test lets it go. */
  recordHold: null as null | Promise<void>,
  recordFails: new Set<number>(),
  recordLog: [] as string[],
  reviews: [] as Array<Record<string, unknown>>,
  latches: [] as string[],
  events: [] as Array<{ name: string }>,
  /** How many writes of the entry throw before one works (a finish that rejects). */
  entryFails: 0,
  planned: 0,
  finishes: 0,
  /** What the stored run held when each finish began. */
  storedAtFinish: [] as unknown[],
  finishHold: null as null | Promise<void>,
}));

vi.mock('react-native', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-native')>();
  const { createElement, Fragment } = await import('react');
  const Modal = ({ visible, children }: { visible?: boolean; children?: unknown }) => (visible === true ? createElement(Fragment, null, children as never) : null);
  return { ...actual, Modal };
});
vi.mock('@react-navigation/native', () => ({ CommonActions: { reset: (state: unknown) => ({ type: 'RESET', payload: state }) } }));
vi.mock('../../../platform/motion', () => ({ useReducedMotion: () => true }));
vi.mock('../use-stage-offer', async (importOriginal) => ({ ...(await importOriginal<object>()), useStageOffer: () => ({ complete: true, open: true }) }));
vi.mock('../../../platform/storage', () => ({
  readJson: vi.fn(async () => null),
  readJsonStrict: vi.fn(async () => null),
  readJsonExact: vi.fn(async (k: string) => {
    if (rig.stall) await rig.stall;
    return rig.readOverride !== undefined ? rig.readOverride : (rig.mem.get(k) ?? null);
  }),
  readJsonExactFresh: vi.fn(async (k: string) => rig.mem.get(k) ?? null),
  keepRawCopy: vi.fn(async () => true),
  writeJson: vi.fn(async (k: string, v: unknown) => {
    rig.mem.set(k, JSON.parse(JSON.stringify(v)));
  }),
  updateJson: vi.fn(async () => true),
  removeKey: vi.fn(async (k: string) => {
    if (rig.failRemove) throw new Error('storage cannot remove');
    rig.mem.delete(k);
  }),
  listKeys: vi.fn(async () => [...rig.mem.keys()]),
}));
vi.mock('../../../platform/profiles-channel', () => ({ postProfilesChanged: () => undefined, subscribeProfilesChanged: () => () => undefined }));
vi.mock('../../../platform/screen-reader', async (importOriginal) => ({ ...(await importOriginal<object>()), announceForScreenReader: vi.fn(), focusForScreenReader: vi.fn() }));

vi.mock('../../reviews/DailyReviewRoute', async () => {
  const { createElement } = await import('react');
  const { SaveFailedPage } = await import('../../reviews/SaveFailedPage');
  const { useRomanizationMode } = await import('../../../i18n/use-romanization-mode');
  function RoundView({ round, onFirst, onSolved }: { round: { question: { itemId: string } }; onFirst: (a: { correct: boolean }) => void; onSolved: () => void }) {
    const mode = useRomanizationMode();
    // One tap answers the round and solves it, as a round that ends.
    return createElement('button', { 'data-testid': 'round-stub', 'data-item': round.question.itemId, 'data-mode': mode, role: 'button', onClick: () => (onFirst({ correct: rig.right }), onSolved()) }, 'answer');
  }
  return {
    dailyReviewChunk: async () => ({
      TopRow: () => createElement('div', { 'data-testid': 'top-row' }),
      DisplayHeadline: ({ children, testID }: { children?: unknown; testID?: string }) => createElement('div', { 'data-testid': testID }, children as never),
      RoundView,
      SaveFailedPage,
    }),
  };
});

vi.mock('../../../logic/memory/boot', async (importOriginal) => {
  const { createStageCheckApi } = await import('../../../logic/reviews/stage-check-api');
  const { emptyMemoryFile } = await import('../../../logic/memory/memory-file');
  const { INDEX } = await import('../../../logic/memory/__tests__/fixtures');
  const { mergeReview } = await import('../../../logic/sync/merge');
  const ids = INDEX.items.slice(0, 20).map((i) => i.id);
  const roundOf = (i: number) => {
    const id = ids[i] as string;
    const other = ids[i + 10] as string;
    return {
      type: 'pick',
      heard: false,
      ask: 'meaning',
      prompt: { ko: '산', romanization: 'san' },
      options: [
        { id, label: 'a' },
        { id: other, label: 'b' },
      ],
      answerId: id,
      question: { itemId: id, kind: 'lex', rung: 'read', format: 'read-pick', theme: 'nature', stretch: false, voiceFallback: false },
      answer: { ko: { ko: '산', romanization: 'san' }, gloss: 'mountain' },
    };
  };
  const deps: StageCheckDeps = {
    file: async () => emptyMemoryFile(),
    ensureSeeded: async () => undefined,
    items: async () => INDEX,
    on: () => true,
    cells: () => [],
    visibility: () => ({ volumes: true, topicPacks: true }),
    voice: () => true,
    hydrate: async () => undefined,
    snapshot: () => ({ reviews: rig.reviews, stageCheckAt: rig.latches.length > 0 ? { stage2: rig.latches[0] } : undefined }) as never,
    itemsHash: () => 'hash-1',
    recordReview: (_p, entry) => {
      if (rig.entryFails > 0) {
        rig.entryFails -= 1;
        throw new Error('store full');
      }
      const i = rig.reviews.findIndex((r) => r.id === entry.id);
      if (i < 0) rig.reviews.push(entry as never);
      else rig.reviews[i] = mergeReview(rig.reviews[i] as never, entry) as never;
    },
    recordAnswers: async (_p, answers) => {
      rig.recordLog.push(...answers.map((a) => a.itemId));
      if (rig.recordHold !== null) await rig.recordHold;
      if (answers.some((a) => rig.recordFails.delete(ids.indexOf(a.itemId)))) throw new Error('store full');
    },
    latch: (_p, _s, at) => void rig.latches.push(at),
    stageOpen: () => true,
    serverTime: () => null,
    track: (e) => void rig.events.push(e),
    overlays: () => ({}),
    ensureCell: async () => undefined,
  };
  const real = createStageCheckApi(deps);
  const api = {
    ...real,
    readWorld: async () => ({ kind: 'ready', world: { profileId: 'profile:mina', ctx: {} } }),
    startSession: async () => {
      rig.planned += 1;
      return { stage: 'stage2', rounds: Array.from({ length: rig.rounds }, (_, i) => roundOf(i)), soundNotice: false };
    },
    finishSession: async (...args: Parameters<typeof real.finishSession>) => {
      rig.finishes += 1;
      rig.storedAtFinish.push(rig.mem.get('check-run:profile:mina') ?? null);
      if (rig.finishHold !== null) await rig.finishHold;
      return real.finishSession(...args);
    },
  };
  return { ...(await importOriginal<object>()), memoryChunk: async () => ({ stageCheckApi: () => api }) };
});

const { StageCheckScreen } = await import('../StageCheckScreen');
const { CHECK_RUN_KEY, settleSavedChecksForTests } = await import('../../../store/check-run-saved');

const ID = 'profile:mina';
const AT = '2026-10-01T10:00:00.000Z';
const learner: Profile = { id: ID, displayName: 'Mina', ageGroup: '8-9', avatar: 'hoya-orange', role: 'learner', createdAt: AT, learnerType: 'child' };
const EN = getMessages('en');
const M = EN.learner.stageReview;

const flush = async (): Promise<void> => {
  await act(async () => {
    for (let i = 0; i < 60; i += 1) await Promise.resolve();
  });
};

type Listener = (event: { preventDefault: () => void }) => void;
function fakeNav() {
  const listeners: Listener[] = [];
  const goBack = vi.fn();
  const nav = {
    navigate: vi.fn(),
    dispatch: vi.fn(),
    goBack,
    canGoBack: () => true,
    addListener: (_type: string, listener: Listener) => {
      listeners.push(listener);
      return () => listeners.splice(listeners.indexOf(listener), 1);
    },
    back: async (): Promise<boolean> => {
      let held = false;
      await act(async () => {
        for (const listener of [...listeners]) listener({ preventDefault: () => (held = true) });
      });
      return held;
    },
  };
  return nav;
}

async function open(nav = fakeNav()): Promise<{ r: ReactTestRenderer; nav: ReturnType<typeof fakeNav> }> {
  const r = await render(
    <LayoutProvider value={layoutClassFor({ width: 320, height: 640 })}>
      <StageCheckScreen navigation={nav as never} route={{ key: 'StageCheck', name: 'StageCheck', params: { stageKey: 'stage2' } } as never} />
    </LayoutProvider>,
  );
  await flush();
  return { r, nav };
}

const tapId = async (r: ReactTestRenderer, id: string): Promise<void> => {
  await press(byTestId(r.root, id).find((n) => typeof n.props.onClick === 'function' || typeof n.props.onPress === 'function')!);
  await flush();
};
const button = (r: ReactTestRenderer, label: string): ReactTestInstance => buttonsNamed(r.root, label)[0]!;
const tap = async (r: ReactTestRenderer, label: string): Promise<void> => {
  await press(button(r, label));
  await flush();
};
const round = (r: ReactTestRenderer): ReactTestInstance | undefined => byTestId(r.root, 'round-stub').find((n) => typeof n.props.onClick === 'function');
/** The index of the round on screen, by its item (the plan's rounds are the items 0 to 6 of the fixture, in order). */
const itemOf = (r: ReactTestRenderer): string => round(r)?.props['data-item'] as string;
const answerRounds = async (r: ReactTestRenderer, times: number): Promise<string[]> => {
  const seen: string[] = [];
  for (let n = 0; n < times; n += 1) {
    seen.push(itemOf(r));
    await tapId(r, 'round-stub');
    if (byTestId(r.root, 'stage-check-pause').length > 0) await tapId(r, 'stage-check-keep-going');
  }
  return seen;
};
type Stored = { v: number; kind: string; stage: string; locale: string; itemsHash: string; rounds: Array<{ question: { itemId: string } }>; answers: Array<[number, { correct: boolean }]>; hideRomanization: boolean; startedAt: string };
const stored = (): Stored | null => (rig.mem.get(CHECK_RUN_KEY(ID)) as Stored | undefined) ?? null;
const sheetOf = (r: ReactTestRenderer): ConfirmSheetProps => r.root.findAllByType(ConfirmSheet)[0]!.props as ConfirmSheetProps;
const startEvents = (): number => rig.events.filter((e) => e.name === 'review.start').length;
const completeEvents = (): number => rig.events.filter((e) => e.name === 'review.complete').length;

/** Opens the check, takes Let us go and answers `count` rounds, then lets the screen go (an app kill, a discarded tab). */
async function playSome(count: number): Promise<{ plan: string[] }> {
  const { r } = await open();
  await tapId(r, 'stage-check-go');
  const plan = await answerRounds(r, count);
  await settleSavedChecksForTests();
  await cleanup();
  return { plan };
}

beforeEach(async () => {
  await settleSavedChecksForTests(true);
  rig.mem.clear();
  rig.right = true;
  rig.failRemove = false;
  rig.stall = null;
  rig.readOverride = undefined;
  rig.rounds = 7;
  rig.recordHold = null;
  rig.recordFails.clear();
  rig.recordLog.length = 0;
  rig.reviews.length = 0;
  rig.latches.length = 0;
  rig.events.length = 0;
  rig.entryFails = 0;
  rig.planned = 0;
  rig.finishes = 0;
  rig.storedAtFinish.length = 0;
  rig.finishHold = null;
  resetRemoteConfigForTests();
  useProfileStore.setState({ profiles: [learner], activeId: ID, hydrated: true });
  useProgressStore.setState({ hydratedFor: new Set([ID]), saveRetryFailedFor: new Set(), loadFailedFor: new Set() });
});
afterEach(async () => {
  vi.useRealTimers();
  await cleanup();
  resetPlatform();
});

describe('[LR] a Stage Check stores each first answer once its recording has settled (OD-LR9 (b))', () => {
  it('stores nothing before the first answer, then the plan rounds and one answer after another', async () => {
    const { r } = await open();
    await tapId(r, 'stage-check-go');
    await settleSavedChecksForTests();
    expect(stored()).toBeNull();
    await answerRounds(r, 1);
    await settleSavedChecksForTests();
    expect(stored()).toMatchObject({ v: 1, kind: 'stage', stage: 'stage2', locale: 'en', itemsHash: 'hash-1', hideRomanization: false });
    expect(stored()!.rounds).toHaveLength(7);
    expect(stored()!.answers.map(([i]) => i)).toEqual([0]);
    await answerRounds(r, 2);
    await settleSavedChecksForTests();
    expect(stored()!.answers.map(([i]) => i)).toEqual([0, 1, 2]);
  });

  it('an answer is stored only after its recording settled; one whose recording rejected is not stored', async () => {
    let release: () => void = () => undefined;
    rig.recordHold = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { r } = await open();
    await tapId(r, 'stage-check-go');
    await answerRounds(r, 1);
    await settleSavedChecksForTests();
    expect(stored()).toBeNull();
    release();
    await flush();
    await settleSavedChecksForTests();
    expect(stored()!.answers.map(([i]) => i)).toEqual([0]);
    rig.recordHold = null;
    rig.recordFails.add(1);
    await answerRounds(r, 2);
    await settleSavedChecksForTests();
    // Round 1 failed to record: its answer is not stored; round 2's is.
    expect(stored()!.answers.map(([i]) => i)).toEqual([0, 2]);
  });
});

describe('[LR] a stored Stage Check is offered, and Continue goes on', () => {
  it('a new mount reads, shows the resume page (not the intro), and plans nothing', async () => {
    await playSome(3);
    rig.planned = 0;
    const { r } = await open();
    expect(byTestId(r.root, 'stage-check-resume')).toHaveLength(1);
    expect(byTestId(r.root, 'stage-check-intro')).toHaveLength(0);
    expect(screenTexts(r.root)).toContain(M.resume.title);
    expect(screenTexts(r.root)).toContain(EN.learner.stageCheck.title);
    expect(buttonsNamed(r.root, EN.common.buttons.continue)).toHaveLength(1);
    expect(buttonsNamed(r.root, M.resume.startAgain.cta)).toHaveLength(1);
    // The run keeps its romanization choice: no switch; no count of rounds, no fraction, no percent.
    expect(r.root.findAll((n) => n.props.role === 'switch')).toHaveLength(0);
    expect(screenTexts(r.root).join(' ')).not.toMatch(/\d+\s*\/\s*\d+|%/);
    expect(rig.planned).toBe(0);
  });

  it('Continue goes on at the round after the last one answered, records only new answers and does not send review.start again', async () => {
    const { plan } = await playSome(3);
    expect(startEvents()).toBe(1);
    const recordedBefore = rig.recordLog.length;
    const { r } = await open();
    await tap(r, EN.common.buttons.continue);
    expect(byTestId(r.root, 'stage-check-resume')).toHaveLength(0);
    expect(itemOf(r)).toBe(plan[0] === undefined ? '' : stored()!.rounds[3]!.question.itemId);
    expect(rig.recordLog).toHaveLength(recordedBefore);
    expect(startEvents()).toBe(1);
    await answerRounds(r, 1);
    expect(rig.recordLog).toHaveLength(recordedBefore + 1);
    expect(stored()!.answers.map(([i]) => i)).toEqual([0, 1, 2, 3]);
  });

  it('a stored round is never asked again: the check goes round 3, then the pause after round 4 comes as before', async () => {
    await playSome(3);
    const run = stored()!.rounds.map((x) => x.question.itemId);
    const { r } = await open();
    await tap(r, EN.common.buttons.continue);
    const asked = await answerRounds(r, 4);
    // Rounds 3 and 4 (a pause between parts after round 4), then rounds 5 and 6 of the second part.
    expect(asked).toEqual(run.slice(3, 7));
    expect(byTestId(r.root, 'stage-check-result')).toHaveLength(1);
  });

  it('the stars equal those of an uninterrupted run with the same answers, and one entry is written', async () => {
    rig.right = false;
    await playSome(2);
    rig.right = true;
    const { r } = await open();
    await tap(r, EN.common.buttons.continue);
    await answerRounds(r, 5);
    expect(byTestId(r.root, 'stage-check-result')).toHaveLength(1);
    const interrupted = { stars: rig.reviews[0]!.resultStars, missed: rig.reviews[0]!.missedItemIds };
    expect(rig.reviews).toHaveLength(1);
    expect(completeEvents()).toBe(1);
    expect(startEvents()).toBe(1);
    await cleanup();

    // The same answers without an interruption.
    rig.reviews.length = 0;
    rig.events.length = 0;
    rig.mem.clear();
    const again = await open();
    await tapId(again.r, 'stage-check-go');
    rig.right = false;
    await answerRounds(again.r, 2);
    rig.right = true;
    await answerRounds(again.r, 5);
    expect({ stars: rig.reviews[0]!.resultStars, missed: rig.reviews[0]!.missedItemIds }).toEqual(interrupted);
  });

  it('the result clears the stored run', async () => {
    await playSome(3);
    const { r } = await open();
    await tap(r, EN.common.buttons.continue);
    await answerRounds(r, 4);
    await settleSavedChecksForTests();
    expect(byTestId(r.root, 'stage-check-result')).toHaveLength(1);
    expect(stored()).toBeNull();
  });

  it('the romanization choice of the run is kept: a hidden round stays hidden', async () => {
    const first = await open();
    await press(first.r.root.findAll((n) => n.props.role === 'switch')[0]!);
    await tapId(first.r, 'stage-check-go');
    expect(round(first.r)!.props['data-mode']).toBe('tap');
    await answerRounds(first.r, 2);
    await settleSavedChecksForTests();
    expect(stored()!.hideRomanization).toBe(true);
    await cleanup();
    const { r } = await open();
    await tap(r, EN.common.buttons.continue);
    expect(round(r)!.props['data-mode']).toBe('tap');
  });

  it('a second tap on Continue does nothing: the stored answers are not put back over the new ones', async () => {
    await playSome(3);
    const { r } = await open();
    const go = button(r, EN.common.buttons.continue);
    const onClick = go.props.onClick as (event: unknown) => void;
    const event = { altKey: false, currentTarget: { getAttribute: (name: string): unknown => go.props[name] ?? null, tagName: 'DIV' }, nativeEvent: {}, preventDefault: () => undefined, stopPropagation: () => undefined };
    passTapLock();
    await act(async () => {
      onClick(event);
    });
    await flush();
    await answerRounds(r, 1);
    await settleSavedChecksForTests();
    expect(stored()!.answers.map(([i]) => i)).toEqual([0, 1, 2, 3]);
    // The same handler again (a double tap that reached it after the page went): nothing moves.
    passTapLock();
    await act(async () => {
      onClick(event);
    });
    await flush();
    await settleSavedChecksForTests();
    expect(stored()!.answers.map(([i]) => i)).toEqual([0, 1, 2, 3]);
    expect(itemOf(r)).toBe(stored()!.rounds[4]!.question.itemId);
  });
});

describe('[LR] the run is stored with every answer before the finish runs', () => {
  it('the stored run holds all the answers when the finish begins', async () => {
    const { r } = await open();
    await tapId(r, 'stage-check-go');
    await answerRounds(r, 7);
    expect(rig.finishes).toBe(1);
    expect((rig.storedAtFinish[0] as Stored).answers).toHaveLength(7);
    expect(byTestId(r.root, 'stage-check-result')).toHaveLength(1);
    await settleSavedChecksForTests();
    expect(stored()).toBeNull();
  });

  it('a finish that rejects keeps the run: a remount offers Continue, which goes straight to the finish (no round asked, one entry)', async () => {
    rig.entryFails = 1;
    const first = await open();
    await tapId(first.r, 'stage-check-go');
    await answerRounds(first.r, 7);
    expect(byTestId(first.r.root, 'stage-check-save-failed')).toHaveLength(1);
    await settleSavedChecksForTests();
    expect(stored()!.answers).toHaveLength(7);
    await cleanup();

    const { r } = await open();
    expect(byTestId(r.root, 'stage-check-resume')).toHaveLength(1);
    const recorded = rig.recordLog.length;
    await tap(r, EN.common.buttons.continue);
    await settleSavedChecksForTests();
    expect(round(r)).toBeUndefined();
    expect(byTestId(r.root, 'stage-check-result')).toHaveLength(1);
    expect(rig.recordLog).toHaveLength(recorded);
    expect(rig.reviews).toHaveLength(1);
    expect(completeEvents()).toBe(1);
    expect(startEvents()).toBe(1);
    expect(stored()).toBeNull();
  });

  it('a second tap on Continue of an all-answered run finishes once, with one entry and one complete event', async () => {
    rig.entryFails = 1;
    const first = await open();
    await tapId(first.r, 'stage-check-go');
    await answerRounds(first.r, 7);
    await settleSavedChecksForTests();
    await cleanup();
    const finishes = rig.finishes;

    const { r } = await open();
    const go = button(r, EN.common.buttons.continue);
    const onClick = go.props.onClick as (event: unknown) => void;
    const event = { altKey: false, currentTarget: { getAttribute: (name: string): unknown => go.props[name] ?? null, tagName: 'DIV' }, nativeEvent: {}, preventDefault: () => undefined, stopPropagation: () => undefined };
    for (let tap = 0; tap < 2; tap += 1) {
      passTapLock();
      await act(async () => {
        onClick(event);
      });
      await flush();
    }
    expect(rig.finishes).toBe(finishes + 1);
    expect(rig.reviews).toHaveLength(1);
    expect(completeEvents()).toBe(1);
    expect(byTestId(r.root, 'stage-check-result')).toHaveLength(1);
  });

  it('Try again on the failed page stores the rounds recorded now before it finishes', async () => {
    rig.recordFails.add(6);
    const { r } = await open();
    await tapId(r, 'stage-check-go');
    await answerRounds(r, 7);
    expect(byTestId(r.root, 'stage-check-save-failed')).toHaveLength(1);
    await settleSavedChecksForTests();
    // Round 6 did not record: its answer is not stored.
    expect(stored()!.answers.map(([i]) => i)).toEqual([0, 1, 2, 3, 4, 5]);
    await tap(r, EN.common.buttons.tryAgain);
    expect(byTestId(r.root, 'stage-check-result')).toHaveLength(1);
    expect(rig.storedAtFinish.at(-1) as Stored).toMatchObject({ answers: expect.arrayContaining([[6, { correct: true }]]) });
  });

  it('a stored run with a round whose recording failed asks that round again, and not the ones stored after it', async () => {
    rig.recordFails.add(1);
    const first = await open();
    await tapId(first.r, 'stage-check-go');
    await answerRounds(first.r, 4);
    await settleSavedChecksForTests();
    expect(stored()!.answers.map(([i]) => i)).toEqual([0, 2, 3]);
    await cleanup();
    const { r } = await open();
    await tap(r, EN.common.buttons.continue);
    const run = stored()!.rounds.map((x) => x.question.itemId);
    expect(itemOf(r)).toBe(run[1]);
    await tapId(r, 'round-stub');
    // Rounds 2 and 3 are stored: the next round asked is 4.
    expect(itemOf(r)).toBe(run[4]);
  });
});

describe('[LR] a finished check is recorded once', () => {
  const OLDER = { id: 'stage-check:stage2', kind: 'stage-certificate', generatedAt: '2026-09-01T10:00:00.000Z', scope: 'stage2', itemIds: [], resultStars: 3, missedItemIds: [] };

  it('the finish marks the stored run finished after the entry and the latch, before the clear', async () => {
    rig.failRemove = true;
    const { r } = await open();
    await tapId(r, 'stage-check-go');
    await answerRounds(r, 7);
    await settleSavedChecksForTests();
    expect(byTestId(r.root, 'stage-check-result')).toHaveLength(1);
    // The clear did not happen: the run is there, whole, with its marker.
    expect(stored()!.answers).toHaveLength(7);
    expect(typeof (stored() as unknown as { finishedAt?: string }).finishedAt).toBe('string');
  });

  it('kill after the progress write (the clear never ran): a marked run is not offered, is cleared, and records nothing again', async () => {
    rig.failRemove = true;
    const first = await open();
    await tapId(first.r, 'stage-check-go');
    await answerRounds(first.r, 7);
    await settleSavedChecksForTests();
    expect(rig.reviews).toHaveLength(1);
    await cleanup();
    rig.failRemove = false;
    const events = rig.events.length;

    const { r } = await open();
    await settleSavedChecksForTests();
    expect(byTestId(r.root, 'stage-check-resume')).toHaveLength(0);
    expect(byTestId(r.root, 'stage-check-intro')).toHaveLength(1);
    expect(stored()).toBeNull();
    expect(rig.reviews).toHaveLength(1);
    expect(rig.events).toHaveLength(events);
    expect(rig.finishes).toBe(1);
  });

  it('an equal-stars retake whose clear rejects: the earlier entry is kept, yet the run is not offered again and no second complete event is sent', async () => {
    rig.reviews.push({ ...OLDER });
    rig.failRemove = true;
    const first = await open();
    await tapId(first.r, 'stage-check-go');
    await answerRounds(first.r, 7);
    await settleSavedChecksForTests();
    expect(byTestId(first.r.root, 'stage-check-result')).toHaveLength(1);
    // Equal stars: the merge keeps the earliest copy, so the entry's stamp says nothing about this run.
    expect(rig.reviews).toHaveLength(1);
    expect(rig.reviews[0]!.generatedAt).toBe(OLDER.generatedAt);
    expect(completeEvents()).toBe(1);
    await cleanup();

    // The clear keeps failing: the next opens each show the intro, never the resume page, and send nothing.
    for (let visit = 0; visit < 2; visit += 1) {
      const { r } = await open();
      expect(byTestId(r.root, 'stage-check-resume')).toHaveLength(0);
      expect(byTestId(r.root, 'stage-check-intro')).toHaveLength(1);
      await cleanup();
    }
    expect(completeEvents()).toBe(1);
    expect(rig.finishes).toBe(1);
  });

  it('kill between the entry and the marker: the unmarked run is offered, and its finish writes the entry again as a merge (one entry)', async () => {
    const first = await open();
    await tapId(first.r, 'stage-check-go');
    await answerRounds(first.r, 3);
    await settleSavedChecksForTests();
    const midRun = JSON.parse(JSON.stringify(stored()));
    await answerRounds(first.r, 4);
    await settleSavedChecksForTests();
    expect(rig.reviews).toHaveLength(1);
    rig.mem.set(CHECK_RUN_KEY(ID), { ...midRun, answers: Array.from({ length: 7 }, (_, i) => [i, { correct: true }]) });
    await cleanup();

    const { r } = await open();
    expect(byTestId(r.root, 'stage-check-resume')).toHaveLength(1);
    await tap(r, EN.common.buttons.continue);
    await settleSavedChecksForTests();
    expect(byTestId(r.root, 'stage-check-result')).toHaveLength(1);
    expect(rig.reviews).toHaveLength(1);
    expect(stored()).toBeNull();
  });

  it('a late read of a finished run, landing after Let us go, is ignored: it clears nothing of the new check', async () => {
    let release: () => void = () => undefined;
    rig.stall = new Promise<void>((resolve) => {
      release = resolve;
    });
    rig.readOverride = { v: 1, kind: 'stage', stage: 'stage2', startedAt: new Date().toISOString(), finishedAt: new Date().toISOString() };
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const r = await render(
      <LayoutProvider value={layoutClassFor({ width: 320, height: 640 })}>
        <StageCheckScreen navigation={fakeNav() as never} route={{ key: 'StageCheck', name: 'StageCheck', params: { stageKey: 'stage2' } } as never} />
      </LayoutProvider>,
    );
    await flush();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });
    expect(byTestId(r.root, 'stage-check-intro')).toHaveLength(1);
    await press(byTestId(r.root, 'stage-check-go').find((n) => typeof n.props.onPress === 'function' || typeof n.props.onClick === 'function')!);
    await flush();
    await answerRounds(r, 2);
    await settleSavedChecksForTests();
    expect(stored()!.answers).toHaveLength(2);
    release();
    await flush();
    await settleSavedChecksForTests();
    expect(stored()!.answers).toHaveLength(2);
    expect(round(r)).toBeDefined();
    // And a finished run read late while the intro still shows is cleared, as the early read does.
    await cleanup();
    rig.mem.clear();
    rig.stall = new Promise<void>((resolve) => {
      release = resolve;
    });
    const again = await render(
      <LayoutProvider value={layoutClassFor({ width: 320, height: 640 })}>
        <StageCheckScreen navigation={fakeNav() as never} route={{ key: 'StageCheck', name: 'StageCheck', params: { stageKey: 'stage2' } } as never} />
      </LayoutProvider>,
    );
    await flush();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });
    rig.mem.set(CHECK_RUN_KEY(ID), rig.readOverride);
    release();
    await flush();
    await settleSavedChecksForTests();
    expect(byTestId(again.root, 'stage-check-intro')).toHaveLength(1);
    expect(byTestId(again.root, 'stage-check-resume')).toHaveLength(0);
    expect(stored()).toBeNull();
  });
});

describe('[LR] Start again, Maybe later and the stop sheet', () => {
  it('Start again shows the intro and clears nothing; Let us go plans the check behind the loading frame, clears the stored run and begins', async () => {
    await playSome(3);
    expect(startEvents()).toBe(1);
    const { r } = await open();
    expect(rig.planned).toBe(1);
    rig.planned = 0;
    await tap(r, M.resume.startAgain.cta);
    expect(byTestId(r.root, 'stage-check-intro')).toHaveLength(1);
    expect(byTestId(r.root, 'stage-check-resume')).toHaveLength(0);
    expect(stored()).not.toBeNull();
    expect(rig.planned).toBe(0);
    await tapId(r, 'stage-check-go');
    await settleSavedChecksForTests();
    expect(rig.planned).toBe(1);
    expect(stored()).toBeNull();
    expect(startEvents()).toBe(2);
    expect(itemOf(r)).toBe(itemOf(r));
    expect(round(r)).toBeDefined();
    await answerRounds(r, 1);
    await settleSavedChecksForTests();
    expect(stored()!.answers.map(([i]) => i)).toEqual([0]);
  });

  it('Maybe later on that intro and the Close on the resume page leave with the run kept', async () => {
    await playSome(3);
    const first = await open();
    await tap(first.r, M.resume.startAgain.cta);
    await tap(first.r, M.intro.later.cta);
    expect(first.nav.goBack).toHaveBeenCalledTimes(1);
    expect(stored()).not.toBeNull();
    await cleanup();

    const second = await open();
    expect(await second.nav.back()).toBe(false);
    expect(stored()).not.toBeNull();
  });

  it('the stop sheet says the check is kept once an answer is stored, and the old line before; Stop keeps the run', async () => {
    const { r, nav } = await open();
    await tapId(r, 'stage-check-go');
    expect(await nav.back()).toBe(true);
    expect(sheetOf(r).message).toBe(M.leave.body);
    await act(async () => sheetOf(r).onCancel());
    await answerRounds(r, 1);
    await settleSavedChecksForTests();
    expect(await nav.back()).toBe(true);
    expect(sheetOf(r).message).toBe(M.leave.bodyKept);
    expect(sheetOf(r).message).toBe('You can keep going later.');
    await act(async () => sheetOf(r).onConfirm());
    expect(nav.goBack).toHaveBeenCalledTimes(1);
    await settleSavedChecksForTests();
    expect(stored()!.answers).toHaveLength(1);
  });

  // [LR-6] Keep going is the filled button and Stop the plain one, as on the Hangul Check's sheet.
  it('[LR-6] the stop sheet draws Keep going as the filled safe choice and Stop plain, Stop never danger', async () => {
    const { r, nav } = await open();
    await tapId(r, 'stage-check-go');
    expect(await nav.back()).toBe(true);
    expect(sheetOf(r)).toMatchObject({
      visible: true,
      testID: 'stage-check-leave',
      title: M.leave.title,
      cancelLabel: M.leave.stay.cta,
      confirmLabel: M.leave.stop.cta,
      safeFilled: true,
    });
    expect(sheetOf(r).confirmTone ?? 'primary').toBe('primary');
    expect(sheetOf(r).confirmFirst).toBeUndefined();
    // Keep going closes the sheet and the check goes on; nothing is left.
    await act(async () => sheetOf(r).onCancel());
    expect(sheetOf(r).visible).toBe(false);
    expect(nav.goBack).not.toHaveBeenCalled();
  });

  it('a resumed check says the check is kept from its first round', async () => {
    await playSome(2);
    const { r, nav } = await open();
    await tap(r, EN.common.buttons.continue);
    expect(await nav.back()).toBe(true);
    expect(sheetOf(r).message).toBe(M.leave.bodyKept);
  });
});

describe('[LR] a read that takes longer than 800 ms', () => {
  const late = async (nav = fakeNav()) => {
    let release: () => void = () => undefined;
    rig.stall = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const r = await render(
      <LayoutProvider value={layoutClassFor({ width: 320, height: 640 })}>
        <StageCheckScreen navigation={nav as never} route={{ key: 'StageCheck', name: 'StageCheck', params: { stageKey: 'stage2' } } as never} />
      </LayoutProvider>,
    );
    await flush();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });
    return { r, release };
  };

  it('shows the intro first, and a read that lands later switches it to the resume page while nothing has started', async () => {
    await playSome(3);
    const { r, release } = await late();
    expect(byTestId(r.root, 'stage-check-intro')).toHaveLength(1);
    release();
    await flush();
    expect(byTestId(r.root, 'stage-check-resume')).toHaveLength(1);
    expect(byTestId(r.root, 'stage-check-intro')).toHaveLength(0);
    // Start again keeps the plan the intro already had: Let us go does not plan a second time.
    rig.planned = 0;
    await tap(r, M.resume.startAgain.cta);
    await tapId(r, 'stage-check-go');
    expect(rig.planned).toBe(0);
    expect(round(r)).toBeDefined();
  });

  it('a late read after Let us go is ignored: the new check plays on', async () => {
    await playSome(3);
    const { r, release } = await late();
    await press(byTestId(r.root, 'stage-check-go').find((n) => typeof n.props.onPress === 'function' || typeof n.props.onClick === 'function')!);
    await flush();
    release();
    await flush();
    expect(byTestId(r.root, 'stage-check-resume')).toHaveLength(0);
    expect(round(r)).toBeDefined();
  });
});

describe('[LR] nothing to resume', () => {
  it('another UI language or another review-item set: the normal intro, with the run left stored', async () => {
    await playSome(3);
    const saved = stored()!;
    rig.mem.set(CHECK_RUN_KEY(ID), { ...saved, itemsHash: 'older-build' });
    const { r } = await open();
    expect(byTestId(r.root, 'stage-check-intro')).toHaveLength(1);
    expect(byTestId(r.root, 'stage-check-resume')).toHaveLength(0);
    expect(rig.mem.has(CHECK_RUN_KEY(ID))).toBe(true);
  });

  it('another check\'s run (a Hangul Check) is not offered here, and Let us go forgets it', async () => {
    rig.mem.set(CHECK_RUN_KEY(ID), { v: 1, kind: 'hangul', seed: 1, items: [], answers: {}, hideRomanization: false, startedAt: new Date().toISOString() });
    const { r } = await open();
    expect(byTestId(r.root, 'stage-check-intro')).toHaveLength(1);
    await tapId(r, 'stage-check-go');
    await settleSavedChecksForTests();
    expect(stored()).toBeNull();
  });
});
