import type { BillingSpaceCard, Coverage, Usage } from '@hangul-route/content-schema';
import { LOCALES, getMessages } from '@hangul-route/i18n';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { accountDenyHits } from '../deny-list';
import { nativePlanLines, type NativePlanCard } from '../plan-lines';

/**
 * F-AUTH-004 section 8.5 (row NS-2; ND-8, CS-N5): the plan block, a fact and never an action, over every coverage and
 * status, with an input type that cannot hold an action, a receipt, a payer or a "manages" reason.
 */

const en = getMessages('en').console.billing;
const day = (iso: string): string => `day(${iso})`;
const DATE = '2027-01-31T00:00:00.000Z';

const own = (planKey: 'family_lifetime' | 'group_license' | 'school_seat', status: 'trial' | 'active' | 'past_due' | 'cancelled' | 'expired'): Coverage => ({
  state: 'own',
  planKey,
  status,
  expiresAt: DATE,
  statusSince: '2026-10-01T00:00:00.000Z',
  endsAtPeriodEnd: status === 'cancelled',
});
const school = (expiresAt: string | null, planKey: 'group_license' | 'school_seat' = 'group_license'): Coverage => ({ state: 'school', schoolName: 'Maple School', planKey, expiresAt });
const usage: Usage = { learners: 3, learnerCap: 30, teachers: 2, teacherCap: 5 };

describe('the input type (a type test pins it)', () => {
  it('holds only kind, coverage and usage', () => {
    expectTypeOf<keyof NativePlanCard>().toEqualTypeOf<'kind' | 'coverage' | 'usage'>();
    // A full card has more; none of its money fields can be named on the block's input.
    expectTypeOf<NativePlanCard>().not.toHaveProperty('actions');
    expectTypeOf<NativePlanCard>().not.toHaveProperty('receipts');
    expectTypeOf<NativePlanCard>().not.toHaveProperty('payer');
    expectTypeOf<NativePlanCard>().not.toHaveProperty('readOnlyReason');
    expectTypeOf<NativePlanCard>().not.toHaveProperty('mode');
    expectTypeOf<NativePlanCard>().not.toHaveProperty('purchasesOpen');
    expectTypeOf<BillingSpaceCard>().toHaveProperty('actions');
  });

  it('a whole card passed in reads only those three fields', () => {
    const card = {
      spaceId: 'space:a',
      kind: 'family',
      name: 'Kim family',
      role: 'owner',
      archived: false,
      payer: true,
      readOnlyReason: 'family',
      coverage: own('family_lifetime', 'active'),
      usage: { learners: 2, learnerCap: 6, teachers: null, teacherCap: null },
      actions: { buy: 'family_lifetime', manage: true, contact: true },
      receipts: [],
      hasReceipts: true,
      legacyNoHistory: false,
    } as BillingSpaceCard;
    expect(nativePlanLines(card, en, day)).toEqual({ plan: en.coverage.family, usage: en.usage.learners(2, 6) });
  });
});

describe('section 8.5 rows', () => {
  it('free: the free line and the usage line', () => {
    expect(nativePlanLines({ kind: 'family', coverage: { state: 'free' }, usage }, en, day)).toEqual({ plan: en.coverage.free, usage: en.usage.learners(3, 30) });
    expect(nativePlanLines({ kind: 'class', coverage: { state: 'free' }, usage: null }, en, day)).toEqual({ plan: en.coverage.free, usage: null });
  });

  it('own, any live status: the plan name only, never a date or a payment state', () => {
    for (const status of ['trial', 'active', 'past_due', 'cancelled'] as const) {
      expect(nativePlanLines({ kind: 'family', coverage: own('family_lifetime', status), usage: null }, en, day).plan, status).toBe(en.coverage.family);
      expect(nativePlanLines({ kind: 'class', coverage: own('group_license', status), usage: null }, en, day).plan).toBe(en.coverage.license);
      expect(nativePlanLines({ kind: 'school', coverage: own('school_seat', status), usage: null }, en, day).plan).toBe(en.coverage.contract);
    }
  });

  it('own, expired: the free line', () => {
    expect(nativePlanLines({ kind: 'family', coverage: own('family_lifetime', 'expired'), usage }, en, day)).toEqual({ plan: en.coverage.free, usage: en.usage.learners(3, 30) });
  });

  it('school coverage on a class: the school line, with its date when there is one; no usage line', () => {
    expect(nativePlanLines({ kind: 'class', coverage: school(DATE), usage }, en, day)).toEqual({ plan: en.coverage.schoolUntil('Maple School', day(DATE)), usage: null });
    expect(nativePlanLines({ kind: 'class', coverage: school(null), usage }, en, day)).toEqual({ plan: en.coverage.school('Maple School'), usage: null });
  });

  it('school coverage on the school itself (an admin, SA-D11): the plan name, no own date, the usage line', () => {
    expect(nativePlanLines({ kind: 'school', coverage: school(DATE, 'school_seat'), usage }, en, day)).toEqual({
      plan: en.coverage.contract,
      usage: `${en.usage.students(3, 30)} · ${en.usage.teachers(2, 5)}`,
    });
    expect(nativePlanLines({ kind: 'school', coverage: school(null), usage: null }, en, day)).toEqual({ plan: en.coverage.license, usage: null });
  });

  it('the usage line: learners on a family, students on a class, students and teachers on a school', () => {
    const free = { state: 'free' } as const;
    expect(nativePlanLines({ kind: 'family', coverage: free, usage }, en, day).usage).toBe(en.usage.learners(3, 30));
    expect(nativePlanLines({ kind: 'class', coverage: free, usage }, en, day).usage).toBe(en.usage.students(3, 30));
    expect(nativePlanLines({ kind: 'school', coverage: free, usage }, en, day).usage).toBe(`${en.usage.students(3, 30)} · ${en.usage.teachers(2, 5)}`);
    expect(nativePlanLines({ kind: 'school', coverage: free, usage: { ...usage, teachers: null } }, en, day).usage).toBe(en.usage.students(3, 30));
  });
});

describe('every line passes the section 9.2 deny list in en, es and ko', () => {
  it('over every coverage and status', () => {
    const coverages: Coverage[] = [
      { state: 'free' },
      ...(['trial', 'active', 'past_due', 'cancelled', 'expired'] as const).flatMap((s) => [own('family_lifetime', s), own('group_license', s), own('school_seat', s)]),
      school(DATE),
      school(null, 'school_seat'),
    ];
    for (const locale of LOCALES) {
      const words = getMessages(locale).console.billing;
      for (const coverage of coverages) {
        for (const kind of ['family', 'class', 'school'] as const) {
          const lines = nativePlanLines({ kind, coverage, usage }, words, () => '31/01/2027');
          for (const line of [lines.plan, lines.usage ?? '']) expect(accountDenyHits(line, locale), `${locale} ${kind} ${JSON.stringify(coverage)}: ${line}`).toEqual([]);
        }
      }
    }
  });
});
