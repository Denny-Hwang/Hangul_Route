import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import type { AudioCapability } from '../capability';
import { INITIAL_PROMPT_STATE, promptReducer, type PromptEvent, type PromptState } from '../prompt-state';
import { fallbackVisible, promptPanelView, shouldAutoReplay } from '../prompt-view';

/**
 * The learner's own ask for the text (AMENDMENTS-AUDIO-CANT-HEAR section 3.5): `'show_text'` sets `asked`, and a text the
 * learner asked for stays until `'reset'`, even through the late "no Korean voice" clear. Tests 1 to 4 of section 6.
 */

const unknownCap: AudioCapability = { tts: { state: 'unknown' }, clips: false, unlocked: false };
const readyCap: AudioCapability = {
  tts: { state: 'ready', voiceId: 'v', voiceName: 'Yuna', local: true, quality: 'standard' },
  clips: false,
  unlocked: true,
};
const clipsCap: AudioCapability = { tts: { state: 'unknown' }, clips: true, unlocked: true };
const noneCap: AudioCapability = { tts: { state: 'none', reason: 'no_korean_voice' }, clips: false, unlocked: true };
const run = (events: PromptEvent[], from: PromptState = INITIAL_PROMPT_STATE): PromptState => events.reduce(promptReducer, from);

describe("'show_text' (test 1)", () => {
  it.each([
    ['idle', [] as PromptEvent[]],
    ['playing', ['play'] as PromptEvent[]],
    ['ok', ['play', { result: 'played' }] as PromptEvent[]],
  ])('from %s: the text phase, asked, no reason', (_name, before) => {
    const s = run(['show_text'], run(before));
    expect(s.phase).toBe('text');
    expect(s.reason).toBeNull();
    expect(s.asked).toBe(true);
  });

  it('sending it twice changes nothing', () => {
    const once = run(['show_text']);
    expect(run(['show_text'], once)).toEqual(once);
  });

  it('the initial state carries no `asked` key at all', () => {
    expect(INITIAL_PROMPT_STATE).toEqual({ phase: 'idle', reason: null, attempts: 0 });
    expect('asked' in INITIAL_PROMPT_STATE).toBe(false);
  });

  it('on a text that already has a reason the phase and reason are kept and asked is set', () => {
    for (const reason of ['muted', 'no_voice', 'error', 'blocked'] as const) {
      const s = run(['show_text'], { phase: 'text', reason, attempts: 1 });
      expect(s).toEqual({ phase: 'text', reason, attempts: 1, asked: true });
    }
  });

  it('does not mutate the previous state', () => {
    const before = run(['play']);
    const copy = { ...before };
    run(['show_text'], before);
    expect(before).toEqual(copy);
  });
});

describe('an asked text through the other events (test 2, the table of section 3.5)', () => {
  const asked = run(['show_text']);

  it("'play' keeps `asked` and the text, and counts the attempt", () => {
    expect(run(['play'], asked)).toEqual({ phase: 'text', reason: null, attempts: 1, asked: true });
  });

  it('a play that is `played` keeps the text with no reason', () => {
    expect(run(['play', { result: 'played' }], asked)).toEqual({ phase: 'text', reason: null, attempts: 1, asked: true });
  });

  it('an unavailable play gives its own reason, error by default or blocked, and keeps asked', () => {
    expect(run(['play', { result: 'unavailable' }], asked)).toMatchObject({ phase: 'text', reason: 'error', asked: true });
    expect(run(['play', { result: 'unavailable', failure: 'blocked' }], asked)).toMatchObject({ phase: 'text', reason: 'blocked', asked: true });
  });

  it('muted true gives reason muted; muted false clears that reason and the text stays', () => {
    const muted = run([{ muted: true }], asked);
    expect(muted).toMatchObject({ phase: 'text', reason: 'muted', asked: true });
    expect(run([{ muted: false }], muted)).toMatchObject({ phase: 'text', reason: null, asked: true });
  });

  it('capability none (no clip) gives reason no_voice', () => {
    expect(run([{ capability: noneCap }], asked)).toMatchObject({ phase: 'text', reason: 'no_voice', asked: true });
  });

  it.each([
    ['ready', readyCap],
    ['clips', clipsCap],
  ])('capability %s with reason no_voice: the text stays, the reason goes', (_name, cap) => {
    const noVoice = run([{ capability: noneCap }], asked);
    expect(run([{ capability: cap }], noVoice)).toEqual({ phase: 'text', reason: null, attempts: 0, asked: true });
  });

  it('unknown capability changes nothing', () => {
    expect(run([{ capability: unknownCap }], asked)).toEqual(asked);
  });

  it("'reset' goes back to the initial state, with no `asked`", () => {
    const s = run(['reset'], asked);
    expect(s).toEqual(INITIAL_PROMPT_STATE);
    expect('asked' in s).toBe(false);
  });

  it("the sequence 'show_text', capability none, 'play', capability ready keeps the text", () => {
    const s = run(['show_text', { capability: noneCap }, 'play', { capability: readyCap }]);
    expect(s.phase).toBe('text');
    expect(s.reason).toBeNull();
    expect(s.asked).toBe(true);
  });
});

describe('without `asked` the late no_voice clear is as it was (test 3)', () => {
  it('a proactive no_voice text clears to idle when the voices load', () => {
    expect(run([{ capability: noneCap }, { capability: readyCap }])).toEqual({ phase: 'idle', reason: null, attempts: 0 });
  });

  it('after a play it clears to ok, keeping the attempt', () => {
    expect(run(['play', { capability: noneCap }, { capability: readyCap }])).toEqual({ phase: 'ok', reason: null, attempts: 1 });
  });

  it("'play' on a text with no `asked` adds no `asked` key", () => {
    expect('asked' in run([{ capability: noneCap }, 'play'])).toBe(false);
  });
});

describe('promptPanelView on an asked text (test 4)', () => {
  const COPY = getMessages('en').learner.audio;
  const view = promptPanelView(run(['show_text']), readyCap, false, false, COPY);

  it('shows the text, with the text heading, and no reason, action or help', () => {
    expect(view.textShown).toBe(true);
    expect(view.reason).toBeNull();
    expect(view.detail).toBeNull();
    expect(view.actionLabel).toBeNull();
    expect(view.helpLabel).toBeNull();
    expect(view.heading).toBe(COPY.heading.text);
    expect(view.readLine).toBe(COPY.readHere);
    expect(view.speakerLabel).toBe(COPY.speaker.on);
    expect(view.speakerCaption).toBe(COPY.tapToReplay);
  });

  it('is not a fallback to report, and the replay after a miss still plays', () => {
    expect(fallbackVisible(view, false)).toBe(false);
    expect(fallbackVisible(view, true)).toBe(false);
    expect(shouldAutoReplay(view)).toBe(true);
  });
});
