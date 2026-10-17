import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mainTabs } from '../../logic/my-route/tab';
import {
  ROOT_HEADER,
  SCREEN_HEADER_EXCEPTIONS,
  SCREEN_HEADER_ROOTS,
  SCREEN_HEADER_VARIANTS,
  isScreenHeaderException,
  screenHeaderVariant,
} from '../screen-header-variants';

/**
 * AMENDMENTS-DISPLAY-NAV section 7.1 (row DN-4): every non-root route of every navigator has its way
 * back (Back or Close) in `SCREEN_HEADER_VARIANTS`, the exception list is exactly the end of first-run
 * setup, and the roots draw no leading control. The route names are read from the navigators'
 * sources, so a screen registered without a variant fails here (and a variant whose route is gone
 * fails as stale). The record's type also refuses a param-list route without a variant at compile time.
 */
const SRC = join(__dirname, '..', '..');
const read = (path: string): string => readFileSync(join(SRC, path), 'utf8');

/** Every source file under a directory of `src` (tests aside). */
function sources(dir: string): string[] {
  return readdirSync(join(SRC, dir), { withFileTypes: true }).flatMap((e) => {
    const path = `${dir}/${e.name}`;
    if (e.isDirectory()) return e.name === '__tests__' ? [] : sources(path);
    return /\.tsx?$/.test(e.name) ? [path] : [];
  });
}

/** `name="X"` of every `<Stack.Screen>` in a navigator source. */
function stackRoutes(source: string): string[] {
  return [...source.matchAll(/<Stack\.Screen\s+name="([A-Za-z0-9]+)"/g)].map((m) => m[1]!);
}

/** The level check's nested stack: the keys of its `ROUTES` table. */
function placementRoutes(source: string): string[] {
  const table = source.slice(source.indexOf('const ROUTES = {'), source.indexOf('} satisfies Record<PlacementRoute'));
  return [...table.matchAll(/^\s+([A-Za-z0-9]+): flowRoute\(/gm)].map((m) => m[1]!);
}

const routes = {
  root: stackRoutes(read('navigation/root.tsx')),
  onboarding: stackRoutes(read('navigation/onboarding.tsx')),
  browse: stackRoutes(read('navigation/browse.tsx')),
  tabs: [...mainTabs(true)],
  placement: placementRoutes(read('screens/placement/PlacementScreen.tsx')),
};
const registered = new Set(Object.values(routes).flat());

describe('screen header registry (AMENDMENTS-DISPLAY-NAV section 7.1)', () => {
  it('reads every navigator', () => {
    expect(routes.root).toEqual(expect.arrayContaining(['Onboarding', 'Main', 'EpisodeDetail', 'QuestPlayer', 'Profile', 'ParentDashboard', 'VocabSpeedRound']));
    expect(routes.onboarding).toEqual(['Welcome', 'CreateProfile', 'FirstQuestPreview', 'PlacementInvite']);
    expect(routes.browse).toEqual(expect.arrayContaining(['BrowseHome', 'BrowseItem', 'PreviewQuest', 'BrowseAccess']));
    expect(routes.tabs).toEqual(['Home', 'Route', 'Journey', 'Library']);
    expect(routes.placement).toEqual(expect.arrayContaining(['PlacementBoot', 'PlacementItem', 'PlacementResult']));
  });

  it('every registered route has a variant', () => {
    expect([...registered].filter((name) => screenHeaderVariant(name) === undefined)).toEqual([]);
  });

  it('every variant names a registered route (no stale entry)', () => {
    expect(Object.keys(SCREEN_HEADER_VARIANTS).filter((name) => !registered.has(name))).toEqual([]);
  });

  it('the exception list is exactly PlacementInvite and FirstQuestPreview, with no way back', () => {
    expect([...SCREEN_HEADER_EXCEPTIONS].sort()).toEqual(['FirstQuestPreview', 'PlacementInvite']);
    for (const name of SCREEN_HEADER_EXCEPTIONS) {
      expect(isScreenHeaderException(name)).toBe(true);
      expect(SCREEN_HEADER_VARIANTS[name]).toBe('none');
    }
    expect(isScreenHeaderException('CreateProfile')).toBe(false);
  });

  it('the roots draw no leading control: Welcome, the four tabs, All lessons home and BrowseAccess', () => {
    expect(SCREEN_HEADER_ROOTS).toEqual(expect.arrayContaining(['Welcome', 'Home', 'Route', 'Journey', 'Library', 'BrowseHome', 'BrowseAccess']));
    for (const name of SCREEN_HEADER_ROOTS) expect(SCREEN_HEADER_VARIANTS[name]).toBe('none');
  });

  it('every other route has Back or Close', () => {
    const special = new Set<string>([...SCREEN_HEADER_ROOTS, ...SCREEN_HEADER_EXCEPTIONS]);
    const missing = Object.entries(SCREEN_HEADER_VARIANTS).filter(([name, variant]) => !special.has(name) && variant === 'none');
    expect(missing).toEqual([]);
  });

  it('flows that ask before leaving and modals draw Close; stack screens draw Back', () => {
    for (const name of ['QuestPlayer', 'Minigame', 'StageReview', 'StoryReader', 'Placement', 'PlacementItem', 'CardDetail', 'PinEntry', 'VocabSpeedRound', 'PreviewQuest']) {
      expect(SCREEN_HEADER_VARIANTS[name as keyof typeof SCREEN_HEADER_VARIANTS], name).toBe('close');
    }
    for (const name of ['EpisodeDetail', 'Profile', 'ParentDashboard', 'VocabTopic', 'Notes', 'JoinSpace', 'BrowseItem', 'CreateProfile', 'PinReset']) {
      expect(SCREEN_HEADER_VARIANTS[name as keyof typeof SCREEN_HEADER_VARIANTS], name).toBe('back');
    }
  });

  it('a name no navigator declares has no variant; the root header asks for nothing but the row', () => {
    expect(screenHeaderVariant('NoSuchRoute')).toBeUndefined();
    expect(screenHeaderVariant('toString')).toBeUndefined();
    expect(ROOT_HEADER).toEqual({});
    expect(Object.isFrozen(ROOT_HEADER)).toBe(true);
  });

  it('no screen draws its own back control any more (the per-screen controls are deleted)', () => {
    const files = ['screens/vocab/BackButton.tsx'];
    for (const file of files) expect(() => read(file)).toThrow();
    expect(read('screens/notes/parts.tsx')).not.toContain('export function BackButton');
    expect(read('screens/browse/browse-ui.tsx')).not.toMatch(/export function (HeaderBack|HeaderRow)\b/);
    expect(read('screens/placement/parts.tsx')).not.toMatch(/export function (BackArrow|ExitButton)\b/);
    // The unlabelled "Go back" arrows named by a11y.goBack are gone from every learner, grown-up and All lessons screen.
    const named = [...sources('screens'), ...sources('components')].filter((file) => /a11y\.goBack\b/.test(read(file)));
    expect(named).toEqual([]);
  });
});
