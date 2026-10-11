/**
 * The pure WordArt render list (F-VOC-002 §3.7): tones resolved to values and
 * the drawing defaults filled in, so the React Native component (W-1c) and the
 * web contact sheet (W-2) only map a `RenderShape` onto an element.
 */
import { isWordArtPath } from './path';
import { resolveTone } from './tones';
import type { WordArtGlyph, WordArtShape, WordArtTone } from './types';

/** Main outline width when a stroke gives none (§3.3 outline rule). */
const DEFAULT_STROKE_WIDTH = 3;
/** In silhouette a highlight or shadow is lifted to this, so it does not vanish (W8). */
const MONO_MIN_OPACITY = 0.5;

export interface RenderShape {
  tag: 'circle' | 'ellipse' | 'rect' | 'path';
  /** Svg geometry attributes. */
  geometry: Record<string, number | string>;
  /** A resolved colour, or `'none'`. */
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  strokeLinecap: 'round';
  strokeLinejoin: 'round';
  opacity: number;
}

export interface RenderOptions {
  /** Silhouette: every fill and stroke in this one tone. */
  mono?: WordArtTone;
}

function geometryOf(shape: WordArtShape): Pick<RenderShape, 'tag' | 'geometry'> {
  switch (shape.t) {
    case 'circle':
      return { tag: 'circle', geometry: { cx: shape.x, cy: shape.y, r: shape.r } };
    case 'ellipse':
      return { tag: 'ellipse', geometry: { cx: shape.x, cy: shape.y, rx: shape.rx, ry: shape.ry } };
    case 'rect':
      return { tag: 'rect', geometry: { x: shape.x, y: shape.y, width: shape.w, height: shape.h, ...(shape.r === undefined ? {} : { rx: shape.r }) } };
    case 'path':
      // the grammar admits only commands, digits, signs, dots and spaces, so `d` cannot leave its attribute
      if (!isWordArtPath(shape.d)) throw new Error(`WordArt path outside the grammar: ${JSON.stringify(shape.d)}`);
      return { tag: 'path', geometry: { d: shape.d } };
  }
}

export function toRenderList(glyph: WordArtGlyph, options: RenderOptions = {}): RenderShape[] {
  const { mono } = options;
  const paint = (tone: WordArtTone): string => resolveTone(mono ?? tone);
  return glyph.map((shape) => {
    const out: RenderShape = {
      ...geometryOf(shape),
      fill: shape.f === undefined ? 'none' : paint(shape.f),
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      opacity: mono === undefined ? (shape.o ?? 1) : Math.max(shape.o ?? 1, MONO_MIN_OPACITY),
    };
    if (shape.s !== undefined) {
      out.stroke = paint(shape.s);
      out.strokeWidth = shape.sw ?? DEFAULT_STROKE_WIDTH;
    }
    return out;
  });
}

const kebab = (name: string): string => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

function element(shape: RenderShape): string {
  const attrs: [string, string | number][] = [...Object.entries(shape.geometry), ['fill', shape.fill]];
  if (shape.stroke !== undefined) {
    attrs.push(['stroke', shape.stroke], ['strokeWidth', shape.strokeWidth!], ['strokeLinecap', shape.strokeLinecap], ['strokeLinejoin', shape.strokeLinejoin]);
  }
  if (shape.opacity !== 1) attrs.push(['opacity', shape.opacity]);
  return `<${shape.tag} ${attrs.map(([k, v]) => `${kebab(k)}="${v}"`).join(' ')}/>`;
}

/** A standalone `<svg>` string for the web preview, tests and golden files. */
export function glyphToSvgString(glyph: WordArtGlyph, options: { size: number; mono?: WordArtTone }): string {
  if (typeof options.size !== 'number' || !Number.isFinite(options.size) || options.size <= 0) throw new RangeError(`WordArt size must be a positive number: ${String(options.size)}`);
  const body = toRenderList(glyph, { mono: options.mono }).map(element).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${options.size}" height="${options.size}">${body}</svg>`;
}
