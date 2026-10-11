import { getMessages, pseudoLocalize, pseudoText } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import type { AudioCapability } from '../capability';
import { INITIAL_PROMPT_STATE, promptReducer, type PromptEvent, type PromptState } from '../prompt-state';
import {
  failureFromStore,
  promptPanelView as promptPanelViewWith,
  shouldAutoReplay,
  wrongAnswerBubble,
  type PromptPanelView,
} from '../prompt-view';

const COPY = getMessages('en').learner.audio;
const promptPanelView = (s: PromptState, cap: AudioCapability, muted: boolean, hasClip: boolean): PromptPanelView =>
  promptPanelViewWith(s, cap, muted, hasClip, COPY);

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
      helpLabel: 'How to add a voice',
    });
  });

  it('only the no-voice reason offers the how-to link (A-4b)', () => {
    expect(promptPanelView(INITIAL_PROMPT_STATE, readyCap, false, false).helpLabel).toBeNull();
    expect(promptPanelView(INITIAL_PROMPT_STATE, readyCap, true, false).helpLabel).toBeNull();
    expect(promptPanelView(run(['play', { result: 'unavailable', failure: 'error' }]), readyCap, false, false).helpLabel).toBeNull();
    expect(promptPanelView(run(['play', { result: 'unavailable', failure: 'blocked' }]), readyCap, false, false).helpLabel).toBeNull();
    expect(promptPanelView(INITIAL_PROMPT_STATE, unknownCap, false, false).helpLabel).toBeNull();
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

describe('promptPanelView.statusShown (the status-only panel, F-AUDIO-004 A-5b)', () => {
  // Build Letter, Card Match, Tap & Respond, Culture Quiz, Voice Echo and the card detail already print
  // the Korean next to the speaker: the panel only says why there is no sound, once the learner asked for it.
  it('stays hidden until the slot has tried to play, even when sound is off or there is no voice', () => {
    expect(promptPanelView(run([{ muted: true }]), readyCap, true, false).statusShown).toBe(false);
    expect(promptPanelView(INITIAL_PROMPT_STATE, noneCap, false, false).statusShown).toBe(false);
  });

  it('after a play, says the sound is off and offers Turn sound on', () => {
    const v = promptPanelView(run([{ muted: true }, 'play', { result: 'muted' }]), readyCap, true, false);
    expect(v).toMatchObject({ statusShown: true, detail: 'Sound is off.', actionLabel: 'Turn sound on' });
  });

  it('after a play with no Korean voice, says so and links the how-to', () => {
    const v = promptPanelView(run(['play', { result: 'unavailable', failure: 'no_voice' }]), noneCap, false, false);
    expect(v).toMatchObject({ statusShown: true, detail: 'No Korean voice on this device.', actionLabel: null, helpLabel: 'How to add a voice' });
  });

  it('after a failed or blocked play, offers Try again or Tap to hear', () => {
    expect(promptPanelView(run(['play', { result: 'unavailable', failure: 'error' }]), readyCap, false, false)).toMatchObject({
      statusShown: true,
      actionLabel: 'Try again',
    });
    expect(promptPanelView(run(['play', { result: 'unavailable', failure: 'blocked' }]), readyCap, false, false)).toMatchObject({
      statusShown: true,
      detail: null,
      actionLabel: 'Tap to hear',
    });
  });

  it('is hidden while playing, after a sound that played, and when the text only stays after sound came back', () => {
    expect(promptPanelView(run(['play']), readyCap, false, false).statusShown).toBe(false);
    expect(promptPanelView(run(['play']), unknownCap, false, false).statusShown).toBe(false);
    expect(promptPanelView(run(['play', { result: 'played' }]), readyCap, false, false).statusShown).toBe(false);
    expect(promptPanelView(run([{ muted: true }, 'play', { result: 'muted' }, { muted: false }]), readyCap, false, false).statusShown).toBe(false);
  });

  it('a new round (reset) hides it again', () => {
    expect(promptPanelView(run(['play', { result: 'unavailable', failure: 'error' }, 'reset']), readyCap, false, false).statusShown).toBe(false);
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
    expect(wrongAnswerBubble({ text: '가', romanization: 'ga' }, COPY)).toEqual({
      message: 'Listen again. This one says',
      korean: '가',
      romanization: 'ga',
    });
  });
});

describe('promptPanelView takes its words as a parameter (F-I18N-001 §3.4 rule 3)', () => {
  it('renders every line from the subtree it is given (en-XA)', () => {
    const pseudo = pseudoLocalize(getMessages('en')).learner.audio;
    const muted = promptPanelViewWith(INITIAL_PROMPT_STATE, readyCap, true, false, pseudo);
    expect(muted.readLine).toBe(pseudoText('No sound? Read it here.'));
    expect(muted.detail).toBe(pseudoText('Sound is off.'));
    expect(muted.actionLabel).toBe(pseudoText('Turn sound on'));
    expect(muted.heading).toBe(pseudoText('Tap the letter for this sound'));
    expect(muted.speakerLabel).toBe(pseudoText('Play sound, sound is off'));
    expect(muted.speakerCaption).toBe(pseudoText('Tap to replay'));
    const noVoice = promptPanelViewWith(INITIAL_PROMPT_STATE, noneCap, false, false, pseudo);
    expect(noVoice.helpLabel).toBe(pseudoText('How to add a voice'));
    expect(wrongAnswerBubble({ text: '가', romanization: 'ga' }, pseudo).message).toBe(pseudoText('Listen again. This one says'));
  });
});
