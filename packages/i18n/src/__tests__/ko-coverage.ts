import { en } from '../messages/en';
import ledger from '../messages/review-ledger.json';
import { LOCALE_STATUS } from '../locales';
import { fallbackPaths } from '../resolve';
import { englishSha } from './es-coverage';

/**
 * The Korean coverage ratchet (F-I18N-001 §3.10 step 4, PR 16), the twin of `./es-coverage`. A missing key fails only
 * for a `'shipped'` locale; while ko is hidden, a new English key may wait for the next R8 Korean draft, so a PR that
 * adds English never has to write unreviewed Korean to stay green. What the ratchet still holds: every namespace
 * whose English file is byte-for-byte the text the Korean review signed (ledger `enSha` current, the same sha256
 * `scripts/i18n-status.mjs` prints) has no English fallback at all. Once that English changes, the namespace is a
 * stale review in `i18n-status` until the next draft and review re-sign it.
 */

type LedgerEntry = { enSha: string; reviewedBy: string; reviewedAt: string };
const koLedger: Readonly<Record<string, LedgerEntry>> =
  (ledger as Readonly<Record<string, Readonly<Record<string, LedgerEntry>>>>).ko ?? {};

/** The namespaces whose current English is the text the Korean review signed. */
export function koReviewedNamespaces(): string[] {
  return Object.keys(en).filter((namespace) => koLedger[namespace]?.enSha === englishSha(namespace));
}

/** Whether ko must have no fallback at all: once shipped (the release gate), or always inside a still-reviewed namespace. */
export function koCoverageRequired(path: string, reviewed: readonly string[] = koReviewedNamespaces()): boolean {
  return LOCALE_STATUS.ko === 'shipped' || reviewed.includes(path.split('.')[0] ?? '');
}

/** The English fallbacks of ko the ratchet does not allow (always `[]` on a green build). */
export function koUnexpectedFallbacks(): string[] {
  const reviewed = koReviewedNamespaces();
  return fallbackPaths('ko').filter((path) => koCoverageRequired(path, reviewed));
}
