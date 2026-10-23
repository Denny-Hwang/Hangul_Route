import type { Profile, ProgressSnapshot } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import type { ComponentProps, ReactElement } from 'react';
import { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { currBuiltInPct } from '../../../config/flags';
import { useProfileStore } from '../../../store/profile-store';
import { useProgressStore } from '../../../store/progress-store';
import { resetRemoteConfigForTests, useRemoteConfigStore } from '../../../store/remote-config-store';
import { buttonsNamed, byTestId, cleanup, press, render, screenTexts } from '../../../test-support/render';
import { CellCheckBlock } from '../CellCheckBlock';
import { useSwitches } from '../cell-check-entry';

/**
 * F-CURR-002 row CM-21 (design/wireframes/reviews/cell-check.md A, A2, B, H and States): the gate (`cellCheck` with
 * `memoryRecord`, a learner; built-in pct 0), the block after the first volume, Cell Check done, Test out on an unstarted
 * open cell and none on a locked one, and the routes they open.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const navigate = vi.fn();
vi.mock('@react-navigation/native', async () => {
  const { createContext, useEffect } = await import('react');
  return {
    NavigationContext: createContext(undefined),
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
    useNavigation: () => ({ navigate, goBack: () => undefined }),
  };
});
const offerable = vi.fn(async () => ({ check: true, testOut: true }));
vi.mock('../../../logic/memory/boot', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  memoryChunk: async () => ({ cellCheckApi: () => ({ offerable }) }),
}));

const EN = getMessages('en');
const ID = 'profile:mina';
const learner: Profile = { id: ID, displayName: 'Mina', ageGroup: '8-9', avatar: 'hoya-orange', role: 'learner', createdAt: '2026-10-01T00:00:00.000Z', learnerType: 'child' };
const grownUp: Profile = { ...learner, id: 'profile:mum', displayName: 'Mum', role: 'parent' };
const CELL = 'episode:stage2-life';

function flags(on: Record<string, boolean>): void {
  useRemoteConfigStore.setState({
    hydrated: true,
    cache: { v: 1, fetchedAt: 0, maxAgeS: 300, flags: Object.fromEntries(Object.entries(on).map(([flag, value]) => [flag, { on: value, pct: 100 }])) },
  });
}

function snapshot(over: Partial<ProgressSnapshot> = {}): void {
  useProgressStore.setState({ byProfile: { [ID]: { profileId: ID, updatedAt: '2026-10-01T00:00:00.000Z', episodes: [], quests: [], cards: [], sessions: [], homework: [], reviews: [], streakDays: 0, ...over } as ProgressSnapshot } });
}

const props = (over: Partial<ComponentProps<typeof CellCheckBlock>> = {}): ComponentProps<typeof CellCheckBlock> => ({
  place: 'top',
  profileId: ID,
  episodeId: CELL,
  stage: 'stage2',
  theme: 'life',
  stars: [3, 2, 2],
  open: [true, true, true],
  checkOn: true,
  masteryOn: false,
  ...over,
});

async function draw(element: ReactElement) {
  const r = await render(element);
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  return r;
}

beforeEach(() => {
  resetRemoteConfigForTests();
  navigate.mockClear();
  offerable.mockClear();
  offerable.mockImplementation(async () => ({ check: true, testOut: true }));
  useProfileStore.setState({ profiles: [learner, grownUp], activeId: ID, hydrated: true });
  snapshot();
});
afterEach(async () => {
  await cleanup();
});

describe('the gate (section 12.2)', () => {
  function Probe({ id }: { id: string | null }): ReactElement {
    return <>{String(useSwitches(id)[0])}</>;
  }
  const on = async (id: string | null): Promise<boolean> => {
    const r = await render(<Probe id={id} />);
    return JSON.stringify(r.toJSON()) === '"true"';
  };

  it('cellCheck ships at built-in pct 0: a device that never fetched the config shows nothing', async () => {
    expect(currBuiltInPct('cellCheck')).toBe(0);
    useRemoteConfigStore.setState({ hydrated: true, cache: null });
    expect(await on(ID)).toBe(false);
  });

  it('on only with cellCheck and memoryRecord for a learner; memoryRecord turned off remotely closes it; a grown-up never', async () => {
    flags({ cellCheck: true, memoryRecord: true });
    expect(await on(ID)).toBe(true);
    expect(await on(grownUp.id)).toBe(false);
    expect(await on(null)).toBe(false);
    flags({ cellCheck: true, memoryRecord: false });
    expect(await on(ID)).toBe(false);
    flags({ cellCheck: false, memoryRecord: true });
    expect(await on(ID)).toBe(false);
  });
});

describe('the block (A, A2)', () => {
  it('after the first volume: Cell Check, its line and the page primary, which opens the check', async () => {
    const r = await draw(<CellCheckBlock {...props()} />);
    expect(screenTexts(r.root)).toEqual(expect.arrayContaining([EN.learner.cellCheck.title, EN.learner.cellCheck.body]));
    const [button] = buttonsNamed(r.root, EN.learner.cellCheck.cta);
    expect(button).toBeDefined();
    await press(button!);
    expect(navigate).toHaveBeenCalledWith('CellCheck', { cellId: CELL, mode: 'check' });
    expect(offerable).toHaveBeenCalledWith(ID, CELL);
  });

  it('after a 3-star Check: Cell Check done and Take it again', async () => {
    snapshot({ cellCheckAt: { [CELL]: '2026-10-20T10:00:00.000Z' } });
    const r = await draw(<CellCheckBlock {...props()} />);
    expect(byTestId(r.root, 'cell-check-done').length).toBeGreaterThan(0);
    expect(buttonsNamed(r.root, EN.learner.cellCheck.again)).toHaveLength(1);
  });

  it('a new cell offers nothing until its own plan is read (the earlier cell\'s offer never shows)', async () => {
    let resolve: (v: { check: boolean; testOut: boolean }) => void = () => undefined;
    const r = await draw(<CellCheckBlock {...props()} />);
    expect(buttonsNamed(r.root, EN.learner.cellCheck.cta)).toHaveLength(1);
    offerable.mockImplementation(() => new Promise((res) => (resolve = res)));
    await act(async () => {
      r.update(<CellCheckBlock {...props({ episodeId: 'episode:stage2-crafts' })} />);
      await Promise.resolve();
    });
    expect(buttonsNamed(r.root, EN.learner.cellCheck.cta)).toHaveLength(0);
    await act(async () => {
      resolve({ check: true, testOut: true });
      await Promise.resolve();
    });
    expect(buttonsNamed(r.root, EN.learner.cellCheck.cta)).toHaveLength(1);
  });

  it('nothing before the first volume is done, nothing with too few rounds, nothing with cellCheck off', async () => {
    expect((await draw(<CellCheckBlock {...props({ stars: [3, 0, 0] })} />)).toJSON()).toBeNull();
    await cleanup();
    offerable.mockImplementation(async () => ({ check: false, testOut: false }));
    expect((await draw(<CellCheckBlock {...props()} />)).toJSON()).toBeNull();
    await cleanup();
    expect((await draw(<CellCheckBlock {...props({ checkOn: false })} />)).toJSON()).toBeNull();
  });
});

describe('Test out (B)', () => {
  const bottom = (over: Partial<ComponentProps<typeof CellCheckBlock>> = {}) => props({ place: 'bottom', stars: [0, 0, 0], ...over });

  it('under an unstarted open cell: Already know this? and Test out, which opens the test-out', async () => {
    const r = await draw(<CellCheckBlock {...bottom()} />);
    expect(screenTexts(r.root)).toContain(EN.learner.testOut.prompt);
    const [button] = buttonsNamed(r.root, EN.learner.testOut.title);
    await press(button!);
    expect(navigate).toHaveBeenCalledWith('CellCheck', { cellId: CELL, mode: 'testout' });
  });

  it('entitlement (F-ENT-003): a locked cell offers no test-out; neither does Stage 1 or a tested-out cell', async () => {
    expect((await draw(<CellCheckBlock {...bottom({ open: [false, false, false] })} />)).toJSON()).toBeNull();
    await cleanup();
    expect((await draw(<CellCheckBlock {...bottom({ stage: 'stage1', episodeId: 'episode:stage1-life' })} />)).toJSON()).toBeNull();
    await cleanup();
    snapshot({ testedOut: { [CELL]: '2026-10-20T10:00:00.000Z' } });
    expect((await draw(<CellCheckBlock {...bottom()} />)).toJSON()).toBeNull();
  });

  it('a cell whose topic words are too many for Test out (testOutFits false) offers none; the Check stays', async () => {
    offerable.mockImplementation(async () => ({ check: true, testOut: false }));
    expect((await draw(<CellCheckBlock {...bottom()} />)).toJSON()).toBeNull();
    await cleanup();
    const r = await draw(<CellCheckBlock {...props()} />);
    expect(buttonsNamed(r.root, EN.learner.cellCheck.cta)).toHaveLength(1);
  });
});
