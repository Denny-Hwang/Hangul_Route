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
 * The screens PR A-5b (spec §6, the other rows of §3.9) moved to the one entry
 * point: each plays through a prompt slot (`usePromptSlot`) and shows the
 * slot's status (why there is no sound, and the one action) in a
 * `PromptPanel`, because the Korean text itself is already printed next to the
 * speaker. Culture Quiz gained its Hear-it button in the same PR.
 */
const SLOT_SCREENS = [
  'minigames/BuildLetterGame.tsx',
  'minigames/CardMatchGame.tsx',
  'minigames/TapRespondGame.tsx',
  'minigames/VoiceEchoGame.tsx',
  'minigames/CultureQuizGame.tsx',
  'library/CardDetailView.tsx',
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

  it('no screen imports speak', () => {
    expect(files.filter((f) => audioImports(f.source).includes('speak')).map((f) => f.rel)).toEqual([]);
  });

  it.each(SLOT_SCREENS)('%s plays through a prompt slot and shows its status panel', (rel) => {
    const file = files.find((f) => f.rel === rel);
    expect(file, rel).toBeDefined();
    const source = file!.source;
    expect(audioImports(source).some((n) => n === 'playPrompt' || n === 'playJamo')).toBe(true);
    expect(source).toMatch(/usePromptSlot\(\{\s*source:/);
    // Props in any order: an arrow-function prop before `variant` must not end the match at its `>`.
    expect(source).toMatch(/<PromptPanel\b[\s\S]*?variant="status"[\s\S]*?\/>/);
  });

  /**
   * Screens that speak without a tap on every open (a Tap & Respond turn) or
   * that can be closed mid-word (the card detail) stop the speech when they
   * unmount, as Listen & Pick and Story Order do, so Korean never keeps
   * playing over the next screen.
   */
  it.each(['minigames/TapRespondGame.tsx', 'library/CardDetailView.tsx', 'minigames/ListenPickGame.tsx'])(
    '%s stops its speech on unmount',
    (rel) => {
      const file = files.find((f) => f.rel === rel);
      expect(file, rel).toBeDefined();
      expect(audioImports(file!.source)).toContain('stop');
      expect(file!.source).toMatch(/\bstop\(\)/);
    },
  );
});
