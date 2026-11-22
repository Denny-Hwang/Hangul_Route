import type { Profile } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { episodesAll } from '../../../content/episodes';
import { emptySnapshot } from '../../../logic/my-route/view';
import { questsAll } from '../../../content/quests';
import { useProfileStore } from '../../../store/profile-store';
import { followSaveRetries, useProgressStore } from '../../../store/progress-store';
import { byTestId, cleanup, render, screenTexts } from '../../../test-support/render';
import { ResultsScreen } from '../ResultsScreen';

/**
 * [DP] AMENDMENTS-DURABLE-PROGRESS section 3.7 (row DP-2; design design/screens/system/progress-read-failed/ frame K,
 * D6, D8): while the learner's progress could not be saved (`saveFailedFor`) or read (`loadFailedFor`), Results shows
 * one quiet line under the stars: `learner.results.saveLater`, secondary text, no icon, not a live region. Nothing is
 * blocked: the buttons are there as always.
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
  useProgressStore.setState({ byProfile: { [ID]: emptySnapshot(ID) }, hydratedFor: new Set([ID]), saveFailedFor: new Set(), loadFailedFor: new Set() });
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
  useProgressStore.setState({ saveFailedFor: new Set(), loadFailedFor: new Set() });
});

const results = (): Promise<Awaited<ReturnType<typeof render>>> =>
  render(<ResultsScreen route={{ key: 'results', name: 'Results', params }} navigation={navigation as never} />);

describe('[DP] the Results save line (DP-2)', () => {
  it('is absent while the saves land', async () => {
    const r = await results();
    expect(screenTexts(r.root)).not.toContain(LINE);
    expect(byTestId(r.root, 'results-save-later')).toHaveLength(0);
  });

  it("shows under the stars, before the bubble, when this run's write did not land (saveFailedFor)", async () => {
    disk.full = true;
    const r = await results();
    await act(async () => {
      for (let i = 0; i < 40; i += 1) await Promise.resolve();
    });
    expect(useProgressStore.getState().saveFailedFor.has(ID)).toBe(true);
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

  it('comes and goes with the store, and another learner in saveFailedFor does not show it', async () => {
    useProgressStore.setState({ saveFailedFor: new Set(['profile:joon']) });
    const r = await results();
    expect(screenTexts(r.root)).not.toContain(LINE);
    await act(async () => {
      useProgressStore.setState({ saveFailedFor: new Set([ID]) });
    });
    expect(screenTexts(r.root)).toContain(LINE);
    await act(async () => {
      useProgressStore.setState({ saveFailedFor: new Set() });
    });
    expect(screenTexts(r.root)).not.toContain(LINE);
  });
});
