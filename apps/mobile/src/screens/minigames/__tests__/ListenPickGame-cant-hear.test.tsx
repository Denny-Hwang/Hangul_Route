import type { ListenPickRound } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SCREEN_SETTLE_MS } from '../../../logic/audio/settle';
import { useAudioStore } from '../../../store/audio-store';
import { KO_VOICE, createAudioRig, type AudioRig } from '../../../test-support/audio-rig';
import { clearReaderLog, focusNodes, hasId, newReaderLog, pressableById } from '../../../test-support/cant-hear-rig';
import { RomanizationModeOverride } from '../../../i18n/use-romanization-mode';
import { byTestId, press, render, textOf, unmount } from '../../../test-support/render';
import type { HostMode, MinigameHost } from '../host';
import { ListenPickGame } from '../ListenPickGame';

/**
 * "Can't hear it?" on Listen & Pick (AMENDMENTS-AUDIO-CANT-HEAR rows CH-1b and CH-1e, sections 3.1 and 3.12, tests 18 and
 * 21): the link is on every host, the Checks (`check`, `review`) included, and not on a text prompt round; in a practice
 * host Show the letters brings the prompt word with its romanization and focus goes to the speaker; in a Check whose
 * options hold or hide their romanization the asked text is the romanization only (no Hangul); a spelling round (its
 * picture and meaning settle it) gets the guidance-only sheet.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const rig = vi.hoisted(() => ({ current: null as AudioRig | null }));
vi.mock('../../../platform/audio', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...(await import('../../../test-support/audio-rig')).rigAudio(() => rig.current!),
}));
const events = vi.hoisted(() => [] as Array<{ name: string; payload?: unknown }>);
vi.mock('../../../platform/telemetry', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  track: vi.fn(async (event: { name: string; payload?: unknown }) => {
    events.push(event);
  }),
}));
vi.mock('../../../platform/motion', () => ({ useReducedMotion: () => false }));
vi.mock('../../../platform/device-family', () => ({ currentDeviceFamily: () => 'computer' }));
const reader = vi.hoisted(() => ({ log: [] as string[], announced: [] as string[] }));
vi.mock('../../../platform/screen-reader', async (importOriginal) => (await import('../../../test-support/cant-hear-rig')).screenReaderStandIn(reader, await importOriginal<object>()));
vi.mock('react-native', async (importOriginal) => (await import('../../../test-support/cant-hear-rig')).reactNativeWithModal(await importOriginal<object>()));

const T = getMessages('en').learner.audio;
const text = (ko: string, romanization: string, en: string) => ({ ko, romanization, en });
const OPTIONS = [
  { id: 'neo', text: text('너', 'neo', 'you') },
  { id: 'na', text: text('나', 'na', 'I') },
  { id: 'no', text: text('노', 'no', 'oar') },
  { id: 'nu', text: text('누', 'nu', 'who') },
];
const ROUNDS: ListenPickRound[] = [
  { id: 'lp:syl:neo', prompt: text('너', 'neo', 'you'), options: OPTIONS, answerId: 'neo' },
  { id: 'lp:syl:na', prompt: text('나', 'na', 'I'), options: OPTIONS, answerId: 'na' },
];
const BOOK = text('책이', 'chaegi', 'book');
const SPELLING: ListenPickRound = {
  id: 'sp',
  promptKind: 'spelling',
  prompt: BOOK,
  options: [{ id: 'a', text: BOOK }, { id: 'b', text: text('채기', 'chaegi', 'book') }],
  answerId: 'a',
  fallbackOptions: [{ id: 'c', text: text('학교', 'hakgyo', 'school') }, { id: 'd', text: text('우유', 'uyu', 'milk') }],
};

const mounted: ReactTestRenderer[] = [];
/** What the host was told: [round, correct]. */
const answers: Array<[string | number, boolean]> = [];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  vi.setSystemTime(new Date('2026-11-24T09:00:00Z'));
  rig.current = createAudioRig({ voices: [KO_VOICE] });
  useAudioStore.setState({ muted: false, showLetters: false, voiceCheckPending: false });
  clearReaderLog(reader);
  events.length = 0;
  answers.length = 0;
});

afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  vi.useRealTimers();
  useAudioStore.setState({ muted: false, voiceCheckPending: false });
});

const tick = async (ms: number): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

async function game(
  mode: HostMode,
  extra: { rounds?: ListenPickRound[]; textPrompt?: boolean; spelling?: boolean; romanization?: 'always' | 'tap' } = {},
): Promise<ReactTestRenderer> {
  const host: MinigameHost = { mode, answer: (round, correct) => void answers.push([round, correct]), complete: () => undefined };
  const rounds = extra.rounds ?? ROUNDS;
  const kit = extra.spelling === true ? await import('../dictation-chunk') : null;
  const textPrompt = extra.textPrompt === true ? { heading: 'Read it', missLine: 'Look again', prompt: () => null } : undefined;
  const element = <ListenPickGame scope={{ kind: 'listen-pick', rounds: rounds.length, listenPick: { rounds } }} host={host} spelling={kit} {...(textPrompt ? { textPrompt } : {})} />;
  const r = await render(extra.romanization === undefined ? element : <RomanizationModeOverride mode={extra.romanization}>{element}</RomanizationModeOverride>, {
    createNodeMock: focusNodes(['listen-pick-speaker']) as never,
  });
  mounted.push(r);
  await tick(SCREEN_SETTLE_MS);
  return r;
}

describe('Listen & Pick, "Can\'t hear it?" (test 18)', () => {
  it.each<HostMode>(['quest', 'vocab', 'preview', 'check', 'review'])('the %s host shows the link, after the speaker and before the answers', async (mode) => {
    const r = await game(mode);
    expect(hasId(r.root, 'cant-hear')).toBe(true);
    const order = r.root.findAll((n) => typeof n.type === 'string' && ['listen-pick-speaker', 'cant-hear', 'listen-pick-options'].includes(String(n.props['data-testid'])));
    expect(order.map((n) => n.props['data-testid'])).toEqual(['listen-pick-speaker', 'cant-hear', 'listen-pick-options']);
  });

  it('a text prompt round (no speaker) has no link', async () => {
    const r = await game('quest', { textPrompt: true });
    expect(hasId(r.root, 'cant-hear')).toBe(false);
  });

  it('Show the letters: focus goes to the speaker, then the prompt word comes up with its romanization', async () => {
    const r = await game('quest');
    expect(byTestId(r.root, 'listen-pick-prompt-text')).toHaveLength(0);
    await press(pressableById(r.root, 'cant-hear'));
    clearReaderLog(reader);
    await press(pressableById(r.root, 'cant-hear-show-letters'));
    await tick(0);
    expect(reader.log).toEqual(['focus:listen-pick-speaker']);
    expect(byTestId(r.root, 'listen-pick-prompt-text')).toHaveLength(0);
    await tick(320);
    const word = textOf(byTestId(r.root, 'listen-pick-prompt-text')[0]!);
    expect(word).toContain('너');
    expect(word).toContain('neo');
    expect(textOf(byTestId(r.root, 'listen-pick-prompt')[0]!)).toContain(T.readHere);
    expect(hasId(r.root, 'cant-hear')).toBe(false);
  });

  it('Always show the letters (CH-2): the practice round opens with the prompt word and no link; the spelling round keeps its link and prints nothing', async () => {
    useAudioStore.setState({ showLetters: true });
    const r = await game('quest');
    const word = textOf(byTestId(r.root, 'listen-pick-prompt-text')[0]!);
    expect(word).toContain('너');
    expect(word).toContain('neo');
    expect(hasId(r.root, 'cant-hear')).toBe(false);
    const spelling = await game('quest', { rounds: [SPELLING], spelling: true });
    expect(byTestId(spelling.root, 'listen-pick-prompt-text')).toHaveLength(0);
    expect(hasId(spelling.root, 'cant-hear')).toBe(true);
  });

  it('Always show the letters (CH-2) in a Check opens with the romanization only, as an ask would, and is not counted', async () => {
    useAudioStore.setState({ showLetters: true });
    const r = await game('check');
    const word = textOf(byTestId(r.root, 'listen-pick-prompt-text')[0]!);
    expect(word).toBe('neo');
    expect(hasId(r.root, 'cant-hear')).toBe(false);
    expect(events.filter((e) => e.name === 'audio.fallback_shown')).toEqual([]);
  });

  it('the spelling round gets the guidance-only sheet: the line and Hear it, no Show the letters', async () => {
    const r = await game('quest', { rounds: [SPELLING], spelling: true });
    expect(hasId(r.root, 'cant-hear')).toBe(true);
    await press(pressableById(r.root, 'cant-hear'));
    expect(hasId(r.root, 'cant-hear-sheet')).toBe(true);
    expect(textOf(byTestId(r.root, 'cant-hear-line')[0]!)).toBe(T.cantHear.lines.computer);
    expect(hasId(r.root, 'cant-hear-show-letters')).toBe(false);
    expect(hasId(r.root, 'cant-hear-hear')).toBe(true);
    // The prompt's Korean is the answer: nothing prints it.
    expect(byTestId(r.root, 'listen-pick-prompt-text')).toHaveLength(0);
  });
});

describe('Listen & Pick in a Check (CH-1e, section 3.12, test 21)', () => {
  const showLetters = async (r: ReactTestRenderer): Promise<void> => {
    await press(pressableById(r.root, 'cant-hear'));
    clearReaderLog(reader);
    await press(pressableById(r.root, 'cant-hear-show-letters'));
    await tick(400);
  };
  const promptText = (r: ReactTestRenderer): string => textOf(byTestId(r.root, 'listen-pick-prompt-text')[0]!);
  const HANGUL = /[ㄱ-ㆎ가-힣]/;

  it('the quest Check holds its options romanization, so the asked text is the romanization only: no Hangul is printed', async () => {
    const r = await game('check');
    await showLetters(r);
    expect(promptText(r)).toBe('neo');
    expect(promptText(r)).not.toMatch(HANGUL);
    expect(textOf(byTestId(r.root, 'listen-pick-prompt')[0]!)).toContain(T.readHere);
    expect(hasId(r.root, 'cant-hear')).toBe(false);
    // Focus went to the speaker, and a screen reader on iOS is told the romanization once (never the Hangul).
    expect(reader.log).toEqual(['focus:listen-pick-speaker', 'announce']);
    expect(reader.announced).toEqual(['neo']);
  });

  it('the Hangul Check with its hide switch on (the override is tap) asks for the romanization only too', async () => {
    const r = await game('review', { romanization: 'tap' });
    await showLetters(r);
    expect(promptText(r)).toBe('neo');
    expect(reader.announced).toEqual(['neo']);
  });

  it('the Hangul Check with the switch off shows its options romanization, so the asked text is the surface\'s own: the Korean with its romanization', async () => {
    const r = await game('review', { romanization: 'always' });
    await showLetters(r);
    expect(promptText(r)).toContain('너');
    expect(promptText(r)).toContain('neo');
    expect(reader.announced).toEqual([getMessages('en').a11y.koreanItem({ ko: '너', romanization: 'neo' })]);
  });

  it('a practice host is unchanged even when the learner hides the romanization', async () => {
    const r = await game('quest', { romanization: 'tap' });
    await showLetters(r);
    expect(promptText(r)).toContain('너');
  });

  it('Sound off in a Check is not an ask: it keeps the surface\'s own text (AD13), and shows no link', async () => {
    useAudioStore.setState({ muted: true });
    const r = await game('check');
    expect(promptText(r)).toContain('너');
    expect(hasId(r.root, 'cant-hear')).toBe(false);
  });

  it('Always show the letters in the Hangul Check follows the same rule: tap hides, always shows', async () => {
    useAudioStore.setState({ showLetters: true });
    const hidden = await game('review', { romanization: 'tap' });
    expect(promptText(hidden)).toBe('neo');
    const shown = await game('review', { romanization: 'always' });
    expect(promptText(shown)).toContain('너');
  });

  it('a right first answer after Show the letters counts as it does today and is identifiable as asked (CH-1f): one audio.fallback_shown asked, then the answer', async () => {
    const r = await game('check');
    await showLetters(r);
    expect(events.filter((e) => e.name === 'audio.fallback_shown').map((e) => e.payload)).toEqual([{ source: 'listen-pick', reason: 'asked' }]);
    await press(pressableById(r.root, 'listen-pick-option-neo'));
    expect(answers).toEqual([[0, true]]);
    // The answer is known now, so the Korean shows with the meaning, as in any quest Check.
    expect(promptText(r)).toContain('너');
    // The ask is counted once per session and source.
    expect(events.filter((e) => e.name === 'audio.fallback_shown')).toHaveLength(1);
  });

  it('a wrong first answer after Show the letters is a plain miss; the text stays the romanization', async () => {
    const r = await game('check');
    await showLetters(r);
    await press(pressableById(r.root, 'listen-pick-option-na'));
    expect(answers).toEqual([[0, false]]);
    expect(promptText(r)).toBe('neo');
  });

  it('the next round opens sound-only again, with the link', async () => {
    const r = await game('check');
    await showLetters(r);
    await press(pressableById(r.root, 'listen-pick-option-neo'));
    await tick(2500);
    expect(byTestId(r.root, 'listen-pick-prompt-text')).toHaveLength(0);
    expect(hasId(r.root, 'cant-hear')).toBe(true);
  });
});
