import { TapLockProvider } from '@hangul-route/design-system';
import { getMessages } from '@hangul-route/i18n';
import { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SCREEN_SETTLE_MS } from '../../../logic/audio/settle';
import type { PickRound, QuestReviewPlan } from '../../../logic/reviews/quest-review-session';
import { useAudioStore } from '../../../store/audio-store';
import { useProgressStore } from '../../../store/progress-store';
import { KO_VOICE, createAudioRig, type AudioRig } from '../../../test-support/audio-rig';
import { clearReaderLog, focusNodes, hasId, pressableById } from '../../../test-support/cant-hear-rig';
import { byTestId, press, render, textOf, unmount } from '../../../test-support/render';
import { QuestReviewSession } from '../quest-review-chunk';

/**
 * "Can't hear it?" on the quest warm-up and Try these again (AMENDMENTS-AUDIO-CANT-HEAR row CH-1b, section 3.1, test 18):
 * the heard rounds only. A heard round with a cue (a picture or a meaning) gets the guidance-only sheet; one without it
 * (a syllable round) shows the prompt's Korean with its romanization after Show the letters, and focus goes to the speaker.
 * A read round has no sound to miss.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const rig = vi.hoisted(() => ({ current: null as AudioRig | null }));
vi.mock('../../../platform/audio', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...(await import('../../../test-support/audio-rig')).rigAudio(() => rig.current!),
}));
vi.mock('../../../logic/memory/boot', async (importOriginal) => ({ ...(await importOriginal<object>()), recordAnswers: async () => undefined }));
vi.mock('../../../platform/telemetry', async (importOriginal) => ({ ...(await importOriginal<object>()), track: vi.fn(async () => undefined) }));
vi.mock('../../../platform/motion', () => ({ useReducedMotion: () => false }));
vi.mock('../../../platform/device-family', () => ({ currentDeviceFamily: () => 'computer' }));
const reader = vi.hoisted(() => ({ log: [] as string[], announced: [] as string[] }));
vi.mock('../../../platform/screen-reader', async (importOriginal) => (await import('../../../test-support/cant-hear-rig')).screenReaderStandIn(reader, await importOriginal<object>()));
vi.mock('react-native', async (importOriginal) => (await import('../../../test-support/cant-hear-rig')).reactNativeWithModal(await importOriginal<object>()));

const T = getMessages('en').learner.audio;

const heard = (extra: Partial<PickRound> = {}): PickRound => ({
  key: 'warmup:0:lex:bap:hear',
  itemId: 'syl:ba',
  rung: 'read',
  instruction: 'hearPick',
  mode: 'hear',
  ko: '바',
  romanization: 'ba',
  showRomanization: true,
  options: ['lex:ba', 'lex:pa', 'lex:ma'].map((id) => ({ id, ko: id.slice(4), romanization: id.slice(4) })),
  answerId: 'lex:ba',
  ...extra,
});
const planOf = (round: PickRound): QuestReviewPlan => ({
  kind: 'warmup',
  rounds: [round],
  soundNotice: false,
  ctx: { index: { items: [], byId: new Map(), retired: new Set() }, states: {}, today: '2026-11-24', voice: true },
});

const mounted: ReactTestRenderer[] = [];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'] });
  vi.setSystemTime(new Date('2026-11-24T09:00:00Z'));
  rig.current = createAudioRig({ voices: [KO_VOICE] });
  useAudioStore.setState({ muted: false, showLetters: false, voiceCheckPending: false });
  useProgressStore.setState({ byProfile: {} });
  clearReaderLog(reader);
});

afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  vi.useRealTimers();
});

const tick = async (ms: number): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

async function open(round: PickRound): Promise<ReactTestRenderer> {
  const r = await render(
    <TapLockProvider>
      <QuestReviewSession plan={planOf(round)} profileId="profile:mina" onDone={() => undefined} />
    </TapLockProvider>,
    { createNodeMock: focusNodes(['quest-review-speaker']) as never },
  );
  mounted.push(r);
  await tick(SCREEN_SETTLE_MS);
  return r;
}

describe('quest warm-up and Try these again, "Can\'t hear it?" (test 18)', () => {
  it('a heard syllable round shows the link after the speaker and Hear again, before the answers', async () => {
    const r = await open(heard());
    expect(hasId(r.root, 'cant-hear')).toBe(true);
    const order = r.root.findAll((n) => typeof n.type === 'string' && ['quest-review-speaker', 'quest-review-hear-again', 'cant-hear', 'quest-review-options'].includes(String(n.props['data-testid'])));
    expect(order.map((n) => n.props['data-testid'])).toEqual(['quest-review-speaker', 'quest-review-hear-again', 'cant-hear', 'quest-review-options']);
  });

  it('Show the letters: focus goes to the speaker, then the prompt Korean comes up with its romanization', async () => {
    const r = await open(heard());
    expect(byTestId(r.root, 'quest-review-prompt-text')).toHaveLength(0);
    await press(pressableById(r.root, 'cant-hear'));
    clearReaderLog(reader);
    await press(pressableById(r.root, 'cant-hear-show-letters'));
    await tick(0);
    expect(reader.log).toEqual(['focus:quest-review-speaker']);
    expect(byTestId(r.root, 'quest-review-prompt-text')).toHaveLength(0);
    await tick(320);
    const word = textOf(byTestId(r.root, 'quest-review-prompt-text')[0]!);
    expect(word).toContain('바');
    expect(word).toContain('ba');
    expect(hasId(r.root, 'cant-hear')).toBe(false);
  });

  it('Always show the letters (CH-2): a heard syllable round opens with the prompt Korean and no link; with a cue it prints nothing and keeps its link', async () => {
    useAudioStore.setState({ showLetters: true });
    const plain = await open(heard());
    const word = textOf(byTestId(plain.root, 'quest-review-prompt-text')[0]!);
    expect(word).toContain('바');
    expect(word).toContain('ba');
    expect(hasId(plain.root, 'cant-hear')).toBe(false);
    const cued = await open(heard({ cue: { gloss: 'Father' } }));
    expect(byTestId(cued.root, 'quest-review-prompt-text')).toHaveLength(0);
    expect(hasId(cued.root, 'cant-hear')).toBe(true);
  });

  it('a heard round with a cue gets the guidance-only sheet: the cue settles it', async () => {
    const r = await open(heard({ cue: { gloss: 'Father' } }));
    await press(pressableById(r.root, 'cant-hear'));
    expect(textOf(byTestId(r.root, 'cant-hear-line')[0]!)).toBe(T.cantHear.lines.computer);
    expect(hasId(r.root, 'cant-hear-show-letters')).toBe(false);
    expect(hasId(r.root, 'cant-hear-hear')).toBe(true);
  });

  it('a read round (nothing is played) has no link', async () => {
    const r = await open(heard({ mode: 'see', instruction: 'seeMeaning', options: [{ id: 'lex:ba', label: 'a' }, { id: 'lex:pa', label: 'b' }], answerId: 'lex:ba' }));
    expect(hasId(r.root, 'cant-hear')).toBe(false);
  });
});
