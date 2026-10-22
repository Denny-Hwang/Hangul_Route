import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCALE_META, getMessages } from '@hangul-route/i18n';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_SANS } from '../../components/SiteDocument';
import { SiteFooter } from '../../components/landing/SiteFooter';
import { LanguageMenu } from '../../components/landing/LanguageMenu';
import { PERSONA_PAGES, SHIPPED_PERSONA_PAGES, SiteHeader, languageMenuItems } from '../../components/landing/SiteHeader';
import { SiteShell } from '../../components/landing/SiteShell';
import AboutPage from '../(en)/about/page';
import PrivacyPage from '../(en)/privacy/page';
import TermsPage from '../(en)/terms/page';
import NotFoundPage from '../not-found';
import { CONTACT_EMAIL } from '../../data/contact';
import { learnerStart, signIn } from '../../lib/site-links';
import { SITE_PAGES, shownSiteLocales, type SitePage } from '../../lib/site-metadata';
import { sitePath } from '../../lib/site-path';
import { SITE_BREAKPOINTS } from '../../lib/site-style';
import { withoutLanguageMenu, withoutSwitcher } from './locale-switcher-html';

/**
 * The site's shared header and footer (F-SITE-002 §3.2, §6; wireframe design/wireframes/site/header-footer.md; mock
 * design/screens/site/header.md). DOM order is the visual order at every width; the phone row is the brand and Sign in,
 * and the items hidden below 720 px carry the breakpoint class that `display: none`s them; the legal variant has no
 * Sign in and no Start learning; the current page's link carries `aria-current="page"` and its label alone.
 */
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SHOW_ALL_LOCALES', '');
  vi.stubEnv('EXPO_PUBLIC_SHOW_ALL_LOCALES', '');
  vi.stubEnv('CONSOLE_ORIGIN', 'false');
});
afterEach(() => vi.unstubAllEnvs());
// Grown-up links on the site's own origin (the kill switch CONSOLE_ORIGIN=false; a build without the variable
// links to the app host since F-SITE-002 S-10). Also set here for the pages rendered while tests are collected.
vi.stubEnv('CONSOLE_ORIGIN', 'false');

const t = getMessages('en').landing;
const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, '..', 'globals.css'), 'utf8');

interface Control {
  tag: string;
  attrs: string;
  text: string;
}

/** Every link and button in document order, with its attributes and its text (tags inside stripped). */
function controls(html: string): Control[] {
  return [...html.matchAll(/<(a|button)\b([^>]*)>([\s\S]*?)<\/\1>/g)].map((m) => ({
    tag: m[1] ?? '',
    attrs: m[2] ?? '',
    text: (m[3] ?? '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&'),
  }));
}
const hrefOf = (c: Control | undefined): string => /href="([^"]*)"/.exec(c?.attrs ?? '')?.[1] ?? '';
/** True for a link of the footer's locale switcher (it carries hrefLang and marks the current locale's page). */
const isSwitcherLink = (c: Control): boolean => c.attrs.includes('hrefLang=');

/** The shipped persona pages' labels and paths, in nav order (S-4a: Learners; S-4b adds Parents and Teachers). */
const personaLabels = SHIPPED_PERSONA_PAGES.map((page) => t.nav[page]);
const personaPaths = (locale: 'en' | 'es'): string[] => SHIPPED_PERSONA_PAGES.map((page) => sitePath(locale, `/${page}`));

describe('SHIPPED_PERSONA_PAGES', () => {
  it('are the persona pages whose path is in SITE_PAGES, in nav order', () => {
    expect(SHIPPED_PERSONA_PAGES).toEqual(PERSONA_PAGES.filter((page) => (SITE_PAGES as readonly string[]).includes(`/${page}`)));
    expect(SHIPPED_PERSONA_PAGES).toContain('learners');
  });
});

describe('every internal site link in the header and footer resolves to an exported page', () => {
  const external = (href: string): boolean => /^(https?:|mailto:|#)/.test(href) || href === signIn() || href.startsWith('/signin');
  for (const locale of ['en', 'es'] as const) {
    it(`${locale}: each one is sitePath(locale, page) for a page in SITE_PAGES`, () => {
      // The locale switcher links the same page in every shipped locale (es and ko ship, rows 15b / 16b).
      const pages = new Set((['en', 'es', 'ko'] as const).flatMap((l) => SITE_PAGES.map((page) => sitePath(l, page))));
      const html = [
        renderToStaticMarkup(<SiteHeader locale={locale} />),
        renderToStaticMarkup(<SiteHeader locale={locale} variant="legal" />),
        renderToStaticMarkup(<SiteFooter locale={locale} page="/learners" />),
        renderToStaticMarkup(<SiteFooter locale={locale} page="/privacy" variant="legal" />),
      ].join('');
      const internal = controls(html).map(hrefOf).filter((href) => !external(href) && href !== learnerStart(locale));
      expect(internal.length).toBeGreaterThan(0);
      for (const href of internal) expect(pages, href).toContain(href);
    });
  }
});
const classOf = (c: Control | undefined): string => /class="([^"]*)"/.exec(c?.attrs ?? '')?.[1] ?? '';

describe('SiteHeader', () => {
  const html = renderToStaticMarkup(<SiteHeader locale="en" page="/learners" current="learners" />);
  const items = controls(html);
  const endonyms = shownSiteLocales().map((l) => LOCALE_META[l].endonym);
  const menuPaths = (page: SitePage): string[] => shownSiteLocales().map((l) => sitePath(l, page));

  it('DOM order = visual order: skip link, brand, Start, the shipped persona links, Language, Sign in', () => {
    expect(items.map((c) => c.text)).toEqual([t.nav.skip, `${t.brand.mark}${t.brand.name}`, t.nav.startShort, ...personaLabels, ...endonyms, t.nav.signIn]);
    expect(items.map(hrefOf)).toEqual(['#content', '/', learnerStart('en'), ...personaPaths('en'), ...menuPaths('/learners'), signIn()]);
    // The language control sits between the nav and Sign in in the markup too (no CSS order).
    expect(html.indexOf('<nav')).toBeLessThan(html.indexOf('<details'));
    expect(html.indexOf('<details')).toBeLessThan(html.indexOf(`href="${signIn()}"`));
  });

  it('Sign in is the neutral grown-up sign-in (no persona hint), never /teach or /parent', () => {
    expect(hrefOf(items.at(-1))).toBe('/signin');
    expect(html).not.toMatch(/href="\/(teach|parent)(\/|"|\?)/);
  });

  it('the skip link is the first Tab stop; the brand mark is part of the brand link\'s name (WCAG 2.5.3)', () => {
    expect(html.indexOf('href="#content"')).toBeLessThan(html.indexOf('<header'));
    expect(html).toMatch(/<span class="hr-site-brand-mark"/);
    expect(html).not.toMatch(/<span aria-hidden="true" class="hr-site-brand-mark"/);
    expect(items[1]?.attrs).not.toContain('aria-label');
  });

  it('[SN] the brand mark shows at every width in a rem box; the name is the stylesheet\'s (hidden only visually)', () => {
    expect(html).toMatch(/class="hr-site-brand-mark" style="display:flex;[^"]*width:3rem;height:3rem/);
    expect(html).toMatch(/<span class="hr-site-brand-name"[^>]*>Hangul Route<\/span>/);
  });

  it('[SN] Start shows at every width off `/`: visible "Start", accessible name "Start learning", which contains it', () => {
    const start = items[2];
    expect(classOf(start)).toContain('hr-site-header-start');
    expect(classOf(start)).not.toContain('hr-site-wide-only');
    expect(start?.text).toBe(t.nav.startShort);
    expect(start?.attrs).toContain(`aria-label="${t.nav.start}"`);
    for (const locale of ['en', 'es', 'ko'] as const) {
      const words = getMessages(locale).landing.nav;
      expect(words.start.toLowerCase(), locale).toContain(words.startShort.toLowerCase());
    }
    // display is the stylesheet's: an inline display would beat the media query.
    expect(start?.attrs).not.toMatch(/style="[^"]*display:/);
  });

  it('[SN] on `/` Start stays wide-only (OD-SN-1) and the brand carries the home class (name from 22.5em, OD-SN-2)', () => {
    const home = controls(renderToStaticMarkup(<SiteHeader locale="en" page="/" />));
    expect(classOf(home[2])).toContain('hr-site-wide-only');
    expect(classOf(home[1])).toContain('hr-site-brand-home');
    expect(classOf(items[1])).not.toContain('hr-site-brand-home');
    // A 404 passes page "/" but is not the home: its header has the phone Start pill.
    const notFound = controls(renderToStaticMarkup(<SiteHeader locale="en" page="/" home={false} />));
    expect(classOf(notFound[2])).not.toContain('hr-site-wide-only');
    expect(classOf(notFound[1])).not.toContain('hr-site-brand-home');
  });

  it('the persona nav is the only phone-hidden group (one class the stylesheet hides below 720 px)', () => {
    expect(html).toMatch(/<nav aria-label="Main" class="[^"]*hr-site-wide-only/);
    for (const i of [1, 2, items.length - 1]) expect(classOf(items[i])).not.toContain('hr-site-wide-only');
    expect(html).not.toMatch(/<nav[^>]*style="[^"]*display:/);
  });

  it('the current page: aria-current="page", a non-colour marker, and an accessible name equal to its label', () => {
    const current = controls(withoutLanguageMenu(html)).filter((c) => c.attrs.includes('aria-current="page"'));
    expect(current).toHaveLength(1);
    expect(current[0]?.text).toBe(t.nav.learners);
    expect(current[0]?.attrs).toContain('text-decoration-line:underline');
    expect(current[0]?.attrs).not.toContain('aria-label');
    expect(html).not.toContain('current page');
  });

  it('no current page: no nav link is marked', () => {
    expect(withoutLanguageMenu(renderToStaticMarkup(<SiteHeader locale="en" />))).not.toContain('aria-current');
  });

  it('links to the app are plain <a>, persona pages stay inside the site group', () => {
    expect(hrefOf(items[2])).toBe(learnerStart('en'));
    expect(items.every((c) => c.tag === 'a')).toBe(true);
  });

  it('every control has a 64 x 64 hit area', () => {
    for (const c of items) {
      expect(c.attrs, c.text).toMatch(/min-height:(64|80)px/);
      expect(c.attrs, c.text).toContain('min-width:64px');
    }
    // The language control's summary takes its hit area from the stylesheet (its layout changes at 45em).
    const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(rules).toMatch(/\.hr-site-lang-summary\s*\{[^}]*min-width:\s*var\(--hr-site-touch-min\);[^}]*min-height:\s*var\(--hr-site-touch-min\)/);
  });

  it('a locale page links its locale: brand and persona links prefixed, the app link and Sign in carry ?lang=', () => {
    const es = controls(renderToStaticMarkup(<SiteHeader locale="es" page="/learners" current="learners" />));
    expect(es.map(hrefOf)).toEqual(['#content', '/es', learnerStart('es'), ...personaPaths('es'), ...menuPaths('/learners'), signIn(undefined, 'es')]);
    expect(signIn(undefined, 'es')).toContain('lang=es');
    expect(personaPaths('es')).toContain('/es/learners');
    expect(learnerStart('es')).toContain('lang=es');
  });

  it('the legal variant: brand, the persona links and the language control; no Sign in and no Start (OD-14)', () => {
    const legal = controls(renderToStaticMarkup(<SiteHeader locale="en" page="/privacy" variant="legal" />));
    expect(legal.map((c) => c.text)).toEqual([t.nav.skip, `${t.brand.mark}${t.brand.name}`, ...personaLabels, ...endonyms]);
    expect(legal.map(hrefOf)).not.toContain(signIn());
    expect(legal.map(hrefOf)).not.toContain(learnerStart('en'));
    expect(renderToStaticMarkup(<SiteHeader locale="en" page="/privacy" variant="legal" />)).toContain('class="hr-site-lang hr-site-lang-push"');
  });
});

/** [SN] AMENDMENTS-SITE-NEWUSER §3.2: the header's language control. */
describe('LanguageMenu in the header', () => {
  const html = renderToStaticMarkup(<SiteHeader locale="es" page="/teachers" current="teachers" />);
  const details = html.match(/<details class="hr-site-lang[^"]*">[\s\S]*?<\/details>/g) ?? [];
  const menu = details[0] ?? '';
  const links = controls(menu);

  it('is one native <details>: the summary holds the globe, the hidden word "Language" and the current endonym with lang', () => {
    expect(details).toHaveLength(1);
    const summary = menu.match(/<summary[^>]*>([\s\S]*?)<\/summary>/)?.[1] ?? '';
    expect(summary).toMatch(/<svg[^>]*aria-hidden="true"/);
    expect(summary).toContain(`>${getMessages('es').landing.footer.language}</span>`);
    expect(summary).toContain(`<span lang="es" class="hr-site-lang-endonym">${LOCALE_META.es.endonym}</span>`);
    expect(menu).not.toMatch(/<details[^>]*\sopen/);
  });

  it('links the same page in every shown locale, by endonym, with lang and hrefLang, the current one marked', () => {
    expect(links.map((c) => c.text)).toEqual(shownSiteLocales().map((l) => LOCALE_META[l].endonym));
    expect(links.map(hrefOf)).toEqual(shownSiteLocales().map((l) => sitePath(l, '/teachers')));
    for (const [i, l] of shownSiteLocales().entries()) {
      expect(links[i]?.attrs).toContain(`hrefLang="${LOCALE_META[l].htmlLang}"`);
      expect(links[i]?.attrs).toContain(`lang="${LOCALE_META[l].htmlLang}"`);
      expect(links[i]?.attrs.includes('aria-current="page"'), l).toBe(l === 'es');
    }
    // The current one: bold and a check glyph, not colour alone.
    expect(links.find((c) => c.attrs.includes('aria-current'))?.attrs).toContain('font-weight:700');
    expect(menu).toMatch(/aria-current="page"[^>]*>[^<]*<span>Español<\/span><svg/);
  });

  it('on every site page: the links follow the page (the 404 passes `/`)', () => {
    for (const page of SITE_PAGES) {
      const items = languageMenuItems('en', page);
      expect(items.map((i) => i.href)).toEqual(shownSiteLocales().map((l) => sitePath(l, page)));
    }
  });

  it('the endonyms are values from LOCALE_META, never a message (a message holding an endonym fails)', () => {
    for (const locale of ['en', 'es', 'ko'] as const) {
      const flat = JSON.stringify(getMessages(locale).landing.nav) + JSON.stringify(getMessages(locale).landing.footer);
      for (const meta of Object.values(LOCALE_META)) expect(flat, locale).not.toContain(meta.endonym);
    }
  });

  it('is not rendered while only one locale is shown', () => {
    expect(renderToStaticMarkup(<LanguageMenu label="Language" items={languageMenuItems('en', '/', ['en'])} />)).toBe('');
  });
});

describe('SiteFooter', () => {
  const html = renderToStaticMarkup(<SiteFooter locale="en" page="/learners" />);
  const items = controls(html);
  const headings = [...html.matchAll(/<h2[^>]*>([^<]*)<\/h2>/g)].map((m) => m[1]);

  it('three groups in DOM order: Guide, App, Company', () => {
    expect(headings).toEqual([t.footer.guide, t.footer.app, t.footer.company]);
  });

  it('Guide: the persona pages; App: Start learning and Sign in; Company: About, Privacy, Terms and Contact; then Open-source notices beside the copyright line', () => {
    expect(items.map((c) => c.text)).toEqual([
      ...personaLabels,
      t.nav.start,
      t.nav.signIn,
      t.footer.about,
      t.footer.privacy,
      t.footer.terms,
      `${t.footer.contact}${CONTACT_EMAIL}`,
      t.footer.licenses,
      'English',
      'Español',
      '한국어',
    ]);
    expect(items.map(hrefOf)).toEqual([
      ...personaPaths('en'),
      learnerStart('en'),
      signIn(),
      '/about',
      '/privacy',
      '/terms',
      `mailto:${CONTACT_EMAIL}`,
      '/licenses',
      '/learners',
      '/es/learners',
      '/ko/learners',
    ]);
  });

  it('the open-source link keeps its 64 px hit area without overlapping the copyright line or the locale links', () => {
    // The link's negative block margins reach out by the overflow; the row takes it up as row gap (when the link wraps
    // under the line) and as bottom padding less the locale row's own top margin.
    const link = html.match(/<a [^>]*href="\/licenses"[^>]*>/)?.[0] ?? '';
    const overflow = link.match(/margin-block:calc\(-1 \* (\(\([^;"]+\)\/ 2\)|[^;"]+)\)/)?.[1];
    expect(overflow, link).toBeTruthy();
    const row = html.slice(0, html.indexOf(link)).match(/<div style="([^"]*)"><p[^>]*>[^<]*<\/p>$/)?.[1] ?? '';
    expect(row).toContain(`row-gap:calc(${overflow})`);
    expect(row).toContain(`padding-block-end:calc(${overflow} - 8px)`);
  });

  it('no console, demo or billing link and no old anchors', () => {
    expect(html).not.toMatch(/href="\/(teach|parent|account|billing)(\/|"|\?|#)/);
    expect(html).not.toMatch(/href="#(cards|games|parents)"/);
  });

  it('only Guide is a landmark (nav, the page navigation on phones); App and Company add no region', () => {
    expect(html).toMatch(/<nav aria-labelledby="footer-guide"><h2 id="footer-guide"/);
    expect(html).not.toMatch(/<section\b/);
    expect(html).not.toMatch(/aria-labelledby="footer-(app|company)"/);
  });

  it('every footer list keeps its list role', () => {
    for (const m of html.matchAll(/<ul\b([^>]*)>/g)) expect(m[1]).toContain('role="list"');
  });

  it('marks the current persona page in Guide (the header nav is hidden on phones), bold and not by colour alone', () => {
    expect(withoutSwitcher(html)).not.toContain('aria-current="page"');
    const marked = controls(renderToStaticMarkup(<SiteFooter locale="en" page="/learners" current="learners" />)).filter(
      (c) => !isSwitcherLink(c) && c.attrs.includes('aria-current="page"'),
    );
    expect(marked.map((c) => c.text)).toEqual([t.nav.learners]);
    expect(marked[0]?.attrs).toContain('font-weight:700');
  });

  it('the brand line and the copyright', () => {
    expect(html).toContain(t.meta.tagline);
    expect(html).toContain(t.footer.copyright(new Date().getFullYear()));
  });

  it('the footer columns are the stylesheet\'s (one class), so large text can fall back to one column', () => {
    expect(html).toMatch(/class="hr-site-footer-groups"/);
    expect(html).not.toMatch(/class="hr-site-footer-groups"[^>]*style="[^"]*grid-template-columns/);
  });

  it('every link has a 64 px tall hit area', () => {
    for (const c of items) expect(c.attrs, c.text).toContain('min-height:64px');
  });

  it('the legal variant has no App group', () => {
    const legal = renderToStaticMarkup(<SiteFooter locale="en" page="/privacy" variant="legal" />);
    expect([...legal.matchAll(/<h2[^>]*>([^<]*)<\/h2>/g)].map((m) => m[1])).toEqual([t.footer.guide, t.footer.company]);
    expect(legal).not.toContain(`href="${signIn()}"`);
    expect(legal).not.toContain(`href="${learnerStart('en')}"`);
  });

  it('a locale page links its locale', () => {
    const es = controls(renderToStaticMarkup(<SiteFooter locale="es" page="/learners" />)).map(hrefOf);
    expect(es).toEqual(expect.arrayContaining(['/es/learners', '/es/about', '/es/privacy', learnerStart('es'), signIn(undefined, 'es')]));
    expect(es).not.toContain(signIn());
  });

  it('the locale switcher shows now that es and ko ship, keeps the page and marks the current locale', () => {
    expect(html).toContain('href="/es/learners" hrefLang="es"');
    expect(html).toContain('href="/ko/learners" hrefLang="ko"');
    const switcher = controls(html).filter(isSwitcherLink);
    expect(switcher.filter((c) => c.attrs.includes('aria-current="page"')).map((c) => c.text)).toEqual(['English']);
    const ko = controls(renderToStaticMarkup(<SiteFooter locale="ko" page="/learners" />)).filter(isSwitcherLink);
    expect(ko.filter((c) => c.attrs.includes('aria-current="page"')).map(hrefOf)).toEqual(['/ko/learners']);
  });
});

describe('SiteShell', () => {
  const html = renderToStaticMarkup(
    <SiteShell locale="en" page="/learners" current="learners">
      <p>body</p>
    </SiteShell>,
  );

  it('landmarks in order: skip link, header, main#content (the skip target), footer', () => {
    const order = ['href="#content"', '<header', '<main id="content"', '<footer'].map((s) => html.indexOf(s));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html).toMatch(/<main id="content" tabindex="-1"/i);
  });

  it('sets the token custom properties the stylesheet reads, and text in rem so browser text size scales it', () => {
    expect(html).toMatch(/<div class="hr-site" style="[^"]*--hr-site-brand:/);
    expect(html).toMatch(/<div class="hr-site" style="[^"]*font-size:1.125rem/);
  });
});

describe('About, Privacy, Terms and the 404 page get the site chrome (F-SITE-002 §3.7, S-5)', () => {
  const about = renderToStaticMarkup(<AboutPage />);
  const legal = [
    ['privacy', renderToStaticMarkup(<PrivacyPage />)],
    ['terms', renderToStaticMarkup(<TermsPage />)],
  ] as const;

  it('About: the full header and footer around its body, which keeps Back home; no current persona page', () => {
    const items = controls(about);
    expect(items.map((c) => c.text)).toEqual(expect.arrayContaining([t.nav.start, t.nav.signIn, t.about.backHome]));
    expect(about).toMatch(/<main id="content"[\s\S]*<h1[^>]*>[^<]*<\/h1>/);
    expect(withoutSwitcher(about)).not.toContain('aria-current="page"');
    expect(about.match(/<h1\b/g)).toHaveLength(1);
    expect(about.match(/<main\b/g)).toHaveLength(1);
  });

  it.each(legal)('%s: the legal variant (no Sign in, no Start learning, no App group) around the unchanged document', (_name, html) => {
    expect(html).not.toContain(`href="${signIn()}"`);
    expect(html).not.toContain(`href="${learnerStart('en')}"`);
    expect([...html.matchAll(/<h2 id="footer-[^"]*"[^>]*>([^<]*)<\/h2>/g)].map((m) => m[1])).toEqual([t.footer.guide, t.footer.company]);
    expect(html.match(/<main\b/g)).toHaveLength(1);
    expect(html).toContain(t.legal.draft);
  });

  it('every link of About and the legal pages has a 64 px hit area', () => {
    for (const html of [about, ...legal.map(([, h]) => h)]) {
      for (const c of controls(html)) expect(c.attrs, c.text).toMatch(/min-height:(64|80)px/);
    }
  });

  it('404: an English document in the site chrome, with Next\'s body, our line and links to / and Start learning', () => {
    const html = renderToStaticMarkup(<NotFoundPage />);
    expect(html).toMatch(/^<html lang="en">/);
    expect(html).toContain('This page could not be found.');
    expect(html).toContain(t.notFound.body);
    // The shared header and footer (F-SITE-002 S-5), so a lost visitor keeps the site's way around.
    expect(controls(html)[0]?.text).toBe(t.nav.skip);
    expect(html).toMatch(/<header\b/);
    expect(html).toMatch(/<footer\b/);
    const main = /<main\b[^>]*>([\s\S]*)<\/main>/.exec(html)?.[1] ?? '';
    const links = controls(main);
    expect(links.map((c) => [hrefOf(c), c.text])).toEqual([
      ['/', t.notFound.home],
      [learnerStart('en'), t.notFound.start],
    ]);
    for (const c of links) expect(c.attrs).toMatch(/min-height:(64|80)px/);
    // Next's body is a full-screen box; inside the chrome it sizes to its content, so the links sit on the first screen.
    expect(main).toMatch(/<div class="hr-site-404">/);
    expect(css.replace(/\/\*[\s\S]*?\*\//g, '')).toMatch(/\.hr-site-404 > div\s*\{[^}]*height:\s*auto !important/);
  });
});

describe('globals.css: the site rules', () => {
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');
  /** The media queries whose rules are the site's (their first rule is an `hr-site-*` rule). */
  const siteQueries = [...rules.matchAll(/@media\s*\(([^)]*)\)\s*\{\s*\.hr-site/g)].map((m) => m[1]?.trim());

  it('are mobile first, in em: only min-width queries at the S-D breakpoints (plus the hover-capable guard)', () => {
    expect(siteQueries.length).toBeGreaterThan(0);
    const allowed = [...Object.values(SITE_BREAKPOINTS).map((em) => `min-width: ${em}em`), 'hover: hover'];
    for (const q of siteQueries) expect(allowed, q).toContain(q);
  });

  it('hover looks apply only on devices that hover, so a tapped card does not keep them after Back', () => {
    const outside = rules.replace(/@media\s*\(hover: hover\)\s*\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g, '');
    expect(outside).not.toMatch(/\.hr-site[^{]*:hover/);
    expect(rules).toMatch(/@media \(hover: hover\)\s*\{\s*\.hr-site-persona-card:hover/);
  });

  it('every hr-site rule inside a media query sits in one of those queries (none behind an old landing query)', () => {
    const blocks = [...rules.matchAll(/@media\s*\(([^)]*)\)\s*\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g)];
    const withSiteRules = blocks.filter((m) => /\.hr-site/.test(m[2] ?? '')).map((m) => m[1]?.trim());
    expect(withSiteRules).toEqual(siteQueries);
  });

  it('hide the phone-hidden header items by default and show them from 45em', () => {
    expect(rules).toMatch(/\.hr-site-wide-only\s*\{\s*display:\s*none;?\s*\}/);
    // [SN] The Start pill shows on phones, except where it is also wide-only (`/`), and in every header from 45em.
    expect(rules).toMatch(/\n\.hr-site-header-start\s*\{\s*display:\s*inline-flex/);
    expect(rules).toMatch(/\n\.hr-site-header-start\.hr-site-wide-only\s*\{\s*display:\s*none/);
    expect(rules).toMatch(/@media \(min-width: 45em\)\s*\{\s*\.hr-site-header-start,\s*\.hr-site-header-start\.hr-site-wide-only\s*\{\s*display:\s*inline-flex/);
  });

  it('[SN] the brand name: visually hidden below 30em, shown to 45em, hidden to 60em (with the language endonym), shown after; on / shown from 22.5em', () => {
    const block = (q: string): string => rules.match(new RegExp(`@media \\(min-width: ${q}\\)\\s*\\{((?:[^{}]*\\{[^{}]*\\})*)\\s*\\}`))?.[1] ?? '';
    expect(rules).toMatch(/\n\.hr-site-brand-name\s*\{[^}]*clip:\s*rect\(0 0 0 0\)/);
    expect(block('22.5em')).toMatch(/\.hr-site-brand-home \.hr-site-brand-name\s*\{[^}]*position:\s*static/);
    expect(block('30em')).toMatch(/\.hr-site-brand-name\s*\{[^}]*position:\s*static/);
    expect(block('45em')).toMatch(/\.hr-site-brand-name,\s*\.hr-site-brand-home \.hr-site-brand-name,\s*\.hr-site-lang-endonym\s*\{[^}]*position:\s*absolute/);
    expect(block('60em')).toMatch(/\.hr-site-brand-name,\s*\.hr-site-brand-home \.hr-site-brand-name,\s*\.hr-site-lang-endonym\s*\{[^}]*position:\s*static/);
  });

  it('[SN] the language menu hangs from the header row, inside the screen less the gutters', () => {
    expect(rules).toMatch(/\.hr-site-header-row\s*\{[^}]*position:\s*relative/);
    expect(rules).toMatch(/\.hr-site-lang-menu\s*\{[^}]*position:\s*absolute;[^}]*max-width:\s*calc\(100vw - 2 \* var\(--hr-site-gutter-compact\)\)/);
  });

  it('take every value from the token custom properties (no literal colour or length)', () => {
    const site = rules.slice(rules.indexOf('.hr-site'));
    expect(site).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
    const declarations = [...site.matchAll(/:\s*([^;{}]+);/g)].map((m) => m[1] ?? '');
    const lengths = declarations.filter((d) => /\b\d+(\.\d+)?(px|rem)\b/.test(d));
    expect(lengths).toEqual([]);
  });

  it('never reorder (focus order = visual order)', () => {
    expect(rules).not.toMatch(/(^|[^-\w])order\s*:/);
  });
});

describe('the site font stack (F-SITE-002 §3.11 budgets measured on Linux CI)', () => {
  it('names Arial-metric sans faces before system-ui, so Linux does not fall back to a wide default', () => {
    const faces = SYSTEM_SANS.split(',').map((f) => f.trim());
    expect(faces.slice(0, 3)).toEqual(['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"']);
    expect(faces.indexOf('Arial')).toBeGreaterThan(-1);
    expect(faces.indexOf('Arial')).toBeLessThan(faces.indexOf('system-ui'));
    expect(faces.at(-1)).toBe('sans-serif');
  });

  it('is the body font of every site document', () => {
    expect(renderToStaticMarkup(<NotFoundPage />)).toContain(`font-family:${SYSTEM_SANS.replace(/"/g, '&quot;')}`);
  });
});
