import { getMessages } from '@hangul-route/i18n';
import type { ReactElement } from 'react';
import { Text } from 'react-native';
import { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import type { StoryShelfChunk } from '../../logic/story/story-chunk-store';
import { StoryShelfMismatch, createStoryShelfSlot } from '../../logic/story/story-shelf-load';
import { buttonsNamed, byTestId, press, render, screenTexts } from '../../test-support/render';
import { SHELF_WAITING_LINE_MS, storyShelfGateBindings } from '../story-shelf-gate';

/**
 * The story shelf before the first screen (F-CURR-002 §10, row CM-8b), from a cold shelf: the gate draws the
 * waiting state until the shelf chunk is in, then requires the roots (`resolveRoot`) once and draws its root; a failed
 * shelf shows the crash screen, whose Try again loads it again; a shelf of a newer build reloads the page.
 */
const messages = getMessages('en');
const LOADING = messages.learner.presenter.state.loading;
const TRY_AGAIN = messages.common.buttons.tryAgain;
const shelfChunk = (hash: string): StoryShelfChunk => ({ CHUNK_HASH: hash, STORY_SHELF: [], HELD_STORY_CARDS: [] });

const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
};

function Root(): ReactElement {
  return <Text testID="root">root</Text>;
}

/** A shelf slot whose loads wait for the test (`loads[i]`), and the gate over it. */
function gate(over: { reload?: () => boolean; answer?: (error: unknown) => Promise<boolean> } = {}) {
  const loads: { resolve: (c: StoryShelfChunk) => void; reject: (e: unknown) => void }[] = [];
  const slot = createStoryShelfSlot({
    load: () =>
      new Promise<StoryShelfChunk>((resolve, reject) => {
        loads.push({ resolve, reject });
      }),
    hash: 'h1',
  });
  const reload = vi.fn(over.reload ?? (() => false));
  const answer = vi.fn(over.answer ?? (async () => false));
  const resolveRoot = vi.fn(() => Root);
  const { withStoryShelf } = storyShelfGateBindings({ isIn: slot.isIn, ensure: slot.ensure, reloadForNewBuild: reload, isNewBuildAnswer: answer });
  return { slot, loads, reload, answer, resolveRoot, withStoryShelf };
}

describe('withStoryShelf', () => {
  it('returns the root itself when the shelf is in from the start (native, the tests): nothing waits', () => {
    const resolveRoot = vi.fn(() => Root);
    const { withStoryShelf } = storyShelfGateBindings({
      isIn: () => true,
      ensure: () => Promise.resolve(),
      reloadForNewBuild: () => false,
      isNewBuildAnswer: async () => false,
    });
    expect(withStoryShelf(resolveRoot)).toBe(Root);
    expect(resolveRoot).toHaveBeenCalledTimes(1);
  });

  it('waits for the shelf, then requires the root once and draws it', async () => {
    const t = gate();
    const Gated = t.withStoryShelf(t.resolveRoot);
    expect(Gated.displayName).toBe('WithStoryShelf');
    const r = await render(<Gated />);
    expect(byTestId(r.root, 'story-shelf-waiting')).toHaveLength(1);
    expect(byTestId(r.root, 'root')).toHaveLength(0);
    // The roots are not required yet: nothing that reads the stories runs before the shelf is in.
    expect(t.resolveRoot).not.toHaveBeenCalled();
    expect(t.loads).toHaveLength(1);
    await act(async () => t.loads[0]?.resolve(shelfChunk('h1')));
    await settle();
    expect(byTestId(r.root, 'root')).toHaveLength(1);
    expect(t.resolveRoot).toHaveBeenCalledTimes(1);
    expect(t.slot.isIn()).toBe(true);
  });

  it('asks for the shelf when the root is made, before it first draws, and requires the root as soon as it is in', async () => {
    const t = gate();
    const Gated = t.withStoryShelf(t.resolveRoot);
    // index.ts makes the root while the start bundle runs: the shelf's script is asked for then, not at the first draw.
    expect(t.loads).toHaveLength(1);
    await act(async () => t.loads[0]?.resolve(shelfChunk('h1')));
    // The roots run as soon as the shelf is in, drawn or not (they open their storage as they did with the start bundle).
    expect(t.resolveRoot).toHaveBeenCalledTimes(1);
    const r = await render(<Gated />);
    expect(byTestId(r.root, 'root')).toHaveLength(1);
    expect(byTestId(r.root, 'story-shelf-waiting')).toHaveLength(0);
    expect(t.loads).toHaveLength(1);
  });

  it('shows the calm status line only once the shelf is late', async () => {
    vi.useFakeTimers();
    try {
      const t = gate();
      const Gated = t.withStoryShelf(t.resolveRoot);
      const r = await render(<Gated />);
      expect(screenTexts(r.root)).not.toContain(LOADING);
      await act(async () => {
        vi.advanceTimersByTime(SHELF_WAITING_LINE_MS);
      });
      expect(screenTexts(r.root)).toContain(LOADING);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a shelf that fails shows the crash screen, never a root without stories; Try again loads it again', async () => {
    const t = gate();
    const Gated = t.withStoryShelf(t.resolveRoot);
    const r = await render(<Gated />);
    await act(async () => t.loads[0]?.reject(new Error('offline')));
    await settle();
    expect(byTestId(r.root, 'root')).toHaveLength(0);
    expect(t.resolveRoot).not.toHaveBeenCalled();
    expect(t.reload).not.toHaveBeenCalled();
    const retry = buttonsNamed(r.root, TRY_AGAIN);
    expect(retry).toHaveLength(1);
    await press(retry[0]!);
    expect(t.loads).toHaveLength(2);
    await act(async () => t.loads[1]?.resolve(shelfChunk('h1')));
    await settle();
    expect(byTestId(r.root, 'root')).toHaveLength(1);
  });

  it('a shelf of a newer build (another hash) reloads the page instead of the crash screen', async () => {
    const t = gate({ reload: () => true });
    const Gated = t.withStoryShelf(t.resolveRoot);
    const r = await render(<Gated />);
    await act(async () => t.loads[0]?.resolve(shelfChunk('h-old')));
    await settle();
    expect(t.reload).toHaveBeenCalledTimes(1);
    expect(byTestId(r.root, 'story-shelf-waiting')).toHaveLength(1);
    expect(buttonsNamed(r.root, TRY_AGAIN)).toHaveLength(0);
  });

  it('a script error whose URL now answers for a newer build reloads the page', async () => {
    const t = gate({ reload: () => true, answer: async () => true });
    const Gated = t.withStoryShelf(t.resolveRoot);
    await render(<Gated />);
    await act(async () => t.loads[0]?.reject(Object.assign(new Error('Loading module /_expo/static/js/web/stories-shelf-0.js failed.'), { name: 'AsyncRequireError' })));
    await settle();
    expect(t.answer).toHaveBeenCalledTimes(1);
    expect(t.reload).toHaveBeenCalledTimes(1);
  });

  it('a newer build that cannot reload (offline, or reloaded a minute ago) shows the crash screen', async () => {
    const t = gate({ reload: () => false });
    const Gated = t.withStoryShelf(t.resolveRoot);
    const r = await render(<Gated />);
    await act(async () => t.loads[0]?.reject(new StoryShelfMismatch('h1', 'h-old')));
    await settle();
    expect(t.reload).toHaveBeenCalledTimes(1);
    expect(buttonsNamed(r.root, TRY_AGAIN)).toHaveLength(1);
  });

  it('a root that throws as it is required shows the crash screen; Try again requires it again', async () => {
    const t = gate();
    let attempt = 0;
    const resolveRoot = vi.fn(() => {
      attempt += 1;
      if (attempt === 1) throw new Error('root failed');
      return Root;
    });
    const Gated = t.withStoryShelf(resolveRoot);
    const r = await render(<Gated />);
    await act(async () => t.loads[0]?.resolve(shelfChunk('h1')));
    await settle();
    expect(byTestId(r.root, 'root')).toHaveLength(0);
    const retry = buttonsNamed(r.root, TRY_AGAIN);
    expect(retry).toHaveLength(1);
    await press(retry[0]!);
    await settle();
    // The shelf is in: Try again loads nothing and requires the root again.
    expect(t.loads).toHaveLength(1);
    expect(resolveRoot).toHaveBeenCalledTimes(2);
    expect(byTestId(r.root, 'root')).toHaveLength(1);
  });
});
