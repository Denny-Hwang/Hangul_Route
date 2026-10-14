import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { HOYA_POSES, hoyaFigure, hoyaItem, type HoyaPart } from '../hoya';
import { paletteOf } from '../resolve';
import { isColorToken } from '../tokens-map';

/**
 * F-STORY-002 §3.9.4 parity guard. Since PR 2.11 `Hoya.tsx` renders
 * `hoyaFigure` and the scene form `hoyaNodes` is derived from the same figure,
 * so the two cannot drift apart in geometry; this keeps the palettes equal and
 * the component free of drawing of its own. The element-for-element check of
 * the component lives in `components/Hoya/__tests__/Hoya.test.tsx`; the
 * side-by-side picture on the contact sheet (PR 2.4).
 */
const here = dirname(fileURLToPath(import.meta.url));
const hoyaTsx = readFileSync(join(here, '../../components/Hoya/Hoya.tsx'), 'utf8');

function figureTokens(parts: readonly HoyaPart[]): Set<string> {
  const used = new Set<string>();
  const walk = (part: HoyaPart): void => {
    if (part.fill !== undefined && part.fill !== 'none') used.add(part.fill);
    if (part.stroke !== undefined) used.add(part.stroke);
    if (part.t === 'group') part.kids.forEach(walk);
  };
  parts.forEach(walk);
  return used;
}

describe('hoya parity with Hoya.tsx', () => {
  it('the component draws the figure and holds no drawing of its own', () => {
    expect(hoyaTsx).toMatch(/import \{ hoyaFigure\b/);
    expect(hoyaTsx).toMatch(/hoyaFigure\(pose\)/);
    expect(hoyaTsx).not.toMatch(/\bcolors\./);
    expect(hoyaTsx).not.toMatch(/\b(cx|cy|r|rx|ry|x|y|x1|y1|x2|y2|width|height|d|points)=\{?["'`\d-]/);
  });

  it('the figure uses the fixed Hoya palette across the five poses', () => {
    expect(new Set(HOYA_POSES.flatMap((pose) => [...figureTokens(hoyaFigure(pose))]))).toEqual(
      new Set([
        'hoya.fur',
        'hoya.furDark',
        'hoya.cheek',
        'hoya.stripes',
        'hoya.belly',
        'hoya.nose',
        'surface.paper',
        'brand.secondary',
        'feedback.nudge',
        'text.secondary',
        'text.primary',
      ]),
    );
  });

  it.each(HOYA_POSES)('%s: the scene form uses exactly the figure palette', (pose) => {
    expect(new Set(paletteOf(hoyaItem(pose)))).toEqual(figureTokens(hoyaFigure(pose)));
  });

  it('only uses tokens a scene may use', () => {
    for (const pose of HOYA_POSES) for (const token of figureTokens(hoyaFigure(pose))) expect(isColorToken(token)).toBe(true);
  });

  it('has the five poses the component declares', () => {
    const declared = readFileSync(join(here, '../../components/Hoya/types.ts'), 'utf8');
    const poses = [...declared.matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
    expect(poses).toEqual([...HOYA_POSES]);
  });
});
