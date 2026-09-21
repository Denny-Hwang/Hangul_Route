import type { BackupFile, Profile, ProgressSnapshot } from '@hangul-route/content-schema';
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

/** Copy for the merge notice — English, warm, never "overwritten". */
export function restoreNotice(plan: RestorePlan): string {
  const name = plan.profile.displayName;
  if (plan.action === 'create') return `Welcome back, ${name}! Your journey is here.`;
  const parts: string[] = [];
  if (plan.added.cards > 0) parts.push(`${plan.added.cards} ${plan.added.cards === 1 ? 'card' : 'cards'}`);
  if (plan.added.quests > 0) parts.push(`${plan.added.quests} ${plan.added.quests === 1 ? 'quest' : 'quests'}`);
  return parts.length === 0
    ? `${name} already has everything from this file.`
    : `We found ${name}'s progress! Added ${parts.join(' and ')}.`;
}
