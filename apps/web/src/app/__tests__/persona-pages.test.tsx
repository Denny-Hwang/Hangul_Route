import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FAMILY_LIFETIME_LEARNERS, FREE_CLASS_STUDENT_CAP, GROUP_LICENSE_LEARNERS, SCHOOL_ADMIN_CAP, SCHOOL_LEARNER_CAP } from '@hangul-route/content-schema';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AboutPage } from '../../components/landing/AboutPage';
import { HomePage } from '../../components/landing/HomePage';
import { LearnersPage } from '../../components/landing/LearnersPage';
import { ParentsPage } from '../../components/landing/ParentsPage';
import { PrivacyPage } from '../../components/landing/PrivacyPage';
import { TeachersPage } from '../../components/landing/TeachersPage';
import { TermsPage } from '../../components/landing/TermsPage';
import { ALL_CLAIMS_OFF, ALL_CLAIMS_ON } from '../../data/__tests__/site-claims-fixtures';
import { CONTACT_EMAIL } from '../../data/contact';
import { siteGames } from '../../data/minigame-catalog';
import { captureFile, showsCapture } from '../../data/site-captures';
import { SITE_CLAIMS, showsClaim, type SiteClaims } from '../../data/site-claims';
import { stage1Cards } from '../../data/stage1-cards';
import { createAccount, learnerStart, signIn } from '../../lib/site-links';
import EnLearners from '../(en)/learners/page';
import EnParents from '../(en)/parents/page';
import EnTeachers from '../(en)/teachers/page';

/**
 * The persona pages (F-SITE-002 §3.4 to §3.6, appendix B; wireframes design/wireframes/site/learners.md, parents.md,
 * teachers.md; mock design/screens/site/persona-page.md). Each renders one h1 and its primary action from `site-links`,
 * is complete with every claim off (no empty section, no teaser), shows each claim line exactly once with its claim
 * on, and holds no console, demo or billing path. S-4a: `/learners`; S-4b: `/parents` and `/teachers`.
 */
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SHOW_ALL_LOCALES', '');
  vi.stubEnv('EXPO_PUBLIC_SHOW_ALL_LOCALES', '');
  vi.stubEnv('CONSOLE_ORIGIN', 'false');
});
afterEach(() => vi.unstubAllEnvs());
// Grown-up links on the site's own origin (the kill switch CONSOLE_ORIGIN=false; a build without the variable
// links to the app host since F-SITE-002 S-10). Also set here for the pages rendered while tests are collected.
vi.stubEnv('CONSOLE_ORIGIN', 'false');

const here = dirname(fileURLToPath(import.meta.url));
const webSrc = join(here, '..', '..');
const t = getMessages('en').landing;
const L = t.persona.learners;

const decode = (s: string): string =>
  s.replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const textOf = (html: string): string => decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const count = (haystack: string, needle: string): number => haystack.split(needle).length - 1;
/** The page's main content only (header and footer are site-chrome.test.tsx's). */
const mainOf = (html: string): string => /<main[^>]*>([\s\S]*)<\/main>/.exec(html)?.[1] ?? '';
/** h2 sections of the main content, by their heading text (visually hidden headings included). */
const sectionTitles = (html: string): string[] =>
  [...mainOf(html).matchAll(/<section[^>]*>\s*<h2[^>]*>([^<]*)<\/h2>/g)].map((m) => decode(m[1] ?? ''));

describe('/learners (S-4a)', () => {
  const html = renderToStaticMarkup(<LearnersPage locale="en" />);
  const main = mainOf(html);
  const text = textOf(main);

  it('renders exactly one h1, "For learners", then the lead', () => {
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html).toMatch(new RegExp(`<h1[^>]*>${L.title}</h1>`));
    expect(text).toContain(L.lead);
  });

  it('its primary action is Start learning to the learner app, at the top and in the closing block', () => {
    const starts = [...main.matchAll(/<a [^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/g)].filter((m) => m[2] === t.nav.start);
    expect(starts.map((m) => m[1])).toEqual([learnerStart('en'), learnerStart('en')]);
    expect(main).not.toContain('Sign in');
  });

  it('with every claim off: four sections and the questions, no Learning Route, nothing empty', () => {
    expect(sectionTitles(html)).toEqual([L.learn.title, L.quest.title, L.cards.title, t.persona.faqTitle]);
    expect(text).not.toContain(L.route.title);
    expect(main).not.toMatch(/<section[^>]*>\s*<h2[^>]*>[^<]*<\/h2>\s*<\/section>/);
  });

  it('with the learningRoute claim on: the Learning Route section appears once, between Collect and the questions', () => {
    const on = renderToStaticMarkup(<LearnersPage locale="en" claims={{ ...ALL_CLAIMS_OFF, learningRoute: true }} />);
    expect(sectionTitles(on)).toEqual([L.learn.title, L.quest.title, L.cards.title, L.route.title, t.persona.faqTitle]);
    expect(count(textOf(on), L.route.body)).toBe(1);
    const all = renderToStaticMarkup(<LearnersPage locale="en" claims={ALL_CLAIMS_ON} />);
    expect(count(textOf(all), L.route.body)).toBe(1);
  });

  it('what you learn first: the Stage 1 line and read, listen, write; no speaking line', () => {
    expect(text).toContain(L.learn.body);
    for (const line of Object.values(L.learn.bullets)) expect(text).toContain(line);
    expect(text).not.toMatch(/\b(speak|speaking|say it|pronounce)\b/i);
  });

  it('what you learn first ends with one paragraph on what comes after the alphabet, inside the same section', () => {
    const section = new RegExp(`<section[^>]*>\\s*<h2[^>]*>${esc(L.learn.title)}</h2>([\\s\\S]*?)</section>`).exec(main)?.[1] ?? '';
    expect(section).toMatch(new RegExp(`<p[^>]*><strong[^>]*>${esc(L.after.title)}</strong>${esc(L.after.body)}</p>`));
    expect(count(text, L.after.body)).toBe(1);
  });

  it('how most quests work: three numbered steps, the Hoya line with decorative art, and the mini-games fold', () => {
    expect(main).toMatch(/<ol[^>]*>/);
    for (const line of Object.values(L.quest.bullets)) expect(text).toContain(line);
    expect(text).toContain(L.quest.hoya);
    expect(main).toMatch(/<span aria-hidden="true"[^>]*><svg[^>]*data-pose="waving"/);
    expect(main).toMatch(new RegExp(`<summary[^>]*><span[^>]*>${L.quest.gamesFold}</span></summary>`));
  });

  it('collect: six card tiles, each the Korean word (lang="ko") with its romanization and English gloss (CLAUDE.md §1)', () => {
    expect(main).toMatch(/<ul role="list" class="hr-site-tiles"/);
    const tiles = [...main.matchAll(/<li class="hr-site-tile"[^>]*>([\s\S]*?)<\/li>/g)].map((m) => m[1] ?? '');
    expect(tiles).toHaveLength(6);
    stage1Cards.slice(0, 6).forEach((card, i) => {
      const tile = decode(tiles[i] ?? '');
      expect(tile).toContain(`<span lang="ko"`);
      expect(tile).toContain(`>${card.ko}<`);
      expect(tile).toContain(`>${card.romanization}<`);
      expect(tile).toContain(`>${card.en}<`);
      // The gloss is a meaning, never the romanization again (card.title is "Bap" for 밥).
      const spans = [...tile.matchAll(/<span[^>]*>([^<]*)<\/span>/g)].map((m) => m[1] ?? '');
      expect(spans).toHaveLength(3);
      expect(spans[2]?.toLowerCase(), card.id).not.toBe(card.romanization.toLowerCase());
    });
  });

  it('the cards fold names the count from data, and holds the full card grid with no heading or teaser of its own', () => {
    expect(main).toMatch(new RegExp(`<summary[^>]*><span[^>]*>${L.cards.seeAll(stage1Cards.length)}</span></summary>`));
    const fold = /<details[^>]*>(?:(?!<\/details>)[\s\S])*?See all[\s\S]*?<\/details>/.exec(main)?.[0] ?? '';
    for (const card of stage1Cards) expect(fold).toContain(card.ko);
    expect(fold).not.toMatch(/<h2\b|<section\b|<header id/);
  });

  it('the games fold: the games without a speaking one, titles as h3 under the section h2, no heading, eyebrow or beta', () => {
    const fold = decode(new RegExp(`<details[^>]*>(?:(?!</details>)[\\s\\S])*?${esc(L.quest.gamesFold)}[\\s\\S]*?</details>`).exec(main)?.[0] ?? '');
    expect(fold).not.toBe('');
    expect(fold).not.toMatch(/<h2\b|<section\b/);
    expect(fold.match(/<h3\b/g)).toHaveLength(siteGames.length);
    for (const game of siteGames) expect(fold).toContain(`>${t.games.items[game.kind].title}<`);
    expect(fold).not.toContain(t.games.beta);
    expect(fold).not.toMatch(/in beta/i);
  });

  it('every styled list keeps its list role (VoiceOver drops it with list-style: none)', () => {
    for (const m of main.matchAll(/<(ul|ol)\b([^>]*)>/g)) expect(m[2], m[0]).toContain('role="list"');
  });

  it('six folded questions today, in order, each a native details; the level-check question (last) only with its claim on', () => {
    const questions = [...main.matchAll(/<summary[^>]*><span[^>]*>([^<]*)<\/span><\/summary>/g)].map((m) => decode(m[1] ?? ''));
    expect(SITE_CLAIMS.levelCheck).toBe(true);
    expect(questions.slice(2)).toEqual([L.faq.signIn.q, L.faq.code.q, L.faq.offline.q, L.faq.adult.q, L.faq.korean.q, L.faq.level.q]);
    for (const { a } of [L.faq.signIn, L.faq.code, L.faq.offline, L.faq.adult, L.faq.korean, L.faq.level]) expect(count(text, a)).toBe(1);
    const off = textOf(mainOf(renderToStaticMarkup(<LearnersPage locale="en" claims={{ ...SITE_CLAIMS, levelCheck: false }} />)));
    expect(off).not.toContain(L.faq.level.q);
    expect(off).not.toContain(L.faq.level.a);
  });

  it('with the levelCheck claim on: the level-check question follows the Korean one, once', () => {
    const on = mainOf(renderToStaticMarkup(<LearnersPage locale="en" claims={{ ...ALL_CLAIMS_OFF, levelCheck: true }} />));
    const questions = [...on.matchAll(/<summary[^>]*><span[^>]*>([^<]*)<\/span><\/summary>/g)].map((m) => decode(m[1] ?? ''));
    expect(questions.slice(2)).toEqual([L.faq.signIn.q, L.faq.code.q, L.faq.offline.q, L.faq.adult.q, L.faq.korean.q, L.faq.level.q]);
    expect(count(textOf(on), L.faq.level.a)).toBe(1);
  });

  it('every summary keeps a block box: the layout is on its inner span (older WebKit)', () => {
    for (const m of main.matchAll(/<summary([^>]*)>/g)) expect(m[1] ?? '').not.toMatch(/display:(grid|flex)/);
  });

  it('the questions heading is visually hidden but present, so the outline goes h1 then h2', () => {
    expect(main).toMatch(new RegExp(`<h2[^>]*style="[^"]*position:absolute[^"]*"[^>]*>${t.persona.faqTitle}</h2>`));
  });

  it('closing block: its own line labels it, then Start learning', () => {
    const closing = /<section aria-labelledby="([^"]+)" class="hr-site-closing"[^>]*>([\s\S]*?)<\/section>/.exec(main);
    expect(closing).not.toBeNull();
    expect(closing?.[2]).toMatch(new RegExp(`<p id="${closing?.[1]}"[^>]*>${esc(t.persona.closing.learners)}</p>`));
    expect(closing?.[2]).toContain(`href="${learnerStart('en')}"`);
  });

  it('marks Learners as the current page in the header', () => {
    expect(html).toMatch(new RegExp(`<a [^>]*aria-current="page"[^>]*>${t.nav.learners}</a>`));
  });

  it('no age wording and no price on the page', () => {
    // The whole rendered page, the cards fold and its Stage 1 blurbs included (S-6 reworded them, OD-9).
    expect(text).toContain(stage1Cards[0]?.blurb);
    expect(text).not.toMatch(/\bkids?\b|\bchild(ren)?\b|\bages? \d|\$\s?\d/i);
  });

  it('the en route renders the same page', () => {
    expect(renderToStaticMarkup(<EnLearners />)).toBe(html);
  });
});

const P = t.persona.parents;
const T = t.persona.teachers;
const plans = t.plans;

/** The `<a>` links of some markup, with their href and text. */
const linksOf = (html: string): Array<{ href: string; text: string }> =>
  [...html.matchAll(/<a [^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => ({ href: decode(m[1] ?? ''), text: textOf(m[2] ?? '').trim() }));
/** The paragraphs and list items of the section headed `title`, as text. */
function linesOf(html: string, title: string): string[] {
  const section = new RegExp(`<section[^>]*>\\s*<h2[^>]*>${esc(title)}</h2>([\\s\\S]*?)</section>`).exec(mainOf(html))?.[1] ?? '';
  const visible = section.replace(/<span aria-hidden="true"[^>]*>[\s\S]*?<\/span>/g, '');
  return [...visible.matchAll(/<(p|li)\b[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => textOf(m[2] ?? '').trim());
}
const render = (Page: typeof ParentsPage, claims?: Readonly<SiteClaims>, locale: UiLocale = 'en'): string =>
  renderToStaticMarkup(<Page locale={locale} claims={claims} />);

/**
 * The Plans block both grown-up pages share (§3.5, §3.6): the paid line only while plans are coming; host named once.
 * [SA] AMENDMENTS-SEATS-ADMINS section 4 (SA-6): once plans are on sale (`paidPlans: 'inApp'`), the sizes line takes
 * the paid line's place, its numbers from content-schema, never a price or a term.
 */
const SIZES = plans.sizes(FAMILY_LIFETIME_LEARNERS, GROUP_LICENSE_LEARNERS);
function expectPlans(html: string, paidPlans: SiteClaims['paidPlans']): void {
  const lines = linesOf(html, t.persona.plansTitle);
  // The free line comes first, alone (the site never states the free limits, owner decision 2026-10-21); then the
  // paid or sizes line; the managed line says "when plans arrive" until they are on sale.
  expect(lines).toEqual(
    paidPlans === 'coming' ? [plans.free.stage1, plans.paid.coming, plans.managedLater] : [plans.free.stage1, SIZES, plans.managedInApp],
  );
  expect(textOf(mainOf(html))).not.toContain(paidPlans === 'coming' ? plans.managedInApp : plans.managedLater);
  expect(lines.join(' ').match(/app\.hangulroute\.com/g)).toHaveLength(1);
  expect(textOf(mainOf(html))).not.toContain(plans.paid.inApp);
  expect(count(textOf(mainOf(html)), SIZES)).toBe(paidPlans === 'inApp' ? 1 : 0);
}

describe('/parents (S-4b)', () => {
  // The base page: every claim off (the state before any companion flip PR); today's claims are tested below.
  const html = render(ParentsPage, ALL_CLAIMS_OFF);
  const main = mainOf(html);
  const text = textOf(main);
  const follow = [P.follow.reports, P.follow.route, P.follow.notes, P.follow.browse, P.follow.lecture];

  it('renders exactly one h1, "For parents and caregivers", then the lead', () => {
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html).toMatch(new RegExp(`<h1[^>]*>${esc(P.title)}</h1>`));
    expect(text).toContain(P.lead);
  });

  it('[SN] create first: Create a free family space (/signin?mode=create&persona=parent), Start learning, then the have-account link; the closing the same', () => {
    const links = linksOf(main);
    expect(links[0]).toEqual({ href: createAccount('parent', 'en'), text: P.create });
    expect(links[1]).toEqual({ href: learnerStart('en'), text: t.nav.start });
    expect(links[2]).toEqual({ href: signIn('parent', 'en'), text: t.persona.haveAccount });
    expect(links.slice(-2)).toEqual([
      { href: createAccount('parent', 'en'), text: P.create },
      { href: signIn('parent', 'en'), text: t.persona.haveAccount },
    ]);
    expect(createAccount('parent', 'en')).toBe('/signin?mode=create&persona=parent');
    expect(signIn('parent', 'en')).toBe('/signin?persona=parent');
    expect(main).toMatch(new RegExp(`<a href="${esc(createAccount('parent', 'en').replace(/&/g, '&amp;'))}" class="hr-site-primary"`));
    expect(main).toMatch(new RegExp(`<a href="${esc(learnerStart('en'))}" class="hr-site-secondary"`));
    // The have-account link is a 64 px tall text link, not a button.
    expect(main).toMatch(new RegExp(`<a href="${esc(signIn('parent', 'en'))}" class="hr-site-text-link"`));
  });

  it('sections in order with every claim off, two columns on wide screens, nothing empty', () => {
    expect(sectionTitles(html)).toEqual([P.learn.title, P.safe.title, P.follow.title, t.persona.plansTitle, t.persona.faqTitle]);
    expect(main).toMatch(/class="hr-site-row-2"/);
    expect(main).not.toMatch(/<section[^>]*>\s*<h2[^>]*>[^<]*<\/h2>\s*<\/section>/);
  });

  it('what they learn: the line and the link to /learners', () => {
    expect(linesOf(html, P.learn.title)).toEqual([P.learn.body]);
    expect(linksOf(main)).toContainEqual({ href: '/learners', text: P.learn.link });
  });

  it('safe by design: the four bullets, the backup sentence word for word', () => {
    expect(linesOf(html, P.safe.title)).toEqual([P.safe.bullets.ads, P.safe.bullets.backup, P.safe.bullets.gate, P.safe.bullets.siblings]);
  });

  it('follow along with every claim off: the base line alone, no teaser', () => {
    expect(linesOf(html, P.follow.title)).toEqual([P.follow.body]);
    for (const line of follow) expect(text).not.toContain(line);
  });

  it('every claim on: each claim line once, in order, the browse line with the plan words', () => {
    const on = render(ParentsPage, ALL_CLAIMS_ON);
    expect(linesOf(on, P.follow.title)).toEqual([P.follow.body, ...follow]);
    for (const line of follow) expect(count(textOf(on), line)).toBe(1);
    expect(P.follow.browse).toContain('Family Plan');
  });

  it.each([
    ['parentReports', P.follow.reports],
    ['learningRoute', P.follow.route],
    ['feedbackNotes', P.follow.notes],
    ['lectureMode', P.follow.lecture],
  ] as const)('%s alone adds its one line', (claim, line) => {
    const on = render(ParentsPage, { ...ALL_CLAIMS_OFF, [claim]: true });
    expect(linesOf(on, P.follow.title)).toEqual([P.follow.body, line]);
  });

  it('browseAsLearner needs paid plans on sale: absent while coming, present with inApp', () => {
    expect(textOf(render(ParentsPage, { ...ALL_CLAIMS_OFF, browseAsLearner: true }))).not.toContain(P.follow.browse);
    const inApp = render(ParentsPage, { ...ALL_CLAIMS_OFF, browseAsLearner: true, paidPlans: 'inApp' });
    expect(linesOf(inApp, P.follow.title)).toEqual([P.follow.body, P.follow.browse]);
  });

  it('plans: both composed blocks, no price', () => {
    expectPlans(html, 'coming');
    expectPlans(render(ParentsPage, { ...ALL_CLAIMS_OFF, paidPlans: 'inApp' }), 'inApp');
    expect(text).not.toMatch(/[$€£]\s?\d|\d+\s?(USD|dollars?)\b|per (month|year)|lifetime/i);
  });

  it('three folded questions; "What can I see?" has its own answer, the reports variant with its claim', () => {
    const questions = [...main.matchAll(/<summary[^>]*><span[^>]*>([^<]*)<\/span><\/summary>/g)].map((m) => decode(m[1] ?? ''));
    expect(questions).toEqual([P.faq.account.q, P.faq.learnAlong.q, P.faq.whatSee.q]);
    expect(text).toContain(P.faq.account.a);
    expect(text).toContain('Learning Korean yourself? Play the same quests.');
    expect(text).toContain(P.faq.whatSee.a);
    expect(text).not.toContain(P.faq.whatSee.reports);
    const reports = textOf(render(ParentsPage, { ...ALL_CLAIMS_OFF, parentReports: true }));
    expect(reports).toContain(P.faq.whatSee.reports);
    expect(reports).not.toContain(P.faq.whatSee.a);
  });

  it('closing block: its own line labels it, then Create and the have-account link under it', () => {
    const closing = /<section aria-labelledby="([^"]+)" class="hr-site-closing"[^>]*>([\s\S]*?)<\/section>/.exec(main);
    expect(closing?.[2]).toMatch(new RegExp(`<p id="${closing?.[1]}"[^>]*>${esc(t.persona.closing.parents.replace(/'/g, '&#x27;'))}</p>`));
    expect(closing?.[2]).toContain(`href="${createAccount('parent', 'en').replace(/&/g, '&amp;')}"`);
    expect(closing?.[2]).toContain(`href="${signIn('parent', 'en')}"`);
    expect(closing?.[2]).toMatch(/class="hr-site-closing-actions"/);
  });

  it('marks Parents as the current page; no ranking, no age range', () => {
    expect(html).toMatch(new RegExp(`<a [^>]*aria-current="page"[^>]*>${t.nav.parents}</a>`));
    expect(text).not.toMatch(/\bages? \d|\d+\s?(–|-|to)\s?\d+\s?years|leaderboard|ranking/i);
  });

  it('the en route renders the same page', () => {
    expect(renderToStaticMarkup(<EnParents />)).toBe(render(ParentsPage));
  });
});

describe('/teachers (S-4b)', () => {
  // The base page: every claim off (the state before any companion flip PR); today's claims are tested below.
  const html = render(TeachersPage, ALL_CLAIMS_OFF);
  const main = mainOf(html);
  const text = textOf(main);
  const classLines = [T.class.reports, T.class.route, T.class.notes, T.class.browse, T.class.lecture];

  it('renders exactly one h1, "For teachers", then the lead', () => {
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html).toMatch(new RegExp(`<h1[^>]*>${T.title}</h1>`));
    expect(text).toContain(T.lead);
  });

  it('[SN] create first: Create a free class, secondary Try it as a learner, the have-account link; the closing the same', () => {
    const links = linksOf(main);
    expect(links).toEqual([
      { href: createAccount('teacher', 'en'), text: T.create },
      { href: learnerStart('en'), text: T.tryIt },
      { href: signIn('teacher', 'en'), text: t.persona.haveAccount },
      { href: createAccount('teacher', 'en'), text: T.create },
      { href: signIn('teacher', 'en'), text: t.persona.haveAccount },
    ]);
    expect(createAccount('teacher', 'en')).toBe('/signin?mode=create&persona=teacher');
  });

  it('sections in order with every claim off; the plan and class sections side by side on wide screens', () => {
    expect(sectionTitles(html)).toEqual([T.setup.title, T.plan.title, T.class.title, T.schools.title, T.privacy.title, t.persona.plansTitle, t.persona.faqTitle]);
    expect(main).toMatch(/class="hr-site-row-2"/);
    expect(main).not.toMatch(/<section[^>]*>\s*<h2[^>]*>[^<]*<\/h2>\s*<\/section>/);
  });

  it('set up in minutes: three numbered steps in one row on wide screens', () => {
    expect(linesOf(html, T.setup.title)).toEqual([T.setup.steps.space, T.setup.steps.code, T.setup.steps.devices]);
    expect(main).toMatch(/<ol role="list" class="hr-site-steps hr-site-steps-wide"/);
  });

  it('plan and assign, privacy for classes: their bullets', () => {
    expect(linesOf(html, T.plan.title)).toEqual([T.plan.bullets.pick, T.plan.bullets.planner]);
    expect(linesOf(html, T.privacy.title)).toEqual([T.privacy.bullets.initials, T.privacy.bullets.ads]);
  });

  it('see how the class is doing: the base line alone with every claim off, never a ranking', () => {
    expect(linesOf(html, T.class.title)).toEqual([T.class.body]);
    expect(T.class.body).toContain('Never a ranking.');
  });

  it('every claim on: each claim line once, in order', () => {
    const on = render(TeachersPage, ALL_CLAIMS_ON);
    expect(linesOf(on, T.class.title)).toEqual([T.class.body, ...classLines]);
    for (const line of classLines) expect(count(textOf(on), line)).toBe(1);
  });

  it.each([
    ['teacherReports', T.class.reports],
    ['learningRoute', T.class.route],
    ['feedbackNotes', T.class.notes],
    ['lectureMode', T.class.lecture],
  ] as const)('%s alone adds its one line', (claim, line) => {
    expect(linesOf(render(TeachersPage, { ...ALL_CLAIMS_OFF, [claim]: true }), T.class.title)).toEqual([T.class.body, line]);
  });

  it('parentReports does not touch the teacher page', () => {
    expect(render(TeachersPage, { ...ALL_CLAIMS_OFF, parentReports: true })).toBe(html);
  });

  it('browseAsLearner needs paid plans on sale: absent while coming, present with inApp (with the plan words)', () => {
    expect(textOf(render(TeachersPage, { ...ALL_CLAIMS_OFF, browseAsLearner: true }))).not.toContain(T.class.browse);
    const inApp = render(TeachersPage, { ...ALL_CLAIMS_OFF, browseAsLearner: true, paidPlans: 'inApp' });
    expect(linesOf(inApp, T.class.title)).toEqual([T.class.body, T.class.browse]);
    // Names the plan as the billing page does (`console.billing.planTitle.group_license`).
    expect(T.class.browse).toContain(getMessages('en').console.billing.planTitle.group_license);
  });

  it('plans: both composed blocks, no price', () => {
    expectPlans(html, 'coming');
    expectPlans(render(TeachersPage, { ...ALL_CLAIMS_OFF, paidPlans: 'inApp' }), 'inApp');
    expect(text).not.toMatch(/[$€£]\s?\d|per (month|year)|lifetime/i);
  });

  it('three folded questions with their answers', () => {
    const questions = [...main.matchAll(/<summary[^>]*><span[^>]*>([^<]*)<\/span><\/summary>/g)].map((m) => decode(m[1] ?? ''));
    expect(questions).toEqual([T.faq.students.q, T.faq.ranking.q, T.faq.try.q]);
    for (const { a } of Object.values(T.faq)) expect(text).toContain(a);
  });

  it('closing block: its own line labels it, then Create and the have-account link under it', () => {
    const closing = /<section aria-labelledby="([^"]+)" class="hr-site-closing"[^>]*>([\s\S]*?)<\/section>/.exec(main);
    expect(closing?.[2]).toMatch(new RegExp(`<p id="${closing?.[1]}"[^>]*>${esc(t.persona.closing.teachers)}</p>`));
    expect(closing?.[2]).toContain(`href="${createAccount('teacher', 'en').replace(/&/g, '&amp;')}"`);
    expect(closing?.[2]).toContain(`href="${signIn('teacher', 'en')}"`);
  });

  it('marks Teachers as the current page', () => {
    expect(html).toMatch(new RegExp(`<a [^>]*aria-current="page"[^>]*>${t.nav.teachers}</a>`));
  });

  it('the en route renders the same page', () => {
    expect(renderToStaticMarkup(<EnTeachers />)).toBe(render(TeachersPage));
  });
});

/**
 * The claim hand-offs of F-REPORT-001 RP-11 and F-FEEDBACK-001 FB-14 (F-SITE-002 section 3.9): both report flags and
 * both notes flags are on in production, so the pages as served (`SITE_CLAIMS`) carry the reports lines and the
 * notes line, word for word, and no other feature line.
 */
describe('today\'s claims: the reports lines (F-REPORT-001 RP-11), the notes line (F-FEEDBACK-001 FB-14) and the lecture mode lines (AMENDMENTS-LECTURE-V2 LV-7) are live', () => {
  it('/parents: the reports line under Follow along and the reports answer to "What can I see?"', () => {
    const html = render(ParentsPage);
    expect(SITE_CLAIMS.parentReports).toBe(true);
    expect(linesOf(html, P.follow.title)).toEqual([P.follow.body, P.follow.reports, P.follow.notes, P.follow.lecture]);
    expect(P.follow.reports).toBe('Reports for today, this week, this month and all time show what went well and what to practice next.');
    const text = textOf(mainOf(html));
    expect(text).toContain(P.faq.whatSee.reports);
    expect(text).not.toContain(P.faq.whatSee.a);
    expect(text).not.toMatch(/ranking|leaderboard|\bkids?\b|\bages? \d/i);
  });

  it('/teachers: the reports line under See how the class is doing, never a ranking', () => {
    const html = render(TeachersPage);
    expect(SITE_CLAIMS.teacherReports).toBe(true);
    expect(linesOf(html, T.class.title)).toEqual([T.class.body, T.class.reports, T.class.notes, T.class.lecture]);
    expect(T.class.notes).toBe('Send students a short note of encouragement.');
    expect(T.class.reports).toBe('Reports for each student and statistics for the whole class, by day, week, month or all time. Never a ranking.');
  });

  it('/learners is unchanged by the reports claims (only the level-check claim, on today, changes it)', () => {
    expect(renderToStaticMarkup(<LearnersPage locale="en" />)).toBe(renderToStaticMarkup(<LearnersPage locale="en" claims={{ ...ALL_CLAIMS_OFF, levelCheck: true }} />));
  });

  it.each(['ko', 'es'] as const)('%s: the reports lines and the notes line, since its report words are signed (F-SITE-002 G6; MAR re-review)', (locale) => {
    const persona = getMessages(locale).landing.persona;
    const parents = renderToStaticMarkup(<ParentsPage locale={locale} />);
    const teachers = renderToStaticMarkup(<TeachersPage locale={locale} />);
    expect(linesOf(parents, persona.parents.follow.title)).toEqual([persona.parents.follow.body, persona.parents.follow.reports, persona.parents.follow.notes, persona.parents.follow.lecture]);
    const parentsText = textOf(mainOf(parents));
    expect(parentsText).toContain(persona.parents.faq.whatSee.reports);
    expect(parentsText).not.toContain(persona.parents.faq.whatSee.a);
    expect(linesOf(teachers, persona.teachers.class.title)).toEqual([persona.teachers.class.body, persona.teachers.class.reports, persona.teachers.class.notes, persona.teachers.class.lecture]);
  });

  it('/parents: the lecture mode line under Follow along, word for word, as plain text with no link (F-SITE-002 section 3.8)', () => {
    const html = render(ParentsPage);
    expect(SITE_CLAIMS.lectureMode).toBe(true);
    expect(P.follow.lecture).toBe('Lecture mode shows ready-made lessons from Stages 1 to 7 on a TV, a laptop or a phone turned sideways, so you can learn together.');
    expect(count(textOf(mainOf(html)), P.follow.lecture)).toBe(1);
    expect(linksOf(mainOf(html)).map((link) => link.text)).not.toContain(P.follow.lecture);
    expect(html).not.toMatch(/href="[^"]*\/(present|teach|parent)\b/);
  });

  it('/teachers: the reworded lecture mode line names the feature, as plain text with no link', () => {
    const html = render(TeachersPage);
    expect(T.class.lecture).toBe(
      'Lecture mode: teach from the front with ready-made slides for Stages 1 to 7, stories and word sets, on a projector, a TV or a phone turned sideways.',
    );
    expect(T.class.lecture.startsWith('Lecture mode')).toBe(true);
    expect(count(textOf(mainOf(html)), T.class.lecture)).toBe(1);
    expect(linksOf(mainOf(html)).map((link) => link.text)).not.toContain(T.class.lecture);
    expect(html).not.toMatch(/href="[^"]*\/(present|teach|parent)\b/);
  });

  it('a PR that sets the lecture mode claim back to false takes both lines off (the LV-D1 rollback)', () => {
    const off: Readonly<SiteClaims> = { ...SITE_CLAIMS, lectureMode: false };
    expect(textOf(render(ParentsPage, off))).not.toContain(P.follow.lecture);
    expect(textOf(render(TeachersPage, off))).not.toContain(T.class.lecture);
    expect(linesOf(render(ParentsPage, off), P.follow.title)).toEqual([P.follow.body, P.follow.reports, P.follow.notes]);
    expect(linesOf(render(TeachersPage, off), T.class.title)).toEqual([T.class.body, T.class.reports, T.class.notes]);
  });

  it('the lecture mode lines name no speaking, no price and no age, in every locale', () => {
    for (const locale of ['en', 'es', 'ko'] as const) {
      const persona = getMessages(locale).landing.persona;
      for (const line of [persona.parents.follow.lecture, persona.teachers.class.lecture]) {
        expect(line.length, `${locale}: ${line}`).toBeGreaterThan(0);
        expect(line).not.toMatch(/speak|pronounc|habla|pronunci|[$€£]\s?\d|lifetime|\bkids?\b|\bchild(ren)?\b|\bages?\b/i);
      }
    }
  });

  it('the reports lines name no speaking and no price, in every locale', () => {
    for (const locale of ['en', 'es', 'ko'] as const) {
      const persona = getMessages(locale).landing.persona;
      for (const line of [persona.parents.follow.reports, persona.parents.faq.whatSee.reports, persona.teachers.class.reports]) {
        expect(line.length, `${locale}: ${line}`).toBeGreaterThan(0);
        expect(line).not.toMatch(/speak|pronounc|habla|pronunci|[$€£]\s?\d/i);
      }
    }
  });
});

describe('a build with CONSOLE_ORIGIN set or unset (S-10 default) sends both grown-up actions to the app host', () => {
  it.each(['', 'https://app.hangulroute.com'])('with CONSOLE_ORIGIN=%j', (value) => {
    vi.stubEnv('CONSOLE_ORIGIN', value);
    expect(linksOf(mainOf(render(ParentsPage)))[0]?.href).toBe('https://app.hangulroute.com/signin?mode=create&persona=parent');
  });

  it('[SN] Create and the have-account link go to https://app.hangulroute.com/signin?…, with lang off English', () => {
    vi.stubEnv('CONSOLE_ORIGIN', 'https://app.hangulroute.com');
    const parents = linksOf(mainOf(render(ParentsPage)));
    expect(parents[0]?.href).toBe('https://app.hangulroute.com/signin?mode=create&persona=parent');
    expect(parents[2]?.href).toBe('https://app.hangulroute.com/signin?persona=parent');
    expect(linksOf(mainOf(render(TeachersPage)))[0]?.href).toBe('https://app.hangulroute.com/signin?mode=create&persona=teacher');
    const es = linksOf(mainOf(renderToStaticMarkup(<TeachersPage locale="es" />)));
    expect(es[0]?.href).toBe('https://app.hangulroute.com/signin?mode=create&persona=teacher&lang=es');
    expect(es[2]?.href).toBe('https://app.hangulroute.com/signin?persona=teacher&lang=es');
  });
});

describe('persona page modules hold no console, demo, account or billing path', () => {
  const files = [
    join('components', 'landing', 'LearnersPage.tsx'),
    join('components', 'landing', 'ParentsPage.tsx'),
    join('components', 'landing', 'TeachersPage.tsx'),
    join('components', 'landing', 'SiteHeader.tsx'),
    join('components', 'landing', 'SiteFooter.tsx'),
    join('components', 'landing', 'SiteShell.tsx'),
    join('components', 'landing', 'site-parts.tsx'),
    join('app', '(en)', 'learners', 'page.tsx'),
    join('app', '(loc)', '[locale]', 'learners', 'page.tsx'),
    ...['parents', 'teachers'].flatMap((page) => [join('app', '(en)', page, 'page.tsx'), join('app', '(loc)', '[locale]', page, 'page.tsx')]),
  ];
  it.each(files)('%s', (file) => {
    const source = readFileSync(join(webSrc, file), 'utf8');
    expect(source).not.toMatch(/['"`]\/(teach|parent|account|billing)\b/);
  });
});

describe('no free limits on the site (owner decision 2026-10-21)', () => {
  // The stand-alone free class cap is the one free limit no plan line shares (the Group License also holds 50). The
  // figure next to any word for a learner, or the number spelled out, counts as stating it.
  const freeClass: Record<'en' | 'es' | 'ko', RegExp> = {
    en: new RegExp(`\\b(${FREE_CLASS_STUDENT_CAP}|twenty) (students?|learners?|kids?|children|child|pupils?)\\b`, 'i'),
    es: new RegExp(`\\b(${FREE_CLASS_STUDENT_CAP}|veinte) (estudiantes?|alumn[oa]s?|niñ[oa]s?|aprendices|personas?)\\b`, 'i'),
    ko: new RegExp(`(${FREE_CLASS_STUDENT_CAP}|스무)\\s?(명|학생)`),
  };
  const states: ReadonlyArray<Readonly<SiteClaims>> = [SITE_CLAIMS, { ...SITE_CLAIMS, paidPlans: 'inApp' }, ALL_CLAIMS_ON, ALL_CLAIMS_OFF];

  it.each(['en', 'es', 'ko'] as const)('%s: no persona page or the home states the free class limit, in any claim state', (locale) => {
    for (const Page of [LearnersPage, ParentsPage, TeachersPage, HomePage]) {
      for (const claims of states) {
        expect(textOf(renderToStaticMarkup(<Page locale={locale} claims={claims} />)), `${locale} paidPlans ${claims.paidPlans}`).not.toMatch(
          freeClass[locale],
        );
      }
    }
  });

  it.each(['en', 'es', 'ko'] as const)('%s: About, Privacy and Terms do not state the free class limit either', (locale) => {
    for (const Page of [AboutPage, PrivacyPage, TermsPage]) {
      expect(textOf(renderToStaticMarkup(<Page locale={locale} />)), `${locale} ${Page.name}`).not.toMatch(freeClass[locale]);
    }
  });

  it('the guard matches the line it exists to keep out', () => {
    expect(`up to ${FREE_CLASS_STUDENT_CAP} students`).toMatch(freeClass.en);
    expect(`hasta ${FREE_CLASS_STUDENT_CAP} estudiantes`).toMatch(freeClass.es);
    expect(`최대 ${FREE_CLASS_STUDENT_CAP}명`).toMatch(freeClass.ko);
  });
});

describe('[SA] the plan sizes line (AMENDMENTS-SEATS-ADMINS section 4, SA-6)', () => {
  const pages = [
    ['/parents', ParentsPage],
    ['/teachers', TeachersPage],
  ] as const;
  const onSale: Readonly<SiteClaims> = { ...SITE_CLAIMS, paidPlans: 'inApp' };

  it.each(['en', 'es', 'ko'] as const)('%s: shown once on both grown-up pages while plans are on sale, in the Plans block', (locale) => {
    const l = getMessages(locale).landing;
    const sizes = l.plans.sizes(FAMILY_LIFETIME_LEARNERS, GROUP_LICENSE_LEARNERS);
    for (const [path, Page] of pages) {
      const html = renderToStaticMarkup(<Page locale={locale} claims={onSale} />);
      expect(count(textOf(mainOf(html)), sizes), `${locale} ${path}`).toBe(1);
      expect(linesOf(html, l.persona.plansTitle), `${locale} ${path}`).toEqual([l.plans.free.stage1, sizes, l.plans.managedInApp]);
    }
  });

  it.each(['en', 'es', 'ko'] as const)('%s: absent while plans are coming', (locale) => {
    const sizes = getMessages(locale).landing.plans.sizes(FAMILY_LIFETIME_LEARNERS, GROUP_LICENSE_LEARNERS);
    const coming: Readonly<SiteClaims> = { ...SITE_CLAIMS, paidPlans: 'coming' };
    for (const [path, Page] of pages) {
      expect(textOf(mainOf(renderToStaticMarkup(<Page locale={locale} claims={coming} />))), `${locale} ${path}`).not.toContain(sizes);
    }
  });

  it.each(['en', 'es', 'ko'] as const)('%s: never on /learners, whether plans are coming or on sale', (locale) => {
    const sizes = getMessages(locale).landing.plans.sizes(FAMILY_LIFETIME_LEARNERS, GROUP_LICENSE_LEARNERS);
    const states: ReadonlyArray<Readonly<SiteClaims>> = [{ ...SITE_CLAIMS, paidPlans: 'coming' }, onSale, ALL_CLAIMS_ON];
    for (const claims of states) {
      const html = renderToStaticMarkup(<LearnersPage locale={locale} claims={claims} />);
      expect(textOf(html), `${locale} paidPlans ${claims.paidPlans}`).not.toContain(sizes);
    }
  });

  it('the numbers come from content-schema: 4 learners in a family, 50 students on a Group License', () => {
    expect([FAMILY_LIFETIME_LEARNERS, GROUP_LICENSE_LEARNERS]).toEqual([4, 50]);
    expect(SIZES).toBe('The Family Plan is for up to 4 learners. The Group License is for up to 50 students in a class or a school.');
  });

  it('names no price and no term in any locale', () => {
    for (const locale of ['en', 'es', 'ko'] as const) {
      const sizes = getMessages(locale).landing.plans.sizes(FAMILY_LIFETIME_LEARNERS, GROUP_LICENSE_LEARNERS);
      expect(sizes, locale).not.toMatch(/[$€£₩]|\d+\.\d+|\b153\b|\bper\s+(year|month)\b|yearly|annual|lifetime|al año|anual|연간|매년|평생/i);
    }
  });
});

/** [SN] AMENDMENTS-SITE-NEWUSER §3.6 (SN-D8): "Use it across a whole school" on `/teachers`. */
describe('[SN] /teachers: the schools section', () => {
  const S = T.schools;
  const coming = render(TeachersPage, ALL_CLAIMS_OFF);

  it('sits after the media row and before Privacy for classes, four lines in order, with every claim off too', () => {
    const titles = sectionTitles(coming);
    expect(titles.indexOf(T.schools.title)).toBe(titles.indexOf(T.privacy.title) - 1);
    expect(linesOf(coming, S.title)).toEqual([S.space, S.admins(SCHOOL_ADMIN_CAP), S.moves, S.size(CONTACT_EMAIL)]);
    expect(linesOf(render(TeachersPage), S.title)).toEqual(linesOf(coming, S.title));
    const media = mainOf(render(TeachersPage)).indexOf('hr-site-media');
    expect(media).toBeGreaterThan(-1);
    expect(media).toBeLessThan(mainOf(render(TeachersPage)).indexOf('id="teachers-schools"'));
  });

  it('the administrator cap and the address come from their constants: 2 administrators, the contact address as plain text', () => {
    expect(SCHOOL_ADMIN_CAP).toBe(2);
    expect(S.admins(SCHOOL_ADMIN_CAP)).toContain('2 more administrators');
    expect(S.admins(1)).toContain('1 more administrator ');
    expect(S.size(CONTACT_EMAIL)).toBe(`Need room for more students? Write to ${CONTACT_EMAIL}.`);
    expect(S.size('x@example.org')).toBe('Need room for more students? Write to x@example.org.');
    const section = /<section[^>]*aria-labelledby="teachers-schools"[\s\S]*?<\/section>/.exec(mainOf(coming))?.[0] ?? '';
    expect(section).toContain(CONTACT_EMAIL);
    expect(section).not.toMatch(/<a\b/);
  });

  it('while plans are coming: no owner-plan line and the size line names no product (OD-SN-13); on sale: the owner-plan line after the administrators', () => {
    expect(textOf(mainOf(coming))).not.toContain(S.ownerPlan);
    expect(textOf(mainOf(coming))).not.toContain('School Contract');
    const onSale = render(TeachersPage, { ...ALL_CLAIMS_OFF, paidPlans: 'inApp' });
    expect(linesOf(onSale, S.title)).toEqual([S.space, S.admins(SCHOOL_ADMIN_CAP), S.ownerPlan, S.moves, S.size(CONTACT_EMAIL)]);
    expect(textOf(mainOf(onSale))).not.toContain(S.sizeContract(CONTACT_EMAIL));
  });

  // Owner decision (b) 2026-10-21 (OD-SN-11): no free-tier seat number on the site. `SCHOOL_LEARNER_CAP` also caps a
  // school with no licence, so the schools section states no seat figure in any locale, with plans coming or on sale.
  it.each(['en', 'es', 'ko'] as const)('%s: the schools section states no seat figure (owner decision (b))', (locale) => {
    expect(SCHOOL_LEARNER_CAP).toBe(50);
    for (const paidPlans of ['coming', 'inApp'] as const) {
      const html = render(TeachersPage, { ...ALL_CLAIMS_OFF, paidPlans }, locale);
      const section = /<section[^>]*aria-labelledby="teachers-schools"[\s\S]*?<\/section>/.exec(mainOf(html))?.[0] ?? '';
      expect(section, `${locale} ${paidPlans}`).not.toBe('');
      expect(textOf(section), `${locale} ${paidPlans}`).not.toMatch(new RegExp(`\\b${SCHOOL_LEARNER_CAP}\\b`));
    }
    const s = getMessages(locale).landing.persona.teachers.schools;
    for (const line of [s.size(CONTACT_EMAIL), s.sizeContract(CONTACT_EMAIL)]) expect(line).not.toMatch(/\d/);
  });

  it.each(['en', 'es', 'ko'] as const)('%s: no price, no plan term, no age word', (locale) => {
    const s = getMessages(locale).landing.persona.teachers.schools;
    for (const line of [s.title, s.space, s.admins(SCHOOL_ADMIN_CAP), s.ownerPlan, s.moves, s.size(CONTACT_EMAIL)]) {
      expect(line, `${locale}: ${line}`).not.toMatch(/[$€£₩]\s?\d|\bper\s+(year|month)\b|yearly|annual|lifetime|al año|anual|연간|매년|평생|\bkids?\b|\bchild(ren)?\b/i);
    }
  });
});

/** [SN] AMENDMENTS-SITE-NEWUSER §3.5, §3.6, §3.13: the captures of the grown-up pages follow their claims. */
describe('[SN] grown-up page captures follow their claims', () => {
  const imgs = (html: string): Array<{ src: string; alt: string }> =>
    [...mainOf(html).matchAll(/<img [^>]*src="([^"]*)"[^>]*alt="([^"]*)"/g)].map((m) => ({ src: m[1] ?? '', alt: decode(m[2] ?? '') }));
  const srcOf = (locale: 'en' | 'es' | 'ko', name: Parameters<typeof captureFile>[1]): string => captureFile(locale, name)?.src ?? 'missing';

  it('/parents today: the weekly report capture under Follow along, lazy, with its alt text', () => {
    const html = render(ParentsPage);
    expect(imgs(html)).toEqual([{ src: srcOf('en', 'report'), alt: t.captures.report }]);
    const follow = /<section[^>]*aria-labelledby="parents-follow"[\s\S]*?<\/section>/.exec(mainOf(html))?.[0] ?? '';
    expect(follow).toMatch(/<figure[\s\S]*<img [^>]*loading="lazy"/);
  });

  it('/teachers today: the class page (a phone crop below 45em) and the Lecture mode slide, two columns', () => {
    const page = render(TeachersPage);
    const html = mainOf(page);
    expect(imgs(page)).toEqual([
      { src: srcOf('en', 'class-list-narrow'), alt: t.captures.classList },
      { src: srcOf('en', 'lecture-slide'), alt: t.captures.lectureSlide },
    ]);
    expect(html).toContain(`<source media="(min-width: 45em)" srcSet="${srcOf('en', 'class-list')}"`);
    expect(html).toMatch(/class="hr-site-media hr-site-media-pair"/);
  });

  it('with every claim off: no report, class page or slide capture, and no empty media row', () => {
    expect(imgs(render(ParentsPage, ALL_CLAIMS_OFF))).toEqual([]);
    const teachersPage = render(TeachersPage, ALL_CLAIMS_OFF);
    const teachers = mainOf(teachersPage);
    expect(imgs(teachersPage)).toEqual([]);
    expect(teachers).not.toContain('hr-site-media');
    expect(teachers).not.toContain('<figure');
  });

  it('with lectureMode alone on, the slide alone takes the row; with teacherReports alone, the class page alone', () => {
    const slide = render(TeachersPage, { ...ALL_CLAIMS_OFF, lectureMode: true });
    expect(imgs(slide).map((img) => img.alt)).toEqual([t.captures.lectureSlide]);
    expect(mainOf(slide)).toMatch(/class="hr-site-media"/);
    const reports = render(TeachersPage, { ...ALL_CLAIMS_OFF, teacherReports: true });
    expect(imgs(reports).map((img) => img.alt)).toEqual([t.captures.classList]);
    expect(mainOf(reports)).toMatch(/class="hr-site-media"/);
  });

  it('parentReports alone draws the report and nothing on /teachers; teacherReports alone draws nothing on /parents', () => {
    expect(imgs(render(ParentsPage, { ...ALL_CLAIMS_OFF, parentReports: true })).map((img) => img.alt)).toEqual([t.captures.report]);
    expect(imgs(render(ParentsPage, { ...ALL_CLAIMS_OFF, teacherReports: true, lectureMode: true }))).toEqual([]);
  });

  it.each(['en', 'es', 'ko'] as const)('%s: a capture shows exactly where its claim line shows (CLAIM_LOCALES applies to pictures), in the page locale', (locale) => {
    expect(showsCapture(SITE_CLAIMS, 'report', locale)).toBe(showsClaim(SITE_CLAIMS, 'parentReports', locale));
    expect(showsCapture(SITE_CLAIMS, 'class-list', locale)).toBe(showsClaim(SITE_CLAIMS, 'teacherReports', locale));
    const html = renderToStaticMarkup(<ParentsPage locale={locale} />);
    const report = imgs(html).find((img) => img.src === srcOf(locale, 'report'));
    expect(Boolean(report)).toBe(showsClaim(SITE_CLAIMS, 'parentReports', locale));
    if (report) expect(report.alt).toBe(getMessages(locale).landing.captures.report);
  });
});
