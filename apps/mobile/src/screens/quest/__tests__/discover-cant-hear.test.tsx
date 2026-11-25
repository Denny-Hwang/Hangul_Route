import type { DiscoverPage } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SCREEN_SETTLE_MS } from '../../../logic/audio/settle';
import { useAudioStore } from '../../../store/audio-store';
import { useLocaleStore } from '../../../store/locale-store';
import { KO_VOICE, createAudioRig, type AudioRig } from '../../../test-support/audio-rig';
import { clearReaderLog, focusNodes, hasId, pressableById } from '../../../test-support/cant-hear-rig';
import { byTestId, press, render, textOf, unmount } from '../../../test-support/render';
import { DiscoverStep } from '../DiscoverStep';

/**
 * "Can't hear it?" on Discover (AMENDMENTS-AUDIO-CANT-HEAR row CH-1d, OD-CH3 approved, test 20): a guidance-only link,
 * once per page, under the first card's buttons. Its sheet has the line for this device and **Hear it** (primary), and
 * no Show the letters: the page already prints every letter and word. Hidden while the card's status panel shows a
 * reason (sound off, no Korean voice, a failed or blocked play), because that panel already says what to do. Continue
 * is never gated on it.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const rig = vi.hoisted(() => ({ current: null as AudioRig | null }));
vi.mock('../../../platform/audio', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...(await import('../../../test-support/audio-rig')).rigAudio(() => rig.current!),
}));
vi.mock('../../../platform/telemetry', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  track: vi.fn(async () => undefined),
}));
vi.mock('../../../platform/motion', () => ({ useReducedMotion: () => false }));
vi.mock('../../../platform/device-family', () => ({ currentDeviceFamily: () => 'computer' }));
const reader = vi.hoisted(() => ({ log: [] as string[], announced: [] as string[] }));
vi.mock('../../../platform/screen-reader', async (importOriginal) => (await import('../../../test-support/cant-hear-rig')).screenReaderStandIn(reader, await importOriginal<object>()));
vi.mock('react-native', async (importOriginal) => (await import('../../../test-support/cant-hear-rig')).reactNativeWithModal(await importOriginal<object>()));

const T = getMessages('en').learner.audio;
const LETTERS: DiscoverPage = {
  items: [
    { type: 'jamo', jamoId: 'jamo:a', example: { ko: '나', romanization: 'na', en: 'I, me' } },
    { type: 'jamo', jamoId: 'jamo:eo', example: { ko: '너', romanization: 'neo', en: 'you' } },
  ],
};
const WORDS: DiscoverPage = {
  items: [
    { type: 'word', word: { ko: '나무', romanization: 'namu', en: 'tree' } },
    { type: 'word', word: { ko: '사과', romanization: 'sagwa', en: 'apple' } },
  ],
};
const ONE_WORD: DiscoverPage = { items: [{ type: 'word', word: { ko: '물', romanization: 'mul', en: 'water' } }] };
const EXCHANGE: DiscoverPage = {
  items: [
    {
      type: 'exchange',
      lines: [
        { speaker: 'a', speakerEn: 'Hoya', line: { ko: '안녕하세요!', romanization: 'annyeonghaseyo!', en: 'Hello!' } },
        { speaker: 'b', speakerEn: 'Mina', line: { ko: '안녕하세요!', romanization: 'annyeonghaseyo!', en: 'Hello!' } },
      ],
    },
  ],
};
const mounted: ReactTestRenderer[] = [];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  vi.setSystemTime(new Date('2026-11-24T09:00:00Z'));
  rig.current = createAudioRig({ voices: [KO_VOICE] });
  useAudioStore.setState({ muted: false, showLetters: false, voiceCheckPending: false });
  useLocaleStore.setState({ device: 'en' });
  clearReaderLog(reader);
});
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  vi.useRealTimers();
  useAudioStore.setState({ muted: false, showLetters: false, voiceCheckPending: false });
});

const tick = async (ms: number): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};
const spoken = (): string[] => rig.current!.synth.spoken.map((u) => u.text);
const count = (r: ReactTestRenderer, id: string): number => byTestId(r.root, id).filter((n) => typeof n.type === 'string').length;

async function open(pages: DiscoverPage[], extra: { compact?: boolean } = {}): Promise<ReactTestRenderer> {
  const r = await render(<DiscoverStep pages={pages} onDone={() => undefined} {...extra} />, { createNodeMock: focusNodes([]) as never });
  mounted.push(r);
  await tick(SCREEN_SETTLE_MS + 60);
  return r;
}
const sheet = (r: ReactTestRenderer): ReactTestInstance => byTestId(r.root, 'cant-hear-sheet')[0]!;

describe('Discover, "Can\'t hear it?" (test 20)', () => {
  it('shows the guidance-only link once per page, in the first card under its buttons, from the moment the page opens', async () => {
    const r = await open([LETTERS]);
    expect(count(r, 'cant-hear')).toBe(1);
    // Inside the first card, after the Hear it and Letter name buttons, before the next card.
    const order = r.root.findAll(
      (n) => typeof n.type === 'string' && ['discover-hear-jamo:a|sound', 'discover-hear-jamo:a|vowel', 'cant-hear', 'discover-item-jamo:eo'].includes(String(n.props['data-testid'])),
    );
    const ids = order.map((n) => n.props['data-testid']);
    expect(ids.indexOf('cant-hear')).toBeGreaterThan(ids.indexOf('discover-hear-jamo:a|sound'));
    expect(ids.indexOf('cant-hear')).toBeLessThan(ids.indexOf('discover-item-jamo:eo'));
    expect(byTestId(r.root, 'cant-hear')[0]!.props.style.opacity).not.toBe(0.6);
  });

  it('one link on a page of two words and on the compact card, one on a page of one word, and the next page has its own', async () => {
    const two = await open([WORDS]);
    expect(count(two, 'cant-hear')).toBe(1);
    const one = await open([ONE_WORD]);
    expect(count(one, 'cant-hear')).toBe(1);
    const compact = await open([LETTERS, WORDS], { compact: true });
    await press(pressableById(compact.root, 'discover-continue'));
    expect(hasId(compact.root, 'discover-compact')).toBe(true);
    expect(count(compact, 'cant-hear')).toBe(1);
  });

  it('is on the exchange page too, under Read along', async () => {
    const r = await open([EXCHANGE]);
    expect(count(r, 'cant-hear')).toBe(1);
    const order = r.root.findAll((n) => typeof n.type === 'string' && ['discover-read-along', 'cant-hear', 'discover-read-along-status'].includes(String(n.props['data-testid'])));
    expect(order.map((n) => n.props['data-testid'])).toEqual(['discover-read-along', 'cant-hear', 'discover-read-along-status']);
  });

  it('the sheet is guidance only: the line for this device and Hear it as the primary action, no Show the letters', async () => {
    const r = await open([LETTERS]);
    await press(pressableById(r.root, 'cant-hear'));
    expect(textOf(byTestId(r.root, 'cant-hear-line')[0]!)).toBe(T.cantHear.lines.computer);
    expect(textOf(sheet(r))).toContain(T.cantHear.cta);
    expect(hasId(r.root, 'cant-hear-show-letters')).toBe(false);
    expect(hasId(r.root, 'cant-hear-hear')).toBe(true);
    expect(hasId(r.root, 'cant-hear-sheet-close')).toBe(true);
  });

  it('Hear it plays the page\'s first sound once through the same play as the card\'s own Hear it, and records nothing', async () => {
    const r = await open([LETTERS]);
    expect(spoken()).toEqual([]);
    await press(pressableById(r.root, 'cant-hear'));
    await press(pressableById(r.root, 'cant-hear-hear'));
    await tick(1000);
    expect(spoken()).toEqual(['아']);
    expect(hasId(r.root, 'cant-hear-sheet')).toBe(false);
    // The card's own Hear it says the same thing.
    await press(pressableById(r.root, 'discover-hear-jamo:a|sound'));
    await tick(500);
    expect(spoken()).toEqual(['아', '아']);
  });

  it('is hidden while the card shows a reason: sound off, no Korean voice, a play that could not sound', async () => {
    useAudioStore.setState({ muted: true });
    const muted = await open([LETTERS]);
    expect(hasId(muted.root, 'cant-hear')).toBe(false);
    useAudioStore.setState({ muted: false });
    rig.current = createAudioRig({ voices: [] });
    useAudioStore.setState({ tts: { state: 'none', reason: 'no_korean_voice' } });
    const none = await open([LETTERS]);
    expect(hasId(none.root, 'cant-hear')).toBe(false);
  });

  it('a play that fails: the card shows its panel with Try again, and the link goes', async () => {
    rig.current = createAudioRig({ voices: [KO_VOICE] });
    rig.current.synth.speak = () => {
      throw new Error('no speech');
    };
    const r = await open([LETTERS]);
    expect(count(r, 'cant-hear')).toBe(1);
    await press(pressableById(r.root, 'discover-hear-jamo:a|sound'));
    await tick(500);
    expect(textOf(byTestId(r.root, 'discover-sound-jamo:a')[0]!)).toContain(T.didNotPlay);
    expect(hasId(r.root, 'cant-hear')).toBe(false);
  });

  it('Always show the letters (CH-2) changes nothing here: the page prints every letter, and the link stays', async () => {
    useAudioStore.setState({ showLetters: true });
    const r = await open([LETTERS]);
    expect(count(r, 'cant-hear')).toBe(1);
    expect(hasId(r.root, 'prompt-panel-text')).toBe(false);
  });

  it('Continue is never gated on the link: it is enabled at once, and with the sheet closed Previous and Continue work', async () => {
    const r = await open([LETTERS, WORDS]);
    const next = pressableById(r.root, 'discover-continue');
    expect(next.props['aria-disabled']).not.toBe(true);
    await press(next);
    expect(count(r, 'cant-hear')).toBe(1);
  });

  it('closing the sheet changes nothing and returns focus to the link; a new page closes an open sheet', async () => {
    const r = await open([LETTERS, WORDS]);
    await press(pressableById(r.root, 'cant-hear'));
    expect(hasId(r.root, 'cant-hear-sheet')).toBe(true);
    clearReaderLog(reader);
    await press(pressableById(r.root, 'cant-hear-sheet-close'));
    await tick(400);
    expect(hasId(r.root, 'cant-hear-sheet')).toBe(false);
    expect(reader.log).toEqual(['focus:cant-hear']);
    expect(spoken()).toEqual([]);
    await press(pressableById(r.root, 'cant-hear'));
    await press(pressableById(r.root, 'discover-continue'));
    expect(hasId(r.root, 'cant-hear-sheet')).toBe(false);
  });
});
