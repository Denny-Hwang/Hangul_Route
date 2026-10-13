import type { BillingSummary } from '@hangul-route/content-schema';
import { DEFAULT_LOCALE, getMessages, type UiLocale } from '@hangul-route/i18n';
import { ownCovers } from './billing-summary';

/**
 * F-BILL-002 B-12 (section 4.6): the line the space settings archive confirm adds
 * about the plan the archive affects. Archiving pauses a space's own plan for its
 * learners (`tierFromSpaces` skips archived spaces) but never stops a Stripe
 * subscription from renewing, so the confirm says both before the grown-up acts.
 *
 * Reads the space's card in the billing summary. Null when there is nothing to
 * name: no summary (not loaded, offline, failed), no card for the space, a free
 * space, a class covered by its school (the school's plan is not this space's), a
 * School Contract (it never renews by itself) or a plan that already ended.
 */
export function archivePlanNote(summary: BillingSummary | null, spaceId: string, now: Date, locale: UiLocale = DEFAULT_LOCALE): string | null {
  const card = summary?.cards.find((c) => c.spaceId === spaceId);
  if (!card || card.coverage.state !== 'own') return null;
  const coverage = card.coverage;
  if (!ownCovers(coverage, now)) return null;
  const words = getMessages(locale).console.billing.archiveConfirm;
  // A dated plan not cancelled in the portal renews; a legacy one-time row (no date) never does.
  const renews = coverage.expiresAt !== null && !coverage.endsAtPeriodEnd && coverage.status !== 'cancelled';
  if (coverage.planKey === 'family_lifetime') return renews ? `${words.familyLoses(card.name)} ${words.familyRenews}` : words.familyLoses(card.name);
  if (coverage.planKey === 'group_license') return renews ? words.licenseRenews : null;
  return null;
}

/** The archive confirm dialog's text: the ask, what archiving keeps, then the plan line on its own paragraph. */
export function archiveConfirmText(spaceName: string, planNote: string | null, locale: UiLocale = DEFAULT_LOCALE): string {
  const c = getMessages(locale).console;
  const ask = `${c.settings.danger.archiveAsk(spaceName)} ${c.archiveKeeps}`;
  return planNote ? `${ask}\n\n${planNote}` : ask;
}
