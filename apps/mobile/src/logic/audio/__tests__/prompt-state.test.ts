import { describe, expect, it } from 'vitest';
import type { AudioCapability } from '../capability';
import {
  INITIAL_PROMPT_STATE,
  fallbackAction,
  promptReducer,
  showText,
  type PromptEvent,
  type PromptState,
} from '../prompt-state';

const unknownCap: AudioCapability = { tts: { state: 'unknown' }, clips: false, unlocked: false };
const readyCap: AudioCapability = {
  tts: { state: 'ready', voiceId: 'v', voiceName: 'Yuna', local: true, quality: 'standard' },
  clips: false,
  unlocked: true,
};
const noneCap: AudioCapability = { tts: { state: 'none', reason: 'no_korean_voice' }, clips: false, unlocked: true };

function run(events: PromptEvent[], from: PromptState = INITIAL_PROMPT_STATE): PromptState {
  return events.reduce(promptReducer, from);
}

describe('promptReducer', () => {
  it('starts idle with no reason and no attempts', () => {
    expect(INITIAL_PROMPT_STATE).toEqual({ phase: 'idle', reason: null, attempts: 0 });
  });

  it('play then played is ok', () => {
    const playing = run(['play']);
    expect(playing).toEqual({ phase: 'playing', reason: null, attempts: 1 });
    expect(run(['play', { result: 'played' }])).toEqual({ phase: 'ok', reason: null, attempts: 1 });
  });

  it('a muted result shows text with reason muted', () => {
    expect(run(['play', { result: 'muted' }])).toEqual({ phase: 'text', reason: 'muted', attempts: 1 });
  });

  it('an unavailable result shows text with the reported reason, defaulting to error', () => {
    expect(run(['play', { result: 'unavailable', failure: 'blocked' }])).toMatchObject({ phase: 'text', reason: 'blocked' });
    expect(run(['play', { result: 'unavailable', failure: 'no_voice' }])).toMatchObject({ phase: 'text', reason: 'no_voice' });
    expect(run(['play', { result: 'unavailable' }])).toMatchObject({ phase: 'text', reason: 'error' });
  });

  it('text stays once shown: replay keeps it, a successful replay does not hide it', () => {
    const shown = run(['play', { result: 'unavailable', failure: 'blocked' }]);
    const replaying = run(['play'], shown);
    expect(replaying).toMatchObject({ phase: 'text', reason: 'blocked', attempts: 2 });
    const played = run([{ result: 'played' }], replaying);
    expect(played.phase).toBe('text');
    expect(played.reason).toBeNull();
  });

  it('a later failure updates the reason but never leaves the text phase', () => {
    const s = run([
      'play',
      { result: 'unavailable', failure: 'blocked' },
      'play',
      { result: 'unavailable', failure: 'error' },
    ]);
    expect(s).toMatchObject({ phase: 'text', reason: 'error', attempts: 2 });
  });

  it('a capability with no Korean voice and no clips shows text proactively as no_voice', () => {
    expect(run([{ capability: noneCap }])).toEqual({ phase: 'text', reason: 'no_voice', attempts: 0 });
  });

  it('a capability event keeps an existing reason in the text phase', () => {
    const s = run([{ result: 'muted' }, { capability: noneCap }]);
    expect(s).toMatchObject({ phase: 'text', reason: 'muted' });
  });

  it('a capability event with a null reason in the text phase sets no_voice', () => {
    const s = run(['play', { result: 'unavailable', failure: 'blocked' }, { result: 'played' }, { capability: noneCap }]);
    expect(s).toMatchObject({ phase: 'text', reason: 'no_voice' });
  });

  it('unknown, ready or clips-only capabilities change nothing', () => {
    expect(run([{ capability: unknownCap }])).toEqual(INITIAL_PROMPT_STATE);
    expect(run([{ capability: readyCap }])).toEqual(INITIAL_PROMPT_STATE);
    expect(run([{ capability: { ...noneCap, clips: true } }])).toEqual(INITIAL_PROMPT_STATE);
  });

  it('muting shows text; unmuting clears the muted reason but keeps the text for the round', () => {
    const muted = run([{ muted: true }]);
    expect(muted).toEqual({ phase: 'text', reason: 'muted', attempts: 0 });
    const unmuted = run([{ muted: false }], muted);
    expect(unmuted).toEqual({ phase: 'text', reason: null, attempts: 0 });
  });

  it('unmuting leaves other reasons and non-text phases alone', () => {
    const blocked = run(['play', { result: 'unavailable', failure: 'blocked' }]);
    expect(run([{ muted: false }], blocked)).toEqual(blocked);
    expect(run([{ muted: false }])).toEqual(INITIAL_PROMPT_STATE);
  });

  it('reset returns to the initial state for the next round', () => {
    const shown = run(['play', { result: 'muted' }]);
    expect(run(['reset'], shown)).toEqual(INITIAL_PROMPT_STATE);
  });

  it('does not mutate the previous state', () => {
    const before = run(['play']);
    const copy = { ...before };
    promptReducer(before, { result: 'muted' });
    expect(before).toEqual(copy);
  });
});

describe('showText', () => {
  it('is false while the capability is unknown (no flash of text)', () => {
    expect(showText(INITIAL_PROMPT_STATE, unknownCap, false, false)).toBe(false);
  });

  it('is true whenever sound is off, with or without a clip, whatever the capability', () => {
    expect(showText(INITIAL_PROMPT_STATE, readyCap, true, true)).toBe(true);
    expect(showText(INITIAL_PROMPT_STATE, unknownCap, true, false)).toBe(true);
  });

  it('is true with no Korean voice and no clip for this item, false with a clip', () => {
    expect(showText(INITIAL_PROMPT_STATE, noneCap, false, false)).toBe(true);
    expect(showText(INITIAL_PROMPT_STATE, noneCap, false, true)).toBe(false);
  });

  it('is false with a ready voice', () => {
    expect(showText(INITIAL_PROMPT_STATE, readyCap, false, false)).toBe(false);
  });

  it('is true once the reducer reached the text phase, even with a ready voice', () => {
    const shown = run(['play', { result: 'unavailable', failure: 'error' }]);
    expect(showText(shown, readyCap, false, false)).toBe(true);
  });
});

describe('fallbackAction', () => {
  it.each([
    ['muted', 'turn_on'],
    ['blocked', 'tap_to_hear'],
    ['error', 'try_again'],
    ['no_voice', 'none'],
    [null, 'none'],
  ] as const)('%s -> %s', (reason, action) => {
    expect(fallbackAction(reason)).toBe(action);
  });
});
