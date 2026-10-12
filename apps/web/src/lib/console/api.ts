import { ReceiptViewSchema, parseBillingSummary, type BillingSummary, type ReceiptView } from '@hangul-route/content-schema';
import type {
  CurriculumMeta,
  Entitlement,
  LearnerLevelId,
  PlanItem,
  ProgressSummary,
  Promo,
  PurchasablePlanKey,
  SpaceKind,
  SpaceRole,
  TeacherVisibleSummaryKey,
  VocabSummary,
} from '@hangul-route/content-schema';

/**
 * Console transport for /api/spaces — F-CONSOLE-001. Bearer = the console
 * session token; typed results, never throws.
 */
export interface SpaceView {
  id: string;
  kind: SpaceKind;
  name: string;
  parentSpaceId: string | null;
  settings: { consentMode: 'parent' | 'school'; anonymizeRoster: boolean };
  archivedAt: string | null;
  createdAt: string;
}

export interface SpaceListItem {
  space: SpaceView;
  role: SpaceRole;
  counts: { learners: number; accounts: number; classes: number };
  joinCode: string | null;
  joinCodeExpiresAt: string | null;
}

/**
 * A roster summary as the Worker sends it: projected to the teacher allow-list,
 * `planProgress` holding this space's plans only (F-SPACE-002 T-1a, section 4.11).
 */
export type RosterSummary = Pick<ProgressSummary, TeacherVisibleSummaryKey> &
  /**
   * A family space also reads the learner's own-route counts (F-PLAN-002 section 3.10) and the goal the
   * learner's Learning Route shows (Learning Route LR-W1, LR-OD-12); a class never receives them.
   */
  Partial<Pick<ProgressSummary, 'selfRoute' | 'routeGoal'>> &
  /**
   * Word counts (F-VOC-005 section 3.8). `vocab` is on `TEACHER_HIDDEN_SUMMARY_KEYS`, so no roster
   * carries it until a consent item covers it (P-4b); the console shows its word lines only when it
   * is here. Never the first-try rate: P-4b's projection drops it for every roster viewer.
   */
  { vocab?: RosterVocab };

/** A roster's `summary.vocab`: the learner's word counts and words to revisit, without the first-try rate. */
export type RosterVocab = Omit<VocabSummary, 'firstTryRate'>;

export interface RosterLearner {
  /** Opaque learner id: keys the row, targets plans, issues Rescue Codes. Never shown. */
  id: string;
  displayName: string;
  ageGroup: LearnerLevelId;
  avatar: string;
  joinedAt: string;
  lastActiveAt: string;
  summary: RosterSummary | null;
  lastSyncedAt: string | null;
}

export interface Roster {
  space: SpaceView;
  learners: RosterLearner[];
  joinCode: string | null;
  joinCodeExpiresAt: string | null;
}

export interface CreatedSpace {
  space: SpaceView;
  membership: { role: SpaceRole };
  joinCode: string | null;
  joinCodeExpiresAt: string | null;
}

export interface PlanView {
  id: string;
  spaceId: string;
  authorAccountId: string;
  title: string;
  items: PlanItem[];
  targetLearnerIds: string[] | null;
  publishedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** A route plan's curriculum (F-PLAN-002 section 3.5); null or absent = a classic plan. */
  meta?: CurriculumMeta | null;
}

export interface PlanSave {
  id?: string;
  title: string;
  items: PlanItem[];
  targetLearnerIds?: string[] | null;
  publish: boolean;
  /** Absent keeps the stored meta; the wizard sends a route's meta, a re-pace its new one. */
  meta?: CurriculumMeta | null;
}

export interface MemberView {
  memberKind: 'account' | 'learner';
  memberId: string;
  role: SpaceRole;
  joinedAt: string;
  name: string;
  isOwner: boolean;
}

export interface RelinkView {
  id: string;
  learnerId: string;
  learnerName: string;
  deviceId: string;
  platform: string | null;
  requestedAt: string;
  expiresAt: string;
  status: 'pending' | 'approved' | 'denied' | 'expired';
}

export type EntitlementView = Entitlement & { subjectName: string | null };

/** What a promotion / referral code is worth on a plan — F-ENT-002. */
export interface PromoCheckView {
  promo: Promo;
  price: { planKey: PurchasablePlanKey; listUsd: number; discountedUsd: number };
}

export interface SchoolClassRow {
  space: SpaceView;
  teacher: { accountId: string; name: string } | null;
  students: number;
  practiced: number;
  lastActiveAt: string | null;
  hasPublishedPlan: boolean;
}

export interface SchoolView {
  school: SpaceView;
  invite: { joinCode: string | null; joinCodeExpiresAt: string | null };
  license: (EntitlementView & { active: boolean }) | null;
  limits: { licensed: boolean; students: number | null; teachers: number | null };
  usage: { students: number; teachers: number };
  thisWeek: { students: number; practiced: number; classes: number; classesWithPlan: number };
  classes: SchoolClassRow[];
}

/** One space's receipts for its payer — F-BILL-002 section 5.3 (`GET /api/billing/receipts`). */
export interface ReceiptsView {
  spaceName: string;
  receipts: ReceiptView[];
}

/**
 * Clerk's reverification hint (`clerk_error`), which the Worker sends with a
 * 403 `reverify_required` when money moves on a stale sign-in (F-BILL-002 B-5).
 * A failed result carries it as is, so the result itself is what
 * `useReverification` in @clerk/clerk-react recognises.
 */
export interface ClerkErrorHint {
  type?: unknown;
  reason?: unknown;
  metadata?: unknown;
}

export type ApiError = 'unauthorized' | 'forbidden' | 'not_found' | 'invalid' | 'network' | 'unknown';
/** `code` is the server envelope's error code when it sent one (e.g. stripe_not_configured). */
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError; status: number; code?: string; clerk_error?: ClerkErrorHint };

export interface ConsoleApiOptions {
  endpoint: string;
  /** A fixed bearer (dev sign-in) or a provider that fetches a fresh Clerk session token per request (F-AUTH-002). */
  token: string | (() => Promise<string | null>);
  fetchImpl?: typeof fetch;
}

/** The receipt rows this build can read; unknown keys (never a URL or a Stripe id) are stripped. */
function readableReceipts(rows: readonly unknown[]): ReceiptView[] {
  return rows.flatMap((row) => {
    const parsed = ReceiptViewSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

/** How many rows a raw summary sent, before the lenient read dropped any (an array or nothing). */
function rawRows(raw: unknown, key: 'cards' | 'account'): number {
  const rows = raw && typeof raw === 'object' ? (raw as Record<string, unknown>)[key] : undefined;
  return Array.isArray(rows) ? rows.length : 0;
}

/** Only an https link is ever navigated to: the page opens it in a tab that shares the app origin (section 4.10). */
function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function mapError(status: number): ApiError {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 422) return 'invalid';
  return 'unknown';
}

export function createConsoleApi(opts: ConsoleApiOptions) {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  const base = `${opts.endpoint}/api/spaces`;
  const recovery = `${opts.endpoint}/api/recovery`;
  const entitlements = `${opts.endpoint}/api/entitlements`;
  const billing = `${opts.endpoint}/api/billing`;
  const resolveToken = async (): Promise<string | null> => (typeof opts.token === 'string' ? opts.token : opts.token().catch(() => null));

  async function call<T>(url: string, init: RequestInit, okStatus: number[]): Promise<ApiResult<T>> {
    try {
      const token = await resolveToken();
      if (!token) return { ok: false, error: 'unauthorized', status: 401 }; // signed out mid-flight: no request leaves
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
      const res = await fetchImpl(url, { ...init, headers });
      const body = (await res.json().catch(() => ({}))) as { data?: T; error?: { code?: unknown }; clerk_error?: unknown };
      if (!okStatus.includes(res.status) || body.data === undefined) {
        const code = typeof body.error?.code === 'string' ? body.error.code : undefined;
        const hint = body.clerk_error && typeof body.clerk_error === 'object' ? { clerk_error: body.clerk_error as ClerkErrorHint } : {};
        return { ok: false, error: mapError(res.status), status: res.status, ...(code ? { code } : {}), ...hint };
      }
      return { ok: true, data: body.data };
    } catch {
      return { ok: false, error: 'network', status: -1 };
    }
  }

  return {
    listSpaces: () => call<{ spaces: SpaceListItem[] }>(base, { method: 'GET' }, [200]).then((r) => (r.ok ? { ok: true as const, data: r.data.spaces } : r)),
    createSpace: (input: { kind: SpaceKind; name: string; email?: string; displayName?: string; parentSpaceId?: string }) =>
      call<CreatedSpace>(base, { method: 'POST', body: JSON.stringify(input) }, [201]),
    regenerateCode: (spaceId: string) =>
      call<{ joinCode: string; expiresAt: string }>(`${base}/${encodeURIComponent(spaceId)}/code`, { method: 'POST' }, [200]),
    roster: (spaceId: string) => call<Roster>(`${base}/${encodeURIComponent(spaceId)}/roster`, { method: 'GET' }, [200]),
    listPlans: (spaceId: string) =>
      call<{ plans: PlanView[] }>(`${base}/${encodeURIComponent(spaceId)}/plans`, { method: 'GET' }, [200]).then((r) => (r.ok ? { ok: true as const, data: r.data.plans } : r)),
    savePlan: (spaceId: string, body: PlanSave) =>
      call<{ plan: PlanView }>(`${base}/${encodeURIComponent(spaceId)}/plans`, { method: 'PUT', body: JSON.stringify(body) }, [200, 201]).then((r) => (r.ok ? { ok: true as const, data: r.data.plan } : r)),
    archivePlan: (spaceId: string, planId: string) =>
      call<{ plan: PlanView }>(`${base}/${encodeURIComponent(spaceId)}/plans/${encodeURIComponent(planId)}/archive`, { method: 'POST' }, [200]).then((r) => (r.ok ? { ok: true as const, data: r.data.plan } : r)),
    members: (spaceId: string) =>
      call<{ members: MemberView[] }>(`${base}/${encodeURIComponent(spaceId)}/members`, { method: 'GET' }, [200]).then((r) => (r.ok ? { ok: true as const, data: r.data.members } : r)),
    removeMember: (spaceId: string, kind: 'account' | 'learner', memberId: string) =>
      call<{ removed: boolean }>(`${base}/${encodeURIComponent(spaceId)}/members/${kind}/${encodeURIComponent(memberId)}`, { method: 'DELETE' }, [200]),
    patchSettings: (spaceId: string, patch: { anonymizeRoster?: boolean; consentMode?: 'parent' | 'school' }) =>
      call<{ space: SpaceView }>(`${base}/${encodeURIComponent(spaceId)}/settings`, { method: 'PATCH', body: JSON.stringify(patch) }, [200]).then((r) => (r.ok ? { ok: true as const, data: r.data.space } : r)),
    archiveSpace: (spaceId: string, archive: boolean) =>
      call<{ space: SpaceView }>(`${base}/${encodeURIComponent(spaceId)}/${archive ? 'archive' : 'unarchive'}`, { method: 'POST' }, [200]).then((r) => (r.ok ? { ok: true as const, data: r.data.space } : r)),
    deleteLearnerData: (spaceId: string, learnerId: string) =>
      call<{ deleted: boolean }>(`${base}/${encodeURIComponent(spaceId)}/learners/${encodeURIComponent(learnerId)}/data`, { method: 'DELETE' }, [200]),
    relinkRequests: (spaceId: string) =>
      call<{ requests: RelinkView[] }>(`${base}/${encodeURIComponent(spaceId)}/relink-requests`, { method: 'GET' }, [200]).then((r) => (r.ok ? { ok: true as const, data: r.data.requests } : r)),
    decideRelink: (spaceId: string, requestId: string, approve: boolean) =>
      call<{ request: RelinkView }>(`${base}/${encodeURIComponent(spaceId)}/relink-requests/${encodeURIComponent(requestId)}/${approve ? 'approve' : 'deny'}`, { method: 'POST' }, [200]).then((r) => (r.ok ? { ok: true as const, data: r.data.request } : r)),
    issueRescueCode: (learnerId: string) =>
      call<{ code: string; issuedAt: string }>(`${recovery}/issue`, { method: 'POST', body: JSON.stringify({ learnerId }) }, [201]),
    school: (spaceId: string) => call<SchoolView>(`${base}/${encodeURIComponent(spaceId)}/school`, { method: 'GET' }, [200]),
    addMember: (spaceId: string, accountId: string) =>
      call<{ alreadyMember: boolean }>(`${base}/${encodeURIComponent(spaceId)}/members`, { method: 'POST', body: JSON.stringify({ accountId, role: 'teacher' }) }, [200, 201]),
    entitlements: () =>
      call<{ entitlements: EntitlementView[] }>(entitlements, { method: 'GET' }, [200]).then((r) => (r.ok ? { ok: true as const, data: r.data.entitlements } : r)),
    checkout: (body: { planKey: PurchasablePlanKey; subjectKind: 'space'; subjectId: string; promoCode?: string }) =>
      call<{ url: string }>(`${entitlements}/stripe/checkout`, { method: 'POST', body: JSON.stringify(body) }, [200]),
    checkPromo: (body: { code: string; planKey: PurchasablePlanKey }) => call<PromoCheckView>(`${entitlements}/stripe/promo`, { method: 'POST', body: JSON.stringify(body) }, [200]),
    portal: (body: { subjectKind: 'account' | 'space'; subjectId: string }) =>
      call<{ url: string }>(`${entitlements}/stripe/portal`, { method: 'POST', body: JSON.stringify(body) }, [200]),
    /**
     * F-BILL-002 B-7: the billing home's summary, read leniently (`parseBillingSummary`), so a
     * newer Worker never blanks an older page. `poll` marks a checkout-return poll (no view event).
     */
    billingSummary: (options: { poll?: boolean } = {}): Promise<ApiResult<BillingSummary>> =>
      call<unknown>(`${billing}/summary${options.poll ? '?poll=1' : ''}`, { method: 'GET' }, [200]).then((r) => {
        if (!r.ok) return r;
        const summary = parseBillingSummary(r.data);
        // Every row dropped (a newer Worker): not the "no spaces yet" empty state, which would
        // send an owner who already pays to set up a second family or class.
        const sent = rawRows(r.data, 'cards') + rawRows(r.data, 'account');
        const allDropped = summary !== null && sent > 0 && summary.cards.length + summary.account.length === 0;
        return summary && !allDropped ? { ok: true as const, data: summary } : { ok: false as const, error: 'unknown' as const, status: 200, code: 'unreadable_summary' };
      }),
    /** One space's receipts (payers only); a row this build cannot read is dropped, its siblings stay. */
    receipts: (spaceId: string): Promise<ApiResult<ReceiptsView>> =>
      call<{ spaceName?: unknown; receipts?: unknown }>(`${billing}/receipts?id=${encodeURIComponent(spaceId)}`, { method: 'GET' }, [200]).then((r) => {
        if (!r.ok) return r;
        const { spaceName, receipts } = r.data;
        if (typeof spaceName !== 'string' || !Array.isArray(receipts)) return { ok: false as const, error: 'unknown' as const, status: 200, code: 'unreadable_receipts' };
        return { ok: true as const, data: { spaceName, receipts: readableReceipts(receipts) } };
      }),
    /** A fresh Stripe receipt or invoice link for one row; step-up and the live guard apply (B-4, B-5). */
    receiptLink: (id: string): Promise<ApiResult<{ url: string }>> =>
      call<{ url?: unknown }>(`${billing}/receipt-link`, { method: 'POST', body: JSON.stringify({ id }) }, [200]).then((r) => {
        if (!r.ok) return r;
        const { url } = r.data;
        return isHttpsUrl(url) ? { ok: true as const, data: { url } } : { ok: false as const, error: 'unknown' as const, status: 200, code: 'unreadable_link' };
      }),
  };
}

export type ConsoleApi = ReturnType<typeof createConsoleApi>;
