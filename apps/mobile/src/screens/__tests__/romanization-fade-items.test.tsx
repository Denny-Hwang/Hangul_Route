import type { DiscoverPage, ListenPickRound, Profile, ProgressSnapshot, RomanizationChoice } from '@hangul-route/content-schema';
import type { ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
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
import { byTestId, cleanup, hostNodes, press, render, screenTexts, textOf } from '../../test-support/render';
import type { HostMode, MinigameHost } from '../minigames/host';
import { ListenPickGame } from '../minigames/ListenPickGame';
import { PicWordMatchGame } from '../minigames/PicWordMatchGame';
import { DiscoverStep } from '../quest/DiscoverStep';

/**
 * AMENDMENTS-ROMANIZATION-FADE section 3.6, row RF-1b: on a profile on As I learn (`auto`) in phase `reading`, the words the
 * learner can read fold on Discover, Listen & Pick and Pic-Word Match when they run in a quest step; a theme word with an
 * unmet letter stays shown; a tap or the answer reaches every one; and no Check folds anything. With the shipped default
 * (`always`, no stored choice) nothing is drawn differently, in any phase.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const rig = vi.hoisted(() => ({ current: null as AudioRig | null }));
vi.mock('../../platform/audio', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...(await import('../../test-support/audio-rig')).rigAudio(() => rig.current!),
  warmClips: async () => undefined,
}));
vi.mock('../../platform/telemetry', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  track: vi.fn(async () => undefined),
}));

const ID = 'profile:mina';
const learner: Profile = { id: ID, displayName: 'Mina', ageGroup: '8-9', avatar: 'hoya-orange', role: 'learner', createdAt: '2026-10-01T00:00:00.000Z', learnerType: 'child' };
const FIRST_TEN = STAGE1_QUESTS.slice(0, 10).map((q) => ({ questId: q.id, episodeId: 'episode:x' }));
const PHASES = {
  letters: (): ProgressSnapshot => snapshotWith(FIRST_TEN.slice(0, 3)),
  reading: (): ProgressSnapshot => snapshotWith(FIRST_TEN),
  all: (): ProgressSnapshot => ({ ...snapshotWith([]), testedOut: { 'episode:stage2-letters': '2026-11-01T00:00:00.000Z' } }),
};

function seed(choice: RomanizationChoice | undefined, phase: keyof typeof PHASES): void {
  useProfileStore.setState({ profiles: [learner], activeId: ID, hydrated: true });
  useLocaleStore.setState({
    byProfile: { [ID]: choice === undefined ? { romanizationMode: 'always' } : { romanizationMode: choice === 'tap' ? 'tap' : 'always', romanizationChoice: choice } },
    screenReader: false,
    device: 'en',
  });
  useProgressStore.setState({ byProfile: { [ID]: PHASES[phase]() } });
}

const mounted: ReactTestRenderer[] = [];
const track = async <T extends ReactTestRenderer>(r: T): Promise<T> => {
  mounted.push(r);
  return r;
};
const pressable = (root: ReactTestInstance, id: string): ReactTestInstance => {
  const node = byTestId(root, id).find((n) => typeof n.props.onClick === 'function');
  if (!node) throw new Error(`no pressable ${id}`);
  return node;
};
/** The leaf text nodes under `within` that are exactly one of `words`, drawn (not held, not aria-hidden). */
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

beforeEach(() => {
  rig.current = createAudioRig({ voices: [KO_VOICE] });
  useAudioStore.setState({ muted: false });
  useProfileStore.setState({ profiles: [], activeId: null, hydrated: true });
  useLocaleStore.setState({ byProfile: {}, screenReader: false, device: 'en' });
  useProgressStore.setState({ byProfile: {} });
});
afterEach(async () => {
  mounted.length = 0;
  await cleanup();
});

describe('Discover word cards (quest step)', () => {
  const PAGE: DiscoverPage = {
    items: [
      { type: 'word', word: { ko: '나무', romanization: 'namu', en: 'tree' } },
      { type: 'word', word: { ko: '까치', romanization: 'kkachi', en: 'magpie' } },
    ],
  };
  const open = async (): Promise<ReactTestRenderer> => track(await render(<DiscoverStep pages={[PAGE]} onDone={() => undefined} />));

  it('auto, reading: the word she can read folds with Show how to say it, and a tap shows it; the theme word stays shown', async () => {
    seed('auto', 'reading');
    const r = await open();
    expect(drawn(r.root, ['namu', 'kkachi'])).toEqual(['kkachi']);
    expect(byTestId(r.root, 'discover-reveal-word:나무')).not.toHaveLength(0);
    expect(byTestId(r.root, 'discover-reveal-word:까치')).toHaveLength(0);
    // The gloss and the Hangul never fold.
    expect(screenTexts(r.root)).toEqual(expect.arrayContaining(['나무', 'tree']));
    await press(pressable(r.root, 'discover-reveal-word:나무'));
    expect(drawn(r.root, ['namu', 'kkachi'])).toEqual(['kkachi', 'namu']);
    expect(byTestId(r.root, 'discover-reveal-word:나무')).toHaveLength(0);
  });

  it('the Hear it name keeps the romanization while the card is folded', async () => {
    seed('auto', 'reading');
    const r = await open();
    const hear = pressable(r.root, 'discover-hear-word:나무|sound');
    expect(String(hear.props['aria-label'])).toContain('namu');
  });

  it.each([
    ['auto in letters', 'auto', 'letters'],
    ['the shipped default in letters', undefined, 'letters'],
    ['the shipped default in reading', undefined, 'reading'],
    ['the shipped default in all', undefined, 'all'],
    ['an explicit always in reading', 'always', 'reading'],
  ] as const)('%s: nothing folds', async (_, choice, phase) => {
    seed(choice, phase);
    const r = await open();
    expect(drawn(r.root, ['namu', 'kkachi'])).toEqual(['kkachi', 'namu']);
    expect(byTestId(r.root, 'discover-reveal-word:나무')).toHaveLength(0);
  });

  it('auto, all (Word Builder done): every word card folds, a tap shows it', async () => {
    seed('auto', 'all');
    const r = await open();
    expect(drawn(r.root, ['namu', 'kkachi'])).toEqual([]);
    await press(pressable(r.root, 'discover-reveal-word:까치'));
    expect(drawn(r.root, ['namu', 'kkachi'])).toEqual(['kkachi']);
  });

  it('a screen reader keeps auto shown', async () => {
    seed('auto', 'reading');
    useLocaleStore.setState({ screenReader: true });
    const r = await open();
    expect(drawn(r.root, ['namu', 'kkachi'])).toEqual(['kkachi', 'namu']);
  });

  it('an explicit tap folds every word card, with its reveal', async () => {
    seed('tap', 'letters');
    const r = await open();
    expect(drawn(r.root, ['namu', 'kkachi'])).toEqual([]);
    expect(byTestId(r.root, 'discover-reveal-word:까치')).not.toHaveLength(0);
  });
});

describe('Listen & Pick (quest host only)', () => {
  const text = (ko: string, romanization: string, en: string) => ({ ko, romanization, en });
  const OPTIONS = [
    { id: 'a', text: text('산', 'san', 'mountain') },
    { id: 'b', text: text('바다', 'bada', 'sea') },
    { id: 'c', text: text('까치', 'kkachi', 'magpie') },
    { id: 'd', text: text('떡국', 'tteokguk', 'rice cake soup') },
  ];
  const ROUNDS: ListenPickRound[] = [{ id: 'lp:word:san', prompt: text('산', 'san', 'mountain'), options: OPTIONS, answerId: 'a' }];
  const WORDS = OPTIONS.map((o) => o.text.romanization);
  let now = 1_000_000;
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockImplementation(() => (now += 1000));
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function game(mode: HostMode): Promise<ReactTestInstance> {
    const host: MinigameHost = { mode, answer: () => undefined, complete: () => undefined };
    const r = await track(await render(<ListenPickGame scope={{ kind: 'listen-pick', rounds: 1, listenPick: { rounds: ROUNDS } }} host={host} />));
    return r.root;
  }
  const board = (root: ReactTestInstance): ReactTestInstance => byTestId(root, 'listen-pick-options')[0]!;

  it('auto, reading, quest: the two decodable options fold, the two with an unmet letter stay; a touch and the answer reach every one', async () => {
    seed('auto', 'reading');
    const root = await game('quest');
    expect(drawn(board(root), WORDS)).toEqual(['kkachi', 'tteokguk']);
    await press(pressable(root, 'listen-pick-option-b'));
    expect(drawn(board(root), WORDS)).toEqual(['bada', 'kkachi', 'tteokguk']);
    await press(pressable(root, 'listen-pick-option-a'));
    expect(drawn(board(root), WORDS)).toEqual([...WORDS].sort());
  });

  it.each(['check', 'review'] as const)('auto, reading, %s: the fade folds nothing (the Check holds what it holds, not the fade)', async (mode) => {
    seed('auto', 'reading');
    const root = await game(mode);
    // The option lines are held (kept in room, unannounced) while the question is open, whatever the mode...
    expect(drawn(board(root), WORDS)).toEqual([]);
    await press(pressable(root, 'listen-pick-option-a'));
    // ...and come with the answer, every one, as for a default profile.
    expect(drawn(board(root), WORDS)).toEqual([...WORDS].sort());
  });

  it.each(['vocab', 'preview'] as const)('auto, reading, %s host: not the quest, so nothing folds', async (mode) => {
    seed('auto', 'reading');
    expect(drawn(board(await game(mode)), WORDS)).toEqual([...WORDS].sort());
  });

  it.each([
    ['the shipped default', undefined],
    ['an explicit always', 'always'],
  ] as const)('%s: every option is shown from the start, in every phase and host', async (_, choice) => {
    for (const phase of ['letters', 'reading', 'all'] as const) {
      for (const mode of ['quest', 'vocab', 'preview'] as const) {
        seed(choice, phase);
        expect(drawn(board(await game(mode)), WORDS)).toEqual([...WORDS].sort());
        await cleanup();
      }
    }
  });
});

describe('Pic-Word Match (quest host only)', () => {
  const scope = scopeFor('minigame:s1-nature-q1-apply')!;
  const pairs = validBoards(scope)[0]!.pairs;
  const romans = pairs.map((p) => p.word.romanization);
  /** 호랑이, 달 and 산 can be read after quest 10; 까치 has a tense consonant. */
  const theme = pairs.find((p) => p.word.ko === '까치')!;

  async function game(mode: HostMode): Promise<ReactTestInstance> {
    const host: MinigameHost = { mode, answer: () => undefined, complete: () => undefined };
    return (await track(await render(<PicWordMatchGame scope={scope} host={host} />))).root;
  }
  const words = (root: ReactTestInstance): ReactTestInstance => byTestId(root, 'pic-word-words')[0]!;

  it('auto, reading, quest: a readable word folds until it is selected; the theme word stays shown', async () => {
    seed('auto', 'reading');
    const root = await game('quest');
    expect(drawn(words(root), romans)).toEqual([theme.word.romanization]);
    const folded = pairs.find((p) => p.word.ko === '산')!;
    await press(pressable(root, `pic-word-word-${folded.id}`));
    expect(drawn(words(root), romans)).toEqual([folded.word.romanization, theme.word.romanization].sort());
  });

  it.each(['check', 'vocab'] as const)('auto, reading, %s host: nothing folds by the fade', async (mode) => {
    seed('auto', 'reading');
    const shown = drawn(words(await game(mode)), romans);
    // The Check holds its lines until each pair is matched (DC-1c); Words shows them all.
    expect(shown).toEqual(mode === 'check' ? [] : [...romans].sort());
  });

  it('the shipped default shows every word from the start, in every phase', async () => {
    for (const phase of ['letters', 'reading', 'all'] as const) {
      seed(undefined, phase);
      expect(drawn(words(await game('quest')), romans)).toEqual([...romans].sort());
      await cleanup();
    }
  });
});
