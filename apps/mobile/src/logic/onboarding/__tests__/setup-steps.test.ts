import { describe, expect, it } from 'vitest';
import type { FormState } from '../create-profile-form';
import {
  canChooseWho,
  nextStep,
  previousStep,
  profileVoice,
  setupSteps,
  stepMissing,
  stepPosition,
  switchToGrownUp,
  systemBack,
} from '../setup-steps';

/** F-LEARN-001 §3.15: Who is learning, Profile and Privacy as steps of one form. */
const fresh: FormState = {
  learnerType: null,
  name: '',
  email: '',
  agreed: false,
  pin: null,
  guardianAcceptedAt: null,
  selfAcceptedAt: null,
  parentPinHash: null,
};
const STAMP = '2026-10-14T00:00:00.000Z';
/** A device that already has the guardian consent and a PIN (adding a child there needs no Privacy step). */
const family = { guardianAcceptedAt: STAMP, parentPinHash: 'salt:hash' } as const;

describe('setupSteps: which steps this answer needs', () => {
  it('is only the question before an answer (L4)', () => {
    expect(setupSteps(fresh)).toEqual(['who']);
  });

  it('a fresh install always has the Privacy step, for either answer', () => {
    expect(setupSteps({ ...fresh, learnerType: 'self' })).toEqual(['who', 'profile', 'privacy']);
    expect(setupSteps({ ...fresh, learnerType: 'child' })).toEqual(['who', 'profile', 'privacy']);
  });

  it('adding a profile on a device that already has what the answer needs skips Privacy', () => {
    expect(setupSteps({ ...fresh, ...family, learnerType: 'child' })).toEqual(['who', 'profile']);
    expect(setupSteps({ ...fresh, selfAcceptedAt: STAMP, learnerType: 'self' })).toEqual(['who', 'profile']);
    expect(setupSteps({ ...fresh, guardianAcceptedAt: STAMP, learnerType: 'self' })).toEqual(['who', 'profile']);
  });

  it('a self-only device gaining a child brings the Privacy step (grown-up card, mandatory PIN)', () => {
    expect(setupSteps({ ...fresh, selfAcceptedAt: STAMP, learnerType: 'child' })).toEqual(['who', 'profile', 'privacy']);
  });
});

describe('stepPosition: the "Step n of N" caption', () => {
  it('counts three before an answer and on a fresh install', () => {
    expect(stepPosition('who', fresh)).toEqual({ n: 1, total: 3 });
    expect(stepPosition('profile', { ...fresh, learnerType: 'self' })).toEqual({ n: 2, total: 3 });
    expect(stepPosition('privacy', { ...fresh, learnerType: 'child' })).toEqual({ n: 3, total: 3 });
  });

  it('counts two when Privacy is skipped', () => {
    expect(stepPosition('who', { ...fresh, ...family, learnerType: 'child' })).toEqual({ n: 1, total: 2 });
    expect(stepPosition('profile', { ...fresh, ...family, learnerType: 'child' })).toEqual({ n: 2, total: 2 });
  });
});

describe('stepMissing: only the step\'s own gaps, in caption order', () => {
  it('step 1 needs an answer, nothing else', () => {
    expect(stepMissing('who', fresh)).toBe('who');
    expect(stepMissing('who', { ...fresh, learnerType: 'self' })).toBeNull();
  });

  it('step 2 needs a name the profile rules accept, never the consent', () => {
    const self = { ...fresh, learnerType: 'self' as const };
    expect(stepMissing('profile', self)).toBe('name');
    expect(stepMissing('profile', { ...self, name: 'x'.repeat(13) })).toBe('name');
    expect(stepMissing('profile', { ...self, name: 'Andrés' })).toBeNull();
    expect(stepMissing('profile', { ...self, name: '수니' })).toBeNull();
  });

  it('step 2 also asks for an answer when it is reached without one', () => {
    expect(stepMissing('profile', { ...fresh, name: 'Sam' })).toBe('who');
  });

  it('step 3 on "Me": the box, then a valid email when one is typed; no PIN needed', () => {
    const self = { ...fresh, learnerType: 'self' as const, name: 'Sam' };
    expect(stepMissing('privacy', self)).toBe('agree');
    expect(stepMissing('privacy', { ...self, agreed: true })).toBeNull();
    expect(stepMissing('privacy', { ...self, agreed: true, email: 'nope' })).toBe('email');
  });

  it('step 3 for someone looked after: the box, then the PIN, then the email', () => {
    const child = { ...fresh, learnerType: 'child' as const, name: 'Sam' };
    expect(stepMissing('privacy', child)).toBe('agree');
    expect(stepMissing('privacy', { ...child, agreed: true })).toBe('pin');
    expect(stepMissing('privacy', { ...child, agreed: true, pin: '1234', email: 'nope' })).toBe('email');
    expect(stepMissing('privacy', { ...child, agreed: true, pin: '1234' })).toBeNull();
  });

  it('step 3 still reports an earlier gap, so the last Continue never submits an incomplete form', () => {
    expect(stepMissing('privacy', { ...fresh, learnerType: 'self', agreed: true })).toBe('name');
  });
});

describe('nextStep and previousStep', () => {
  it('walks who, profile, privacy, then submits', () => {
    const s = { ...fresh, learnerType: 'self' as const, name: 'Sam' };
    expect(nextStep('who', s)).toBe('profile');
    expect(nextStep('profile', s)).toBe('privacy');
    expect(nextStep('privacy', s)).toBe('submit');
  });

  it('submits from the profile step when Privacy is skipped', () => {
    expect(nextStep('profile', { ...fresh, ...family, learnerType: 'child', name: 'Sam' })).toBe('submit');
  });

  it('stays on the question while it has no answer', () => {
    expect(nextStep('who', fresh)).toBe('who');
  });

  it('goes back one step, and leaves from the question', () => {
    expect(previousStep('privacy')).toBe('profile');
    expect(previousStep('profile')).toBe('who');
    expect(previousStep('who')).toBe('leave');
  });
});

describe('switchToGrownUp: "I\'m under 13" on the Privacy step', () => {
  const me: FormState = { ...fresh, learnerType: 'self', name: 'Sam', email: 'sam@example.com', agreed: true, pin: '4321' };

  it('makes the learner someone looked after and clears the box and any PIN', () => {
    const next = switchToGrownUp(me);
    expect(next.learnerType).toBe('child');
    expect(next.agreed).toBe(false);
    expect(next.pin).toBeNull();
  });

  it('keeps the name and what the device holds, and clears the email the learner typed', () => {
    const next = switchToGrownUp({ ...me, parentPinHash: null });
    expect(next.name).toBe('Sam');
    // Typed by the learner before the statement: never carried over as the grown-up's address.
    expect(next.email).toBe('');
    expect(next.guardianAcceptedAt).toBeNull();
    expect(next.selfAcceptedAt).toBeNull();
  });

  it('keeps the Privacy step, now with the guardian consent and a mandatory PIN', () => {
    const next = switchToGrownUp(me);
    expect(setupSteps(next)).toEqual(['who', 'profile', 'privacy']);
    expect(stepMissing('privacy', next)).toBe('agree');
    expect(stepMissing('privacy', { ...next, agreed: true })).toBe('pin');
    expect(nextStep('privacy', next)).toBe('submit');
  });

  it('does not touch the input', () => {
    switchToGrownUp(me);
    expect(me.learnerType).toBe('self');
    expect(me.agreed).toBe(true);
  });
});

describe('canChooseWho and profileVoice: the under-13 statement is latched for the form', () => {
  it('every answer is open before "I\'m under 13"', () => {
    expect(canChooseWho('self', false)).toBe(true);
    expect(canChooseWho('child', false)).toBe(true);
  });

  it('after it, "Me" stays closed so Back cannot bring the "13 or older" box again', () => {
    expect(canChooseWho('self', true)).toBe(false);
    expect(canChooseWho('child', true)).toBe(true);
  });

  it('a latched form still reaches Privacy with the grown-up card after Back and Continue', () => {
    const switched = switchToGrownUp({ ...fresh, learnerType: 'self', name: 'Sam' });
    expect(previousStep('privacy')).toBe('profile');
    expect(previousStep('profile')).toBe('who');
    expect(canChooseWho('self', true)).toBe(false);
    expect(nextStep('who', switched)).toBe('profile');
    expect(nextStep('profile', switched)).toBe('privacy');
    expect(stepMissing('privacy', switched)).toBe('agree');
  });

  it('the profile step keeps the first person for the learner who switched', () => {
    expect(profileVoice('child', true)).toBe('self');
    expect(profileVoice('child', false)).toBe('child');
    expect(profileVoice('self', false)).toBe('self');
  });
});

describe('systemBack: the Android back on each step', () => {
  it('leaves from the question', () => {
    expect(systemBack('who', 'GO_BACK')).toBe('leave');
    expect(systemBack('who', 'POP')).toBe('leave');
  });

  it('opens the previous step past the question', () => {
    expect(systemBack('privacy', 'GO_BACK')).toBe('profile');
    expect(systemBack('profile', 'POP')).toBe('who');
    expect(systemBack('privacy', 'POP_TO_TOP')).toBe('profile');
  });

  it('lets an action that is not a back through untouched', () => {
    expect(systemBack('privacy', 'REPLACE')).toBe('ignore');
    expect(systemBack('profile', 'NAVIGATE')).toBe('ignore');
    expect(systemBack('who', 'RESET')).toBe('ignore');
  });
});
