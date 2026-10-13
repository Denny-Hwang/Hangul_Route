import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getMessages } from '@hangul-route/i18n';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SiteFooter } from '../../components/landing/SiteFooter';
import { SiteHeader } from '../../components/landing/SiteHeader';
import { SiteShell } from '../../components/landing/SiteShell';
import { CONTACT_EMAIL } from '../../data/contact';
import { learnerStart, signIn } from '../../lib/site-links';
import { SITE_BREAKPOINTS } from '../../lib/site-style';

/**
 * The site's shared header and footer (F-SITE-002 §3.2, §6; wireframe design/wireframes/site/header-footer.md; mock
 * design/screens/site/header.md). DOM order is the visual order at every width; the phone row is the brand and Sign in,
 * and the items hidden below 720 px carry the breakpoint class that `display: none`s them; the legal variant has no
 * Sign in and no Start learning; the current page's link carries `aria-current="page"` and its label alone.
 */
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SHOW_ALL_LOCALES', '');
  vi.stubEnv('EXPO_PUBLIC_SHOW_ALL_LOCALES', '');
  vi.stubEnv('CONSOLE_ORIGIN', '');
});
afterEach(() => vi.unstubAllEnvs());

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
const classOf = (c: Control | undefined): string => /class="([^"]*)"/.exec(c?.attrs ?? '')?.[1] ?? '';

describe('SiteHeader', () => {
  const html = renderToStaticMarkup(<SiteHeader locale="en" current="learners" />);
  const items = controls(html);

  it('DOM order = visual order: skip link, brand, Start learning, the three persona links, Sign in', () => {
    expect(items.map((c) => c.text)).toEqual([
      t.nav.skip,
      `${t.brand.mark}${t.brand.name}`,
      t.nav.start,
      t.nav.learners,
      t.nav.parents,
      t.nav.teachers,
      t.nav.signIn,
    ]);
    expect(items.map(hrefOf)).toEqual(['#content', '/', learnerStart('en'), '/learners', '/parents', '/teachers', signIn()]);
  });

  it('Sign in is the neutral grown-up sign-in (no persona hint), never /teach or /parent', () => {
    expect(hrefOf(items.at(-1))).toBe('/signin');
    expect(html).not.toMatch(/href="\/(teach|parent)(\/|"|\?)/);
  });

  it('the skip link is the first Tab stop and the brand mark is decorative', () => {
    expect(html.indexOf('href="#content"')).toBeLessThan(html.indexOf('<header'));
    expect(html).toMatch(/<span aria-hidden="true" class="hr-site-brand-mark"/);
  });

  it('Start learning and the persona links are the phone-hidden items (one class the stylesheet hides below 720 px)', () => {
    expect(classOf(items[2])).toContain('hr-site-wide-only');
    expect(html).toMatch(/<nav aria-label="Main" class="[^"]*hr-site-wide-only/);
    for (const i of [1, 6]) expect(classOf(items[i])).not.toContain('hr-site-wide-only');
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

  it('a locale page links its locale: brand and persona links prefixed, the app link carries ?lang=', () => {
    const es = controls(renderToStaticMarkup(<SiteHeader locale="es" current="learners" />));
    expect(es.map(hrefOf)).toEqual(['#content', '/es', learnerStart('es'), '/es/learners', '/es/parents', '/es/teachers', signIn()]);
    expect(learnerStart('es')).toContain('lang=es');
  });

  it('the legal variant: brand and the persona links only, no Sign in and no Start learning (OD-14)', () => {
    const legal = controls(renderToStaticMarkup(<SiteHeader locale="en" variant="legal" />));
    expect(legal.map((c) => c.text)).toEqual([t.nav.skip, `${t.brand.mark}${t.brand.name}`, t.nav.learners, t.nav.parents, t.nav.teachers]);
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

  it('Guide: the persona pages; App: Start learning and Sign in; Company: About, Privacy, Terms and Contact', () => {
    expect(items.map((c) => c.text)).toEqual([
      t.nav.learners,
      t.nav.parents,
      t.nav.teachers,
      t.nav.start,
      t.nav.signIn,
      t.footer.about,
      t.footer.privacy,
      t.footer.terms,
      `${t.footer.contact}${CONTACT_EMAIL}`,
    ]);
    expect(items.map(hrefOf)).toEqual([
      '/learners',
      '/parents',
      '/teachers',
      learnerStart('en'),
      signIn(),
      '/about',
      '/privacy',
      '/terms',
      `mailto:${CONTACT_EMAIL}`,
    ]);
  });

  it('no console, demo or billing link and no old anchors', () => {
    expect(html).not.toMatch(/href="\/(teach|parent|account|billing)(\/|"|\?|#)/);
    expect(html).not.toMatch(/href="#(cards|games|parents)"/);
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
    expect(es).toEqual(expect.arrayContaining(['/es/learners', '/es/about', '/es/privacy', learnerStart('es')]));
  });

  it('the locale switcher shows once a second locale ships and keeps the page', () => {
    expect(html).not.toContain('hrefLang');
    vi.stubEnv('NEXT_PUBLIC_SHOW_ALL_LOCALES', '1');
    const qa = renderToStaticMarkup(<SiteFooter locale="en" page="/learners" />);
    expect(qa).toContain('href="/es/learners" hrefLang="es"');
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

describe('globals.css: the site rules', () => {
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');
  /** The media queries whose rules are the site's (their first rule is an `hr-site-*` rule). */
  const siteQueries = [...rules.matchAll(/@media\s*\(([^)]*)\)\s*\{\s*\.hr-site/g)].map((m) => m[1]?.trim());

  it('are mobile first, in em: only min-width queries at the S-D breakpoints', () => {
    expect(siteQueries.length).toBeGreaterThan(0);
    const allowed = Object.values(SITE_BREAKPOINTS).map((em) => `min-width: ${em}em`);
    for (const q of siteQueries) expect(allowed, q).toContain(q);
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
