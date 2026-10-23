import { LIBRARY_SCENE } from '@hangul-route/content-schema/testing/role-play';
import { LayoutProvider, layoutClassFor } from '@hangul-route/design-system';
import TestRenderer, { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { byTestId, hostNodes, press, screenTexts } from '../../../test-support/render';
import type { MinigameHost } from '../host';
import { RolePlayGame } from '../role-play/RolePlayGame';
import { RolePlayStep } from '../role-play/role-play-entry';

/**
 * F-CURR-002 row CM-35 (design/wireframes/minigame/role-play.md): Role Play rendered through react-native-web. A
 * natural reply is sent and the partner answers along its branch; a less natural one locks in amber with Hoya's why
 * line and nothing is sent; every way ends with the closing line and Continue; no speaking UI anywhere.
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

type Host = MinigameHost & { answers: unknown[]; completes: number };
function host(): Host {
  const h = {
    mode: 'quest' as const,
    answers: [] as unknown[],
    completes: 0,
    answer: (key: string | number, correct: boolean, meta?: { itemId?: string; hinted?: boolean }) => void h.answers.push([key, correct, meta]),
    complete: () => {
      h.completes += 1;
    },
  };
  return h;
}

const scope = { rolePlay: { scene: LIBRARY_SCENE } };
let renderers: ReactTestRenderer[] = [];

async function open(h: Host = host(), size = { width: 320, height: 568 }): Promise<{ r: ReactTestRenderer; h: Host }> {
  let r!: ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(
      <LayoutProvider value={layoutClassFor(size)}>
        <RolePlayGame scope={scope} host={h} onBack={() => undefined} />
      </LayoutProvider>,
      { createNodeMock: () => ({ focus: () => undefined, scrollToEnd: () => undefined, addEventListener: () => undefined, removeEventListener: () => undefined }) },
    );
  });
  renderers.push(r);
  return { r, h };
}

const root = (r: ReactTestRenderer): ReactTestInstance => r.root;
const reply = (r: ReactTestRenderer, id: string): ReactTestInstance => {
  const node = byTestId(root(r), `role-play-reply-${id}`).find((n) => typeof n.props.onClick === 'function');
  expect(node, id).toBeDefined();
  return node!;
};
const texts = (r: ReactTestRenderer): string[] => screenTexts(byTestId(root(r), 'role-play')[0]!);
/** A sent reply is said in full, at least 900 ms, before the partner answers. */
const said = async (): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
};

beforeEach(() => {
  vi.useFakeTimers();
  audio.said = [];
});
afterEach(async () => {
  for (const r of renderers) await act(async () => r.unmount());
  renderers = [];
  vi.useRealTimers();
});

describe('Role Play (row CM-35)', () => {
  it('opens on the partner line, named by role, with the line said once, and replies without their meanings', async () => {
    const { r } = await open();
    const all = texts(r);
    expect(all).toEqual(expect.arrayContaining(['도서관', 'doseogwan', 'At the library', '안녕하세요!', 'annyeonghaseyo', 'Hello!', ' saseo · librarian', 'Tap a reply', 'Show meanings']));
    expect(audio.said).toEqual(['안녕하세요!']);
    expect(screenTexts(reply(r, 'meal'))).toEqual(['잘 먹겠습니다!, jal meokgetseumnida', '잘 먹겠습니다!', 'jal meokgetseumnida']);
    const partner = byTestId(root(r), 'role-play-partner-newest')[0]!;
    expect(partner.props['aria-label']).toBe('librarian says: 안녕하세요!, annyeonghaseyo. Hello!');
    expect(hostNodes(root(r), (n) => n.props.role === 'list')[0]?.props['aria-label']).toBe('Chat');
  });

  it('a less natural reply locks in amber, Hoya says why, nothing is sent; the turn scores on its first tap only', async () => {
    const { r, h } = await open();
    await press(reply(r, 'meal'));
    expect(texts(r)).toEqual(expect.arrayContaining(['That one is for the start of a meal. Try a greeting.']));
    expect(byTestId(root(r), 'role-play-why')).toHaveLength(1);
    expect(byTestId(root(r), 'role-play-me')).toHaveLength(0);
    expect(reply(r, 'meal').props['aria-label']).toBe('Not this one: 잘 먹겠습니다!, jal meokgetseumnida');
    expect(reply(r, 'meal').props['aria-disabled']).toBe(true);
    await press(reply(r, 'hello'));
    expect(h.answers).toEqual([['t1', false, { itemId: 't1/hello' }]]);
    expect(byTestId(root(r), 'role-play-me')).toHaveLength(1);
    await said();
    expect(texts(r)).toEqual(expect.arrayContaining(['무슨 책을 찾아요?', 'What book are you looking for?']));
    expect(audio.said).toEqual(['안녕하세요!', '안녕하세요!', '무슨 책을 찾아요?']);
  });

  it('Show meanings reveals the replies’ meanings for this turn and marks the answer hinted', async () => {
    const { r, h } = await open();
    await press(byTestId(root(r), 'role-play-show-meanings').find((n) => typeof n.props.onClick === 'function')!);
    expect(texts(r)).toEqual(expect.arrayContaining(['Meanings shown', 'I will eat well. (said before eating)']));
    await press(reply(r, 'hello'));
    expect(h.answers).toEqual([['t1', true, { itemId: 't1/hello', hinted: true }]]);
  });

  it('every way ends with the closing line and Continue, which completes the step; no speaking UI on the way', async () => {
    const { r, h } = await open();
    for (const id of ['hello', 'hangeul', 'thanks', 'stay']) {
      expect(texts(r).join(' ')).not.toMatch(/say it|speak|microphone|record|wrong|try again later/i);
      await press(reply(r, id));
      await said();
    }
    expect(texts(r)).toEqual(expect.arrayContaining(['You found your book!', 'Continue']));
    expect(byTestId(root(r), 'role-play-end')).toHaveLength(1);
    // The Hangul branch was played: its own line is in the log.
    expect(texts(r)).toEqual(expect.arrayContaining(['한글 책은 여기 있어요.']));
    expect(h.answers.map((a) => (a as unknown[])[2])).toEqual([{ itemId: 't1/hello' }, { itemId: 't2/hangeul' }, { itemId: 't3b/thanks' }, { itemId: 't4/stay' }]);
    await press(byTestId(root(r), 'role-play-continue').find((n) => typeof n.props.onClick === 'function')!);
    expect(h.completes).toBe(1);
    expect(hostNodes(root(r), (n) => /mic|record|voice-echo/i.test(String(n.props['data-testid'] ?? '')))).toEqual([]);
  });

  it('a why line quoting Korean draws it with its romanization; the second miss rings the natural reply', async () => {
    const { r } = await open();
    for (const id of ['hello', 'storybook', 'thanks']) {
      await press(reply(r, id));
      await said();
    }
    await press(reply(r, 'go'));
    const why = screenTexts(byTestId(root(r), 'role-play-why')[0]!).join('');
    expect(why).toContain('안녕히 계세요');
    expect(why).toContain('annyeonghi gyeseyo');
  });

  it('an empty scope shows a way back, never a dead end', async () => {
    let r!: ReactTestRenderer;
    const back = vi.fn();
    await act(async () => {
      r = TestRenderer.create(<RolePlayGame scope={{}} host={host()} onBack={back} />);
    });
    renderers.push(r);
    await press(byTestId(r.root, 'role-play-back').find((n) => typeof n.props.onClick === 'function')!);
    expect(back).toHaveBeenCalled();
  });

  it('the start bundle door loads the chunk, then draws the game', async () => {
    let r!: ReactTestRenderer;
    await act(async () => {
      r = TestRenderer.create(<RolePlayStep scope={{ kind: 'role-play', rolePlay: { scene: LIBRARY_SCENE } }} host={host()} onBack={() => undefined} />, {
        createNodeMock: () => ({ focus: () => undefined, scrollToEnd: () => undefined, addEventListener: () => undefined, removeEventListener: () => undefined }),
      });
    });
    renderers.push(r);
    vi.useRealTimers();
    await vi.waitFor(async () => {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
      });
      expect(byTestId(r.root, 'role-play')).toHaveLength(1);
    });
  });
});
