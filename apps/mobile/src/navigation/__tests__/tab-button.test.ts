import * as ReactModule from 'react';
import type { ReactElement } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { TAP_LOCK_MS } from '@hangul-route/design-system/tap-model';
import { colors, spacing } from '@hangul-route/design-system/tokens';
import { tabBarMetrics } from '@hangul-route/design-system/layout';
import { WCAG_AA_LARGE, contrastRatio } from '../../../../../packages/design-system/src/contrast';
import { GuardedTabButton, TAB_SELECTED_MARK, TAB_SELECTED_MARK_TEST_ID } from '../tab-button';

/**
 * The learner tab button (AMENDMENTS-TOUCH 6.9, row KT-9), checked on the element tree built by calling it directly with
 * the hosts replaced by plain tags: a bounce switches once, the app-level tap lock is read and set, and on the web a
 * plain click always prevents the link's own navigation, so a dropped bounce never reloads the page.
 */
const platform = vi.hoisted(() => ({ OS: 'web' }));
vi.mock('react-native', () => ({ Pressable: 'Pressable', View: 'View', Text: 'Text', Platform: platform }));
vi.mock('@react-navigation/native', () => ({ Link: 'Link' }));
const app = vi.hoisted(() => ({ clock: null as null | { until: () => number; lock: (ms: number) => void } }));
vi.mock('@hangul-route/design-system', async () => {
  const { usePressGuard } = await import('../../../../../packages/design-system/src/components/TapBoard/use-press-guard');
  const { borderWidth, colors, radii, spacing } = await import('../../../../../packages/design-system/src/tokens');
  const { tabBarMetrics } = await import('../../../../../packages/design-system/src/layout');
  return { usePressGuard, NO_PRESS_DELAY: { delayPressIn: 0, unstable_pressDelay: 0 }, borderWidth, colors, radii, spacing, tabBarMetrics };
});
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  const useRef = <T,>(v: T): { current: T } => ({ current: v });
  const useCallback = <T,>(fn: T): T => fn;
  const useContext = (): unknown => app.clock;
  const hooks = { useRef, useCallback, useContext };
  return { ...actual, ...hooks, default: { ...actual, ...hooks } };
});

type El = ReactElement<Record<string, unknown>>;
type Click = { button?: number; metaKey?: boolean; preventDefault: () => void };

/** The host elements among a button's children (the navigator's own children are `null` here). */
function kids(el: El): El[] {
  const out: El[] = [];
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) node.forEach(walk);
    else if (node !== null && typeof node === 'object' && 'props' in node) out.push(node as El);
  };
  walk(el.props.children);
  return out;
}

const marks = (el: El): El[] => kids(el).filter((k) => k.props.testID === TAB_SELECTED_MARK_TEST_ID);

function tab(onPress: (e: unknown) => void, to?: string, selected?: boolean): El {
  const state = selected === undefined ? {} : { accessibilityState: { selected } };
  return GuardedTabButton({ children: null, onPress, to, accessibilityRole: 'tab', ...state } as never) as El;
}

describe('GuardedTabButton (AMENDMENTS-TOUCH 6.9, row KT-9)', () => {
  // This (node) project compiles JSX with the classic runtime, which reads a global React.
  beforeAll(() => {
    (globalThis as { React?: unknown }).React = ReactModule;
  });

  afterEach(() => {
    app.clock = null;
    platform.OS = 'web';
    vi.useRealTimers();
  });

  it('web: the tab is the navigator link; a bounce switches once but both clicks keep the browser from navigating', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const onPress = vi.fn();
    const el = tab(onPress, '/library');
    expect(el.type).toBe('Link');
    expect(el.props.to).toBe('/library');
    const click = el.props.onPress as (e: Click) => void;
    const first = { button: 0, preventDefault: vi.fn() };
    const bounce = { button: 0, preventDefault: vi.fn() };
    click(first);
    vi.setSystemTime(1_150);
    click(bounce);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(first.preventDefault).toHaveBeenCalled();
    expect(bounce.preventDefault).toHaveBeenCalled();
  });

  // [AU] AMENDMENTS-AUDIT-2026-11 AU-17c (audit A11Y-3): the navigator's `tablist` owns tabs, not links.
  it('web: the link takes the tab role (after the link props, so it wins over the link role) and says which tab is selected', () => {
    const on = tab(vi.fn(), '/library', true);
    expect(on.type).toBe('Link');
    expect(on.props.to).toBe('/library');
    expect(on.props.accessibilityRole).toBe('tab');
    expect(on.props['aria-selected']).toBe(true);
    const off = tab(vi.fn(), '/home', false);
    expect(off.props.accessibilityRole).toBe('tab');
    expect(off.props['aria-selected']).toBe(false);
    expect(tab(vi.fn(), '/home').props['aria-selected']).toBe(false);
  });

  it('native: the tab keeps the role the navigator gives it (a button on iOS, a tab on Android)', () => {
    platform.OS = 'ios';
    const el = GuardedTabButton({ children: null, onPress: vi.fn(), accessibilityRole: 'button', accessibilityState: { selected: true } } as never) as El;
    expect(el.type).toBe('Pressable');
    expect(el.props.accessibilityRole).toBe('button');
    expect(el.props.accessibilityState).toEqual({ selected: true });
  });

  it('web: a modified click is left to the browser (a new tab) and switches nothing', () => {
    const onPress = vi.fn();
    const click = tab(onPress, '/home').props.onPress as (e: Click) => void;
    const modified = { button: 0, metaKey: true, preventDefault: vi.fn() };
    click(modified);
    expect(onPress).not.toHaveBeenCalled();
    expect(modified.preventDefault).not.toHaveBeenCalled();
  });

  it('native: a Pressable with no press delay; a tap during the app lock is dropped and a switch sets the lock', () => {
    platform.OS = 'ios';
    vi.useFakeTimers();
    vi.setSystemTime(2_000);
    let until = 2_200;
    const lock = vi.fn((ms: number) => {
      until = Date.now() + ms;
    });
    app.clock = { until: () => until, lock };
    const onPress = vi.fn();
    const el = tab(onPress);
    expect(el.type).toBe('Pressable');
    expect(el.props.delayPressIn).toBe(0);
    expect(el.props.accessibilityRole).toBe('tab');
    const press = el.props.onPress as () => void;
    press();
    expect(onPress).not.toHaveBeenCalled();
    vi.setSystemTime(2_200);
    press();
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(lock).toHaveBeenCalledWith(TAP_LOCK_MS);
  });

  // AMENDMENTS-FINISH-2026-11 FN-8 (audit A11Y-5): the selected tab carries a shape mark, not only its tint.
  describe('the selected mark (FN-8)', () => {
    it('web: only the selected tab draws the mark; its accessible state is unchanged', () => {
      const on = tab(vi.fn(), '/library', true);
      const off = tab(vi.fn(), '/home', false);
      expect(marks(on)).toHaveLength(1);
      expect(marks(off)).toHaveLength(0);
      expect(marks(tab(vi.fn(), '/home'))).toHaveLength(0);
      expect(on.props.accessibilityRole).toBe('tab');
      expect(on.props['aria-selected']).toBe(true);
      expect(off.props['aria-selected']).toBe(false);
    });

    it('native: only the selected tab draws the mark; role and accessibilityState pass through as before', () => {
      platform.OS = 'android';
      const on = GuardedTabButton({ children: null, onPress: vi.fn(), accessibilityRole: 'tab', accessibilityState: { selected: true } } as never) as El;
      const off = GuardedTabButton({ children: null, onPress: vi.fn(), accessibilityRole: 'tab', accessibilityState: { selected: false } } as never) as El;
      expect(on.type).toBe('Pressable');
      expect(marks(on)).toHaveLength(1);
      expect(marks(off)).toHaveLength(0);
      expect(on.props.accessibilityState).toEqual({ selected: true });
      expect(off.props.accessibilityState).toEqual({ selected: false });
      expect(on.props.accessibilityRole).toBe('tab');
    });

    it('the mark is not a control and is not read: no taps, hidden from screen readers on every platform', () => {
      const [mark] = marks(tab(vi.fn(), '/library', true));
      expect(mark!.type).toBe('View');
      expect(mark!.props.pointerEvents).toBe('none');
      expect(mark!.props['aria-hidden']).toBe(true);
      expect(mark!.props.accessibilityElementsHidden).toBe(true);
      expect(mark!.props.importantForAccessibility).toBe('no-hide-descendants');
      expect(mark!.props.style).toBe(TAB_SELECTED_MARK);
    });

    it('the mark sits in the bar top padding, centred, the same at every text size (no font-relative value)', () => {
      expect(TAB_SELECTED_MARK.position).toBe('absolute');
      expect(TAB_SELECTED_MARK.top).toBe(-tabBarMetrics(0).paddingTop);
      expect(TAB_SELECTED_MARK.height).toBe(tabBarMetrics(0).paddingTop);
      expect(TAB_SELECTED_MARK.width).toBe(spacing.xxl);
      expect(TAB_SELECTED_MARK.left).toBe('50%');
      expect(TAB_SELECTED_MARK.marginLeft).toBe(-spacing.xxl / 2);
    });

    it('the mark is a filled border in the selected tint, at least 3:1 on the bar (WCAG 1.4.11)', () => {
      expect(TAB_SELECTED_MARK.borderColor).toBe(colors.brand.primary);
      expect(TAB_SELECTED_MARK.backgroundColor).toBe(TAB_SELECTED_MARK.borderColor);
      // A border of half the height on each side fills the mark, so forced colours (which drop fills) still draw it whole.
      expect(TAB_SELECTED_MARK.borderWidth * 2).toBe(TAB_SELECTED_MARK.height);
      expect(contrastRatio(TAB_SELECTED_MARK.borderColor, colors.surface.paper)).toBeGreaterThanOrEqual(WCAG_AA_LARGE);
    });
  });
});
