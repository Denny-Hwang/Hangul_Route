import { getMessages, isEnglishAuthoritative, retiredDataPromises } from '@hangul-route/i18n';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AboutPage } from '../../components/landing/AboutPage';
import { HomePage } from '../../components/landing/HomePage';
import { LearnersPage } from '../../components/landing/LearnersPage';
import { NotFoundPage } from '../../components/landing/NotFoundPage';
import { ParentsPage } from '../../components/landing/ParentsPage';
import { PrivacyPage } from '../../components/landing/PrivacyPage';
import { TeachersPage } from '../../components/landing/TeachersPage';
import { TermsPage } from '../../components/landing/TermsPage';
import { GUEST_TTL_DAYS, GUEST_TTL_SHARED_DAYS } from '../../data/guest-ttl';
import { SITE_CLAIMS, type SiteClaims } from '../../data/site-claims';
import { appUrl } from '../../lib/console/config';

/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON section 13 (row GU-6): the site with the `guestLesson` claim off (as shipped until
 * GU-7) and forced on, through the pages' `claims` prop, in every combination with `levelCheck` and in en, es and ko.
 *
 * - Every Start learning carries `try=1` with the claim on and never with it off; Sign in and Create never carry it.
 * - Home: the one hero line under the facts line; How it works step 1 and step 3 tell a true start (section 13.2):
 *   no "Make a profile" or "Pick a name and a Hoya" first, no unqualified "Your progress is saved and backed up".
 * - /learners: the level answer quotes Home's level-check button word for word (`learner.placement.homeCard.take`),
 *   never the first run's `knowSome` label; and the site names the no-profile start nowhere else (OQ-G7).
 * - The Privacy Policy bullet, English only (L10), only under the claim.
 */
const LOCALES = ['en', 'es', 'ko'] as const;

function textOf(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ');
}

const claimsWith = (levelCheck: boolean, guestLesson: boolean): Readonly<SiteClaims> => ({ ...SITE_CLAIMS, levelCheck, guestLesson });
const COMBINATIONS = [false, true].flatMap((levelCheck) => [false, true].map((guestLesson) => ({ levelCheck, guestLesson })));

/** Every href of the rendered page, decoded. */
const hrefs = (html: string): string[] => [...html.matchAll(/href="([^"]*)"/g)].map((m) => (m[1] ?? '').replace(/&amp;/g, '&'));
/** The links into the learner app (every Start learning): the app origin, not its sign-in page. */
const learnerLinks = (html: string): string[] =>
  hrefs(html).filter((href) => href.startsWith(appUrl()) && !new URL(href).pathname.startsWith('/signin'));
/** The grown-up links (Sign in and Create): the `/signin` page on any origin. */
const grownUpLinks = (html: string): string[] => hrefs(html).filter((href) => /\/signin\b/.test(href));

const homeSteps = (html: string): string[] =>
  [...(/<section aria-labelledby="home-how"[\s\S]*?<\/section>/.exec(html)?.[0] ?? '').matchAll(/<li\b[\s\S]*?<\/li>/g)].map((m) => textOf(m[0]).trim());
/** The hero's text block (h1 to the grown-up links), in order. */
const heroText = (html: string): string => textOf(/<section aria-labelledby="home-title"[\s\S]*?<\/section>/.exec(html)?.[0] ?? '');

describe('[GU] the guestLesson claim on the site (AMENDMENTS-GUEST-FIRST-LESSON section 13)', () => {
  it('is off today (it flips only in GU-7)', () => {
    expect(SITE_CLAIMS.guestLesson).toBe(false);
  });

  for (const locale of LOCALES) {
    const m = getMessages(locale);
    const H = m.landing.home;
    const level = m.landing.persona.learners.faq.level;
    const knowSome = m.learner.placement.invite.knowSome;
    const take = m.learner.placement.homeCard.take;
    const chooseWho = m.learner.createProfile.missing.who;

    for (const { levelCheck, guestLesson } of COMBINATIONS) {
      const claims = claimsWith(levelCheck, guestLesson);
      const label = `${locale}, levelCheck ${levelCheck ? 'on' : 'off'}, guestLesson ${guestLesson ? 'on' : 'off'}`;

      describe(label, () => {
        const home = renderToStaticMarkup(<HomePage locale={locale} claims={claims} />);
        const homeText = textOf(home);
        const learners = renderToStaticMarkup(<LearnersPage locale={locale} claims={claims} />);
        const learnersText = textOf(learners);

        it('home: the hero line shows once, right under the facts line and above the grown-up links, only with the claim on', () => {
          const hero = heroText(home);
          if (guestLesson) {
            expect(homeText.split(H.hero.guest)).toHaveLength(2);
            const facts = hero.indexOf(H.hero.facts);
            const line = hero.indexOf(H.hero.guest);
            const parents = hero.indexOf(H.hero.forParents);
            expect(facts).toBeGreaterThan(-1);
            expect(line).toBeGreaterThan(facts);
            expect(parents).toBeGreaterThan(line);
            // Plain text, not a second action: the hero still has one button (Start learning) and the two text links.
            expect(/<p class="hr-site-hero-guest"[^>]*>[^<]*<\/p>/.test(home)).toBe(true);
          } else {
            expect(homeText).not.toContain(H.hero.guest);
            expect(home).not.toContain('hr-site-hero-guest');
          }
        });

        it('home: How it works tells a true start (section 13.2 table)', () => {
          const steps = homeSteps(home);
          expect(steps).toHaveLength(3);
          if (guestLesson) {
            expect(steps[0]).toBe(`1 ${H.how.steps.start.guestTitle} ${levelCheck ? H.how.guestLevelBody : H.how.guestStartBody}`);
            expect(steps[2]).toBe(`3 ${H.how.steps.collect.title} ${H.how.steps.collect.guestBody}`);
            // Step 1's shipped words (since SN-1) and the old order never show.
            expect(homeText).not.toContain(H.how.steps.start.title);
            expect(homeText).not.toContain(H.how.steps.start.body);
            expect(homeText).not.toContain(H.how.levelBody);
            // No unqualified backup line: the backup is tied to adding a name.
            expect(homeText).not.toContain(H.how.steps.collect.body);
          } else {
            expect(steps[0]).toBe(`1 ${H.how.steps.start.title} ${levelCheck ? H.how.levelBody : H.how.steps.start.body}`);
            expect(steps[2]).toBe(`3 ${H.how.steps.collect.title} ${H.how.steps.collect.body}`);
            for (const guestLine of [H.how.steps.start.guestTitle, H.how.guestLevelBody, H.how.guestStartBody, H.how.steps.collect.guestBody]) {
              expect(homeText).not.toContain(guestLine);
            }
          }
        });

        it('/learners: the level answer follows both claims, and quotes Home’s button word for word with the guest start', () => {
          if (!levelCheck) {
            expect(learnersText).not.toContain(level.q);
            expect(learnersText).not.toContain(level.a);
            expect(learnersText).not.toContain(level.guestA);
            return;
          }
          expect(learnersText.split(level.q)).toHaveLength(2);
          if (guestLesson) {
            expect(learnersText.split(level.guestA)).toHaveLength(2);
            expect(learnersText).not.toContain(level.a);
            expect(level.guestA).toContain(take);
          } else {
            expect(learnersText.split(level.a)).toHaveLength(2);
            expect(learnersText).not.toContain(level.guestA);
          }
        });

        it('with the claim on, neither page shows the first run’s words: the knowSome label, “Choose who is learning”, the unqualified backup line', () => {
          if (!guestLesson) return;
          for (const text of [homeText, learnersText]) {
            expect(text).not.toContain(knowSome);
            expect(text).not.toContain(chooseWho);
            expect(text).not.toContain(H.how.steps.collect.body);
            if (locale === 'en') {
              expect(text).not.toContain('Choose who is learning');
              expect(text).not.toContain('Make a profile');
              expect(text).not.toContain('Pick a name and a Hoya');
              // "Your progress is saved and backed up" only after "Add a name, and" (never opening a sentence).
              expect(text).not.toMatch(/(^|[.!?]\s+)Your progress is saved and backed up/);
            }
          }
        });

        it('OQ-G7: the no-profile start is named on Home only (one line), never on /learners', () => {
          expect(learnersText).not.toContain(H.hero.guest);
        });

        it('every Start learning carries try=1 with the claim on and never with it off; Sign in and Create never do', () => {
          for (const html of [home, learners]) {
            const starts = learnerLinks(html);
            expect(starts.length).toBeGreaterThan(0);
            for (const href of starts) {
              const params = new URL(href).searchParams;
              expect(params.get('try'), href).toBe(guestLesson ? '1' : null);
              // try=1 is the only thing added: lang from /es and /ko, nothing else (no id, no PII).
              expect([...params.keys()].filter((key) => key !== 'lang' && key !== 'try'), href).toEqual([]);
              expect(params.get('lang'), href).toBe(locale === 'en' ? null : locale);
            }
            for (const href of grownUpLinks(html)) expect(href, href).not.toMatch(/[?&]try=/);
          }
        });
      });
    }
  }
});

describe('[GU] every other caller of learnerStart gets try=1 from the page claims (header, phone pill, footer, persona pages, About, 404)', () => {
  const ON = claimsWith(true, true);
  for (const locale of LOCALES) {
    const pages: ReadonlyArray<readonly [string, (claims: Readonly<SiteClaims>) => string]> = [
      ['/parents', (claims) => renderToStaticMarkup(<ParentsPage locale={locale} claims={claims} />)],
      ['/teachers', (claims) => renderToStaticMarkup(<TeachersPage locale={locale} claims={claims} />)],
      ['/about', (claims) => renderToStaticMarkup(<AboutPage locale={locale} claims={claims} />)],
      ['404', (claims) => renderToStaticMarkup(<NotFoundPage locale={locale} claims={claims} />)],
    ];
    for (const [name, render] of pages) {
      it(`${locale} ${name}: the header pill, the page's own Start and the footer carry try=1 only with the claim on`, () => {
        const on = learnerLinks(render(ON));
        // The header pill, the page's action and the footer's link at least.
        expect(on.length).toBeGreaterThanOrEqual(3);
        for (const href of on) expect(new URL(href).searchParams.get('try'), href).toBe('1');
        for (const href of grownUpLinks(render(ON))) expect(href).not.toMatch(/[?&]try=/);
        for (const href of learnerLinks(render(SITE_CLAIMS))) expect(href).not.toMatch(/[?&]try=/);
        // No other guest copy reaches these pages (OQ-G7): the one line is the home's.
        expect(textOf(render(ON))).not.toContain(getMessages(locale).landing.home.hero.guest);
      });
    }
  }
});

describe('[GU] the Privacy Policy first-quest bullet (section 13.3), English only (L10), only under the claim', () => {
  const en = getMessages('en').landing.legal.privacy.sections.collect.bullets;
  const BULLET = en.guest({ email: '', levels: '', days: GUEST_TTL_DAYS, sharedDays: GUEST_TTL_SHARED_DAYS });

  it('names the app’s days: 30 without play, 7 on a device with learner profiles', () => {
    expect(BULLET).toContain('after 30 days without play (7 days on a device that already has learner profiles)');
  });

  it('passes the retired data promises guard and says nothing of a legal review', () => {
    expect(retiredDataPromises(BULLET)).toEqual([]);
    expect(BULLET).not.toMatch(/legal review|counsel|lawyer|pending/i);
  });

  it('is in the English-authoritative subtree, so the es and ko L10 tests cover it', () => {
    expect(isEnglishAuthoritative('landing.legal.privacy.sections.collect.bullets.guest')).toBe(true);
  });

  for (const locale of LOCALES) {
    it(`${locale}: shown in "What we collect" with the claim on, in English, and absent with it off`, () => {
      const on = renderToStaticMarkup(<PrivacyPage locale={locale} claims={claimsWith(true, true)} />);
      const off = renderToStaticMarkup(<PrivacyPage locale={locale} claims={SITE_CLAIMS} />);
      expect(textOf(on).split(BULLET)).toHaveLength(2);
      expect(textOf(off)).not.toContain(BULLET);
      expect(textOf(off)).not.toContain('Trying the first quest');
      const collect = /<section[^>]*>\s*<h2[^>]*>What we collect<\/h2>[\s\S]*?<\/section>/.exec(on)?.[0] ?? '';
      expect(textOf(collect)).toContain(BULLET);
      // Under the English notice on /es and /ko, in a section marked lang="en" (L10).
      if (locale !== 'en') {
        expect(textOf(on)).toContain(getMessages(locale).landing.legal.englishAuthoritative);
        expect(collect).toMatch(/^<section[^>]*lang="en"/);
      }
      // Every other bullet stays; the off page has exactly one bullet fewer.
      expect((on.match(/<li>/g) ?? []).length).toBe((off.match(/<li>/g) ?? []).length + 1);
    });
  }

  it('the Terms take the same values and show no first-quest text', () => {
    expect(textOf(renderToStaticMarkup(<TermsPage locale="en" />))).not.toContain('Trying the first quest');
  });
});
