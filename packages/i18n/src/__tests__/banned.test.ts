import { describe, expect, it } from 'vitest';
import bannedWords from '../banned-words.json';
import { LOCALES } from '../locales';
import { BANNED_WORDS, bannedWordsFor, findBannedWord, isCopySafe, scanCopy } from '../banned';

describe('banned-words.json', () => {
  it('has a learner and a caregiver list for every locale (single source)', () => {
    expect(Object.keys(bannedWords).sort()).toEqual([...LOCALES].sort());
    for (const locale of LOCALES) {
      expect(Object.keys(bannedWords[locale]).sort()).toEqual(['caregiver', 'learner']);
      expect(bannedWords[locale].learner.length).toBeGreaterThan(0);
      expect(bannedWords[locale].caregiver.length).toBeGreaterThan(0);
    }
  });

  it('is exactly the spec seed lists', () => {
    expect(bannedWords.en.learner).toEqual(['missed', 'incomplete', 'failed', 'overdue']);
    expect(bannedWords.en.caregiver).toEqual(['behind', 'lazy']);
    expect(bannedWords.es.learner).toEqual([
      'fallaste', 'fallido', 'incompleto', 'incompleta', 'atrasado', 'atrasada', 'vencido', 'vencida', 'perdiste',
    ]);
    expect(bannedWords.es.caregiver).toEqual(['retrasado', 'retrasada', 'vago', 'perezoso', 'flojo']);
    expect(bannedWords.ko.learner).toEqual(['실패', '미완료', '놓친', '밀린', '기한 초과']);
    expect(bannedWords.ko.caregiver).toEqual(['뒤처', '게으른']);
  });

  it('every list is lower-case and trimmed', () => {
    for (const locale of LOCALES) {
      for (const surface of ['learner', 'caregiver'] as const) {
        for (const w of bannedWords[locale][surface]) {
          expect(w).toBe(w.trim().toLowerCase());
        }
      }
    }
  });
});

describe('bannedWordsFor', () => {
  it('the caregiver surface is the learner list plus the caregiver additions', () => {
    expect(bannedWordsFor('en', 'learner')).toEqual(['missed', 'incomplete', 'failed', 'overdue']);
    expect(bannedWordsFor('en', 'caregiver')).toEqual([
      'missed', 'incomplete', 'failed', 'overdue', 'behind', 'lazy',
    ]);
    expect(BANNED_WORDS.en.caregiver).toEqual(bannedWordsFor('en', 'caregiver'));
  });
});

describe('findBannedWord (en)', () => {
  it('finds a whole word case-insensitively', () => {
    expect(findBannedWord('You MISSED one', 'en', 'learner')).toBe('missed');
    expect(findBannedWord('Failed!', 'en', 'learner')).toBe('failed');
    expect(findBannedWord('2 overdue tasks', 'en', 'learner')).toBe('overdue');
  });

  it('near-misses are ordinary copy', () => {
    expect(findBannedWord('dismissed', 'en', 'learner')).toBeNull();
    expect(findBannedWord('incompletely', 'en', 'learner')).toBeNull();
    expect(findBannedWord('', 'en', 'learner')).toBeNull();
    expect(findBannedWord('Great work, keep going', 'en', 'learner')).toBeNull();
  });

  it('caregiver additions only apply to the caregiver surface', () => {
    expect(findBannedWord('running behind', 'en', 'learner')).toBeNull();
    expect(findBannedWord('running behind', 'en', 'caregiver')).toBe('behind');
    expect(findBannedWord('a lazy day', 'en', 'caregiver')).toBe('lazy');
    expect(findBannedWord('You missed it', 'en', 'caregiver')).toBe('missed');
  });
});

describe('findBannedWord (es): token matching with explicit letter ranges', () => {
  it('hits whole tokens', () => {
    expect(findBannedWord('¡Fallaste otra vez!', 'es', 'learner')).toBe('fallaste');
    expect(findBannedWord('tarea incompleta', 'es', 'learner')).toBe('incompleta');
    expect(findBannedWord('pago VENCIDO', 'es', 'learner')).toBe('vencido');
  });

  it('near-misses behave: plurals and longer words are not hits', () => {
    expect(findBannedWord('vencidos', 'es', 'learner')).toBeNull();
    expect(findBannedWord('atrasadísimo', 'es', 'learner')).toBeNull();
    expect(findBannedWord('fallasteis', 'es', 'learner')).toBeNull();
  });

  it('accented letters never split a token', () => {
    // "perdiste" must not be found inside "perdiste" + accented tail, and an
    // accented neighbour must not make a boundary.
    expect(findBannedWord('perdistéis', 'es', 'learner')).toBeNull();
    expect(findBannedWord('éperdiste', 'es', 'learner')).toBeNull();
    expect(findBannedWord('(perdiste)', 'es', 'learner')).toBe('perdiste');
    expect(findBannedWord('canción: fallido.', 'es', 'learner')).toBe('fallido');
  });

  it('caregiver additions', () => {
    expect(findBannedWord('va retrasado', 'es', 'learner')).toBeNull();
    expect(findBannedWord('va retrasado', 'es', 'caregiver')).toBe('retrasado');
    expect(findBannedWord('muy flojo', 'es', 'caregiver')).toBe('flojo');
  });
});

describe('findBannedWord (ko): substring matching', () => {
  it('particles and endings attach to the stem', () => {
    expect(findBannedWord('실패했어요', 'ko', 'learner')).toBe('실패');
    expect(findBannedWord('숙제가 밀린 날', 'ko', 'learner')).toBe('밀린');
    expect(findBannedWord('미완료입니다', 'ko', 'learner')).toBe('미완료');
  });

  it('multi-word entries match as a phrase', () => {
    expect(findBannedWord('기한 초과', 'ko', 'learner')).toBe('기한 초과');
    expect(findBannedWord('기한', 'ko', 'learner')).toBeNull();
  });

  it('caregiver additions', () => {
    expect(findBannedWord('뒤처지고 있어요', 'ko', 'learner')).toBeNull();
    expect(findBannedWord('뒤처지고 있어요', 'ko', 'caregiver')).toBe('뒤처');
    expect(findBannedWord('게으른 하루', 'ko', 'caregiver')).toBe('게으른');
  });

  it('clean Korean copy passes', () => {
    expect(findBannedWord('잘했어요! 계속 해 봐요', 'ko', 'caregiver')).toBeNull();
  });
});

describe('isCopySafe and scanCopy', () => {
  it('isCopySafe mirrors findBannedWord', () => {
    expect(isCopySafe('Nice job', 'en', 'learner')).toBe(true);
    expect(isCopySafe('You failed', 'en', 'learner')).toBe(false);
  });

  it('scanCopy returns each banned word once, across all strings', () => {
    expect(scanCopy(['a missed b', 'ok', 'missed again', 'so overdue'], 'en', 'learner')).toEqual([
      'missed',
      'overdue',
    ]);
    expect(scanCopy([], 'es', 'learner')).toEqual([]);
    expect(scanCopy(['todo bien'], 'es', 'caregiver')).toEqual([]);
  });
});
