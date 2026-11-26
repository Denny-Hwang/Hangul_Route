import { LayoutProvider, layoutClassFor } from '@hangul-route/design-system';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MinigameScope } from '../../../logic/minigame-config';
import { resetPlatform, screenTexts } from '../../../test-support/render';
import { VoiceEchoGame } from '../VoiceEchoGame';

/**
 * F-CNT-002 and AMENDMENTS-ROMANIZER-GAPS RG-2a: the word under the speaker carries its own
 * romanization, else the reviewed one (a word with an entry in ROMANIZATION_EXCEPTIONS says what the
 * entry says), and nothing when the word cannot be read.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

vi.mock('../../../platform/audio', () => ({ playPrompt: vi.fn() }));

const mounted: ReactTestRenderer[] = [];

async function show(cardPairs: MinigameScope['cardPairs']): Promise<string[]> {
  const scope = { kind: 'voice-echo', rounds: 1, cardPairs } as MinigameScope;
  let r!: ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(
      <LayoutProvider value={layoutClassFor({ width: 375, height: 667 })}>
        <VoiceEchoGame scope={scope} onFinish={() => undefined} />
      </LayoutProvider>,
      { createNodeMock: () => ({ focus: () => undefined, addEventListener: () => undefined, removeEventListener: () => undefined, nodeType: 1, getBoundingClientRect: () => ({ width: 0, height: 0, top: 0, left: 0 }) }) },
    );
  });
  mounted.push(r);
  return screenTexts(r.root);
}

afterEach(async () => {
  for (const r of mounted.splice(0)) {
    await act(async () => {
      r.unmount();
    });
  }
  resetPlatform();
});

describe('VoiceEchoGame: the romanization under the word', () => {
  it('is the reviewed romanization of a word with an entry (솔잎 is sollip, not the converter\'s sorip)', async () => {
    const texts = await show([{ ko: '솔잎', en: 'pine needle' }]);
    expect(texts).toContain('sollip');
    expect(texts).toContain('Hear sollip');
    expect(texts).not.toContain('sorip');
  });

  it('is the pair\'s own romanization when it has one, and the converter\'s for any other word', async () => {
    expect(await show([{ ko: '솔잎', en: 'pine needle', romanization: 'own' }])).toContain('own');
    expect(await show([{ ko: '사과', en: 'apple' }])).toContain('sagwa');
  });

  it('shows none for a word the converter cannot read', async () => {
    // No romanization: the speaker's label falls back to the word itself.
    const texts = await show([{ ko: 'A1', en: 'odd' }]);
    expect(texts).toContain('Hear A1');
  });
});
