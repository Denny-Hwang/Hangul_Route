import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import {
  formPlan,
  missingStep,
  nameHint,
  type FormState,
} from '../create-profile-form';

const base: FormState = {
  learnerType: 'child',
  name: 'Mina',
  email: '',
  agreed: true,
  pin: '1234',
  guardianAcceptedAt: null,
  selfAcceptedAt: null,
  parentPinHash: null,
};

describe('formPlan: which card, which fields (F-LEARN-001 §3.3)', () => {
  it('draws nothing until someone says who is learning (L4)', () => {
    expect(formPlan({ ...base, learnerType: null })).toBeNull();
  });

  it('child on a fresh device: grown-up card with consent, email and a required PIN', () => {
    expect(formPlan(base)).toEqual({
      card: 'guardian',
      consent: 'guardian',
      pinRequired: true,
      pinOptional: false,
      showEmail: true,
    });
  });

  it('child on a device with guardian consent and no PIN: card with the PIN only', () => {
    expect(formPlan({ ...base, guardianAcceptedAt: '2026-10-10T00:00:00.000Z' })).toEqual({
      card: 'guardian',
      consent: null,
      pinRequired: true,
      pinOptional: false,
      showEmail: false,
    });
  });

  it('child on a family device that already has consent and a PIN: no card', () => {
    expect(
      formPlan({ ...base, guardianAcceptedAt: '2026-10-10T00:00:00.000Z', parentPinHash: 'salt:hash' }),
    ).toEqual({ card: null, consent: null, pinRequired: false, pinOptional: false, showEmail: false });
  });

  it('child on a device with a PIN but no guardian consent (a self-only device gaining a child): consent, no new PIN', () => {
    expect(
      formPlan({ ...base, selfAcceptedAt: '2026-10-10T00:00:00.000Z', parentPinHash: 'salt:hash' }),
    ).toEqual({ card: 'guardian', consent: 'guardian', pinRequired: false, pinOptional: false, showEmail: true });
  });

  it('self on a fresh device: agreement card with an optional PIN', () => {
    expect(formPlan({ ...base, learnerType: 'self' })).toEqual({
      card: 'self',
      consent: 'self',
      pinRequired: false,
      pinOptional: true,
      showEmail: true,
    });
  });

  it('self on a device that already has any consent: no card', () => {
    expect(formPlan({ ...base, learnerType: 'self', guardianAcceptedAt: '2026-10-10T00:00:00.000Z' })).toEqual({
      card: null,
      consent: null,
      pinRequired: false,
      pinOptional: false,
      showEmail: false,
    });
    expect(formPlan({ ...base, learnerType: 'self', selfAcceptedAt: '2026-10-10T00:00:00.000Z' })?.card).toBeNull();
  });
});

describe('missingStep: what the disabled Continue names (UX-27)', () => {
  it('names the steps in order: who, name, agree box, PIN', () => {
    expect(missingStep({ ...base, learnerType: null, name: '', agreed: false, pin: null })).toBe('who');
    expect(missingStep({ ...base, name: '', agreed: false, pin: null })).toBe('name');
    expect(missingStep({ ...base, agreed: false, pin: null })).toBe('agree');
    expect(missingStep({ ...base, pin: null })).toBe('pin');
    expect(missingStep(base)).toBeNull();
  });

  it('treats an invalid name as missing, and a name the rule rejects the same way', () => {
    expect(missingStep({ ...base, name: '   ' })).toBe('name');
    expect(missingStep({ ...base, name: 'A very long name indeed' })).toBe('name');
    expect(missingStep({ ...base, name: 'Mina :)' })).toBe('name');
  });

  it('accepts an accented name and a Hangul name (F-I18N-001 §3.9)', () => {
    expect(missingStep({ ...base, name: 'Andrés' })).toBeNull();
    expect(missingStep({ ...base, name: '수니' })).toBeNull();
  });

  it('does not ask for the box or the PIN when the plan does not need them', () => {
    const device = { guardianAcceptedAt: '2026-10-10T00:00:00.000Z', parentPinHash: 'salt:hash' };
    expect(missingStep({ ...base, ...device, agreed: false, pin: null })).toBeNull();
  });

  it('never asks for the optional PIN of a self learner', () => {
    expect(missingStep({ ...base, learnerType: 'self', pin: null })).toBeNull();
    expect(missingStep({ ...base, learnerType: 'self', agreed: false, pin: null })).toBe('agree');
  });

  it('flags an email that does not look right, last', () => {
    expect(missingStep({ ...base, email: 'nope' })).toBe('email');
    expect(missingStep({ ...base, email: 'mom@example.com' })).toBeNull();
    expect(missingStep({ ...base, email: '  ' })).toBeNull();
    expect(missingStep({ ...base, email: 'nope', pin: null })).toBe('pin');
  });

  it('ignores an email the plan does not show a field for', () => {
    const device = { guardianAcceptedAt: '2026-10-10T00:00:00.000Z', parentPinHash: 'salt:hash' };
    expect(missingStep({ ...base, ...device, email: 'nope' })).toBeNull();
  });

  it('has the five captions the spec names, calm and in order (dictionary learner.createProfile.missing)', () => {
    expect(getMessages('en').learner.createProfile.missing).toEqual({
      who: 'Choose who is learning',
      name: 'Type a name',
      agree: 'Tick the box to agree',
      pin: 'Create the PIN',
      email: 'Check the email, or leave it empty',
    });
  });
});

describe('nameHint: calm, never on an unfinished field', () => {
  const words = getMessages('en').learner.createProfile.nameHint;

  it('is silent for an empty or valid name', () => {
    expect(nameHint('', words)).toBeNull();
    expect(nameHint('Mina', words)).toBeNull();
  });

  it('explains a long name and an unsupported character', () => {
    expect(nameHint('Abcdefghijklmn', words)).toBe('Names can be up to 12 letters.');
    expect(nameHint('Mina :)', words)).toBe("Please use letters, numbers, spaces, ' or -.");
  });

  it('writes the hint in the words it is given (the sentence is not in the logic)', () => {
    const other = { tooLong: (max: number) => `max ${max}`, unsupportedCharacter: 'chars' };
    expect(nameHint('Abcdefghijklmn', other)).toBe('max 12');
    expect(nameHint('Mina :)', other)).toBe('chars');
  });
});
