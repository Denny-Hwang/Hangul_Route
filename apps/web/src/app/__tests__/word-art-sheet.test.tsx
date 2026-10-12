import { WORD_ART } from '@hangul-route/design-system/word-art';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { VOCAB_CATALOG } from '../../data/vocab-catalog';
import { BUDGET_GZIP, BUDGET_RAW, measureWordArtSource } from '../../lib/word-art-sheet/budget';
import WordArtPreviewPage, { metadata } from '../(console)/design-preview/word-art/page';
import DesignPreviewPage from '../(console)/design-preview/page';

/**
 * F-VOC-002 §3.10 and §5: the WordArt contact sheet, server-rendered the way
 * `next build` writes it. The browser smoke is e2e/word-art-sheet.spec.ts.
 */
const count = (html: string, needle: string): number => html.split(needle).length - 1;
const stat = (html: string, id: string): string => new RegExp(`data-testid="${id}"[^>]*>([^<]*)<`).exec(html)?.[1] ?? '';

describe('/design-preview/word-art', () => {
  const html = renderToStaticMarkup(<WordArtPreviewPage />);
  const keys = Object.keys(WORD_ART);
  const entries = Object.values(WORD_ART);

  it('renders one card per registry key, with its key, shape count and byte size', () => {
    expect(count(html, 'data-testid="word-art-card"')).toBe(keys.length);
    for (const key of keys) {
      expect(html).toContain(`data-key="${key}"`);
      const { glyph } = WORD_ART[key]!;
      expect(html).toContain(`data-shapes="${glyph.length}" data-bytes="${JSON.stringify(glyph).length}"`);
    }
  });

  it('draws each glyph once as a colour and a silhouette symbol, and at 160, four sizes on three backgrounds, silhouette and three simulations', () => {
    expect(count(html, '<symbol id="wa-')).toBe(keys.length * 2);
    for (const key of keys) {
      expect(count(html, `href="#wa-${key}"`)).toBe(1 + 12 + 3);
      expect(count(html, `href="#wa-${key}-mono"`)).toBe(1);
    }
    for (const size of [160, 96, 64, 48, 32]) expect(html).toContain(`width="${size}" height="${size}"`);
    expect(count(html, 'data-bg="paper"')).toBe(keys.length);
    expect(count(html, 'data-bg="sunken"')).toBe(keys.length);
    expect(count(html, 'data-bg="canvas"')).toBe(keys.length);
  });

  it('defines the three colour-vision filters once and uses each on every card', () => {
    for (const v of ['protanopia', 'deuteranopia', 'tritanopia']) {
      expect(count(html, `<filter id="word-art-${v}"`)).toBe(1);
      expect(count(html, `filter="url(#word-art-${v})"`)).toBe(keys.length);
    }
    expect(count(html, '<feColorMatrix')).toBe(3);
  });

  it('shows the Korean word, romanization and gloss from the web catalog for a glyph that pictures one', () => {
    const apple = VOCAB_CATALOG.find((e) => e.visual === 'word:food-apple')!;
    expect(html).toContain(`<span lang="ko">${apple.ko}</span>`);
    expect(html).toContain(apple.romanization);
    expect(html).toContain(apple.en);
    expect(html).toContain('drawn inside a colour swatch');
  });

  it('marks every glyph with its review state and counts them in the totals line (behaviour 8)', () => {
    const by = (s: string): number => entries.filter((e) => e.meta.status === s).length;
    expect(stat(html, 'count-glyphs')).toBe(String(keys.length));
    expect(stat(html, 'count-draft')).toBe(String(by('draft')));
    expect(stat(html, 'count-review')).toBe(String(by('review')));
    expect(stat(html, 'count-approved')).toBe(String(by('approved')));
    expect(count(html, 'data-status="review"')).toBe(by('review'));
    expect(count(html, '>needs review</span>')).toBe(by('review'));
  });

  it('measures the source against the budget (W7)', () => {
    const size = measureWordArtSource();
    expect(stat(html, 'budget-raw')).toBe(`${size.raw} / ${BUDGET_RAW} B`);
    expect(stat(html, 'budget-gzip')).toBe(`${size.gzip} / ${BUDGET_GZIP} B`);
  });

  it('offers a filter link per family with glyphs, and one for all', () => {
    expect(html).toContain('href="/design-preview/word-art"');
    for (const family of new Set(entries.map((e) => e.meta.family))) expect(html).toContain(`href="/design-preview/word-art?topic=${family}"`);
  });

  it('prints the review checklist, links back to the design preview, has no text, image or emoji in art, and is not indexed', () => {
    expect(html).toContain('Review checklist');
    expect(html).toContain('href="/design-preview"');
    expect(html).not.toMatch(/<image|<text|<img/);
    expect(html).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});

describe('/design-preview links the WordArt contact sheet', () => {
  it('has a link to /design-preview/word-art', () => {
    expect(renderToStaticMarkup(<DesignPreviewPage />)).toContain('href="/design-preview/word-art"');
  });
});
