import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Source guards for the My route screen (F-ROUTE-001 R-3). The mobile vitest
 * lane does not render components, so these pin what a render test would:
 * drawn shapes only (no arrow, geometric or emoji-capable character, section
 * 3.4), tokens only (no colour literal, CLAUDE.md section 4), no ratio or
 * percent text, no speaking UI, and the entries behind `flags.myRouteEnabled`.
 */
const SRC = join(__dirname, '..', '..', '..');
const SCREEN_DIR = join(SRC, 'screens', 'my-route');
const files = readdirSync(SCREEN_DIR).filter((f) => f.endsWith('.tsx'));
const read = (path: string): string => readFileSync(path, 'utf8');
const SYMBOL = /[\p{Extended_Pictographic}←-⇿⌀-⏿■-◿☀-➿️]/u;

describe('screens/my-route sources', () => {
  it('has the screen and its parts', () => {
    expect(files.sort()).toEqual(['GainsCard.tsx', 'HeroCard.tsx', 'MyRouteScreen.tsx', 'SkillsCard.tsx', 'StageBadge.tsx', 'TrailRow.tsx']);
  });

  for (const file of files) {
    const src = read(join(SCREEN_DIR, file));
    it(`${file}: no emoji-capable or arrow character`, () => {
      expect(src).not.toMatch(SYMBOL);
    });
    it(`${file}: no colour literal`, () => {
      expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
    });
    it(`${file}: no percent or ratio text, no speaking UI`, () => {
      expect(src).not.toMatch(/['"`][^'"`]*\d+\s*\/\s*\d+[^'"`]*['"`]/);
      expect(src).not.toMatch(/voice-echo|VoiceEcho|microphone|speak/i);
    });
    it(`${file}: names its design reference`, () => {
      expect(src).toMatch(/design\/(wireframes|components)\//);
    });
  }

  it('the screen reads the gate, sends route_map events and never reads storage directly', () => {
    const src = read(join(SCREEN_DIR, 'MyRouteScreen.tsx'));
    expect(src).toContain('myRouteAccess(');
    expect(src).toContain("navigation.replace('PinEntry', { next: 'MyRoute'");
    expect(src).toMatch(/viewedEvent\(|stageOpenedEvent\(|continueTappedEvent\(/);
    // The cursor comes from `cursorContext` inside the shared `routeModelInput` (R-4b).
    expect(src).toContain('routeModelInput(');
    expect(read(join(SRC, 'logic', 'my-route', 'route-input.ts'))).toContain('cursorContext(');
    expect(src).not.toMatch(/AsyncStorage|localStorage/);
  });

  it('the screen feeds the R-7a start route, so the start tag and known pips show', () => {
    const src = read(join(SCREEN_DIR, 'MyRouteScreen.tsx'));
    const input = read(join(SRC, 'logic', 'my-route', 'route-input.ts'));
    expect(src).toContain('buildMyRoute(routeModelInput(');
    expect(input).toContain('route: startRouteOf(i.snapshot.placements, journeyContent.catalog, cursor.isEntitled)');
    expect(src).not.toMatch(/route:\s*null/);
    expect(input).not.toMatch(/route:\s*null/);
  });

  it('the Journey header button exists only behind flags.myRouteEnabled', () => {
    const src = read(join(SRC, 'screens', 'journey', 'JourneyScreen.tsx'));
    const at = src.indexOf("navigate('MyRoute'");
    expect(at).toBeGreaterThan(0);
    expect(src.lastIndexOf('flags.myRouteEnabled ?', at)).toBeGreaterThan(0);
  });

  it('PinEntry continues to the read-only page once the gate is open, as a grown-up', () => {
    const src = read(join(SRC, 'screens', 'parent', 'PinEntryScreen.tsx'));
    expect(src).toContain("navigation.replace('MyRoute', { source: 'parent', profileId, viewer: 'grownup' })");
  });

  it('the screen forces read-only for a grown-up entry (amendment section 5.1)', () => {
    const src = read(join(SCREEN_DIR, 'MyRouteScreen.tsx'));
    expect(src).toContain("grownup: route.params?.viewer === 'grownup'");
  });
});

/**
 * The parent dashboard's Learning Route row (F-ROUTE-001 R-9b, section 3.12,
 * amendment LR-A6; wireframes `journey/my-route-overview.md` H and
 * `parent/learning-route.md` L1a).
 */
describe('parent dashboard Learning Route row sources', () => {
  const ROW = join(SRC, 'screens', 'parent', 'LearningRouteRow.tsx');
  const DASHBOARD = join(SRC, 'screens', 'parent', 'ParentDashboardScreen.tsx');
  const row = read(ROW);
  const dashboard = read(DASHBOARD);

  it('the row shows only behind flags.myRouteEnabled', () => {
    const at = dashboard.indexOf('<LearningRouteRow');
    expect(at).toBeGreaterThan(0);
    expect(dashboard.lastIndexOf('flags.myRouteEnabled ?', at)).toBeGreaterThan(0);
  });

  it('See Learning Route opens the root-stack page forced read-only, never the interactive one', () => {
    expect(row).toContain("navigation.navigate('MyRoute', { source: 'parent', profileId, viewer: 'grownup' })");
    for (const src of [row, dashboard]) {
      for (const m of src.matchAll(/navigate\('MyRoute'[^)]*\)/g)) expect(m[0]).toContain("viewer: 'grownup'");
    }
  });

  it('the row builds the same model as the page (cursor, start route) and never sends telemetry or writes seen', () => {
    expect(row).toContain('cursorContext(');
    expect(row).toContain('route: startRouteOf(snapshot.placements, journeyContent.catalog, cursor.isEntitled)');
    expect(row).toContain('dashboardRowView(');
    expect(row).not.toMatch(/track\(|writeSeen|viewedEvent|AsyncStorage|localStorage/);
  });

  it('no emoji-capable or arrow character, no colour literal, no ratio, no speaking UI', () => {
    expect(row).not.toMatch(SYMBOL);
    expect(row).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
    expect(row).not.toMatch(/['"`][^'"`]*\d+\s*\/\s*\d+[^'"`]*['"`]/);
    expect(row).not.toMatch(/voice-echo|VoiceEcho|microphone|speak/i);
  });

  it('names its design reference', () => {
    expect(row).toMatch(/design\/(wireframes|components)\//);
  });

  it('the drawn segments are hidden from screen readers and a text list reads them', () => {
    expect(row).toContain('accessibilityElementsHidden');
    expect(row).toContain('segment.a11yLabel');
  });
});

describe('the Home route strip (F-ROUTE-001 R-4b)', () => {
  it('the page and the strip build the model from one input helper', () => {
    const page = read(join(SRC, 'screens', 'my-route', 'MyRouteScreen.tsx'));
    expect(page).toContain('buildMyRoute(');
    expect(page).toContain('routeModelInput(');
    expect(page).toContain('localizedRouteContent(locale)');
  });

  const home = read(join(SRC, 'screens', 'home', 'HomeScreen.tsx'));
  const strip = read(join(SRC, 'screens', 'home', 'RouteStrip.tsx'));

  it('RouteStrip.tsx: tokens only, drawn shapes only, names its design reference', () => {
    expect(strip).not.toMatch(SYMBOL);
    expect(strip).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
    expect(strip).not.toMatch(/['"`][^'"`]*\d+\s*\/\s*\d+[^'"`]*['"`]/);
    expect(strip).toMatch(/design\/(wireframes|components)\//);
    expect(strip).toContain('<PipRow');
    expect(strip).toContain('<StageSegments');
    expect(strip).toContain('accessibilityLabel={view.a11yLabel}');
    // No header role inside the button (it would hide from heading navigation).
    expect(strip).not.toContain('<Heading');
  });

  it('Home builds the strip from the shared model and opens the page from Home', () => {
    expect(home).toContain('homeStripView(');
    expect(home).toContain('buildMyRoute(routeModelInput(');
    expect(home).toContain('localizedRouteContent(locale)');
    expect(home).toContain("navigation.navigate('MyRoute', { source: 'home' })");
  });

  it('the strip replaces the "Stage 1 progress" bar only behind flags.myRouteEnabled', () => {
    const strip = home.indexOf('<RouteStrip');
    const bar = home.indexOf('m.learner.home.progress.heading');
    expect(strip).toBeGreaterThan(0);
    expect(bar).toBeGreaterThan(0);
    const branch = home.lastIndexOf('flags.myRouteEnabled', strip);
    expect(branch).toBeGreaterThan(0);
    // One ternary: the strip when the flag is on, the old bar otherwise (never both).
    expect(bar).toBeGreaterThan(strip);
    expect(home.slice(strip, bar)).toMatch(/\)\s*:\s*\(/);
  });
});
