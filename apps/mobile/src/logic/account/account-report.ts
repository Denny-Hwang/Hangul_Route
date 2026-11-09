import type { Catalog, ReportPeriod, StageKey } from '@hangul-route/content-schema';
import type { Messages, UiLocale } from '@hangul-route/i18n';
import { inAppReportView, type InAppReportView, type ReportSectionView } from '../reports/report-view';
import type { AccountReportBody } from './account-data';

/**
 * F-AUTH-004 section 8.7 (row NS-5; design `account-reports.md` board 1, D14; CS-N5): the native account learner report
 * in words. `learnerReport()` over the route's answer (the consented roster projection the console reads, never the
 * device's snapshot), through the in-app report's view model (`inAppReportView` with the space's viewer: the third
 * voice, the console's stale and no-data lines, "All devices", that space's plan rows), with what native leaves out:
 *
 * - "Now on" and **Open Learning Route** (Learning Route pages are not in v1, ND-2; no control leads out);
 * - the free-end line `report.insight.free_days_done` (D14: on a build where nothing can be bought, saying the free
 *   part is over points to buying elsewhere). The filter is here, by the line's code, not in the shared blocks, so the
 *   in-app report is unchanged;
 * - line actions, Preview lessons and the skills rows are never drawn by the account screen (it passes none).
 *
 * Pure: the clock, the catalogue, the words and the content lookups come in.
 */

export interface AccountReportInput {
  body: AccountReportBody;
  period: ReportPeriod;
  /** A learner-local day selecting a past window (the stepper); null for the current one. */
  at: string | null;
  now: Date;
  catalog: Catalog;
  locale: UiLocale;
  messages: Messages;
  stageTitle: (stage: StageKey) => string;
  questTitle: (id: string) => string | null;
  letterInfo: (letter: string) => { romanization: string; gloss: string | null } | null;
  /** `Platform.OS`. */
  platform: string;
}

/** D14: the insight code native never draws, for any viewer. */
export const FREE_END_CODE = 'free_days_done';

function withoutFreeEnd(section: ReportSectionView | null): ReportSectionView | null {
  if (section === null) return null;
  const lines = section.lines.filter((line) => line.code !== FREE_END_CODE);
  return lines.length === 0 ? null : { ...section, lines };
}

/** The account learner report's view, or null for a space with no learner report (a school). */
export function accountReportView(input: AccountReportInput): InAppReportView | null {
  const { body } = input;
  if (body.space.kind === 'school') return null;
  const view = inAppReportView({
    summary: body.summary,
    name: body.learner.displayName,
    voice: 'third',
    period: input.period,
    at: input.at,
    now: input.now,
    catalog: input.catalog,
    locale: input.locale,
    messages: input.messages,
    stageTitle: input.stageTitle,
    questTitle: input.questTitle,
    letterInfo: input.letterInfo,
    learningRoute: false,
    platform: input.platform,
    viewer: body.space.kind,
    lastSyncedAt: body.lastSyncedAt,
  });
  // An archived space's report says so, neutrally (the console's line for a viewer who cannot unarchive: nobody can
  // here, ND-2), after the report's own lines.
  const archived = body.space.archivedAt !== null ? [input.messages.report.state.archived[body.space.kind]] : [];
  return {
    ...view,
    notices: [...view.notices, ...archived],
    glance: view.glance === null ? null : { ...view.glance, nowOn: null, openRoute: null },
    wentWell: withoutFreeEnd(view.wentWell),
    practiceNext: withoutFreeEnd(view.practiceNext),
  };
}
