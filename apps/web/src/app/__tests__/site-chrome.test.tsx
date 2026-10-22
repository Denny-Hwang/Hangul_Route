import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getMessages } from '@hangul-route/i18n';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_SANS } from '../../components/SiteDocument';
import { SiteFooter } from '../../components/landing/SiteFooter';
import { PERSONA_PAGES, SHIPPED_PERSONA_PAGES, SiteHeader } from '../../components/landing/SiteHeader';
import { SiteShell } from '../../components/landing/SiteShell';
import AboutPage from '../(en)/about/page';
import PrivacyPage from '../(en)/privacy/page';
import TermsPage from '../(en)/terms/page';
import NotFoundPage from '../not-found';
import { CONTACT_EMAIL } from '../../data/contact';
import { learnerStart, signIn } from '../../lib/site-links';
import { SITE_PAGES } from '../../lib/site-metadata';
import { sitePath } from '../../lib/site-path';
import { SITE_BREAKPOINTS } from '../../lib/site-style';
import { withoutSwitcher } from './locale-switcher-html';

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
  const html = renderToStaticMarkup(<SiteHeader locale="en" current="learners" />);
  const items = controls(html);

  it('DOM order = visual order: skip link, brand, Start learning, the shipped persona links, Sign in', () => {
    expect(items.map((c) => c.text)).toEqual([t.nav.skip, `${t.brand.mark}${t.brand.name}`, t.nav.start, ...personaLabels, t.nav.signIn]);
    expect(items.map(hrefOf)).toEqual(['#content', '/', learnerStart('en'), ...personaPaths('en'), signIn()]);
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

  it('Start learning and the persona links are the phone-hidden items (one class the stylesheet hides below 720 px)', () => {
    expect(classOf(items[2])).toContain('hr-site-wide-only');
    expect(html).toMatch(/<nav aria-label="Main" class="[^"]*hr-site-wide-only/);
    for (const i of [1, items.length - 1]) expect(classOf(items[i])).not.toContain('hr-site-wide-only');
    // display is the stylesheet's: an inline display would beat the media query.
    expect(items[2]?.attrs).not.toMatch(/style="[^"]*display:/);
    expect(html).not.toMatch(/<nav[^>]*style="[^"]*display:/);
  });

  it('the current page: aria-current="page", a non-colour marker, and an accessible name equal to its label', () => {
    const current = items.filter((c) => c.attrs.includes('aria-current="page"'));
    expect(current).toHaveLength(1);
    expect(current[0]?.text).toBe(t.nav.learners);
    expect(current[0]?.attrs).toContain('text-decoration-line:underline');
    expect(current[0]?.attrs).not.toContain('aria-label');
    expect(html).not.toContain('current page');
  });

  it('no current page: no link is marked', () => {
    expect(renderToStaticMarkup(<SiteHeader locale="en" />)).not.toContain('aria-current');
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
  });

  it('a locale page links its locale: brand and persona links prefixed, the app link and Sign in carry ?lang=', () => {
    const es = controls(renderToStaticMarkup(<SiteHeader locale="es" current="learners" />));
    expect(es.map(hrefOf)).toEqual(['#content', '/es', learnerStart('es'), ...personaPaths('es'), signIn(undefined, 'es')]);
    expect(signIn(undefined, 'es')).toContain('lang=es');
    expect(personaPaths('es')).toContain('/es/learners');
    expect(learnerStart('es')).toContain('lang=es');
  });

  it('the legal variant: brand and the persona links only, no Sign in and no Start learning (OD-14)', () => {
    const legal = controls(renderToStaticMarkup(<SiteHeader locale="en" variant="legal" />));
    expect(legal.map((c) => c.text)).toEqual([t.nav.skip, `${t.brand.mark}${t.brand.name}`, ...personaLabels]);
    expect(legal.map(hrefOf)).not.toContain(signIn());
    expect(legal.map(hrefOf)).not.toContain(learnerStart('en'));
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
    expect(html).not.toContain(`Draft for review`);
  });

  it('every link of About and the legal pages has a 64 px hit area', () => {
    for (const html of [about, ...legal.map(([, h]) => h)]) {
      for (const c of controls(html)) expect(c.attrs, c.text).toMatch(/min-height:(64|80)px/);
    }
  });

  it('404: an English document in the site chrome, with Hoya waving, its h1, our line, the home link, then Start learning (SN-2, §3.7)', () => {
    const html = renderToStaticMarkup(<NotFoundPage />);
    expect(html).toMatch(/^<html lang="en">/);
    expect(html).not.toContain('This page could not be found.');
    expect(html).toContain(t.notFound.body);
    // The shared header and footer (F-SITE-002 S-5), so a lost visitor keeps the site's way around.
    expect(controls(html)[0]?.text).toBe(t.nav.skip);
    expect(html).toMatch(/<header\b/);
    expect(html).toMatch(/<footer\b/);
    const main = /<main\b[^>]*>([\s\S]*)<\/main>/.exec(html)?.[1] ?? '';
    expect(main.match(/<h1\b/g)).toHaveLength(1);
    expect(main).toMatch(new RegExp(`<h1[^>]*>${t.notFound.title}</h1>`));
    // Hoya waving (OD-SN-7: a missing page is not the visitor's miss), never a failure picture, and decorative: the h1
    // says what happened.
    expect(main).toMatch(/<svg[^>]*aria-hidden="true"[^>]*data-pose="waving"/);
    expect(main).not.toContain('data-pose="thinking"');
    // DOM order = the mock's visual order: Hoya, h1, line, the home text link, then the primary action.
    expect(main.indexOf('data-pose="waving"')).toBeLessThan(main.indexOf('<h1'));
    expect(main.indexOf('<h1')).toBeLessThan(main.indexOf(t.notFound.body));
    const links = controls(main);
    expect(links.map((c) => [hrefOf(c), c.text])).toEqual([
      ['/', t.notFound.home],
      [learnerStart('en'), t.notFound.start],
    ]);
    expect(links[0]?.attrs).toContain('class="hr-site-text-link"');
    expect(links[1]?.attrs).toContain('class="hr-site-primary"');
    expect(links[1]?.attrs).toMatch(/min-height:80px/);
    for (const c of links) expect(c.attrs).toMatch(/min-height:(64|80)px/);
    expect(main).not.toContain('hr-site-secondary');
    expect(css).not.toMatch(/\.hr-site-404 > div/);
    // Hoya 4.5rem below 45em and 7rem from 45em, from the site's custom properties (§3.7).
    expect(css).toMatch(/\.hr-site-404-hoya\s*\{[^}]*width:\s*var\(--hr-site-404-hoya\)/);
    const wide = css.slice(css.indexOf('@media (min-width: 45em)'));
    expect(wide).toMatch(/\.hr-site-404-hoya\s*\{[^}]*width:\s*var\(--hr-site-404-hoya-wide\)/);
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
    expect(rules).toMatch(/@media \(min-width: 45em\)\s*\{[^}]*\.hr-site-header-start\s*\{\s*display:\s*inline-flex/);
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
