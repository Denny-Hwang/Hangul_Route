import type { Profile } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { episodesAll } from '../../../content/episodes';
import { emptySnapshot } from '../../../logic/my-route/view';
import { questsAll } from '../../../content/quests';
import { useProfileStore } from '../../../store/profile-store';
import { SAVE_RETRY_DELAYS_MS, followSaveRetries, useProgressStore } from '../../../store/progress-store';
import { byTestId, cleanup, render, screenTexts } from '../../../test-support/render';
import { ResultsScreen } from '../ResultsScreen';

/**
 * [DP] AMENDMENTS-DURABLE-PROGRESS section 3.7 (row DP-2; design design/screens/system/progress-read-failed/ frame K,
 * D6, D8): while the learner's progress could not be saved or read (`loadFailedFor`), Results shows one quiet line under
 * the stars: `learner.results.saveLater`, secondary text, no icon, not a live region. Nothing is blocked: the buttons are
 * there as always. [DP] Owner decision OD-DP7 (row DP-1e): a save that did not land shows the line only once the first
 * retry (1 s) has not landed either (`saveRetryFailedFor`), so a save that lands on its retry never flashes it.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

/** The device's storage: a map; while `full`, a progress write rejects (a full disk). */
const disk = vi.hoisted(() => ({ mem: new Map<string, unknown>(), full: false }));
vi.mock('../../../platform/storage', async () =>
  (await import('../../../test-support/storage-transactions')).withTransactions({
    readJson: vi.fn(async (key: string) => (disk.mem.has(key) ? structuredClone(disk.mem.get(key)) : null)),
    readJsonStrict: vi.fn(async (key: string) => (disk.mem.has(key) ? structuredClone(disk.mem.get(key)) : null)),
    writeJson: vi.fn(async (key: string, value: unknown) => {
      if (disk.full && key.startsWith('progress:')) throw new Error('disk full');
      disk.mem.set(key, structuredClone(value));
    }),
    removeKey: vi.fn(async (key: string) => void disk.mem.delete(key)),
  }),
);
vi.mock('../../../platform/telemetry', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  track: vi.fn(async () => true),
}));
vi.mock('@react-navigation/native', async () => {
  const { createContext, useEffect } = await import('react');
  return {
    CommonActions: { reset: (state: unknown) => ({ type: 'RESET', payload: state }) },
    NavigationContext: createContext(undefined),
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
    useNavigation: () => ({ goBack: () => undefined, navigate: () => undefined }),
  };
});

const LINE = getMessages('en').learner.results.saveLater;
const ID = 'profile:mina';
const learner: Profile = {
  id: ID,
  displayName: 'Mina',
  ageGroup: '8-9',
  avatar: 'hoya-orange',
  role: 'learner',
  createdAt: '2026-10-01T00:00:00.000Z',
  learnerType: 'child',
};
const episodeOf = (questId: string): string => episodesAll.find((e) => e.questIds.includes(questId))?.id ?? 'episode:none';
const quest = questsAll.find((q) => /^episode:stage[2-7]-/.test(episodeOf(q.id)))!;
const params = { questId: quest.id, episodeId: episodeOf(quest.id), stars: 2 as const, correct: 2, total: 3, retries: 1 };

const listeners: Array<(event: { data: { action: { type: string } }; preventDefault(): void }) => void> = [];
const navigation = {
  navigate: vi.fn(),
  dispatch: vi.fn(),
  goBack: vi.fn(),
  setOptions: vi.fn(),
  getState: () => ({ index: 1, routes: [{ name: 'Main' }, { name: 'Results' }] }),
  addListener: (_type: string, listener: (typeof listeners)[number]) => {
    listeners.push(listener);
    return () => listeners.splice(listeners.indexOf(listener), 1);
  },
};

beforeEach(() => {
  disk.mem.clear();
  disk.full = false;
  useProfileStore.setState({ profiles: [learner], activeId: ID });
  useProgressStore.setState({ byProfile: { [ID]: emptySnapshot(ID) }, hydratedFor: new Set([ID]), saveFailedFor: new Set(), saveRetryFailedFor: new Set(), loadFailedFor: new Set() });
});
afterEach(async () => {
  disk.full = false;
  // [DP] Row DP-2: a retry left waiting lands now on the working disk, so none reaches the next test.
  followSaveRetries((listener) => {
    listener(true);
    return () => undefined;
  });
  await act(async () => {
    for (let i = 0; i < 40; i += 1) await Promise.resolve();
  });
  await cleanup();
  useProgressStore.setState({ saveFailedFor: new Set(), saveRetryFailedFor: new Set(), loadFailedFor: new Set() });
});

/** Lets the store's promise chains run. */
const flush = (): Promise<void> =>
  act(async () => {
    for (let i = 0; i < 40; i += 1) await Promise.resolve();
  });
/** Lets the first timed retry (1 s, `SAVE_RETRY_DELAYS_MS[0]`) run and its write answer, on the real clock. */
const pastFirstRetry = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, SAVE_RETRY_DELAYS_MS[0]! + 50));
  });
  await flush();
};

const results = (): Promise<Awaited<ReturnType<typeof render>>> =>
  render(<ResultsScreen route={{ key: 'results', name: 'Results', params }} navigation={navigation as never} />);

describe('[DP] the Results save line (DP-2)', () => {
  it('is absent while the saves land', async () => {
    const r = await results();
    expect(screenTexts(r.root)).not.toContain(LINE);
    expect(byTestId(r.root, 'results-save-later')).toHaveLength(0);
  });

  it("shows under the stars, before the bubble, once this run's write and its first retry did not land", async () => {
    disk.full = true;
    const r = await results();
    await flush();
    expect(useProgressStore.getState().saveFailedFor.has(ID)).toBe(true);
    // OD-DP7: not yet; the first retry is still to come.
    expect(screenTexts(r.root)).not.toContain(LINE);
    await pastFirstRetry();
    expect(useProgressStore.getState().saveRetryFailedFor.has(ID)).toBe(true);
    const texts = screenTexts(r.root);
    expect(texts).toContain(LINE);
    // Reading order: the headline block, then the line, then Hoya's bubble.
    const line = texts.indexOf(LINE);
    expect(line).toBeGreaterThan(-1);
    expect(texts.indexOf(getMessages('en').a11y.stars(2))).toBeLessThan(line);
    expect(byTestId(r.root, 'results-hoya')).not.toHaveLength(0);
    expect(texts.indexOf('Nice work! Try one more for three stars.')).toBeGreaterThan(line);
    const node = byTestId(r.root, 'results-save-later')[0];
    expect(node).toBeDefined();
    // Quiet: not a live region and no alert role.
    expect(node!.props['aria-live']).toBeUndefined();
    expect(node!.props.accessibilityRole).toBeUndefined();
  });

  it('shows while the learner is in loadFailedFor', async () => {
    useProgressStore.setState({ loadFailedFor: new Set([ID]) });
    const r = await results();
    expect(screenTexts(r.root)).toContain(LINE);
  });

  it('comes and goes with the store, and another learner whose retry failed does not show it', async () => {
    useProgressStore.setState({ saveFailedFor: new Set(['profile:joon']), saveRetryFailedFor: new Set(['profile:joon']) });
    const r = await results();
    expect(screenTexts(r.root)).not.toContain(LINE);
    // A save that did not land, whose first retry has not run: no line yet (OD-DP7).
    await act(async () => {
      useProgressStore.setState({ saveFailedFor: new Set([ID]) });
    });
    expect(screenTexts(r.root)).not.toContain(LINE);
    await act(async () => {
      useProgressStore.setState({ saveRetryFailedFor: new Set([ID]) });
    });
    expect(screenTexts(r.root)).toContain(LINE);
    await act(async () => {
      useProgressStore.setState({ saveFailedFor: new Set(), saveRetryFailedFor: new Set() });
    });
    expect(screenTexts(r.root)).not.toContain(LINE);
  });
});

/**
 * [DP] Owner decision OD-DP7 (row DP-1e), the Results timing test: Results writes the run on mount, so on a disk that
 * is full for a moment the first write fails at once; the line waits for the 1 s retry.
 */
describe('[DP] OD-DP7: the Results save line waits for the first retry', () => {
  it('a save that lands on its first retry never shows the line', async () => {
    disk.full = true;
    const shown: boolean[] = [];
    const r = await results();
    await flush();
    expect(useProgressStore.getState().saveFailedFor.has(ID)).toBe(true);
    shown.push(screenTexts(r.root).includes(LINE));
    const off = useProgressStore.subscribe((s) => shown.push(s.saveRetryFailedFor.has(ID)));
    // Space comes back before the retry.
    disk.full = false;
    await pastFirstRetry();
    off();
    shown.push(screenTexts(r.root).includes(LINE));
    expect(useProgressStore.getState().saveFailedFor.has(ID)).toBe(false);
    expect(shown).not.toContain(true);
    expect(byTestId(r.root, 'results-save-later')).toHaveLength(0);
    // The run is on disk.
    expect(disk.mem.has(`progress:${ID}`)).toBe(true);
  });

  it('a save whose first retry does not land either shows the line after it, and it goes when a write lands', async () => {
    disk.full = true;
    const r = await results();
    await flush();
    expect(screenTexts(r.root)).not.toContain(LINE);
    await pastFirstRetry();
    expect(screenTexts(r.root)).toContain(LINE);
    // Space comes back; the next timed retry (4 s) is not waited for here: the app comes to the front, its retry lands
    // and the line goes.
    disk.full = false;
    followSaveRetries((listener) => {
      listener(true);
      return () => undefined;
    });
    await flush();
    expect(useProgressStore.getState().saveFailedFor.has(ID)).toBe(false);
    expect(screenTexts(r.root)).not.toContain(LINE);
  });
});
