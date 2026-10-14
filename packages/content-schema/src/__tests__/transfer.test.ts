import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  ACCEPTED_CONSENT_TEXT_VERSIONS,
  ConsentResetReasonSchema,
  DeviceAttestKindSchema,
  DeviceTransferApproveBodySchema,
  DeviceTransferCreateBodySchema,
  DeviceTransferPrefsBodySchema,
  DeviceTransferPreviewBodySchema,
  InboxTransferSchema,
  LearnerBasisSchema,
  LearnerSlotStateSchema,
  SourceSlotStateSchema,
  TRANSFER_BLOCKED_VALID_MS,
  TRANSFER_CODE_FAILS_PER_DAY,
  TRANSFER_CODE_FAILS_PER_HOUR,
  TRANSFER_CONSENT_TEXT_VERSION,
  TRANSFER_COOLDOWN_MS,
  TRANSFER_COOLING_OFF_MS,
  TRANSFER_GUARDIAN_MIN_AGE_MS,
  TRANSFER_LIST_MAX,
  TRANSFER_MAX_CREATED_PER_ACCOUNT_PER_DAY,
  TRANSFER_MAX_CREATED_PER_LEARNER_PER_DAY,
  TRANSFER_MAX_OPEN_PER_DESTINATION,
  TRANSFER_PURGE_AFTER_MS,
  TRANSFER_REFUSAL_COOLDOWN_MS,
  TRANSFER_WINDOW_MS,
  TransferApproveBodySchema,
  TransferBlockReasonSchema,
  TransferConsentSchema,
  TransferCreateBodySchema,
  TransferDeclineBodySchema,
  TransferDeclineReasonSchema,
  TransferEmptyBodySchema,
  TransferEndReasonSchema,
  TransferEndedFromSchema,
  TransferFamilyPrefsBodySchema,
  TransferIdSchema,
  TransferInitiatorSchema,
  TransferLearnerRouteSchema,
  TransferPremiumChangeSchema,
  TransferPreviewBodySchema,
  TransferSlotSchema,
  TransferStatusSchema,
  TransferStepStateSchema,
  InboxPlanSchema,
  LearnerMembershipSchema,
  SyncInboxSchema,
  TierSourceSchema,
  lenientArray,
} from '../index';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const consent = { textVersion: TRANSFER_CONSENT_TEXT_VERSION, locale: 'en' };

/** A full inbox row as the Worker will send it (F-SPACE-002 §4.4). */
const inboxTransfer = {
  id: 'transfer:0b6f2a3c-1d4e-4f5a-9b8c-7d6e5f4a3b2c',
  status: 'requested',
  initiator: 'source',
  from: { spaceId: 'space:a', name: 'Sunday Class A' },
  to: { spaceId: 'space:b', name: 'Saturday Class B', ownerName: 'Ms Park', schoolName: null, ageBucket: 'months', learnerCount: 12 },
  learnerState: 'pending',
  sourceState: 'yes',
  destinationState: 'waiting',
  introduce: false,
  premiumChange: 'none',
  destinationConsentMode: 'parent',
  relinkAffected: false,
  sourcePlansAffected: true,
  visibleToday: [{ kind: 'class', name: 'Sunday Class A', ownerName: 'Mr Han' }],
  blockReason: null,
  executeAfter: null,
  expiresAt: '2026-10-24T00:00:00.000Z',
  learnerRoute: 'caregiver',
  canVeto: true,
  endedFrom: null,
  termsDigest: null,
};

describe('transfer constants (F-SPACE-002 §4.1)', () => {
  it('pins every time window and limit', () => {
    expect(TRANSFER_WINDOW_MS).toBe(14 * DAY);
    expect(TRANSFER_COOLING_OFF_MS).toBe(48 * HOUR);
    expect(TRANSFER_BLOCKED_VALID_MS).toBe(72 * HOUR);
    expect(TRANSFER_GUARDIAN_MIN_AGE_MS).toBe(24 * HOUR);
    expect(TRANSFER_COOLDOWN_MS).toBe(7 * DAY);
    expect(TRANSFER_REFUSAL_COOLDOWN_MS).toBe(30 * DAY);
    expect(TRANSFER_PURGE_AFTER_MS).toBe(90 * DAY);
    expect(TRANSFER_MAX_CREATED_PER_ACCOUNT_PER_DAY).toBe(10);
    expect(TRANSFER_MAX_CREATED_PER_LEARNER_PER_DAY).toBe(3);
    expect(TRANSFER_MAX_OPEN_PER_DESTINATION).toBe(20);
    expect(TRANSFER_CODE_FAILS_PER_HOUR).toBe(10);
    expect(TRANSFER_CODE_FAILS_PER_DAY).toBe(30);
    expect(TRANSFER_LIST_MAX).toBe(50);
  });

  it('accepts the current consent text version and every earlier one (F-REPORT-001 RP-W2, F-FEEDBACK-001 FB-1)', () => {
    expect(TRANSFER_CONSENT_TEXT_VERSION).toBe('transfer-2026-10d');
    // records signed with the text before F-REPORT-001 RP-W2 (10), F-FEEDBACK-001 FB-1 (10b) or [TV] TV-D6 (10c) stay valid
    expect(ACCEPTED_CONSENT_TEXT_VERSIONS).toEqual(['transfer-2026-10d', 'transfer-2026-10c', 'transfer-2026-10b', 'transfer-2026-10']);
  });
});

describe('transfer enums', () => {
  it('lists exactly the values of the spec', () => {
    expect(TransferStatusSchema.options).toEqual(['requested', 'approved', 'executed', 'declined', 'expired', 'cancelled']);
    expect(TransferSlotSchema.options).toEqual(['learner', 'source', 'destination']);
    expect(LearnerSlotStateSchema.options).toEqual(['pending', 'consented', 'declined']);
    expect(SourceSlotStateSchema.options).toEqual(['pending', 'consented', 'declined', 'not_required']);
    expect(LearnerBasisSchema.options).toEqual(['caregiver', 'device_attested']);
    expect(DeviceAttestKindSchema.options).toEqual(['grown_up_pin', 'self']);
    expect(TransferInitiatorSchema.options).toEqual(['learner_side', 'source']);
    expect(TransferDeclineReasonSchema.options).toEqual(['not_now', 'no_room']);
    expect(TransferEndReasonSchema.options).toEqual([
      'declined_learner',
      'declined_source',
      'declined_destination',
      'cancelled_initiator',
      'withdrawn_learner',
      'expired',
      'destination_archived',
      'learner_left_source',
    ]);
    expect(TransferBlockReasonSchema.options).toEqual(['cap_class', 'cap_school', 'cap_learner']);
    expect(ConsentResetReasonSchema.options).toEqual(['terms_changed', 'guardian_changed', 'lapsed']);
  });

  it('lists the strict values consumers narrow the lenient inbox strings to', () => {
    expect(TransferStepStateSchema.options).toEqual(['waiting', 'yes']);
    expect(TransferLearnerRouteSchema.options).toEqual(['caregiver', 'device', 'none']);
    expect(TransferEndedFromSchema.options).toEqual(['family', 'device']);
    expect(TransferPremiumChangeSchema.options).toEqual(['none', 'may_change']);
  });
});

describe('TransferIdSchema', () => {
  it('accepts transfer:<uuid> and nothing else', () => {
    expect(TransferIdSchema.safeParse('transfer:0b6f2a3c-1d4e-4f5a-9b8c-7d6e5f4a3b2c').success).toBe(true);
    expect(TransferIdSchema.safeParse('relink:0b6f2a3c').success).toBe(false);
    expect(TransferIdSchema.safeParse('transfer:').success).toBe(false);
    expect(TransferIdSchema.safeParse('transfer:ABC').success).toBe(false);
    expect(TransferIdSchema.safeParse('transfer:abc/../x').success).toBe(false);
  });
});

describe('console request bodies are strict (F-SPACE-002 §4.4)', () => {
  it('consent carries a text version and a UI locale, nothing else', () => {
    expect(TransferConsentSchema.parse(consent)).toEqual(consent);
    expect(TransferConsentSchema.safeParse({ ...consent, locale: 'ko' }).success).toBe(true);
    expect(TransferConsentSchema.safeParse({ ...consent, locale: 'fr' }).success).toBe(false);
    expect(TransferConsentSchema.safeParse({ ...consent, textVersion: '' }).success).toBe(false);
    expect(TransferConsentSchema.safeParse({ ...consent, attest: 'self' }).success).toBe(false);
  });

  it('consent may carry the terms digest the preview returned: 64 lowercase hex characters, optional', () => {
    const digest = 'a1'.repeat(32);
    expect(TransferConsentSchema.parse({ ...consent, termsDigest: digest })).toEqual({ ...consent, termsDigest: digest });
    expect(TransferConsentSchema.safeParse({ ...consent, termsDigest: 'A1'.repeat(32) }).success).toBe(false);
    expect(TransferConsentSchema.safeParse({ ...consent, termsDigest: 'a1'.repeat(31) }).success).toBe(false);
    expect(TransferConsentSchema.safeParse({ ...consent, termsDigest: '' }).success).toBe(false);
    expect(TransferConsentSchema.parse(consent)).not.toHaveProperty('termsDigest');
  });

  it('preview: learner and code, optional fromSpaceId; normalizes the code', () => {
    const ok = TransferPreviewBodySchema.parse({ learnerId: 'profile:mina', code: 'abc-def', fromSpaceId: 'space:a' });
    expect(ok).toEqual({ learnerId: 'profile:mina', code: 'ABCDEF', fromSpaceId: 'space:a' });
    expect(TransferPreviewBodySchema.safeParse({ learnerId: 'profile:mina', code: 'ABCDEF' }).success).toBe(true);
    expect(TransferPreviewBodySchema.safeParse({ learnerId: 'mina', code: 'ABCDEF' }).success).toBe(false);
    expect(TransferPreviewBodySchema.safeParse({ learnerId: 'profile:mina', code: 'O0' }).success).toBe(false);
    expect(TransferPreviewBodySchema.safeParse({ learnerId: 'profile:mina', code: 'ABCDEF', destinationSpaceId: 'space:b' }).success).toBe(
      false,
    );
  });

  it('create: destination proven by id and code; unknown key is refused', () => {
    const body = { learnerId: 'profile:mina', destinationSpaceId: 'space:b', code: 'ABCDEF' };
    expect(TransferCreateBodySchema.parse(body)).toEqual(body);
    const family = { ...body, fromSpaceId: 'space:a', introduce: true, consent };
    expect(TransferCreateBodySchema.parse(family)).toEqual(family);
    expect(TransferCreateBodySchema.safeParse({ ...body, displayName: 'Mina' }).success).toBe(false);
    expect(TransferCreateBodySchema.safeParse({ ...body, destinationSpaceId: 'b' }).success).toBe(false);
    expect(TransferCreateBodySchema.safeParse({ ...body, consent: { ...consent, extra: 1 } }).success).toBe(false);
  });

  it('approve: the learner slot needs consent; slots are 1-3 and unique', () => {
    expect(TransferApproveBodySchema.parse({ slots: ['source', 'destination'] })).toEqual({ slots: ['source', 'destination'] });
    expect(TransferApproveBodySchema.parse({ slots: ['learner'], consent, introduce: false })).toEqual({
      slots: ['learner'],
      consent,
      introduce: false,
    });
    const noConsent = TransferApproveBodySchema.safeParse({ slots: ['learner'] });
    expect(noConsent.success).toBe(false);
    expect(noConsent.error?.issues[0]?.path).toEqual(['consent']);
    expect(TransferApproveBodySchema.safeParse({ slots: [] }).success).toBe(false);
    expect(TransferApproveBodySchema.safeParse({ slots: ['source', 'source'] }).success).toBe(false);
    expect(TransferApproveBodySchema.safeParse({ slots: ['owner'] }).success).toBe(false);
    expect(TransferApproveBodySchema.safeParse({ slots: ['source'], via: 'school_admin' }).success).toBe(false);
  });

  it('decline: a reason only on the destination slot', () => {
    expect(TransferDeclineBodySchema.parse({ slot: 'destination', reason: 'no_room' })).toEqual({ slot: 'destination', reason: 'no_room' });
    expect(TransferDeclineBodySchema.parse({ slot: 'source' })).toEqual({ slot: 'source' });
    const sourceReason = TransferDeclineBodySchema.safeParse({ slot: 'source', reason: 'not_now' });
    expect(sourceReason.success).toBe(false);
    expect(sourceReason.error?.issues[0]?.path).toEqual(['reason']);
    expect(TransferDeclineBodySchema.safeParse({ slot: 'destination', reason: 'too busy' }).success).toBe(false);
    expect(TransferDeclineBodySchema.safeParse({ slot: 'destination', note: 'x' }).success).toBe(false);
  });

  it('cancel, retry and device decline/cancel take an empty body', () => {
    expect(TransferEmptyBodySchema.parse({})).toEqual({});
    expect(TransferEmptyBodySchema.safeParse({ reason: 'x' }).success).toBe(false);
  });

  it('family prefs: blockTeacherRequests only', () => {
    expect(TransferFamilyPrefsBodySchema.parse({ blockTeacherRequests: true })).toEqual({ blockTeacherRequests: true });
    expect(TransferFamilyPrefsBodySchema.safeParse({ blockTeacherRequests: true, selfManaged: false }).success).toBe(false);
    expect(TransferFamilyPrefsBodySchema.safeParse({}).success).toBe(false);
  });
});

describe('device request bodies are strict', () => {
  const deviceConsent = { ...consent, attest: 'grown_up_pin' };

  it('preview: fromSpaceId and code', () => {
    expect(DeviceTransferPreviewBodySchema.parse({ fromSpaceId: 'space:a', code: 'abcdef' })).toEqual({ fromSpaceId: 'space:a', code: 'ABCDEF' });
    expect(DeviceTransferPreviewBodySchema.safeParse({ code: 'ABCDEF' }).success).toBe(false);
    expect(DeviceTransferPreviewBodySchema.safeParse({ fromSpaceId: 'space:a', code: 'ABCDEF', learnerId: 'profile:x' }).success).toBe(false);
  });

  it('create: consent with an attestation claim is required', () => {
    const body = { fromSpaceId: 'space:a', destinationSpaceId: 'space:b', code: 'ABCDEF', consent: deviceConsent };
    expect(DeviceTransferCreateBodySchema.parse(body)).toEqual(body);
    expect(DeviceTransferCreateBodySchema.parse({ ...body, introduce: true }).introduce).toBe(true);
    expect(DeviceTransferCreateBodySchema.safeParse({ ...body, consent }).success).toBe(false);
    expect(DeviceTransferCreateBodySchema.safeParse({ ...body, consent: { ...deviceConsent, attest: 'guardian' } }).success).toBe(false);
    expect(DeviceTransferCreateBodySchema.safeParse({ ...body, consent: { ...deviceConsent, basis: 'caregiver' } }).success).toBe(false);
    const { consent: _omit, ...withoutConsent } = body;
    expect(DeviceTransferCreateBodySchema.safeParse(withoutConsent).success).toBe(false);
  });

  it('approve: consent only', () => {
    expect(DeviceTransferApproveBodySchema.parse({ consent: { ...consent, attest: 'self' } })).toEqual({ consent: { ...consent, attest: 'self' } });
    expect(DeviceTransferApproveBodySchema.safeParse({}).success).toBe(false);
    expect(DeviceTransferApproveBodySchema.safeParse({ consent: deviceConsent, slots: ['learner'] }).success).toBe(false);
  });

  it('prefs: selfManaged only', () => {
    expect(DeviceTransferPrefsBodySchema.parse({ selfManaged: false })).toEqual({ selfManaged: false });
    expect(DeviceTransferPrefsBodySchema.safeParse({ selfManaged: 'yes' }).success).toBe(false);
    expect(DeviceTransferPrefsBodySchema.safeParse({ selfManaged: true, blockTeacherRequests: true }).success).toBe(false);
  });
});

describe('lenientArray', () => {
  const Item = z.object({ n: z.number() });

  it('keeps the elements that parse and drops the rest', () => {
    expect(lenientArray(Item).parse([{ n: 1 }, { n: 'two' }, null, { n: 3, extra: true }])).toEqual([{ n: 1 }, { n: 3 }]);
  });

  it('never fails: a missing or non-array value reads as empty', () => {
    expect(lenientArray(Item).parse(undefined)).toEqual([]);
    expect(lenientArray(Item).parse(null)).toEqual([]);
    expect(lenientArray(Item).parse({ n: 1 })).toEqual([]);
    expect(lenientArray(Item).parse('[]')).toEqual([]);
  });

  it('keeps element transforms and defaults', () => {
    const WithDefault = z.object({ n: z.number().default(0) });
    expect(lenientArray(WithDefault).parse([{}])).toEqual([{ n: 0 }]);
  });
});

describe('InboxTransferSchema is lenient on the wire', () => {
  it('parses a full row', () => {
    expect(InboxTransferSchema.parse(inboxTransfer)).toEqual(inboxTransfer);
  });

  it('keeps enum-like fields as strings, so a newer Worker value does not fail the row', () => {
    const newer = { ...inboxTransfer, status: 'paused', initiator: 'destination', learnerState: 'held', sourceState: 'maybe', learnerRoute: 'email' };
    expect(InboxTransferSchema.parse(newer).status).toBe('paused');
  });

  it('drops unknown keys and bad visibleToday entries instead of failing', () => {
    const row = InboxTransferSchema.parse({
      ...inboxTransfer,
      learnerId: 'profile:mina',
      visibleToday: [{ kind: 'family', name: 'Home', ownerName: null }, { kind: 'class' }],
    });
    expect(row).not.toHaveProperty('learnerId');
    expect(row.visibleToday).toEqual([{ kind: 'family', name: 'Home', ownerName: null }]);
  });

  it('reads termsDigest leniently: an older Worker omits it and a malformed value never drops the row', () => {
    const { termsDigest: _digest, ...older } = inboxTransfer;
    expect(InboxTransferSchema.parse(older).termsDigest).toBeNull();
    const digest = 'a1'.repeat(32);
    expect(InboxTransferSchema.parse({ ...inboxTransfer, termsDigest: digest }).termsDigest).toBe(digest);
    for (const bad of ['A1'.repeat(32), 'a1', 12, null, 'g'.repeat(64)]) {
      const row = InboxTransferSchema.safeParse({ ...inboxTransfer, termsDigest: bad });
      expect(row.success, String(bad)).toBe(true);
      expect(row.success && row.data.termsDigest, String(bad)).toBeNull();
    }
  });

  it('reads to.learnerCount leniently (T-5d): an older Worker omits it and a bad value never drops the row', () => {
    const { learnerCount: _count, ...olderTo } = inboxTransfer.to;
    expect(InboxTransferSchema.parse({ ...inboxTransfer, to: olderTo }).to.learnerCount).toBeNull();
    for (const bad of [-1, 1.5, '12', null, Number.NaN]) {
      const row = InboxTransferSchema.safeParse({ ...inboxTransfer, to: { ...inboxTransfer.to, learnerCount: bad } });
      expect(row.success, String(bad)).toBe(true);
      expect(row.success && row.data.to.learnerCount, String(bad)).toBeNull();
    }
    expect(InboxTransferSchema.parse({ ...inboxTransfer, to: { ...inboxTransfer.to, learnerCount: 0 } }).to.learnerCount).toBe(0);
  });

  it('rejects a row without an id or with a malformed one', () => {
    const { id: _id, ...noId } = inboxTransfer;
    expect(InboxTransferSchema.safeParse(noId).success).toBe(false);
    expect(InboxTransferSchema.safeParse({ ...inboxTransfer, id: 'x' }).success).toBe(false);
    expect(InboxTransferSchema.safeParse({ ...inboxTransfer, to: { spaceId: 'space:b', name: 'B' } }).success).toBe(false);
  });
});

/** SyncInboxSchema exactly as it was before F-SPACE-002 (what installed apps run today). */
const PreTransferSyncInboxSchema = z.object({
  rev: z.number().int().nonnegative(),
  plans: z.array(InboxPlanSchema),
  memberships: z.array(LearnerMembershipSchema),
  tier: z.enum(['free', 'premium']),
  tierSource: TierSourceSchema.nullable().default(null),
  tierValidUntil: z.string().nullable().default(null),
  serverTime: z.string(),
});

describe('SyncInboxSchema transfer additions (F-SPACE-002 §4.4)', () => {
  const membership = { spaceId: 'space:a', kind: 'class', name: 'Sunday Class A', role: 'student', joinedAt: 't' };
  const plan = {
    id: 'plan:1',
    spaceId: 'space:a',
    spaceKind: 'class',
    spaceName: 'Sunday Class A',
    title: 'Week 1',
    items: [{ kind: 'quest', id: 'quest:stage1-letters-q1' }],
    publishedAt: 't',
    updatedAt: 't',
  };
  const oldWorker = { rev: 2, plans: [plan], memberships: [membership], tier: 'premium', serverTime: 't' };
  const newWorker = {
    ...oldWorker,
    transfersEnabled: true,
    transferDeviceConsent: false,
    selfManaged: true,
    transfers: [inboxTransfer],
  };

  it('an installed app (pre-change schema) still parses an inbox that has the new fields', () => {
    const parsed = PreTransferSyncInboxSchema.safeParse(newWorker);
    expect(parsed.success).toBe(true);
    expect(parsed.data?.memberships).toEqual([membership]);
    expect(parsed.data?.plans).toHaveLength(1);
    expect(parsed.data?.tier).toBe('premium');
  });

  it('a new app reads an old Worker inbox with everything off and empty', () => {
    const inbox = SyncInboxSchema.parse(oldWorker);
    expect(inbox.transfersEnabled).toBe(false);
    expect(inbox.transferDeviceConsent).toBe(false);
    expect(inbox.selfManaged).toBe(false);
    expect(inbox.transfers).toEqual([]);
  });

  it('parses the new fields', () => {
    const inbox = SyncInboxSchema.parse(newWorker);
    expect(inbox.transfersEnabled).toBe(true);
    expect(inbox.selfManaged).toBe(true);
    expect(inbox.transfers).toEqual([inboxTransfer]);
  });

  it('a malformed transfer element never costs memberships, plans or tier', () => {
    const inbox = SyncInboxSchema.parse({ ...newWorker, transfers: [{ id: 'transfer:x' }, inboxTransfer, 'junk'] });
    expect(inbox.transfers).toEqual([inboxTransfer]);
    expect(inbox.memberships).toEqual([membership]);
    expect(inbox.plans).toHaveLength(1);
    expect(inbox.tier).toBe('premium');
  });

  it('an unknown status string still yields memberships, plans and tier', () => {
    const inbox = SyncInboxSchema.parse({ ...newWorker, transfers: [{ ...inboxTransfer, status: 'on_hold' }] });
    expect(inbox.transfers[0]?.status).toBe('on_hold');
    expect(TransferStatusSchema.safeParse(inbox.transfers[0]?.status).success).toBe(false);
    expect(inbox.memberships).toEqual([membership]);
    expect(inbox.plans).toHaveLength(1);
    expect(inbox.tier).toBe('premium');
  });

  it('a non-array transfers value reads as empty', () => {
    expect(SyncInboxSchema.parse({ ...newWorker, transfers: null }).transfers).toEqual([]);
  });

  it('deviceScope: the value the Worker sends, else null (unknown, never a guess), and never costs the rest', () => {
    expect(SyncInboxSchema.parse(oldWorker).deviceScope).toBeNull();
    expect(SyncInboxSchema.parse({ ...newWorker, deviceScope: 'class' }).deviceScope).toBe('class');
    expect(SyncInboxSchema.parse({ ...newWorker, deviceScope: 'full' }).deviceScope).toBe('full');
    const odd = SyncInboxSchema.parse({ ...newWorker, deviceScope: 'kiosk' });
    expect(odd.deviceScope).toBeNull();
    expect(odd.memberships).toEqual([membership]);
    expect(PreTransferSyncInboxSchema.safeParse({ ...newWorker, deviceScope: 'class' }).success).toBe(true);
  });
});
