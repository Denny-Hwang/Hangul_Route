import { TAP_LOCK_MS } from '@hangul-route/design-system/tap-model';
import { LayoutProvider, layoutClassFor } from '@hangul-route/design-system';
import { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RomanizationModeOverride } from '../../../i18n/use-romanization-mode';
import { CLOZE_ADVANCE_MS } from '../../../logic/cloze-pick/flow';
import { clozeFixtureScope, type ClozeFixture } from '../../../logic/cloze-pick/e2e-rounds';
import { tileId } from '../../../logic/cloze-pick/round';
import { byTestId, press, render, screenTexts, unmount } from '../../../test-support/render';
import { ClozePickGame } from '../ClozePickGame';
import type { MinigameHost } from '../host';
import { SENTENCE_SOUND_MAX_MS } from '../../../logic/audio/sound-pacing';

/**
 * F-CURR-002 row CM-30 (design/wireframes/minigame/cloze-pick.md): Cloze Pick rendered through react-native-web. A
 * reading round: nothing is said before the answer; a tile that does not fit is amber with its mark (never red),
 * Hoya says the gap's line, the second miss rings the tile that fits; the right tile fills the gap, the completed
 * sentence is said once, Hear it replays it, and the step completes after the last round. First answers score.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const audio = vi.hoisted(() => ({
  playPrompt: vi.fn((_spec: { text: string; kind?: string; source?: string }) => Promise.resolve('played' as const)),
  stop: vi.fn(),
  hasClip: vi.fn(() => false),
}));
vi.mock('../../../platform/audio', async (importOriginal) => ({ ...(await importOriginal<object>()), ...audio }));
const motion = vi.hoisted(() => ({ reduced: true }));
vi.mock('../../../platform/motion', () => ({ useReducedMotion: () => motion.reduced }));

function host(mode: MinigameHost['mode'] = 'quest') {
  const h = {
    mode,
    answers: [] as Array<[string | number, boolean, string | undefined]>,
    completes: 0,
    answer: (key: string | number, correct: boolean, meta?: { itemId?: string }) => void h.answers.push([key, correct, meta?.itemId]),
    complete: () => {
      h.completes += 1;
    },
  };
  return h;
}

const mounted: ReactTestRenderer[] = [];
async function play(keys: ClozeFixture[], options: { width?: number; mode?: 'always' | 'tap'; h?: ReturnType<typeof host> } = {}) {
  const h = options.h ?? host();
  const r = await render(
    <LayoutProvider value={layoutClassFor({ width: options.width ?? 320, height: 568 })}>
      <RomanizationModeOverride mode={options.mode ?? 'always'}>
        <ClozePickGame scope={clozeFixtureScope(keys)} host={h} />
      </RomanizationModeOverride>
    </LayoutProvider>,
  );
  mounted.push(r);
  return { r, h };
}

const tile = (r: ReactTestRenderer, id: string) => byTestId(r.root, `cloze-pick-tile-${id}`).find((n) => typeof n.props.onClick === 'function');
const tap = async (r: ReactTestRenderer, id: string): Promise<void> => {
  // Taps a beat apart: a touch inside TAP_LOCK_MS of the last one is a bounce (AMENDMENTS-TOUCH KT-D5).
  await act(async () => {
    vi.advanceTimersByTime(TAP_LOCK_MS);
  });
  const node = tile(r, id);
  expect(node, id).toBeDefined();
  await press(node!);
};
const texts = (r: ReactTestRenderer): string[] => screenTexts(r.root);

beforeEach(() => {
  vi.clearAllMocks();
  motion.reduced = true;
  vi.useFakeTimers();
});
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  vi.useRealTimers();
});

describe('Cloze Pick', () => {
  it('asks with the sentence, its gap, its romanization and meaning; tiles show Korean and romanization, no gloss; nothing is said', async () => {
    const { r } = await play(['word']);
    const all = texts(r);
    expect(all).toContain('Fill the gap');
    expect(all).toContain('Pick the word that fits.');
    expect(all).toContain('chaegeul ___.');
    expect(all).toContain('I read a book.');
    expect(all).toContain('Sentence: chaegeul blank. I read a book.');
    for (const ko of ['읽어요', '먹어요', '마셔요']) expect(all.join(' ')).toContain(ko);
    for (const gloss of ['read', 'eat', 'drink']) expect(all).not.toContain(gloss);
    expect(byTestId(r.root, 'cloze-pick-hear-it')).toHaveLength(0);
    expect(audio.playPrompt).not.toHaveBeenCalled();
  });

  it('a miss is amber with Hoya, the second rings the tile that fits; only the first answer scores', async () => {
    const { r, h } = await play(['word']);
    await tap(r, tileId('e2e-cloze-word', 1));
    expect(texts(r)).toContain('Read the sentence again. Which one fits?');
    expect(texts(r).some((t) => t.startsWith('Not this one:'))).toBe(true);
    expect(audio.playPrompt).not.toHaveBeenCalled();
    await tap(r, tileId('e2e-cloze-word', 2));
    expect(texts(r)).toContain('This one fits here.');
    expect(texts(r).some((t) => t.startsWith('Look here: 읽어요'))).toBe(true);
    await tap(r, tileId('e2e-cloze-word', 0));
    expect(h.answers).toEqual([
      [0, false, 'e2e-cloze-word'],
      [0, false, 'e2e-cloze-word'],
      [0, true, 'e2e-cloze-word'],
    ]);
  });

  it('the right tile fills the gap, the completed sentence is said once, Hear it replays it, then the step completes', async () => {
    const { r, h } = await play(['word', 'particle']);
    await tap(r, tileId('e2e-cloze-word', 0));
    expect(textsOf(r, 'cloze-pick-gap')).toContain('읽어요');
    expect(texts(r)).toContain('chaegeul ilgeoyo.');
    expect(texts(r)).toContain('Sentence complete: chaegeul ilgeoyo. I read a book.');
    expect(audio.playPrompt).toHaveBeenCalledTimes(1);
    expect(audio.playPrompt.mock.calls[0]?.[0]).toMatchObject({ text: '책을 읽어요.', kind: 'sentence', source: 'cloze-pick' });
    const hear = byTestId(r.root, 'cloze-pick-hear-it').find((n) => typeof n.props.onClick === 'function');
    // A screen reader reaches it: no ancestor groups it into one accessible element (VoiceOver, TalkBack).
    for (let up = hear?.parent; up; up = up.parent) expect(up.props.accessible, 'an accessible ancestor').not.toBe(true);
    await press(hear!);
    expect(audio.playPrompt).toHaveBeenCalledTimes(2);
    await act(async () => {
      vi.advanceTimersByTime(CLOZE_ADVANCE_MS);
    });
    // Round 2, a particle gap: its own instruction, and Sentence Builder's line on a miss.
    expect(texts(r)).toContain('Pick the piece that fits.');
    await tap(r, tileId('e2e-cloze-particle', 1));
    expect(texts(r)).toContain('Look at how the word before it ends.');
    expect(audio.playPrompt).toHaveBeenCalledTimes(2);
    await tap(r, tileId('e2e-cloze-particle', 0));
    expect(texts(r)).toContain('mureul masyeoyo.');
    await act(async () => {
      vi.advanceTimersByTime(CLOZE_ADVANCE_MS);
    });
    expect(h.completes).toBe(1);
  });

  it('a value gap draws its card above the sentence and says the card line on a miss', async () => {
    const { r } = await play(['value']);
    expect(byTestId(r.root, 'cloze-pick-realia').length).toBeGreaterThan(0);
    expect(texts(r)).toContain('Read the menu, sign or ticket, then pick.');
    expect(texts(r)).toContain('It is ___ won.');
    await tap(r, tileId('e2e-cloze-value', 1));
    expect(texts(r)).toContain('Look again');
    await tap(r, tileId('e2e-cloze-value', 0));
    expect(texts(r)).toContain('It is three thousand won.');
  });

  it('in a review session no per-item line shows and no ring', async () => {
    const { r } = await play(['word'], { h: host('review') });
    await tap(r, tileId('e2e-cloze-word', 1));
    await tap(r, tileId('e2e-cloze-word', 2));
    expect(texts(r)).not.toContain('Read the sentence again. Which one fits?');
    expect(texts(r)).not.toContain('This one fits here.');
  });

  it('tap mode hides the romanization until the answer', async () => {
    const { r } = await play(['word'], { mode: 'tap' });
    expect(texts(r)).not.toContain('chaegeul ___.');
    await tap(r, tileId('e2e-cloze-word', 0));
    expect(texts(r)).toContain('chaegeul ilgeoyo.');
  });

  it('plays the same with motion allowed (the gap fills with a short move)', async () => {
    motion.reduced = false;
    const { r, h } = await play(['word'], { width: 768 });
    await tap(r, tileId('e2e-cloze-word', 0));
    expect(textsOf(r, 'cloze-pick-gap')).toContain('읽어요');
    await act(async () => {
      vi.advanceTimersByTime(CLOZE_ADVANCE_MS);
    });
    expect(h.completes).toBe(1);
  });

  it('an empty scope says so and keeps the way back', async () => {
    const back = vi.fn();
    const r = await render(<ClozePickGame scope={{ kind: 'cloze-pick', clozePick: { rounds: [] } }} host={host()} onBack={back} />);
    mounted.push(r);
    expect(texts(r)).toContain('Nothing to play here');
    const button = r.root.findAll((n) => typeof n.props.onClick === 'function' && screenTexts(n).includes('Back to quest'))[0];
    await press(button!);
    expect(back).toHaveBeenCalled();
  });
});

function textsOf(r: ReactTestRenderer, id: string): string[] {
  return byTestId(r.root, id).flatMap((n) => screenTexts(n));
}

/** [QS] AMENDMENTS-QUEST-SOUND-BACK QS-4: the completed sentence is said to its end before the next round. */
describe('[QS-4] the next round waits for the sentence', () => {
  const advance = async (ms: number): Promise<void> => {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  };

  it('held past the cloze delay while the sentence is being said, released when it ends', async () => {
    let end: () => void = () => undefined;
    audio.playPrompt.mockImplementationOnce(() => new Promise((resolve) => (end = () => resolve('played' as const))));
    const { r } = await play(['word', 'particle']);
    await tap(r, tileId('e2e-cloze-word', 0));
    await advance(CLOZE_ADVANCE_MS + 2_500); // past the word cap too: a sentence gets the long one
    expect(texts(r)).not.toContain('Pick the piece that fits.');
    end();
    await advance(0);
    expect(texts(r)).toContain('Pick the piece that fits.');
  });

  it('released at the sentence cap, and the last round completes the step the same way', async () => {
    audio.playPrompt.mockImplementationOnce(() => new Promise(() => undefined));
    const { r, h } = await play(['word']);
    await tap(r, tileId('e2e-cloze-word', 0));
    await advance(SENTENCE_SOUND_MAX_MS - 1);
    expect(h.completes).toBe(0);
    await advance(1);
    expect(h.completes).toBe(1);
  });
});
