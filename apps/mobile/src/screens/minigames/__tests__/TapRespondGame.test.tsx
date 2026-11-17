import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ADVANCE_MIN_MS } from '../../../logic/audio/reply-advance';
import { SCREEN_SETTLE_MS } from '../../../logic/audio/settle';
import type { MinigameScope } from '../../../logic/minigame-config';
import { useAudioStore } from '../../../store/audio-store';
import { byTestId, press, render, screenTexts, unmount } from '../../../test-support/render';
import { TapRespondGame } from '../TapRespondGame';

/**
 * [QS] AMENDMENTS-QUEST-SOUND-BACK QS-3: Tap and Respond says its first line 350 ms after the screen appears; the
 * next turn's line is said as the turn opens, and a tap on Hear it is immediate.
 */
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const audio = vi.hoisted(() => ({ said: [] as string[] }));
vi.mock('../../../platform/audio', async (orig) => ({
  ...(await orig<object>()),
  playPrompt: async (spec: { text: string }) => {
    audio.said.push(spec.text);
    return 'played';
  },
  stop: () => undefined,
}));
vi.mock('../../../platform/telemetry', async (orig) => ({ ...(await orig<object>()), track: vi.fn(async () => undefined) }));

const scope: MinigameScope = {
  kind: 'tap-respond',
  dialogue: [
    {
      npcKo: '안녕하세요!',
      npcEn: 'Hello!',
      options: [
        { ko: '안녕하세요!', en: 'Hello!', isCorrect: true },
        { ko: '감사합니다.', en: 'Thank you.', isCorrect: false },
      ],
    },
    {
      npcKo: '이름이 뭐예요?',
      npcEn: 'What is your name?',
      options: [
        { ko: '저는 다미예요.', en: 'I am Dami.', isCorrect: true },
        { ko: '안녕히 가세요.', en: 'Goodbye.', isCorrect: false },
      ],
    },
  ],
};
const tick = async (ms: number): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};
const hearIt = (root: ReactTestInstance): ReactTestInstance => {
  const node = byTestId(root, 'tap-respond-hear').find((n) => typeof n.props.onClick === 'function');
  if (!node) throw new Error('no Hear it');
  return node;
};
const mounted: ReactTestRenderer[] = [];
const open = async (): Promise<ReactTestRenderer> => {
  const r = await render(<TapRespondGame scope={scope} onFinish={() => undefined} />);
  mounted.push(r);
  return r;
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  audio.said = [];
  useAudioStore.setState({ muted: false });
});
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  vi.useRealTimers();
});

describe('[QS] the first line waits 350 ms for the screen (QS-3)', () => {
  it('nothing is said while the screen arrives; then the line; the next turn says its line as it opens', async () => {
    const r = await open();
    await tick(SCREEN_SETTLE_MS - 1);
    expect(audio.said).toEqual([]);
    await tick(1);
    expect(audio.said).toEqual(['안녕하세요!']);
    await press(r.root.findAll((n) => n.props.role === 'button' && typeof n.props.onClick === 'function' && screenTexts(n).some((t) => t.includes('안녕하세요!')) && n.props.testID !== 'tap-respond-hear').at(-1)!);
    expect(audio.said).toEqual(['안녕하세요!', '안녕하세요!']); // the reply
    await tick(ADVANCE_MIN_MS);
    expect(audio.said).toEqual(['안녕하세요!', '안녕하세요!', '이름이 뭐예요?']);
  });

  it('a tap on Hear it during the wait plays at once, and the line is not said a second time', async () => {
    const r = await open();
    await tick(100);
    await press(hearIt(r.root));
    expect(audio.said).toEqual(['안녕하세요!']);
    await tick(2_000);
    expect(audio.said).toEqual(['안녕하세요!']);
  });

  it('with sound off nothing is scheduled, and a game left during the wait says nothing', async () => {
    useAudioStore.setState({ muted: true });
    await open();
    await tick(2_000);
    expect(audio.said).toEqual([]);
    useAudioStore.setState({ muted: false });
    const r = await render(<TapRespondGame scope={scope} onFinish={() => undefined} />);
    await tick(100);
    await unmount(r);
    await tick(2_000);
    expect(audio.said).toEqual([]);
  });
});
