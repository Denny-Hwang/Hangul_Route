import { getMessages, pseudoLocalize, pseudoText } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import type { KoVoiceStatus } from '../capability';
import {
  soundCardView as soundCardViewWith,
  soundSwitchLabel as soundSwitchLabelWith,
  voiceHelpContent,
  type SoundCardView,
} from '../voice-help';

const messages = getMessages('en');
const COPY = messages.learner.audio;
const soundCardView = (status: KoVoiceStatus, muted: boolean): SoundCardView => soundCardViewWith(status, muted, COPY);
const soundSwitchLabel = (status: KoVoiceStatus, muted: boolean): string =>
  soundSwitchLabelWith(status, muted, COPY, messages.a11y.soundSwitch);
const VOICE_HELP = voiceHelpContent(COPY.voiceHelp);

const ready: KoVoiceStatus = { state: 'ready', voiceId: 'v', voiceName: 'Yuna', local: true, quality: 'standard' };
const unknown: KoVoiceStatus = { state: 'unknown' };
const noVoice: KoVoiceStatus = { state: 'none', reason: 'no_korean_voice' };
const noEngine: KoVoiceStatus = { state: 'none', reason: 'no_engine' };
const netOnly: KoVoiceStatus = { state: 'none', reason: 'offline_network_only' };

describe('soundCardView', () => {
  it('ready voice: status line, no how-to, speaker glyph while sound is on', () => {
    expect(soundCardView(ready, false)).toEqual({
      statusLine: 'Korean voice: ready',
      showHowTo: false,
      howToLabel: 'How to add a voice',
      glyph: 'speaker',
    });
  });

  it('muted switches to the speaker-off glyph and keeps the voice line', () => {
    const v = soundCardView(ready, true);
    expect(v.glyph).toBe('speaker-off');
    expect(v.statusLine).toBe('Korean voice: ready');
  });

  it('still looking: a calm line, no how-to yet (no flash of help)', () => {
    const v = soundCardView(unknown, false);
    expect(v.statusLine).toBe('Looking for a Korean voice');
    expect(v.showHowTo).toBe(false);
  });

  it.each([noVoice, noEngine])('no voice (%o): says so and offers the how-to', (status) => {
    const v = soundCardView(status, false);
    expect(v.statusLine).toBe('No Korean voice on this device');
    expect(v.showHowTo).toBe(true);
  });

  it('only a network voice while offline: its own line, still offers the how-to (a local voice fixes it)', () => {
    const v = soundCardView(netOnly, false);
    expect(v.statusLine).toBe('Korean voice needs the internet');
    expect(v.showHowTo).toBe(true);
  });
});

describe('soundSwitchLabel', () => {
  it('is one group: switch state and voice state', () => {
    expect(soundSwitchLabel(ready, false)).toBe('Sound, on. Korean voice ready.');
    expect(soundSwitchLabel(ready, true)).toBe('Sound, off. Korean voice ready.');
    expect(soundSwitchLabel(noVoice, false)).toBe('Sound, on. No Korean voice on this device.');
    expect(soundSwitchLabel(unknown, false)).toBe('Sound, on. Looking for a Korean voice.');
    expect(soundSwitchLabel(netOnly, true)).toBe('Sound, off. Korean voice needs the internet.');
  });

  it('always starts with the word Sound so the switch is found by its name', () => {
    for (const s of [ready, unknown, noVoice, netOnly]) expect(soundSwitchLabel(s, false).startsWith('Sound')).toBe(true);
  });
});

describe('VOICE_HELP', () => {
  it('has the three OS families in the order of the wireframe, each with numbered-able steps', () => {
    expect(VOICE_HELP.title).toBe('Add a Korean voice');
    expect(VOICE_HELP.sections.map((s) => s.id)).toEqual(['apple', 'android', 'computer']);
    expect(VOICE_HELP.sections.map((s) => s.title)).toEqual(['iPhone or iPad', 'Android', 'Computer']);
    for (const s of VOICE_HELP.sections) {
      expect(s.steps.length).toBeGreaterThanOrEqual(2);
      for (const step of s.steps) expect(step.trim().length).toBeGreaterThan(10);
    }
  });

  it('names the real menu paths and says they can differ', () => {
    const all = VOICE_HELP.sections.flatMap((s) => s.steps).join(' ');
    expect(all).toContain('Spoken Content');
    expect(all).toContain('Speech Services by Google');
    expect(all).toContain('Manage voices');
    expect(VOICE_HELP.note).toBe('Menu names can differ on your device.');
  });

  it('tells the learner they can still play, and closes with OK', () => {
    expect(VOICE_HELP.footer).toBe('You can still play: the sound is written on screen.');
    expect(messages.common.buttons.ok).toBe('OK');
  });

  it('is plain: no emoji, no age words, no shaming', () => {
    const text = JSON.stringify(VOICE_HELP);
    expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(text).not.toMatch(/\b(kid|kids|child|children|baby)\b/i);
    expect(text).not.toMatch(/\b(error|failed|wrong)\b/i);
  });

  it('the link label is the one in the copy table', () => {
    expect(COPY.howToAddVoice.cta).toBe('How to add a voice');
  });

  it('builds the sheet from the subtree it is given (en-XA)', () => {
    const pseudo = voiceHelpContent(pseudoLocalize(messages).learner.audio.voiceHelp);
    expect(pseudo.title).toBe(pseudoText(VOICE_HELP.title));
    expect(pseudo.sections.map((s) => s.id)).toEqual(['apple', 'android', 'computer']);
    expect(pseudo.sections[0]!.steps).toEqual(VOICE_HELP.sections[0]!.steps.map(pseudoText));
  });
});
