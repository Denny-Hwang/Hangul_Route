/**
 * The goals chunk (F-CURR-002 section 7.4 and section 10, row CM-17): the daily and weekly goals' logic and screens,
 * one precached web bundle of its own, reached only through the literal `import()` of `store/goals-entry.ts`. Never
 * import it statically from the start bundle (Metro would then fold it back in). Its marker is `GOALS_CHUNK`.
 */
export const GOALS_CHUNK = 'goals-chunk:goals';
export { checkSteadyWeeks, handleGoalEvent, planDaysFor, recordActivityPoints, saveGoals, takeGoalMoment } from '../../store/goals';
export { GoalMomentBanner } from './GoalMomentBanner';
export { GoalsHome } from './GoalsHome';
