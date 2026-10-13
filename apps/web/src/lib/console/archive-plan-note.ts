import type { BillingSummary } from '@hangul-route/content-schema';
import { DEFAULT_LOCALE, getMessages, type UiLocale } from '@hangul-route/i18n';
import { ownCovers } from './billing-summary';

/**
 * F-BILL-002 B-12 (section 4.6): the line the space settings archive confirm adds
 * about the plan the archive affects. Archiving pauses a space's own plan for its
 * learners (`tierFromSpaces` skips archived spaces) but never stops a Stripe
 * subscription from renewing, so the confirm says both before the grown-up acts.
 *
 * Reads the space's card in the billing summary. "Renews" follows the server's rule
 * for a plan Billing can cancel (`actions.manage`: a Stripe subscription on the
 * payer's card), so the line never points at a cancel the payer cannot find.
 * A plan past due beyond its grace week no longer covers, but Stripe still retries
 * the renewal, so the confirm says it keeps renewing (and not that learners lose it).
 *
 * Null when there is nothing to name: no summary (not loaded, offline, failed), no
 * card for the space, a free space, a class covered by its school (the school's plan
 * is not this space's), a School Contract (it never renews by itself) or a plan that
 * already ended.
 */
export function archivePlanNote(summary: BillingSummary | null, spaceId: string, now: Date, locale: UiLocale = DEFAULT_LOCALE): string | null {
  const card = summary?.cards.find((c) => c.spaceId === spaceId);
  if (!card || card.coverage.state !== 'own') return null;
  const coverage = card.coverage;
  const family = coverage.planKey === 'family_lifetime';
  if (!family && coverage.planKey !== 'group_license') return null;
  const words = getMessages(locale).console.billing.archiveConfirm;
  // A legacy one-time row (no date) never renews, whatever the card says.
  const renews = card.payer && card.actions.manage && coverage.expiresAt !== null && !coverage.endsAtPeriodEnd && (coverage.status === 'active' || coverage.status === 'trial' || coverage.status === 'past_due');
  if (!ownCovers(coverage, now)) {
    if (coverage.status !== 'past_due' || !renews) return null;
    return family ? words.familyRenewsAlone : words.licenseRenews;
  }
  if (family) return renews ? `${words.familyLoses(card.name)} ${words.familyRenews}` : words.familyLoses(card.name);
  return renews ? words.licenseRenews : null;
}

/**
 * The billing read the archive confirm waits for, at most `ms`: a click that lands
 * before the read settles still names the plan, and a slow or failed read falls back
 * to the plain confirm (null) instead of holding the dialog back.
 */
export function settleWithin<T>(read: Promise<T> | null, ms: number): Promise<T | null> {
  if (!read) return Promise.resolve(null);
  return new Promise<T | null>((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    read.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
    );
  });
}

/** The archive confirm dialog's text: the ask, what archiving keeps, then the plan line on its own paragraph. */
export function archiveConfirmText(spaceName: string, planNote: string | null, locale: UiLocale = DEFAULT_LOCALE): string {
  const c = getMessages(locale).console;
  const ask = `${c.settings.danger.archiveAsk(spaceName)} ${c.archiveKeeps}`;
  return planNote ? `${ask}\n\n${planNote}` : ask;
}
