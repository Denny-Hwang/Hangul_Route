import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { HOYA_POSES, hoyaItem } from '../hoya';
import { paletteOf } from '../resolve';
import { isColorToken } from '../tokens-map';

/**
 * F-STORY-002 §3.9.4 parity guard. `Hoya.tsx` is not changed by the data port,
 * so this keeps the two honest: the port may only use colour tokens the shipped
 * component uses. The side-by-side picture lives on the contact sheet (PR 2.4).
 */
const here = dirname(fileURLToPath(import.meta.url));
const hoyaTsx = readFileSync(join(here, '../../components/Hoya/Hoya.tsx'), 'utf8');

/** `colors.group.name` references, plus the fur pair the component reads from `hoyaVariantColors`. */
function tokensUsedBy(source: string): Set<string> {
  const used = new Set<string>();
  for (const m of source.matchAll(/\bcolors\.([a-z]+)\.([A-Za-z0-9]+)/g)) used.add(`${m[1]}.${m[2]}`);
  if (/hoyaVariantColors\(/.test(source)) {
    used.add('hoya.fur');
    used.add('hoya.furDark');
  }
  return used;
}

describe('hoya parity with Hoya.tsx', () => {
  const shipped = tokensUsedBy(hoyaTsx);

  it('reads the shipped component (guards the scan itself)', () => {
    expect(shipped).toEqual(
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

  it('uses only tokens the shipped component uses, in every pose', () => {
    for (const pose of HOYA_POSES) {
      for (const token of paletteOf(hoyaItem(pose))) {
        expect(shipped.has(token), `${pose}: ${token}`).toBe(true);
      }
    }
  });

  it('uses every token the shipped component uses somewhere in the five poses', () => {
    const ported = new Set(HOYA_POSES.flatMap((pose) => paletteOf(hoyaItem(pose))));
    expect([...shipped].filter((t) => !ported.has(t as never))).toEqual([]);
  });

  it('only uses tokens a scene may use', () => {
    for (const pose of HOYA_POSES) for (const token of paletteOf(hoyaItem(pose))) expect(isColorToken(token)).toBe(true);
  });

  it('has the five poses the component declares', () => {
    const declared = readFileSync(join(here, '../../components/Hoya/types.ts'), 'utf8');
    const poses = [...declared.matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
    expect(poses).toEqual([...HOYA_POSES]);
  });
});
