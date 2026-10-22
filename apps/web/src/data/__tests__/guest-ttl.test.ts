import * as schema from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { GUEST_TTL_DAYS, GUEST_TTL_SHARED_DAYS } from '../guest-ttl';

/**
 * [GU] The days the Privacy Policy's first-quest bullet names (AMENDMENTS-GUEST-FIRST-LESSON GU-D13, OQ-G2 default)
 * are the days the learner app's sweep keeps a never-saved first quest.
 */
describe('GUEST_TTL_DAYS and GUEST_TTL_SHARED_DAYS (the site copy of the guest record life)', () => {
  it('are 30 days without play, and 7 on a device that already has learner profiles (OQ-G2 default)', () => {
    expect(GUEST_TTL_DAYS).toBe(30);
    expect(GUEST_TTL_SHARED_DAYS).toBe(7);
    expect(GUEST_TTL_SHARED_DAYS).toBeLessThan(GUEST_TTL_DAYS);
  });

  it('equal the content-schema constants of the guest record wherever they are exported (row GU-1)', () => {
    const shared = schema as unknown as Record<string, unknown>;
    if ('GUEST_TTL_DAYS' in shared) expect(shared.GUEST_TTL_DAYS).toBe(GUEST_TTL_DAYS);
    if ('GUEST_TTL_SHARED_DAYS' in shared) expect(shared.GUEST_TTL_SHARED_DAYS).toBe(GUEST_TTL_SHARED_DAYS);
    if ('GUEST_TTL_MS' in shared) expect(shared.GUEST_TTL_MS).toBe(GUEST_TTL_DAYS * 24 * 60 * 60 * 1000);
    if ('GUEST_TTL_SHARED_MS' in shared) expect(shared.GUEST_TTL_SHARED_MS).toBe(GUEST_TTL_SHARED_DAYS * 24 * 60 * 60 * 1000);
  });
});
