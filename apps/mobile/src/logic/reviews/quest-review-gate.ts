/**
 * Who gets the quest warm-up and Try these again (F-CURR-002 sections 4.5 and 12.2, row CM-15). Pure and tiny, in
 * the start bundle: the quest player asks it before it loads anything, so with a switch off (built-in pct 0 until
 * the ramp) the surface hides and the review engine never loads.
 */

/** `stage2` -> 2; anything else 0. */
export function stageNumber(stageKey: string | undefined): number {
  const match = /^stage([1-7])$/.exec(stageKey ?? '');
  return match ? Number(match[1]) : 0;
}

export interface WarmupGate {
  /** `questWarmup` is on for the learner. */
  flagOn: boolean;
  /** The learner's answers are recorded (`memoryRecord` on, a learner persona): the due pool is real. */
  records: boolean;
  stage: number;
  /** The step the run starts on: a resumed story quest starts past step 0 and gets no warm-up. */
  startStep: number;
}

/** Whether a quest may open with a warm-up: Stage 2+, from its first step, both switches on. */
export function warmupOffered(g: WarmupGate): boolean {
  return g.flagOn && g.records && g.stage >= 2 && g.startStep === 0;
}

/** Whether the reward step may offer Try these again: `missedPractice` on, answers recorded, and a miss to look at. */
export function tryAgainOffered(g: { flagOn: boolean; records: boolean; misses: number }): boolean {
  return g.flagOn && g.records && g.misses > 0;
}
