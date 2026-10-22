import { FAMILY_LIFETIME_LEARNERS, GROUP_LICENSE_LEARNERS } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HomePage as HomeDocument } from '../../components/landing/HomePage';
import { LearnersPage as LearnersDocument } from '../../components/landing/LearnersPage';
import { ParentsPage as ParentsDocument } from '../../components/landing/ParentsPage';
import { TeachersPage as TeachersDocument } from '../../components/landing/TeachersPage';
import { ALL_CLAIMS_OFF, ALL_CLAIMS_ON } from '../../data/__tests__/site-claims-fixtures';
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
  // The plan's name appears only once plans are on sale, in the sizes line ([SA] SA-6) and in the teachers' browse line,
  // which shows only then (`CLAIM_REQUIRES_PAID`) and names the plan as the billing page does, the way the parents'
  // browse line names the Family Plan (both scanned below): OD-7 lets the site name a plan without an amount.
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
    expect(home).toContain(
      'Stage 1 is free. Words, sentences and stories are in the app too. Family and class plans are on the way.',
    );
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

/**
 * [SA] AMENDMENTS-SEATS-ADMINS section 4 (SA-6): once `paidPlans` is 'inApp', the persona Plans blocks add the sizes
 * line, which names the Family Plan and the Group License with their learner limits. It names no amount, no term and
 * no lifetime; the rest of each page still passes every commercial check, the plan name included.
 */
describe('site text — the plan sizes line once plans are on sale', () => {
  const sizes = getMessages('en').landing.plans.sizes(FAMILY_LIFETIME_LEARNERS, GROUP_LICENSE_LEARNERS);
  const browse = getMessages('en').landing.persona.teachers.class.browse;
  const states = [
    ['the paidPlans flip', { ...SITE_CLAIMS, paidPlans: 'inApp' }],
    ['every claim on', ALL_CLAIMS_ON],
  ] as const;
  const pages = [
    ['/parents', ParentsDocument],
    ['/teachers', TeachersDocument],
  ] as const;

  it('the sizes line itself names no price, no term, no lifetime and no subscription', () => {
    for (const { name, re } of COMMERCIAL_CLAIMS) {
      if (name !== '"Group License"') expect(sizes, name).not.toMatch(re);
    }
  });

  for (const [state, claims] of states) {
    for (const [path, Page] of pages) {
      it(`${path} (${state}): shows the sizes line once, and nothing else on the page makes a commercial claim`, () => {
        const text = textOf(renderToStaticMarkup(<Page locale="en" claims={claims} />));
        expect(text.split(sizes)).toHaveLength(2);
        // The teachers' browse line (paid plans on sale only) names the Group License too; nothing else may.
        const rest = text.split(sizes).join(' ').split(browse).join(' ');
        for (const { name, re } of COMMERCIAL_CLAIMS) expect(rest, name).not.toMatch(re);
      });
    }
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

  // The metadata's only cost words are "Stage 1 is free", true in both `paidPlans` states (F-SITE-002 site facts,
  // 2026-10-21): later stages ship, so it no longer says more stages are coming, and the paidPlans flip needs no
  // metadata change.
  it.each([
    ['en', /more stages are coming/i, /Stage 1 is free/],
    ['es', /vienen más etapas/i, /La Etapa 1 es gratis/],
    ['ko', /더 많은 단계가 준비되고 있어요/, /1단계는 무료예요/],
  ] as const)('%s: the metadata cost clause is true whatever the paidPlans claim says', (locale, coming, free) => {
    const text = JSON.stringify(SITE_PAGES.map((page) => siteMetadataFor(locale, page, true)));
    expect(coming.test(text)).toBe(false);
    expect(free.test(text)).toBe(true);
  });
});

/**
 * The level check (F-PLC-001; placement on for every platform since P-10) is a claim, on since the owner decision of
 * 2026-10-21: off, neither line shows; on, `/learners` asks the level question after the Korean one and step 1 of the
 * home's How it works names it (one line, not a fourth step: the home's word budget). Both states, in every UI locale.
 */
describe('site text — the level-check lines follow the levelCheck claim', () => {
  const steps = (html: string): string[] =>
    [...(/<section aria-labelledby="home-how"[\s\S]*?<\/section>/.exec(html)?.[0] ?? '').matchAll(/<li\b[\s\S]*?<\/li>/g)].map((m) => textOf(m[0]).trim());

  it('is on today (owner decision 2026-10-21)', () => {
    expect(SITE_CLAIMS.levelCheck).toBe(true);
  });

  for (const locale of ['en', 'es', 'ko'] as const) {
    const t = getMessages(locale).landing;
    const H = t.home.how;
    const L = t.persona.learners.faq.level;

    for (const [state, base] of [
      ['every claim off', ALL_CLAIMS_OFF],
      ['today', SITE_CLAIMS],
    ] as const) {
      it(`${locale} (${state}, levelCheck off): no level question, step 1 as before`, () => {
        const claims = { ...base, levelCheck: false };
        const learners = textOf(renderToStaticMarkup(<LearnersDocument locale={locale} claims={claims} />));
        expect(learners).not.toContain(L.q);
        expect(learners).not.toContain(L.a);
        const home = renderToStaticMarkup(<HomeDocument locale={locale} claims={claims} />);
        expect(steps(home)).toHaveLength(3);
        expect(steps(home)[0]).toBe(`1 ${H.steps.start.title} ${H.steps.start.body}`);
        expect(textOf(home)).not.toContain(H.levelBody);
      });

      it(`${locale} (${state}, levelCheck on): the level question once, and step 1 names the level check`, () => {
        const claims = { ...base, levelCheck: true };
        const learners = textOf(renderToStaticMarkup(<LearnersDocument locale={locale} claims={claims} />));
        expect(learners.split(L.q)).toHaveLength(2);
        expect(learners.split(L.a)).toHaveLength(2);
        const home = renderToStaticMarkup(<HomeDocument locale={locale} claims={claims} />);
        const shown = steps(home);
        expect(shown).toHaveLength(3);
        expect(shown[0]).toBe(`1 ${H.steps.start.title} ${H.levelBody}`);
        // The level line opens with the base line's words (it follows "Make a profile"), so the base line is not shown
        // on its own as well: those words appear once, inside the level line.
        expect(H.levelBody).not.toBe(H.steps.start.body);
        expect(textOf(home).split(H.steps.start.body)).toHaveLength(2);
      });
    }
  }

  it('the English lines never call it a test', () => {
    const en = getMessages('en').landing;
    for (const line of [en.persona.learners.faq.level.q, en.persona.learners.faq.level.a, en.home.how.levelBody]) {
      expect(line).not.toMatch(/\btest\b|\bplacement\b/i);
    }
  });
});
