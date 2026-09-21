import type { ProgressSnapshot, ProgressSummary } from '@hangul-route/content-schema';
import { mergeSnapshots } from './merge';

/**
 * One sync round for one learner — F-SYNC-001 §3.5. Transport is injected
 * (`SyncApi`) so the engine is pure and testable; the platform layer wires
 * fetch + device credentials.
 */
export type PutResult =
  | { status: 'ok'; rev: number }
  | { status: 'conflict'; rev: number; snapshot: ProgressSnapshot | null }
  | { status: 'error'; code: string };

export interface SyncApi {
  putSnapshot: (learnerId: string, body: { baseRev: number; snapshot: ProgressSnapshot; summary: ProgressSummary }) => Promise<PutResult>;
}

export interface SyncInput {
  learnerId: string;
  local: ProgressSnapshot;
  localRev: number;
  api: SyncApi;
  now: Date;
  summarize: (snapshot: ProgressSnapshot) => ProgressSummary;
}

export type SyncOutcome =
  | { status: 'synced'; rev: number; snapshot: ProgressSnapshot; merged: boolean }
  | { status: 'retry-later'; rev: number; snapshot: ProgressSnapshot }
  | { status: 'error'; code: string; snapshot: ProgressSnapshot };

export const MAX_CONFLICT_RETRIES = 1;

export async function syncLearner(input: SyncInput): Promise<SyncOutcome> {
  let snapshot = input.local;
  let baseRev = input.localRev;
  let merged = false;

  for (let attempt = 0; attempt <= MAX_CONFLICT_RETRIES; attempt += 1) {
    const result = await input.api.putSnapshot(input.learnerId, {
      baseRev,
      snapshot,
      summary: input.summarize(snapshot),
    });
    if (result.status === 'ok') return { status: 'synced', rev: result.rev, snapshot, merged };
    if (result.status === 'error') return { status: 'error', code: result.code, snapshot };
    // conflict: fold the server copy in and try once more from its rev
    snapshot = result.snapshot ? mergeSnapshots(snapshot, result.snapshot, { now: input.now }) : snapshot;
    baseRev = result.rev;
    merged = merged || !!result.snapshot;
  }
  return { status: 'retry-later', rev: baseRev, snapshot };
}
