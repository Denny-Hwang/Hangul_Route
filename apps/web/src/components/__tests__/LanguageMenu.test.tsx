import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LanguageMenu, bindLanguageMenu, type LanguageMenuItem, type MenuElement } from '../landing/LanguageMenu';

/**
 * [SN] The header's language control (AMENDMENTS-SITE-NEWUSER §3.2, SN-D1). The web tests run in node with no DOM,
 * so the close handlers are driven through `bindLanguageMenu` with plain event targets, and the no-JavaScript
 * behaviour is the static markup: a native `<details>`, which opens and closes by itself.
 */
const ITEMS: readonly LanguageMenuItem[] = [
  { href: '/parents', endonym: 'English', lang: 'en', current: true },
  { href: '/es/parents', endonym: 'Español', lang: 'es', current: false },
  { href: '/ko/parents', endonym: '한국어', lang: 'ko', current: false },
];

/** A stand-in `<details>`: `inside` is the set of nodes it contains. */
function fakeMenu(open: boolean): MenuElement & { focused: number; inside: Set<unknown> } {
  const menu = {
    open,
    focused: 0,
    inside: new Set<unknown>(),
    contains(node: unknown): boolean {
      return menu.inside.has(node);
    },
    querySelector(): { focus(): void } {
      return { focus: () => void (menu.focused += 1) };
    },
  };
  return menu;
}

const key = (name: string): Event => Object.assign(new Event('keydown'), { key: name });
const pointerOn = (target: unknown): Event => {
  const event = new Event('pointerdown');
  Object.defineProperty(event, 'target', { value: target });
  return event;
};

describe('bindLanguageMenu (with JavaScript)', () => {
  it('Escape closes an open menu and returns focus to the summary', () => {
    const doc = new EventTarget();
    const menu = fakeMenu(true);
    bindLanguageMenu(menu, doc);
    doc.dispatchEvent(key('Escape'));
    expect(menu.open).toBe(false);
    expect(menu.focused).toBe(1);
  });

  it('a pointer down outside closes it and focuses the summary; one inside leaves it open', () => {
    const doc = new EventTarget();
    const menu = fakeMenu(true);
    const link = {};
    menu.inside.add(link);
    bindLanguageMenu(menu, doc);
    doc.dispatchEvent(pointerOn(link));
    expect(menu.open).toBe(true);
    doc.dispatchEvent(pointerOn({}));
    expect(menu.open).toBe(false);
    expect(menu.focused).toBe(1);
  });

  it('other keys, and anything while closed, change nothing (focus is not stolen)', () => {
    const doc = new EventTarget();
    const menu = fakeMenu(true);
    bindLanguageMenu(menu, doc);
    doc.dispatchEvent(key('Tab'));
    expect(menu.open).toBe(true);
    menu.open = false;
    doc.dispatchEvent(key('Escape'));
    doc.dispatchEvent(pointerOn({}));
    expect(menu.focused).toBe(0);
  });

  it('the cleanup removes both listeners', () => {
    const doc = new EventTarget();
    const menu = fakeMenu(true);
    bindLanguageMenu(menu, doc)();
    doc.dispatchEvent(key('Escape'));
    doc.dispatchEvent(pointerOn({}));
    expect(menu.open).toBe(true);
  });
});

describe('LanguageMenu markup (without JavaScript)', () => {
  const html = renderToStaticMarkup(<LanguageMenu label="Language" items={ITEMS} />);

  it('is one closed native <details> with a <summary>: it opens and closes with no script', () => {
    expect(html.match(/<details\b/g)).toHaveLength(1);
    expect(html).not.toMatch(/<details[^>]*\sopen/);
    expect(html).toMatch(/^<details[^>]*><summary\b/);
  });

  it('the summary holds a decorative globe, the hidden word and the current endonym with lang', () => {
    const summary = /<summary[^>]*>([\s\S]*?)<\/summary>/.exec(html)?.[1] ?? '';
    expect(summary).toMatch(/<svg[^>]*aria-hidden="true"/);
    expect(summary).toMatch(/<span style="[^"]*position:absolute[^"]*">Language<\/span>/);
    expect(summary).toContain('<span lang="en">English</span>');
  });

  it('one link per locale, each with lang and hrefLang, the current one aria-current and checked', () => {
    const links = [...html.matchAll(/<a ([^>]*)>([\s\S]*?)<\/a>/g)];
    expect(links.map((m) => /href="([^"]*)"/.exec(m[1] ?? '')?.[1])).toEqual(['/parents', '/es/parents', '/ko/parents']);
    for (const [i, m] of links.entries()) {
      expect(m[1]).toContain(`hrefLang="${ITEMS[i]?.lang}"`);
      expect(m[1]).toContain(`lang="${ITEMS[i]?.lang}"`);
      expect(m[1]).toContain('min-height:64px');
    }
    expect(links[0]?.[1]).toContain('aria-current="page"');
    expect(links[0]?.[2]).toMatch(/<svg/);
    expect(links[1]?.[1]).not.toContain('aria-current');
    expect(links[1]?.[2]).not.toMatch(/<svg/);
  });

  it('is not rendered with one locale shown, or with no current one', () => {
    expect(renderToStaticMarkup(<LanguageMenu label="Language" items={ITEMS.slice(0, 1)} />)).toBe('');
    expect(renderToStaticMarkup(<LanguageMenu label="Language" items={ITEMS.map((item) => ({ ...item, current: false }))} />)).toBe('');
  });

  it('push takes the phone auto margin (no Start pill before it)', () => {
    expect(renderToStaticMarkup(<LanguageMenu label="Language" items={ITEMS} push />)).toMatch(/^<details class="hr-site-lang hr-site-lang-push"/);
    expect(html).toMatch(/^<details class="hr-site-lang"/);
  });

  it('the client file imports no dictionary (endonyms and paths arrive as values)', () => {
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'landing', 'LanguageMenu.tsx'), 'utf8');
    expect(source).not.toMatch(/from '@hangul-route\/i18n'/);
    expect(source).toMatch(/^'use client';/);
  });
});
