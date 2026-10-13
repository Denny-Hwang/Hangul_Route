import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getMessages } from '@hangul-route/i18n';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LearnersPage } from '../../components/landing/LearnersPage';
import { ALL_CLAIMS_ON } from '../../data/__tests__/site-claims-fixtures';
import { siteGames } from '../../data/minigame-catalog';
import { SITE_CLAIMS } from '../../data/site-claims';
import { stage1Cards } from '../../data/stage1-cards';
import { learnerStart } from '../../lib/site-links';
import EnLearners from '../(en)/learners/page';

/**
 * The persona pages (F-SITE-002 §3.4 to §3.6, appendix B; wireframes design/wireframes/site/learners.md, parents.md,
 * teachers.md; mock design/screens/site/persona-page.md). Each renders one h1 and its primary action from `site-links`,
 * is complete with every claim off (no empty section, no teaser), shows each claim line exactly once with its claim
 * on, and holds no console, demo or billing path. S-4a: `/learners`.
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

describe('persona page modules hold no console, demo, account or billing path', () => {
  const files = [
    join('components', 'landing', 'LearnersPage.tsx'),
    join('components', 'landing', 'SiteHeader.tsx'),
    join('components', 'landing', 'SiteFooter.tsx'),
    join('components', 'landing', 'SiteShell.tsx'),
    join('components', 'landing', 'site-parts.tsx'),
    join('app', '(en)', 'learners', 'page.tsx'),
    join('app', '(loc)', '[locale]', 'learners', 'page.tsx'),
  ];
  it.each(files)('%s', (file) => {
    const source = readFileSync(join(webSrc, file), 'utf8');
    expect(source).not.toMatch(/['"`]\/(teach|parent|account|billing)\b/);
  });
});
