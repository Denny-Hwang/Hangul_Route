import { LEARNER_LEVELS } from '@hangul-route/content-schema';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
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

const privacy = textOf(renderToStaticMarkup(<PrivacyPage />));
const terms = textOf(renderToStaticMarkup(<TermsPage />));

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
