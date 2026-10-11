import { describe, expect, it, vi } from 'vitest';
import type { Profile } from '@hangul-route/content-schema';
import { ONBOARDING_TELEMETRY_PAYLOADS } from '@hangul-route/content-schema';
import type { FormState } from '../create-profile-form';
import { submitProfile, type SubmitDeps, type SubmitInput } from '../submit-profile';

const fresh: FormState = {
  learnerType: 'child',
  name: ' Mina ',
  email: '',
  agreed: true,
  pin: '1234',
  guardianAcceptedAt: null,
  selfAcceptedAt: null,
  parentPinHash: null,
};

function setup(overrides: Partial<SubmitDeps> = {}) {
  const calls: string[] = [];
  const events: Array<{ name: string; profileId?: string; payload?: Record<string, unknown> }> = [];
  const profile = { id: 'profile:abc' } as Profile;
  const deps: SubmitDeps = {
    hashPin: vi.fn(async (pin: string) => {
      calls.push('hash');
      return `hashed:${pin}`;
    }),
    acceptGuardianConsent: vi.fn(() => void calls.push('guardian')),
    acceptSelfConsent: vi.fn(() => void calls.push('self')),
    setParentPinHash: vi.fn((h: string) => void calls.push(`pin:${h}`)),
    setParentEmail: vi.fn((e: string) => void calls.push(`email:${e}`)),
    createProfile: vi.fn(() => {
      calls.push('create');
      return profile;
    }),
    track: vi.fn((e) => void events.push(e)),
    ...overrides,
  };
  return { deps, calls, events, profile };
}

function input(state: FormState, extra: Partial<SubmitInput> = {}): SubmitInput {
  return { state, level: '8-9', avatar: 'hoya-blue', firstRun: true, ...extra };
}

describe('submitProfile (F-LEARN-001 §3.3, §3.14)', () => {
  it('child: hashes first, then stores consent, PIN, email and the profile in that order', async () => {
    const { deps, calls } = setup();
    const result = await submitProfile(input({ ...fresh, email: ' mom@example.com ' }), deps);
    expect(result).toEqual({ ok: true, profile: expect.objectContaining({ id: 'profile:abc' }) });
    expect(calls).toEqual(['hash', 'guardian', 'pin:hashed:1234', 'email: mom@example.com ', 'create']);
    expect(deps.createProfile).toHaveBeenCalledWith({
      displayName: 'Mina',
      ageGroup: '8-9',
      avatar: 'hoya-blue',
      learnerType: 'child',
    });
  });

  it('child: sends the three events with the new profile id and no name, email or learnerType', async () => {
    const { deps, events } = setup();
    await submitProfile(input({ ...fresh, email: 'mom@example.com' }), deps);
    expect(events.map((e) => e.name)).toEqual(['onboarding.consent_given', 'pin.created', 'onboarding.started']);
    expect(events.every((e) => e.profileId === 'profile:abc')).toBe(true);
    expect(events[0]?.payload).toEqual({ basis: 'guardian', hasEmail: true, pinSet: true });
    expect(events[1]?.payload).toEqual({ where: 'first_run' });
    expect(events[2]?.payload).toEqual({ level: '8-9', firstRun: true, hasEmail: true });
    for (const e of events) {
      const schema = ONBOARDING_TELEMETRY_PAYLOADS[e.name as keyof typeof ONBOARDING_TELEMETRY_PAYLOADS];
      expect(schema.safeParse(e.payload).success).toBe(true);
      expect(JSON.stringify(e)).not.toMatch(/Mina|mom@|learnerType/);
    }
  });

  it('self without a PIN: self consent only, no hash, no PIN event, no gate', async () => {
    const { deps, calls, events } = setup();
    const state: FormState = { ...fresh, learnerType: 'self', pin: null };
    await submitProfile(input(state), deps);
    expect(calls).toEqual(['self', 'create']);
    expect(deps.hashPin).not.toHaveBeenCalled();
    expect(deps.createProfile).toHaveBeenCalledWith(expect.objectContaining({ learnerType: 'self' }));
    expect(events.map((e) => e.name)).toEqual(['onboarding.consent_given', 'onboarding.started']);
    expect(events[0]?.payload).toEqual({ basis: 'self_13plus', hasEmail: false, pinSet: false });
    expect(events[1]?.payload).toEqual({ level: '8-9', firstRun: true, hasEmail: false });
  });

  it('self with the optional PIN: stores it and reports it as optional', async () => {
    const { deps, calls, events } = setup();
    await submitProfile(input({ ...fresh, learnerType: 'self' }), deps);
    expect(calls).toEqual(['hash', 'self', 'pin:hashed:1234', 'create']);
    expect(events.map((e) => e.name)).toEqual(['onboarding.consent_given', 'pin.created', 'onboarding.started']);
    expect(events[1]?.payload).toEqual({ where: 'optional' });
    expect(events[0]?.payload).toMatchObject({ pinSet: true });
  });

  it('adding a profile where nothing more is needed: just the profile and its event', async () => {
    const { deps, calls, events } = setup();
    const state: FormState = {
      ...fresh,
      guardianAcceptedAt: '2026-10-10T00:00:00.000Z',
      parentPinHash: 'salt:hash',
      pin: null,
      agreed: false,
      email: 'ignored@example.com',
    };
    await submitProfile(input(state, { firstRun: false }), deps);
    expect(calls).toEqual(['create']);
    expect(events.map((e) => e.name)).toEqual(['onboarding.started']);
    expect(events[0]?.payload).toEqual({ level: '8-9', firstRun: false, hasEmail: false });
  });

  it('stores nothing and creates no profile when the PIN cannot be hashed', async () => {
    const { deps, calls, events } = setup({
      hashPin: vi.fn(async () => {
        throw new Error('boom');
      }),
    });
    const result = await submitProfile(input(fresh), deps);
    expect(result).toEqual({ ok: false, reason: 'pin-failed' });
    expect(calls).toEqual([]);
    expect(events).toEqual([]);
  });

  it('refuses a form that is not complete', async () => {
    const { deps, calls } = setup();
    expect(await submitProfile(input({ ...fresh, pin: null }), deps)).toEqual({ ok: false, reason: 'incomplete' });
    expect(await submitProfile(input({ ...fresh, agreed: false }), deps)).toEqual({
      ok: false,
      reason: 'incomplete',
    });
    expect(calls).toEqual([]);
  });
});
