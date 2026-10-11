import { romanizeWord, type Jamo } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { jamoAll } from '../../../content/jamo';
import { decompose } from '../hangul';
import { spokenFormFor } from '../spoken';

describe('spoken forms read from the jamo data (F-QUEST-002 §3.12, F-AUDIO-004 AD2)', () => {
  const form = (id: string) => spokenFormFor(jamoAll.find((j) => j.id === id)!)!;

  it('every one of the 30 symbols has a form', () => {
    expect(jamoAll).toHaveLength(30);
    for (const j of jamoAll) expect(spokenFormFor(j), j.id).toEqual({ ko: j.spokenKo, romanization: j.spokenRomanization, kind: j.spokenKind });
  });

  it('speaks a consonant as its sound on the carrier vowel ㅏ', () => {
    for (const j of jamoAll.filter((x) => x.kind === 'consonant' && x.id !== 'jamo:ieung')) {
      expect(decompose(form(j.id).ko)!, j.id).toMatchObject({ initial: j.char, medial: 'ㅏ', final: null });
    }
  });

  it('speaks the initial ㅇ by its name 이응, not as 아 (the vowel ㅏ sounds the same)', () => {
    expect(form('jamo:ieung')).toEqual({ ko: '이응', romanization: 'ieung', kind: 'name' });
    expect(form('jamo:a').ko).toBe('아');
  });

  it('speaks a vowel as its ㅇ-syllable', () => {
    for (const j of jamoAll.filter((x) => x.kind === 'vowel')) {
      expect(decompose(form(j.id).ko)!, j.id).toMatchObject({ initial: 'ㅇ', medial: j.char, final: null });
    }
  });

  it('speaks a batchim as a short closed syllable 악 안 알 암 압 앙', () => {
    const finals = jamoAll.filter((x) => x.kind === 'batchim');
    expect(finals.map((j) => form(j.id).ko)).toEqual(['악', '안', '알', '암', '압', '앙']);
    for (const j of finals) {
      expect(decompose(form(j.id).ko)).toMatchObject({ initial: 'ㅇ', medial: 'ㅏ', final: j.char });
    }
  });

  it('marks every form a sound except the name 이응', () => {
    expect(jamoAll.filter((j) => form(j.id).kind === 'name').map((j) => j.id)).toEqual(['jamo:ieung']);
  });

  it('gives each form its Revised Romanization, lower-case and unhyphenated', () => {
    for (const j of jamoAll) {
      const f = form(j.id);
      expect(f.romanization, j.id).toMatch(/^[a-z]+$/);
      expect(f.romanization, j.id).toBe(romanizeWord(f.ko));
    }
  });

  describe('a record without the spoken fields', () => {
    const bare: Jamo = { id: 'jamo:giyeok', char: 'ㄱ', romanization: 'g/k', kind: 'consonant', nameEn: 'giyeok', spokenKind: 'sound', order: 1 };

    it('has no form when either spoken field is missing', () => {
      expect(spokenFormFor(bare)).toBeUndefined();
      expect(spokenFormFor({ ...bare, spokenKo: '그' })).toBeUndefined();
      expect(spokenFormFor({ ...bare, spokenRomanization: 'geu' })).toBeUndefined();
    });

    it('reads the fields when both are present', () => {
      expect(spokenFormFor({ ...bare, spokenKo: '그', spokenRomanization: 'geu' })).toEqual({ ko: '그', romanization: 'geu', kind: 'sound' });
      expect(spokenFormFor({ ...bare, spokenKo: '기역', spokenRomanization: 'giyeok', spokenKind: 'name' })?.kind).toBe('name');
    });
  });
});
