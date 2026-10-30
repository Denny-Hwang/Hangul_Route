import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MinigameScope } from '../../../logic/minigame-config';
import { FIXTURE_CHAIN } from '../../../logic/my-story/e2e-chain';
import { byTestId, screenTexts } from '../../../test-support/render';
import type { MinigameHost } from '../host';

/**
 * F-CURR-002 §7.1 F8 and §10 (row CM-38): My Story's chunk cannot load (offline before the precache filled). The step
 * is never a dead end: it plays the switch-off fallback, Write Frame on the first frame, from the start bundle.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

vi.mock('../../../platform/screen-reader', () => ({ announceForScreenReader: vi.fn(), focusForScreenReader: vi.fn() }));
vi.mock('../../../platform/audio', async (importOriginal) => ({ ...(await importOriginal<object>()), playPrompt: vi.fn(() => Promise.resolve('played')) }));
vi.mock('../../../platform/telemetry', () => ({ track: vi.fn(() => Promise.resolve()) }));
vi.mock('../my-story-chunk', () => {
  throw new Error('the chunk is not reachable');
});

const scope: MinigameScope = { kind: 'my-story', rounds: FIXTURE_CHAIN.length, myStory: { frames: [...FIXTURE_CHAIN] } };
const host: MinigameHost = { mode: 'quest', answer: () => undefined, complete: () => undefined };
let mounted: ReactTestRenderer | null = null;

afterEach(async () => {
  await act(async () => {
    mounted?.unmount();
  });
  mounted = null;
});

describe('My Story when its chunk cannot load (row CM-38)', () => {
  it('plays Write Frame on the first frame instead of a crash screen', async () => {
    const { MyStoryRoute } = await import('../my-story-entry');
    const onFallback = vi.fn();
    await act(async () => {
      mounted = TestRenderer.create(<MyStoryRoute scope={scope} host={host} onFallback={onFallback} />, {
        createNodeMock: () => ({ focus: vi.fn(), addEventListener: () => undefined, removeEventListener: () => undefined }),
      });
    });
    // Let the rejected import settle.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const r = mounted!;
    expect(byTestId(r.root, 'write-frame').length).toBeGreaterThan(0);
    const shown = screenTexts(byTestId(r.root, 'write-frame')[0]!);
    expect(shown).toEqual(expect.arrayContaining(['Make your own sentence', '도서관', '시장', '공원']));
    expect(shown).not.toContain('Write your story');
    expect(shown.join(' ')).toMatch(/1 \/ 1/);
    expect(byTestId(r.root, 'oops-screen')).toHaveLength(0);
    // The host is told which scope was played, so minigame.finished names write-frame (review of PR #849).
    expect(onFallback).toHaveBeenCalledWith(expect.objectContaining({ kind: 'write-frame', rounds: 1 }));
  });
});
