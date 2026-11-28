/**
 * The level check's plan parts (AMENDMENTS-START-BUNDLE-2026-11 SB-4d): what the level check (`placement-chunk`) and the
 * grown-up reports (`reports-chunk`) share, a chunk of their own so the start bundle does not carry it. It is reached only
 * through the literal `import()` of `./plan-parts-entry.ts`, and both doors wait for it together with their own chunk.
 * Never import this module statically.
 */

/** The chunk's marker (`SCREEN_CHUNKS` in scripts/pwa/lesson-chunks.mjs): the build finds it here and never in the start bundle. */
export const PLAN_PARTS_CHUNK = 'screen-chunk:plan-parts';

export { placementRouteCatalog } from '../../logic/placement/catalog';
export { draftOfOffer, grownUpWarnings, grownUpWarningText, stripLineOf } from '../../logic/placement/plan-offer';
export { acceptPlanOffer, applyPlanUpdate, keepPlan, loadPlanOffer, planOfferNow } from '../../store/plan-offer-store';
export { PaceChips, PlanStrip, PlanUpdateCard } from './PlanParts';
export { usePlacementBank } from './use-placement-bank';
