/**
 * The pure report module — F-REPORT-001 section 3.4. One module for the Worker (class aggregates), the console
 * (learner report) and the learner app (in-app report), so the three cannot disagree.
 *
 * Only the public surface of section 3.4 leaves the package root; the small date helpers (`addMonths`,
 * `rowsFromOf`, `firstDayOf`, `lettersIn`, ...) stay module imports for the other report modules, so no generic
 * name crowds the root.
 */
export {
  todayFor,
  windowOf,
  clampAt,
  stepOf,
  horizonOf,
  sumDays,
  practiceDaysIn,
  localRunEndingAt,
  monthOf,
  type ReportWindow,
  type ReportStep,
  type ReportHorizon,
  type DaySums,
} from './windows';
export {
  learnerReport,
  REPORT_WORDS_VISIBLE,
  type ReportViewer,
  type ReportVoice,
  type LearnerReportInput,
  type LearnerReportState,
  type ReportHeadlineCode,
  type ReportCalendarKind,
  type ReportStage,
  type ReportFigure,
  type ReportCalendarCell,
  type ReportPlanCounts,
  type LearnerReportDetail,
  type LearnerReport,
} from './learner-report';
export {
  wentWell,
  practiceNext,
  INSIGHT_CODES,
  INSIGHT_LINES_MAX,
  InsightLineSchema,
  WENT_WELL_CODES,
  WENT_WELL_RULES,
  PRACTICE_NEXT_CODES,
  PRACTICE_NEXT_RULES,
  type InsightCode,
  type WentWellCode,
  type PracticeNextCode,
  type InsightLine,
  type InsightSummary,
  type InsightContext,
} from './insights';
export { classReport, type ClassReportInput, type ClassReportLearner, type ClassReportPlan } from './class-report';
