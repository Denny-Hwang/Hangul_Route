import { LOCALES, getMessages } from '@hangul-route/i18n';
import { describe, expect, it, vi } from 'vitest';
import { dashboardFreeLine, ownedLearnerSpace, type DashboardFreeLineInput, type DeviceAccount, type LearnerSpace } from '../dashboard-free-line';

/**
 * F-ENT-003 section 3.9.2 (row E3-12b; wireframe console/free-lessons-line B): the free-lessons
 * line on the on-device parent dashboard child row. It shows `free-end` when `routeNext` for that
 * learner is `free-end`, the effective switch (`gatingActive`) is on, the learner's access tier is
 * free, and the device's signed-in account owns the learner's space (the row's standing default:
 * never without a signed-in account). Open billing follows on the web build only.
 */

const en = getMessages('en');
const FAMILY: LearnerSpace = { spaceId: 'space:fam-1', kind: 'family' };
const CLASS: LearnerSpace = { spaceId: 'space:class-1', kind: 'class' };
const SCHOOL: LearnerSpace = { spaceId: 'space:school-1', kind: 'school' };

function input(over: Partial<DashboardFreeLineInput> = {}): DashboardFreeLineInput {
  return { name: 'Mina', gatingActive: true, tier: 'free', space: FAMILY, freeEnd: () => true, platform: 'web', ...over };
}

describe('ownedLearnerSpace: who counts as the owner on a device (E3-12b default)', () => {
  const account = (...ids: string[]): DeviceAccount => ({ ownedSpaceIds: ids });

  it('is null without a signed-in account, whatever the memberships', () => {
    expect(ownedLearnerSpace(null, [FAMILY, CLASS])).toBeNull();
  });

  it('is null when the memberships are not read yet or empty', () => {
    expect(ownedLearnerSpace(account(FAMILY.spaceId), undefined)).toBeNull();
    expect(ownedLearnerSpace(account(FAMILY.spaceId), [])).toBeNull();
  });

  it('is null when the account owns none of the learner spaces (a teacher of another class, a co-caregiver)', () => {
    expect(ownedLearnerSpace(account('space:other'), [FAMILY, CLASS])).toBeNull();
    expect(ownedLearnerSpace(account(), [FAMILY])).toBeNull();
  });

  it('returns the owned space; a family space the account owns comes before an owned class or school', () => {
    expect(ownedLearnerSpace(account(CLASS.spaceId), [FAMILY, CLASS])).toEqual(CLASS);
    expect(ownedLearnerSpace(account(CLASS.spaceId, FAMILY.spaceId), [CLASS, FAMILY])).toEqual(FAMILY);
    expect(ownedLearnerSpace(account(SCHOOL.spaceId, CLASS.spaceId), [SCHOOL, CLASS])).toEqual(SCHOOL);
  });
});

describe('dashboardFreeLine: the free-end line on the child row (section 3.9.2)', () => {
  it('words free-end for a family space with the Family Plan, no price', () => {
    expect(dashboardFreeLine(input(), en)).toEqual({
      line: 'Mina finished the free lessons. Stage 2 and later open with the Family Plan.',
      openBilling: 'Open billing',
    });
  });

  it('names a Group License for a class or a school space', () => {
    expect(dashboardFreeLine(input({ space: CLASS }), en)?.line).toBe('Mina finished the free lessons. Stage 2 and later open with a Group License.');
    expect(dashboardFreeLine(input({ space: SCHOOL }), en)?.line).toBe('Mina finished the free lessons. Stage 2 and later open with a Group License.');
  });

  it('offers Open billing on the web build only; nothing on native', () => {
    expect(dashboardFreeLine(input({ platform: 'ios' }), en)).toEqual({
      line: 'Mina finished the free lessons. Stage 2 and later open with the Family Plan.',
      openBilling: null,
    });
    expect(dashboardFreeLine(input({ platform: 'android' }), en)?.openBilling).toBeNull();
  });

  it('shows nothing when the learner has not reached free-end', () => {
    expect(dashboardFreeLine(input({ freeEnd: () => false }), en)).toBeNull();
  });

  it('shows nothing with the switch off, for a premium learner, or for a viewer who does not own the space', () => {
    expect(dashboardFreeLine(input({ gatingActive: false }), en)).toBeNull();
    expect(dashboardFreeLine(input({ tier: 'premium' }), en)).toBeNull();
    expect(dashboardFreeLine(input({ space: null }), en)).toBeNull();
  });

  it('never without a signed-in account, even at free-end with the switch on', () => {
    expect(dashboardFreeLine(input({ space: ownedLearnerSpace(null, [FAMILY]) }), en)).toBeNull();
  });

  it('reads routeNext only when every other condition holds (no work for a row that cannot show)', () => {
    const freeEnd = vi.fn(() => true);
    dashboardFreeLine(input({ gatingActive: false, freeEnd }), en);
    dashboardFreeLine(input({ tier: 'premium', freeEnd }), en);
    dashboardFreeLine(input({ space: null, freeEnd }), en);
    expect(freeEnd).not.toHaveBeenCalled();
    dashboardFreeLine(input({ freeEnd }), en);
    expect(freeEnd).toHaveBeenCalledTimes(1);
  });

  it('words the line in every UI locale without throwing (English until the ko and es overlays are reviewed)', () => {
    for (const locale of LOCALES) {
      const view = dashboardFreeLine(input(), getMessages(locale));
      expect(view?.line).toContain('Mina');
      expect(view?.openBilling).toBeTruthy();
    }
  });
});
