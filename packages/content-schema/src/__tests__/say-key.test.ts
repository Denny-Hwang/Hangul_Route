import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { AUDIO_REF_PATTERN, SAY_KEY_LENGTH, isSayRef, sayKey, sayRef, sha256Hex } from '../index';

/**
 * The text-keyed clip index (AMENDMENTS-AUDIO-CLIPS AC-B4): `sayKey(text) = sha256(NFC(text.trim()))`, the first 16
 * hex characters. The implementation is pure and synchronous (no `node:crypto`, no SubtleCrypto) so the React Native
 * bundle, the web bundle and the plain-node scripts compute the same key; these vectors are cross-checked against
 * `node:crypto` here.
 */
const nodeSha256 = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');

describe('sha256Hex: the pure SHA-256 agrees with node:crypto', () => {
  it.each([
    ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
    ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
    [
      'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq',
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    ],
  ])('the FIPS 180-2 vector %j', (text, hex) => {
    expect(sha256Hex(text)).toBe(hex);
    expect(nodeSha256(text)).toBe(hex);
  });

  it.each([
    '가',
    '나.',
    '니은',
    '쌍기역',
    '앋',
    '안녕하세요.',
    '국물',
    '이천 원이에요.',
    'Hear it with a vowel',
    'é',
    'a'.repeat(55),
    'a'.repeat(56),
    'a'.repeat(63),
    'a'.repeat(64),
    'a'.repeat(65),
    '가'.repeat(200),
    '\u{1F600} 4-byte',
    '\u0000 control',
  ])('matches node:crypto for %j', (text) => {
    expect(sha256Hex(text)).toBe(nodeSha256(text));
  });

  it('encodes a lone surrogate as U+FFFD, as TextEncoder and node:crypto do', () => {
    expect(sha256Hex('a\uD800b')).toBe(nodeSha256('a\uD800b'));
    expect(sha256Hex('a\uDC00b')).toBe(nodeSha256('a\uDC00b'));
    expect(sha256Hex('a\uD800')).toBe(nodeSha256('a\uD800'));
  });
});

describe('sayKey (AC-B4)', () => {
  it('is the first 16 hex characters of sha256 of the trimmed NFC text', () => {
    for (const text of ['가', '니은', '안녕하세요.', '같이 가요']) {
      expect(sayKey(text)).toBe(nodeSha256(text.trim().normalize('NFC')).slice(0, 16));
    }
    expect(SAY_KEY_LENGTH).toBe(16);
    expect(sayKey('가')).toMatch(/^[0-9a-f]{16}$/);
  });

  it('pins the keys of a few texts, so a change to the key is a visible test change', () => {
    // Literal keys, generated once from node:crypto: AC-2's manifest and lock rows depend on them never changing.
    expect(sayKey('가')).toBe('64ee5293d31bc58b');
    expect(sayKey('니은')).toBe('7383da42119a1c5c');
    expect(sayKey('안녕하세요.')).toBe('8b118d6741f7cfa1');
    expect(sayKey('')).toBe('e3b0c44298fc1c14');
    expect(sayKey('가')).toBe(nodeSha256('가').slice(0, 16));
  });

  it('trims surrounding white space, so "가 " and "가" are one clip', () => {
    expect(sayKey(' 가 ')).toBe(sayKey('가'));
    expect(sayKey('\n안녕하세요.\t')).toBe(sayKey('안녕하세요.'));
  });

  it('keeps inner white space and punctuation: they are part of what is said', () => {
    expect(sayKey('같이 가요')).not.toBe(sayKey('같이가요'));
    expect(sayKey('아.')).not.toBe(sayKey('아'));
  });

  it('normalizes to NFC, so a decomposed syllable keys like the composed one', () => {
    const decomposed = '가'; // ᄀ + ᅡ, conjoining jamo
    expect(decomposed).not.toBe('가');
    expect(decomposed.normalize('NFC')).toBe('가');
    expect(sayKey(decomposed)).toBe(sayKey('가'));
  });

  it('on a runtime with no String.prototype.normalize the trimmed text is keyed as it is', () => {
    const proto = String.prototype as { normalize?: unknown };
    const original = proto.normalize;
    proto.normalize = undefined;
    try {
      expect(sayKey(' 가 ')).toBe(nodeSha256('가').slice(0, 16));
    } finally {
      proto.normalize = original;
    }
  });

  it('differs for different texts (changed text never finds the old clip)', () => {
    expect(sayKey('사과')).not.toBe(sayKey('사과요'));
    expect(sayKey('가')).not.toBe(sayKey('나'));
  });
});

describe('sayRef and isSayRef', () => {
  it('names the clip audio/say/<sayKey>.mp3, a valid audio ref', () => {
    const ref = sayRef('니은');
    expect(ref).toBe(`audio/say/${sayKey('니은')}.mp3`);
    expect(AUDIO_REF_PATTERN.test(ref)).toBe(true);
    expect(isSayRef(ref)).toBe(true);
  });

  it('the ref grammar takes exactly the say refs isSayRef recognizes (16 lower-case hex, no folders)', () => {
    for (const ref of ['audio/say/abc.mp3', 'audio/say/foo.mp3', 'audio/say/0123456789ABCDEF.mp3', 'audio/say/0123456789abcdef0.mp3', 'audio/say/ab/0123456789abcdef.mp3']) {
      expect(AUDIO_REF_PATTERN.test(ref)).toBe(false);
      expect(isSayRef(ref)).toBe(false);
    }
  });

  it('recognizes only a 16-hex say ref', () => {
    expect(isSayRef('audio/jamo/giyeok.mp3')).toBe(false);
    expect(isSayRef('audio/say/abc.mp3')).toBe(false);
    expect(isSayRef('audio/say/0123456789ABCDEF.mp3')).toBe(false);
    expect(isSayRef('audio/say/0123456789abcdef.mp3')).toBe(true);
    expect(isSayRef('audio/say/0123456789abcdef0.mp3')).toBe(false);
  });
});
