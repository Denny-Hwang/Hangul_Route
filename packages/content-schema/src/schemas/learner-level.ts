import { z } from 'zod';

/**
 * Learner level (F-LEARN-001 §3.1, decision L1).
 *
 * The ids stay '5-7' | '8-9' | '10-11' on the wire and in D1 (a CHECK
 * constraint pins them; no migration). Despite the field name `ageGroup`,
 * they are opaque level ids, not ages: this table is the one place that names
 * them. Strings are plain English (CEFR Pre-A1) so F-I18N-001 can overlay
 * `es` / `ko` keyed by `id`.
 */
export const LEARNER_LEVEL_IDS = ['5-7', '8-9', '10-11'] as const;
export const LearnerLevelIdSchema = z.enum(LEARNER_LEVEL_IDS);
export type LearnerLevelId = z.infer<typeof LearnerLevelIdSchema>;

/**
 * Who manages a profile (L2, L3). 'self' = the learner manages their own
 * profile and attests to being 13 or older; 'child' = an adult manages it.
 * Local only: never sent in LearnerRegister, telemetry or stored in D1.
 * Absent is treated as 'child' by consumers (never inferred from the level).
 */
export const LearnerTypeSchema = z.enum(['child', 'self']);
export type LearnerType = z.infer<typeof LearnerTypeSchema>;

export interface LearnerLevel {
  id: LearnerLevelId;
  order: 0 | 1 | 2;
  label: string;
  description: string;
}

export const LEARNER_LEVELS: readonly LearnerLevel[] = [
  { id: '5-7', order: 0, label: 'Pictures first', description: 'Big tiles and pictures, very little to read.' },
  { id: '8-9', order: 1, label: 'Some reading', description: 'Short words and short sentences.' },
  { id: '10-11', order: 2, label: 'Reads easily', description: 'Longer text, stories and conversations.' },
] as const;

export const DEFAULT_LEARNER_LEVEL: LearnerLevelId = '8-9';

export function isLearnerLevelId(v: unknown): v is LearnerLevelId {
  return LearnerLevelIdSchema.safeParse(v).success;
}

function find(id: string): LearnerLevel | null {
  return LEARNER_LEVELS.find((l) => l.id === id) ?? null;
}

/** Label for a stored id; null for an id this build does not know (a pill is then simply not drawn). */
export function levelLabel(id: string): string | null {
  return find(id)?.label ?? null;
}

export function levelDescription(id: string): string | null {
  return find(id)?.description ?? null;
}

/** 0 = Pictures first, 1 = Some reading, 2 = Reads easily; null for an unknown id. Consumers branch on this, never on the raw '5-7' id. */
export function levelOrder(id: string): 0 | 1 | 2 | null {
  return find(id)?.order ?? null;
}
