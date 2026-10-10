import { describe, expect, it } from 'vitest';
import { ONBOARDING_TELEMETRY_PAYLOADS, TELEMETRY_EVENT_NAMES, isTelemetryEventName } from '../index';

const S = ONBOARDING_TELEMETRY_PAYLOADS;

describe('onboarding telemetry payloads (F-LEARN-001 §3.8, owner decision 2026-10-10)', () => {
  it('every payload name is a whitelisted telemetry event', () => {
    for (const name of Object.keys(S)) expect(isTelemetryEventName(name)).toBe(true);
    expect(Object.keys(S).sort()).toEqual(
      [
        'onboarding.consent_given',
        'onboarding.level_selected',
        'onboarding.started',
        'onboarding.who_selected',
        'pin.created',
        'pin.reset_completed',
        'pin.reset_requested',
        'profile.updated',
      ].sort(),
    );
    expect(TELEMETRY_EVENT_NAMES).toContain('onboarding.started');
  });

  it('onboarding.started carries level, firstRun, hasEmail', () => {
    expect(S['onboarding.started'].parse({ level: '8-9', firstRun: true, hasEmail: false })).toEqual({
      level: '8-9',
      firstRun: true,
      hasEmail: false,
    });
    expect(S['onboarding.started'].safeParse({ level: '12-14', firstRun: true, hasEmail: false }).success).toBe(false);
  });

  it('onboarding.level_selected carries level only', () => {
    expect(S['onboarding.level_selected'].parse({ level: '10-11' })).toEqual({ level: '10-11' });
  });

  it('onboarding.who_selected carries firstRun only', () => {
    expect(S['onboarding.who_selected'].parse({ firstRun: false })).toEqual({ firstRun: false });
  });

  it('onboarding.consent_given', () => {
    expect(S['onboarding.consent_given'].parse({ basis: 'guardian', hasEmail: true, pinSet: true }).basis).toBe('guardian');
    expect(S['onboarding.consent_given'].parse({ basis: 'self_13plus', hasEmail: false, pinSet: false }).basis).toBe('self_13plus');
    expect(S['onboarding.consent_given'].safeParse({ basis: 'other', hasEmail: false, pinSet: false }).success).toBe(false);
  });

  it('profile.updated / pin.* enumerations', () => {
    for (const field of ['level', 'avatar', 'name', 'learner_type']) {
      expect(S['profile.updated'].safeParse({ field }).success).toBe(true);
    }
    expect(S['profile.updated'].safeParse({ field: 'email' }).success).toBe(false);
    for (const where of ['first_run', 'gate', 'reset', 'optional']) {
      expect(S['pin.created'].safeParse({ where }).success).toBe(true);
    }
    expect(S['pin.created'].safeParse({ where: 'x' }).success).toBe(false);
    for (const method of ['rescue_code', 'wait']) {
      expect(S['pin.reset_requested'].safeParse({ method }).success).toBe(true);
      expect(S['pin.reset_completed'].safeParse({ method }).success).toBe(true);
    }
    expect(S['pin.reset_requested'].safeParse({ method: 'email' }).success).toBe(false);
  });

  it('never accepts learnerType, a name or an email in any payload', () => {
    const valid: Record<string, Record<string, unknown>> = {
      'onboarding.started': { level: '8-9', firstRun: true, hasEmail: false },
      'onboarding.who_selected': { firstRun: true },
      'onboarding.level_selected': { level: '8-9' },
      'onboarding.consent_given': { basis: 'self_13plus', hasEmail: false, pinSet: false },
      'profile.updated': { field: 'level' },
      'pin.created': { where: 'gate' },
      'pin.reset_requested': { method: 'wait' },
      'pin.reset_completed': { method: 'wait' },
    };
    for (const [name, payload] of Object.entries(valid)) {
      const schema = S[name as keyof typeof S];
      expect(schema.safeParse(payload).success).toBe(true);
      for (const extra of [{ learnerType: 'self' }, { displayName: 'Suni' }, { email: 'a@b.co' }]) {
        expect(schema.safeParse({ ...payload, ...extra }).success).toBe(false);
      }
    }
  });
});
