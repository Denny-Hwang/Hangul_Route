import { getMessages } from '@hangul-route/i18n';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HeritageCardsPreview } from '../../components/landing/HeritageCardsPreview';
import { MiniGamesGallery } from '../../components/landing/MiniGamesGallery';
import { minigameCatalog, siteGames } from '../../data/minigame-catalog';
import { stage1Cards } from '../../data/stage1-cards';

/**
 * The old landing's mini-games gallery and Heritage Card grid, as a full section (the old landing) and `embedded` in a
 * fold of a layered-site page (F-SITE-002 §3.4, §3.11): embedded, the section's h2 and the fold's summary name the
 * list, so it brings no heading, eyebrow, body line or forward-looking line of its own, and its text is in rem.
 */
const t = getMessages('en').landing;
const decode = (s: string): string =>
  s.replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

describe('MiniGamesGallery', () => {
  it('counts shipped and beta games from the list it shows (a custom list without beta games)', () => {
    const full = decode(renderToStaticMarkup(<MiniGamesGallery locale="en" />));
    const fullShipped = minigameCatalog.filter((g) => g.status === 'shipped').length;
    expect(full).toContain(t.games.eyebrow(fullShipped, minigameCatalog.length - fullShipped));

    const shown = siteGames.filter((g) => g.status === 'shipped');
    const custom = decode(renderToStaticMarkup(<MiniGamesGallery locale="en" games={shown} />));
    expect(custom).toContain(t.games.eyebrow(shown.length, 0));
    expect(custom).not.toContain(t.games.beta);
    expect(custom.match(/role="listitem"/g)).toHaveLength(shown.length);
  });

  it('embedded: the list alone, game titles as h3, text in rem, a column never wider than its box', () => {
    const html = decode(renderToStaticMarkup(<MiniGamesGallery locale="en" games={siteGames} embedded />));
    expect(html).not.toMatch(/<h2\b|<section\b|<header\b/);
    expect(html).not.toContain(t.games.title);
    expect(html).not.toContain(t.games.body);
    expect(html).not.toMatch(/margin-top:64px/);
    expect(html).toMatch(/^<div role="list" aria-label="[^"]+"/);
    expect(html.match(/<h3\b/g)).toHaveLength(siteGames.length);
    expect(html).not.toMatch(/font-size:\d+px/);
    expect(html).toContain('minmax(min(100%, 260px), 1fr)');
  });

  it('the full section keeps its heading and its px text (the old landing renders as before)', () => {
    const html = renderToStaticMarkup(<MiniGamesGallery locale="en" />);
    expect(html).toMatch(/<section aria-labelledby="games-heading"/);
    expect(html).toMatch(/<h2 id="games-heading"/);
  });
});

describe('HeritageCardsPreview', () => {
  it('every card shows its English gloss (card.en), never only its romanization twice', () => {
    for (const embedded of [false, true]) {
      const html = decode(renderToStaticMarkup(<HeritageCardsPreview locale="en" embedded={embedded} />));
      for (const card of stage1Cards) expect(html).toContain(`>${card.en}<`);
    }
  });

  it('embedded: the list alone, no heading, body or Stage 2 line, text in rem, a column never wider than its box', () => {
    const html = decode(renderToStaticMarkup(<HeritageCardsPreview locale="en" embedded />));
    expect(html).not.toMatch(/<h2\b|<section\b|<header id|margin-top:64px/);
    expect(html).not.toContain(t.cards.more);
    expect(html).not.toContain(t.cards.eyebrow);
    expect(html).toMatch(/^<div role="list" aria-label="[^"]+"/);
    expect(html.match(/role="listitem"/g)).toHaveLength(stage1Cards.length);
    expect(html).not.toMatch(/font-size:\d+px/);
    expect(html).toContain('minmax(min(100%, 220px), 1fr)');
  });

  it('the full section keeps its heading and the Stage 2 line (the old landing)', () => {
    const html = decode(renderToStaticMarkup(<HeritageCardsPreview locale="en" />));
    expect(html).toMatch(/<h2 id="cards-heading"/);
    expect(html).toContain(t.cards.more);
  });
});
