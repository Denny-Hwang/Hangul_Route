import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { siteMetadata } from '../../data/landing-copy';
import HomePage from '../page';

/**
 * The landing promises only what the product does today (owner decisions
 * 2026-10-10). This scans what a visitor (and a search engine) actually sees.
 *
 * 1. No price, and nothing sold that is not built. Payments are not live and
 *    Stages 2–7 do not exist yet, so the page may say only "Stage 1 is free.
 *    More stages and classroom plans are coming."
 * 2. No adult sign-up flow. The learner app's first-run screen still asks
 *    "How old are you?" with kid age bands (audit UF-05 / UF-06, PR-23), so the
 *    page must not tell an adult to "make your own profile".
 */
const COMMERCIAL_CLAIMS: ReadonlyArray<{ name: string; re: RegExp }> = [
  { name: 'a dollar amount', re: /\$\s?\d/ },
  { name: 'a price per year or month', re: /\bper\s+(year|month)\b|\/\s?(yr|year|mo|month)\b/i },
  { name: '"every stage"', re: /\bevery\s+stage\b/i },
  { name: '"all stages"', re: /\ball\s+stages\b/i },
  { name: '"lifetime"', re: /\blifetime\b/i },
  { name: '"Group License"', re: /\bgroup\s+license\b/i },
  { name: '"one purchase" / "pay once"', re: /\bone purchase\b|\bpay(s)?\s+once\b/i },
  { name: 'a subscription', re: /\bsubscription\b/i },
  { name: 'the retired "12 cards" / card-pack offer', re: /\b12\s+cards\b|\bcard packs?\b/i },
];

function textOf(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ');
}

const pageText = textOf(renderToStaticMarkup(<HomePage />));
const metaText = JSON.stringify(siteMetadata);

describe('landing page text — no prices, nothing sold that is not built', () => {
  it('renders the cost lines (so this scan is looking at the right page)', () => {
    expect(pageText).toContain('Stage 1 is free. More stages and classroom plans are coming.');
    expect(pageText).toMatch(/Pricing\s+Stage 1\s+—\s+free/);
  });

  for (const { name, re } of COMMERCIAL_CLAIMS) {
    it(`the page has no ${name}`, () => {
      expect(pageText).not.toMatch(re);
    });

    it(`the site metadata has no ${name}`, () => {
      expect(metaText).not.toMatch(re);
    });
  }
});

describe('landing page text — promises no adult flow that does not exist yet', () => {
  it('the parents blurb does not tell an adult to make their own profile', () => {
    expect(pageText).not.toMatch(/your own profile/i);
  });

  it('it still tells an adult learner the same quests are theirs to play', () => {
    expect(pageText).toContain('Learning Korean yourself? Play the same quests.');
  });
});
