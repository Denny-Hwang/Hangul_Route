import { LOCALES, findBannedWord, getMessages, type Messages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { cleanJoinCode, isCodeError, isCompleteJoinCode, joinErrorMessage, joinPrefill, type JoinErrorCode } from '../join-code';

const ALL: JoinErrorCode[] = ['code_not_found', 'code_expired', 'cap_learner', 'cap_class', 'not_joinable', 'learner_not_found', 'already_bound', 'too_many_attempts', 'network', 'invalid', 'unknown', 'off'];
const m = getMessages('en').caregiver;

describe('join code helpers (F-SPACE-001 §3.5)', () => {
  it('cleans keystrokes to the alphabet, upper case, six characters', () => {
    expect(cleanJoinCode('k7m-2x 9')).toBe('K7M2X9');
    expect(cleanJoinCode('k7m2xo1i0')).toBe('K7M2X'); // O, 1, I, 0 are never accepted
    expect(cleanJoinCode('abcdefghjk')).toBe('ABCDEF');
    expect(isCompleteJoinCode('K7M2X9')).toBe(true);
    expect(isCompleteJoinCode('K7M2X')).toBe(false);
  });

  it('has calm copy for every error and tells code errors apart', () => {
    for (const c of ALL) {
      expect(joinErrorMessage(c, m).length).toBeGreaterThan(10);
      expect(joinErrorMessage(c, m)).not.toMatch(/wrong code|failed|error/i);
    }
    expect(isCodeError('code_expired')).toBe(true);
    expect(isCodeError('cap_learner')).toBe(false);
  });

  it('keeps the English wording of every error', () => {
    expect(ALL.map((c) => joinErrorMessage(c, m))).toEqual([
      "That code didn't work. Check it with your teacher.",
      'That code is too old. Ask for a new one.',
      "You're already in three classes. Leave one under Classes & family in your Profile first.",
      'This class is full. Ask your teacher.',
      "That code isn't for joining as a learner. Ask for a class code.",
      'That name is not in this class anymore. Ask your teacher.',
      'This device already has that learner — switch profiles instead.',
      "Let's wait a few minutes before trying again.",
      'This needs internet. Try again when you are online.',
      'A code has 6 letters or numbers.',
      'Something went wrong. Try again in a moment.',
      'Joining a class is not set up on this build.',
    ]);
  });

  it('names the fix without a grown-up (F-LEARN-001 §3.9): leave a class in Settings, ask for a class code', () => {
    expect(joinErrorMessage('cap_learner', m)).toBe(m.audience.shared.joinCodeFull);
    expect(joinErrorMessage('not_joinable', m)).toBe(m.audience.shared.joinCodeNotForLearners);
    for (const c of ['cap_learner', 'not_joinable'] as const) expect(joinErrorMessage(c, m)).not.toMatch(/grown-?up/i);
  });
});

describe('joinErrorMessage takes its words from the message subtree (F-I18N-001 §3.4 rule 3)', () => {
  it('reads the join errors, the shared retry lines and the audience lines it is given', () => {
    const other: Pick<Messages['caregiver'], 'join' | 'retry' | 'audience'> = {
      ...m,
      join: { ...m.join, errors: { ...m.join.errors, codeNotFound: 'Ese codigo no.', off: 'Apagado.' } },
      retry: { tooManyAttempts: 'Espera.', offline: 'Sin internet.', unknown: 'Otra vez.' },
      audience: { ...m.audience, shared: { ...m.audience.shared, joinCodeFull: 'Ya tienes tres.' } },
    };
    expect(joinErrorMessage('code_not_found', other)).toBe('Ese codigo no.');
    expect(joinErrorMessage('off', other)).toBe('Apagado.');
    expect(joinErrorMessage('too_many_attempts', other)).toBe('Espera.');
    expect(joinErrorMessage('network', other)).toBe('Sin internet.');
    expect(joinErrorMessage('unknown', other)).toBe('Otra vez.');
    expect(joinErrorMessage('cap_learner', other)).toBe('Ya tienes tres.');
  });

  for (const locale of LOCALES) {
    it(`${locale}: every error is non-empty and free of shaming words`, () => {
      const caregiver = getMessages(locale).caregiver;
      for (const c of ALL) {
        const line = joinErrorMessage(c, caregiver);
        expect(line.trim().length).toBeGreaterThan(0);
        expect(findBannedWord(line, locale, 'learner'), `${locale}.${c}`).toBeNull();
      }
    });
  }
});

describe('joinPrefill (the class join link, owner decision 2026-10-17)', () => {
  it('the link code wins over the family home hand-off', () => {
    expect(joinPrefill('ABC234', 'XYZ789')).toBe('ABC234');
  });

  it('falls back to the hand-off, then to nothing', () => {
    expect(joinPrefill(undefined, 'XYZ789')).toBe('XYZ789');
    expect(joinPrefill(undefined, null)).toBeNull();
  });

  it('cleans what it is given as typed keys are; a value with nothing usable is skipped', () => {
    expect(joinPrefill('abc-234', null)).toBe('ABC234');
    expect(joinPrefill('!!!', 'XYZ789')).toBe('XYZ789');
    expect(joinPrefill('', null)).toBeNull();
  });
});
