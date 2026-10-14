import type { TypeHangulRound } from '@hangul-route/content-schema';
import { LayoutProvider, layoutClassFor } from '@hangul-route/design-system';
import React from 'react';
import TestRenderer, { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RomanizationModeOverride } from '../../../i18n/use-romanization-mode';
import { FIXTURE_ROUNDS } from '../../../logic/type-hangul/e2e-rounds';
import { PASS_PAUSE_MS } from '../../../logic/type-hangul/flow';
import { byTestId, press, resetPlatform, screenTexts, setPlatform } from '../../../test-support/render';
import type { MinigameHost } from '../host';
import { ResultPanel, TypeHangulGame } from '../TypeHangulGame';
import { scoreTyped } from '../../../logic/type-hangul/score';

/**
 * F-CURR-001 G-3 (design/wireframes/minigame/type-hangul.md, review of #646): Type Hangul rendered
 * through react-native-web. Skip is drawn once in every window class and completes the game once,
 * even during the pass pause; the field's live line reaches VoiceOver on iOS (no live regions there)
 * and the result panel moves screen-reader focus on native; Shift carries its selected state; the
 * learner's "tap to show" romanization setting hides the prompt's romanization until a tap.
 */

// The WordArt picture reads Metro's `__DEV__`, which the Node render lane does not define.
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const screenReader = vi.hoisted(() => ({
  announceForScreenReader: vi.fn<(text: string) => void>(),
  focusForScreenReader: vi.fn<(node: object | null) => void>(),
}));
vi.mock('../../../platform/screen-reader', () => screenReader);

type Fixture = keyof typeof FIXTURE_ROUNDS;

function host(): MinigameHost & { answers: unknown[]; completes: number } {
  const h = {
    mode: 'quest' as const,
    answers: [] as unknown[],
    completes: 0,
    answer: (key: string | number, correct: boolean) => void h.answers.push([key, correct]),
    complete: () => {
      h.completes += 1;
    },
  };
  return h;
}

async function play(
  rounds: Fixture[],
  size: { width: number; height: number },
  options: { mode?: 'always' | 'tap'; h?: ReturnType<typeof host> } = {},
): Promise<{ r: ReactTestRenderer; h: ReturnType<typeof host> }> {
  const h = options.h ?? host();
  const list = rounds.map((k) => FIXTURE_ROUNDS[k] as TypeHangulRound);
  const scope = { kind: 'type-hangul' as const, rounds: list.length, typeHangul: { rounds: list } };
  let r!: ReactTestRenderer;
  await act(async () => {
    // Host refs are null in react-test-renderer unless mocked: each host node gets a stand-in with a
    // `focus` spy, so the panel's focus move can be seen on every platform.
    r = TestRenderer.create(
      <LayoutProvider value={layoutClassFor(size)}>
        <RomanizationModeOverride mode={options.mode ?? 'always'}>
          <TypeHangulGame scope={scope} host={h} />
        </RomanizationModeOverride>
      </LayoutProvider>,
      { createNodeMock: () => ({ focus: domFocus, addEventListener: () => undefined, removeEventListener: () => undefined }) },
    );
  });
  mounted.push(r);
  return { r, h };
}

const domFocus = vi.fn();
const mounted: ReactTestRenderer[] = [];

const root = (r: ReactTestRenderer): ReactTestInstance => r.root;
const tap = async (r: ReactTestRenderer, id: string): Promise<void> => {
  const node = byTestId(root(r), id).find((n) => typeof n.props.onClick === 'function');
  expect(node, id).toBeDefined();
  await press(node!);
};
const typeKeys = async (r: ReactTestRenderer, jamo: string): Promise<void> => {
  for (const j of jamo) await tap(r, `hangul-key-${j}`);
};

beforeEach(() => {
  screenReader.announceForScreenReader.mockClear();
  screenReader.focusForScreenReader.mockClear();
  domFocus.mockClear();
});

afterEach(async () => {
  for (const r of mounted.splice(0)) {
    await act(async () => {
      r.unmount();
    });
  }
  vi.useRealTimers();
  resetPlatform();
});

describe('Type Hangul: Skip is drawn once and completes once', () => {
  it.each([
    [320, 568],
    [375, 667],
    [768, 1024],
    [1180, 820],
    [844, 390],
    [568, 320],
    [1024, 600],
    [768, 600],
  ])('%i x %i: exactly one Skip', async (width, height) => {
    const { r } = await play(['hoya'], { width, height });
    expect(byTestId(root(r), 'type-hangul-skip')).toHaveLength(1);
    expect(byTestId(root(r), 'type-hangul-done')).toHaveLength(1);
  });

  it('Skip in the pass pause of the last round completes the game once; the pause advance adds nothing', async () => {
    vi.useFakeTimers();
    const { r, h } = await play(['hoya'], { width: 375, height: 667 });
    await typeKeys(r, 'ㅎㅗㅇㅑ');
    await tap(r, 'type-hangul-done');
    expect(h.answers).toEqual([[0, true]]);
    await tap(r, 'type-hangul-skip');
    await tap(r, 'type-hangul-skip');
    await act(async () => {
      vi.advanceTimersByTime(PASS_PAUSE_MS * 2);
    });
    expect(h.completes).toBe(1);
  });
});

describe('Type Hangul: screen readers', () => {
  it('iOS: each finished block and each Del is told to VoiceOver; a block still open is not', async () => {
    setPlatform('ios');
    const { r } = await play(['hoya'], { width: 375, height: 667 });
    await typeKeys(r, 'ㅎㅗㅇ');
    expect(screenReader.announceForScreenReader).not.toHaveBeenCalled();
    await typeKeys(r, 'ㅑ');
    expect(screenReader.announceForScreenReader).toHaveBeenLastCalledWith('You typed: 호, ho');
    await tap(r, 'hangul-key-delete');
    expect(screenReader.announceForScreenReader).toHaveBeenLastCalledWith('You typed: 홍, hong');
  });

  it('native: the result panel moves screen-reader focus to Hoya\'s line, on every Done', async () => {
    setPlatform('ios');
    const { r } = await play(['hoya'], { width: 375, height: 667 });
    await typeKeys(r, 'ㅎㅗㅇㅕ');
    await tap(r, 'type-hangul-done');
    expect(screenReader.focusForScreenReader).toHaveBeenCalledTimes(1);
    expect(screenReader.focusForScreenReader.mock.calls[0]?.[0]).not.toBeNull();
    expect(domFocus).not.toHaveBeenCalled();
    await tap(r, 'type-hangul-fix');
    await tap(r, 'type-hangul-done');
    expect(screenReader.focusForScreenReader).toHaveBeenCalledTimes(2);
  });

  it('web: the panel takes focus through the element, never the native helper', async () => {
    const { r } = await play(['hoya'], { width: 375, height: 667 });
    await typeKeys(r, 'ㅎㅏㄴㅏ');
    await tap(r, 'type-hangul-done');
    expect(screenReader.focusForScreenReader).not.toHaveBeenCalled();
    expect(domFocus).toHaveBeenCalledTimes(1);
    const line = byTestId(root(r), 'type-hangul-line')[0];
    expect(line?.props['aria-label']).toBe('Here is how it is written. Try again.');
    expect(line?.props['aria-live']).toBe('polite');
  });

  it('the field reads what was typed with its romanization, and its live line is polite', async () => {
    const { r } = await play(['hoya'], { width: 375, height: 667 });
    const field = (): ReactTestInstance => byTestId(root(r), 'type-hangul-field')[0]!;
    expect(field().props['aria-label']).toBe('Type this word');
    await typeKeys(r, 'ㅎㅗㅇㅑ');
    expect(field().props['aria-label']).toBe('You typed: 호야, hoya');
    expect(field().findAll((n) => typeof n.type === 'string' && n.props['aria-live'] === 'polite').length).toBeGreaterThan(0);
  });

  it('Shift is a toggle with its selected state, and one-shot', async () => {
    const { r } = await play(['hoya'], { width: 375, height: 667 });
    const shift = (): ReactTestInstance =>
      root(r).find((n) => n.props.testID === 'hangul-key-shift' && n.props.accessibilityState !== undefined);
    expect(shift().props.accessibilityState).toMatchObject({ selected: false });
    await tap(r, 'hangul-key-shift');
    expect(shift().props.accessibilityState).toMatchObject({ selected: true });
    expect(byTestId(root(r), 'hangul-key-ㄱ')[0]?.props['aria-label']).toBe('ㄲ, kk or k');
    await tap(r, 'hangul-key-ㄱ');
    expect(shift().props.accessibilityState).toMatchObject({ selected: false });
  });
});

describe('Type Hangul: the romanization setting', () => {
  it('"tap to show" hides the prompt\'s romanization until Show how to say it; the result always shows it', async () => {
    const { r } = await play(['hoya'], { width: 375, height: 667 }, { mode: 'tap' });
    const promptTexts = (): string[] => screenTexts(byTestId(root(r), 'type-hangul-prompt')[0]!);
    expect(promptTexts()).not.toContain('hoya');
    expect(promptTexts()).toContain('호야');
    await tap(r, 'type-hangul-reveal');
    expect(promptTexts()).toContain('hoya');
    expect(byTestId(root(r), 'type-hangul-reveal')).toHaveLength(0);
  });

  it('"tap to show" on a compact-height window: the word line hides it too', async () => {
    const { r } = await play(['hoya'], { width: 320, height: 568 }, { mode: 'tap' });
    expect(screenTexts(byTestId(root(r), 'type-hangul-prompt')[0]!)).not.toContain('hoya');
    await tap(r, 'type-hangul-reveal');
    expect(screenTexts(byTestId(root(r), 'type-hangul-prompt')[0]!)).toContain('hoya');
  });

  it('a picture round keeps the romanization whatever the setting: it is the cue', async () => {
    const { r } = await play(['bibimbap'], { width: 375, height: 667 }, { mode: 'tap' });
    expect(screenTexts(root(r))).toContain('bibimbap');
    expect(byTestId(root(r), 'type-hangul-reveal')).toHaveLength(0);
  });

  it('"always" shows it with no reveal button', async () => {
    const { r } = await play(['hoya'], { width: 375, height: 667 });
    expect(screenTexts(byTestId(root(r), 'type-hangul-prompt')[0]!)).toContain('hoya');
    expect(byTestId(root(r), 'type-hangul-reveal')).toHaveLength(0);
  });
});

describe('Type Hangul: the block compare stays on screen at 320 px (G-3 follow-up 1)', () => {
  /** Composite views (the React Native props, before react-native-web) carrying `testID`. */
  const views = (r: ReactTestRenderer, id: string): ReactTestInstance[] =>
    root(r).findAll((n) => typeof n.type !== 'string' && n.props.testID === id && n.props.style !== undefined);
  const flat = (style: unknown): Record<string, number> =>
    Object.assign({}, ...(Array.isArray(style) ? style.flat(Infinity) : [style]).filter(Boolean)) as Record<string, number>;

  it('a 24-block guess on a 320-wide panel wraps into lines inside the width, typed and word in one column, every mark drawn', async () => {
    const width = 320;
    const gutter = 16;
    const inner = width - 2 * gutter;
    const typed = '가나다라마바사아자차카타파하거너더러머버서어저처';
    const score = scoreTyped(typed, '비빔밥');
    expect(score.blocks).toHaveLength(24);
    let r!: ReactTestRenderer;
    await act(async () => {
      r = TestRenderer.create(
        <LayoutProvider value={layoutClassFor({ width, height: 568 })}>
          <ResultPanel
            state={{ score, phase: 'miss' as const }}
            round={{ target: FIXTURE_ROUNDS.bibimbap.target as TypeHangulRound['target'] }}
            width={width}
            height={400}
            gutter={gutter}
            panelRef={{ current: null }}
            onFix={() => undefined}
          />
        </LayoutProvider>,
      );
    });
    mounted.push(r);
    const typedRows = views(r, 'type-hangul-typed-row');
    const targetRows = views(r, 'type-hangul-target-row');
    expect(typedRows.length).toBeGreaterThan(1);
    expect(targetRows).toHaveLength(typedRows.length);
    const gap = flat(typedRows[0]!.props.style).gap!;
    // A block cell is the one view in the row with a border style (solid, or dashed where a side has no block).
    const cellsOf = (row: ReactTestInstance): ReactTestInstance[] =>
      row.findAll((n) => typeof n.type !== 'string' && n !== row && typeof n.props.style === 'object' && n.props.style?.borderStyle !== undefined);
    let typedCount = 0;
    typedRows.forEach((row, i) => {
      const cells = cellsOf(row);
      const cell = flat(cells[0]!.props.style).width!;
      expect(cells.length * cell + (cells.length - 1) * gap, `line ${i}`).toBeLessThanOrEqual(inner);
      // The pair stays aligned: the word line under it has the same columns.
      expect(cellsOf(targetRows[i]!)).toHaveLength(cells.length);
      typedCount += cells.length;
    });
    expect(typedCount).toBe(24);
    const marked = score.blocks.filter((b) => b.status !== 'same');
    expect(views(r, 'type-hangul-typed-marked')).toHaveLength(marked.length);
    expect(views(r, 'type-hangul-target-marked')).toHaveLength(marked.length);
    // Every pair is captioned ("You typed" over "The word"), not only the first one.
    const chunks = views(r, 'type-hangul-compare-chunk');
    expect(chunks).toHaveLength(typedRows.length);
    for (const chunk of chunks) {
      const words = screenTexts(chunk);
      expect(words).toContain('You typed');
      expect(words).toContain('The word');
    }
    // The readout is one item, unchanged by the wrap.
    expect(views(r, 'type-hangul-compare')).toHaveLength(1);
  });
});
