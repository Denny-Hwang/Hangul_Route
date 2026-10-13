import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getMessages } from '@hangul-route/i18n';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LearnersPage } from '../../components/landing/LearnersPage';
import { ParentsPage } from '../../components/landing/ParentsPage';
import { TeachersPage } from '../../components/landing/TeachersPage';
import { ALL_CLAIMS_ON } from '../../data/__tests__/site-claims-fixtures';
import { siteGames } from '../../data/minigame-catalog';
import { SITE_CLAIMS, type SiteClaims } from '../../data/site-claims';
import { stage1Cards } from '../../data/stage1-cards';
import { learnerStart, signIn } from '../../lib/site-links';
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
  vi.stubEnv('CONSOLE_ORIGIN', '');
});
afterEach(() => vi.unstubAllEnvs());

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
    const on = renderToStaticMarkup(<LearnersPage locale="en" claims={{ ...SITE_CLAIMS, learningRoute: true }} />);
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
    expect(fold).not.toMatch(/<h2\b|<section\b/);
    expect(decode(fold)).not.toContain(t.cards.more);
    expect(decode(fold)).not.toContain(t.cards.eyebrow);
  });

  it('the games fold: the games without a speaking one, titles as h3 under the section h2, no heading, eyebrow or beta', () => {
    const fold = decode(new RegExp(`<details[^>]*>(?:(?!</details>)[\\s\\S])*?${esc(L.quest.gamesFold)}[\\s\\S]*?</details>`).exec(main)?.[0] ?? '');
    expect(fold).not.toBe('');
    expect(fold).not.toMatch(/<h2\b|<section\b/);
    expect(fold.match(/<h3\b/g)).toHaveLength(siteGames.length);
    for (const game of siteGames) expect(fold).toContain(`>${game.title}<`);
    expect(fold).not.toContain(t.games.title);
    expect(fold).not.toContain(t.games.body);
    expect(fold).not.toContain(t.games.beta);
    expect(fold).not.toMatch(/in beta/i);
  });

  it('every styled list keeps its list role (VoiceOver drops it with list-style: none)', () => {
    for (const m of main.matchAll(/<(ul|ol)\b([^>]*)>/g)) expect(m[2], m[0]).toContain('role="list"');
  });

  it('five folded questions, in order, each a native details', () => {
    const questions = [...main.matchAll(/<summary[^>]*><span[^>]*>([^<]*)<\/span><\/summary>/g)].map((m) => decode(m[1] ?? ''));
    expect(questions.slice(2)).toEqual([L.faq.signIn.q, L.faq.code.q, L.faq.offline.q, L.faq.adult.q, L.faq.korean.q]);
    for (const { a } of Object.values(L.faq)) expect(text).toContain(a);
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
    // TODO(F-SITE-002 S-6, OD-9): the Stage 1 card blurbs in the cards fold still carry audience wording, which S-6
    // rewords; only those blurbs are left out here, and S-6 removes this exclusion.
    const withoutBlurbs = stage1Cards.reduce((acc, card) => acc.split(card.blurb).join(' '), text);
    expect(withoutBlurbs).not.toMatch(/\bkids?\b|\bchild(ren)?\b|\bages? \d|\$\s?\d/i);
    expect(text).not.toMatch(/\bages? \d|\$\s?\d/i);
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
const render = (Page: typeof ParentsPage, claims?: Readonly<SiteClaims>): string => renderToStaticMarkup(<Page locale="en" claims={claims} />);

/** The Plans block both grown-up pages share (§3.5, §3.6): the paid line only while plans are coming; host named once. */
function expectPlans(html: string, paidPlans: SiteClaims['paidPlans']): void {
  const lines = linesOf(html, t.persona.plansTitle);
  expect(lines).toEqual(
    paidPlans === 'coming' ? [`${plans.free.stage1} ${plans.paid.coming}`, plans.managedInApp] : [plans.free.stage1, plans.managedInApp],
  );
  expect(lines.join(' ').match(/app\.hangulroute\.com/g)).toHaveLength(1);
  expect(textOf(mainOf(html))).not.toContain(plans.paid.inApp);
}

describe('/parents (S-4b)', () => {
  const html = render(ParentsPage);
  const main = mainOf(html);
  const text = textOf(main);
  const follow = [P.follow.reports, P.follow.route, P.follow.notes, P.follow.browse];

  it('renders exactly one h1, "For parents and caregivers", then the lead', () => {
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html).toMatch(new RegExp(`<h1[^>]*>${esc(P.title)}</h1>`));
    expect(text).toContain(P.lead);
  });

  it('primary action Sign in as a parent (/signin?persona=parent), then Start learning, and the closing action', () => {
    const links = linksOf(main);
    expect(links[0]).toEqual({ href: signIn('parent'), text: P.signIn });
    expect(links[1]).toEqual({ href: learnerStart('en'), text: t.nav.start });
    expect(links.at(-1)).toEqual({ href: signIn('parent'), text: P.signIn });
    expect(signIn('parent')).toBe('/signin?persona=parent');
    expect(main).toMatch(new RegExp(`<a href="${esc(signIn('parent'))}" class="hr-site-primary"`));
    expect(main).toMatch(new RegExp(`<a href="${esc(learnerStart('en'))}" class="hr-site-secondary"`));
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
  ] as const)('%s alone adds its one line', (claim, line) => {
    const on = render(ParentsPage, { ...SITE_CLAIMS, [claim]: true });
    expect(linesOf(on, P.follow.title)).toEqual([P.follow.body, line]);
  });

  it('browseAsLearner needs paid plans on sale: absent while coming, present with inApp', () => {
    expect(textOf(render(ParentsPage, { ...SITE_CLAIMS, browseAsLearner: true }))).not.toContain(P.follow.browse);
    const inApp = render(ParentsPage, { ...SITE_CLAIMS, browseAsLearner: true, paidPlans: 'inApp' });
    expect(linesOf(inApp, P.follow.title)).toEqual([P.follow.body, P.follow.browse]);
  });

  it('plans: both composed blocks, no price', () => {
    expectPlans(html, 'coming');
    expectPlans(render(ParentsPage, { ...SITE_CLAIMS, paidPlans: 'inApp' }), 'inApp');
    expect(text).not.toMatch(/[$€£]\s?\d|\d+\s?(USD|dollars?)\b|per (month|year)|lifetime/i);
  });

  it('three folded questions; "What can I see?" has its own answer, the reports variant with its claim', () => {
    const questions = [...main.matchAll(/<summary[^>]*><span[^>]*>([^<]*)<\/span><\/summary>/g)].map((m) => decode(m[1] ?? ''));
    expect(questions).toEqual([P.faq.account.q, P.faq.learnAlong.q, P.faq.whatSee.q]);
    expect(text).toContain(P.faq.account.a);
    expect(text).toContain('Learning Korean yourself? Play the same quests.');
    expect(text).toContain(P.faq.whatSee.a);
    expect(text).not.toContain(P.faq.whatSee.reports);
    const reports = textOf(render(ParentsPage, { ...SITE_CLAIMS, parentReports: true }));
    expect(reports).toContain(P.faq.whatSee.reports);
    expect(reports).not.toContain(P.faq.whatSee.a);
  });

  it('closing block: its own line labels it, then Sign in as a parent', () => {
    const closing = /<section aria-labelledby="([^"]+)" class="hr-site-closing"[^>]*>([\s\S]*?)<\/section>/.exec(main);
    expect(closing?.[2]).toMatch(new RegExp(`<p id="${closing?.[1]}"[^>]*>${esc(t.persona.closing.parents.replace(/'/g, '&#x27;'))}</p>`));
    expect(closing?.[2]).toContain(`href="${signIn('parent')}"`);
  });

  it('marks Parents as the current page; no ranking, no age range', () => {
    expect(html).toMatch(new RegExp(`<a [^>]*aria-current="page"[^>]*>${t.nav.parents}</a>`));
    expect(text).not.toMatch(/\bages? \d|\d+\s?(–|-|to)\s?\d+\s?years|leaderboard|ranking/i);
  });

  it('the en route renders the same page', () => {
    expect(renderToStaticMarkup(<EnParents />)).toBe(html);
  });
});

describe('/teachers (S-4b)', () => {
  const html = render(TeachersPage);
  const main = mainOf(html);
  const text = textOf(main);
  const classLines = [T.class.reports, T.class.route, T.class.notes, T.class.browse, T.class.lecture];

  it('renders exactly one h1, "For teachers", then the lead', () => {
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html).toMatch(new RegExp(`<h1[^>]*>${T.title}</h1>`));
    expect(text).toContain(T.lead);
  });

  it('primary action Sign in as a teacher (/signin?persona=teacher), secondary Try it as a learner, closing action', () => {
    const links = linksOf(main);
    expect(links[0]).toEqual({ href: signIn('teacher'), text: T.signIn });
    expect(links[1]).toEqual({ href: learnerStart('en'), text: T.tryIt });
    expect(links.at(-1)).toEqual({ href: signIn('teacher'), text: T.signIn });
    expect(signIn('teacher')).toBe('/signin?persona=teacher');
    expect(links).toHaveLength(3);
  });

  it('sections in order with every claim off; the plan and class sections side by side on wide screens', () => {
    expect(sectionTitles(html)).toEqual([T.setup.title, T.plan.title, T.class.title, T.privacy.title, t.persona.plansTitle, t.persona.faqTitle]);
    expect(main).toMatch(/class="hr-site-row-2"/);
    expect(main).not.toMatch(/<section[^>]*>\s*<h2[^>]*>[^<]*<\/h2>\s*<\/section>/);
  });

  it('set up in minutes: three numbered steps in one row on wide screens', () => {
    expect(linesOf(html, T.setup.title)).toEqual([T.setup.steps.space, T.setup.steps.code, T.setup.steps.devices]);
    expect(main).toMatch(/<ol class="hr-site-steps hr-site-steps-wide"/);
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
    expect(linesOf(render(TeachersPage, { ...SITE_CLAIMS, [claim]: true }), T.class.title)).toEqual([T.class.body, line]);
  });

  it('parentReports does not touch the teacher page', () => {
    expect(render(TeachersPage, { ...SITE_CLAIMS, parentReports: true })).toBe(html);
  });

  it('browseAsLearner needs paid plans on sale: absent while coming, present with inApp (with the plan words)', () => {
    expect(textOf(render(TeachersPage, { ...SITE_CLAIMS, browseAsLearner: true }))).not.toContain(T.class.browse);
    const inApp = render(TeachersPage, { ...SITE_CLAIMS, browseAsLearner: true, paidPlans: 'inApp' });
    expect(linesOf(inApp, T.class.title)).toEqual([T.class.body, T.class.browse]);
    expect(T.class.browse).toMatch(/class or school plan/);
  });

  it('plans: both composed blocks, no price', () => {
    expectPlans(html, 'coming');
    expectPlans(render(TeachersPage, { ...SITE_CLAIMS, paidPlans: 'inApp' }), 'inApp');
    expect(text).not.toMatch(/[$€£]\s?\d|per (month|year)|lifetime/i);
  });

  it('three folded questions with their answers', () => {
    const questions = [...main.matchAll(/<summary[^>]*><span[^>]*>([^<]*)<\/span><\/summary>/g)].map((m) => decode(m[1] ?? ''));
    expect(questions).toEqual([T.faq.students.q, T.faq.ranking.q, T.faq.try.q]);
    for (const { a } of Object.values(T.faq)) expect(text).toContain(a);
  });

  it('closing block: its own line labels it, then Sign in as a teacher', () => {
    const closing = /<section aria-labelledby="([^"]+)" class="hr-site-closing"[^>]*>([\s\S]*?)<\/section>/.exec(main);
    expect(closing?.[2]).toMatch(new RegExp(`<p id="${closing?.[1]}"[^>]*>${esc(t.persona.closing.teachers)}</p>`));
    expect(closing?.[2]).toContain(`href="${signIn('teacher')}"`);
  });

  it('marks Teachers as the current page', () => {
    expect(html).toMatch(new RegExp(`<a [^>]*aria-current="page"[^>]*>${t.nav.teachers}</a>`));
  });

  it('the en route renders the same page', () => {
    expect(renderToStaticMarkup(<EnTeachers />)).toBe(html);
  });
});

describe('a build with CONSOLE_ORIGIN set sends both grown-up actions to the app host', () => {
  it('Sign in as a parent / teacher go to https://app.hangulroute.com/signin?persona=…', () => {
    vi.stubEnv('CONSOLE_ORIGIN', 'https://app.hangulroute.com');
    expect(linksOf(mainOf(render(ParentsPage)))[0]?.href).toBe('https://app.hangulroute.com/signin?persona=parent');
    expect(linksOf(mainOf(render(TeachersPage)))[0]?.href).toBe('https://app.hangulroute.com/signin?persona=teacher');
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
