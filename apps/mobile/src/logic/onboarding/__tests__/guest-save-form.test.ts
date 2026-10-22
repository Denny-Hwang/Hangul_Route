import { GUEST_TELEMETRY_PAYLOADS, ONBOARDING_TELEMETRY_PAYLOADS, type Profile } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it, vi } from 'vitest';
import { promotionPlan } from '../../guest/guest-model';
import { lessonsLine } from '../create-profile-copy';
import { emailFieldShown, formPlan, missingStep, toggleEmailRow, type FormState } from '../create-profile-form';
import { guestSaved, onboardingStarted } from '../onboarding-events';
import { canChooseWho, nextStep, previousStep, setupSteps, stepMissing, stepPosition, switchToGrownUp, systemBack } from '../setup-steps';
import { submitProfile, type SubmitDeps } from '../submit-profile';

/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON sections 5.4, 8.3, 8.5 and 12, CS-G8, CS-G10 (row GU-4, section 19): the save
 * after the first quest as the CreateProfile form's guest variant (`FormState.fromGuest`): two steps, the folded
 * email, `lessons.plain` under the who cards, no PIN part where a PIN is stored, and the submit that ends in
 * `promoteGuest` with `onboarding.started.fromGuest` and `guest.saved`.
 */
const STAMP = '2026-10-22T00:00:00.000Z';
const guest: FormState = {
  learnerType: null,
  name: '',
  email: '',
  agreed: false,
  pin: null,
  guardianAcceptedAt: null,
  selfAcceptedAt: null,
  parentPinHash: null,
  fromGuest: true,
};
const en = getMessages('en').learner.createProfile;

describe('setupSteps, guest variant (8.3)', () => {
  it('is always two steps, the name then Privacy, before and after an answer and whatever the device holds', () => {
    expect(setupSteps(guest)).toEqual(['name', 'privacy']);
    expect(setupSteps({ ...guest, learnerType: 'self' })).toEqual(['name', 'privacy']);
    expect(setupSteps({ ...guest, learnerType: 'child', guardianAcceptedAt: STAMP, parentPinHash: 'salt:hash' })).toEqual(['name', 'privacy']);
    // Today's form is unchanged.
    expect(setupSteps({ ...guest, fromGuest: undefined })).toEqual(['who']);
  });

  it('"Step 1 of 2" and "Step 2 of 2"', () => {
    expect(stepPosition('name', guest)).toEqual({ n: 1, total: 2 });
    expect(stepPosition('privacy', { ...guest, learnerType: 'child' })).toEqual({ n: 2, total: 2 });
  });

  it('step 1 needs a valid name only; who is learning is the Privacy step\'s', () => {
    expect(stepMissing('name', guest)).toBe('name');
    expect(stepMissing('name', { ...guest, name: 'Sam' })).toBeNull();
    expect(stepMissing('privacy', { ...guest, name: 'Sam' })).toBe('who');
    expect(stepMissing('privacy', { ...guest, name: 'Sam', learnerType: 'self' })).toBe('agree');
    expect(stepMissing('privacy', { ...guest, name: 'Sam', learnerType: 'self', agreed: true })).toBeNull();
    // A child on a device with no PIN: the grown-up card's PIN.
    expect(stepMissing('privacy', { ...guest, name: 'Sam', learnerType: 'child', agreed: true })).toBe('pin');
  });

  it('Continue: name to Privacy (even before the answer), then the submit', () => {
    expect(nextStep('name', guest)).toBe('privacy');
    expect(nextStep('privacy', guest)).toBe('submit');
    expect(nextStep('privacy', { ...guest, learnerType: 'child' })).toBe('submit');
  });

  it('Back on step 1 leaves (the save card); Back on step 2 opens step 1; only a back does', () => {
    expect(previousStep('name', true)).toBe('leave');
    expect(previousStep('privacy', true)).toBe('name');
    expect(systemBack('privacy', 'GO_BACK', true)).toBe('name');
    expect(systemBack('name', 'POP', true)).toBe('leave');
    expect(systemBack('privacy', 'RESET', true)).toBe('ignore');
    // Today's form is unchanged.
    expect(previousStep('privacy')).toBe('profile');
  });

  it('the under-13 latch holds for the form\'s life: the answer becomes someone looked after and "Me" stays closed', () => {
    const switched = switchToGrownUp({ ...guest, name: 'Sam', learnerType: 'self', agreed: true, email: 'sam@example.com' });
    expect(switched).toMatchObject({ learnerType: 'child', agreed: false, email: '', name: 'Sam', fromGuest: true });
    expect(canChooseWho('self', true)).toBe(false);
    expect(canChooseWho('child', true)).toBe(true);
    expect(missingStep({ ...switched, agreed: true })).toBe('pin');
  });
});

describe('formPlan, guest variant: PIN parts by case (CS-G10)', () => {
  it('case open (no profile, no PIN): section 3.15\'s PIN parts, as on an empty device', () => {
    expect(formPlan({ ...guest, learnerType: 'self' })).toMatchObject({ card: 'self', pinOptional: true, pinRequired: false });
    expect(formPlan({ ...guest, learnerType: 'child' })).toMatchObject({ card: 'guardian', pinRequired: true });
  });

  it('after a verify (a PIN is stored): no PIN part at all', () => {
    const pinned = { ...guest, parentPinHash: 'salt:hash' };
    expect(formPlan({ ...pinned, learnerType: 'self' })).toMatchObject({ card: 'self', pinOptional: false, pinRequired: false });
    expect(formPlan({ ...pinned, learnerType: 'child' })).toMatchObject({ card: 'guardian', pinOptional: false, pinRequired: false });
    // The shipped plan still offers the optional row there (Add a profile on a device with a PIN).
    expect(formPlan({ ...pinned, fromGuest: undefined, learnerType: 'self' })).toMatchObject({ pinOptional: true });
  });

  it('consent already held: no card, so step 2 is the who cards and Ready only', () => {
    expect(formPlan({ ...guest, learnerType: 'child', guardianAcceptedAt: STAMP, parentPinHash: 'salt:hash' })).toMatchObject({ card: null, consent: null, showEmail: false });
    expect(formPlan({ ...guest, learnerType: 'self', selfAcceptedAt: STAMP })).toMatchObject({ card: null, showEmail: false });
  });

  it('nothing is preselected (L4): no plan before an answer', () => {
    expect(formPlan(guest)).toBeNull();
  });
});

describe('the folded email (8.3, CS-G8)', () => {
  it('opening keeps what the field held; closing clears what was typed', () => {
    expect(toggleEmailRow({ open: false, email: '' })).toEqual({ open: true, email: '' });
    expect(toggleEmailRow({ open: true, email: 'sam@example.com' })).toEqual({ open: false, email: '' });
  });

  it('the field shows on the guest\'s save only while the row is open, and only where the plan has an email', () => {
    const plan = formPlan({ ...guest, learnerType: 'self' });
    expect(emailFieldShown(plan, true, false)).toBe(false);
    expect(emailFieldShown(plan, true, true)).toBe(true);
    expect(emailFieldShown(plan, false, false)).toBe(true);
    expect(emailFieldShown(formPlan({ ...guest, learnerType: 'self', selfAcceptedAt: STAMP }), true, true)).toBe(false);
    expect(emailFieldShown(null, true, true)).toBe(false);
  });
});

describe('the line under the who cards (8.3)', () => {
  it('is always lessons.plain on the guest\'s save, even with the level check on', () => {
    expect(lessonsLine(en, true, true)).toBe(en.lessons.plain);
    expect(lessonsLine(en, false, true)).toBe(en.lessons.plain);
    // Today's form names the check when it is on.
    expect(lessonsLine(en, true)).toBe(en.lessons.withCheck);
  });
});

describe('guest telemetry builders (section 12)', () => {
  it('onboarding.started gains fromGuest only on a guest\'s save; guest.saved carries codes only', () => {
    const started = onboardingStarted('8-9', true, false, true);
    expect(started.payload).toEqual({ level: '8-9', firstRun: true, hasEmail: false, fromGuest: true });
    expect(ONBOARDING_TELEMETRY_PAYLOADS['onboarding.started'].safeParse(started.payload).success).toBe(true);
    expect(onboardingStarted('8-9', true, false).payload).toEqual({ level: '8-9', firstRun: true, hasEmail: false });
    const saved = guestSaved(true, 'new', 'results');
    expect(saved).toEqual({ name: 'guest.saved', payload: { gated: true, consent: 'new', via: 'results' } });
    expect(GUEST_TELEMETRY_PAYLOADS['guest.saved'].safeParse(saved.payload).success).toBe(true);
  });
});

function deps(overrides: Partial<SubmitDeps> = {}) {
  const calls: string[] = [];
  const events: Array<{ name: string; profileId?: string; payload?: Record<string, unknown> }> = [];
  const profile = { id: 'profile:guest001' } as Profile;
  const d: SubmitDeps = {
    hashPin: vi.fn(async (pin: string) => {
      calls.push('hash');
      return `hashed:${pin}`;
    }),
    acceptGuardianConsent: vi.fn(() => void calls.push('guardian')),
    acceptSelfConsent: vi.fn(() => void calls.push('self')),
    setParentPinHash: vi.fn((h: string) => void calls.push(`pin:${h}`)),
    setParentEmail: vi.fn((e: string) => void calls.push(`email:${e}`)),
    createProfile: vi.fn(async () => {
      calls.push('promote');
      return profile;
    }),
    track: vi.fn((e) => void events.push(e)),
    ...overrides,
  };
  return { d, calls, events, profile };
}

describe('submitProfile on a guest\'s save (sections 5.4 and 8.3)', () => {
  it('F-LEARN-001 section 3.3\'s order, then the promotion; events: consent, PIN, onboarding.started { fromGuest }, guest.saved last', async () => {
    const { d, calls, events } = deps();
    const state: FormState = { ...guest, learnerType: 'child', name: ' Sam ', agreed: true, pin: '1234', email: 'g@example.com' };
    const result = await submitProfile({ state, level: '8-9', avatar: 'hoya-orange', firstRun: true, guest: { gated: false, via: 'results' } }, d);
    expect(result.ok).toBe(true);
    expect(calls).toEqual(['hash', 'guardian', 'pin:hashed:1234', 'email:g@example.com', 'promote']);
    expect(d.createProfile).toHaveBeenCalledWith({ displayName: 'Sam', ageGroup: '8-9', avatar: 'hoya-orange', learnerType: 'child' });
    expect(events.map((e) => e.name)).toEqual(['onboarding.consent_given', 'pin.created', 'onboarding.started', 'guest.saved']);
    expect(events[2]!.payload).toMatchObject({ firstRun: true, fromGuest: true, hasEmail: true });
    // guest.saved: no id (the Worker drops one anyway), never learnerType.
    expect(events[3]).toEqual({ name: 'guest.saved', payload: { gated: false, consent: 'new', via: 'results' } });
  });

  it('consent already held: consent "existing", no consent event; a verify is gated', async () => {
    const { d, events } = deps();
    const state: FormState = { ...guest, learnerType: 'child', name: 'Sam', guardianAcceptedAt: STAMP, parentPinHash: 'salt:hash' };
    await submitProfile({ state, level: '8-9', avatar: 'hoya-orange', firstRun: false, guest: { gated: true, via: 'later' } }, d);
    expect(events.map((e) => e.name)).toEqual(['onboarding.started', 'guest.saved']);
    expect(events[1]!.payload).toEqual({ gated: true, consent: 'existing', via: 'later' });
    expect(d.setParentPinHash).not.toHaveBeenCalled();
  });

  it('after a verify the "Me" card never replaces the stored PIN, even with digits typed (CS-G10)', async () => {
    const { d, calls } = deps();
    const state: FormState = { ...guest, learnerType: 'self', name: 'Sam', agreed: true, pin: '9999', parentPinHash: 'salt:hash' };
    await submitProfile({ state, level: '8-9', avatar: 'hoya-orange', firstRun: true, guest: { gated: true, via: 'results' } }, d);
    expect(calls).toEqual(['self', 'promote']);
  });

  it('a promotion that could not be written answers save-failed and sends nothing', async () => {
    const { d, events } = deps({ createProfile: vi.fn(async () => null) });
    const state: FormState = { ...guest, learnerType: 'self', name: 'Sam', agreed: true };
    expect(await submitProfile({ state, level: '8-9', avatar: 'hoya-orange', firstRun: true, guest: { gated: false, via: 'welcome' } }, d)).toEqual({ ok: false, reason: 'save-failed' });
    expect(events).toEqual([]);
  });

  it('GU-D11: the first-run setup with a live guest sends guest.saved { via: setup }', async () => {
    const { d, events } = deps();
    const state: FormState = { ...guest, fromGuest: undefined, learnerType: 'self', name: 'Sam', agreed: true };
    await submitProfile({ state, level: '8-9', avatar: 'hoya-orange', firstRun: true, guest: { gated: false, via: 'setup' } }, d);
    expect(events.at(-1)).toEqual({ name: 'guest.saved', payload: { gated: false, consent: 'new', via: 'setup' } });
  });
});

describe('promotionPlan for each consent state the form gives (5.4)', () => {
  const record = { v: 1 as const, id: 'profile:guest001', startedAt: STAMP, lastAt: STAMP, via: 'site' as const, questDone: true };
  const form = { displayName: 'Sam', ageGroup: '8-9' as const, avatar: 'hoya-orange' as const };
  it('guardian with a new PIN and an email, self, and consent held: always the guest\'s id, then the profile and forget-guest', () => {
    const at = Date.parse(STAMP) + 1000;
    expect(promotionPlan(record, { ...form, learnerType: 'child', consent: 'guardian', makesPin: true, email: true }, at).steps).toEqual(['consent', 'pin', 'email', 'profile', 'forget-guest']);
    expect(promotionPlan(record, { ...form, learnerType: 'self', consent: 'self' }, at).steps).toEqual(['consent', 'profile', 'forget-guest']);
    const held = promotionPlan(record, { ...form, learnerType: 'child', consent: null }, at);
    expect(held.steps).toEqual(['profile', 'forget-guest']);
    expect(held).toMatchObject({ id: 'profile:guest001', createdAt: STAMP });
  });
});
