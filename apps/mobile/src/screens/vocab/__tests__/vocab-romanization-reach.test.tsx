import { LayoutProvider, layoutClassFor } from '@hangul-route/design-system';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RomanizationModeOverride } from '../../../i18n/use-romanization-mode';
import { topicItems, vocabTopic } from '../../../content/vocab';
import type { RoundSummary } from '../../../logic/vocab/stars';
import { byTestId, cleanup, hostNodes, press, render, textOf } from '../../../test-support/render';

/**
 * AMENDMENTS-ROMANIZATION-FADE section 3.8, row RF-1c, the Words screens: the Speed round's results list ("Words to see again")
 * shows each word's romanization in every mode (the round is over, (c)); a topic page folds its Korean title under `tap` and
 * has its **Show how to say it** button (a), which the tiles that open it rely on (d).
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

vi.mock('../../../platform/telemetry', async (importOriginal) => ({ ...(await importOriginal<object>()), track: vi.fn(async () => undefined) }));
vi.mock('../../../platform/app-state', () => ({ subscribeAppActive: () => () => undefined }));
vi.mock('../../../platform/screen-reader', async (orig) => ({ ...(await orig<object>()), isScreenReaderEnabled: async () => false, subscribeScreenReader: () => () => undefined }));

const { VocabResultsScreen } = await import('../VocabResultsScreen');
const { VocabTopicScreen } = await import('../VocabTopicScreen');

const nav = () =>
  ({ replace: () => undefined, navigate: () => undefined, goBack: () => undefined, canGoBack: () => true, addListener: () => () => undefined, setOptions: () => undefined }) as never;

afterEach(async () => {
  await cleanup();
});

/** The leaf texts drawn under `root` (not under an `aria-hidden` ancestor), as the learner reads them. */
function drawn(root: import('react-test-renderer').ReactTestInstance): string[] {
  const hidden = (n: import('react-test-renderer').ReactTestInstance): boolean => {
    for (let at: import('react-test-renderer').ReactTestInstance | null = n; at; at = at.parent) if (at.props['aria-hidden'] === true) return true;
    return false;
  };
  return hostNodes(root, (n) => n.children.length === 1 && typeof n.children[0] === 'string' && !hidden(n)).map(textOf);
}

describe('the Speed round results: Words to see again (VocabResultsScreen)', () => {
  const food = topicItems('food');
  const missed = food.slice(0, 2);
  const summary: RoundSummary = {
    mode: 'relaxed',
    endedBy: 'questions',
    clockMs: null,
    answered: 4,
    firstTryCorrect: 2,
    hinted: 0,
    caught: 2,
    caughtIds: food.slice(2, 4).map((i) => i.id),
    seeAgainIds: missed.map((i) => i.id),
    stars: 2,
  };
  const open = (mode: 'tap' | 'always') =>
    render(
      <LayoutProvider value={layoutClassFor({ width: 360, height: 740 })}>
        <RomanizationModeOverride mode={mode}>
          <VocabResultsScreen route={{ key: 'r', name: 'VocabResults', params: { topicKey: 'food', summary } } as never} navigation={nav()} />
        </RomanizationModeOverride>
      </LayoutProvider>,
    );

  it.each(['tap', 'always'] as const)('%s: every word to see again shows its romanization', async (mode) => {
    const r = await open(mode);
    expect(byTestId(r.root, 'vocab-results-see-again')).toHaveLength(1);
    for (const item of missed) {
      const tile = byTestId(r.root, `vocab-results-tile-${item.id}`)[0]!;
      expect(drawn(tile), item.id).toEqual(expect.arrayContaining([item.ko, item.romanization]));
    }
  });
});

describe('a topic page (VocabTopicScreen)', () => {
  const topicKey = 'food';
  const open = (mode: 'tap' | 'always') =>
    render(
      <LayoutProvider value={layoutClassFor({ width: 360, height: 740 })}>
        <RomanizationModeOverride mode={mode}>
          <VocabTopicScreen route={{ key: 't', name: 'VocabTopic', params: { topicKey } } as never} navigation={nav()} />
        </RomanizationModeOverride>
      </LayoutProvider>,
    );

  it('tap: the Korean title folds, Show how to say it shows it; the page is where a topic tile leads', async () => {
    const r = await open('tap');
    const title = (): string[] => drawn(byTestId(r.root, 'vocab-topic-ko')[0]!);
    expect(byTestId(r.root, 'vocab-topic-ko')).not.toHaveLength(0);
    const rom = vocabTopic(topicKey)!.titleKo.romanization;
    expect(title()).not.toContain(rom);
    const reveal = byTestId(r.root, 'vocab-topic-reveal').find((n) => typeof n.props.onClick === 'function');
    expect(reveal).toBeDefined();
    await press(reveal!);
    expect(byTestId(r.root, 'vocab-topic-reveal')).toHaveLength(0);
    expect(title()).toContain(rom);
  });

  it('always: no reveal button, the title shows its romanization', async () => {
    const r = await open('always');
    expect(byTestId(r.root, 'vocab-topic-reveal')).toHaveLength(0);
    expect(drawn(byTestId(r.root, 'vocab-topic-ko')[0]!)).toContain(vocabTopic(topicKey)!.titleKo.romanization);
  });
});
