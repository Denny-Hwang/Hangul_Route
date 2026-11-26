import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RomanizationModeOverride } from '../../../i18n/use-romanization-mode';
import { byTestId, hostNodes, render, unmount } from '../../../test-support/render';
import { MinigameScreen } from '../MinigameScreen';
import { endVoiceCheckHold } from '../../../store/audio-store';

/**
 * AMENDMENTS-STAGE1-DECODING-CHECK section 3.3 (row DC-1c) through the real quest host: Tap Respond is mounted without a host,
 * so the screen hands it a `hold` boolean. A Check step holds the NPC line's romanization and the replies' romanization and
 * meanings until the right reply; a practice step of the same game shows them from the start.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

vi.mock('../../../platform/telemetry', () => ({ track: vi.fn(() => Promise.resolve()) }));
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
vi.mock('../../../content', () => ({
  episodesAll: [],
  questsAll: [],
  questById: (id: string) =>
    id === 'q-tap'
      ? {
          id,
          steps: [
            { kind: 'check', minigameRef: 'mg-tap' },
            { kind: 'practice', minigameRef: 'mg-tap' },
          ],
        }
      : undefined,
}));
vi.mock('../../../logic/minigame-config', () => ({
  scopeFor: (ref: string) =>
    ref === 'mg-tap'
      ? {
          kind: 'tap-respond',
          dialogue: [
            {
              npcKo: '이름이 뭐예요?',
              npcRomanization: 'ireumi mwoyeyo?',
              npcEn: 'What is your name?',
              options: [
                { ko: '저는 다미예요.', romanization: 'jeoneun damiyeyo.', en: 'I am Dami.', isCorrect: true },
                { ko: '안녕히 가세요.', romanization: 'annyeonghi gaseyo.', en: 'Goodbye.', isCorrect: false },
              ],
            },
          ],
        }
      : undefined,
}));
vi.mock('../../../logic/content-locale', () => ({ localizeScope: (scope: unknown) => scope, localizeQuest: (quest: unknown) => quest }));
vi.mock('../../../store/quest-run-store', () => {
  const state = { questId: null, short: undefined, answerRound: () => undefined, markStepComplete: () => undefined };
  return { useQuestRunStore: Object.assign(() => state, { getState: () => state }) };
});

const mounted: ReactTestRenderer[] = [];
beforeEach(() => {
  endVoiceCheckHold();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
});
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  vi.useRealTimers();
});

const mount = async (stepIndex: number): Promise<ReactTestInstance> => {
  const route = { key: 'Minigame-1', name: 'Minigame' as const, params: { questId: 'q-tap', episodeId: 'e', stepIndex } };
  const r = await render(
    <RomanizationModeOverride mode="always">
      <MinigameScreen route={route} onBack={() => undefined} />
    </RomanizationModeOverride>,
  );
  mounted.push(r);
  await act(async () => {
    await vi.dynamicImportSettled();
  });
  return r.root;
};

const off = (node: ReactTestInstance): boolean => node.props['aria-hidden'] === true || JSON.stringify(node.props.style ?? {}).includes('"opacity":0');
/** The held lines under `node`: text kept for its room, drawn invisible and off the accessibility tree. */
const held = (node: ReactTestInstance): number => hostNodes(node, (n) => off(n) && n.children.some((c) => typeof c === 'string' && c.trim() !== '')).length;

describe('Tap Respond through the quest host', () => {
  it('a Check step holds the NPC line and the replies (romanization and meaning): one held line on the line, two on each reply', async () => {
    const root = await mount(0);
    expect(held(byTestId(root, 'tap-respond-round')[0]!)).toBe(1);
    expect(held(byTestId(root, 'tap-respond-option-저는 다미예요.')[0]!)).toBe(2);
    expect(held(byTestId(root, 'tap-respond-option-안녕히 가세요.')[0]!)).toBe(2);
  });

  it('a practice step of the same game holds nothing', async () => {
    const root = await mount(1);
    expect(held(root)).toBe(0);
  });
});
