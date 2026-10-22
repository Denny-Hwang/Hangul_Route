import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON section 7.1, CS-G1 (row GU-3, section 19): a static walk of the `Guest` stack.
 * Its param list is exactly the routes of 7.1, the navigator registers only those (GU-4 adds the save's two), and
 * every navigate target reachable from its screens is one of them; the only ways out reset the root after the run has
 * ended (section 6.4). A static walk cannot see `getParent()`, helpers or `Linking` hand-offs, so it also pins that
 * `getParent` appears in the one exit module and that no guest source opens a link; the e2e
 * (`e2e/web/guest-first-quest.spec.ts`) checks the routes and the pages at run time.
 */
const SRC = join(__dirname, '..', '..');
const read = (path: string): string => readFileSync(join(SRC, path), 'utf8');

/** Section 7.1: every route a guest run can reach. */
const ALLOWED = ['QuestPlayer', 'Minigame', 'Results', 'CardDetail', 'GuestLater', 'CreateProfile', 'PinEntry'];
/** Section 6.4: where the root goes once the run ended (never during it). */
const AFTER_RUN = ['Onboarding', 'WhoIsUsing', 'Main'];

const guestSources = (): string[] => [
  'navigation/guest.tsx',
  'navigation/guest-chunk.tsx',
  ...readdirSync(join(SRC, 'screens/guest'), { withFileTypes: true })
    .filter((e) => e.isFile() && /\.tsx?$/.test(e.name))
    .map((e) => `screens/guest/${e.name}`),
];

/** The route names a source navigates to: `navigate('X'`, `replace('X'`, `push('X'`, and `name: 'X'` in a reset. */
function targets(source: string): string[] {
  const calls = [...source.matchAll(/\.(?:navigate|replace|push)\(\s*'([A-Za-z0-9]+)'/g)].map((m) => m[1]!);
  const resets = [...source.matchAll(/name:\s*'([A-Za-z0-9]+)'/g)].map((m) => m[1]!);
  return [...calls, ...resets];
}

describe('the Guest stack (CS-G1)', () => {
  it('its param list is exactly the routes of section 7.1', () => {
    const types = read('navigation/types.ts');
    const start = types.indexOf('export type GuestStackParamList = {');
    const block = types.slice(start, types.indexOf('\n};', start));
    const keys = [...block.matchAll(/^\s{2}([A-Za-z0-9]+):/gm)].map((m) => m[1]!);
    expect(keys).toEqual(ALLOWED);
  });

  it('the navigator registers only those routes (the save\'s two come with row GU-4)', async () => {
    const source = read('navigation/guest-chunk.tsx');
    const registered = [...source.matchAll(/<Stack\.Screen\s+name="([A-Za-z0-9]+)"/g)].map((m) => m[1]!);
    expect(registered).toEqual(['QuestPlayer', 'Minigame', 'Results', 'CardDetail', 'GuestLater']);
    for (const name of registered) expect(ALLOWED).toContain(name);
    // The exported list is the same, in the same order.
    expect(source).toContain("export const GUEST_STACK_ROUTES = ['QuestPlayer', 'Minigame', 'Results', 'CardDetail', 'GuestLater'] as const");
  });

  it('every navigate target of the guest sources is a route of the stack, or the root after the run ended', () => {
    for (const file of guestSources()) {
      for (const name of targets(read(file))) expect([...ALLOWED, 'Guest', ...AFTER_RUN], `${file}: ${name}`).toContain(name);
    }
    // The only route outside the stack named during a run is the stack itself (Welcome's Back to my quest).
    const exits = read('logic/guest/guest-run.ts');
    expect([...new Set(targets(exits).filter((n) => !ALLOWED.includes(n)))]).toEqual(['Onboarding', 'WhoIsUsing', 'Main']);
  });

  it('the run ends before the root leaves the stack, and getParent is used by the exit module alone', () => {
    const exits = read('screens/guest/guest-exits.ts');
    expect(exits).toMatch(/const target = endGuestRunTo\(at\);\s*navigation\.getParent\(\)\?\.dispatch\(\{ type: 'RESET', payload: guestLeaveState\(target\) \}\);/);
    for (const file of guestSources().filter((f) => f !== 'screens/guest/guest-exits.ts')) expect(read(file), file).not.toMatch(/getParent\(/);
  });

  it('no guest source opens a link, a console page or a sign-in page', () => {
    for (const file of guestSources()) {
      const source = read(file);
      expect(source, file).not.toMatch(/Linking|openURL|window\.open|location\.(assign|replace|href)|openGrownUpArea|consoleUrl|signIn/);
      // No PIN destination but the save's (row GU-4); none in this row.
      expect(source, file).not.toMatch(/'PinEntry'/);
    }
  });

  it('the stack registers the guest variants, never the learner\'s player or Results; a game\'s only exit is Back', () => {
    const source = read('navigation/guest-chunk.tsx');
    expect(source).toContain('<Stack.Screen name="QuestPlayer" component={GuestQuestPlayer}');
    expect(source).toContain('<Stack.Screen name="Results" component={GuestResults}');
    expect(source).not.toMatch(/QuestPlayerScreen|ResultsScreen/);
    // The Culture notes link (a root route) is not drawn.
    expect(source).toMatch(/<MinigameScreen route=\{route\} navigation=\{\{ goBack: \(\) => navigation\.goBack\(\), push: \(\) => undefined \}\} onOpenCultureNote=\{null\} \/>/);
    // The card page navigates nowhere.
    expect(targets(read('screens/library/CardDetailScreen.tsx'))).toEqual([]);
  });

  it('the stack is a chunk of its own: one literal import(), never a static import (F-CURR-002 section 10)', () => {
    expect(read('navigation/guest.tsx')).toContain("import('./guest-chunk')");
    expect(read('navigation/guest-chunk.tsx')).toContain("export const SCREEN_CHUNK = 'screen-chunk:guest';");
    const all = (dir: string): string[] =>
      readdirSync(join(SRC, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === '__tests__' ? [] : all(`${dir}/${e.name}`)) : /\.tsx?$/.test(e.name) ? [`${dir}/${e.name}`] : []));
    const importers = all('.').filter((file) => /from '[^']*guest-chunk'|from '[^']*\/Guest(QuestPlayer|Results|LaterScreen)'/.test(read(file)));
    expect(importers.map((f) => f.replace(/^\.\//, ''))).toEqual(['navigation/guest-chunk.tsx']);
  });

  it('the guest variants take the learner id from the active learner, never the active profile', () => {
    for (const file of ['screens/guest/GuestQuestPlayer.tsx', 'screens/guest/GuestResults.tsx', 'screens/quest/QuestPlayerScreen.tsx', 'screens/minigames/MinigameScreen.tsx', 'screens/library/CardDetailScreen.tsx', 'screens/results/ResultsScreen.tsx']) {
      const source = read(file);
      expect(source, file).toContain('useActiveLearnerId()');
      expect(source, file).not.toContain('activeProfileSelector');
    }
  });

  it('the root stack registers the Guest stack only with the guest switch on', () => {
    expect(read('navigation/root.tsx')).toMatch(/\{flags\.guestLessonEnabled \? \(\s*<Stack\.Screen name="Guest" component=\{GuestStack\}/);
  });
});
