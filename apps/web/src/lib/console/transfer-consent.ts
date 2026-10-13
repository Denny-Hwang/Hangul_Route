import {
  TEACHER_VISIBLE_ITEM_IDS,
  TRANSFER_CONSENT_LINES,
  TRANSFER_CONSENT_TEXT,
  TRANSFER_CONSENT_TEXT_VERSION,
  isTransferConsentLocale,
  transferConsentLineIds,
  type TransferConsent,
  type TransferConsentLineId,
  type TransferInitiator,
} from '@hangul-route/content-schema';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import type { TransferDestinationFacts, TransferSheetTerms } from './api';

/**
 * The consent sheet's text (F-SPACE-002 section 4.11, PR T-6d; `design/screens/transfer/consent-sheet.md`), pure.
 * The lines are content-schema's keyed catalogue (`TRANSFER_CONSENT_TEXT`), drawn word for word in the canonical
 * order of `transferConsentLineIds`; nothing here types a consent sentence. The frame around them (title, identity
 * block, `visible_today` items) is `console.transfer.consent` in the sheet's own locale.
 */

/** What one sheet is about: the names it fills in, the destination facts from the preview and the server's terms. */
export interface ConsentSheetData {
  learnerName: string;
  sourceName: string;
  destination: { name: string } & TransferDestinationFacts;
  initiator: TransferInitiator;
  terms: TransferSheetTerms;
  /** The family space the guardian is acting from: its own `visible_today` row reads "(you)". */
  familyName: string;
}

export type ConsentLine =
  | { id: TransferConsentLineId; kind: 'statement'; text: string; conditional: boolean }
  | { id: TransferConsentLineId; kind: 'list'; text: string; items: string[]; conditional: boolean }
  | { id: TransferConsentLineId; kind: 'option'; text: string; conditional: boolean };

const WHEN = new Map(TRANSFER_CONSENT_LINES.map((line) => [line.id, line]));

function fill(template: string, data: ConsentSheetData): string {
  return template.replace(/\{(learner|source|destination)\}/g, (_, key: string) =>
    key === 'learner' ? data.learnerName : key === 'source' ? data.sourceName : data.destination.name,
  );
}

/**
 * One `visible_today` row: a class or school with its teacher, the viewer's own family, another family. `ownFamily`
 * is the acting family's name, or null when it cannot be told apart (the rows carry no space id, so a name shared by
 * two families, such as the default "Our family", marks neither as "(you)" and both keep their owner).
 */
export function visibleTodayItem(space: { kind: string; name: string; ownerName: string | null }, ownFamily: string | null, locale: UiLocale): string {
  const c = getMessages(locale).console.transfer.consent;
  if (space.kind === 'family') {
    if (ownFamily !== null && space.name === ownFamily) return c.visibleYou(space.name);
    return space.ownerName ? c.visibleFamily(space.name, space.ownerName) : space.name;
  }
  return space.ownerName ? c.visibleClass(space.name, space.ownerName) : space.name;
}

/** The lines of the sheet in canonical order, or null when the locale has no consent text ("Not available in your language yet."). */
export function consentLines(data: ConsentSheetData, locale: UiLocale): ConsentLine[] | null {
  if (!isTransferConsentLocale(locale)) return null;
  const text = TRANSFER_CONSENT_TEXT[locale];
  const ids = transferConsentLineIds({ initiator: data.initiator, ...data.terms });
  const sameName = data.terms.visibleToday.filter((space) => space.kind === 'family' && space.name === data.familyName).length;
  const ownFamily = sameName === 1 ? data.familyName : null;
  return ids.map((id): ConsentLine => {
    const line = WHEN.get(id);
    const conditional = line?.when !== 'always';
    const sentence = fill(text.lines[id], data);
    if (line?.kind === 'list') {
      const items =
        id === 'visible_list'
          ? TEACHER_VISIBLE_ITEM_IDS.map((item) => fill(text.items[item], data))
          : data.terms.visibleToday.map((space) => visibleTodayItem(space, ownFamily, locale));
      return { id, kind: 'list', text: sentence, items, conditional };
    }
    if (line?.kind === 'option') return { id, kind: 'option', text: sentence, conditional };
    return { id, kind: 'statement', text: sentence, conditional };
  });
}

/** The identity block's second and third lines ("Teacher: Ms Park · Riverside school", "A few months old · 8 learners"). */
export function identityLines(facts: TransferDestinationFacts, locale: UiLocale): string[] {
  const c = getMessages(locale).console.transfer.consent;
  const who = [facts.ownerName ? c.teacher(facts.ownerName) : null, facts.schoolName].filter((part): part is string => !!part);
  const bucket = facts.ageBucket && facts.ageBucket in c.age ? c.age[facts.ageBucket as keyof typeof c.age] : null;
  const size = [bucket, c.learners(facts.learnerCount)].filter((part): part is string => !!part);
  return [who.join(' · '), size.join(' · ')].filter((line) => line.length > 0);
}

/** The record the create / approve body carries: the current text version, the locale the sheet was read in and its digest. */
export function consentRecord(locale: UiLocale, termsDigest: string | null): TransferConsent {
  return { textVersion: TRANSFER_CONSENT_TEXT_VERSION, locale, ...(termsDigest ? { termsDigest } : {}) };
}
