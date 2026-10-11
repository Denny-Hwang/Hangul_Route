/**
 * Stage completion (F-QUEST-002 §3.8). A thin re-export of the award engine's
 * transitions (F-STORY-006 §3.4), so the Stage 1 ceremony and the stage cards
 * use one rule: a stage is complete when every grid episode of a fully
 * shipped stage is complete (every quest has a `completedAt`, at any star
 * count). Story shelf episodes never count toward a stage.
 */
export type { CompletionState, CompletionTransition } from '../awards/transitions';
export { completionState, completionTransition, stageCompleteFor as isStageComplete } from '../awards/transitions';
