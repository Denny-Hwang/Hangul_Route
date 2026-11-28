import { chunkDoor } from '../chunk-door';

// The bank's loader holds the literal `import()` of the bank chunk (`content/placement-bank.ts`). A chunk that holds the
// literal of another chunk is named by a hash that does not cover its own content (the post-build rejects it), so the
// loader stays a start module (about 0.5 KB), through this door, and `use-placement-bank.ts` reads it from here.
export { loadPlacementBank, placementBankNow } from '../../content/placement-bank';

/*
 * The start bundle's door to the level check's plan parts (AMENDMENTS-START-BUNDLE-2026-11 SB-4d): the plan offer, its
 * store, the plan strip and cards, the bank hook and the route catalog live in `plan-parts-chunk.tsx`, reached only
 * through the literal `import()` below. The level check's door (`placement-entry.tsx`) and the reports' door
 * (`parent/reports-entry.tsx`) wait for the parts together with their own chunk under one retry level (`withPlanParts`),
 * so no screen inside either chunk draws before they are in, and none draws a waiting frame of its own (decision D4).
 */

export type PlanParts = typeof import('./plan-parts-chunk');

/** The door of the chunk: its `attempt()` is one import with no retry of its own, for the doors' single retry level. */
export const planPartsDoor = chunkDoor<PlanParts>(() => import('./plan-parts-chunk'));

/** Thrown by `usePlanParts` when a screen draws before its door has the parts in (a development error: the doors guarantee them). */
export class PlanPartsMissing extends Error {
  override name = 'PlanPartsMissing';
  constructor() {
    super('the plan parts are not loaded: the screen was drawn before its door waited for them');
  }
}

/** The plan parts, for a screen inside `placement-chunk` or `reports-chunk`; throws `PlanPartsMissing` when they are not in. */
export function usePlanParts(): PlanParts {
  const parts = planPartsDoor.now();
  if (parts === null) throw new PlanPartsMissing();
  return parts;
}

/**
 * A screen chunk's import together with the plan parts, for a door's one retry level: it resolves with the screen chunk
 * once both are in, and rejects when either fails (the door's retry asks for both again).
 */
export function withPlanParts<C>(importScreen: () => Promise<C>, importParts: () => Promise<unknown> = planPartsDoor.attempt): () => Promise<C> {
  return async () => {
    const [screen] = await Promise.all([importScreen(), importParts()]);
    return screen;
  };
}
