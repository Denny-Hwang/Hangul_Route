import { CLASS_SCOPE_TEXT_VERSION, TRANSFER_CONSENT_TEXT_VERSION, classScopeRank, type ClassScope, type NotesMode, type SpaceKind } from '@hangul-route/content-schema';
import type { Db, StoredClassScopeAck } from '../db';

/**
 * [TV] The Worker switch for full-scope teacher visibility (AMENDMENTS-TEACHER-VISIBILITY-TRANSFER TV-D15): a dashboard
 * text variable kept across deploys (`keep_vars = true`). On when unset, empty or `enabled`; any other value (the kill
 * switch is `disabled`) fails closed, so every class and school reader sees the base scope at once. Acknowledgements
 * are still recorded while it is off, and count again once it is back on. Families always read full scope.
 */
export interface ClassScopeEnv {
  CLASS_SCOPE_FULL?: string;
}

export function classScopeFullEnabled(env: ClassScopeEnv | undefined): boolean {
  const v = env?.CLASS_SCOPE_FULL;
  return v === undefined || v === '' || v === 'enabled';
}

/**
 * What a roster or report reader may read of one learner: the [TV] scope, and whether the memory counts
 * (`summary.memory`, F-CURR-002 row CM-16) are open to it, which needs an acknowledgement at a text that lists the
 * `memory` item (`MEMORY_SCOPE_TEXT_VERSIONS`). A family always reads both.
 */
export interface LearnerReadScope {
  scope: ClassScope;
  memory: boolean;
}

/**
 * [TV] The per-learner scope of a roster or report reader (AMENDMENTS-TEACHER-VISIBILITY-TRANSFER
 * section 2): a family is always `full`; a class or school is `full` for a learner whose family
 * acknowledged the class-scope update at a full-scope version (TV-D4), else `base`, and reads the memory counts only
 * at a memory-scope version (row CM-16). One set-based read per request, whatever the class size. With the switch
 * off, or when the acknowledgement read fails (for example a Worker that runs before migration 0009), a class or
 * school reads `base` for everyone: closed for privacy, open for availability.
 */
export async function learnerReadScopes(db: Db, kind: SpaceKind, learnerIds: readonly string[], env?: ClassScopeEnv): Promise<Map<string, LearnerReadScope>> {
  const out = new Map<string, LearnerReadScope>();
  if (kind === 'family') {
    for (const id of learnerIds) out.set(id, { scope: 'full', memory: true });
    return out;
  }
  for (const id of learnerIds) out.set(id, { scope: 'base', memory: false });
  if (learnerIds.length === 0 || !classScopeFullEnabled(env)) return out;
  let acks: StoredClassScopeAck[];
  try {
    acks = await db.classScopeAcksOf(learnerIds);
  } catch {
    return out;
  }
  for (const ack of acks) {
    const rank = classScopeRank(ack.textVersion);
    if (rank > 0) out.set(ack.learnerId, { scope: 'full', memory: rank === 2 });
  }
  return out;
}

/** The [TV] scope alone, per learner (`learnerReadScopes` without the memory flag). */
export async function learnerScopes(db: Db, kind: SpaceKind, learnerIds: readonly string[], env?: ClassScopeEnv): Promise<Map<string, ClassScope>> {
  const scopes = await learnerReadScopes(db, kind, learnerIds, env);
  return new Map([...scopes].map(([id, read]) => [id, read.scope]));
}

/** What a reader of `kind` may read of one learner. */
export async function learnerReadScope(db: Db, kind: SpaceKind, learnerId: string, env?: ClassScopeEnv): Promise<LearnerReadScope> {
  return (await learnerReadScopes(db, kind, [learnerId], env)).get(learnerId) ?? { scope: 'base', memory: false };
}

/** The scope of one learner for a viewer of `kind`. */
export async function learnerScope(db: Db, kind: SpaceKind, learnerId: string, env?: ClassScopeEnv): Promise<ClassScope> {
  return (await learnerReadScope(db, kind, learnerId, env)).scope;
}

/**
 * The learner's server-held settings a full-scope reader sees (TV-D12): the class-notes setting
 * (`learner_note_prefs.classes`, F-FEEDBACK-001 section 7.4), `all` when the family never changed it.
 */
export async function learnerSettingsOf(db: Db, learnerId: string): Promise<{ classNotes: NotesMode | null }> {
  const prefs = await db.getNotePrefs(learnerId);
  return { classNotes: prefs?.classes ?? 'all' };
}

/**
 * Writes a learner's acknowledgement (TV-D4) and answers it. A newer acknowledgement replaces an older one;
 * an acknowledgement at a version that opens less than the stored one (`classScopeRank`) never replaces it.
 */
export async function recordClassScopeAck(db: Db, input: Omit<StoredClassScopeAck, 'ackedAt'>, now: Date): Promise<StoredClassScopeAck> {
  const stored = await db.getClassScopeAck(input.learnerId);
  if (stored && classScopeRank(stored.textVersion) > classScopeRank(input.textVersion)) return stored;
  const ack: StoredClassScopeAck = { ...input, ackedAt: now.toISOString() };
  await db.putClassScopeAck(ack);
  return ack;
}

/**
 * The class-scope text each transfer text also acknowledges: the current one lists every full-scope item, so it
 * stands for the current class-scope text; `transfer-2026-10d` listed every one but the `memory` item (row CM-16), so
 * it stands for `class-scope-2026-10`, the full scope without the memory counts. An older text acknowledges nothing.
 */
const CLASS_SCOPE_OF_TRANSFER_TEXT: Readonly<Record<string, string>> = {
  [TRANSFER_CONSENT_TEXT_VERSION]: CLASS_SCOPE_TEXT_VERSION,
  'transfer-2026-10d': 'class-scope-2026-10',
};

/**
 * A guardian's consent to a family-started class move also acknowledges the class-scope update ([TV] TV-D4) that
 * its sheet listed in full (`CLASS_SCOPE_OF_TRANSFER_TEXT`). A consent at an older text does not.
 */
export async function ackFromTransferConsent(db: Db, learnerId: string, accountId: string, textVersion: string, now: Date): Promise<void> {
  const version = CLASS_SCOPE_OF_TRANSFER_TEXT[textVersion];
  if (version === undefined) return;
  await recordClassScopeAck(db, { learnerId, textVersion: version, basis: 'caregiver', evidence: accountId }, now);
}
