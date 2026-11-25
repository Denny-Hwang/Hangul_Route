import { LayoutProvider, layoutClassFor } from '@hangul-route/design-system';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { topicItems } from '../../../content/vocab';
import { resolvePicture } from '../../../logic/picture-ref';
import { buildQuestions } from '../../../logic/vocab/question-builder';
import { clockFor } from '../../../logic/vocab/session-clock';
import { roundPlan } from '../../../logic/vocab/speed-round';
import type { SpeedMode } from '../../../logic/vocab/session-clock';
import { byTestId, cleanup, render, resetPlatform } from '../../../test-support/render';
import { PICTURE_CONTEXT } from '../../minigames/PictureArt';

/**
 * Where the Speed round gives its question `cantHear` (AMENDMENTS-AUDIO-CANT-HEAR row CH-1b, review of #1099): Relaxed
 * yes (no clock), Challenge no (a clocked drill, OD-CH4). `VocabQuestionView` is a stub that shows the prop it got, so
 * deleting or flipping `cantHear={config.mode === 'relaxed'}` turns a test red (`vocab-question-cant-hear.test.tsx`
 * covers what the prop does).
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

vi.mock('../VocabQuestionView', async () => {
  const { createElement } = await import('react');
  return {
    VocabQuestionView: ({ cantHear }: { cantHear?: boolean }) => createElement('div', { 'data-testid': 'question-stub', 'data-cant-hear': cantHear === true }, 'question'),
  };
});
vi.mock('../../../platform/telemetry', async (importOriginal) => ({ ...(await importOriginal<object>()), track: vi.fn(async () => undefined) }));
vi.mock('../../../platform/app-state', () => ({ subscribeAppActive: () => () => undefined }));
vi.mock('../../../platform/screen-reader', async (orig) => ({ ...(await orig<object>()), isScreenReaderEnabled: async () => false, subscribeScreenReader: () => () => undefined }));

const { RoundPlay } = await import('../VocabSpeedRoundScreen');

const items = topicItems('food');
const questions = buildQuestions({
  pool: items,
  universe: items,
  count: items.length,
  optionCount: 4,
  levelOrder: 1,
  boxOf: () => 2,
  seed: 7,
  canRender: (ref) => resolvePicture(ref, PICTURE_CONTEXT).kind !== 'text',
  canPlay: true,
});

const nav = () => ({ replace: () => undefined, navigate: () => undefined, goBack: () => undefined, canGoBack: () => true, addListener: () => () => undefined }) as never;

async function play(mode: SpeedMode) {
  const config = { mode, questions, clockMs: clockFor(mode, 1), hintsEnabled: false };
  return render(
    <LayoutProvider value={layoutClassFor({ width: 360, height: 740 })}>
      <RoundPlay topicKey="food" playing={{ config, plan: roundPlan(1, mode), earlierBest: 0, canPlay: true }} navigation={nav()} onLeave={() => undefined} />
    </LayoutProvider>,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
});
afterEach(async () => {
  await cleanup();
  vi.useRealTimers();
  resetPlatform();
});

describe('the Speed round gives its question cantHear by mode', () => {
  it('Relaxed (no clock) does', async () => {
    const r = await play('relaxed');
    expect(byTestId(r.root, 'question-stub')).toHaveLength(1);
    expect(byTestId(r.root, 'question-stub')[0]!.props['data-cant-hear']).toBe(true);
  });

  it('Challenge (a clocked drill) does not', async () => {
    const r = await play('challenge');
    expect(byTestId(r.root, 'question-stub')).toHaveLength(1);
    expect(byTestId(r.root, 'question-stub')[0]!.props['data-cant-hear']).toBe(false);
  });
});
