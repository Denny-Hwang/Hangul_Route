import type { ListenPickRound } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import type { ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAudioStore } from '../../../store/audio-store';
import { KO_VOICE, createAudioRig, type AudioRig } from '../../../test-support/audio-rig';
import { byTestId, render, textOf, unmount } from '../../../test-support/render';
import type { MinigameHost } from '../host';
import { ListenPickGame } from '../ListenPickGame';

/**
 * AMENDMENTS-DISCOVER-SOUND-FIRST SF-1: a round framed `startsWith` (a quest Check's consonant round, which plays the
 * sound 차) asks "Which letter starts this sound?" in its heading and in the round's accessible label; every other
 * round keeps "Listen, then pick".
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

const en = getMessages('en');
const text = (ko: string, romanization: string, gloss: string) => ({ ko, romanization, en: gloss });
const SOUND_ROUND: ListenPickRound = {
  id: 'lp:sym:jamo:chieut',
  frame: 'startsWith',
  prompt: { ...text('차', 'cha', 'the sound of the letter chieut'), audioRef: 'audio/jamo/chieut.mp3' },
  options: [
    { id: 'jamo:chieut', text: text('ㅊ', 'ch', 'the letter chieut') },
    { id: 'jamo:nieun', text: text('ㄴ', 'n', 'the letter nieun') },
    { id: 'jamo:giyeok', text: text('ㄱ', 'g/k', 'the letter giyeok') },
    { id: 'jamo:digeut', text: text('ㄷ', 'd/t', 'the letter digeut') },
  ],
  answerId: 'jamo:chieut',
};
const LETTER_ROUND: ListenPickRound = {
  id: 'lp:sym:jamo:eo',
  prompt: text('어', 'eo', 'the letter eo'),
  options: [
    { id: 'jamo:eo', text: text('ㅓ', 'eo', 'the letter eo') },
    { id: 'jamo:a', text: text('ㅏ', 'a', 'the letter a') },
  ],
  answerId: 'jamo:eo',
};

const mounted: ReactTestRenderer[] = [];
beforeEach(() => {
  rig.current = createAudioRig({ voices: [KO_VOICE] });
  useAudioStore.setState({ muted: false });
});
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
});

async function game(round: ListenPickRound): Promise<ReactTestInstance> {
  const host: MinigameHost = { mode: 'check', answer: () => undefined, complete: () => undefined };
  const r = await render(<ListenPickGame scope={{ kind: 'listen-pick', rounds: 1, listenPick: { rounds: [round] } }} host={host} />);
  mounted.push(r);
  return r.root;
}

describe("a 'startsWith' round asks which letter starts the sound", () => {
  it('the heading and the round label say "Which letter starts this sound?"', async () => {
    const root = await game(SOUND_ROUND);
    const header = byTestId(root, 'listen-pick-round').find((n) => n.props.role === 'heading' || n.props['aria-label'] !== undefined)!;
    expect(textOf(header)).toContain(en.learner.audio.heading.startsWith);
    expect(textOf(header)).not.toContain(en.learner.minigame.listenPick.heading);
    expect(String(header.props['aria-label'])).toBe(en.a11y.answer.round(1, 1, en.learner.audio.heading.startsWith));
  });

  it('another round keeps "Listen, then pick"', async () => {
    const root = await game(LETTER_ROUND);
    const header = byTestId(root, 'listen-pick-round').find((n) => n.props['aria-label'] !== undefined)!;
    expect(textOf(header)).toContain(en.learner.minigame.listenPick.heading);
    expect(String(header.props['aria-label'])).toBe(en.a11y.answer.round(1, 1, en.learner.minigame.listenPick.heading));
  });
});
