import type { Profile, ProgressSnapshot } from '@hangul-route/content-schema';
import { LayoutProvider, layoutClassFor } from '@hangul-route/design-system';
import { getMessages } from '@hangul-route/i18n';
import { Fragment, createElement } from 'react';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { episodesAll } from '../../../content';
import { gridEpisodesOf } from '../../../logic/my-route/order';
import { buildHangulCheck } from '../../../logic/stage1/hangul-check';
import { useProfileStore } from '../../../store/profile-store';
import { useProgressStore } from '../../../store/progress-store';
import { resetRemoteConfigForTests } from '../../../store/remote-config-store';
import { buttonsNamed, byTestId, cleanup, press, render, resetPlatform, screenTexts } from '../../../test-support/render';

/**
 * AMENDMENTS-QUEST-LEAVE-RESUME row LR-3a (test 20): the Hangul Check goes on after an interruption. The game is a stub
 * that answers the next round of its part on a tap and hands the part back on another, so the screen's own work is what
 * is under test: reading, the resume page, Continue at the item after the last one answered, Start again, Stop, the
 * result. Storage is a memory map.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const rig = vi.hoisted(() => ({ right: true, mem: new Map<string, unknown>(), stall: null as Promise<void> | null }));

// The stop sheet is a Modal the Node renderer cannot show: a stand-in that draws its children while visible.
vi.mock('react-native', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-native')>();
  const Modal = ({ visible, children }: { visible?: boolean; children?: unknown }) => (visible === true ? createElement(Fragment, null, children as never) : null);
  return { ...actual, Modal };
});
vi.mock('@react-navigation/native', () => ({ CommonActions: { reset: (state: unknown) => ({ type: 'RESET', payload: state }) } }));
vi.mock('../../../platform/storage', () => ({
  readJson: vi.fn(async () => null),
  readJsonStrict: vi.fn(async () => null),
  readJsonExact: vi.fn(async (k: string) => {
    if (rig.stall) await rig.stall;
    return rig.mem.get(k) ?? null;
  }),
  readJsonExactFresh: vi.fn(async (k: string) => rig.mem.get(k) ?? null),
  keepRawCopy: vi.fn(async () => true),
  writeJson: vi.fn(async (k: string, v: unknown) => {
    rig.mem.set(k, JSON.parse(JSON.stringify(v)));
  }),
  updateJson: vi.fn(async () => true),
  removeKey: vi.fn(async (k: string) => {
    rig.mem.delete(k);
  }),
  listKeys: vi.fn(async () => [...rig.mem.keys()]),
}));
vi.mock('../../../platform/profiles-channel', () => ({ postProfilesChanged: () => undefined, subscribeProfilesChanged: () => () => undefined }));
vi.mock('../../../platform/telemetry', async (importOriginal) => ({ ...(await importOriginal<object>()), track: vi.fn(async () => undefined) }));
vi.mock('../../minigames/ListenPickGame', async () => {
  const React = await import('react');
  const { roundItemId } = await import('../../../logic/listen-pick');
  type Round = Parameters<typeof roundItemId>[0];
  function Stub({ scope, host }: { scope: { listenPick: { rounds: Round[] } }; host: { answer: (key: number, correct: boolean, meta?: { itemId?: string }) => void; complete: () => void } }) {
    const rounds = scope.listenPick.rounds;
    const [i, setI] = React.useState(0);
    return React.createElement(
      'div',
      { 'data-testid': 'part-stub' },
      React.createElement('span', { 'data-testid': 'part-items' }, rounds.map(roundItemId).join(',')),
      React.createElement(
        'button',
        {
          role: 'button',
          'data-testid': 'part-answer',
          onClick: () => {
            const round = rounds[i];
            if (!round) return;
            host.answer(i, rig.right, { itemId: roundItemId(round) });
            setI(i + 1);
          },
        },
        'answer',
      ),
      React.createElement('button', { role: 'button', 'data-testid': 'part-done', onClick: () => host.complete() }, 'done'),
    );
  }
  return { ListenPickGame: Stub };
});

const { StageReviewScreen } = await import('../StageReviewScreen');
const { track } = await import('../../../platform/telemetry');
const { CHECK_RUN_KEY, settleSavedChecksForTests } = await import('../../../store/check-run-saved');
const { useReviewRunStore } = await import('../../../store/review-run-store');

const ID = 'profile:mina';
const AT = '2026-10-01T10:00:00.000Z';
const learner: Profile = { id: ID, displayName: 'Mina', ageGroup: '8-9', avatar: 'hoya-orange', role: 'learner', createdAt: AT, learnerType: 'child' };
const EN = getMessages('en');
const M = EN.learner.stageReview;

/** Every Stage 1 quest done: the check opens. */
function snapshot(): ProgressSnapshot {
  const quests = gridEpisodesOf(episodesAll)
    .filter((e) => e.stage === 'stage1')
    .flatMap((e) => e.questIds.map((questId) => ({ questId, episodeId: e.id, startedAt: AT, completedAt: AT, stars: 2 as const, attempts: 1, accuracy: 0.9 })));
  return { profileId: ID, updatedAt: AT, episodes: [], quests, cards: [], sessions: [], homework: [], reviews: [], streakDays: 0 } as ProgressSnapshot;
}

const flush = async (): Promise<void> => {
  await act(async () => {
    for (let i = 0; i < 60; i += 1) await Promise.resolve();
  });
};

type Listener = (event: { preventDefault: () => void }) => void;
function fakeNav() {
  const listeners: Listener[] = [];
  const nav = {
    navigate: vi.fn(),
    dispatch: vi.fn(),
    goBack: vi.fn(),
    canGoBack: () => true,
    addListener: (_type: string, listener: Listener) => {
      listeners.push(listener);
      return () => listeners.splice(listeners.indexOf(listener), 1);
    },
    /** A back from the header's Close or the system: true when a guard held it. */
    back: (): boolean => {
      let held = false;
      for (const listener of [...listeners]) listener({ preventDefault: () => (held = true) });
      return held;
    },
  };
  return nav;
}

async function open(nav = fakeNav()): Promise<{ r: ReactTestRenderer; nav: ReturnType<typeof fakeNav> }> {
  const r = await render(
    <LayoutProvider value={layoutClassFor({ width: 320, height: 640 })}>
      <StageReviewScreen navigation={nav as never} route={{ key: 'StageReview', name: 'StageReview', params: { stageKey: 'stage1' } } as never} />
    </LayoutProvider>,
  );
  await flush();
  return { r, nav };
}

const button = (r: ReactTestRenderer, label: string): ReactTestInstance => buttonsNamed(r.root, label)[0]!;
const tap = async (r: ReactTestRenderer, label: string): Promise<void> => {
  await press(button(r, label));
  await flush();
};
const items = (r: ReactTestRenderer): string[] => screenTexts(byTestId(r.root, 'part-items')[0]!)[0]!.split(',').filter(Boolean);
/** A back (the header's Close, the system back) inside `act`; true when a guard held it. */
const back = async (nav: ReturnType<typeof fakeNav>): Promise<boolean> => {
  let held = false;
  await act(async () => {
    held = nav.back();
  });
  return held;
};
const answer = async (r: ReactTestRenderer, times: number): Promise<void> => {
  for (let n = 0; n < times; n += 1) await press(byTestId(r.root, 'part-answer')[0]!);
  await flush();
};
const partDone = async (r: ReactTestRenderer): Promise<void> => {
  await press(byTestId(r.root, 'part-done')[0]!);
  await flush();
};
const stored = (): { seed: number; answers: Record<string, unknown>; startedAt: string; hideRomanization: boolean } | null =>
  (rig.mem.get(CHECK_RUN_KEY(ID)) as never) ?? null;

/** Plays the first `count` items of a fresh check (taps Let us go, answers them, passing the pauses), then leaves the screen. */
async function playSome(count: number, nav = fakeNav()): Promise<{ r: ReactTestRenderer; nav: ReturnType<typeof fakeNav> }> {
  const { r } = await open(nav);
  await tap(r, M.intro.start.cta);
  let left = count;
  for (let part = 0; part < 5 && left > 0; part += 1) {
    const here = Math.min(left, items(r).length);
    await answer(r, here);
    left -= here;
    if (left > 0) {
      await partDone(r);
      await tap(r, M.pause.keepGoing.cta);
    }
  }
  await settleSavedChecksForTests();
  return { r, nav };
}

beforeEach(async () => {
  await settleSavedChecksForTests(true);
  rig.mem.clear();
  rig.right = true;
  rig.stall = null;
  vi.mocked(track).mockClear();
  resetRemoteConfigForTests();
  useReviewRunStore.getState().reset();
  useProfileStore.setState({ profiles: [learner], activeId: ID, hydrated: true });
  useProgressStore.setState({ byProfile: { [ID]: snapshot() }, hydratedFor: new Set([ID]), saveRetryFailedFor: new Set(), loadFailedFor: new Set() });
});
afterEach(async () => {
  vi.useRealTimers();
  await cleanup();
  resetPlatform();
});

describe('[LR] the Hangul Check reads before it shows its intro', () => {
  it('with nothing stored, the intro shows after the read (a reading frame first, no buttons)', async () => {
    const { r } = await open();
    expect(byTestId(r.root, 'hangul-check-intro')).toHaveLength(1);
    expect(byTestId(r.root, 'hangul-check-resume')).toHaveLength(0);
    expect(buttonsNamed(r.root, M.intro.start.cta)).toHaveLength(1);
  });

  it('the reading frame is the intro\'s Hoya and title with no buttons, marked busy', async () => {
    rig.stall = new Promise<void>(() => undefined);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const r = await render(
      <LayoutProvider value={layoutClassFor({ width: 320, height: 640 })}>
        <StageReviewScreen navigation={fakeNav() as never} route={{ key: 'StageReview', name: 'StageReview', params: { stageKey: 'stage1' } } as never} />
      </LayoutProvider>,
    );
    const frame = byTestId(r.root, 'hangul-check-reading');
    expect(frame).toHaveLength(1);
    expect(screenTexts(frame[0]!)).toContain(M.title);
    expect(frame[0]!.props['aria-busy']).toBe(true);
    expect(buttonsNamed(r.root, M.intro.start.cta)).toHaveLength(0);
    expect(buttonsNamed(r.root, EN.common.buttons.continue)).toHaveLength(0);
  });

  it('a read that takes longer than 800 ms shows the intro, and a read that lands later switches it to the resume page', async () => {
    const { r: first } = await playSome(9);
    expect(stored()).not.toBeNull();
    await cleanup();

    let release: () => void = () => undefined;
    rig.stall = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const r = await render(
      <LayoutProvider value={layoutClassFor({ width: 320, height: 640 })}>
        <StageReviewScreen navigation={fakeNav() as never} route={{ key: 'StageReview', name: 'StageReview', params: { stageKey: 'stage1' } } as never} />
      </LayoutProvider>,
    );
    expect(byTestId(r.root, 'hangul-check-reading')).toHaveLength(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });
    expect(byTestId(r.root, 'hangul-check-intro')).toHaveLength(1);
    release();
    await flush();
    expect(byTestId(r.root, 'hangul-check-resume')).toHaveLength(1);
    expect(byTestId(r.root, 'hangul-check-intro')).toHaveLength(0);
    void first;
  });

  it('a late read after Let us go is ignored: the new check plays on, and its first answer replaces the stored one', async () => {
    await playSome(9);
    const oldSeed = stored()!.seed;
    await cleanup();

    let release: () => void = () => undefined;
    rig.stall = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const r = await render(
      <LayoutProvider value={layoutClassFor({ width: 320, height: 640 })}>
        <StageReviewScreen navigation={fakeNav() as never} route={{ key: 'StageReview', name: 'StageReview', params: { stageKey: 'stage1' } } as never} />
      </LayoutProvider>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });
    await press(button(r, M.intro.start.cta));
    release();
    await flush();
    expect(byTestId(r.root, 'hangul-check-resume')).toHaveLength(0);
    expect(byTestId(r.root, 'part-stub')).toHaveLength(1);
    expect(items(r)).toHaveLength(7);
    await answer(r, 1);
    await settleSavedChecksForTests();
    expect(stored()!.seed).not.toBe(oldSeed);
    expect(Object.keys(stored()!.answers)).toHaveLength(1);
  });
});

describe('[LR] answers are stored as they are given (OD-LR9 (b)) and the check goes on', () => {
  it('stores nothing before the first answer, then one answer after another', async () => {
    const { r } = await open();
    await tap(r, M.intro.start.cta);
    await settleSavedChecksForTests();
    expect(stored()).toBeNull();
    await answer(r, 1);
    await settleSavedChecksForTests();
    expect(Object.keys(stored()!.answers)).toHaveLength(1);
    await answer(r, 2);
    await settleSavedChecksForTests();
    expect(Object.keys(stored()!.answers)).toHaveLength(3);
    expect(stored()).toMatchObject({ hideRomanization: false });
  });

  it('answers in the first parts are stored; a new mount reads, offers the resume page and Continue goes on at the item after the last answered', async () => {
    const first = await playSome(9);
    const saved = stored()!;
    const full = buildHangulCheck({ seed: saved.seed });
    const allIds = full.items.map((i) => i.id);
    expect(Object.keys(saved.answers)).toEqual(allIds.slice(0, 9));
    await cleanup();
    void first;

    const { r } = await open();
    expect(byTestId(r.root, 'hangul-check-resume')).toHaveLength(1);
    expect(byTestId(r.root, 'hangul-check-intro')).toHaveLength(0);
    const texts = screenTexts(r.root);
    expect(texts).toContain(M.resume.title);
    expect(texts).toContain(EN.common.buttons.continue);
    expect(texts).toContain(M.resume.startAgain.cta);
    // The reading-practice switch is not shown; the run's choice is kept.
    expect(byTestId(r.root, 'hangul-check-hide-romanization')).toHaveLength(0);

    await tap(r, EN.common.buttons.continue);
    // The check is the one of the stored seed, at the item after the ninth: part 2, from its third item.
    expect(items(r)).toEqual(allIds.slice(9, 14));
    // `review.start` was sent once, by the first visit; Continue sends nothing.
    expect(vi.mocked(track).mock.calls.filter(([e]) => e.name === 'review.start')).toHaveLength(1);
    expect(useReviewRunStore.getState().itemIds).toEqual(allIds);
    expect(Object.keys(useReviewRunStore.getState().answers)).toEqual(allIds.slice(0, 9));
  });

  it('the result counts every item, the resumed ones with their stored first try, and the stored check is forgotten', async () => {
    // The first visit: nine items, the second of them wrong on the first try.
    const { r: a } = await open();
    await tap(a, M.intro.start.cta);
    rig.right = false;
    await answer(a, 1);
    rig.right = true;
    await answer(a, 6);
    await partDone(a);
    await tap(a, M.pause.keepGoing.cta);
    await answer(a, 2);
    await settleSavedChecksForTests();
    const saved = stored()!;
    const allIds = buildHangulCheck({ seed: saved.seed }).items.map((i) => i.id);
    await cleanup();

    const { r } = await open();
    await tap(r, EN.common.buttons.continue);
    await answer(r, 5);
    await partDone(r);
    for (let part = 2; part < 5; part += 1) {
      await tap(r, M.pause.keepGoing.cta);
      await answer(r, 7);
      await partDone(r);
    }
    await flush();
    expect(byTestId(r.root, 'hangul-check-result')).toHaveLength(1);
    // Right on the first try: all but the one miss (a symbol, so it is a tip letter).
    const entry = useProgressStore.getState().byProfile[ID]!.reviews.at(-1)!;
    expect(entry).toMatchObject({ kind: 'stage-certificate', scope: 'stage1' });
    expect(entry.itemIds).toEqual(allIds);
    expect(entry.missedItemIds).toEqual([allIds[0]]);
    expect(vi.mocked(track).mock.calls.filter(([e]) => e.name === 'review.complete')).toHaveLength(1);
    await settleSavedChecksForTests();
    expect(stored()).toBeNull();
  });

  it('a stored check with every item answered (a kill before the finish) goes from Continue straight to the result', async () => {
    const { r: a } = await open();
    await tap(a, M.intro.start.cta);
    for (let part = 0; part < 5; part += 1) {
      await answer(a, 7);
      if (part < 4) {
        await partDone(a);
        await tap(a, M.pause.keepGoing.cta);
      }
    }
    await settleSavedChecksForTests();
    // The kill came before the finish: the stored check is the whole run.
    const whole = stored();
    expect(Object.keys(whole!.answers)).toHaveLength(35);
    await cleanup();
    useProgressStore.setState({ byProfile: { [ID]: snapshot() } });
    rig.mem.set(CHECK_RUN_KEY(ID), whole);

    const { r } = await open();
    await tap(r, EN.common.buttons.continue);
    expect(byTestId(r.root, 'hangul-check-result')).toHaveLength(1);
    expect(useProgressStore.getState().byProfile[ID]!.reviews.at(-1)).toMatchObject({ resultStars: 3 });
    await settleSavedChecksForTests();
    expect(stored()).toBeNull();
  });

  it('the stored reading-practice choice is kept on Continue', async () => {
    const { r: a } = await open();
    await press(byTestId(a.root, 'hangul-check-hide-romanization')[0]!);
    await tap(a, M.intro.start.cta);
    await answer(a, 2);
    await settleSavedChecksForTests();
    expect(stored()).toMatchObject({ hideRomanization: true });
    await cleanup();

    const { r } = await open();
    await tap(r, EN.common.buttons.continue);
    expect(byTestId(r.root, 'part-stub')).toHaveLength(1);
    expect(items(r)).toHaveLength(5);
  });
});

describe('[LR] Start again, Stop and Close keep the stored check; Let us go replaces it', () => {
  it('Start again shows the normal intro and clears nothing; Maybe later leaves with the check kept', async () => {
    await playSome(9);
    await cleanup();
    const { r, nav } = await open();
    await tap(r, M.resume.startAgain.cta);
    expect(byTestId(r.root, 'hangul-check-intro')).toHaveLength(1);
    expect(buttonsNamed(r.root, M.intro.start.cta)).toHaveLength(1);
    expect(byTestId(r.root, 'hangul-check-hide-romanization')).toHaveLength(1);
    await settleSavedChecksForTests();
    expect(stored()).not.toBeNull();
    await tap(r, M.intro.later.cta);
    expect(nav.goBack).toHaveBeenCalledTimes(1);
    await settleSavedChecksForTests();
    expect(Object.keys(stored()!.answers)).toHaveLength(9);
  });

  it('Let us go after Start again starts a new check: the stored one is cleared, and a new seed is stored with the first answer', async () => {
    await playSome(9);
    const oldSeed = stored()!.seed;
    await cleanup();
    const { r } = await open();
    await tap(r, M.resume.startAgain.cta);
    await tap(r, M.intro.start.cta);
    await settleSavedChecksForTests();
    expect(stored()).toBeNull();
    expect(items(r)).toHaveLength(7);
    expect(vi.mocked(track).mock.calls.filter(([e]) => e.name === 'review.start')).toHaveLength(2);
    await answer(r, 1);
    await settleSavedChecksForTests();
    expect(stored()!.seed).not.toBe(oldSeed);
    expect(Object.keys(stored()!.answers)).toHaveLength(1);
  });

  it('the header\'s Close on the resume page leaves at once and keeps the check', async () => {
    await playSome(9);
    await cleanup();
    const { r, nav } = await open();
    expect(byTestId(r.root, 'hangul-check-resume')).toHaveLength(1);
    // The page is an intro: no guard holds the back.
    expect(await back(nav)).toBe(false);
    await settleSavedChecksForTests();
    expect(Object.keys(stored()!.answers)).toHaveLength(9);
  });

  it('a Stop in the middle of a check keeps what was stored, and the sheet says so (OD-LR1 (c)); Keep going keeps playing', async () => {
    const { r, nav } = await playSome(3);
    expect(await back(nav)).toBe(true);
    await flush();
    expect(byTestId(r.root, 'hangul-check-leave')).toHaveLength(1);
    expect(screenTexts(r.root)).toContain(M.leave.bodyKept);
    expect(screenTexts(r.root)).not.toContain(M.leave.body);
    await tap(r, M.leave.stay.cta);
    expect(nav.goBack).not.toHaveBeenCalled();
    expect(byTestId(r.root, 'part-stub')).toHaveLength(1);

    expect(await back(nav)).toBe(true);
    await flush();
    await tap(r, M.leave.stop.cta);
    expect(nav.goBack).toHaveBeenCalledTimes(1);
    await settleSavedChecksForTests();
    expect(Object.keys(stored()!.answers)).toHaveLength(3);
  });

  it('before the first answer nothing is stored, and the sheet keeps its old line', async () => {
    const { r, nav } = await open();
    await tap(r, M.intro.start.cta);
    expect(await back(nav)).toBe(true);
    await flush();
    expect(screenTexts(r.root)).toContain(M.leave.body);
    expect(screenTexts(r.root)).not.toContain(M.leave.bodyKept);
  });

  it('a stopped check offers the resume page when the check is opened again', async () => {
    const { r, nav } = await playSome(3);
    await back(nav);
    await flush();
    await tap(r, M.leave.stop.cta);
    await cleanup();
    const { r: again } = await open();
    expect(byTestId(again.root, 'hangul-check-resume')).toHaveLength(1);
    await tap(again, EN.common.buttons.continue);
    expect(items(again)).toHaveLength(4);
  });
});

describe('[LR] what is never resumed', () => {
  it('a check older than 24 hours, another learner\'s check and a stored value that is not a check open the normal intro', async () => {
    await playSome(9);
    const saved = stored()!;
    await cleanup();

    rig.mem.set(CHECK_RUN_KEY(ID), { ...saved, startedAt: new Date(Date.now() - 24 * 60 * 60 * 1000 - 5000).toISOString() });
    expect(byTestId((await open()).r.root, 'hangul-check-intro')).toHaveLength(1);
    await cleanup();

    rig.mem.clear();
    rig.mem.set(CHECK_RUN_KEY('profile:other'), saved);
    expect(byTestId((await open()).r.root, 'hangul-check-intro')).toHaveLength(1);
    await cleanup();

    rig.mem.clear();
    rig.mem.set(CHECK_RUN_KEY(ID), { v: 1, kind: 'stage' });
    expect(byTestId((await open()).r.root, 'hangul-check-intro')).toHaveLength(1);
  });

  it('a check whose items changed (another seed than the one stored) opens the normal intro', async () => {
    await playSome(9);
    const saved = stored()!;
    await cleanup();
    rig.mem.set(CHECK_RUN_KEY(ID), { ...saved, seed: saved.seed + 1 });
    expect(byTestId((await open()).r.root, 'hangul-check-intro')).toHaveLength(1);
  });

  it('a learner who has not finished Stage 1 sees the not-ready page before any stored check is looked at', async () => {
    await playSome(9);
    await cleanup();
    useProgressStore.setState({ byProfile: { [ID]: { ...snapshot(), quests: [] } } });
    const { r } = await open();
    expect(byTestId(r.root, 'hangul-check-not-ready')).toHaveLength(1);
    expect(byTestId(r.root, 'hangul-check-resume')).toHaveLength(0);
  });
});
