import { getMessages } from '@hangul-route/i18n';
import type { ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MinigameScope } from '../../../logic/minigame-config';
import { byTestId, render, unmount } from '../../../test-support/render';
import { CultureQuizGame } from '../CultureQuizGame';

/**
 * AMENDMENTS-A11Y-CI AC-1 (axe `label-content-name-mismatch`, WCAG 2.5.3): the Hear button shows "Hear it", so its
 * accessible name has to start with those words, or a voice-control user cannot say what they see.
 */
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

vi.mock('../../../platform/audio', async (orig) => ({
  ...(await orig<object>()),
  playPrompt: () => Promise.resolve('played'),
  playJamo: () => Promise.resolve('played'),
  stop: () => undefined,
}));
vi.mock('../../../platform/telemetry', async (orig) => ({ ...(await orig<object>()), track: vi.fn(async () => undefined) }));

const m = getMessages('en');
const PAIRS = [
  { ko: '그네', en: 'swing', romanization: 'geune' },
  { ko: '모래', en: 'sand', romanization: 'morae' },
  { ko: '공', en: 'ball', romanization: 'gong' },
  { ko: '미끄럼틀', en: 'slide', romanization: 'mikkeureomteul' },
];
const scope = { kind: 'culture-quiz', rounds: 2, cardPairs: PAIRS } as unknown as MinigameScope;

let mounted: ReactTestRenderer | null = null;
afterEach(async () => {
  if (mounted) await unmount(mounted);
  mounted = null;
});

describe('Culture Quiz Hear button name', () => {
  it('starts with the visible "Hear it" and carries the word after it', async () => {
    mounted = await render(<CultureQuizGame scope={scope} onFinish={() => undefined} />);
    const [hear] = byTestId(mounted.root, 'culture-quiz-hear');
    const name = String(hear?.props['aria-label']);
    expect(name.startsWith(m.learner.audio.hearIt.cta)).toBe(true);
    expect(PAIRS.map((p) => m.a11y.hearItLabel(p.romanization))).toContain(name);
  });
});
