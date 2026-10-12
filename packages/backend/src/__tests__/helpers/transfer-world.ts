import { TRANSFER_CONSENT_TEXT_VERSION, type Space } from '@hangul-route/content-schema';
import { expect } from 'vitest';
import type { StoredTransfer } from '../../db';
import app from '../../index';
import { newRequest } from '../../lib/transfer';
import { testDb as db } from './db';

/*
 * The world the class-transfer route suites share (F-SPACE-002 section 4.4):
 * accounts, classes, families and learners, request helpers and Db-level
 * seeding. Runs in memory and, with HR_TEST_DB=sqlite, through the shim.
 */
export type Envelope = { ok: boolean; data?: Record<string, unknown>; error?: { code: string; details?: Record<string, unknown> } };
export const json = { 'content-type': 'application/json' };
export const bearer = (user: string): Record<string, string> => ({ ...json, authorization: `Bearer ${user}` });
export const ON = { CLASS_TRANSFER: 'enabled' };

/** `LOCKED` sends no Worker vars at all (the production default). */
export const LOCKED = 'locked' as const;
export async function call(method: string, path: string, headers: Record<string, string>, body?: unknown, env: Record<string, string> | typeof LOCKED = ON) {
  const res = await app.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }, env === LOCKED ? undefined : env);
  return { status: res.status, body: (await res.json()) as Envelope };
}

export const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;
export const NOW = new Date('2026-10-11T12:00:00.000Z');
export const ago = (ms: number): string => new Date(NOW.getTime() - ms).toISOString();
export const ahead = (ms: number): string => new Date(NOW.getTime() + ms).toISOString();
export const OLD = ago(30 * DAY);

export const A = 'space:class-a';
export const B = 'space:class-b';
export const C = 'space:class-c';
export const E = 'space:class-e';
export const FAMILY = 'space:family';
export const FAMILY2 = 'space:family-two';
export const SCHOOL = 'space:school';
export const SUNI = 'profile:suni';
export const MINA = 'profile:mina';
export const CODE_B = 'BBBBBB';
export const CODE_C = 'CCCCCC';
export const CODE_E = 'EEEEEE';
export const CODE_FAMILY = 'FFFFFF';
export const CODE_A = 'AAAAAA';

export const space = (id: string, kind: Space['kind'], owner: string, over: Partial<Space> = {}): Space => ({
  id,
  kind,
  name: over.name ?? `${id.slice(6)} name`,
  parentSpaceId: null,
  ownerAccountId: owner,
  joinCode: null,
  joinCodeExpiresAt: null,
  settings: { consentMode: 'parent', anonymizeRoster: false },
  archivedAt: null,
  createdAt: OLD,
  ...over,
});

export async function member(spaceId: string, kind: 'account' | 'learner', memberId: string, role: 'owner' | 'teacher' | 'caregiver' | 'admin' | 'student', joinedAt = OLD) {
  await db.addMembership({ spaceId, memberKind: kind, memberId, role, joinedAt });
}

/**
 * teacher-a owns class A (Suni is in it), teacher-b owns class B (live code
 * BBBBBB), teacher-c owns C (CCCCCC) and E (expired EEEEEE); mom owns the
 * family (Suni and Mina), dad is a caregiver of it; aunt owns a second family
 * with Mina only. Every membership is 30 days old.
 */
export async function seed() {
  for (const [id, name] of [
    ['teacher-a', 'Mr Han'],
    ['teacher-b', 'Ms Park'],
    ['teacher-c', null],
    ['mom', 'Mom'],
    ['dad', null],
    ['aunt', null],
    ['admin', null],
    ['stranger', null],
  ] as const) {
    await db.putAccount({ id, email: `${id}@example.test`, displayName: name, consent: null, createdAt: OLD });
  }
  await db.putSpace(space(A, 'class', 'teacher-a', { name: 'Sunday Class A', joinCode: CODE_A, joinCodeExpiresAt: ahead(20 * DAY) }));
  await db.putSpace(space(B, 'class', 'teacher-b', { name: 'Saturday Class B', joinCode: CODE_B, joinCodeExpiresAt: ahead(20 * DAY), createdAt: ago(90 * DAY) }));
  await db.putSpace(space(C, 'class', 'teacher-c', { joinCode: CODE_C, joinCodeExpiresAt: ahead(20 * DAY) }));
  await db.putSpace(space(E, 'class', 'teacher-c', { joinCode: CODE_E, joinCodeExpiresAt: ago(DAY) }));
  await db.putSpace(space(FAMILY, 'family', 'mom', { name: 'Kim family', joinCode: CODE_FAMILY, joinCodeExpiresAt: ahead(20 * DAY) }));
  await db.putSpace(space(FAMILY2, 'family', 'aunt'));
  await member(A, 'account', 'teacher-a', 'owner');
  await member(B, 'account', 'teacher-b', 'owner');
  await member(C, 'account', 'teacher-c', 'owner');
  await member(E, 'account', 'teacher-c', 'owner');
  await member(FAMILY, 'account', 'mom', 'owner');
  await member(FAMILY, 'account', 'dad', 'caregiver');
  await member(FAMILY2, 'account', 'aunt', 'owner');
  for (const [id, name] of [
    [SUNI, 'Suni Kim'],
    [MINA, 'Mina Kim'],
  ] as const) {
    await db.putLearner({ id, displayName: name, ageGroup: '8-9', avatar: 'hoya-orange', recoveryHash: null, createdAt: OLD, lastActiveAt: OLD });
  }
  await member(A, 'learner', SUNI, 'student');
  await member(FAMILY, 'learner', SUNI, 'student');
  await member(FAMILY, 'learner', MINA, 'student');
  await member(FAMILY2, 'learner', MINA, 'student');
}

export const base = (spaceId: string) => `/api/spaces/${spaceId}/transfer-requests`;
export const preview = (spaceId: string, user: string, body: Record<string, unknown>) => call('POST', `${base(spaceId)}/preview`, bearer(user), body);
export const create = (spaceId: string, user: string, body: Record<string, unknown>) => call('POST', base(spaceId), bearer(user), body);
export const list = (spaceId: string, user: string) => call('GET', base(spaceId), bearer(user));
export const decline = (spaceId: string, user: string, tid: string, body: Record<string, unknown>) => call('POST', `${base(spaceId)}/${tid}/decline`, bearer(user), body);
export const cancel = (spaceId: string, user: string, tid: string, body: Record<string, unknown> = {}) => call('POST', `${base(spaceId)}/${tid}/cancel`, bearer(user), body);
export const approve = (spaceId: string, user: string, tid: string, body: Record<string, unknown>) => call('POST', `${base(spaceId)}/${tid}/approve`, bearer(user), body);
export const retry = (spaceId: string, user: string, tid: string, body: Record<string, unknown> = {}) => call('POST', `${base(spaceId)}/${tid}/retry`, bearer(user), body);
export const prefs = (spaceId: string, learnerId: string, user: string, body: Record<string, unknown>) => call('PUT', `/api/spaces/${spaceId}/learners/${learnerId}/transfer-prefs`, bearer(user), body);

export const consent = { textVersion: TRANSFER_CONSENT_TEXT_VERSION, locale: 'en' };
export const familyCreate = (over: Record<string, unknown> = {}) => ({ learnerId: SUNI, fromSpaceId: A, destinationSpaceId: B, code: CODE_B, consent, ...over });
export const classCreate = (over: Record<string, unknown> = {}) => ({ learnerId: SUNI, destinationSpaceId: B, code: CODE_B, ...over });

export type View = Record<string, unknown> & { id: string; status: string };
export const requestOf = (r: { body: Envelope }): View => (r.body.data as { request: View }).request;
export const requestsOf = (r: { body: Envelope }): View[] => (r.body.data as { requests: View[] }).requests;

export async function stored(): Promise<StoredTransfer[]> {
  return db.transfersOfLearner(SUNI);
}

/** A request row created `createdAgo` before now, straight through the Db (for limits, cooldowns and purge). */
export async function seedRow(input: { id: string; learnerId?: string; initiator: 'learner_side' | 'source'; account?: string; dest?: string; createdAgo: number }) {
  const at = new Date(NOW.getTime() - input.createdAgo);
  const common = { id: input.id, learnerId: input.learnerId ?? SUNI, sourceSpaceId: A, destSpaceId: input.dest ?? B, introduce: false, now: at };
  const row =
    input.initiator === 'source'
      ? newRequest({ ...common, initiator: 'source', initiatorAccountId: input.account ?? 'teacher-a', via: 'owner' })
      : newRequest({
          ...common,
          initiator: 'learner_side',
          initiatorAccountId: input.account ?? 'mom',
          consent: {
            basis: 'caregiver',
            attest: null,
            evidence: input.account ?? 'mom',
            role: 'owner',
            textVersion: TRANSFER_CONSENT_TEXT_VERSION,
            locale: 'en',
            shown: { lineIds: ['moving'], flags: {} },
            terms: { destNameHash: 'a'.repeat(64), destConsentMode: 'parent', destAnonymize: false, destOwnerId: 'teacher-b', sourceNameHash: 'b'.repeat(64), premiumChange: 'none' },
          },
        });
  expect(await db.createTransfer(row, { at: row.createdAt, actorKind: 'account', actorRef: input.account ?? null, event: 'created', slot: null, detail: null })).toBe('created');
  return row;
}

/** Runs `fn` with every Db call counted (the routes read the fallback Db). */
export async function countDbCalls(fn: () => Promise<void>): Promise<number> {
  const calls = { n: 0 };
  const spy = new Proxy(db, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver) as unknown;
      if (typeof value !== 'function') return value;
      return (...args: unknown[]) => {
        calls.n += 1;
        return (value as (...a: unknown[]) => unknown).apply(target, args);
      };
    },
  });
  const { setFallbackDb, fallbackDb } = await import('../../db');
  const before = fallbackDb();
  setFallbackDb(spy);
  try {
    await fn();
  } finally {
    setFallbackDb(before);
  }
  return calls.n;
}

/** A learner in class A (and nowhere else), for tests that need many rows. */
export async function filler(id: string, spaceId = A) {
  await db.putLearner({ id, displayName: `Filler ${id.slice(8)}`, ageGroup: '8-9', avatar: 'hoya-orange', recoveryHash: null, createdAt: OLD, lastActiveAt: OLD });
  await member(spaceId, 'learner', id, 'student');
}

