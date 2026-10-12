import { describe, expect, it } from 'vitest';
import { LOCALES } from '../locales';
import { getMessages } from '../resolve';
import { isPlainObject, lookup } from '../tree';
import { SAMPLES } from './samples';

/**
 * AMENDMENTS-ROUTE-LEARNING-ROUTE section 7 (LR-1): the page is named **Learning Route**.
 * Section 7.2 pins the renamed English values; section 7.3 is the copy test below. Key paths,
 * code identifiers and telemetry names do not change (section 7.1). es / ko fall back to English
 * until the F-I18N-001 native review (section 7.3), so these rules run on the English values.
 */
const en = getMessages('en');

/** Section 7.3 "Banned phrases": the namespaces on main today, and the ones a later PR adds. */
const ROUTE_NAMESPACES = [
  'learner.myRoute',
  'caregiver.journey',
  'console.journey',
  'a11y.myRoute',
  'landing',
  'learner.placement.result.seeMyRoute',
  // Walked so the section 7.3 "my route" exemption below is real; the other rules still apply to it.
  'learner.placement.result.routeStays',
] as const;
/** `console.learningRoute.*` arrives with LR-7; the rules apply to it as soon as it exists. */
const LATER_NAMESPACES = ['console.learningRoute'] as const;

/** Section 7.3: the only value under the checked paths allowed to say "my route" (it speaks about the start spot). */
const MY_ROUTE_EXEMPT: ReadonlySet<string> = new Set(['learner.placement.result.routeStays']);

/**
 * Section 6.1 cases 2 and 3 (section 11.1 names): the case 2 and 3 lines, the case 2 stage tag and the
 * shared parts both cases draw. None may claim to show the learner's own goal.
 */
const SCOPED_GOAL_PATHS = [
  'console.learningRoute.planReaches.class',
  'console.learningRoute.planReaches.family',
  'console.learningRoute.stageReached',
  'console.learningRoute.nextOpen',
  'console.learningRoute.planGoalTag',
  'console.learningRoute.canDoLead',
  'console.learningRoute.planEnds',
  'console.learningRoute.endOfRoad',
  'console.learningRoute.hereTag',
  'console.learningRoute.startTag',
] as const;
/**
 * Case 1 only (the family viewer holds `summary.routeGoal`, the learner's own goal): the only
 * `console.learningRoute` values allowed to name it. Every other value is checked, so a key LR-7
 * adds is covered unless it is listed here on purpose.
 */
const CASE_1_ONLY: readonly string[] = [
  'console.learningRoute.learnerGoal',
  'console.learningRoute.goalTag',
  'console.learningRoute.reached',
  'console.learningRoute.fromLead',
];
const isCase1Only = (path: string): boolean => CASE_1_ONLY.some((p) => path === p || path.startsWith(`${p}.`));
const hasLearningRoute = lookup(en, 'console.learningRoute') !== undefined;

/** Section 7.3 "Same access word": one value for "Not open yet"; LR-3b and F-ENT-003 add the other two keys. */
const NOT_OPEN_PATHS = ['learner.myRoute.state.notOpen', 'learner.myRoute.legend.notOpen', 'learner.access.notOpen'] as const;

type Rendered = { path: string; text: string };

/** Every output under `path`: strings as they are, arrays item by item, functions with their SAMPLES rows. */
function render(node: unknown, path: string, out: Rendered[] = []): Rendered[] {
  if (typeof node === 'string') out.push({ path, text: node });
  else if (Array.isArray(node)) for (const item of node) render(item, path, out);
  else if (typeof node === 'function') {
    const samples = SAMPLES[path];
    expect(samples, `function message ${path} needs a row in SAMPLES`).toBeDefined();
    for (const args of samples ?? []) out.push({ path, text: (node as (...a: unknown[]) => string)(...args) });
  } else if (isPlainObject(node)) for (const [key, value] of Object.entries(node)) render(value, `${path}.${key}`, out);
  return out;
}

/** Every English output of the checked namespaces that exist in this build. */
function checkedOutputs(): Rendered[] {
  return [...ROUTE_NAMESPACES, ...LATER_NAMESPACES].flatMap((ns) => {
    const node = lookup(en, ns);
    return node === undefined ? [] : render(node, ns);
  });
}

/** Every English output in the dictionary, for the casing rule (LR-OD-1 names the page wherever it appears). */
function everyOutput(): Rendered[] {
  return Object.entries(en).flatMap(([ns, node]) => render(node, ns));
}

/** Section 7.3: "learning route" in any casing or joiner but the title case of LR-OD-1. */
const miscased = (text: string): string[] => [...text.matchAll(/learning[\s-]+route/gi)].map((m) => m[0]).filter((m) => m !== 'Learning Route');
const saysMyRoute = (text: string): boolean => /\bmy\s+route\b/i.test(text);
/** "family plan" and "class plan" name the paid product (F-APP-001, F-BILL-002): use "weekly plan". */
const saysProductPlan = (text: string): boolean => /\b(family|class)\s+plans?\b/i.test(text);
/** Section 7.3 "Grown-up honesty": cases 2 and 3 never claim the learner's own goal. */
const claimsLearnerGoal = (text: string): boolean => /['’]s\s+goal\b|\bgoal:/i.test(text);

describe('Learning Route English values (AMENDMENTS-ROUTE-LEARNING-ROUTE section 7.2)', () => {
  it('names the page Learning Route on learner screens', () => {
    expect(en.learner.myRoute.title).toBe('Learning Route');
    expect(en.learner.myRoute.open.cta).toBe('See Learning Route');
    expect(en.learner.myRoute.hero.start).toBe('Your Learning Route starts here.');
    expect(en.learner.placement.result.seeMyRoute).toBe('See Learning Route');
    // R-4b (#367): the Home strip already carries the name.
    expect(en.learner.myRoute.home.strip.title).toBe('Learning Route');
  });

  it('gives the Route tab and the Journey tab one purpose line each (LR-OD-3)', () => {
    expect(en.learner.myRoute.purpose).toBe('Where you are and where you are going.');
    expect(en.learner.journey.intro).toBe('Every lesson, by stage and theme.');
    // The grid stops using the word "route", so the two tabs never read as synonyms.
    expect(en.learner.journey.intro).not.toMatch(/\broute\b/i);
  });

  it('names the page in the grown-up copy, in the third person', () => {
    expect(en.caregiver.journey.viewing('Sam')).toBe("Viewing Sam's Learning Route");
    expect(en.caregiver.journey.start('Sam')).toBe("Sam's Learning Route starts here.");
    expect(en.console.journey.title).toBe('Learning Route');
  });

  it('labels the tab Route within the 12-character tab budget, read aloud as the full name (LR-OD-1)', () => {
    expect(en.a11y.tabs.route).toBe('Route');
    expect(en.a11y.tabs.route.length).toBeLessThanOrEqual(12);
    expect(en.a11y.myRoute.tab).toBe('Learning Route');
  });

  it('reads a tab of the four-tab bar with its place on iOS (LR-4)', () => {
    expect(en.a11y.tabPosition(en.a11y.myRoute.tab, 2, 4)).toBe('Learning Route, tab, 2 of 4');
    expect(en.a11y.tabPosition(en.a11y.tabs.home, 1, 4)).toBe('Today, tab, 1 of 4');
  });

  it('keeps the values section 7.2 leaves unchanged on purpose', () => {
    expect(en.learner.placement.result.routeStays).toBe('Your route stays right where it is.');
    expect(en.learner.journey.title).toBe('Heritage Journey');
    expect(en.learner.myRoute.home.strip.week(3)).toBe('Week 3 of your weekly plan');
  });
});

describe('Learning Route copy rules (AMENDMENTS-ROUTE-LEARNING-ROUTE section 7.3)', () => {
  const outputs = checkedOutputs();

  it('checks every namespace on main and finds the renamed values', () => {
    for (const ns of ROUTE_NAMESPACES) expect(lookup(en, ns), ns).toBeDefined();
    const paths = new Set(outputs.map((o) => o.path));
    for (const path of [
      'learner.myRoute.title',
      'learner.myRoute.purpose',
      'learner.myRoute.home.strip.title',
      'caregiver.journey.viewing',
      'console.journey.title',
      'a11y.myRoute.tab',
      'learner.placement.result.seeMyRoute',
    ]) {
      expect(paths.has(path), path).toBe(true);
    }
  });

  it('never says "my route" (except the start-spot line)', () => {
    const paths = new Set(outputs.map((o) => o.path));
    for (const path of MY_ROUTE_EXEMPT) expect(paths.has(path), `${path} is exempt, so it must be a checked path`).toBe(true);
    const bad = outputs.filter((o) => !MY_ROUTE_EXEMPT.has(o.path) && saysMyRoute(o.text)).map((o) => `${o.path}: "${o.text}"`);
    expect(bad).toEqual([]);
  });

  it('writes Learning Route in title case only, anywhere in the dictionary', () => {
    const all = everyOutput();
    // The whole dictionary includes every checked namespace.
    const allPaths = new Set(all.map((o) => o.path));
    for (const o of outputs) expect(allPaths.has(o.path), o.path).toBe(true);
    const bad = all.filter((o) => miscased(o.text).length > 0).map((o) => `${o.path}: "${o.text}"`);
    expect(bad).toEqual([]);
  });

  it('never says "family plan" or "class plan" outside the site (the dated plan is the weekly plan)', () => {
    const bad = outputs.filter((o) => !o.path.startsWith('landing.') && saysProductPlan(o.text)).map((o) => `${o.path}: "${o.text}"`);
    expect(bad).toEqual([]);
  });

  // Skipped, not passed, until LR-7 adds `console.learningRoute`; it then runs unchanged.
  it.skipIf(!hasLearningRoute)("cases 2 and 3 of the grown-up card never claim the learner's own goal (LR-7)", () => {
    for (const path of SCOPED_GOAL_PATHS) expect(lookup(en, path), `${path} (section 11.1)`).toBeDefined();
    const scoped = render(lookup(en, 'console.learningRoute'), 'console.learningRoute').filter((o) => !isCase1Only(o.path));
    const scopedPaths = new Set(scoped.map((o) => o.path));
    for (const path of SCOPED_GOAL_PATHS) expect(scopedPaths.has(path), `${path} is checked`).toBe(true);
    const bad = scoped.filter((o) => claimsLearnerGoal(o.text)).map((o) => `${o.path}: "${o.text}"`);
    expect(bad).toEqual([]);
  });

  it('uses one word for a lesson that is not open yet, in every locale', () => {
    expect(lookup(en, NOT_OPEN_PATHS[0])).toBe('Not open yet');
    for (const locale of LOCALES) {
      const messages = getMessages(locale);
      const values = NOT_OPEN_PATHS.map((path) => lookup(messages, path)).filter((v) => v !== undefined);
      expect(values.length, locale).toBeGreaterThan(0);
      expect(new Set(values).size, `${locale}: ${values.join(' / ')}`).toBe(1);
    }
  });

  it('each rule catches the phrase it bans', () => {
    expect(saysMyRoute('See my route')).toBe(true);
    expect(saysMyRoute('My  Route')).toBe(true);
    expect(saysMyRoute('Your route stays right where it is.')).toBe(false);
    expect(miscased('LEARNING ROUTE')).toEqual(['LEARNING ROUTE']);
    expect(miscased('Learning route')).toEqual(['Learning route']);
    expect(miscased('See the Learning-Route')).toEqual(['Learning-Route']);
    expect(miscased('See Learning Route')).toEqual([]);
    expect(saysProductPlan('From your family plan')).toBe(true);
    expect(saysProductPlan('Class plans')).toBe(true);
    expect(saysProductPlan("From your class's weekly plan")).toBe(false);
    expect(claimsLearnerGoal("Sam's goal: Stage 2 · Words")).toBe(true);
    expect(claimsLearnerGoal('Goal: Stage 2 · Words')).toBe(true);
    expect(claimsLearnerGoal("Your class's weekly plan reaches Stage 2 · Words")).toBe(false);
    expect(claimsLearnerGoal('Next open stage: Stage 2 · Words')).toBe(false);
    expect(isCase1Only('console.learningRoute.fromLead.self')).toBe(true);
    expect(isCase1Only('console.learningRoute.planGoalTag')).toBe(false);
    expect(isCase1Only('console.learningRoute.goalTagline')).toBe(false);
  });
});
