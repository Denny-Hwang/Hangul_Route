import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { siteMetadata } from '../../data/landing-copy';
import HomePage from '../page';

/**
 * Owner decision 2026-10-10: the landing quotes no price and sells nothing
 * that is not built. Payments are not live and Stages 2–7 do not exist yet,
 * so the page may say only "Stage 1 is free. More stages and classroom plans
 * are coming." This scans what a visitor (and a search engine) actually sees.
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
