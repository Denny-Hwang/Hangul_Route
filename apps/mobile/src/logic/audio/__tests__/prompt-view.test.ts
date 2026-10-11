import { describe, expect, it } from 'vitest';
import type { AudioCapability } from '../capability';
import { AUDIO_COPY } from '../copy';
import { INITIAL_PROMPT_STATE, promptReducer, type PromptEvent, type PromptState } from '../prompt-state';
import { failureFromStore, promptPanelView, shouldAutoReplay, wrongAnswerBubble } from '../prompt-view';

const unknownCap: AudioCapability = { tts: { state: 'unknown' }, clips: false, unlocked: false };
const readyCap: AudioCapability = {
  tts: { state: 'ready', voiceId: 'v', voiceName: 'Yuna', local: true, quality: 'standard' },
  clips: false,
  unlocked: true,
};
const noneCap: AudioCapability = { tts: { state: 'none', reason: 'no_korean_voice' }, clips: false, unlocked: true };
const run = (events: PromptEvent[]): PromptState => events.reduce(promptReducer, INITIAL_PROMPT_STATE);

describe('promptPanelView', () => {
  it('shows the audio prompt with a ready voice and nothing played yet', () => {
    const v = promptPanelView(INITIAL_PROMPT_STATE, readyCap, false, false);
    expect(v).toMatchObject({
      textShown: false,
      reason: null,
      action: 'none',
      actionLabel: null,
      detail: null,
      heading: 'Tap the letter you hear',
      speakerLabel: 'Play sound',
      speakerCaption: 'Tap to replay',
    });
    expect(v.readLine).toBe('No sound? Read it here.');
  });

  it('never flashes the text while the capability is unknown', () => {
    expect(promptPanelView(INITIAL_PROMPT_STATE, unknownCap, false, false).textShown).toBe(false);
    expect(promptPanelView(run(['play']), unknownCap, false, false).textShown).toBe(false);
  });

  it('muted shows the text at once, offers Turn sound on and the text heading', () => {
    const v = promptPanelView(INITIAL_PROMPT_STATE, readyCap, true, false);
    expect(v).toMatchObject({
      textShown: true,
      reason: 'muted',
      detail: 'Sound is off.',
      action: 'turn_on',
      actionLabel: 'Turn sound on',
      heading: 'Tap the letter for this sound',
      speakerLabel: 'Play sound, sound is off',
    });
  });

  it('no Korean voice and no clip shows the text at once with no button', () => {
    const v = promptPanelView(INITIAL_PROMPT_STATE, noneCap, false, false);
    expect(v).toMatchObject({
      textShown: true,
      reason: 'no_voice',
      detail: 'No Korean voice on this device.',
      action: 'none',
      actionLabel: null,
      heading: 'Tap the letter for this sound',
    });
  });

  it('a bundled clip keeps the audio prompt even with no voice', () => {
    expect(promptPanelView(INITIAL_PROMPT_STATE, noneCap, false, true).textShown).toBe(false);
  });

  it('a blocked play shows the text, Tap to hear, and keeps the listen heading', () => {
    const v = promptPanelView(run(['play', { result: 'unavailable', failure: 'blocked' }]), readyCap, false, false);
    expect(v).toMatchObject({
      textShown: true,
      reason: 'blocked',
      detail: null,
      action: 'tap_to_hear',
      actionLabel: 'Tap to hear',
      heading: 'Tap the letter you hear',
      speakerLabel: 'Tap to hear',
      speakerCaption: 'Tap to hear',
    });
  });

  it('an engine error shows the text with Try again and the listen heading', () => {
    const v = promptPanelView(run(['play', { result: 'unavailable', failure: 'error' }]), readyCap, false, false);
    expect(v).toMatchObject({ textShown: true, reason: 'error', detail: 'The sound did not play.', action: 'try_again', heading: 'Tap the letter you hear' });
  });

  it('turning sound back on keeps the text for the round with no reason, and the text heading', () => {
    const s = run([{ muted: true }, { muted: false }]);
    const v = promptPanelView(s, readyCap, false, false);
    expect(v).toMatchObject({ textShown: true, reason: null, action: 'none', detail: null, heading: 'Tap the letter for this sound' });
  });
});

describe('shouldAutoReplay', () => {
  it('replays after a wrong tap unless the text is up because of sound off or an unavailable sound', () => {
    expect(shouldAutoReplay(promptPanelView(INITIAL_PROMPT_STATE, readyCap, false, false))).toBe(true);
    expect(shouldAutoReplay(promptPanelView(INITIAL_PROMPT_STATE, readyCap, true, false))).toBe(false);
    expect(shouldAutoReplay(promptPanelView(INITIAL_PROMPT_STATE, noneCap, false, false))).toBe(false);
    expect(shouldAutoReplay(promptPanelView(run(['play', { result: 'unavailable', failure: 'error' }]), readyCap, false, false))).toBe(false);
    // Text kept after turning sound on: sound works again, so the replay is back.
    expect(shouldAutoReplay(promptPanelView(run([{ muted: true }, { muted: false }]), readyCap, false, false))).toBe(true);
  });
});

describe('failureFromStore', () => {
  it('passes a play failure through and treats anything else as an error', () => {
    expect(failureFromStore({ reason: 'blocked', at: 1 })).toBe('blocked');
    expect(failureFromStore({ reason: 'no_voice', at: 1 })).toBe('no_voice');
    expect(failureFromStore({ reason: 'error', at: 1 })).toBe('error');
    expect(failureFromStore({ reason: 'muted', at: 1 })).toBe('error');
    expect(failureFromStore(null)).toBe('error');
  });
});

describe('wrongAnswerBubble', () => {
  it('says the spoken syllable and its romanization, never the letter name', () => {
    expect(wrongAnswerBubble({ text: '가', romanization: 'ga' })).toEqual({
      message: AUDIO_COPY.listenAgain,
      korean: '가',
      romanization: 'ga',
    });
  });
});
