import type { ReactTestInstance } from 'react-test-renderer';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UiLocale } from '@hangul-route/content-schema';
import { LayoutProvider, ROUTE_RING_SIZE, borderWidth, colors, layoutClassFor, spacing, typography } from '@hangul-route/design-system';
import { getMessages } from '@hangul-route/i18n';
import { JourneyGrid } from '../../../components/JourneyGrid';
import { episodesAll, gridEpisodes, stages, themes } from '../../../content';
import { themeGlyph } from '../../../logic/journey';
import { journeyCellMetrics } from '../../../logic/journey-cell-layout';
import type { JourneyAccessInput, JourneyMarksOf } from '../../../logic/journey-grid';
import { defaultStoryIndex } from '../../../logic/story/story-index';
import { useLocaleStore } from '../../../store/locale-store';
import { byTestId, cleanup, hostNodes, render, resetPlatform } from '../../../test-support/render';

/**
 * The Journey grid's theme glyphs (owner decision 2026-10-14; design/components/Icon/theme-glyphs.md):
 * every cell draws its theme's glyph instead of a letter, each column label shows the same glyph over
 * its word, the glyphs are hidden from screen readers, and each cell's label names its theme in words.
 */

afterEach(async () => {
  await cleanup();
  resetPlatform();
  vi.unstubAllEnvs();
  useLocaleStore.setState({ device: 'en', session: null, byProfile: {} });
});

function useUiLocale(locale: UiLocale): void {
  // es and ko are hidden until they ship (LOCALE_STATUS); the QA switch shows them.
  vi.stubEnv('EXPO_PUBLIC_SHOW_ALL_LOCALES', '1');
  useLocaleStore.setState({ device: locale, session: null, byProfile: {} });
}

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
      const label = getMessages('en').learner.journey.themeWord[theme.key];
      const word = (column as ReactTestInstance).findAll((n) => typeof n.type === 'string' && n.children.includes(label));
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
      [800, 24, 48],
      [1280, 28, 56],
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

describe('JourneyGrid cell word (owner request 2026-10-14)', () => {
  const words = (cell: ReactTestInstance, stage: string, theme: string): ReactTestInstance[] => byTestId(cell, `journey-word-${stage}-${theme}`);

  it('a lesson cell shows its theme word under the glyph, hidden from screen readers (the label already names the theme)', async () => {
    const r = await render(grid());
    for (const theme of themes) {
      const [glyph] = byTestId(r.root, `journey-glyph-stage1-${theme.key}`);
      const cell = buttonOf(glyph as ReactTestInstance) as ReactTestInstance;
      const [word] = words(cell, 'stage1', theme.key);
      expect(word, theme.key).toBeDefined();
      expect(strings(word as ReactTestInstance)).toEqual([getMessages('en').learner.journey.themeWord[theme.key]]);
      expect(hidden(word as ReactTestInstance)).toBe(true);
      // the label names the theme in words once; the word is not a second accessible element
      expect(String(cell.props['aria-label'])).toContain(theme.titleEn);
    }
  });

  it('a stories-only cell names its theme under the books glyph; a coming-later cell stays empty', async () => {
    // Stage 1 only (the later stages are coming later), and Stage 1 Nature without its lesson: its heritage stories stay (stories-only).
    const stage1 = gridEpisodes(episodesAll).filter((e) => e.stage === 'stage1' && e.theme !== 'nature');
    const r = await render(grid(stage1));
    const later = hostNodes(r.root, (n) => n.props.role === 'button' && /coming soon/i.test(String(n.props['aria-label'])));
    expect(later.length).toBeGreaterThan(0);
    for (const cell of later) expect(strings(cell).join('')).toBe('');
    const storiesOnly = hostNodes(r.root, (n) => String(n.props['data-testid'] ?? '').startsWith('journey-cell-stories-'));
    expect(storiesOnly.length).toBeGreaterThan(0);
    for (const cell of storiesOnly) {
      const [, , , stage, theme] = String(cell.props['data-testid']).split('-');
      const [word] = words(cell, stage as string, theme as string);
      expect(word, String(cell.props['data-testid'])).toBeDefined();
      expect(hidden(word as ReactTestInstance)).toBe(true);
    }
  });

  it.each(['es', 'ko'] as const)('in %s the cells and the column labels show the %s theme words', async (locale) => {
    useUiLocale(locale);
    const r = await render(grid());
    const themeWord = getMessages(locale).learner.journey.themeWord;
    for (const theme of themes) {
      const [word] = byTestId(r.root, `journey-word-stage1-${theme.key}`);
      expect(strings(word as ReactTestInstance), theme.key).toEqual([themeWord[theme.key]]);
      const [column] = byTestId(r.root, `journey-col-${theme.key}`);
      expect(strings(column as ReactTestInstance), theme.key).toContain(themeWord[theme.key]);
    }
  });

  it('the cell sizes from the ring the design system draws', () => {
    expect(journeyCellMetrics({ spacing, borderWidth, typography }).ring).toBe(ROUTE_RING_SIZE);
  });

  it('a placed-out cell moves its count mark to the top left, never onto the word at the bottom', async () => {
    const all = gridEpisodes(episodesAll);
    const r = await render(
      <JourneyGrid
        stages={stages}
        themes={themes}
        gridEpisodes={all}
        paneMode={false}
        selectedId={null}
        onOpen={() => undefined}
        storyEntries={defaultStoryIndex()}
        marksOf={(stage, theme) => ({ completed: false, isStart: false, placedOut: stage === 'stage1' && theme === 'nature' })}
      />,
    );
    const [count] = byTestId(r.root, 'journey-count-stage1-nature');
    expect(count).toBeDefined();
    const style = Object.assign({}, ...[count?.props.style].flat());
    expect(style.top).toBeDefined();
    expect(style.left).toBeDefined();
    expect(style.bottom).toBeUndefined();
    expect(style.right).toBeUndefined();
  });

  it('a cell with the start pin and the placed-out check still draws its count mark, under the check, and grows to hold it', async () => {
    const all = gridEpisodes(episodesAll);
    const M = journeyCellMetrics({ spacing, borderWidth, typography });
    const r = await render(
      <JourneyGrid
        stages={stages}
        themes={themes}
        gridEpisodes={all}
        paneMode={false}
        selectedId={null}
        onOpen={() => undefined}
        storyEntries={defaultStoryIndex()}
        marksOf={(stage, theme) =>
          stage === 'stage1' && theme === 'nature' ? { completed: false, isStart: true, placedOut: true } : { completed: false, isStart: false, placedOut: false }
        }
      />,
    );
    const [count] = byTestId(r.root, 'journey-count-stage1-nature');
    expect(count).toBeDefined();
    const cell = buttonOf(count as ReactTestInstance) as ReactTestInstance;
    expect(byTestId(cell, 'journey-start-pin').length).toBeGreaterThan(0);
    const style = Object.assign({}, ...[count?.props.style].flat());
    expect(style).toMatchObject({ top: `${2 * M.inset + M.markSize}px`, right: `${M.inset}px` });
    expect(style.left).toBeUndefined();
    expect(style.bottom).toBeUndefined();
    // only this cell grows; its row neighbour keeps the plain height
    const heightOf = (n: ReactTestInstance): number => parseFloat(String(Object.assign({}, ...[n.props.style].flat()).minHeight));
    const [lifeGlyph] = byTestId(r.root, 'journey-glyph-stage1-life');
    const neighbour = buttonOf(lifeGlyph as ReactTestInstance) as ReactTestInstance;
    expect(heightOf(cell)).toBeGreaterThan(heightOf(neighbour));
    // the label still says the count
    expect(String(cell.props['aria-label'])).toMatch(/stor/i);
  });
});
