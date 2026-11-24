import { useEffect, useSyncExternalStore } from 'react';
import type { ReactElement } from 'react';
import { Text } from 'react-native';
import { act, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { savedRunOf, stepsSignature, type RunToSave } from '../../../logic/quest-flow/saved-run';
import { byTestId, render, textOf } from '../../../test-support/render';
import { useHeroResume, type HeroResumeDeps, type LessonStepsStore } from '../use-hero-resume';

// The native navigation package has no build that loads in Node: focus is the mount (the Home tab's first focus), and a
// test leaves and comes back with `focus.set`: the effect's cleanup runs on a blur, the effect again on a refocus.
const focus = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  const state = { on: true };
  return {
    get: (): boolean => state.on,
    subscribe: (l: () => void): (() => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    set: (on: boolean): void => {
      state.on = on;
      for (const l of listeners) l();
    },
  };
});
vi.mock('@react-navigation/native', async () => ({
  useFocusEffect: (effect: () => void | (() => void)) => {
    const on = useSyncExternalStore(focus.subscribe, focus.get);
    useEffect(() => (on ? effect() : undefined), [effect, on]);
  },
  useNavigation: () => ({ navigate: () => undefined }),
}));

/**
 * [LR] AMENDMENTS-QUEST-LEAVE-RESUME row LR-2 (section 3.2, tests 12-13): Home's decision whether the hero's lesson goes on.
 * The lesson store is a stand-in whose chunk lands when the test says so; the hook never throws a failed load.
 */
const QUEST = 'quest:lesson-1';
const STEPS = [
  { id: 's1', kind: 'intro' },
  { id: 's2', kind: 'discover' },
  { id: 's3', kind: 'practice', minigameRef: 'minigame:a' },
  { id: 's4', kind: 'apply', minigameRef: 'minigame:b' },
  { id: 's5', kind: 'reward' },
] as const;
const NOW = Date.parse('2026-11-24T10:00:00.000Z');
const STARTED = '2026-11-24T09:00:00.000Z';

const base: RunToSave = {
  questId: QUEST,
  episodeId: 'episode:e1',
  stepIndex: 2,
  correctCount: 1,
  totalCount: 1,
  retryCount: 0,
  scoredRounds: ['1:0'],
  skippedSteps: [],
  startedAt: STARTED,
};
const savedAt = (stepIndex: number, over: Partial<RunToSave> = {}): unknown => JSON.parse(JSON.stringify(savedRunOf({ ...base, stepIndex, ...over }, STEPS)));

/** A lesson store whose chunk is in or not; `land` brings it in and tells the subscribers. */
function fakeStore(ready: boolean, ensure?: () => Promise<void>) {
  const state = { ready };
  const listeners = new Set<() => void>();
  const ensureCells = vi.fn(ensure ?? (async () => undefined));
  const store: LessonStepsStore = {
    subscribe: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    isQuestReady: () => state.ready,
    cellOfQuest: () => 'episode:e1',
    ensureCells,
  };
  return {
    store,
    ensureCells,
    land: (): void => {
      state.ready = true;
      for (const l of listeners) l();
    },
  };
}

interface Setup {
  saved: unknown;
  profileId?: string | null;
  questId?: string | null;
  store?: LessonStepsStore;
  steps?: readonly object[];
  startAgainRef?: { current: ((open: () => void) => void) | null };
  clear?: (profileId: string) => Promise<void>;
}

/** The hook's answer as text, so a render test can read it. `log` collects every render as `profile: answer`. */
function Probe({ profileId, questId, deps, startAgainRef, log }: { profileId: string | null; questId: string | null; deps: HeroResumeDeps; startAgainRef?: Setup['startAgainRef']; log?: string[] }): ReactElement {
  const { resume, startAgain } = useHeroResume(profileId, questId, deps);
  if (startAgainRef) startAgainRef.current = startAgain;
  const text = resume === null ? 'none' : `${resume.step}/${resume.total}`;
  log?.push(`${profileId}: ${text}`);
  return <Text testID="resume">{text}</Text>;
}

async function mount({ saved, profileId = 'p1', questId = QUEST, store, steps = STEPS, startAgainRef, clear }: Setup): Promise<{ r: ReactTestRenderer; read: ReturnType<typeof vi.fn> }> {
  const lessons = store ?? fakeStore(true).store;
  const read = vi.fn(async () => saved);
  const deps: HeroResumeDeps = {
    store: lessons,
    // The steps arrive with the chunk, as a lesson quest's do.
    questOf: (id) => (id === QUEST ? ({ id: QUEST, steps: lessons.isQuestReady(QUEST) ? steps : [] } as never) : undefined),
    read,
    ...(clear ? { clear } : {}),
    now: () => NOW,
  };
  const r = await render(<Probe profileId={profileId} questId={questId} deps={deps} startAgainRef={startAgainRef} />);
  return { r, read };
}
const shown = (r: ReactTestRenderer): string => textOf(byTestId(r.root, 'resume')[0]!);

beforeEach(() => focus.set(true));

describe('useHeroResume: a run of the hero lesson that can go on', () => {
  it('says the step it opens (the saved step + 1) of the lesson', async () => {
    const { r, read } = await mount({ saved: savedAt(2) });
    expect(shown(r)).toBe('3/5');
    expect(read).toHaveBeenCalledWith('p1');
  });

  it('is the same whatever step it stopped on, from the second step on', async () => {
    expect(shown((await mount({ saved: savedAt(1) })).r)).toBe('2/5');
    expect(shown((await mount({ saved: savedAt(4) })).r)).toBe('5/5');
  });
});

describe('useHeroResume: no resume variant', () => {
  it.each([
    ['nothing stored', null],
    ['a run of another quest', savedAt(2, { questId: 'quest:other' })],
    ['a run still on its first step', savedAt(0)],
    ['a run older than a day', savedAt(2, { startedAt: '2026-11-22T09:00:00.000Z' })],
    ['a value that is not a run', 'garbage'],
  ])('%s: the plain hero, and no chunk is asked for', async (_name, saved) => {
    const lessons = fakeStore(false);
    const { r } = await mount({ saved, store: lessons.store });
    expect(shown(r)).toBe('none');
    expect(lessons.ensureCells).not.toHaveBeenCalled();
  });

  it.each([
    ['a run whose step list changed', { ...(savedAt(2) as object), steps: stepsSignature(STEPS.slice(1)) }],
    ['a step past the lesson', savedAt(2, { stepIndex: 9 })],
  ])('%s (known only once the steps are in): the plain hero', async (_name, saved) => {
    expect(shown((await mount({ saved })).r)).toBe('none');
  });

  it('a story quest (it resumes only through Keep reading): the plain hero', async () => {
    const story = [{ id: 's1', kind: 'intro' }, { id: 's2', kind: 'discover', minigameKind: 'story-read', minigameRef: 'minigame:story-read-listen-x' }] as const;
    const lessons = fakeStore(true);
    const read = vi.fn(async () => JSON.parse(JSON.stringify(savedRunOf({ ...base, stepIndex: 1 }, story))));
    const r = await render(<Probe profileId="p1" questId={QUEST} deps={{ store: lessons.store, questOf: () => ({ id: QUEST, steps: story } as never), read, now: () => NOW }} />);
    expect(shown(r)).toBe('none');
    expect(lessons.ensureCells).not.toHaveBeenCalled();
  });

  it('a read that failed (the saved-run read answers null): the plain hero', async () => {
    expect(shown((await mount({ saved: null })).r)).toBe('none');
  });

  it('no learner or no hero lesson: nothing is read', async () => {
    const none = await mount({ saved: savedAt(2), profileId: null });
    expect(none.read).not.toHaveBeenCalled();
    expect(shown(none.r)).toBe('none');
    const noQuest = await mount({ saved: savedAt(2), questId: null });
    expect(shown(noQuest.r)).toBe('none');
  });
});

describe('useHeroResume: another learner, and Home leaving focus', () => {
  const deferred = <T,>(): { promise: Promise<T>; resolve: (v: T) => void } => {
    let resolve: (v: T) => void = () => undefined;
    const promise = new Promise<T>((r) => {
      resolve = r;
    });
    return { promise, resolve };
  };
  const lessons = (): { store: LessonStepsStore; ensureCells: ReturnType<typeof fakeStore>['ensureCells'] } => fakeStore(true);
  const depsOf = (read: HeroResumeDeps['read'], store: LessonStepsStore = lessons().store): HeroResumeDeps => ({
    store,
    questOf: () => ({ id: QUEST, steps: STEPS } as never),
    read,
    now: () => NOW,
  });

  it("another learner's run is never said for this one: no render of p2 shows p1's step, the read of p2 still out", async () => {
    const p2Read = deferred<unknown>();
    const read = vi.fn(async (id: string) => (id === 'p1' ? savedAt(2) : p2Read.promise));
    const deps = depsOf(read);
    const log: string[] = [];
    const r = await render(<Probe profileId="p1" questId={QUEST} deps={deps} log={log} />);
    expect(shown(r)).toBe('3/5');
    await act(async () => r.update(<Probe profileId="p2" questId={QUEST} deps={deps} log={log} />));
    expect(read).toHaveBeenCalledWith('p2');
    expect(shown(r)).toBe('none');
    expect(log.filter((l) => l.startsWith('p2:'))).not.toContain('p2: 3/5');
    await act(async () => p2Read.resolve(savedAt(3)));
    expect(shown(r)).toBe('4/5');
  });

  it('leaving Home drops the line: back in focus, an old Continue is not said while the saved run is read again', async () => {
    const second = deferred<unknown>();
    const read = vi.fn().mockResolvedValueOnce(savedAt(2)).mockReturnValueOnce(second.promise);
    const r = await render(<Probe profileId="p1" questId={QUEST} deps={depsOf(read)} />);
    expect(shown(r)).toBe('3/5');
    await act(async () => focus.set(false));
    expect(shown(r)).toBe('none');
    await act(async () => focus.set(true));
    expect(read).toHaveBeenCalledTimes(2);
    expect(shown(r)).toBe('none');
    // The lesson was finished in the player meanwhile: nothing is stored, so the hero stays plain.
    await act(async () => second.resolve(null));
    expect(shown(r)).toBe('none');
  });

  it('back in focus the line comes from the new read (the run went on to a later step)', async () => {
    const read = vi.fn().mockResolvedValueOnce(savedAt(1)).mockResolvedValueOnce(savedAt(3));
    const r = await render(<Probe profileId="p1" questId={QUEST} deps={depsOf(read)} />);
    expect(shown(r)).toBe('2/5');
    await act(async () => focus.set(false));
    await act(async () => focus.set(true));
    expect(shown(r)).toBe('4/5');
  });

  it('a chunk load that failed is asked for again the next time Home is focused', async () => {
    const store = fakeStore(false, async () => {
      throw new Error('chunk failed to load');
    });
    const read = vi.fn(async () => savedAt(2));
    const r = await render(<Probe profileId="p1" questId={QUEST} deps={depsOf(read, store.store)} />);
    expect(store.ensureCells).toHaveBeenCalledTimes(1);
    await act(async () => focus.set(false));
    await act(async () => focus.set(true));
    expect(store.ensureCells).toHaveBeenCalledTimes(2);
    expect(shown(r)).toBe('none');
  });
});

describe('useHeroResume: a lesson whose chunk is not in yet', () => {
  it('asks for the lesson cell once (a candidate only), keeps the plain hero until it lands, then says the step', async () => {
    const lessons = fakeStore(false);
    const { r } = await mount({ saved: savedAt(2), store: lessons.store });
    expect(lessons.ensureCells).toHaveBeenCalledTimes(1);
    expect(lessons.ensureCells).toHaveBeenCalledWith(['episode:e1']);
    expect(shown(r)).toBe('none');
    await act(async () => lessons.land());
    expect(shown(r)).toBe('3/5');
    expect(lessons.ensureCells).toHaveBeenCalledTimes(1);
  });

  it('a chunk load that rejects: the plain hero, no crash, no reload', async () => {
    const lessons = fakeStore(false, async () => {
      throw new Error('chunk failed to load');
    });
    const reload = vi.fn();
    vi.stubGlobal('location', { reload });
    try {
      const { r } = await mount({ saved: savedAt(2), store: lessons.store });
      expect(lessons.ensureCells).toHaveBeenCalledTimes(1);
      expect(shown(r)).toBe('none');
      expect(reload).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('a load that never ends: the plain hero', async () => {
    const lessons = fakeStore(false, () => new Promise<void>(() => undefined));
    const { r } = await mount({ saved: savedAt(2), store: lessons.store });
    expect(shown(r)).toBe('none');
  });

  it('a chunk that lands with another step list drops the resume variant', async () => {
    const lessons = fakeStore(false);
    const { r } = await mount({ saved: { ...(savedAt(2) as object), steps: stepsSignature(STEPS.slice(1)) }, store: lessons.store });
    await act(async () => lessons.land());
    expect(shown(r)).toBe('none');
  });
});

describe('useHeroResume: Start again', () => {
  it('clears the saved run first, opens the lesson only once that has run, and the line goes', async () => {
    const startAgainRef: NonNullable<Setup['startAgainRef']> = { current: null };
    const order: string[] = [];
    let finish: () => void = () => undefined;
    const clear = vi.fn(
      (_profileId: string) =>
        new Promise<void>((resolve) => {
          finish = () => {
            order.push('cleared');
            resolve();
          };
        }),
    );
    const { r } = await mount({ saved: savedAt(2), startAgainRef, clear });
    expect(shown(r)).toBe('3/5');
    await act(async () => startAgainRef.current?.(() => order.push('opened')));
    expect(clear).toHaveBeenCalledWith('p1');
    expect(order).toEqual([]);
    expect(shown(r)).toBe('3/5');
    await act(async () => finish());
    expect(order).toEqual(['cleared', 'opened']);
    expect(shown(r)).toBe('none');
  });

  it('a clear that fails still opens the lesson (the button is never stuck)', async () => {
    const startAgainRef: NonNullable<Setup['startAgainRef']> = { current: null };
    const open = vi.fn();
    await mount({ saved: savedAt(2), startAgainRef, clear: async () => Promise.reject(new Error('storage is full')) });
    await act(async () => startAgainRef.current?.(open));
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('with no learner it does nothing', async () => {
    const startAgainRef: NonNullable<Setup['startAgainRef']> = { current: null };
    const open = vi.fn();
    const clear = vi.fn(async () => undefined);
    await mount({ saved: null, profileId: null, startAgainRef, clear });
    await act(async () => startAgainRef.current?.(open));
    expect(open).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
  });
});
