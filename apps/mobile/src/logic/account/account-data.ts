import {
  ClassReportSchema,
  CoverageSchema,
  JOIN_CODE_RE,
  ProgressSummarySchema,
  ReportPeriodSchema,
  ReportSummarySchema,
  SpaceKindSchema,
  SpaceRoleSchema,
  UsageSchema,
  isDateKey,
  readSpaceAttention,
  type ClassReport,
  type ReportPeriod,
  type ReportSummary,
  type SpaceKind,
  type SpaceRole,
} from '@hangul-route/content-schema';
import type { NativePlanCard } from './plan-lines';

/**
 * F-AUTH-004 sections 8.1 to 8.5 and 8.7 (rows NS-5, NS-6; ND-10, CS-N5): what the native homes read of the Worker's answers
 * (`logic/account/api.ts` hands every `data` back as `unknown`). Pure and tolerant, as the console's readers are
 * (`apps/web/src/lib/console/api.ts`): each item, row and summary key is checked on its own and one this bundle cannot
 * read is dropped, so a Worker deployed first with a wider answer never fails a home. Only the fields a home draws are
 * kept: never a plan's actions, receipts, payer or mode, never an avatar or an age group, never a teacher's name or a
 * school's licence (row NS-6).
 */

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isStringOrNull = (value: unknown): value is string | null => value === null || typeof value === 'string';
const countOf = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0);
/** A join code as the server sends it under `space.manage`; anything else is no code (never drawn). */
const codeOf = (value: unknown): string | null => (typeof value === 'string' && JOIN_CODE_RE.test(value) ? value : null);

/** One `GET /api/spaces` item, as far as a home reads it (`order.ts` sorts it as it is). */
export interface AccountSpaceItem {
  space: { id: string; kind: SpaceKind; name: string; createdAt: string; archivedAt: string | null };
  role: SpaceRole;
  counts: { learners: number };
  /** Sent only to a grown-up with `space.manage`, and only while the code is live. */
  joinCode: string | null;
  /**
   * Row NS-6 (section 8.3, AMENDMENTS-GROWNUP-UX section 12): what waits for this grown-up's OK on the space, as one
   * count (its re-links and its moves; the Worker counts moves only while class moves are on), or null when the Worker
   * sent no readable `attention` (never read as zero). Counts only: never a learner's name.
   */
  attention: number | null;
}

function spaceItemOf(raw: unknown): AccountSpaceItem | null {
  if (!isRecord(raw) || !isRecord(raw.space)) return null;
  const { space } = raw;
  const kind = SpaceKindSchema.safeParse(space.kind);
  const role = SpaceRoleSchema.safeParse(raw.role);
  if (!kind.success || !role.success) return null;
  if (typeof space.id !== 'string' || space.id === '' || typeof space.name !== 'string' || typeof space.createdAt !== 'string' || !isStringOrNull(space.archivedAt)) return null;
  const counts = isRecord(raw.counts) ? raw.counts : {};
  const attention = readSpaceAttention(raw.attention);
  return {
    space: { id: space.id, kind: kind.data, name: space.name, createdAt: space.createdAt, archivedAt: space.archivedAt },
    role: role.data,
    counts: { learners: countOf(counts.learners) },
    joinCode: codeOf(raw.joinCode),
    attention: attention === null ? null : attention.relinks + attention.moves,
  };
}

/** `GET /api/spaces` (`{ spaces: [...] }`): the items a home can read, or null for an answer of another shape. */
export function spaceItemsOf(data: unknown): AccountSpaceItem[] | null {
  if (!isRecord(data) || !Array.isArray(data.spaces)) return null;
  return data.spaces.flatMap((raw) => {
    const item = spaceItemOf(raw);
    return item === null ? [] : [item];
  });
}

const PLAN_ROW = ProgressSummarySchema.shape.planProgress.valueSchema;

/**
 * A learner summary as the report reads it, each key (and each plan of `planProgress`) checked on its own and a key
 * this bundle cannot read dropped; null for a value that is not an object. The console's `reportSummaryOf`, so the
 * native report and card read a summary exactly as the console does.
 */
export function reportSummaryOf(source: unknown): ReportSummary | null {
  if (!isRecord(source)) return null;
  const summary: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(ReportSummarySchema.shape)) {
    const value = source[key];
    if (value === undefined) continue;
    if (key === 'planProgress' && isRecord(value)) {
      summary.planProgress = Object.fromEntries(
        Object.entries(value).flatMap(([planId, row]) => {
          const checked = PLAN_ROW.safeParse(row);
          return checked.success ? [[planId, checked.data]] : [];
        }),
      );
      continue;
    }
    const checked = (field as { safeParse: (v: unknown) => { success: boolean; data?: unknown } }).safeParse(value);
    if (checked.success && checked.data !== undefined) summary[key] = checked.data;
  }
  return summary as ReportSummary;
}

/** One learner of a roster (`GET /api/spaces/:id/roster`), as the Family home's card reads it. */
export interface AccountRosterLearner {
  id: string;
  /** The roster's name (initials when a class anonymizes). */
  displayName: string;
  joinedAt: string;
  lastActiveAt: string;
  summary: ReportSummary | null;
}

/** The space a roster or a report is of, as far as a page reads it (its title, its kind, whether it is archived). */
export interface AccountSpaceRef {
  id: string;
  kind: SpaceKind;
  name: string;
  archivedAt: string | null;
}

function spaceRefOf(raw: unknown): AccountSpaceRef | null {
  if (!isRecord(raw)) return null;
  const kind = SpaceKindSchema.safeParse(raw.kind);
  if (!kind.success || typeof raw.id !== 'string' || raw.id === '' || typeof raw.name !== 'string' || !isStringOrNull(raw.archivedAt ?? null)) return null;
  return { id: raw.id, kind: kind.data, name: raw.name, archivedAt: (raw.archivedAt ?? null) as string | null };
}

export interface AccountRoster {
  /** Row NS-6: the roster's own space (the class page's title and kind); null when the Worker sent none it can read. */
  space: AccountSpaceRef | null;
  learners: AccountRosterLearner[];
  /** Sent only under `space.manage`, while live. */
  joinCode: string | null;
}

function rosterLearnerOf(raw: unknown): AccountRosterLearner | null {
  if (!isRecord(raw)) return null;
  const { id, displayName, joinedAt, lastActiveAt } = raw;
  if (typeof id !== 'string' || id === '' || typeof displayName !== 'string' || typeof joinedAt !== 'string') return null;
  return { id, displayName, joinedAt, lastActiveAt: typeof lastActiveAt === 'string' ? lastActiveAt : '', summary: reportSummaryOf(raw.summary) };
}

/** `GET /api/spaces/:id/roster`: its learners (in the server's order; `order.ts` sorts them) and its code, or null. */
export function rosterOf(data: unknown): AccountRoster | null {
  if (!isRecord(data) || !Array.isArray(data.learners)) return null;
  return {
    space: spaceRefOf(data.space),
    learners: data.learners.flatMap((raw) => {
      const learner = rosterLearnerOf(raw);
      return learner === null ? [] : [learner];
    }),
    joinCode: codeOf(data.joinCode),
  };
}

/**
 * `GET /api/billing/summary?view=status` (section 8.5): each space's status card, reduced to what the plan block may
 * read (`NativePlanCard`: kind, coverage, usage) and keyed by space id. A card that does not parse is dropped (that
 * space shows no block); an answer of another shape is an empty map. Nothing else of the summary is kept.
 */
export function planCardsOf(data: unknown): Map<string, NativePlanCard> {
  const cards = new Map<string, NativePlanCard>();
  if (!isRecord(data) || !Array.isArray(data.cards)) return cards;
  for (const raw of data.cards) {
    if (!isRecord(raw) || typeof raw.spaceId !== 'string') continue;
    const kind = SpaceKindSchema.safeParse(raw.kind);
    const coverage = CoverageSchema.safeParse(raw.coverage);
    const usage = raw.usage === null || raw.usage === undefined ? ({ success: true, data: null } as const) : UsageSchema.safeParse(raw.usage);
    if (!kind.success || !coverage.success || !usage.success) continue;
    cards.set(raw.spaceId, { kind: kind.data, coverage: coverage.data, usage: usage.data });
  }
  return cards;
}

/** The part of a learner report body the account report reads (F-REPORT-001 section 3.8, the console's envelope). */
export interface AccountReportBody {
  space: { id: string; kind: SpaceKind; name: string; archivedAt: string | null };
  learner: { id: string; displayName: string };
  summary: ReportSummary | null;
  lastSyncedAt: string | null;
}

/** `GET /api/spaces/:id/learners/:learnerId/report`, read as the console reads it; null for a body it cannot read. */
export function reportBodyOf(data: unknown): AccountReportBody | null {
  if (!isRecord(data) || !isRecord(data.space) || !isRecord(data.learner)) return null;
  const { space, learner, lastSyncedAt } = data;
  const kind = SpaceKindSchema.safeParse(space.kind);
  if (!kind.success || typeof space.id !== 'string' || typeof space.name !== 'string' || !isStringOrNull(space.archivedAt)) return null;
  if (typeof learner.id !== 'string' || typeof learner.displayName !== 'string' || !isStringOrNull(lastSyncedAt ?? null)) return null;
  const envelope = {
    space: { id: space.id, kind: kind.data, name: space.name, archivedAt: space.archivedAt },
    learner: { id: learner.id, displayName: learner.displayName },
    lastSyncedAt: (lastSyncedAt ?? null) as string | null,
  };
  if (data.summary === null || data.summary === undefined) return { ...envelope, summary: null };
  const summary = reportSummaryOf(data.summary);
  return summary === null ? null : { ...envelope, summary };
}

/** One class of a school page (`GET /api/spaces/:id/school`), as the native school page reads it. */
export interface AccountSchoolClass {
  space: { id: string; name: string; createdAt: string; archivedAt: string | null };
  /** Its learner members (`students`). */
  students: number;
}

/**
 * Row NS-6 (section 8.4): the school page. Only the school's name, its classes (name, learner count) and how many
 * teachers it has; never a teacher's name, the licence, its seats or dates, the invite code or a week's figures, which
 * the Worker's answer also carries for the console.
 */
export interface AccountSchoolPage {
  school: AccountSpaceRef;
  classes: AccountSchoolClass[];
  /** `usage.teachers`; null when the Worker sent none it can read. */
  teachers: number | null;
}

function schoolClassOf(raw: unknown): AccountSchoolClass | null {
  if (!isRecord(raw) || !isRecord(raw.space)) return null;
  const { space } = raw;
  if (typeof space.id !== 'string' || space.id === '' || typeof space.name !== 'string' || typeof space.createdAt !== 'string' || !isStringOrNull(space.archivedAt ?? null)) return null;
  if (space.kind !== undefined && space.kind !== 'class') return null;
  return { space: { id: space.id, name: space.name, createdAt: space.createdAt, archivedAt: (space.archivedAt ?? null) as string | null }, students: countOf(raw.students) };
}

/** `GET /api/spaces/:id/school`: what the school page draws, or null for an answer it cannot read (or not a school's). */
export function schoolPageOf(data: unknown): AccountSchoolPage | null {
  if (!isRecord(data)) return null;
  const school = spaceRefOf(data.school);
  if (school === null || school.kind !== 'school' || !Array.isArray(data.classes)) return null;
  const usage = isRecord(data.usage) ? data.usage : {};
  const teachers = typeof usage.teachers === 'number' && Number.isInteger(usage.teachers) && usage.teachers >= 0 ? usage.teachers : null;
  return {
    school,
    classes: data.classes.flatMap((raw) => {
      const row = schoolClassOf(raw);
      return row === null ? [] : [row];
    }),
    teachers,
  };
}

/** Row NS-6 (section 8.7): a class report's answer (`GET /api/spaces/:id/class-report`), as the console reads it. */
export interface AccountClassReportBody {
  space: AccountSpaceRef;
  period: ReportPeriod;
  /** The window the figures read: a day key, or null for the current one (or a Worker from before the echo). */
  at: string | null;
  report: ClassReport;
}

/**
 * The class report's envelope and figures, checked whole against `ClassReportSchema` (aggregates only: no learner id,
 * name or row can be in it), or null for a body it cannot read. The console's `parseClassReport`.
 */
export function classReportBodyOf(data: unknown): AccountClassReportBody | null {
  if (!isRecord(data)) return null;
  const space = spaceRefOf(data.space);
  const period = ReportPeriodSchema.safeParse(data.period);
  const report = ClassReportSchema.safeParse(data.report);
  if (space === null || !period.success || !report.success) return null;
  const at = typeof data.at === 'string' && isDateKey(data.at) ? data.at : null;
  return { space, period: period.data, at, report: report.data };
}
