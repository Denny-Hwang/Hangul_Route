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
    expect(src).toContain('cursorContext(');
    expect(src).not.toMatch(/AsyncStorage|localStorage/);
  });

  it('the screen feeds the R-7a start route, so the start tag and known pips show', () => {
    const src = read(join(SCREEN_DIR, 'MyRouteScreen.tsx'));
    expect(src).toContain('route: startRouteOf(snapshot.placements, journeyContent.catalog, cursor.isEntitled)');
    expect(src).not.toMatch(/route:\s*null/);
  });

  it('the Journey header button exists only behind flags.myRouteEnabled', () => {
    const src = read(join(SRC, 'screens', 'journey', 'JourneyScreen.tsx'));
    const at = src.indexOf("navigate('MyRoute'");
    expect(at).toBeGreaterThan(0);
    expect(src.lastIndexOf('flags.myRouteEnabled ?', at)).toBeGreaterThan(0);
  });

  it('PinEntry continues to the read-only page once the gate is open', () => {
    const src = read(join(SRC, 'screens', 'parent', 'PinEntryScreen.tsx'));
    expect(src).toContain("navigation.replace('MyRoute', { source: 'parent', profileId })");
  });
});
