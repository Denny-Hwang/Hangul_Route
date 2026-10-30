import type { ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MinigameHost } from '../host';
import { render, unmount } from '../../../test-support/render';
import { MinigameScreen } from '../MinigameScreen';

/**
 * F-CURR-002 section 4.3 through the real quest host: what reaches the run store (and so the memory store) as hinted.
 * Type Hangul's hint (Dictation's Show how it sounds, a typed answer one letter off, row CM-31) is a hinted right
 * answer whatever it scored; Story Order's Show meanings (row CM-34, and its Story Sequence fallback, which passes the
 * hint on every answer) and Role Play's (row CM-35) are help shown, so a wrong answer with one stays a plain miss.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const runStore = vi.hoisted(() => ({ answers: [] as unknown[][] }));
// Each game only hands its host to the test, which answers as the game would.
const hosts = vi.hoisted(() => {
  const state = { last: undefined as MinigameHost | undefined, capture: ({ host }: { host: MinigameHost }): null => ((state.last = host), null) };
  return state;
});

vi.mock('../../../platform/telemetry', () => ({ track: () => Promise.resolve() }));
vi.mock('@react-navigation/native', async () => {
  const { createContext, useEffect } = await import('react');
  return {
    NavigationContext: createContext(undefined),
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
    useNavigation: () => ({ goBack: () => undefined, navigate: () => undefined }),
    StackActions: { push: () => undefined },
  };
});
vi.mock('../TraceStrokeGame', () => ({ TraceStrokeGame: () => null }));
vi.mock('../TraceWordGame', () => ({ TraceWordGame: () => null }));
vi.mock('../../use-practice-session', () => ({ usePracticeSession: () => undefined }));
vi.mock('../../lesson-content', () => ({ useLessonQuestReady: () => true, LessonWaiting: () => null }));
vi.mock('../../story-content', () => ({ useStoryQuestReady: () => true }));
vi.mock('../../../content', () => ({
  questById: (id: string) => ({ id, steps: [{ kind: 'check', minigameRef: `mg-${id}` }] }),
}));
vi.mock('../../../logic/minigame-config', () => ({
  scopeFor: (ref: string) => ({ ref, kind: ref.slice('mg-'.length), rounds: [] }),
}));
vi.mock('../../../logic/content-locale', () => ({ localizeScope: (scope: unknown) => scope, localizeQuest: (quest: unknown) => quest }));
vi.mock('../../../logic/role-play/fallback', () => ({ playedScope: (scope: unknown) => scope }));
vi.mock('../../../store/remote-config-store', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useFrozenCurrFlag: () => true,
}));
vi.mock('../dictation-entry', () => ({ useSwitchedScope: (scope: unknown) => ({ kind: 'ready', scope, kit: null }) }));
vi.mock('../TypeHangulGame', () => ({ TypeHangulGame: hosts.capture }));
vi.mock('../story-order/StoryOrderStep', () => ({ StoryOrderStep: hosts.capture }));
vi.mock('../role-play/role-play-entry', () => ({ RolePlayStep: hosts.capture }));
vi.mock('../../../store/quest-run-store', () => {
  const state = {
    questId: null,
    short: undefined,
    answerRound: (...args: unknown[]) => void runStore.answers.push(args),
    markStepComplete: () => undefined,
  };
  return { useQuestRunStore: Object.assign(() => state, { getState: () => state }) };
});

const route = (kind: string) => ({ key: `Minigame-${kind}`, name: 'Minigame' as const, params: { questId: kind, episodeId: 'e', stepIndex: 0 } });

beforeEach(() => {
  runStore.answers = [];
  hosts.last = undefined;
});
let mounted: ReactTestRenderer | undefined;
afterEach(async () => {
  if (mounted) await unmount(mounted);
  mounted = undefined;
});

/** Plays two first answers with the hint shown, one right and one wrong, and returns the `hinted` the store got. */
async function hintedOf(kind: string): Promise<Array<[boolean, boolean | undefined]>> {
  mounted = await render(<MinigameScreen route={route(kind)} onBack={() => undefined} />);
  const host = hosts.last;
  expect(host, kind).toBeDefined();
  host!.answer('r1', true, { itemId: 'i1', hinted: true });
  host!.answer('r2', false, { itemId: 'i2', hinted: true });
  host!.answer('r3', false, { itemId: 'i3' });
  return runStore.answers.map((a) => [a[1] as boolean, a[3] as boolean | undefined]);
}

describe('the quest host passes a hint to the run store by the game that showed it (section 4.3)', () => {
  it('Type Hangul (Dictation): a hinted answer is hinted whatever it scored', async () => {
    expect(await hintedOf('type-hangul')).toEqual([
      [true, true],
      [false, true],
      [false, false],
    ]);
  });

  it.each(['story-order', 'role-play'])('%s: the hint counts only with a right answer; a hinted miss is a plain miss', async (kind) => {
    expect(await hintedOf(kind)).toEqual([
      [true, true],
      [false, false],
      [false, false],
    ]);
  });
});
