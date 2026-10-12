import { describe, expect, it } from 'vitest';
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
] as const;
/** `console.learningRoute.*` arrives with LR-7; the rules apply to it as soon as it exists. */
const LATER_NAMESPACES = ['console.learningRoute'] as const;

/** Section 7.3: the only value under the checked paths allowed to say "my route" (it speaks about the start spot). */
const MY_ROUTE_EXEMPT: ReadonlySet<string> = new Set(['learner.placement.result.routeStays']);

/** Section 6.1 cases 2 and 3 (section 11.1 names): they must not claim to show the learner's own goal. */
const SCOPED_GOAL_PATHS = [
  'console.learningRoute.planReaches.class',
  'console.learningRoute.planReaches.family',
  'console.learningRoute.stageReached',
  'console.learningRoute.nextOpen',
] as const;

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

/** Section 7.3: "learning route" in any casing but the title case of LR-OD-1. */
const miscased = (text: string): string[] => [...text.matchAll(/learning\s+route/gi)].map((m) => m[0]).filter((m) => m !== 'Learning Route');
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
    const bad = outputs.filter((o) => !MY_ROUTE_EXEMPT.has(o.path) && saysMyRoute(o.text)).map((o) => `${o.path}: "${o.text}"`);
    expect(bad).toEqual([]);
  });

  it('writes Learning Route in title case only', () => {
    const bad = outputs.filter((o) => miscased(o.text).length > 0).map((o) => `${o.path}: "${o.text}"`);
    expect(bad).toEqual([]);
  });

  it('never says "family plan" or "class plan" outside the site (the dated plan is the weekly plan)', () => {
    const bad = outputs.filter((o) => !o.path.startsWith('landing.') && saysProductPlan(o.text)).map((o) => `${o.path}: "${o.text}"`);
    expect(bad).toEqual([]);
  });

  it('cases 2 and 3 of the grown-up card never claim the learner\'s own goal (once LR-7 adds them)', () => {
    if (lookup(en, 'console.learningRoute') === undefined) return;
    for (const path of SCOPED_GOAL_PATHS) expect(lookup(en, path), `${path} (section 11.1)`).toBeDefined();
    const bad = SCOPED_GOAL_PATHS.flatMap((path) => render(lookup(en, path), path))
      .filter((o) => claimsLearnerGoal(o.text))
      .map((o) => `${o.path}: "${o.text}"`);
    expect(bad).toEqual([]);
  });

  it('uses one word for a lesson that is not open yet', () => {
    const values = NOT_OPEN_PATHS.map((path) => lookup(en, path)).filter((v) => v !== undefined);
    expect(lookup(en, NOT_OPEN_PATHS[0])).toBe('Not open yet');
    expect(new Set(values)).toEqual(new Set(['Not open yet']));
  });

  it('each rule catches the phrase it bans', () => {
    expect(saysMyRoute('See my route')).toBe(true);
    expect(saysMyRoute('My  Route')).toBe(true);
    expect(saysMyRoute('Your route stays right where it is.')).toBe(false);
    expect(miscased('LEARNING ROUTE')).toEqual(['LEARNING ROUTE']);
    expect(miscased('Learning route')).toEqual(['Learning route']);
    expect(miscased('See Learning Route')).toEqual([]);
    expect(saysProductPlan('From your family plan')).toBe(true);
    expect(saysProductPlan('Class plans')).toBe(true);
    expect(saysProductPlan("From your class's weekly plan")).toBe(false);
    expect(claimsLearnerGoal("Sam's goal: Stage 2 · Words")).toBe(true);
    expect(claimsLearnerGoal('Goal: Stage 2 · Words')).toBe(true);
    expect(claimsLearnerGoal("Your class's weekly plan reaches Stage 2 · Words")).toBe(false);
    expect(claimsLearnerGoal('Next open stage: Stage 2 · Words')).toBe(false);
  });
});
