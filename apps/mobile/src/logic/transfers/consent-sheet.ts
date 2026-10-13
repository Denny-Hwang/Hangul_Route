import {
  TEACHER_VISIBLE_ITEM_IDS,
  TRANSFER_CONSENT_LINES,
  TRANSFER_CONSENT_TEXT,
  TRANSFER_CONSENT_TEXT_VERSION,
  isTransferConsentLocale,
  transferConsentLineIds,
  type DeviceAttestKind,
  type DeviceTransferConsent,
  type InboxTransfer,
  type InboxVisibleSpace,
  type SpaceSettings,
  type TransferConsentLineId,
  type TransferConsentLocale,
  type TransferInitiator,
  type TransferPremiumChange,
} from '@hangul-route/content-schema';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import type { DeviceTransferPreview } from '../../platform/sync-api';
import { initiatorOf } from './consent-gate';

/**
 * The app consent sheet's text — F-SPACE-002 section 4.11, T-7c (`design/screens/transfer/app-sheets.md`,
 * `consent-sheet.md`, app column). Pure. The lines are content-schema's keyed catalogue
 * (`TRANSFER_CONSENT_TEXT`) in the canonical order of `transferConsentLineIds`, word for word as on the
 * console; the frame (title, identity block, `visible_today` items) is `console.transfer.consent` in the
 * sheet's own locale. Nothing here types a consent sentence.
 */

export interface DestinationFacts {
  ownerName: string | null;
  schoolName: string | null;
  ageBucket: string | null;
  /** Null from an inbox row of an older Worker: the identity block then shows the age alone. */
  learnerCount: number | null;
}

export interface SheetTerms {
  premiumChange: TransferPremiumChange;
  destinationConsentMode: SpaceSettings['consentMode'];
  relinkAffected: boolean;
  sourcePlansAffected: boolean;
  visibleToday: InboxVisibleSpace[];
}

export interface ConsentSheetData {
  learnerName: string;
  sourceName: string;
  destination: { name: string } & DestinationFacts;
  initiator: TransferInitiator;
  terms: SheetTerms;
  /** The digest of what the server computed for this sheet; sent back with the yes. */
  termsDigest: string | null;
}

export type ConsentLine =
  | { id: TransferConsentLineId; kind: 'statement'; text: string; conditional: boolean }
  | { id: TransferConsentLineId; kind: 'list'; text: string; items: string[]; conditional: boolean }
  | { id: TransferConsentLineId; kind: 'option'; text: string; conditional: boolean };

const WHEN = new Map(TRANSFER_CONSENT_LINES.map((line) => [line.id, line]));

/** Unknown server values read as the quiet defaults (the lenient inbox, an older app). */
const premiumOf = (value: string): TransferPremiumChange => (value === 'may_change' ? 'may_change' : 'none');
const consentModeOf = (value: string): SpaceSettings['consentMode'] => (value === 'school' ? 'school' : 'parent');

function fill(template: string, data: ConsentSheetData): string {
  return template.replace(/\{(learner|source|destination)\}/g, (_, key: string) =>
    key === 'learner' ? data.learnerName : key === 'source' ? data.sourceName : data.destination.name,
  );
}

/**
 * One `visible_today` row. The inbox rows carry no space id, so the device cannot tell which family is
 * its own: every family keeps its owner and none reads "(you)".
 */
function visibleTodayItem(space: InboxVisibleSpace, locale: UiLocale): string {
  const c = getMessages(locale).console.transfer.consent;
  if (!space.ownerName) return space.name;
  return space.kind === 'family' ? c.visibleFamily(space.name, space.ownerName) : c.visibleClass(space.name, space.ownerName);
}

/** The lines of the sheet in canonical order, or null when the locale has no consent text. */
export function consentLines(data: ConsentSheetData, locale: UiLocale): ConsentLine[] | null {
  if (!isTransferConsentLocale(locale)) return null;
  const text = TRANSFER_CONSENT_TEXT[locale];
  const ids = transferConsentLineIds({ initiator: data.initiator, ...data.terms });
  return ids.map((id): ConsentLine => {
    const line = WHEN.get(id);
    const conditional = line?.when !== 'always';
    const sentence = fill(text.lines[id], data);
    if (line?.kind === 'list') {
      const items = id === 'visible_list' ? TEACHER_VISIBLE_ITEM_IDS.map((item) => fill(text.items[item], data)) : data.terms.visibleToday.map((space) => visibleTodayItem(space, locale));
      return { id, kind: 'list', text: sentence, items, conditional };
    }
    if (line?.kind === 'option') return { id, kind: 'option', text: sentence, conditional };
    return { id, kind: 'statement', text: sentence, conditional };
  });
}

/** The identity block under "Who is the new class?": teacher and school, then age and learner count. */
export function identityLines(facts: DestinationFacts, locale: UiLocale): string[] {
  const c = getMessages(locale).console.transfer.consent;
  const who = [facts.ownerName ? c.teacher(facts.ownerName) : null, facts.schoolName].filter((part): part is string => !!part);
  const bucket = facts.ageBucket && facts.ageBucket in c.age ? c.age[facts.ageBucket as keyof typeof c.age] : null;
  const size = [bucket, facts.learnerCount === null ? null : c.learners(facts.learnerCount)].filter((part): part is string => !!part);
  return [who.join(' · '), size.join(' · ')].filter((line) => line.length > 0);
}

/** The sheet MoveClass draws from the device preview (always learner-started). */
export function sheetDataFromPreview(preview: DeviceTransferPreview, names: { learnerName: string; sourceName: string }): ConsentSheetData {
  const { id: _id, name, ...facts } = preview.destination;
  return {
    ...names,
    destination: { name, ...facts },
    initiator: 'learner_side',
    terms: {
      premiumChange: premiumOf(preview.premiumChange),
      destinationConsentMode: consentModeOf(preview.destinationConsentMode),
      relinkAffected: preview.relinkAffected,
      sourcePlansAffected: preview.sourcePlansAffected,
      visibleToday: preview.visibleToday,
    },
    termsDigest: preview.termsDigest,
  };
}

/** The sheet ApproveTransfer draws from the inbox row. */
export function sheetDataFromRequest(t: InboxTransfer, learnerName: string): ConsentSheetData {
  return {
    learnerName,
    sourceName: t.from.name,
    destination: { name: t.to.name, ownerName: t.to.ownerName, schoolName: t.to.schoolName, ageBucket: t.to.ageBucket, learnerCount: t.to.learnerCount },
    initiator: initiatorOf(t.initiator),
    terms: {
      premiumChange: premiumOf(t.premiumChange),
      destinationConsentMode: consentModeOf(t.destinationConsentMode),
      relinkAffected: t.relinkAffected,
      sourcePlansAffected: t.sourcePlansAffected,
      visibleToday: t.visibleToday,
    },
    termsDigest: t.termsDigest,
  };
}

/** The record a device yes carries: the current text version, the locale the sheet was read in, the claim and the digest. */
export function deviceConsentRecord(locale: TransferConsentLocale, attest: DeviceAttestKind, termsDigest: string | null): DeviceTransferConsent {
  return { textVersion: TRANSFER_CONSENT_TEXT_VERSION, locale, attest, ...(termsDigest ? { termsDigest } : {}) };
}

/** The sheet opens in the UI locale when it has a consent text, else in English (the switch offers the rest). */
export const sheetLocaleOf = (locale: UiLocale): TransferConsentLocale => (isTransferConsentLocale(locale) ? locale : 'en');

/**
 * The reading rule (T-0b D2): the primary is `aria-disabled` until the end marker after `cannot_undo`
 * has been in view once. A scroll-position rule only, not evidence of reading. `markerY` is the
 * marker's top inside the scrolled content; a sheet shorter than its window starts open.
 */
export function readToEndOpen(m: { markerY: number | null; scrollY: number; viewportHeight: number }): boolean {
  if (m.markerY === null || m.viewportHeight <= 0) return false;
  return m.markerY <= m.scrollY + m.viewportHeight;
}
