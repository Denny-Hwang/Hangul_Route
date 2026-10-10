import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import HomePage from '../page';

/**
 * Responsive landing contract (audit W1 / p2-L6, roadmap PR-21).
 *
 * Inline styles beat stylesheet rules, so every property the phone layout
 * overrides must live in globals.css, not inline. This test pins that split;
 * the pixel checks (no horizontal scroll at 320 / 375 / 768, "Play now"
 * visible, focus order = visual order) run in Playwright against the static
 * export (apps/web/e2e/landing-layout.spec.ts).
 *
 * DOM order is visual order at every width: brand, "Play now", then the nav.
 * The header never uses CSS `order`, so keyboard focus (WCAG 2.4.3) follows
 * what the eye sees (WCAG 1.3.2).
 */
const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, '..', 'globals.css'), 'utf8');
const html = renderToStaticMarkup(<HomePage />);

/** Brand + five links + "Play now" need ~780px of content width (measured in Chromium). */
const HEADER_QUERY = '@media (max-width: 899px)';
/** Hero and Meet Hoya stack below ~720px. */
const PHONE_QUERY = '@media (max-width: 719px)';
/** At 320px the brand row only fits "Play now" without the decorative logo mark. */
const TINY_QUERY = '@media (max-width: 359px)';

function openingTag(className: string): string {
  const re = new RegExp(`<[a-z]+[^>]*class="[^"]*\\b${className}\\b[^"]*"[^>]*>`);
  const match = re.exec(html);
  if (!match) throw new Error(`no element with class ${className}`);
  return match[0];
}

function inlineStyle(tag: string): string {
  return /style="([^"]*)"/.exec(tag)?.[1] ?? '';
}

function block(source: string, opener: string): string {
  const start = source.indexOf(opener);
  if (start < 0) throw new Error(`missing ${opener}`);
  let depth = 0;
  for (let i = source.indexOf('{', start); i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(source.indexOf('{', start) + 1, i);
    }
  }
  throw new Error(`unbalanced ${opener}`);
}

function rule(source: string, selector: string): string {
  const re = new RegExp(`(^|[\\s}])${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`);
  return re.exec(source)?.[2]?.replace(/\s+/g, ' ').trim() ?? '';
}

const headerCss = block(css, HEADER_QUERY);
const phoneCss = block(css, PHONE_QUERY);
const tinyCss = block(css, TINY_QUERY);
const desktopCss = [headerCss, phoneCss, tinyCss].reduce((rest, inner) => rest.replace(inner, ''), css);

describe('landing header — nav wraps, "Play now" stays visible', () => {
  it('header and nav are allowed to wrap', () => {
    expect(inlineStyle(openingTag('hr-landing-header'))).toContain('flex-wrap:wrap');
    expect(inlineStyle(openingTag('hr-landing-nav'))).toContain('flex-wrap:wrap');
  });

  it('"Play now" is its own header item, outside the wrapping nav', () => {
    const header = /<header[^>]*class="[^"]*hr-landing-header[^"]*"[^>]*>([\s\S]*?)<\/header>/.exec(html)?.[1] ?? '';
    const nav = /<nav[\s\S]*?<\/nav>/.exec(header)?.[0] ?? '';
    expect(nav).not.toBe('');
    expect(nav).not.toContain('Play now');
    expect(header).toMatch(/<a[^>]*class="[^"]*hr-landing-cta[^"]*"[^>]*>Play now<\/a>/);
    expect(openingTag('hr-landing-cta')).toContain('href="https://app.hangulroute.com"');
  });

  it('the nav has an accessible name', () => {
    expect(openingTag('hr-landing-nav')).toContain('aria-label="Main"');
  });

  it('"Play now" comes before the nav in the DOM, so focus order matches the visual order', () => {
    const header = /<header[^>]*class="[^"]*hr-landing-header[^"]*"[^>]*>([\s\S]*?)<\/header>/.exec(html)?.[1] ?? '';
    const cta = header.indexOf('hr-landing-cta');
    const nav = header.indexOf('<nav');
    expect(cta).toBeGreaterThan(-1);
    expect(nav).toBeGreaterThan(cta);
  });

  it('no rule reorders the header — a CSS `order` would split focus order from visual order', () => {
    const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(rules).not.toMatch(/(^|[^-\w])order\s*:/);
    expect(rules).not.toMatch(/(row|column)-reverse/);
  });

  it('the CTA is pushed to the right of the brand row at every width', () => {
    expect(rule(desktopCss, '.hr-landing-cta')).toContain('margin-left: auto');
  });

  it('on wide screens the section links follow the CTA, right-aligned', () => {
    expect(rule(desktopCss, '.hr-landing-nav')).toContain('justify-content: flex-end');
    expect(rule(desktopCss, '.hr-landing-nav')).not.toContain('margin-left');
  });

  it('below 900px the section links drop to their own full-width row after the CTA', () => {
    expect(rule(headerCss, '.hr-landing-nav')).toContain('flex-basis: 100%');
    expect(rule(headerCss, '.hr-landing-nav')).toContain('justify-content: flex-start');
    expect(headerCss).not.toContain('hr-landing-cta');
  });

  it('at 359px and below only the decorative logo mark is dropped — never the CTA', () => {
    const mark = openingTag('hr-landing-logo-mark');
    expect(mark).toContain('aria-hidden="true"');
    // An inline display would beat the media query and keep the mark on screen.
    expect(inlineStyle(mark)).not.toMatch(/(^|;)display:/);
    expect(rule(desktopCss, '.hr-landing-logo-mark')).toContain('display: flex');
    expect(rule(tinyCss, '.hr-landing-logo-mark')).toContain('display: none');
    expect(tinyCss).not.toContain('hr-landing-cta');
  });

  it('order, flex-basis and margin-left are not set inline (the stylesheet must win)', () => {
    for (const className of ['hr-landing-cta', 'hr-landing-nav']) {
      const style = inlineStyle(openingTag(className));
      expect(style).not.toMatch(/(^|;)order:/);
      expect(style).not.toMatch(/flex-basis|margin-left/);
    }
  });

  it('nothing hides "Play now" at any width', () => {
    expect(css).not.toMatch(/\.hr-landing-cta\s*\{[^}]*display:\s*none/);
  });
});

describe('landing hero and Meet Hoya stack to one column on phones', () => {
  it('two columns on wide screens, one below 720px', () => {
    expect(rule(desktopCss, '.hr-landing-hero')).toContain('grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr)');
    expect(rule(phoneCss, '.hr-landing-hero')).toContain('grid-template-columns: minmax(0, 1fr)');
    expect(rule(desktopCss, '.hr-landing-split')).toContain('grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr)');
    expect(rule(phoneCss, '.hr-landing-split')).toContain('grid-template-columns: minmax(0, 1fr)');
  });

  it('column templates are not set inline', () => {
    for (const className of ['hr-landing-hero', 'hr-landing-split']) {
      const style = inlineStyle(openingTag(className));
      expect(style).toContain('display:grid');
      expect(style).not.toContain('grid-template-columns');
    }
  });

  it('the hero illustration is capped and centred when stacked', () => {
    openingTag('hr-landing-hero-art');
    const art = rule(phoneCss, '.hr-landing-hero-art');
    expect(art).toContain('justify-self: center');
    expect(art).toMatch(/max-width: \d+px/);
  });
});

describe('nothing forces horizontal scroll', () => {
  it('the footer contact line can break anywhere (was 32px of overflow at 820px)', () => {
    const contact = /<div[^>]*data-contact="email"[^>]*>/.exec(html)?.[0] ?? '';
    expect(contact).not.toBe('');
    expect(inlineStyle(contact)).toContain('overflow-wrap:anywhere');
  });

  it('the email input may shrink below its intrinsic width', () => {
    const input = /<input[^>]*id="email"[^>]*>/.exec(html)?.[0] ?? '';
    expect(inlineStyle(input)).toContain('min-width:0');
  });

  it('globals.css stays layout-only: no colour literals (tokens-only styling)', () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
  });
});
