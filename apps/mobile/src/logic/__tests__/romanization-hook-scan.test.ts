import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * F-BROWSE-001 §4.9 (BR-5c): every screen reads the romanization mode through
 * `useRomanizationMode()`, so All lessons can set it for the whole tab without
 * a learner profile. No file under `screens/` or `components/` reads
 * `romanizationMode` off the locale store's profile settings directly. Source
 * scan, because the vitest lanes do not render screens.
 */
const SRC = join(__dirname, '..', '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : sourceFiles(full);
    return /\.tsx?$/.test(e.name) ? [full] : [];
  });
}

const files = ['screens', 'components'].flatMap((dir) =>
  sourceFiles(join(SRC, dir)).map((f) => ({ rel: relative(SRC, f).split('\\').join('/'), source: readFileSync(f, 'utf8') })),
);

/**
 * Every way a file could read the mode, or the stored reading choice (AMENDMENTS-ROMANIZATION-FADE section 3.1, row RF-1a),
 * off a settings object instead of the hook.
 */
const DIRECT_READS: RegExp[] = [
  /\.\s*romanizationMode\b/,
  /\]\??\.romanizationMode/,
  /\b(?:const|let|var)\s*\{[^}]*\bromanizationMode\b[^}]*\}\s*=/,
  /\[\s*['"`]romanizationMode['"`]\s*\]/,
  /\.\s*romanizationChoice\b/,
  /\]\??\.romanizationChoice/,
  /\b(?:const|let|var)\s*\{[^}]*\bromanizationChoice\b[^}]*\}\s*=/,
  /\[\s*['"`]romanizationChoice['"`]\s*\]/,
];

/**
 * The one editor: `ReadingPracticeCard` changes a profile's stored setting, so it shows
 * the stored choice (`romanizationChoiceOf(settings)`, AMENDMENTS-ROMANIZATION-FADE row RF-2), never an override.
 */
const EDITOR = 'components/ReadingPracticeCard.tsx';

/** The other nine call sites of F-BROWSE-001 §1. */
const CALL_SITES = [
  'screens/quest/DiscoverStep.tsx',
  'screens/minigames/ListenPickGame.tsx',
  'screens/minigames/PicWordMatchGame.tsx',
  'screens/minigames/StoryCheckGame.tsx',
  'screens/minigames/StorySequenceGame.tsx',
  // Type Hangul's "see" prompt (F-CURR-001 G-3 review).
  'screens/minigames/TypeHangulGame.tsx',
  'screens/story/StoryReaderView.tsx',
  'screens/story/CheckpointCard.tsx',
  'screens/story/StoryWordRecap.tsx',
  // The Library sections and the cell page share the tile hook (F-STORY-005 PR 5.5b).
  'screens/library/StoryTileGrid.tsx',
  'screens/episode/StoryEpisodeDetail.tsx',
  'screens/story/CultureNotesScreen.tsx',
];

/**
 * The three item-level surfaces (AMENDMENTS-ROMANIZATION-FADE section 3.6, row RF-1b): they read the per-text mode of the
 * resolver, taken once per mount, besides the surface mode the hook gives. Discover is a quest step; the two games pass it
 * on and their flows use it on the `quest` host only.
 */
const RESOLVER_SITES = [
  'screens/quest/DiscoverStep.tsx',
  'screens/minigames/ListenPickGame.tsx',
  'screens/minigames/PicWordMatchGame.tsx',
];

describe('romanization mode through one hook (F-BROWSE-001 BR-5c)', () => {
  it('scans the screens and components', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('no screen or component reads romanizationMode off a settings object', () => {
    const offenders = files
      .filter((f) => DIRECT_READS.some((re) => re.test(f.source)))
      .map((f) => f.rel);
    expect(offenders).toEqual([]);
  });

  it.each([
    ['a property read', 'const m = settings.romanizationMode;'],
    ['an optional read', "const m = s.byProfile[id]?.romanizationMode;"],
    ['destructuring', 'const { romanizationMode } = settings;'],
    ['destructuring with a rename', 'const { uiLocale, romanizationMode: mode } = s.byProfile[id];'],
    ['a string key', "const m = settings['romanizationMode'];"],
    ['a string key in double quotes', 'const m = settings["romanizationMode"];'],
    ['a choice property read', 'const c = settings.romanizationChoice;'],
    ['an optional choice read', 'const c = s.byProfile[id]?.romanizationChoice;'],
    ['choice destructuring', 'const { romanizationChoice } = settings;'],
    ['choice destructuring with a rename', 'const { uiLocale, romanizationChoice: choice } = s.byProfile[id];'],
    ['a choice string key', "const c = settings['romanizationChoice'];"],
  ])('the scan catches %s', (_, line) => {
    expect(DIRECT_READS.some((re) => re.test(line))).toBe(true);
  });

  it('the scan lets the hook call, the editor read and passing the hook value on through', () => {
    for (const line of [
      'const romanizationMode = useRomanizationMode();',
      'resolveRomanizationMode(null, settings)',
      'wordTileView(pair, state, { romanizationMode }, m.a11y.minigame);',
      'const resolver = useRomanizationResolver();',
      'romanizationChoiceOf(settings)',
    ]) {
      expect(DIRECT_READS.some((re) => re.test(line))).toBe(false);
    }
  });

  it('no screen or component passes the mode down as a prop any more', () => {
    expect(files.filter((f) => /romanizationMode=\{/.test(f.source)).map((f) => f.rel)).toEqual([]);
  });

  it.each(CALL_SITES)('%s calls useRomanizationMode', (rel) => {
    const file = files.find((f) => f.rel === rel);
    expect(file, rel).toBeDefined();
    expect(file!.source).toContain('useRomanizationMode(');
  });

  it.each(RESOLVER_SITES)('%s takes the resolver once per mount and reads the per-text mode from it', (rel) => {
    const file = files.find((f) => f.rel === rel);
    expect(file, rel).toBeDefined();
    // `useMountResolver` holds the first resolver for the whole mount (taken again once the native screen-reader answer is
    // in), so a surface never reads the live hook value per draw.
    expect(file!.source).toContain('useMountResolver(');
    expect(file!.source).not.toContain('useRomanizationResolver(');
    expect(file!.source).toContain('resolver.forText');
  });

  it('the resolver is read by the three item-level surfaces and by no other screen or component', () => {
    expect(
      files
        .filter((f) => f.source.includes('useMountResolver('))
        .map((f) => f.rel)
        .sort(),
    ).toEqual([...RESOLVER_SITES].sort());
  });

  it('no Check host reads the per-text mode: the games hand it to flows that use it on the quest host only', () => {
    const listen = readFileSync(join(SRC, 'logic', 'listen-pick-flow.ts'), 'utf8');
    const pic = readFileSync(join(SRC, 'logic', 'pic-word-flow.ts'), 'utf8');
    expect(listen).toContain("context.mode === 'quest' && context.romanizationModeOf");
    expect(pic).toContain("context.mode === 'quest' && context.romanizationModeOf");
  });

  it('the editor shows the stored setting, never the override', () => {
    const file = files.find((f) => f.rel === EDITOR);
    expect(file, EDITOR).toBeDefined();
    expect(file!.source).toContain('romanizationChoiceOf(settings)');
    expect(file!.source).not.toContain('resolveRomanizationMode(');
    expect(file!.source).not.toContain('useRomanizationMode(');
  });

  it('the hook takes the override from a provider and resolves through the one rule', () => {
    const hook = readFileSync(join(SRC, 'i18n', 'use-romanization-mode.tsx'), 'utf8');
    expect(hook).toContain('export function useRomanizationMode(');
    expect(hook).toContain('export function RomanizationModeOverride(');
    expect(hook).toContain('useContext(');
    expect(hook).toContain('romanizationResolver(');
  });

  it('the hook carries the Check scope and the resolver hook (RF section 3.7), and the Check host wraps its game in the scope', () => {
    const hook = readFileSync(join(SRC, 'i18n', 'use-romanization-mode.tsx'), 'utf8');
    expect(hook).toContain('export function RomanizationCheckScope(');
    expect(hook).toContain('export function useRomanizationResolver(');
    expect(hook).toContain('export function useMountResolver(');
    const host = readFileSync(join(SRC, 'screens', 'minigames', 'MinigameScreen.tsx'), 'utf8');
    expect(host).toContain('<RomanizationCheckScope active={step?.kind === \'check\'}>');
    // set by the two Check hosts that mount a game reading the hook, and nowhere else
    // and by the Hangul Check, whose Listen & Pick (host `review`) is not hosted by `MinigameScreen`
    expect(files.filter((f) => f.source.includes('<RomanizationCheckScope')).map((f) => f.rel).sort()).toEqual([
      'screens/minigames/MinigameScreen.tsx',
      'screens/reviews/StageReviewScreen.tsx',
    ]);
  });
});
