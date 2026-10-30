import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { scopeFor } from '../../../logic/minigame-config';
import { validBoards } from '../../../logic/pic-word-flow';
import { useAudioStore } from '../../../store/audio-store';
import { KO_VOICE, createAudioRig, type AudioRig } from '../../../test-support/audio-rig';
import { byTestId, press, render, screenTexts, unmount } from '../../../test-support/render';
import type { MinigameHost } from '../host';
import { PicWordMatchGame } from '../PicWordMatchGame';

/**
 * Pic-Word Match as a Check (F-QUEST-002 L2 and D3; F-CURR-002 row CM-3A S2, where four Stage 2 Checks play it): the
 * Check has no Skip, even after a miss, and its header is the Check's (fill-only dots, one a board, and "Quick check",
 * never "n / N"). Anywhere else Skip comes after the first answer, as before.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const rig = vi.hoisted(() => ({ current: null as AudioRig | null }));
vi.mock('../../../platform/audio', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...(await import('../../../test-support/audio-rig')).rigAudio(() => rig.current!),
}));
vi.mock('../../../platform/telemetry', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  track: vi.fn(async () => undefined),
}));

const scope = scopeFor('minigame:s1-life-q1-apply')!;
const pairs = validBoards(scope)[0]!.pairs;
const mounted: ReactTestRenderer[] = [];

const host = (mode: MinigameHost['mode']): MinigameHost & { completes: number } => {
  const h = {
    mode,
    completes: 0,
    answer: () => undefined,
    complete: () => {
      h.completes += 1;
    },
  };
  return h;
};
const pressable = (root: ReactTestInstance, id: string): ReactTestInstance => {
  const node = byTestId(root, id).find((n) => typeof n.props.onClick === 'function');
  if (!node) throw new Error(`no pressable ${id}`);
  return node;
};
const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
};
/** A wrong pair: the first picture with the second word. */
const miss = async (r: ReactTestRenderer): Promise<void> => {
  await press(pressable(r.root, `pic-word-picture-${pairs[0]!.id}`));
  await press(pressable(r.root, `pic-word-word-${pairs[1]!.id}`));
  await settle();
};

beforeEach(() => {
  rig.current = createAudioRig({ voices: [KO_VOICE] });
  useAudioStore.setState({ muted: false });
});

afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
});

describe('Pic-Word Match as a Check (row CM-3A S2)', () => {
  it('a Check draws no Skip, before or after a miss, and the Check header: "Quick check", no "n / N"', async () => {
    const h = host('check');
    const r = await render(<PicWordMatchGame scope={scope} host={h} />);
    mounted.push(r);
    expect(byTestId(r.root, 'pic-word-skip')).toHaveLength(0);
    await miss(r);
    expect(byTestId(r.root, 'pic-word-skip')).toHaveLength(0);
    const texts = screenTexts(r.root);
    expect(texts).toContain('Quick check');
    expect(texts.some((t) => /\d+ \/ \d+/.test(t))).toBe(false);
    expect(h.completes).toBe(0);
  });

  it('a quest step keeps its Skip after the first answer and its "n / N"', async () => {
    const r = await render(<PicWordMatchGame scope={scope} host={host('quest')} />);
    mounted.push(r);
    await miss(r);
    expect(byTestId(r.root, 'pic-word-skip').length).toBeGreaterThan(0);
    expect(screenTexts(r.root)).not.toContain('Quick check');
    expect(screenTexts(r.root).some((t) => /\d+ \/ \d+/.test(t))).toBe(true);
  });
});
