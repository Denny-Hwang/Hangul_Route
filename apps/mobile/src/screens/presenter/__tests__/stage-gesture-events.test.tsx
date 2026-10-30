import { LectureDeckSchema } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import type { ReactElement } from 'react';
import { act, type ReactTestInstance } from 'react-test-renderer';
import { Dimensions } from 'react-native';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { lectureBundle } from '../../../logic/lecture/content';
import { expandDeck, type Slide } from '../../../logic/lecture/deck-builder';
import { COMPAT_MOUSE_MS, type GesturePointer, type StageCommand, type StageCovering, type StageStepSource } from '../../../logic/lecture/stage-gesture';
import type { NavLayout } from '../../../logic/lecture/stage-scale';
import { subscribeInputKind, type PresenterEnv } from '../../../platform/presenter.web';
import { byTestId, render } from '../../../test-support/render';
import { PresenterViewProvider } from '../presenter-context';
import { Stage } from '../Stage';

/**
 * The stage's responder handlers (AMENDMENTS-PRESENTER-NAV sections 4, 6 and 7.2, row PN-2): the
 * touch tracked from the grant gives the travel (never `changedTouches[0]`, the last finger
 * lifted), `onResponderStart` and `onResponderMove` raise the touch count, the gesture's pointer
 * comes from the grant event (a pen's mouse event counts as touch), and the target is read at the
 * grant from the node the gesture started on.
 */

// The picture art reads Metro's `__DEV__`, which the Node render lane does not define.
(globalThis as { __DEV__?: boolean }).__DEV__ = false;
vi.mock('../../../components/StrokeHint', () => ({ StrokeHint: () => null }));

const W = 1280;
const before = { window: Dimensions.get('window'), screen: Dimensions.get('screen') };
beforeAll(() => {
  Dimensions.set({ window: { width: W, height: 720, scale: 1, fontScale: 1 }, screen: { width: W, height: 720, scale: 1, fontScale: 1 } });
});
afterAll(() => {
  Dimensions.set(before);
});

const deck = LectureDeckSchema.parse({ v: 1, id: 'lecture:gesture1', title: 'Gestures', createdAt: '2026-10-29T09:00:00Z', seed: 1, blocks: [{ kind: 'quest', id: 'quest:stage1-letters-q1' }] });
const slides: Slide[] = expandDeck(deck, lectureBundle('en'), { canPlayKorean: true }).slides;
const titleIdx = slides.findIndex((s) => s.kind === 'title');
const quizIdx = slides.findIndex((s) => s.kind === 'quiz');
const scale = { unit: 1, logicalWidth: 1280, logicalHeight: 600, stageWidth: 1280, stageHeight: 600, offsetX: 0, offsetY: 0, letterboxed: false, portrait: false, tooSmall: false };

interface Setup {
  idx?: number;
  layout?: NavLayout;
  covering?: StageCovering;
  pointing?: boolean;
  lastPointer?: () => GesturePointer | null;
}

async function mount(setup: Setup = {}): Promise<{ stage: ReactTestInstance; commands: Exclude<StageCommand, null>[]; sources: StageStepSource[] }> {
  const commands: Exclude<StageCommand, null>[] = [];
  const sources: StageStepSource[] = [];
  const element = (
    <PresenterViewProvider value={{ messages: getMessages('en'), locale: 'en', unit: 1, reducedMotion: true }}>
      <Stage
        scale={scale}
        slides={slides}
        slideIdx={setup.idx ?? titleIdx}
        reveal={0}
        deckTitle="Gestures"
        strokeToken={0}
        joinCta="Join"
        onGesture={(command, source) => {
          commands.push(command);
          sources.push(source);
        }}
        layout={setup.layout ?? 'docked'}
        covering={setup.covering ?? 'none'}
        pointing={setup.pointing ?? false}
        lastPointer={setup.lastPointer ?? (() => null)}
        onPlaySound={() => undefined}
        romanization="always"
        sayIt={false}
        storyScene={() => undefined}
      />
    </PresenterViewProvider>
  ) as ReactElement;
  const r = await render(element);
  // The composite View that holds the responder handlers (the host node gets them as DOM listeners).
  const stage = r.root.find((n) => n.props.testID === 'presenter-stage' && typeof n.props.onResponderGrant === 'function');
  return { stage, commands, sources };
}

type Touch = { identifier: number; pageX: number; pageY: number };
const at = (identifier: number, pageX: number, pageY = 300): Touch => ({ identifier, pageX, pageY });

/** A responder event: `type` the DOM event's, `touches` still down, `changedTouches` the ones this event moved or lifted. */
function ev(type: string, changedTouches: Touch[], touches: Touch[], target: unknown = null) {
  const first = changedTouches[0] ?? { identifier: 0, pageX: 0, pageY: 0 };
  return { target, nativeEvent: { type, target, identifier: first.identifier, pageX: first.pageX, pageY: first.pageY, changedTouches, touches } };
}

function fire(stage: ReactTestInstance, handler: string, event: unknown): void {
  act(() => {
    (stage.props[handler] as (e: unknown) => void)(event);
  });
}

/** A node inside a content target: `closest('[data-stage-target]')` finds the marker. */
const inside = (marker: string) => ({ closest: (selector: string) => (selector === '[data-stage-target]' ? { getAttribute: (name: string) => (name === 'data-stage-target' ? marker : null) } : null) });
const outside = { closest: () => null };

describe('Stage: the touch tracked from the grant (section 6)', () => {
  it('the travel comes from the grant touch by identifier, never from changedTouches[0]', async () => {
    const { stage, commands } = await mount();
    fire(stage, 'onResponderGrant', ev('touchstart', [at(7, 600)], [at(7, 600)], outside));
    fire(stage, 'onResponderStart', ev('touchstart', [at(7, 600)], [at(7, 600)]));
    fire(stage, 'onResponderMove', ev('touchmove', [at(7, 540)], [at(7, 540)]));
    // changedTouches[0] is another touch moving right (dx +100); the tracked one moved left 100: next.
    fire(stage, 'onResponderRelease', ev('touchend', [at(9, 700), at(7, 500)], []));
    expect(commands).toEqual(['next']);
  });

  it('a finger that stays down (touches) still gives its place', async () => {
    const { stage, commands } = await mount();
    fire(stage, 'onResponderGrant', ev('touchstart', [at(2, 500)], [at(2, 500)], outside));
    fire(stage, 'onResponderMove', ev('touchmove', [at(2, 560)], [at(2, 560)]));
    fire(stage, 'onResponderRelease', ev('touchend', [], [at(2, 600)]));
    expect(commands).toEqual(['prev']);
  });

  it('onResponderStart and onResponderMove raise the touch count: two fingers do nothing, whichever lifts first', async () => {
    for (const trackedFirst of [true, false]) {
      const { stage, commands } = await mount();
      fire(stage, 'onResponderGrant', ev('touchstart', [at(1, 700)], [at(1, 700)], outside));
      fire(stage, 'onResponderStart', ev('touchstart', [at(2, 800)], [at(1, 700), at(2, 800)]));
      fire(stage, 'onResponderMove', ev('touchmove', [at(1, 560), at(2, 660)], [at(1, 560), at(2, 660)]));
      if (trackedFirst) {
        fire(stage, 'onResponderEnd', ev('touchend', [at(1, 500)], [at(2, 600)]));
        fire(stage, 'onResponderRelease', ev('touchend', [at(2, 600)], []));
      } else {
        fire(stage, 'onResponderEnd', ev('touchend', [at(2, 600)], [at(1, 500)]));
        fire(stage, 'onResponderRelease', ev('touchend', [at(1, 500)], []));
      }
      expect(commands, trackedFirst ? 'tracked finger first' : 'other finger first').toEqual([]);
    }
  });

  it('a second finger seen only while moving counts too', async () => {
    const { stage, commands } = await mount();
    fire(stage, 'onResponderGrant', ev('touchstart', [at(1, 700)], [at(1, 700)], outside));
    fire(stage, 'onResponderMove', ev('touchmove', [at(1, 600)], [at(1, 600), at(4, 300)]));
    fire(stage, 'onResponderRelease', ev('touchend', [at(1, 500)], []));
    expect(commands).toEqual([]);
  });

  it('a terminated gesture (a stage button took it) does nothing on a later release', async () => {
    const { stage, commands } = await mount();
    fire(stage, 'onResponderGrant', ev('touchstart', [at(1, 700)], [at(1, 700)], outside));
    fire(stage, 'onResponderTerminate', ev('touchcancel', [at(1, 700)], []));
    fire(stage, 'onResponderRelease', ev('touchend', [at(1, 500)], []));
    fire(stage, 'onResponderMove', ev('touchmove', [at(1, 500)], [at(1, 500)]));
    expect(commands).toEqual([]);
  });
});

describe("Stage: the gesture's own pointer (section 4)", () => {
  it('a mousedown grant is the mouse: a click on a target-free slide goes on', async () => {
    const { stage, commands } = await mount();
    fire(stage, 'onResponderGrant', ev('mousedown', [at(0, 100)], [at(0, 100)], outside));
    fire(stage, 'onResponderRelease', ev('mouseup', [at(0, 100)], []));
    expect(commands).toEqual(['next']);
  });

  it('a touchstart grant is touch: a tap on empty stage rings Next (docked) or toggles the bar (overlay)', async () => {
    const docked = await mount();
    fire(docked.stage, 'onResponderGrant', ev('touchstart', [at(1, 640)], [at(1, 640)], outside));
    fire(docked.stage, 'onResponderRelease', ev('touchend', [at(1, 645)], []));
    expect(docked.commands).toEqual(['nudge-next']);
    const overlay = await mount({ layout: 'overlay' });
    fire(overlay.stage, 'onResponderGrant', ev('touchstart', [at(1, 640)], [at(1, 640)], outside));
    fire(overlay.stage, 'onResponderRelease', ev('touchend', [at(1, 640)], []));
    expect(overlay.commands).toEqual(['toggle-bar']);
  });

  it('a mouse event after a pen pointerdown is touch (Windows Chrome sends pen input as mouse events)', async () => {
    // The page's input kind, as the presenter keeps it from subscribeInputKind.
    const listeners = new Map<string, (event: unknown) => void>();
    const win = { addEventListener: (type: string, fn: (event: never) => void) => listeners.set(type, fn as (event: unknown) => void), removeEventListener: () => undefined };
    let last: GesturePointer | null = null;
    const stop = subscribeInputKind((kind) => (last = kind === 'key' ? null : kind), { window: win } as PresenterEnv);
    const { stage, commands } = await mount({ lastPointer: () => last });
    listeners.get('pointerdown')!({ pointerType: 'pen' });
    fire(stage, 'onResponderGrant', ev('mousedown', [at(0, 640)], [at(0, 640)], outside));
    fire(stage, 'onResponderRelease', ev('mouseup', [at(0, 640)], []));
    expect(commands).toEqual(['nudge-next']);
    // A real mouse press after it is the mouse again.
    listeners.get('pointerdown')!({ pointerType: 'mouse' });
    fire(stage, 'onResponderGrant', ev('mousedown', [at(0, 640)], [at(0, 640)], outside));
    fire(stage, 'onResponderRelease', ev('mouseup', [at(0, 640)], []));
    expect(commands).toEqual(['nudge-next', 'next']);
    stop();
  });
});

describe("Stage: a browser's compatibility mouse events after a tap", () => {
  it('a mousedown under COMPAT_MOUSE_MS after a touch ended is dropped: the overlay bar toggles once', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(1_000_000);
      const { stage, commands } = await mount({ layout: 'overlay', lastPointer: () => 'touch' });
      // A tap whose finger moved a little (react-native-web then lets the mouse events through).
      fire(stage, 'onResponderGrant', ev('touchstart', [at(1, 640)], [at(1, 640)], outside));
      fire(stage, 'onResponderMove', ev('touchmove', [at(1, 643)], [at(1, 643)]));
      fire(stage, 'onResponderRelease', ev('touchend', [at(1, 643)], []));
      vi.setSystemTime(1_000_000 + COMPAT_MOUSE_MS - 1);
      fire(stage, 'onResponderGrant', ev('mousedown', [at(0, 643)], [at(0, 643)], outside));
      fire(stage, 'onResponderRelease', ev('mouseup', [at(0, 643)], []));
      expect(commands).toEqual(['toggle-bar']);
      // A later click is a new gesture.
      vi.setSystemTime(1_000_000 + COMPAT_MOUSE_MS + 1);
      fire(stage, 'onResponderGrant', ev('mousedown', [at(0, 643)], [at(0, 643)], outside));
      fire(stage, 'onResponderRelease', ev('mouseup', [at(0, 643)], []));
      expect(commands).toEqual(['toggle-bar', 'toggle-bar']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a touch taken by a stage button (touchcancel) counts as ended too', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(2_000_000);
      const { stage, commands } = await mount();
      fire(stage, 'onResponderGrant', ev('touchstart', [at(1, 640)], [at(1, 640)], outside));
      fire(stage, 'onResponderTerminate', ev('touchcancel', [at(1, 640)], []));
      fire(stage, 'onResponderGrant', ev('mousedown', [at(0, 640)], [at(0, 640)], outside));
      fire(stage, 'onResponderRelease', ev('mouseup', [at(0, 640)], []));
      expect(commands).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Stage: the target read at the grant (section 7.1)', () => {
  it('a tap inside an option points at it only with pointing on; never a step', async () => {
    const off = await mount({ idx: quizIdx });
    fire(off.stage, 'onResponderGrant', ev('mousedown', [at(0, 200)], [at(0, 200)], inside('option:1')));
    fire(off.stage, 'onResponderRelease', ev('mouseup', [at(0, 200)], []));
    expect(off.commands).toEqual([]);
    const on = await mount({ idx: quizIdx, pointing: true });
    fire(on.stage, 'onResponderGrant', ev('touchstart', [at(1, 200)], [at(1, 200)], inside('option:3')));
    fire(on.stage, 'onResponderRelease', ev('touchend', [at(1, 200)], []));
    expect(on.commands).toEqual([{ point: 3 }]);
  });

  it('a tap on a step, a tile or a chip does nothing; a swipe that starts on one still steps', async () => {
    for (const marker of ['step', 'tile', 'chip']) {
      const { stage, commands } = await mount({ idx: quizIdx });
      fire(stage, 'onResponderGrant', ev('touchstart', [at(1, 600)], [at(1, 600)], inside(marker)));
      fire(stage, 'onResponderRelease', ev('touchend', [at(1, 600)], []));
      fire(stage, 'onResponderGrant', ev('touchstart', [at(1, 600)], [at(1, 600)], inside(marker)));
      fire(stage, 'onResponderRelease', ev('touchend', [at(1, 520)], []));
      expect(commands, marker).toEqual(['next']);
    }
  });

  it('a mouse click on empty area of a slide with targets does nothing; a node with no closest() is empty area', async () => {
    const { stage, commands } = await mount({ idx: quizIdx });
    fire(stage, 'onResponderGrant', ev('mousedown', [at(0, 600)], [at(0, 600)], null));
    fire(stage, 'onResponderRelease', ev('mouseup', [at(0, 600)], []));
    expect(commands).toEqual([]);
  });

  it('under the More sheet a tap closes it and a swipe does nothing; under another overlay nothing at all', async () => {
    const more = await mount({ covering: 'more' });
    fire(more.stage, 'onResponderGrant', ev('touchstart', [at(1, 600)], [at(1, 600)], inside('option:1')));
    fire(more.stage, 'onResponderRelease', ev('touchend', [at(1, 600)], []));
    fire(more.stage, 'onResponderGrant', ev('touchstart', [at(1, 600)], [at(1, 600)], outside));
    fire(more.stage, 'onResponderRelease', ev('touchend', [at(1, 450)], []));
    expect(more.commands).toEqual(['close-more']);
    const other = await mount({ covering: 'other' });
    fire(other.stage, 'onResponderGrant', ev('mousedown', [at(0, 600)], [at(0, 600)], outside));
    fire(other.stage, 'onResponderRelease', ev('mouseup', [at(0, 600)], []));
    expect(other.commands).toEqual([]);
  });

  it('the edge guard is the window width less 24 px: a touch swipe from 10 px in does nothing', async () => {
    const { stage, commands } = await mount();
    fire(stage, 'onResponderGrant', ev('touchstart', [at(1, W - 10)], [at(1, W - 10)], outside));
    fire(stage, 'onResponderRelease', ev('touchend', [at(1, W - 200)], []));
    fire(stage, 'onResponderGrant', ev('touchstart', [at(1, 10)], [at(1, 10)], outside));
    fire(stage, 'onResponderRelease', ev('touchend', [at(1, 200)], []));
    expect(commands).toEqual([]);
    expect(byTestId(stage, 'presenter-grabber')).toHaveLength(0);
  });
});

describe('Stage: the source of a step, for lecture.complete (section 12, row PN-6)', () => {
  it('a touch swipe and a mouse drag are swipes; a mouse click that goes on is a click', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(3_000_000);
      const { stage, commands, sources } = await mount();
      fire(stage, 'onResponderGrant', ev('touchstart', [at(1, 700)], [at(1, 700)], outside));
      fire(stage, 'onResponderRelease', ev('touchend', [at(1, 600)], []));
      // The mouse comes later than a tap's compatibility events would.
      vi.setSystemTime(3_000_000 + COMPAT_MOUSE_MS + 1);
      fire(stage, 'onResponderGrant', ev('mousedown', [at(0, 500)], [at(0, 500)], outside));
      fire(stage, 'onResponderMove', ev('mousemove', [at(0, 560)], [at(0, 560)]));
      fire(stage, 'onResponderRelease', ev('mouseup', [at(0, 600)], []));
      fire(stage, 'onResponderGrant', ev('mousedown', [at(0, 640)], [at(0, 640)], outside));
      fire(stage, 'onResponderRelease', ev('mouseup', [at(0, 640)], []));
      expect(commands).toEqual(['next', 'prev', 'next']);
      expect(sources).toEqual(['swipe', 'swipe', 'click']);
    } finally {
      vi.useRealTimers();
    }
  });

  it("a touch tap's compatibility mouse events on a docked, target-free slide are no click step", async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(4_000_000);
      const { stage, commands, sources } = await mount({ lastPointer: () => 'touch' });
      fire(stage, 'onResponderGrant', ev('touchstart', [at(1, 640)], [at(1, 640)], outside));
      fire(stage, 'onResponderMove', ev('touchmove', [at(1, 643)], [at(1, 643)]));
      fire(stage, 'onResponderRelease', ev('touchend', [at(1, 643)], []));
      vi.setSystemTime(4_000_000 + COMPAT_MOUSE_MS - 1);
      fire(stage, 'onResponderGrant', ev('mousedown', [at(0, 643)], [at(0, 643)], outside));
      fire(stage, 'onResponderRelease', ev('mouseup', [at(0, 643)], []));
      // The touch tap alone answers (it never steps); the mouse events after it are dropped, so
      // nothing reaches the stepper to be counted as a mouse click.
      expect(commands).toHaveLength(1);
      expect(commands).not.toContain('next');
      expect(commands).not.toContain('prev');
    } finally {
      vi.useRealTimers();
    }
  });
});
