import { describe, expect, it } from 'vitest';
import {
  GUEST_KEY,
  GUEST_REOPEN_MS,
  GUEST_SECONDS_IN,
  GUEST_TELEMETRY_NAMES,
  GUEST_TELEMETRY_PAYLOADS,
  GUEST_TTL_DAYS,
  GUEST_TTL_MS,
  GUEST_TTL_SHARED_DAYS,
  GUEST_TTL_SHARED_MS,
  GuestRecordSchema,
  GuestViaSchema,
  OA_TELEMETRY_PAYLOADS,
  ONBOARDING_TELEMETRY_PAYLOADS,
  TELEMETRY_EVENT_NAMES,
  TRY_INTENT_PARAM,
  WHO_TRIGGERS,
  isTelemetryEventName,
} from '../index';

/**
 * AMENDMENTS-GUEST-FIRST-LESSON section 5.1 (the guest record) and section 12 (the guest.* names and payloads),
 * row GU-1: the record holds no name, email, level, cub, learnerType or answer; the payloads hold codes, booleans and
 * bounded whole numbers only, never a profile id.
 */
const RECORD = {
  v: 1,
  id: 'profile:k3x9-2a',
  startedAt: '2026-10-22T08:00:00.000Z',
  lastAt: '2026-10-22T08:04:00.000Z',
  via: 'site',
  questDone: false,
} as const;

describe('GuestRecordSchema (section 5.1)', () => {
  it('parses a valid record for every via', () => {
    expect(GuestViaSchema.options).toEqual(['site', 'chooser', 'welcome']);
    for (const via of GuestViaSchema.options) expect(GuestRecordSchema.parse({ ...RECORD, via })).toEqual({ ...RECORD, via });
    expect(GuestRecordSchema.parse({ ...RECORD, questDone: true }).questDone).toBe(true);
  });

  it('rejects junk', () => {
    for (const junk of [null, undefined, 'guest', 42, [], {}]) expect(GuestRecordSchema.safeParse(junk).success, String(junk)).toBe(false);
    expect(GuestRecordSchema.safeParse({ ...RECORD, v: 2 }).success).toBe(false);
    expect(GuestRecordSchema.safeParse({ ...RECORD, via: 'link' }).success).toBe(false);
    expect(GuestRecordSchema.safeParse({ ...RECORD, questDone: 'yes' }).success).toBe(false);
    expect(GuestRecordSchema.safeParse({ ...RECORD, startedAt: 1 }).success).toBe(false);
    for (const key of Object.keys(RECORD)) {
      const { [key as keyof typeof RECORD]: _drop, ...rest } = RECORD;
      expect(GuestRecordSchema.safeParse(rest).success, key).toBe(false);
    }
  });

  it('takes an ordinary profile id only', () => {
    for (const id of ['profile:a', 'profile:0-9', 'profile:abc-123']) expect(GuestRecordSchema.safeParse({ ...RECORD, id }).success, id).toBe(true);
    for (const id of ['', 'profile:', 'guest:a', 'profile:A', 'profile:a_b', 'profile:a b', ' profile:a', 'profile:a\n', 'xprofile:a']) {
      expect(GuestRecordSchema.safeParse({ ...RECORD, id }).success, JSON.stringify(id)).toBe(false);
    }
  });

  it('keeps no name, email, level, cub or learnerType (unknown keys are stripped)', () => {
    const parsed = GuestRecordSchema.parse({ ...RECORD, name: 'Mina', email: 'a@b.c', level: '8-9', cub: 'bom', learnerType: 'child' });
    expect(Object.keys(parsed).sort()).toEqual(['id', 'lastAt', 'questDone', 'startedAt', 'v', 'via']);
  });
});

describe('guest constants (section 5.1)', () => {
  it('pins the key, the reopen window, the lives and the intent param', () => {
    expect(GUEST_KEY).toBe('guest');
    expect(GUEST_REOPEN_MS).toBe(30 * 60 * 1000);
    expect(GUEST_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000);
    expect(GUEST_TTL_SHARED_MS).toBe(7 * 24 * 60 * 60 * 1000);
    expect(GUEST_TTL_DAYS).toBe(30);
    expect(GUEST_TTL_SHARED_DAYS).toBe(7);
    expect(GUEST_TTL_MS).toBe(GUEST_TTL_DAYS * 24 * 60 * 60 * 1000);
    expect(GUEST_TTL_SHARED_MS).toBe(GUEST_TTL_SHARED_DAYS * 24 * 60 * 60 * 1000);
    expect(TRY_INTENT_PARAM).toBe('try');
  });
});

const GUEST_NAMES = ['guest.started', 'guest.first_letter', 'guest.quest_done', 'guest.left', 'guest.saved', 'guest.expired'] as const;

const VALID: Record<(typeof GUEST_NAMES)[number], Record<string, unknown>> = {
  'guest.started': { via: 'chooser', resumed: true },
  'guest.first_letter': { secondsIn: '15-30' },
  'guest.quest_done': { stars: 3 },
  'guest.left': { at: 'save' },
  'guest.saved': { gated: true, consent: 'existing', via: 'setup' },
  'guest.expired': { questDone: false },
};

describe('guest telemetry (section 12)', () => {
  it('appends the six guest.* names to the shared list, together and in order', () => {
    expect([...GUEST_TELEMETRY_NAMES]).toEqual([...GUEST_NAMES]);
    expect(Object.keys(GUEST_TELEMETRY_PAYLOADS)).toEqual([...GUEST_NAMES]);
    for (const name of GUEST_NAMES) {
      expect(isTelemetryEventName(name), name).toBe(true);
      expect(TELEMETRY_EVENT_NAMES.filter((n) => n === name), name).toHaveLength(1);
    }
    const at = TELEMETRY_EVENT_NAMES.indexOf('guest.started');
    expect(TELEMETRY_EVENT_NAMES.slice(at, at + GUEST_NAMES.length)).toEqual([...GUEST_NAMES]);
    expect(TELEMETRY_EVENT_NAMES.filter((n) => n.startsWith('guest.'))).toEqual([...GUEST_NAMES]);
  });

  it('every payload takes its documented example and refuses a profile id, a learnerType, an extra key or an off-list value', () => {
    for (const name of GUEST_NAMES) {
      const schema = GUEST_TELEMETRY_PAYLOADS[name];
      expect(schema.safeParse(VALID[name]).success, name).toBe(true);
      expect(schema.safeParse({ ...VALID[name], profileId: 'profile:a' }).success, name).toBe(false);
      expect(schema.safeParse({ ...VALID[name], learnerType: 'child' }).success, name).toBe(false);
      expect(schema.safeParse({ ...VALID[name], name: 'Mina' }).success, name).toBe(false);
      for (const key of Object.keys(VALID[name])) {
        expect(schema.safeParse({ ...VALID[name], [key]: 'profile:a' }).success, `${name}.${key}`).toBe(false);
        const { [key]: _drop, ...rest } = VALID[name];
        expect(schema.safeParse(rest).success, `${name} without ${key}`).toBe(false);
      }
    }
  });

  it('documents the codes and bounds of each payload', () => {
    const s = GUEST_TELEMETRY_PAYLOADS;
    expect(s['guest.started'].shape.via.options).toEqual(['site', 'chooser', 'welcome']);
    expect(GUEST_SECONDS_IN).toEqual(['0-15', '15-30', '30-60', '60+']);
    expect(s['guest.first_letter'].shape.secondsIn.options).toEqual([...GUEST_SECONDS_IN]);
    for (const stars of [0, 1, 2, 3]) expect(s['guest.quest_done'].safeParse({ stars }).success, String(stars)).toBe(true);
    for (const stars of [-1, 4, 1.5, Number.NaN, '2']) expect(s['guest.quest_done'].safeParse({ stars }).success, String(stars)).toBe(false);
    expect(s['guest.left'].shape.at.options).toEqual(['quest', 'save']);
    expect(s['guest.saved'].shape.consent.options).toEqual(['new', 'existing']);
    expect(s['guest.saved'].shape.via.options).toEqual(['results', 'welcome', 'later', 'setup']);
    expect(Object.keys(s['guest.saved'].shape).sort()).toEqual(['consent', 'gated', 'via']);
    expect(Object.keys(s['guest.expired'].shape)).toEqual(['questDone']);
  });
});

describe('[GU] section 12: the onboarding.started and OA payload additions', () => {
  it('onboarding.started gains an optional fromGuest boolean', () => {
    const started = ONBOARDING_TELEMETRY_PAYLOADS['onboarding.started'];
    expect(started.safeParse({ level: '8-9', firstRun: true, hasEmail: false }).success).toBe(true);
    expect(started.safeParse({ level: '8-9', firstRun: true, hasEmail: false, fromGuest: true }).success).toBe(true);
    expect(started.safeParse({ level: '8-9', firstRun: false, hasEmail: true, fromGuest: false }).success).toBe(true);
    expect(started.safeParse({ level: '8-9', firstRun: true, hasEmail: false, fromGuest: 'yes' }).success).toBe(false);
  });

  it("who.shown and profile.switch take the 'try' trigger; who.picked takes the 'try' and 'guest' kinds", () => {
    expect(WHO_TRIGGERS).toContain('try');
    expect(OA_TELEMETRY_PAYLOADS['who.shown'].shape.trigger.options).toContain('try');
    expect(OA_TELEMETRY_PAYLOADS['profile.switch'].shape.trigger.options).toContain('try');
    expect(OA_TELEMETRY_PAYLOADS['who.picked'].shape.kind.options).toEqual(['learner', 'locked_learner', 'grown_up', 'add', 'cancel_reset', 'try', 'guest']);
    expect(OA_TELEMETRY_PAYLOADS['who.picked'].safeParse({ kind: 'guest' }).success).toBe(true);
    expect(OA_TELEMETRY_PAYLOADS['who.picked'].safeParse({ kind: 'try' }).success).toBe(true);
    expect(OA_TELEMETRY_PAYLOADS['who.shown'].safeParse({ trigger: 'try', learners: '2', grownUps: 0, anyLocked: false, resetPending: false }).success).toBe(true);
    expect(OA_TELEMETRY_PAYLOADS['profile.switch'].safeParse({ via: 'chooser', trigger: 'try', locked: false, minutesIn: '0-2' }).success).toBe(true);
  });
});
