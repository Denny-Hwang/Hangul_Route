import type { ReactTestInstance } from 'react-test-renderer';
import type { Episode, QuestProgress } from '@hangul-route/content-schema';
import { colors } from '@hangul-route/design-system';
import { afterEach, describe, expect, it } from 'vitest';
import { JourneyGrid } from '../../../components/JourneyGrid';
import { episodesAll, gridEpisodes, questsAll, stages, themes, withVolumes } from '../../../content';
import { cellModel } from '../../../logic/journey-cells';
import { journeyCell, learnerCellMarks } from '../../../logic/journey-grid';
import { appRouteCatalog } from '../../../logic/placement/route-skip';
import { byTestId, cleanup, hostNodes, press, render, resetPlatform } from '../../../test-support/render';

/**
 * Two volumes in a Journey cell (F-STORY-005 PR 5.8, F-CURR-002 row CM-40; wireframe `journey/volumes.md` A): the
 * volume dots (one per playable volume, filled once done, decorative), the "first incomplete volume" open rule and the
 * label's "Opens Volume 2." sentence, all only when the caller passes the later volumes (`volumes` on). No Volume 2
 * ships, so a fixture Volume 2 of Stage 2 Nature joins the grid.
 */
afterEach(async () => {
  await cleanup();
  resetPlatform();
});

const NATURE = 'episode:stage2-nature';
const V2 = 'episode:stage2-nature-v2';
const nature = episodesAll.find((e) => e.id === NATURE) as Episode;
const v2: Episode = { ...nature, id: V2, volume: 2, questIds: ['quest:stage2-nature-v2-q1', 'quest:stage2-nature-v2-q2'] };
const at = '2026-10-01T00:00:00Z';
const done = (episode: Episode): QuestProgress[] =>
  episode.questIds.map((questId) => ({ questId, episodeId: episode.id, startedAt: at, completedAt: at, stars: 3, attempts: 1, accuracy: 1 }));
const withV2 = (on: boolean): Episode[] => gridEpisodes(withVolumes(on, [...episodesAll, v2]));
const ROUTE_CATALOG = appRouteCatalog(questsAll, episodesAll);

describe('cellModel with two volumes (the open rule)', () => {
  const model = (quests: QuestProgress[], on = true) => cellModel({ stage: 'stage2', theme: 'nature', episodes: withV2(on), storyEntries: [], quests });

  it('opens Volume 1 until it is done, then Volume 2, then Volume 1 again once both are', () => {
    expect(model([]).episodeId).toBe(NATURE);
    expect(model(done(nature)).episodeId).toBe(V2);
    expect(model([...done(nature), ...done(v2)]).episodeId).toBe(NATURE);
    // Volume 2 first: Volume 1 is the first not done.
    expect(model(done(v2)).episodeId).toBe(NATURE);
  });

  it('lists the volumes with their completion; the cell is complete once Volume 1 is, so it never drops when Volume 2 turns on', () => {
    expect(model(done(nature)).volumes).toEqual([
      { episodeId: NATURE, volume: 1, complete: true },
      { episodeId: V2, volume: 2, complete: false },
    ]);
    // The same answer with `volumes` on and off (section 7.7: nothing a learner finished stops looking finished).
    expect(model(done(nature)).completed).toBe(true);
    expect(model(done(nature), false).completed).toBe(true);
    expect(model([...done(nature), ...done(v2)]).completed).toBe(true);
    // Volume 2 alone does not make the cell complete.
    expect(model(done(v2)).completed).toBe(false);
  });

  it('with volumes off the cell is its Volume 1 alone, complete once Volume 1 is', () => {
    expect(model(done(nature), false).volumes).toEqual([{ episodeId: NATURE, volume: 1, complete: true }]);
    expect(model(done(nature), false).episodeId).toBe(NATURE);
    expect(model(done(nature), false).completed).toBe(true);
  });

  it('the grid cell keeps its own id for its marks, opens the open volume, and is selected while the pane shows either', () => {
    const cell = journeyCell({ stage: 'stage2', theme: 'nature', gridEpisodes: withV2(true), paneMode: true, selectedId: V2, quests: done(nature) });
    expect(cell.episodeId).toBe(NATURE);
    expect(cell.openId).toBe(V2);
    expect(cell.selected).toBe(true);
  });
});

describe('GridCell volume dots and label', () => {
  const grid = (on: boolean, quests: QuestProgress[], opened: string[] = [], marks = false) => (
    <JourneyGrid
      stages={stages}
      themes={themes}
      gridEpisodes={withV2(on)}
      paneMode={false}
      selectedId={null}
      onOpen={(id) => opened.push(id)}
      quests={quests}
      {...(marks ? { marksOf: learnerCellMarks({ quests, marks: null, catalog: ROUTE_CATALOG, completedIds: new Set(quests.map((q) => q.questId)) }) } : {})}
    />
  );
  const cellButton = (root: ReactTestInstance): ReactTestInstance =>
    hostNodes(root, (n) => n.props.role === 'button' && /^Stage 2 [^,]+, Nature & Animals/.test(String(n.props['aria-label'])))[0] as ReactTestInstance;

  it('draws one decorative dot per volume, the done one filled, and says which volume a tap opens', async () => {
    const opened: string[] = [];
    const r = await render(grid(true, done(nature), opened));
    const [dots] = byTestId(r.root, 'journey-volumes-stage2-nature');
    expect(dots).toBeDefined();
    expect(byTestId(r.root, 'journey-volumes-stage2-nature-1-done')).toHaveLength(1);
    expect(byTestId(r.root, 'journey-volumes-stage2-nature-2-open')).toHaveLength(1);
    const fill = (id: string): string => JSON.stringify((byTestId(r.root, id)[0] as ReactTestInstance).props.style).match(/"backgroundColor":"([^"]+)"/)?.[1] ?? '';
    // Filled once done; an open volume is an empty ring.
    expect(fill('journey-volumes-stage2-nature-1-done')).not.toMatch(/,0(\.0+)?\)$|transparent/);
    expect(fill('journey-volumes-stage2-nature-2-open')).toMatch(/,0(\.0+)?\)$|transparent/);
    const button = cellButton(r.root);
    expect(String(button.props['aria-label'])).toMatch(/Opens Volume 2\.$/);
    // Only the cell with two volumes has dots.
    expect(byTestId(r.root, 'journey-volumes-stage2-letters')).toHaveLength(0);
    await press(button);
    expect(opened).toEqual([V2]);
  });

  it('the success tint and the label agree: Volume 1 done is a complete cell, with Volume 2 still to open', async () => {
    // The renderer writes colours as rgba(): compare the tint's channels.
    const hex = colors.feedback.successLight.replace('#', '');
    const success = `rgba(${[0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(',')},1.00)`;
    const tint = (button: ReactTestInstance): string => String((button.props.style as { backgroundColor?: string }).backgroundColor);
    for (const on of [true, false]) {
      const r = await render(grid(on, done(nature), [], true));
      const button = cellButton(r.root);
      expect(String(button.props['aria-label']), `volumes ${on ? 'on' : 'off'}`).toMatch(/, complete/);
      expect(tint(button)).toBe(success);
      await cleanup();
    }
    // Neither volume done: no tint and no "complete" in the label.
    const r = await render(grid(true, done(v2), [], true));
    const button = cellButton(r.root);
    expect(String(button.props['aria-label'])).not.toMatch(/, complete/);
    expect(tint(button)).not.toBe(success);
  });

  it('with volumes off: no dots, no volume sentence, and the cell opens Volume 1', async () => {
    const opened: string[] = [];
    const r = await render(grid(false, done(nature), opened));
    expect(byTestId(r.root, 'journey-volumes-stage2-nature')).toHaveLength(0);
    const button = cellButton(r.root);
    expect(String(button.props['aria-label'])).not.toMatch(/Volume/);
    await press(button);
    expect(opened).toEqual([NATURE]);
  });
});
