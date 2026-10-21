import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATALOG, JAMO_SOUND_VALUES } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FIRST_LETTER, HomePage as Home } from '../../components/landing/HomePage';
import { ALL_CLAIMS_ON } from '../../data/__tests__/site-claims-fixtures';
import { SITE_CLAIMS } from '../../data/site-claims';
import { learnerStart } from '../../lib/site-links';
import HomePage from '../(en)/page';
import { withoutSwitcher } from './locale-switcher-html';

/**
 * The layered home `/` (F-SITE-002 §3.3, appendix B.1; wireframe design/wireframes/site/home.md; mock
 * design/screens/site/home-hero.md). L0 hero, then the persona chooser (`#who`), How it works, the three promise
 * titles, the cost line and the launch news, in that order; no questions block. Inline styles beat stylesheet rules,
 * so what changes at the 45em breakpoint (hero columns, persona columns, band padding) is pinned to `globals.css`;
 * the pixel checks (budgets, first screen, Tab order) run in Playwright over the static export
 * (`e2e/site-budgets.spec.ts`, `e2e/landing-layout.spec.ts`).
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
const css = readFileSync(join(here, '..', 'globals.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const t = getMessages('en').landing;
const H = t.home;

const decode = (s: string): string =>
  s.replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const textOf = (html: string): string => decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const mainOf = (html: string): string => /<main[^>]*>([\s\S]*)<\/main>/.exec(html)?.[1] ?? '';
const sectionTitles = (html: string): string[] =>
  [...mainOf(html).matchAll(/<section[^>]*>\s*<h2[^>]*>([^<]*)<\/h2>/g)].map((m) => decode(m[1] ?? ''));
/** The markup of the section with this id. */
const sectionById = (html: string, id: string): string => new RegExp(`<section id="${id}"[\\s\\S]*?</section>`).exec(html)?.[0] ?? '';
/** The rules of one `@media (min-width: …)` block, comments stripped. */
function mediaBlock(query: string): string {
  const start = css.indexOf(`@media (${query})`);
  let depth = 0;
  for (let i = css.indexOf('{', start); i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(start, i);
    }
  }
  return '';
}
const rule = (source: string, selector: string): string =>
  new RegExp(`(^|[\\s}])${esc(selector)}\\s*\\{([^}]*)\\}`).exec(source)?.[2]?.replace(/\s+/g, ' ').trim() ?? '';

const html = renderToStaticMarkup(<HomePage />);
const main = mainOf(html);
const text = textOf(main);

describe('the hero (L0)', () => {
  it('the page has one h1, the tagline, then the one-sentence lead', () => {
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html).toMatch(new RegExp(`<h1[^>]*>${esc(H.hero.title)}</h1>`));
    expect(H.hero.title).toBe(t.meta.tagline);
    expect(text).toContain(H.hero.lead);
  });

  it('Start learning is the primary action, to the learner app', () => {
    expect(main).toMatch(new RegExp(`<a href="${esc(learnerStart('en'))}" class="hr-site-primary"[^>]*>${H.hero.start}</a>`));
  });

  it('"Parent or teacher? Find your page" moves to #who, which takes focus', () => {
    expect(main).toMatch(new RegExp(`<a[^>]*href="#who"[^>]*>${esc(H.hero.grownUps)}</a>`));
    expect(main).toMatch(/<section id="who" tabindex="-1"/i);
  });

  it('the facts line, and Hoya waving as decorative art with the taught letter and its romanization in the bubble', () => {
    expect(text).toContain(H.hero.facts);
    expect(main).toMatch(/<div aria-hidden="true" class="hr-site-hero-art"[\s\S]*?<svg[^>]*data-pose="waving"/);
    // ㅏ: quest 1 (`quest:stage1-letters-q1`, "Meet a, eo, g, n") teaches it first (F-QUEST-002 §3.6).
    expect(FIRST_LETTER).toBe('ㅏ');
    const romanization = JAMO_SOUND_VALUES['ㅏ']?.[0] ?? '';
    expect(romanization).toBe('a');
    // The bubble keeps the letter and its romanization together with a no-break space; the text helper folds it.
    expect(H.hero.bubble('ㅏ', romanization)).toContain('ㅏ\u00a0(a)');
    expect(text).toContain(H.hero.bubble('ㅏ', romanization).replace(/\s+/g, ' '));
  });

  it('the bubble letter is the first letter quest 1 teaches, with its taught romanization (F-QUEST-002 §3.6)', () => {
    const first = CATALOG.quests.find((quest) => quest.id === 'quest:stage1-letters-q1');
    expect(first?.teaches[0]).toBe(FIRST_LETTER);
    expect(text).toContain(`${FIRST_LETTER} (${JAMO_SOUND_VALUES[FIRST_LETTER]?.[0]})`);
  });
});

describe('the blocks under the hero (L1)', () => {
  it('in order: who, how, the promises (hidden heading), cost, launch news; no questions block', () => {
    expect(sectionTitles(html)).toEqual([H.who.title, H.how.title, H.promises.label, t.plans.title, H.news.title]);
    expect(main).not.toContain('<details');
  });

  it('#who: three persona cards in a list, each one link to its page, named by title and line', () => {
    const who = sectionById(main, 'who');
    const cards = [...who.matchAll(/<li[^>]*>\s*<a [^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>\s*<\/li>/g)];
    expect(cards.map((m) => m[1])).toEqual(['/learners', '/parents', '/teachers']);
    const items = [H.who.items.learners, H.who.items.parents, H.who.items.teachers];
    cards.forEach((m, i) => {
      expect(textOf(m[2] ?? '').trim()).toBe(`${items[i]?.title} ${items[i]?.body}`);
    });
    // role="list" keeps an unstyled list a list for VoiceOver in Safari (as the S-4a parts do).
    expect(who).toMatch(/<ul role="list" class="hr-site-persona-list"/);
  });

  it('how it works: three numbered steps, title and line; the Learning Route line only with its claim', () => {
    const how = /<section[^>]*>\s*<h2[^>]*>How it works<\/h2>[\s\S]*?<\/section>/.exec(main)?.[0] ?? '';
    expect(how).toMatch(/<ol role="list"/);
    for (const step of Object.values(H.how.steps)) expect(textOf(how)).toContain(step.title);
    // Step 1's line names the level check while the `levelCheck` claim is on, as it is today (owner decision
    // 2026-10-21); landing-claims.test.tsx pins both states.
    expect(SITE_CLAIMS.levelCheck).toBe(true);
    expect(textOf(how)).toContain(H.how.levelBody);
    expect(textOf(how)).not.toContain(H.how.steps.start.body);
    expect(textOf(how)).toContain(H.how.steps.quests.body);
    expect(textOf(how)).toContain(H.how.steps.collect.body);
    expect(text).not.toContain(H.how.routeBody);
    const on = textOf(mainOf(renderToStaticMarkup(<Home locale="en" claims={{ ...SITE_CLAIMS, learningRoute: true }} />)));
    expect(on).toContain(H.how.routeBody);
    expect(on).not.toContain(H.how.steps.collect.body);
  });

  it('the promises: three titles, no body, "Child safety first" and no compliance claim (OD-4)', () => {
    const promises = /<section[^>]*>\s*<h2[^>]*>Our promises<\/h2>([\s\S]*?)<\/section>/.exec(main)?.[1] ?? '';
    expect([...promises.matchAll(/<li[^>]*>([^<]*)<\/li>/g)].map((m) => m[1])).toEqual([H.promises.items.ads, H.promises.items.safety, H.promises.items.noRed]);
    expect(promises).toMatch(/<ul role="list"/);
    expect(main).toMatch(/<h2[^>]*style="[^"]*position:absolute[^"]*"[^>]*>Our promises<\/h2>/);
    expect(textOf(html)).not.toMatch(/COPPA/);
  });

  it('the cost line: the free line then the paid line the claim picks, one paragraph, no price', () => {
    const cost = /<section[^>]*>\s*<h2[^>]*>What does it cost\?<\/h2>([\s\S]*?)<\/section>/.exec(main)?.[1] ?? '';
    expect(textOf(cost).trim()).toBe(`${t.plans.free.stage1} ${t.plans.paid.coming}`);
    const inApp = renderToStaticMarkup(<Home locale="en" claims={{ ...SITE_CLAIMS, paidPlans: 'inApp' }} />);
    expect(textOf(inApp)).toContain(`${t.plans.free.stage1} ${t.plans.paid.inApp}`);
    expect(textOf(inApp)).not.toContain(t.plans.paid.coming);
  });

  it('launch news (#news): the band with its heading, its line and the unchanged form', () => {
    const news = sectionById(main, 'news');
    expect(news).toMatch(/class="hr-site-news"/);
    expect(textOf(news)).toContain(H.news.body);
    expect(news).toMatch(/<input[^>]*id="waitlist-email"/);
    expect(news).toContain(t.waitlist.submit);
    // Links shared before S-5 point at the old waitlist anchor (hangulroute.com/#get); it still lands on the form.
    expect(news).toMatch(/<span id="get" aria-hidden="true"><\/span>/);
  });

  it('every claim on: still one h1, no section grows by more than its one line', () => {
    const all = renderToStaticMarkup(<Home locale="en" claims={ALL_CLAIMS_ON} />);
    expect(sectionTitles(all)).toEqual(sectionTitles(html));
  });
});

describe('the shared chrome on /', () => {
  it('the header (no current persona page) and the footer', () => {
    expect(html).toMatch(/<header class="hr-site-header"/);
    expect(withoutSwitcher(html)).not.toContain('aria-current="page"');
    expect(html).toMatch(/<footer/);
  });

  it('no link into the console, the demo or billing, and none of the old anchors', () => {
    expect(html).not.toMatch(/href="\/(teach|parent|account|billing)(\/|"|\?|#)/);
    expect(html).not.toMatch(/href="#(cards|games|parents|get)"/);
  });
});

describe('globals.css holds what changes at the breakpoint', () => {
  const wide = mediaBlock('min-width: 45em');

  it('the hero is one column on phones, text and art side by side from 45em', () => {
    expect(rule(css, '.hr-site-hero')).toContain('grid-template-columns: minmax(0, 1fr)');
    expect(rule(wide, '.hr-site-hero')).toContain('grid-template-columns: minmax(0, var(--hr-site-hero-ratio)) minmax(0, 1fr)');
    expect(rule(css, '.hr-site-hero-art')).toContain('max-width: var(--hr-site-hero-art-max)');
    expect(rule(wide, '.hr-site-hero-art')).toContain('max-width: var(--hr-site-hero-art-max-wide)');
  });

  it('the persona cards: one column on phones, three from 45em', () => {
    expect(rule(css, '.hr-site-persona-list')).toContain('grid-template-columns: minmax(0, 1fr)');
    expect(rule(wide, '.hr-site-persona-list')).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
  });

  it('on the launch-news band the focus ring is text.onPrimary (border.focus is under 3:1 on brand.primary)', () => {
    expect(rule(css, '.hr-site-news :focus-visible')).toContain('outline-color: var(--hr-site-on-primary)');
  });

  it('column templates are not set inline (the stylesheet must win)', () => {
    for (const className of ['hr-site-hero', 'hr-site-persona-list']) {
      const tag = new RegExp(`<[a-z]+[^>]*class="${className}"[^>]*>`).exec(html)?.[0] ?? '';
      expect(tag, className).not.toBe('');
      expect(tag).not.toContain('grid-template-columns');
    }
  });

  it('globals.css stays tokens-only: no colour literals', () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
  });

  it('globals.css keeps no rule of the old landing (F-SITE-002 S-6): no hr-landing-* class, no max-width query', () => {
    expect(css).not.toMatch(/\.hr-landing-/);
    expect(css).not.toMatch(/@media\s*\(max-width/);
  });
});

describe('Korean line breaks (F-I18N-001 PR 16)', () => {
  it('Korean wraps at spaces, never inside a word, and a long word still breaks instead of overflowing', () => {
    const korean = /:lang\(ko\)\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(korean).toMatch(/word-break:\s*keep-all/);
    expect(korean).toMatch(/overflow-wrap:\s*break-word/);
    // `anywhere` must come last: it lowers min-content so a flex or grid item holding a long Korean run
    // can still shrink at 200% text (WCAG 1.4.4 / 1.4.10); break-word stays only as the older-Safari fallback.
    expect(korean).toMatch(/overflow-wrap:\s*break-word;\s*overflow-wrap:\s*anywhere;?\s*$/);
  });
});

describe('site page modules hold no console, demo, account or billing literal (F-SITE-002 §3.8)', () => {
  const files = [
    join('components', 'landing', 'HomePage.tsx'),
    join('components', 'landing', 'AboutPage.tsx'),
    join('components', 'landing', 'PrivacyPage.tsx'),
    join('components', 'landing', 'TermsPage.tsx'),
    join('app', 'not-found.tsx'),
    ...['', 'about', 'privacy', 'terms'].flatMap((page) => [join('app', '(en)', page, 'page.tsx'), join('app', '(loc)', '[locale]', page, 'page.tsx')]),
  ];
  it.each(files)('%s', (file) => {
    expect(readFileSync(join(webSrc, file), 'utf8')).not.toMatch(/['"`]\/(teach|parent|account|billing)\b/);
  });
});
