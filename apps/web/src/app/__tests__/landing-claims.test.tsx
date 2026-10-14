import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { siteMetadata } from '../../data/landing-copy';
import { SITE_CLAIMS } from '../../data/site-claims';
import { SITE_PAGES, siteMetadataFor } from '../../lib/site-metadata';
import AboutPage from '../(en)/about/page';
import LearnersPage from '../(en)/learners/page';
import HomePage from '../(en)/page';
import ParentsPage from '../(en)/parents/page';
import PrivacyPage from '../(en)/privacy/page';
import TeachersPage from '../(en)/teachers/page';
import TermsPage from '../(en)/terms/page';
import LicensesPage from '../(en)/licenses/page';
import { SITE_PRICE_PATTERNS } from './site-price-patterns';

/**
 * The site promises only what the product does today (owner decisions 2026-10-10; F-SITE-002 §3.9, §3.12). This
 * scans what a visitor (and a search engine) actually sees on every site page and in their metadata.
 *
 * 1. No price, and nothing sold that is not built: no amount, no term, no lifetime or one-time wording. The home's
 *    cost line is "Stage 1 is free." then the paid line the `paidPlans` claim picks.
 * 2. No adult sign-up flow that does not exist: no page tells an adult to "make your own profile"; the parents page
 *    tells a grown-up the same quests are theirs to play.
 *
 * The legal pages are drafts that describe store billing (S-7 corrects the payment facts), and the open-source notices
 * quote license texts as written, so they are scanned for amounts only.
 */
const COMMERCIAL_CLAIMS: ReadonlyArray<{ name: string; re: RegExp }> = [
  ...SITE_PRICE_PATTERNS,
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

const render = (Page: () => JSX.Element): string => textOf(renderToStaticMarkup(<Page />));
const SITE: ReadonlyArray<readonly [string, string]> = [
  ['/', render(HomePage)],
  ['/learners', render(LearnersPage)],
  ['/parents', render(ParentsPage)],
  ['/teachers', render(TeachersPage)],
  ['/about', render(AboutPage)],
];
const LEGAL: ReadonlyArray<readonly [string, string]> = [
  ['/privacy', render(PrivacyPage)],
  ['/terms', render(TermsPage)],
  // The open-source notices quote third-party license texts as written (owner decision 2026-10-14).
  ['/licenses', render(LicensesPage)],
];
const metaText = JSON.stringify([siteMetadata, ...SITE_PAGES.map((page) => siteMetadataFor('en', page))]);
const home = SITE[0]?.[1] ?? '';

describe('site text — no prices, nothing sold that is not built', () => {
  it('scans every site page', () => {
    expect([...SITE, ...LEGAL].map(([path]) => path).sort()).toEqual([...SITE_PAGES].sort());
  });

  it('the home keeps the pinned cost sentence', () => {
    expect(home).toContain('Stage 1 is free. More stages are coming, with plans for families and classes.');
  });

  for (const { name, re } of COMMERCIAL_CLAIMS) {
    for (const [path, text] of SITE) {
      it(`${path} has no ${name}`, () => {
        expect(text).not.toMatch(re);
      });
    }

    it(`the site metadata has no ${name}`, () => {
      expect(metaText).not.toMatch(re);
    });
  }

  for (const [path, text] of LEGAL) {
    it(`${path} names no amount`, () => {
      expect(text).not.toMatch(/\$\s?\d/);
    });
  }
});

describe('site text — promises no adult flow that does not exist yet', () => {
  for (const [path, text] of SITE) {
    it(`${path} does not tell an adult to make their own profile`, () => {
      expect(text).not.toMatch(/your own profile/i);
    });
  }

  it('/parents tells a grown-up the same quests are theirs to play', () => {
    expect(SITE.find(([path]) => path === '/parents')?.[1]).toContain('Learning Korean yourself? Play the same quests.');
  });
});

describe('metadata truth pass (F-SITE-002 §3.12)', () => {
  it('no typed stage, theme or game counts, and no unbuilt journey in the metadata', () => {
    expect(metaText).not.toMatch(/\b\d+\s+(stages|culture themes|themes|mini-games)\b/i);
    expect(metaText).not.toMatch(/Heritage Journey/);
  });

  it('no compliance claim while the legal documents are drafts (OD-4)', () => {
    expect(metaText).not.toMatch(/COPPA/);
    for (const [path, text] of SITE) expect(text, path).not.toMatch(/COPPA/);
  });

  // The Spanish and Korean metadata get the same truth pass, so a later edit cannot put the counts or the unbuilt
  // journey back in a hidden locale before it ships.
  const localeMeta = (locale: 'es' | 'ko'): string => JSON.stringify(SITE_PAGES.map((page) => siteMetadataFor(locale, page, true)));

  it('es: no typed stage, theme or game counts, no unbuilt journey, no compliance claim', () => {
    const text = localeMeta('es');
    expect(text).not.toMatch(/\d+\s*(etapas|temas|minijuegos)/i);
    expect(text).not.toMatch(/Recorrido del patrimonio/i);
    expect(text).not.toMatch(/COPPA/);
  });

  it('ko: no typed stage, theme or game counts, no unbuilt journey, no compliance claim', () => {
    const text = localeMeta('ko');
    // "1단계" is the name Stage 1 (the free plan), not a count; any other number of stages or games is a count.
    expect(text).not.toMatch(/(?<!\d)([2-9]|\d{2,})\s*단계|\d+\s*가지/);
    expect(text).not.toMatch(/문화 여정/);
    expect(text).not.toMatch(/COPPA/);
  });

  // The metadata's cost clause ("more stages are coming") is the `paidPlans: 'coming'` state. The PR that flips
  // `paidPlans` to 'inApp' must reword it in en, es and ko (section 3.9 hand-off), or this goes red.
  it.each([
    ['en', /more stages are coming/i],
    ['es', /vienen más etapas/i],
    ['ko', /더 많은 단계가 준비되고 있어요/],
  ] as const)('%s: the metadata cost clause follows the paidPlans claim', (locale, coming) => {
    const text = JSON.stringify(SITE_PAGES.map((page) => siteMetadataFor(locale, page, true)));
    expect(coming.test(text)).toBe(SITE_CLAIMS.paidPlans === 'coming');
  });
});
