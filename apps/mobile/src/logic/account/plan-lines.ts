import type { Coverage, PlanKey, SpaceKind, Usage } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';

/**
 * F-AUTH-004 section 8.5 (rows NS-2, NS-5; ND-8, D20, CS-N5): the plan block of a native grown-up home, a fact and
 * never an action. Pure: the screen passes one status card of `GET /api/billing/summary?view=status` and its words.
 *
 * The input type holds only `kind`, `coverage` and `usage`: never `actions`, `receipts`, `mode`, `purchasesOpen`,
 * `payer` or `readOnlyReason`, so no buy or manage control, receipt, payer line or "manages this plan" line can reach
 * the block, whatever the Worker sends (a type test pins it).
 *
 * | Coverage                                       | Plan line                                         | Second line    |
 * | `free`                                         | `coverage.free`                                   | none (D20)     |
 * | `own`, `active` `trial` `past_due` `cancelled` | the plan's name (`family`, `license`, `contract`) | the usage line |
 * | `own`, `expired`                               | `coverage.free`                                   | none (D20)     |
 * | `school` on a class or family                  | `coverage.school(name)`, with or without a date   | none           |
 * | `school` on the school itself (an admin)       | the plan's name                                   | the usage line |
 *
 * **Never a date** (D20, row NS-5): not the renewal or end date of the space's own plan, and not the school's end date
 * either (`coverage.schoolUntil` is never used here: for a school's own admin it is the contract's end, a date to act
 * on). **Never a free plan's cap** (D20): "3 of 3 learners" on a build where nothing can be bought reads as a limit to
 * lift elsewhere. Never a payment state. The last row: the Worker gives a school's admin the school's own plan as
 * `school` coverage (AMENDMENTS-SEATS-ADMINS SA-D11), so the plan's name stands alone, as on an `own` card.
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

/** Section 8.5: the block's two lines. Takes no date formatter: no line it draws holds a date (D20). */
export function nativePlanLines(card: NativePlanCard, words: BillingWords): NativePlanLines {
  const { coverage } = card;
  if (coverage.state === 'free' || (coverage.state === 'own' && coverage.status === 'expired')) return { plan: words.coverage.free, usage: null };
  const usage = usageLine(card.kind, card.usage, words);
  if (coverage.state === 'own') return { plan: planName(coverage.planKey, words), usage };
  if (card.kind === 'school') return { plan: planName(coverage.planKey, words), usage };
  return { plan: words.coverage.school(coverage.schoolName), usage: null };
}
