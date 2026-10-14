import { keysFor, type WriteFrameRound } from '@hangul-route/content-schema';
import { LayoutProvider, layoutClassFor } from '@hangul-route/design-system';
import React from 'react';
import TestRenderer, { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RomanizationModeOverride } from '../../../i18n/use-romanization-mode';
import { FIXTURE_ROUNDS, type WriteFrameFixture } from '../../../logic/write-frame/e2e-rounds';
import { PASS_PAUSE_MS, SENTENCE_PAUSE_MS } from '../../../logic/write-frame/flow';
import { byTestId, press, resetPlatform, screenTexts, setPlatform } from '../../../test-support/render';
import type { HostMode, MinigameHost } from '../host';
import { WriteFrameGame } from '../WriteFrameGame';

/**
 * F-CURR-001 G-5 (design/wireframes/minigame/write-frame.md): Write Frame rendered through
 * react-native-web. Any pick is right and the ending follows it; the typing is checked against
 * the pick; My page closes the step and Continue completes it; the name round is unscored and
 * its Done needs whole syllables; and test P-1: the host hears no text, and nothing typed is
 * left on screen or in the host once the game unmounts.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const screenReader = vi.hoisted(() => ({
  announceForScreenReader: vi.fn<(text: string) => void>(),
  focusForScreenReader: vi.fn<(node: object | null) => void>(),
}));
vi.mock('../../../platform/screen-reader', () => screenReader);

type Host = MinigameHost & { answers: unknown[]; completes: number };

function host(mode: HostMode = 'quest'): Host {
  const h = {
    mode,
    answers: [] as unknown[],
    completes: 0,
    answer: (key: string | number, correct: boolean, meta?: { itemId?: string }) => void h.answers.push([key, correct, meta]),
    complete: () => {
      h.completes += 1;
    },
  };
  return h;
}

const domFocus = vi.fn();
const mounted: ReactTestRenderer[] = [];

async function play(
  rounds: WriteFrameFixture[],
  options: { size?: { width: number; height: number }; mode?: 'always' | 'tap'; h?: Host } = {},
): Promise<{ r: ReactTestRenderer; h: Host }> {
  const h = options.h ?? host();
  const list = rounds.map((k) => FIXTURE_ROUNDS[k] as WriteFrameRound);
  const scope = { kind: 'write-frame' as const, rounds: list.length, writeFrame: { rounds: list } };
  let r!: ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(
      <LayoutProvider value={layoutClassFor(options.size ?? { width: 375, height: 667 })}>
        <RomanizationModeOverride mode={options.mode ?? 'always'}>
          <WriteFrameGame scope={scope} host={h} />
        </RomanizationModeOverride>
      </LayoutProvider>,
      { createNodeMock: () => ({ focus: domFocus, addEventListener: () => undefined, removeEventListener: () => undefined }) },
    );
  });
  mounted.push(r);
  return { r, h };
}

const root = (r: ReactTestRenderer): ReactTestInstance => r.root;
const tap = async (r: ReactTestRenderer, id: string): Promise<void> => {
  const node = byTestId(root(r), id).find((n) => typeof n.props.onClick === 'function');
  expect(node, id).toBeDefined();
  await press(node!);
};
/** The tense letters and the key that types each with Shift (KS X 5002). */
const SHIFTED: Record<string, string> = { 'ㅃ': 'ㅂ', 'ㅉ': 'ㅈ', 'ㄸ': 'ㄷ', 'ㄲ': 'ㄱ', 'ㅆ': 'ㅅ' };
const typeWord = async (r: ReactTestRenderer, text: string): Promise<void> => {
  for (const j of keysFor(text)) {
    if (SHIFTED[j]) {
      await tap(r, 'hangul-key-shift');
      await tap(r, `hangul-key-${SHIFTED[j]}`);
    } else {
      await tap(r, `hangul-key-${j}`);
    }
  }
};
const texts = (r: ReactTestRenderer, id = 'write-frame'): string[] => screenTexts(byTestId(root(r), id)[0]!);
const advance = async (ms: number): Promise<void> => {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
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

describe('Write Frame: pick, write, sentence, My page', () => {
  it('shows both endings before a pick, the fitted one after, and checks the typing against the pick', async () => {
    vi.useFakeTimers();
    const { r, h } = await play(['food']);
    expect(texts(r)).toContain('을/를');
    expect(byTestId(root(r), 'write-frame-card')[0]?.props['aria-label']).toBe('저는, blank, 을 or 를, 좋아해요. I like blank.');
    await tap(r, 'write-frame-word-0');
    expect(texts(r)).toContain('를');
    expect(texts(r)).not.toContain('을/를');
    expect(byTestId(root(r), 'write-frame-notice')[0]?.props.children).toBe('를 after 떡볶이');
    await typeWord(r, '떡볶이');
    await tap(r, 'write-frame-done');
    expect(h.answers).toEqual([[0, true, { itemId: 'e2e-food' }]]);
    expect(texts(r, 'write-frame-sentence')).toEqual(expect.arrayContaining(['저는 떡볶이를 좋아해요.', 'jeoneun tteokbokkireul joahaeyo', 'I like spicy rice cakes.', 'You wrote a sentence!']));
    await advance(SENTENCE_PAUSE_MS);
    expect(texts(r, 'write-frame-my-page')).toEqual(
      expect.arrayContaining(['My page', '저는 떡볶이를 좋아해요.', 'This page is just for now. It is not saved.', 'Continue']),
    );
    expect(domFocus).toHaveBeenCalled();
    await tap(r, 'write-frame-continue');
    expect(h.completes).toBe(1);
  });

  it('a near miss shows the picked word under the typed one; Fix it and a pass record one missed round', async () => {
    vi.useFakeTimers();
    const { r, h } = await play(['food']);
    await tap(r, 'write-frame-word-1');
    expect(texts(r)).toContain('을');
    await typeWord(r, '김빱');
    await tap(r, 'write-frame-done');
    expect(texts(r, 'type-hangul-result')).toEqual(expect.arrayContaining(['Almost! Check the marked block.', '김밥']));
    expect(byTestId(root(r), 'write-frame-change-word')).toHaveLength(0);
    await tap(r, 'type-hangul-fix');
    for (let i = 0; i < 3; i += 1) await tap(r, 'hangul-key-delete');
    await typeWord(r, '밥');
    await tap(r, 'write-frame-done');
    expect(h.answers).toEqual([[0, false, { itemId: 'e2e-food' }]]);
  });

  it('Change word goes back to the bank with the pick kept selected', async () => {
    const { r } = await play(['food']);
    await tap(r, 'write-frame-word-2');
    await tap(r, 'write-frame-change-word');
    const card = byTestId(root(r), 'write-frame-word-2').find((n) => n.props.accessibilityState !== undefined || n.props['aria-selected'] !== undefined);
    expect(card?.props['aria-selected']).toBe(true);
  });

  it('two slots: the first passes with the pass pause, the second is picked and written, one answer', async () => {
    vi.useFakeTimers();
    const { r, h } = await play(['holiday']);
    await tap(r, 'write-frame-word-1');
    await typeWord(r, '추석');
    await tap(r, 'write-frame-done');
    expect(texts(r, 'type-hangul-result')).toContain('You typed it!');
    await advance(PASS_PAUSE_MS);
    expect(byTestId(root(r), 'write-frame-bank')).toHaveLength(1);
    await tap(r, 'write-frame-word-1');
    await typeWord(r, '송편');
    await tap(r, 'write-frame-done');
    expect(h.answers).toEqual([[0, true, { itemId: 'e2e-holiday' }]]);
    expect(texts(r, 'write-frame-sentence')).toEqual(expect.arrayContaining(['추석에 송편을 먹었어요.', 'On Chuseok, I ate half-moon rice cakes.']));
  });

  it('a pick-only frame finishes on the pick, unscored', async () => {
    const { r, h } = await play(['place']);
    await tap(r, 'write-frame-word-1');
    expect(texts(r, 'write-frame-sentence')).toEqual(expect.arrayContaining(['오늘 공원에 가요.', 'Today I go to the park.']));
    expect(h.answers).toEqual([]);
  });

  it('Skip completes once and My page is never shown', async () => {
    const { r, h } = await play(['food']);
    await tap(r, 'write-frame-skip');
    expect(h.completes).toBe(1);
    expect(byTestId(root(r), 'write-frame-my-page')).toHaveLength(0);
  });

  it.each([
    [320, 568],
    [375, 667],
    [768, 1024],
    [844, 390],
    [568, 320],
  ])('%i x %i: one Skip and one Done while writing', async (width, height) => {
    const { r } = await play(['food'], { size: { width, height } });
    expect(byTestId(root(r), 'write-frame-skip')).toHaveLength(1);
    await tap(r, 'write-frame-word-0');
    expect(byTestId(root(r), 'write-frame-skip')).toHaveLength(1);
    expect(byTestId(root(r), 'write-frame-done')).toHaveLength(1);
  });

  it('"tap to show" hides the romanization of the frame and the bank until a tap', async () => {
    const { r } = await play(['food'], { mode: 'tap' });
    expect(texts(r)).not.toContain('tteokbokki');
    await tap(r, 'write-frame-reveal');
    expect(texts(r)).toContain('tteokbokki');
  });

  it('an empty scope keeps a way back', async () => {
    let r!: ReactTestRenderer;
    const onBack = vi.fn();
    await act(async () => {
      r = TestRenderer.create(<WriteFrameGame scope={{ kind: 'write-frame', rounds: 0 }} host={host()} onBack={onBack} />);
    });
    mounted.push(r);
    expect(screenTexts(root(r)).length).toBeGreaterThan(0);
  });
});

describe('Write Frame: the name round (Write Your Name q3)', () => {
  it('builds the name with sound tiles; Done needs whole syllables; the ending follows the last block', async () => {
    vi.useFakeTimers();
    setPlatform('ios');
    const { r, h } = await play(['name']);
    expect(texts(r)).toEqual(expect.arrayContaining(['Write your name in Hangul', 'There is no wrong way to write your name.', 'Sounds', 'At the end']));
    expect(byTestId(root(r), 'write-frame-done').some((n) => n.props.accessibilityState?.disabled === true || n.props['aria-disabled'] === true)).toBe(true);
    await tap(r, 'write-frame-tile-호');
    await tap(r, 'write-frame-tile-야');
    expect(texts(r)).toContain('예요');
    // A final on the last block: the ending follows it on the frame line (the cast name is kept for the finish).
    await tap(r, 'write-frame-tile-ㄴ');
    expect(texts(r)).toContain('이에요');
    await tap(r, 'write-frame-tile-delete');
    expect(texts(r)).toContain('예요');
    expect(byTestId(root(r), 'write-frame-card')[0]?.props['aria-label']).toContain('My name is Hoya.');
    await tap(r, 'write-frame-tab-keyboard');
    await typeWord(r, 'ㅗ');
    expect(texts(r)).toContain('Finish the last block.');
    expect(texts(r)).toContain('이에요/예요');
    expect(byTestId(root(r), 'write-frame-card')[0]?.props['aria-label']).toContain('My name is blank.');
    await tap(r, 'hangul-key-delete');
    await tap(r, 'write-frame-done');
    expect(texts(r, 'write-frame-sentence')).toEqual(expect.arrayContaining(['제 이름은 호야예요.', 'My name is Hoya.']));
    expect(h.answers).toEqual([]);
    await advance(SENTENCE_PAUSE_MS);
    expect(texts(r, 'write-frame-my-page')).toEqual(expect.arrayContaining(['제 이름은 호야예요.', 'My name is Hoya.']));
  });

  it('says when the name is at its longest', async () => {
    const { r } = await play(['name']);
    for (let i = 0; i < 9; i += 1) await tap(r, 'write-frame-tile-나');
    expect(texts(r)).toContain('That is the longest name that fits here.');
  });

  it('the grown-up preview opens on the cast name 호야', async () => {
    const { r } = await play(['name'], { h: host('preview') });
    expect(texts(r)).toContain('호야');
    expect(texts(r)).toContain('예요');
  });
});

describe('test P-1: what is written stays in the round', () => {
  it('the host hears ids, indices and booleans only, never the text', async () => {
    vi.useFakeTimers();
    const { r, h } = await play(['food', 'name']);
    await tap(r, 'write-frame-word-0');
    await typeWord(r, '떡볶이');
    await tap(r, 'write-frame-done');
    await advance(SENTENCE_PAUSE_MS);
    await tap(r, 'write-frame-tile-호');
    await tap(r, 'write-frame-tile-야');
    await tap(r, 'write-frame-done');
    await advance(SENTENCE_PAUSE_MS);
    await tap(r, 'write-frame-continue');
    expect(JSON.stringify(h.answers)).not.toMatch(/[ㄱ-ㆎ가-힣]/);
    expect(h.completes).toBe(1);
  });

  it('the composed name is gone after unmount: a new mount starts empty', async () => {
    const first = await play(['name']);
    await tap(first.r, 'write-frame-tile-호');
    await tap(first.r, 'write-frame-tile-야');
    expect(texts(first.r)).toContain('호야');
    await act(async () => {
      first.r.unmount();
    });
    mounted.splice(mounted.indexOf(first.r), 1);
    const second = await play(['name']);
    expect(texts(second.r)).not.toContain('호야');
    expect(texts(second.r)).toContain('Write your name in Hangul');
  });
});
