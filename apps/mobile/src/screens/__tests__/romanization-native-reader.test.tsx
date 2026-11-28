import type { DiscoverPage, ListenPickRound, Profile, ProgressSnapshot } from '@hangul-route/content-schema';
import type { ReactTestInstance } from 'react-test-renderer';
import { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { scopeFor } from '../../logic/minigame-config';
import { validBoards } from '../../logic/pic-word-flow';
import { snapshotWith } from '../../logic/stage1/__tests__/fixtures';
import { STAGE1_QUESTS } from '../../logic/stage1/curriculum';
import { useAudioStore } from '../../store/audio-store';
import { useLocaleStore } from '../../store/locale-store';
import { useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';
import { KO_VOICE, createAudioRig, type AudioRig } from '../../test-support/audio-rig';
import { byTestId, cleanup, hostNodes, render, resetPlatform, setPlatform, textOf } from '../../test-support/render';
import type { MinigameHost } from '../minigames/host';
import { ListenPickGame } from '../minigames/ListenPickGame';
import { PicWordMatchGame } from '../minigames/PicWordMatchGame';
import { DiscoverStep } from '../quest/DiscoverStep';

/**
 * AMENDMENTS-ROMANIZATION-FADE sections 3.3, 3.13 and OD-RF-3, review of RF-2: on the native app the platform answers "is a
 * screen reader on?" a moment after the screen mounts. Until it has answered, a profile on As I learn is treated as a reader
 * in use (everything shown: it can only show more, never hide), and the three per-mount surfaces (Discover, Listen & Pick,
 * Pic-Word Match) take the resolver once it is known. So a VoiceOver or TalkBack user never meets a folded word, and a
 * native learner without a reader gets the fade as soon as the answer is in. The web has no such wait.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const rig = vi.hoisted(() => ({ current: null as AudioRig | null }));
vi.mock('../../platform/audio', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...(await import('../../test-support/audio-rig')).rigAudio(() => rig.current!),
  warmClips: async () => undefined,
}));
vi.mock('../../platform/telemetry', async (importOriginal) => ({ ...(await importOriginal<object>()), track: vi.fn(async () => undefined) }));
// The platform's answer is held until the test gives it, as it arrives a moment after the screen mounts.
const platform = vi.hoisted(() => ({ answer: null as null | ((on: boolean) => void), waiting: [] as Array<(on: boolean) => void> }));
vi.mock('../../platform/screen-reader', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  isScreenReaderEnabled: () =>
    new Promise<boolean>((resolve) => {
      platform.waiting.push(resolve);
    }),
  subscribeScreenReader: () => () => undefined,
}));

const ID = 'profile:mina';
const learner: Profile = { id: ID, displayName: 'Mina', ageGroup: '8-9', avatar: 'hoya-orange', role: 'learner', createdAt: '2026-10-01T00:00:00.000Z', learnerType: 'child' };
const FIRST_TEN = STAGE1_QUESTS.slice(0, 10).map((q) => ({ questId: q.id, episodeId: 'episode:x' }));
const PHASES: Record<'reading' | 'all', () => ProgressSnapshot> = {
  reading: () => snapshotWith(FIRST_TEN),
  all: () => ({ ...snapshotWith([]), testedOut: { 'episode:stage2-letters': '2026-11-01T00:00:00.000Z' } }),
};

/** A profile whose stored record is the old switch's Off (`always`, no choice): read as the default, As I learn. */
function seed(phase: 'reading' | 'all'): void {
  useProfileStore.setState({ profiles: [learner], activeId: ID, hydrated: true });
  useLocaleStore.setState({ byProfile: { [ID]: { romanizationMode: 'always' } }, screenReader: false, device: 'en' });
  useProgressStore.setState({ byProfile: { [ID]: PHASES[phase]() } });
}

/** The platform's answer to every holder start so far. */
async function platformAnswers(on: boolean): Promise<void> {
  await act(async () => {
    for (const resolve of platform.waiting.splice(0)) resolve(on);
    await Promise.resolve();
  });
}

function drawn(within: ReactTestInstance, words: readonly string[]): string[] {
  const hidden = (n: ReactTestInstance): boolean => {
    for (let at: ReactTestInstance | null = n; at; at = at.parent) if (at.props['aria-hidden'] === true) return true;
    return false;
  };
  return hostNodes(within, (n) => n.children.length === 1 && typeof n.children[0] === 'string' && words.includes(textOf(n)))
    .filter((n) => !hidden(n))
    .map(textOf)
    .sort();
}

// Discover: 나무 can be read after quest 10, 까치 has a tense consonant.
const PAGE: DiscoverPage = {
  items: [
    { type: 'word', word: { ko: '나무', romanization: 'namu', en: 'tree' } },
    { type: 'word', word: { ko: '까치', romanization: 'kkachi', en: 'magpie' } },
  ],
};
const discover = async (): Promise<ReactTestInstance> => (await render(<DiscoverStep pages={[PAGE]} onDone={() => undefined} />)).root;
const discoverWords = (root: ReactTestInstance): string[] => drawn(root, ['namu', 'kkachi']);

// Listen & Pick
const lpText = (ko: string, romanization: string, en: string) => ({ ko, romanization, en });
const LP_OPTIONS = [
  { id: 'a', text: lpText('산', 'san', 'mountain') },
  { id: 'b', text: lpText('바다', 'bada', 'sea') },
  { id: 'c', text: lpText('까치', 'kkachi', 'magpie') },
  { id: 'd', text: lpText('떡국', 'tteokguk', 'rice cake soup') },
];
const LP_ROUNDS: ListenPickRound[] = [{ id: 'lp:word:san', prompt: lpText('산', 'san', 'mountain'), options: LP_OPTIONS, answerId: 'a' }];
const LP_WORDS = LP_OPTIONS.map((o) => o.text.romanization);
const questHost: MinigameHost = { mode: 'quest', answer: () => undefined, complete: () => undefined };
const listenPick = async (): Promise<ReactTestInstance> =>
  (await render(<ListenPickGame scope={{ kind: 'listen-pick', rounds: 1, listenPick: { rounds: LP_ROUNDS } }} host={questHost} />)).root;
const lpWords = (root: ReactTestInstance): string[] => drawn(byTestId(root, 'listen-pick-options')[0]!, LP_WORDS);

// Pic-Word Match
const PW_SCOPE = scopeFor('minigame:s1-nature-q1-apply')!;
const PW_PAIRS = validBoards(PW_SCOPE)[0]!.pairs;
const PW_ROMANS = PW_PAIRS.map((p) => p.word.romanization);
const picWord = async (): Promise<ReactTestInstance> => (await render(<PicWordMatchGame scope={PW_SCOPE} host={questHost} />)).root;
const pwWords = (root: ReactTestInstance): string[] => drawn(byTestId(root, 'pic-word-words')[0]!, PW_ROMANS);

const SURFACES = [
  { name: 'Discover', open: discover, shown: discoverWords, all: ['kkachi', 'namu'], foldedInReading: ['kkachi'] },
  { name: 'Listen & Pick', open: listenPick, shown: lpWords, all: [...LP_WORDS].sort(), foldedInReading: ['kkachi', 'tteokguk'] },
  { name: 'Pic-Word Match', open: picWord, shown: pwWords, all: [...PW_ROMANS].sort(), foldedInReading: null },
] as const;

beforeEach(() => {
  platform.waiting.length = 0;
  rig.current = createAudioRig({ voices: [KO_VOICE] });
  useAudioStore.setState({ muted: false });
  useProfileStore.setState({ profiles: [], activeId: null, hydrated: true });
  useLocaleStore.setState({ byProfile: {}, screenReader: false, device: 'en' });
  useProgressStore.setState({ byProfile: {} });
});
afterEach(async () => {
  await cleanup();
  resetPlatform();
});

describe.each(SURFACES)('$name on native, As I learn', (surface) => {
  it.each(['reading', 'all'] as const)('a reader that turns out to be on never sees a folded word (phase %s)', async (phase) => {
    setPlatform('ios');
    seed(phase);
    const root = await surface.open();
    // Before the platform has answered: everything is shown.
    expect(surface.shown(root)).toEqual(surface.all);
    await platformAnswers(true);
    expect(surface.shown(root)).toEqual(surface.all);
  });

  it.each(['reading', 'all'] as const)('with no reader it shows everything until the platform answers, then folds as the phase says (phase %s)', async (phase) => {
    setPlatform('ios');
    seed(phase);
    const root = await surface.open();
    expect(surface.shown(root)).toEqual(surface.all);
    await platformAnswers(false);
    const after = surface.shown(root);
    if (phase === 'all') expect(after).toEqual([]);
    else if (surface.foldedInReading !== null) expect(after).toEqual(surface.foldedInReading);
    else expect(after.length).toBeLessThan(surface.all.length);
  });

  it('on the web nothing waits: the first draw already folds', async () => {
    setPlatform('web');
    seed('all');
    const root = await surface.open();
    expect(surface.shown(root)).toEqual([]);
  });
});
