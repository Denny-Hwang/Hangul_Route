import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CONTACT_EMAIL } from '../../data/contact';
import { minigameCatalog } from '../../data/minigame-catalog';
import { stage1Cards } from '../../data/stage1-cards';
// The pages are imported here, once, not inside each test: a page load pulls in the whole landing graph, and inside
// a test body it counted against the 5 s test timeout, which a busy CI runner exceeded. `vi.mock` below is hoisted
// above these imports, so the pages still load (and render) with the pseudo dictionary.
import AboutPage from '../(en)/about/page';
import LandingPage from '../(en)/page';
import PrivacyPage from '../(en)/privacy/page';
import TermsPage from '../(en)/terms/page';
import LearnersPage from '../(en)/learners/page';
import ParentsPage from '../(en)/parents/page';
import TeachersPage from '../(en)/teachers/page';

/**
 * F-I18N-001 PR 11a, §3.11: the site's pages take every word from `messages/*\/landing.ts`.
 * With the English dictionary swapped for its pseudo-localised copy (en-XA), every text node
 * and labelled attribute on the landing, About, Privacy, Terms and persona pages must be bracketed
 * pseudo text. What may stay as it is: content (heritage cards, mini-game titles and blurbs),
 * taught Korean and its romanization, the contact address, and decoration the page passes in.
 */
vi.mock('@hangul-route/i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@hangul-route/i18n')>();
  const pseudo = actual.pseudoLocalize(actual.getMessages('en'));
  return { ...actual, getMessages: (locale: Parameters<typeof actual.getMessages>[0]) => (locale === 'en' ? pseudo : actual.getMessages(locale)) };
});

const CONTENT: readonly string[] = [
  CONTACT_EMAIL,
  ...stage1Cards.flatMap((card) => [card.ko, card.romanization, card.title, card.en, card.blurb]),
  ...minigameCatalog.flatMap((game) => [game.title, game.blurb]),
];

const decode = (s: string): string =>
  s.replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

function wordsOf(html: string): string[] {
  const texts = html.replace(/<!-- -->/g, '').split(/<[^>]+>/).map(decode);
  const attrs = [...html.matchAll(/ (?:aria-label|placeholder|title|alt)="([^"]*)"/g)].map((match) => decode(match[1] ?? ''));
  return [...texts, ...attrs]
    .map((t) => t.trim())
    .filter((t) => !CONTENT.includes(t))
    .map((t) => t.replace(/^[^[A-Za-z]+|[^\]A-Za-z]+$/g, ''))
    .filter((t) => /[A-Za-z]/.test(t));
}

function render(Page: () => JSX.Element): string {
  return renderToStaticMarkup(<Page />);
}

describe('site pages render only dictionary text (en-XA)', () => {
  for (const [name, Page] of [
    ['landing', LandingPage],
    ['about', AboutPage],
    ['privacy', PrivacyPage],
    ['terms', TermsPage],
    ['learners', LearnersPage],
    ['parents', ParentsPage],
    ['teachers', TeachersPage],
  ] as const) {
    it(name, () => {
      const words = wordsOf(render(Page));
      expect(words.length).toBeGreaterThan(10);
      for (const w of words) expect(w, `"${w}" is not from the dictionary`).toMatch(/^\[[^\]]*\]$/);
    });
  }
});
