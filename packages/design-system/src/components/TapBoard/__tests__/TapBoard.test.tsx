import { Children, isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TAP_LOCK_MS } from '../../../tap-model';
import { TapBoardContext, type TapBoardContextValue } from '../context';
import type { TapScrollerLike } from '../controller';
import { TapScrollerContext } from '../scroller';
import { TapBoard } from '../TapBoard';
import { TapControl } from '../TapControl';
import { TapLockContext, type TapLockClock } from '../TapLockProvider';
import { TapScroller } from '../TapScroller';
import { TapTarget } from '../TapTarget';
import type { TapBoardProps, TapTargetProps } from '../types';
import { usePressGuard } from '../use-press-guard';
import { useTapLock } from '../use-tap-lock';

/**
 * `TapBoard`, `TapTarget`, `TapControl`, `TapScroller` and the hooks (docs/specs/AMENDMENTS-TOUCH.md section 4;
 * design/components/TapBoard/spec.md), checked on the element tree built by calling the components directly with
 * react-native's hosts as plain tags (as Button.test.tsx does). The responder rules are in controller.test.ts; here:
 * the web `touch-action` on the board (from its scroller) and on every target, the responder wired on the board's
 * View, the context a target and a control read, the board's registration with its Screen, the scroller and native
 * re-measuring, a target's role, label, state and click path, the guard outside a board, and the lock hooks.
 */
const platform = vi.hoisted(() => ({ OS: 'web' }));
const screen = vi.hoisted(() => ({ fits: false, boards: 0 }));
const ctx = vi.hoisted(() => ({ board: null as unknown, app: null as unknown, scroller: null as unknown, values: new Map<unknown, unknown>() }));
const hooks = vi.hoisted(() => ({ store: [] as unknown[], at: 0, effects: [] as Array<() => void | (() => void)> }));
vi.mock('react-native', () => ({ Platform: platform, View: 'View', Pressable: 'Pressable' }));
vi.mock('../../Screen/fit', () => ({
  useScreenFit: () => ({
    fits: screen.fits,
    registerBoard: registerBoardStub,
  }),
}));
const registerBoardStub = vi.hoisted(() => () => {
  screen.boards += 1;
  return () => {
    screen.boards -= 1;
  };
});
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  const slot = <T,>(init: () => T): { value: T } => {
    const at = hooks.at++;
    if (hooks.store.length <= at) hooks.store.push({ value: init() });
    return hooks.store[at] as { value: T };
  };
  const stubs = {
    useContext: (context: unknown): unknown => ctx.values.get(context) ?? null,
    useState: <T,>(initial: T) => {
      const s = slot(() => initial);
      return [s.value, (v: T) => (s.value = v)] as const;
    },
    useRef: <T,>(initial: T) => slot(() => ({ current: initial })).value,
    useCallback: <T,>(fn: T): T => fn,
    useMemo: <T,>(fn: () => T): T => fn(),
    useEffect: (fn: () => void | (() => void)) => {
      hooks.effects.push(fn);
    },
    useId: (): string => ':t1:',
  };
  return { ...actual, ...stubs, default: { ...actual, ...stubs } };
});

type El = ReactElement<Record<string, unknown>>;

function renderBoard(props: Partial<TapBoardProps> = {}): { provider: El; view: El } {
  syncContexts();
  hooks.at = 0;
  const provider = TapBoard({ lock: 'board', children: <span>kids</span>, ...props }) as El;
  const view = Children.only(provider.props.children as ReactNode) as El;
  return { provider, view };
}

function renderTarget(props: Partial<TapTargetProps> = {}): El {
  syncContexts();
  hooks.at = 0;
  return TapTarget({ onCommit: () => undefined, accessibilityLabel: 'ㄱ giyeok', children: ({ pressed }) => <span>{pressed ? 'pressed' : 'idle'}</span>, ...props }) as El;
}

const textOf = (node: ReactNode): string => (isValidElement(node) ? String((node as El).props.children) : '');
const refOf = (el: El): ((v: unknown) => void) => (el as unknown as { ref: (v: unknown) => void }).ref;
const runEffects = (): Array<() => void> => hooks.effects.splice(0).map((fn) => fn()).filter((c): c is () => void => typeof c === 'function');

function fakeScroller(canScroll: boolean, axis: 'x' | 'y' = 'y'): TapScrollerLike & { listeners: Set<(o: number) => void> } {
  const listeners = new Set<(o: number) => void>();
  return {
    axis,
    canScroll,
    listeners,
    scrollBy: (d) => d,
    onScroll: (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
}

/** The contexts the components read, by the test file's own imports (the mock factory cannot import them). */
function syncContexts(): void {
  ctx.values = new Map<unknown, unknown>([
    [TapBoardContext, ctx.board],
    [TapLockContext, ctx.app],
    [TapScrollerContext, ctx.scroller],
  ]);
}

beforeEach(() => {
  hooks.store = [];
  hooks.effects = [];
  platform.OS = 'web';
  screen.fits = false;
  screen.boards = 0;
  ctx.board = null;
  ctx.app = null;
  ctx.scroller = null;
  (globalThis as { CSS?: unknown }).CSS = { supports: (p: string, v: string) => p === 'touch-action' && v === 'pinch-zoom' };
});

afterEach(() => {
  delete (globalThis as { CSS?: unknown }).CSS;
  vi.useRealTimers();
});

const touchActionOf = (el: El): unknown => (el.props.style as Record<string, unknown> | undefined)?.touchAction;

describe('TapBoard: touch-action (KT-D3)', () => {
  it('pans along its scroller only while it can scroll; otherwise (or with no scroller) pinch-zoom', () => {
    ctx.scroller = fakeScroller(true);
    expect(touchActionOf(renderBoard().view)).toBe('pan-y pinch-zoom');
    ctx.scroller = fakeScroller(true, 'x');
    expect(touchActionOf(renderBoard().view)).toBe('pan-x pinch-zoom');
    ctx.scroller = fakeScroller(false);
    expect(touchActionOf(renderBoard().view)).toBe('pinch-zoom');
    ctx.scroller = null;
    expect(touchActionOf(renderBoard().view)).toBe('pinch-zoom');
  });

  it('a browser without pinch-zoom: a board that must not pan gets none (U1)', () => {
    delete (globalThis as { CSS?: unknown }).CSS;
    expect(touchActionOf(renderBoard().view)).toBe('none');
  });

  it('native: no style', () => {
    platform.OS = 'ios';
    expect(renderBoard().view.props.style).toBeUndefined();
  });
});

describe('TapBoard: the responder, the context and the Screen', () => {
  it('wires the capture responder on its View and passes testID', () => {
    const { view } = renderBoard({ testID: 'answers' });
    expect(view.type).toBe('View');
    expect(view.props.testID).toBe('answers');
    for (const name of ['onStartShouldSetResponderCapture', 'onResponderGrant', 'onResponderStart', 'onResponderMove', 'onResponderEnd', 'onResponderRelease', 'onResponderTerminate', 'onResponderTerminationRequest']) {
      expect(typeof view.props[name]).toBe('function');
    }
    expect((view.props.onStartShouldSetResponder as () => boolean)()).toBe(false);
    expect(view.props.onLayout).toBeUndefined();
  });

  it('hands its targets and controls register, click, lock and remeasure, and starts unlocked with nothing pressed', () => {
    const { provider } = renderBoard();
    expect(provider.type).toBe(TapBoardContext.Provider);
    const value = provider.props.value as TapBoardContextValue;
    expect(value.locked).toBe(false);
    expect(value.pressed.size).toBe(0);
    for (const fn of ['register', 'registerControl', 'click', 'lock', 'remeasure'] as const) expect(typeof value[fn]).toBe('function');
  });

  it('registers with its Screen while mounted (native scrollEnabled is opt-in)', () => {
    renderBoard();
    const cleanups = runEffects();
    expect(screen.boards).toBe(1);
    for (const c of cleanups) c();
    expect(screen.boards).toBe(0);
  });

  it('listens to its scroller while mounted; a board with no scroller listens to nothing', () => {
    const scroller = fakeScroller(true);
    ctx.scroller = scroller;
    renderBoard();
    const cleanups = runEffects();
    expect(scroller.listeners.size).toBe(1);
    for (const c of cleanups) c();
    expect(scroller.listeners.size).toBe(0);
    ctx.scroller = null;
    renderBoard();
    expect(() => runEffects()).not.toThrow();
  });

  it('native: re-measures on its layout, after a scroll settles, and when the fit changes', () => {
    vi.useFakeTimers();
    platform.OS = 'android';
    const scroller = fakeScroller(true);
    ctx.scroller = scroller;
    const { provider, view } = renderBoard();
    const measured: number[] = [];
    const host = { measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => (measured.push(1), cb(0, 0, 96, 96)) };
    (provider.props.value as TapBoardContextValue).register('A', { node: () => host, disabled: () => false, commit: () => undefined });
    const cleanups = runEffects();
    const afterFit = measured.length;
    expect(afterFit).toBeGreaterThan(0);
    (view.props.onLayout as () => void)();
    expect(measured.length).toBe(afterFit + 1);
    // Both listeners hear the scroll: the cancel check and the settle timer.
    expect(scroller.listeners.size).toBe(2);
    for (const l of scroller.listeners) l(120);
    for (const l of scroller.listeners) l(130);
    vi.advanceTimersByTime(100);
    expect(measured.length).toBe(afterFit + 2);
    for (const l of scroller.listeners) l(140);
    for (const c of cleanups) c();
    vi.advanceTimersByTime(100);
    expect(measured.length).toBe(afterFit + 2);
  });

  it('a board commit locks; the published lock clears after TAP_LOCK_MS; unmount stops the timer', () => {
    vi.useFakeTimers();
    const { provider } = renderBoard();
    const value = provider.props.value as TapBoardContextValue;
    const commits: string[] = [];
    value.register('A', { node: () => null, disabled: () => false, commit: () => commits.push('A') });
    value.click('A');
    expect(commits).toEqual(['A']);
    expect((renderBoard().provider.props.value as TapBoardContextValue).locked).toBe(true);
    vi.advanceTimersByTime(TAP_LOCK_MS);
    expect((renderBoard().provider.props.value as TapBoardContextValue).locked).toBe(false);
    value.lock(900);
    for (const c of runEffects()) c();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('with an app lock, a board commit sets it and a board reads it', () => {
    let until = 0;
    const locks: number[] = [];
    ctx.app = { until: () => until, extendTo: (at: number) => ((until = at), locks.push(at)), lock: () => undefined, locked: false } satisfies TapLockClock;
    const { provider } = renderBoard();
    const value = provider.props.value as TapBoardContextValue;
    const commits: string[] = [];
    value.register('A', { node: () => null, disabled: () => false, commit: () => commits.push('A') });
    value.click('A');
    expect(locks).toHaveLength(1);
    value.click('A');
    expect(commits).toEqual(['A']);
  });

  it('the web host: the board node is the DOM walk\'s stop, rectangles come from the DOM', () => {
    const { provider, view } = renderBoard();
    const host = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 96, height: 96 }) };
    refOf(view)(host);
    const value = provider.props.value as TapBoardContextValue;
    const commits: string[] = [];
    value.register('A', { node: () => host, disabled: () => false, commit: () => commits.push('A') });
    const touch = { identifier: 1, pageX: 48, pageY: 48, target: null };
    const event = { nativeEvent: { changedTouches: [touch], ...touch, type: 'touchstart' } };
    expect((view.props.onStartShouldSetResponderCapture as (e: unknown) => boolean)(event)).toBe(true);
    (view.props.onResponderStart as (e: unknown) => void)(event);
    expect([...(renderBoard().provider.props.value as TapBoardContextValue).pressed]).toEqual(['A']);
    (view.props.onResponderEnd as (e: unknown) => void)({ nativeEvent: { ...event.nativeEvent, type: 'touchend' } });
    expect(commits).toEqual(['A']);
  });

  it('native: the board reads the measured cache', () => {
    platform.OS = 'android';
    const { provider, view } = renderBoard();
    const host = { measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => cb(0, 0, 96, 96) };
    (provider.props.value as TapBoardContextValue).register('A', { node: () => host, disabled: () => false, commit: () => undefined });
    const touch = { identifier: 1, pageX: 48, pageY: 48, target: 12 };
    expect((view.props.onStartShouldSetResponderCapture as (e: unknown) => boolean)({ nativeEvent: { changedTouches: [touch] } })).toBe(true);
  });
});

describe('TapTarget inside a board', () => {
  const stamps: unknown[] = [];
  function inBoard(pressed: string[] = []): { value: TapBoardContextValue; clicks: string[]; registered: Map<string, unknown>; remeasured: number[] } {
    const clicks: string[] = [];
    const remeasured: number[] = [];
    stamps.length = 0;
    const registered = new Map<string, unknown>();
    const value: TapBoardContextValue = {
      register: (id, entry) => {
        registered.set(id, entry);
        return () => registered.delete(id);
      },
      registerControl: (id, entry) => {
        registered.set(`control:${id}`, entry);
        return () => registered.delete(`control:${id}`);
      },
      click: (id, stamp) => {
        clicks.push(id);
        stamps.push(stamp);
      },
      lock: () => undefined,
      remeasure: () => remeasured.push(1),
      locked: false,
      pressed: new Set(pressed),
    };
    ctx.board = value;
    syncContexts();
    return { value, clicks, registered, remeasured };
  }

  it('a choice chip is a checkbox or a radio, and its checked state goes out as aria-checked too (BL-8)', () => {
    inBoard();
    const chip = renderTarget({ accessibilityRole: 'checkbox', accessibilityState: { checked: true } });
    expect(chip.props.accessibilityRole).toBe('checkbox');
    expect(chip.props['aria-checked']).toBe(true);
    const radio = renderTarget({ accessibilityRole: 'radio', accessibilityState: { checked: false } });
    expect(radio.props['aria-checked']).toBe(false);
    expect('aria-checked' in renderTarget({}).props).toBe(false);
  });

  it('is a focusable button with the caller\'s label and state; its click (with its time stamp) goes to the board', () => {
    const { clicks } = inBoard();
    const el = renderTarget({ accessibilityState: { selected: true }, testID: 'tile-0' });
    expect(el.type).toBe('Pressable');
    expect(el.props.accessibilityRole).toBe('button');
    expect(el.props.accessibilityLabel).toBe('ㄱ giyeok');
    expect(el.props.accessibilityState).toEqual({ selected: true, disabled: false });
    expect(el.props.testID).toBe('tile-0');
    expect(el.props.delayPressIn).toBe(0);
    (el.props.onPress as (e?: unknown) => void)({ timeStamp: 1234 });
    expect(clicks).toEqual([':t1:']);
    expect(stamps).toEqual([1234]);
  });

  it('paints the board\'s press look, not the Pressable\'s', () => {
    inBoard([':t1:']);
    expect(textOf(renderTarget().props.children as ReactNode)).toBe('pressed');
    inBoard([]);
    hooks.store = [];
    expect(textOf(renderTarget().props.children as ReactNode)).toBe('idle');
  });

  it('web: touch-action pinch-zoom after the caller\'s style (none without pinch-zoom); a style function gets the board\'s look', () => {
    inBoard([':t1:']);
    const el = renderTarget({ style: ({ pressed }) => ({ opacity: pressed ? 0.5 : 1 }) });
    expect(el.props.style).toEqual([{ opacity: 0.5 }, { touchAction: 'pinch-zoom' }]);
    delete (globalThis as { CSS?: unknown }).CSS;
    hooks.store = [];
    expect(renderTarget({ style: { opacity: 1 } }).props.style).toEqual([{ opacity: 1 }, { touchAction: 'none' }]);
  });

  it('native: the caller\'s style alone, and its layout asks the board to re-measure', () => {
    platform.OS = 'ios';
    const { remeasured } = inBoard();
    const el = renderTarget({ style: { opacity: 1 } });
    expect(el.props.style).toEqual({ opacity: 1 });
    (el.props.onLayout as () => void)();
    expect(remeasured).toEqual([1]);
  });

  it('registers on mount with getters for its node, disabled, gapFill and commit, and unregisters on unmount', () => {
    const { registered } = inBoard();
    const commits: string[] = [];
    const el = renderTarget({ onCommit: () => commits.push('first'), lockMs: 120, gapFill: false });
    const cleanups = runEffects();
    const entry = registered.get(':t1:') as { node: () => unknown; disabled: () => boolean; lockMs?: number; gapFill?: boolean; commit: () => void };
    refOf(el)('host');
    expect(entry.node()).toBe('host');
    expect(entry.lockMs).toBe(120);
    expect(entry.gapFill).toBe(false);
    entry.commit();
    // A re-render with a new callback and disabled: the same registration reads them.
    syncContexts();
    hooks.at = 0;
    TapTarget({ onCommit: () => commits.push('second'), disabled: true, accessibilityLabel: 'x', children: () => null });
    entry.commit();
    expect(commits).toEqual(['first', 'second']);
    expect(entry.disabled()).toBe(true);
    for (const c of cleanups) c();
    expect(registered.size).toBe(0);
  });

  it('a disabled target says so in its state', () => {
    inBoard();
    const el = renderTarget({ disabled: true });
    expect(el.props.accessibilityState).toEqual({ disabled: true });
    expect(el.props.disabled).toBe(true);
  });

  it('an inactive target (an answered card, KT-2) is claimed and never pressed or committed, but stays an enabled, focusable button', () => {
    const { registered, clicks } = inBoard([':t1:']);
    const commits: string[] = [];
    const el = renderTarget({ inactive: true, onCommit: () => commits.push('x'), accessibilityState: { selected: true } });
    runEffects();
    const entry = registered.get(':t1:') as { disabled: () => boolean; commit: () => void };
    expect(entry.disabled()).toBe(true);
    expect(el.props.disabled).toBeUndefined();
    expect(el.props.accessibilityState).toEqual({ selected: true, disabled: false });
    // A card drawn as disabled says so, and still is not a disabled (unfocusable) Pressable.
    hooks.store = [];
    const drawn = renderTarget({ inactive: true, accessibilityState: { selected: false, disabled: true } });
    expect(drawn.props.accessibilityState).toEqual({ selected: false, disabled: true });
    expect(drawn.props.disabled).toBeUndefined();
    expect(textOf(el.props.children as ReactNode)).toBe('idle');
    (el.props.onPress as (e?: unknown) => void)({ timeStamp: 5 });
    expect(clicks).toEqual([':t1:']);
    expect(commits).toEqual([]);
  });

  it('pressableRef gets the Pressable\'s node too (a function or an object ref), as the board does', () => {
    const { registered } = inBoard();
    const seen: unknown[] = [];
    const el = renderTarget({ pressableRef: (v) => seen.push(v) });
    runEffects();
    refOf(el)('host');
    expect(seen).toEqual(['host']);
    expect((registered.get(':t1:') as { node: () => unknown }).node()).toBe('host');
    const obj = { current: null as unknown };
    hooks.store = [];
    refOf(renderTarget({ pressableRef: obj as never }))('node-2');
    expect(obj.current).toBe('node-2');
  });
});

describe('TapTarget outside a board', () => {
  it('a plain Pressable whose press is guarded against a bounce (TAP_LOCK_MS); it registers nothing', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const commits: number[] = [];
    const el = renderTarget({ onCommit: () => commits.push(Date.now()) });
    expect(runEffects()).toEqual([]);
    const press = el.props.onPress as () => void;
    press();
    vi.setSystemTime(150);
    press();
    vi.setSystemTime(TAP_LOCK_MS);
    press();
    expect(commits).toEqual([0, TAP_LOCK_MS]);
  });

  it('shows the Pressable\'s own pressed state, never on a disabled target; no touch-action of its own', () => {
    const render = (props: Partial<TapTargetProps>) => renderTarget(props).props.children as (s: { pressed: boolean }) => ReactNode;
    expect(textOf(render({})({ pressed: true }))).toBe('pressed');
    hooks.store = [];
    expect(textOf(render({ disabled: true })({ pressed: true }))).toBe('idle');
    hooks.store = [];
    // No board drives the page's scroll here, so the browser keeps its own touch-action (a drag on it still scrolls).
    expect(renderTarget({ style: { opacity: 1 } }).props.style).toEqual({ opacity: 1 });
    hooks.store = [];
    const style = renderTarget({ style: ({ pressed }) => ({ opacity: pressed ? 0.5 : 1 }) }).props.style as (s: { pressed: boolean }) => unknown;
    expect(style({ pressed: true })).toEqual({ opacity: 0.5 });
    hooks.store = [];
    const off = renderTarget({ disabled: true, style: ({ pressed }) => ({ opacity: pressed ? 0.5 : 1 }) }).props.style as (s: { pressed: boolean }) => unknown;
    expect(off({ pressed: true })).toEqual({ opacity: 1 });
  });

  it('an inactive target shows no press and its press does nothing: it neither runs nor sets the app lock', () => {
    const app = { until: () => 0, extendTo: () => undefined, lock: vi.fn(), locked: false };
    ctx.app = app;
    const commits: number[] = [];
    const el = renderTarget({ inactive: true, onCommit: () => commits.push(1) });
    expect(el.props.disabled).toBeUndefined();
    expect(textOf((el.props.children as (s: { pressed: boolean }) => ReactNode)({ pressed: true }))).toBe('idle');
    expect(el.props.onPress).toBeUndefined();
    expect(commits).toEqual([]);
    expect(app.lock).not.toHaveBeenCalled();
  });
});

describe('TapControl and TapScroller', () => {
  it('a control registers its node with the board and asks for a re-measure on layout', () => {
    const remeasured: number[] = [];
    const registered = new Map<string, { node: () => unknown }>();
    ctx.board = {
      registerControl: (id: string, entry: { node: () => unknown }) => {
        registered.set(id, entry);
        return () => registered.delete(id);
      },
      remeasure: () => remeasured.push(1),
    };
    syncContexts();
    hooks.at = 0;
    const el = TapControl({ children: <span>speaker</span>, testID: 'spk' }) as El;
    expect(el.type).toBe('View');
    expect(el.props.testID).toBe('spk');
    const cleanups = runEffects();
    refOf(el)('node');
    expect(registered.get(':t1:')!.node()).toBe('node');
    (el.props.onLayout as () => void)();
    expect(remeasured).toEqual([1]);
    for (const c of cleanups) c();
    expect(registered.size).toBe(0);
  });

  it('outside a board a control is a plain View', () => {
    syncContexts();
    hooks.at = 0;
    const el = TapControl({ children: <span>speaker</span> }) as El;
    expect(el.props.onLayout).toBeUndefined();
    expect(runEffects()).toEqual([]);
  });

  it('TapScroller hands its scroller to the boards inside', () => {
    const scroller = fakeScroller(true, 'x');
    const el = TapScroller({ scroller, children: <span>scene</span> }) as El;
    expect(el.type).toBe(TapScrollerContext.Provider);
    expect(el.props.value).toBe(scroller);
  });
});

describe('useTapLock and usePressGuard', () => {
  it('outside any board or provider: never locked, lock does nothing', () => {
    syncContexts();
    const lock = useTapLock();
    expect(lock.locked).toBe(false);
    expect(() => lock.lock(500)).not.toThrow();
  });

  it('with no provider, the nearest board\'s own clock', () => {
    const calls: number[] = [];
    ctx.board = { lock: (ms: number) => calls.push(ms), locked: true };
    syncContexts();
    const lock = useTapLock();
    expect(lock.locked).toBe(true);
    lock.lock(520);
    expect(calls).toEqual([520]);
  });

  it('with a provider, the app clock, inside a board or not', () => {
    const calls: number[] = [];
    ctx.board = { lock: () => calls.push(-1), locked: false };
    ctx.app = { until: () => 0, extendTo: () => undefined, lock: (ms: number) => calls.push(ms), locked: true };
    syncContexts();
    const lock = useTapLock();
    expect(lock.locked).toBe(true);
    lock.lock(520);
    expect(calls).toEqual([520]);
  });

  it('the guard drops its own repeat within TAP_LOCK_MS; an undefined handler is a no-op', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    syncContexts();
    hooks.at = 0;
    const guard = usePressGuard();
    const calls: string[] = [];
    guard((x: string) => calls.push(x))('next');
    guard((x: string) => calls.push(x))('back');
    expect(calls).toEqual(['next']);
    vi.setSystemTime(1000 + TAP_LOCK_MS);
    expect(() => guard(undefined)()).not.toThrow();
  });

  it('with the app lock: a press during it is dropped, and a press that runs sets it (unless setsLock is false)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    let until = 0;
    const locks: number[] = [];
    ctx.app = { until: () => until, extendTo: () => undefined, lock: (ms: number) => (locks.push(ms), (until = Date.now() + ms)), locked: false };
    syncContexts();
    hooks.at = 0;
    const next = usePressGuard();
    hooks.at = 0;
    hooks.store = [];
    const speaker = usePressGuard({ setsLock: false });
    const calls: string[] = [];
    speaker(() => calls.push('speaker'))();
    expect(locks).toEqual([]);
    next(() => calls.push('next'))();
    expect(locks).toEqual([TAP_LOCK_MS]);
    vi.setSystemTime(1000 + 200);
    speaker(() => calls.push('speaker again'))();
    expect(calls).toEqual(['speaker', 'next']);
  });

  it('a mouse, keyboard or screen-reader press (web) is deliberate: it always runs and sets no lock; a touch is guarded', () => {
    const listeners = new Map<string, (e: { pointerType?: string }) => void>();
    (globalThis as { document?: unknown }).document = { addEventListener: (t: string, fn: (e: { pointerType?: string }) => void) => listeners.set(t, fn) };
    try {
      const app = { until: () => Number.POSITIVE_INFINITY, extendTo: () => undefined, lock: vi.fn(), locked: true };
      ctx.app = app;
      syncContexts();
      hooks.at = 0;
      const runs: string[] = [];
      const guarded = usePressGuard()((kind: { nativeEvent: { pointerType: string } }) => runs.push(kind.nativeEvent.pointerType));
      guarded({ nativeEvent: { pointerType: 'mouse' } });
      guarded({ nativeEvent: { pointerType: 'mouse' } });
      guarded({ nativeEvent: { pointerType: '' } });
      guarded({ nativeEvent: { pointerType: 'touch' } });
      expect(runs).toEqual(['mouse', 'mouse', '']);
      expect(app.lock).not.toHaveBeenCalled();
    } finally {
      delete (globalThis as { document?: unknown }).document;
    }
  });
});
