import type { ReactTestInstance } from 'react-test-renderer';
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { LayoutProvider, colors, layoutClassFor } from '@hangul-route/design-system';
import { JourneyGrid } from '../../../components/JourneyGrid';
import { episodesAll, gridEpisodes, stages, themes } from '../../../content';
import { themeGlyph } from '../../../logic/journey';
import type { JourneyAccessInput, JourneyMarksOf } from '../../../logic/journey-grid';
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

  it('keeps the glyph beside every overlay: complete, start pin, placed-out, Next, In your plan and Not open yet', async () => {
    const all = gridEpisodes(episodesAll);
    const idOf = (stage: string, theme: string): string => {
      const found = all.find((e) => e.stage === stage && e.theme === theme);
      if (!found) throw new Error(`no ${stage} ${theme} episode`);
      return found.id;
    };
    const marksOf: JourneyMarksOf = (stage, theme) => ({
      completed: stage === 'stage1' && theme === 'letters',
      isStart: stage === 'stage1' && theme === 'life',
      placedOut: stage === 'stage1' && theme === 'rites',
    });
    const access: JourneyAccessInput = {
      nextEpisodeId: idOf('stage1', 'crafts'),
      inPlanEpisodeIds: new Set([idOf('stage1', 'nature')]),
      isQuestOpen: (questId) => !all.some((e) => e.stage === 'stage2' && e.questIds.includes(questId)),
    };
    const r = await render(
      <JourneyGrid
        stages={stages}
        themes={themes}
        gridEpisodes={all}
        paneMode={false}
        selectedId={null}
        onOpen={() => undefined}
        marksOf={marksOf}
        access={access}
      />,
    );
    const glyphIn = (cell: ReactTestInstance | undefined, key: string): void => {
      expect(cell, key).toBeDefined();
      const [glyph] = byTestId(cell as ReactTestInstance, key);
      expect(glyph, key).toBeDefined();
      expect(hidden(glyph as ReactTestInstance), key).toBe(true);
    };
    // the start pin and the placed-out check: their cells still draw the glyph
    glyphIn(byTestId(r.root, 'journey-cell-start')[0], 'journey-glyph-stage1-life');
    glyphIn(byTestId(r.root, 'journey-cell-placed-out')[0], 'journey-glyph-stage1-rites');
    // the complete cell (the success tint) and the Next cell (the triangle)
    const [done] = byTestId(r.root, 'journey-glyph-stage1-letters');
    expect(hidden(done as ReactTestInstance)).toBe(true);
    const [r8, g8, b8] = [1, 3, 5].map((at) => parseInt(colors.feedback.successLight.slice(at, at + 2), 16));
    expect(buttonOf(done as ReactTestInstance)?.props.style.backgroundColor).toBe(`rgba(${r8},${g8},${b8},1.00)`);
    const [nextCell] = byTestId(r.root, 'journey-next-stage1-crafts').map((n) => buttonOf(n));
    glyphIn(nextCell ?? undefined, 'journey-glyph-stage1-crafts');
    // In your plan and Not open yet: the ring and the glyph share one cell
    for (const [ring, stage, theme] of [
      ['inPlan', 'stage1', 'nature'],
      ['notOpen', 'stage2', 'letters'],
    ] as const) {
      const [ringNode] = byTestId(r.root, `journey-ring-${ring}-${stage}-${theme}`);
      expect(ringNode, ring).toBeDefined();
      const cell = buttonOf(ringNode as ReactTestInstance);
      glyphIn(cell ?? undefined, `journey-glyph-${stage}-${theme}`);
    }
  });

  it('on a tablet the glyph scales with the ring around it and still fits inside it', async () => {
    const all = gridEpisodes(episodesAll);
    const nature = all.find((e) => e.stage === 'stage1' && e.theme === 'nature');
    for (const [width, glyphSize, ringSize] of [
      [800, 29, 48],
      [1280, 34, 56],
    ] as const) {
      const r = await render(
        <LayoutProvider value={layoutClassFor({ width, height: 1000 })}>
          <JourneyGrid
            stages={stages}
            themes={themes}
            gridEpisodes={all}
            paneMode={false}
            selectedId={null}
            onOpen={() => undefined}
            access={{ nextEpisodeId: null, inPlanEpisodeIds: new Set([nature?.id ?? '']), isQuestOpen: () => true }}
          />
        </LayoutProvider>,
      );
      const [glyph] = byTestId(r.root, 'journey-glyph-stage1-nature');
      const [svg] = (glyph as ReactTestInstance).findAll((n) => String(n.type) === 'svg-Svg');
      const [ring] = byTestId(r.root, 'journey-ring-inPlan-stage1-nature');
      const [ringSvg] = (ring as ReactTestInstance).findAll((n) => String(n.type) === 'svg-Svg');
      expect(Number(svg?.props.width), String(width)).toBe(glyphSize);
      expect(Number(ringSvg?.props.width ?? ring?.props.width), String(width)).toBe(ringSize);
      expect(glyphSize).toBeLessThan(ringSize);
      await cleanup();
    }
  });
});
