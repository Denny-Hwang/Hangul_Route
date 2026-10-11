import { TRANSFER_COOLING_OFF_MS, type Entitlement, type EntitlementApply, type MemberKind, type Membership, type Plan, type Space, type TransferBlockReason, type TransferEndReason, type TransferSlot } from '@hangul-route/content-schema';
import { id, type Account, type Learner, type LearnerDevice, type SnapshotRecord } from '../store';
import {
  learnerRateKeys,
  mergeEntitlement,
  type ConsentResetReason,
  type Db,
  type ExecuteTransferInput,
  type ExecuteTransferResult,
  type NewTransferEvent,
  type StoredRelink,
  type StoredTransfer,
  type TransferEndActor,
  type TransferEvent,
  type TransferPrefKey,
  type TransferPrefs,
  type TransferSlotConsent,
  type WaitlistEntry,
} from './types';
import { assertNewTransfer, assertTransferPrefKey, assertTransferSlot, finiteCap, teacherSlotsOf } from './transfer-rules';
import { ENDED_TRANSFER_STATUSES, OPEN_TRANSFER_STATUSES } from './transfer-types';

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
  /**
   * Runs the statements as one transaction (D1's native `batch`): one result
   * per statement, in order, each with its own `meta.changes`. A statement
   * that changes 0 rows does not stop the batch, so every statement that must
   * depend on an earlier one carries its own guard (F-SPACE-002 section 4.6).
   * If any statement throws, the whole batch is rolled back and the promise
   * rejects.
   */
  batch(statements: D1PreparedLike[]): Promise<D1RunResultLike[]>;
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
const toWaitlist = (r: Row): WaitlistEntry => ({ email: str(r.email), createdAt: str(r.created_at), source: nstr(r.source), locale: nstr(r.locale), consentTextVersion: str(r.consent_text_version), unsubscribedAt: nstr(r.unsubscribed_at) });
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

const bool = (v: unknown): boolean => v === 1 || v === true || v === '1';
const toTransfer = (r: Row): StoredTransfer => ({
  id: str(r.id),
  learnerId: str(r.learner_id),
  sourceSpaceId: str(r.source_space_id),
  destSpaceId: str(r.dest_space_id),
  initiator: str(r.initiator) as StoredTransfer['initiator'],
  initiatorAccountId: nstr(r.initiator_account_id),
  status: str(r.status) as StoredTransfer['status'],
  endReason: nstr(r.end_reason) as StoredTransfer['endReason'],
  endActor: nstr(r.end_actor) as StoredTransfer['endActor'],
  blockReason: nstr(r.block_reason) as StoredTransfer['blockReason'],
  introduce: bool(r.introduce),
  rev: num(r.rev),
  learner: {
    state: str(r.l_state) as StoredTransfer['learner']['state'],
    at: nstr(r.l_at),
    basis: nstr(r.l_basis) as StoredTransfer['learner']['basis'],
    attest: nstr(r.l_attest) as StoredTransfer['learner']['attest'],
    evidence: nstr(r.l_evidence),
    role: nstr(r.l_role) as StoredTransfer['learner']['role'],
    textVersion: nstr(r.l_text_version),
    locale: nstr(r.l_locale),
    shown: json(r.l_shown_json) as StoredTransfer['learner']['shown'],
    terms:
      [r.l_dest_name_hash, r.l_dest_consent_mode, r.l_dest_anonymize, r.l_dest_owner_id, r.l_source_name_hash, r.l_premium_change].some((v) => v === null || v === undefined)
        ? null
        : {
            destNameHash: str(r.l_dest_name_hash),
            destConsentMode: str(r.l_dest_consent_mode) as Space['settings']['consentMode'],
            destAnonymize: bool(r.l_dest_anonymize),
            destOwnerId: str(r.l_dest_owner_id),
            sourceNameHash: str(r.l_source_name_hash),
            premiumChange: str(r.l_premium_change) as NonNullable<StoredTransfer['learner']['terms']>['premiumChange'],
          },
  },
  source: { state: str(r.s_state) as StoredTransfer['source']['state'], at: nstr(r.s_at), accountId: nstr(r.s_account_id), via: nstr(r.s_via) as StoredTransfer['source']['via'] },
  destination: { state: str(r.d_state) as StoredTransfer['destination']['state'], at: nstr(r.d_at), accountId: nstr(r.d_account_id), via: nstr(r.d_via) as StoredTransfer['destination']['via'] },
  createdAt: str(r.created_at),
  updatedAt: str(r.updated_at),
  expiresAt: str(r.expires_at),
  approvedAt: nstr(r.approved_at),
  executeAfter: nstr(r.execute_after),
  endedAt: nstr(r.ended_at),
  executedAt: nstr(r.executed_at),
});
const toTransferEvent = (r: Row): TransferEvent => ({
  id: num(r.id),
  transferId: str(r.transfer_id),
  at: str(r.at),
  actorKind: str(r.actor_kind) as TransferEvent['actorKind'],
  actorRef: nstr(r.actor_ref),
  event: str(r.event) as TransferEvent['event'],
  slot: nstr(r.slot) as TransferEvent['slot'],
  detail: json(r.detail_json) as TransferEvent['detail'],
});

/** The learner-slot record columns, in the order `learnerRecordValues` binds them. */
const LEARNER_RECORD_COLUMNS = ['l_at', 'l_basis', 'l_attest', 'l_evidence', 'l_role', 'l_text_version', 'l_locale', 'l_shown_json', 'l_dest_name_hash', 'l_dest_consent_mode', 'l_dest_anonymize', 'l_dest_owner_id', 'l_source_name_hash', 'l_premium_change'] as const;
const learnerRecordValues = (slot: StoredTransfer['learner']): unknown[] => [
  slot.at,
  slot.basis,
  slot.attest,
  slot.evidence,
  slot.role,
  slot.textVersion,
  slot.locale,
  slot.shown === null ? null : JSON.stringify(slot.shown),
  slot.terms?.destNameHash ?? null,
  slot.terms?.destConsentMode ?? null,
  slot.terms === null ? null : slot.terms.destAnonymize ? 1 : 0,
  slot.terms?.destOwnerId ?? null,
  slot.terms?.sourceNameHash ?? null,
  slot.terms?.premiumChange ?? null,
];
const TRANSFER_COLUMNS = [
  'id', 'learner_id', 'source_space_id', 'dest_space_id', 'initiator', 'initiator_account_id', 'status', 'end_reason', 'end_actor', 'block_reason', 'introduce', 'rev',
  'l_state', ...LEARNER_RECORD_COLUMNS,
  's_state', 's_at', 's_account_id', 's_via', 'd_state', 'd_at', 'd_account_id', 'd_via',
  'created_at', 'updated_at', 'expires_at', 'approved_at', 'execute_after', 'ended_at', 'executed_at',
] as const;
const transferValues = (t: StoredTransfer): unknown[] => [
  t.id, t.learnerId, t.sourceSpaceId, t.destSpaceId, t.initiator, t.initiatorAccountId, t.status, t.endReason, t.endActor, t.blockReason, t.introduce ? 1 : 0, t.rev,
  t.learner.state, ...learnerRecordValues(t.learner),
  t.source.state, t.source.at, t.source.accountId, t.source.via, t.destination.state, t.destination.at, t.destination.accountId, t.destination.via,
  t.createdAt, t.updatedAt, t.expiresAt, t.approvedAt, t.executeAfter, t.endedAt, t.executedAt,
];
/** Column of each slot's state; a fixed map, never caller text in SQL. */
const SLOT_STATE_COLUMN: Record<TransferSlot, string> = { learner: 'l_state', source: 's_state', destination: 'd_state' };
const PREF_COLUMN: Record<TransferPrefKey, string> = { selfManaged: 'self_managed', blockTeacherRequests: 'block_teacher_requests' };
const sqlList = (values: readonly string[]): string => values.map((v) => `'${v}'`).join(',');
const OPEN = `status IN (${sqlList(OPEN_TRANSFER_STATUSES)})`;
const ENDED = `status IN (${sqlList(ENDED_TRANSFER_STATUSES)})`;
const ALL_SLOTS_IN = "l_state = 'consented' AND s_state IN ('consented','not_required') AND d_state = 'consented'";
/** The row count a write reports; a binding that does not say is an error, never zero. */
const readChanges = (result: D1RunResultLike | undefined): number => {
  const changed = result?.meta?.changes;
  if (typeof changed !== 'number') throw new Error('D1 did not report meta.changes for a compare-and-set write');
  return changed;
};
/** D1 binds at most 100 parameters per statement. */
const IN_CHUNK = 90;

/**
 * Every table `reset()` empties, children before parents. The class-transfer
 * tables come from migration 0005 (F-SPACE-002 PR T-3b).
 */
/** The tables of migration 0005 (F-SPACE-002 PR T-3b), children first. */
const TRANSFER_TABLES = ['transfer_events', 'transfer_requests', 'learner_transfer_prefs', 'rate_hits'] as const;
const RESET_TABLES = [
  ...TRANSFER_TABLES,
  'waitlist',
  'entitlements',
  'relink_requests',
  'plans',
  'memberships',
  'spaces',
  'snapshots',
  'learner_devices',
  'learners',
  'accounts',
] as const;

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
  /**
   * Runs a write and reports how many rows it changed. A binding that does not
   * say is an error, never zero: a compare-and-set read as "lost the race"
   * every time would answer 409 to every upload without a trace.
   */
  private async changes(sql: string, params: unknown[]): Promise<number> {
    return readChanges(await this.d1.prepare(sql).bind(...params).run());
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
    // learner_devices, snapshots, relink_requests and the transfer tables cascade from learners; memberships and
    // rate_hits hold a plain id. Each is deleted explicitly anyway, children first, in one transaction
    // (F-SPACE-002 section 4.7). A transfer table is named only once migration 0005 has created it: an erase is
    // the live caregiver route, and "no such table" would roll the whole batch back if this Worker ever ran
    // before the migration.
    const present = await this.presentTables(TRANSFER_TABLES);
    const rateKeys = learnerRateKeys(learnerId);
    const transferStatements: Array<[(typeof TRANSFER_TABLES)[number], string, unknown[]]> = [
      ['transfer_events', 'DELETE FROM transfer_events WHERE transfer_id IN (SELECT id FROM transfer_requests WHERE learner_id = ?)', [learnerId]],
      ['transfer_requests', 'DELETE FROM transfer_requests WHERE learner_id = ?', [learnerId]],
      ['learner_transfer_prefs', 'DELETE FROM learner_transfer_prefs WHERE learner_id = ?', [learnerId]],
      ['rate_hits', `DELETE FROM rate_hits WHERE key IN (${rateKeys.map(() => '?').join(', ')})`, rateKeys],
    ];
    const statements: Array<[string, unknown[]]> = [
      ...transferStatements.filter(([table]) => present.has(table)).map(([, sql, params]): [string, unknown[]] => [sql, params]),
      ["DELETE FROM memberships WHERE member_kind = 'learner' AND member_id = ?", [learnerId]],
      ['DELETE FROM relink_requests WHERE learner_id = ?', [learnerId]],
      ['DELETE FROM learner_devices WHERE learner_id = ?', [learnerId]],
      ['DELETE FROM snapshots WHERE learner_id = ?', [learnerId]],
      ['DELETE FROM learners WHERE id = ?', [learnerId]],
    ];
    await this.d1.batch(statements.map(([sql, params]) => this.d1.prepare(sql).bind(...params)));
    return existed;
  }
  /** Which of `tables` exist (migration order is not guaranteed relative to the Worker upload). */
  private async presentTables(tables: readonly string[]): Promise<Set<string>> {
    const names = await this.many(`SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${tables.map(() => '?').join(', ')})`, [...tables], (r) => str(r.name));
    return new Set(names);
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

  addWaitlist(e: Omit<WaitlistEntry, 'unsubscribedAt'>): Promise<void> {
    return this.run('INSERT INTO waitlist (email, created_at, source, locale, consent_text_version) VALUES (?, ?, ?, ?, ?) ON CONFLICT(email) DO NOTHING', [e.email, e.createdAt, e.source, e.locale, e.consentTextVersion]);
  }
  waitlistEntries(): Promise<WaitlistEntry[]> {
    return this.many('SELECT * FROM waitlist ORDER BY created_at, id', [], toWaitlist);
  }
  async unsubscribeWaitlist(email: string, now: Date): Promise<boolean> {
    return (await this.changes('UPDATE waitlist SET unsubscribed_at = ? WHERE email = ?', [now.toISOString(), email])) > 0;
  }

  // ---- class transfer (F-SPACE-002 section 4.7) ----

  /** One batch's results as row counts; a binding that does not report `meta.changes` is an error, never zero. */
  private async batchChanges(statements: Array<[string, unknown[]]>): Promise<number[]> {
    const results = await this.d1.batch(statements.map(([sql, params]) => this.d1.prepare(sql).bind(...params)));
    return results.map(readChanges);
  }

  async createTransfer(row: StoredTransfer, event: Omit<NewTransferEvent, 'transferId'>): Promise<'created' | 'already_open'> {
    assertNewTransfer(row);
    // Insert only while the learner has no open request (the partial unique index is the backstop);
    // the event needs its row and is written once per row; both run in one transaction.
    const [inserted] = await this.batchChanges([
      [
        `INSERT INTO transfer_requests (${TRANSFER_COLUMNS.join(', ')}) SELECT ${TRANSFER_COLUMNS.map(() => '?').join(', ')} WHERE NOT EXISTS (SELECT 1 FROM transfer_requests WHERE learner_id = ? AND ${OPEN})`,
        [...transferValues(row), row.learnerId],
      ],
      [
        'INSERT INTO transfer_events (transfer_id, at, actor_kind, actor_ref, event, slot, detail_json) SELECT ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM transfer_requests WHERE id = ?) AND NOT EXISTS (SELECT 1 FROM transfer_events WHERE transfer_id = ?)',
        [row.id, event.at, event.actorKind, event.actorRef, event.event, event.slot, event.detail === null ? null : JSON.stringify(event.detail), row.id, row.id],
      ],
    ]);
    return inserted === 1 ? 'created' : 'already_open';
  }

  async consentSlot(transferId: string, consent: TransferSlotConsent, now: Date): Promise<number> {
    const at = now.toISOString();
    if (consent.kind === 'learner') {
      const record = { state: 'consented' as const, at, ...consent.record };
      const introduce = consent.introduce === undefined ? null : consent.introduce ? 1 : 0;
      return this.changes(
        `UPDATE transfer_requests SET l_state = 'consented', ${LEARNER_RECORD_COLUMNS.map((c) => `${c} = ?`).join(', ')}, introduce = COALESCE(?, introduce), execute_after = ?, updated_at = ?, rev = rev + 1 WHERE id = ? AND ${OPEN} AND l_state = 'pending'`,
        [...learnerRecordValues(record), introduce, new Date(now.getTime() + TRANSFER_COOLING_OFF_MS).toISOString(), at, transferId],
      );
    }
    const slots = teacherSlotsOf(consent);
    const sets: string[] = [];
    const params: unknown[] = [];
    const where: string[] = [];
    if (slots.source) {
      sets.push("s_state = 'consented', s_at = ?, s_account_id = ?, s_via = ?");
      params.push(at, consent.accountId, consent.via);
      where.push("s_state = 'pending'");
    }
    if (slots.destination) {
      sets.push("d_state = 'consented', d_at = ?, d_account_id = ?, d_via = ?");
      params.push(at, consent.accountId, consent.via);
      where.push("d_state = 'pending'", "l_state = 'consented'");
    }
    return this.changes(`UPDATE transfer_requests SET ${sets.join(', ')}, updated_at = ?, rev = rev + 1 WHERE id = ? AND ${OPEN} AND ${where.join(' AND ')}`, [...params, at, transferId]);
  }

  async declineSlot(transferId: string, slot: TransferSlot, endReason: TransferEndReason, endActor: TransferEndActor, now: Date): Promise<number> {
    assertTransferSlot(slot);
    const at = now.toISOString();
    return this.changes(
      `UPDATE transfer_requests SET ${SLOT_STATE_COLUMN[slot]} = 'declined', status = 'declined', end_reason = ?, end_actor = ?, ended_at = ?, updated_at = ?, rev = rev + 1 WHERE id = ? AND ${OPEN}`,
      [endReason, endActor, at, at, transferId],
    );
  }

  cancelTransfer(transferId: string, endReason: TransferEndReason, endActor: TransferEndActor, now: Date): Promise<number> {
    const at = now.toISOString();
    return this.changes(`UPDATE transfer_requests SET status = 'cancelled', end_reason = ?, end_actor = ?, ended_at = ?, updated_at = ?, rev = rev + 1 WHERE id = ? AND ${OPEN}`, [endReason, endActor, at, at, transferId]);
  }

  expireTransfer(transferId: string, now: Date): Promise<number> {
    const at = now.toISOString();
    return this.changes(
      `UPDATE transfer_requests SET status = 'expired', end_reason = 'expired', end_actor = 'system', ended_at = ?, updated_at = ?, rev = rev + 1 WHERE id = ? AND ${OPEN} AND expires_at <= ?`,
      [at, at, transferId, at],
    );
  }

  markSourceNotRequired(transferId: string, now: Date): Promise<number> {
    return this.changes(`UPDATE transfer_requests SET s_state = 'not_required', updated_at = ?, rev = rev + 1 WHERE id = ? AND ${OPEN} AND s_state = 'pending'`, [now.toISOString(), transferId]);
  }

  promoteTransfer(transferId: string, now: Date): Promise<number> {
    const at = now.toISOString();
    return this.changes(`UPDATE transfer_requests SET status = 'approved', approved_at = ?, updated_at = ?, rev = rev + 1 WHERE id = ? AND status = 'requested' AND ${ALL_SLOTS_IN}`, [at, at, transferId]);
  }

  blockTransfer(transferId: string, reason: TransferBlockReason, now: Date): Promise<number> {
    return this.changes("UPDATE transfer_requests SET block_reason = ?, updated_at = ?, rev = rev + 1 WHERE id = ? AND status = 'approved'", [reason, now.toISOString(), transferId]);
  }

  async resetLearnerConsent(transferId: string, why: ConsentResetReason, now: Date): Promise<number> {
    const at = now.toISOString();
    // The reset and its audit row in one transaction: the UPDATE marks the row it changed with a one-off
    // token in `block_reason` (which the reset clears anyway), the event is guarded by it, and the last
    // statement clears it (the same pattern as executeTransfer).
    const token = `resetting:${crypto.randomUUID()}`;
    const [changed] = await this.batchChanges([
      [
        `UPDATE transfer_requests SET l_state = 'pending', ${LEARNER_RECORD_COLUMNS.map((c) => `${c} = NULL`).join(', ')}, status = 'requested', approved_at = NULL, execute_after = NULL, block_reason = ?, updated_at = ?, rev = rev + 1 WHERE id = ? AND ${OPEN} AND l_state = 'consented'`,
        [token, at, transferId],
      ],
      [
        "INSERT INTO transfer_events (transfer_id, at, actor_kind, actor_ref, event, slot, detail_json) SELECT ?, ?, 'system', NULL, 'consent_reset', 'learner', ? WHERE EXISTS (SELECT 1 FROM transfer_requests WHERE id = ? AND block_reason = ?)",
        [transferId, at, JSON.stringify({ why }), transferId, token],
      ],
      ['UPDATE transfer_requests SET block_reason = NULL WHERE id = ? AND block_reason = ?', [transferId, token]],
    ]);
    return changed ?? 0;
  }

  async executeTransfer(input: ExecuteTransferInput): Promise<ExecuteTransferResult> {
    const at = input.now.toISOString();
    const { id: transferId, learnerId, sourceSpaceId: source, destSpaceId: dest } = input;
    // The gate marks the row it changed with a one-off token in `block_reason` (which the move clears
    // anyway) and the last statement clears it, so no reader outside the transaction ever sees it.
    // G = "this call's gate executed the row". Matching on `executed_at = now` alone (the spec's
    // sketch) would let a second execute in the same millisecond run every later statement again.
    const token = `executing:${crypto.randomUUID()}`;
    const guard = "EXISTS (SELECT 1 FROM transfer_requests WHERE id = ? AND status = 'executed' AND block_reason = ?)";
    const g = [transferId, token];
    const [gate, , , relinksClosed, devicesRevoked] = await this.batchChanges([
      [
        `UPDATE transfer_requests SET status = 'executed', executed_at = ?, block_reason = ?, updated_at = ?, rev = rev + 1
         WHERE id = ? AND learner_id = ? AND source_space_id = ? AND dest_space_id = ?
           AND source_space_id <> dest_space_id
           AND status = 'approved' AND expires_at > ? AND execute_after <= ? AND ${ALL_SLOTS_IN}
           AND EXISTS (SELECT 1 FROM learners WHERE id = ?)
           AND EXISTS (SELECT 1 FROM memberships WHERE space_id = ? AND member_kind = 'learner' AND member_id = ?)
           AND EXISTS (SELECT 1 FROM spaces WHERE id = ? AND kind = 'class')
           AND EXISTS (SELECT 1 FROM spaces WHERE id = ? AND kind = 'class' AND archived_at IS NULL)
           AND ( EXISTS (SELECT 1 FROM memberships WHERE space_id = ? AND member_kind = 'learner' AND member_id = ?)
                 OR ( (SELECT COUNT(*) FROM memberships WHERE space_id = ? AND member_kind = 'learner') < ?
                      AND (SELECT COUNT(*) FROM memberships m JOIN spaces s ON s.id = m.space_id
                           WHERE m.member_kind = 'learner' AND m.member_id = ? AND s.kind = 'class' AND s.archived_at IS NULL AND m.space_id <> ?) < ? ) )`,
        [at, token, at, transferId, learnerId, source, dest, at, at, learnerId, source, learnerId, source, dest, dest, learnerId, dest, finiteCap(input.destCap), learnerId, source, finiteCap(input.learnerCap)],
      ],
      [`INSERT INTO memberships (space_id, member_kind, member_id, role, joined_at) SELECT ?, 'learner', ?, 'student', ? WHERE ${guard} ON CONFLICT(space_id, member_kind, member_id) DO NOTHING`, [dest, learnerId, at, ...g]],
      [`DELETE FROM memberships WHERE space_id = ? AND member_kind = 'learner' AND member_id = ? AND ${guard}`, [source, learnerId, ...g]],
      [`UPDATE relink_requests SET status = 'denied', decided_at = ? WHERE space_id = ? AND learner_id = ? AND status = 'pending' AND ${guard}`, [at, source, learnerId, ...g]],
      [
        `DELETE FROM learner_devices WHERE learner_id = ? AND scope = 'class' AND ${guard}
           AND device_id IN (SELECT device_id FROM relink_requests WHERE space_id = ? AND learner_id = ? AND status = 'approved')
           AND device_id NOT IN (SELECT r.device_id FROM relink_requests r JOIN memberships m ON m.space_id = r.space_id AND m.member_kind = 'learner' AND m.member_id = r.learner_id
                                 WHERE r.learner_id = ? AND r.status = 'approved' AND r.space_id <> ?)`,
        [learnerId, ...g, source, learnerId, learnerId, source],
      ],
      [`INSERT INTO transfer_events (transfer_id, at, actor_kind, actor_ref, event, slot, detail_json) SELECT ?, ?, 'system', NULL, 'executed', NULL, NULL WHERE ${guard}`, [transferId, at, ...g]],
      ['UPDATE transfer_requests SET block_reason = NULL WHERE id = ? AND block_reason = ?', g],
    ]);
    return gate === 1 ? { executed: true, devicesRevoked: devicesRevoked ?? 0, relinksClosed: relinksClosed ?? 0 } : { executed: false, devicesRevoked: 0, relinksClosed: 0 };
  }

  getTransfer(transferId: string): Promise<StoredTransfer | null> {
    return this.one('SELECT * FROM transfer_requests WHERE id = ?', [transferId], toTransfer);
  }
  transfersOfSpace(spaceId: string, role: 'source' | 'destination', limit: number): Promise<StoredTransfer[]> {
    const column = role === 'source' ? 'source_space_id' : 'dest_space_id';
    return this.many(`SELECT * FROM transfer_requests WHERE ${column} = ? ORDER BY created_at DESC, id DESC LIMIT ?`, [spaceId, limit], toTransfer);
  }
  transfersOfLearner(learnerId: string): Promise<StoredTransfer[]> {
    return this.many('SELECT * FROM transfer_requests WHERE learner_id = ? ORDER BY created_at DESC, id DESC', [learnerId], toTransfer);
  }
  openTransferOf(learnerId: string): Promise<StoredTransfer | null> {
    return this.one(`SELECT * FROM transfer_requests WHERE learner_id = ? AND ${OPEN} LIMIT 1`, [learnerId], toTransfer);
  }
  lastLearnerRefusal(learnerId: string, since: Date): Promise<StoredTransfer | null> {
    return this.one(
      "SELECT * FROM transfer_requests WHERE learner_id = ? AND initiator = 'source' AND end_reason IN ('declined_learner','withdrawn_learner') AND ended_at >= ? ORDER BY ended_at DESC, id DESC LIMIT 1",
      [learnerId, since.toISOString()],
      toTransfer,
    );
  }
  lastCooldownDecline(learnerId: string, destSpaceId: string, since: Date): Promise<StoredTransfer | null> {
    return this.one(
      "SELECT * FROM transfer_requests WHERE learner_id = ? AND dest_space_id = ? AND initiator = 'learner_side' AND end_reason IN ('declined_source','declined_destination') AND ended_at >= ? ORDER BY ended_at DESC, id DESC LIMIT 1",
      [learnerId, destSpaceId, since.toISOString()],
      toTransfer,
    );
  }
  private async count(sql: string, params: unknown[]): Promise<number> {
    return (await this.one(sql, params, (r) => num(r.n))) ?? 0;
  }
  countTransfersCreatedBy(accountId: string, since: Date): Promise<number> {
    return this.count('SELECT COUNT(*) AS n FROM transfer_requests WHERE initiator_account_id = ? AND created_at >= ?', [accountId, since.toISOString()]);
  }
  countTransfersCreatedForLearner(learnerId: string, since: Date): Promise<number> {
    return this.count('SELECT COUNT(*) AS n FROM transfer_requests WHERE learner_id = ? AND created_at >= ?', [learnerId, since.toISOString()]);
  }
  countOpenTransfersTo(spaceId: string): Promise<number> {
    return this.count(`SELECT COUNT(*) AS n FROM transfer_requests WHERE dest_space_id = ? AND ${OPEN}`, [spaceId]);
  }
  transferEvents(transferId: string): Promise<TransferEvent[]> {
    return this.many('SELECT * FROM transfer_events WHERE transfer_id = ? ORDER BY id', [transferId], toTransferEvent);
  }
  addTransferEvent(e: NewTransferEvent): Promise<void> {
    return this.run('INSERT INTO transfer_events (transfer_id, at, actor_kind, actor_ref, event, slot, detail_json) VALUES (?, ?, ?, ?, ?, ?, ?)', [
      e.transferId,
      e.at,
      e.actorKind,
      e.actorRef,
      e.event,
      e.slot,
      e.detail === null ? null : JSON.stringify(e.detail),
    ]);
  }
  private async byIds<T>(table: 'learners' | 'spaces', ids: readonly string[], map: (r: Row) => T): Promise<T[]> {
    const unique = [...new Set(ids)];
    const out: T[] = [];
    for (let i = 0; i < unique.length; i += IN_CHUNK) {
      const chunk = unique.slice(i, i + IN_CHUNK);
      out.push(...(await this.many(`SELECT * FROM ${table} WHERE id IN (${chunk.map(() => '?').join(', ')})`, chunk, map)));
    }
    return out;
  }
  getLearners(ids: readonly string[]): Promise<Learner[]> {
    return this.byIds('learners', ids, toLearner);
  }
  getSpaces(ids: readonly string[]): Promise<Space[]> {
    return this.byIds('spaces', ids, toSpace);
  }
  purgeTransfers(endedBefore: Date, executedBefore: Date, limit: number): Promise<number> {
    // One bounded statement (section 4.1); the events go with their rows through ON DELETE CASCADE.
    return this.changes(
      `DELETE FROM transfer_requests WHERE id IN (SELECT t.id FROM transfer_requests t
         WHERE (t.${ENDED} AND t.ended_at < ?)
            OR (t.status = 'executed' AND t.executed_at < ? AND NOT EXISTS (SELECT 1 FROM memberships m WHERE m.space_id = t.dest_space_id AND m.member_kind = 'learner' AND m.member_id = t.learner_id))
         ORDER BY t.id LIMIT ?)`,
      [endedBefore.toISOString(), executedBefore.toISOString(), limit],
    );
  }
  recordRateHit(key: string, at: Date): Promise<void> {
    return this.run('INSERT INTO rate_hits (key, at) VALUES (?, ?)', [key, at.toISOString()]);
  }
  countRateHits(key: string, since: Date): Promise<number> {
    return this.count('SELECT COUNT(*) AS n FROM rate_hits WHERE key = ? AND at >= ?', [key, since.toISOString()]);
  }
  purgeRateHits(before: Date, limit: number): Promise<number> {
    return this.changes('DELETE FROM rate_hits WHERE id IN (SELECT id FROM rate_hits WHERE at < ? ORDER BY id LIMIT ?)', [before.toISOString(), limit]);
  }
  async getTransferPrefs(learnerId: string): Promise<TransferPrefs> {
    const prefs = await this.one('SELECT * FROM learner_transfer_prefs WHERE learner_id = ?', [learnerId], (r): TransferPrefs => ({ selfManaged: bool(r.self_managed), blockTeacherRequests: bool(r.block_teacher_requests), updatedAt: nstr(r.updated_at) }));
    return prefs ?? { selfManaged: false, blockTeacherRequests: false, updatedAt: null };
  }
  async setTransferPref(learnerId: string, which: TransferPrefKey, value: boolean, now: Date): Promise<void> {
    assertTransferPrefKey(which);
    const column = PREF_COLUMN[which];
    return this.run(`INSERT INTO learner_transfer_prefs (learner_id, ${column}, updated_at) VALUES (?, ?, ?) ON CONFLICT(learner_id) DO UPDATE SET ${column} = excluded.${column}, updated_at = excluded.updated_at`, [
      learnerId,
      value ? 1 : 0,
      now.toISOString(),
    ]);
  }

  /** Tests only. Child tables first; a table whose migration has not landed yet is skipped. */
  async reset(): Promise<void> {
    const present = new Set(await this.many("SELECT name FROM sqlite_master WHERE type = 'table'", [], (r) => str(r.name)));
    for (const table of RESET_TABLES) {
      if (present.has(table)) await this.run(`DELETE FROM ${table}`, []);
    }
  }
}
