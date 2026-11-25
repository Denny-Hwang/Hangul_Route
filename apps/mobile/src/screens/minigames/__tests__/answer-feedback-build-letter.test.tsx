import { HoyaBubble, Icon, LayoutProvider, colors, TAP_LOCK_MS, TapLockProvider, layoutClassFor } from '@hangul-route/design-system';
import { getMessages } from '@hangul-route/i18n';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jamoAll } from '../../../content/jamo';
import { answerAnnouncement, RESULT_MARK_MIN_MS, type AnswerResult } from '../../../logic/answer-feedback';
import { blockShape, shapeHint, shapePlaceHeight } from '../../../logic/build-letter-view';
import type { MinigameScope } from '../../../logic/minigame-config';
import { useLocaleStore } from '../../../store/locale-store';
import { useQuestRunStore } from '../../../store/quest-run-store';
import { byTestId, hostNodes, render, resetPlatform, setPlatform, textOf, unmount, type RenderPlatform } from '../../../test-support/render';
import { BuildLetterGame } from '../BuildLetterGame';

/**
 * F-A11Y-001 row AF-4a (§6 test 15), Build a Letter: a `check` on the target box after a right block; each result said
 * once through the answer announcer; a wrong build STAYS in the slots with the shape picture and Hoya's line until the
 * learner takes a tile back, taps Undo or taps a tray tile (OD-AF7 (i)), with the picture's place kept under the slots at
 * the block's own height in every state (AnswerFeedback D7); the 1000 ms floor with the reader off; with the reader on
 * Next (OD-AF9 (b)), the last round included, and focus on the round's header node.
 */
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const sr = vi.hoisted(() => ({ enabled: false, queued: [] as string[], focused: [] as unknown[], log: [] as string[] }));
vi.mock('../../../platform/screen-reader', async (orig) => ({
  ...(await orig<object>()),
  isScreenReaderEnabled: () => Promise.resolve(sr.enabled),
  subscribeScreenReader: () => () => undefined,
  announceQueued: (text: string) => {
    if ((globalThis as { __os?: string }).__os === 'ios') sr.queued.push(text);
  },
  announceAndWait: (text: string) => {
    sr.log.push(`announce: ${text}`);
    return Promise.resolve();
  },
  focusForScreenReader: (node: unknown) => {
    sr.focused.push(node);
    sr.log.push(`focus: ${(node as { testID?: string } | null)?.testID}`);
  },
}));
vi.mock('../../../platform/audio', async (importOriginal) => ({ ...(await importOriginal<object>()), playPrompt: vi.fn(async () => 'played'), stop: vi.fn() }));
vi.mock('../../../platform/telemetry', async (importOriginal) => ({ ...(await importOriginal<object>()), track: vi.fn(async () => undefined) }));

const m = getMessages('en');
const copy = m.learner.minigame;
const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/;
const idOf = (char: string, kind: 'consonant' | 'vowel' | 'batchim'): string => jamoAll.find((j) => j.char === char && j.kind === kind)!.id;
const G = idOf('ㄱ', 'consonant');
const A = idOf('ㅏ', 'vowel');
const O = idOf('ㅗ', 'vowel');

const scope = (syllables: MinigameScope['syllables']): MinigameScope => ({ kind: 'build-letter', rounds: syllables?.length ?? 0, syllables });
const GA2 = scope([
  { ko: '가', romanization: 'ga', jamoChars: ['ㄱ', 'ㅏ'] },
  { ko: '나', romanization: 'na', jamoChars: ['ㄴ', 'ㅏ'] },
]);
const GA1 = scope([{ ko: '가', romanization: 'ga', jamoChars: ['ㄱ', 'ㅏ'] }]);
const GO1 = scope([{ ko: '고', romanization: 'go', jamoChars: ['ㄱ', 'ㅗ'] }]);

const nodeMock = (el: { props: Record<string, unknown> }): unknown => ({
  testID: el.props['data-testid'],
  focus: () => undefined,
  nodeType: 1,
  getBoundingClientRect: () => ({ left: -10_000, top: -10_000, width: 0, height: 0 }),
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  contains: () => false,
  setAttribute: () => undefined,
  removeAttribute: () => undefined,
});
const mounted: ReactTestRenderer[] = [];
const open = async (s: MinigameScope, onFinish: () => void = () => undefined): Promise<ReactTestRenderer> => {
  const r = await render(
    <LayoutProvider value={layoutClassFor({ width: 320, height: 640 })}>
      <TapLockProvider>
        <BuildLetterGame scope={s} onFinish={onFinish} />
      </TapLockProvider>
    </LayoutProvider>,
    { createNodeMock: nodeMock },
  );
  mounted.push(r);
  await tick(TAP_LOCK_MS);
  return r;
};
const host = (root: ReactTestInstance, testId: string): ReactTestInstance => {
  const found = byTestId(root, testId)[0];
  if (!found) throw new Error(`no ${testId}`);
  return found;
};
/** A click as react-native-web's press responder gets it, without moving the tap clock (the test drives it). */
const click = async (root: ReactTestInstance, testId: string): Promise<void> => {
  const target = host(root, testId);
  const onClick = target.props.onClick as ((e: unknown) => void) | undefined;
  if (onClick === undefined) return;
  const currentTarget = { getAttribute: (name: string): unknown => target.props[name] ?? null, tagName: String(target.type) };
  await act(async () => {
    onClick({ altKey: false, currentTarget, nativeEvent: {}, preventDefault: () => undefined, stopPropagation: () => undefined });
  });
};
const tick = async (ms: number): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};
const on = (os: RenderPlatform): void => {
  setPlatform(os);
  (globalThis as { __os?: string }).__os = os;
};
const readerOnWeb = (): void => useLocaleStore.setState({ screenReader: true });
const tile = (id: string): string => `build-letter-tile-${id}`;

const slots = (root: ReactTestInstance): string[] =>
  [0, 1, 2]
    .filter((i) => byTestId(root, `build-letter-slot-${i}`).length > 0)
    .map((i) => textOf(host(root, `build-letter-slot-${i}`)));
const marks = (node: ReactTestInstance): string[] => node.findAll((n) => n.type === Icon).map((n) => String(n.props.name));
const announced = (r: ReactTestRenderer): string[] =>
  hostNodes(host(r.root, 'answer-announcer'), () => true)
    .flatMap((n) => n.children)
    .filter((c): c is string => typeof c === 'string');
const bubbleLive = (r: ReactTestRenderer): boolean[] => r.root.findAllByType(HoyaBubble).map((b) => b.props.live !== false);
const line = (result: AnswerResult): string => answerAnnouncement(result, m.a11y).map((x) => x.text).join('');
const has = (root: ReactTestInstance, testId: string): boolean => byTestId(root, testId).length > 0;
const shapeOf = (ids: string[]) => blockShape(ids);
const GA_SHAPE = shapeOf([G, A]);
const MISS_LINE = (shape: ReturnType<typeof blockShape>): string => line({ kind: 'line', text: copy.buildLetter.notQuite(shapeHint(shape, copy.buildLetter.shape)) });
/** The distractor tiles of round 1 (every tray tile that is neither ㄱ nor ㅏ). */
const distractors = (root: ReactTestInstance, parts: string[]): string[] => {
  const ids = new Set(root.findAll((n) => typeof n.props['data-testid'] === 'string' && String(n.props['data-testid']).startsWith('build-letter-tile-')).map((n) => String(n.props['data-testid']).slice('build-letter-tile-'.length)));
  return [...ids].filter((id) => !parts.includes(id));
};
const answers: Array<[string | number, boolean]> = [];

/** Builds ㅏ then ㄱ: a full block in the wrong order, one scored miss. */
const miss = async (r: ReactTestRenderer): Promise<void> => {
  await click(r.root, tile(A));
  await tick(TAP_LOCK_MS);
  await click(r.root, tile(G));
};
const right = async (r: ReactTestRenderer): Promise<void> => {
  await click(r.root, tile(G));
  await tick(TAP_LOCK_MS);
  await click(r.root, tile(A));
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'] });
  answers.length = 0;
  useQuestRunStore.setState({ answerRound: (key, correct) => answers.push([key, correct]), markStepComplete: () => undefined });
  sr.enabled = false;
  sr.queued.length = 0;
  sr.focused.length = 0;
  sr.log.length = 0;
  useLocaleStore.setState({ screenReader: false });
  on('web');
});
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  vi.useRealTimers();
  resetPlatform();
  (globalThis as { __os?: string }).__os = undefined;
  useLocaleStore.setState({ screenReader: false });
});

describe('Build a Letter: the target box (test 15)', () => {
  it('shows a check after a right block and none before, nor after a miss; the speaker keeps its "Hear …" name', async () => {
    const r = await open(GA2);
    const speaker = (): ReactTestInstance => host(r.root, 'build-letter-speaker');
    expect(marks(speaker())).toEqual([]);
    await miss(r);
    expect(marks(speaker())).toEqual([]);
    // Take one tile back and finish it right.
    await tick(TAP_LOCK_MS);
    await click(r.root, 'build-letter-undo');
    await tick(TAP_LOCK_MS);
    await click(r.root, 'build-letter-undo');
    await tick(TAP_LOCK_MS);
    await right(r);
    expect(marks(speaker())).toEqual(['check']);
    expect(speaker().props['aria-label']).toBe(m.a11y.minigame.hear('ga'));
  });
});

describe('Build a Letter: the announcer (test 15)', () => {
  it('says the miss line once and the right line once; Hoya\'s miss bubble is not live', async () => {
    const r = await open(GA2);
    expect(announced(r)).toEqual([]);
    expect(bubbleLive(r)).toEqual([]);
    await miss(r);
    expect(announced(r)).toEqual([MISS_LINE(GA_SHAPE)]);
    expect(bubbleLive(r)).toEqual([false]);
    await tick(TAP_LOCK_MS);
    await click(r.root, 'build-letter-slot-0');
    await tick(TAP_LOCK_MS);
    await click(r.root, 'build-letter-undo');
    await tick(TAP_LOCK_MS);
    await right(r);
    expect(announced(r)).toEqual([line({ kind: 'right', item: 'ga' })]);
    expect(announced(r)[0]).not.toMatch(HANGUL);
  });

  it('iOS: one queued call per result', async () => {
    on('ios');
    const r = await open(GA2);
    await miss(r);
    expect(sr.queued).toEqual([MISS_LINE(GA_SHAPE)]);
    await tick(TAP_LOCK_MS);
    await click(r.root, 'build-letter-undo');
    await tick(TAP_LOCK_MS);
    await click(r.root, 'build-letter-undo');
    await tick(TAP_LOCK_MS);
    await right(r);
    expect(sr.queued).toEqual([MISS_LINE(GA_SHAPE), line({ kind: 'right', item: 'ga' })]);
  });
});

describe('Build a Letter: a wrong build stays (OD-AF7 (i))', () => {
  it('stays in the slots with the shape picture and Hoya\'s line, with no timer: 900 ms and 10 s later it is all still there', async () => {
    const r = await open(GA2);
    await miss(r);
    expect(answers).toEqual([[0, false]]);
    for (const wait of [900, 10_000]) {
      await tick(wait);
      expect(slots(r.root)).toEqual(['ㅏ', 'ㄱ']);
      expect(has(r.root, 'build-letter-shape')).toBe(true);
      expect(has(r.root, 'build-letter-hoya')).toBe(true);
    }
    expect(answers).toEqual([[0, false]]);
  });

  it('the shape picture is named for a screen reader', async () => {
    const r = await open(GA2);
    await miss(r);
    expect(host(r.root, 'build-letter-shape').props['aria-label']).toBe(m.a11y.minigame.blockShape(shapeHint(GA_SHAPE, copy.buildLetter.shape)));
  });

  it('a slot tap takes that tile back and ends the miss: the picture and Hoya\'s line go', async () => {
    const r = await open(GA2);
    await miss(r);
    await tick(TAP_LOCK_MS);
    await click(r.root, 'build-letter-slot-0');
    expect(slots(r.root)).toEqual(['ㄱ', '']);
    expect(has(r.root, 'build-letter-shape')).toBe(false);
    expect(has(r.root, 'build-letter-hoya')).toBe(false);
    expect(answers).toEqual([[0, false]]);
  });

  it('Undo takes the last tile back and ends the miss; it is on while the miss shows', async () => {
    const r = await open(GA2);
    await miss(r);
    await tick(TAP_LOCK_MS);
    expect(host(r.root, 'build-letter-undo').props['aria-disabled']).not.toBe(true);
    await click(r.root, 'build-letter-undo');
    expect(slots(r.root)).toEqual(['ㅏ', '']);
    expect(has(r.root, 'build-letter-shape')).toBe(false);
    expect(has(r.root, 'build-letter-hoya')).toBe(false);
  });

  it('a tray tile empties the slots and starts a new build with that tile; a used tile does nothing', async () => {
    const r = await open(GA2);
    await miss(r);
    await tick(TAP_LOCK_MS);
    await click(r.root, tile(A));
    expect(slots(r.root)).toEqual(['ㅏ', 'ㄱ']);
    expect(has(r.root, 'build-letter-shape')).toBe(true);
    const other = distractors(r.root, [G, A])[0]!;
    await click(r.root, tile(other));
    expect(slots(r.root)).toEqual([jamoAll.find((j) => j.id === other)!.char, '']);
    expect(has(r.root, 'build-letter-shape')).toBe(false);
    expect(has(r.root, 'build-letter-hoya')).toBe(false);
    // The new build is a fresh attempt: no extra miss was scored.
    expect(answers).toEqual([[0, false]]);
  });

  it('a bounce right after the miss is swallowed, not read as the start of a new build', async () => {
    const r = await open(GA2);
    await miss(r);
    const other = distractors(r.root, [G, A])[0]!;
    await tick(TAP_LOCK_MS - 100);
    await click(r.root, tile(other));
    expect(slots(r.root)).toEqual(['ㅏ', 'ㄱ']);
    await tick(100);
    await click(r.root, tile(other));
    expect(slots(r.root)).toEqual([jamoAll.find((j) => j.id === other)!.char, '']);
  });

  it('after a fresh build the next miss is scored and shown again', async () => {
    const r = await open(GA2);
    await miss(r);
    await tick(TAP_LOCK_MS);
    await click(r.root, 'build-letter-undo');
    await tick(TAP_LOCK_MS);
    await click(r.root, 'build-letter-undo');
    await tick(TAP_LOCK_MS);
    await miss(r);
    expect(answers).toEqual([[0, false], [0, false]]);
    expect(has(r.root, 'build-letter-shape')).toBe(true);
    expect(announced(r)).toEqual([MISS_LINE(GA_SHAPE)]);
  });
});

describe('Build a Letter: the slots of a wrong build take the nudge look (AnswerFeedback D7)', () => {
  /** Every colour a slot's box draws (react-native-web resolves the style object into the host's `style`). */
  const paint = (root: ReactTestInstance, i: number): string => {
    const found = byTestId(root, `build-letter-slot-${i}`).flatMap((n) => hostNodes(n, () => true));
    return JSON.stringify(found.map((n) => n.props.style));
  };
  const hex = (c: string): string => {
    const n = Number.parseInt(c.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},1.00)`;
  };

  it('a wrong build draws amber slots (nudgeLight fill, nudge border), never the danger colour; a fresh build is back to the brand look', async () => {
    const r = await open(GA2);
    await click(r.root, tile(G));
    await tick(TAP_LOCK_MS);
    expect(paint(r.root, 0)).toContain(hex(colors.brand.primaryLight));
    await click(r.root, 'build-letter-undo');
    await tick(TAP_LOCK_MS);
    await miss(r);
    for (const i of [0, 1]) {
      expect(paint(r.root, i)).toContain(hex(colors.feedback.nudgeLight));
      expect(paint(r.root, i)).toContain(hex(colors.feedback.nudge));
      expect(paint(r.root, i)).not.toContain(hex(colors.feedback.danger));
      expect(paint(r.root, i)).not.toContain(hex(colors.brand.primaryLight));
    }
    await tick(TAP_LOCK_MS);
    await click(r.root, 'build-letter-undo');
    expect(paint(r.root, 0)).toContain(hex(colors.brand.primaryLight));
  });
});

describe('Build a Letter: the shape picture\'s place (AnswerFeedback D7)', () => {
  const place = (root: ReactTestInstance): ReactTestInstance => host(root, 'build-letter-shape-place');
  /** The place's height as drawn (react-native-web resolves it into the host's style). */
  const heightOf = (node: ReactTestInstance): number => {
    const flat = ([] as unknown[]).concat(node.props.style).flat(Infinity).filter(Boolean) as Array<Record<string, unknown>>;
    const h = flat.reduce<unknown>((acc, style) => ('height' in style ? style.height : acc), undefined);
    return typeof h === 'string' ? Number.parseFloat(h) : Number(h);
  };

  it('is there in every state at the block\'s own height: idle, a miss and a right block (beside: 40)', async () => {
    const r = await open(GA2);
    const want = shapePlaceHeight(GA_SHAPE, 40, 8);
    expect(want).toBe(40);
    expect(heightOf(place(r.root))).toBe(want);
    await miss(r);
    expect(heightOf(place(r.root))).toBe(want);
    await tick(TAP_LOCK_MS);
    await click(r.root, 'build-letter-undo');
    await tick(TAP_LOCK_MS);
    await click(r.root, 'build-letter-undo');
    await tick(TAP_LOCK_MS);
    await right(r);
    expect(heightOf(place(r.root))).toBe(want);
  });

  it('a two-row block (ㄱ + ㅗ, the vowel under) keeps 88', async () => {
    const r = await open(GO1);
    expect(heightOf(place(r.root))).toBe(shapePlaceHeight(shapeOf([G, O]), 40, 8));
    expect(heightOf(place(r.root))).toBe(88);
  });

  it('the picture is empty until a miss, and the order is target, slots, picture, Undo, tray, Hoya\'s line', async () => {
    const r = await open(GA2);
    expect(has(r.root, 'build-letter-shape')).toBe(false);
    await miss(r);
    const order = ['build-letter-speaker', 'build-letter-slot-0', 'build-letter-shape', 'build-letter-undo', tile(G), 'build-letter-hoya'];
    const dump = JSON.stringify(r.toJSON());
    const at = order.map((id) => dump.indexOf(`"data-testid":"${id}"`));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });
});

describe('Build a Letter: the advance (test 15)', () => {
  it('reader off: the next round comes after the floor (not at 900 ms), and focus does not move', async () => {
    const r = await open(GA2);
    const roundIsOne = (): boolean => has(r.root, tile(G));
    await right(r);
    await tick(900);
    expect(roundIsOne()).toBe(true);
    await tick(RESULT_MARK_MIN_MS - 900 - 1);
    expect(roundIsOne()).toBe(true);
    await tick(1);
    expect(roundIsOne()).toBe(false);
    expect(sr.focused).toEqual([]);
    expect(announced(r)).toEqual([]);
    expect(has(r.root, 'build-letter-next')).toBe(false);
  });

  it('reader off: the last right block ends the step after the floor, once; leaving the game first ends nothing', async () => {
    const finish = vi.fn();
    const r = await open(GA1, finish);
    await right(r);
    await tick(RESULT_MARK_MIN_MS - 1);
    expect(finish).not.toHaveBeenCalled();
    await tick(1);
    expect(finish).toHaveBeenCalledTimes(1);

    const gone = vi.fn();
    const g = await open(GA1, gone);
    await right(g);
    await unmount(g);
    await tick(RESULT_MARK_MIN_MS * 3);
    expect(gone).not.toHaveBeenCalled();
  });

  it('reader on: Next takes focus, nothing moves on by itself, then focus goes to the header node (the heading and the romanization, no Hangul)', async () => {
    readerOnWeb();
    const r = await open(GA2);
    await miss(r);
    expect(has(r.root, 'build-letter-next')).toBe(false);
    await tick(TAP_LOCK_MS);
    await click(r.root, 'build-letter-undo');
    await tick(TAP_LOCK_MS);
    await click(r.root, 'build-letter-undo');
    await tick(TAP_LOCK_MS);
    await right(r);
    expect(has(r.root, 'build-letter-next')).toBe(true);
    expect(sr.focused).toEqual([expect.objectContaining({ testID: 'build-letter-next' })]);
    await tick(60_000);
    expect(has(r.root, tile(G))).toBe(true);
    expect(announced(r)).toEqual([line({ kind: 'right', item: 'ga' })]);

    await tick(TAP_LOCK_MS);
    await click(r.root, 'build-letter-next');
    expect(has(r.root, 'build-letter-next')).toBe(false);
    expect(announced(r)).toEqual([]);
    const header = host(r.root, 'build-letter-round');
    expect(sr.focused.at(-1)).toEqual(expect.objectContaining({ testID: 'build-letter-round' }));
    expect(header.props.role).toBe('heading');
    expect(String(header.props['aria-label'])).toBe(m.a11y.answer.round(2, 2, `${copy.buildLetter.heading} na`));
    expect(String(header.props['aria-label'])).not.toMatch(HANGUL);
  });

  it('reader on: the last round also shows Next, the step ends when it is pressed, and a second Next ends it once', async () => {
    readerOnWeb();
    const finish = vi.fn();
    const r = await open(GA1, finish);
    await right(r);
    await tick(60_000);
    expect(finish).not.toHaveBeenCalled();
    await tick(TAP_LOCK_MS);
    const shown = host(r.root, 'build-letter-next');
    const next = { props: shown.props, type: shown.type } as ReactTestInstance;
    const press = async (): Promise<void> => {
      const currentTarget = { getAttribute: (name: string): unknown => next.props[name] ?? null, tagName: String(next.type) };
      await act(async () => {
        (next.props.onClick as (e: unknown) => void)({ altKey: false, currentTarget, nativeEvent: {}, preventDefault: () => undefined, stopPropagation: () => undefined });
      });
    };
    await press();
    await tick(TAP_LOCK_MS);
    await press();
    expect(finish).toHaveBeenCalledTimes(1);
  });

  it('iOS, reader on: focus moves to Next first, then the line is queued', async () => {
    on('ios');
    sr.enabled = true;
    const r = await open(GA2);
    await right(r);
    expect(sr.log).toEqual(['focus: build-letter-next', `announce: ${line({ kind: 'right', item: 'ga' })}`]);
  });
});
