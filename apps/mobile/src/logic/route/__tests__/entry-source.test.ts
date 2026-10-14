import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { routeEnabledFor } from '../../../config/flags';

/**
 * F-PLAN-002 P2-8b: with `flags.routeEnabled` on by default, the learner entries to the weekly plan
 * (Home's plan slot: the prompt, the Hoya check-in and the moved line; the Profile row) follow
 * `routeEnabledFor(locale)`, so a UI locale whose `learner.weeklyPlan` words have no signed review
 * never shows them (en only). The stack keeps registering the screens on the raw flag, as reports do.
 */
const src = (rel: string): string => readFileSync(join(__dirname, '../../..', rel), 'utf8');
const slot = src('screens/route/PlanPromptCard.tsx');
const profile = src('screens/profile/ProfileScreen.tsx');
const root = src('navigation/root.tsx');

describe('weekly plan entries follow routeEnabledFor(locale) (P2-8b)', () => {
  it("Home's plan slot reads the locale switch, never the raw flag", () => {
    expect(slot).toContain('routeEnabledFor(useLocale())');
    expect(slot).not.toContain('flags.routeEnabled');
  });

  it('the Profile row reads the locale switch, never the raw flag', () => {
    expect(profile).toContain('routeEnabledFor(locale)');
    expect(profile).not.toContain('flags.routeEnabled');
  });

  it('the stack registers the plan screens on the flag', () => {
    for (const name of ['RouteProposal', 'RouteSetup', 'RoutePreview', 'RouteOverview']) {
      expect(root).toMatch(new RegExp(`\\{flags\\.routeEnabled \\? <Stack\\.Screen name="${name}"`));
    }
  });
});

describe('every learner-facing weekly plan entry reads routeEnabledFor(locale) (P2-8b follow-up, #577)', () => {
  // The only places that may read the raw flag: the stack registering the plan screens (the entries gate) and the
  // daily re-pace of a plan the learner already has (#577: it keeps a made plan current whatever the UI locale).
  const RAW_FLAG_READERS: Readonly<Record<string, number>> = {
    'navigation/root.tsx': 4,
    'store/membership-store.ts': 2,
  };
  const SCREEN_ENTRIES: Readonly<Record<string, string>> = {
    'screens/route/PlanPromptCard.tsx': 'routeEnabledFor(useLocale())',
    'screens/profile/ProfileScreen.tsx': 'routeEnabledFor(locale)',
    'screens/my-route/MyRouteScreen.tsx': 'planOverview: routeEnabledFor(locale)',
    'screens/parent/SuggestedPlanCard.tsx': 'routeEnabledFor(useLocale())',
    'screens/placement/PlacementScreen.tsx': 'routeEnabledFor(uiLocale)',
  };

  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const full = join(dir, e.name);
      if (e.isDirectory()) return e.name === '__tests__' || e.name === '__generated__' ? [] : walk(full);
      return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [full] : [];
    });
  const root = join(__dirname, '../../..');
  // Code reads only, found on the syntax tree, so comments (however they wrap) never count: `flags.routeEnabled`,
  // `flags['routeEnabled']` and `const { routeEnabled } = flags`. A read through another alias of `flags`, or an offer
  // call handed a literal `true`, is not caught here; the SCREEN_ENTRIES checks below pin the known entries.
  const codeReads = (text: string): number => {
    const file = ts.createSourceFile('f.tsx', text, ts.ScriptTarget.Latest, false, ts.ScriptKind.TSX);
    const isFlags = (e: ts.Node): boolean => ts.isIdentifier(e) && e.text === 'flags';
    let n = 0;
    const visit = (node: ts.Node): void => {
      if (ts.isPropertyAccessExpression(node) && isFlags(node.expression) && node.name.text === 'routeEnabled') n += 1;
      else if (
        ts.isElementAccessExpression(node) &&
        isFlags(node.expression) &&
        ts.isStringLiteralLike(node.argumentExpression) &&
        node.argumentExpression.text === 'routeEnabled'
      )
        n += 1;
      else if (
        ts.isVariableDeclaration(node) &&
        node.initializer !== undefined &&
        isFlags(node.initializer) &&
        ts.isObjectBindingPattern(node.name) &&
        node.name.elements.some((b) => (b.propertyName ?? b.name).getText(file) === 'routeEnabled')
      )
        n += 1;
      ts.forEachChild(node, visit);
    };
    visit(file);
    return n;
  };

  it('the reader scan sees through comments and the other spellings of a read', () => {
    expect(codeReads('/* a note\n flags.routeEnabled\n */ // flags.routeEnabled\nconst a = 1;')).toBe(0);
    expect(codeReads('const a = flags.routeEnabled;')).toBe(1);
    expect(codeReads("const a = flags['routeEnabled'];")).toBe(1);
    expect(codeReads('const { routeEnabled } = flags;')).toBe(1);
    expect(codeReads('const { routeEnabled: on } = flags;')).toBe(1);
    expect(codeReads('const a = 2\n  * flags.routeEnabledCount;')).toBe(0);
  });

  it('no file outside the allow list reads flags.routeEnabled', () => {
    const readers: Record<string, number> = {};
    for (const file of walk(root)) {
      const n = codeReads(readFileSync(file, 'utf8'));
      if (n > 0) readers[relative(root, file).split(sep).join('/')] = n;
    }
    expect(readers).toEqual(RAW_FLAG_READERS);
  });

  it('each entry screen reads the locale switch', () => {
    for (const [file, call] of Object.entries(SCREEN_ENTRIES)) {
      expect(src(file), file).toContain(call);
      expect(codeReads(src(file)), file).toBe(0);
    }
  });

  it('the report card (SuggestedPlanCard) neither reads the offer nor draws in an es or ko UI', () => {
    const card = src('screens/parent/SuggestedPlanCard.tsx');
    expect(card).toContain('const enabled = routeEnabledFor(useLocale());');
    expect(card).toContain('if (!enabled) return;');
    expect(card).toContain('if (!enabled) return null;');
    expect(routeEnabledFor('es', { routeEnabled: true }, false)).toBe(false);
    expect(routeEnabledFor('ko', { routeEnabled: true }, false)).toBe(false);
  });

  it('the placement strip and its offer read the same locale switch', () => {
    const placement = src('screens/placement/PlacementScreen.tsx');
    expect(placement).toContain('planOfferNow(profile.id, planOn, new Date())');
    expect(placement).toContain('routeEnabled: planOn,');
  });
});

describe('the overview offers Refresh route only for an older catalogue (F-STORY-005 PR 5.6)', () => {
  it('a route saved on a newer catalogue (another device on a newer build) is not stale', () => {
    const overview = src('screens/route/RouteOverviewScreen.tsx');
    expect(overview).toContain('active.meta.catalogVersion < CATALOG.version');
    expect(overview).not.toContain('active.meta.catalogVersion !== CATALOG.version');
  });
});
