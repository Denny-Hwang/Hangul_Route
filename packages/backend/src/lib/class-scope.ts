import { CLASS_SCOPE_TEXT_VERSION, TRANSFER_CONSENT_TEXT_VERSION, isFullScopeVersion, type ClassScope, type NotesMode, type SpaceKind } from '@hangul-route/content-schema';
import type { Db, StoredClassScopeAck } from '../db';

/**
 * [TV] The per-learner scope of a roster or report reader (AMENDMENTS-TEACHER-VISIBILITY-TRANSFER
 * section 2): a family is always `full`; a class or school is `full` for a learner whose family
 * acknowledged the class-scope update at a full-scope version (TV-D4), else `base`. One set-based
 * read per request, whatever the class size.
 */
export async function learnerScopes(db: Db, kind: SpaceKind, learnerIds: readonly string[]): Promise<Map<string, ClassScope>> {
  const out = new Map<string, ClassScope>();
  if (kind === 'family') {
    for (const id of learnerIds) out.set(id, 'full');
    return out;
  }
  for (const id of learnerIds) out.set(id, 'base');
  if (learnerIds.length === 0) return out;
  for (const ack of await db.classScopeAcksOf(learnerIds)) if (isFullScopeVersion(ack.textVersion)) out.set(ack.learnerId, 'full');
  return out;
}

/** The scope of one learner for a viewer of `kind`. */
export async function learnerScope(db: Db, kind: SpaceKind, learnerId: string): Promise<ClassScope> {
  return (await learnerScopes(db, kind, [learnerId])).get(learnerId) ?? 'base';
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
 * an acknowledgement at a version that opens less than the stored one never replaces it.
 */
export async function recordClassScopeAck(db: Db, input: Omit<StoredClassScopeAck, 'ackedAt'>, now: Date): Promise<StoredClassScopeAck> {
  const stored = await db.getClassScopeAck(input.learnerId);
  if (stored && isFullScopeVersion(stored.textVersion) && !isFullScopeVersion(input.textVersion)) return stored;
  const ack: StoredClassScopeAck = { ...input, ackedAt: now.toISOString() };
  await db.putClassScopeAck(ack);
  return ack;
}

/**
 * A guardian's consent to a family-started class move recorded at the current transfer text also acknowledges
 * the class-scope update ([TV] TV-D4): that sheet lists every full-scope item. A consent at an older text does not.
 */
export async function ackFromTransferConsent(db: Db, learnerId: string, accountId: string, textVersion: string, now: Date): Promise<void> {
  if (textVersion !== TRANSFER_CONSENT_TEXT_VERSION) return;
  await recordClassScopeAck(db, { learnerId, textVersion: CLASS_SCOPE_TEXT_VERSION, basis: 'caregiver', evidence: accountId }, now);
}
