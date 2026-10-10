import { ProfileSchema } from '@hangul-route/content-schema';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import PrivacyPage from '../privacy/page';
import TermsPage from '../terms/page';

/**
 * Privacy & terms audience copy (audit UF-09, copy only — pending legal review).
 *
 * The product is for anyone learning Hangul; many learners are children, so
 * every child-privacy protection stays. These tests pin both halves: the
 * kids-only framing is gone, and the protections are still on the page.
 */
function textOf(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ');
}

const privacy = textOf(renderToStaticMarkup(<PrivacyPage />));
const terms = textOf(renderToStaticMarkup(<TermsPage />));

describe('privacy policy', () => {
  it('describes an all-ages audience where many learners are children', () => {
    expect(privacy).toMatch(/anyone learning Hangul/);
    expect(privacy).toMatch(/many of our learners are children/i);
    expect(privacy).not.toMatch(/built for children ages/i);
    expect(privacy).not.toMatch(/\b5\s*[–-]\s*11\b/);
  });

  it('lists the age groups the app actually stores', () => {
    const groups = ProfileSchema.shape.ageGroup.options.map((g) => g.replace('-', '–'));
    expect(privacy).toContain(`age group (${groups.join(' / ')})`);
    expect(privacy).not.toContain('5–7 / 8–11');
  });

  it('says the account holder creates the account — not "an adult" (owner decision 2026-10-10)', () => {
    expect(privacy).toContain(
      'Accounts are created and managed by the account holder (a parent or legal guardian when the learner is a child).',
    );
    expect(privacy).not.toMatch(/created and managed by an adult/i);
    // A grown-up still sets a child's account up behind the parent-gate.
    expect(privacy).toMatch(/When the learner is a child, the child uses the app, but a grown-up sets it up/);
  });

  it('keeps every child-privacy protection', () => {
    expect(privacy).toContain("Children's privacy (COPPA / GDPR-K)");
    expect(privacy).toContain('verifiable parental consent');
    expect(privacy).toContain('parent-gate');
    expect(privacy).toContain('No advertising identifiers');
    expect(privacy).toMatch(/A parent can review, export, correct, or delete/);
  });

  it('is still marked as a draft pending legal review', () => {
    expect(privacy).toContain('pending review by qualified legal counsel');
  });
});

describe('terms of service', () => {
  it('no longer says the app is for children only', () => {
    expect(terms).not.toMatch(/because the app is for children/i);
    expect(terms).toMatch(/many learners are children/i);
  });

  it('keeps the guardian acceptance and supervision for child learners', () => {
    expect(terms).toMatch(/when the learner is a child, the parent or legal guardian who sets up the account accepts these terms/i);
    expect(terms).toContain('A child may use the app under that supervision.');
    expect(terms).toContain('parent-gate');
  });

  it('says the account holder creates and supervises the account — not "an adult" (owner decision 2026-10-10)', () => {
    expect(terms).toContain(
      'The account holder (a parent or legal guardian when the learner is a child) creates and supervises the account',
    );
    expect(terms).not.toMatch(/an adult creates the account/i);
  });

  it('is still marked as a draft pending legal review', () => {
    expect(terms).toContain('pending review by qualified legal counsel');
  });
});
