import type { InboxTransfer } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import {
  PIN_MIN_AGE_MS,
  ageBucketOf,
  deviceAttest,
  initiatorOf,
  isOpenRequest,
  learnerRouteOf,
  moveRule,
  openRequestOf,
  requestAction,
  type DeviceFacts,
  type MoveFacts,
} from '../consent-gate';

/*
 * Device rules for a class move — F-SPACE-002 sections 4.11 (device rules)
 * and 4.12 (row variants), T-0b D8, D13, D16, D24 (`design/screens/transfer/
 * classes-card.md`). Pure: what the Classes card and the sheets may offer,
 * decided before any tap, so a PIN is never asked for a dead end.
 */

const NOW = Date.parse('2026-10-11T12:00:00.000Z');
const HOUR = 60 * 60 * 1000;

const child = { role: 'learner' as const, learnerType: 'child' as const };
const selfP = { role: 'learner' as const, learnerType: 'self' as const };
const legacy = { role: 'learner' as const };

const managed = (over: Partial<DeviceFacts> = {}): DeviceFacts => ({
  profile: child,
  profiles: [child],
  selfConsentAcceptedAt: null,
  parentPinHash: 'hash',
  pinCreatedAt: NOW - 25 * HOUR,
  now: NOW,
  ...over,
});
const selfOnly = (over: Partial<DeviceFacts> = {}): DeviceFacts => ({
  profile: selfP,
  profiles: [selfP],
  selfConsentAcceptedAt: '2026-09-01T00:00:00.000Z',
  parentPinHash: null,
  pinCreatedAt: null,
  now: NOW,
  ...over,
});
const facts = (over: Partial<MoveFacts> = {}, device: DeviceFacts = managed()): MoveFacts => ({
  scope: 'full',
  transfersEnabled: true,
  transferDeviceConsent: true,
  hasFamily: false,
  selfManaged: false,
  transfers: [],
  device,
  ...over,
});

const req = (over: Partial<InboxTransfer> = {}): InboxTransfer => ({
  id: 'transfer:0b6c2f4e-1111-4000-8000-000000000001',
  status: 'requested',
  initiator: 'learner_side',
  from: { spaceId: 'space:a', name: 'Sunday Class A' },
  to: { spaceId: 'space:b', name: 'Saturday Class B', ownerName: 'Ms Park', schoolName: null, ageBucket: 'months', learnerCount: 12 },
  learnerState: 'consented',
  sourceState: 'waiting',
  destinationState: 'waiting',
  introduce: false,
  premiumChange: 'none',
  destinationConsentMode: 'parent',
  relinkAffected: false,
  sourcePlansAffected: false,
  visibleToday: [],
  blockReason: null,
  executeAfter: null,
  expiresAt: '2026-10-25T12:00:00.000Z',
  learnerRoute: 'device',
  canVeto: true,
  endedFrom: null,
  termsDigest: null,
  ...over,
});

describe('deviceAttest: which claim this device may make (section 4.11)', () => {
  it('a self learner with a self consent attests self, with or without a PIN', () => {
    expect(deviceAttest(selfOnly())).toEqual({ kind: 'attest', attest: 'self' });
    expect(deviceAttest(selfOnly({ parentPinHash: 'hash', pinCreatedAt: NOW - HOUR }))).toEqual({ kind: 'attest', attest: 'self' });
  });

  it('a self learner without a self consent may claim nothing (no Move, no line)', () => {
    expect(deviceAttest(selfOnly({ selfConsentAcceptedAt: null }))).toEqual({ kind: 'none' });
    expect(deviceAttest(selfOnly({ selfConsentAcceptedAt: null, parentPinHash: 'hash', pinCreatedAt: null }))).toEqual({ kind: 'none' });
  });

  it('a managed learner attests the grown-up PIN once the PIN is a day old', () => {
    expect(deviceAttest(managed({ pinCreatedAt: NOW - PIN_MIN_AGE_MS }))).toEqual({ kind: 'attest', attest: 'grown_up_pin' });
    expect(deviceAttest(managed({ pinCreatedAt: NOW - PIN_MIN_AGE_MS + 1 }))).toEqual({ kind: 'pin_too_new' });
    expect(deviceAttest(managed({ pinCreatedAt: NOW }))).toEqual({ kind: 'pin_too_new' });
  });

  it('a PIN older than this feature (no creation time) counts as old enough', () => {
    expect(deviceAttest(managed({ pinCreatedAt: null }))).toEqual({ kind: 'attest', attest: 'grown_up_pin' });
  });

  it('a managed learner with no PIN needs one first', () => {
    expect(deviceAttest(managed({ parentPinHash: null, pinCreatedAt: null }))).toEqual({ kind: 'needs_pin' });
    expect(deviceAttest(managed({ parentPinHash: null, pinCreatedAt: NOW - 100 * HOUR }))).toEqual({ kind: 'needs_pin' });
  });

  it('a relinked or restored profile (no learner type) reads as managed: the PIN branch only, never self', () => {
    expect(deviceAttest(managed({ profile: legacy, profiles: [legacy], selfConsentAcceptedAt: '2026-09-01T00:00:00.000Z' }))).toEqual({ kind: 'attest', attest: 'grown_up_pin' });
    expect(deviceAttest(managed({ profile: legacy, profiles: [legacy], parentPinHash: null }))).toEqual({ kind: 'needs_pin' });
  });

  it('a creation time in the future is never old enough', () => {
    expect(deviceAttest(managed({ pinCreatedAt: NOW + HOUR }))).toEqual({ kind: 'pin_too_new' });
  });
});

describe('moveRule with no open request (classes-card.md, D16)', () => {
  it('nothing new while the inbox says transfers are off, whatever else is true', () => {
    expect(moveRule(facts({ transfersEnabled: false }))).toEqual({ variant: 'hidden' });
    expect(moveRule(facts({ transfersEnabled: false, scope: 'class' }))).toEqual({ variant: 'hidden' });
  });

  it('(a) a class-scoped device: the rescue-code line, before anything else', () => {
    expect(moveRule(facts({ scope: 'class' }))).toEqual({ variant: 'class_scope' });
    expect(moveRule(facts({ scope: 'class', transferDeviceConsent: false }))).toEqual({ variant: 'class_scope' });
  });

  it('device consent off (launch state until G6): nothing', () => {
    expect(moveRule(facts({ transferDeviceConsent: false }))).toEqual({ variant: 'hidden' });
  });

  it('(b) a family membership and not self-managed: nothing until a request exists', () => {
    expect(moveRule(facts({ hasFamily: true }))).toEqual({ variant: 'hidden' });
    expect(moveRule(facts({ hasFamily: true, selfManaged: true }))).toMatchObject({ variant: 'move' });
  });

  it('(c) Move: gated on a managed device, direct on a self-only device with no PIN', () => {
    expect(moveRule(facts())).toEqual({ variant: 'move', attest: 'grown_up_pin', gated: true });
    expect(moveRule(facts({}, selfOnly()))).toEqual({ variant: 'move', attest: 'self', gated: false });
    expect(moveRule(facts({}, selfOnly({ parentPinHash: 'hash', pinCreatedAt: NOW })))).toEqual({ variant: 'move', attest: 'self', gated: true });
    expect(moveRule(facts({}, selfOnly({ profiles: [selfP, child] })))).toEqual({ variant: 'move', attest: 'self', gated: true });
  });

  it('(d) no PIN, and a PIN made less than a day ago', () => {
    expect(moveRule(facts({}, managed({ parentPinHash: null, pinCreatedAt: null })))).toEqual({ variant: 'needs_pin' });
    expect(moveRule(facts({}, managed({ pinCreatedAt: NOW - HOUR })))).toEqual({ variant: 'pin_too_new' });
  });

  it('a profile that matches no branch shows nothing', () => {
    expect(moveRule(facts({}, selfOnly({ selfConsentAcceptedAt: null })))).toEqual({ variant: 'hidden' });
  });

  it('an open request shows no Move: the pending row is the only action; ended and executed rows do not count', () => {
    expect(moveRule(facts({ transfers: [req()] }))).toEqual({ variant: 'request' });
    expect(moveRule(facts({ transfers: [req({ status: 'approved' })] }))).toEqual({ variant: 'request' });
    expect(moveRule(facts({ transfers: [req({ status: 'declined' }), req({ status: 'executed' })] }))).toEqual({ variant: 'move', attest: 'grown_up_pin', gated: true });
    expect(moveRule(facts({ scope: 'class', transfers: [req()] }))).toEqual({ variant: 'class_scope' });
  });
});

describe('requestAction for an open request (classes-card.md table 1, app-sheets.md)', () => {
  it('route caregiver: a gated Review that opens the read-only sheet; its only action is the veto', () => {
    expect(requestAction(req({ initiator: 'source', learnerState: 'pending', learnerRoute: 'caregiver' }), managed())).toEqual({ sheet: 'read_only', veto: 'decline', answerHere: false, cannotAnswerHere: false, gated: true, pinSetupFirst: false });
    expect(requestAction(req({ learnerState: 'pending', learnerRoute: 'caregiver' }), managed())).toMatchObject({ sheet: 'read_only', veto: 'cancel' });
  });

  it('route device with the learner consent reset: ApproveTransfer, when this device may still attest', () => {
    expect(requestAction(req({ learnerState: 'pending' }), managed())).toEqual({ sheet: 'approve', attest: 'grown_up_pin', veto: 'decline', answerHere: true, cannotAnswerHere: false, gated: true, pinSetupFirst: false });
    expect(requestAction(req({ learnerState: 'pending' }), selfOnly())).toEqual({ sheet: 'approve', attest: 'self', veto: 'decline', answerHere: true, cannotAnswerHere: false, gated: false, pinSetupFirst: false });
    // A PIN made too recently, or a profile with no claim: the read-only sheet, never a dead-end yes.
    expect(requestAction(req({ learnerState: 'pending' }), managed({ pinCreatedAt: NOW }))).toMatchObject({ sheet: 'read_only', veto: 'cancel', answerHere: false });
    expect(requestAction(req({ learnerState: 'pending' }), selfOnly({ selfConsentAcceptedAt: null }))).toMatchObject({ sheet: 'read_only', veto: 'cancel' });
  });

  it('route device in any other state: the read-only sheet with the veto (nothing to answer)', () => {
    expect(requestAction(req(), managed())).toEqual({ sheet: 'read_only', veto: 'cancel', answerHere: false, cannotAnswerHere: false, gated: true, pinSetupFirst: false });
  });

  it('route none: the read-only sheet, the veto, and "This move can\'t be answered here."', () => {
    expect(requestAction(req({ initiator: 'source', learnerState: 'pending', learnerRoute: 'none' }), managed())).toMatchObject({ sheet: 'read_only', veto: 'decline', cannotAnswerHere: true });
    expect(requestAction(req({ learnerState: 'pending', learnerRoute: 'none' }), managed())).toMatchObject({ sheet: 'read_only', veto: 'cancel', cannotAnswerHere: true });
  });

  it('a teacher request the grown-up already agreed to: no "can\'t be answered" line, still the veto', () => {
    expect(requestAction(req({ initiator: 'source', learnerState: 'consented', learnerRoute: 'none' }), managed())).toMatchObject({ sheet: 'read_only', veto: 'decline', cannotAnswerHere: false });
  });

  it('a route this app does not know reads as none; an unknown initiator reads learner-side (Cancel the request)', () => {
    expect(requestAction(req({ learnerState: 'pending', learnerRoute: 'carrier-pigeon' }), managed())).toMatchObject({ sheet: 'read_only', cannotAnswerHere: true });
    expect(requestAction(req({ initiator: 'principal', learnerState: 'pending', learnerRoute: 'device' }), managed())).toMatchObject({ sheet: 'approve', veto: 'decline' });
    expect(requestAction(req({ initiator: 'principal', learnerRoute: 'caregiver' }), managed())).toMatchObject({ sheet: 'read_only', veto: 'cancel' });
  });

  it('planned (approved, no room block): the veto is Cancel the move', () => {
    expect(requestAction(req({ status: 'approved', executeAfter: '2026-10-13T12:00:00.000Z', initiator: 'source' }), managed())).toMatchObject({ sheet: 'planned', veto: 'cancel' });
    expect(requestAction(req({ status: 'approved', blockReason: 'cap_class', initiator: 'source' }), managed())).toMatchObject({ sheet: 'read_only', veto: 'cancel' });
  });

  it('a managed device with no PIN runs the PIN setup first, then the read-only sheet (D24); a self-only device with no PIN opens directly', () => {
    expect(requestAction(req({ initiator: 'source', learnerState: 'pending', learnerRoute: 'caregiver' }), managed({ parentPinHash: null, pinCreatedAt: null }))).toEqual({
      sheet: 'read_only',
      veto: 'decline',
      answerHere: false,
      cannotAnswerHere: false,
      gated: true,
      pinSetupFirst: true,
    });
    expect(requestAction(req({ learnerState: 'pending', learnerRoute: 'device' }), managed({ parentPinHash: null, pinCreatedAt: null }))).toMatchObject({ sheet: 'read_only', pinSetupFirst: true });
    expect(requestAction(req({ learnerRoute: 'caregiver' }), selfOnly())).toMatchObject({ gated: false, pinSetupFirst: false });
  });

  it('a request that is no longer open has no action', () => {
    for (const status of ['declined', 'expired', 'cancelled', 'executed', 'unknown-status']) expect(requestAction(req({ status }), managed())).toBeNull();
  });
});

describe('fallbacks for values this app does not know (classes-card.md, Unknown values)', () => {
  it('learnerRoute, initiator and ageBucket', () => {
    expect(['caregiver', 'device', 'none', 'x', ''].map(learnerRouteOf)).toEqual(['caregiver', 'device', 'none', 'none', 'none']);
    expect(['source', 'learner_side', 'teacher', ''].map(initiatorOf)).toEqual(['source', 'learner_side', 'learner_side', 'learner_side']);
    expect(['days', 'weeks', 'months', 'years', 'decades', null].map(ageBucketOf)).toEqual(['days', 'weeks', 'months', 'years', null, null]);
  });

  it('isOpenRequest and openRequestOf read only requested and approved rows', () => {
    expect(['requested', 'approved', 'executed', 'declined', 'zzz'].map((status) => isOpenRequest(req({ status })))).toEqual([true, true, false, false, false]);
    expect(openRequestOf([req({ status: 'declined', id: 'transfer:a' }), req({ id: 'transfer:b' })])?.id).toBe('transfer:b');
    expect(openRequestOf([req({ status: 'expired' })])).toBeNull();
  });
});
