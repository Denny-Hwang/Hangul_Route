import { describe, expect, it } from 'vitest';
import { en } from '../messages/en';
import ledger from '../messages/review-ledger.json';
import { LOCALE_STATUS, LOCALES } from '../locales';
import { englishSha } from './es-coverage';

/**
 * The review ledger stays current for every shipped locale (F-I18N-001 §3.10 steps 3-4). `i18n-status` only
 * warns on a stale namespace, and a warning is easy to miss: #714 and #722 changed `en/learner.ts` and
 * `en/caregiver.ts` after the es / ko sign-off and nothing went red. This test is the CI guard: once a locale is
 * `'shipped'`, every namespace's ledger `enSha` must be the sha256 of today's English file, so a PR that changes
 * shipped English also runs the two-lens MAR of the changed keys and re-signs the namespace in the same PR.
 *
 * Scope: this guard detects English drift only. An es / ko value edited after its sign-off while the English file
 * stays the same is not detected here (the ledger holds no overlay hash); a PR that changes a shipped es / ko value
 * runs the MAR of that key in the same PR, and that is a reviewer check. The exact es / ko values the #714 / #722
 * MAR kept or changed are pinned once, in `learner-messages.test.ts`.
 *
 * To fix a failure: run `node scripts/i18n-status.mjs`, review the changed keys (es and ko), and copy the printed
 * `enSha` into `messages/review-ledger.json` with `reviewedBy: "MAR"` and today's `reviewedAt`.
 */

type LedgerEntry = { enSha: string; reviewedBy: string; reviewedAt: string };
const LEDGER = ledger as Readonly<Record<string, Readonly<Record<string, LedgerEntry>>>>;
const SHIPPED_OVERLAYS = LOCALES.filter((locale) => locale !== 'en' && LOCALE_STATUS[locale] === 'shipped');

describe('review ledger: no stale sign-off in a shipped locale (§3.10)', () => {
  it('es and ko are shipped, so the guard below checks them', () => {
    expect(SHIPPED_OVERLAYS).toEqual(expect.arrayContaining(['es', 'ko']));
  });

  it.each(SHIPPED_OVERLAYS)('%s: every namespace is signed against the current English', (locale) => {
    const entries = LEDGER[locale] ?? {};
    const stale = Object.keys(en)
      .filter((namespace) => entries[namespace]?.enSha !== englishSha(namespace))
      .map((namespace) => `${locale}.${namespace}: ledger ${entries[namespace]?.enSha ?? '(none)'} vs English ${englishSha(namespace)}`);
    expect(stale, 'English changed since the MAR sign-off; review the changed keys and re-sign (see this file).').toEqual([]);
  });

  it('englishSha is the 64-hex sha256 that i18n-status prints for every namespace', () => {
    for (const namespace of Object.keys(en)) expect(englishSha(namespace), namespace).toMatch(/^[0-9a-f]{64}$/);
  });
});
