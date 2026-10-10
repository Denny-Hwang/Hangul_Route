import type { Entitlement, EntitlementApply, MemberKind, Membership, Plan, Space } from '@hangul-route/content-schema';
import { id, type Account, type Learner, type LearnerDevice, type SnapshotRecord } from '../store';
import { mergeEntitlement, type Db, type StoredRelink } from './types';

/** What `run()` resolves to on D1 (`D1Result`): `meta.changes` is the row count the statement wrote. */
export interface D1RunResultLike {
  meta?: { changes?: number };
}

/** The slice of Cloudflare's D1 API this package uses (also what the SQLite test shim provides). */
export interface D1PreparedLike {
  bind(...values: unknown[]): D1PreparedLike;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<D1RunResultLike>;
}
export interface D1Like {
  prepare(sql: string): D1PreparedLike;
}

type Row = Record<string, unknown>;
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const nstr = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v ?? 0));
const nnum = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
const json = (v: unknown): unknown => (typeof v === 'string' && v.length > 0 ? JSON.parse(v) : null);

const toAccount = (r: Row): Account => ({ id: str(r.id), email: nstr(r.email), displayName: nstr(r.display_name), consent: json(r.consent_json), createdAt: str(r.created_at) });
const toLearner = (r: Row): Learner => ({ id: str(r.id), displayName: str(r.display_name), ageGroup: str(r.age_group) as Learner['ageGroup'], avatar: str(r.avatar), recoveryHash: nstr(r.recovery_hash), createdAt: str(r.created_at), lastActiveAt: str(r.last_active_at) });
const toDevice = (r: Row): LearnerDevice => ({ learnerId: str(r.learner_id), deviceId: str(r.device_id), secretHash: str(r.secret_hash), scope: r.scope === 'class' ? 'class' : 'full', createdAt: str(r.created_at), lastSeenAt: str(r.last_seen_at) });
const toSnapshot = (r: Row): SnapshotRecord => ({ learnerId: str(r.learner_id), rev: num(r.rev), schemaVer: num(r.schema_ver), contentVer: str(r.content_ver), deviceId: str(r.device_id), summary: json(r.summary_json), payload: json(r.payload_json), updatedAt: str(r.updated_at) });
const toSpace = (r: Row): Space => ({
  id: str(r.id),
  kind: str(r.kind) as Space['kind'],
  name: str(r.name),
  parentSpaceId: nstr(r.parent_space_id),
  ownerAccountId: str(r.owner_account_id),
  joinCode: nstr(r.join_code),
  joinCodeExpiresAt: nstr(r.join_code_expires_at),
  settings: { consentMode: 'parent', anonymizeRoster: false, ...(json(r.settings_json) as Partial<Space['settings']> | null) },
  archivedAt: nstr(r.archived_at),
  createdAt: str(r.created_at),
});
const toMembership = (r: Row): Membership => ({ spaceId: str(r.space_id), memberKind: str(r.member_kind) as MemberKind, memberId: str(r.member_id), role: str(r.role) as Membership['role'], joinedAt: str(r.joined_at) });
const toPlan = (r: Row): Plan => ({
  id: str(r.id),
  spaceId: str(r.space_id),
  authorAccountId: str(r.author_account_id),
  title: str(r.title),
  items: (json(r.items_json) as Plan['items'] | null) ?? [],
  targetLearnerIds: json(r.target_learner_ids_json) as string[] | null,
  publishedAt: nstr(r.published_at),
  archivedAt: nstr(r.archived_at),
  createdAt: str(r.created_at),
  updatedAt: str(r.updated_at),
});
const toRelink = (r: Row): StoredRelink => ({
  id: str(r.id),
  spaceId: str(r.space_id),
  learnerId: str(r.learner_id),
  deviceId: str(r.device_id),
  platform: nstr(r.platform),
  requestedAt: str(r.requested_at),
  expiresAt: str(r.expires_at),
  status: str(r.status) as StoredRelink['status'],
  decidedAt: nstr(r.decided_at),
  secret: nstr(r.secret),
});
const toEntitlement = (r: Row): Entitlement => ({
  id: str(r.id),
  subjectKind: str(r.subject_kind) as Entitlement['subjectKind'],
  subjectId: str(r.subject_id),
  planKey: str(r.plan_key) as Entitlement['planKey'],
  status: str(r.status) as Entitlement['status'],
  provider: str(r.provider) as Entitlement['provider'],
  providerRef: nstr(r.provider_ref),
  customerRef: nstr(r.customer_ref),
  seats: nnum(r.seats),
  expiresAt: nstr(r.expires_at),
  promoCode: nstr(r.promo_code),
  updatedAt: str(r.updated_at),
});

/** `Db` over a D1 binding — F-INFRA-003. Schema: apps/api/migrations. */
export class D1Db implements Db {
  constructor(private readonly d1: D1Like) {}

  private async one<T>(sql: string, params: unknown[], map: (r: Row) => T): Promise<T | null> {
    const row = await this.d1.prepare(sql).bind(...params).first<Row>();
    return row ? map(row) : null;
  }
  private async many<T>(sql: string, params: unknown[], map: (r: Row) => T): Promise<T[]> {
    const { results } = await this.d1.prepare(sql).bind(...params).all<Row>();
    return results.map(map);
  }
  private async run(sql: string, params: unknown[]): Promise<void> {
    await this.d1.prepare(sql).bind(...params).run();
  }
  /** Runs a write and reports how many rows it changed. */
  private async changes(sql: string, params: unknown[]): Promise<number> {
    const result = await this.d1.prepare(sql).bind(...params).run();
    return Number(result.meta?.changes ?? 0);
  }

  getAccount(accountId: string): Promise<Account | null> {
    return this.one('SELECT * FROM accounts WHERE id = ?', [accountId], toAccount);
  }
  putAccount(a: Account): Promise<void> {
    return this.run(
      'INSERT INTO accounts (id, email, display_name, consent_json, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET email = excluded.email, display_name = excluded.display_name, consent_json = excluded.consent_json',
      [a.id, a.email, a.displayName, a.consent === null || a.consent === undefined ? null : JSON.stringify(a.consent), a.createdAt],
    );
  }

  getLearner(learnerId: string): Promise<Learner | null> {
    return this.one('SELECT * FROM learners WHERE id = ?', [learnerId], toLearner);
  }
  putLearner(l: Learner): Promise<void> {
    return this.run(
      'INSERT INTO learners (id, display_name, age_group, avatar, recovery_hash, created_at, last_active_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET display_name = excluded.display_name, age_group = excluded.age_group, avatar = excluded.avatar, recovery_hash = excluded.recovery_hash, last_active_at = excluded.last_active_at',
      [l.id, l.displayName, l.ageGroup, l.avatar, l.recoveryHash, l.createdAt, l.lastActiveAt],
    );
  }
  learnerByRecoveryHash(hash: string): Promise<Learner | null> {
    return this.one('SELECT * FROM learners WHERE recovery_hash = ?', [hash], toLearner);
  }
  async deleteLearner(learnerId: string): Promise<boolean> {
    const existed = !!(await this.getLearner(learnerId));
    // learner_devices, snapshots and relink_requests cascade from learners; memberships hold a plain member_id.
    await this.run("DELETE FROM memberships WHERE member_kind = 'learner' AND member_id = ?", [learnerId]);
    await this.run('DELETE FROM relink_requests WHERE learner_id = ?', [learnerId]);
    await this.run('DELETE FROM learner_devices WHERE learner_id = ?', [learnerId]);
    await this.run('DELETE FROM snapshots WHERE learner_id = ?', [learnerId]);
    await this.run('DELETE FROM learners WHERE id = ?', [learnerId]);
    return existed;
  }
  getDevice(learnerId: string, deviceId: string): Promise<LearnerDevice | null> {
    return this.one('SELECT * FROM learner_devices WHERE learner_id = ? AND device_id = ?', [learnerId, deviceId], toDevice);
  }
  putDevice(d: LearnerDevice): Promise<void> {
    return this.run(
      'INSERT INTO learner_devices (learner_id, device_id, secret_hash, scope, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(learner_id, device_id) DO UPDATE SET secret_hash = excluded.secret_hash, scope = excluded.scope, last_seen_at = excluded.last_seen_at',
      [d.learnerId, d.deviceId, d.secretHash, d.scope, d.createdAt, d.lastSeenAt],
    );
  }
  async deviceExists(deviceId: string): Promise<boolean> {
    return !!(await this.one('SELECT device_id FROM learner_devices WHERE device_id = ? LIMIT 1', [deviceId], (r) => r));
  }

  getSnapshot(learnerId: string): Promise<SnapshotRecord | null> {
    return this.one('SELECT * FROM snapshots WHERE learner_id = ?', [learnerId], toSnapshot);
  }
  async putSnapshot(s: SnapshotRecord, baseRev: number): Promise<boolean> {
    // One statement each, so the rev check and the write cannot interleave with another isolate (SYNC-1).
    const summary = JSON.stringify(s.summary ?? null);
    const payload = JSON.stringify(s.payload ?? null);
    const written =
      baseRev === 0
        ? await this.changes(
            'INSERT INTO snapshots (learner_id, rev, schema_ver, content_ver, device_id, summary_json, payload_json, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(learner_id) DO NOTHING',
            [s.learnerId, s.rev, s.schemaVer, s.contentVer, s.deviceId, summary, payload, s.updatedAt],
          )
        : await this.changes(
            'UPDATE snapshots SET rev = ?, schema_ver = ?, content_ver = ?, device_id = ?, summary_json = ?, payload_json = ?, updated_at = ? WHERE learner_id = ? AND rev = ?',
            [s.rev, s.schemaVer, s.contentVer, s.deviceId, summary, payload, s.updatedAt, s.learnerId, baseRev],
          );
    return written === 1;
  }

  getSpace(spaceId: string): Promise<Space | null> {
    return this.one('SELECT * FROM spaces WHERE id = ?', [spaceId], toSpace);
  }
  putSpace(s: Space): Promise<void> {
    return this.run(
      'INSERT INTO spaces (id, kind, name, parent_space_id, owner_account_id, join_code, join_code_expires_at, settings_json, archived_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET kind = excluded.kind, name = excluded.name, parent_space_id = excluded.parent_space_id, owner_account_id = excluded.owner_account_id, join_code = excluded.join_code, join_code_expires_at = excluded.join_code_expires_at, settings_json = excluded.settings_json, archived_at = excluded.archived_at',
      [s.id, s.kind, s.name, s.parentSpaceId, s.ownerAccountId, s.joinCode, s.joinCodeExpiresAt, JSON.stringify(s.settings), s.archivedAt, s.createdAt],
    );
  }
  spaceByCode(code: string): Promise<Space | null> {
    return this.one('SELECT * FROM spaces WHERE join_code = ?', [code], toSpace);
  }
  childSpaces(parentSpaceId: string): Promise<Space[]> {
    return this.many('SELECT * FROM spaces WHERE parent_space_id = ? ORDER BY created_at', [parentSpaceId], toSpace);
  }
  spacesOwnedBy(accountId: string): Promise<Space[]> {
    return this.many('SELECT * FROM spaces WHERE owner_account_id = ? ORDER BY created_at', [accountId], toSpace);
  }
  membership(spaceId: string, kind: MemberKind, memberId: string): Promise<Membership | null> {
    return this.one('SELECT * FROM memberships WHERE space_id = ? AND member_kind = ? AND member_id = ?', [spaceId, kind, memberId], toMembership);
  }
  addMembership(m: Membership): Promise<void> {
    return this.run(
      'INSERT INTO memberships (space_id, member_kind, member_id, role, joined_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(space_id, member_kind, member_id) DO UPDATE SET role = excluded.role, joined_at = excluded.joined_at',
      [m.spaceId, m.memberKind, m.memberId, m.role, m.joinedAt],
    );
  }
  async removeMembership(spaceId: string, kind: MemberKind, memberId: string): Promise<boolean> {
    const existed = !!(await this.membership(spaceId, kind, memberId));
    if (existed) await this.run('DELETE FROM memberships WHERE space_id = ? AND member_kind = ? AND member_id = ?', [spaceId, kind, memberId]);
    return existed;
  }
  membershipsOf(kind: MemberKind, memberId: string): Promise<Membership[]> {
    return this.many('SELECT * FROM memberships WHERE member_kind = ? AND member_id = ? ORDER BY joined_at', [kind, memberId], toMembership);
  }
  membersOf(spaceId: string): Promise<Membership[]> {
    return this.many('SELECT * FROM memberships WHERE space_id = ? ORDER BY joined_at', [spaceId], toMembership);
  }

  getPlan(planId: string): Promise<Plan | null> {
    return this.one('SELECT * FROM plans WHERE id = ?', [planId], toPlan);
  }
  putPlan(p: Plan): Promise<void> {
    return this.run(
      'INSERT INTO plans (id, space_id, author_account_id, title, items_json, target_learner_ids_json, published_at, archived_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET title = excluded.title, items_json = excluded.items_json, target_learner_ids_json = excluded.target_learner_ids_json, published_at = excluded.published_at, archived_at = excluded.archived_at, updated_at = excluded.updated_at',
      [p.id, p.spaceId, p.authorAccountId, p.title, JSON.stringify(p.items), p.targetLearnerIds === null ? null : JSON.stringify(p.targetLearnerIds), p.publishedAt, p.archivedAt, p.createdAt, p.updatedAt],
    );
  }
  plansOf(spaceId: string): Promise<Plan[]> {
    return this.many('SELECT * FROM plans WHERE space_id = ? ORDER BY created_at', [spaceId], toPlan);
  }

  getRelink(relinkId: string): Promise<StoredRelink | null> {
    return this.one('SELECT * FROM relink_requests WHERE id = ?', [relinkId], toRelink);
  }
  putRelink(r: StoredRelink): Promise<void> {
    return this.run(
      'INSERT INTO relink_requests (id, space_id, learner_id, device_id, platform, requested_at, expires_at, status, decided_at, secret) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET status = excluded.status, decided_at = excluded.decided_at, secret = excluded.secret, expires_at = excluded.expires_at',
      [r.id, r.spaceId, r.learnerId, r.deviceId, r.platform, r.requestedAt, r.expiresAt, r.status, r.decidedAt, r.secret],
    );
  }
  relinksOf(spaceId: string): Promise<StoredRelink[]> {
    return this.many('SELECT * FROM relink_requests WHERE space_id = ? ORDER BY requested_at', [spaceId], toRelink);
  }

  entitlementsFor(subjectKind: Entitlement['subjectKind'], subjectId: string): Promise<Entitlement[]> {
    return this.many('SELECT * FROM entitlements WHERE subject_kind = ? AND subject_id = ? ORDER BY plan_key', [subjectKind, subjectId], toEntitlement);
  }
  async applyEntitlement(input: EntitlementApply, now: Date): Promise<Entitlement> {
    const existing = await this.one('SELECT * FROM entitlements WHERE subject_kind = ? AND subject_id = ? AND plan_key = ?', [input.subjectKind, input.subjectId, input.planKey], toEntitlement);
    const e = mergeEntitlement(existing, input, now, () => id('ent'));
    await this.run(
      'INSERT INTO entitlements (id, subject_kind, subject_id, plan_key, status, provider, provider_ref, customer_ref, seats, expires_at, promo_code, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(subject_kind, subject_id, plan_key) DO UPDATE SET status = excluded.status, provider = excluded.provider, provider_ref = excluded.provider_ref, customer_ref = excluded.customer_ref, seats = excluded.seats, expires_at = excluded.expires_at, promo_code = excluded.promo_code, updated_at = excluded.updated_at',
      [e.id, e.subjectKind, e.subjectId, e.planKey, e.status, e.provider, e.providerRef, e.customerRef, e.seats, e.expiresAt, e.promoCode, e.updatedAt],
    );
    return e;
  }

  async reset(): Promise<void> {
    for (const table of ['entitlements', 'relink_requests', 'plans', 'memberships', 'spaces', 'snapshots', 'learner_devices', 'learners', 'accounts']) {
      await this.run(`DELETE FROM ${table}`, []);
    }
  }
}
