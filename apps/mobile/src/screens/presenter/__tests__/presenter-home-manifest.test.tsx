import { act } from 'react-test-renderer';
import { afterEach, beforeAll, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { lessonContent } from '../../../content/lessons';
import { storyContent } from '../../../content/stories';
import { byTestId, render } from '../../../test-support/render';

/**
 * [FN] AMENDMENTS-FINISH-2026-11 row FN-4 (finding F6) on the whole presenter: the home (no deck link) draws from the
 * lesson and story manifests and asks for no lesson cell or story body. The global test setup preloads the app's
 * stores, so the loads are spied on. A deck's own loads: `presenter-deck-content.test.tsx`.
 */

vi.mock('../../../platform/presenter', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../platform/presenter')>()),
  takeDeckFragment: () => null,
}));
vi.mock('../../../platform/telemetry', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../platform/telemetry')>()),
  track: async () => true,
  flushQueue: async () => 0,
}));
// The picture art reads Metro's `__DEV__`, which the Node render lane does not define.
(globalThis as { __DEV__?: boolean }).__DEV__ = false;
vi.mock('../../../components/StrokeHint', () => ({ StrokeHint: () => null }));
vi.mock('react-native-gesture-handler', async () => {
  const { View: Plain } = await import('react-native');
  return { GestureHandlerRootView: Plain };
});
vi.mock('expo-status-bar', () => ({ StatusBar: () => null }));

import PresenterApp from '../../../../PresenterApp';
import { lectureSourcesDoor } from '../../lecture-sources-entry';

/** The grown-up roots' loader puts the lecture sources in before a root draws (SB-4e); a test that draws a root's parts does the same. */
beforeAll(async () => {
  await lectureSourcesDoor.load();
});

type Ensure = (ids: readonly string[]) => Promise<void>;
let cells: MockInstance<Ensure>;
let allCells: MockInstance<() => Promise<void>>;
let stories: MockInstance<Ensure>;
let allStories: MockInstance<() => Promise<void>>;
beforeEach(() => {
  cells = vi.spyOn(lessonContent, 'ensureCells');
  allCells = vi.spyOn(lessonContent, 'ensureAll');
  stories = vi.spyOn(storyContent, 'ensureStories');
  allStories = vi.spyOn(storyContent, 'ensureAll');
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

async function tick(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

const asked = (spy: MockInstance<Ensure>): string[] => spy.mock.calls.flatMap((call) => [...call[0]]).sort();

describe('the presenter home lists from the manifest (row FN-4)', () => {
  it('draws the home, its chooser and its ready-made lessons without asking for a lesson cell or a story body', async () => {
    vi.useFakeTimers();
    const r = await render(<PresenterApp />);
    await tick(10);
    expect(byTestId(r.root, 'presenter-home')).not.toHaveLength(0);
    expect(byTestId(r.root, 'presenter-home-presets')).not.toHaveLength(0);
    expect(byTestId(r.root, 'presenter-home-customize')).not.toHaveLength(0);
    expect(asked(cells)).toEqual([]);
    expect(asked(stories)).toEqual([]);
    expect(allCells).not.toHaveBeenCalled();
    expect(allStories).not.toHaveBeenCalled();
  });
});
