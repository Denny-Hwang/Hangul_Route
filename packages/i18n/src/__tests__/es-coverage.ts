import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { en } from '../messages/en';
import ledger from '../messages/review-ledger.json';
import { LOCALE_STATUS } from '../locales';
import { fallbackPaths } from '../resolve';

/**
 * The Spanish coverage ratchet (F-I18N-001 §3.10 step 4, review of PR 15). A missing key fails only for a
 * `'shipped'` locale; while es is hidden, a new English key may wait for the next R8 Spanish draft, so a PR that
 * adds English never has to write unreviewed Spanish to stay green. What the ratchet still holds: every namespace
 * whose English file is byte-for-byte the text the Spanish review signed (ledger `enSha` current, the same sha256
 * `scripts/i18n-status.mjs` prints) has no English fallback at all. Once that English changes, the namespace is a
 * stale review in `i18n-status` until the next draft and review re-sign it.
 */

type LedgerEntry = { enSha: string; reviewedBy: string; reviewedAt: string };
const esLedger: Readonly<Record<string, LedgerEntry>> =
  (ledger as Readonly<Record<string, Readonly<Record<string, LedgerEntry>>>>).es ?? {};

/** sha256 of `messages/en/<namespace>.ts` with CRLF folded to LF, as `hashEnglishSource` in i18n-status. */
export function englishSha(namespace: string): string {
  const text = readFileSync(new URL(`../messages/en/${namespace}.ts`, import.meta.url), 'utf8');
  return createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex');
}

/** The namespaces whose current English is the text the Spanish review signed. */
export function esReviewedNamespaces(): string[] {
  return Object.keys(en).filter((namespace) => esLedger[namespace]?.enSha === englishSha(namespace));
}

/** Whether es must have no fallback at all: once shipped (the release gate), or always inside a still-reviewed namespace. */
export function esCoverageRequired(path: string, reviewed: readonly string[] = esReviewedNamespaces()): boolean {
  return LOCALE_STATUS.es === 'shipped' || reviewed.includes(path.split('.')[0] ?? '');
}

/** The English fallbacks of es the ratchet does not allow (always `[]` on a green build). */
export function esUnexpectedFallbacks(): string[] {
  const reviewed = esReviewedNamespaces();
  return fallbackPaths('es').filter((path) => esCoverageRequired(path, reviewed));
}
