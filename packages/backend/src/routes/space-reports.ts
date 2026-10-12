import { ReportSummarySchema, reportPeriodOf, type LearnerReportResponse, type ReportSummary } from '@hangul-route/content-schema';
import { Hono } from 'hono';
import { dbFor } from '../db';
import { fail, ok } from '../envelope';
import { rosterSummary, type FamilyVisibleSummary } from '../lib/roster-summary';
import { recordServerEvent } from '../lib/server-events';
import { findSpace, publicSpace, requireCan, rosterName } from './spaces';

/**
 * Progress report routes — F-REPORT-001 section 3.8. Read-only and additive:
 * no migration, no new table. A report reads exactly what the roster reads
 * (the allow-listed summary, `summary.read`), so it can never show more than
 * the roster's consent allows, and it reads it with a narrow select that never
 * loads `payload_json`. The console has no telemetry client, so each served
 * report records its own `report.viewed` event, codes only (section 3.13).
 */
export const spaceReportRoutes = new Hono();

/** The summary keys a report reads (`ReportSummarySchema`); anything else the roster carries stays out (data minimisation). */
const REPORT_SUMMARY_KEYS: readonly string[] = Object.keys(ReportSummarySchema.shape);

function reportSummaryOf(projected: FamilyVisibleSummary | null): ReportSummary | null {
  if (!projected) return null;
  const source = projected as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of REPORT_SUMMARY_KEYS) if (source[key] !== undefined) out[key] = source[key];
  // Every value comes from the roster projection, which only removes and narrows validated data.
  return out as ReportSummary;
}

/**
 * GET /api/spaces/:id/learners/:learnerId/report?period=<day|week|month|all>
 *
 * Who: whoever may read the roster (family caregiver or owner, class teacher
 * or owner, a school admin over the class: OD-14, read-only). Archived spaces
 * are served read-only, like the roster. A school space has no learner report
 * (409 `wrong_kind`: its admin opens the class's). A learner who is not a
 * member of this space answers 404 `not_member`, with no hint whether the id
 * exists elsewhere. `period` only labels the server event; anything unknown
 * reads as `week`.
 */
spaceReportRoutes.get('/:id/learners/:learnerId/report', async (c) => {
  const db = dbFor(c);
  const space = await findSpace(c, db, c.req.param('id'), true);
  if (!('id' in space)) return space;
  const account = await requireCan(c, db, space, 'summary.read');
  if (!('id' in account)) return account;
  if (space.kind === 'school') return fail(c, 'wrong_kind', 'A school has no learner report; open the class report', 409);

  const membership = await db.membership(space.id, 'learner', c.req.param('learnerId'));
  const learner = membership ? await db.getLearner(membership.memberId) : null;
  if (!membership || !learner) return fail(c, 'not_member', 'This learner is not in this space', 404);

  // planProgress keeps this space's own plans only, archived ones included (F-SPACE-002 T-1a), as on the roster.
  const planIds = new Set((await db.plansOf(space.id)).map((p) => p.id));
  const stored = await db.summaryOf(learner.id);
  const body: LearnerReportResponse = {
    space: publicSpace(space),
    // No ageGroup: no report block uses it (section 3.8, data minimisation).
    learner: {
      id: learner.id,
      displayName: rosterName(space, learner.displayName),
      avatar: learner.avatar,
      joinedAt: membership.joinedAt,
      lastActiveAt: learner.lastActiveAt,
    },
    // The roster's projection for this kind and this membership: selfRoute for a family only, no activity day before joinedAt for a class.
    summary: reportSummaryOf(rosterSummary(stored?.summary, planIds, space.kind, { joinedAt: membership.joinedAt })),
    lastSyncedAt: stored?.updatedAt ?? null,
    serverTime: new Date().toISOString(),
  };
  recordServerEvent('report.viewed', { scope: 'learner', space: space.kind, period: reportPeriodOf(c.req.query('period')) });
  return ok(c, body);
});
