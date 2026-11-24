import type { ListenPickRound } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SCREEN_SETTLE_MS } from '../../../logic/audio/settle';
import { useAudioStore } from '../../../store/audio-store';
import { KO_VOICE, createAudioRig, type AudioRig } from '../../../test-support/audio-rig';
import { clearReaderLog, focusNodes, hasId, newReaderLog, pressableById } from '../../../test-support/cant-hear-rig';
import { byTestId, press, render, textOf, unmount } from '../../../test-support/render';
import type { HostMode, MinigameHost } from '../host';
import { ListenPickGame } from '../ListenPickGame';

/**
 * "Can't hear it?" on Listen & Pick (AMENDMENTS-AUDIO-CANT-HEAR row CH-1b, section 3.1, test 18): the link is on the
 * practice hosts (`quest`, `vocab`, `preview`) and not in a Check (`check`, `review`: CH-1e) or a text prompt round;
 * Show the letters brings the prompt word with its romanization and focus goes to the speaker; a spelling round (its
 * picture and meaning settle it) gets the guidance-only sheet.
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

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  vi.setSystemTime(new Date('2026-11-24T09:00:00Z'));
  rig.current = createAudioRig({ voices: [KO_VOICE] });
  useAudioStore.setState({ muted: false, voiceCheckPending: false });
  clearReaderLog(reader);
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

async function game(mode: HostMode, extra: { rounds?: ListenPickRound[]; textPrompt?: boolean; spelling?: boolean } = {}): Promise<ReactTestRenderer> {
  const host: MinigameHost = { mode, answer: () => undefined, complete: () => undefined };
  const rounds = extra.rounds ?? ROUNDS;
  const kit = extra.spelling === true ? await import('../dictation-chunk') : null;
  const textPrompt = extra.textPrompt === true ? { heading: 'Read it', missLine: 'Look again', prompt: () => null } : undefined;
  const r = await render(<ListenPickGame scope={{ kind: 'listen-pick', rounds: rounds.length, listenPick: { rounds } }} host={host} spelling={kit} {...(textPrompt ? { textPrompt } : {})} />, {
    createNodeMock: focusNodes(['listen-pick-speaker']) as never,
  });
  mounted.push(r);
  await tick(SCREEN_SETTLE_MS);
  return r;
}

describe('Listen & Pick, "Can\'t hear it?" (test 18)', () => {
  it.each<HostMode>(['quest', 'vocab', 'preview'])('the %s host shows the link, after the speaker and before the answers', async (mode) => {
    const r = await game(mode);
    expect(hasId(r.root, 'cant-hear')).toBe(true);
    const order = r.root.findAll((n) => typeof n.type === 'string' && ['listen-pick-speaker', 'cant-hear', 'listen-pick-options'].includes(String(n.props['data-testid'])));
    expect(order.map((n) => n.props['data-testid'])).toEqual(['listen-pick-speaker', 'cant-hear', 'listen-pick-options']);
  });

  it.each<HostMode>(['check', 'review'])('the %s host has no link until CH-1e', async (mode) => {
    const r = await game(mode);
    expect(hasId(r.root, 'cant-hear')).toBe(false);
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
