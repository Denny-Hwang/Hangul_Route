import { describe, expect, it } from 'vitest';
import { LOCALES } from '../locales';
import { findBannedWord } from '../banned';
import { pseudoLocalize, pseudoText } from '../pseudo';
import { getMessages } from '../resolve';
import { leafPaths, lookup } from '../tree';
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
  });

  it('heritage cards: counts per rarity, and the card label', () => {
    expect(l.cards.title(24)).toBe('24 Heritage Cards. One Korea, one card at a time.');
    expect(l.cards.body(24, 10, 8, 4, 2)).toBe(
      'Every letter you learn earns a real piece of Korean culture — a ramyeon bowl, a Chuseok moon, a swing from a Dano painting. Stage 1 ships 24 cards: 10 common, 8 uncommon, 4 rare, and 2 legendary.',
    );
    expect(l.cards.cardLabel('gangaji', 'Puppy')).toBe('Korean word gangaji, meaning Puppy');
  });

  it('mini-games: the beta count shows only when there is one', () => {
    expect(l.games.eyebrow(8, 1)).toBe('8 mini-games + 1 in beta');
    expect(l.games.eyebrow(9, 0)).toBe('9 mini-games');
  });

  it('Meet Hoya: the Korean phrase and its romanization are passed in', () => {
    expect(l.hoya.bubble('x', 'geoui da haesseo')).toBe('x · geoui da haesseo · almost there!');
    expect(l.hoya.points.wrong.body('x')).toBe('Hoya says “x” (almost there) on amber — never red.');
  });

  it('the footer year is a value', () => {
    expect(l.footer.copyright(2026)).toBe('© 2026 Hangul Route');
  });

  it('about: the contact address and the mark are passed in', () => {
    expect(l.about.feedback.body('hello@example.com')).toBe('Email hello@example.com — we read everything.');
    expect(l.about.promises.noRed('X')).toBe('No red X for wrong answers — Hoya nudges with amber.');
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
const KIDS_ONLY: readonly RegExp[] = [
  /\b5\s*[–-]\s*11\b/,
  /\bfor kids\b/i,
  /\bkids who\b/i,
  /\byour kid\b/i,
  /\bpara niños\b/i,
  /\bde 5 a 11 años\b/i,
  /어린이용/,
  /5\s*~\s*11\s*세/,
];

function outputs(tree: unknown, path: string): string[] {
  const value = lookup(tree, path);
  if (typeof value === 'function') return (SAMPLES[`landing.${path}`] ?? []).map((args) => (value as (...a: unknown[]) => string)(...args));
  if (Array.isArray(value)) return value.map(String);
  return [String(value)];
}

describe('landing: audience and anti-shame in every locale', () => {
  for (const locale of LOCALES) {
    it(`${locale}: no kids-only framing, no age range, no learner-banned word`, () => {
      const tree = getMessages(locale).landing;
      for (const path of leafPaths(tree)) {
        const outs = outputs(tree, path);
        expect(outs.length, `landing.${path} renders`).toBeGreaterThan(0);
        for (const out of outs) {
          for (const re of KIDS_ONLY) expect(re.test(out), `${path}: ${out}`).toBe(false);
          expect(findBannedWord(out, locale, 'learner'), out).toBeNull();
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
