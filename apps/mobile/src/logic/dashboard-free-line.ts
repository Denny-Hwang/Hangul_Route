import { freeLessonsLine, type LearnerMembership } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import type { Tier } from './entitlement';
import { billingHandOffStep, type BillingOpenResult } from './paywall';
import { planOpenBlocked } from './shell/entry-points';

/**
 * The free-lessons line on the on-device parent dashboard child row (F-ENT-003 section 3.9.2,
 * row E3-12b; wireframe console/free-lessons-line B). Behind the grown-up gate, written about the
 * learner. It shows `free-end` (exact: the snapshot is on the device) when all of these hold:
 *
 * - the effective free-plan switch is on (`gatingActive`; native store builds stay ungated, OD-13);
 * - the learner's access tier is free (the space is not covered, judged per learner, LR section 6.1);
 * - the viewer owns the learner's space: on a device that is the row's standing default for its
 *   open question, "the device's signed-in account owns the learner's space, and never without a
 *   signed-in account" (`ownedLearnerSpace`);
 * - `routeNext` for that learner is `free-end`, the same reading as Home and the Plan screen.
 *
 * **Open billing** follows on the web build only (F-BILL-002 billing hand-off); a native build
 * shows the line with no link. The words are F-ENT-003's glossary (`caregiver.access`): no price,
 * no "Premium", the product named by the owned space's kind.
 */

/** The grown-up account signed in on this device, as far as the learner app knows it: the spaces it owns. */
export interface DeviceAccount {
  ownedSpaceIds: readonly string[];
}

/** A learner's space as the device knows it (an inbox membership row). */
export type LearnerSpace = Pick<LearnerMembership, 'spaceId' | 'kind'>;

/**
 * The learner's space the signed-in account owns, or null: no signed-in account, memberships not
 * read yet, or none of the learner's spaces owned by the account (a teacher of another class, a
 * co-caregiver). A family space comes first, since it names the Family Plan the family buys; then
 * the memberships' own order.
 */
export function ownedLearnerSpace(account: DeviceAccount | null, memberships: readonly LearnerSpace[] | undefined): LearnerSpace | null {
  if (account === null || memberships === undefined) return null;
  const owned = memberships.filter((ms) => account.ownedSpaceIds.includes(ms.spaceId));
  return owned.find((ms) => ms.kind === 'family') ?? owned[0] ?? null;
}

export interface DashboardFreeLineInput {
  /** The learner's name as the card shows it. */
  name: string;
  /** `gatingActive(flags, bundleOs())`. */
  gatingActive: boolean;
  /** The learner's access tier (`accessTier`). */
  tier: Tier;
  /** `ownedLearnerSpace(...)`: null hides the row. */
  space: LearnerSpace | null;
  /** `routeNext(...).kind === 'free-end'` for this learner; read only when everything else holds. */
  freeEnd: () => boolean;
  /** `Platform.OS`: only `web` gets Open billing. */
  platform: string;
}

export interface DashboardFreeLineView {
  line: string;
  /** The Open billing label on the web build; null on native (no link). */
  openBilling: string | null;
}

export function dashboardFreeLine(input: DashboardFreeLineInput, messages: Pick<Messages, 'caregiver'>): DashboardFreeLineView | null {
  const { space } = input;
  // The cheap checks first, so a row that cannot show never walks the plans and the curriculum.
  if (!input.gatingActive || space === null || input.tier !== 'free') return null;
  const code = freeLessonsLine({ gating: true, owner: true, covered: false, spaceKind: space.kind, freeEnd: input.freeEnd() });
  // No plans and no neutral ask: `free-end` is the only line the device row can draw.
  if (code?.code !== 'free-end') return null;
  const m = messages.caregiver;
  return {
    line: m.access.freeEnd(input.name, m.access.product[code.product]),
    openBilling: input.platform === 'web' ? m.plan.openBilling.cta : null,
  };
}

/** What one tap of the row's **Open billing** needs (the screen passes the live parts). */
export interface DashboardBillingDeps {
  /** `billingOpensSameTab()`: the grown-up area in this tab (flag on, web), else a new tab. */
  sameTab: boolean;
  /** The live network state at the tap, not the last render's (as the Plan screen). */
  isOnline: () => boolean;
  /** A ref, checked and set before the first await, so two taps in one render run it once. */
  busy: { current: boolean };
  /** `openBilling(sameTab, DASHBOARD_BILLING_HANDOFF)`; it opens the tab before it awaits anything. */
  open: (sameTab: boolean) => Promise<BillingOpenResult>;
  /** Opens the PIN screen for the grown-up area with the dashboard's billing request. */
  askPin: () => void;
  /** The line under the link: the address to type when the browser blocked the new tab, else null. */
  setNote: (note: string | null) => void;
  messages: Pick<Messages, 'caregiver'>;
}

/**
 * One tap of **Open billing** on the dashboard row, the Plan screen's flow (F-BILL-002 section 4.7)
 * without its `paywall.console_opened` (the dashboard is not the Plan screen): blocked in the
 * same-tab mode while offline; a blocked new tab shows the address to type; a same-tab hand-off that
 * needs a fresh PIN opens the PIN screen, which hands off itself; a hand-off that throws settles
 * quietly and frees the link for another tap.
 */
export async function runDashboardBilling(d: DashboardBillingDeps): Promise<void> {
  if (planOpenBlocked(d.sameTab, d.isOnline()) || d.busy.current) return;
  d.busy.current = true;
  d.setNote(null);
  try {
    // Called before the first await, so the tap's activation reaches `window.open`.
    const step = billingHandOffStep(await d.open(d.sameTab), 'free', d.messages);
    d.setNote(step.note);
    if (step.askPin) d.askPin();
  } catch {
    // Nothing opened; the link stays usable.
  } finally {
    d.busy.current = false;
  }
}

export interface FreeLessonsRowA11y {
  /** The line's id: the link's description on the web. */
  lineId: string;
  /** The id of "Needs the internet" under the link while offline. */
  offlineId: string;
  /** `aria-describedby` on the web (the line, plus "Needs the internet" while offline); null on native. */
  describedBy: string | null;
  /** `accessibilityHint`: "Needs the internet" while offline, as the Plan screen's Open billing. */
  hint: string | undefined;
}

/**
 * How the row's link is described (section 3.14): by its own line, since several cards can each
 * carry Open billing, and while offline by "Needs the internet" too (F-APP-001 section 3.12: the
 * offline text is the button's description).
 */
export function freeLessonsRowA11y(testID: string, offline: boolean, needsInternet: string, platform: string): FreeLessonsRowA11y {
  const lineId = `${testID}-line`;
  const offlineId = `${testID}-offline`;
  return {
    lineId,
    offlineId,
    describedBy: platform === 'web' ? (offline ? `${lineId} ${offlineId}` : lineId) : null,
    hint: offline ? needsInternet : undefined,
  };
}
