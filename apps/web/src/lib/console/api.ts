import type { PlanItem, ProgressSummary, SpaceKind, SpaceRole } from '@hangul-route/content-schema';

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

export interface RosterLearner {
  id: string;
  displayName: string;
  ageGroup: '5-7' | '8-9' | '10-11';
  avatar: string;
  joinedAt: string;
  lastActiveAt: string;
  summary: ProgressSummary | null;
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
}

export interface PlanSave {
  id?: string;
  title: string;
  items: PlanItem[];
  targetLearnerIds?: string[] | null;
  publish: boolean;
}

export type ApiError = 'unauthorized' | 'forbidden' | 'not_found' | 'invalid' | 'network' | 'unknown';
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError; status: number };

export interface ConsoleApiOptions {
  endpoint: string;
  token: string;
  fetchImpl?: typeof fetch;
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
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${opts.token}` };

  async function call<T>(url: string, init: RequestInit, okStatus: number[]): Promise<ApiResult<T>> {
    try {
      const res = await fetchImpl(url, { ...init, headers });
      const body = (await res.json().catch(() => ({}))) as { data?: T };
      if (!okStatus.includes(res.status) || body.data === undefined) return { ok: false, error: mapError(res.status), status: res.status };
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
  };
}

export type ConsoleApi = ReturnType<typeof createConsoleApi>;
