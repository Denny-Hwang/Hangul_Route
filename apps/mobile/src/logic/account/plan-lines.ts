import type { Coverage, PlanKey, SpaceKind, Usage } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';

/**
 * F-AUTH-004 section 8.5 (row NS-2; ND-8, CS-N5): the plan block of a native grown-up home, a fact and never an action.
 * Pure: the screen passes one status card of `GET /api/billing/summary?view=status`, its words and a day formatter.
 *
 * The input type holds only `kind`, `coverage` and `usage`: never `actions`, `receipts`, `mode`, `purchasesOpen`,
 * `payer` or `readOnlyReason`, so no buy or manage control, receipt, payer line or "manages this plan" line can reach
 * the block, whatever the Worker sends (a type test pins it).
 *
 * | Coverage                                       | Plan line                                    | Second line          |
 * | `free`                                         | `coverage.free`                              | the usage line       |
 * | `own`, `active` `trial` `past_due` `cancelled` | the plan's name (`family`, `license`, `contract`) | the usage line  |
 * | `own`, `expired`                               | `coverage.free`                              | the usage line       |
 * | `school` on a class or family, with a date     | `coverage.schoolUntil(name, date)`           | -                    |
 * | `school` on a class or family, without one     | `coverage.school(name)`                      | -                    |
 * | `school` on the school itself (an admin)       | the plan's name, no date                     | the usage line       |
 *
 * Never a renewal or end date of the space's own plan and never a payment state. The last row: the Worker gives a
 * school's admin the school's own plan as `school` coverage (AMENDMENTS-SEATS-ADMINS SA-D11); its date is the space's
 * own plan date, so it is not shown (ND-8) and the plan's name stands alone, as on an `own` card.
 */

/** Exactly what the block may read of a status card. */
export interface NativePlanCard {
  kind: SpaceKind;
  coverage: Coverage;
  usage: Usage | null;
}

export interface NativePlanLines {
  plan: string;
  usage: string | null;
}

type BillingWords = Messages['console']['billing'];

function planName(planKey: PlanKey, words: BillingWords): string {
  if (planKey === 'family_lifetime') return words.coverage.family;
  if (planKey === 'group_license') return words.coverage.license;
  return words.coverage.contract;
}

/** The usage line (the console's words): learners on a family, students on a class, students and teachers on a school. */
function usageLine(kind: SpaceKind, usage: Usage | null, words: BillingWords): string | null {
  if (usage === null) return null;
  if (kind === 'family') return words.usage.learners(usage.learners, usage.learnerCap);
  const students = words.usage.students(usage.learners, usage.learnerCap);
  if (kind === 'class' || usage.teachers === null) return students;
  return `${students} · ${words.usage.teachers(usage.teachers, usage.teacherCap)}`;
}

/** Section 8.5: the block's two lines. `formatDay` turns an ISO time into the UI locale's day (UTC). */
export function nativePlanLines(card: NativePlanCard, words: BillingWords, formatDay: (iso: string) => string): NativePlanLines {
  const { coverage } = card;
  const usage = usageLine(card.kind, card.usage, words);
  if (coverage.state === 'free') return { plan: words.coverage.free, usage };
  if (coverage.state === 'own') return { plan: coverage.status === 'expired' ? words.coverage.free : planName(coverage.planKey, words), usage };
  if (card.kind === 'school') return { plan: planName(coverage.planKey, words), usage };
  const plan = coverage.expiresAt ? words.coverage.schoolUntil(coverage.schoolName, formatDay(coverage.expiresAt)) : words.coverage.school(coverage.schoolName);
  return { plan, usage: null };
}
