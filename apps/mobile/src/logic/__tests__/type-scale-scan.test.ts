import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * AMENDMENTS-DISPLAY-NAV section 4 (rows DN-3 and DN-3b): text on the learner surfaces is drawn at
 * the device's chosen text size, read from `useTypeScale()` (or a design-system text component
 * that reads it). A raw `typography.size.*` draws at the standard size whatever the step, so this
 * source scan counts every raw use under `apps/mobile/src/screens`, `apps/mobile/src/components`
 * and `packages/design-system/src/components` (comments and tests aside) and holds each file to the
 * count written here. The list is a ratchet: a new raw use fails, and a file that loses one must
 * lower its number (or leave the list) in the same change, so the count only goes down. Row
 * DN-3b moved the last screens over: what is left is held by design (the reasons below), and
 * every other learner, grown-up and All lessons screen draws at the chosen size.
 */
type Why =
  /** The presenter's stage and what is drawn for the room: stage units (F-TCH-004 §3.6), never the teacher's text size. */
  | 'stage'
  /** Part of a picture: card art, a stroke diagram, a cover, a badge or a syllable diagram sized with the media (`useMediaSize`). */
  | 'media'
  /** Fixed-size cells whose words the cell's label carries (the Journey grid), capped at 1 by design. */
  | 'fixed'
  /** The on-screen Hangul keyboard keeps a system keyboard's fixed keys (key widths come from the window width). */
  | 'keyboard'
  /** A style module's default for a caller that passes the scaled size. */
  | 'style';

const ALLOWED: Readonly<Record<string, { count: number; why: Why }>> = {
  'apps/mobile/src/components/CardArt.tsx': { count: 1, why: 'media' },
  'apps/mobile/src/components/JourneyGrid.tsx': { count: 2, why: 'fixed' },
  'apps/mobile/src/components/StrokeHint.tsx': { count: 2, why: 'media' },
  'apps/mobile/src/screens/library/StoryTile.tsx': { count: 2, why: 'media' },
  'apps/mobile/src/screens/minigames/BuildLetterGame.tsx': { count: 1, why: 'media' },
  'apps/mobile/src/screens/my-route/StageBadge.tsx': { count: 2, why: 'media' },
  'apps/mobile/src/screens/presenter/overlays/TimerOverlay.tsx': { count: 1, why: 'stage' },
  'apps/mobile/src/screens/presenter/slides/LetterSlide.tsx': { count: 2, why: 'stage' },
  'apps/mobile/src/screens/presenter/stage-metrics.ts': { count: 9, why: 'stage' },
  'packages/design-system/src/components/HangulKeyboard/HangulKeyboard.tsx': { count: 5, why: 'keyboard' },
  'packages/design-system/src/components/RouteMarkers/geometry.ts': { count: 1, why: 'media' },
  'packages/design-system/src/components/SectionTabs/style.ts': { count: 1, why: 'style' },
  'packages/design-system/src/components/SyllableBlock/SyllableBlock.tsx': { count: 1, why: 'media' },
};

/** The repository root (this file is apps/mobile/src/logic/__tests__). */
const ROOT = join(__dirname, '..', '..', '..', '..', '..');
const SCANNED = ['apps/mobile/src/screens', 'apps/mobile/src/components', 'packages/design-system/src/components'];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : sourceFiles(full);
    return /\.tsx?$/.test(e.name) ? [full] : [];
  });
}

/** The source without its comments (a comment that names a token is no use of it); line breaks kept. */
export function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, '')).replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

export function rawUses(source: string): number {
  return (withoutComments(source).match(/typography\.size\./g) ?? []).length;
}

const counts = new Map<string, number>();
for (const dir of SCANNED) {
  for (const file of sourceFiles(join(ROOT, dir))) {
    const n = rawUses(readFileSync(file, 'utf8'));
    if (n > 0) counts.set(relative(ROOT, file).split('\\').join('/'), n);
  }
}

describe('type scale scan: raw typography.size uses only shrink (AMENDMENTS-DISPLAY-NAV section 4)', () => {
  it('counts code, not comments', () => {
    expect(rawUses('const a = typography.size.body; // typography.size.caption\n/* typography.size.title */')).toBe(1);
    expect(rawUses("const url = 'https://x'; const b = textScale.size.body;")).toBe(0);
  });

  it('no file has a raw use the list does not hold', () => {
    const over = [...counts].filter(([file, n]) => n > (ALLOWED[file]?.count ?? 0)).map(([file, n]) => `${file}: ${n} (allowed ${ALLOWED[file]?.count ?? 0})`);
    expect(over).toEqual([]);
  });

  it('the list holds no more than there is: a file that lost a use lowers its number', () => {
    const stale = Object.entries(ALLOWED)
      .filter(([file, entry]) => (counts.get(file) ?? 0) < entry.count)
      .map(([file, entry]) => `${file}: ${counts.get(file) ?? 0} (listed ${entry.count})`);
    expect(stale).toEqual([]);
  });

  it('DN-3b reached zero: outside the presenter stage, a screen holds an entry only for a picture', () => {
    const screens = Object.entries(ALLOWED).filter(([file]) => file.startsWith('apps/mobile/src/screens/') && !file.startsWith('apps/mobile/src/screens/presenter/'));
    expect(screens.filter(([, entry]) => entry.why !== 'media')).toEqual([]);
  });

  it('the whole list only shrinks: 31 uses at most, each held by design', () => {
    expect(Object.values(ALLOWED).reduce((sum, entry) => sum + entry.count, 0)).toBeLessThanOrEqual(31);
  });
});
