import { presenter } from '@hangul-route/design-system';
import { Dimensions, View } from 'react-native';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { BAR_SHOW_GRACE_MS } from '../../../logic/lecture/stage-constants';
import { NUDGE_MS } from '../../../logic/lecture/stage-gesture';
import type { InputKind } from '../../../platform/presenter';
import { byTestId, press, render, textOf } from '../../../test-support/render';

/**
 * The pinned pair on a docked touch window and the Next ring (AMENDMENTS-PRESENTER-NAV sections
 * 5.1, 5.4 and 7.2, row PN-2), on the whole presenter with fake timers at 1180 x 820: once touch is
 * seen, Previous and Next keep opacity 1 and take taps after `presenter.autoHideMs` and inside the
 * `BAR_SHOW_GRACE_MS` after a show, while the chips and tools fade and keep the grace; mouse only,
 * the whole bar fades (README D3); a touch tap on empty stage rings Next for `NUDGE_MS` and steps
 * nothing. In a phone window (844 x 390, the overlay layout) the same tap shows and hides the bar,
 * and with More open the stage is covered (a tap closes it). The page's input kind, its activity and
 * its pointer media are driven by the test.
 */

const page = vi.hoisted(() => ({ input: null as ((kind: InputKind) => void) | null, activity: null as (() => void) | null, touchAtStart: false }));
vi.mock('../../../platform/presenter', async (importOriginal) => {
  const { encodeDeck } = await import('@hangul-route/content-schema');
  const deck = { v: 1, id: 'lecture:navpin1', title: 'Pin', createdAt: '2026-10-29T09:00:00Z', seed: 1, blocks: [{ kind: 'quest', id: 'quest:stage1-letters-q1' }] };
  return {
    ...(await importOriginal<typeof import('../../../platform/presenter')>()),
    takeDeckFragment: () => ({ raw: encodeDeck(deck as never), reloaded: false }),
    subscribeInputKind: (handler: (kind: InputKind) => void) => {
      page.input = handler;
      return () => {
        page.input = null;
      };
    },
    subscribeActivity: (handler: () => void) => {
      page.activity = handler;
      return () => {
        page.activity = null;
      };
    },
    touchSeenAtStart: () => page.touchAtStart,
  };
});
// The picture art reads Metro's `__DEV__`, which the Node render lane does not define.
(globalThis as { __DEV__?: boolean }).__DEV__ = false;
vi.mock('../../../components/StrokeHint', () => ({ StrokeHint: () => null }));
vi.mock('react-native-gesture-handler', async () => {
  const { View: Plain } = await import('react-native');
  return { GestureHandlerRootView: Plain };
});
vi.mock('expo-status-bar', () => ({ StatusBar: () => null }));

import PresenterApp from '../../../../PresenterApp';

const before = { window: Dimensions.get('window'), screen: Dimensions.get('screen') };
beforeAll(() => {
  const size = { width: 1180, height: 820, scale: 1, fontScale: 1 };
  Dimensions.set({ window: size, screen: size });
});
afterAll(() => {
  Dimensions.set(before);
});
afterEach(() => {
  vi.useRealTimers();
});

/** react-native-web's pointer-events classes, read from a probe (they are hashed). */
let POINTER_CLASSES: Map<string, string> | null = null;
async function pointerClasses(): Promise<Map<string, string>> {
  if (POINTER_CLASSES) return POINTER_CLASSES;
  const probe = await render(
    <View>
      {(['auto', 'none', 'box-none'] as const).map((value) => (
        <View key={value} testID={`probe-${value}`} pointerEvents={value} />
      ))}
    </View>,
  );
  POINTER_CLASSES = new Map();
  for (const value of ['auto', 'none', 'box-none']) {
    const cls = String(byTestId(probe.root, `probe-${value}`)[0]!.props.className).split(' ').find((c) => c.startsWith('r-pointerEvents-'))!;
    POINTER_CLASSES.set(cls, value);
  }
  return POINTER_CLASSES;
}

/**
 * Whether a host node takes a pointer, as the browser decides: the nearest own `auto` or `none` wins
 * (react-native-web writes both as !important); a `box-none` node takes none itself and hands `auto`
 * to what is under it.
 */
async function takesPointer(node: ReactTestInstance): Promise<boolean> {
  const classes = await pointerClasses();
  let at: ReactTestInstance | null = node;
  let first = true;
  while (at) {
    if (typeof at.type === 'string') {
      const cls = String(at.props.className ?? '').split(' ').find((c) => classes.has(c));
      const value = cls === undefined ? undefined : classes.get(cls);
      if (value === 'auto') return true;
      if (value === 'none') return false;
      if (value === 'box-none') return !first;
      first = false;
    }
    at = at.parent;
  }
  return true;
}

/** The product of every opacity from the node up (1: drawn in full). */
function opacityOf(node: ReactTestInstance): number {
  let out = 1;
  for (let at: ReactTestInstance | null = node; at; at = at.parent) {
    if (typeof at.type !== 'string') continue;
    const style = (at.props.style ?? {}) as { opacity?: number | string };
    if (style.opacity !== undefined) out *= Number(style.opacity);
  }
  return out;
}

const one = (r: ReactTestRenderer, id: string): ReactTestInstance => byTestId(r.root, id)[0]!;
const counter = (r: ReactTestRenderer): string => textOf(one(r, 'presenter-counter'));

async function tick(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/** The presenter (at 1180 x 820, docked, unless a phone window is set) with the first slide on screen. */
async function lesson(touchAtStart: boolean, docked = true): Promise<ReactTestRenderer> {
  page.touchAtStart = touchAtStart;
  vi.useFakeTimers();
  const r = await render(<PresenterApp />);
  await tick(10);
  await press(one(r, 'presenter-start-button'));
  await tick(10);
  expect(byTestId(r.root, 'presenter-stage')).toHaveLength(1);
  expect(byTestId(r.root, 'presenter-bar-band')).toHaveLength(docked ? 1 : 0);
  return r;
}

/** A one-finger tap (or, with `dx`, a swipe) on empty stage area, through the stage's responder handlers. */
function tapStage(r: ReactTestRenderer, type: 'touch' | 'mouse', dx = 0): void {
  const stage = r.root.find((n) => n.props.testID === 'presenter-stage' && typeof n.props.onResponderGrant === 'function');
  const down = { identifier: 0, pageX: 400, pageY: 200 };
  const up = { ...down, pageX: down.pageX + dx };
  const event = (kind: string, at: typeof down, touches: unknown[]) => ({ target: null, nativeEvent: { type: kind, target: null, ...at, changedTouches: [at], touches } });
  act(() => {
    (stage.props.onResponderGrant as (e: unknown) => void)(event(type === 'touch' ? 'touchstart' : 'mousedown', down, [down]));
    (stage.props.onResponderRelease as (e: unknown) => void)(event(type === 'touch' ? 'touchend' : 'mouseup', up, []));
  });
}

describe('docked, touch seen: Previous and Next never fade (section 5.1)', () => {
  it('after presenter.autoHideMs the pair keeps opacity 1 and takes taps; the tools fade and take none', async () => {
    const r = await lesson(true);
    expect(one(r, 'presenter-nav-pair').props['data-pinned']).toBe('true');
    await tick(presenter.autoHideMs + 1000);
    for (const id of ['presenter-back', 'presenter-next']) {
      expect(opacityOf(one(r, id)), id).toBe(1);
      expect(await takesPointer(one(r, id)), id).toBe(true);
    }
    for (const id of ['presenter-sound', 'presenter-timer', 'presenter-exit']) {
      expect(opacityOf(one(r, id)), id).toBe(0);
      expect(await takesPointer(one(r, id)), id).toBe(false);
    }
    // A press on the faded bar's Next steps at once.
    const was = counter(r);
    await press(one(r, 'presenter-next'));
    expect(counter(r)).not.toBe(was);
  });

  it('inside the grace after a show the tools still take no tap, and the pair does: a press steps', async () => {
    const r = await lesson(true);
    await tick(presenter.autoHideMs + 1000);
    act(() => page.activity?.());
    await tick(BAR_SHOW_GRACE_MS - 100);
    expect(await takesPointer(one(r, 'presenter-sound'))).toBe(false);
    expect(await takesPointer(one(r, 'presenter-next'))).toBe(true);
    const was = counter(r);
    await press(one(r, 'presenter-next'));
    expect(counter(r)).not.toBe(was);
    // The tools take taps again once the grace is over.
    await tick(200);
    expect(await takesPointer(one(r, 'presenter-sound'))).toBe(true);
  });

  it('touch seen by the first touch press on a mouse-looking page pins the pair from then on', async () => {
    const r = await lesson(false);
    expect(one(r, 'presenter-nav-pair').props['data-pinned']).toBe('false');
    act(() => page.input?.('touch'));
    expect(one(r, 'presenter-nav-pair').props['data-pinned']).toBe('true');
    await tick(presenter.autoHideMs + 1000);
    expect(opacityOf(one(r, 'presenter-next'))).toBe(1);
    expect(await takesPointer(one(r, 'presenter-back'))).toBe(true);
  });
});

describe('docked, mouse only: the whole bar fades (README D3, unchanged)', () => {
  it('after presenter.autoHideMs Previous, Next and the tools all fade and take no pointer', async () => {
    const r = await lesson(false);
    act(() => page.input?.('mouse'));
    await tick(presenter.autoHideMs + 1000);
    for (const id of ['presenter-back', 'presenter-next', 'presenter-sound', 'presenter-exit']) {
      expect(opacityOf(one(r, id)), id).toBe(0);
      expect(await takesPointer(one(r, id)), id).toBe(false);
    }
    // Any activity brings it back, with the grace for every control.
    act(() => page.activity?.());
    await tick(BAR_SHOW_GRACE_MS - 100);
    expect(await takesPointer(one(r, 'presenter-next'))).toBe(false);
    await tick(200);
    expect(await takesPointer(one(r, 'presenter-next'))).toBe(true);
  });

  it('a mouse click on the title slide goes on', async () => {
    const r = await lesson(false);
    const was = counter(r);
    tapStage(r, 'mouse');
    expect(counter(r)).not.toBe(was);
  });
});

describe("'nudge-next': a touch tap on empty stage rings Next and steps nothing (section 7.2)", () => {
  it('the ring is drawn at once for NUDGE_MS, a static border.focus outline, and goes at once', async () => {
    const r = await lesson(true);
    const was = counter(r);
    expect(one(r, 'presenter-next').props['data-nudge']).toBeUndefined();
    tapStage(r, 'touch');
    expect(counter(r)).toBe(was);
    const ring = one(r, 'presenter-next');
    expect(ring.props['data-nudge']).toBe('on');
    expect((ring.props.style as { outlineStyle?: string }).outlineStyle).toBe('solid');
    await tick(NUDGE_MS - 10);
    expect(one(r, 'presenter-next').props['data-nudge']).toBe('on');
    // A second tap restarts it; it ends NUDGE_MS after the last one.
    tapStage(r, 'touch');
    await tick(NUDGE_MS - 10);
    expect(one(r, 'presenter-next').props['data-nudge']).toBe('on');
    await tick(20);
    expect(one(r, 'presenter-next').props['data-nudge']).toBeUndefined();
    expect(counter(r)).toBe(was);
    // Nothing is said: the live region still names the first slide.
    expect(textOf(one(r, 'presenter-live'))).toContain('Slide 1 of');
  });
});

describe('a phone window (the overlay layout, sections 5.2 and 5.3)', () => {
  const phone = { width: 844, height: 390, scale: 1, fontScale: 1 };
  const tablet = { width: 1180, height: 820, scale: 1, fontScale: 1 };
  afterEach(() => {
    Dimensions.set({ window: tablet, screen: tablet });
  });

  it('a touch tap on empty stage shows the hidden bar and hides it again; it never steps', async () => {
    Dimensions.set({ window: phone, screen: phone });
    const r = await lesson(true, false);
    await tick(presenter.autoHideMs + 1000);
    expect(await takesPointer(one(r, 'presenter-next'))).toBe(false);
    const was = counter(r);
    tapStage(r, 'touch');
    await tick(BAR_SHOW_GRACE_MS + 100);
    expect(await takesPointer(one(r, 'presenter-next'))).toBe(true);
    tapStage(r, 'touch');
    await tick(10);
    expect(await takesPointer(one(r, 'presenter-next'))).toBe(false);
    expect(counter(r)).toBe(was);
    // A swipe steps, and the bar stays hidden.
    tapStage(r, 'touch', -100);
    await tick(10);
    expect(counter(r)).not.toBe(was);
    expect(await takesPointer(one(r, 'presenter-next'))).toBe(false);
  });

  it('with More open the stage is covered: a swipe steps nothing, a tap closes More and steps nothing', async () => {
    Dimensions.set({ window: phone, screen: phone });
    const r = await lesson(true, false);
    await press(one(r, 'presenter-more'));
    expect(byTestId(r.root, 'presenter-more-sheet')).toHaveLength(1);
    const was = counter(r);
    tapStage(r, 'touch', -100);
    await tick(10);
    expect(counter(r)).toBe(was);
    expect(byTestId(r.root, 'presenter-more-sheet')).toHaveLength(1);
    tapStage(r, 'touch');
    await tick(10);
    expect(byTestId(r.root, 'presenter-more-sheet')).toHaveLength(0);
    expect(counter(r)).toBe(was);
  });

  it('More open when the window stops being a phone window (a foldable opened): More closes, and Next steps', async () => {
    Dimensions.set({ window: phone, screen: phone });
    // The Node lane has no window resize: the test hands useWindowDimensions its 'change' itself.
    const changes: ((d: { window: typeof tablet; screen: typeof tablet }) => void)[] = [];
    const spy = vi.spyOn(Dimensions, 'addEventListener').mockImplementation(((type: string, handler: (typeof changes)[number]) => {
      if (type === 'change') changes.push(handler);
      return { remove: () => undefined };
    }) as never);
    try {
      const r = await lesson(true, false);
      await press(one(r, 'presenter-more'));
      expect(byTestId(r.root, 'presenter-more-sheet')).toHaveLength(1);
      act(() => {
        Dimensions.set({ window: tablet, screen: tablet });
        for (const change of changes) change({ window: tablet, screen: tablet });
      });
      await tick(10);
      expect(byTestId(r.root, 'presenter-bar-band')).toHaveLength(1);
      expect(byTestId(r.root, 'presenter-more-sheet')).toHaveLength(0);
      const was = counter(r);
      await press(one(r, 'presenter-next'));
      expect(counter(r)).not.toBe(was);
      // The stage is no longer covered: a touch tap on empty stage rings Next (not 'close-more').
      tapStage(r, 'touch');
      expect(one(r, 'presenter-next').props['data-nudge']).toBe('on');
    } finally {
      spy.mockRestore();
    }
  });
});
