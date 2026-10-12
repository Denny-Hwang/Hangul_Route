import { describe, expect, it } from 'vitest';
import { LOCALES } from '../locales';
import { getMessages } from '../resolve';
import { leafPaths, lookup } from '../tree';
import { LANDING_PATHS_BEFORE_SITE } from './landing-paths-before-site';
import { SAMPLES } from './samples';

// F-SITE-002 PR S-3: the English strings of the layered intro site (appendix B), written before any
// page reads them. The pages (S-4a, S-4b, S-5) pin the rendered output; these tests pin the words, the
// rules that apply to every one of them (Learning Route spelling, no price, no speaking line) and that
// no key of the current landing is removed before S-6.
const l = getMessages('en').landing;

/** Every rendered output of a landing leaf: the string, each array item, or one output per SAMPLES row. */
function outputs(tree: unknown, path: string): string[] {
  const value = lookup(tree, path);
  if (typeof value === 'function') return (SAMPLES[`landing.${path}`] ?? []).map((args) => (value as (...a: unknown[]) => string)(...args));
  if (Array.isArray(value)) return value.map(String);
  return [String(value)];
}

/** Every rendered output under a landing sub-tree (all of `landing` for ''), with its path. */
function entriesUnder(prefix: string): Array<[string, string]> {
  const tree = getMessages('en').landing;
  return leafPaths(tree)
    .filter((path) => prefix === '' || path === prefix || path.startsWith(`${prefix}.`))
    .flatMap((path) => outputs(tree, path).map((out): [string, string] => [path, out]));
}

describe('B.1 home: nav, hero, persona chooser, how it works, promises, plans, launch news', () => {
  it('nav', () => {
    expect(l.nav.label).toBe('Main');
    expect(l.nav.learners).toBe('Learners');
    expect(l.nav.parents).toBe('Parents');
    expect(l.nav.teachers).toBe('Teachers');
    expect(l.nav.signIn).toBe('Sign in');
    expect(l.nav.start).toBe('Start learning');
    expect(l.nav.skip).toBe('Skip to content');
    expect(l.nav.current).toBe('(current page)');
  });

  it('hero: the taught letter is passed in', () => {
    expect(l.home.hero.title).toBe('Learn Hangul from zero, at any age.');
    expect(l.home.hero.lead).toBe(
      'Short, playful quests teach you to read, hear and write the Korean alphabet, with Hoya the tiger as your guide.',
    );
    expect(l.home.hero.start).toBe('Start learning');
    expect(l.home.hero.grownUps).toBe('Parent or teacher? Find your page');
    expect(l.home.hero.facts).toBe('Runs in your browser · Nothing to install · The app works offline on most devices after your first visit');
    expect(l.home.hero.bubble('x')).toBe("Annyeong! Let's meet x.");
  });

  it('the hero title is the tagline (F-SITE-002 §5), so the footer and the hero cannot drift', () => {
    expect(l.home.hero.title).toBe(l.meta.tagline);
  });

  it('the offline fact is hedged like the learners FAQ answer (iOS 14 offline is an open issue)', () => {
    expect(l.home.hero.facts).toMatch(/offline on most devices/);
    expect(l.persona.learners.faq.offline.a).toMatch(/^On most devices, yes/);
  });

  it('who is it for: three persona cards, each with a title, one line and a link label', () => {
    expect(l.home.who.title).toBe('Who is it for?');
    expect(l.home.who.items).toEqual({
      learners: {
        title: 'Learners',
        body: 'Five-minute quests, a guide who never scolds, and Korean culture cards to collect.',
        linkLabel: 'For learners',
      },
      parents: {
        title: 'Parents and caregivers',
        body: 'See what your learner practises, with a grown-up gate and no ads.',
        linkLabel: 'For parents',
      },
      teachers: {
        title: 'Teachers',
        body: 'Students join with a class code. No student emails, no accounts.',
        linkLabel: 'For teachers',
      },
    });
    expect(Object.keys(l.home.who.items)).toEqual(['learners', 'parents', 'teachers']);
  });

  it('how it works: three steps in order, and the Learning Route variant of step 3', () => {
    expect(l.home.how.title).toBe('How it works');
    expect(l.home.how.steps).toEqual({
      start: { title: 'Open the app', body: 'Choose who is learning and begin.' },
      quests: { title: 'Learn in five-minute quests', body: 'Letters, sounds and first words, with sound and pictures on every screen.' },
      collect: { title: 'Collect and keep going', body: 'Earn Korean culture cards. Your progress is saved on your device.' },
    });
    expect(Object.keys(l.home.how.steps)).toEqual(['start', 'quests', 'collect']);
    expect(l.home.how.routeBody).toBe('Earn Korean culture cards and see your whole Learning Route: where you are and what comes next.');
  });

  it('promises: three titles, no body; "Child safety first" replaces the compliance claim (OD-4)', () => {
    expect(l.home.promises.label).toBe('Our promises');
    expect(l.home.promises.items).toEqual({ ads: 'No ads, ever', safety: 'Child safety first', noRed: 'No red marks' });
    expect(JSON.stringify(l.home)).not.toMatch(/COPPA|compliant/i);
  });

  it('plans: the only cost words on the site, never a price (OD-7)', () => {
    expect(l.plans.title).toBe('What does it cost?');
    expect(l.plans.free.stage1).toBe('Stage 1 is free.');
    expect(l.plans.paid.coming).toBe('More stages are coming, with plans for families and classes.');
    expect(l.plans.paid.inApp).toBe('Plans for families and classes are at app.hangulroute.com.');
    expect(l.plans.managedInApp).toBe('Plans and billing are managed at app.hangulroute.com after you sign in.');
    expect(Object.keys(l.plans)).toEqual(['title', 'free', 'paid', 'managedInApp']);
    expect(Object.keys(l.plans.paid)).toEqual(['coming', 'inApp']);
  });

  it('the free plan is all of Stage 1: one free line, no day-count line (F-ENT-003 OD-1)', () => {
    // The `firstDays` value of revision 2 is dropped with its string; the free line never flips.
    expect(Object.keys(l.plans.free)).toEqual(['stage1']);
    expect(lookup(l, 'plans.free.firstDays')).toBeUndefined();
  });

  it('the free line is true with paid plans coming and on sale, so it says nothing about paid plans (F-ENT-003 OD-1)', () => {
    expect(l.plans.free.stage1).not.toMatch(/\bplans?\b|coming|app\.hangulroute\.com/i);
    // What is coming belongs to the paid line, which follows the `paidPlans` claim.
    expect(l.plans.paid.coming).toMatch(/coming/);
    expect(l.plans.paid.inApp).not.toMatch(/coming/);
  });

  it('launch news: the form itself keeps landing.waitlist', () => {
    expect(l.home.news).toEqual({ title: 'Get the launch news', body: "Leave your email and we'll send you the launch news. Nothing else." });
  });
});

describe('B.2 learners', () => {
  const p = () => getMessages('en').landing.persona.learners;

  it('lead, what you learn first (read, listen, write; no speaking line)', () => {
    expect(p().title).toBe('For learners');
    expect(p().lead).toBe('Learn to read, hear and write Hangul, one five-minute quest at a time.');
    expect(p().learn).toEqual({
      title: 'What you learn first',
      body: 'Stage 1 is the Korean alphabet: the letters, their sounds and how they build syllables.',
      bullets: { read: 'Read letters and syllables', listen: 'Listen and match sounds', write: 'Write letters by tracing them' },
    });
  });

  it('how a quest works, with the Hoya line and the mini-games fold', () => {
    expect(p().quest).toEqual({
      title: 'How a quest works',
      bullets: {
        discover: 'Discover: see and hear a new letter.',
        play: 'Play: short mini-games that use it.',
        check: 'Check: a gentle round. Wrong answers get an amber nudge, never red.',
      },
      hoya: 'Hoya the tiger guides every quest and never says “wrong.”',
      gamesFold: 'See the mini-games',
    });
  });

  it('collect Korean culture: the fold counts the cards with plural forms', () => {
    expect(p().cards.title).toBe('Collect Korean culture');
    expect(p().cards.body).toBe('Every letter you learn earns a card: a piece of Korean food, art or everyday life.');
    expect(p().cards.seeAll(24)).toBe('See all 24 Stage 1 cards');
    expect(p().cards.seeAll(1)).toBe('See the Stage 1 card');
  });

  it('your Learning Route (shown only with its claim)', () => {
    expect(p().route).toEqual({ title: 'Your Learning Route', body: 'One map shows where you started, where you are and what comes next.' });
  });

  it('five folded questions in order; the adult and Korean answers are today’s text', () => {
    const faq = p().faq;
    expect(Object.keys(faq)).toEqual(['signIn', 'code', 'offline', 'adult', 'korean']);
    expect(faq.signIn).toEqual({
      q: 'Is there a sign-in for learners?',
      a: 'No email or password needed. Open the app and choose your profile, or enter your class or family code. Moving to a new device? Use your Rescue Code.',
    });
    expect(faq.code.q).toBe('I have a join code. Where do I enter it?');
    expect(faq.offline).toEqual({
      q: 'Does it work offline?',
      a: 'On most devices, yes: after your first visit the app opens without a connection. Letter sounds may need a Korean voice installed on your device.',
    });
    expect(faq.adult).toEqual(l.faq.items.adult);
    expect(faq.korean).toEqual(l.faq.items.korean);
  });

  it('the join-code answer names the labels the learner taps: Profile, Classes & family, Join a class', () => {
    const app = getMessages('en');
    const answer = p().faq.code.a;
    expect(answer).toBe('In the app: tap Profile, then go to Classes & family and tap Join a class.');
    expect(answer).toContain(app.learner.home.profileLabel);
    expect(answer).toContain(app.caregiver.spaces.title);
    expect(answer).toContain(app.caregiver.spaces.join.cta);
  });

  it('the console tells teachers the same path the learners page gives students', () => {
    const app = getMessages('en');
    for (const label of [app.learner.home.profileLabel, app.caregiver.spaces.title, app.caregiver.spaces.join.cta]) {
      expect(app.console.writeOnBoard).toContain(label);
    }
    expect(app.console.writeOnBoard).not.toMatch(/Settings/);
  });
});

describe('B.3 parents', () => {
  const p = () => getMessages('en').landing.persona.parents;

  it('lead names grandparents and every caregiver; the primary action fits one line', () => {
    expect(p().title).toBe('For parents and caregivers');
    expect(p().lead).toBe("For parents, grandparents and every caregiver: short, kind lessons that keep your learner's data private.");
    expect(p().signIn).toBe('Sign in as a parent');
  });

  it('what they learn, with the link to the learners page', () => {
    expect(p().learn).toEqual({
      title: 'What they learn',
      body: 'The Korean alphabet first: reading, listening and writing, in five-minute quests.',
      link: 'What learners do',
    });
  });

  it('safe by design: four bullets in order', () => {
    expect(p().safe.title).toBe('Safe by design');
    expect(Object.keys(p().safe.bullets)).toEqual(['ads', 'localFirst', 'gate', 'siblings']);
    expect(p().safe.bullets.ads).toBe('No ads, and no data sold.');
    expect(p().safe.bullets.gate).toBe('A grown-up gate guards anything that costs money or deletes data.');
    expect(p().safe.bullets.siblings).toBe('Siblings can share a device. Each learner keeps their own stars and cards.');
  });

  it('pins the local-first sentence that stays true for usage events, sign-in sync and class and family joins', () => {
    const sentence = p().safe.bullets.localFirst;
    expect(sentence).toBe(
      'Most learning data stays on the device. When a grown-up signs in, progress is saved to our servers so it can be restored. When a learner joins a class or family with a code, only a short progress summary is shared with that space.',
    );
    // Today's "until you sign in" is not true for a learner who joins a class with a code (F-SPACE-001 §3.5).
    expect(sentence).not.toMatch(/until you sign in/i);
    expect(sentence).toMatch(/joins a class or family with a code/);
    expect(sentence).toMatch(/only a short progress summary/);
  });

  it('the local-first sentence says what the Privacy Policy says, so the two cannot drift', () => {
    const sentence = p().safe.bullets.localFirst;
    const policy = l.legal.privacy.sections;
    const policyText = JSON.stringify(policy);
    // Usage events (a finished quest, an unlocked card) are sent before any sign-in, so never "all" and never
    // "stays until": the policy's own hedge is "Most learning data stays on the device".
    expect(sentence.startsWith('Most learning data stays on the device.')).toBe(true);
    expect(policyText).toContain('Most learning data stays on the device');
    expect(sentence).not.toMatch(/\ball learning data\b|stays on the device until/i);
    // A grown-up's sign-in syncs progress so it can be restored; the policy says the same.
    expect(sentence).toMatch(/signs in, progress is saved to our servers so it can be restored/);
    expect(policyText).toMatch(/progress syncs to our servers \(Cloudflare\) so it can be restored/);
  });

  it('follow along: the base line and one line per claim', () => {
    expect(p().follow).toEqual({
      title: 'Follow along',
      body: "Create a free family space, share its code, and see each learner's week: time practised, quests done and letters to revisit together.",
      reports: 'Reports for today, this week, this month and all time show what went well and what to practise next.',
      route: "Open each learner's Learning Route to see where they are and what comes next.",
      notes: 'Send a short note of encouragement that your learner sees in the app.',
      browse: 'With the Family Plan, browse every lesson exactly as your learner sees it.',
    });
  });

  it('the browse line names the Family Plan as the app names it (yearly Family Plan, BY-1)', () => {
    const app = getMessages('en');
    expect(app.console.billing.planTitle.family_lifetime).toBe('Family Plan');
    expect(p().follow.browse).toContain(`the ${app.console.billing.planTitle.family_lifetime}`);
  });

  it('three folded questions; "What can I see?" is answered by the follow-along lines', () => {
    expect(Object.keys(p().faq)).toEqual(['account', 'learnAlong', 'whatSee']);
    expect(p().faq.account).toEqual({ q: 'Does my learner need an account?', a: 'No. Learners never need an email or a password.' });
    expect(p().faq.learnAlong).toEqual({ q: 'Can I learn alongside them?', a: 'Yes. Learning Korean yourself? Play the same quests.' });
    expect(p().faq.whatSee).toEqual({ q: 'What can I see?' });
  });

  it('keeps the pinned sentence that moves to /parents', () => {
    expect(p().faq.learnAlong.a).toContain('Learning Korean yourself? Play the same quests.');
  });
});

describe('B.4 teachers', () => {
  const p = () => getMessages('en').landing.persona.teachers;

  it('lead and both actions', () => {
    expect(p().title).toBe('For teachers');
    expect(p().lead).toBe('Students join with a code, you plan the week, and everyone learns at their own pace.');
    expect(p().signIn).toBe('Sign in as a teacher');
    expect(p().tryIt).toBe('Try it as a learner');
  });

  it('set up in minutes: three numbered steps in order', () => {
    expect(p().setup).toEqual({
      title: 'Set up in minutes',
      steps: {
        space: 'Sign in and create a class space.',
        code: 'Share the class code. Students enter it in the app; no student emails or accounts.',
        devices: 'Students learn on any device with a browser.',
      },
    });
    expect(Object.keys(p().setup.steps)).toEqual(['space', 'code', 'devices']);
  });

  it('plan and assign', () => {
    expect(p().plan).toEqual({
      title: 'Plan and assign',
      bullets: {
        pick: "Pick quests for the week. They appear on each student's homework list.",
        planner: 'Or let the planner build a term route from your class level and rhythm.',
      },
    });
  });

  it('see how the class is doing: the base line and one line per claim, never a ranking', () => {
    expect(p().class).toEqual({
      title: 'See how the class is doing',
      body: 'A weekly view shows who practised and which letters to revisit together. Never a ranking.',
      reports: 'Reports for each student and statistics for the whole class, by day, week, month or all time. Never a ranking.',
      route: "Open each student's Learning Route to see where they are and what comes next.",
      notes: 'Send students a short note of encouragement.',
      browse: 'With a class or school plan, preview every lesson exactly as students see it.',
      lecture: 'Teach from the front on a projector or TV.',
    });
  });

  it('privacy for classes', () => {
    expect(p().privacy).toEqual({
      title: 'Privacy for classes',
      bullets: { initials: 'Show initials only on the class list.', ads: 'No ads, and no data sold.' },
    });
  });

  it('three folded questions in order', () => {
    expect(p().faq).toEqual({
      students: { q: 'Do students need accounts?', a: 'No. They join with the class code inside the app.' },
      ranking: { q: 'Is there a leaderboard?', a: 'No. Hangul Route never ranks students against each other.' },
      try: { q: 'Can I try it first?', a: 'Yes. Open the app and play the first quests as a learner.' },
    });
    expect(Object.keys(p().faq)).toEqual(['students', 'ranking', 'try']);
  });
});

describe('closing lines, footer groups, the 404 links and per-page metadata', () => {
  it('the section headings the persona pages share', () => {
    expect(l.persona.plansTitle).toBe('Plans');
    expect(l.persona.faqTitle).toBe('Questions');
  });

  it('closing block lines', () => {
    expect(l.persona.closing).toEqual({
      learners: 'Ready for your first letter?',
      parents: "See your learner's week in one place.",
      teachers: 'Bring Hangul to your class this week.',
    });
  });

  it('footer group headings', () => {
    expect(l.footer.guide).toBe('Guide');
    expect(l.footer.app).toBe('App');
  });

  it('404 links', () => {
    expect(l.notFound).toEqual({ body: 'We could not find this page.', home: 'Go to the home page', start: 'Start learning' });
  });

  it('per-page metadata for the three persona pages', () => {
    expect(Object.keys(l.meta.pages)).toEqual(['learners', 'parents', 'teachers']);
    expect(l.meta.pages.learners.title).toBe('For learners — Hangul Route');
    expect(l.meta.pages.parents.title).toBe('For parents and caregivers — Hangul Route');
    expect(l.meta.pages.teachers.title).toBe('For teachers — Hangul Route');
    for (const page of Object.values(l.meta.pages)) {
      expect(page.description.length).toBeGreaterThan(40);
      // Search snippets are cut near 160 characters.
      expect(page.description.length).toBeLessThanOrEqual(160);
    }
  });

  it('metadata types no count into copy and makes no compliance claim (§3.12)', () => {
    const text = JSON.stringify(l.meta.pages);
    expect(text).not.toMatch(/\d+\s*(stages|culture themes|mini-games)/i);
    expect(text).not.toMatch(/COPPA|compliant/i);
  });
});

const NEW_SITE_PREFIXES = ['nav', 'home', 'plans', 'persona', 'footer.guide', 'footer.app', 'notFound', 'meta.pages'] as const;

/**
 * Words the site never uses about a plan. The Family Plan renews yearly (owner decision 2026-10-11, BY-1), so
 * no one-time or lifetime wording; and the site names no term, which the signed-in billing page and the Terms
 * state (F-SITE-002 OD-7, S-7).
 */
const LIFETIME_OR_TERM_WORDS =
  /\blifetime\b|\bonce\b|\bone payment\b|\bfor good\b|\bforever\b|\bnothing to cancel\b|\bno renewal\b|\bsubscri|\brenew|\byearly\b|\bper year\b|\ba year\b|\bannual/i;

/** Free-plan copy of revision 2 and its kin: day counts, trials and time limits (F-ENT-003 OD-1, OD-8). */
const DAY_COUNT_WORDS = /\bday\s+(\d+|one|two|three)\b|\b(\d+|one|two|three|first|few)[\s-]+days?\b|\btrial\b|\bfree for\b/i;

describe('rules for every new site string', () => {
  const entries = NEW_SITE_PREFIXES.flatMap((prefix) => entriesUnder(prefix));

  it('finds the new strings', () => {
    expect(entries.length).toBeGreaterThan(100);
  });

  it('no price, amount or currency on the site (OD-7)', () => {
    for (const [path, out] of entries) expect(out, path).not.toMatch(/[$€£₩¥]|\b\d+(\.\d+)?\s*(USD|EUR|dollars?|per month|\/mo)\b/i);
  });

  it('no speaking line: reading, listening and writing only (owner decision 2026-10-10)', () => {
    for (const [path, out] of entries) expect(out, path).not.toMatch(/\bspeak|\bspoken|\bpronounc|\bsay it\b|\bsay the\b/i);
  });

  it('no ranking promise: every ranking word is a "never" or a "no"; a question about it is answered "No."', () => {
    const answers = new Map(entries);
    for (const [path, out] of entries) {
      if (!/rank|leaderboard/i.test(out)) continue;
      if (path.endsWith('.q')) expect(answers.get(`${path.slice(0, -2)}.a`), path).toMatch(/^No\./);
      else expect(out, path).toMatch(/\bnever\b|\bno\b/i);
    }
  });

  it('links name their purpose: no "learn more", no "click here"', () => {
    for (const [path, out] of entries) expect(out, path).not.toMatch(/learn more|click here/i);
  });

  it('no plan is a one-time or lifetime purchase: plans bought on the web renew yearly (BY-1)', () => {
    for (const [path, out] of entries) expect(out, path).not.toMatch(LIFETIME_OR_TERM_WORDS);
  });

  it('no day-count, trial or time-limited free-plan copy: the free plan is all of Stage 1 (F-ENT-003 OD-1)', () => {
    for (const [path, out] of entries) expect(out, path).not.toMatch(DAY_COUNT_WORDS);
  });

  it('the plan-word checks catch what they are for and pass the strings the site keeps (self-check)', () => {
    for (const bad of ['Family Lifetime', 'Pay once, keep it', 'One payment, no renewal.', 'Yours for good.', 'Free forever', 'Nothing to cancel.', 'A yearly subscription.', 'Renews every year.']) {
      expect(bad, bad).toMatch(LIFETIME_OR_TERM_WORDS);
    }
    for (const bad of ['Start free with Day 1 and Day 2 of the route', 'Your first two days are free.', 'A 7-day free trial', 'Try it free for 14 days', 'A two-day pass']) {
      expect(bad, bad).toMatch(DAY_COUNT_WORDS);
    }
    for (const ok of [l.persona.teachers.class.reports, l.persona.parents.follow.reports, l.persona.teachers.faq.try.a, l.plans.free.stage1]) {
      expect(ok, ok).not.toMatch(DAY_COUNT_WORDS);
      expect(ok, ok).not.toMatch(LIFETIME_OR_TERM_WORDS);
    }
  });
});

/**
 * Learning Route spelling (AMENDMENTS-ROUTE-LEARNING-ROUTE G1, LR-OD-1; F-SITE-002 §5): any landing value that
 * says "learning route" in any casing says it as "Learning Route": title case, never capitals, never lower case.
 */
function misspelledLearningRoute(text: string): string | null {
  for (const match of text.match(/learning[\s -]+route/gi) ?? []) if (match !== 'Learning Route') return match;
  return null;
}

describe('Learning Route spelling in every landing value', () => {
  it('the check passes title case and catches every other spelling (self-check)', () => {
    expect(misspelledLearningRoute('See your Learning Route.')).toBeNull();
    expect(misspelledLearningRoute('No route here, only learning.')).toBeNull();
    for (const bad of ['your learning route', 'LEARNING ROUTE', 'Learning route', 'learning Route', 'Learning-Route', 'Learning  Route']) {
      expect(misspelledLearningRoute(bad), bad).not.toBeNull();
    }
  });

  it('the new strings use the term', () => {
    const route = entriesUnder('').filter(([, out]) => /Learning Route/.test(out)).map(([path]) => path);
    expect(route).toEqual(
      expect.arrayContaining(['home.how.routeBody', 'persona.learners.route.title', 'persona.parents.follow.route', 'persona.teachers.class.route']),
    );
  });

  for (const locale of LOCALES) {
    it(`${locale}: every landing value spells it "Learning Route"`, () => {
      const tree = getMessages(locale).landing;
      for (const path of leafPaths(tree)) {
        for (const out of outputs(tree, path)) {
          expect(misspelledLearningRoute(out), `landing.${path}: ${out}`).toBeNull();
          // The retired name (AMENDMENTS-ROUTE-LEARNING-ROUTE §7.3) never reaches the site.
          expect(out, `landing.${path}`).not.toMatch(/\bmy route\b/i);
        }
      }
    });
  }
});

describe('no key of the current landing is removed before S-6', () => {
  it('the frozen list holds every leaf of the landing tree as it was before S-3', () => {
    expect(LANDING_PATHS_BEFORE_SITE.length).toBe(225);
  });

  it.each(LANDING_PATHS_BEFORE_SITE)('landing.%s is still there', (path) => {
    expect(lookup(l, path)).toBeDefined();
  });
});
