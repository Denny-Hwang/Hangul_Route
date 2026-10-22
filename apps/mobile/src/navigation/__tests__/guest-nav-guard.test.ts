import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { guardGuestNavigation, guestRootResetAllowed, guestStackMoveAllowed } from '../guest-nav-guard';

/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON section 7.1, CS-G1 (row GU-4 review): the guarded `navigation` the `Guest` stack
 * gives the save's two shared screens. Every route `CreateProfileScreen.tsx` and `PinEntryScreen.tsx` name is run
 * through the guard: those outside the stack never reach the navigation, so a later edit of either screen cannot open
 * an adult route from a guest run.
 */
const SRC = join(__dirname, '..', '..');
const read = (path: string): string => readFileSync(join(SRC, path), 'utf8');

const ROUTES = ['QuestPlayer', 'Minigame', 'Results', 'CardDetail', 'GuestLater', 'CreateProfile', 'PinEntry'] as const;
const SHARED = ['screens/onboarding/CreateProfileScreen.tsx', 'screens/parent/PinEntryScreen.tsx'];

/** The route names a source names: `navigate('X'`, `replace('X'`, `push('X'`, and `name: 'X'` in a reset. */
const targets = (source: string): string[] => [
  ...[...source.matchAll(/\.(?:navigate|replace|push)\(\s*'([A-Za-z0-9]+)'/g)].map((m) => m[1]!),
  ...[...source.matchAll(/name:\s*'([A-Z][A-Za-z0-9]+)'/g)].map((m) => m[1]!),
];

function doubles() {
  const root = { dispatch: vi.fn(), reset: vi.fn(), navigate: vi.fn(), getState: vi.fn(() => ({ index: 0, routes: [] })) };
  const nav = {
    navigate: vi.fn(),
    replace: vi.fn(),
    push: vi.fn(),
    reset: vi.fn(),
    dispatch: vi.fn(),
    goBack: vi.fn(),
    setOptions: vi.fn(),
    addListener: vi.fn(() => () => undefined),
    getState: vi.fn(() => ({ index: 0, routes: [] })),
    navigateDeprecated: vi.fn(),
    getParent: vi.fn(() => root),
  };
  const blocked: string[] = [];
  const guarded = guardGuestNavigation(nav, ROUTES, (what) => void blocked.push(what));
  return { nav, root, guarded, blocked };
}

describe('guestStackMoveAllowed and guestRootResetAllowed', () => {
  it('a route of the stack; PinEntry only as { next: SaveGuest }', () => {
    expect(guestStackMoveAllowed(ROUTES, 'CreateProfile', { firstRun: true, from: 'guest' })).toBe(true);
    expect(guestStackMoveAllowed(ROUTES, 'PinEntry', { next: 'SaveGuest' })).toBe(true);
    expect(guestStackMoveAllowed(ROUTES, 'PinEntry', { next: 'SaveGuest', mode: 'setup' })).toBe(false);
    expect(guestStackMoveAllowed(ROUTES, 'PinEntry', { next: 'ParentDashboard' })).toBe(false);
    expect(guestStackMoveAllowed(ROUTES, 'PinEntry', undefined)).toBe(false);
    expect(guestStackMoveAllowed(ROUTES, 'Paywall', {})).toBe(false);
    expect(guestStackMoveAllowed(ROUTES, undefined, undefined)).toBe(false);
  });

  it('the root takes only Home alone', () => {
    expect(guestRootResetAllowed({ index: 0, routes: [{ name: 'Main' }] })).toBe(true);
    expect(guestRootResetAllowed({ index: 1, routes: [{ name: 'Main' }, { name: 'JoinSpace' }] })).toBe(false);
    expect(guestRootResetAllowed({ index: 0, routes: [{ name: 'Main', params: { screen: 'Profile' } }] })).toBe(false);
    expect(guestRootResetAllowed({ index: 0, routes: [{ name: 'ParentDashboard' }] })).toBe(false);
    expect(guestRootResetAllowed(null)).toBe(false);
  });
});

describe('guardGuestNavigation (CS-G1)', () => {
  it('every route the two shared screens name outside the stack is dropped; the stack\'s own pass', () => {
    const names = [...new Set(SHARED.flatMap((file) => targets(read(file))))];
    // The screens name many adult routes (Paywall, the Grown-up area, Join a class, the level check, ...).
    expect(names.length).toBeGreaterThan(15);
    for (const name of names) {
      const { nav, guarded, blocked } = doubles();
      guarded.navigate(name, {});
      guarded.replace(name, {});
      guarded.push(name, {});
      guarded.navigate({ name, params: {} });
      const inStack = (ROUTES as readonly string[]).includes(name) && name !== 'PinEntry';
      expect(nav.navigate.mock.calls.length + nav.replace.mock.calls.length + nav.push.mock.calls.length, name).toBe(inStack ? 4 : 0);
      if (!inStack) expect(blocked, name).toHaveLength(4);
    }
  });

  it('the stack\'s reset and dispatch are dropped; reads, options, listeners and Back pass', () => {
    const { nav, guarded, blocked } = doubles();
    guarded.reset({ index: 0, routes: [{ name: 'Paywall' }] });
    guarded.dispatch({ type: 'NAVIGATE', payload: { name: 'Paywall' } });
    guarded.navigateDeprecated('Paywall');
    expect(nav.reset).not.toHaveBeenCalled();
    expect(nav.dispatch).not.toHaveBeenCalled();
    expect(nav.navigateDeprecated).not.toHaveBeenCalled();
    expect(blocked).toEqual(['reset', 'dispatch', 'navigateDeprecated']);
    guarded.goBack();
    guarded.setOptions({ gestureEnabled: false });
    (guarded.addListener as (...args: unknown[]) => unknown)('beforeRemove', () => undefined);
    guarded.getState();
    expect(nav.goBack).toHaveBeenCalledTimes(1);
    expect(nav.setOptions).toHaveBeenCalledTimes(1);
    expect(nav.addListener).toHaveBeenCalledTimes(1);
    expect(nav.getState).toHaveBeenCalledTimes(1);
  });

  it('the root takes the reset to Home of the saved learner, and nothing else', () => {
    const { root, guarded, blocked } = doubles();
    const parent = guarded.getParent();
    parent.dispatch({ type: 'RESET', payload: { index: 0, routes: [{ name: 'Main' }] } });
    expect(root.dispatch).toHaveBeenCalledTimes(1);
    parent.dispatch({ type: 'RESET', payload: { index: 1, routes: [{ name: 'Main' }, { name: 'JoinSpace' }] } });
    parent.dispatch({ type: 'NAVIGATE', payload: { name: 'ParentDashboard' } });
    parent.reset({ index: 1, routes: [{ name: 'Main' }, { name: 'JoinSpace' }] });
    parent.navigate('Paywall');
    expect(root.dispatch).toHaveBeenCalledTimes(1);
    expect(root.reset).not.toHaveBeenCalled();
    expect(root.navigate).not.toHaveBeenCalled();
    expect(blocked).toEqual(['root.dispatch', 'root.dispatch', 'root.reset', 'root.navigate']);
    parent.reset({ index: 0, routes: [{ name: 'Main' }] });
    expect(root.reset).toHaveBeenCalledTimes(1);
  });

  it('the Guest stack hands both shared screens the guarded navigation; neither reads useNavigation()', () => {
    const chunk = read('navigation/guest-chunk.tsx');
    expect(chunk).toContain('guardGuestNavigation(navigation, GUEST_STACK_ROUTES)');
    expect(chunk).toMatch(/function GuestCreateProfileRoute\(\{ route, navigation \}[^)]*\)[^{]*\{\s*const guarded = useGuardedNavigation\(navigation\);[\s\S]*?navigation=\{guarded as never\}/);
    expect(chunk).toMatch(/function GuestPinEntryRoute\(\{ route, navigation \}[^)]*\)[^{]*\{\s*const guarded = useGuardedNavigation\(navigation\);[\s\S]*?navigation=\{guarded as never\}/);
    expect(chunk).not.toMatch(/shared<'(CreateProfile|PinEntry)'/);
    for (const file of SHARED) expect(read(file), file).not.toMatch(/useNavigation\b/);
    // The one hand-off out of the app on the guest's form: the Privacy Policy link (a page, never a route).
    const form = read('screens/onboarding/CreateProfileScreen.tsx');
    expect([...form.matchAll(/Linking\.\w+\([^)]*\)/g)].map((m) => m[0])).toEqual(['Linking.openURL(privacyUrl()']);
  });
});
