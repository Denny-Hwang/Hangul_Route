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
  });

  it('no visually hidden "(current page)" suffix: aria-current="page" alone names the current link (S-3 review 3)', () => {
    // Every major screen reader announces aria-current, so a hidden suffix would be read twice.
    expect(lookup(l, 'nav.current')).toBeUndefined();
  });

  it('hero: the taught letter and its romanization are passed in', () => {
    expect(l.home.hero.title).toBe('Learn Hangul from zero, at any age.');
    expect(l.home.hero.lead).toBe(
      'Short, playful quests teach you to read, hear and write the Korean alphabet, with Hoya the tiger as your guide.',
    );
    expect(l.home.hero.start).toBe('Start learning');
    expect(l.home.hero.grownUps).toBe('Parent or teacher? Find your page');
    expect(l.home.hero.facts).toBe('Runs in your browser · Nothing to install · The app works offline on most devices after your first visit');
    expect(l.home.hero.bubble('x', 'g/k')).toBe("Annyeong! Let's meet x\u00a0(g/k).");
  });

  it("the taught letter in Hoya's bubble keeps its romanization in the sentence (CLAUDE.md §1, F-SITE-002 §6)", () => {
    expect(l.home.hero.bubble.length).toBe(2);
    const sentence = l.home.hero.bubble('LETTER', 'ROMANIZATION');
    // A no-break space keeps the letter and its romanization on one line when the bubble wraps.
    expect(sentence).toContain('LETTER\u00a0(ROMANIZATION)');
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

  /**
   * How the pages compose the cost words (F-SITE-002 §3.3 block 5, §3.5 and §3.6 Plans). Home: one paragraph, the
   * free line then the paid line. Persona pages: the free line, the paid line only while plans are coming (once they
   * are on sale, `managedInApp` already says where), then `managedInApp`. S-4b and S-5 pin the rendered output.
   */
  const homeCost = (paidPlans: 'coming' | 'inApp'): string => `${l.plans.free.stage1} ${l.plans.paid[paidPlans]}`;
  const personaPlans = (paidPlans: 'coming' | 'inApp'): string[] => [
    paidPlans === 'coming' ? `${l.plans.free.stage1} ${l.plans.paid.coming}` : l.plans.free.stage1,
    l.plans.managedInApp,
  ];

  it('the cost line on the home, in both paidPlans states', () => {
    expect(homeCost('coming')).toBe('Stage 1 is free. More stages are coming, with plans for families and classes.');
    expect(homeCost('inApp')).toBe('Stage 1 is free. Plans for families and classes are at app.hangulroute.com.');
  });

  it('the Plans block of a persona page, in both paidPlans states, names the app host once (rule 3: no repeats)', () => {
    expect(personaPlans('coming')).toEqual([
      'Stage 1 is free. More stages are coming, with plans for families and classes.',
      'Plans and billing are managed at app.hangulroute.com after you sign in.',
    ]);
    expect(personaPlans('inApp')).toEqual(['Stage 1 is free.', 'Plans and billing are managed at app.hangulroute.com after you sign in.']);
    for (const state of ['coming', 'inApp'] as const) {
      expect(personaPlans(state).join(' ').match(/app\.hangulroute\.com/g), state).toHaveLength(1);
      expect(homeCost(state).match(/app\.hangulroute\.com/g)?.length ?? 0, state).toBeLessThanOrEqual(1);
    }
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
      title: 'How most quests work',
      bullets: {
        discover: 'Discover: see and hear a new letter.',
        play: 'Play: short mini-games that use it.',
        check: 'Check: a gentle round. Wrong answers get an amber nudge, never red.',
      },
      hoya: 'Hoya the tiger guides every quest and never says “wrong.”',
      gamesFold: 'See the mini-games',
    });
  });

  it('the quest heading says "most": two Stage 1 quests have no Discover and Check steps until F-QUEST-002 Q-8', () => {
    // quest:stage1-nature-q1 and quest:stage1-crafts-q1 still run intro, present, practice, apply, reward.
    expect(p().quest.title).toMatch(/\bmost quests\b/);
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

  it('the learner app names the same place when a learner already has three classes (no "Settings" on that path)', () => {
    const app = getMessages('en');
    const full = app.caregiver.audience.shared.joinCodeFull;
    expect(full).toBe("You're already in three classes. Leave one under Classes & family in your Profile first.");
    expect(full).toContain(app.caregiver.spaces.title);
    expect(full).toContain(app.learner.home.profileLabel);
    expect(full).not.toMatch(/Settings/);
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
    expect(Object.keys(p().safe.bullets)).toEqual(['ads', 'backup', 'gate', 'siblings']);
    expect(p().safe.bullets.ads).toBe('No ads, and no data sold.');
    expect(p().safe.bullets.gate).toBe('A grown-up gate guards anything that costs money or deletes data.');
    expect(p().safe.bullets.siblings).toBe('Siblings can share a device. Each learner keeps their own stars and cards.');
  });

  it('pins the backup sentence: what leaves the device, where it goes and who sees it (S-3 review 3)', () => {
    expect(p().safe.bullets.backup).toBe(
      "Each learner's nickname and progress are kept on the device and backed up to our servers, so they can be restored with a Rescue Code. When a learner joins a class or family with a code, that space sees the name they join with and their progress. A family's grown-ups can also restore their progress.",
    );
  });

  it('the backup sentence says what the app does: every learner syncs, no sign-in needed (F-SYNC-002, F-RESTORE-001)', () => {
    const sentence = p().safe.bullets.backup;
    // The app backs up every learner profile (nickname, level, avatar, progress) on start and after each write,
    // and mints a Rescue Code after the first cloud save; nothing waits for a grown-up to sign in.
    expect(sentence).toMatch(/nickname and progress are kept on the device and backed up to our servers/);
    expect(sentence.toLowerCase()).toContain(getMessages('en').caregiver.backup.save.detail.toLowerCase());
    // The wordings this sentence replaced: each said data stays local until a sign-in, which the app does not do.
    expect(sentence).not.toMatch(/until you sign in|signs? in|stays on the device|\ball learning data\b|\bmost learning data\b/i);
  });

  it('the backup sentence agrees with the Privacy Policy on who sees progress (legal.privacy...progressWho)', () => {
    const sentence = p().safe.bullets.backup;
    const who = l.legal.privacy.sections.collect.bullets.progressWho;
    // A family's caregivers can recover the full saved progress; a class sees progress, never "only a summary".
    expect(who).toMatch(/family caregivers, who can also recover the full saved progress/);
    expect(sentence).toMatch(/A family's grown-ups can also restore their progress\./);
    expect(who).toMatch(/the teacher of a class the learner joined/);
    expect(sentence).toMatch(/joins a class or family with a code, that space sees the name they join with and their progress/);
    expect(sentence).not.toMatch(/only a (short )?(progress )?summary/i);
  });

  it('the name a space sees is the one the join screen shows (caregiver.join.confirm.seeYouAs)', () => {
    const seeYouAs = getMessages('en').caregiver.join.confirm.seeYouAs;
    expect(seeYouAs.teacher).toMatch(/will see you as/);
    expect(seeYouAs.family).toMatch(/will see you as/);
    expect(p().safe.bullets.backup).toMatch(/the name they join with/);
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

  it('three folded questions; "What can I see?" has its own answer and a report variant', () => {
    expect(Object.keys(p().faq)).toEqual(['account', 'learnAlong', 'whatSee']);
    expect(p().faq.account).toEqual({ q: 'Does my learner need an account?', a: 'No. Learners never need an email or a password.' });
    expect(p().faq.learnAlong).toEqual({ q: 'Can I learn alongside them?', a: 'Yes. Learning Korean yourself? Play the same quests.' });
    expect(p().faq.whatSee).toEqual({
      q: 'What can I see?',
      a: "Each learner's week, in your family space after you sign in. Learners join it with your family code.",
      reports: "Each learner's week and reports, in your family space after you sign in. Learners join it with your family code.",
    });
  });

  it('"What can I see?" never repeats a line the page already shows (§3.1 rule 3)', () => {
    const { whatSee } = p().faq;
    for (const line of [p().follow.body, p().follow.reports]) {
      expect(whatSee.a).not.toContain(line);
      expect(whatSee.reports).not.toContain(line);
    }
    // The report variant says "reports" and nothing else changes, so it shows only while parentReports is on.
    expect(whatSee.reports.replace(' and reports', '')).toBe(whatSee.a);
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
  it('the frozen list holds every leaf of the landing tree as it was before S-3, once each', () => {
    expect(LANDING_PATHS_BEFORE_SITE.length).toBe(226);
    expect(new Set(LANDING_PATHS_BEFORE_SITE).size).toBe(LANDING_PATHS_BEFORE_SITE.length);
    expect(LANDING_PATHS_BEFORE_SITE).toContain('legal.privacy.sections.collect.bullets.progressWho');
  });

  it.each(LANDING_PATHS_BEFORE_SITE)('landing.%s is still there', (path) => {
    expect(lookup(l, path)).toBeDefined();
  });
});
