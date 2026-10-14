import type { ReactTestInstance } from 'react-test-renderer';
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { JourneyGrid } from '../../../components/JourneyGrid';
import { episodesAll, gridEpisodes, stages, themes } from '../../../content';
import { themeGlyph } from '../../../logic/journey';
import { defaultStoryIndex } from '../../../logic/story/story-index';
import { byTestId, cleanup, hostNodes, render, resetPlatform } from '../../../test-support/render';

/**
 * The Journey grid's theme glyphs (owner decision 2026-10-14; design/components/Icon/theme-glyphs.md):
 * every cell draws its theme's glyph instead of a letter, each column label shows the same glyph over
 * its word, the glyphs are hidden from screen readers, and each cell's label names its theme in words.
 */

afterEach(async () => {
  await cleanup();
  resetPlatform();
});

const grid = (episodes = gridEpisodes(episodesAll)): React.ReactElement => (
  <JourneyGrid
    stages={stages}
    themes={themes}
    gridEpisodes={episodes}
    paneMode={false}
    selectedId={null}
    onOpen={() => undefined}
    storyEntries={defaultStoryIndex()}
    onOpenStories={() => undefined}
  />
);

/** True when the node or one of its host ancestors is hidden from screen readers. */
function hidden(node: ReactTestInstance | null): boolean {
  for (let at = node; at; at = at.parent) {
    if (typeof at.type === 'string' && (at.props['aria-hidden'] === true || at.props['aria-hidden'] === 'true')) return true;
  }
  return false;
}

/** The nearest host button above a node. */
function buttonOf(node: ReactTestInstance): ReactTestInstance | null {
  for (let at = node.parent; at; at = at.parent) if (typeof at.type === 'string' && at.props.role === 'button') return at;
  return null;
}

/** The theme glyph drawn under a node (its Icon's testID is `theme-glyph-<name>`), or null. */
function glyphOf(node: ReactTestInstance): string | null {
  const [svg] = node.findAll((n) => String(n.type) === 'svg-Svg' && String(n.props.testID ?? '').startsWith('theme-glyph-'));
  return svg ? String(svg.props.testID).slice('theme-glyph-'.length) : null;
}

/** Every string child under a node. */
function strings(node: ReactTestInstance): string[] {
  const out: string[] = [];
  const walk = (n: ReactTestInstance | string): void => {
    if (typeof n === 'string') out.push(n);
    else n.children.forEach(walk);
  };
  walk(node);
  return out;
}

describe('JourneyGrid theme glyphs', () => {
  it('a playable cell draws its theme glyph, hidden from screen readers, inside a button whose label names the theme', async () => {
    const r = await render(grid());
    for (const theme of themes) {
      const [glyph] = byTestId(r.root, `journey-glyph-stage1-${theme.key}`);
      expect(glyph, theme.key).toBeDefined();
      const node = glyph as ReactTestInstance;
      expect(glyphOf(node)).toBe(themeGlyph(theme.key));
      expect(hidden(node)).toBe(true);
      const button = buttonOf(node);
      expect(String(button?.props['aria-label'])).toContain(theme.titleEn);
    }
  });

  it('no cell shows a single letter (L, F, H, N, P were the old cell art)', async () => {
    const r = await render(grid());
    const cells = hostNodes(r.root, (n) => n.props.role === 'button');
    expect(cells.length).toBeGreaterThan(0);
    for (const cell of cells) {
      for (const text of strings(cell)) expect(text.trim(), String(cell.props['aria-label'])).not.toMatch(/^[A-Z]$/);
    }
  });

  it('a coming-later cell stays empty: no glyph', async () => {
    // Every cell of today's bundle is playable, so the later stages are emptied here to draw coming-later cells.
    const r = await render(grid(gridEpisodes(episodesAll).filter((e) => e.stage === 'stage1')));
    const later = hostNodes(r.root, (n) => n.props.role === 'button' && /coming soon/i.test(String(n.props['aria-label'])));
    expect(later.length).toBeGreaterThan(0);
    for (const cell of later) {
      expect(glyphOf(cell)).toBeNull();
    }
  });

  it('each column label shows the same glyph over its word; the glyph is hidden and the word is read', async () => {
    const r = await render(grid());
    for (const theme of themes) {
      const [glyph] = byTestId(r.root, `journey-col-glyph-${theme.key}`);
      expect(glyph, theme.key).toBeDefined();
      expect(glyphOf(glyph as ReactTestInstance)).toBe(themeGlyph(theme.key));
      expect(hidden(glyph as ReactTestInstance)).toBe(true);
      const [column] = byTestId(r.root, `journey-col-${theme.key}`);
      const word = (column as ReactTestInstance).findAll((n) => typeof n.type === 'string' && n.children.includes(theme.titleEn.split(' ')[0] as string));
      expect(word.length, theme.key).toBeGreaterThan(0);
      expect(hidden(word[0] as ReactTestInstance)).toBe(false);
    }
  });
});
