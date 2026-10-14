import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HOYA_POSES, hoyaFigure, type HoyaPart } from '@hangul-route/design-system/scene-art';
import { HOYA_VARIANTS, colors, hoyaVariantColors } from '@hangul-route/design-system/tokens';
import { HoyaSvg } from '../HoyaReference';

/**
 * The /design-preview Hoya is the one drawing, `hoyaFigure(pose)`, rendered as
 * DOM SVG (F-STORY-002 §3.9.4): element for element, tokens only.
 */
const partCount = (parts: readonly HoyaPart[]): number => parts.reduce((n, p) => n + 1 + (p.t === 'group' ? partCount(p.kids) : 0), 0);
const elementsIn = (markup: string): string[] => [...markup.matchAll(/<(g|rect|circle|ellipse|line|path)[\s>]/g)].map((m) => m[1]!);
const tagOf = (p: HoyaPart): string => (p.t === 'group' ? 'g' : p.t);
const flatTags = (parts: readonly HoyaPart[]): string[] => parts.flatMap((p) => [tagOf(p), ...(p.t === 'group' ? flatTags(p.kids) : [])]);

describe('HoyaReference renders hoyaFigure', () => {
  it.each(HOYA_POSES)('%s: one svg element per figure part, in draw order', (pose) => {
    const markup = renderToStaticMarkup(<HoyaSvg pose={pose} />);
    expect(markup.startsWith('<svg width="96" height="96" viewBox="0 0 128 128" aria-label="Hoya ' + pose + '"')).toBe(true);
    expect(elementsIn(markup)).toHaveLength(partCount(hoyaFigure(pose)));
    expect(elementsIn(markup)).toEqual(flatTags(hoyaFigure(pose)));
  });

  it('swaps the fur pair for the variant and keeps the shared tokens', () => {
    for (const variant of HOYA_VARIANTS) {
      const { fur, furDark } = hoyaVariantColors(variant);
      const markup = renderToStaticMarkup(<HoyaSvg pose="reading" variant={variant} size={120} />);
      expect(markup).toContain(`<circle cx="64" cy="64" r="44" fill="${fur}"></circle>`);
      expect(markup).toContain(`fill="${furDark}" opacity="0.2"`);
      expect(markup).toContain(`fill="${colors.hoya.belly}"`);
      expect(markup).toContain('width="120"');
    }
  });

  it('keeps the cheek blush to idle, cheering and waving', () => {
    const blush = `fill="${colors.hoya.cheek}" opacity="0.6"`;
    for (const pose of HOYA_POSES) {
      expect(renderToStaticMarkup(<HoyaSvg pose={pose} />).includes(blush)).toBe(pose === 'idle' || pose === 'cheering' || pose === 'waving');
    }
  });

  it('holds no colour literal: the colours come from the tokens', () => {
    const source = readFileSync(fileURLToPath(new URL('../HoyaReference.tsx', import.meta.url)), 'utf8');
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
  });
});
