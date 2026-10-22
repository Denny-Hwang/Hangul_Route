import { describe, expect, it } from 'vitest';
import { LOCALES, LOCALE_STATUS } from '../locales';
import { KIDS_ONLY_FRAMING } from '../audience';
import { pseudoLocalize, pseudoText } from '../pseudo';
import { fallbackPaths, getMessages } from '../resolve';
import { leafPaths, lookup } from '../tree';
import { STALE_SITE_WORDS, landingBannedWord } from './landing-banned';
import { SAMPLES } from './samples';

// F-I18N-001 PR 11a: the site's copy (metadata, landing, about, privacy, terms, the waitlist
// form) moves into `messages/en/landing.ts`. English is the source and must render exactly
// what the pages hard-coded before (§3.4 rule 1); the pages' tests (landing-*.test.tsx,
// legal-copy.test.tsx, contact-email.test.tsx) pin the rendered pages, and the values below
// pin the sentences that now take an argument.
const l = getMessages('en').landing;

describe('landing: sentences that take a value render the former text', () => {
  it('heritage cards: the card label takes the romanization and the meaning', () => {
    expect(l.cards.cardLabel('gangaji', 'Puppy')).toBe('Korean word gangaji, meaning Puppy');
  });

  // site-learners-l10n: the /learners games fold reads each title and blurb from the dictionary, in every UI locale.
  it('mini-games: one title and blurb per Stage 1 kind the site lists, in en, es and ko', () => {
    const kinds = ['listen-pick', 'match-sound', 'build-letter', 'pic-word-match', 'trace-stroke', 'odd-one-out', 'culture-quiz', 'story-sequence'];
    for (const locale of ['en', 'es', 'ko'] as const) {
      const items = getMessages(locale).landing.games.items;
      expect(Object.keys(items), locale).toEqual(kinds);
      for (const kind of kinds) {
        const { title, blurb } = items[kind as keyof typeof items];
        expect(title.trim().length, `${locale} ${kind}`).toBeGreaterThan(0);
        expect(blurb.trim().length, `${locale} ${kind}`).toBeGreaterThan(0);
        if (locale !== 'en') {
          expect(title, `${locale} ${kind}`).not.toBe(l.games.items[kind as keyof typeof items].title);
          expect(blurb, `${locale} ${kind}`).not.toBe(l.games.items[kind as keyof typeof items].blurb);
        }
      }
    }
    // No timer on any of them (Culture Quiz has none), and no speaking line.
    for (const { blurb } of Object.values(l.games.items)) expect(blurb).not.toMatch(/\bseconds?\b|\btimer\b|\bsay\b|\bspeak/i);
  });

  it('the level-check lines name the app\'s button label word for word, in every UI locale', () => {
    for (const locale of ['en', 'es', 'ko'] as const) {
      const m = getMessages(locale);
      expect(m.landing.persona.learners.faq.level.a, locale).toContain(m.learner.placement.invite.knowSome);
      expect(m.landing.home.how.levelBody.trim().length, locale).toBeGreaterThan(0);
    }
    expect(l.persona.learners.faq.level).toEqual({
      q: 'I already know some Hangul. Do I have to start at the beginning?',
      a: 'No. When you start, tap “I already know some Korean” and take a level check. Hoya suggests where to begin.',
    });
    expect(l.home.how.levelBody).toBe('Pick a name and a Hoya. A level check is optional.');
    expect(l.persona.learners.after).toEqual({
      title: 'After the alphabet',
      body: 'Words, short sentences, conversations and heritage stories, in the same five-minute quests.',
    });
    // Placement is a level check, never a "test", in the English copy.
    expect(JSON.stringify([l.persona.learners.faq.level, l.home.how.levelBody])).not.toMatch(/\btest\b|\bplacement\b/i);
  });

  it('the footer year is a value', () => {
    expect(l.footer.copyright(2026)).toBe('© 2026 Hangul Route');
  });

  it('the locale switcher and the "View in" banner (PR 11c): the endonym is passed in', () => {
    expect(l.footer.language).toBe('Language');
    expect(l.localeBanner.label).toBe('Language suggestion');
    expect(l.localeBanner.viewIn('Español')).toBe('View in Español');
    // Spanish writes a language name in lower case after "en".
    expect(getMessages('es').landing.localeBanner.viewIn('Español')).toBe('Ver en español');
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
      // AMENDMENTS-SITE-NEWUSER SN-2: the level check can suggest the level; placement.start, item_answered, complete,
      // skipped and override_applied go up as usage events (apps/mobile/src/logic/placement/events.ts), and the full
      // result is backed up in the sync snapshot (Codex review on #804, P1).
      "Learner profile: a display nickname and a starting level the learner picks or a short level check suggests (A / B). It describes how much the learner reads, not how old they are, and we do not need a birth date to use it. A real name is optional and only stored if a parent enters it. If the learner takes the level check, it sends us usage events. When it starts: where it was started, its language and length, whether the sound guide shows by itself or after a tap, and the learner's starting level. For each answer: which question it was and which part of the check it belongs to, how it was answered (right, wrong or not sure), whether the sound guide was used, whether the sound could play, and how long it took. When it ends: the level it suggests for reading and for listening, whether the learner reached the highest level the check measures, how many of the five skills it checks are secure, its length, how many questions were asked and why it stopped. We also note when the check is skipped and from which screen, and when a grown-up picks a different start. Each event carries the learner's id and the time it happened. The finished result is saved with the learner's progress and backed up to our servers with it; the app keeps the 10 most recent. Each result has an id and holds every answer (which question, which choice was picked, recorded by its id and not its words, whether it was right, wrong or not sure, whether the sound guide was used, whether the sound could play, and how long it took); how the learner did in each part of the check and in each of the five skills; the suggested levels, whether the learner reached the highest level the check measures, the first lesson, the lessons the learner can skip, up to three letters or skills to practice first, and whether the suggested level is outside the learner's plan; when the check started and ended, where it was started, its language, length and settings, and which versions of the questions and lessons it used; why the learner is learning Korean, if they picked a reason; why it stopped; and, if a grown-up picked a different start, that start and when. A short summary of the newest result (when it was taken, the suggested levels, the five skills, whether the learner reached the highest level and whether a grown-up changed the start) is saved with the learner's progress reports.",
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
      // [TV] AMENDMENTS-TEACHER-VISIBILITY-TRANSFER TV-D14: the owner's decision of 2026-10-14
      "Who can see progress and reports: the learner's family caregivers, who can also recover the full saved progress, see all of it, words included. Once the family has read a short update about classes in the app or the console, the teacher of a class the learner joined, and the owner and admins of that class's school, see the same progress, words included, and whether the learner gets notes from the class. We record when that update was read and whether it was read in the console or on the learner's device. Until then a class sees what it saw before: day-by-day history only from the day the learner joined, all-time totals without the first practice day, and no words.",
    );
    const keys = Object.keys(bullets);
    expect(keys.indexOf('progressWho')).toBe(keys.indexOf('progress') + 1);
  });
});

describe('privacy: notes from grown-ups (F-FEEDBACK-001 section 8.7, FB-13; English-authoritative)', () => {
  const bullets = l.legal.privacy.sections.collect.bullets;
  const values = { email: 'hello@hangulroute.com', levels: 'A / B' };

  it('says who can send, the only answer, what a teacher and the family see, take back, how long notes are kept, and how to hide, report, stop and delete', () => {
    expect(typeof bullets.notes).toBe('function');
    expect(bullets.notes(values)).toBe(
      "Notes from grown-ups: the learner's family, and the teacher of a class the learner joined, can send the learner short notes that start from a set of reviewed messages. In a family, only the family owner and the adults the owner allows can send. The learner cannot write back: they can only pick one of four fixed answers, such as \"Thank you\". A teacher sees the notes sent in their class and, unless the family limits class notes, that answer, but never whether a note was opened. The learner's family caregivers see every note to the learner, and which family adult sent a note from home, and can hide or report a note or stop notes from one sender. A note can also be put away or reported from the learner's device. A sender can take a note back at any time: it leaves the learner's devices, and the learner's family can still see it. We keep notes for 180 days, and a reported note until 90 days after its last report so we can review it. To have a note deleted sooner, the learner's family can email hello@hangulroute.com.",
    );
  });

  it('comes right after who can see progress, and has no es or ko leaf (English-authoritative)', () => {
    const keys = Object.keys(bullets);
    expect(keys.indexOf('notes')).toBe(keys.indexOf('progressWho') + 1);
    expect(fallbackPaths('es').some((path) => path.includes('collect.bullets.notes'))).toBe(false);
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
  // [SA] AMENDMENTS-SEATS-ADMINS section 4 (SA-6): the learners each plan holds, before Stripe Live.
  // SN-2: then the school administrators an owner can invite (owner decision 2026-10-21 (b): no free seat numbers).
  const SIZES =
    'The Family Plan covers one family with up to 4 learners. The Group License covers one class or one school with up to 50 students; a school also holds up to 10 teachers. A School Contract can cover more. When a family, class or school already has the most learners its plan holds, new learners cannot join until a place opens; nobody already in it is removed because of the limit. A school owner can also invite up to 2 administrators.';
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
    expect(billing.paragraphs).toEqual({ channels: CHANNELS, webRenewal: WEB_RENEWAL, sponsored: SPONSORED, sizes: SIZES });
    // [SA] SA-6: what each plan holds follows the renewal paragraphs (landing-plan-sizes.test.ts pins its numbers).
    expect(Object.keys(billing.paragraphs)).toEqual(['channels', 'webRenewal', 'sponsored', 'sizes']);
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

/**
 * AMENDMENTS-SITE-NEWUSER SN-2: facts in the Privacy Policy and the Terms that had fallen behind the app. English-
 * authoritative (L10): es and ko show this English. No claim of legal review; the draft banner is gone (owner decision
 * 2026-10-21 (c)), and nothing says a legal review happened or is pending.
 */
describe('legal: SN-2 accuracy (English-authoritative)', () => {
  const privacy = l.legal.privacy.sections;

  it("the account contact is the sign-in email of a parent, teacher or school administrator; the school's receipts go to its payer only", () => {
    // Codex review on #804 (P2): an administrator cannot reach the checkout, portal or receipts of the school they
    // administer (space-seats.test.ts); the same account may still pay for its own family or class plan.
    expect(privacy.collect.bullets.contact).toBe(
      "Account contact: the email a parent, teacher or school administrator signs in with, used for sign-in and account recovery. The email of the grown-up who buys a plan is also used for that plan's receipts. A school administrator cannot buy or manage the school's plan, so their email is not used for the school's receipts.",
    );
  });

  it('no voice is recorded: no voice mini-game ships, and the site promises no speaking', () => {
    expect(privacy.never.bullets.media).toBe('No contacts, photos, or microphone audio leave the device. The app does not record your voice.');
    expect(privacy.never.bullets.media).not.toMatch(/voice mini-game|process speech/i);
  });

  it('both documents point at the date at the top, where the page shows it', () => {
    expect(privacy.changes.paragraphs.p1).toBe(
      'If we make a material change, we will notify parents in the app or by email before it takes effect. The date at the top shows the current version.',
    );
    expect(l.legal.terms.sections.changes.paragraphs.p1).toBe(
      'If we make material changes, we will notify parents in the app or by email before they take effect. The date at the top shows the current version.',
    );
  });

  it('a school has up to three grown-ups with admin rights: the owner and two administrators', () => {
    expect(privacy.collect.bullets.schoolAdmins.startsWith(
      "A school's owner can add up to two administrators with an invite link, so a school has up to three grown-ups with admin rights. Administrators see",
    )).toBe(true);
  });

  it('claims no legal review, and es and ko keep the English text (L10)', () => {
    const text = JSON.stringify([l.legal.privacy, l.legal.terms, l.meta.pages, l.notFound]);
    expect(text).not.toMatch(/reviewed by (a )?(lawyer|counsel|attorney)|legally reviewed|native speaker|expert[- ]reviewed/i);
    // Owner decision 2026-10-21 (c): no draft banner and no line that a legal review is pending.
    expect(text).not.toMatch(/\bdraft\b|legal counsel|pending review|confirmed with (legal )?counsel/i);
    expect(Object.keys(l.legal)).toEqual(['backHome', 'englishAuthoritative', 'privacy', 'terms']);
    for (const locale of ['es', 'ko'] as const) {
      const legal = getMessages(locale).landing.legal;
      expect(legal.privacy.sections.collect.bullets.contact).toBe(privacy.collect.bullets.contact);
      expect(legal.terms.sections.changes.paragraphs.p1).toBe(l.legal.terms.sections.changes.paragraphs.p1);
    }
  });
});

/** AMENDMENTS-SITE-NEWUSER §3.14 and appendix A (row SN-2): the share image's alt text in each locale. */
describe('landing.captures.og: the share image alt text (SN-2)', () => {
  it('names Hoya and the words the image shows, the brand and the tagline passed in', () => {
    expect(l.captures.og('Hangul Route', l.meta.tagline)).toBe('Hoya the tiger next to the words Hangul Route: Learn Hangul from zero, at any age.');
    const es = getMessages('es').landing;
    expect(es.captures.og('Hangul Route', es.meta.tagline)).toBe('Hoya, el tigre, junto a las palabras Hangul Route: Aprende hangul desde cero, a cualquier edad.');
    const ko = getMessages('ko').landing;
    expect(ko.captures.og('Hangul Route', ko.meta.tagline)).toBe('호랑이 호야와 Hangul Route 로고. 문구: 나이와 상관없이, 한글을 처음부터 배워요.');
  });

  it('types neither the brand nor a tagline into the message, in any locale', () => {
    for (const locale of ['en', 'es', 'ko'] as const) {
      const out = getMessages(locale).landing.captures.og('{B}', '{T}');
      expect(out, locale).toContain('{B}');
      expect(out, locale).toContain('{T}');
      expect(out, locale).not.toMatch(/Hangul Route|hangulroute/i);
    }
  });
});

describe('landing: the lines other PRs rely on stay byte-identical', () => {
  it('keeps the waitlist consent line byte-identical (#146, CONSENT_TEXT_VERSION); the band speaks of launch news only', () => {
    expect(l.waitlist.consentLead).toBe(
      'We use your email only to send Hangul Route launch news. It is never sold or shared. To be removed, reply to any message or ',
    );
    // F-SITE-002 site facts (2026-10-21): the app is live, so the band no longer reads as pre-launch.
    expect(l.waitlist.submit).toBe('Get launch news');
    expect(l.waitlist.success).toBe("You're on the list. We'll email you when family and class plans launch.");
    expect(l.home.news.title).toBe('Launch news by email');
    expect(l.home.news.body).toBe("We'll email you when family and class plans launch. Nothing else.");
  });

  it('keeps the es and ko consent lines byte-identical too', () => {
    expect(getMessages('es').landing.waitlist.consentLead).toBe(
      'Usamos tu correo solo para enviarte noticias del lanzamiento de Hangul Route. Nunca lo vendemos ni lo compartimos. Para darte de baja, responde a cualquier mensaje o ',
    );
    expect(getMessages('ko').landing.waitlist.consentLead).toBe(
      '이메일은 Hangul Route 출시 소식을 보내는 데에만 써요. 절대 팔거나 공유하지 않아요. 그만 받으려면 아무 메일에나 답장하거나 ',
    );
  });

  it('keeps the cost words price-free (owner decision 2026-10-10, F-SITE-002 §3.9)', () => {
    expect(l.plans.free.stage1).toBe('Stage 1 is free.');
    expect(JSON.stringify(l.plans)).not.toMatch(/[$€£₩]|\d+\s*(USD|dollars?)|lifetime/i);
  });

  it('keeps the legal effective dates (#149)', () => {
    // October 12, 2026: the backup sentences replace "until … sign in" (privacy-statements.test.ts).
    // October 20, 2026 ([SA] AMENDMENTS-SEATS-ADMINS section 6.7): the school administrators bullet.
    // October 22, 2026 (SN-2): the fact fixes and the draft banner removed (owner decision 2026-10-21 (c)).
    expect(l.legal.privacy.effective).toBe('Effective October 22, 2026');
    // October 12, 2026: the payment facts of F-SITE-002 S-7 (both channels, the web renewal, store terms marked in-app).
    // October 14, 2026 ([TV] TV-D14): who sees progress, class moves and the Classes and teachers section, as the owner's decision.
    // October 20, 2026 ([SA] SA-6): the Terms say how many learners each plan holds; the Privacy Policy is unchanged.
    // October 22, 2026 (SN-2): the fact fixes and the draft banner removed, as the Privacy Policy.
    expect(l.legal.terms.effective).toBe('Effective October 22, 2026');
    expect('draft' in l.legal).toBe(false);
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
  it('says the app works offline on most devices and that letter sounds may need a device voice', () => {
    expect(l.home.hero.facts).toMatch(/offline on most devices after your first visit/);
    expect(l.persona.learners.faq.offline.a).toMatch(/Letter sounds may need a Korean voice installed on your device/);
  });

  it('never claims that sound plays offline', () => {
    expect(JSON.stringify({ home: l.home, persona: l.persona })).not.toMatch(/plays offline|plays without a connection/i);
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


/**
 * F-SITE-002 site facts (2026-10-21): the site says what the app does today. No locale brings back an older
 * version's words (`STALE_SITE_WORDS`: the multiplication gate, the invite, "when Hangul Route launches",
 * "nothing to install", a romanized greeting), and the English uses US spelling ("practice", never "practise").
 */
describe('landing: no words of an older site, in any locale', () => {
  it('the check catches the old words (self-check)', () => {
    for (const bad of [
      'Parent-gate behind multiplication',
      'Control para adultos con una multiplicación',
      '곱셈 문제로 된 부모 확인 장치',
      'Send me the invite',
      'Quiero la invitación',
      '초대 받기',
      "We'll email you when Hangul Route launches.",
      'cuando Hangul Route se lance',
      'Hangul Route가 출시되면',
      'Nothing to install',
      'No hay que instalar nada',
      '설치할 것이 없어요',
      'Annyeong!',
    ]) {
      expect(STALE_SITE_WORDS.test(bad), bad).toBe(true);
    }
    expect(STALE_SITE_WORDS.test("We'll email you when family and class plans launch.")).toBe(false);
  });

  for (const locale of LOCALES) {
    it(`${locale}: no stale word outside the legal documents`, () => {
      const tree = getMessages(locale).landing;
      for (const path of leafPaths(tree).filter((p) => !p.startsWith('legal.'))) {
        for (const out of outputs(tree, path)) expect(STALE_SITE_WORDS.test(out), `landing.${path}: ${out}`).toBe(false);
      }
    });
  }

  it('en: US spelling, "practice" and "practiced", never "practise"', () => {
    const tree = getMessages('en').landing;
    for (const path of leafPaths(tree)) {
      for (const out of outputs(tree, path)) expect(out, `landing.${path}`).not.toMatch(/practis/i);
    }
    expect(l.home.who.items.parents.body).toContain('what your learner practices');
    expect(l.persona.teachers.class.body).toContain('who practiced');
  });

  it('the grown-up PIN, not a gate puzzle, guards money and deletion (PinEntryScreen replaced the v1.0 math gate)', () => {
    const PIN = {
      en: 'A grown-up PIN guards anything that costs money or deletes data.',
      es: 'Un PIN de adultos protege todo lo que cuesta dinero o borra datos.',
      ko: '돈이 드는 일이나 데이터를 지우는 일은 어른용 PIN이 지켜요.',
    } as const;
    for (const locale of LOCALES) {
      const m = getMessages(locale).landing;
      expect(m.about.promises.gate, locale).toBe(PIN[locale]);
      expect(m.persona.parents.safe.bullets.gate, locale).toBe(PIN[locale]);
    }
  });

  it('names all three UI languages where it says what the menus are in', () => {
    const NAMES = { en: ['English', 'Spanish', 'Korean'], es: ['inglés', 'español', 'coreano'], ko: ['영어', '스페인어', '한국어'] } as const;
    for (const locale of LOCALES) {
      const m = getMessages(locale).landing;
      for (const name of NAMES[locale]) {
        expect(m.about.promises.plainEnglish, locale).toContain(name);
        expect(m.persona.learners.faq.korean.a, locale).toContain(name);
      }
      expect(m.about.promises.plainEnglish, locale).not.toMatch(/CEFR/);
    }
  });

  it('says every taught Korean word comes with its romanization and meaning, in every locale', () => {
    expect(l.persona.learners.faq.korean.a).toContain('romanization and meaning');
    expect(getMessages('es').landing.persona.learners.faq.korean.a).toContain('romanización y su significado');
    expect(getMessages('ko').landing.persona.learners.faq.korean.a).toContain('로마자 표기와 뜻');
    // The /about promise under the three-language line says the same (review of #806): with a Korean UI, "Korean is only
    // used for the content being taught" would contradict the line above it.
    expect(l.about.promises.koreanTaught).toBe('Every Korean word you learn comes with its romanization and meaning.');
    expect(getMessages('es').landing.about.promises.koreanTaught).toBe('Cada palabra coreana que aprendes viene con su romanización y su significado.');
    expect(getMessages('ko').landing.about.promises.koreanTaught).toContain('로마자 표기와 뜻');
    for (const locale of LOCALES) {
      expect(getMessages(locale).landing.about.promises.koreanTaught, locale).not.toMatch(/only used for|se usa solo/);
    }
  });

  it('the hero bubble greets in the UI language and keeps the letter with its romanization (no-break space)', () => {
    expect(l.home.hero.bubble('ㅏ', 'a')).toBe("Hi! Let's meet ㅏ\u00a0(a).");
    expect(getMessages('es').landing.home.hero.bubble('ㅏ', 'a')).toBe('¡Hola! Conozcamos la letra ㅏ\u00a0(a).');
    expect(getMessages('ko').landing.home.hero.bubble('ㅏ', 'a')).toBe('안녕하세요! 오늘 만날 글자: ㅏ\u00a0(a)');
  });

  it('later stages are in the app: the cost line and the description no longer say they are coming', () => {
    expect(l.plans.paid.coming).toBe('Words, sentences and stories are in the app too. Family and class plans are on the way.');
    expect(l.meta.description).toBe(
      'Learn Hangul from zero with Hoya the tiger, at any age. Five-minute quests teach the Korean alphabet, then words, sentences and stories. Stage 1 is free. No ads, ever.',
    );
    for (const locale of LOCALES) {
      const m = getMessages(locale).landing;
      expect(`${m.meta.description} ${m.plans.paid.coming}`, locale).not.toMatch(/more stages are coming|vienen más etapas|더 많은 단계가 준비/i);
    }
  });
});
