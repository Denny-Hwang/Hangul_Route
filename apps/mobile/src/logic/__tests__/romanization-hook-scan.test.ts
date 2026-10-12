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

/** Every way a file could read the mode off a settings object instead of the hook. */
const DIRECT_READS: RegExp[] = [
  /\.\s*romanizationMode\b/,
  /\]\??\.romanizationMode/,
  /\b(?:const|let|var)\s*\{[^}]*\bromanizationMode\b[^}]*\}\s*=/,
  /\[\s*['"`]romanizationMode['"`]\s*\]/,
];

/**
 * The one editor: `LanguageCard` changes a profile's stored setting, so it shows
 * the stored value (`resolveRomanizationMode(null, settings)`), never an override.
 */
const EDITOR = 'components/LanguageCard.tsx';

/** The other nine call sites of F-BROWSE-001 §1. */
const CALL_SITES = [
  'screens/quest/DiscoverStep.tsx',
  'screens/minigames/ListenPickGame.tsx',
  'screens/minigames/PicWordMatchGame.tsx',
  'screens/minigames/StoryCheckGame.tsx',
  'screens/minigames/StorySequenceGame.tsx',
  'screens/story/StoryReaderView.tsx',
  'screens/story/CheckpointCard.tsx',
  'screens/story/StoryWordRecap.tsx',
  'screens/library/StoryShelf.tsx',
  'screens/episode/StoryEpisodeDetail.tsx',
  'screens/story/CultureNotesScreen.tsx',
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
  ])('the scan catches %s', (_, line) => {
    expect(DIRECT_READS.some((re) => re.test(line))).toBe(true);
  });

  it('the scan lets the hook call, the editor read and passing the hook value on through', () => {
    for (const line of [
      'const romanizationMode = useRomanizationMode();',
      'resolveRomanizationMode(null, settings)',
      'wordTileView(pair, state, { romanizationMode }, m.a11y.minigame);',
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

  it('the editor shows the stored setting, never the override', () => {
    const file = files.find((f) => f.rel === EDITOR);
    expect(file, EDITOR).toBeDefined();
    expect(file!.source).toContain('resolveRomanizationMode(null, settings)');
    expect(file!.source).not.toContain('useRomanizationMode(');
  });

  it('the hook takes the override from a provider and resolves through the one rule', () => {
    const hook = readFileSync(join(SRC, 'i18n', 'use-romanization-mode.tsx'), 'utf8');
    expect(hook).toContain('export function useRomanizationMode(');
    expect(hook).toContain('export function RomanizationModeOverride(');
    expect(hook).toContain('useContext(');
    expect(hook).toContain('resolveRomanizationMode(');
  });
});
