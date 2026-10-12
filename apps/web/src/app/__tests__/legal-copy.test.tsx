import { LEARNER_LEVELS } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PrivacyPage as PrivacyDocument } from '../../components/landing/PrivacyPage';
import { TermsPage as TermsDocument } from '../../components/landing/TermsPage';
import { CONTACT_EMAIL } from '../../data/contact';
import PrivacyPage from '../(en)/privacy/page';
import TermsPage from '../(en)/terms/page';

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

const privacyHtml = renderToStaticMarkup(<PrivacyPage />);
const termsHtml = renderToStaticMarkup(<TermsPage />);
const privacy = textOf(privacyHtml);
const terms = textOf(termsHtml);

/**
 * Each heading, paragraph (the English-authoritative notice is a `<p role="note">`), list item and the draft banner
 * (a `<div>` holding only text) on its own, so a marking in one block cannot cover another. The legal pages nest no
 * block inside these, so the lazy match ends at the block's own closing tag.
 */
function blocksOf(html: string): string[] {
  return [...html.matchAll(/<(h[1-6]|p|li|div)\b[^>]*>(.*?)<\/\1>/g)].map((m) => textOf(m[2] ?? '').trim()).filter((b) => b.length > 0);
}

/** A block split into sentences (a period followed by a space ends one; "app.hangulroute.com" does not). */
function sentencesOf(block: string): string[] {
  return block
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** The text between two section headings of a rendered document. */
function between(text: string, from: string, to: string): string {
  const start = text.indexOf(from);
  const end = text.indexOf(to, start);
  return start >= 0 && end > start ? text.slice(start + from.length, end) : '';
}

describe('privacy policy', () => {
  it('describes an all-ages audience where many learners are children', () => {
    expect(privacy).toMatch(/anyone learning Hangul/);
    expect(privacy).toMatch(/many of our learners are children/i);
    expect(privacy).not.toMatch(/built for children ages/i);
    expect(privacy).not.toMatch(/\b5\s*[–-]\s*11\b/);
  });

  it('describes the learner level as a self-chosen reading level, never an age', () => {
    const labels = LEARNER_LEVELS.map((l) => l.label);
    expect(labels.length).toBeGreaterThan(0);
    expect(privacy).toContain(`starting level the learner picks (${labels.join(' / ')})`);
    expect(privacy).toMatch(/It describes how much the learner reads, not how old they are/);
    expect(privacy).not.toMatch(/age group/i);
    expect(privacy).not.toMatch(/\b5\s*[–-]\s*7\b|\b8\s*[–-]\s*9\b|\b10\s*[–-]\s*11\b/);
    expect(terms).not.toMatch(/age group/i);
  });

  it('says the privacy page was last updated 2026-10-12 (the backup sentences, privacy-statements.test.tsx)', () => {
    expect(privacy).toContain('Effective October 12, 2026');
  });

  describe('launch-news email list', () => {
    it('has its own section', () => {
      expect(privacy).toContain('Launch-news email list');
    });

    it('says what is collected and what is not', () => {
      expect(privacy).toContain('the email address you type into the launch form');
      expect(privacy).toContain('the date you signed up');
      expect(privacy).toContain('which form on our site it came from');
      expect(privacy).toContain('your language setting');
      expect(privacy).toContain('which version of the consent text you saw');
      expect(privacy).toMatch(/We do not store your IP address or any browser details/);
    });

    it('says why, who stores it, and that it is never sold or shared', () => {
      expect(privacy).toMatch(/only to send you Hangul Route launch news/);
      expect(privacy).toMatch(/never sold or shared/i);
      expect(privacy).toMatch(/our own database on Cloudflare/);
    });

    it('says how long it is kept and how to be removed or erased', () => {
      expect(privacy).toMatch(/until the launch news ends or you ask us to remove it/);
      expect(privacy).toContain(`email ${CONTACT_EMAIL} from the address you signed up with`);
      expect(privacy).toMatch(/we will remove it/i);
    });

    it('says signing up is optional and the app does not need an email', () => {
      expect(privacy).toMatch(/Signing up is optional/);
      expect(privacy).toMatch(/does not depend on using the app/);
      expect(privacy).toMatch(/The app itself does not require an email address/);
    });

    it('promises no response time for removal requests in this section', () => {
      const section = /Launch-news email list(.*?)Where your data lives/.exec(privacy)?.[1] ?? '';
      expect(section.length).toBeGreaterThan(200);
      expect(section).not.toMatch(/within \d+|\bdays\b|\bhours\b|immediately/i);
    });
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

  describe('progress reports (F-REPORT-001 section 3.10, notice before collection)', () => {
    it('names every progress-report detail the app sends, and their limits', () => {
      expect(privacy).toContain('for the last 35 days, which days were practiced, with minutes, quests, cards and words for each day');
      expect(privacy).toContain('monthly totals for up to 24 months');
      expect(privacy).toContain('all-time totals since the first practice day');
      expect(privacy).toContain('the day each stage was finished');
      expect(privacy).toContain('the letters that became strong each day');
      expect(privacy).toContain('the next lesson and one lesson to revisit');
      expect(privacy).toContain("the device's time zone, so days are counted in the learner's local time");
    });

    it('says who can see progress and reports, and that a class sees history only from the day the learner joined', () => {
      expect(privacy).toContain("the learner's family caregivers");
      expect(privacy).toContain('who can also recover the full saved progress');
      expect(privacy).toContain('the teacher of a class the learner joined');
      expect(privacy).toContain("the owner and admins of that class's school");
      expect(privacy).toContain('only from the day the learner joined, and all-time totals without the first practice day');
    });

    it('puts both lines in "What we collect", progress first', () => {
      const section = /What we collect(.*?)What we never collect/.exec(privacy)?.[1] ?? '';
      const kept = section.indexOf('for the last 35 days');
      const who = section.indexOf("the learner's family caregivers");
      expect(kept).toBeGreaterThan(-1);
      expect(who).toBeGreaterThan(kept);
    });

    it('names no speaking data, recordings or per-question history among the report details', () => {
      const section = /What we collect(.*?)What we never collect/.exec(privacy)?.[1] ?? '';
      expect(section).not.toMatch(/speak|pronunciation|recording|response time/i);
    });
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

/**
 * F-SITE-002 S-7 (section 3.7, OD-13): factual payment corrections to the drafts. The web is paid through
 * Stripe after signing in at app.hangulroute.com; the iPhone and Android apps go through the App Store or
 * Google Play when they offer purchases (F-ENT-001 §3.5, F-IAP-002). Web plans renew yearly until cancelled
 * (AMENDMENTS-BILLING-FAMILY-YEARLY BY-D10). The store paragraphs stay, marked as applying to in-app purchases.
 * English is authoritative (L10), the draft banner stays, and the PR flags the wording for counsel.
 */
describe('payment facts (F-SITE-002 S-7)', () => {
  const CHANNELS =
    'On the web, a grown-up pays through Stripe after signing in at app.hangulroute.com. In the iPhone and Android apps, purchases (when offered) go through the App Store or Google Play.';
  const WEB_RENEWAL =
    'Plans bought on the web (the Family Plan and the Group License) renew every year until cancelled. Cancel any time in Billing, under Manage subscription; the plan stays active until the end of the year already paid.';
  const IN_APP = /^In-app purchases: /;
  const STORE = /App Store|Google Play/;
  const STORES_LINE = 'Apple App Store / Google Play — payments and subscription management for in-app purchases.';

  /**
   * Sentences about the stores or renewal that do not say which purchases they apply to. A block marked
   * "In-app purchases:" scopes its sentences, so none of them may speak of the web or Stripe; elsewhere a sentence
   * must be one of the channel or web-renewal sentences, or the third-party stores line itself.
   */
  function unscopedSentences(html: string): string[] {
    const allowed = new Set([...sentencesOf(`${CHANNELS} ${WEB_RENEWAL}`), STORES_LINE]);
    const blocks = blocksOf(html);
    const outside = blocks
      .filter((block) => !IN_APP.test(block))
      .flatMap(sentencesOf)
      .filter((sentence) => STORE.test(sentence) || /\brenew/i.test(sentence))
      .filter((sentence) => !allowed.has(sentence));
    const insideAboutWeb = blocks
      .filter((block) => IN_APP.test(block))
      .flatMap(sentencesOf)
      .filter((sentence) => /\bweb\b|Stripe/i.test(sentence));
    return [...outside, ...insideAboutWeb];
  }

  const privacyPayments = between(privacy, 'Payments and subscriptions', 'Third-party services');
  const privacyThirdParty = between(privacy, 'Third-party services', 'Parental rights and choices');
  const termsBilling = between(terms, 'Subscriptions, billing, and cancellation', 'Acceptable use');

  describe('Privacy Policy', () => {
    it('names both payment channels in "Payments and subscriptions"', () => {
      expect(privacyPayments).toContain(CHANNELS);
    });

    it('no longer says every subscription is billed through the stores', () => {
      expect(privacy).not.toContain('Subscriptions are billed through the Apple App Store or Google Play.');
      expect(privacy).not.toContain('the store handles payment and gives us');
    });

    it('keeps the card promise for both channels and says what is kept about a plan', () => {
      expect(privacyPayments).toContain('We never see or store full card numbers — Stripe or the store handles payment.');
      expect(privacyPayments).toContain(
        'For each plan we keep the plan, its status and dates, the Stripe or store reference ids, any promotion code used, and a record of each payment and refund, and of any payment that did not go through (amount, currency and date).',
      );
      expect(privacyPayments).not.toMatch(/the minimum needed to unlock|only what we need/);
    });

    it('lists Stripe for the web and keeps the stores, marked for in-app purchases, among the third-party services', () => {
      expect(privacyThirdParty).toContain(
        'Stripe — payments and subscription management for plans bought on the web. We give Stripe the email address the grown-up signed in with, for receipts, and the plan, our reference ids for it and any promotion code used, so each payment is matched to the right plan.',
      );
      expect(privacyThirdParty).toContain('Apple App Store / Google Play — payments and subscription management for in-app purchases.');
      expect(privacyThirdParty.indexOf('Stripe —')).toBeLessThan(privacyThirdParty.indexOf('Apple App Store /'));
    });
  });

  describe('Terms of Service', () => {
    it('names both payment channels, then the web renewal, before the in-app terms', () => {
      const channels = termsBilling.indexOf(CHANNELS);
      const renewal = termsBilling.indexOf(WEB_RENEWAL);
      const inApp = termsBilling.indexOf('In-app purchases:');
      expect(channels).toBeGreaterThan(-1);
      expect(renewal).toBeGreaterThan(channels);
      expect(inApp).toBeGreaterThan(renewal);
    });

    it('keeps the store subscription, auto-renew, management and refund paragraphs, each marked for in-app purchases', () => {
      expect(termsBilling).toContain(
        'In-app purchases: when offered, premium content is an auto-renewing subscription billed through the Apple App Store or Google Play.',
      );
      expect(termsBilling).toContain(
        'In-app purchases: your subscription renews automatically unless you cancel at least 24 hours before the end of the current period.',
      );
      expect(termsBilling).toContain('In-app purchases: manage or cancel anytime in your App Store or Google Play account settings.');
      expect(termsBilling).toContain(
        'In-app purchases: refunds are handled by the store under its policy. A free trial, if offered, converts to a paid subscription unless cancelled before it ends.',
      );
    });

    it('marks every list item of the billing section as in-app, and no longer bills premium through the stores alone', () => {
      const section = between(termsHtml, 'Subscriptions, billing, and cancellation', 'Acceptable use');
      const items = [...section.matchAll(/<li\b[^>]*>(.*?)<\/li>/g)].map((m) => textOf(m[1] ?? '').trim());
      expect(items).toHaveLength(4);
      for (const item of items) expect(item).toMatch(IN_APP);
      expect(terms).not.toContain('Premium content is offered as an auto-renewing subscription billed through the Apple App Store or Google Play.');
      expect(terms).not.toMatch(/(^|\. )Your subscription renews automatically/);
    });
  });

  describe('both documents', () => {
    const documents = [
      ['privacy', privacyHtml],
      ['terms', termsHtml],
    ] as const;

    it.each(documents)('%s: every sentence about the stores or renewal says which purchases it applies to', (_, html) => {
      expect(unscopedSentences(html)).toEqual([]);
      expect(blocksOf(html).some((block) => STORE.test(block))).toBe(true);
    });

    it('the scope check reads each sentence and every kind of block (self-check)', () => {
      const html = [
        `<p>${CHANNELS} Subscriptions renew automatically through Google Play.</p>`,
        '<li>In-app purchases: renews in the store.</li>',
        '<li>In-app purchases: refunds are handled by the store. Web plans renew monthly.</li>',
        `<li>${STORES_LINE}</li>`,
        '<li>Every plan renews through the App Store or Google Play for in-app purchases.</li>',
        '<h2>Plans renew through Google Play</h2>',
        '<div>Billing renews yearly.</div>',
      ].join('');
      expect(unscopedSentences(html)).toEqual([
        'Subscriptions renew automatically through Google Play.',
        'Every plan renews through the App Store or Google Play for in-app purchases.',
        'Plans renew through Google Play',
        'Billing renews yearly.',
        'Web plans renew monthly.',
      ]);
    });

    /** A currency sign or code, a decimal amount, the two plan amounts, or an amount per period (OD-7). */
    const PRICE =
      /[$€£₩]|\b(USD|EUR|GBP|KRW|dollars?)\b|\b\d+\.\d+\b|\b153\b|\d\s*(a|an|per|each|every|\/)\s*(year|yr|month|mo)\b|\b(yearly|annual|monthly) (price|fee|cost)\b/i;

    it('the price guard catches the usual ways of writing a price (self-check)', () => {
      for (const sample of ['$15.30 a year', 'USD 15', '15.3 yearly', '153 per year', '15 / year', 'fifteen dollars yearly', 'the yearly price', '₩20000', '20000 KRW']) {
        expect(sample).toMatch(PRICE);
      }
      for (const fine of ['Plans bought on the web renew every year until cancelled.', "We won't sell your data.", 'within 30 days']) {
        expect(fine).not.toMatch(PRICE);
      }
    });

    it.each(documents)('%s: names no price and no one-time or lifetime purchase', (_, html) => {
      const text = textOf(html);
      expect(text).not.toMatch(PRICE);
      expect(text).not.toMatch(/\blifetime\b|\bpay once\b|\bone payment\b|\bfor good\b|\bforever\b|\bnothing to cancel\b|\bno renewal\b/i);
    });

    it.each(documents)('%s: adds no sentence about site analytics', (_, html) => {
      expect(textOf(html)).not.toMatch(/analytics/i);
    });

    it.each(documents)('%s: keeps the draft banner', (_, html) => {
      expect(textOf(html)).toContain(
        'Draft for review. This document is a working draft pending review by qualified legal counsel before public launch.',
      );
    });

    it('Terms of Service: the effective date moves to 2026-10-12 with the payment facts; the Privacy Policy keeps 2026-10-12', () => {
      expect(terms).toContain('Effective October 12, 2026');
      expect(terms).not.toContain('Effective May 22, 2026');
      expect(privacy).toContain('Effective October 12, 2026');
    });

    it.each(['es', 'ko'] as const)('%s: shows the same English payment facts under the English-authoritative notice (L10)', (locale) => {
      const notice = getMessages(locale).landing.legal.englishAuthoritative;
      const localizedPrivacy = textOf(renderToStaticMarkup(<PrivacyDocument locale={locale} />));
      const localizedTerms = textOf(renderToStaticMarkup(<TermsDocument locale={locale} />));
      expect(localizedPrivacy).toContain(notice);
      expect(localizedTerms).toContain(notice);
      expect(localizedPrivacy).toContain(CHANNELS);
      expect(localizedTerms).toContain(CHANNELS);
      expect(localizedTerms).toContain(WEB_RENEWAL);
    });
  });
});
