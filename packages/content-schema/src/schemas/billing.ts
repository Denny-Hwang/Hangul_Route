import { z } from 'zod';
import { APP_ROUTES } from './app-shell';
import { EntitlementProviderSchema, EntitlementStatusSchema, PlanKeySchema, PurchasablePlanKeySchema, SubjectKindSchema } from './entitlement';
import { SpaceKindSchema, SpaceRoleSchema } from './space';

/**
 * Billing in the app for every persona — F-BILL-002 §5.2. One billing home on
 * the app host (`APP_ROUTES.billing`), plan status per space, receipts recorded
 * from Stripe webhooks. No card data, no person or learner names, no receipt
 * URL: amounts, dates and Stripe ids only, and the ids never leave the Worker
 * (`ReceiptView`). The only names are space and school names, which the viewer
 * already sees in the console.
 */

/** All receipts of one space: `?id=<spaceId>` (static export, so a query, not a segment). */
export const BILLING_RECEIPTS_PATH = `${APP_ROUTES.billing}/receipts` as const;

/** Checkout, portal and receipt links need a second factor verified at most this many minutes ago. */
export const STEP_UP_MAX_AGE_MIN = 10;
/** Newest rows on the receipts page. */
export const RECEIPTS_PAGE_LIMIT = 50;
/** Newest rows inline on a payer card. */
export const RECEIPTS_CARD_LIMIT = 3;
/** Checkout return: poll the summary every 2 s, at most 10 times. */
export const CHECKOUT_POLL_MS = 2000;
export const CHECKOUT_POLL_MAX = 10;

export const BillingEventKindSchema = z.enum(['purchase', 'renewal', 'refund', 'failed']);
export type BillingEventKind = z.infer<typeof BillingEventKindSchema>;

const BillingEventIdSchema = z.string().regex(/^bev:[a-z0-9-]+$/);
/** ISO 4217, lower-case as Stripe sends it. */
const CurrencySchema = z.string().regex(/^[a-z]{3}$/);
/**
 * Stripe minor units, as Stripe sends them: cents for `usd`, but whole units for
 * zero-decimal currencies (`krw`, `jpy`, …). Format with the currency's own
 * fraction digits (`Intl.NumberFormat`), never a fixed `/ 100`.
 */
const AmountCentsSchema = z.number().int().nonnegative();

/** One row of `billing_events` (D1 migration `0007_billing_events.sql`). */
export const BillingEventSchema = z.object({
  id: BillingEventIdSchema,
  subjectKind: SubjectKindSchema,
  subjectId: z.string().min(1),
  planKey: PlanKeySchema,
  kind: BillingEventKindSchema,
  amountCents: AmountCentsSchema,
  currency: CurrencySchema,
  provider: EntitlementProviderSchema,
  /** Payment intent / checkout session / invoice id; refunds: `<charge>:refund:<cumulative cents>`. */
  providerRef: z.string().min(1),
  /** The payment intent behind an invoice (refund matching); null when unknown, never empty. */
  paymentRef: z.string().min(1).nullable(),
  livemode: z.boolean(),
  occurredAt: z.string(),
  createdAt: z.string(),
});
export type BillingEvent = z.infer<typeof BillingEventSchema>;

/** What a payer sees of a row: no Stripe id, no URL. `id` is the opaque `bev:` id the receipt-link call takes. */
export const ReceiptViewSchema = z.object({
  id: BillingEventIdSchema,
  kind: BillingEventKindSchema,
  planKey: PlanKeySchema,
  amountCents: AmountCentsSchema,
  currency: CurrencySchema,
  livemode: z.boolean(),
  occurredAt: z.string(),
  hasReceipt: z.boolean(),
});
export type ReceiptView = z.infer<typeof ReceiptViewSchema>;

/**
 * Billing telemetry (F-BILL-002 §10): the console has no telemetry client, so every `billing.*`
 * event is recorded by the Worker itself (`recordServerEvent`), never sent by an app.
 * `POST /api/telemetry` refuses these names with 422, so no client can forge one.
 */
export const BILLING_TELEMETRY_PREFIX = 'billing.';

/** Whether a telemetry name is one only the Worker records (every `billing.*` name). */
export function isServerOnlyTelemetryName(name: unknown): boolean {
  return typeof name === 'string' && name.startsWith(BILLING_TELEMETRY_PREFIX);
}

/** From the bound Stripe key prefix: `sk_test_` / `rk_test_`, `sk_live_` / `rk_live_`, or no key. */
export const StripeModeSchema = z.enum(['test', 'live', 'none']);
export type StripeMode = z.infer<typeof StripeModeSchema>;

/** How a space is covered, as its card shows it. */
export const CoverageSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('free') }),
  /** The space holds the plan. `endsAtPeriodEnd`: cancelled in the portal, ends on `expiresAt`. */
  z.object({
    state: z.literal('own'),
    planKey: PlanKeySchema,
    status: EntitlementStatusSchema,
    expiresAt: z.string().nullable(),
    statusSince: z.string(),
    endsAtPeriodEnd: z.boolean(),
  }),
  /** A class covered by its school, or a school seen by a teacher member. */
  z.object({
    state: z.literal('school'),
    schoolName: z.string(),
    planKey: z.enum(['group_license', 'school_seat']),
    expiresAt: z.string().nullable(),
  }),
]);
export type Coverage = z.infer<typeof CoverageSchema>;

const CountSchema = z.number().int().nonnegative();
/** `null` cap = unlimited; teachers only for school payers. */
export const UsageSchema = z.object({
  learners: CountSchema,
  learnerCap: CountSchema.nullable(),
  teachers: CountSchema.nullable(),
  teacherCap: CountSchema.nullable(),
});
export type Usage = z.infer<typeof UsageSchema>;

/** Which "manages this plan" line a viewer sees. */
export const ReadOnlyReasonSchema = z.enum(['family', 'class', 'school']);
export type ReadOnlyReason = z.infer<typeof ReadOnlyReasonSchema>;

const InlineReceiptsSchema = z.array(ReceiptViewSchema).max(RECEIPTS_CARD_LIMIT);

/** Cards exist only where the account is `owner`, `caregiver`, `teacher` or `admin` (§5.3); never for a student. */
const BillingCardRoleSchema = SpaceRoleSchema.exclude(['student']);

/** One card per space. Viewer cards: `receipts: []`, `hasReceipts: false`, actions off, a `readOnlyReason`. */
export const BillingSpaceCardSchema = z.object({
  spaceId: z.string().regex(/^space:[a-z0-9-]+$/),
  kind: SpaceKindSchema,
  name: z.string(),
  role: BillingCardRoleSchema,
  archived: z.boolean(),
  payer: z.boolean(),
  readOnlyReason: ReadOnlyReasonSchema.nullable(),
  coverage: CoverageSchema,
  /** `null`: no usage line (a school seen by a teacher member; seat counts are for payers only, §4.2). */
  usage: UsageSchema.nullable(),
  actions: z.object({
    buy: PurchasablePlanKeySchema.nullable(),
    manage: z.boolean(),
    contact: z.boolean(),
  }),
  /** Payer only, newest first; inline rows carry no link (`hasReceipt` is ignored there). */
  receipts: InlineReceiptsSchema,
  hasReceipts: z.boolean(),
  /** An active Stripe plan with no recorded rows (paid before history began). */
  legacyNoHistory: z.boolean(),
});
export type BillingSpaceCard = z.infer<typeof BillingSpaceCardSchema>;

/**
 * A legacy `subjectKind: 'account'` row, shown as one extra card titled "Your
 * account". Always the viewer's own account, so always a payer. `manage`: a
 * renewing Stripe plan the portal can cancel (the portal takes subject
 * `account`). Receipts are inline only: there is no All receipts link, because
 * the receipts page takes a space id.
 */
export const BillingAccountCardSchema = z.object({
  coverage: CoverageSchema,
  actions: z.object({ manage: z.boolean() }),
  receipts: InlineReceiptsSchema,
  legacyNoHistory: z.boolean(),
});
export type BillingAccountCard = z.infer<typeof BillingAccountCardSchema>;

/**
 * `GET /api/billing/summary`, the strict contract the Worker answers with:
 * closed enums, at most `RECEIPTS_CARD_LIMIT` inline rows. Pages read a response
 * with `parseBillingSummary`, not with this schema.
 */
export const BillingSummarySchema = z.object({
  mode: StripeModeSchema,
  purchasesOpen: z.boolean(),
  cards: z.array(BillingSpaceCardSchema),
  account: z.array(BillingAccountCardSchema),
});
export type BillingSummary = z.infer<typeof BillingSummarySchema>;

/** Keeps the rows that parse and drops the rest, so one row an older page cannot read never fails the list. */
function keepValid<O>(row: z.ZodType<O, z.ZodTypeDef, unknown>) {
  return z.array(z.unknown()).transform((rows) =>
    rows.flatMap((raw) => {
      const parsed = row.safeParse(raw);
      return parsed.success ? [parsed.data] : [];
    }),
  );
}

const TolerantReceiptsSchema = keepValid(ReceiptViewSchema).transform((rows) => rows.slice(0, RECEIPTS_CARD_LIMIT));

/** What a page accepts: per-card and per-row tolerant, an unknown mode read as `none` (every buy and manage button off). */
const BillingSummaryPageSchema = z.object({
  mode: StripeModeSchema.catch('none'),
  purchasesOpen: z.boolean(),
  cards: keepValid(BillingSpaceCardSchema.extend({ receipts: TolerantReceiptsSchema })),
  account: keepValid(BillingAccountCardSchema.extend({ receipts: TolerantReceiptsSchema })),
});

/**
 * Reads a summary response on the page, so a newer Worker never blanks an
 * older page (installed PWAs keep an old bundle for days, §4.1): unknown keys
 * are stripped; a card or receipt row carrying a value this build does not
 * know (a new coverage state, receipt kind, role, plan, …) is dropped and its
 * siblings stay; more than `RECEIPTS_CARD_LIMIT` inline rows are cut to the
 * newest ones. `null` only when the summary itself is unreadable.
 */
export function parseBillingSummary(raw: unknown): BillingSummary | null {
  const parsed = BillingSummaryPageSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
