import type { OrderItRound } from '@hangul-route/content-schema';
import { motion } from '@hangul-route/design-system';
import React from 'react';
import { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EAT_RICE, LIKE_TTEOKGUK } from '../../../logic/sentence-builder/__tests__/fixtures';
import { byTestId, press, render, unmount } from '../../../test-support/render';
import type { MinigameHost } from '../host';
import { SentenceBuilderGame } from '../SentenceBuilderGame';

/**
 * F-CURR-001 G-1 follow-up (verify:docs follow-ups final, item 2): Sentence Builder rendered through
 * react-native-web. The prompt slot is told, round by round, whether the current sentence has a
 * bundled recording (so a missing Korean voice is not a missing sound), and the sentence clips are
 * warmed once on mount. The source-pattern guard stays in logic/__tests__/no-direct-speak.test.ts.
 */

// The picture art reads Metro's `__DEV__`, which the Node render lane does not define.
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const CLIP = 'audio/sentences/like-tteokguk.mp3';

const audio = vi.hoisted(() => ({
  hasClip: vi.fn((ref: string | undefined) => ref === 'audio/sentences/like-tteokguk.mp3'),
  warmClips: vi.fn((_refs: readonly string[]) => Promise.resolve()),
  playPrompt: vi.fn(() => Promise.resolve('played' as const)),
  stop: vi.fn(),
}));
vi.mock('../../../platform/audio', async (importOriginal) => ({ ...(await importOriginal<object>()), ...audio }));

// The real hook runs (PromptPanel needs its view); the spy records what the game hands it each render.
const slotArgs = vi.hoisted(() => [] as Array<{ source: string; hasClip?: boolean; textOnScreen?: boolean }>);
vi.mock('../../../components/use-prompt-slot', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../components/use-prompt-slot')>();
  return {
    ...real,
    usePromptSlot: (options: Parameters<typeof real.usePromptSlot>[0]) => {
      slotArgs.push({ ...options });
      return real.usePromptSlot(options);
    },
  };
});

/** Round 1 has a bundled recording; round 2 (EAT_RICE) has no audioRef. */
const WITH_CLIP: OrderItRound = { ...LIKE_TTEOKGUK, sentence: { ...LIKE_TTEOKGUK.sentence, audioRef: CLIP } };

function host(): MinigameHost {
  return { mode: 'quest', answer: () => undefined, complete: () => undefined };
}

const mounted: ReactTestRenderer[] = [];

beforeEach(() => {
  slotArgs.length = 0;
  vi.clearAllMocks();
});

afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
});

async function tapTile(r: ReactTestRenderer, id: string): Promise<void> {
  const node = byTestId(r.root, `sentence-builder-tile-${id}`).find((n) => typeof n.props.onClick === 'function');
  expect(node, id).toBeDefined();
  await press(node!);
}

describe('SentenceBuilderGame: the prompt slot follows the round, the clips are warmed', () => {
  it('hasClip is true for a round with a bundled sentence, false once the reducer moves to one without', async () => {
    const rounds = [WITH_CLIP, EAT_RICE];
    const r = await render(<SentenceBuilderGame scope={{ kind: 'order-it', rounds: rounds.length, orderIt: { rounds } }} host={host()} />);
    mounted.push(r);

    expect(slotArgs.length).toBeGreaterThan(0);
    for (const args of slotArgs) expect(args).toEqual({ source: 'sentence-builder', hasClip: true, textOnScreen: true });
    expect(audio.hasClip).toHaveBeenCalledWith(CLIP);

    // Warmed once on mount, with the one bundled ref (EAT_RICE has none).
    expect(audio.warmClips).toHaveBeenCalledTimes(1);
    expect(audio.warmClips).toHaveBeenCalledWith([CLIP]);

    // Build round 1 in order (w0, w1, w2), each tap a second apart (past the double-tap window);
    // the built sentence is heard, then the next round opens.
    // The clock holds still during each tap and moves only between taps.
    const round1 = slotArgs.length;
    const start = Date.now();
    const now = vi.spyOn(Date, 'now');
    for (const [i, id] of ['w0', 'w1', 'w2'].entries()) {
      now.mockReturnValue(start + (i + 1) * 1000);
      await tapTile(r, id);
    }
    now.mockRestore();
    expect(byTestId(r.root, 'sentence-builder-done').length).toBeGreaterThan(0);

    // With no sound played the next round opens `crawl` later: poll for it (bounded), not a fixed sleep.
    const round2Open = (): boolean =>
      byTestId(r.root, 'sentence-builder-gloss').some((n) => n.props.children === EAT_RICE.sentence.en);
    const deadline = Date.now() + motion.duration.crawl + 5000;
    while (!round2Open() && Date.now() < deadline) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 25));
      });
    }

    expect(round2Open()).toBe(true);
    const later = slotArgs.slice(round1);
    expect(later.at(-1)).toEqual({ source: 'sentence-builder', hasClip: false, textOnScreen: true });
    expect(audio.hasClip).toHaveBeenLastCalledWith(undefined);
    // A new round does not warm the clips again.
    expect(audio.warmClips).toHaveBeenCalledTimes(1);
  });
});
