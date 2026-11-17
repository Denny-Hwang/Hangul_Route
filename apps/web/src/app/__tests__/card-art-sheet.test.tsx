import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HeritageCardArt } from '@hangul-route/design-system/components/HeritageCardArt';
import { supportedCardIds } from '@hangul-route/design-system/heritage-card-ids';
import { albumLegendArtIds, upperCellCardArtIds } from '@hangul-route/design-system/upper-card-ids';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CARD_ART_SHEET, CARD_ART_SIZES } from '../../data/card-art-sheet';
import CardsPreviewPage, { metadata } from '../(console)/design-preview/cards/page';
import DesignPreviewPage from '../(console)/design-preview/page';

/**
 * AMENDMENTS-PICTURES-2026-11 row PX-0: /design-preview/cards is the contact
 * sheet of the REAL card art (HeritageCardArt and UpperCellCardArt through the
 * react-native-svg shim), all 60 cards at 200, 64 and 54 px with id and title,
 * server-rendered the way `next build` writes it.
 */
const count = (html: string, needle: string): number => html.split(needle).length - 1;
const cards = CARD_ART_SHEET.flatMap((g) => g.cards.map((c) => ({ ...c, art: g.art })));
const APP_CARDS = readFileSync(join(__dirname, '..', '..', '..', '..', 'mobile', 'src', 'content', 'heritage-cards.ts'), 'utf8');

describe('the card-art sheet data', () => {
  it('lists exactly the cards the design system draws: 30 Stage 1, 25 album, 5 legendary, each once', () => {
    expect(cards).toHaveLength(60);
    expect(new Set(cards.map((c) => c.id)).size).toBe(60);
    expect(cards.filter((c) => c.art === 'stage1').map((c) => c.id).sort()).toEqual([...supportedCardIds].sort());
    expect(cards.filter((c) => c.art === 'upper').map((c) => c.id)).toEqual([...upperCellCardArtIds, ...albumLegendArtIds]);
  });

  it("gives every card the app's English title", () => {
    for (const c of cards) {
      const id = c.id.slice('card:'.length);
      expect(APP_CARDS, `${c.id} ${c.title}`).toContain(`'${id}', '${c.title.replace(/'/g, "\\'")}'`);
    }
  });

  it('draws at the full size and the two question sizes', () => {
    expect([...CARD_ART_SIZES]).toEqual([200, 64, 54]);
  });
});

describe('/design-preview/cards', () => {
  const html = renderToStaticMarkup(<CardsPreviewPage />);
  const cellOf = (id: string): string => {
    const at = html.indexOf(`data-card="${id}"`);
    expect(at, id).toBeGreaterThan(-1);
    return html.slice(at, html.indexOf('</article>', at));
  };

  it('renders one cell per card, with its id and title', () => {
    expect(count(html, 'data-testid="card-art"')).toBe(60);
    for (const c of cards) {
      const cell = cellOf(c.id);
      expect(cell).toContain(`>${c.id}</strong>`);
      expect(cell).toContain(c.title.replace(/'/g, '&#x27;'));
    }
  });

  it('draws the real art of every card at 200, 64 and 54 px, each card its own drawing and none an empty svg', () => {
    const drawings = new Set<string>();
    const unknown = /<svg[^>]*>([\s\S]*?)<\/svg>/.exec(renderToStaticMarkup(<HeritageCardArt cardId="card:none" size={200} accessibilityLabel="x" />))?.[1] ?? '';
    for (const c of cards) {
      const cell = cellOf(c.id);
      expect(count(cell, 'viewBox="0 0 200 200"'), c.id).toBe(3);
      for (const size of CARD_ART_SIZES) expect(count(cell, `<svg width="${size}" height="${size}" viewBox="0 0 200 200"`), `${c.id} at ${size}`).toBe(1);
      const full = /<svg width="200"[^>]*>([\s\S]*?)<\/svg>/.exec(cell)?.[1] ?? '';
      // a real drawing: several shapes, and never what the component paints for an id it does not know
      expect(count(full, '<path') + count(full, '<circle') + count(full, '<rect') + count(full, '<ellipse') + count(full, '<line') + count(full, '<polygon'), c.id).toBeGreaterThanOrEqual(3);
      expect(full, c.id).not.toBe(unknown);
      drawings.add(full);
    }
    expect(drawings.size).toBe(60);
  });

  it('names the full-size picture for assistive technology and hides the small repeats', () => {
    for (const c of cards.slice(0, 3)) {
      const cell = cellOf(c.id);
      expect(count(cell, 'role="img"')).toBe(3);
      expect(cell).toContain('aria-hidden="true"');
    }
  });

  it('keeps the Korean word of a Stage 1 card beside its romanization', () => {
    const cell = cellOf('card:kimchi');
    expect(cell).toContain('<span lang="ko">김치</span> <em>gimchi</em>');
  });

  it('counts the cards, prints the review checklist, links both ways and is not indexed', () => {
    expect(/data-testid="count-cards"[^>]*>([^<]*)</.exec(html)?.[1]).toBe('60');
    expect(/data-testid="count-stage1"[^>]*>([^<]*)</.exec(html)?.[1]).toBe('30');
    expect(/data-testid="count-upper"[^>]*>([^<]*)</.exec(html)?.[1]).toBe('30');
    expect(html).toContain('Review checklist');
    expect(html).toContain('href="/design-preview"');
    expect(html).toContain('href="/design-preview/word-art"');
    expect(html).not.toMatch(/<image|<img/);
    expect(html).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});

describe('/design-preview links the card-art sheet', () => {
  it('has a link to /design-preview/cards that says how many cards it shows', () => {
    const html = renderToStaticMarkup(<DesignPreviewPage />);
    expect(html).toContain('href="/design-preview/cards"');
    expect(html).toContain('All 60 heritage cards');
  });
});
