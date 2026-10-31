import { Children, isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TAP_LOCK_MS } from '../../../tap-model';
import { TapBoardContext, type TapBoardContextValue } from '../context';
import { TapBoard } from '../TapBoard';
import { TapTarget } from '../TapTarget';
import type { TapBoardProps, TapTargetProps } from '../types';
import { usePressGuard } from '../use-press-guard';
import { useTapLock } from '../use-tap-lock';

/**
 * `TapBoard` and `TapTarget` (docs/specs/AMENDMENTS-TOUCH.md section 4; design/components/TapBoard/spec.md), checked on
 * the element tree built by calling the components directly with react-native's hosts as plain tags (as
 * Button.test.tsx does). The responder rules are in controller.test.ts; here: the web `touch-action` per `scroll` and
 * the `Screen` fit, the responder wired on the board's View, the context a target reads, a target's role, label,
 * state and click path, the guard outside a board, and `useTapLock`.
 */
const platform = vi.hoisted(() => ({ OS: 'web' }));
const fit = vi.hoisted(() => ({ fits: false }));
const board = vi.hoisted(() => ({ value: null as unknown }));
const hooks = vi.hoisted(() => ({ store: [] as unknown[], at: 0, effects: [] as Array<() => void | (() => void)> }));
vi.mock('react-native', () => ({ Platform: platform, View: 'View', Pressable: 'Pressable' }));
vi.mock('../../Screen/fit', () => ({ useScreenFit: () => ({ fits: fit.fits, scrollY: () => 0 }) }));
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  const { TapBoardContext: boardContext } = await import('../context');
  const slot = <T,>(init: () => T): { value: T } => {
    const at = hooks.at++;
    if (hooks.store.length <= at) hooks.store.push({ value: init() });
    return hooks.store[at] as { value: T };
  };
  const stubs = {
    useContext: (context: unknown): unknown => (context === boardContext ? board.value : null),
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
  hooks.at = 0;
  const provider = TapBoard({ lock: 'board', children: <span>kids</span>, ...props }) as El;
  const view = Children.only(provider.props.children as ReactNode) as El;
  return { provider, view };
}

function renderTarget(props: Partial<TapTargetProps> = {}): El {
  hooks.at = 0;
  return TapTarget({ onCommit: () => undefined, accessibilityLabel: 'ㄱ giyeok', children: ({ pressed }) => <span>{pressed ? 'pressed' : 'idle'}</span>, ...props }) as El;
}

const textOf = (node: ReactNode): string => (isValidElement(node) ? String((node as El).props.children) : '');

beforeEach(() => {
  hooks.store = [];
  hooks.effects = [];
  platform.OS = 'web';
  fit.fits = false;
  board.value = null;
  (globalThis as { CSS?: unknown }).CSS = { supports: (p: string, v: string) => p === 'touch-action' && v === 'pinch-zoom' };
});

afterEach(() => {
  delete (globalThis as { CSS?: unknown }).CSS;
  vi.useRealTimers();
});

describe('TapBoard: touch-action (KT-D3)', () => {
  it('auto: pan-y pinch-zoom while the screen scrolls, pinch-zoom once it fits', () => {
    expect((renderBoard().view.props.style as Record<string, unknown>).touchAction).toBe('pan-y pinch-zoom');
    fit.fits = true;
    hooks.store = [];
    expect((renderBoard().view.props.style as Record<string, unknown>).touchAction).toBe('pinch-zoom');
  });

  it('x and none', () => {
    expect((renderBoard({ scroll: 'x' }).view.props.style as Record<string, unknown>).touchAction).toBe('pan-x pinch-zoom');
    hooks.store = [];
    expect((renderBoard({ scroll: 'none' }).view.props.style as Record<string, unknown>).touchAction).toBe('pinch-zoom');
  });

  it('a browser without pinch-zoom: a fitting board gets none (U1)', () => {
    delete (globalThis as { CSS?: unknown }).CSS;
    fit.fits = true;
    expect((renderBoard().view.props.style as Record<string, unknown>).touchAction).toBe('none');
  });

  it('native: no style at all', () => {
    platform.OS = 'ios';
    expect(renderBoard().view.props.style).toBeUndefined();
  });
});

describe('TapBoard: the responder and the context', () => {
  it('wires the capture responder on its View and passes testID', () => {
    const { view } = renderBoard({ testID: 'answers' });
    expect(view.type).toBe('View');
    expect(view.props.testID).toBe('answers');
    for (const name of ['onStartShouldSetResponderCapture', 'onResponderGrant', 'onResponderStart', 'onResponderMove', 'onResponderEnd', 'onResponderRelease', 'onResponderTerminate', 'onResponderTerminationRequest']) {
      expect(typeof view.props[name]).toBe('function');
    }
    expect((view.props.onStartShouldSetResponder as () => boolean)()).toBe(false);
  });

  it('hands its targets register, click and lock, and starts unlocked with nothing pressed', () => {
    const { provider } = renderBoard();
    expect(provider.type).toBe(TapBoardContext.Provider);
    const value = provider.props.value as TapBoardContextValue;
    expect(value.locked).toBe(false);
    expect(value.pressed.size).toBe(0);
    expect(typeof value.register).toBe('function');
  });

  it('a commit locks a board board; the published lock clears after TAP_LOCK_MS; unmount stops the timer', () => {
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
    const cleanup = hooks.effects.at(-1)!();
    if (typeof cleanup === 'function') cleanup();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('the board ref keeps its host node; the web host reads the window scroll for rectangles', () => {
    const { provider, view } = renderBoard();
    const host = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 96, height: 96 }) };
    ((view as unknown as { ref: (v: unknown) => void }).ref)(host);
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

  it('native: the board reads rectangles by measureInWindow', () => {
    platform.OS = 'android';
    const { provider, view } = renderBoard();
    const host = { measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => cb(0, 0, 96, 96) };
    const value = provider.props.value as TapBoardContextValue;
    value.register('A', { node: () => host, disabled: () => false, commit: () => undefined });
    const touch = { identifier: 1, pageX: 48, pageY: 48, target: 12 };
    expect((view.props.onStartShouldSetResponderCapture as (e: unknown) => boolean)({ nativeEvent: { changedTouches: [touch] } })).toBe(true);
  });
});

describe('TapTarget inside a board', () => {
  function inBoard(pressed: string[] = []): { value: TapBoardContextValue; clicks: string[]; registered: Map<string, unknown> } {
    const clicks: string[] = [];
    const registered = new Map<string, unknown>();
    const value: TapBoardContextValue = {
      register: (id, entry) => {
        registered.set(id, entry);
        return () => registered.delete(id);
      },
      click: (id) => clicks.push(id),
      lock: () => undefined,
      locked: false,
      pressed: new Set(pressed),
    };
    board.value = value;
    return { value, clicks, registered };
  }

  it('is a focusable button with the caller\'s label and state; its click goes to the board (rule 8)', () => {
    const { clicks } = inBoard();
    const el = renderTarget({ accessibilityState: { selected: true }, testID: 'tile-0' });
    expect(el.type).toBe('Pressable');
    expect(el.props.accessibilityRole).toBe('button');
    expect(el.props.accessibilityLabel).toBe('ㄱ giyeok');
    expect(el.props.accessibilityState).toEqual({ selected: true, disabled: false });
    expect(el.props.testID).toBe('tile-0');
    expect(el.props.delayPressIn).toBe(0);
    (el.props.onPress as () => void)();
    expect(clicks).toEqual([':t1:']);
  });

  it('paints the board\'s press look, not the Pressable\'s', () => {
    inBoard([':t1:']);
    expect(textOf(renderTarget().props.children as ReactNode)).toBe('pressed');
    inBoard([]);
    hooks.store = [];
    expect(textOf(renderTarget().props.children as ReactNode)).toBe('idle');
  });

  it('a style function gets the board\'s look', () => {
    inBoard([':t1:']);
    const el = renderTarget({ style: ({ pressed }) => ({ opacity: pressed ? 0.5 : 1 }) });
    expect(el.props.style).toEqual({ opacity: 0.5 });
  });

  it('registers on mount with getters for its node, disabled and commit, and unregisters on unmount', () => {
    const { registered } = inBoard();
    const commits: string[] = [];
    let disabled = false;
    const el = renderTarget({ onCommit: () => commits.push('first'), lockMs: 120 });
    const cleanup = hooks.effects.at(-1)!();
    const entry = registered.get(':t1:') as { node: () => unknown; disabled: () => boolean; lockMs?: number; commit: () => void };
    ((el as unknown as { ref: (v: unknown) => void }).ref)('host');
    expect(entry.node()).toBe('host');
    expect(entry.lockMs).toBe(120);
    entry.commit();
    // A re-render with a new callback and disabled: the same registration reads them.
    hooks.at = 0;
    disabled = true;
    TapTarget({ onCommit: () => commits.push('second'), disabled, accessibilityLabel: 'x', children: () => null });
    entry.commit();
    expect(commits).toEqual(['first', 'second']);
    expect(entry.disabled()).toBe(true);
    if (typeof cleanup === 'function') cleanup();
    expect(registered.size).toBe(0);
  });

  it('a disabled target says so in its state', () => {
    inBoard();
    expect(renderTarget({ disabled: true }).props.accessibilityState).toEqual({ disabled: true });
  });
});

describe('TapTarget outside a board', () => {
  it('a plain Pressable whose press is guarded against a bounce (TAP_LOCK_MS)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const commits: number[] = [];
    const el = renderTarget({ onCommit: () => commits.push(Date.now()) });
    expect(hooks.effects.length).toBe(1);
    const press = el.props.onPress as () => void;
    press();
    vi.setSystemTime(150);
    press();
    vi.setSystemTime(TAP_LOCK_MS);
    press();
    expect(commits).toEqual([0, TAP_LOCK_MS]);
  });

  it('shows the Pressable\'s own pressed state, never on a disabled target', () => {
    const render = (props: Partial<TapTargetProps>) => renderTarget(props).props.children as (s: { pressed: boolean }) => ReactNode;
    expect(textOf(render({})({ pressed: true }))).toBe('pressed');
    hooks.store = [];
    expect(textOf(render({ disabled: true })({ pressed: true }))).toBe('idle');
    hooks.store = [];
    const style = renderTarget({ style: { opacity: 1 } }).props.style as (s: { pressed: boolean }) => unknown;
    expect(style({ pressed: true })).toEqual({ opacity: 1 });
  });
});

describe('useTapLock and usePressGuard', () => {
  it('outside a board: never locked, lock does nothing', () => {
    const lock = useTapLock();
    expect(lock.locked).toBe(false);
    expect(() => lock.lock(500)).not.toThrow();
  });

  it('inside a board: the board\'s lock', () => {
    const calls: number[] = [];
    board.value = { register: () => () => undefined, click: () => undefined, lock: (ms: number) => calls.push(ms), locked: true, pressed: new Set() };
    const lock = useTapLock();
    expect(lock.locked).toBe(true);
    lock.lock(520);
    expect(calls).toEqual([520]);
  });

  it('one guard clock for every function it wraps; an undefined handler is a no-op', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    hooks.at = 0;
    const guard = usePressGuard();
    const calls: string[] = [];
    guard((x: string) => calls.push(x))('next');
    guard((x: string) => calls.push(x))('back');
    expect(calls).toEqual(['next']);
    vi.setSystemTime(1000 + TAP_LOCK_MS);
    expect(() => guard(undefined)()).not.toThrow();
  });
});
