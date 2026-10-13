import type { InboxTransfer } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import type { DeviceFacts } from '../consent-gate';
import { classesCardView, homeLineView, moveErrorLine, readOnlySheetView, type CardInput, type TransfersFacts } from '../transfer-views';

/*
 * What the Classes card, the Home line and the read-only sheet draw for a class move — F-SPACE-002
 * section 4.12, T-7b and T-7c (`design/screens/transfer/classes-card.md`, `app-sheets.md`). Pure:
 * the route is decided from the inbox before any tap, so a PIN is never asked for a yes the device
 * cannot give, and a class-scoped device never sees Move.
 */

const en = getMessages('en');
const t = en.caregiver.transfer;
const NOW = Date.parse('2026-10-11T12:00:00.000Z');
const HOUR = 60 * 60 * 1000;
const child = { role: 'learner' as const, learnerType: 'child' as const };
const selfP = { role: 'learner' as const, learnerType: 'self' as const };

const managed = (over: Partial<DeviceFacts> = {}): DeviceFacts => ({ profile: child, profiles: [child], selfConsentAcceptedAt: null, parentPinHash: 'hash', pinCreatedAt: NOW - 25 * HOUR, now: NOW, ...over });
const selfOnly = (over: Partial<DeviceFacts> = {}): DeviceFacts => ({ profile: selfP, profiles: [selfP], selfConsentAcceptedAt: '2026-09-01T00:00:00.000Z', parentPinHash: null, pinCreatedAt: null, now: NOW, ...over });

const req = (over: Partial<InboxTransfer> = {}): InboxTransfer => ({
  id: 'transfer:one',
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

const transfers = (over: Partial<TransfersFacts> = {}): TransfersFacts => ({ enabled: true, deviceConsent: true, selfManaged: false, scope: 'full', requests: [], ...over });
const input = (over: Partial<CardInput> = {}): CardInput => ({ transfers: transfers(), memberships: [{ kind: 'class' }], device: managed(), online: true, ...over });
const date = (iso: string): string => `<${iso.slice(0, 10)}>`;

describe('classesCardView (T-7b)', () => {
  it('draws nothing new while the inbox says transfers are off, or has not been read', () => {
    expect(classesCardView(input({ transfers: transfers({ enabled: false }) }), t, date)).toEqual({ move: null, pending: null, line: null, setUpPin: false });
    expect(classesCardView(input({ transfers: null }), t, date)).toEqual({ move: null, pending: null, line: null, setUpPin: false });
  });

  it('(a) a class-scoped device: no Move, only "Use your rescue code first."', () => {
    const v = classesCardView(input({ transfers: transfers({ scope: 'class', requests: [req({ learnerState: 'pending' })] }) }), t, date);
    expect(v).toEqual({ move: null, pending: null, line: 'Use your rescue code first.', setUpPin: false });
  });

  it('device consent off: the card reads as today', () => {
    expect(classesCardView(input({ transfers: transfers({ deviceConsent: false }) }), t, date)).toEqual({ move: null, pending: null, line: null, setUpPin: false });
  });

  it('(b) a family account answers and nothing is asked: nothing', () => {
    expect(classesCardView(input({ memberships: [{ kind: 'class' }, { kind: 'family' }] }), t, date).move).toBeNull();
  });

  it('(c) Move on every class row: gated on a managed device, direct on a self-only device with no PIN', () => {
    expect(classesCardView(input(), t, date).move).toEqual({ gated: true, disabled: false });
    expect(classesCardView(input({ device: selfOnly() }), t, date).move).toEqual({ gated: false, disabled: false });
  });

  it('(c) offline: Move stays, disabled', () => {
    expect(classesCardView(input({ online: false }), t, date).move).toEqual({ gated: true, disabled: true });
  });

  it('(d) a managed device with no PIN: the PIN line and Set up PIN; (d\') a PIN younger than a day: its own line, no button', () => {
    expect(classesCardView(input({ device: managed({ parentPinHash: null }) }), t, date)).toEqual({ move: null, pending: null, line: 'A grown-up needs to set up a PIN first. Open Profile, then Grown-up zone.', setUpPin: true });
    expect(classesCardView(input({ device: managed({ pinCreatedAt: NOW - 2 * HOUR }) }), t, date)).toEqual({ move: null, pending: null, line: 'Moves open one day after the PIN is set.', setUpPin: false });
  });

  it('a self profile without its consent shows nothing', () => {
    expect(classesCardView(input({ device: selfOnly({ selfConsentAcceptedAt: null }) }), t, date)).toEqual({ move: null, pending: null, line: null, setUpPin: false });
  });

  it('(b) a teacher asked, route caregiver: the pending row with a ghost gated Review, and the console line', () => {
    const v = classesCardView(input({ transfers: transfers({ requests: [req({ initiator: 'source', learnerState: 'pending', learnerRoute: 'caregiver' })] }) }), t, date);
    expect(v.move).toBeNull();
    expect(v.pending).toEqual({ transferId: 'transfer:one', text: 'Sunday Class A asked about a move.', room: null, button: 'review', primary: false, gated: true });
    expect(v.line).toBe('Ask the grown-up with the account to answer this in the console.');
  });

  it('a teacher asked and the grown-up said yes: waiting for the other class (or both)', () => {
    const one = classesCardView(input({ transfers: transfers({ requests: [req({ initiator: 'source', learnerState: 'consented', sourceState: 'yes', learnerRoute: 'caregiver' })] }) }), t, date);
    expect(one.pending?.text).toBe('Sunday Class A asked about a move. Waiting for the other class to answer.');
    expect(one.line).toBeNull();
    const both = classesCardView(input({ transfers: transfers({ requests: [req({ initiator: 'source', learnerState: 'consented', learnerRoute: 'caregiver' })] }) }), t, date);
    expect(both.pending?.text).toBe('Sunday Class A asked about a move. Waiting for the classes to answer.');
  });

  it('(c) learner consent reset on route device: the primary Review asks this device', () => {
    const v = classesCardView(input({ transfers: transfers({ requests: [req({ learnerState: 'pending' })] }) }), t, date);
    expect(v.pending).toMatchObject({ text: 'Asked: a move to Saturday Class B. Please check this again.', button: 'review', primary: true, gated: true });
    expect(v.line).toBeNull();
  });

  it('a reset learner request the device cannot answer yet keeps the veto and says why (PIN split)', () => {
    const noPin = classesCardView(input({ device: managed({ parentPinHash: null }), transfers: transfers({ requests: [req({ learnerState: 'pending' })] }) }), t, date);
    expect(noPin.pending).toMatchObject({ primary: false, gated: true });
    expect(noPin.line).toBe('A grown-up needs to set up a PIN first. Open Profile, then Grown-up zone.');
    expect(noPin.setUpPin).toBe(true);
    const young = classesCardView(input({ device: managed({ pinCreatedAt: NOW - HOUR }), transfers: transfers({ requests: [req({ learnerState: 'pending' })] }) }), t, date);
    expect(young.line).toBe('Moves open one day after the PIN is set.');
    expect(young.setUpPin).toBe(false);
  });

  it('route none: its own line, never a primary', () => {
    const teacher = classesCardView(input({ transfers: transfers({ requests: [req({ initiator: 'source', learnerState: 'pending', learnerRoute: 'none' })] }) }), t, date);
    expect(teacher.pending).toMatchObject({ text: "Sunday Class A asked about a move. This move can't be answered here.", primary: false });
    const learner = classesCardView(input({ transfers: transfers({ requests: [req({ learnerState: 'pending', learnerRoute: 'none' })] }) }), t, date);
    expect(learner.pending?.text).toBe("Asked: a move to Saturday Class B. This move can't be answered here.");
    // A value this app does not know reads as none.
    const unknown = classesCardView(input({ transfers: transfers({ requests: [req({ learnerState: 'pending', learnerRoute: 'family' })] }) }), t, date);
    expect(unknown.pending).toMatchObject({ primary: false, text: "Asked: a move to Saturday Class B. This move can't be answered here." });
  });

  it('a learner-side request waiting for the classes', () => {
    const v = classesCardView(input({ transfers: transfers({ requests: [req({ destinationState: 'yes' })] }) }), t, date);
    expect(v.pending).toMatchObject({ text: 'Asked: a move to Saturday Class B. Waiting for the other class to answer.', primary: false });
  });

  it('approved and waiting for room: the room block with Review', () => {
    const v = classesCardView(input({ transfers: transfers({ requests: [req({ status: 'approved', blockReason: 'cap_class' })] }) }), t, date);
    expect(v.pending).toMatchObject({ text: 'Asked: a move to Saturday Class B.', room: 'Waiting for room in the new class.', button: 'review' });
  });

  it('planned (cooling-off): the date with a gated Cancel', () => {
    const v = classesCardView(input({ transfers: transfers({ requests: [req({ status: 'approved', executeAfter: '2026-10-14T09:00:00.000Z' })] }) }), t, date);
    expect(v.pending).toMatchObject({ text: 'A move is planned for <2026-10-14>.', button: 'cancel', gated: true, room: null });
  });

  it('a managed device with no PIN still gets the gated Review (D24: the PIN is made for the veto)', () => {
    const v = classesCardView(input({ device: managed({ parentPinHash: null }), transfers: transfers({ requests: [req({ initiator: 'source', learnerState: 'pending', learnerRoute: 'caregiver' })] }) }), t, date);
    expect(v.pending).toMatchObject({ gated: true, primary: false });
  });

  it('an ended request still listed: one neutral line, and Move stays when it applies', () => {
    const v = classesCardView(input({ transfers: transfers({ requests: [req({ status: 'declined' })] }) }), t, date);
    expect(v.line).toBe('This request ended.');
    expect(v.move).toEqual({ gated: true, disabled: false });
  });
});

describe('homeLineView (T-7c)', () => {
  const home = (requests: InboxTransfer[], device: DeviceFacts = managed()) => homeLineView({ transfers: transfers({ requests }), device, learnerName: 'Mina' }, t, date);

  it('nothing with no open request, while transfers are off, or on a class-scoped device', () => {
    expect(home([])).toBeNull();
    expect(homeLineView({ transfers: transfers({ enabled: false, requests: [req({ learnerState: 'pending' })] }), device: managed(), learnerName: 'Mina' }, t, date)).toBeNull();
    expect(homeLineView({ transfers: transfers({ scope: 'class', requests: [req({ learnerState: 'pending' })] }), device: managed(), learnerName: 'Mina' }, t, date)).toBeNull();
    expect(homeLineView({ transfers: null, device: managed(), learnerName: 'Mina' }, t, date)).toBeNull();
  });

  it('teacher-started, learner slot waiting (any route)', () => {
    expect(home([req({ initiator: 'source', learnerState: 'pending', learnerRoute: 'caregiver' })])).toEqual({
      transferId: 'transfer:one',
      text: 'Sunday Class A asked about moving Mina to Saturday Class B.',
      button: 'review',
      gated: true,
    });
  });

  it('learner-side reset on route device: managed and self wording', () => {
    expect(home([req({ learnerState: 'pending' })])?.text).toBe('A move to Saturday Class B is waiting.');
    expect(home([req({ learnerState: 'pending' })], selfOnly())).toEqual({ transferId: 'transfer:one', text: 'A move is waiting for you.', button: 'review', gated: false });
  });

  it('learner-side reset on route caregiver or none: the managed wording, gated', () => {
    expect(home([req({ learnerState: 'pending', learnerRoute: 'caregiver' })])).toMatchObject({ text: 'A move to Saturday Class B is waiting.', gated: true });
    expect(home([req({ learnerState: 'pending', learnerRoute: 'none' })])).toMatchObject({ text: 'A move to Saturday Class B is waiting.' });
  });

  it('waiting for the classes or for room: no Home line', () => {
    expect(home([req()])).toBeNull();
    expect(home([req({ status: 'approved', blockReason: 'cap_class' })])).toBeNull();
  });

  it('planned: the date and Cancel', () => {
    expect(home([req({ status: 'approved', executeAfter: '2026-10-14T09:00:00.000Z' })])).toEqual({ transferId: 'transfer:one', text: 'A move is planned for <2026-10-14>.', button: 'cancel', gated: true });
  });
});

describe('readOnlySheetView (guard 11: the veto and Back only)', () => {
  const view = (r: InboxTransfer, device: DeviceFacts = managed()) => readOnlySheetView(r, device, 'Mina', t);

  it('teacher-started, caregiver route: where the yes happens, and Not now with its description', () => {
    expect(view(req({ initiator: 'source', learnerState: 'pending', learnerRoute: 'caregiver' }))).toEqual({
      lines: ['Sunday Class A asked about moving Mina to Saturday Class B.', 'A grown-up with an account answers this in the console.'],
      room: null,
      veto: 'decline',
      vetoNote: 'Not now ends this request.',
    });
  });

  it('teacher-started, consented: waiting line; route none: cannot answer here', () => {
    expect(view(req({ initiator: 'source', learnerState: 'consented', learnerRoute: 'caregiver' })).lines[1]).toBe('Waiting for the classes to answer.');
    expect(view(req({ initiator: 'source', learnerState: 'pending', learnerRoute: 'none' })).lines[1]).toBe("This move can't be answered here.");
  });

  it('learner-side waiting for the classes: Cancel the request', () => {
    expect(view(req({ sourceState: 'yes' }))).toEqual({ lines: ['Asked: a move to Saturday Class B.', 'Waiting for the other class to answer.'], room: null, veto: 'cancel', vetoNote: null });
  });

  it('approved, waiting for room: the room block', () => {
    expect(view(req({ status: 'approved', blockReason: 'cap_class' }))).toEqual({ lines: ['Asked: a move to Saturday Class B.'], room: 'Waiting for room in the new class.', veto: 'cancel', vetoNote: null });
  });

  it('learner-side reset on caregiver, none, or a device that cannot answer yet', () => {
    expect(view(req({ learnerState: 'pending', learnerRoute: 'caregiver' })).lines).toEqual(['Asked: a move to Saturday Class B. Please check this again.', 'A grown-up with an account answers this in the console.']);
    expect(view(req({ learnerState: 'pending', learnerRoute: 'none' })).lines[1]).toBe("This move can't be answered here.");
    expect(view(req({ learnerState: 'pending' }), managed({ pinCreatedAt: NOW - HOUR })).lines[1]).toBe('Moves open one day after the PIN is set.');
    expect(view(req({ learnerState: 'pending' }), managed({ parentPinHash: null })).lines[1]).toBe('A grown-up needs to set up a PIN first. Open Profile, then Grown-up zone.');
  });

  it('an unknown initiator reads learner-side, with Cancel the request', () => {
    expect(view(req({ initiator: 'robot', learnerState: 'consented' })).veto).toBe('cancel');
  });
});

describe('moveErrorLine (MoveClass answers, one at a time)', () => {
  const line = (error: string, startedBy?: 'class' | 'learner_side') => moveErrorLine({ ok: false, error, ...(startedBy ? { startedBy } : {}) }, 'Mina', en.caregiver);

  it('maps every answer of app-sheets.md to its line', () => {
    expect(line('code_not_found')).toBe("That code didn't work.");
    expect(line('invalid_code')).toBe("That code didn't work.");
    expect(line('code_expired')).toBe('That code is too old. Ask for a new one.');
    expect(line('cap_class')).toBe('That class is full right now.');
    expect(line('cap_school')).toBe('That class is full right now.');
    expect(line('already_member')).toBe('Mina is already in that class.');
    expect(line('too_many_attempts')).toBe('Too many tries. Try again later.');
    expect(line('cooldown')).toBe('You can ask again in about a week.');
    expect(line('caregiver_required')).toBe('Ask the grown-up with the account to start this move in the console.');
    expect(line('device_consent_locked')).toBe("Moves can't be started on this device yet.");
    expect(line('already_open', 'class')).toBe('A class already asked about moving Mina. Look on the Classes & family card.');
    expect(line('already_open', 'learner_side')).toBe('A move for Mina is already waiting. Look on the Classes & family card.');
    expect(line('already_open')).toBe('A move for Mina is already waiting. Look on the Classes & family card.');
    expect(line('same_space')).toBe('That code is for the class Mina is in now.');
    expect(line('not_transferable')).toBe("That code can't be used for a move.");
    expect(line('destination_busy')).toBe('That class has many moves waiting. Try again in a few days.');
    expect(line('too_many_requests')).toBe('Too many moves were started today. Try again tomorrow.');
    expect(line('consent_locale_unavailable')).toBe('Not available in your language yet.');
  });

  it('offline, no API, a locked switch or anything unknown: calm retry lines, nothing queued', () => {
    expect(line('network')).toBe('This needs internet. Try again when you are online.');
    expect(line('off')).toBe('This needs internet. Try again when you are online.');
    expect(line('transfers_locked')).toBe("Moves can't be started on this device yet.");
    expect(line('mystery')).toBe('Something went wrong. Try again in a moment.');
  });
});
