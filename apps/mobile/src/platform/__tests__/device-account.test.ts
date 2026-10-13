import { describe, expect, it } from 'vitest';
import { dashboardFreeLine, ownedLearnerSpace } from '../../logic/dashboard-free-line';
import { getMessages } from '@hangul-route/i18n';
import { signedInAccount } from '../device-account';

/**
 * F-ENT-003 E3-12b, the row's standing default: the dashboard free-lessons line shows only when the
 * device's signed-in account owns the learner's space, and never without a signed-in account. The
 * learner app holds no grown-up sign-in (F-APP-001 section 3.9 clears the console session on every
 * learner boot; native builds have no grown-up sign-in, OD-6), so no account is signed in here.
 */
describe('signedInAccount (E3-12b)', () => {
  it('is null: the learner app knows no signed-in grown-up account', () => {
    expect(signedInAccount()).toBeNull();
  });

  it('so the dashboard free-lessons line stays hidden, even at free-end with the switch on', () => {
    const space = ownedLearnerSpace(signedInAccount(), [{ spaceId: 'space:fam-1', kind: 'family' }]);
    expect(dashboardFreeLine({ name: 'Mina', gatingActive: true, tier: 'free', space, freeEnd: () => true, platform: 'web' }, getMessages('en'))).toBeNull();
  });
});
