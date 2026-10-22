import { describe, expect, it } from 'vitest';
import {
  CHOOSER_NAME_ORDER_FROM,
  CHOOSER_RESUME_MS,
  DEVICE_USES_TTL_MS,
  DeviceUsesSchema,
  GROWN_UP_BACKGROUND_MS,
  GROWN_UP_FRESH_PIN_MS,
  GROWN_UP_HANDOFF_TARGETS,
  GROWN_UP_HANDOFF_VIAS,
  GROWN_UP_LOCK_CHANNEL,
  GrownUpLockMessageSchema,
  GrownUpUseSchema,
  OA_TELEMETRY_PAYLOADS,
  ONBOARDING_TELEMETRY_PAYLOADS,
  PIN_PAUSE_STEPS_MS,
  PIN_RESET_TICKET_KEY,
  PIN_RESET_TICKET_MS,
  PIN_STRIKE_DECAY_MS,
  PROFILES_CHANNEL,
  PROFILE_LOCKS_KEY,
  PROFILE_LOCKS_MAX_IDS,
  PinOwnerSchema,
  PinPromptSeenSchema,
  PinResetTicketSchema,
  ProfileLocksSchema,
  ProfilesChangedMessageSchema,
  RESCUE_MAX_ATTEMPTS,
  RESCUE_PAUSE_MS,
  RESCUE_WINDOW_MS,
  SHELL_KEYS,
  SHELL_TELEMETRY_PAYLOADS,
  SpaceKindSchema,
  SpaceRoleSchema,
  TELEMETRY_DAILY_KEEP_DAYS,
  TELEMETRY_EVENT_NAMES,
  WHO_TRIGGERS,
  isTelemetryEventName,
  parseLenient,
  personasFor,
  usesFor,
  type SpaceKind,
  type SpaceRole,
} from '../index';

/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS row OA-1 (sections 5.2, 7.1, 7.2, 7.6, 8.5, 13.1, 15): grown-up uses of an
 * account, the small device records the learner app and the console share, the constants, and the telemetry
 * payload contract the Worker enforces.
 */

type M = { kind: SpaceKind; role: SpaceRole };
const m = (kind: SpaceKind, role: SpaceRole): M => ({ kind, role });

describe('usesFor (section 5.2)', () => {
  it('maps each membership to its use, as in the table', () => {
    const table: Array<[M, string[]]> = [
      [m('family', 'owner'), ['family']],
      [m('family', 'caregiver'), ['family']],
      [m('family', 'teacher'), []],
      [m('family', 'admin'), []],
      [m('family', 'student'), []],
      [m('class', 'owner'), ['teacher']],
      [m('class', 'teacher'), ['teacher']],
      [m('class', 'caregiver'), []],
      [m('class', 'admin'), []],
      [m('class', 'student'), []],
      [m('school', 'owner'), ['school']],
      [m('school', 'admin'), ['school']],
      [m('school', 'teacher'), ['teacher']],
      [m('school', 'caregiver'), []],
      [m('school', 'student'), []],
    ];
    for (const [membership, uses] of table) expect(usesFor([membership]), `${membership.kind}/${membership.role}`).toEqual(uses);
  });

  it('returns the fixed order family, teacher, school, each once, whatever the input order', () => {
    expect(usesFor([m('school', 'admin'), m('class', 'teacher'), m('family', 'owner'), m('school', 'owner'), m('family', 'caregiver')])).toEqual(['family', 'teacher', 'school']);
    expect(usesFor([m('school', 'teacher'), m('school', 'admin')])).toEqual(['teacher', 'school']);
    expect(usesFor([])).toEqual([]);
  });

  it('ignores student rows and kinds this bundle does not know', () => {
    expect(usesFor([m('family', 'student'), m('class', 'student'), m('school', 'student')])).toEqual([]);
    expect(usesFor([{ kind: 'district' as SpaceKind, role: 'owner' }])).toEqual([]);
  });

  it('counts archived spaces (the membership row is all it reads)', () => {
    const archived = { kind: 'class' as const, role: 'owner' as const, archivedAt: '2026-01-01T00:00:00.000Z' };
    expect(usesFor([archived])).toEqual(['teacher']);
  });

  it('property: family exactly when personasFor has parent; teacher or school exactly when it has teacher', () => {
    const all: M[] = SpaceKindSchema.options.flatMap((kind) => SpaceRoleSchema.options.map((role) => m(kind, role)));
    const check = (list: M[]): void => {
      const uses = usesFor(list);
      const personas = personasFor(list);
      expect(uses.includes('family'), JSON.stringify(list)).toBe(personas.includes('parent'));
      expect(uses.includes('teacher') || uses.includes('school'), JSON.stringify(list)).toBe(personas.includes('teacher'));
      expect(new Set(uses).size).toBe(uses.length);
      expect([...uses].sort((a, b) => GrownUpUseSchema.options.indexOf(a) - GrownUpUseSchema.options.indexOf(b))).toEqual(uses);
    };
    // Every list of up to two memberships, exhaustively.
    check([]);
    for (const a of all) {
      check([a]);
      for (const b of all) check([a, b]);
    }
    // And seeded random lists of up to eight (a small LCG keeps the run reproducible).
    let seed = 20261021;
    const next = (n: number): number => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed % n;
    };
    for (let run = 0; run < 500; run += 1) {
      const length = next(9);
      check(Array.from({ length }, () => all[next(all.length)] as M));
    }
  });
});

describe('device records (sections 7.1, 7.2, 7.6, 8.5, 13.1)', () => {
  it('GrownUpUseSchema lists family, teacher, school', () => {
    expect(GrownUpUseSchema.options).toEqual(['family', 'teacher', 'school']);
  });

  it('DeviceUsesSchema: uses and a time, no names; rejects junk', () => {
    expect(DeviceUsesSchema.parse({ v: 1, uses: ['family', 'teacher'], at: 1 })).toEqual({ v: 1, uses: ['family', 'teacher'], at: 1 });
    expect(DeviceUsesSchema.parse({ v: 1, uses: [], at: 0 }).uses).toEqual([]);
    // Unknown keys are stripped, so a name or an email never rides along.
    expect(DeviceUsesSchema.parse({ v: 1, uses: ['school'], at: 5, email: 'a@b.c', accountId: 'acct' })).toEqual({ v: 1, uses: ['school'], at: 5 });
    for (const junk of [
      null,
      'family',
      {},
      { v: 2, uses: [], at: 1 },
      { v: 1, uses: ['area'], at: 1 },
      { v: 1, uses: ['parent'], at: 1 },
      { v: 1, uses: ['family', 'family'], at: 1 },
      { v: 1, uses: 'family', at: 1 },
      { v: 1, uses: [], at: -1 },
      { v: 1, uses: [], at: Number.POSITIVE_INFINITY },
      { v: 1, uses: [] },
    ]) {
      expect(DeviceUsesSchema.safeParse(junk).success, JSON.stringify(junk)).toBe(false);
    }
    expect(parseLenient(DeviceUsesSchema, '{"v":1,"uses":["teacher"],"at":3}')).toEqual({ v: 1, uses: ['teacher'], at: 3 });
    expect(parseLenient(DeviceUsesSchema, '{broken')).toBeNull();
  });

  it('PinOwnerSchema: 16 lower-case hex digits and a real PIN epoch; rejects junk', () => {
    expect(PinOwnerSchema.parse({ v: 1, owner: '0123456789abcdef', epoch: 1_700_000_000_000 })).toEqual({ v: 1, owner: '0123456789abcdef', epoch: 1_700_000_000_000 });
    for (const junk of [
      { v: 1, owner: '0123456789abcde', epoch: 1 },
      { v: 1, owner: '0123456789abcdef0', epoch: 1 },
      { v: 1, owner: '0123456789ABCDEF', epoch: 1 },
      { v: 1, owner: 'user_2abcdefghijk', epoch: 1 },
      { v: 1, owner: '0123456789abcdef', epoch: 0 },
      { v: 1, owner: '0123456789abcdef', epoch: -1 },
      { v: 1, owner: '0123456789abcdef' },
      { v: 2, owner: '0123456789abcdef', epoch: 1 },
      'owner',
    ]) {
      expect(PinOwnerSchema.safeParse(junk).success, JSON.stringify(junk)).toBe(false);
    }
  });

  it('PinResetTicketSchema and its sessionStorage key; rejects junk', () => {
    expect(PIN_RESET_TICKET_KEY).toBe('hr:shell:pinReset');
    expect(PinResetTicketSchema.parse({ v: 1, at: 10, epoch: 7 })).toEqual({ v: 1, at: 10, epoch: 7 });
    for (const junk of [{ v: 1, at: 10 }, { v: 1, epoch: 7 }, { v: 1, at: -1, epoch: 7 }, { v: 1, at: 10, epoch: 0 }, { v: 1, at: '10', epoch: 7 }, { v: 2, at: 10, epoch: 7 }, []]) {
      expect(PinResetTicketSchema.safeParse(junk).success, JSON.stringify(junk)).toBe(false);
    }
  });

  it('ProfileLocksSchema: profile ids only, each once; a repeat or a malformed id is dropped, not the record; rejects junk', () => {
    expect(PROFILE_LOCKS_KEY).toBe('profiles:locks');
    expect(ProfileLocksSchema.parse({ v: 1, ids: [] })).toEqual({ v: 1, ids: [] });
    expect(ProfileLocksSchema.parse({ v: 1, ids: ['profile:a', 'profile:b-2'] }).ids).toEqual(['profile:a', 'profile:b-2']);
    // Two tabs appending the same lock: the lock holds, once.
    expect(ProfileLocksSchema.parse({ v: 1, ids: ['profile:a', 'profile:b-2', 'profile:a'] }).ids).toEqual(['profile:a', 'profile:b-2']);
    // A malformed id can never match a profile: dropped, and the other locks still hold.
    expect(ProfileLocksSchema.parse({ v: 1, ids: ['Mina', '', 'profile:a'] }).ids).toEqual(['profile:a']);
    // At most 200 ids: a longer record (corrupted or hostile) is a failed read, refused before any id is checked.
    expect(PROFILE_LOCKS_MAX_IDS).toBe(200);
    const many = (count: number) => Array.from({ length: count }, (_, i) => `profile:p${i}`);
    expect(ProfileLocksSchema.parse({ v: 1, ids: many(PROFILE_LOCKS_MAX_IDS) }).ids).toHaveLength(PROFILE_LOCKS_MAX_IDS);
    for (const junk of [{ v: 1 }, { v: 1, ids: [7] }, { v: 1, ids: ['profile:a', null] }, { v: 1, ids: 'profile:a' }, { v: 2, ids: [] }, null, { v: 1, ids: many(PROFILE_LOCKS_MAX_IDS + 1) }]) {
      expect(ProfileLocksSchema.safeParse(junk).success, JSON.stringify(junk).slice(0, 60)).toBe(false);
    }
  });

  it('the tab messages carry nothing but their kind', () => {
    expect(GROWN_UP_LOCK_CHANNEL).toBe('hr-grownup');
    expect(PROFILES_CHANNEL).toBe('hr-profiles');
    expect(GrownUpLockMessageSchema.parse({ v: 1, kind: 'lock' })).toEqual({ v: 1, kind: 'lock' });
    expect(ProfilesChangedMessageSchema.parse({ v: 1, kind: 'changed' })).toEqual({ v: 1, kind: 'changed' });
    for (const junk of [{ v: 1, kind: 'unlock' }, { v: 1, kind: 'lock', profileId: 'profile:a' }, { v: 2, kind: 'lock' }, 'lock', null]) {
      expect(GrownUpLockMessageSchema.safeParse(junk).success, JSON.stringify(junk)).toBe(false);
    }
    for (const junk of [{ v: 1, kind: 'lock' }, { v: 1, kind: 'changed', ids: ['profile:a'] }, { v: 2, kind: 'changed' }, undefined]) {
      expect(ProfilesChangedMessageSchema.safeParse(junk).success, JSON.stringify(junk)).toBe(false);
    }
  });

  it('pinPromptSeen holds true and nothing else', () => {
    expect(PinPromptSeenSchema.parse(true)).toBe(true);
    for (const junk of [false, 'true', 1, {}, null]) expect(PinPromptSeenSchema.safeParse(junk).success).toBe(false);
  });

  it('the shell store names its new keys outside the learner hr: namespace', () => {
    expect(SHELL_KEYS).toMatchObject({ deviceUses: 'deviceUses', pinOwner: 'pinOwner', pinPromptSeen: 'pinPromptSeen' });
  });
});

describe('constants (section 13.1)', () => {
  it('holds the decided values', () => {
    const MIN = 60_000;
    expect(CHOOSER_RESUME_MS).toBe(30 * MIN);
    expect(GROWN_UP_BACKGROUND_MS).toBe(5 * MIN);
    expect(GROWN_UP_FRESH_PIN_MS).toBe(2 * MIN);
    expect(PIN_PAUSE_STEPS_MS).toEqual([30_000, MIN, 5 * MIN, 15 * MIN, 60 * MIN]);
    expect(PIN_STRIKE_DECAY_MS).toBe(24 * 60 * MIN);
    expect(RESCUE_MAX_ATTEMPTS).toBe(5);
    expect(RESCUE_WINDOW_MS).toBe(15 * MIN);
    expect(RESCUE_PAUSE_MS).toBe(15 * MIN);
    expect(PIN_RESET_TICKET_MS).toBe(2 * MIN);
    expect(DEVICE_USES_TTL_MS).toBe(30 * 24 * 60 * MIN);
    expect(CHOOSER_NAME_ORDER_FROM).toBe(13);
    expect(TELEMETRY_DAILY_KEEP_DAYS).toBe(400);
  });
});

/** Section 15: every name and its documented payload. */
const OA_NAMES = [
  'profile.switch',
  'parent.gate.opened',
  'who.shown',
  'who.picked',
  'pin.paused',
  'pin.reset_requested',
  'pin.reset_completed',
  'pin.biometric_changed',
  'profile.lock_changed',
  'profile.removed',
  'space.join.batch',
  'shell.grown_up_handoff',
] as const;

const VALID: Record<(typeof OA_NAMES)[number], Record<string, unknown>> = {
  'profile.switch': { via: 'chooser', trigger: 'resume', locked: false, minutesIn: '2-10' },
  'parent.gate.opened': { dest: 'locked_profile', via: 'biometric', marker: 'pin' },
  'who.shown': { trigger: 'launch', learners: '3-4', grownUps: 2, anyLocked: true, resetPending: false },
  'who.picked': { kind: 'grown_up', use: 'teacher' },
  'pin.paused': { step: 3 },
  'pin.reset_requested': { method: 'wait_cancelled' },
  'pin.reset_completed': { method: 'sign_in' },
  'pin.biometric_changed': { on: false, reason: 'enrolment_changed' },
  'profile.lock_changed': { locked: true },
  'profile.removed': { saved: true, wasActive: false, anyway: false },
  'space.join.batch': { picked: 3, joined: 2, refused: 1 },
  'shell.grown_up_handoff': { via: 'chooser', target: 'next' },
};

describe('telemetry (section 15)', () => {
  it('lists every section 15 name in the shared list, the new ones appended', () => {
    for (const name of OA_NAMES) expect(isTelemetryEventName(name), name).toBe(true);
    expect(Object.keys(OA_TELEMETRY_PAYLOADS)).toEqual([...OA_NAMES]);
    // Appended together, in this order; other rows may append after them (the list is append-only).
    const at = TELEMETRY_EVENT_NAMES.indexOf('who.shown');
    expect(at).toBeGreaterThan(0);
    expect(TELEMETRY_EVENT_NAMES.slice(at, at + 7)).toEqual(['who.shown', 'who.picked', 'pin.paused', 'pin.biometric_changed', 'profile.lock_changed', 'profile.removed', 'space.join.batch']);
  });

  it('every payload schema takes its documented example and refuses a profile id, an extra key or an off-list value', () => {
    for (const name of OA_NAMES) {
      const schema = OA_TELEMETRY_PAYLOADS[name];
      expect(schema.safeParse(VALID[name]).success, name).toBe(true);
      expect(schema.safeParse({ ...VALID[name], profileId: 'profile:a' }).success, name).toBe(false);
      expect(schema.safeParse({ ...VALID[name], name: 'Mina' }).success, name).toBe(false);
      for (const key of Object.keys(VALID[name])) {
        expect(schema.safeParse({ ...VALID[name], [key]: 'profile:a' }).success, `${name}.${key}`).toBe(false);
      }
    }
  });

  it('documents the codes of each payload', () => {
    const shape = OA_TELEMETRY_PAYLOADS;
    expect(WHO_TRIGGERS).toEqual(['launch', 'return', 'resume', 'join', 'manual', 'try']);
    expect(shape['profile.switch'].shape.via.options).toEqual(['chooser', 'profile', 'home']);
    expect(shape['profile.switch'].shape.trigger.options).toEqual(['launch', 'return', 'resume', 'join', 'manual', 'try', 'none']);
    expect(shape['profile.switch'].shape.minutesIn.options).toEqual(['0-2', '2-10', '10+']);
    expect(shape['parent.gate.opened'].shape.dest.options).toEqual(['area', 'use', 'locked_profile', 'action', 'cancel_reset']);
    expect(shape['parent.gate.opened'].shape.via.options).toEqual(['pin', 'biometric', 'session', 'open']);
    expect(shape['parent.gate.opened'].shape.marker.options).toEqual(['none', 'pin', 'nopin']);
    expect(shape['who.shown'].shape.trigger.options).toEqual([...WHO_TRIGGERS]);
    expect(shape['who.shown'].shape.learners.options).toEqual(['1', '2', '3-4', '5-12', '13+']);
    expect(shape['who.picked'].shape.kind.options).toEqual(['learner', 'locked_learner', 'grown_up', 'add', 'cancel_reset', 'try', 'guest']);
    expect(shape['who.picked'].shape.use.unwrap().options).toEqual(['family', 'teacher', 'school', 'area', 'signin']);
    expect(shape['pin.biometric_changed'].shape.reason.options).toEqual(['user', 'pin_changed', 'enrolment_changed']);
    expect(shape['pin.reset_requested'].shape.method.options).toEqual(['rescue_code', 'wait', 'sign_in', 'wait_cancelled']);
    expect(shape['pin.reset_completed'].shape.method.options).toEqual(['rescue_code', 'wait', 'sign_in']);
    // The pin.reset_* schemas are the onboarding ones, so the two contracts cannot drift.
    expect(shape['pin.reset_requested']).toBe(ONBOARDING_TELEMETRY_PAYLOADS['pin.reset_requested']);
    expect(shape['pin.reset_completed']).toBe(ONBOARDING_TELEMETRY_PAYLOADS['pin.reset_completed']);
    expect(GROWN_UP_HANDOFF_VIAS).toEqual(['profile', 'dashboard', 'plan', 'lock', 'chooser']);
    expect(GROWN_UP_HANDOFF_TARGETS).toEqual(['router', 'billing', 'next']);
    expect(SHELL_TELEMETRY_PAYLOADS['shell.grown_up_handoff']).toEqual({ via: [...GROWN_UP_HANDOFF_VIAS], target: [...GROWN_UP_HANDOFF_TARGETS] });
  });

  it('who.picked use is optional; the counts and steps are bounded whole numbers', () => {
    expect(OA_TELEMETRY_PAYLOADS['who.picked'].safeParse({ kind: 'learner' }).success).toBe(true);
    const batch = OA_TELEMETRY_PAYLOADS['space.join.batch'];
    expect(batch.safeParse({ picked: 0, joined: 0, refused: 0 }).success).toBe(true);
    expect(batch.safeParse({ picked: 12, joined: 12, refused: 12 }).success).toBe(true);
    for (const bad of [13, -1, 1.5, Number.NaN, '3']) expect(batch.safeParse({ picked: bad, joined: 0, refused: 0 }).success, String(bad)).toBe(false);
    const shown = OA_TELEMETRY_PAYLOADS['who.shown'];
    expect(shown.safeParse({ ...VALID['who.shown'], grownUps: 4 }).success).toBe(true);
    expect(shown.safeParse({ ...VALID['who.shown'], grownUps: 5 }).success).toBe(false);
    const paused = OA_TELEMETRY_PAYLOADS['pin.paused'];
    expect(paused.safeParse({ step: 1 }).success).toBe(true);
    expect(paused.safeParse({ step: 5 }).success).toBe(true);
    expect(paused.safeParse({ step: 0 }).success).toBe(false);
    expect(paused.safeParse({ step: 6 }).success).toBe(false);
  });
});
