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
    // LR-5a: the route card replaces the hero card.
    expect(files.sort()).toEqual(['GainsCard.tsx', 'LetterWall.tsx', 'MyRouteScreen.tsx', 'RouteCard.tsx', 'SkillsCard.tsx', 'StageBadge.tsx', 'TrailRow.tsx']);
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

  it('the open Stage 1 draws the R-7c letter wall from the page model, each letter with KoreanText', () => {
    const screen = read(join(SCREEN_DIR, 'MyRouteScreen.tsx'));
    const trail = read(join(SCREEN_DIR, 'TrailRow.tsx'));
    const wall = read(join(SCREEN_DIR, 'LetterWall.tsx'));
    expect(screen).toContain('letterWall: routeLetterWall(model)');
    expect(trail).toMatch(/row\.letterWall[^\n]*<LetterWall /);
    expect(wall).toContain('<KoreanText');
    expect(wall).toContain('accessibilityLabel={tile.a11yLabel}');
    // The tile list carries its items (ARIA list needs listitem children), and a tile grows with the device text size.
    expect(wall).toContain('role="listitem"');
    expect(wall).toContain('letterTileWidth(TILE_WIDTH, fontScale)');
    // Romanization and gloss always show on the wall: the letters are taught content (CLAUDE.md section 1).
    expect(wall).not.toContain('romanizationShown={false}');
  });

  it('the screen feeds the R-7a start route, so the start tag and known pips show', () => {
    const src = read(join(SCREEN_DIR, 'MyRouteScreen.tsx'));
    const input = read(join(SRC, 'logic', 'my-route', 'route-input.ts'));
    expect(src).toContain('buildMyRoute(routeModelInput(');
    expect(input).toContain('route: startRouteOf(i.snapshot.placements, journeyContent.catalog, cursor.isEntitled)');
    expect(src).not.toMatch(/route:\s*null/);
    expect(input).not.toMatch(/route:\s*null/);
  });

  it('the page line and the Home strip read one live weekly plan week (R-7b)', () => {
    const page = read(join(SCREEN_DIR, 'MyRouteScreen.tsx'));
    const home = read(join(SRC, 'screens', 'home', 'HomeScreen.tsx'));
    expect(page).toContain('week: routeWeekOf(model, next)');
    expect(home).toMatch(/homeStripView\(\{[\s\S]*?week:\s*routeWeekOf\(\s*model,\s*routeInput/);
    // The strip's model is built from the same input as the week, so the goal and the week name one plan.
    expect(home).toContain('...(routeInput ? { next: routeInput } : {})');
  });

  it('the Journey header button exists only behind flags.myRouteEnabled and opens the Route tab (LR-4, LR-OD-11)', () => {
    const src = read(join(SRC, 'screens', 'journey', 'JourneyScreen.tsx'));
    const at = src.indexOf("navigation.navigate('Main', { screen: 'Route' })");
    expect(at).toBeGreaterThan(0);
    expect(src.lastIndexOf('flags.myRouteEnabled ?', at)).toBeGreaterThan(0);
    expect(src.lastIndexOf('messages.learner.myRoute.open.cta', at)).toBeGreaterThan(0);
    expect(src).not.toContain("navigate('MyRoute'");
  });

  it('PinEntry continues to the read-only page once the gate is open, as a grown-up', () => {
    const src = read(join(SRC, 'screens', 'parent', 'PinEntryScreen.tsx'));
    expect(src).toContain("navigation.replace('MyRoute', { profileId, viewer: 'grownup' })");
  });

  it('the screen forces read-only for a grown-up entry (amendment section 5.1)', () => {
    const src = read(join(SCREEN_DIR, 'MyRouteScreen.tsx'));
    expect(src).toContain('entry: myRouteEntryOf(route.params)');
    // Read-only builds the grown-up view, which carries no episode, tile or stories link (view.test.ts).
    expect(src).toContain("viewer: readOnly ? 'grownup' : 'self'");
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
    expect(row).toContain("navigation.navigate('MyRoute', { profileId, viewer: 'grownup' })");
    for (const src of [row, dashboard]) {
      for (const m of src.matchAll(/navigate\('MyRoute'[^)]*\)/g)) expect(m[0]).toContain("viewer: 'grownup'");
    }
  });

  it('the row builds the same model as the page (the one routeModelInput) and never sends telemetry or writes seen', () => {
    expect(row).toContain('buildMyRoute(routeModelInput(');
    expect(row).toContain('localizedRouteContent(locale)');
    expect(row).not.toContain('startRouteOf(');
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

  it('draws the segments with the design system StageSegments (hidden from screen readers) and a text list reads them', () => {
    expect(row).toContain('<StageSegments');
    expect(row).not.toMatch(/pipParts|cursorMarkerParts|markerBand|<Svg/);
    expect(row).toContain('role="listitem"');
    expect(row).toContain('segment.a11yLabel');
  });

  it('waits for the snapshot before drawing a profile, so a child is never shown as a new learner first', () => {
    expect(row).toContain('hydratedFor.has(profileId)');
  });

  it('content that cannot be read still leaves the title and See Learning Route, which opens the page and its retry', () => {
    expect(row).toMatch(/view === null \?/);
    expect(row).toContain('LearningRouteRowFallback');
  });

  it('the Started line is left to the Starting spot row when that row shows (one level check per card)', () => {
    const at = dashboard.indexOf('<LearningRouteRow');
    expect(dashboard.slice(at, dashboard.indexOf('/>', at))).toContain('showStarted={!flags.placementEnabled}');
  });

  it('the skill inks come from the page skills card, not a copy', () => {
    expect(row).toContain("import { SKILL_ACCENT } from '../my-route/SkillsCard'");
    expect(row).not.toMatch(/const SKILL_ACCENT/);
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

  it('Home builds the strip from the shared model and opens the Route tab from Home (LR-4)', () => {
    expect(home).toContain('homeStripView(');
    expect(home).toContain('buildMyRoute(routeModelInput(');
    expect(home).toContain('localizedRouteContent(locale)');
    expect(home).toContain("<RouteStrip view={routeStrip} onPress={() => navigation.navigate('Main', { screen: 'Route' })} />");
    expect(home).not.toContain("navigate('MyRoute'");
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

/** Every source file under src/ except tests, for the navigation contract checks. */
const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });

/**
 * The Route tab and its entries (AMENDMENTS-ROUTE-LEARNING-ROUTE LR-4, sections
 * 5.1 and 5.2; design/screens/learning-route/tab-bar.md, mock/route-tab.html).
 */
describe('the Route tab (LR-4)', () => {
  const tabs = read(join(SRC, 'navigation', 'tabs.tsx'));
  const types = read(join(SRC, 'navigation', 'types.ts'));
  const screen = read(join(SCREEN_DIR, 'MyRouteScreen.tsx'));

  it('the tab bar takes its order from mainTabs(flags.myRouteEnabled), so the Route tab shows only behind the flag', () => {
    expect(tabs).toContain('mainTabs(flags.myRouteEnabled)');
    expect(tabs).toContain('Route: MyRouteTabScreen');
    // No Tab.Screen is written out by hand: the order and the flag live in one place (logic/my-route/tab.ts).
    expect(tabs.match(/<Tab\.Screen/g)).toHaveLength(1);
    expect(types).toMatch(/MainTabParamList = \{[^}]*Route: undefined;/s);
  });

  it('the Route tab draws the route glyph from Icon, labelled Route with the accessibility label Learning Route', () => {
    expect(tabs).toContain('<Icon name={TAB_ICON[route.name]}');
    expect(tabs).toContain('Route: tabs.route');
    expect(tabs).toContain('messages.a11y.myRoute.tab');
    // The four-tab bar names every tab through tabAccessibilityLabel (iOS keeps "tab, n of 4"); the three-tab bar is untouched.
    expect(tabs).toContain('tabAccessibilityLabel(name, order, spoken, Platform.OS)');
    expect(tabs).toContain('position: messages.a11y.tabPosition');
    expect(tabs).toContain(': { tabBarLabel: labels[name] }}');
    expect(tabs).not.toMatch(SYMBOL);
    expect(tabs).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
  });

  it('the tab labels use the type tokens only (caption, semibold)', () => {
    expect(tabs).toContain('fontWeight: typography.weight.semibold');
    expect(tabs).not.toMatch(/fontWeight: '\d+'/);
  });

  it('only the four-tab bar caps its native label at 1.3 x caption and shrinks to fit; the three-tab bar keeps its plain labels', () => {
    expect(tabs).toContain('{...FOUR_TAB_LABEL_FIT}');
    expect(tabs).toMatch(/fourTabs \? \{ tabBarLabel: fittedLabel\(/);
    expect(tabs).toMatch(/design\/screens\/learning-route\/tab-bar\.md/);
  });

  it('the tab variant has no back button, shows the title and the purpose line, and sends route_map.viewed with source tab once per focus', () => {
    expect(screen).toContain('export function MyRouteTabScreen(');
    expect(screen).toContain("variant=\"tab\"");
    expect(screen).toMatch(/variant === 'stack' \? back : null/);
    expect(screen).toContain('{m.purpose}');
    expect(screen).toContain('useFocusEffect(');
    expect(screen).toContain("source: 'tab'");
    // The per-focus decision is the pure focusEffects (logic/my-route/focus.ts, unit-tested); the screen applies it.
    expect(screen).toContain('focusEffects({ focusKey, viewedFor: viewedFor.current, seenFor, seenWrittenFor: seenWrittenFor.current, readOnly');
    expect(screen).toMatch(/if \(fx\.sendViewed\)/);
    expect(screen).toMatch(/if \(fx\.writeSeen\)/);
    expect(screen).toMatch(/design\/screens\/learning-route\//);
  });

  it('the tab stays mounted, so each focus is a fresh open: read chained on the write, view gated, hero focus and fill per focus', () => {
    // The read scheduling and the view gate are the pure seenReadAfter / seenForView (focus.ts, unit-tested).
    expect(screen).toContain('seenReadAfter(pendingWrite.current, () => readSeen(STORAGE, profileId), () => live)');
    expect(screen).toContain('written = writeSeen(');
    expect(screen).toContain('pendingWrite.current = written;');
    // The write carries the record this open read, so goalsReached survives every later focus (LR-3b, LR-5c).
    expect(screen).toContain('seenFrom(model, new Date(), seenRead)');
    expect(screen).toContain('seenForView({ focusKey, seenFor, focused, seen: seenRead })');
    expect(screen).toMatch(/return \(\) => \{\s*setFocused\(false\);/);
    // Screen-reader focus lands on the route card's summary on every focus, not only on mount (amendment section 10).
    expect(screen).toContain('focusToken={focusKey}');
    const card = read(join(SCREEN_DIR, 'RouteCard.tsx'));
    expect(card).toMatch(/focusForScreenReader\(summaryRef\.current\);\s*\}, \[focusToken\]\);/);
    // The one-time fill restarts from faded whenever it turns on, so it plays on a later focus too.
    const trail = read(join(SCREEN_DIR, 'TrailRow.tsx'));
    expect(trail).toMatch(/if \(!animate\) return;\s*opacity\.setValue\(FRESH_FROM\);/);
  });

  it('the first reached goal (LR-5c): the Hoya line for that visit, the goalsReached write and route_map.goal_reached, never read-only', () => {
    // The decision is the pure firstGoalReachedFor (focus.ts, unit-tested): only after this focus's read, never read-only.
    expect(screen).toContain('firstGoalReachedFor({ focusKey, seenFor, focused, readOnly, goal: model?.goal ?? null, seen: seenRead })');
    expect(screen).toMatch(/myRouteView\(\{[\s\S]*?firstReached,/);
    // The key is written once per focus (goalRecordFor, unit-tested): with this focus's seen record, or on its
    // own when the goal is reached mid-focus; the event is sent only after the write succeeds.
    expect(screen).toContain('goalRecordFor({ focusKey, seenWrittenFor: seenWrittenFor.current, writeSeenNow: fx.writeSeen, firstReached, goal: model.goal, recordedFor: goalRecordedFor.current })');
    expect(screen).toMatch(/if \(fx\.writeSeen\) \{[\s\S]*?withGoalReached\(record, goal\)/);
    expect(screen).toMatch(/withGoalReached\(stored \?\? fallback, goal\)/);
    expect(screen).toMatch(/goalReachedEvent\(\{ profileId, goal, firstReached, readOnly \}\)[\s\S]*?written\.then\(\(ok\) => \{\s*if \(ok\) void track\(reached\);/);
  });

  it('the root-stack screen is grown-up only: a learner access moves to the tab instead of opening a second copy', () => {
    // navigate returns to the Main route already below (replace would stack a second Main).
    expect(screen).toContain("navigation.navigate('Main', { screen: selfEntryTab(flags.myRouteEnabled) })");
    expect(screen).not.toContain("navigation.replace('Main'");
    expect(types).toContain("MyRoute: { profileId: string; viewer: 'grownup' };");
  });

  it("every navigate('MyRoute' or replace('MyRoute' passes profileId and viewer 'grownup'", () => {
    let calls = 0;
    for (const file of sourceFiles(SRC)) {
      for (const m of read(file).matchAll(/(navigate|replace)\('MyRoute'[^)]*\)/g)) {
        calls += 1;
        expect(m[0], file).toMatch(/\{ profileId(: \w+)?, viewer: 'grownup' \}/);
      }
    }
    // The dashboard row and the PIN screen's continue.
    expect(calls).toBeGreaterThanOrEqual(2);
  });

  it('the active learner reaches the tab from the level-check result, behind the same flag', () => {
    const placement = read(join(SRC, 'screens', 'placement', 'PlacementScreen.tsx'));
    const result = read(join(SRC, 'screens', 'placement', 'ResultScreen.tsx'));
    expect(placement).toContain('myRouteEnabled: flags.myRouteEnabled');
    expect(placement).toMatch(/case 'seeMyRoute':\s*resetTo\(\[\{ name: 'Main', params: \{ screen: 'Route' \} \}\]\);/);
    expect(result).toContain("seeMyRoute: 'seeMyRoute'");
  });

  it('no billing, plans or ask link anywhere under screens/my-route/', () => {
    for (const file of files) {
      const src = read(join(SCREEN_DIR, file));
      expect(src, file).not.toMatch(/Paywall|[Bb]illing|navigate\('Plans|askGrown|askParent/);
    }
  });
});

describe('the route card wiring (Learning Route LR-5a)', () => {
  const screen = read(join(SCREEN_DIR, 'MyRouteScreen.tsx'));
  const card = read(join(SCREEN_DIR, 'RouteCard.tsx'));
  const trail = read(join(SCREEN_DIR, 'TrailRow.tsx'));
  const home = read(join(SRC, 'screens', 'home', 'HomeScreen.tsx'));
  const row = read(join(SRC, 'screens', 'parent', 'LearningRouteRow.tsx'));

  it('the page builds F-ENT-003\'s input as Home does and passes it to the one model input', () => {
    expect(screen).toContain('routeNextInputOf({');
    expect(screen).toContain('buildMyRoute(routeModelInput({ snapshot, tier, localized, seen, now, next }))');
    expect(home).toMatch(/routeNextInputOf\(\{[\s\S]*gatingActive: gatingActive\(flags, bundleOs\(\)\)/);
    expect(screen).toContain('gatingActive: gatingActive(flags, bundleOs())');
  });

  it('quest access comes only from F-ENT-003\'s tier store: the learner\'s own, or the viewed learner\'s for a grown-up', () => {
    expect(screen).toContain('const activeQuestOpen = useQuestAccess();');
    expect(screen).toContain('isQuestOpen: readOnly ? questOpenFor(profileId, now, snapshot) : activeQuestOpen');
    for (const file of files) expect(read(join(SCREEN_DIR, file)), file).not.toMatch(/questAccess\(|questOpenPredicate\(|content-access/);
  });

  it('Continue opens the one next, sends continue_tapped and route.next_started from the route surface, never read-only', () => {
    expect(screen).toMatch(/cta\.action === 'quest' && model\.next/);
    expect(screen).toContain("if (!readOnly) void track(nextStartedEvent(profileId, model.next.source, 'route'));");
    expect(screen).toContain("navigation.navigate('QuestPlayer', { questId: model.next.questId, episodeId: model.next.episodeId })");
    expect(screen).not.toMatch(/model\.cursor\.questId/);
  });

  it('the card names the next quest and the plan week; the grown-up card gets the plan end formatter', () => {
    expect(screen).toContain('model.next ? questsAll.find((q) => q.id === model.next?.questId)');
    expect(screen).toContain('week: routeWeekOf(model, next)');
    expect(screen).toContain("formatDay: (day) => formatDate(locale, `${day}T00:00:00.000Z`, 'monthDay', { utc: true })");
    expect(screen).toContain('testID="my-route-plan-line"');
  });

  it('Open plan (R-7d) opens F-PLAN-002 RouteOverview for this learner, behind flags.routeEnabled, never read-only', () => {
    // The view decides when it shows (own plan, learner view); the screen passes the flag and opens the plan.
    expect(screen).toContain('planOverview: flags.routeEnabled');
    expect(screen).toMatch(/view\.planOpen !== null && !readOnly/);
    expect(screen).toContain("navigation.navigate('RouteOverview', { profileId })");
    expect(screen).toContain('testID="my-route-plan-open"');
    // The accessible name is the visible words (section 3.9), with the link role from LinkButton.
    expect(screen).toMatch(/<LinkButton label=\{view\.planOpen\}/);
    // RouteOverview is mounted only behind the same flag, so the link never opens a missing screen.
    expect(read(join(SRC, 'navigation', 'root.tsx'))).toContain('{flags.routeEnabled ? <Stack.Screen name="RouteOverview"');
    // Structure: the link sits inside the plan line's block (after the line, before the block closes), not elsewhere.
    const block = screen.slice(screen.indexOf('{view.planLine !== null ? ('));
    const blockEnd = block.indexOf('</>\n      ) : null}');
    expect(blockEnd).toBeGreaterThan(0);
    const inBlock = block.slice(0, blockEnd);
    expect(inBlock.indexOf('testID="my-route-plan-line"')).toBeGreaterThan(-1);
    expect(inBlock.indexOf('testID="my-route-plan-open"')).toBeGreaterThan(inBlock.indexOf('testID="my-route-plan-line"'));
    expect(screen.split('testID="my-route-plan-open"')).toHaveLength(2);
    // The profile opened is the page's own body prop, the profile whose plan line this is.
    expect(screen).toMatch(/function MyRouteBody\(\{ profileId, readOnly, variant, navigation \}/);
  });

  it('the card is one summary for screen readers with its glyphs, Hoya and pips hidden; one button only when not read-only', () => {
    expect(card).toContain('accessibilityRole="summary"');
    expect(card).toContain('accessibilityLabel={copy.a11yLabel}');
    expect(card).toMatch(/<Icon name=\{name\}/);
    expect(card.match(/<Button /g)).toHaveLength(1);
    expect(card).toContain('cta !== null ?');
    expect(card).toMatch(/importantForAccessibility="no-hide-descendants"/);
  });

  it('the trail draws the goal flag, the start pin and "In your plan" as a chip with its ring, never a bare ring', () => {
    expect(trail).toContain('<Icon name={tag.glyph}');
    expect(trail).toContain('{cell.inPlan !== null ? <InPlanChip label={cell.inPlan} /> : null}');
    expect(trail).toContain('<PlanRing />');
  });

  it('the content-cannot-be-read state is Hoya, the route words and Try again (LR-D state J)', () => {
    expect(screen).toContain('messages.caregiver.journey.error(');
    expect(screen).toContain('m.hero.error');
    expect(screen).toContain('testID="my-route-error"');
  });

  it('the Home strip and the parent dashboard row name the same goal from the same input', () => {
    expect(home).toMatch(/homeStripView\(\{\s*model,\s*messages: m,\s*goalStage: model\.goal\?\.stage \?\? null,\s*week: routeWeekOf\(\s*model,\s*routeInput/);
    expect(home).toContain('...(routeInput ? { next: routeInput } : {})');
    expect(row).toContain('dashboardRowView({ model, messages, name, started, goalStage: model.goal?.stage ?? null })');
    expect(row).toContain('buildMyRoute(routeModelInput({ snapshot, tier, localized, now, next }))');
    expect(row).toContain('isQuestOpen: questOpenFor(profileId, now, snapshot)');
  });
});

describe('the narrow-width route card (Learning Route LR-11)', () => {
  const card = read(join(SCREEN_DIR, 'RouteCard.tsx'));

  it('takes its padding, gaps and can-do lines from routeCardLook (unit-tested) and draws the goal pips with bands per line', () => {
    expect(card).toContain('const look = routeCardLook(windowWidth, cta !== null);');
    expect(card).toContain('<Card padding={look.padding}');
    expect(card).toContain('gap: spacing[look.gap]');
    expect(card).toContain('marginTop: spacing[look.ctaGap]');
    expect(card).toContain('copy.canDo !== null && look.showCanDo');
    expect(card).toMatch(/<PipRow groups=\{\[\[\.\.\.pips\]\]\}[^>]*bandsPerLine/);
    // The summary label is the same at every width; it never included the can-do lines (spec section 10).
    expect(card).toContain('accessibilityLabel={copy.a11yLabel}');
  });
});

describe('not-open pips and the free-end hero (Learning Route LR-5b)', () => {
  const screen = read(join(SCREEN_DIR, 'MyRouteScreen.tsx'));
  const card = read(join(SCREEN_DIR, 'RouteCard.tsx'));
  const trail = read(join(SCREEN_DIR, 'TrailRow.tsx'));

  it('the legend draws "Not open yet" with the dotted ring, before "Coming later", only for a row that has a not-open pip', () => {
    expect(trail).toContain('<PipLegend accent={accent} notOpen={row.notOpenLegend} />');
    expect(trail).toMatch(/notOpen \? \([\s\S]*<Pip state="later"[\s\S]*\{m\.notOpen\}/);
    // The not-open row comes before the coming-later row: the word, not the shape, tells them apart.
    expect(trail.indexOf('{m.notOpen}')).toBeLessThan(trail.indexOf("LEGEND_AFTER.map"));
  });

  it('the free-end card hides the goal pips; the button is Practice words (the first free word topic) or Open Library', () => {
    expect(card).toContain('copy.showPips &&');
    expect(screen).toContain('practiceTopicOf(vocabTopics.map((t) => t.key))');
    expect(screen).toMatch(/cta\.action === 'practice' && practiceTopic !== null/);
    expect(screen).toContain("navigation.navigate('VocabTopic', { topicKey: practiceTopic })");
  });

  it('the route page never shows the first-lessons celebration, never sets its key and never sends free_end_reached', () => {
    for (const file of files) {
      const src = read(join(SCREEN_DIR, file));
      expect(src, file).not.toMatch(/free-end-seen|freeEndSeen|freeEnd\.title|free_end_reached|freeEndReached/);
    }
  });

  it('no lock glyph and no ask anywhere under screens/my-route/ (F-ENT-003 OD-6, LR-OD-8)', () => {
    for (const file of files) {
      const src = read(join(SCREEN_DIR, file));
      expect(src, file).not.toMatch(/name=["']lock["']|name=\{?['"]lock|askFor\(|help_asked|helpAsked|access\.ask/);
    }
  });
});
