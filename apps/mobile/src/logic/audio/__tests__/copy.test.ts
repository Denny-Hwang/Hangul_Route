import { getMessages, pseudoLocalize, pseudoText } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import {
  fallbackActionLabel as fallbackActionLabelWith,
  fallbackMessage as fallbackMessageWith,
  matchSoundHeading as matchSoundHeadingWith,
  panelDetail as panelDetailWith,
  speakerLabel as speakerLabelWith,
  voiceStatusLine as voiceStatusLineWith,
  type AudioCopy,
} from '../copy';
import type { KoVoiceStatus } from '../capability';
import type { FallbackAction, FallbackReason } from '../prompt-state';

// The words are `learner.audio` (F-I18N-001 PR 7b); these tests read the dictionary.
const COPY = getMessages('en').learner.audio;
const matchSoundHeading = (textShown: boolean): string => matchSoundHeadingWith(textShown, COPY);
const speakerLabel = (muted: boolean): string => speakerLabelWith(muted, COPY);
const fallbackMessage = (r: FallbackReason | null): string | null => fallbackMessageWith(r, COPY);
const fallbackActionLabel = (a: FallbackAction): string | null => fallbackActionLabelWith(a, COPY);
const voiceStatusLine = (s: KoVoiceStatus): string => voiceStatusLineWith(s, COPY);
const panelDetail = (r: FallbackReason | null): string | null => panelDetailWith(r, COPY);

const REASONS = ['muted', 'no_voice', 'error', 'blocked', null] as const;
const ACTIONS = ['turn_on', 'try_again', 'tap_to_hear', 'none'] as const;
const STATUSES: KoVoiceStatus[] = [
  { state: 'unknown' },
  { state: 'ready', voiceId: 'v', voiceName: 'Yuna', local: true, quality: 'standard' },
  { state: 'none', reason: 'no_engine' },
  { state: 'none', reason: 'no_korean_voice' },
  { state: 'none', reason: 'offline_network_only' },
];

/** Every line the rules can pick, for one copy subtree. */
function everyLine(copy: AudioCopy): string[] {
  return [
    copy.readHere,
    copy.listenAgain,
    copy.hearIt.cta,
    copy.tapToReplay,
    copy.letterName.cta,
    copy.howToAddVoice.cta,
    matchSoundHeadingWith(false, copy),
    matchSoundHeadingWith(true, copy),
    speakerLabelWith(false, copy),
    speakerLabelWith(true, copy),
    ...REASONS.flatMap((r) => fallbackMessageWith(r, copy) ?? []),
    ...REASONS.flatMap((r) => panelDetailWith(r, copy) ?? []),
    ...ACTIONS.flatMap((a) => fallbackActionLabelWith(a, copy) ?? []),
    ...STATUSES.map((s) => voiceStatusLineWith(s, copy)),
  ];
}

describe('audio copy rules (learner.audio)', () => {
  const all = everyLine(COPY);

  it('has exactly the spec strings', () => {
    expect(COPY.readHere).toBe('No sound? Read it here.');
    expect(COPY.noKoreanVoice).toBe('No Korean voice on this device');
    expect(COPY.listenAgain).toBe('Listen again. This one says');
    expect(COPY.tapToHear).toBe('Tap to hear');
    expect(COPY.action.turn_on.cta).toBe('Turn sound on');
    expect(COPY.action.try_again.cta).toBe('Try again');
    expect(COPY.letterName.cta).toBe('Letter name');
    expect(COPY.voice.ready).toBe('Korean voice: ready');
    expect(matchSoundHeading(false)).toBe('Tap the letter you hear');
    expect(matchSoundHeading(true)).toBe('Tap the letter for this sound');
    expect(speakerLabel(false)).toBe('Play sound');
    expect(speakerLabel(true)).toBe('Play sound, sound is off');
  });

  it('maps every fallback reason to a message, and null to none', () => {
    expect(fallbackMessage('muted')).toBe('Sound is off.');
    expect(fallbackMessage('no_voice')).toBe('No Korean voice on this device');
    expect(fallbackMessage('error')).toBe('The sound did not play.');
    expect(fallbackMessage('blocked')).toBe('Tap to hear');
    expect(fallbackMessage(null)).toBeNull();
  });

  it('maps every action to a label, none to null', () => {
    expect(fallbackActionLabel('turn_on')).toBe('Turn sound on');
    expect(fallbackActionLabel('try_again')).toBe('Try again');
    expect(fallbackActionLabel('tap_to_hear')).toBe('Tap to hear');
    expect(fallbackActionLabel('none')).toBeNull();
  });

  it('gives the voice status line for each state', () => {
    expect(voiceStatusLine({ state: 'ready', voiceId: 'v', voiceName: 'Yuna', local: true, quality: 'standard' })).toBe('Korean voice: ready');
    expect(voiceStatusLine({ state: 'none', reason: 'no_korean_voice' })).toBe('No Korean voice on this device');
    expect(voiceStatusLine({ state: 'none', reason: 'no_engine' })).toBe('No Korean voice on this device');
    expect(voiceStatusLine({ state: 'none', reason: 'offline_network_only' })).toBe('Korean voice needs the internet');
    expect(voiceStatusLine({ state: 'unknown' })).toBe('Looking for a Korean voice');
  });

  it('is plain English: ASCII only (no emoji, no Hangul in UI copy), no age words, no shame words', () => {
    for (const s of all) {
      expect(s.length).toBeGreaterThan(0);
      expect(/^[\x20-\x7E]+$/.test(s)).toBe(true);
      expect(/\b(kid|kids|child|children|baby|wrong|fail|failed|error|red)\b/i.test(s)).toBe(false);
    }
  });
});

describe('panelDetail', () => {
  it('gives the reason line, none for blocked and none', () => {
    expect(panelDetail('muted')).toBe('Sound is off.');
    expect(panelDetail('no_voice')).toBe('No Korean voice on this device.');
    expect(panelDetail('error')).toBe('The sound did not play.');
    expect(panelDetail('blocked')).toBeNull();
    expect(panelDetail(null)).toBeNull();
    expect(COPY.tapToReplay).toBe('Tap to replay');
  });
});

describe('the rules take their words as a parameter (F-I18N-001 §3.4 rule 3)', () => {
  it('renders another locale\'s subtree unchanged (en-XA)', () => {
    const pseudo = pseudoLocalize(getMessages('en')).learner.audio;
    expect(everyLine(pseudo)).toEqual(everyLine(COPY).map(pseudoText));
  });
});
