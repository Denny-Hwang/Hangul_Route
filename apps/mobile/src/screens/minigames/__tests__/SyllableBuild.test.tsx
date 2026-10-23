import type { SyllableBuildRound } from '@hangul-route/content-schema';
import { LayoutProvider, layoutClassFor } from '@hangul-route/design-system';
import TestRenderer, { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MinigameScope } from '../../../logic/minigame-config';
import { useAudioStore } from '../../../store/audio-store';
import { byTestId, press, screenTexts } from '../../../test-support/render';
import type { MinigameHost } from '../host';
import { SOLVED_PAUSE_MS, SyllableBuildBoard } from '../SyllableBuildBoard';
import { SyllableBuildStep, syllableBuildChunk } from '../syllable-build-entry';

/**
 * F-CURR-002 section 7.1 F3 and section 12.2, row CM-32 (design/wireframes/minigame/syllable-build.md): the board at
 * 320 x 568 (jamo-only tiles of 64, the romanization held back, a miss in amber with where to listen, the ring after a
 * second miss, Show how it sounds as a hint, the no-voice state) and the quest step with `game.syllable-build` off (Listen
 * & Pick on the built block) and on (the game).
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const flag = vi.hoisted(() => ({ on: false }));
vi.mock('../../../store/remote-config-store', async (original) => ({
  ...((await original()) as Record<string, unknown>),
  useCurrFlag: (name: string) => (name === 'game.syllable-build' ? flag.on : false),
}));

const BAP = { ko: '밥', romanization: 'bap', gloss: 'rice, a meal' };
const TILES = { firstTiles: ['ㄱ', 'ㅂ', 'ㅁ', 'ㄷ'], vowelTiles: ['ㅏ', 'ㅓ', 'ㅗ', 'ㅜ'], finalTiles: ['ㅂ', 'ㄴ', 'ㅇ'] };
const mounted: ReactTestRenderer[] = [];

async function mount(element: React.ReactElement): Promise<ReactTestRenderer> {
  let r!: ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(<LayoutProvider value={layoutClassFor({ width: 320, height: 568 })}>{element}</LayoutProvider>, {
      createNodeMock: () => ({ focus: () => undefined, addEventListener: () => undefined, removeEventListener: () => undefined }),
    });
  });
  mounted.push(r);
  return r;
}

const tap = async (root: ReactTestInstance, id: string): Promise<void> => {
  const node = byTestId(root, id).find((n) => typeof n.props.onClick === 'function');
  expect(node, id).toBeDefined();
  await press(node!);
};
const texts = (r: ReactTestRenderer): string[] => screenTexts(r.root);

beforeEach(() => {
  useAudioStore.setState({ tts: { state: 'unknown' }, muted: false });
});
afterEach(async () => {
  for (const r of mounted.splice(0)) {
    await act(async () => {
      r.unmount();
    });
  }
  vi.useRealTimers();
});

describe('the Syllable Build board', () => {
  it('draws jamo-only tiles in three labelled rows and holds the romanization back until the block is right', async () => {
    vi.useFakeTimers();
    const onFirst = vi.fn();
    const onSolved = vi.fn();
    const r = await mount(<SyllableBuildBoard target={BAP} tiles={TILES} autoplay={false} source="syllable-build" onFirst={onFirst} onSolved={onSolved} />);
    const before = texts(r);
    for (const caption of ['First letter', 'Vowel', 'Final', 'No final', 'rice, a meal', 'Show how it sounds']) expect(before).toContain(caption);
    expect(before.join(' ')).not.toMatch(/\bbap\b/);
    expect(before).toContain('ㅂ, letter bieup');
    expect(before).toContain('ㅂ, letter bieup, as a final');
    await tap(r.root, 'syllable-build-tile-final:ㅂ');
    await tap(r.root, 'syllable-build-tile-first:ㅂ');
    expect(onFirst).not.toHaveBeenCalled();
    await tap(r.root, 'syllable-build-tile-vowel:ㅏ');
    expect(onFirst).toHaveBeenCalledWith(true, false);
    expect(texts(r)).toContain('You built it!');
    expect(texts(r).join(' ')).toMatch(/\bbap\b/);
    expect(onSolved).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(SOLVED_PAUSE_MS);
    });
    expect(onSolved).toHaveBeenCalledTimes(1);
  });

  it('a zone that does not fit is amber with where to listen; a second miss rings the right tile; only the first block scores', async () => {
    const onFirst = vi.fn();
    const r = await mount(<SyllableBuildBoard target={BAP} tiles={TILES} autoplay={false} source="syllable-build" onFirst={onFirst} onSolved={() => undefined} />);
    await tap(r.root, 'syllable-build-tile-first:ㅂ');
    await tap(r.root, 'syllable-build-tile-vowel:ㅓ');
    await tap(r.root, 'syllable-build-tile-final:ㅂ');
    expect(texts(r)).toContain('Listen to the middle sound.');
    expect(texts(r)).toContain('Vowel, ㅓ, letter eo, listen again');
    await tap(r.root, 'syllable-build-tile-vowel:ㅗ');
    expect(texts(r)).toContain('This one goes here.');
    await tap(r.root, 'syllable-build-tile-vowel:ㅏ');
    expect(onFirst).toHaveBeenCalledTimes(1);
    expect(onFirst).toHaveBeenCalledWith(false, false);
  });

  it('No final where there is a final asks about the end; a tap on a filled zone empties it', async () => {
    const r = await mount(<SyllableBuildBoard target={BAP} tiles={TILES} autoplay={false} source="syllable-build" onFirst={() => undefined} onSolved={() => undefined} />);
    await tap(r.root, 'syllable-build-tile-first:ㄱ');
    expect(texts(r)).toContain('First letter, ㄱ, letter giyeok');
    await tap(r.root, 'syllable-build-zone-first');
    expect(texts(r)).toContain('First letter, empty');
    await tap(r.root, 'syllable-build-tile-first:ㅂ');
    await tap(r.root, 'syllable-build-tile-vowel:ㅏ');
    await tap(r.root, 'syllable-build-tile-final:none');
    expect(texts(r)).toContain('Listen to the end: is there a final sound?');
  });

  it('Show how it sounds reveals the romanization and the block is recorded as hinted', async () => {
    const onFirst = vi.fn();
    const r = await mount(<SyllableBuildBoard target={BAP} tiles={TILES} autoplay={false} source="syllable-build" onFirst={onFirst} onSolved={() => undefined} />);
    await tap(r.root, 'syllable-build-meaning');
    expect(texts(r)).toContain('bap');
    for (const id of ['first:ㅂ', 'vowel:ㅏ', 'final:ㅂ']) await tap(r.root, `syllable-build-tile-${id}`);
    expect(onFirst).toHaveBeenCalledWith(true, true);
  });

  it('with no Korean voice the romanization shows from the start, with the sound notice, and is no hint', async () => {
    useAudioStore.setState({ tts: { state: 'none', reason: 'no_korean_voice' } });
    const onFirst = vi.fn();
    const r = await mount(<SyllableBuildBoard target={BAP} tiles={TILES} autoplay={false} source="syllable-build" onFirst={onFirst} onSolved={() => undefined} />);
    expect(texts(r)).toContain('bap');
    expect(texts(r)).not.toContain('Show how it sounds');
    expect(byTestId(r.root, 'syllable-build-prompt').length).toBeGreaterThan(0);
    for (const id of ['first:ㅂ', 'vowel:ㅏ', 'final:ㅂ']) await tap(r.root, `syllable-build-tile-${id}`);
    expect(onFirst).toHaveBeenCalledWith(true, false);
  });

  it('a symbol item at the produce rung: its zone is filled and locked, its row not drawn', async () => {
    const r = await mount(<SyllableBuildBoard target={BAP} tiles={TILES} fixed="first" autoplay={false} source="daily-review" onFirst={() => undefined} onSolved={() => undefined} />);
    expect(byTestId(r.root, 'syllable-build-tile-first:ㅂ')).toHaveLength(0);
    expect(texts(r)).toContain('First letter, ㅂ, letter bieup');
  });
});

const round: SyllableBuildRound = { id: 'sb:bap', target: { ko: '밥', romanization: 'bap', en: 'rice, a meal' }, ...TILES };
const scope: MinigameScope = { kind: 'syllable-build', syllableBuild: { rounds: [round] } };

function host(log: string[]): (played: MinigameScope) => MinigameHost {
  return (played) => ({
    mode: 'quest',
    answer: (key, correct, meta) => log.push(`${played.kind} ${String(key)} ${String(correct)} ${meta?.itemId ?? ''}${meta?.hinted ? ' hinted' : ''}`),
    complete: () => log.push(`complete ${played.kind}`),
  });
}

describe('a quest step with game.syllable-build off and on (section 12.2: no switch bricks a quest)', () => {
  it('off: Listen & Pick on the built block, the target and real blocks one zone away; the pick is recorded on its own scope', async () => {
    flag.on = false;
    await syllableBuildChunk();
    const log: string[] = [];
    const r = await mount(<SyllableBuildStep scope={scope} hostFor={host(log)} onBack={() => undefined} />);
    expect(byTestId(r.root, 'listen-pick-options').length).toBeGreaterThan(0);
    expect(byTestId(r.root, 'syllable-build-game')).toHaveLength(0);
    const options = byTestId(r.root, 'listen-pick-option-밥');
    expect(options.length).toBeGreaterThan(0);
    await tap(r.root, 'listen-pick-option-밥');
    expect(log[0]).toBe('listen-pick 0 true lp:syl:sb:bap');
  });

  it('on: the game, with its count, heading and Skip; Skip completes the step as the game it played', async () => {
    flag.on = true;
    await syllableBuildChunk();
    const log: string[] = [];
    const r = await mount(<SyllableBuildStep scope={scope} hostFor={host(log)} onBack={() => undefined} />);
    expect(byTestId(r.root, 'syllable-build-game').length).toBeGreaterThan(0);
    expect(texts(r)).toContain('Build the block you hear');
    expect(texts(r)).toContain('1 / 1');
    for (const id of ['first:ㅂ', 'vowel:ㅏ', 'final:ㅂ']) await tap(r.root, `syllable-build-tile-${id}`);
    expect(log).toEqual(['syllable-build sb:bap true sb:bap']);
    await tap(r.root, 'syllable-build-skip');
    expect(log).toEqual(['syllable-build sb:bap true sb:bap', 'complete syllable-build']);
  });
});
