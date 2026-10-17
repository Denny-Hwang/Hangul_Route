import { Screen, ScreenHeaderSlotContext } from '@hangul-route/design-system';
import { getMessages } from '@hangul-route/i18n';
import { NavigationContext, NavigationRouteContext } from '@react-navigation/native';
import React from 'react';
import { Text } from 'react-native';
import { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeviceDisplaySheet } from '../../components/DeviceDisplaySheet';
import { LearnerScreenHeader } from '../../components/LearnerScreenHeader';
import { ROOT_HEADER, SCREEN_HEADER_EXCEPTIONS, SCREEN_HEADER_ROOTS, SCREEN_HEADER_VARIANTS, type ScreenHeaderRouteName } from '../../navigation/screen-header-variants';
import { useLocaleStore } from '../../store/locale-store';
import { buttonsNamed, hostNodes, press, render, resetPlatform, screenTexts, setPlatform, textOf } from '../../test-support/render';

/**
 * AMENDMENTS-DISPLAY-NAV section 7.1 (row DN-4): every route of the route table, drawn as a `Screen`
 * inside its route with the app's header slot, finds its way back by role and name (Back or Close,
 * the first control), and a root and the exception list find none. The visible Back runs
 * `navigation.goBack()` (so a screen's `beforeRemove` guard answers it, as the browser back does);
 * Back is drawn only when the navigator can go back; the Display (Aa) control opens the Display sheet.
 */
// The native navigation package has no build that loads in Node: the two contexts a route provides stand in for it.
vi.mock('@react-navigation/native', async () => {
  const { createContext } = await import('react');
  return { NavigationContext: createContext(undefined), NavigationRouteContext: createContext(undefined) };
});

const en = getMessages('en');
const BACK = en.common.buttons.back;
const CLOSE = en.common.buttons.close;
const AA = en.common.display.a11y;

interface FakeNavigation {
  canGoBack: () => boolean;
  goBack: ReturnType<typeof vi.fn>;
  addListener: (type: string, listener: () => void) => () => void;
}

function navigationFor(canGoBack: boolean): FakeNavigation {
  return { canGoBack: () => canGoBack, goBack: vi.fn(), addListener: () => () => undefined };
}

function inRoute(name: string, navigation: FakeNavigation, header?: React.ComponentProps<typeof Screen>['header']): React.ReactElement {
  return (
    <ScreenHeaderSlotContext.Provider value={LearnerScreenHeader}>
      <NavigationContext.Provider value={navigation as never}>
        <NavigationRouteContext.Provider value={{ key: `${name}-1`, name, params: undefined } as never}>
          <Screen header={header}>
            <Text>body</Text>
          </Screen>
        </NavigationRouteContext.Provider>
      </NavigationContext.Provider>
    </ScreenHeaderSlotContext.Provider>
  );
}

/** Every element a person can press, in document order (the leading control must come first). */
const controls = (root: Parameters<typeof hostNodes>[0]) => hostNodes(root, (n) => n.props.role === 'button');

const ROUTES = Object.keys(SCREEN_HEADER_VARIANTS) as ScreenHeaderRouteName[];
const ROOTS = new Set<string>(SCREEN_HEADER_ROOTS);
const EXCEPTIONS = new Set<string>(SCREEN_HEADER_EXCEPTIONS);

beforeEach(() => {
  setPlatform('web');
  useLocaleStore.setState({ device: 'en', byProfile: {} });
});

afterEach(() => resetPlatform());

describe('the header of every route (AMENDMENTS-DISPLAY-NAV section 7.1)', () => {
  for (const name of ROUTES) {
    const variant = SCREEN_HEADER_VARIANTS[name];
    if (ROOTS.has(name) || EXCEPTIONS.has(name)) continue;
    it(`${name}: ${variant === 'close' ? 'Close' : 'Back'} is the first control and goes back`, async () => {
      const navigation = navigationFor(true);
      const renderer = await render(inRoute(name, navigation));
      const label = variant === 'close' ? CLOSE : BACK;
      const leading = buttonsNamed(renderer.root, label);
      expect(leading).toHaveLength(1);
      expect(controls(renderer.root)[0]).toBe(leading[0]);
      // The visible word is the accessible name (WCAG 2.5.3).
      expect(screenTexts(leading[0]!).filter((t) => t === label).length).toBeGreaterThanOrEqual(1);
      expect(leading[0]!.props['aria-label']).toBe(label);
      await press(leading[0]!);
      expect(navigation.goBack).toHaveBeenCalledTimes(1);
      expect(buttonsNamed(renderer.root, AA)).toHaveLength(1);
    });
  }

  it('a root draws no header of its own accord, and with its root header only the Display control', async () => {
    for (const name of ROOTS) {
      const none = await render(inRoute(name, navigationFor(true)));
      expect(controls(none.root), name).toEqual([]);
      const row = await render(inRoute(name, navigationFor(true), ROOT_HEADER));
      expect(buttonsNamed(row.root, BACK), name).toEqual([]);
      expect(buttonsNamed(row.root, CLOSE), name).toEqual([]);
      expect(buttonsNamed(row.root, AA), name).toHaveLength(1);
    }
  });

  it('the exception list draws the header with no way back, even when the navigator could go back', async () => {
    for (const name of EXCEPTIONS) {
      const renderer = await render(inRoute(name, navigationFor(true)));
      expect(buttonsNamed(renderer.root, BACK), name).toEqual([]);
      expect(buttonsNamed(renderer.root, CLOSE), name).toEqual([]);
      expect(buttonsNamed(renderer.root, AA), name).toHaveLength(1);
    }
  });

  it('Back only where there is somewhere to go', async () => {
    const renderer = await render(inRoute('Profile', navigationFor(false)));
    expect(buttonsNamed(renderer.root, BACK)).toEqual([]);
    expect(buttonsNamed(renderer.root, AA)).toHaveLength(1);
  });

  it('a root with its own way out (All lessons home) names its Close and runs its own action', async () => {
    const leave = vi.fn();
    const navigation = navigationFor(false);
    const renderer = await render(inRoute('BrowseHome', navigation, { leading: { kind: 'close', label: 'Close', onPress: leave }, trailing: <Text>chip</Text> }));
    await press(buttonsNamed(renderer.root, CLOSE)[0]!);
    expect(leave).toHaveBeenCalledTimes(1);
    expect(navigation.goBack).not.toHaveBeenCalled();
    expect(textOf(renderer.root)).toContain('chip');
  });

  it('the Display (Aa) control opens the Display sheet; a clock hides it', async () => {
    const renderer = await render(inRoute('VocabTopic', navigationFor(true)));
    // The sheet is a native Modal (a portal on the web, not in the test tree): its `visible` prop says it opened.
    const sheet = (): { visible: boolean } => renderer.root.findByType(DeviceDisplaySheet).props as { visible: boolean };
    expect(sheet().visible).toBe(false);
    await press(buttonsNamed(renderer.root, AA)[0]!);
    expect(sheet().visible).toBe(true);
    await act(async () => {
      (renderer.root.findByType(DeviceDisplaySheet).props as { onClose: () => void }).onClose();
    });
    expect(sheet().visible).toBe(false);
    const clock = await render(inRoute('VocabSpeedRound', navigationFor(true), { displayHidden: true }));
    expect(buttonsNamed(clock.root, AA)).toEqual([]);
    expect(buttonsNamed(clock.root, CLOSE)).toHaveLength(1);
  });

  it('a screen title is the screen heading', async () => {
    const renderer = await render(inRoute('VocabTopic', navigationFor(true), { title: 'Food' }));
    const heading = hostNodes(renderer.root, (n) => n.props.role === 'heading' && textOf(n) === 'Food');
    expect(heading).toHaveLength(1);
  });

  it('a screen that draws its header in its own layout gets none from Screen, and draws it where it renders it', async () => {
    const renderer = await render(
      <ScreenHeaderSlotContext.Provider value={LearnerScreenHeader}>
        <NavigationContext.Provider value={navigationFor(true) as never}>
          <NavigationRouteContext.Provider value={{ key: 'PlacementItem-1', name: 'PlacementItem' } as never}>
            <Screen header={{ drawnByScreen: true }}>
              <LearnerScreenHeader options={{ displayHidden: true }} inLayout />
            </Screen>
          </NavigationRouteContext.Provider>
        </NavigationContext.Provider>
      </ScreenHeaderSlotContext.Provider>,
    );
    expect(buttonsNamed(renderer.root, CLOSE)).toHaveLength(1);
  });

  it('outside a route (a boot screen) nothing is drawn', async () => {
    const renderer = await render(
      <ScreenHeaderSlotContext.Provider value={LearnerScreenHeader}>
        <Screen>
          <Text>body</Text>
        </Screen>
      </ScreenHeaderSlotContext.Provider>,
    );
    expect(controls(renderer.root)).toEqual([]);
  });

  it('a stack change under the screen redraws its Back', async () => {
    let can = false;
    const listeners: (() => void)[] = [];
    const navigation = { canGoBack: () => can, goBack: vi.fn(), addListener: (_t: string, l: () => void) => (listeners.push(l), () => undefined) };
    const renderer = await render(inRoute('Profile', navigation as never));
    expect(buttonsNamed(renderer.root, BACK)).toEqual([]);
    can = true;
    await act(async () => {
      for (const listener of listeners) listener();
    });
    expect(buttonsNamed(renderer.root, BACK)).toHaveLength(1);
  });
});
