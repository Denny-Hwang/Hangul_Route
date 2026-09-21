import { describe, expect, it } from 'vitest';
import { TELEMETRY_FLUSH_BATCH, TELEMETRY_QUEUE_CAP, enqueue, requeue, takeBatch, type QueuedEvent } from '../queue';

const ev = (n: number): QueuedEvent => ({ name: `e${n}`, at: `2026-09-21T00:00:${String(n).padStart(2, '0')}Z` });

describe('telemetry queue', () => {
  it('appends in order and drops the oldest past the cap', () => {
    let q: QueuedEvent[] = [];
    for (let i = 0; i < TELEMETRY_QUEUE_CAP + 5; i += 1) q = enqueue(q, ev(i));
    expect(q).toHaveLength(TELEMETRY_QUEUE_CAP);
    expect(q[0]?.name).toBe('e5');
    expect(q.at(-1)?.name).toBe(`e${TELEMETRY_QUEUE_CAP + 4}`);
  });
  it('takes a batch oldest-first and leaves the rest', () => {
    const q = Array.from({ length: 25 }, (_, i) => ev(i));
    const { batch, rest } = takeBatch(q);
    expect(batch).toHaveLength(TELEMETRY_FLUSH_BATCH);
    expect(batch[0]?.name).toBe('e0');
    expect(rest[0]?.name).toBe(`e${TELEMETRY_FLUSH_BATCH}`);
  });
  it('requeue keeps a failed batch ahead of newer events', () => {
    const q = requeue([ev(0), ev(1)], [ev(2)]);
    expect(q.map((e) => e.name)).toEqual(['e0', 'e1', 'e2']);
  });
  it('respects a custom cap', () => {
    expect(enqueue([ev(0), ev(1)], ev(2), 2).map((e) => e.name)).toEqual(['e1', 'e2']);
  });
});
