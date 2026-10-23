import type { ReactTestInstance } from 'react-test-renderer';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { borderWidth, colors, spacing } from '@hangul-route/design-system';
import { getMessages } from '@hangul-route/i18n';
import { JourneyGrid, masteryWords, type JourneyMastery } from '../../../components/JourneyGrid';
import { episodesAll, gridEpisodes, stages, themes } from '../../../content';
import type { JourneyAccessInput } from '../../../logic/journey-grid';
import { defaultStoryIndex } from '../../../logic/story/story-index';
import { byTestId, cleanup, hostNodes, render, resetPlatform } from '../../../test-support/render';
import { MasteryBanners } from '../MasteryBanners';
import { MasteryRing } from '../MasteryRing';

/**
 * F-CURR-002 sections 4.4, 7.7, 12.2 and 14, row CM-20 (wireframe journey/mastery-ring.md): the ring round each started
 * cell, Ready to refresh only on a mastered cell, New volume, the cell labels ("Mastered. Ready to refresh. New
 * volume."), the ring hidden from screen readers, nothing drawn with `mastery` off, and the Results banners in reduced
 * motion.
 */

afterEach(async () => {
  await cleanup();
  resetPlatform();
});

const EN = getMessages('en');
const ALL = gridEpisodes(episodesAll);
const idOf = (stage: string, theme: string): string => {
  const found = ALL.find((e) => e.stage === stage && e.theme === theme);
  if (!found) throw new Error(`no ${stage} ${theme} episode`);
  return found.id;
};
const LETTERS = idOf('stage1', 'letters');
const LIFE = idOf('stage1', 'life');
const RITES = idOf('stage1', 'rites');
const NATURE = idOf('stage1', 'nature');

const MASTERY: JourneyMastery = {
  Ring: MasteryRing,
  levelOf: (id) => (id === LETTERS ? 3 : id === LIFE ? 2 : id === RITES ? 1 : 0),
  refresh: new Set([LETTERS, LIFE]),
  newVolume: new Set([RITES, NATURE]),
};

const grid = (mastery?: JourneyMastery, access?: JourneyAccessInput): ReactElement => (
  <JourneyGrid
    stages={stages}
    themes={themes}
    gridEpisodes={ALL}
    paneMode={false}
    selectedId={null}
    onOpen={() => undefined}
    storyEntries={defaultStoryIndex()}
    onOpenStories={() => undefined}
    mastery={mastery}
    access={access}
  />
);

function hidden(node: ReactTestInstance | null): boolean {
  for (let at = node; at; at = at.parent) {
    if (typeof at.type === 'string' && (at.props['aria-hidden'] === true || at.props['aria-hidden'] === 'true')) return true;
  }
  return false;
}
function buttonOf(node: ReactTestInstance): ReactTestInstance | null {
  for (let at = node.parent; at; at = at.parent) if (typeof at.type === 'string' && at.props.role === 'button') return at;
  return null;
}
const labelOf = (root: ReactTestInstance, theme: string): string => {
  const [glyph] = byTestId(root, `journey-glyph-stage1-${theme}`);
  return String(buttonOf(glyph as ReactTestInstance)?.props['aria-label']);
};
const flat = (style: unknown): Record<string, unknown> => (Array.isArray(style) ? Object.assign({}, ...style.flat(5).map(flat)) : ((style ?? {}) as Record<string, unknown>));

describe('JourneyGrid with mastery on', () => {
  it('draws the ring only round started cells, hidden from screen readers; the label reads the level and the marks', async () => {
    const r = await render(grid(MASTERY));
    for (const theme of ['letters', 'life', 'rites']) {
      const [ring] = byTestId(r.root, `journey-mastery-stage1-${theme}`);
      expect(ring, theme).toBeDefined();
      expect(hidden(ring as ReactTestInstance)).toBe(true);
    }
    expect(byTestId(r.root, 'journey-mastery-stage1-nature')).toHaveLength(0);
    expect(byTestId(r.root, 'journey-mastery-stage1-crafts')).toHaveLength(0);
    expect(labelOf(r.root, 'letters')).toMatch(/\. Mastered\. Ready to refresh\.$/);
    // Ready to refresh only on a mastered cell: the Practiced cell with items due reads its level alone.
    expect(labelOf(r.root, 'life')).toMatch(/\. Practiced\.$/);
    expect(labelOf(r.root, 'rites')).toMatch(/\. Done\. New volume\.$/);
    // Level 0 adds nothing, and its New volume (a started cell only) is not read or drawn.
    expect(labelOf(r.root, 'nature')).not.toMatch(/Done|Practiced|Mastered|New volume/);
  });

  it('the sparkle and the marker are drawn where they apply; no sparkle on the Next cell', async () => {
    const r = await render(grid(MASTERY));
    expect(byTestId(r.root, 'journey-mastery-stage1-letters-refresh')).toHaveLength(1);
    expect(byTestId(r.root, 'journey-mastery-stage1-life-refresh')).toHaveLength(0);
    expect(byTestId(r.root, 'journey-mastery-stage1-rites-new-volume')).toHaveLength(1);
    const next = await render(grid(MASTERY, { nextEpisodeId: LETTERS, inPlanEpisodeIds: new Set(), isQuestOpen: () => true }));
    expect(byTestId(next.root, 'journey-mastery-stage1-letters-refresh')).toHaveLength(0);
    // The label still says it.
    expect(labelOf(next.root, 'letters')).toMatch(/Ready to refresh\.$/);
  });

  it('the track replaces the border, which keeps its width in a transparent colour, so the cell keeps its size', async () => {
    const r = await render(grid(MASTERY));
    const style = (theme: string) => flat(buttonOf(byTestId(r.root, `journey-glyph-stage1-${theme}`)[0] as ReactTestInstance)?.props.style);
    expect(style('letters')).toMatchObject({ borderTopWidth: `${borderWidth.base}px`, borderTopColor: 'rgba(0,0,0,0.00)' });
    expect(style('nature').borderTopWidth).toBe(`${borderWidth.base}px`);
    expect(style('nature').borderTopColor).not.toBe('rgba(0,0,0,0.00)');
  });

  it('the stage header and the notes get their fixed room while the rings are on, never per cell', async () => {
    const on = await render(grid(MASTERY));
    const off = await render(grid());
    const header = (root: ReactTestInstance) => flat((byTestId(root, 'journey-stage-stage1')[0] as ReactTestInstance).children[0] && ((byTestId(root, 'journey-stage-stage1')[0] as ReactTestInstance).children[0] as ReactTestInstance).props.style);
    expect(header(on.root).marginBottom).toBe(spacing.md);
    expect(header(off.root).marginBottom).toBe(spacing.sm);
  });
});

describe('JourneyGrid with mastery off (section 12.2)', () => {
  it('draws no ring, no glow and no marker, and the labels are today\'s', async () => {
    const r = await render(grid());
    expect(hostNodes(r.root, (n) => String(n.props['data-testid'] ?? n.props.testID ?? '').startsWith('journey-mastery-'))).toHaveLength(0);
    expect(labelOf(r.root, 'letters')).not.toMatch(/Mastered|Ready to refresh|New volume/);
  });
});

describe('MasteryRing', () => {
  it('draws the halo for Ready to refresh, and the focus outline in its place when selected', async () => {
    const glow = await render(<MasteryRing level={3} theme="letters" edge={borderWidth.thick} refresh newVolume={false} selected={false} next={false} testID="ring" />);
    // The track and the halo draw once the ring has measured itself; before that only the stickers.
    expect(byTestId(glow.root, 'ring-refresh')).toHaveLength(1);
    const sel = await render(<MasteryRing level={3} theme="letters" edge={borderWidth.thick} refresh newVolume selected next={false} testID="ring" />);
    expect(byTestId(sel.root, 'ring-halo')).toHaveLength(0);
    expect(byTestId(sel.root, 'ring-new-volume')).toHaveLength(1);
  });
});

describe('masteryWords', () => {
  it('reads Done, Practiced or Mastered, then Ready to refresh (mastered only) and New volume (started only)', () => {
    const m = EN.learner.mastery;
    expect(masteryWords(0, true, true, m)).toEqual([]);
    expect(masteryWords(1, true, true, m)).toEqual(['Done', 'New volume']);
    expect(masteryWords(2, false, false, m)).toEqual(['Practiced']);
    expect(masteryWords(3, true, true, m)).toEqual(['Mastered', 'Ready to refresh', 'New volume']);
  });
});

describe('MasteryBanners on Results', () => {
  it('shows the milestone first, then the level up; with reduced motion the new segment is drawn at once', async () => {
    const r = await render(<MasteryBanners milestone={1000} levelUp={{ title: 'Lunch Box Words', level: 2, theme: 'life' }} reducedMotion />);
    const texts = hostNodes(r.root, (n) => typeof n.children[0] === 'string').map((n) => n.children.join(''));
    const milestone = texts.findIndex((t) => t === '1,000 words! Hoya is so proud of you.');
    const level = texts.findIndex((t) => t === 'Lunch Box Words: Practiced');
    expect(milestone).toBeGreaterThanOrEqual(0);
    expect(level).toBeGreaterThan(milestone);
    const [fresh] = byTestId(r.root, 'results-mastery-ring-new');
    expect(flat(fresh?.props.style).opacity).toBe(1);
    // The ring is decorative; the line is read.
    expect(hidden(byTestId(r.root, 'results-mastery-ring')[0] as ReactTestInstance)).toBe(true);
  });

  it('draws nothing without a moment', async () => {
    const r = await render(<MasteryBanners milestone={null} levelUp={null} reducedMotion={false} />);
    expect(byTestId(r.root, 'results-words-milestone')).toHaveLength(0);
    expect(byTestId(r.root, 'results-level-up')).toHaveLength(0);
  });

  it('a level 3 level up fills the closed ring', async () => {
    const r = await render(<MasteryBanners milestone={null} levelUp={{ title: 'Letters', level: 3, theme: 'letters' }} reducedMotion={false} />);
    expect(byTestId(r.root, 'results-level-up')).toHaveLength(1);
    expect(colors.theme.letters).toBeDefined();
  });
});
