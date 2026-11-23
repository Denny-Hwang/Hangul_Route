import type { Profile } from '@hangul-route/content-schema';
import { Screen } from '@hangul-route/design-system';
import { getMessages } from '@hangul-route/i18n';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Text } from 'react-native';
import { act, type ReactTestInstance } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../platform/telemetry', () => ({ track: vi.fn(async () => true) }));
vi.mock('../../../platform/screen-reader', () => ({ announceForScreenReader: vi.fn(), focusForScreenReader: vi.fn() }));
const memory = vi.hoisted(() => ({ activate: vi.fn() }));
vi.mock('../../../logic/memory/boot', () => ({ activateMemory: memory.activate }));

import { flags } from '../../../config/flags';
import { useProfileStore } from '../../../store/profile-store';
import { useProgressStore } from '../../../store/progress-store';
import { buttonsNamed, press, render, screenTexts } from '../../../test-support/render';
import { LearnerReadFailedScreen, useLearnerReadHeld } from '../LearnerReadGate';
import { resetReadFailedTriesForTests } from '../ProgressReadFailedScreen';

/**
 * [DP] AMENDMENTS-DURABLE-PROGRESS section 3.4 (row DP-1c; test 12 of section 6, the learner chosen after boot): the
 * chooser marks nothing; a learner whose progress could not be read gets the learner variant on their Home, with Try
 * again (that one hydrate) and Choose another learner (2 learner profiles only).
 */
const m = getMessages('en').learner.progressReadFailed;
const HOME = 'Home body';
const learner = (id: string): Profile => ({ id, displayName: id, ageGroup: '8-9', avatar: 'hoya-orange', role: 'learner', createdAt: 't' });
const chooserFlag = flags.whoChooserEnabled;
const realHydrate = useProgressStore.getState().hydrate;
const homeMounted = vi.fn();

function HomeBody() {
  homeMounted();
  return <Text>{HOME}</Text>;
}

/** Home as HomeScreen draws it: the held learner's screen, or the body. */
function HomeStandIn({ choose }: { choose: () => void }) {
  const held = useLearnerReadHeld();
  if (held !== null) return <LearnerReadFailedScreen key={held} profileId={held} onChooseAnother={choose} edges={['top', 'left', 'right']} />;
  return <HomeBody />;
}
const gate = (choose = vi.fn()) => <HomeStandIn choose={choose} />;

beforeEach(() => {
  resetReadFailedTriesForTests();
  homeMounted.mockClear();
  flags.whoChooserEnabled = true;
  useProfileStore.setState({ profiles: [learner('p:a'), learner('p:b')], activeId: 'p:a', hydrated: true, loadFailed: null });
  useProgressStore.setState({ loadFailedFor: new Set(), hydratedFor: new Set(['p:a', 'p:b']), hydrate: realHydrate });
});

afterEach(() => {
  flags.whoChooserEnabled = chooserFlag;
  useProgressStore.setState({ hydrate: realHydrate });
});

describe('LearnerReadGate (Home)', () => {
  it('a learner who was read: Home as always', async () => {
    const r = await render(gate());
    expect(screenTexts(r.root)).toContain(HOME);
    expect(screenTexts(r.root)).not.toContain(m.title);
  });

  it('a learner chosen whose progress could not be read: the learner variant, and Home body never mounts', async () => {
    useProgressStore.setState({ loadFailedFor: new Set(['p:b']), hydratedFor: new Set(['p:a']) });
    const r = await render(gate());
    expect(screenTexts(r.root)).toContain(HOME);
    homeMounted.mockClear();
    await act(async () => {
      useProfileStore.setState({ activeId: 'p:b' });
    });
    expect(screenTexts(r.root)).toContain(m.title);
    expect(screenTexts(r.root)).not.toContain(HOME);
    expect(homeMounted).not.toHaveBeenCalled();
    // The tab screen's edges reach the Screen.
    expect(r.root.findByType(Screen).props.edges).toEqual(['top', 'left', 'right']);
  });

  it('Try again reruns that learner hydrate; when it reads, Home shows', async () => {
    useProgressStore.setState({ loadFailedFor: new Set(['p:a']), hydratedFor: new Set(['p:b']) });
    const hydrate = vi.fn(async (id: string) => {
      useProgressStore.setState((s) => ({ loadFailedFor: new Set(), hydratedFor: new Set([...s.hydratedFor, id]) }));
    });
    useProgressStore.setState({ hydrate });
    const r = await render(gate());
    await press(buttonsNamed(r.root, m.tryAgain)[0] as ReactTestInstance);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 700));
    });
    expect(hydrate).toHaveBeenCalledWith('p:a');
    expect(hydrate).toHaveBeenCalledTimes(1);
    expect(screenTexts(r.root)).toContain(HOME);
    expect(memory.activate).toHaveBeenCalledWith('p:a');
  });

  it('Choose another learner opens the chooser with 2 learners; it goes when only 1 is left', async () => {
    useProgressStore.setState({ loadFailedFor: new Set(['p:a']), hydratedFor: new Set(['p:b']) });
    const choose = vi.fn();
    const r = await render(gate(choose));
    await press(buttonsNamed(r.root, m.chooseAnother)[0] as ReactTestInstance);
    expect(choose).toHaveBeenCalledTimes(1);
    await act(async () => {
      useProfileStore.setState({ profiles: [learner('p:a')] });
    });
    expect(screenTexts(r.root)).not.toContain(m.chooseAnother);
  });

  it('a Try again that fails activates nothing', async () => {
    memory.activate.mockClear();
    useProgressStore.setState({ loadFailedFor: new Set(['p:a']), hydratedFor: new Set(['p:b']), hydrate: vi.fn(async () => undefined) });
    const r = await render(gate());
    await press(buttonsNamed(r.root, m.tryAgain)[0] as ReactTestInstance);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 700));
    });
    expect(screenTexts(r.root)).toContain(m.title);
    expect(memory.activate).not.toHaveBeenCalled();
  });
});

/**
 * [DP] Row DP-1e (OD-DP6): Home is held by the same gate as every learner tab (rendered per tab in
 * `learner-tabs-held.test.tsx`); it keeps no gate of its own.
 */
describe('Home holds a learner who was not read through the tab gate', () => {
  it('the tab navigator registers Home (and every tab) through learnerReadGated; HomeScreen has no gate of its own', () => {
    const tabs = readFileSync(join(__dirname, '../../../navigation/tabs.tsx'), 'utf8');
    for (const screen of ['HomeScreen', 'MyRouteTabScreen', 'JourneyScreen', 'LibraryScreen']) {
      expect(tabs).toContain(`frozenWhenBlurred(learnerReadGated(${screen}))`);
    }
    const home = readFileSync(join(__dirname, '../../home/HomeScreen.tsx'), 'utf8');
    expect(home).not.toMatch(/useLearnerReadHeld|LearnerReadFailedScreen/);
  });
});
