import { z } from 'zod';
import { SpaceKindSchema } from './space';

/** Entitlements — F-ENT-001 §3.1. Who paid for what; learners inherit through memberships. */
export const PlanKeySchema = z.enum(['family_premium', 'teacher_pro', 'school_license', 'school_seat']);
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
});
export type EntitlementApply = z.infer<typeof EntitlementApplySchema>;

export const BillingIntervalSchema = z.enum(['monthly', 'yearly']);
export type BillingInterval = z.infer<typeof BillingIntervalSchema>;

/** POST /api/entitlements/stripe/checkout body. */
export const CheckoutCreateSchema = z.object({
  planKey: z.enum(['family_premium', 'teacher_pro', 'school_license']),
  interval: BillingIntervalSchema.default('monthly'),
  subjectKind: SubjectKindSchema,
  subjectId: z.string().min(1),
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

/** Offline grace for a cached premium tier (roadmap §3.2). */
export const TIER_GRACE_MS = 7 * 24 * 60 * 60 * 1000;
export const PAST_DUE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;
