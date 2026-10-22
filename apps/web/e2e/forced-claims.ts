import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Page } from '@playwright/test';

/**
 * [GU] The home with the `guestLesson` claim forced on, in a real browser, for AMENDMENTS-GUEST-FIRST-LESSON section
 * 13.2 (row GU-6): the claim stays `false` in `SITE_CLAIMS` until GU-7, so the export never holds the line; a build
 * variable may never switch a claim on (site-claims.ts). Instead the page's own `claims` prop does it, test-only:
 *
 * 1. `src/app/__tests__/forced-claims-home.test.tsx` renders the home route's document (`SiteDocument` and `HomePage`)
 *    with the claim forced on and with today's claims, in en, es and ko, and with `HR_FORCED_CLAIMS_OUT` set writes
 *    them to that folder. It runs once per Playwright worker (about a second), through the web package's vitest.
 * 2. `openForcedHome` answers the navigation to `/`, `/es` or `/ko` with that document under the export's own
 *    `<head>` (its stylesheet, fonts and metadata), scripts left out: the export's CSS, captures and layout, measured
 *    without hydration. Nothing is shipped and nothing is built for it.
 *
 * `site-budgets.spec.ts` checks the harness against the export: with today's claims, its home measures as the
 * export's home does, so a forced-on measurement is a measurement of what GU-7 will ship.
 */
export type ForcedLocale = 'en' | 'es' | 'ko';
export type ForcedState = 'on' | 'off';

const WEB = join(__dirname, '..');
let rendered: string | undefined;

/** The folder holding `<state>-<locale>.html`, rendered once per worker. */
function renderedDir(): string {
  if (rendered) return rendered;
  const out = mkdtempSync(join(tmpdir(), 'hr-forced-claims-'));
  execFileSync(join(WEB, 'node_modules', '.bin', 'vitest'), ['run', 'src/app/__tests__/forced-claims-home.test.tsx'], {
    cwd: WEB,
    env: { ...process.env, HR_FORCED_CLAIMS_OUT: out, TZ: 'UTC' },
    stdio: 'pipe',
  });
  rendered = out;
  return out;
}

/** The home's path in `locale`, as the export serves it. */
export const homePath = (locale: ForcedLocale): string => (locale === 'en' ? '/' : `/${locale}`);

/** The rendered document under the export's `<head>`, every script removed (the forced render has none). */
function composeDocument(exported: string, forced: string): string {
  const head = (/<head>[\s\S]*?<\/head>/.exec(exported)?.[0] ?? '<head></head>')
    .replace(/<script\b[\s\S]*?<\/script>/g, '')
    .replace(/<link\b[^>]*\bas="script"[^>]*>/g, '');
  const open = /^<html\b[^>]*>/.exec(forced)?.[0];
  if (!open) throw new Error('forced render: no <html> element');
  return `<!DOCTYPE html>${open}${head}${forced.slice(open.length)}`;
}

/**
 * Opens the home in `locale` with the claims of `state` (`on`: today's claims and `guestLesson: true`; `off`: today's
 * claims, the harness self-check). Set the viewport first, as the other specs do.
 */
export async function openForcedHome(page: Page, locale: ForcedLocale, state: ForcedState): Promise<void> {
  const forced = readFileSync(join(renderedDir(), `${state}-${locale}.html`), 'utf8');
  const path = homePath(locale);
  await page.route(
    (url) => url.pathname === path,
    async (route) => {
      if (route.request().resourceType() !== 'document') return route.continue();
      const exported = await (await route.fetch()).text();
      return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: composeDocument(exported, forced) });
    },
  );
  await page.goto(path);
  await page.waitForLoadState('load');
}
