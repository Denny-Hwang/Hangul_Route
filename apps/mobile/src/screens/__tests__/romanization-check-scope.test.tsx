import type { Profile, ProgressSnapshot, RomanizationChoice } from '@hangul-route/content-schema';
import type { ReactElement } from 'react';
import { Text } from 'react-native';
import { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RomanizationCheckScope, RomanizationModeOverride, useRomanizationMode, useRomanizationResolver } from '../../i18n/use-romanization-mode';
import { snapshotWith } from '../../logic/stage1/__tests__/fixtures';
import { STAGE1_QUESTS } from '../../logic/stage1/curriculum';
import { useLocaleStore } from '../../store/locale-store';
import { useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';
import { byTestId, cleanup, render, resetPlatform, setPlatform, textOf, unmount } from '../../test-support/render';

/**
 * AMENDMENTS-ROMANIZATION-FADE section 3.7, row RF-1a: a game inside `RomanizationCheckScope` reads the resolver's `check`
 * mode; everything else reads `surface`; the hook is memoized on the phase; the native screen reader is one app-wide
 * holder. With the shipped default (`always`) nothing changes for any profile.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const sr = vi.hoisted(() => ({ enabled: false, listeners: [] as Array<(on: boolean) => void>, subscriptions: 0 }));
vi.mock('../../platform/screen-reader', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  isScreenReaderEnabled: () => Promise.resolve(sr.enabled),
  subscribeScreenReader: (fn: (on: boolean) => void) => {
    sr.subscriptions += 1;
    sr.listeners.push(fn);
    return () => {
      sr.listeners.splice(sr.listeners.indexOf(fn), 1);
    };
  },
}));

const ID = 'profile:mina';
const learner: Profile = { id: ID, displayName: 'Mina', ageGroup: '8-9', avatar: 'hoya-orange', role: 'learner', createdAt: '2026-10-01T00:00:00.000Z', learnerType: 'child' };

const FIRST_TEN = STAGE1_QUESTS.slice(0, 10).map((q) => ({ questId: q.id, episodeId: 'episode:x' }));
/** Quests 1 to 10 done: phase `reading`. */
const reading = (): ProgressSnapshot => snapshotWith(FIRST_TEN);
/** Word Builder tested out: phase `all`. */
const allPhase = (): ProgressSnapshot => ({ ...snapshotWith([]), testedOut: { 'episode:stage2-letters': '2026-11-01T00:00:00.000Z' } });
const letters = (): ProgressSnapshot => snapshotWith(FIRST_TEN.slice(0, 3));

function seed(choice: RomanizationChoice | undefined, snapshot: ProgressSnapshot | undefined, legacy: 'always' | 'tap' = 'always'): void {
  useProfileStore.setState({ profiles: [learner], activeId: ID, hydrated: true });
  useLocaleStore.setState({
    byProfile: { [ID]: choice === undefined ? { romanizationMode: legacy } : { romanizationMode: choice === 'tap' ? 'tap' : 'always', romanizationChoice: choice } },
    screenReader: false,
  });
  useProgressStore.setState({ byProfile: snapshot === undefined ? {} : { [ID]: snapshot } });
}

let renders = 0;
function Probe(): ReactElement {
  renders += 1;
  const mode = useRomanizationMode();
  const resolver = useRomanizationResolver();
  return (
    <>
      <Text testID="mode">{mode}</Text>
      <Text testID="word">{resolver.forText('산')}</Text>
      <Text testID="theme">{resolver.forText('까치')}</Text>
    </>
  );
}

async function read(element: ReactElement): Promise<{ mode: string; word: string; theme: string }> {
  const r = await render(element);
  const at = (id: string): string => textOf(byTestId(r.root, id)[0]!);
  return { mode: at('mode'), word: at('word'), theme: at('theme') };
}

beforeEach(() => {
  renders = 0;
  sr.enabled = false;
  sr.listeners.length = 0;
  useProfileStore.setState({ profiles: [], activeId: null, hydrated: true });
  useLocaleStore.setState({ byProfile: {}, screenReader: false });
  useProgressStore.setState({ byProfile: {} });
});
afterEach(async () => {
  await cleanup();
  resetPlatform();
});

describe('useRomanizationMode: with the shipped default nothing changes (RF-1a)', () => {
  it('no profile: always, with and without the Check scope', async () => {
    expect((await read(<Probe />)).mode).toBe('always');
    expect((await read(<RomanizationCheckScope><Probe /></RomanizationCheckScope>)).mode).toBe('always');
  });

  it.each([
    ['letters', letters],
    ['reading', reading],
    ['all', allPhase],
  ])('a profile with no stored choice in phase %s reads always, inside a Check too', async (_, snapshot) => {
    seed(undefined, snapshot());
    expect(await read(<Probe />)).toEqual({ mode: 'always', word: 'always', theme: 'always' });
    expect((await read(<RomanizationCheckScope><Probe /></RomanizationCheckScope>)).mode).toBe('always');
  });

  it('a stored tap (the old switch) reads tap, on every surface and inside a Check, as before', async () => {
    seed(undefined, allPhase(), 'tap');
    expect(await read(<Probe />)).toEqual({ mode: 'tap', word: 'tap', theme: 'tap' });
    expect((await read(<RomanizationCheckScope><Probe /></RomanizationCheckScope>)).mode).toBe('tap');
  });

  it('a stored always with a Read to me fill reads always (the default), not a choice', async () => {
    seed(undefined, allPhase());
    useLocaleStore.setState({ byProfile: { [ID]: { romanizationMode: 'always', readToMe: true } } });
    expect((await read(<Probe />)).mode).toBe('always');
  });
});

describe('RomanizationCheckScope and the resolver, for a profile on As I learn (auto)', () => {
  it('reads the surface mode outside a Check: always while letters or reading, tap once Word Builder is done', async () => {
    seed('auto', letters());
    expect((await read(<Probe />)).mode).toBe('always');
    await cleanup();
    seed('auto', reading());
    expect((await read(<Probe />)).mode).toBe('always');
    await cleanup();
    seed('auto', allPhase());
    expect((await read(<Probe />)).mode).toBe('tap');
  });

  it('reads the check mode inside the scope: always in every phase, so a Check never folds', async () => {
    for (const snapshot of [letters(), reading(), allPhase()]) {
      seed('auto', snapshot);
      expect((await read(<RomanizationCheckScope><Probe /></RomanizationCheckScope>)).mode).toBe('always');
      await cleanup();
    }
  });

  it('inactive, the scope changes nothing; nested inside an active one, it stays a Check', async () => {
    seed('auto', allPhase());
    expect((await read(<RomanizationCheckScope active={false}><Probe /></RomanizationCheckScope>)).mode).toBe('tap');
    await cleanup();
    expect(
      (
        await read(
          <RomanizationCheckScope>
            <RomanizationCheckScope active={false}>
              <Probe />
            </RomanizationCheckScope>
          </RomanizationCheckScope>,
        )
      ).mode,
    ).toBe('always');
  });

  it('an override above wins, in a Check too', async () => {
    seed('auto', allPhase());
    expect((await read(<RomanizationModeOverride mode="tap"><RomanizationCheckScope><Probe /></RomanizationCheckScope></RomanizationModeOverride>)).mode).toBe('tap');
    await cleanup();
    seed('tap', allPhase());
    expect((await read(<RomanizationModeOverride mode="always"><RomanizationCheckScope><Probe /></RomanizationCheckScope></RomanizationModeOverride>)).mode).toBe('always');
  });

  it('an explicit tap folds a Check, and an explicit always shows every surface, in any phase', async () => {
    seed('tap', letters());
    expect((await read(<RomanizationCheckScope><Probe /></RomanizationCheckScope>)).mode).toBe('tap');
    await cleanup();
    seed('always', allPhase());
    expect(await read(<Probe />)).toEqual({ mode: 'always', word: 'always', theme: 'always' });
  });

  it('forText follows the phase: in reading a word the learner can read folds and a theme word stays; in all both fold', async () => {
    seed('auto', reading());
    expect(await read(<Probe />)).toEqual({ mode: 'always', word: 'tap', theme: 'always' });
    await cleanup();
    seed('auto', allPhase());
    expect(await read(<Probe />)).toEqual({ mode: 'tap', word: 'tap', theme: 'tap' });
    await cleanup();
    seed('auto', letters());
    expect(await read(<Probe />)).toEqual({ mode: 'always', word: 'always', theme: 'always' });
  });

  it('progress not read yet (no snapshot) resolves as always', async () => {
    seed('auto', undefined);
    expect(await read(<Probe />)).toEqual({ mode: 'always', word: 'always', theme: 'always' });
  });

  it('the web flag "I use a screen reader" keeps auto on always, even after Word Builder', async () => {
    seed('auto', allPhase());
    useLocaleStore.setState({ screenReader: true });
    expect(await read(<Probe />)).toEqual({ mode: 'always', word: 'always', theme: 'always' });
  });

  it('moves with the stores: a choice changed in Profile, and a phase reached, re-render the reader', async () => {
    seed('auto', reading());
    const r = await render(<Probe />);
    const mode = (): string => textOf(byTestId(r.root, 'mode')[0]!);
    expect(mode()).toBe('always');
    await act(async () => {
      useProgressStore.setState({ byProfile: { [ID]: allPhase() } });
    });
    expect(mode()).toBe('tap');
    await act(async () => {
      useLocaleStore.getState().setRomanizationChoice(ID, 'always');
    });
    expect(mode()).toBe('always');
  });

  it('a progress write that leaves the phase as it is re-renders nothing', async () => {
    seed('auto', allPhase());
    await render(<Probe />);
    const before = renders;
    await act(async () => {
      useProgressStore.setState({ byProfile: { [ID]: { ...allPhase(), streakDays: 9 } } });
    });
    expect(renders).toBe(before);
  });

  it('a profile that is not on auto never reads progress, so a progress write re-renders nothing either', async () => {
    seed('always', allPhase());
    await render(<Probe />);
    const before = renders;
    await act(async () => {
      useProgressStore.setState({ byProfile: { [ID]: reading() } });
    });
    expect(renders).toBe(before);
  });
});

describe('the native screen reader: one holder, one platform subscription (section 3.13)', () => {
  it('keeps auto on always while the platform reader is on, and is told once however many readers mount', async () => {
    setPlatform('ios');
    seed('auto', allPhase());
    const before = sr.subscriptions;
    const r = await render(
      <>
        <Probe />
        <Probe />
      </>,
    );
    const modes = (): string[] => byTestId(r.root, 'mode').map((n) => textOf(n));
    expect(modes()).toEqual(['tap', 'tap']);
    expect(sr.subscriptions).toBe(before + 1);
    await act(async () => {
      for (const listener of sr.listeners) listener(true);
    });
    expect(modes()).toEqual(['always', 'always']);
    // a third reader joining the running holder subscribes to nothing more, and starts from what is known
    const second = await render(<Probe />);
    expect(sr.subscriptions).toBe(before + 1);
    expect(textOf(byTestId(second.root, 'mode')[0]!)).toBe('always');
    await act(async () => {
      for (const listener of sr.listeners) listener(false);
    });
    expect(modes()).toEqual(['tap', 'tap']);
  });

  it('a profile that is not on auto makes no platform call at all', async () => {
    setPlatform('ios');
    const before = sr.subscriptions;
    seed('always', allPhase());
    await render(<Probe />);
    await cleanup();
    seed(undefined, allPhase());
    await render(<Probe />);
    expect(sr.subscriptions).toBe(before);
  });

  it('the platform reader is read at the first reader, and forgotten when the last one leaves', async () => {
    setPlatform('ios');
    seed('auto', allPhase());
    sr.enabled = true;
    const first = await render(<Probe />);
    expect(textOf(byTestId(first.root, 'mode')[0]!)).toBe('always');
    await unmount(first);
    sr.enabled = false;
    const next = await render(<Probe />);
    expect(textOf(byTestId(next.root, 'mode')[0]!)).toBe('tap');
  });

  it('on the web the platform reader is not the signal: only the device flag is', async () => {
    seed('auto', allPhase());
    sr.enabled = true;
    const r = await render(<Probe />);
    expect(textOf(byTestId(r.root, 'mode')[0]!)).toBe('tap');
    await act(async () => {
      for (const listener of sr.listeners) listener(true);
    });
    expect(textOf(byTestId(r.root, 'mode')[0]!)).toBe('tap');
  });
});
