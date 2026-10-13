import { PLAN_PRICING, discountedUsd, promoLabel, type Entitlement, type PlanKey, type PlanPricing, type Promo, type PurchasablePlanKey } from '@hangul-route/content-schema';
import { DEFAULT_LOCALE, formatDate, formatUsd, getMessages, type UiLocale } from '@hangul-route/i18n';

/**
 * Billing words shared by the billing home (`billing-summary.ts`, F-BILL-002) and the school page — F-ENT-001 §3.6.
 * Two products (decision #30), both renewing yearly since 2026-10-11 (AMENDMENTS-BILLING-FAMILY-YEARLY): the Family
 * Plan and the Group License; a contract beyond the caps. The F-ENT-001 page's own rows, cards and notes went with
 * it (F-BILL-002 B-8c).
 */
const PAST_DUE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

/** A plan's name ("Family Plan"), in `locale`. */
export function planTitle(planKey: PlanKey | 'free', locale: UiLocale = DEFAULT_LOCALE): string {
  return getMessages(locale).console.billing.planTitle[planKey];
}

/** "$15.30 / year" · "$153 / year" around a formatted amount; `cents` keeps two digits for a computed (discounted) amount. */
function priceText(per: PlanPricing['per'], amountUsd: number, locale: UiLocale, cents = false): string {
  const price = getMessages(locale).console.price;
  const amount = formatUsd(locale, amountUsd, { cents });
  return per === 'year' ? price.year(amount) : price.once(amount);
}

/**
 * A purchasable plan's price in `locale`, from `PLAN_PRICING[…].amountUsd` and `.per`
 * through `formatUsd` — never the English `label` (F-I18N-001 §3.1).
 */
export function planPrice(planKey: PurchasablePlanKey, locale: UiLocale = DEFAULT_LOCALE): string {
  const pricing = PLAN_PRICING[planKey];
  return priceText(pricing.per, pricing.amountUsd, locale);
}

/** Mirror of the server rule so the page can label cards without a round trip. */
export function isActive(e: Entitlement, now: Date): boolean {
  const t = now.getTime();
  const future = e.expiresAt ? Date.parse(e.expiresAt) > t : null;
  if (e.status === 'trial' || e.status === 'active') return future !== false;
  if (e.status === 'cancelled') return future === true;
  if (e.status === 'past_due') return Date.parse(e.updatedAt) + PAST_DUE_GRACE_MS > t;
  return false;
}

/** Entitlement status line, in `locale`; dates are the UTC calendar day of the stored timestamp. */
export function statusLine(e: Entitlement, now: Date, locale: UiLocale = DEFAULT_LOCALE): string {
  const words = getMessages(locale).console.entitlementStatus;
  const when = e.expiresAt ? formatDate(locale, e.expiresAt, 'monthDayYear', { utc: true }) : null;
  switch (e.status) {
    case 'trial':
      return when ? words.trialEnds(when) : words.trial;
    case 'active':
      // A yearly plan says when it renews; a row without a date (a legacy one-time sandbox row) just says active.
      return when ? words.activeRenews(when) : words.active;
    case 'past_due':
      return isActive(e, now) ? words.pastDueKept : words.pastDuePaused;
    case 'cancelled':
      return when && isActive(e, now) ? words.cancelledEnds(when) : words.cancelled;
    default:
      return when ? words.endedOn(when) : words.ended;
  }
}

/**
 * Price line once a code is applied — "$12.24 / year with HOYA20 (20% off, first year), was $15.30 / year" (F-ENT-002 §3.3).
 * A yearly plan on a one-charge coupon says "first year"; null when the plan is not purchasable.
 */
export function promoPriceLine(planKey: PlanKey | 'free', promo: Promo | null, locale: UiLocale = DEFAULT_LOCALE): string | null {
  if (!promo || (planKey !== 'family_lifetime' && planKey !== 'group_license')) return null;
  const pricing = PLAN_PRICING[planKey];
  const after = priceText(pricing.per, discountedUsd(pricing.amountUsd, promo), locale, true);
  const firstYear = pricing.per === 'year' && promo.duration === 'once';
  return getMessages(locale).console.promoPrice(after, promo.code, promoLabel(promo), firstYear, planPrice(planKey, locale));
}

/** The promo form's last result; data, worded at render time. */
export type PromoNote = { kind: 'applied'; code: string; name: string | null } | { kind: 'tooMany' | 'notConfigured' | 'invalid' };

/** The words for a `PromoNote`, in `locale`. */
export function promoNoteText(note: PromoNote, locale: UiLocale = DEFAULT_LOCALE): string {
  const c = getMessages(locale).console;
  if (note.kind === 'applied') return c.billing.promo.applied(note.code, note.name);
  if (note.kind === 'tooMany') return c.promoTooMany;
  if (note.kind === 'notConfigured') return c.promoNotConfigured;
  return c.promoInvalid;
}
