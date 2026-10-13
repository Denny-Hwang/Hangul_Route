import type { ReportPeriod, TelemetryEventName } from '@hangul-route/content-schema';

/**
 * The in-app report's telemetry — F-REPORT-001 section 3.13 (RP-9). One `report.viewed` per open and per period
 * change or step, with `space: 'device'`: codes only, and **no `profileId`** (a grown-up event, like `lecture.*`; the
 * Worker drops it anyway). The screen passes it to `platform/telemetry` `track`.
 */
export interface ReportViewedEvent {
  name: TelemetryEventName;
  payload: { scope: 'learner'; space: 'device'; period: ReportPeriod };
}

export function reportViewedEvent(period: ReportPeriod): ReportViewedEvent {
  return { name: 'report.viewed', payload: { scope: 'learner', space: 'device', period } };
}
