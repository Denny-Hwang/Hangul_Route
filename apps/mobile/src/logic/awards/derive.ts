import type { Episode, ProgressSnapshot, StageKey } from '@hangul-route/content-schema';
import { isEpisodeComplete, stageAvailability } from '../journey';
import { shouldUnlockCard } from '../reward';
import { parseUnlockedBy } from './rules';
import type { AwardWorld, DerivedAward } from './types';

/**
 * The award engine (F-STORY-006 §3.1-§3.2): a pure function from the bundle
 * and a snapshot to the cards the snapshot should hold. Awards are derived,
 * never stored as events, so the same function runs live, at launch, after
 * a sync and after a restore without ever awarding a card twice.
 */

const isPlayable = (e: Pick<Episode, 'status'>): boolean => e.status === 'shipped' || e.status === 'ready';
const isGrid = (e: Pick<Episode, 'placement'>): boolean => (e.placement ?? 'grid') === 'grid';

/**
 * Times compare as instants (`Date.parse`), the same rule as
 * `earlierLatchTime` in logic/sync/merge.ts: an offset form from the Worker
 * or a restored backup can sit next to a UTC form. A value that does not
 * parse never beats one that does (neither as the earlier nor as the later
 * time); two unparseable values or one instant in two forms fall back to the
 * string order, so the result never depends on argument order.
 */
const parses = (t: string): boolean => Number.isFinite(Date.parse(t));

/** `a` is a strictly earlier instant than `b`. */
function isBefore(a: string, b: string): boolean {
  const pa = parses(a);
  if (pa !== parses(b)) return pa;
  return pa ? Date.parse(a) < Date.parse(b) : a < b;
}

function laterOf(a: string, b: string): string {
  const pa = parses(a);
  if (pa !== parses(b)) return pa ? a : b;
  const diff = pa ? Date.parse(a) - Date.parse(b) : 0;
  if (diff !== 0) return diff > 0 ? a : b;
  return a >= b ? a : b;
}

const latest = (times: readonly string[]): string => times.reduce(laterOf);

/**
 * Complete episodes and when each completed (the latest `completedAt` among
 * its quests). Grid and shelf episodes both count; a preview or draft
 * episode never completes.
 */
export function completedEpisodes(world: Pick<AwardWorld, 'episodes'>, snapshot: Pick<ProgressSnapshot, 'quests'>): Map<string, string> {
  const out = new Map<string, string>();
  for (const episode of world.episodes) {
    if (!isPlayable(episode) || !isEpisodeComplete(episode, snapshot.quests)) continue;
    const times = snapshot.quests
      .filter((q) => q.episodeId === episode.id && episode.questIds.includes(q.questId))
      .flatMap((q) => (q.completedAt ? [q.completedAt] : []));
    out.set(episode.id, latest(times));
  }
  return out;
}

/** The grid episodes of a stage, in content order (story shelves never count toward a stage). */
export function gridEpisodes(stage: StageKey, world: Pick<AwardWorld, 'episodes'>): Episode[] {
  return world.episodes.filter((e) => e.stage === stage && isGrid(e));
}

/**
 * A stage can complete only when every grid cell of it is shipped (the
 * Journey's "open" row); story shelves never count toward a stage.
 */
export function stageCanComplete(stage: StageKey, world: Pick<AwardWorld, 'episodes'>): boolean {
  return stageAvailability(stage, gridEpisodes(stage, world)) === 'open';
}

/** Every grid episode of a fully shipped stage is complete; `at` is the latest of their completion times. */
export function isStageComplete(
  stage: StageKey,
  world: Pick<AwardWorld, 'episodes'>,
  completed: ReadonlyMap<string, string>,
): { complete: boolean; at?: string } {
  if (!stageCanComplete(stage, world)) return { complete: false };
  const times = gridEpisodes(stage, world).map((e) => completed.get(e.id));
  if (times.some((t) => t === undefined)) return { complete: false };
  return { complete: true, at: latest(times as string[]) };
}

/**
 * One card named by two rules (a quest card is also its episode's card):
 * keep the earlier instant. Quest awards are collected first, so on a tie
 * (including one instant in two forms) the quest source stays and the result
 * never depends on content order.
 */
function better(first: DerivedAward, next: DerivedAward): DerivedAward {
  return isBefore(next.unlockedAt, first.unlockedAt) ? next : first;
}

/**
 * The full set of cards the rules say this snapshot should hold, one entry
 * per card, sorted by card id. Includes cards already owned; sets are
 * resolved last, counting members already owned or derived in this pass
 * by a non-set rule (a set card derived in the same pass never counts, so
 * the answer does not depend on the order of `world.sets`).
 */
export function derivedAwards(world: AwardWorld, snapshot: ProgressSnapshot, profile: { createdAt: string }): DerivedAward[] {
  const known = new Set(world.cards.map((c) => c.id));
  const found = new Map<string, DerivedAward>();
  const add = (award: DerivedAward): void => {
    const existing = found.get(award.cardId);
    found.set(award.cardId, existing ? better(existing, award) : award);
  };

  for (const quest of world.quests) {
    const cardId = quest.rewardCardId;
    if (!cardId || !known.has(cardId)) continue;
    const run = snapshot.quests.find((q) => q.questId === quest.id);
    if (run?.completedAt && shouldUnlockCard(run.stars)) add({ cardId, source: 'quest', via: quest.id, unlockedAt: run.completedAt });
  }

  const completed = completedEpisodes(world, snapshot);
  const sets: { cardId: string; setId: string }[] = [];
  for (const card of world.cards) {
    const rule = parseUnlockedBy(card.unlockedBy);
    if (rule.kind === 'episode') {
      const at = completed.get(rule.episodeId);
      if (at) add({ cardId: card.id, source: 'episode', via: rule.episodeId, unlockedAt: at });
    } else if (rule.kind === 'stage') {
      const { at } = isStageComplete(rule.stage, world, completed);
      if (at) add({ cardId: card.id, source: 'stage', via: rule.stage, unlockedAt: at });
    } else if (rule.kind === 'welcome') {
      add({ cardId: card.id, source: 'welcome', via: 'welcome', unlockedAt: profile.createdAt });
    } else if (rule.kind === 'set') {
      sets.push({ cardId: card.id, setId: rule.setId });
    }
  }

  const ownedAt = new Map(snapshot.cards.map((c) => [c.cardId, c.unlockedAt]));
  const base = new Map(found);
  for (const { cardId, setId } of sets) {
    const set = world.sets.find((s) => s.id === setId);
    if (!set || set.memberCardIds.length === 0) continue;
    const times = set.memberCardIds.map((id) => ownedAt.get(id) ?? base.get(id)?.unlockedAt);
    if (times.some((t) => t === undefined)) continue;
    add({ cardId, source: 'set', via: setId, unlockedAt: latest(times as string[]) });
  }

  return [...found.values()].sort((a, b) => a.cardId.localeCompare(b.cardId));
}

/** The derived awards this snapshot does not hold yet — what a reconcile adds. */
export function missingAwards(world: AwardWorld, snapshot: ProgressSnapshot, profile: { createdAt: string }): DerivedAward[] {
  const owned = new Set(snapshot.cards.map((c) => c.cardId));
  return derivedAwards(world, snapshot, profile).filter((a) => !owned.has(a.cardId));
}
