import { romanizeWord } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { jamoAll } from '../../../content/jamo';
import { decompose } from '../hangul';
import { INTERIM_SPOKEN, interimSpokenFor, spokenFormFor } from '../spoken';

describe('interim spoken forms (F-QUEST-002 §3.12, F-AUDIO-004 AD2)', () => {
  it('covers each of the 30 symbols exactly once', () => {
    expect(Object.keys(INTERIM_SPOKEN).sort()).toEqual(jamoAll.map((j) => j.id).sort());
  });

  it('speaks a consonant as its sound on the carrier vowel ㅏ', () => {
    for (const j of jamoAll.filter((x) => x.kind === 'consonant' && x.id !== 'jamo:ieung')) {
      const parts = decompose(interimSpokenFor(j.id)!.ko)!;
      expect(parts, j.id).toMatchObject({ initial: j.char, medial: 'ㅏ', final: null });
    }
  });

  it('speaks the initial ㅇ by its name 이응, not as 아 (the vowel ㅏ sounds the same)', () => {
    expect(interimSpokenFor('jamo:ieung')).toEqual({ ko: '이응', romanization: 'ieung', kind: 'name' });
    expect(interimSpokenFor('jamo:a')!.ko).toBe('아');
  });

  it('speaks a vowel as its ㅇ-syllable', () => {
    for (const j of jamoAll.filter((x) => x.kind === 'vowel')) {
      const parts = decompose(interimSpokenFor(j.id)!.ko)!;
      expect(parts, j.id).toMatchObject({ initial: 'ㅇ', medial: j.char, final: null });
    }
  });

  it('speaks a batchim as a short closed syllable 악 안 알 암 압 앙', () => {
    const finals = jamoAll.filter((x) => x.kind === 'batchim');
    expect(finals.map((j) => interimSpokenFor(j.id)!.ko)).toEqual(['악', '안', '알', '암', '압', '앙']);
    for (const j of finals) {
      expect(decompose(interimSpokenFor(j.id)!.ko)).toMatchObject({ initial: 'ㅇ', medial: 'ㅏ', final: j.char });
    }
  });

  it('marks every form a sound except the name 이응', () => {
    const kinds = Object.entries(INTERIM_SPOKEN).filter(([, f]) => f.kind === 'name');
    expect(kinds.map(([id]) => id)).toEqual(['jamo:ieung']);
  });

  it('gives each form its Revised Romanization, lower-case and unhyphenated', () => {
    for (const [id, form] of Object.entries(INTERIM_SPOKEN)) {
      expect(form.romanization, id).toMatch(/^[a-z]+$/);
      expect(form.romanization, id).toBe(romanizeWord(form.ko));
    }
  });

  it('returns undefined for an unknown id', () => {
    expect(interimSpokenFor('jamo:nope')).toBeUndefined();
  });

  it('prefers the jamo data (F-AUDIO-004) and falls back to the interim map when spokenKo is absent', () => {
    const g = jamoAll.find((j) => j.id === 'jamo:giyeok')!;
    expect(spokenFormFor(g)).toEqual(interimSpokenFor('jamo:giyeok'));
    expect(spokenFormFor({ ...g, spokenKo: '그', spokenRomanization: 'geu', spokenKind: 'sound' })).toEqual({
      ko: '그',
      romanization: 'geu',
      kind: 'sound',
    });
    expect(spokenFormFor({ ...g, spokenKo: '기역', spokenRomanization: 'giyeok', spokenKind: 'name' })?.kind).toBe('name');
  });

  it('falls back to the interim map when the data has no romanization for its spoken form', () => {
    const g = jamoAll.find((j) => j.id === 'jamo:giyeok')!;
    expect(spokenFormFor({ ...g, spokenKo: '그', spokenKind: 'sound' })).toEqual(interimSpokenFor('jamo:giyeok'));
  });

  it('has no form for a symbol that is neither in the data nor the map', () => {
    const g = jamoAll[0]!;
    expect(spokenFormFor({ ...g, id: 'jamo:nope', spokenKind: 'sound' })).toBeUndefined();
  });
});
