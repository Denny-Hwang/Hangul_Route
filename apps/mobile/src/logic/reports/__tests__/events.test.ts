import { REPORT_PERIODS, REPORT_TELEMETRY_PAYLOAD, TelemetryEventNameSchema } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { reportViewedEvent } from '../events';

/** F-REPORT-001 section 3.13 (RP-9): `report.viewed` from the app, codes only and never a profile id. */
describe('reportViewedEvent', () => {
  it.each(REPORT_PERIODS)('%s: scope learner, space device, the period, and no profileId', (period) => {
    const event = reportViewedEvent(period);
    expect(event).toEqual({ name: 'report.viewed', payload: { scope: 'learner', space: 'device', period } });
    expect('profileId' in event).toBe(false);
    expect(TelemetryEventNameSchema.safeParse(event.name).success).toBe(true);
  });

  it('every payload value is one the Worker keeps (REPORT_TELEMETRY_PAYLOAD)', () => {
    const { payload } = reportViewedEvent('week');
    expect(Object.keys(payload).sort()).toEqual(Object.keys(REPORT_TELEMETRY_PAYLOAD).sort());
    for (const [key, value] of Object.entries(payload)) {
      expect((REPORT_TELEMETRY_PAYLOAD as Record<string, readonly string[]>)[key]).toContain(value);
    }
  });
});
