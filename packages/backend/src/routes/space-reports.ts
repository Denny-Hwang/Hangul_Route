import {
  CATALOG,
  ProgressSummarySchema,
  ReportSummarySchema,
  classAtOf,
  classReport,
  reportPeriodOf,
  type ClassReportResponse,
  type LearnerReportResponse,
  type ReportSummary,
} from '@hangul-route/content-schema';
import { topDueOf, type ClassProgressCounts, type LearningSummaryResponse } from '@hangul-route/content-schema/learning-summary';
import { Hono } from 'hono';
import type { Db } from '../db';
import { dbFor } from '../db';
import { fail, ok } from '../envelope';
import { learnerReadScope, learnerReadScopes, learnerSettingsOf, type ClassScopeEnv } from '../lib/class-scope';
import { memoryFor, rosterSummary, type FamilyVisibleSummary } from '../lib/roster-summary';
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
export const spaceReportRoutes = new Hono<{ Bindings: ClassScopeEnv }>();

const PLAN_ENTRY = ProgressSummarySchema.shape.planProgress.valueSchema;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * The report's summary: the roster projection narrowed to the keys a report
 * reads (`ReportSummarySchema`; anything else the roster carries stays out,
 * data minimisation), each key checked on its own, and each plan of
 * `planProgress` on its own. A stored summary was valid when it was written,
 * but an older build may have written a field the schema has since tightened:
 * that one field (or plan) is dropped instead of failing the whole report, so
 * the body always parses as `LearnerReportResponseSchema`.
 */
function reportSummaryOf(projected: FamilyVisibleSummary | null): ReportSummary | null {
  if (!projected) return null;
  const source = projected as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(ReportSummarySchema.shape)) {
    const value = source[key];
    if (value === undefined) continue;
    if (key === 'planProgress' && isRecord(value)) {
      out.planProgress = Object.fromEntries(
        Object.entries(value).flatMap(([planId, row]) => {
          const checked = PLAN_ENTRY.safeParse(row);
          return checked.success ? [[planId, checked.data]] : [];
        }),
      );
      continue;
    }
    const checked = field.safeParse(value);
    if (checked.success && checked.data !== undefined) out[key] = checked.data;
  }
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

  // Independent reads, in parallel (one round trip); nothing read here is used before the membership check below.
  // planProgress keeps this space's own plans only, archived ones included (F-SPACE-002 T-1a), as on the roster.
  const learnerId = c.req.param('learnerId');
  const [membership, learner, plans, stored] = await Promise.all([
    db.membership(space.id, 'learner', learnerId),
    db.getLearner(learnerId),
    db.plansOf(space.id),
    db.summaryOf(learnerId),
  ]);
  if (!membership || !learner) return fail(c, 'not_member', 'This learner is not in this space', 404);
  const planIds = new Set(plans.map((p) => p.id));
  // [TV] AMENDMENTS-TEACHER-VISIBILITY-TRANSFER section 2: the learner report is a student's detail view (firstTryRate kept); the scope decides the rest.
  const { scope, memory } = await learnerReadScope(db, space.kind, learner.id, c.env);
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
    // F-CURR-002 CM-16: the memory counts where the acknowledged text listed them (a family always).
    summary: reportSummaryOf(rosterSummary(stored?.summary, planIds, space.kind, { joinedAt: membership.joinedAt, scope, memory, detail: true })),
    lastSyncedAt: stored?.updatedAt ?? null,
    serverTime: new Date().toISOString(),
    scope,
    settings: scope === 'full' ? await learnerSettingsOf(db, learner.id) : null,
  };
  // One event per report a grown-up actually views: a HEAD (Hono answers it with this GET handler) records nothing, nor
  // does the console's background read of a report already open (`refresh=1`, F-LEARN-001 section 3.11).
  if (c.req.method === 'GET' && c.req.query('refresh') !== '1') recordServerEvent('report.viewed', { scope: 'learner', space: space.kind, period: reportPeriodOf(c.req.query('period')) });
  // A learner's progress never sits in a shared browser's HTTP cache.
  c.header('Cache-Control', 'no-store');
  return ok(c, body);
});

/**
 * GET /api/spaces/:id/class-report?period=<day|week|month|all>&at=<day>
 *
 * Class statistics (F-REPORT-001 sections 3.7 and 3.8, RP-5b): aggregates
 * only, computed here so the class page never receives a per-learner row.
 * Who: whoever may read the class roster (class teacher or owner, a school
 * admin over the class); archived classes are served read-only. A family
 * space has no class report (siblings are never compared) and a school has
 * none either: both answer 409 `wrong_kind`.
 *
 * Reads: the memberships and the plans, then the learner members that still
 * have a learner row (`learnersOf`, ids only) and their stored summaries
 * (`summariesOf`, never `payload_json`), each batched as `IN (...)` chunks of
 * 100 ids, so the statement count grows by 2 per 100 members and nothing
 * else. Each summary is the roster's own projection for its membership
 * (`rosterSummary` with `joinedAt`), so the report can never count more than
 * the roster's consent allows; no id or name is carried into `classReport`.
 * The body echoes `at` as `classAtOf` clamped it (null: the current window).
 */
spaceReportRoutes.get('/:id/class-report', async (c) => {
  const db = dbFor(c);
  const space = await findSpace(c, db, c.req.param('id'), true);
  if (!('id' in space)) return space;
  const account = await requireCan(c, db, space, 'summary.read');
  if (!('id' in account)) return account;
  if (space.kind !== 'class') return fail(c, 'wrong_kind', 'Only a class has a class report', 409);

  const [members, plans] = await Promise.all([db.membersOf(space.id), db.plansOf(space.id)]);
  const joinedAt = new Map(members.filter((m) => m.memberKind === 'learner').map((m) => [m.memberId, m.joinedAt]));
  const memberIds = [...joinedAt.keys()];
  const [learnerIds, stored] = await Promise.all([db.learnersOf(memberIds), db.summariesOf(memberIds)]);
  const summaries = new Map(stored.map((row) => [row.learnerId, row]));
  // [TV] each learner counts with its own scope, so a base-scope learner's words never reach a class total
  const scopes = await learnerReadScopes(db, space.kind, learnerIds, c.env);
  // planProgress keeps this class's own plans only (archived ones included), as on the roster.
  const planIds = new Set(plans.map((p) => p.id));
  const learners = learnerIds.map((learnerId) => {
    const row = summaries.get(learnerId);
    const joined = joinedAt.get(learnerId) ?? null;
    const read = scopes.get(learnerId);
    return { summary: reportSummaryOf(rosterSummary(row?.summary, planIds, space.kind, { joinedAt: joined, scope: read?.scope, memory: read?.memory })), lastSyncedAt: row?.updatedAt ?? null, joinedAt: joined };
  });

  const period = reportPeriodOf(c.req.query('period'));
  const now = new Date();
  // The window is clamped here with the same `now` as `serverTime` and echoed, so the page labels the window the
  // figures read instead of recomputing it on the browser's clock (section 3.7). `classAtOf` is idempotent, so
  // `classReport` reads this very window.
  const at = classAtOf(period, c.req.query('at') ?? null, now);
  const body: ClassReportResponse = {
    space: publicSpace(space),
    period,
    at,
    serverTime: now.toISOString(),
    report: classReport({ learners, plans, period, at, now, catalog: CATALOG }),
  };
  if (c.req.method === 'GET') recordServerEvent('report.viewed', { scope: 'class', space: space.kind, period });
  // A class's progress never sits in a shared browser's HTTP cache.
  c.header('Cache-Control', 'no-store');
  return ok(c, body);
});

/**
 * Class-scoped learners' counts-only class progress (`POST /api/sync/learners/:id/class-progress`, F-CURR-002
 * section 7.6, row CM-62). That route is not built yet, so nothing is stored and every learner reads null: row CM-62
 * fills this read (one set-based select for the members) and the learning summary below counts its `topDue` ids
 * for the class tablets that keep their memory on the device.
 */
export async function classProgressOf(_db: Db, _spaceId: string, _learnerIds: readonly string[]): Promise<ReadonlyMap<string, ClassProgressCounts>> {
  return new Map();
}

/**
 * GET /api/spaces/:id/learning-summary
 *
 * The teacher read route of F-CURR-002 section 8 (row CM-16): each learner's `memory` block (words known, items
 * ready to refresh, episodes per mastery level, Stage Checks, week points, up to 8 due item ids) and a class
 * aggregate, the items due for the most learners with how many have each one due, for `class-review` (row CM-63).
 * It returns no item state, no answer history and no name.
 *
 * Who: whoever may read the space's progress summaries, the action the roster and the reports read
 * (`summary.read`: a family caregiver or owner, a class teacher or owner, a school admin over the class; read-only,
 * archived spaces included, section 4.9: grown-ups read and never write). Section 8 names `snapshot.read`, but
 * `can.ts` never grants that action to a class role (a teacher never reads the saved progress itself), so it would
 * shut out the teacher this route is for; the block is part of the summary, which `summary.read` covers. Each
 * learner's block is projected for its own reader (`memoryFor`): a family reads every block; a class or school reads
 * a block only where the family acknowledged the class-scope text that lists the `memory` item, and any other
 * learner reads `memory: null` and adds nothing to the aggregate. A school has no learners of its own: 409
 * `wrong_kind` (its admin opens the class's).
 */
spaceReportRoutes.get('/:id/learning-summary', async (c) => {
  const db = dbFor(c);
  const space = await findSpace(c, db, c.req.param('id'), true);
  if (!('id' in space)) return space;
  const account = await requireCan(c, db, space, 'summary.read');
  if (!('id' in account)) return account;
  if (space.kind === 'school') return fail(c, 'wrong_kind', 'A school has no learning summary; open the class', 409);

  const memberIds = (await db.membersOf(space.id)).filter((m) => m.memberKind === 'learner').map((m) => m.memberId);
  const [learnerIds, stored] = await Promise.all([db.learnersOf(memberIds), db.summariesOf(memberIds)]);
  const summaries = new Map(stored.map((row) => [row.learnerId, row.summary]));
  const [scopes, progress] = await Promise.all([learnerReadScopes(db, space.kind, learnerIds, c.env), classProgressOf(db, space.id, learnerIds)]);
  // In id order: the list never follows anyone's activity or figures.
  const learners = [...learnerIds].sort().map((learnerId) => {
    const read = scopes.get(learnerId);
    return { learnerId, memory: memoryFor(summaries.get(learnerId), space.kind, { scope: read?.scope, memory: read?.memory }), classProgress: progress.get(learnerId) ?? null };
  });
  const counted = learners.filter((row) => row.memory !== null || row.classProgress !== null);
  const body: LearningSummaryResponse = {
    space: publicSpace(space),
    learners,
    class: {
      learners: learners.length,
      counted: counted.length,
      topDue: topDueOf(counted.map((row) => [...(row.memory?.topDue ?? []), ...(row.classProgress?.topDue ?? [])])),
    },
    serverTime: new Date().toISOString(),
  };
  // A learner's progress never sits in a shared browser's HTTP cache.
  c.header('Cache-Control', 'no-store');
  return ok(c, body);
});
