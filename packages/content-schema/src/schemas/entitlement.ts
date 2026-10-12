import { z } from 'zod';
import { SpaceKindSchema } from './space';

/**
 * Entitlements — F-ENT-001 §3.1. Who paid for what; learners inherit through memberships.
 * Two products (owner decision #30, 2026-10-06), both renewing **yearly** since the owner
 * decision of 2026-10-11 (AMENDMENTS-BILLING-FAMILY-YEARLY): the Family Plan for a family,
 * the Group License for a class or school; beyond the group caps it is a contract (`school_seat`).
 *
 * `family_lifetime` is the Family Plan's key. The name is historical: D1's CHECK on
 * `entitlements.plan_key` fixes these three values and cannot change additively (BY-D1),
 * so the key stays and its term comes from Stripe (`expiresAt` = the period end).
 */
export const PlanKeySchema = z.enum(['family_lifetime', 'group_license', 'school_seat']);
export type PlanKey = z.infer<typeof PlanKeySchema>;

export const EntitlementStatusSchema = z.enum(['trial', 'active', 'past_due', 'expired', 'cancelled']);
export type EntitlementStatus = z.infer<typeof EntitlementStatusSchema>;

export const EntitlementProviderSchema = z.enum(['apple', 'google', 'stripe', 'manual']);
export type EntitlementProvider = z.infer<typeof EntitlementProviderSchema>;

export const SubjectKindSchema = z.enum(['account', 'space']);
export type SubjectKind = z.infer<typeof SubjectKindSchema>;

export const EntitlementSchema = z.object({
  id: z.string().regex(/^ent:[a-z0-9-]+$/),
  subjectKind: SubjectKindSchema,
  subjectId: z.string().min(1),
  planKey: PlanKeySchema,
  status: EntitlementStatusSchema,
  provider: EntitlementProviderSchema,
  providerRef: z.string().nullable(),
  customerRef: z.string().nullable(),
  seats: z.number().int().positive().nullable(),
  expiresAt: z.string().nullable(),
  /** Promotion / referral code used at checkout, for attribution (F-ENT-002). */
  promoCode: z.string().nullable().default(null),
  updatedAt: z.string(),
});
export type Entitlement = z.infer<typeof EntitlementSchema>;

/** Input every provider path feeds into `applyEntitlement`. */
export const EntitlementApplySchema = z.object({
  subjectKind: SubjectKindSchema,
  subjectId: z.string().min(1),
  planKey: PlanKeySchema,
  status: EntitlementStatusSchema,
  provider: EntitlementProviderSchema,
  providerRef: z.string().nullable().optional(),
  customerRef: z.string().nullable().optional(),
  seats: z.number().int().positive().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
  promoCode: z.string().nullable().optional(),
});
export type EntitlementApply = z.infer<typeof EntitlementApplySchema>;

/** What each product costs and covers — one source for the paywall, the console and Stripe. */
export const PurchasablePlanKeySchema = z.enum(['family_lifetime', 'group_license']);
export type PurchasablePlanKey = z.infer<typeof PurchasablePlanKeySchema>;

export interface PlanPricing {
  amountUsd: number;
  /** 'year' = renews yearly (every plan sold today); 'once' = one payment, no renewal (none since 2026-10-11). */
  per: 'once' | 'year';
  label: string;
}

export const PLAN_PRICING: Record<PurchasablePlanKey, PlanPricing> = {
  family_lifetime: { amountUsd: 15.3, per: 'year', label: '$15.30 / year' },
  group_license: { amountUsd: 153, per: 'year', label: '$153 / year' },
};

/** A Family Plan (key `family_lifetime`) covers one family space with up to this many learners. */
export const FAMILY_LIFETIME_LEARNERS = 5;

/**
 * Promotion / referral codes — F-ENT-002. The owner creates them in the Stripe
 * dashboard (Coupon + Promotion code); the API only looks them up and applies them.
 */
export const PROMO_CODE_RE = /^[A-Z0-9][A-Z0-9_-]{1,31}$/;

/** Stripe matches codes case-insensitively; we store and show them upper-case. */
export function normalizePromoCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

export const PromoCodeFieldSchema = z.string().transform(normalizePromoCode).pipe(z.string().regex(PROMO_CODE_RE));

export const PromoSchema = z.object({
  /** Stripe promotion code id (promo_…), never shown. */
  id: z.string(),
  code: z.string(),
  name: z.string().nullable(),
  percentOff: z.number().min(0).max(100).nullable(),
  /** In cents, USD only. */
  amountOffCents: z.number().int().nonnegative().nullable(),
  /** 'once' = the first year only; 'forever' = every renewal; 'repeating' = a number of months. */
  duration: z.enum(['once', 'forever', 'repeating']),
});
export type Promo = z.infer<typeof PromoSchema>;

/** POST /api/entitlements/stripe/promo body. */
export const PromoCheckSchema = z.object({
  code: PromoCodeFieldSchema,
  planKey: PurchasablePlanKeySchema,
});
export type PromoCheck = z.infer<typeof PromoCheckSchema>;

/** List price after a promo, rounded to cents and never below zero. */
export function discountedUsd(listUsd: number, promo: Pick<Promo, 'percentOff' | 'amountOffCents'> | null): number {
  if (!promo) return listUsd;
  if (promo.percentOff !== null) return Math.max(0, Math.round(listUsd * (100 - promo.percentOff)) / 100);
  if (promo.amountOffCents !== null) return Math.max(0, Math.round(listUsd * 100 - promo.amountOffCents) / 100);
  return listUsd;
}

/** "20% off" · "$5 off" — what the code is worth, for the row and the paywall. */
export function promoLabel(promo: Pick<Promo, 'percentOff' | 'amountOffCents'>): string {
  if (promo.percentOff !== null) return `${promo.percentOff}% off`;
  if (promo.amountOffCents !== null) return `$${(promo.amountOffCents / 100).toFixed(2)} off`;
  return 'no discount';
}

/** POST /api/entitlements/stripe/checkout body — plans attach to a space (family, class or school). */
export const CheckoutCreateSchema = z.object({
  planKey: PurchasablePlanKeySchema,
  subjectKind: z.literal('space'),
  subjectId: z.string().min(1),
  promoCode: PromoCodeFieldSchema.optional(),
});
export type CheckoutCreate = z.infer<typeof CheckoutCreateSchema>;

/** POST /api/entitlements/verify body (F-IAP-001 receipt, converged). */
export const ReceiptVerifySchema = z.object({
  spaceId: z.string().regex(/^space:[a-z0-9-]+$/),
  store: z.enum(['apple', 'google']),
  receipt: z.string().min(1),
});
export type ReceiptVerify = z.infer<typeof ReceiptVerifySchema>;

/** Where a learner's premium comes from (inbox). */
export const TierSourceSchema = z.object({
  kind: SpaceKindSchema,
  spaceId: z.string(),
  name: z.string(),
});
export type TierSource = z.infer<typeof TierSourceSchema>;

export const TierSchema = z.enum(['free', 'premium']);
export type Tier = z.infer<typeof TierSchema>;

/** Group licence limits (roadmap §7): a school on `group_license` holds this many; beyond it, `school_seat` (contact us). */
export const SCHOOL_LICENSE_STUDENTS = 300;
export const SCHOOL_LICENSE_TEACHERS = 10;

/** POST /api/spaces/:id/members body — F-SCHOOL-001 §3.2. */
export const MemberAddSchema = z.object({
  accountId: z.string().min(1),
  role: z.literal('teacher'),
});
export type MemberAdd = z.infer<typeof MemberAddSchema>;

/** Offline grace for a cached premium tier (roadmap §3.2). */
export const TIER_GRACE_MS = 7 * 24 * 60 * 60 * 1000;
export const PAST_DUE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;
