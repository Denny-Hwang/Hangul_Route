import type { BackupFile, Profile, ProgressSnapshot } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import { mergeSnapshots } from './merge';

/**
 * What to do with a decoded backup file (F-SYNC-002 §3.3): merge into the
 * matching profile, or create it. Never overwrites.
 */
export interface RestorePlan {
  action: 'merge' | 'create';
  profile: Profile;
  snapshot: ProgressSnapshot;
  /** Human-readable deltas for the merge notice. */
  added: { cards: number; quests: number };
}

export function planRestore(
  file: BackupFile,
  existing: { profile: Profile; snapshot: ProgressSnapshot } | null,
  now: Date,
): RestorePlan {
  if (!existing) {
    return {
      action: 'create',
      profile: file.profile,
      snapshot: file.snapshot,
      added: { cards: file.snapshot.cards.length, quests: file.snapshot.quests.filter((q) => q.completedAt).length },
    };
  }
  const merged = mergeSnapshots(existing.snapshot, file.snapshot, { now });
  const beforeCards = new Set(existing.snapshot.cards.map((c) => c.cardId));
  const beforeQuests = new Set(existing.snapshot.quests.filter((q) => q.completedAt).map((q) => q.questId));
  return {
    action: 'merge',
    profile: existing.profile,
    snapshot: merged,
    added: {
      cards: merged.cards.filter((c) => !beforeCards.has(c.cardId)).length,
      quests: merged.quests.filter((q) => q.completedAt && !beforeQuests.has(q.questId)).length,
    },
  };
}

type Caregiver = Messages['caregiver'];

/**
 * Copy after a teacher approves a re-link (F-TCH-001 §10.1). The class link
 * restores the learner and the class, not the cards (SEC-4): say where they
 * come from instead of promising them. Words: `restore.notice` and
 * `audience.shared.restoreCardsBack` (F-I18N-001 §3.4 rule 3).
 */
export function relinkNotice(plan: RestorePlan, m: Pick<Caregiver, 'restore' | 'audience'>): string {
  const back = m.restore.notice.relinked(plan.profile.displayName);
  return plan.action === 'create' ? `${back} ${m.audience.shared.restoreCardsBack}` : back;
}

/** Copy for the merge notice — warm, never "overwritten"; counts go through the message's plural(). */
export function restoreNotice(plan: RestorePlan, m: Pick<Caregiver, 'restore'>): string {
  const name = plan.profile.displayName;
  if (plan.action === 'create') return m.restore.notice.created(name);
  const { cards, quests } = plan.added;
  return cards === 0 && quests === 0 ? m.restore.notice.nothingNew(name) : m.restore.notice.added(name, cards, quests);
}
