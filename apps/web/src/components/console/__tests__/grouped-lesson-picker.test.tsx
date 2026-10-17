import { CATALOG, LECTURE_MAX_BLOCKS, type ChooserSelection, type LectureBlock, type PlanItem } from '@hangul-route/content-schema';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The grouped lesson picker (owner report 2026-10-16 item 5, AMENDMENTS-LECTURE-V2 row LV-3) as the plan builder
 * and the lecture page use it: the stage chips, the episode rows with their lessons folded, the whole-episode box
 * and its mixed state, search across every group (title, Hangul, romanization), the room limit, and the update it
 * hands the page (which the page applies to its own items).
 */
const view = vi.hoisted(() => ({ locale: 'en' as string }));
vi.mock('@/lib/i18n/locale-context', async () => {
  const { getMessages: messages } = await import('@hangul-route/i18n');
  return {
    useMessages: () => messages(view.locale as UiLocale),
    useLocale: () => view.locale,
  };
});

import { GroupedLessonPicker } from '../GroupedLessonPicker';
import { LectureCatalogueSection } from '../LectureParts';
import { applyToPlan, chooserKeys, consoleChooserGroups, planSelection } from '@/lib/console/lesson-picker';

afterEach(() => {
  view.locale = 'en';
});

const byTestId = (root: ReactTestInstance, id: string): ReactTestInstance => root.find((n) => n.props['data-testid'] === id && typeof n.type === 'string');
const hasTestId = (root: ReactTestInstance, id: string): boolean => root.findAll((n) => n.props['data-testid'] === id && typeof n.type === 'string').length > 0;
const textOf = (node: ReactTestInstance): string => node.children.map((c) => (typeof c === 'string' ? c : textOf(c))).join('');

/** A plan builder harness: the page's items, the picker's updates applied the way the page applies them. */
function planHarness(initial: PlanItem[] = [], room = 30, locale = 'en'): { renderer: ReactTestRenderer; items: () => PlanItem[]; boxes: Map<string, { indeterminate: boolean }> } {
  view.locale = locale;
  const groups = consoleChooserGroups(locale as UiLocale, 'plan');
  const keys = chooserKeys(groups);
  let items = initial;
  const boxes = new Map<string, { indeterminate: boolean }>();
  let renderer!: ReactTestRenderer;
  const render = (): JSX.Element => (
    <GroupedLessonPicker
      groups={groups}
      selection={planSelection(items, keys)}
      onChange={(update: (s: ChooserSelection) => string[]) => {
        items = applyToPlan(items, keys, update(planSelection(items, keys)));
        renderer.update(render());
      }}
      room={room - items.length}
      title="Lessons"
      fullNote="Full"
      testId="pick"
    />
  );
  act(() => {
    renderer = create(render(), {
      // The row boxes set `indeterminate` on their DOM node.
      createNodeMock: (element) => {
        const id = String(element.props['data-testid'] ?? '');
        const node = { indeterminate: false };
        if (id) boxes.set(id, node);
        return node;
      },
    });
  });
  return { renderer, items: () => items, boxes };
}

describe('GroupedLessonPicker', () => {
  it('opens on Stage 1 with every group a chip, the rows folded, and nothing chosen', () => {
    const { renderer } = planHarness();
    const root = renderer.root;
    const chips = root.findAll((n) => n.type === 'input' && n.props.type === 'radio');
    expect(chips.map((c) => c.props['data-testid'])).toEqual(['stage1', 'stage2', 'stage3', 'stage4', 'stage5', 'stage6', 'stage7'].map((s) => `pick-chip-${s}`));
    expect(byTestId(root, 'pick-chip-stage1').props.checked).toBe(true);
    expect(textOf(root.find((n) => n.type === 'h3'))).toBe('Stage 1 · 15 lessons');
    // Five episode rows, their lessons rendered but hidden until opened.
    const rows = root.findAll((n) => typeof n.props['data-testid'] === 'string' && n.props['data-testid'].startsWith('pick-row-'));
    expect(rows).toHaveLength(5);
    for (const list of root.findAll((n) => n.type === 'ul' && n.props.className === 'hr-pick-lessons')) expect(list.props.hidden).toBe(true);
    expect(byTestId(root, 'pick-open-episode:stage1-letters').props['aria-expanded']).toBe(false);
  });

  it('a chip shows that stage; the button shows and hides an episode\'s lessons', () => {
    const { renderer } = planHarness();
    const root = renderer.root;
    act(() => byTestId(root, 'pick-chip-stage2').props.onChange());
    expect(textOf(root.find((n) => n.type === 'h3'))).toBe('Stage 2 · 18 lessons');
    const open = byTestId(root, 'pick-open-episode:stage2-letters');
    expect(open.props['aria-label']).toBe('Lessons: Word Builder');
    act(() => open.props.onClick());
    expect(byTestId(root, 'pick-open-episode:stage2-letters').props['aria-expanded']).toBe(true);
    const list = root.find((n) => n.type === 'ul' && n.props.id === byTestId(root, 'pick-open-episode:stage2-letters').props['aria-controls']);
    expect(list.props.hidden).toBe(false);
    expect(list.findAll((n) => n.type === 'input')).toHaveLength(6);
    act(() => byTestId(root, 'pick-open-episode:stage2-letters').props.onClick());
    expect(byTestId(root, 'pick-open-episode:stage2-letters').props['aria-expanded']).toBe(false);
  });

  it('Stage 2 lessons go into the plan; the whole-episode box is mixed, then whole, then clear', () => {
    const { renderer, items, boxes } = planHarness([{ kind: 'quest', id: 'quest:stage1-life-q1', targetDate: '2026-10-20' }]);
    const root = renderer.root;
    act(() => byTestId(root, 'pick-chip-stage2').props.onChange());
    act(() => byTestId(root, 'pick-lesson-quest:stage2-life-q2').props.onChange());
    expect(items()).toEqual([{ kind: 'quest', id: 'quest:stage1-life-q1', targetDate: '2026-10-20' }, { kind: 'quest', id: 'quest:stage2-life-q2' }]);
    expect(byTestId(root, 'pick-row-episode:stage2-life').props.checked).toBe(false);
    expect(boxes.get('pick-row-episode:stage2-life')?.indeterminate).toBe(true);
    act(() => byTestId(root, 'pick-row-episode:stage2-life').props.onChange());
    expect(items()).toEqual([{ kind: 'quest', id: 'quest:stage1-life-q1', targetDate: '2026-10-20' }, { kind: 'episode', id: 'episode:stage2-life' }]);
    expect(byTestId(root, 'pick-row-episode:stage2-life').props.checked).toBe(true);
    expect(boxes.get('pick-row-episode:stage2-life')?.indeterminate).toBe(false);
    for (const q of CATALOG.cells.find((c) => c.episodeId === 'episode:stage2-life')!.questIds) expect(byTestId(root, `pick-lesson-${q}`).props.checked).toBe(true);
    // Unticking one lesson of the whole episode keeps the other two in its place.
    act(() => byTestId(root, 'pick-lesson-quest:stage2-life-q1').props.onChange());
    expect(items().map((i) => i.id)).toEqual(['quest:stage1-life-q1', 'quest:stage2-life-q2', 'quest:stage2-life-q3']);
    act(() => byTestId(root, 'pick-row-episode:stage2-life').props.onChange());
    expect(items().map((i) => i.id)).toEqual(['quest:stage1-life-q1', 'episode:stage2-life']);
    act(() => byTestId(root, 'pick-row-episode:stage2-life').props.onChange());
    expect(items().map((i) => i.id)).toEqual(['quest:stage1-life-q1']);
  });

  it('opens on the stage of the first chosen item', () => {
    const { renderer } = planHarness([{ kind: 'quest', id: 'quest:stage6-life-q2' }]);
    expect(byTestId(renderer.root, 'pick-chip-stage6').props.checked).toBe(true);
  });

  it('search narrows the list across every stage, with the count, and Clear brings the chips back', () => {
    const { renderer } = planHarness();
    const root = renderer.root;
    const all = root.findAll((n) => n.type === 'input' && n.props.type === 'checkbox').length;
    act(() => byTestId(root, 'pick-search').props.onChange({ target: { value: 'kitchen' } }));
    expect(root.findAll((n) => n.type === 'input' && n.props.type === 'radio')).toHaveLength(0);
    expect(hasTestId(root, 'pick-group-stage4')).toBe(true);
    expect(hasTestId(root, 'pick-group-stage1')).toBe(false);
    const found = root.findAll((n) => n.type === 'input' && n.props.type === 'checkbox').length;
    expect(found).toBeLessThan(all);
    expect(textOf(byTestId(root, 'pick-status'))).toBe(`${found} matches`);
    // While searching the lessons are open, and there is no open button.
    expect(hasTestId(root, 'pick-open-episode:stage4-life')).toBe(false);
    act(() => byTestId(root, 'pick-clear').props.onClick());
    expect(byTestId(root, 'pick-search').props.value).toBe('');
    expect(root.findAll((n) => n.type === 'input' && n.props.type === 'radio')).toHaveLength(7);
    expect(textOf(byTestId(root, 'pick-status'))).toBe('');
  });

  it('search finds Hangul and romanization, and says so when nothing matches', () => {
    const { renderer } = planHarness();
    const root = renderer.root;
    act(() => byTestId(root, 'pick-search').props.onChange({ target: { value: '글자 만나기' } }));
    expect(hasTestId(root, 'pick-row-episode:stage1-letters')).toBe(true);
    act(() => byTestId(root, 'pick-search').props.onChange({ target: { value: 'horangi' } }));
    expect(hasTestId(root, 'pick-row-episode:stage1-nature')).toBe(true);
    act(() => byTestId(root, 'pick-search').props.onChange({ target: { value: 'zzzz' } }));
    expect(textOf(byTestId(root, 'pick-status'))).toBe(getMessages('en').console.chooser.noMatch);
    expect(root.findAll((n) => n.type === 'h3')).toHaveLength(0);
  });

  it('titles follow the console language (owner report: English titles in the ko console)', () => {
    const { renderer } = planHarness([], 30, 'ko');
    const root = renderer.root;
    expect(textOf(root.find((n) => n.type === 'h3'))).toBe('1단계 · 수업 15개');
    const row = byTestId(root, 'pick-row-episode:stage1-letters');
    const label = root.find((n) => n.type === 'label' && n.findAll((c) => c === row).length > 0);
    expect(textOf(label)).toContain('글자 만나기');
  });

  it('with no room, a box that would add is off and the note shows; removing stays on', () => {
    const { renderer } = planHarness([{ kind: 'quest', id: 'quest:stage1-letters-q1' }], 1);
    const root = renderer.root;
    expect(textOf(root.find((n) => n.type === 'p' && n.props.className === 'hr-pick-note'))).toBe('Full');
    expect(byTestId(root, 'pick-lesson-quest:stage1-letters-q1').props.disabled).toBe(false);
    expect(byTestId(root, 'pick-lesson-quest:stage1-letters-q2').props.disabled).toBe(true);
    expect(byTestId(root, 'pick-row-episode:stage1-life').props.disabled).toBe(true);
    // The whole episode in place of its one chosen lesson adds nothing: allowed.
    expect(byTestId(root, 'pick-row-episode:stage1-letters').props.disabled).toBe(false);
  });
});

describe('LectureCatalogueSection (the lecture page)', () => {
  it('adds stories, topics and Stage 2 lessons as blocks, and removes them in place; a quiz keeps its place', () => {
    let blocks: LectureBlock[] = [{ kind: 'quiz', from: 'previous', rounds: 5 }];
    let renderer!: ReactTestRenderer;
    const render = (): JSX.Element => (
      <LectureCatalogueSection
        blocks={blocks}
        onChange={(next) => {
          blocks = next;
          renderer.update(render());
        }}
      />
    );
    act(() => {
      renderer = create(render(), { createNodeMock: () => ({ indeterminate: false }) });
    });
    const root = renderer.root;
    const chips = root.findAll((n) => n.type === 'input' && n.props.type === 'radio').map((c) => c.props['data-testid']);
    expect(chips.slice(-2)).toEqual(['lecture-picker-chip-stories', 'lecture-picker-chip-topics']);
    act(() => byTestId(root, 'lecture-picker-chip-stories').props.onChange());
    act(() => byTestId(root, 'lecture-picker-row-story:hangeul-day').props.onChange());
    act(() => byTestId(root, 'lecture-picker-chip-topics').props.onChange());
    act(() => byTestId(root, 'lecture-picker-row-vocab-topic:food').props.onChange());
    act(() => byTestId(root, 'lecture-picker-chip-stage2').props.onChange());
    act(() => byTestId(root, 'lecture-picker-lesson-quest:stage2-letters-q1').props.onChange());
    expect(blocks).toEqual([
      { kind: 'quiz', from: 'previous', rounds: 5 },
      { kind: 'story', storyId: 'story:hangeul-day', checks: true },
      { kind: 'vocab', topicId: 'vocab-topic:food' },
      { kind: 'quest', id: 'quest:stage2-letters-q1' },
    ]);
    act(() => byTestId(root, 'lecture-picker-chip-stories').props.onChange());
    act(() => byTestId(root, 'lecture-picker-row-story:hangeul-day').props.onChange());
    expect(blocks.map((b) => b.kind)).toEqual(['quiz', 'vocab', 'quest']);
    expect(LECTURE_MAX_BLOCKS).toBe(30);
  });
});
