import {
  APP_ROUTES,
  BILLING_RECEIPTS_PATH,
  FAMILY_LIFETIME_LEARNERS,
  FREE_CLASS_STUDENT_CAP,
  PAST_DUE_GRACE_MS,
  RECEIPTS_CARD_LIMIT,
  SCHOOL_LICENSE_STUDENTS,
  SCHOOL_LICENSE_TEACHERS,
  type BillingAccountCard,
  type BillingSpaceCard,
  type BillingSummary,
  type Coverage,
  type PlanKey,
  type Promo,
  type PurchasablePlanKey,
  type ReceiptView,
  type SpaceKind,
  type Usage,
} from '@hangul-route/content-schema';
import { DEFAULT_LOCALE, formatDate, formatMinorAmount, formatUsd, getMessages, type UiLocale } from '@hangul-route/i18n';
import { CONTACT_EMAIL } from '../../data/contact';
import { SITE_CLAIMS, type SiteClaims } from '../../data/site-claims';
import { planPrice, planTitle, promoPriceLine } from './billing';

/**
 * The billing home's view model — F-BILL-002 B-7 (sections 4.2, 4.3, 4.6, 4.9,
 * 4.10; wireframe billing/billing-home). Pure: the page passes the summary it
 * read with `parseBillingSummary`, the clock, the locale and, for the includes
 * lines, `SITE_CLAIMS` (a parameter so tests pin every state). Every word comes
 * from the dictionary; prices only from `PLAN_PRICING` through `planPrice`.
 *
 * The server already decides who is a payer and what a viewer may see
 * (section 5.3); this model still never renders an offer, a manage button or
 * a receipt on a viewer card, whatever a summary says.
 */

/** A buy offer: inside the one buyable card, or a row of Add a plan. */
export interface BillingOfferView {
  planKey: PurchasablePlanKey;
  spaceId: string;
  /** "Family Plan" inside the card; "Group License for Room 4" in Add a plan. */
  title: string;
  includes: string[];
  /** The plan price, or the promo line once a code is applied (F-ENT-002 section 3.3). */
  price: string;
  /** "Renews yearly. Cancel from Manage subscription any time." */
  renew: string;
  cta: string;
  /** Exactly one primary button on the page: the first offer. */
  primary: boolean;
}

/** One receipt row: date, kind, plan, amount; a "test" pill for sandbox rows. Inline rows carry no link. */
export interface ReceiptRowView {
  id: string;
  date: string;
  kind: string;
  plan: string;
  amount: string;
  testPill: string | null;
  hasReceipt: boolean;
  viewLabel: string;
  /** The accessible name of View receipt: it says it opens Stripe in a new tab. */
  viewA11y: string;
}

export interface ConnectLearnerView {
  line: string;
  cta: string;
  /** F-APP-001's family page with the join code panel; the code itself is never in the summary. */
  href: string;
}

export interface BillingCardView {
  spaceId: string;
  kind: SpaceKind;
  /** The h3: "Family · Kim family", with "(archived)" when archived. */
  heading: string;
  payer: boolean;
  archived: boolean;
  /** The plan line: "Free plan", "Family Plan", "Covered by Maple School's license until …". */
  plan: string;
  /** "Renews on …", "Ends on …", a past-due line, or null (free, covered by a school, no date). */
  status: string | null;
  usage: string | null;
  /** Who manages the plan, on a viewer card. */
  readOnly: string | null;
  pastDue: boolean;
  manage: boolean;
  contact: boolean;
  connectLearner: ConnectLearnerView | null;
  /** The offer inside this card when it is the only space that can buy. */
  offer: BillingOfferView | null;
  receipts: ReceiptRowView[];
  /** The receipts page of this space, when it has any row (payers only). */
  allReceiptsHref: string | null;
  legacyNoHistory: boolean;
}

/** A legacy account-subject row: always the viewer's own, so always a payer card; inline receipts only. */
export interface BillingAccountCardView {
  heading: string;
  plan: string;
  status: string | null;
  pastDue: boolean;
  manage: boolean;
  receipts: ReceiptRowView[];
  legacyNoHistory: boolean;
}

export interface ContactRowView {
  spaceId: string;
  title: string;
  cta: string;
  href: string;
}

export interface BillingHomeView {
  /** The one-line mode banner, or null when payments are live and open. */
  banner: string | null;
  /** Buy and manage buttons work (test mode, or live and opened by the owner). */
  actionsEnabled: boolean;
  /** One neutral note above the cards while a payer card is past due and still inside its grace week. */
  pastDueNote: string | null;
  cards: BillingCardView[];
  accountCards: BillingAccountCardView[];
  /** Only when two or more payer cards can buy. */
  addPlan: { offers: BillingOfferView[]; contact: ContactRowView[] } | null;
  empty: { title: string; family: { cta: string; href: string }; class: { cta: string; href: string } } | null;
  help: { refund: string; learners: string; sharedDevice: string };
}

export interface BillingHomeOptions {
  now: Date;
  locale?: UiLocale;
  /** F-SITE-002's feature claims; defaults to what is live today. */
  claims?: Readonly<SiteClaims>;
  /** A code checked with `POST /stripe/promo`; rewrites every offer's price line. */
  promo?: Promo | null;
}

const KIND_ORDER: Readonly<Record<SpaceKind, number>> = { family: 0, class: 1, school: 2 };

/** The receipts page of one space (query, not a path segment: the web build is a static export). */
export function receiptsHref(spaceId: string): string {
  return `${BILLING_RECEIPTS_PATH}?id=${encodeURIComponent(spaceId)}`;
}

/** F-APP-001's family page, which shows the join code panel. */
export function connectLearnerHref(spaceId: string): string {
  return `${APP_ROUTES.parentHome}/space?id=${encodeURIComponent(spaceId)}`;
}

/** Contact us for a school contract: a mail link with a fixed subject, never a space name or id. */
export function contactHref(locale: UiLocale = DEFAULT_LOCALE): string {
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(getMessages(locale).console.billing.contact.mailSubject)}`;
}

/** What a plan includes. Feature lines appear only while `claims` says the feature is live (section 4.3). */
export function includesLines(planKey: PurchasablePlanKey, kind: SpaceKind, locale: UiLocale = DEFAULT_LOCALE, claims: Readonly<SiteClaims> = SITE_CLAIMS): string[] {
  const lines = getMessages(locale).console.billing.includesLines;
  if (planKey === 'family_lifetime') {
    const family = lines.family;
    return [
      family.everyLesson,
      family.learners(FAMILY_LIFETIME_LEARNERS),
      family.cloudSave,
      ...(claims.browseAsLearner ? [family.browse] : []),
      ...(claims.parentReports ? [family.reports] : []),
      ...(claims.feedbackNotes ? [family.notes] : []),
    ];
  }
  const license = lines.license;
  return [
    license.everyStudent,
    license.noCap(FREE_CLASS_STUDENT_CAP),
    ...(kind === 'school' ? [license.school(SCHOOL_LICENSE_TEACHERS, SCHOOL_LICENSE_STUDENTS)] : []),
    ...(claims.browseAsLearner ? [license.browse] : []),
    ...(claims.teacherReports ? [license.reports] : []),
    ...(claims.feedbackNotes ? [license.notes] : []),
  ];
}

const day = (locale: UiLocale, iso: string): string => formatDate(locale, iso, 'monthDayYear', { utc: true });

export function receiptRow(r: ReceiptView, locale: UiLocale = DEFAULT_LOCALE): ReceiptRowView {
  const receipts = getMessages(locale).console.billing.receipts;
  const date = day(locale, r.occurredAt);
  return {
    id: r.id,
    date,
    kind: receipts.kind[r.kind],
    // A legacy one-time sandbox row shows the plan name only (BY-D9).
    plan: planTitle(r.planKey, locale),
    // usd like every other price on the page (formatUsd); any other currency in Stripe's own minor unit (section 4.10).
    amount: r.currency.toLowerCase() === 'usd' ? formatUsd(locale, r.amountCents / 100) : formatMinorAmount(locale, r.amountCents, r.currency),
    testPill: r.livemode ? null : receipts.test.pill,
    hasReceipt: r.hasReceipt,
    viewLabel: receipts.view.cta,
    viewA11y: receipts.viewA11y(date),
  };
}

type OwnCoverage = Extract<Coverage, { state: 'own' }>;

/** The server's activity rule for a plan the space holds (F-ENT-001 section 3.2). */
function ownCovers(c: OwnCoverage, now: Date): boolean {
  const t = now.getTime();
  const future = c.expiresAt ? Date.parse(c.expiresAt) > t : null;
  if (c.status === 'trial' || c.status === 'active') return future !== false;
  if (c.status === 'cancelled') return future === true;
  if (c.status === 'past_due') return Date.parse(c.statusSince) + PAST_DUE_GRACE_MS > t;
  return false;
}

/** A past-due plan still inside its grace week: the only time the note's "keep the full route for a week" holds (section 4.6). */
function pastDueInGrace(c: Coverage, now: Date): boolean {
  return c.state === 'own' && c.status === 'past_due' && ownCovers(c, now);
}

function ownPlanLine(planKey: PlanKey, locale: UiLocale): string {
  const coverage = getMessages(locale).console.billing.coverage;
  if (planKey === 'family_lifetime') return coverage.family;
  if (planKey === 'group_license') return coverage.license;
  return coverage.contract;
}

/** The status line of a plan the space holds (section 4.6); null when there is nothing to say. */
function ownStatusLine(c: OwnCoverage, now: Date, locale: UiLocale): string | null {
  const messages = getMessages(locale).console;
  const words = messages.entitlementStatus;
  const status = messages.billing.status;
  const when = c.expiresAt ? day(locale, c.expiresAt) : null;
  if (c.status === 'past_due') return ownCovers(c, now) ? words.pastDueKept : words.pastDuePaused;
  if (!ownCovers(c, now)) return when ? words.endedOn(when) : words.ended;
  // A legacy one-time sandbox row (BY-D2) has no date: the plan name alone.
  if (!when) return null;
  // A cancel in the portal, or a contract (it never renews by itself), ends on the date.
  if (c.endsAtPeriodEnd || c.status === 'cancelled' || c.planKey === 'school_seat') return status.endsOn(when);
  return status.renewsOn(when);
}

function coverageLines(coverage: Coverage, now: Date, locale: UiLocale): { plan: string; status: string | null; pastDue: boolean; covers: boolean } {
  const billing = getMessages(locale).console.billing;
  if (coverage.state === 'free') return { plan: billing.coverage.free, status: null, pastDue: false, covers: false };
  if (coverage.state === 'school') {
    const plan = coverage.expiresAt ? billing.coverage.schoolUntil(coverage.schoolName, day(locale, coverage.expiresAt)) : billing.coverage.school(coverage.schoolName);
    return { plan, status: null, pastDue: false, covers: true };
  }
  return { plan: ownPlanLine(coverage.planKey, locale), status: ownStatusLine(coverage, now, locale), pastDue: coverage.status === 'past_due', covers: ownCovers(coverage, now) };
}

function usageLine(kind: SpaceKind, usage: Usage | null, locale: UiLocale): string | null {
  if (!usage) return null;
  const words = getMessages(locale).console.billing.usage;
  if (kind === 'family') return words.learners(usage.learners, usage.learnerCap);
  const students = words.students(usage.learners, usage.learnerCap);
  if (kind === 'class' || usage.teachers === null) return students;
  return `${students} · ${words.teachers(usage.teachers, usage.teacherCap)}`;
}

function offerFor(card: BillingSpaceCard, planKey: PurchasablePlanKey, inCard: boolean, locale: UiLocale, claims: Readonly<SiteClaims>, promo: Promo | null): BillingOfferView {
  const messages = getMessages(locale).console;
  const title = planTitle(planKey, locale);
  return {
    planKey,
    spaceId: card.spaceId,
    title: inCard ? title : messages.billing.buy.forSpace(title, card.name),
    includes: includesLines(planKey, card.kind, locale, claims),
    price: promoPriceLine(planKey, promo, locale) ?? planPrice(planKey, locale),
    renew: planKey === 'family_lifetime' ? messages.familyLine : messages.groupLine,
    cta: messages.billing.buy[planKey].cta,
    primary: false,
  };
}

/** The plan a payer card can buy now: never on a viewer or an archived card. */
function buyable(card: BillingSpaceCard): PurchasablePlanKey | null {
  return card.payer && !card.archived ? card.actions.buy : null;
}

function orderCards(cards: readonly BillingSpaceCard[]): BillingSpaceCard[] {
  // Array.prototype.sort is stable: the server's newest-first order holds within each group.
  return [...cards].sort((a, b) => Number(b.payer) - Number(a.payer) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
}

function cardView(card: BillingSpaceCard, offer: BillingOfferView | null, now: Date, locale: UiLocale): BillingCardView {
  const billing = getMessages(locale).console.billing;
  const lines = coverageLines(card.coverage, now, locale);
  const payer = card.payer;
  const name = card.archived ? `${card.name} ${billing.archived}` : card.name;
  const noLearnerYet = card.kind === 'family' && card.usage?.learners === 0;
  return {
    spaceId: card.spaceId,
    kind: card.kind,
    heading: `${billing.kind[card.kind]} · ${name}`,
    payer,
    archived: card.archived,
    plan: lines.plan,
    status: lines.status,
    usage: usageLine(card.kind, card.usage, locale),
    readOnly: card.readOnlyReason ? billing.readOnly[card.readOnlyReason] : null,
    pastDue: lines.pastDue,
    manage: payer && card.actions.manage,
    contact: payer && card.actions.contact,
    connectLearner: payer && noLearnerYet && card.coverage.state === 'own' && lines.covers ? { line: billing.connectLearner.line, cta: billing.connectLearner.cta, href: connectLearnerHref(card.spaceId) } : null,
    offer,
    receipts: payer ? card.receipts.slice(0, RECEIPTS_CARD_LIMIT).map((r) => receiptRow(r, locale)) : [],
    allReceiptsHref: payer && card.hasReceipts ? receiptsHref(card.spaceId) : null,
    legacyNoHistory: payer && card.legacyNoHistory,
  };
}

function accountCardView(card: BillingAccountCard, now: Date, locale: UiLocale): BillingAccountCardView {
  const lines = coverageLines(card.coverage, now, locale);
  return {
    heading: getMessages(locale).console.billing.accountCard.title,
    plan: lines.plan,
    status: lines.status,
    pastDue: lines.pastDue,
    manage: card.actions.manage,
    receipts: card.receipts.slice(0, RECEIPTS_CARD_LIMIT).map((r) => receiptRow(r, locale)),
    legacyNoHistory: card.legacyNoHistory,
  };
}

function bannerFor(summary: BillingSummary, locale: UiLocale): string | null {
  const billing = getMessages(locale).console.billing;
  if (summary.mode === 'test') return billing.testMode;
  if (summary.mode === 'none') return billing.notConfigured;
  return summary.purchasesOpen ? null : billing.liveOff;
}

export function billingHomeView(summary: BillingSummary, options: BillingHomeOptions): BillingHomeView {
  const { now } = options;
  const locale = options.locale ?? DEFAULT_LOCALE;
  const claims = options.claims ?? SITE_CLAIMS;
  const promo = options.promo ?? null;
  const billing = getMessages(locale).console.billing;

  const ordered = orderCards(summary.cards);
  const buyers = ordered.filter((c) => buyable(c) !== null);
  const single = buyers.length === 1 ? buyers[0] : undefined;
  const cards = ordered.map((card) => {
    const plan = card === single ? buyable(card) : null;
    const offer = plan ? { ...offerFor(card, plan, true, locale, claims, promo), primary: true } : null;
    return cardView(card, offer, now, locale);
  });
  const accountCards = summary.account.map((card) => accountCardView(card, now, locale));

  const addPlan =
    buyers.length > 1
      ? {
          offers: buyers.map((card, i) => ({ ...offerFor(card, buyable(card) as PurchasablePlanKey, false, locale, claims, promo), primary: i === 0 })),
          contact: buyers
            // The server's contact action, the same flag the card's own Contact us button reads.
            .filter((card) => card.actions.contact)
            .map((card) => ({ spaceId: card.spaceId, title: billing.buy.forSpace(planTitle('school_seat', locale), card.name), cta: billing.contact.cta, href: contactHref(locale) })),
        }
      : null;

  const pastDue = summary.cards.some((c) => c.payer && pastDueInGrace(c.coverage, now)) || summary.account.some((c) => pastDueInGrace(c.coverage, now));
  const empty =
    summary.cards.length === 0 && summary.account.length === 0
      ? {
          title: billing.noSpaces.title,
          family: { cta: billing.noSpaces.family.cta, href: `${APP_ROUTES.start}?persona=parent` },
          class: { cta: billing.noSpaces.class.cta, href: `${APP_ROUTES.start}?persona=teacher` },
        }
      : null;

  return {
    banner: bannerFor(summary, locale),
    // Section 4.3 item 2: off with no key, and in live mode until the owner opens purchases; test mode always works.
    actionsEnabled: summary.mode === 'test' || (summary.mode === 'live' && summary.purchasesOpen),
    pastDueNote: pastDue ? billing.pastDue : null,
    cards,
    accountCards,
    addPlan,
    empty,
    help: { refund: billing.help.refund(CONTACT_EMAIL), learners: billing.help.learners, sharedDevice: billing.help.sharedDevice },
  };
}

/** The panel when the summary could not be read: offline, or an error while online (section 4.12). */
export function summaryFailureNotice(offline: boolean, locale: UiLocale = DEFAULT_LOCALE): { text: string; retry: string } {
  const billing = getMessages(locale).console.billing;
  return { text: offline ? billing.offline : billing.cantCheck, retry: billing.retry.cta };
}

/** A note above the cards after Get … or Manage subscription did not reach Stripe (section 4.4; neutral tone). */
export type BillingActionNote = 'alreadyActive' | 'notConfigured' | 'liveOff' | 'checkoutFailed' | 'portalFailed';

/** The note for a refused checkout or portal call, from the server's error code. */
export function actionNoteFor(action: 'checkout' | 'portal', code: string | undefined): BillingActionNote {
  if (action === 'checkout' && code === 'already_active') return 'alreadyActive';
  if (code === 'stripe_not_configured' || code === 'not_configured') return 'notConfigured';
  if (code === 'live_not_enabled') return 'liveOff';
  return action === 'checkout' ? 'checkoutFailed' : 'portalFailed';
}

export function actionNoteText(note: BillingActionNote, locale: UiLocale = DEFAULT_LOCALE): string {
  return getMessages(locale).console.billing[note];
}
