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

describe('privacy: progress report lines (F-REPORT-001 RP-0b)', () => {
  const bullets = l.legal.privacy.sections.collect.bullets;

  it('extends the progress bullet with the day-by-day details and their limits', () => {
    expect(bullets.progress).toBe(
      "Learning progress: quests completed, stars earned, cards unlocked, streaks, and which jamo a learner recognizes — so the journey can resume and a parent can see progress. For progress reports we also keep: for the last 35 days, which days were practiced, with minutes, quests, cards and words for each day; monthly totals for up to 24 months; all-time totals since the first practice day; the day each stage was finished; the letters that became strong each day; the next lesson and one lesson to revisit; and the device's time zone, so days are counted in the learner's local time.",
    );
  });

  it('says who can see progress and reports, right after the progress bullet', () => {
    expect(bullets.progressWho).toBe(
      "Who can see progress and reports: the learner's family caregivers, who can also recover the full saved progress; the teacher of a class the learner joined; and the owner and admins of that class's school. A class sees day-by-day history only from the day the learner joined, and all-time totals without the first practice day.",
    );
    const keys = Object.keys(bullets);
    expect(keys.indexOf('progressWho')).toBe(keys.indexOf('progress') + 1);
  });
});

describe('legal: payment facts (F-SITE-002 S-7, OD-13; English-authoritative, flagged for counsel)', () => {
  const CHANNELS =
    'On the web, a grown-up pays through Stripe after signing in at app.hangulroute.com. In the iPhone and Android apps, purchases (when offered) go through the App Store or Google Play.';
  const WEB_RENEWAL =
    'Plans bought on the web (the Family Plan and the Group License) renew every year until cancelled. Cancel any time in Billing, under Manage subscription; the plan stays active until the end of the year already paid.';
  // BY-D4: a sponsored Group License (100%-off code, no card on file) lapses at the end of its year.
  const SPONSORED =
    'A Group License started with a code that makes its first year free needs no card; it ends when that year does unless a card is added under Manage subscription.';
  const privacy = l.legal.privacy.sections;
  const billing = l.legal.terms.sections.billing;

  it('Privacy Policy: payments name both channels, then the card promise for both', () => {
    expect(privacy.payments.paragraphs.p1).toBe(
      `${CHANNELS} We never see or store full card numbers — Stripe or the store handles payment. For each plan we keep the plan, its status and dates, the Stripe, store or contract reference ids, the number of seats on a school contract, any promotion code used, and a record of each payment and refund, and of any payment that did not go through (amount, currency, date and its reference id).`,
    );
    // One source for the channel sentence: the Terms carry the same string.
    expect(privacy.payments.paragraphs.p1.startsWith(billing.paragraphs.channels)).toBe(true);
  });

  it('Privacy Policy: third-party services list Stripe for the web, then the stores for in-app purchases', () => {
    expect(privacy.thirdParty.bullets.stripe).toBe(
      'Stripe — payments and subscription management for plans bought on the web. We give Stripe the email address the grown-up signed in with, for receipts, and the plan, our reference ids for it and any promotion code used, so each payment is matched to the right plan.',
    );
    expect(privacy.thirdParty.bullets.stores).toBe('Apple App Store / Google Play — payments and subscription management for in-app purchases.');
    expect(Object.keys(privacy.thirdParty.bullets)).toEqual(['stripe', 'stores', 'cloudflare', 'noTracking']);
  });

  it('Terms of Service: the channels and the web renewal (BY-D10) lead the billing section', () => {
    expect(billing.heading).toBe('Subscriptions, billing, and cancellation');
    expect(billing.paragraphs).toEqual({ channels: CHANNELS, webRenewal: WEB_RENEWAL, sponsored: SPONSORED });
    expect(Object.keys(billing.paragraphs)).toEqual(['channels', 'webRenewal', 'sponsored']);
  });

  it('Terms of Service: the web renewal names the console labels the grown-up sees, so a relabel breaks this test', () => {
    const consoleBilling = getMessages('en').console.billing;
    expect(consoleBilling.title).toBe('Billing');
    expect(consoleBilling.manage.cta).toBe('Manage subscription');
    expect(consoleBilling.planTitle.family_lifetime).toBe('Family Plan');
    expect(consoleBilling.planTitle.group_license).toBe('Group License');
    expect(WEB_RENEWAL).toContain(`in ${consoleBilling.title}, under ${consoleBilling.manage.cta};`);
    expect(WEB_RENEWAL).toContain(`(the ${consoleBilling.planTitle.family_lifetime} and the ${consoleBilling.planTitle.group_license})`);
    expect(SPONSORED).toContain(`under ${consoleBilling.manage.cta}.`);
  });

  it('Terms of Service: the store terms stay, each marked for in-app purchases, in their old order', () => {
    expect(billing.bullets).toEqual({
      premium: 'In-app purchases: when offered, premium content is an auto-renewing subscription billed through the Apple App Store or Google Play.',
      renews: 'In-app purchases: your subscription renews automatically unless you cancel at least 24 hours before the end of the current period.',
      manage: 'In-app purchases: manage or cancel anytime in your App Store or Google Play account settings.',
      refunds:
        'In-app purchases: refunds are handled by the store under its policy. A free trial, if offered, converts to a paid subscription unless cancelled before it ends.',
    });
    expect(Object.keys(billing.bullets)).toEqual(['premium', 'renews', 'manage', 'refunds']);
  });
});

describe('landing: the lines other PRs rely on stay byte-identical', () => {
  it('keeps the launch-news line of #get and the waitlist copy (#146)', () => {
    expect(l.get.body).toBe(
      "Hangul Route runs in your browser — open it, add it to your home screen, and it works offline. Leave your email and we'll send you the launch news.",
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
    // October 12, 2026: the backup sentences replace "until … sign in" (privacy-statements.test.ts).
    expect(l.legal.privacy.effective).toBe('Effective October 12, 2026');
    // October 12, 2026: the payment facts of F-SITE-002 S-7 (both channels, the web renewal, store terms marked in-app).
    expect(l.legal.terms.effective).toBe('Effective October 12, 2026');
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

describe('landing: offline claims stay qualified until the recordings ship (F-AUDIO-004 §3.12)', () => {
  it('says the app works offline and that letter sounds need a device voice for now', () => {
    expect(l.hero.facts).toBe('Nothing to download · No ads · Works offline after your first visit');
    expect(l.trust.items.offline).toEqual({
      title: 'Works offline',
      body: 'After your first visit the app opens without a connection. Letter sounds need a Korean voice on your device until our own recordings arrive.',
    });
    expect(l.parents.body).toContain('Bring it on a long flight — the app works offline after your first visit.');
  });

  it('never claims that sound plays offline', () => {
    const text = JSON.stringify({ hero: l.hero.facts, trust: l.trust, parents: l.parents.body, get: l.get.body });
    expect(text).not.toMatch(/plays offline|plays without a connection/i);
  });
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

