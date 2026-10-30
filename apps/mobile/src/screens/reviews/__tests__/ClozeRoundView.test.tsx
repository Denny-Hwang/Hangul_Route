import { LayoutProvider, layoutClassFor } from '@hangul-route/design-system';
import TestRenderer, { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ClozeRound } from '../../../logic/reviews/review-rounds';
import { byTestId, press, resetPlatform, screenTexts } from '../../../test-support/render';
import { RoundView } from '../ReviewRounds';

/**
 * F-CURR-002 row CM-30: a Cloze Pick round inside a review (Daily Review, Keep going, the Checks). The sentence with
 * its gap, its meaning and word tiles in Korean and romanization; nothing is said before the answer; a miss nudges in
 * amber and rings the tile that fits; the right tile completes the sentence, which is said once. First answer scores.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const audio = vi.hoisted(() => ({ playPrompt: vi.fn((_spec: { text: string }) => Promise.resolve('played' as const)), stop: vi.fn() }));
vi.mock('../../../platform/audio', async (importOriginal) => ({ ...(await importOriginal<object>()), ...audio }));

const ROUND: ClozeRound = {
  type: 'cloze',
  question: { itemId: 'pat:chaegi-isseoyo', kind: 'pat', rung: 'produce', format: 'cloze-pick', theme: 'letters', stretch: false, voiceFallback: false },
  gapped: { ko: '책이 ___.', romanization: 'chaegi ___' },
  meaning: 'There is a book.',
  tiles: [
    { id: 'pat:chaegi-isseoyo#1:0', ko: { ko: '없어요', romanization: 'eopseoyo' } },
    { id: 'pat:chaegi-isseoyo#1', ko: { ko: '있어요', romanization: 'isseoyo' } },
    { id: 'pat:chaegi-isseoyo#1:1', ko: { ko: '마셔요', romanization: 'masyeoyo' } },
  ],
  answerId: 'pat:chaegi-isseoyo#1',
  answer: { ko: { ko: '책이 있어요.', romanization: 'chaegi isseoyo' }, gloss: 'There is a book.' },
};

const mounted: ReactTestRenderer[] = [];
async function mount(onFirst: (a: unknown) => void, onSolved: () => void): Promise<ReactTestRenderer> {
  let r!: ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(
      <LayoutProvider value={layoutClassFor({ width: 320, height: 568 })}>
        <RoundView round={ROUND} reducedMotion onFirst={onFirst} onSolved={onSolved} grade={() => 'miss'} />
      </LayoutProvider>,
    );
  });
  mounted.push(r);
  return r;
}
const tap = async (root: ReactTestInstance, id: string): Promise<void> => {
  const node = byTestId(root, id).find((n) => typeof n.props.onClick === 'function');
  expect(node, id).toBeDefined();
  await press(node!);
};

afterEach(async () => {
  for (const r of mounted.splice(0)) {
    await act(async () => {
      r.unmount();
    });
  }
  vi.useRealTimers();
  vi.clearAllMocks();
  resetPlatform();
});

describe('Daily Review: the Cloze Pick round', () => {
  it('asks with the gap and the meaning, says nothing before the answer, then completes the sentence once', async () => {
    vi.useFakeTimers();
    const onFirst = vi.fn();
    const onSolved = vi.fn();
    const r = await mount(onFirst, onSolved);
    const texts = (): string[] => screenTexts(r.root);
    expect(texts()).toContain('Fill the gap');
    expect(texts()).toContain('Sentence: chaegi blank. There is a book.');
    expect(texts()).toContain('There is a book.');
    expect(audio.playPrompt).not.toHaveBeenCalled();
    await tap(r.root, 'daily-review-option-pat:chaegi-isseoyo#1:0');
    expect(onFirst).toHaveBeenCalledWith({ correct: false });
    expect(texts()).toContain('Read the sentence again. Which one fits?');
    expect(texts().some((t) => t.includes('있어요'))).toBe(true);
    expect(audio.playPrompt).not.toHaveBeenCalled();
    await tap(r.root, 'daily-review-option-pat:chaegi-isseoyo#1');
    expect(onFirst).toHaveBeenCalledTimes(1);
    expect(texts()).toContain('Sentence complete: chaegi isseoyo. There is a book.');
    expect(audio.playPrompt).toHaveBeenCalledTimes(1);
    expect(audio.playPrompt.mock.calls[0]?.[0]).toMatchObject({ text: '책이 있어요.' });
    await act(async () => {
      vi.runAllTimers();
    });
    expect(onSolved).toHaveBeenCalledTimes(1);
  });
});
