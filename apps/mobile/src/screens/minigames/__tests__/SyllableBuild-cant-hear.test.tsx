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

async function mount(props: { cantHear?: boolean; onFirst?: (c: boolean, h: boolean) => void } = {}): Promise<ReactTestRenderer> {
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

  it('Show the letters: focus goes to the speaker, then the block\'s romanization comes up (never the block), and the round goes on without a hint', async () => {
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
    // The block is still the answer: nothing printed it, and the answer is scored as an ordinary right one.
    expect(byTestId(r.root, 'syllable-build-built')).toHaveLength(0);
    await tap(r.root, 'syllable-build-tile-first:ㅂ');
    await tap(r.root, 'syllable-build-tile-vowel:ㅏ');
    await tap(r.root, 'syllable-build-tile-final:ㅂ');
    expect(onFirst).toHaveBeenCalledWith(true, false);
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
