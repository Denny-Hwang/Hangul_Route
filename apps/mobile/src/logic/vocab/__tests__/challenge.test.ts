import { CLOCK_SCALES } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { scanLearnerCopy } from '../../homework/banned-text';
import {
  TIME_UP_MS,
  challengeLine,
  challengeSettings,
  clockView,
  initialMode,
  pausedFor,
  scaleOnOptIn,
  scaleOptions,
} from '../challenge';

const M = getMessages('en');
const COPY = M.learner.vocab.speed.challenge;
const A11Y = M.a11y.vocab.speed;

describe('challengeSettings (S8: absent reads as off, scale 1)', () => {
  it('a profile with no settings, or settings without the fields, is Relaxed at scale 1', () => {
    expect(challengeSettings(undefined)).toEqual({ on: false, scale: 1 });
    expect(challengeSettings({ romanizationMode: 'always' })).toEqual({ on: false, scale: 1 });
  });

  it('reads the stored opt-in and scale', () => {
    expect(challengeSettings({ romanizationMode: 'always', challengeMode: true, clockScale: 1.5 })).toEqual({ on: true, scale: 1.5 });
    expect(challengeSettings({ romanizationMode: 'tap', challengeMode: false, clockScale: 2 })).toEqual({ on: false, scale: 2 });
  });
});

describe('initialMode (S8: never preselected for a profile that has not opted in)', () => {
  it('Relaxed unless the profile opted in and the route asks for Challenge', () => {
    expect(initialMode(false, undefined)).toBe('relaxed');
    expect(initialMode(false, 'challenge')).toBe('relaxed');
    expect(initialMode(true, undefined)).toBe('relaxed');
    expect(initialMode(true, 'relaxed')).toBe('relaxed');
    expect(initialMode(true, 'challenge')).toBe('challenge');
  });
});

describe('scaleOnOptIn (§3.8: a screen reader pre-selects twice as long)', () => {
  it('keeps the stored scale without a screen reader, 2 with one', () => {
    for (const scale of CLOCK_SCALES) {
      expect(scaleOnOptIn(scale, false)).toBe(scale);
      expect(scaleOnOptIn(scale, true)).toBe(2);
    }
  });
});

describe('scaleOptions and challengeLine (§3.5)', () => {
  it('names the three scales Normal / A bit longer / Twice as long, in order', () => {
    expect(scaleOptions(COPY)).toEqual([
      { scale: 1, label: 'Normal' },
      { scale: 1.5, label: 'A bit longer' },
      { scale: 2, label: 'Twice as long' },
    ]);
  });

  it('says how long the one clock is', () => {
    expect(challengeLine(1, COPY)).toBe('One clock: 60 seconds for the whole round.');
    expect(challengeLine(1.5, COPY)).toBe('One clock: 90 seconds for the whole round.');
    expect(challengeLine(2, COPY)).toBe('One clock: 120 seconds for the whole round.');
  });
});

describe('clockView (§3.6, §3.8: digits, a stepped bar, static words for the last seconds)', () => {
  it('a full clock', () => {
    expect(clockView(60_000, 60_000, COPY, A11Y)).toEqual({
      digits: '1:00',
      fill: 1,
      fewSeconds: null,
      label: 'Time left: 60 seconds',
    });
  });

  it('rounds the seconds up and steps the bar', () => {
    const v = clockView(41_200, 60_000, COPY, A11Y);
    if (v === null) throw new Error('a clock');
    expect(v.digits).toBe('0:42');
    expect(v.label).toBe('Time left: 42 seconds');
    expect(v.fill).toBeCloseTo(42 / 60);
    expect(v.fewSeconds).toBeNull();
  });

  it('the last ten seconds only add words', () => {
    expect(clockView(10_000, 60_000, COPY, A11Y)?.fewSeconds).toBe('A few seconds left');
    expect(clockView(900, 120_000, COPY, A11Y)).toEqual({
      digits: '0:01',
      fill: 1 / 60,
      fewSeconds: 'A few seconds left',
      label: 'Time left: 1 second',
    });
  });

  it('no clock (Relaxed) or a clock that ran out', () => {
    expect(clockView(null, null, COPY, A11Y)).toBeNull();
    expect(clockView(0, 60_000, COPY, A11Y)).toEqual({ digits: '0:00', fill: 0, fewSeconds: null, label: 'Time left: 0 seconds' });
  });
});

describe('pausedFor (resume carries the paused wall time)', () => {
  it('the wall time since the pause, never negative', () => {
    expect(pausedFor(1_000, 4_500)).toBe(3_500);
    expect(pausedFor(5_000, 4_500)).toBe(0);
    expect(pausedFor(null, 4_500)).toBe(0);
  });
});

describe('Challenge copy (D3, §3.8)', () => {
  it('the time-up beat is one second', () => {
    expect(TIME_UP_MS).toBe(1_000);
  });

  it('no line shames, counts misses, names an age or uses a percentage or a fraction', () => {
    const lines = [
      COPY.label,
      COPY.try,
      COPY.tryLine,
      COPY.scale.title,
      COPY.scale.normal,
      COPY.scale.longer,
      COPY.scale.twice,
      COPY.stopsLine,
      COPY.screenReaderLine,
      COPY.pause,
      COPY.paused,
      COPY.resume,
      COPY.stop,
      COPY.fewSeconds,
      COPY.timeUp,
      COPY.profile.title,
      COPY.profile.line,
      COPY.profile.on,
      COPY.profile.off,
      ...CLOCK_SCALES.map((s) => challengeLine(s, COPY)),
    ];
    for (const line of lines) {
      expect(scanLearnerCopy([line]), line).toEqual([]);
      expect(line, line).not.toMatch(/\b(wrong|fail\w*|missed|lost|lose|streak|combo|lives|hurry)\b|%|\d\s*\/\s*\d/i);
      expect(line).not.toMatch(/\b(kids?|child(ren)?|ages?|years? old|adults?)\b/i);
    }
  });
});
