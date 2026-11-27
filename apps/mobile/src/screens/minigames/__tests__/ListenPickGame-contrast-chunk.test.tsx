import type { ListenPickRound } from '@hangul-route/content-schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, type ReactTestRenderer } from 'react-test-renderer';
import { lp } from '../../../logic/scope-builders';
import { useAudioStore } from '../../../store/audio-store';
import { byTestId, render, unmount } from '../../../test-support/render';
import type { MinigameHost } from '../host';
import { ListenPickGame } from '../ListenPickGame';

/**
 * How a Listen & Pick step reaches the contrast chunk (AMENDMENTS-MINIMAL-PAIRS row MP-2a): a scope with no contrast round
 * never imports it; a scope with one waits for it (the lesson's waiting state); a chunk that cannot load drops the contrast
 * rounds silently, and a step with none left completes having scored nothing. The tests run in this order on purpose: the
 * entry keeps a loaded chunk and a pending load for the life of the page.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const chunk = vi.hoisted(() => ({ imported: 0, mode: 'fail' as 'fail' | 'hang' }));
vi.mock('../contrast-chunk', async () => {
  chunk.imported += 1;
  if (chunk.mode === 'hang') await new Promise<never>(() => undefined);
  throw new Error('the chunk could not load');
});
vi.mock('../../../platform/audio', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  playPrompt: vi.fn(async () => 'played' as const),
  hasClip: () => false,
  hasClipFor: () => false,
  hasPackClips: () => false,
  warmClips: () => Promise.resolve(),
  stop: vi.fn(),
  noteFallbackShown: vi.fn(),
}));
vi.mock('../../../platform/telemetry', async (importOriginal) => ({ ...(await importOriginal<object>()), track: vi.fn(async () => undefined) }));
vi.mock('../../../platform/motion', () => ({ useReducedMotion: () => false }));

const text = (ko: string, romanization: string) => ({ ko, romanization, en: ko });
const PLAIN: ListenPickRound = {
  id: 'lp:syl:가',
  prompt: text('가', 'ga'),
  options: [
    { id: 'a', text: text('가', 'ga') },
    { id: 'b', text: text('나', 'na') },
  ],
  answerId: 'a',
};

const mounted: ReactTestRenderer[] = [];
let completed = 0;
const answers: Array<[string | number, boolean]> = [];
beforeEach(() => {
  completed = 0;
  answers.length = 0;
  chunk.imported = 0;
  useAudioStore.setState({ muted: false, showLetters: false, voiceCheckPending: false });
});
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
});

async function game(rounds: ListenPickRound[]): Promise<ReactTestRenderer> {
  const host: MinigameHost = { mode: 'quest', answer: (round, correct) => void answers.push([round, correct]), complete: () => void (completed += 1) };
  const r = await render(<ListenPickGame scope={{ kind: 'listen-pick', rounds: rounds.length, listenPick: { rounds } }} host={host} />);
  mounted.push(r);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  return r;
}

describe('the contrast chunk is reached only by a contrast round', () => {
  it('a scope with no contrast round plays at once and never imports the chunk', async () => {
    const r = await game([PLAIN]);
    expect(chunk.imported).toBe(0);
    expect(byTestId(r.root, 'listen-pick-speaker').length).toBeGreaterThan(0);
    expect(byTestId(r.root, 'lesson-waiting')).toHaveLength(0);
  });

  it('a chunk that cannot load drops the contrast rounds silently: a step of nothing else completes, having scored nothing', async () => {
    const r = await game([lp.pair('ga-ka'), lp.pair('da-ta')]);
    expect(chunk.imported).toBe(1);
    expect(completed).toBe(1);
    expect(answers).toEqual([]);
    expect(byTestId(r.root, 'listen-pick-speaker')).toHaveLength(0);
  });

  it('a chunk that cannot load leaves the plain rounds of a mixed scope to play', async () => {
    const r = await game([PLAIN, lp.pair('ga-ka')]);
    expect(completed).toBe(0);
    expect(byTestId(r.root, 'listen-pick-speaker').length).toBeGreaterThan(0);
    // One round: the contrast round is not counted.
    expect(byTestId(r.root, 'listen-pick-option-a').length).toBeGreaterThan(0);
  });

  it('while the chunk loads the step shows the lesson\'s waiting state and no round', async () => {
    chunk.mode = 'hang';
    const r = await game([lp.pair('ga-ka'), lp.pair('da-ta')]);
    expect(chunk.imported).toBe(1);
    expect(byTestId(r.root, 'lesson-waiting').length).toBeGreaterThan(0);
    expect(byTestId(r.root, 'listen-pick-speaker')).toHaveLength(0);
    expect(completed).toBe(0);
  });
});
