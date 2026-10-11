import { describe, expect, it } from 'vitest';
import { LOCALES, LOCALE_STATUS } from '../locales';
import { KIDS_ONLY_FRAMING } from '../audience';
import { pseudoLocalize, pseudoText } from '../pseudo';
import { fallbackPaths, getMessages } from '../resolve';
import { leafPaths, lookup } from '../tree';
import { landingBannedWord } from './landing-banned';
import { SAMPLES } from './samples';

// F-I18N-001 PR 11a: the site's copy (metadata, landing, about, privacy, terms, the waitlist
// form) moves into `messages/en/landing.ts`. English is the source and must render exactly
// what the pages hard-coded before (§3.4 rule 1); the pages' tests (landing-*.test.tsx,
// legal-copy.test.tsx, contact-email.test.tsx) pin the rendered pages, and the values below
// pin the sentences that now take an argument.
const l = getMessages('en').landing;

describe('landing: sentences that take a value render the former text', () => {
  it('hero: the taught letter is passed in, never written into the message', () => {
    expect(l.hero.lead('x')).toBe(
      'Hoya the tiger guides you from x to Chuseok — five-minute quests, plain-English instructions, and Korean culture cards to collect along the way. Kids, teens and grown-ups play the same quests. Played, not taught. Never a frown.',
    );
    expect(l.hero.bubble('x')).toBe("Annyeong! Let's meet x.");
    expect(l.hero.titleLines).toEqual(['Learn Hangul from zero —', 'at any age.']);
  });

  it('how it works: the card count comes from the content', () => {
    expect(l.how.steps.collect.body(24)).toBe('Earn 24 Heritage Cards in Stage 1 — from kimchi to Chuseok to the gayageum.');
    expect(l.how.steps.collect.body(1)).toBe('Earn 1 Heritage Card in Stage 1 — from kimchi to Chuseok to the gayageum.');
  });

  it('heritage cards: counts per rarity, and the card label', () => {
    expect(l.cards.title(24)).toBe('24 Heritage Cards. One Korea, one card at a time.');
    expect(l.cards.title(1)).toBe('1 Heritage Card. One Korea, one card at a time.');
    expect(l.cards.body(1, 1, 0, 0, 0)).toContain('Stage 1 ships 1 card: 1 common, 0 uncommon, 0 rare, and 0 legendary.');
    expect(l.cards.body(24, 10, 8, 4, 2)).toBe(
      'Every letter you learn earns a real piece of Korean culture — a ramyeon bowl, a Chuseok moon, a swing from a Dano painting. Stage 1 ships 24 cards: 10 common, 8 uncommon, 4 rare, and 2 legendary.',
    );
    expect(l.cards.cardLabel('gangaji', 'Puppy')).toBe('Korean word gangaji, meaning Puppy');
  });

  it('mini-games: the beta count shows only when there is one', () => {
    expect(l.games.eyebrow(8, 1)).toBe('8 mini-games + 1 in beta');
    expect(l.games.eyebrow(9, 0)).toBe('9 mini-games');
    expect(l.games.eyebrow(1, 0)).toBe('1 mini-game');
    expect(l.games.eyebrow(1, 2)).toBe('1 mini-game + 2 in beta');
  });

  it('Meet Hoya: the Korean phrase and its romanization are passed in', () => {
    expect(l.hoya.bubble('x', 'geoui da haesseo')).toBe('x · geoui da haesseo · almost there!');
    expect(l.hoya.points.wrong.body('x')).toBe('Hoya says “x” (almost there) on amber — never red.');
  });

  it('the footer year is a value', () => {
    expect(l.footer.copyright(2026)).toBe('© 2026 Hangul Route');
  });

  it('the locale switcher and the "View in" banner (PR 11c): the endonym is passed in', () => {
    expect(l.footer.language).toBe('Language');
    expect(l.localeBanner.label).toBe('Language suggestion');
    expect(l.localeBanner.viewIn('Español')).toBe('View in Español');
    expect(l.localeBanner.dismiss).toBe('Close');
    expect(l.localeBanner.close.cta).toBe('×');
  });

  it('about: the contact address is passed in; the "no red" promise says it in words', () => {
    expect(l.about.feedback.body('hello@example.com')).toBe('Email hello@example.com — we read everything.');
    expect(l.about.promises.noRed).toBe('No red X marks for wrong answers — Hoya nudges with amber.');
  });

  it('privacy and terms: the address and the level labels are passed in', () => {
    const values = { email: 'hello@example.com', levels: 'A / B' };
    expect(l.legal.privacy.sections.collect.bullets.profile(values)).toBe(
      'Learner profile: a display nickname and a starting level the learner picks (A / B). It describes how much the learner reads, not how old they are, and we do not need a birth date to use it. A real name is optional and only stored if a parent enters it.',
    );
    expect(l.legal.privacy.sections.emailList.paragraphs.removal(values)).toBe(
      'Removal and erasure: to be taken off the list, or to have your address erased, email hello@example.com from the address you signed up with and we will remove it.',
    );
    expect(l.legal.privacy.sections.contact.paragraphs.ask(values)).toBe('Questions about privacy? Email hello@example.com. We read everything.');
    expect(l.legal.terms.sections.contact.paragraphs.ask(values)).toBe('Questions about these terms? Email hello@example.com.');
  });
});

describe('landing: the lines other PRs rely on stay byte-identical', () => {
  it('keeps the launch-news line of #get and the waitlist copy (#146)', () => {
    expect(l.get.body).toBe(
      "Hangul Route runs in your browser — open it, add it to your home screen, and Stage 1 plays offline. Leave your email and we'll send you the launch news.",
    );
    expect(l.waitlist.submit).toBe('Send me the invite');
    expect(l.waitlist.consentLead).toBe(
      'We use your email only to send Hangul Route launch news. It is never sold or shared. To be removed, reply to any message or ',
    );
    expect(l.waitlist.success).toBe("You're on the list. We'll email you when Hangul Route launches.");
  });

  it('keeps the one cost line (owner decision 2026-10-10)', () => {
    expect(l.faq.items.cost.a).toBe('Stage 1 is free. More stages and classroom plans are coming. No ads.');
    expect(l.pricing.footnote).toBe('No third-party ads, ever.');
  });

  it('keeps the legal effective dates and the draft notice (#149)', () => {
    expect(l.legal.privacy.effective).toBe('Effective October 10, 2026');
    expect(l.legal.terms.effective).toBe('Effective May 22, 2026');
    expect(l.legal.draft).toBe('Draft for review. This document is a working draft pending review by qualified legal counsel before public launch.');
  });
});

// The landing is a public surface (CLAUDE.md §1): no kids-only framing and no age range, in any locale.
// One list (src/audience.ts), shared with apps/web audience-copy.test.ts.
describe('KIDS_ONLY_FRAMING catches kids-only framing and age ranges in every locale (self-check)', () => {
  const samples = ['Korean for kids', 'ages 5-11', 'a 5–7 year-old reading level', 'Coreano para niños', 'de 5 a 11 años', '어린이용 한글', '5~11세 어린이', '5～11세'];
  for (const sample of samples) {
    it(sample, () => expect(KIDS_ONLY_FRAMING.some(({ re }) => re.test(sample))).toBe(true));
  }
  it('passes copy for anyone, at any age', () => {
    expect(KIDS_ONLY_FRAMING.some(({ re }) => re.test('Learn Hangul from zero — at any age.'))).toBe(false);
  });
});

function outputs(tree: unknown, path: string): string[] {
  const value = lookup(tree, path);
  if (typeof value === 'function') return (SAMPLES[`landing.${path}`] ?? []).map((args) => (value as (...a: unknown[]) => string)(...args));
  if (Array.isArray(value)) return value.map(String);
  return [String(value)];
}

describe('landing: audience and anti-shame in every locale', () => {
  for (const locale of LOCALES) {
    it(`${locale}: no kids-only framing, no age range, no caregiver-banned word`, () => {
      const tree = getMessages(locale).landing;
      for (const path of leafPaths(tree)) {
        const outs = outputs(tree, path);
        expect(outs.length, `landing.${path} renders`).toBeGreaterThan(0);
        for (const out of outs) {
          for (const { name, re } of KIDS_ONLY_FRAMING) expect(re.test(out), `${path} (${name}): ${out}`).toBe(false);
          expect(landingBannedWord(out, locale, `landing.${path}`), out).toBeNull();
        }
      }
    });
  }
});

// en-XA (F-I18N-001 §3.11): every landing leaf, function messages included, survives pseudo-localisation.
describe('en-XA covers the landing keys', () => {
  const m = getMessages('en');
  const pseudo = pseudoLocalize(m);
  const paths = leafPaths(m).filter((p) => p.startsWith('landing.'));

  it('finds the landing leaves', () => {
    expect(paths.length).toBeGreaterThan(150);
  });

  for (const path of paths) {
    it(`${path} is bracketed and at least 40% longer`, () => {
      const value = lookup(pseudo, path);
      const source = lookup(m, path);
      const pairs: Array<[string, string]> = [];
      if (typeof value === 'string' && typeof source === 'string') pairs.push([value, source]);
      else if (Array.isArray(value) && Array.isArray(source)) value.forEach((v, i) => pairs.push([String(v), String(source[i])]));
      else if (typeof value === 'function' && typeof source === 'function') {
        const samples = SAMPLES[path];
        expect(samples, `function message ${path} needs a row in SAMPLES`).toBeDefined();
        for (const args of samples ?? []) pairs.push([(value as (...a: unknown[]) => string)(...args), (source as (...a: unknown[]) => string)(...args)]);
      } else throw new Error(`${path} is neither a string, an array nor a function`);
      for (const [out, src] of pairs) {
        expect(out).toBe(pseudoText(src));
        expect(out.length - 2).toBeGreaterThanOrEqual(Math.ceil(src.length * 1.4));
      }
    });
  }
});

/**
 * No emoji in rendered output (CLAUDE.md). Any Extended_Pictographic code point or the emoji
 * variation selector U+FE0F fails; the plain text symbols the site uses on purpose (©, ®, ™ in the
 * footer and legal text) are allowed, and arrows, the middle dot and dashes are not pictographic.
 */
const EMOJI = /(?![\u00A9\u00AE\u2122])\p{Extended_Pictographic}|\uFE0F/u;

describe('landing: no emoji in any locale (en, es, ko, en-XA)', () => {
  it('the check catches emoji and lets the text symbols through (self-check)', () => {
    for (const bad of ['\u{1F42F}', '\u274C', '\u270D\uFE0F', '\u2714', '\u{1F3AF}']) expect(EMOJI.test(bad), bad).toBe(true);
    for (const ok of ['© 2026', '™', '←', '→', '·', '—', '★', 'ㄱ']) expect(EMOJI.test(ok), ok).toBe(false);
  });

  const trees: Array<[string, object]> = [
    ...LOCALES.map((locale): [string, object] => [locale, getMessages(locale).landing]),
    ['en-XA', pseudoLocalize(getMessages('en')).landing],
  ];
  for (const [name, tree] of trees) {
    it(name, () => {
      const paths = leafPaths(tree);
      expect(paths.length).toBeGreaterThan(150);
      for (const path of paths) {
        for (const out of outputs(tree, path)) expect(EMOJI.test(out), `landing.${path}: ${out}`).toBe(false);
      }
    });
  }
});

/**
 * PR 11c: the words a visitor sees on a locale's own pages before reading anything else are written in that
 * locale (`lang` is set to it): the banner offering it, the switcher's heading and the legal notice. Shipping a
 * locale whose overlay leaves them in English would put English under `lang="es"`, read with a Spanish voice.
 */
describe('a shipped locale has its own language words, not the English fallback', () => {
  const REQUIRED = ['landing.localeBanner.', 'landing.footer.language', 'landing.legal.englishAuthoritative'];
  it.each(LOCALES.filter((locale) => locale !== 'en'))('%s', (locale) => {
    const missing = fallbackPaths(locale).filter((path) => REQUIRED.some((prefix) => path.startsWith(prefix)));
    // While hidden the overlay may still be empty; flipping LOCALE_STATUS (PR 15 / 16) without these words fails here.
    expect(LOCALE_STATUS[locale] === 'hidden' || missing.length === 0, `${locale} is shipped but falls back to English for: ${missing.join(', ')}`).toBe(true);
  });

  it('the required paths exist in English', () => {
    const l = getMessages('en').landing;
    expect(Object.keys(l.localeBanner).length).toBeGreaterThan(0);
    expect(l.footer.language).toBe('Language');
    expect(l.legal.englishAuthoritative).toBe('This document is shown in English. The English version is the one that applies.');
  });
});

