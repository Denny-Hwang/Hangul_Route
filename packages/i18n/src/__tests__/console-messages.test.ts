import { describe, expect, it } from 'vitest';
import { en } from '../messages/en';
import { LOCALES } from '../locales';
import { KIDS_ONLY_FRAMING } from '../audience';
import { findBannedWord } from '../banned';
import { pseudoLocalize, pseudoText } from '../pseudo';
import { getMessages } from '../resolve';
import { leafPaths, lookup } from '../tree';
import { SAMPLES } from './samples';

// F-I18N-001 PR 9: the console's `COPY` (apps/web/src/lib/console/copy.ts) moves into
// `messages/en/console.ts` with its keys and English wording unchanged (§3.4 rules 1-2),
// and the console view models take their date/count words from here.
const c = getMessages('en').console;

describe('console: the former COPY, keys and wording unchanged', () => {
  it('keeps the function message and the array', () => {
    expect(c.capWarning(16, 20)).toBe('Free plan: 16 / 20 students');
    expect(c.whySignIn).toEqual(['Keep progress safe across devices', 'Bring cards back after a reinstall', 'Manage plans and billing']);
  });

  it('keeps every flat COPY key with its English text', () => {
    expect(c.kidsNoAccount).toBe("Kids don't need an account — they join with a code.");
    expect(c.tryAgain).toBe('Try again');
    expect(c.writeOnBoard).toBe('Write it on the board. Students join from Profile → Classes & family → Join a class.');
    expect(c.notSyncedYet).toBe('not synced yet');
    expect(c.readoutHint).toBe('Most recent activity first — not a ranking. "Not ready yet" means the learner has not unlocked that item.');
    expect(c.relinkCardsComeBack).toBe(
      "Approving brings the learner back into this class. Their cards come back with the rescue code their grown-up keeps in the app (Save my progress) — teachers can't see or reissue it.",
    );
    expect(c.billingSuccess).toBe('Thank you — the plan is active. Learners see it on their next sync.');
    expect(c.familyLine).toBe('Renews yearly. Cancel from Manage subscription any time.');
    expect(c.schoolLicenceLapsed).toBe('The licence needs attention. Classes stay readable; students keep Stage 1 either way.');
  });

  // PR 10a added one group per console page and retired four fragments (practicedThisWeek, anchor,
  // revisitTogether, notSyncedWeek) for whole-sentence messages under `space.week`; PR 10b added `plan` and `billing`;
  // F-TCH-004 PR 10 added `lecture`; F-I18N-001 PR 10c added `settings`, `school` and `parent`; F-PLC-001 P-9 added `placement`; F-ROUTE-001 R-9a added `journey`; F-APP-001 A-2 added `offline`; F-APP-001 A-4a added `lock`.
  it('has exactly the 54 remaining COPY keys plus the formatter and page groups', () => {
    const groups = ['language', 'codeExpiry', 'spaceCounts', 'planCounts', 'planStatus', 'entitlementStatus', 'price', 'promoPrice'];
    const pages = ['shell', 'kind', 'joinCode', 'signIn', 'start', 'home', 'space', 'relink', 'plan', 'billing', 'curriculum', 'lecture', 'settings', 'school', 'parent', 'placement', 'journey', 'offline', 'lock'];
    const copyKeys = Object.keys(en.console).filter((k) => !groups.includes(k) && !pages.includes(k));
    expect(copyKeys).toHaveLength(54);
    for (const g of pages) expect(Object.keys(en.console)).toContain(g);
    for (const g of groups) expect(Object.keys(en.console)).toContain(g);
  });
});

describe('console: formatter words', () => {
  it('names the header language select', () => {
    expect(c.language.label).toBe('Language');
  });

  it('words join-code expiry with plural', () => {
    expect(c.codeExpiry.none).toBe('no code yet');
    expect(c.codeExpiry.expired).toBe('expired');
    expect(c.codeExpiry.today).toBe('expires today');
    expect(c.codeExpiry.inDays(1)).toBe('expires in 1 day');
    expect(c.codeExpiry.inDays(18)).toBe('expires in 18 days');
  });

  it('counts space members with plural, numbers only', () => {
    expect(c.spaceCounts.learners(1)).toBe('1 learner');
    expect(c.spaceCounts.learners(2)).toBe('2 learners');
    expect(c.spaceCounts.students(1)).toBe('1 student');
    expect(c.spaceCounts.students(0)).toBe('0 students');
    expect(c.spaceCounts.classes(1)).toBe('1 class');
    expect(c.spaceCounts.classes(4)).toBe('4 classes');
  });

  it('counts plan items with plural (plan builder, SchoolAdmin uses spaceCounts.students)', () => {
    expect(c.planCounts.items(1)).toBe('1 item');
    expect(c.planCounts.items(2)).toBe('2 items');
    expect(c.planCounts.items(0)).toBe('0 items');
  });

  it('counts a plan\'s targets with plural, worded per space kind', () => {
    expect(c.planCounts.targets('family', 1)).toBe('1 learner');
    expect(c.planCounts.targets('family', 2)).toBe('2 learners');
    expect(c.planCounts.targets('class', 1)).toBe('1 student');
    expect(c.planCounts.targets('class', 2)).toBe('2 students');
    expect(c.planCounts.targets('school', 1)).toBe('1 member');
    expect(c.planCounts.targets('school', 2)).toBe('2 members');
    expect(c.planCounts.targets('class', 0)).toBe('0 students');
  });

  it('labels a plan; the date arrives formatted', () => {
    expect(c.planStatus.archived).toBe('Archived');
    expect(c.planStatus.draft).toBe('Draft');
    expect(c.planStatus.published('Sep 20')).toBe('Published Sep 20');
  });

  it('words an entitlement status; the date arrives formatted', () => {
    const s = c.entitlementStatus;
    expect(s.trial).toBe('trial');
    expect(s.trialEnds('Oct 21, 2026')).toBe('trial · ends Oct 21, 2026');
    expect(s.active).toBe('active');
    expect(s).not.toHaveProperty('activeForGood'); // the Family Plan renews yearly: it says when (BY-D9)
    expect(s.activeRenews('Oct 21, 2026')).toBe('active · renews Oct 21, 2026');
    expect(s.pastDueKept).toBe('payment needs attention · premium kept for a week');
    expect(s.pastDuePaused).toBe('payment needs attention · premium paused');
    expect(s.cancelled).toBe('cancelled');
    expect(s.cancelledEnds('Oct 21, 2026')).toBe('cancelled · ends Oct 21, 2026');
    expect(s.ended).toBe('ended');
    expect(s.endedOn('Oct 21, 2026')).toBe('ended Oct 21, 2026');
  });

  it('words a price around an already formatted amount (no price is written here)', () => {
    expect(c.price.once('$15.30')).toBe('$15.30 once');
    expect(c.price.year('$153')).toBe('$153 / year');
    expect(c.promoPrice('$12.24 once', 'HOYA20', '20% off', false, '$15.30 once')).toBe('$12.24 once with HOYA20 (20% off), was $15.30 once');
    expect(c.promoPrice('$122.40 / year', 'HOYA20', '20% off', true, '$153 / year')).toBe(
      '$122.40 / year with HOYA20 (20% off, first year), was $153 / year',
    );
  });
});

describe('console: every locale stays caregiver-safe', () => {
  for (const locale of LOCALES) {
    it(`${locale}: no caregiver-banned word in any console message, functions included`, () => {
      const tree = getMessages(locale).console;
      for (const path of leafPaths(tree)) {
        const value = lookup(tree, path);
        const outputs =
          typeof value === 'function'
            ? (SAMPLES[`console.${path}`] ?? []).map((args) => (value as (...a: unknown[]) => string)(...args))
            : Array.isArray(value)
              ? value.map(String)
              : [String(value)];
        expect(outputs.length, `console.${path} renders`).toBeGreaterThan(0);
        for (const out of outputs) expect(findBannedWord(out, locale, 'caregiver'), out).toBeNull();
      }
    });
  }
});

// en-XA (F-I18N-001 §3.11): every console leaf, function messages included, survives pseudo-localisation.
describe('en-XA covers the console keys', () => {
  const m = getMessages('en');
  const pseudo = pseudoLocalize(m);
  const paths = leafPaths(m).filter((p) => p.startsWith('console.'));

  it('finds the console leaves', () => {
    expect(paths.length).toBeGreaterThan(180);
  });

  for (const path of paths) {
    it(`${path} is bracketed and at least 40% longer`, () => {
      const value = lookup(pseudo, path);
      const source = lookup(m, path);
      const outputs: Array<[string, string]> = [];
      if (typeof value === 'string' && typeof source === 'string') outputs.push([value, source]);
      else if (Array.isArray(value) && Array.isArray(source)) value.forEach((v, i) => outputs.push([String(v), String(source[i])]));
      else if (typeof value === 'function' && typeof source === 'function') {
        const samples = SAMPLES[path];
        expect(samples, `function message ${path} needs a row in SAMPLES`).toBeDefined();
        for (const args of samples ?? []) {
          outputs.push([(value as (...a: unknown[]) => string)(...args), (source as (...a: unknown[]) => string)(...args)]);
        }
      } else throw new Error(`${path} is neither a string, an array nor a function`);
      for (const [out, src] of outputs) {
        expect(out).toBe(pseudoText(src));
        expect(out.startsWith('[') && out.endsWith(']')).toBe(true);
        expect(out.length - 2).toBeGreaterThanOrEqual(Math.ceil(src.length * 1.4));
      }
    });
  }
});

describe('console.offline: the grown-up offline page (F-APP-001 A-2)', () => {
  it('words the page the wireframe draws (shell/offline)', () => {
    expect(c.offline).toEqual({
      title: "You're offline",
      line: 'Grown-up pages need the internet. Learning still works offline.',
      back: 'Back to learning',
      retry: 'Try again',
    });
  });

  it('is neutral copy a learner may read: no age wording, no banned word', () => {
    for (const text of Object.values(c.offline)) {
      expect(KIDS_ONLY_FRAMING.filter(({ re }) => re.test(text)).map(({ name }) => name), text).toEqual([]);
      expect(findBannedWord(text, 'en', 'learner'), text).toBeNull();
      expect(findBannedWord(text, 'en', 'caregiver'), text).toBeNull();
    }
  });
});
