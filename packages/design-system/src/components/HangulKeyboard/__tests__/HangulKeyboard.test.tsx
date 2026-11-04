import type { ReactElement, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { layoutClassFor } from '../../../layout';
import { KEY_BOUNCE_MS, TAP_LOCK_MS, type TapRect } from '../../../tap-model';
import { colors, spacing, touchTarget } from '../../../tokens';
import { createTapBoardController, type TapAppLock, type TapControllerConfig, type TapResponderEvent } from '../../TapBoard/controller';
import { HangulKeyboard } from '../HangulKeyboard';
import { keyboardWidth } from '../layout';
import type { HangulKeyboardProps } from '../types';

/**
 * The Type Hangul keyboard under touch (docs/specs/AMENDMENTS-TOUCH.md section 6.7, KT-D7, row KT-7; fixes F7). The
 * keyboard is called directly with react-native's hosts and the TapBoard components as plain tags (as Tile.test.tsx
 * does); its `TapTarget`s, with their own `onCommit`, rectangles and `lockMs`, are then registered on the real board
 * controller with the board's own props, and driven with responder events as react-native-web sends them, on a manual
 * clock. So these cases run the keyboard's own commit path through the real `each` rules.
 */
vi.mock('react-native', () => ({ View: 'View', Text: 'Text' }));
vi.mock('../../Icon', () => ({ Icon: 'Icon' }));
vi.mock('../../TapBoard', async () => {
  const { pressLook } = await import('../../../press-look');
  return { TapBoard: 'TapBoard', TapTarget: 'TapTarget', usePressLook: () => pressLook(false) };
});
// One render: state is its initial value, a ref lives as long as the closures that hold it.
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  const stubs = {
    useState: <T,>(initial: T) => [initial, () => undefined] as const,
    useRef: <T,>(initial: T) => ({ current: initial }),
  };
  return { ...actual, ...stubs, default: { ...actual, ...stubs } };
});

type Props = Record<string, unknown>;
type El = ReactElement<Props>;

const LABELS: HangulKeyboardProps['labels'] = { key: (jamo, sound) => `${jamo}, ${sound}`, shift: 'Shift', delete: 'Delete', space: 'Space' };

/** The keyboard a 320 px phone gets (split, 64 x 64 cells), as Type Hangul sizes it. */
function render(props: Partial<HangulKeyboardProps> = {}): { board: El; keys: El[]; typed: string[] } {
  const typed: string[] = [];
  const lc = layoutClassFor({ width: 320, height: 640 });
  const board = HangulKeyboard({
    onKey: (jamo) => typed.push(jamo),
    onDelete: () => typed.push('Del'),
    onSpace: () => typed.push('Space'),
    width: keyboardWidth(lc, 320),
    layoutClass: lc,
    soundOf: () => 's',
    labels: LABELS,
    testID: 'hangul-key',
    ...props,
  }) as El;
  const tray = board.props.children as El;
  const keys = (tray.props.children as ReactNode[]).flat() as El[];
  return { board, keys, typed };
}

const idOf = (key: El): string => String(key.props.testID).replace('hangul-key-', '');
const rectOf = (key: El): TapRect => {
  const s = key.props.style as { left: number; top: number; width: number; height: number };
  return { x: s.left, y: s.top, width: s.width, height: s.height };
};

/** The rendered keyboard on the real controller, with the board's own props and a manual clock. */
function keyboard(props: Partial<HangulKeyboardProps> = {}, app: TapAppLock | null = null) {
  const { board, keys, typed } = render(props);
  const clock = { now: 1000 };
  const config: TapControllerConfig = {
    lock: board.props.lock as TapControllerConfig['lock'],
    multiTouch: board.props.multiTouch as TapControllerConfig['multiTouch'],
    scroll: board.props.scroll as TapControllerConfig['scroll'],
    disabled: board.props.disabled === true,
  };
  const rects = new Map<string, TapRect>();
  const controller = createTapBoardController(
    {
      now: () => clock.now,
      timeOf: () => clock.now,
      rectOf: (node) => rects.get(node as string) ?? null,
      hitAt: () => undefined,
      appLock: () => app,
      scroller: () => null,
      onPressedChange: () => undefined,
      onLockChange: () => undefined,
      setTimer: () => null,
      clearTimer: () => undefined,
    },
    config,
  );
  for (const key of keys) {
    const id = idOf(key);
    rects.set(id, rectOf(key));
    controller.register(id, {
      node: () => id,
      disabled: () => key.props.disabled === true,
      lockMs: key.props.lockMs as number,
      commit: key.props.onCommit as () => void,
    });
  }
  const centre = (id: string): { x: number; y: number } => {
    const r = rects.get(id)!;
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  };
  const ev = (finger: number, at: { x: number; y: number }, type: string): TapResponderEvent => {
    const touch = { identifier: finger, pageX: at.x, pageY: at.y, target: null };
    return { nativeEvent: { changedTouches: [touch], ...touch, type } };
  };
  const h = controller.handlers;
  const down = (finger: number, at: { x: number; y: number }): void => {
    h.onStartShouldSetResponderCapture(ev(finger, at, 'touchstart'));
    h.onResponderStart(ev(finger, at, 'touchstart'));
  };
  const move = (finger: number, at: { x: number; y: number }): void => h.onResponderMove(ev(finger, at, 'touchmove'));
  const up = (finger: number, at: { x: number; y: number }): void => h.onResponderEnd(ev(finger, at, 'touchend'));
  /** A tap of 40 ms on a key; the clock ends at its release. */
  const tap = (id: string): void => {
    down(1, centre(id));
    clock.now += 40;
    up(1, centre(id));
  };
  return { keys, typed, clock, rects, centre, down, move, up, tap };
}

describe('HangulKeyboard: one TapBoard, each finger on its own (AMENDMENTS-TOUCH 6.7, KT-D7)', () => {
  it('is one target board with multiTouch "each" and scroll "none"; disabled passes to the board and every key', () => {
    const { board, keys } = render();
    expect(board.type).toBe('TapBoard');
    expect(board.props).toMatchObject({ lock: 'target', multiTouch: 'each', scroll: 'none', disabled: false });
    expect(keys).toHaveLength(29);
    expect(keys.every((k) => k.type === 'TapTarget')).toBe(true);
    const off = render({ disabled: true });
    expect(off.board.props.disabled).toBe(true);
    expect(off.keys.every((k) => k.props.disabled === true)).toBe(true);
  });

  it('letters, Delete and Space lock for KEY_BOUNCE_MS (120, motion.duration.fast); only Shift for TAP_LOCK_MS (400)', () => {
    const { keys } = render();
    for (const key of keys) expect(key.props.lockMs, idOf(key)).toBe(idOf(key) === 'shift' ? TAP_LOCK_MS : KEY_BOUNCE_MS);
    expect(KEY_BOUNCE_MS).toBe(120);
  });

  it('hit cells stay edge to edge at 64 x 64 on a 320 px phone: the padding (spacing.xxs) is inside each key', () => {
    const { keys } = render();
    const rects = keys.map(rectOf);
    for (const [i, key] of keys.entries()) {
      expect((key.props.style as Props).padding).toBe(spacing.xxs);
      expect(rects[i]!.height).toBe(touchTarget.min);
      expect(rects[i]!.width).toBeGreaterThanOrEqual(touchTarget.min);
    }
    // Within a row, every key starts where the one before it ends: no dead line between keys.
    const rows = [...new Set(rects.map((r) => r.y))];
    for (const y of rows) {
      const row = rects.filter((r) => r.y === y).sort((a, b) => a.x - b.x);
      for (let i = 1; i < row.length; i++) expect(row[i]!.x).toBe(row[i - 1]!.x + row[i - 1]!.width);
    }
  });

  it('Shift keeps aria-pressed and its selected state', () => {
    const shift = render().keys.find((k) => idOf(k) === 'shift')!;
    expect(shift.props.ariaPressed).toBe(false);
    expect(shift.props.accessibilityState).toEqual({ selected: false });
  });

  it('the press look is the outline and shrink of section 4.3, never the old primaryLight fill', () => {
    const key = render().keys.find((k) => idOf(k) === 'ㄱ')!;
    const face = (pressed: boolean): Props => ((key.props.children as (l: { pressed: boolean }) => El)({ pressed }).props.style as Props);
    expect(face(true).borderColor).toBe(colors.border.shape);
    expect(face(true).backgroundColor).toBe(colors.surface.paper);
    expect(face(true).transform).toEqual([{ scale: 0.97 }]);
    expect(face(false).transform).toBeUndefined();
  });
});

describe('HangulKeyboard under touch (F7)', () => {
  it('a rollover types both letters, in the order the fingers lift', () => {
    const k = keyboard();
    k.down(1, k.centre('ㅎ'));
    k.clock.now += 30;
    k.down(2, k.centre('ㅗ'));
    k.clock.now += 30;
    k.up(1, k.centre('ㅎ'));
    k.clock.now += 30;
    k.up(2, k.centre('ㅗ'));
    expect(k.typed).toEqual(['ㅎ', 'ㅗ']);
    // The second finger lifts first: its letter comes first.
    k.clock.now += 500;
    k.down(1, k.centre('ㄴ'));
    k.clock.now += 30;
    k.down(2, k.centre('ㅏ'));
    k.clock.now += 30;
    k.up(2, k.centre('ㅏ'));
    k.clock.now += 30;
    k.up(1, k.centre('ㄴ'));
    expect(k.typed).toEqual(['ㅎ', 'ㅗ', 'ㅏ', 'ㄴ']);
  });

  it('an 18 px slide on a key types that key; a slide onto a neighbour types the neighbour; a lift off the keyboard types nothing', () => {
    const k = keyboard();
    const g = k.centre('ㄱ');
    k.down(1, g);
    k.move(1, { x: g.x + 9, y: g.y });
    k.up(1, { x: g.x + 18, y: g.y });
    expect(k.typed).toEqual(['ㄱ']);
    k.clock.now += 500;
    // ㄱ to ㅅ, its right-hand neighbour: the key under the finger at release types.
    k.down(1, g);
    k.move(1, { x: g.x + 40, y: g.y });
    k.up(1, { x: g.x + 50, y: g.y });
    expect(k.typed).toEqual(['ㄱ', 'ㅅ']);
    k.clock.now += 500;
    // Up off the keyboard, past the gap reach.
    k.down(1, g);
    k.move(1, { x: g.x, y: -40 });
    k.up(1, { x: g.x, y: -100 });
    expect(k.typed).toEqual(['ㄱ', 'ㅅ']);
  });

  it('0, 8, 16, 24 and 32 px slides type the key under the finger at release', () => {
    const k = keyboard();
    const r = k.rects.get('ㅇ')!;
    // From 20 px inside the key's top-left corner: rightwards and downwards stay on ㅇ, leftwards and upwards cross to
    // ㄴ and ㅈ once the finger is past the edge.
    const from = { x: r.x + 20, y: r.y + 20 };
    const expected: string[] = [];
    const keyAt = (p: { x: number; y: number }): string =>
      [...k.rects.entries()].find(([, q]) => p.x > q.x && p.x < q.x + q.width && p.y > q.y && p.y < q.y + q.height)?.[0] ?? '';
    for (const d of [0, 8, 16, 24, 32]) {
      for (const [dx, dy] of [[d, 0], [0, d], [-d, 0], [0, -d]] as const) {
        const end = { x: from.x + dx, y: from.y + dy };
        k.down(1, from);
        k.move(1, end);
        k.up(1, end);
        expected.push(keyAt(end));
        k.clock.now += 500;
      }
    }
    expect(k.typed).toEqual(expected);
    expect(new Set(expected)).toEqual(new Set(['ㅇ', 'ㄴ', 'ㄷ']));
  });

  for (const [id, out] of [['ㄱ', 'ㄱ'], ['delete', 'Del'], ['space', 'Space']] as const) {
    it(`${id}: a repeat within 120 ms is a bounce and is dropped; one at 150 ms types`, () => {
      const k = keyboard();
      k.tap(id);
      k.clock.now += 100;
      k.tap(id);
      expect(k.typed).toEqual([out]);
      k.clock.now += 150;
      k.tap(id);
      expect(k.typed).toEqual([out, out]);
    });
  }

  it('three deletes 150 to 250 ms apart erase three letters', () => {
    const k = keyboard();
    k.tap('delete');
    k.clock.now += 150;
    k.tap('delete');
    k.clock.now += 250;
    k.tap('delete');
    expect(k.typed).toEqual(['Del', 'Del', 'Del']);
  });

  it('two different letters 30 ms apart both type (the bounce is per key)', () => {
    const k = keyboard();
    k.tap('ㅂ');
    k.clock.now += 30;
    k.tap('ㅣ');
    expect(k.typed).toEqual(['ㅂ', 'ㅣ']);
  });

  it('Shift toggles only outside its 400 ms lock: a bounce on Shift leaves it on, and it stays one-shot', () => {
    const k = keyboard();
    k.tap('shift');
    k.clock.now += 300;
    k.tap('shift'); // a bounce: dropped, Shift stays on
    k.clock.now += 50;
    k.tap('ㄱ');
    expect(k.typed).toEqual(['ㄲ']);
    // One-shot: the next letter is plain.
    k.clock.now += 200;
    k.tap('ㄱ');
    expect(k.typed).toEqual(['ㄲ', 'ㄱ']);
    // On, and off again once its lock has run out: the letter is plain.
    k.clock.now += 200;
    k.tap('shift');
    k.clock.now += 450;
    k.tap('shift');
    k.clock.now += 50;
    k.tap('ㅅ');
    expect(k.typed).toEqual(['ㄲ', 'ㄱ', 'ㅅ']);
  });

  it('a rollover after Shift: the first letter to lift takes Shift, the second is plain', () => {
    const k = keyboard();
    k.tap('shift');
    k.clock.now += 100;
    k.down(1, k.centre('ㄱ'));
    k.down(2, k.centre('ㅅ'));
    k.clock.now += 30;
    k.up(1, k.centre('ㄱ'));
    k.up(2, k.centre('ㅅ'));
    expect(k.typed).toEqual(['ㄲ', 'ㅅ']);
  });

  it('neither reads nor sets the app-level lock: keys type while it is on, and a key never extends it', () => {
    const extended: number[] = [];
    const app: TapAppLock = { until: () => Number.MAX_SAFE_INTEGER, extendTo: (at) => extended.push(at) };
    const k = keyboard({}, app);
    k.tap('ㅁ');
    k.clock.now += 200;
    k.tap('shift');
    expect(k.typed).toEqual(['ㅁ']);
    expect(extended).toEqual([]);
  });

  it('disabled: keys are drawn but no touch types', () => {
    const k = keyboard({ disabled: true });
    k.tap('ㅁ');
    expect(k.typed).toEqual([]);
  });
});
