import {
  CLASS_SCOPE_LINE_IDS,
  CLASS_SCOPE_TEXT,
  classScopeItems,
  isTransferConsentLocale,
  type ClassScopeLineId,
  type InboxClassMove,
  type InboxClassScope,
  type LearnerType,
  type TransferConsentLocale,
} from '@hangul-route/content-schema';
import { effectiveLearnerType } from '../profiles/learner-type';

/**
 * [TV] The learner's Home lines about classes — AMENDMENTS-TEACHER-VISIBILITY-TRANSFER TV-D5, TV-D10 (wireframe
 * `design/wireframes/console/teacher-move-and-scope.md` screen 5). Pure: the inbox fields, the moves this device has
 * already shown, and the profile's type decide what Home draws.
 *
 * - One line per teacher move this device has not shown yet: "{name} moved to a new class: {class}." with OK. It names
 *   nothing private, so any profile reads it without the grown-up gate.
 * - One line when the class update waits for the family: a child profile reads that a grown-up has an update (Open
 *   goes through the grown-up gate), a self profile that there is an update (Open goes straight to it). A child
 *   profile never opens the grown-up screen itself.
 */

export interface ClassUpdateInput {
  scope: InboxClassScope | null;
  moves: readonly InboxClassMove[];
  /** Move ids this device already showed for this profile. */
  seen: readonly string[];
  profile: { learnerType?: LearnerType };
}

export interface ClassUpdateLines {
  moves: InboxClassMove[];
  /** `child`: Open goes through the grown-up gate; `self`: straight to the screen; null: no update waits. */
  scope: 'child' | 'self' | null;
}

export function classUpdateLines(input: ClassUpdateInput): ClassUpdateLines {
  const seen = new Set(input.seen);
  const moves = input.moves.filter((m) => !seen.has(m.id));
  const scope = input.scope?.needed === true ? (effectiveLearnerType(input.profile) === 'self' ? 'self' : 'child') : null;
  return { moves, scope };
}

/** At most this many move ids are kept per profile (the inbox carries 30 days of moves; a learner moves rarely). */
export const SEEN_MOVES_MAX = 50;

/** The seen list after showing `moveId`, newest last, bounded. */
export function withSeen(seen: readonly string[], moveId: string): string[] {
  const next = [...seen.filter((id) => id !== moveId), moveId];
  return next.slice(Math.max(0, next.length - SEEN_MOVES_MAX));
}

/** A stored seen list read leniently: anything that is not a list of strings reads as empty. */
export function readSeen(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string') : [];
}

export const classMovesSeenKey = (profileId: string): string => `class-moves-seen:${profileId}`;

/** One line of the class update screen: a statement, or the list heading with every item (always open). */
export interface ClassScopeLine {
  id: ClassScopeLineId;
  text: string;
  items: string[] | null;
}

/**
 * The class update's lines in the language of the screen (the keyed text of content-schema `CLASS_SCOPE_TEXT`, the
 * same ids in the same order as the console card), the learner's name filled in. A UI language with no text reads
 * English, as the class-move sheet does.
 */
export function classScopeLines(locale: string, learnerName: string): { locale: TransferConsentLocale; lines: ClassScopeLine[] } {
  const textLocale: TransferConsentLocale = isTransferConsentLocale(locale) ? locale : 'en';
  const fill = (text: string): string => text.split('{learner}').join(learnerName);
  const text = CLASS_SCOPE_TEXT[textLocale];
  const items = classScopeItems(textLocale).map((item) => fill(item.text));
  return {
    locale: textLocale,
    lines: CLASS_SCOPE_LINE_IDS.map((id) => ({ id, text: fill(text.lines[id]), items: id === 'list' ? items : null })),
  };
}
