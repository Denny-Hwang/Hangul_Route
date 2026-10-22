import { OVERLAYS } from '@hangul-route/content-schema/overlays';
import { getMessages } from '@hangul-route/i18n';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HeritageCardsPreview } from '../../components/landing/HeritageCardsPreview';
import { MiniGamesGallery } from '../../components/landing/MiniGamesGallery';
import { siteGames } from '../../data/minigame-catalog';
import { stage1Cards, stage1CardsIn } from '../../data/stage1-cards';

/**
 * The mini-games list and the Heritage Card grid inside the `/learners` folds (F-SITE-002 §3.4, §3.11): the section's
 * h2 and the fold's summary name each list, so it brings no heading, eyebrow, body line or forward-looking line of its
 * own, and its text is in rem. Every word is in the UI language (site-learners-l10n).
 */
const t = getMessages('en').landing;
const decode = (s: string): string =>
  s.replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

describe('MiniGamesGallery', () => {
  it('the list alone, game titles as h3, text in rem, a column never wider than its box', () => {
    const html = decode(renderToStaticMarkup(<MiniGamesGallery locale="en" games={siteGames} />));
    expect(html).not.toMatch(/<h2\b|<section\b|<header\b/);
    expect(html).not.toMatch(/margin-top:64px/);
    expect(html).toMatch(/^<div role="list" aria-label="[^"]+"/);
    expect(html.match(/<h3\b/g)).toHaveLength(siteGames.length);
    expect(html).not.toMatch(/font-size:\d+px/);
    expect(html).toContain('minmax(min(100%, 260px), 1fr)');
    expect(html).not.toContain(t.games.beta);
  });

  it.each(['en', 'es', 'ko'] as const)('%s: each title and blurb comes from landing.games.items', (locale) => {
    const items = getMessages(locale).landing.games.items;
    const html = decode(renderToStaticMarkup(<MiniGamesGallery locale={locale} />));
    expect(html.match(/role="listitem"/g)).toHaveLength(siteGames.length);
    for (const game of siteGames) {
      expect(html).toContain(`>${items[game.kind].title}</h3>`);
      expect(html).toContain(`>${items[game.kind].blurb}</p>`);
    }
  });
});

describe('HeritageCardsPreview', () => {
  it('every English card shows its English gloss (card.en), never only its romanization twice', () => {
    const html = decode(renderToStaticMarkup(<HeritageCardsPreview locale="en" cards={stage1CardsIn('en', OVERLAYS)} />));
    for (const card of stage1Cards) {
      expect(html).toContain(`>${card.en}<`);
      expect(html).toContain(`aria-label="${t.cards.cardLabel(card.romanization, card.en)}"`);
    }
  });

  it('the list alone, no heading, body or Stage 2 line, text in rem, a column never wider than its box', () => {
    const html = decode(renderToStaticMarkup(<HeritageCardsPreview locale="en" cards={stage1CardsIn('en', OVERLAYS)} />));
    expect(html).not.toMatch(/<h2\b|<section\b|<header id|margin-top:64px/);
    expect(html).toMatch(/^<div role="list" aria-label="[^"]+"/);
    expect(html.match(/role="listitem"/g)).toHaveLength(stage1Cards.length);
    expect(html).not.toMatch(/font-size:\d+px/);
    expect(html).toContain('minmax(min(100%, 220px), 1fr)');
  });

  it('es: the overlay gloss and blurb, its card label in Spanish; a word whose title only repeats it is read as Korean', () => {
    const cards = stage1CardsIn('es', OVERLAYS);
    const es = getMessages('es').landing.cards;
    const html = decode(renderToStaticMarkup(<HeritageCardsPreview locale="es" cards={cards} />));
    for (const card of cards) {
      expect(html).toContain(`>${card.blurb}<`);
      if (card.gloss === null) {
        expect(html).toMatch(new RegExp(`<span lang="ko"[^>]*>${card.ko}</span>`));
      } else {
        expect(html).toContain(`>${card.gloss}<`);
        expect(html).toContain(`aria-label="${es.cardLabel(card.romanization, card.gloss)}"`);
      }
    }
  });
});
