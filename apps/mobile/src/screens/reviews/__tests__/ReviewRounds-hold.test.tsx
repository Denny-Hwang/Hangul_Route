import { LayoutProvider, layoutClassFor } from '@hangul-route/design-system';
import TestRenderer, { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TAP_LOCK_MS } from '@hangul-route/design-system';
import { SCREEN_SETTLE_MS } from '../../../logic/audio/settle';
import type { HoldSurface } from '../../../logic/locale/check-hold';
import type { Rung } from '../../../logic/memory/spacing';
import type { ClozeRound, OrderRound, PickRound, ReviewRound, TypeRound } from '../../../logic/reviews/review-rounds';
import { useAudioStore } from '../../../store/audio-store';
import { byTestId, press, resetPlatform } from '../../../test-support/render';
import { RoundView } from '../ReviewRounds';

/**
 * The hold in the review rounds (AMENDMENTS-STAGE1-DECODING-CHECK sections 3.1 and 3.3, row DC-1b): a Check (the Stage Check and
 * the Cell Check, every rung) and the Daily Review's read and produce rungs draw no romanization of the question's taught
 * Korean while it is open; the line keeps its room, is off the accessibility tree, and the screen-reader names keep the
 * romanization. Answered, every line shows (`ReviewRounds` never reads the mode). `practice`, the default, never holds.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const audio = vi.hoisted(() => ({ playPrompt: vi.fn((_spec: { text: string }) => Promise.resolve('played' as const)), stop: vi.fn() }));
vi.mock('../../../platform/audio', async (importOriginal) => ({ ...(await importOriginal<object>()), ...audio }));

const RESERVED = 'korean-text-romanization-reserved';
const question = (rung: Rung, itemId = 'lex:namu') => ({ itemId, kind: 'lex', rung, format: 'read-pick', theme: 'life', stretch: false, voiceFallback: false }) as never;
const NAMU = { ko: '나무', romanization: 'namu' };
const NABI = { ko: '나비', romanization: 'nabi' };

const pick = (ask: PickRound['ask'], rung: Rung, over: Partial<PickRound> = {}): PickRound => ({
  type: 'pick',
  question: question(rung),
  heard: ask === 'spelling',
  ask,
  prompt: NAMU,
  answer: { ko: NAMU, gloss: 'tree' },
  options:
    ask === 'meaning'
      ? [
          { id: 'lex:namu', label: 'tree' },
          { id: 'lex:nabi', label: 'butterfly' },
        ]
      : [
          { id: 'lex:namu', ko: NAMU },
          { id: 'lex:nabi', ko: NABI },
        ],
  answerId: 'lex:namu',
  ...over,
});
const REPLY = pick('reply', 'read', { prompt: { ko: '이게 뭐예요?', romanization: 'ige mwoyeyo?' }, answer: { ko: { ko: '나무예요.', romanization: 'namuyeyo.' } }, options: [{ id: 'lex:namu', ko: { ko: '나무예요.', romanization: 'namuyeyo.' } }, { id: 'lex:nabi', ko: { ko: '나비예요.', romanization: 'nabiyeyo.' } }] });
const TYPE: TypeRound = { type: 'type', mode: 'see', target: '나무', question: question('produce'), answer: { ko: NAMU, gloss: 'tree' } };
const CLOZE: ClozeRound = {
  type: 'cloze',
  question: question('produce', 'pat:x'),
  gapped: { ko: '책이 ___.', romanization: 'chaegi ___' },
  meaning: 'There is a book.',
  tiles: [
    { id: 'pat:x', ko: { ko: '있어요', romanization: 'isseoyo' } },
    { id: 'pat:y', ko: { ko: '없어요', romanization: 'eopseoyo' } },
  ],
  answerId: 'pat:x',
  answer: { ko: { ko: '책이 있어요.', romanization: 'chaegi isseoyo' }, gloss: 'There is a book.' },
};
const ORDER: OrderRound = {
  type: 'order',
  question: question('produce', 'pat:z'),
  line: { ko: '이게 뭐예요?', romanization: 'ige mwoyeyo?' },
  meaning: 'It is a tree.',
  tiles: [
    { key: 't0', ko: '나무예요.' },
    { key: 't1', ko: '나무' },
  ],
  words: ['나무예요.'],
  answer: { ko: { ko: '나무예요.', romanization: 'namuyeyo.' } },
};

const mounted: ReactTestRenderer[] = [];
async function open(round: ReviewRound, holdSurface?: HoldSurface): Promise<ReactTestRenderer> {
  let r!: ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(
      <LayoutProvider value={layoutClassFor({ width: 320, height: 568 })}>
        <RoundView
          round={round}
          reducedMotion
          onFirst={() => undefined}
          onSolved={() => undefined}
          grade={(target, typed) => (typed === target ? 'right' : 'miss')}
          {...(holdSurface === undefined ? {} : { holdSurface })}
        />
      </LayoutProvider>,
      { createNodeMock: () => ({ focus: () => undefined, addEventListener: () => undefined, removeEventListener: () => undefined }) },
    );
  });
  mounted.push(r);
  // The heard round's board opens once the prompt has settled (the voice check).
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SCREEN_SETTLE_MS);
  });
  return r;
}

/** The words a sighted learner reads in a host node: text not under an `aria-hidden` ancestor (the held lines are invisible). */
function visible(node: ReactTestInstance): string {
  const out: string[] = [];
  const walk = (n: ReactTestInstance | string, hidden: boolean): void => {
    if (typeof n === 'string') {
      if (!hidden && n.trim() !== '') out.push(n);
      return;
    }
    const off = hidden || n.props['aria-hidden'] === true;
    for (const child of n.children) walk(child, off);
  };
  walk(node, false);
  return out.join(' ');
}
const reserved = (root: ReactTestInstance): number => byTestId(root, RESERVED).length;
const tap = async (root: ReactTestInstance, id: string): Promise<void> => {
  const node = byTestId(root, id).find((n) => typeof n.props.onClick === 'function');
  expect(node, id).toBeDefined();
  // The board locks for a moment after a tap (the bounce guard); a learner's next tap comes later.
  await act(async () => {
    await vi.advanceTimersByTimeAsync(TAP_LOCK_MS * 2);
  });
  await press(node!);
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  vi.setSystemTime(new Date('2026-11-25T09:00:00Z'));
  useAudioStore.setState({ muted: false, showLetters: false, voiceCheckPending: false });
});
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

describe('a heard pick round (spelling): the options hold their romanization', () => {
  it.each(['cell-check', 'stage-check'] as const)('%s: every option keeps its room, draws nothing and keeps its name; the answer shows the lines', async (surface) => {
    const r = await open(pick('spelling', 'recognize'), surface);
    const card = (id: string) => byTestId(r.root, `daily-review-option-${id}`)[0]!;
    expect(reserved(r.root)).toBe(2);
    expect(visible(card('lex:namu'))).not.toContain('namu');
    expect(card('lex:namu').props['aria-label']).toBe('나무, namu');
    expect(card('lex:nabi').props['aria-label']).toBe('나비, nabi');
    // A miss does not end the hold: the missed option waits too.
    await tap(r.root, 'daily-review-option-lex:nabi');
    expect(visible(card('lex:nabi'))).not.toContain('nabi');
    await tap(r.root, 'daily-review-option-lex:namu');
    expect(reserved(r.root)).toBe(0);
    expect(visible(card('lex:namu'))).toContain('namu');
    expect(visible(card('lex:nabi'))).toContain('nabi');
  });

  it('the Daily Review\'s recognize rung is practice: its options show their romanization from the start', async () => {
    const r = await open(pick('spelling', 'recognize'), 'daily-review');
    expect(reserved(r.root)).toBe(0);
    expect(visible(byTestId(r.root, 'daily-review-option-lex:namu')[0]!)).toContain('namu');
  });

  it('with no holdSurface (practice, the default) nothing is held', async () => {
    const r = await open(pick('spelling', 'recognize'));
    expect(reserved(r.root)).toBe(0);
  });
});

describe('a shown pick round: the prompt holds', () => {
  it.each([
    ['stage-check', 'read'],
    ['cell-check', 'read'],
    ['daily-review', 'read'],
    ['daily-review', 'produce'],
  ] as const)('meaning round, %s at the %s rung: the prompt\'s romanization is held until the answer; the name keeps it', async (surface, rung) => {
    const r = await open(pick('meaning', rung), surface);
    const prompt = byTestId(r.root, 'daily-review-prompt')[0]!;
    expect(reserved(prompt)).toBe(1);
    expect(visible(prompt)).toContain('나무');
    expect(visible(prompt)).not.toContain('namu');
    expect(prompt.props['aria-label']).toContain('namu');
    await tap(r.root, 'daily-review-option-lex:namu');
    expect(reserved(r.root)).toBe(0);
    expect(visible(byTestId(r.root, 'daily-review-prompt')[0]!)).toContain('namu');
  });

  it('a reply round holds the line and the reply options', async () => {
    const r = await open(REPLY, 'stage-check');
    expect(reserved(r.root)).toBe(3);
    expect(visible(r.root)).not.toContain('ige mwoyeyo');
    expect(visible(r.root)).not.toContain('namuyeyo');
    await tap(r.root, 'daily-review-option-lex:namu');
    expect(reserved(r.root)).toBe(0);
    expect(visible(r.root)).toContain('ige mwoyeyo');
    expect(visible(r.root)).toContain('namuyeyo');
  });

  it('a sound round is unchanged in a Check: its romanization is the stimulus, its options draw none, nothing is reserved', async () => {
    const r = await open(pick('sound', 'read', { heard: false }), 'stage-check');
    expect(reserved(r.root)).toBe(0);
    expect(visible(byTestId(r.root, 'daily-review-sound')[0]!)).toBe('namu');
    expect(visible(byTestId(r.root, 'daily-review-option-lex:namu')[0]!)).not.toContain('namu');
  });

  it('practice (the default) never holds a meaning round', async () => {
    const r = await open(pick('meaning', 'read'));
    expect(reserved(r.root)).toBe(0);
    expect(visible(byTestId(r.root, 'daily-review-prompt')[0]!)).toContain('namu');
  });
});

describe('type, cloze and order rounds', () => {
  it.each([
    ['stage-check', true],
    ['cell-check', true],
    ['daily-review', false],
  ] as const)('Type Hangul see, %s: the shown word holds its romanization; the keyboard\'s sound line is held in a Check, kept in the Daily Review (OD-DC12)', async (surface, keyboardHeld) => {
    const r = await open(TYPE, surface);
    const target = byTestId(r.root, 'daily-review-type-target')[0]!;
    expect(reserved(target)).toBe(1);
    expect(visible(target)).not.toContain('namu');
    const key = byTestId(r.root, 'hangul-key-ㄱ')[0]!;
    const hiddenLines = key.findAll((n) => n.props['aria-hidden'] === true && typeof n.type === 'string');
    expect(hiddenLines.length > 0).toBe(keyboardHeld);
    // The key keeps its name either way.
    expect(String(key.props['aria-label'])).toMatch(/ㄱ/);
  });

  it('Type Hangul see: typing the word right shows the romanization', async () => {
    const r = await open(TYPE, 'stage-check');
    for (const j of 'ㄴㅏㅁㅜ') await tap(r.root, `hangul-key-${j}`);
    await tap(r.root, 'daily-review-type-done');
    expect(reserved(r.root)).toBe(0);
    expect(visible(byTestId(r.root, 'daily-review-type-target')[0]!)).toContain('namu');
  });

  it('Type Hangul in practice draws the romanization and the keyboard\'s line', async () => {
    const r = await open(TYPE);
    expect(reserved(r.root)).toBe(0);
    expect(visible(byTestId(r.root, 'daily-review-type-target')[0]!)).toContain('namu');
    expect(byTestId(r.root, 'hangul-key-ㄱ')[0]!.findAll((n) => n.props['aria-hidden'] === true && typeof n.type === 'string')).toHaveLength(0);
  });

  it('Cloze Pick: the gapped sentence and every tile hold; the meaning stays; the answer shows them', async () => {
    const r = await open(CLOZE, 'cell-check');
    expect(reserved(r.root)).toBe(3);
    expect(visible(r.root)).not.toContain('chaegi');
    expect(visible(r.root)).not.toContain('isseoyo');
    expect(visible(r.root)).toContain('There is a book.');
    await tap(r.root, 'daily-review-option-pat:x');
    expect(reserved(r.root)).toBe(0);
    expect(visible(r.root)).toContain('isseoyo');
  });

  it('Sentence Builder: the exchange\'s line holds its romanization (the tiles draw Hangul only); the meaning stays', async () => {
    const r = await open(ORDER, 'stage-check');
    const line = byTestId(r.root, 'daily-review-line')[0]!;
    expect(reserved(line)).toBe(1);
    expect(visible(line)).not.toContain('ige');
    expect(visible(r.root)).toContain('It is a tree.');
    await tap(r.root, 'daily-review-tile-t0');
    expect(reserved(r.root)).toBe(0);
    expect(visible(byTestId(r.root, 'daily-review-line')[0]!)).toContain('ige mwoyeyo?');
  });

  it('practice (the default) holds none of the three', async () => {
    for (const round of [TYPE, CLOZE, ORDER]) {
      const r = await open(round);
      expect(reserved(r.root)).toBe(0);
    }
  });
});
