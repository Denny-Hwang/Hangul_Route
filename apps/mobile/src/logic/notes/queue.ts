import type { NoteReactionId, NoteReportReason } from '@hangul-route/content-schema';
import type { NoteAttest, NotesData, PendingWrite } from './types';

/**
 * The queue of pending note writes (F-FEEDBACK-001 section 6.9). Pure. It holds at most one
 * pending state write per note (the newest pick replaces an older one, keeping a pending read)
 * and at most one pending report per note. Hide, block and the notes-mode setting are never
 * queued: they need a connection because they must act on every device.
 */

export function enqueueState(queue: readonly PendingWrite[], noteId: string, change: { read?: true; reaction?: NoteReactionId }, at: string): PendingWrite[] {
  if (change.read === undefined && change.reaction === undefined) return [...queue];
  const old = queue.find((w) => w.kind === 'state' && w.noteId === noteId);
  const read = change.read ?? (old?.kind === 'state' ? old.read : undefined);
  const reaction = change.reaction ?? (old?.kind === 'state' ? old.reaction : undefined);
  return [
    ...queue.filter((w) => w !== old),
    { kind: 'state', noteId, ...(read ? { read } : {}), ...(reaction ? { reaction } : {}), at },
  ];
}

export function enqueueReport(queue: readonly PendingWrite[], noteId: string, reason: NoteReportReason, attest: NoteAttest | undefined, at: string): PendingWrite[] {
  return [
    ...queue.filter((w) => !(w.kind === 'report' && w.noteId === noteId)),
    { kind: 'report', noteId, reason, ...(attest ? { attest } : {}), at },
  ];
}

/** Notes with a report waiting: hidden on this device until the inbox drops them. */
export function pendingReportIds(queue: readonly PendingWrite[]): Set<string> {
  return new Set(queue.filter((w) => w.kind === 'report').map((w) => w.noteId));
}

/** The order of one flush: reports first (they get a note away), then state writes, each oldest first. */
export function flushOrder(queue: readonly PendingWrite[]): PendingWrite[] {
  return [...queue.filter((w) => w.kind === 'report'), ...queue.filter((w) => w.kind === 'state')];
}

/** What a device route's answer means for the write: `-1` is no network. */
export type FlushOutcome = 'done' | 'drop' | 'retry' | 'limited';

export function outcomeOf(httpStatus: number): FlushOutcome {
  if (httpStatus >= 200 && httpStatus < 300) return 'done';
  if (httpStatus === 429) return 'limited';
  // Offline, a server problem, or credentials the next sync refreshes: try again later.
  if (httpStatus === -1 || httpStatus === 401 || httpStatus >= 500) return 'retry';
  // 404: the note is gone. 409 / 422: it changed on the server. Any other refusal will not change by retrying.
  return 'drop';
}

const sameWrite = (a: PendingWrite, b: PendingWrite): boolean => a.kind === b.kind && a.noteId === b.noteId && a.at === b.at;

/**
 * The notes after one write was answered. Only the write that was sent leaves the queue: a newer
 * pick made while it was in flight stays for the next flush. A report the Worker refused for
 * today's limit leaves the queue, and the note stays hidden on this device (put away).
 */
export function settleWrite(data: NotesData, write: PendingWrite, outcome: FlushOutcome): NotesData {
  if (outcome === 'retry' || (outcome === 'limited' && write.kind === 'state')) return data;
  const queue = data.queue.filter((w) => !sameWrite(w, write));
  if (outcome === 'limited' && !data.putAway.includes(write.noteId)) {
    return { ...data, queue, putAway: [...data.putAway, write.noteId] };
  }
  return { ...data, queue };
}
