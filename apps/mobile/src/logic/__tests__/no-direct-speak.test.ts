import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * F-AUDIO-004 §3.9: one entry point. No screen imports the low-level `speak`
 * or the removed `playJamoSound` from `platform/audio`; a screen plays sound
 * with `playPrompt` / `playJamo` and shows the text fallback through the
 * prompt slot. Source scan, because the vitest lanes do not render screens.
 */
const SCREENS = join(__dirname, '..', '..', 'screens');

/**
 * PR A-5b (spec §6) migrates these. Each one already prints the Korean text and
 * its romanization next to the speaker button and is not gated on hearing, so
 * `speak()` (which goes through the same controller: muting, ranked voice, never
 * an engine call without a Korean voice) is silent but loses nothing. A-5b
 * empties this list; a file listed here that no longer imports `speak` fails.
 */
const PENDING_A5B = [
  'minigames/BuildLetterGame.tsx',
  'minigames/CardMatchGame.tsx',
  'minigames/TapRespondGame.tsx',
  'minigames/VoiceEchoGame.tsx',
  'library/CardDetailScreen.tsx',
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : sourceFiles(full);
    return /\.tsx?$/.test(e.name) ? [full] : [];
  });
}

/** Names imported from a `platform/audio` module in one file. */
function audioImports(source: string): string[] {
  const names: string[] = [];
  for (const m of source.matchAll(/import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*['"][^'"]*platform\/audio(?:\.web)?['"]/g)) {
    names.push(...m[1]!.split(',').map((n) => n.trim().split(/\s+as\s+/)[0]!.replace(/^type\s+/, '')).filter(Boolean));
  }
  return names;
}

const files = sourceFiles(SCREENS).map((f) => ({ rel: relative(SCREENS, f).split('\\').join('/'), source: readFileSync(f, 'utf8') }));

describe('no direct speak from screens', () => {
  it('scans the screens', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it('no screen imports playJamoSound', () => {
    expect(files.filter((f) => audioImports(f.source).includes('playJamoSound')).map((f) => f.rel)).toEqual([]);
  });

  it('only the A-5b files still import speak', () => {
    const offenders = files.filter((f) => audioImports(f.source).includes('speak')).map((f) => f.rel).sort();
    expect(offenders).toEqual([...PENDING_A5B].sort());
  });
});
