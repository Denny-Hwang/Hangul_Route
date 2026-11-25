import { LayoutProvider, layoutClassFor } from '@hangul-route/design-system';
import { getMessages } from '@hangul-route/i18n';
import TestRenderer, { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { endVoiceCheckHold, useAudioStore } from '../../../store/audio-store';
import { clearReaderLog, focusNodes, hasId, pressableById } from '../../../test-support/cant-hear-rig';
import { byTestId, press, textOf } from '../../../test-support/render';
import type { MinigameHost } from '../host';
import { SyllableBuildBoard } from '../SyllableBuildBoard';
import { SyllableBuildGame } from '../SyllableBuildGame';

/**
 * "Can't hear it?" on Syllable Build (AMENDMENTS-AUDIO-CANT-HEAR row CH-1b, section 3.1, test 18): the link sits next to
 * the speaker in the quest step and the review round (`cantHear`), and not in the Block Sprint (a clocked drill, which
 * leaves the prop off). Show the letters shows the block's romanization, never the block, and the round goes on with
 * `voice: false`, so the "Show how it sounds" reveal is not counted as a hint.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

vi.mock('../../../platform/device-family', () => ({ currentDeviceFamily: () => 'computer' }));
const reader = vi.hoisted(() => ({ log: [] as string[], announced: [] as string[] }));
vi.mock('../../../platform/screen-reader', async (importOriginal) => (await import('../../../test-support/cant-hear-rig')).screenReaderStandIn(reader, await importOriginal<object>()));
vi.mock('react-native', async (importOriginal) => (await import('../../../test-support/cant-hear-rig')).reactNativeWithModal(await importOriginal<object>()));

const T = getMessages('en').learner.audio;
const BAP = { ko: '밥', romanization: 'bap', gloss: 'rice, a meal' };
const TILES = { firstTiles: ['ㄱ', 'ㅂ', 'ㅁ', 'ㄷ'], vowelTiles: ['ㅏ', 'ㅓ', 'ㅗ', 'ㅜ'], finalTiles: ['ㅂ', 'ㄴ', 'ㅇ'] };
const mounted: ReactTestRenderer[] = [];

async function mount(props: { cantHear?: boolean; onFirst?: (c: boolean, h: boolean, a?: boolean) => void } = {}): Promise<ReactTestRenderer> {
  let r!: ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(
      <LayoutProvider value={layoutClassFor({ width: 320, height: 568 })}>
        <SyllableBuildBoard target={BAP} tiles={TILES} autoplay={false} source="syllable-build" onFirst={props.onFirst ?? (() => undefined)} onSolved={() => undefined} {...(props.cantHear === undefined ? {} : { cantHear: props.cantHear })} />
      </LayoutProvider>,
      { createNodeMock: focusNodes(['syllable-build-speaker']) as never },
    );
  });
  mounted.push(r);
  return r;
}

const tap = async (root: ReactTestInstance, id: string): Promise<void> => press(pressableById(root, id));
const tick = async (ms: number): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  endVoiceCheckHold();
  useAudioStore.setState({ tts: { state: 'unknown' }, muted: false, showLetters: false });
  clearReaderLog(reader);
});
afterEach(async () => {
  for (const r of mounted.splice(0)) {
    await act(async () => {
      r.unmount();
    });
  }
  vi.useRealTimers();
});

describe('Syllable Build, "Can\'t hear it?" (test 18)', () => {
  it('shows the link next to the speaker when the surface opts in, and not when it does not (the Block Sprint)', async () => {
    const on = await mount({ cantHear: true });
    expect(hasId(on.root, 'cant-hear')).toBe(true);
    const order = on.root.findAll((n) => typeof n.type === 'string' && ['syllable-build-speaker', 'cant-hear', 'syllable-build-tile-first:ㅂ'].includes(String(n.props['data-testid'])));
    expect(order.map((n) => n.props['data-testid'])).toEqual(['syllable-build-speaker', 'cant-hear', 'syllable-build-tile-first:ㅂ']);
    const off = await mount();
    expect(hasId(off.root, 'cant-hear')).toBe(false);
  });

  it('Show the letters: focus goes to the speaker, then the block\'s romanization comes up (never the block), and the round goes on with the ask marked', async () => {
    const onFirst = vi.fn();
    const r = await mount({ cantHear: true, onFirst });
    expect(hasId(r.root, 'syllable-build-sound')).toBe(false);
    await tap(r.root, 'cant-hear');
    clearReaderLog(reader);
    await tap(r.root, 'cant-hear-show-letters');
    await tick(0);
    expect(reader.log).toEqual(['focus:syllable-build-speaker']);
    expect(hasId(r.root, 'syllable-build-sound')).toBe(false);
    await tick(320);
    expect(textOf(byTestId(r.root, 'syllable-build-sound')[0]!)).toBe('bap');
    expect(reader.announced).toEqual(['bap']);
    expect(hasId(r.root, 'cant-hear')).toBe(false);
    // The block is still the answer: nothing printed it, and the answer is scored as a right one (marked asked, CH-1f).
    expect(byTestId(r.root, 'syllable-build-built')).toHaveLength(0);
    await tap(r.root, 'syllable-build-tile-first:ㅂ');
    await tap(r.root, 'syllable-build-tile-vowel:ㅏ');
    await tap(r.root, 'syllable-build-tile-final:ㅂ');
    expect(onFirst).toHaveBeenCalledWith(true, false, true);
  });

  it('Always show the letters (CH-2): the round opens with the block\'s romanization (never the block) and no link; the Block Sprint is left alone', async () => {
    useAudioStore.setState({ showLetters: true });
    const on = await mount({ cantHear: true });
    expect(textOf(byTestId(on.root, 'syllable-build-sound')[0]!)).toBe('bap');
    expect(hasId(on.root, 'cant-hear')).toBe(false);
    expect(byTestId(on.root, 'syllable-build-built')).toHaveLength(0);
    const sprint = await mount();
    expect(hasId(sprint.root, 'syllable-build-sound')).toBe(false);
  });

  it('is guidance for this device: one line, Show the letters and Hear it', async () => {
    const r = await mount({ cantHear: true });
    await tap(r.root, 'cant-hear');
    expect(textOf(byTestId(r.root, 'cant-hear-line')[0]!)).toBe(T.cantHear.lines.computer);
    expect(hasId(r.root, 'cant-hear-show-letters')).toBe(true);
    expect(hasId(r.root, 'cant-hear-hear')).toBe(true);
  });
});

describe('the quest step passes it (test 18)', () => {
  it('SyllableBuildGame shows the link on its board', async () => {
    const round = { id: 'sb:bap', target: { ko: '밥', romanization: 'bap', en: 'rice, a meal' }, ...TILES };
    const host: MinigameHost = { mode: 'quest', answer: () => undefined, complete: () => undefined };
    let r!: ReactTestRenderer;
    await act(async () => {
      r = TestRenderer.create(
        <LayoutProvider value={layoutClassFor({ width: 320, height: 568 })}>
          <SyllableBuildGame scope={{ kind: 'syllable-build', syllableBuild: { rounds: [round] } }} host={host} />
        </LayoutProvider>,
        { createNodeMock: focusNodes(['syllable-build-speaker']) as never },
      );
    });
    mounted.push(r);
    expect(hasId(r.root, 'cant-hear')).toBe(true);
  });
});

/**
 * The hinted mark (AMENDMENTS-AUDIO-CANT-HEAR row CH-1f, section 3.13, test 22): a right first block after the learner's own
 * Show the letters says `asked` (third argument), though `voice` is off then and the "Show how it sounds" reveal alone would
 * not count; a wrong block after it is a plain miss; text with no ask says nothing.
 */
describe('Syllable Build, the hinted mark (CH-1f, test 22)', () => {
  const build = async (r: ReactTestRenderer, vowel: string): Promise<void> => {
    await tap(r.root, 'syllable-build-tile-first:ㅂ');
    await tap(r.root, `syllable-build-tile-vowel:${vowel}`);
    await tap(r.root, 'syllable-build-tile-final:ㅂ');
  };
  const ask = async (r: ReactTestRenderer): Promise<void> => {
    await tap(r.root, 'cant-hear');
    await tap(r.root, 'cant-hear-show-letters');
    await tick(400);
  };

  it('asked, then the right block first: `onFirst(true, false, true)`', async () => {
    const onFirst = vi.fn();
    const r = await mount({ cantHear: true, onFirst });
    await ask(r);
    await build(r, 'ㅏ');
    expect(onFirst.mock.calls).toEqual([[true, false, true]]);
  });

  it('asked, then a wrong block first: a plain miss, `onFirst(false, false)`, and the fixed block after it is not another first answer', async () => {
    const onFirst = vi.fn();
    const r = await mount({ cantHear: true, onFirst });
    await ask(r);
    await build(r, 'ㅓ');
    await tap(r.root, 'syllable-build-tile-vowel:ㅏ');
    expect(onFirst.mock.calls).toEqual([[false, false]]);
  });

  it('not asked: `onFirst(true, false)`, with no third argument', async () => {
    const onFirst = vi.fn();
    const r = await mount({ cantHear: true, onFirst });
    await build(r, 'ㅏ');
    expect(onFirst.mock.calls).toEqual([[true, false]]);
  });

  it('Show how it sounds first and Show the letters after it: the right block keeps the reveal\'s own hint and is marked asked too', async () => {
    const onFirst = vi.fn();
    const r = await mount({ cantHear: true, onFirst });
    await tap(r.root, 'syllable-build-meaning');
    await ask(r);
    await build(r, 'ㅏ');
    // The reveal was made with a voice present, so the ask must not erase it (a review's stars count it).
    expect(onFirst.mock.calls).toEqual([[true, true, true]]);
  });

  it('Show the letters without a reveal: asked, and not hinted', async () => {
    const onFirst = vi.fn();
    const r = await mount({ cantHear: true, onFirst });
    await ask(r);
    await build(r, 'ㅏ');
    expect(onFirst.mock.calls).toEqual([[true, false, true]]);
  });

  it('Sound off and "Always show the letters" show the romanization with no ask: no mark', async () => {
    const off = vi.fn();
    useAudioStore.setState({ muted: true });
    const muted = await mount({ cantHear: true, onFirst: off });
    await build(muted, 'ㅏ');
    expect(off.mock.calls).toEqual([[true, false]]);
    useAudioStore.setState({ muted: false, showLetters: true });
    const always = vi.fn();
    const r = await mount({ cantHear: true, onFirst: always });
    await build(r, 'ㅏ');
    expect(always.mock.calls).toEqual([[true, false]]);
  });

  it('the quest step: asked, then the right block is hinted for the host; a wrong block is a plain miss; no ask says nothing', async () => {
    const round = { id: 'sb:bap', target: { ko: '밥', romanization: 'bap', en: 'rice, a meal' }, ...TILES };
    const seen: Array<[boolean, unknown]> = [];
    const host: MinigameHost = { mode: 'quest', answer: (_k, correct, meta) => void seen.push([correct, meta]), complete: () => undefined };
    const play = async (steps: (r: ReactTestRenderer) => Promise<void>, vowel: string): Promise<void> => {
      let r!: ReactTestRenderer;
      await act(async () => {
        r = TestRenderer.create(
          <LayoutProvider value={layoutClassFor({ width: 320, height: 568 })}>
            <SyllableBuildGame scope={{ kind: 'syllable-build', syllableBuild: { rounds: [round] } }} host={host} />
          </LayoutProvider>,
          { createNodeMock: focusNodes(['syllable-build-speaker']) as never },
        );
      });
      mounted.push(r);
      await steps(r);
      await build(r, vowel);
    };
    await play(ask, 'ㅏ');
    await play(ask, 'ㅓ');
    await play(async () => undefined, 'ㅏ');
    expect(seen).toEqual([
      [true, { itemId: 'sb:bap', hinted: true }],
      [false, { itemId: 'sb:bap' }],
      [true, { itemId: 'sb:bap' }],
    ]);
  });
});
