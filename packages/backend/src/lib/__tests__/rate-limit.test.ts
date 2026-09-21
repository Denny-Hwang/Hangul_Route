import { describe, expect, it } from 'vitest';
import { createRateLimiter } from '../rate-limit';

describe('rate limiter', () => {
  it('allows up to the limit inside the window, then blocks with a retry hint', () => {
    const rl = createRateLimiter(2, 1000);
    expect(rl.check('k', 0)).toMatchObject({ allowed: true, remaining: 1 });
    expect(rl.check('k', 100)).toMatchObject({ allowed: true, remaining: 0 });
    expect(rl.check('k', 200)).toMatchObject({ allowed: false, remaining: 0, retryAfterSeconds: 1 });
    expect(rl.check('other', 200).allowed).toBe(true);
    expect(rl.check('k', 1001).allowed).toBe(true);
    rl.reset();
    expect(rl.check('k', 1002).remaining).toBe(1);
  });
});
