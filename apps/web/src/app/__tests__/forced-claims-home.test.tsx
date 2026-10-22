import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { LOCALE_META, getMessages } from '@hangul-route/i18n';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SiteDocument } from '../../components/SiteDocument';
import { HomePage } from '../../components/landing/HomePage';
import { SITE_CLAIMS, type SiteClaims } from '../../data/site-claims';

/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON section 13.2 (row GU-6): the home with the `guestLesson` claim forced on through
 * the page's `claims` prop (test-only; `SITE_CLAIMS` stays off until GU-7), rendered as its route renders it (the
 * locale's `SiteDocument`, then `HomePage`), in en, es and ko, beside the same render with today's claims.
 *
 * The browser checks of `e2e/site-budgets.spec.ts` and `e2e/landing-layout.spec.ts` measure these documents: with
 * `HR_FORCED_CLAIMS_OUT` set, this file also writes each one as `<dir>/<state>-<locale>.html` (`e2e/forced-claims.ts`
 * runs it once per worker and serves the result in place of the export's body, under the export's own `<head>`).
 * Without the variable it only checks the renders, so the documents the browser measures are tested here too.
 */
const FORCED_STATES = {
  on: { ...SITE_CLAIMS, guestLesson: true },
  off: SITE_CLAIMS,
} as const satisfies Record<string, Readonly<SiteClaims>>;
const LOCALES = ['en', 'es', 'ko'] as const;

function documentOf(locale: (typeof LOCALES)[number], claims: Readonly<SiteClaims>): string {
  return renderToStaticMarkup(
    <SiteDocument lang={LOCALE_META[locale].htmlLang}>
      <HomePage locale={locale} claims={claims} />
    </SiteDocument>,
  );
}

describe('[GU] the home documents the forced-claims browser checks measure', () => {
  for (const locale of LOCALES) {
    const H = getMessages(locale).landing.home;
    for (const [state, claims] of Object.entries(FORCED_STATES)) {
      it(`${state}, ${locale}: the route's document, the hero line ${state === 'on' ? 'in' : 'out'}`, () => {
        const html = documentOf(locale, claims);
        expect(html.startsWith(`<html lang="${LOCALE_META[locale].htmlLang}">`)).toBe(true);
        expect(html).not.toMatch(/<script\b/);
        expect(html.includes(H.hero.guest)).toBe(state === 'on');
        expect(html.includes('try=1')).toBe(state === 'on');
        const out = process.env.HR_FORCED_CLAIMS_OUT;
        if (out) {
          mkdirSync(out, { recursive: true });
          // Written whole, then renamed, so a reader never sees half a file.
          const file = join(out, `${state}-${locale}.html`);
          writeFileSync(`${file}.${process.pid}.tmp`, html);
          renameSync(`${file}.${process.pid}.tmp`, file);
        }
      });
    }
  }
});
