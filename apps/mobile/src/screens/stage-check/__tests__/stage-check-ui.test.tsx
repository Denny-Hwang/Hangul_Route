import type { Profile, ProgressSnapshot, StageKey } from '@hangul-route/content-schema';
import { TextSizeProvider } from '@hangul-route/design-system';
import { getMessages } from '@hangul-route/i18n';
import type { ReactElement, ComponentProps } from 'react';
import { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { currBuiltInPct } from '../../../config/flags';
import { episodesAll } from '../../../content';
import { gridEpisodesOf } from '../../../logic/my-route/order';
import { RECAP_SYNC_GRACE_MS, recapStages } from '../../../logic/reviews/stage-ceremony';
import { useProfileStore } from '../../../store/profile-store';
import { useProgressStore } from '../../../store/progress-store';
import { resetRemoteConfigForTests, useRemoteConfigStore } from '../../../store/remote-config-store';
import { buttonsNamed, byTestId, cleanup, press, render, screenTexts } from '../../../test-support/render';

/**
 * F-CURR-002 row CM-22 (design/wireframes/reviews/stage-check.md B, C, G and States): the gates (`stageChecks` for the
 * ceremony, with `memoryRecord` for the check; built-in pct 0), the Journey header's extras, the ceremony (with
 * `stage.card_opened` and the reduced-motion variant) and the one retroactive summary, which latches what it lists.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const navigate = vi.fn();
const dispatch = vi.fn();
vi.mock('@react-navigation/native', async () => {
  const { createContext, useEffect } = await import('react');
  return {
    NavigationContext: createContext(undefined),
    CommonActions: { reset: (state: unknown) => ({ type: 'RESET', payload: state }) },
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
    useIsFocused: () => true,
    useNavigation: () => ({ navigate, goBack: () => undefined }),
  };
});
const offerable = vi.fn(async () => true);
vi.mock('../../../logic/memory/boot', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  memoryChunk: async () => ({ stageCheckApi: () => ({ offerable }) }),
}));
const open = vi.hoisted(() => ({ all: true }));
vi.mock('../../../store/tier-store', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useQuestAccess: () => () => open.all,
}));
const sent = vi.hoisted(() => [] as Array<{ name: string; payload?: unknown }>);
vi.mock('../../../platform/telemetry', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  track: vi.fn(async (e: { name: string }) => void sent.push(e)),
}));
const motion = vi.hoisted(() => ({ reduced: false }));
vi.mock('../../../platform/motion', () => ({ useReducedMotion: () => motion.reduced }));

const { StageHeaderExtras } = await import('../StageHeaderExtras');
const { StageRecapScreen } = await import('../StageRecapScreen');
const { UpperStageCompleteScreen } = await import('../UpperStageCompleteScreen');
const { useStageCeremonyOn } = await import('../stage-check-entry');
const { latchStageCeremony } = await import('../stage-ceremony-latch');
const { StageRecapTrigger } = await import('../StageRecapTrigger');
const { useSyncStore } = await import('../../../store/sync-store');
const { useStageCheckOn } = await import('../use-stage-offer');

const EN = getMessages('en');
const ID = 'profile:mina';
const AT = '2026-10-01T10:00:00.000Z';
const learner: Profile = { id: ID, displayName: 'Mina', ageGroup: '8-9', avatar: 'hoya-orange', role: 'learner', createdAt: '2026-10-01T00:00:00.000Z', learnerType: 'child' };
const grownUp: Profile = { ...learner, id: 'profile:mum', displayName: 'Mum', role: 'parent' };

function flags(on: Record<string, boolean>): void {
  useRemoteConfigStore.setState({
    hydrated: true,
    cache: { v: 1, fetchedAt: 0, maxAgeS: 300, flags: Object.fromEntries(Object.entries(on).map(([flag, value]) => [flag, { on: value, pct: 100 }])) },
  });
}

/** Every grid quest of these stages done. */
function snapshot(stages: readonly StageKey[], over: Partial<ProgressSnapshot> = {}): void {
  const quests = gridEpisodesOf(episodesAll)
    .filter((e) => stages.includes(e.stage))
    .flatMap((e) => e.questIds.map((questId) => ({ questId, episodeId: e.id, startedAt: AT, completedAt: AT, stars: 2 as const, attempts: 1, accuracy: 0.9 })));
  useProgressStore.setState({
    byProfile: { [ID]: { profileId: ID, updatedAt: AT, episodes: [], quests, cards: [], sessions: [], homework: [], reviews: [], streakDays: 0, ...over } as ProgressSnapshot },
    hydratedFor: new Set([ID]),
  });
}

async function draw(element: ReactElement) {
  const r = await render(element);
  await act(async () => {
    for (let i = 0; i < 4; i += 1) await Promise.resolve();
  });
  return r;
}

const nav = () => ({ navigate, dispatch, goBack: () => undefined, canGoBack: () => true, addListener: () => () => undefined }) as never;

beforeEach(() => {
  resetRemoteConfigForTests();
  navigate.mockClear();
  dispatch.mockClear();
  offerable.mockClear();
  offerable.mockImplementation(async () => true);
  open.all = true;
  motion.reduced = false;
  sent.length = 0;
  useProfileStore.setState({ profiles: [learner, grownUp], activeId: ID, hydrated: true });
  snapshot(['stage1', 'stage2']);
});
afterEach(async () => {
  await cleanup();
});

describe('the gates (section 12.2)', () => {
  function Probe({ id }: { id: string | null }): ReactElement {
    return <>{`${String(useStageCeremonyOn(id))}|${String(useStageCheckOn(id))}`}</>;
  }
  const read = async (id: string | null): Promise<string> => JSON.parse(JSON.stringify((await render(<Probe id={id} />)).toJSON())) as string;

  it('stageChecks ships at built-in pct 0: a device that never fetched the config shows nothing (merges dark)', async () => {
    expect(currBuiltInPct('stageChecks')).toBe(0);
    useRemoteConfigStore.setState({ hydrated: true, cache: null });
    expect(await read(ID)).toBe('false|false');
  });

  it('the ceremony needs stageChecks for a learner; the check needs memoryRecord too (turned off remotely, it closes); a grown-up never', async () => {
    flags({ stageChecks: true, memoryRecord: true });
    expect(await read(ID)).toBe('true|true');
    expect(await read(grownUp.id)).toBe('false|false');
    expect(await read(null)).toBe('false|false');
    flags({ stageChecks: true, memoryRecord: false });
    expect(await read(ID)).toBe('true|false');
    flags({ stageChecks: false, memoryRecord: true });
    expect(await read(ID)).toBe('false|false');
  });
});

describe('the Journey header (C)', () => {
  const props = (over: Partial<ComponentProps<typeof StageHeaderExtras>> = {}): ComponentProps<typeof StageHeaderExtras> => ({
    place: 'actions',
    profileId: ID,
    stage: 'stage2',
    complete: true,
    ...over,
  });

  it('a finished Stage 2: See your prize and Stage Check; each opens its route', async () => {
    flags({ stageChecks: true, memoryRecord: true });
    const r = await draw(<StageHeaderExtras {...props()} />);
    await press(buttonsNamed(r.root, EN.learner.journey.stagePrize.cta)[0]!);
    expect(navigate).toHaveBeenCalledWith('StageComplete', { stageKey: 'stage2' });
    await press(buttonsNamed(r.root, EN.learner.stageCheck.title)[0]!);
    expect(navigate).toHaveBeenCalledWith('StageCheck', { stageKey: 'stage2' });
    expect(offerable).toHaveBeenCalledWith(ID, 'stage2');
  });

  it('once taken, the button reads the best stars ("Stage Check, best 2 stars"), never a lower later one', async () => {
    flags({ stageChecks: true, memoryRecord: true });
    const entry = (stars: 1 | 2) => ({ id: `stage-check:stage2-${stars}`, kind: 'stage-certificate' as const, generatedAt: AT, scope: 'stage2', itemIds: [], resultStars: stars });
    snapshot(['stage1', 'stage2'], { reviews: [entry(2), entry(1)] });
    const r = await draw(<StageHeaderExtras {...props()} />);
    expect(screenTexts(r.root)).toContain('Stage Check, best 2 stars');
  });

  it('memoryRecord off: See your prize stays, no Stage Check; a stage the learner cannot open (F-ENT-003): no Stage Check', async () => {
    flags({ stageChecks: true, memoryRecord: false });
    let r = await draw(<StageHeaderExtras {...props()} />);
    expect(buttonsNamed(r.root, EN.learner.journey.stagePrize.cta)).toHaveLength(1);
    expect(buttonsNamed(r.root, EN.learner.stageCheck.title)).toHaveLength(0);
    await cleanup();
    flags({ stageChecks: true, memoryRecord: true });
    open.all = false;
    r = await draw(<StageHeaderExtras {...props()} />);
    expect(buttonsNamed(r.root, EN.learner.stageCheck.title)).toHaveLength(0);
  });

  it('at the Largest text the buttons sit under the header, wrapping (never beside the pill), and nowhere else', async () => {
    flags({ stageChecks: true, memoryRecord: true });
    const big = (place: 'actions' | 'below') => (
      <TextSizeProvider step="largest">
        <StageHeaderExtras {...props({ place })} />
      </TextSizeProvider>
    );
    expect((await draw(big('actions'))).toJSON()).toBeNull();
    await cleanup();
    const r = await draw(big('below'));
    expect(byTestId(r.root, 'journey-stage-actions-below-stage2').length).toBeGreaterThan(0);
    expect(buttonsNamed(r.root, EN.learner.journey.stagePrize.cta)).toHaveLength(1);
    await cleanup();
    // At the standard size the 'below' place draws nothing.
    expect((await draw(<StageHeaderExtras {...props({ place: 'below' })} />)).toJSON()).toBeNull();
  });

  it('nothing for a stage not finished, and nothing with stageChecks off (the results stay latched)', async () => {
    flags({ stageChecks: true, memoryRecord: true });
    expect((await draw(<StageHeaderExtras {...props({ stage: 'stage3', complete: false })} />)).toJSON()).toBeNull();
    await cleanup();
    flags({ stageChecks: false, memoryRecord: true });
    expect((await draw(<StageHeaderExtras {...props()} />)).toJSON()).toBeNull();
  });

  it('the tested-out caption under a stage whose cells are all done or tested out (cell-check.md States)', async () => {
    flags({ cellCheck: true, memoryRecord: true });
    const cells = gridEpisodesOf(episodesAll).filter((e) => e.stage === 'stage3');
    const all = gridEpisodesOf(episodesAll).filter((e) => e.stage === 'stage3' && e.id !== cells[0]?.id);
    snapshot(['stage1'], {
      quests: all.flatMap((e) => e.questIds.map((questId) => ({ questId, episodeId: e.id, startedAt: AT, completedAt: AT, stars: 2 as const, attempts: 1, accuracy: 0.9 }))),
      testedOut: { [cells[0]!.id]: AT },
    });
    const r = await draw(<StageHeaderExtras {...props({ place: 'caption', stage: 'stage3', complete: false })} />);
    expect(screenTexts(r.root)).toContain(EN.learner.testOut.stageHint);
  });
});

describe('the ceremony (B)', () => {
  const route = (stageKey: StageKey) => ({ key: 'k', name: 'StageComplete' as const, params: { stageKey } });

  it('Stage 2 complete!, Hoya, the Stage Check as the one primary; opening the page sends stage.card_opened', async () => {
    flags({ stageChecks: true, memoryRecord: true });
    const r = await draw(<UpperStageCompleteScreen navigation={nav()} route={route('stage2')} />);
    expect(screenTexts(r.root)).toEqual(expect.arrayContaining(['Stage 2 complete!', EN.learner.upperStageComplete.cheer, EN.learner.stageCheck.offer.body]));
    await press(buttonsNamed(r.root, EN.learner.stageCheck.offer.cta)[0]!);
    expect(navigate).toHaveBeenCalledWith('StageCheck', { stageKey: 'stage2' });
    expect(sent).toEqual([{ name: 'stage.card_opened', profileId: ID, payload: { stage: 'stage2' } }]);
    // No stage card yet (row CM-23): the card block is left out, everything else stays.
    expect(byTestId(r.root, 'upper-stage-complete-cards')).toHaveLength(0);
    expect(screenTexts(r.root).join(' ')).not.toMatch(/premium|price|exam|certificate|%/i);
  });

  it('reduced motion: the same page, no sparkles', async () => {
    flags({ stageChecks: true, memoryRecord: true });
    motion.reduced = true;
    const r = await draw(<UpperStageCompleteScreen navigation={nav()} route={route('stage2')} />);
    expect(screenTexts(r.root)).toContain('Stage 2 complete!');
    expect(byTestId(r.root, 'upper-stage-complete-title').length).toBeGreaterThan(0);
  });

  it('memoryRecord off: See my cards is the primary and no Stage Check; a stage not finished or stageChecks off: the calm page', async () => {
    flags({ stageChecks: true, memoryRecord: false });
    let r = await draw(<UpperStageCompleteScreen navigation={nav()} route={route('stage2')} />);
    expect(buttonsNamed(r.root, EN.learner.stageCheck.offer.cta)).toHaveLength(0);
    expect(buttonsNamed(r.root, EN.learner.stageComplete.seeCards.cta)).toHaveLength(1);
    await cleanup();
    r = await draw(<UpperStageCompleteScreen navigation={nav()} route={route('stage3')} />);
    expect(byTestId(r.root, 'upper-stage-complete-not-ready').length).toBeGreaterThan(0);
    await cleanup();
    flags({ stageChecks: false, memoryRecord: true });
    r = await draw(<UpperStageCompleteScreen navigation={nav()} route={route('stage2')} />);
    expect(byTestId(r.root, 'upper-stage-complete-not-ready').length).toBeGreaterThan(0);
  });
});

describe('the one retroactive summary (G, section 4.8 step 7)', () => {
  it('lists every finished stage with no key on one screen, latches them all, and is never listed again', async () => {
    flags({ stageChecks: true });
    snapshot(['stage1', 'stage2', 'stage3']);
    const r = await draw(<StageRecapScreen navigation={nav()} route={{ key: 'k', name: 'StageRecap', params: undefined }} />);
    expect(screenTexts(r.root)).toEqual(expect.arrayContaining(['You finished Stages 2 and 3 earlier', EN.learner.stageCheck.retro.bodyNoCards]));
    const snap = useProgressStore.getState().byProfile[ID]!;
    expect(Object.keys(snap.stageCeremonyAt ?? {})).toEqual(['stage2', 'stage3']);
    expect(recapStages(snap, episodesAll)).toEqual([]);
    // Its own latch never empties the list it shows.
    expect(screenTexts(r.root)).toContain('You finished Stages 2 and 3 earlier');
  });

  it('latchStageCeremony: only on a hydrated snapshot, earliest wins, nothing written twice', () => {
    snapshot(['stage1', 'stage2'], { stageCeremonyAt: { stage3: AT } });
    latchStageCeremony(ID, ['stage2'], new Date('2026-10-22T00:00:00.000Z'));
    expect(useProgressStore.getState().byProfile[ID]?.stageCeremonyAt).toEqual({ stage2: '2026-10-22T00:00:00.000Z', stage3: AT });
    const before = useProgressStore.getState().byProfile[ID];
    latchStageCeremony(ID, ['stage2'], new Date('2026-10-23T00:00:00.000Z'));
    expect(useProgressStore.getState().byProfile[ID]).toBe(before);
    useProgressStore.setState({ hydratedFor: new Set() });
    latchStageCeremony(ID, ['stage4']);
    expect(useProgressStore.getState().byProfile[ID]?.stageCeremonyAt?.stage4).toBeUndefined();
  });
});

describe("Home's trigger for the summary", () => {
  // A learner of its own: the summary marks a profile shown for the app session, and the tests above showed Mina's.
  let next = 0;
  const settle = async (ms = 500): Promise<void> => {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, ms));
    });
  };
  /** A fresh learner (the shown-once mark is per app session) with these stages finished, and its sync status. */
  function learnerWith(stages: StageKey[], status: 'off' | 'idle' | 'syncing' | 'synced' | 'error' | null, over: Partial<ProgressSnapshot> = {}): string {
    next += 1;
    const id = `profile:jo-${next}`;
    useProfileStore.setState({ profiles: [learner, { ...learner, id, displayName: 'Jo' }], activeId: id, hydrated: true });
    snapshot(stages, over);
    const snap = useProgressStore.getState().byProfile[ID]!;
    useProgressStore.setState({ byProfile: { [id]: { ...snap, profileId: id } }, hydratedFor: new Set([id]) });
    useSyncStore.setState({ byLearner: status === null ? {} : { [id]: { learnerId: id, secret: 's', rev: 1, lastSyncedAt: null, lastError: null, status, rescueCode: null, pendingProfile: null, profileAt: null } } });
    return id;
  }

  it('opens the summary once while a finished Stage 2-7 has no key; never with nothing to list', async () => {
    flags({ stageChecks: true });
    let id = learnerWith(['stage1', 'stage2'], 'synced', { stageCeremonyAt: { stage2: AT } });
    await draw(<StageRecapTrigger profileId={id} />);
    await settle();
    expect(navigate).not.toHaveBeenCalled();
    await cleanup();
    id = learnerWith(['stage1', 'stage2'], 'synced');
    await draw(<StageRecapTrigger profileId={id} />);
    await settle();
    expect(navigate).toHaveBeenCalledWith('StageRecap');
    // The summary marks itself shown (and latches the stage): Home never opens it again.
    await draw(<StageRecapScreen navigation={nav()} route={{ key: 'k', name: 'StageRecap', params: undefined }} />);
    await cleanup();
    navigate.mockClear();
    await draw(<StageRecapTrigger profileId={id} />);
    await settle();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('waits for the sync: while a pull runs it never opens, and a pulled key from another device means it never shows here', async () => {
    flags({ stageChecks: true });
    const id = learnerWith(['stage1', 'stage2'], 'syncing');
    await draw(<StageRecapTrigger profileId={id} />);
    await settle();
    expect(navigate).not.toHaveBeenCalled();
    // The pull lands: device A already showed the summary and latched Stage 2.
    await act(async () => {
      const snap = useProgressStore.getState().byProfile[id]!;
      useProgressStore.setState({ byProfile: { [id]: { ...snap, stageCeremonyAt: { stage2: AT } } } });
      useSyncStore.setState({ byLearner: { [id]: { ...useSyncStore.getState().byLearner[id]!, status: 'synced' } } });
    });
    await settle();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('offline (error) or no server (off): the local copy is all there is, so it opens; idle with no sync: after the grace', async () => {
    flags({ stageChecks: true });
    for (const status of ['error', 'off'] as const) {
      navigate.mockClear();
      const id = learnerWith(['stage1', 'stage2'], status);
      await draw(<StageRecapTrigger profileId={id} />);
      await settle();
      expect(navigate, status).toHaveBeenCalledWith('StageRecap');
      await cleanup();
    }
    vi.useFakeTimers();
    try {
      navigate.mockClear();
      const id = learnerWith(['stage1', 'stage2'], null);
      await render(<StageRecapTrigger profileId={id} />);
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      expect(navigate).not.toHaveBeenCalled();
      await act(async () => {
        vi.advanceTimersByTime(RECAP_SYNC_GRACE_MS);
      });
      await act(async () => {
        vi.advanceTimersByTime(500);
      });
      expect(navigate).toHaveBeenCalledWith('StageRecap');
    } finally {
      vi.useRealTimers();
    }
  });

  it("Home's slot draws nothing with stageChecks off, and never for a grown-up", async () => {
    const { StageRecapSlot } = await import('../stage-check-entry');
    flags({ stageChecks: false });
    const id = learnerWith(['stage1', 'stage2'], 'synced');
    expect((await draw(<StageRecapSlot profileId={id} />)).toJSON()).toBeNull();
    await settle();
    expect(navigate).not.toHaveBeenCalled();
    await cleanup();
    flags({ stageChecks: true });
    expect((await draw(<StageRecapSlot profileId={grownUp.id} />)).toJSON()).toBeNull();
    expect((await draw(<StageRecapSlot profileId={null} />)).toJSON()).toBeNull();
  });
});
