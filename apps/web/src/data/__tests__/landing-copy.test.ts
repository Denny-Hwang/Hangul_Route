import { FAMILY_LIFETIME_LEARNERS, PLAN_PRICING } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import {
  SITE_TAGLINE,
  SITE_TITLE,
  audienceBadges,
  familyPlanBullet,
  howItWorks,
  landingFaqs,
  pricingFootnote,
  pricingLines,
  siteMetadata,
} from '../landing-copy';
import { stage1Cards } from '../stage1-cards';

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
    expect(SITE_TAGLINE).toBe('Learn Hangul from zero — at any age.');
  });

  it('audience badges are all-ages, with no age range', () => {
    expect(audienceBadges).toContain('All ages');
    for (const badge of audienceBadges) {
      expect(badge).not.toMatch(AGE_RANGE_RE);
      expect(badge).not.toMatch(/\bkids?\b/i);
    }
  });

  it('"How it works" card count comes from the Stage 1 card data', () => {
    const collect = howItWorks.find((step) => step.title === 'Collect culture');
    expect(collect?.body).toContain(`${stage1Cards.length} Heritage Cards`);
  });

  it('"How it works" never frames the learner as a child', () => {
    for (const step of howItWorks) {
      expect(step.body).not.toMatch(/\b(child|kid)(’s|'s)?\b/i);
    }
  });

  it('answers "who is it for?" with any age, and has an adult-beginner question', () => {
    const who = landingFaqs.find((faq) => /who is .* for\?/i.test(faq.q));
    expect(who?.a).toMatch(/any age/i);
    expect(who?.a).toMatch(/adults/i);
    const adult = landingFaqs.find((faq) => /adult beginner/i.test(faq.q));
    expect(adult?.a).toMatch(/no baby talk/i);
  });

  it('drops the old "How old is this for?" age-gate question', () => {
    for (const faq of landingFaqs) {
      expect(faq.q).not.toMatch(/how old/i);
      // "1–3 quests per sitting" is fine; an age range ("ages 5–11") is not.
      expect(faq.a).not.toMatch(/\bages?\s*\d/i);
    }
  });

  it('every FAQ has a question and an answer', () => {
    expect(landingFaqs.length).toBeGreaterThanOrEqual(5);
    for (const faq of landingFaqs) {
      expect(faq.q.trim().endsWith('?')).toBe(true);
      expect(faq.a.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('pricing copy matches the two-product model (app-map decision #30)', () => {
  const RETIRED = [/12 cards/i, /\$4\.99/, /\$29\b/, /\$19\b/, /card packs?/i, /subscription/i];

  it('meta descriptions say Stage 1 is free — not "the first 12 cards"', () => {
    for (const field of [siteMetadata.description, siteMetadata.openGraph?.description].map(text)) {
      expect(field).toMatch(/Stage 1 is free/);
      expect(field).not.toMatch(/12 cards/i);
    }
  });

  it('the cost FAQ quotes PLAN_PRICING and the family learner cap', () => {
    const cost = landingFaqs.find((faq) => /cost/i.test(faq.q));
    expect(cost?.a).toContain(PLAN_PRICING.family_lifetime.label);
    expect(cost?.a).toContain(PLAN_PRICING.group_license.label);
    expect(cost?.a).toContain(`up to ${FAMILY_LIFETIME_LEARNERS} learners`);
    expect(cost?.a).toMatch(/Stage 1 is free/);
    for (const re of RETIRED) expect(cost?.a).not.toMatch(re);
  });

  it('the pricing card lists Stage 1 free, Family Lifetime and the Group License', () => {
    expect(pricingLines.map((line) => line.name)).toEqual(['Stage 1', 'Family Lifetime', 'Classes & schools']);
    const joined = pricingLines.map((line) => `${line.name} ${line.detail}`).join(' | ');
    expect(joined).toContain(PLAN_PRICING.family_lifetime.label);
    expect(joined).toContain(PLAN_PRICING.group_license.label);
    expect(joined).toContain(`up to ${FAMILY_LIFETIME_LEARNERS} learners`);
    for (const re of RETIRED) expect(joined).not.toMatch(re);
  });

  it('the family bullet uses the real learner cap, not "three profiles"', () => {
    expect(familyPlanBullet.title).toContain(`up to ${FAMILY_LIFETIME_LEARNERS} learners`);
    expect(`${familyPlanBullet.title} ${familyPlanBullet.body}`).not.toMatch(/three|subscription/i);
  });

  it('the pricing footnote promises no family subscription and no ads', () => {
    expect(pricingFootnote).toMatch(/no subscription/i);
    expect(pricingFootnote).toMatch(/no third-party ads/i);
  });
});
