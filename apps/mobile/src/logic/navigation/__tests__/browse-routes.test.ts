import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { linkOpenRoute } from '../screen-exits';

/**
 * F-BROWSE-001 BR-8 (section 4.7, section 10 `browse-routes`): no screen of the
 * All lessons stack dispatches a route the stack does not have, the learner
 * screens it reuses (`MinigameScreen`, `StoryReaderScreen`,
 * `StorySourcesScreen`) leave only through the browse exits (no learner
 * navigation is handed to them, so their learner defaults never run), and
 * story sources in All lessons are copy-only. Source scans: mobile unit tests
 * render no React Native component (the e2e `browse.spec.ts` plays them).
 * Kept under `logic/navigation` because the mobile vitest run includes
 * `src/logic/**` (as `romanization-hook-scan.test.ts` and
 * `screen-exits.test.ts`).
 */
const SRC = resolve(__dirname, '../../..');
const read = (path: string): string => readFileSync(resolve(SRC, path), 'utf8');

const navigator = read('navigation/browse.tsx');

/** The keys of `BrowseStackParamList`, read from its declaration. */
function paramListRoutes(): string[] {
  const body = /export type BrowseStackParamList = \{([\s\S]*?)\n\};/.exec(navigator)?.[1] ?? '';
  return [...body.matchAll(/^\s{2}(\w+):/gm)].map((m) => m[1] as string);
}

/** The names `BROWSE_REGISTERED_ROUTES` lists. */
function registeredRoutes(): string[] {
  const body = /BROWSE_REGISTERED_ROUTES[\s\S]*?\(\[([\s\S]*?)\]\)/.exec(navigator)?.[1] ?? '';
  return [...body.matchAll(/'(\w+)'/g)].map((m) => m[1] as string);
}

/** The names `<Stack.Screen name="…">` mounts. */
function mountedRoutes(): string[] {
  return [...navigator.matchAll(/<Stack\.Screen name="(\w+)"/g)].map((m) => m[1] as string);
}

const browseScreens = readdirSync(resolve(SRC, 'screens/browse'))
  .filter((f) => f.endsWith('.tsx'))
  .map((f) => ({ file: `screens/browse/${f}`, source: read(`screens/browse/${f}`) }));

describe('the All lessons stack (section 4.1)', () => {
  it('every typed route is registered and mounted once BR-8 lands, and nothing else is', () => {
    const typed = paramListRoutes().sort();
    expect(typed).toEqual(['BrowseAccess', 'BrowseEpisode', 'BrowseHome', 'BrowseItem', 'CardDetail', 'Minigame', 'PreviewEnd', 'PreviewFlashcards', 'PreviewQuest', 'StoryReader', 'StorySources']);
    expect(registeredRoutes().sort()).toEqual(typed);
    expect(mountedRoutes().sort()).toEqual(typed);
  });

  it('no browse screen dispatches a route the stack lacks', () => {
    const known = new Set(paramListRoutes());
    const dispatched: string[] = [];
    for (const { file, source } of browseScreens) {
      for (const m of source.matchAll(/\b(?:navigate|replace|push)\(\s*'(\w+)'/g)) {
        dispatched.push(m[1] as string);
        expect(known.has(m[1] as string), `${file} dispatches ${m[1]}`).toBe(true);
      }
      // Never a learner reset or a learner action creator.
      expect(source, file).not.toMatch(/CommonActions|StackActions|navigation\/types|RootStackParamList/);
    }
    // the scan saw the preview's own exits
    expect(dispatched).toEqual(expect.arrayContaining(['PreviewQuest', 'PreviewEnd', 'PreviewFlashcards', 'StoryReader', 'StorySources', 'Minigame', 'BrowseItem', 'BrowseHome', 'CardDetail']));
  });
});

describe('the learner screens inside All lessons (section 4.7, the navigation adapter of BR-5c)', () => {
  const lessons = read('screens/browse/BrowseLessonScreens.tsx');
  const preview = read('screens/browse/PreviewQuestScreen.tsx');

  /** The JSX element `<Name … />` as written, for its props. */
  function element(source: string, name: string): string {
    const m = new RegExp(`<${name}\\b([\\s\\S]*?)/>`).exec(source);
    expect(m, `<${name}> is rendered`).not.toBeNull();
    return m?.[1] ?? '';
  }

  it('MinigameScreen, StoryReaderScreen and StorySourcesScreen get the browse exits and never a learner navigation', () => {
    for (const name of ['MinigameScreen', 'StoryReaderScreen', 'StorySourcesScreen']) {
      const props = element(lessons, name);
      expect(props, name).not.toMatch(/\bnavigation=/);
      expect(props, name).toMatch(/\bonBack=/);
      expect(props, name).toMatch(/\bonHome=/);
    }
    // No culture-note link from a preview: it is a learner page about found notes.
    expect(element(lessons, 'MinigameScreen')).toMatch(/onOpenCultureNote=\{null\}/);
    expect(element(lessons, 'StoryReaderScreen')).toMatch(/onOpenCultureNote=\{null\}/);
    // The reader's Done opens the preview end screen; its sources stay in the browse stack.
    expect(element(lessons, 'StoryReaderScreen')).toMatch(/onDone=/);
    expect(element(lessons, 'StoryReaderScreen')).toMatch(/onOpenSources=\{\(params\) => navigation\.navigate\('StorySources', params\)\}/);
  });

  it('StorySources in All lessons has Copy link and no Open: links are copy-only, so no PIN and no external page', () => {
    expect(element(lessons, 'StorySourcesScreen')).toMatch(/onOpenLink=\{null\}/);
    expect(linkOpenRoute(null, () => true)).toBe('none');
    // the sources screen draws Open only for a link route other than 'none'
    const sources = read('screens/story/StorySourcesScreen.tsx');
    expect(sources).toContain('linkOpenRoute(exitProps.onOpenLink');
  });

  it('the quest player runs with the preview ports, never the learner screen', () => {
    expect(preview).toContain('previewQuestPorts(');
    expect(preview).toContain('<QuestPlayerView');
    expect(preview).not.toMatch(/QuestPlayerScreen|learnerQuestSession|learnerQuestExits/);
  });

  it('the strip is on the lesson screens and the end screen only (section 4.7)', () => {
    const framed = browseScreens.filter(({ source }) => source.includes('<PreviewFrame')).map(({ file }) => file).sort();
    expect(framed).toEqual([
      'screens/browse/BrowseLessonScreens.tsx',
      'screens/browse/PreviewEndScreen.tsx',
      'screens/browse/PreviewFlashcardsScreen.tsx',
      'screens/browse/PreviewQuestScreen.tsx',
    ]);
    // the end screen's strip has no Leave button; the sources page has no strip
    expect(read('screens/browse/PreviewEndScreen.tsx')).toMatch(/<PreviewFrame>/);
    expect(element(lessons, 'StorySourcesScreen')).not.toContain('PreviewFrame');
    expect(/export function BrowseStorySourcesScreen[\s\S]*?\n\}/.exec(lessons)?.[0]).not.toContain('PreviewFrame');
  });

  it('the flashcards (BR-9b) run the learner session with the preview ports and the browse exits only', () => {
    const cards = read('screens/browse/PreviewFlashcardsScreen.tsx');
    const session = element(cards, 'CardsSession');
    expect(session).toMatch(/ports=\{ports\}/);
    expect(cards).toMatch(/const ports = useMemo\(\(\) => previewCardsPorts\(\), \[\]\)/);
    expect(cards).not.toMatch(/learnerCardsPorts|ACTIVITY_ROUTES|VocabTopic/);
    // No Speed round in a preview; every exit returns to the topic page or plays another run here.
    expect(cards).toMatch(/speed: null/);
    expect(cards).toMatch(/back: toItem/);
  });
});
