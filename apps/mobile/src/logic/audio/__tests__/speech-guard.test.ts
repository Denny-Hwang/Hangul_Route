import { afterEach, describe, expect, it, vi } from 'vitest';
import { KNOWN_LONE_JAMO_SPEAKERS, guardSpokenText, isLoneJamo, runtimeMode } from '../speech-guard';

/**
 * JV-A2 runtime guard: a text that is a lone compatibility jamo (U+3131-318E) or a
 * conjoining jamo (U+1100-11FF) never reaches the voice. It throws in tests, warns in a
 * development build and is silent in a release build.
 */

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('runtimeMode', () => {
  it('is test under vitest', () => {
    expect(runtimeMode()).toBe('test');
  });

  it("follows Metro's __DEV__ outside tests", () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubGlobal('__DEV__', true);
    expect(runtimeMode()).toBe('development');
    vi.stubGlobal('__DEV__', false);
    expect(runtimeMode()).toBe('production');
  });

  it('falls back to NODE_ENV when __DEV__ is not a boolean', () => {
    vi.stubGlobal('__DEV__', undefined);
    vi.stubEnv('NODE_ENV', 'production');
    expect(runtimeMode()).toBe('production');
    vi.stubEnv('NODE_ENV', 'development');
    expect(runtimeMode()).toBe('development');
  });
});

describe('isLoneJamo', () => {
  it.each(['ㄴ', 'ㅏ', 'ㆎ', 'ㄱ', 'ᄂ', 'ᅡ', 'ᇿ', ' ㄴ ', '\nㅏ'])('%j is a lone jamo', (text) => {
    expect(isLoneJamo(text)).toBe(true);
  });

  it.each(['나', '니은', '이응', '앋', 'ㄴ 받침', 'ㄴ + ㅏ', 'n', '', '  '])('%j is not', (text) => {
    expect(isLoneJamo(text)).toBe(false);
  });

  it.each([undefined, null, 12, { text: 'ㄴ' }])('a text that is not a string (%j) is not, and never throws', (text) => {
    expect(isLoneJamo(text as unknown as string)).toBe(false);
  });
});

describe('guardSpokenText', () => {
  it.each(['ㄴ', 'ㅏ', 'ᄂ'])('throws in tests on %j', (text) => {
    expect(() => guardSpokenText(text)).toThrow(/lone jamo/);
  });

  it('names the surface in the error', () => {
    expect(() => guardSpokenText('ㄴ', 'match-sound')).toThrow(/match-sound/);
  });

  it.each(['나', '니은', 'ㄴ 받침', 'Tap the letter'])('passes %j', (text) => {
    expect(() => guardSpokenText(text)).not.toThrow();
  });

  it('warns once per call in a development build and never throws', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubGlobal('__DEV__', true);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(() => guardSpokenText('ㄴ', 'story')).not.toThrow();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toMatch(/lone jamo/);
  });

  it('never throws on a text that is not a string, in any build (a malformed cached deck)', () => {
    expect(() => guardSpokenText(undefined as unknown as string)).not.toThrow();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubGlobal('__DEV__', false);
    expect(() => guardSpokenText(42 as unknown as string, 'story')).not.toThrow();
  });

  it('is silent in a release build', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubGlobal('__DEV__', false);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(() => guardSpokenText('ㄴ')).not.toThrow();
    expect(warn).not.toHaveBeenCalled();
  });

  it('every known offender is tagged with the spec row that removes it', () => {
    for (const entry of KNOWN_LONE_JAMO_SPEAKERS) {
      expect(entry.spec).toMatch(/^M\d+$/);
      expect(entry.fixedBy).toMatch(/^JV-\d$/);
      expect(entry.source.length).toBeGreaterThan(0);
    }
  });

  it('no surface is excused at JV-1: the shipped list is empty', () => {
    expect(KNOWN_LONE_JAMO_SPEAKERS).toEqual([]);
  });

  it('a listed source passes silently; another source, or none, still throws', () => {
    const known = [{ source: 'story-reader', spec: 'M8', fixedBy: 'JV-3' }] as const;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(() => guardSpokenText('ㄴ', 'story-reader', known)).not.toThrow();
    expect(warn).not.toHaveBeenCalled();
    expect(() => guardSpokenText('ㄴ', 'match-sound', known)).toThrow(/lone jamo/);
    expect(() => guardSpokenText('ㄴ', undefined, known)).toThrow(/lone jamo/);
  });
});
