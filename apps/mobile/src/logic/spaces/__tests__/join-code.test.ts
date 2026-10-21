import { LOCALES, findBannedWord, getMessages, type Messages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { FAMILY_LIFETIME_LEARNERS } from '@hangul-route/content-schema';
import { CODE_GLYPH_EM, cleanJoinCode, codeFieldFontSize, isCodeError, isCompleteJoinCode, joinErrorMessage, joinPrefill, lookupRefusal, type JoinErrorCode } from '../join-code';

const ALL: JoinErrorCode[] = ['code_not_found', 'code_expired', 'cap_learner', 'cap_class', 'cap_family', 'cap_school', 'not_joinable', 'learner_not_found', 'already_bound', 'too_many_attempts', 'network', 'invalid', 'unknown', 'off'];
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
      'This family already has 4 learners. Ask a grown-up in your family.',
      'This school is full right now. Ask your teacher.',
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

describe('[SA] learner caps at the join (AMENDMENTS-SEATS-ADMINS section 3.4)', () => {
  it('a full family reads familyFull with the cap the Worker sent, never the class or three-classes line', () => {
    expect(joinErrorMessage('cap_family', m, 4)).toBe(m.join.errors.familyFull(4));
    expect(joinErrorMessage('cap_family', m, 6)).toBe('This family already has 6 learners. Ask a grown-up in your family.');
    expect(joinErrorMessage('cap_family', m, 4)).not.toBe(m.join.errors.classFull);
    expect(joinErrorMessage('cap_family', m, 4)).not.toBe(m.audience.shared.joinCodeFull);
  });

  it('without a cap from the Worker, the family line reads FAMILY_LIFETIME_LEARNERS', () => {
    expect(FAMILY_LIFETIME_LEARNERS).toBe(4);
    expect(joinErrorMessage('cap_family', m)).toBe(m.join.errors.familyFull(FAMILY_LIFETIME_LEARNERS));
    expect(joinErrorMessage('cap_family', m, null)).toBe(m.join.errors.familyFull(FAMILY_LIFETIME_LEARNERS));
    // A cap below 2 is not a family cap (the line counts learners in the plural): it reads as absent.
    for (const cap of [0, 1, -1]) expect(joinErrorMessage('cap_family', m, cap)).toBe(m.join.errors.familyFull(FAMILY_LIFETIME_LEARNERS));
  });

  it('a full school reads schoolFull and a full class classFull; neither is a code error', () => {
    expect(joinErrorMessage('cap_school', m, 50)).toBe(m.join.errors.schoolFull);
    expect(joinErrorMessage('cap_class', m, 50)).toBe(m.join.errors.classFull);
    for (const c of ['cap_family', 'cap_school'] as const) expect(isCodeError(c)).toBe(false);
  });

  it('the lookup line comes from seat.reason, not from the kind of space', () => {
    const family = { kind: 'family' as const, full: false };
    expect(lookupRefusal({ ...family, seat: { full: true, reason: 'cap_family', cap: 4 } })).toEqual({ code: 'cap_family', cap: 4 });
    expect(lookupRefusal({ kind: 'class', full: false, seat: { full: true, reason: 'cap_school', cap: 50 } })).toEqual({ code: 'cap_school', cap: 50 });
    expect(lookupRefusal({ kind: 'class', full: false, seat: { full: true, reason: 'cap_class', cap: 20 } })).toEqual({ code: 'cap_class', cap: 20 });
    // A seat with no reason (never sent by the Worker) falls back to the space's own cap.
    expect(lookupRefusal({ ...family, seat: { full: true, reason: null, cap: null } })).toEqual({ code: 'cap_family', cap: null });
    expect(lookupRefusal({ kind: 'class', full: false, seat: { full: true, reason: null, cap: null } })).toEqual({ code: 'cap_class', cap: null });
  });

  it('a returning family member and a sibling-class learner at a full school find room (seat.full false)', () => {
    // The Worker answers seat.full false for a learner the device vouches for who already holds the seat.
    expect(lookupRefusal({ kind: 'family', full: false, seat: { full: false, reason: null, cap: 4 } })).toBeNull();
    expect(lookupRefusal({ kind: 'class', full: false, seat: { full: false, reason: null, cap: 50 } })).toBeNull();
    // seat wins over full, so an old full: true never blocks a learner the seat lets in.
    expect(lookupRefusal({ kind: 'class', full: true, seat: { full: false, reason: null, cap: null } })).toBeNull();
  });

  it('an old-shape lookup (no seat) still works from full: the class line, as before', () => {
    expect(lookupRefusal({ kind: 'class', full: true, seat: null })).toEqual({ code: 'cap_class', cap: null });
    expect(lookupRefusal({ kind: 'class', full: false, seat: null })).toBeNull();
    expect(lookupRefusal({ kind: 'family', full: false, seat: null })).toBeNull();
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

describe('codeFieldFontSize: the code field fits a whole code at every text size (AMENDMENTS-DISPLAY-NAV section 4, DN-3b review)', () => {
  it('keeps the display size while it fits, and never draws larger than the text size asks', () => {
    // Standard on a 375 phone: 36 px and room to spare.
    expect(codeFieldFontSize(36, 339, 8)).toBe(36);
    expect(codeFieldFontSize(45, 1000, 8)).toBe(45);
  });

  it('at Largest on a 320 phone the widest code still fits its field', () => {
    const inner = 280;
    const size = codeFieldFontSize(45, inner, 8);
    expect(size).toBeLessThan(45);
    // Six of the widest letter (one em each) and their letter spacing fit inside the field.
    expect(6 * size * CODE_GLYPH_EM + 6 * 8).toBeLessThanOrEqual(inner);
    expect(6 * (size + 1) * CODE_GLYPH_EM + 6 * 8).toBeGreaterThan(inner);
  });

  it('before the field is laid out the display size stands; it never reaches zero', () => {
    expect(codeFieldFontSize(45, 0, 8)).toBe(45);
    expect(codeFieldFontSize(45, Number.NaN, 8)).toBe(45);
    expect(codeFieldFontSize(45, 10, 8)).toBe(1);
  });
});
