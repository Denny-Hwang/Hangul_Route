/**
 * Sliding-window rate limiter for abuse-prone routes (F-RESTORE-001 §3.2).
 * In-memory per isolate — enough to blunt online guessing; D1/KV-backed
 * counters can replace it without changing callers.
 */
export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function createRateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return {
    check(key: string, now = Date.now()): RateLimitDecision {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      if (recent.length >= limit) {
        const oldest = recent[0] as number;
        hits.set(key, recent);
        return { allowed: false, remaining: 0, retryAfterSeconds: Math.ceil((oldest + windowMs - now) / 1000) };
      }
      recent.push(now);
      hits.set(key, recent);
      return { allowed: true, remaining: limit - recent.length, retryAfterSeconds: 0 };
    },
    reset(): void {
      hits.clear();
    },
  };
}
