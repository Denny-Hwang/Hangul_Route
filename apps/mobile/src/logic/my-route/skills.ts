import type { MinigameKind, Quest } from '@hangul-route/content-schema';
import type { Skill, SkillRow } from './types';

/**
 * What your quests practice (F-ROUTE-001 section 3.7): an inventory of
 * finished quests, never a score. No skill is measured; a finished quest
 * counts for a skill when one of its steps names a game mapped to it.
 * Speaking is not tracked (owner decision 2026-10-10).
 */

export const SKILLS: readonly Skill[] = ['read', 'listen', 'write'];

/** OD-5 default. Exhaustive over `MinigameKindSchema.options`, so a new kind fails the build until it is mapped. */
export const SKILL_OF_KIND: Readonly<Record<MinigameKind, readonly Skill[]>> = {
  'match-sound': ['read', 'listen'],
  'tap-respond': ['read', 'listen'],
  'listen-pick': ['listen'],
  'match-shape': ['read'],
  'odd-one-out': ['read'],
  'pic-word-match': ['read'],
  'story-read': ['read'],
  'trace-stroke': ['write'],
  // Spelling from tiles, not handwriting: counted only in the grown-up "Spelling with tiles" line.
  'build-letter': [],
  'syllable-build': [],
  // Words and culture: do not need decoding.
  'card-match': [],
  'culture-quiz': [],
  'story-sequence': [],
  'story-check': [],
  // Speaking is not tracked in this feature.
  'voice-echo': [],
  // Enum only, no renderer.
  'tap-rhythm': [],
  // F-CURR-001 §3.11 (row G-1, OD-5): Sentence Builder orders whole words and picks particles, which is
  // composing written Korean, so it reads and writes. Only `order-it` changes: tile spelling (TILE_KINDS)
  // still counts toward no skill.
  'order-it': ['read', 'write'],
  // F-CURR-001 §3.11 (row C-1): reading real-world texts, and writing by typing, tracing and sentence frames.
  'realia-read': ['read'],
  'type-hangul': ['write'],
  'trace-word': ['write'],
  'write-frame': ['write'],
};

export const TILE_KINDS: ReadonlySet<MinigameKind> = new Set<MinigameKind>(['build-letter', 'syllable-build']);

export const SKILL_THRESHOLDS: readonly number[] = [1, 2, 4, 6, 8];

type QuestSteps = Pick<Quest, 'steps'>;

export function questSkills(quest: QuestSteps): Set<Skill> {
  return new Set(quest.steps.flatMap((s) => (s.minigameKind ? SKILL_OF_KIND[s.minigameKind] : [])));
}

const hasTiles = (quest: QuestSteps): boolean => quest.steps.some((s) => s.minigameKind !== undefined && TILE_KINDS.has(s.minigameKind));

export function marksFor(count: number): SkillRow['marks'] {
  return SKILL_THRESHOLDS.filter((t) => count >= t).length as SkillRow['marks'];
}

/**
 * Three rows: earned marks, and at most one faint "next" slot, only when the
 * quests open to this learner that count for the skill reach the next
 * threshold. `open` is the offerable quests (grid and shelf); a finished quest
 * always counts as open.
 */
export function skillRows(i: {
  finished: ReadonlySet<string>;
  open: ReadonlySet<string>;
  quests: readonly (QuestSteps & Pick<Quest, 'id'>)[];
}): SkillRow[] {
  return SKILLS.map((skill) => {
    const counting = i.quests.filter((q) => questSkills(q).has(skill));
    const quests = counting.filter((q) => i.finished.has(q.id)).length;
    const reachable = counting.filter((q) => i.finished.has(q.id) || i.open.has(q.id)).length;
    const marks = marksFor(quests);
    const next = SKILL_THRESHOLDS[marks];
    return { skill, marks, nextReachable: next !== undefined && reachable >= next, quests };
  });
}

/** Finished quests with a tile-building game (grown-up view only). */
export function tilesCount(finished: ReadonlySet<string>, quests: readonly (QuestSteps & Pick<Quest, 'id'>)[]): number {
  return quests.filter((q) => finished.has(q.id) && hasTiles(q)).length;
}
