import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { en, getMessages, UI_LOCALES } from '@hangul-route/i18n';
import { REPORT_REVIEWED_LOCALES, browseEnabled, lectureModeEnabled } from '../../lib/console/config';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { CLAIM_LOCALES, CLAIM_REQUIRES_PAID, SITE_CLAIMS, claimLiveIn, showsClaim, type BooleanClaimKey, type SiteClaims } from '../site-claims';
import { ALL_CLAIMS_OFF, ALL_CLAIMS_ON } from './site-claims-fixtures';

/**
 * Feature lines on hangulroute.com appear only when the feature is live (F-SITE-002 §3.9, PR S-2). A code
 * constant, not a build variable, so these tests pin every state and nothing outside a reviewed PR can switch a
 * claim on. A line about a paid feature also needs paid plans on sale (`CLAIM_REQUIRES_PAID`).
 */
const KEYS = Object.keys(SITE_CLAIMS).sort();
const BOOLEAN_KEYS = KEYS.filter((key) => typeof SITE_CLAIMS[key as keyof SiteClaims] === 'boolean') as BooleanClaimKey[];
const PAID_PLANS: readonly SiteClaims['paidPlans'][] = ['coming', 'inApp'];

describe('SITE_CLAIMS (what the site says today)', () => {
  it('is what is live: Stage 1 free, plans coming, the reports lines (F-REPORT-001 RP-11), All lessons (F-BROWSE-001 BR-14), the notes line (F-FEEDBACK-001 FB-14) and lecture mode (AMENDMENTS-LECTURE-V2 LV-7) on, every other feature line off (the level check waits for the owner)', () => {
    expect(SITE_CLAIMS).toEqual({
      freePlan: 'stage1',
      paidPlans: 'coming',
      learningRoute: false,
      parentReports: true,
      teacherReports: true,
      feedbackNotes: true,
      browseAsLearner: true,
      lectureMode: true,
      levelCheck: false,
    });
  });

  it('cannot be changed at run time', () => {
    expect(Object.isFrozen(SITE_CLAIMS)).toBe(true);
  });

  it('is read-only by type, so only a reviewed flip PR switches a claim on', () => {
    expectTypeOf(SITE_CLAIMS).toEqualTypeOf<Readonly<SiteClaims>>();
    expect(() => {
      // @ts-expect-error SITE_CLAIMS is read-only: a page cannot switch a claim on
      SITE_CLAIMS.learningRoute = true;
    }).toThrow(TypeError);
    expect(SITE_CLAIMS.learningRoute).toBe(false);
  });

  it('shows the reports and notes lines today: their flags are on in production (F-SITE-002 section 3.9 hand-off)', () => {
    for (const locale of UI_LOCALES) {
      const shown = BOOLEAN_KEYS.filter((key) => showsClaim(SITE_CLAIMS, key, locale));
      // The reports lines follow REPORT_REVIEWED_LOCALES; the notes line is live in every UI locale (FB-5b).
      const reports = REPORT_REVIEWED_LOCALES.includes(locale) ? (['parentReports', 'teacherReports'] as const) : [];
      expect(shown, locale).toEqual(['feedbackNotes', 'lectureMode', ...reports]);
    }
  });

  it('turns the lecture mode lines on only with both lecture switches on by default (AMENDMENTS-LECTURE-V2 LV-7, LV-D1)', () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
    const learnerFlags = readFileSync(join(root, 'mobile', 'src', 'config', 'flags.ts'), 'utf8');
    const learnerOn = /launchDefaults: Flags = \{[^}]*\blectureModeEnabled: true,/.test(learnerFlags);
    expect(!SITE_CLAIMS.lectureMode || (lectureModeEnabled({}) && learnerOn)).toBe(true);
  });

  it('shows the lecture mode lines in every UI locale, free, while its claim is on, and hides them with it off (LV-D1 rollback)', () => {
    expect(CLAIM_LOCALES.lectureMode).toBeUndefined();
    expect(CLAIM_REQUIRES_PAID.lectureMode).toBe(false);
    for (const locale of UI_LOCALES) {
      for (const paidPlans of PAID_PLANS) {
        expect(showsClaim({ ...SITE_CLAIMS, paidPlans, lectureMode: true }, 'lectureMode', locale), locale).toBe(true);
        // The coordinated rollback (LV-D1): a PR that sets the claim back to false takes both lines off the site.
        expect(showsClaim({ ...SITE_CLAIMS, paidPlans, lectureMode: false }, 'lectureMode', locale), locale).toBe(false);
      }
    }
  });

  it('the lecture mode lines have their copy in every UI locale, with no price, no plan and no age wording', () => {
    for (const locale of UI_LOCALES) {
      const { persona } = getMessages(locale).landing;
      for (const line of [persona.parents.follow.lecture, persona.teachers.class.lecture]) {
        expect(line.trim().length, locale).toBeGreaterThan(0);
        expect(line, locale).not.toMatch(/[$€£]\s?\d|\d+([.,]\d+)?\s?(usd|dollars?)|lifetime|\bplan\b|\bfree\b|\bkids?\b|\bchild(ren)?\b|\bages?\b/i);
      }
    }
    // AMENDMENTS-LECTURE-V2 section 12.5, word for word.
    expect(en.landing.persona.parents.follow.lecture).toBe('Lecture mode puts a lesson on your TV so you can learn together.');
    expect(en.landing.persona.teachers.class.lecture).toBe('Lecture mode: teach from the front on a projector or TV, with ready-made lessons.');
    const es = getMessages('es').landing.persona;
    expect(es.parents.follow.lecture).toBe('El modo proyección pone una lección en tu TV para aprender en familia.');
    expect(es.teachers.class.lecture).toBe('Modo proyección: enseña al frente con un proyector o una TV, con lecciones listas.');
    const ko = getMessages('ko').landing.persona;
    expect(ko.parents.follow.lecture).toBe('강의 모드로 TV에 수업을 띄우고 함께 배워요.');
    expect(ko.teachers.class.lecture).toBe('강의 모드: 준비된 수업으로 프로젝터나 TV 앞에서 가르쳐요.');
  });

  it('turns the notes line on only with the notes flags on by default in both apps (F-FEEDBACK-001 FB-14, OD-19)', () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
    const consoleConfig = readFileSync(join(root, 'web', 'src', 'lib', 'console', 'config.ts'), 'utf8');
    const learnerFlags = readFileSync(join(root, 'mobile', 'src', 'config', 'flags.ts'), 'utf8');
    const consoleOn = /const NOTES_LAUNCH_DEFAULT = true;/.test(consoleConfig);
    const learnerOn = /launchDefaults: Flags = \{[^}]*\bnotesEnabled: true,/.test(learnerFlags);
    expect(!SITE_CLAIMS.feedbackNotes || (consoleOn && learnerOn)).toBe(true);
  });

  it('the notes line has its reviewed copy in every UI locale, with no price and no age wording', () => {
    for (const locale of ['en', 'es', 'ko'] as const) {
      const { persona } = getMessages(locale).landing;
      const lines = [persona.parents.follow.notes, persona.teachers.class.notes];
      for (const line of lines) {
        expect(line.trim().length).toBeGreaterThan(0);
        expect(line).not.toMatch(/[$€£]\s?\d|lifetime|\bkids?\b|\bchild(ren)?\b|\bages?\b/i);
      }
    }
    expect(en.landing.persona.parents.follow.notes).toBe('Send a short note of encouragement that your learner sees in the app.');
    expect(en.landing.persona.teachers.class.notes).toBe('Send students a short note of encouragement.');
    // The reviewed FB-5b es and ko lines, pinned word for word (ko written as escapes: no Hangul in this file).
    const es = getMessages('es').landing.persona;
    expect(es.parents.follow.notes).toBe('Envía una nota corta de ánimo que tu estudiante ve en la app.');
    expect(es.teachers.class.notes).toBe('Envía a tus estudiantes una nota corta de ánimo.');
    const ko = getMessages('ko').landing.persona;
    expect(ko.parents.follow.notes).toBe('학습자가 앱에서 보는 짧은 격려 쪽지를 보내요.');
    expect(ko.teachers.class.notes).toBe('학생에게 짧은 격려 쪽지를 보내요.');
  });

  it('turns the reports lines on only with the report flags on by default in both apps (F-REPORT-001 RP-11)', () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
    const consoleConfig = readFileSync(join(root, 'web', 'src', 'lib', 'console', 'config.ts'), 'utf8');
    const learnerFlags = readFileSync(join(root, 'mobile', 'src', 'config', 'flags.ts'), 'utf8');
    const consoleOn = /const REPORTS_LAUNCH_DEFAULT = true;/.test(consoleConfig);
    const learnerOn = /launchDefaults: Flags = \{[^}]*\breportsEnabled: true,/.test(learnerFlags);
    expect(!SITE_CLAIMS.parentReports || (consoleOn && learnerOn)).toBe(true);
    expect(!SITE_CLAIMS.teacherReports || consoleOn).toBe(true);
  });

  it('turns the All lessons line on only with the console Lessons switch on by default (F-BROWSE-001 BR-14)', () => {
    expect(!SITE_CLAIMS.browseAsLearner || browseEnabled({})).toBe(true);
  });

  it('keeps the All lessons line a paid line: on, yet off the site while paid plans are coming (F-BROWSE-001 BR-14)', () => {
    expect(SITE_CLAIMS.browseAsLearner).toBe(true);
    expect(CLAIM_REQUIRES_PAID.browseAsLearner).toBe(true);
    for (const locale of UI_LOCALES) {
      expect(showsClaim(SITE_CLAIMS, 'browseAsLearner', locale)).toBe(SITE_CLAIMS.paidPlans === 'inApp');
      expect(claimLiveIn(SITE_CLAIMS, 'browseAsLearner', locale)).toBe(true);
    }
  });

  it('has seven feature claims', () => {
    expect(BOOLEAN_KEYS).toEqual(
      ['browseAsLearner', 'feedbackNotes', 'learningRoute', 'lectureMode', 'levelCheck', 'parentReports', 'teacherReports'],
    );
  });

  it('keeps the level-check lines off until the owner decides, though placement is already on in the learner app (F-PLC-001 P-10)', () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
    const learnerFlags = readFileSync(join(root, 'mobile', 'src', 'config', 'flags.ts'), 'utf8');
    const learnerOn = /launchDefaults: Flags = \{[^}]*\bplacementEnabled: true,/.test(learnerFlags);
    expect(learnerOn).toBe(true);
    expect(SITE_CLAIMS.levelCheck).toBe(false);
    // The flip may never run ahead of the feature.
    expect(!SITE_CLAIMS.levelCheck || learnerOn).toBe(true);
  });

  it('shows the level-check lines in every UI locale, free, while its claim is on, and hides them with it off', () => {
    expect(CLAIM_LOCALES.levelCheck).toBeUndefined();
    expect(CLAIM_REQUIRES_PAID.levelCheck).toBe(false);
    for (const locale of UI_LOCALES) {
      for (const paidPlans of PAID_PLANS) {
        expect(showsClaim({ ...SITE_CLAIMS, paidPlans, levelCheck: true }, 'levelCheck', locale), locale).toBe(true);
        expect(showsClaim({ ...SITE_CLAIMS, paidPlans, levelCheck: false }, 'levelCheck', locale), locale).toBe(false);
      }
    }
  });

  it('keeps one free-plan value: all of Stage 1 is free (F-ENT-003 OD-1, so the line never flips)', () => {
    expectTypeOf<SiteClaims['freePlan']>().toEqualTypeOf<'stage1'>();
    expectTypeOf<SiteClaims['paidPlans']>().toEqualTypeOf<'coming' | 'inApp'>();
    expect(SITE_CLAIMS.freePlan).toBe('stage1');
  });

  it('turns the Learning Route line on only once the learner screen is called "Learning Route"', () => {
    // AMENDMENTS-ROUTE-LEARNING-ROUTE G1: the claim flips with R-10 (LR-10 keeps the flip there), after LR-1 renames the screen.
    const screenTitle: string = en.learner.myRoute.title;
    expect(!SITE_CLAIMS.learningRoute || screenTitle === 'Learning Route').toBe(true);
  });
});

describe('ALL_CLAIMS_OFF (test fixture, the shortest state of every page)', () => {
  it('covers every key, read-only, every feature line off', () => {
    expect(Object.keys(ALL_CLAIMS_OFF).sort()).toEqual(KEYS);
    expectTypeOf(ALL_CLAIMS_OFF).toEqualTypeOf<Readonly<SiteClaims>>();
    expect(Object.isFrozen(ALL_CLAIMS_OFF)).toBe(true);
    for (const key of BOOLEAN_KEYS) expect(showsClaim(ALL_CLAIMS_OFF, key, 'en'), key).toBe(false);
    expect(ALL_CLAIMS_OFF.paidPlans).toBe('coming');
  });
});

describe('ALL_CLAIMS_ON (test fixture, the longest state of every page)', () => {
  it('covers every key', () => {
    expect(Object.keys(ALL_CLAIMS_ON).sort()).toEqual(KEYS);
  });

  it('is read-only by type and at run time', () => {
    expectTypeOf(ALL_CLAIMS_ON).toEqualTypeOf<Readonly<SiteClaims>>();
    expect(Object.isFrozen(ALL_CLAIMS_ON)).toBe(true);
  });

  it('turns every feature line on, with paid plans in the app and the one free-plan value', () => {
    for (const key of BOOLEAN_KEYS) expect(ALL_CLAIMS_ON[key], key).toBe(true);
    expect(ALL_CLAIMS_ON.paidPlans).toBe('inApp');
    expect(ALL_CLAIMS_ON.freePlan).toBe('stage1');
    for (const key of BOOLEAN_KEYS) expect(showsClaim(ALL_CLAIMS_ON, key, 'en'), key).toBe(true);
  });

  it('is imported by no page, component or module of the site (only by tests)', () => {
    const src = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
    const files: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== '__tests__' && entry.name !== 'node_modules') walk(path);
        } else if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
          files.push(path);
        }
      }
    };
    walk(src);
    const scanned = files.map((file) => relative(src, file));
    expect(scanned).toContain(join('data', 'site-claims.ts'));
    expect(scanned).toContain(join('app', '(en)', 'page.tsx'));
    const offenders = files
      .filter((file) => /site-claims-fixtures|ALL_CLAIMS_ON|ALL_CLAIMS_OFF/.test(readFileSync(file, 'utf8')))
      .map((file) => relative(src, file));
    expect(offenders).toEqual([]);
  });
});

describe('CLAIM_REQUIRES_PAID (paid feature lines need paid plans on sale)', () => {
  it('covers every key', () => {
    expect(Object.keys(CLAIM_REQUIRES_PAID).sort()).toEqual(KEYS);
  });

  it('marks only browsing lessons as a learner as paid (F-BROWSE-001)', () => {
    expect(CLAIM_REQUIRES_PAID).toEqual({
      freePlan: false,
      paidPlans: false,
      learningRoute: false,
      parentReports: false,
      teacherReports: false,
      feedbackNotes: false,
      browseAsLearner: true,
      lectureMode: false,
      levelCheck: false,
    });
  });

  it('cannot be changed at run time', () => {
    expect(Object.isFrozen(CLAIM_REQUIRES_PAID)).toBe(true);
  });
});

describe('showsClaim', () => {
  const cases = BOOLEAN_KEYS.flatMap((key) =>
    [true, false].flatMap((on) => PAID_PLANS.map((paidPlans) => ({ key, on, paidPlans }))),
  );

  it('covers every feature claim, on and off, with plans coming and in the app', () => {
    expect(cases).toHaveLength(BOOLEAN_KEYS.length * 4);
  });

  it.each(cases)('$key on=$on paidPlans=$paidPlans', ({ key, on, paidPlans }) => {
    const claims: SiteClaims = { ...SITE_CLAIMS, paidPlans, [key]: on };
    const expected = on && (!CLAIM_REQUIRES_PAID[key] || paidPlans === 'inApp');
    expect(showsClaim(claims, key, 'en')).toBe(expected);
  });

  it('hides the browse line while plans are coming, even with its claim on', () => {
    expect(showsClaim({ ...SITE_CLAIMS, browseAsLearner: true, paidPlans: 'coming' }, 'browseAsLearner', 'en')).toBe(false);
    expect(showsClaim({ ...SITE_CLAIMS, browseAsLearner: true, paidPlans: 'inApp' }, 'browseAsLearner', 'en')).toBe(true);
    expect(showsClaim({ ...SITE_CLAIMS, browseAsLearner: false, paidPlans: 'inApp' }, 'browseAsLearner', 'en')).toBe(false);
  });

  it('shows a free feature line as soon as its claim is on', () => {
    expect(showsClaim({ ...SITE_CLAIMS, learningRoute: true }, 'learningRoute', 'en')).toBe(true);
    expect(showsClaim({ ...SITE_CLAIMS, lectureMode: true, paidPlans: 'coming' }, 'lectureMode', 'en')).toBe(true);
  });

  it('takes only a feature claim (by type)', () => {
    expectTypeOf<BooleanClaimKey>().toEqualTypeOf<
      'learningRoute' | 'parentReports' | 'teacherReports' | 'feedbackNotes' | 'browseAsLearner' | 'lectureMode' | 'levelCheck'
    >();
    // @ts-expect-error the cost line reads freePlan and paidPlans directly, not through showsClaim
    expect(() => showsClaim(SITE_CLAIMS, 'paidPlans', 'en')).not.toThrow();
  });
});

describe('CLAIM_LOCALES (a claim live in some UI locales only)', () => {
  it('limits only the reports lines, to the locales whose report words passed review (F-REPORT-001 section 3.1)', () => {
    expect(Object.keys(CLAIM_LOCALES).sort()).toEqual(['parentReports', 'teacherReports']);
    expect(CLAIM_LOCALES.parentReports).toBe(REPORT_REVIEWED_LOCALES);
    expect(CLAIM_LOCALES.teacherReports).toBe(REPORT_REVIEWED_LOCALES);
    expect(Object.isFrozen(CLAIM_LOCALES)).toBe(true);
  });

  it.each(UI_LOCALES)('shows the reports lines in %s only when reports render there', (locale) => {
    const live = REPORT_REVIEWED_LOCALES.includes(locale);
    expect(showsClaim(SITE_CLAIMS, 'parentReports', locale)).toBe(live);
    expect(showsClaim(SITE_CLAIMS, 'teacherReports', locale)).toBe(live);
    expect(claimLiveIn(SITE_CLAIMS, 'parentReports', locale)).toBe(live);
  });

  it('shows the reports lines in en, ko and es now that the es and ko report words are signed', () => {
    expect(showsClaim(SITE_CLAIMS, 'parentReports', 'en')).toBe(true);
    expect(showsClaim(SITE_CLAIMS, 'parentReports', 'ko')).toBe(true);
    expect(showsClaim(SITE_CLAIMS, 'teacherReports', 'es')).toBe(true);
  });

  it('leaves every other claim live in every locale', () => {
    for (const locale of UI_LOCALES) {
      expect(showsClaim({ ...SITE_CLAIMS, learningRoute: true }, 'learningRoute', locale)).toBe(true);
      expect(claimLiveIn({ ...SITE_CLAIMS, feedbackNotes: true }, 'feedbackNotes', locale)).toBe(true);
    }
  });

  it('never shows a claim that is off, in any locale', () => {
    for (const locale of UI_LOCALES) expect(claimLiveIn(ALL_CLAIMS_OFF, 'parentReports', locale)).toBe(false);
  });
});
