import type { Profile } from '@hangul-route/content-schema';
import { Screen, TAB_SCREEN_EDGES } from '@hangul-route/design-system';
import { getMessages } from '@hangul-route/i18n';
import type { ComponentType } from 'react';
import { act, type ReactTestInstance } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * [DP] AMENDMENTS-DURABLE-PROGRESS owner decision OD-DP6 (row DP-1e): a learner whose progress could not be read gets
 * the learner variant of the read-failed screen on every learner tab (Home, Route, Journey, Library), never an empty
 * record that looks like lost progress. Each tab is rendered as the tab navigator registers it (`SCREENS`,
 * `navigation/tabs.tsx`); the tab screens themselves are stand-ins that count their mounts, so a held tab is seen never
 * to mount its own screen.
 */
vi.mock('../../../platform/telemetry', () => ({ track: vi.fn(async () => true) }));
const reader = vi.hoisted(() => ({ focus: vi.fn(), announce: vi.fn() }));
vi.mock('../../../platform/screen-reader', () => ({ announceForScreenReader: reader.announce, focusForScreenReader: reader.focus }));
const memory = vi.hoisted(() => ({ activate: vi.fn() }));
vi.mock('../../../logic/memory/boot', () => ({ activateMemory: memory.activate }));
const nav = vi.hoisted(() => ({ navigate: vi.fn(), focused: true }));
vi.mock('@react-navigation/native', () => ({
  Link: () => null,
  useNavigation: () => ({ navigate: nav.navigate }),
  useIsFocused: () => nav.focused,
}));
// The navigator itself is not rendered here (its native package does not load in this project): only its screens.
vi.mock('@react-navigation/bottom-tabs', () => ({ createBottomTabNavigator: () => ({ Navigator: () => null, Screen: () => null }) }));
const mounts = vi.hoisted(() => ({ Home: 0, Route: 0, Journey: 0, Library: 0 }));
vi.mock('../../home/HomeScreen', async () => {
  const { Text: T } = await import('react-native');
  return {
    HomeScreen: () => {
      mounts.Home += 1;
      return <T>Home body</T>;
    },
  };
});
vi.mock('../../my-route/MyRouteScreen', async () => {
  const { Text: T } = await import('react-native');
  return {
    MyRouteTabScreen: () => {
      mounts.Route += 1;
      return <T>Route body</T>;
    },
  };
});
vi.mock('../../journey/JourneyScreen', async () => {
  const { Text: T } = await import('react-native');
  return {
    JourneyScreen: () => {
      mounts.Journey += 1;
      return <T>Journey body</T>;
    },
  };
});
vi.mock('../../library/LibraryScreen', async () => {
  const { Text: T } = await import('react-native');
  return {
    LibraryScreen: () => {
      mounts.Library += 1;
      return <T>Library body</T>;
    },
  };
});

import { flags } from '../../../config/flags';
import { mainTabs, type MainTabName } from '../../../logic/my-route/tab';
import { SCREENS } from '../../../navigation/tabs';
import { useProfileStore } from '../../../store/profile-store';
import { useProgressStore } from '../../../store/progress-store';
import { buttonsNamed, cleanup, press, render, resetPlatform, screenTexts, setPlatform } from '../../../test-support/render';
import { resetReadFailedTriesForTests } from '../ProgressReadFailedScreen';

const m = getMessages('en').learner.progressReadFailed;
const learner = (id: string): Profile => ({ id, displayName: id, ageGroup: '8-9', avatar: 'hoya-orange', role: 'learner', createdAt: 't' });
const chooserFlag = flags.whoChooserEnabled;
const realHydrate = useProgressStore.getState().hydrate;
const TABS: readonly MainTabName[] = mainTabs(true);

const tab = (name: MainTabName) => {
  const Tab = SCREENS[name] as ComponentType;
  return <Tab />;
};
const body = (name: MainTabName): string => `${name} body`;

beforeEach(() => {
  resetReadFailedTriesForTests();
  for (const name of TABS) mounts[name] = 0;
  nav.navigate.mockClear();
  nav.focused = true;
  reader.focus.mockClear();
  memory.activate.mockClear();
  flags.whoChooserEnabled = true;
  useProfileStore.setState({ profiles: [learner('p:a'), learner('p:b')], activeId: 'p:a', hydrated: true, loadFailed: null });
  useProgressStore.setState({ loadFailedFor: new Set(), hydratedFor: new Set(['p:a', 'p:b']), hydrate: realHydrate });
});

afterEach(async () => {
  await cleanup();
  resetPlatform();
  flags.whoChooserEnabled = chooserFlag;
  useProgressStore.setState({ hydrate: realHydrate });
});

describe('[DP] OD-DP6: every learner tab holds a learner whose progress could not be read', () => {
  it('the tab bar has the four learner tabs this test covers', () => {
    expect([...TABS].sort()).toEqual(['Home', 'Journey', 'Library', 'Route']);
    expect(Object.keys(SCREENS).sort()).toEqual([...TABS].sort());
  });

  describe.each(TABS)('the %s tab', (name) => {
    it('a learner who was read: the tab as always', async () => {
      const r = await render(tab(name));
      expect(screenTexts(r.root)).toContain(body(name));
      expect(screenTexts(r.root)).not.toContain(m.title);
    });

    it('a held learner: the learner variant on tab edges, and the tab never mounts its own screen', async () => {
      useProgressStore.setState({ loadFailedFor: new Set(['p:a']), hydratedFor: new Set(['p:b']) });
      const r = await render(tab(name));
      const texts = screenTexts(r.root);
      expect(texts).toContain(m.title);
      expect(texts).toContain(m.tryAgain);
      expect(texts).not.toContain(body(name));
      expect(mounts[name]).toBe(0);
      expect(r.root.findByType(Screen).props.edges).toEqual(TAB_SCREEN_EDGES);
      // Choose another learner (2 learners) opens the manual chooser.
      await press(buttonsNamed(r.root, m.chooseAnother)[0] as ReactTestInstance);
      expect(nav.navigate).toHaveBeenCalledWith('WhoIsUsing', { trigger: 'manual' });
    });

    it('a learner chosen while the tab shows is held at once; Try again that reads brings the tab back', async () => {
      useProgressStore.setState({ loadFailedFor: new Set(['p:b']), hydratedFor: new Set(['p:a']) });
      const r = await render(tab(name));
      expect(screenTexts(r.root)).toContain(body(name));
      await act(async () => {
        useProfileStore.setState({ activeId: 'p:b' });
      });
      expect(screenTexts(r.root)).toContain(m.title);
      expect(screenTexts(r.root)).not.toContain(body(name));

      const hydrate = vi.fn(async (id: string) => {
        useProgressStore.setState((s) => ({ loadFailedFor: new Set(), hydratedFor: new Set([...s.hydratedFor, id]) }));
      });
      useProgressStore.setState({ hydrate });
      await press(buttonsNamed(r.root, m.tryAgain)[0] as ReactTestInstance);
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 700));
      });
      expect(hydrate).toHaveBeenCalledWith('p:b');
      expect(screenTexts(r.root)).toContain(body(name));
      expect(memory.activate).toHaveBeenCalledWith('p:b');
    });
  });

  it('one learner on the device: no Choose another learner on any tab', async () => {
    useProfileStore.setState({ profiles: [learner('p:a')] });
    useProgressStore.setState({ loadFailedFor: new Set(['p:a']), hydratedFor: new Set() });
    for (const name of TABS) {
      const r = await render(tab(name));
      expect(screenTexts(r.root)).toContain(m.title);
      expect(screenTexts(r.root)).not.toContain(m.chooseAnother);
      await cleanup();
    }
  });

  it('web: a tab that is not in front draws nothing (it is frozen); in front, it holds the learner and its title takes the focus once', async () => {
    nav.focused = false;
    useProgressStore.setState({ loadFailedFor: new Set(['p:a']), hydratedFor: new Set(['p:b']) });
    const r = await render(tab('Journey'));
    expect(screenTexts(r.root)).not.toContain(m.title);
    expect(reader.focus).not.toHaveBeenCalled();
    nav.focused = true;
    await act(async () => {
      r.update(tab('Journey'));
    });
    expect(screenTexts(r.root)).toContain(m.title);
    expect(mounts.Journey).toBe(0);
    expect(reader.focus).toHaveBeenCalledTimes(1);
  });

  it('native: a tab that is not in front holds the learner but leaves the screen reader where it is; it moves to the title once the tab is in front', async () => {
    setPlatform('ios');
    nav.focused = false;
    useProgressStore.setState({ loadFailedFor: new Set(['p:a']), hydratedFor: new Set(['p:b']) });
    const r = await render(tab('Library'));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(screenTexts(r.root)).toContain(m.title);
    expect(reader.focus).not.toHaveBeenCalled();

    nav.focused = true;
    await act(async () => {
      r.update(tab('Library'));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(reader.focus).toHaveBeenCalledTimes(1);
    // Once: later renders in front do not move it again.
    await act(async () => {
      r.update(tab('Library'));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(reader.focus).toHaveBeenCalledTimes(1);
  });
});
