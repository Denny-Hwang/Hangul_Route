/**
 * The price patterns the site must never show (owner decisions 2026-10-10; F-SITE-002 §3.9; F-BILL-002 §4.1, §11).
 * Shared by `landing-claims.test.tsx` (the site's commercial-claims scan) and `site-no-billing.test.ts` (F-BILL-002
 * B-10), so both guards ban the same amounts. Test-only: no page or component imports it.
 */
export const SITE_PRICE_PATTERNS: ReadonlyArray<{ name: string; re: RegExp }> = [
  { name: 'a dollar amount', re: /\$\s?\d/ },
  { name: 'a price per year or month', re: /\bper\s+(year|month)\b|\/\s?(yr|year|mo|month)\b/i },
];
