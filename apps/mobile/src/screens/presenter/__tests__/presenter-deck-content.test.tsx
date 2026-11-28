import { getMessages } from '@hangul-route/i18n';
import { act } from 'react-test-renderer';
import { afterEach, beforeAll, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { lessonContent } from '../../../content/lessons';
import { storyContent } from '../../../content/stories';
import { buttonsNamed, byTestId, press, render } from '../../../test-support/render';

/**
 * [FN] AMENDMENTS-FINISH-2026-11 row FN-4 (finding F6) on the whole presenter: a deck (here one a link opens: a Stage 2
 * lesson and a shelf story) asks for its own cell and story only, never for the whole catalogue, and the start screen
 * keeps its loading state until they are in; a chunk that fails is the crash screen with Try again. The global test
 * setup preloads the app's stores, so the loads are spied on and held where a test needs them pending. The presenter
 * reads its link once per page, so every test here opens the same deck. The home's side:
 * `presenter-home-manifest.test.tsx`.
 */

vi.mock('../../../platform/presenter', async (importOriginal) => {
  const { encodeDeck } = await import('@hangul-route/content-schema');
  const blocks = [
    { kind: 'quest', id: 'quest:stage2-rites-q1' },
    { kind: 'story', storyId: 'story:sun-and-moon', checks: true },
  ];
  const deck = { v: 1, id: 'lecture:deckload1', title: 'Rites lesson', createdAt: '2026-11-18T09:00:00Z', seed: 1, blocks };
  return {
    ...(await importOriginal<typeof import('../../../platform/presenter')>()),
    takeDeckFragment: () => ({ raw: encodeDeck(deck as never), reloaded: false }),
  };
});
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
const realCells = lessonContent.ensureCells;
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

describe('a chosen deck loads only its own content (row FN-4)', () => {
  it('asks for its own cell and story alone and shows the loading state until they are in', async () => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    cells.mockImplementation((ids: readonly string[]) => held.then(() => realCells(ids)));
    vi.useFakeTimers();
    const r = await render(<PresenterApp />);
    await tick(10);
    expect(asked(cells)).toEqual(['episode:stage2-rites']);
    expect(allCells).not.toHaveBeenCalled();
    expect(allStories).not.toHaveBeenCalled();
    expect(byTestId(r.root, 'presenter-loading')).not.toHaveLength(0);
    expect(byTestId(r.root, 'presenter-start-button')).toHaveLength(0);
    // Not rejected as a deck with nothing to show while its cell is on its way.
    expect(byTestId(r.root, 'presenter-invalid')).toHaveLength(0);
    await act(async () => release());
    await tick(10);
    expect(asked(stories)).toEqual(['story:sun-and-moon']);
    expect(byTestId(r.root, 'presenter-start-button')).not.toHaveLength(0);
    expect(byTestId(r.root, 'presenter-loading')).toHaveLength(0);
  });

  it('a core chunk that fails shows the crash screen, and Try again asks for it again', async () => {
    cells.mockImplementationOnce(() => Promise.reject(new Error('offline')));
    vi.useFakeTimers();
    const r = await render(<PresenterApp />);
    await tick(10);
    const retry = buttonsNamed(r.root, getMessages('en').common.buttons.tryAgain);
    expect(retry).toHaveLength(1);
    expect(byTestId(r.root, 'presenter-start-button')).toHaveLength(0);
    await press(retry[0]!);
    await tick(10);
    expect(asked(cells)).toEqual(['episode:stage2-rites', 'episode:stage2-rites']);
    expect(byTestId(r.root, 'presenter-start-button')).not.toHaveLength(0);
  });
});
