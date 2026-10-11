/**
 * Colour and stroke tokens for scene art (F-STORY-002 §3.9.1). The only place
 * scene-art touches `colors` and `borderWidth`; everything else carries token
 * names.
 */
import { borderWidth, colors } from '../tokens';
import type { ColorToken, StrokeToken } from './types';

const RESERVED: ReadonlySet<string> = new Set(['surface.overlay', 'surface.inkScrim', 'feedback.danger']);

/** Every leaf of `colors` a picture may use, in table order. */
export const COLOR_TOKENS: readonly ColorToken[] = Object.entries(colors).flatMap(([group, values]) =>
  Object.keys(values)
    .map((name) => `${group}.${name}`)
    .filter((path) => !RESERVED.has(path)),
) as ColorToken[];

const TOKEN_SET: ReadonlySet<string> = new Set(COLOR_TOKENS);

export function isColorToken(value: unknown): value is ColorToken {
  return typeof value === 'string' && TOKEN_SET.has(value);
}

/**
 * Hex value of a token. An unknown or reserved token throws; renderers guard
 * with `isColorToken` and draw nothing for it in production.
 */
export function resolveColor(token: ColorToken): string {
  if (!isColorToken(token)) throw new RangeError(`Unknown colour token: ${String(token)}`);
  const [group, name] = (token as string).split('.') as [keyof typeof colors, string];
  return (colors[group] as Record<string, string>)[name]!;
}

/** Stroke width in canvas units; absent means `base`. */
export function resolveStroke(token: StrokeToken | undefined): number {
  if (token === undefined) return borderWidth.base;
  if (!Object.hasOwn(borderWidth, token)) throw new RangeError(`Unknown stroke token: ${String(token)}`);
  return borderWidth[token];
}
