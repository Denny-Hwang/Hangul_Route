import { describe, expect, it } from 'vitest';
import { SITE_TAGLINE, SITE_TITLE, landingCopy, siteMetadata } from '../landing-copy';

/** Owner decision 2026-10-09: the product is for anyone learning Hangul, any age. */
const AGE_RANGE_RE = /\b\d{1,2}\s*[–-]\s*\d{1,2}\b/;

function text(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value ?? '');
}

describe('siteMetadata (UF-01)', () => {
  it('uses the all-ages title everywhere a title is shown', () => {
    expect(SITE_TITLE).toBe('Hangul Route — Learn Hangul from zero with Hoya');
    expect(siteMetadata.title).toBe(SITE_TITLE);
    expect(siteMetadata.openGraph?.title).toBe(SITE_TITLE);
    expect(siteMetadata.twitter?.title).toBe(SITE_TITLE);
  });

  it('describes the audience as anyone, any age — no kids-only framing or age range', () => {
    const fields = [
      siteMetadata.description,
      siteMetadata.openGraph?.description,
      siteMetadata.twitter?.description,
    ].map(text);
    for (const field of fields) {
      expect(field).not.toMatch(/\bkids?\b/i);
      expect(field).not.toMatch(/\bchildren\b/i);
      expect(field).not.toMatch(AGE_RANGE_RE);
    }
    expect(text(siteMetadata.description)).toMatch(/any age/i);
  });

  it('keeps "kids" out of the keywords and leads with learning Hangul', () => {
    const keywords = siteMetadata.keywords;
    expect(Array.isArray(keywords)).toBe(true);
    const list = keywords as string[];
    expect(list.length).toBeGreaterThan(0);
    for (const keyword of list) {
      expect(keyword).not.toMatch(/kid/i);
    }
    expect(list[0]).toBe('learn Hangul');
  });

  it('does not hard-code a culture-card count that can drift from the content', () => {
    const fields = [
      siteMetadata.description,
      siteMetadata.openGraph?.description,
      siteMetadata.twitter?.description,
    ].map(text);
    for (const field of fields) {
      expect(field).not.toMatch(/\b\d+\s+(collectable\s+)?(culture|heritage)\s+cards\b/i);
      expect(field).not.toMatch(/\b\d+\s+collectable\b/i);
    }
  });
});

describe('landing copy (UF-02)', () => {
  it('tagline speaks to any age', () => {
    expect(SITE_TAGLINE).toBe('Learn Hangul from zero, at any age.');
  });
});

describe('cost copy says only what is true today (owner decision 2026-10-10)', () => {
  // Payments are not live and Stages 2-7 are not built, so the landing quotes
  // no price and sells no stage. (The rendered page is scanned for prices in
  // src/app/__tests__/landing-no-prices.test.tsx.)
  it('meta descriptions say Stage 1 is free — not "the first 12 cards"', () => {
    for (const field of [siteMetadata.description, siteMetadata.openGraph?.description].map(text)) {
      expect(field).toMatch(/Stage 1 is free/);
      expect(field).not.toMatch(/12 cards/i);
    }
  });

  it('the page description also says more stages are coming (it names a 7-stage journey)', () => {
    expect(text(siteMetadata.description)).toMatch(/more stages are coming/i);
  });
});

describe('landingCopy(locale)', () => {
  it('labels the Open Graph locale from the locale table (en_US for English, unchanged)', () => {
    expect(siteMetadata.openGraph).toMatchObject({ locale: 'en_US' });
    expect(landingCopy('es').metadata.openGraph).toMatchObject({ locale: 'es_419' });
    expect(landingCopy('ko').metadata.openGraph).toMatchObject({ locale: 'ko_KR' });
  });
});
