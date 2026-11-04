import { LayoutProvider, TAP_LOCK_MS, TapLockProvider, layoutClassFor } from '@hangul-route/design-system';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jamoAll } from '../../../content/jamo';
import type { MinigameScope } from '../../../logic/minigame-config';
import { useQuestRunStore } from '../../../store/quest-run-store';
import { byTestId, render } from '../../../test-support/render';
import { BuildLetterGame } from '../BuildLetterGame';

/**
 * AMENDMENTS-TOUCH 6.5 (row KT-6, R2): Build a Letter's tray and slots sit on one `target` board. A used tray tile stays
 * disabled, so a second tap on it does nothing; a filled slot is a take-back target (`gapFill={false}`, named
 * "Take back ...") that removes its tile and shifts the later ones left; a touch just outside a filled slot never reaches
 * it; and the 900 ms wrong reset locks the board, so taps then are swallowed instead of accepted and wiped. The taps go
 * straight to the host's click handler (or the board's responder, with the DOM rectangles mocked), on a fake clock.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

vi.mock('../../../platform/audio', async (importOriginal) => ({ ...(await importOriginal<object>()), playPrompt: vi.fn(async () => 'played'), stop: vi.fn() }));
vi.mock('../../../platform/telemetry', async (importOriginal) => ({ ...(await importOriginal<object>()), track: vi.fn(async () => undefined) }));

const idOf = (char: string, kind: 'consonant' | 'vowel' | 'batchim'): string => jamoAll.find((j) => j.char === char && j.kind === kind)!.id;
const G = idOf('ㄱ', 'consonant');
const A = idOf('ㅏ', 'vowel');
const GK = idOf('ㄱ', 'batchim');

const scope = (syllables: MinigameScope['syllables']): MinigameScope => ({ kind: 'build-letter', rounds: syllables?.length ?? 0, syllables });
const GA = scope([
  { ko: '가', romanization: 'ga', jamoChars: ['ㄱ', 'ㅏ'] },
  { ko: '나', romanization: 'na', jamoChars: ['ㄴ', 'ㅏ'] },
]);
const GAK = scope([
  { ko: '각', romanization: 'gak', jamoChars: ['ㄱ', 'ㅏ', 'ㄱ'], jamoIds: [G, A, GK] },
  { ko: '나', romanization: 'na', jamoChars: ['ㄴ', 'ㅏ'] },
]);

type Rect = { left: number; top: number; width: number; height: number };
/** Where each test id sits on the page (the board reads `getBoundingClientRect` on the web). */
let rects: Record<string, Rect> = {};
const OFF: Rect = { left: -10_000, top: -10_000, width: 0, height: 0 };
const nodeMock = (element: { props: Record<string, unknown> }): unknown => ({
  getBoundingClientRect: () => rects[String(element.props['data-testid'])] ?? OFF,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  contains: () => false,
});

const answers: Array<[string | number, boolean]> = [];

async function draw(s: MinigameScope): Promise<ReactTestRenderer> {
  return render(
    <LayoutProvider value={layoutClassFor({ width: 320, height: 640 })}>
      <TapLockProvider>
        <BuildLetterGame scope={s} onFinish={() => undefined} />
      </TapLockProvider>
    </LayoutProvider>,
    { createNodeMock: nodeMock },
  );
}

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
/** The jamo each slot shows, in order ('' for an empty slot). */
const slots = (root: ReactTestInstance): string[] =>
  [0, 1, 2]
    .filter((i) => byTestId(root, `build-letter-slot-${i}`).length > 0)
    .map((i) => {
      const texts: string[] = [];
      const walk = (n: ReactTestInstance | string): void => {
        if (typeof n === 'string') texts.push(n);
        else n.children.forEach(walk);
      };
      walk(host(root, `build-letter-slot-${i}`));
      return texts.join('');
    });
const disabled = (root: ReactTestInstance, testId: string): boolean => host(root, testId).props['aria-disabled'] === true;

/** The board's responder (on its View), for a real touch at a page point. */
function board(root: ReactTestInstance): Record<string, (e: unknown) => unknown> {
  const found = root.findAll((n) => typeof n.props.onStartShouldSetResponderCapture === 'function' && typeof n.props.onResponderEnd === 'function');
  return found[0]!.props as Record<string, (e: unknown) => unknown>;
}
async function touch(root: ReactTestInstance, x: number, y: number): Promise<boolean> {
  const b = board(root);
  const point = { identifier: 1, pageX: x, pageY: y, target: null };
  const start = { nativeEvent: { ...point, changedTouches: [point], touches: [point], type: 'touchstart' } };
  const claimed = b.onStartShouldSetResponderCapture!(start) === true;
  if (!claimed) return false;
  await act(async () => {
    b.onResponderGrant!(start);
    b.onResponderStart!(start);
  });
  await tick(40);
  await act(async () => {
    b.onResponderEnd!({ nativeEvent: { ...point, changedTouches: [point], touches: [], type: 'touchend' } });
  });
  return true;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'] });
  rects = {};
  answers.length = 0;
  useQuestRunStore.setState({ answerRound: (key, correct) => answers.push([key, correct]), markStepComplete: () => undefined });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('Build a Letter on a target board (AMENDMENTS-TOUCH 6.5, R2)', () => {
  it('a used tray tile stays disabled: a repeat tap on it does nothing and never takes it back', async () => {
    const r = await draw(GA);
    await tick(TAP_LOCK_MS);
    await click(r.root, `build-letter-tile-${G}`);
    expect(slots(r.root)).toEqual(['ㄱ', '']);
    expect(disabled(r.root, `build-letter-tile-${G}`)).toBe(true);
    for (const wait of [60, 150, 500]) {
      await tick(wait);
      await click(r.root, `build-letter-tile-${G}`);
      expect(slots(r.root)).toEqual(['ㄱ', '']);
    }
    expect(answers).toEqual([]);
  });

  it('a tap on a filled slot takes that tile back, the later tiles shift left, and its tray tile is enabled again', async () => {
    const r = await draw(GAK);
    await tick(TAP_LOCK_MS);
    await click(r.root, `build-letter-tile-${G}`);
    await tick(TAP_LOCK_MS);
    await click(r.root, `build-letter-tile-${A}`);
    expect(slots(r.root)).toEqual(['ㄱ', 'ㅏ', '']);
    // The filled slot is a button named for the screen reader (the one new string); an empty slot is no button.
    expect(host(r.root, 'build-letter-slot-0').props['aria-label']).toBe('Take back ㄱ');
    expect(host(r.root, 'build-letter-slot-2').props.role).not.toBe('button');
    await tick(TAP_LOCK_MS);
    await click(r.root, 'build-letter-slot-0');
    expect(slots(r.root)).toEqual(['ㅏ', '', '']);
    expect(disabled(r.root, `build-letter-tile-${G}`)).toBe(false);
    expect(disabled(r.root, `build-letter-tile-${A}`)).toBe(true);
    // A take-back is no attempt: nothing is scored.
    expect(answers).toEqual([]);
  });

  it('a touch 3 px outside a filled slot does not reach it (no gap fill to a take-back target); a touch inside does', async () => {
    const r = await draw(GA);
    rects = {
      'build-letter-slot-0': { left: 100, top: 100, width: 72, height: 72 },
      'build-letter-slot-1': { left: 180, top: 100, width: 72, height: 72 },
    };
    const tray = [...new Set(r.root.findAll((n) => typeof n.props['data-testid'] === 'string' && String(n.props['data-testid']).startsWith('build-letter-tile-')).map((n) => String(n.props['data-testid'])))];
    tray.forEach((id, i) => (rects[id] = { left: 10 + i * 90, top: 400, width: 80, height: 80 }));
    await tick(TAP_LOCK_MS);
    expect(await touch(r.root, 10 + tray.indexOf(`build-letter-tile-${G}`) * 90 + 40, 440)).toBe(true);
    expect(slots(r.root)).toEqual(['ㄱ', '']);
    await tick(TAP_LOCK_MS);
    // 3 px left of the filled slot, and 3 px under it: nothing claims the touch.
    expect(await touch(r.root, 97, 136)).toBe(false);
    expect(await touch(r.root, 136, 175)).toBe(false);
    expect(slots(r.root)).toEqual(['ㄱ', '']);
    // Inside it: the tile comes back.
    expect(await touch(r.root, 104, 136)).toBe(true);
    expect(slots(r.root)).toEqual(['', '']);
  });

  it('taps during the 900 ms wrong reset are swallowed, not accepted and then wiped; after it, a tap counts', async () => {
    const r = await draw(GA);
    await tick(TAP_LOCK_MS);
    // ㅏ then ㄱ: a full block in the wrong order, one scored attempt.
    await click(r.root, `build-letter-tile-${A}`);
    await tick(TAP_LOCK_MS);
    await click(r.root, `build-letter-tile-${G}`);
    expect(answers).toEqual([[0, false]]);
    const others = round1Distractors(r.root);
    // During the reset: a tray tile and a filled slot take nothing.
    await tick(300);
    await click(r.root, `build-letter-tile-${others[0]}`);
    await click(r.root, 'build-letter-slot-0');
    expect(slots(r.root)).toEqual(['ㅏ', 'ㄱ']);
    await tick(600);
    expect(slots(r.root)).toEqual(['', '']);
    expect(answers).toEqual([[0, false]]);
    // The reset is over: a tap is the start of the next attempt.
    await tick(50);
    await click(r.root, `build-letter-tile-${G}`);
    expect(slots(r.root)).toEqual(['ㄱ', '']);
  });
});

function round1Distractors(root: ReactTestInstance): string[] {
  const ids = new Set(root.findAll((n) => typeof n.props['data-testid'] === 'string' && String(n.props['data-testid']).startsWith('build-letter-tile-')).map((n) => String(n.props['data-testid']).slice('build-letter-tile-'.length)));
  return [...ids].filter((id) => id !== G && id !== A);
}
