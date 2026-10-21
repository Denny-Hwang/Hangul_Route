import { CATALOG, LECTURE_MAX_BLOCKS, lessonParents, type ChooserGroup, type ChooserSelection, type LectureBlock, type PlanItem } from '@hangul-route/content-schema';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The grouped lesson picker (owner report 2026-10-16 item 5, AMENDMENTS-LESSON-CHOOSER row LV-3a) as the plan builder
 * and the lecture page use it: the stage chips, the episode rows with their lessons folded, the whole-episode box
 * and its mixed state, search across every group (title, Hangul, romanization) acting on whole episodes, the room
 * limit, a new list from the page (resetKey), and the update it hands the page (which the page applies to its own items).
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
import { LectureChooserSection } from '../LectureParts';
import { applyToPlan, chooserKeys, consoleChooserGroups, planSelection } from '@/lib/console/lesson-picker';

afterEach(() => {
  view.locale = 'en';
});

const byTestId = (root: ReactTestInstance, id: string): ReactTestInstance => root.find((n) => n.props['data-testid'] === id && typeof n.type === 'string');
const hasTestId = (root: ReactTestInstance, id: string): boolean => root.findAll((n) => n.props['data-testid'] === id && typeof n.type === 'string').length > 0;
const textOf = (node: ReactTestInstance): string => node.children.map((c) => (typeof c === 'string' ? c : textOf(c))).join('');

interface Harness {
  renderer: ReactTestRenderer;
  items: () => PlanItem[];
  boxes: Map<string, { indeterminate: boolean; focus: () => void }>;
  /** The page replaces its list (another plan opened): new items, a new resetKey, optionally new groups. */
  replace: (next: PlanItem[], groups?: ChooserGroup[]) => void;
}

/** A plan builder harness: the page's items, the picker's updates applied the way the page applies them (merge: false). */
function planHarness(initial: PlanItem[] = [], room = 30, locale = 'en', merge = false, initialGroups?: ChooserGroup[]): Harness {
  view.locale = locale;
  let groups = initialGroups ?? consoleChooserGroups(locale as UiLocale, 'plan');
  let items = initial;
  let epoch = 0;
  const boxes = new Map<string, { indeterminate: boolean; focus: () => void }>();
  let renderer!: ReactTestRenderer;
  const render = (): JSX.Element => {
    const keys = chooserKeys(groups);
    return (
      <GroupedLessonPicker
        groups={groups}
        selection={planSelection(items, keys)}
        onChange={(update: (s: ChooserSelection) => string[]) => {
          items = applyToPlan(items, keys, update(planSelection(items, keys)), lessonParents(groups));
          renderer.update(render());
        }}
        room={room - items.length}
        title="Lessons"
        fullNote="Full"
        merge={merge}
        resetKey={epoch}
        testId="pick"
      />
    );
  };
  act(() => {
    renderer = create(render(), {
      // The row boxes set `indeterminate` on their DOM node; the search field can take focus.
      createNodeMock: (element) => {
        const id = String(element.props['data-testid'] ?? '');
        const node = { indeterminate: false, focus: vi.fn() };
        if (id) boxes.set(id, node);
        return node;
      },
    });
  });
  const replace = (next: PlanItem[], nextGroups?: ChooserGroup[]): void => {
    items = next;
    if (nextGroups) groups = nextGroups;
    epoch += 1;
    act(() => renderer.update(render()));
  };
  return { renderer, items: () => items, boxes, replace };
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

  it('Stage 2 lessons go into the plan; the whole-episode box is mixed, then whole, then clear (the plan never merges)', () => {
    const { renderer, items, boxes } = planHarness([{ kind: 'quest', id: 'quest:stage1-life-q1', targetDate: '2026-10-20' }]);
    const root = renderer.root;
    act(() => byTestId(root, 'pick-chip-stage2').props.onChange());
    act(() => byTestId(root, 'pick-lesson-quest:stage2-life-q2').props.onChange());
    expect(items()).toEqual([{ kind: 'quest', id: 'quest:stage1-life-q1', targetDate: '2026-10-20' }, { kind: 'quest', id: 'quest:stage2-life-q2' }]);
    expect(byTestId(root, 'pick-row-episode:stage2-life').props.checked).toBe(false);
    expect(boxes.get('pick-row-episode:stage2-life')?.indeterminate).toBe(true);
    // The partly chosen row adds its missing lessons; the chosen one stays as it is.
    act(() => byTestId(root, 'pick-row-episode:stage2-life').props.onChange());
    expect(items().map((i) => i.id)).toEqual(['quest:stage1-life-q1', 'quest:stage2-life-q2', 'quest:stage2-life-q1', 'quest:stage2-life-q3']);
    expect(byTestId(root, 'pick-row-episode:stage2-life').props.checked).toBe(true);
    expect(boxes.get('pick-row-episode:stage2-life')?.indeterminate).toBe(false);
    act(() => byTestId(root, 'pick-row-episode:stage2-life').props.onChange());
    expect(items().map((i) => i.id)).toEqual(['quest:stage1-life-q1']);
    // An unchosen row is the whole episode, one item; every lesson shows ticked.
    act(() => byTestId(root, 'pick-row-episode:stage2-life').props.onChange());
    expect(items()).toEqual([{ kind: 'quest', id: 'quest:stage1-life-q1', targetDate: '2026-10-20' }, { kind: 'episode', id: 'episode:stage2-life' }]);
    for (const q of CATALOG.cells.find((c) => c.episodeId === 'episode:stage2-life')!.questIds) expect(byTestId(root, `pick-lesson-${q}`).props.checked).toBe(true);
    // Unticking one lesson of the whole episode keeps the other two in its place.
    act(() => byTestId(root, 'pick-lesson-quest:stage2-life-q1').props.onChange());
    expect(items().map((i) => i.id)).toEqual(['quest:stage1-life-q1', 'quest:stage2-life-q2', 'quest:stage2-life-q3']);
    act(() => byTestId(root, 'pick-row-episode:stage2-life').props.onChange());
    expect(items().map((i) => i.id)).toEqual(['quest:stage1-life-q1', 'quest:stage2-life-q2', 'quest:stage2-life-q3', 'quest:stage2-life-q1']);
    act(() => byTestId(root, 'pick-row-episode:stage2-life').props.onChange());
    expect(items().map((i) => i.id)).toEqual(['quest:stage1-life-q1']);
  });

  it('with merge (a deck), ticking a partly chosen row makes it one whole episode', () => {
    const { renderer, items } = planHarness([{ kind: 'quest', id: 'quest:stage1-letters-q2' }], 30, 'en', true);
    act(() => byTestId(renderer.root, 'pick-row-episode:stage1-letters').props.onChange());
    expect(items().map((i) => i.id)).toEqual(['episode:stage1-letters']);
  });

  it('a dated, noted whole episode: unticking one lesson keeps the date and note on the others', () => {
    const { renderer, items } = planHarness([{ kind: 'episode', id: 'episode:stage1-letters', targetDate: '2026-10-20', note: 'Bring a lunch box' }]);
    act(() => byTestId(renderer.root, 'pick-lesson-quest:stage1-letters-q2').props.onChange());
    expect(items()).toEqual([
      { kind: 'quest', id: 'quest:stage1-letters-q1', targetDate: '2026-10-20', note: 'Bring a lunch box' },
      { kind: 'quest', id: 'quest:stage1-letters-q3', targetDate: '2026-10-20', note: 'Bring a lunch box' },
    ]);
  });

  it('opens on the stage of the first chosen item', () => {
    const { renderer } = planHarness([{ kind: 'quest', id: 'quest:stage6-life-q2' }]);
    expect(byTestId(renderer.root, 'pick-chip-stage6').props.checked).toBe(true);
  });

  it('a new list from the page (resetKey) opens on its first chosen stage, with the search cleared', () => {
    // The plan page renders the empty draft first, then loads a stored draft (or a link's add) into it.
    const { renderer, replace } = planHarness();
    const root = renderer.root;
    expect(byTestId(root, 'pick-chip-stage1').props.checked).toBe(true);
    act(() => byTestId(root, 'pick-search').props.onChange({ target: { value: 'kitchen' } }));
    replace([{ kind: 'quest', id: 'quest:stage4-life-q1' }]);
    expect(byTestId(root, 'pick-search').props.value).toBe('');
    expect(byTestId(root, 'pick-chip-stage4').props.checked).toBe(true);
    expect(byTestId(root, 'pick-lesson-quest:stage4-life-q1').props.checked).toBe(true);
    // Another plan opened: its stage.
    replace([{ kind: 'episode', id: 'episode:stage2-crafts' }]);
    expect(byTestId(root, 'pick-chip-stage2').props.checked).toBe(true);
  });

  it('an edit never moves the open chip; groups that load later keep a chip that is still there, else the first', () => {
    const stage1 = consoleChooserGroups('en', 'plan', ['stage1']);
    const { renderer, replace } = planHarness([], 30, 'en', false, stage1);
    const root = renderer.root;
    expect(root.findAll((n) => n.type === 'input' && n.props.type === 'radio')).toHaveLength(1);
    // The entitlement list arrives: every stage (the same draft, so the same resetKey would also keep Stage 1).
    replace([], consoleChooserGroups('en', 'plan'));
    expect(root.findAll((n) => n.type === 'input' && n.props.type === 'radio')).toHaveLength(7);
    act(() => byTestId(root, 'pick-chip-stage5').props.onChange());
    act(() => byTestId(root, 'pick-row-episode:stage5-life').props.onChange());
    expect(byTestId(root, 'pick-chip-stage5').props.checked).toBe(true);
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
    expect(byTestId(root, 'pick-status').props.className).toBe('hr-pick-status');
    act(() => byTestId(root, 'pick-clear').props.onClick());
    expect(byTestId(root, 'pick-search').props.value).toBe('');
    expect(root.findAll((n) => n.type === 'input' && n.props.type === 'radio')).toHaveLength(7);
    // The live region stays in the accessibility tree, only visually hidden while empty.
    expect(textOf(byTestId(root, 'pick-status'))).toBe('');
    expect(byTestId(root, 'pick-status').props.className).toBe('hr-pick-status hr-pick-hidden');
  });

  it('Clear keeps the keyboard in the search field', () => {
    const { renderer, boxes } = planHarness();
    const root = renderer.root;
    act(() => byTestId(root, 'pick-search').props.onChange({ target: { value: 'kitchen' } }));
    act(() => byTestId(root, 'pick-clear').props.onClick());
    expect(boxes.get('pick-search')?.focus).toHaveBeenCalledTimes(1);
  });

  it('while searching, a press acts on the whole episode: unticking the one lesson shown keeps the others', () => {
    const title = CATALOG.quests.find((q) => q.id === 'quest:stage2-letters-q4')!.title;
    const { renderer, items } = planHarness([{ kind: 'episode', id: 'episode:stage2-letters', targetDate: '2026-10-22' }]);
    const root = renderer.root;
    act(() => byTestId(root, 'pick-search').props.onChange({ target: { value: title } }));
    // Only the matching lesson is drawn, the detail line is the whole episode's.
    expect(hasTestId(root, 'pick-lesson-quest:stage2-letters-q4')).toBe(true);
    expect(hasTestId(root, 'pick-lesson-quest:stage2-letters-q1')).toBe(false);
    const detail = getMessages('en').console.chooser.episodeDetail(6, CATALOG.cells.find((c) => c.episodeId === 'episode:stage2-letters')!.minutes);
    expect(textOf(root.find((n) => n.type === 'label' && n.findAll((c) => c.props['data-testid'] === 'pick-row-episode:stage2-letters').length > 0))).toContain(detail);
    act(() => byTestId(root, 'pick-lesson-quest:stage2-letters-q4').props.onChange());
    expect(items().map((i) => i.id)).toEqual(['quest:stage2-letters-q1', 'quest:stage2-letters-q2', 'quest:stage2-letters-q3', 'quest:stage2-letters-q5', 'quest:stage2-letters-q6']);
    expect(items().every((i) => i.targetDate === '2026-10-22')).toBe(true);
  });

  it('while searching, the row box with another lesson chosen shows mixed and adds the missing lessons, no duplicate', () => {
    const title = CATALOG.quests.find((q) => q.id === 'quest:stage2-letters-q4')!.title;
    const { renderer, items, boxes } = planHarness([{ kind: 'quest', id: 'quest:stage2-letters-q2' }]);
    const root = renderer.root;
    act(() => byTestId(root, 'pick-search').props.onChange({ target: { value: title } }));
    expect(byTestId(root, 'pick-row-episode:stage2-letters').props.checked).toBe(false);
    expect(boxes.get('pick-row-episode:stage2-letters')?.indeterminate).toBe(true);
    act(() => byTestId(root, 'pick-row-episode:stage2-letters').props.onChange());
    const ids = items().map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(CATALOG.cells.find((c) => c.episodeId === 'episode:stage2-letters')!.questIds.slice().sort());
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
    const { renderer } = planHarness([{ kind: 'quest', id: 'quest:stage1-letters-q1' }], 1, 'en', true);
    const root = renderer.root;
    expect(textOf(root.find((n) => n.type === 'p' && n.props.className === 'hr-pick-note'))).toBe('Full');
    expect(byTestId(root, 'pick-lesson-quest:stage1-letters-q1').props.disabled).toBe(false);
    expect(byTestId(root, 'pick-lesson-quest:stage1-letters-q2').props.disabled).toBe(true);
    expect(byTestId(root, 'pick-row-episode:stage1-life').props.disabled).toBe(true);
    // The whole episode in place of its one chosen lesson adds nothing (a deck merges): allowed.
    expect(byTestId(root, 'pick-row-episode:stage1-letters').props.disabled).toBe(false);
  });

  it('a chosen lesson is off when unticking it would add more than fits (the other lessons of its whole episode)', () => {
    const { renderer } = planHarness([{ kind: 'episode', id: 'episode:stage2-letters' }], 4);
    const root = renderer.root;
    // Room 3; unticking one of six lessons adds four.
    expect(byTestId(root, 'pick-lesson-quest:stage2-letters-q1').props.checked).toBe(true);
    expect(byTestId(root, 'pick-lesson-quest:stage2-letters-q1').props.disabled).toBe(true);
    // The whole row still comes out in one press.
    expect(byTestId(root, 'pick-row-episode:stage2-letters').props.disabled).toBe(false);
  });

  it('draws the page notice under the chips', () => {
    view.locale = 'en';
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        <GroupedLessonPicker groups={consoleChooserGroups('en', 'plan', ['stage1'])} selection={[]} onChange={() => undefined} room={30} title="Lessons" notice="Stage 2 and later" testId="pick" />,
        { createNodeMock: () => ({ indeterminate: false, focus: () => undefined }) },
      );
    });
    expect(textOf(byTestId(renderer.root, 'pick-notice'))).toBe('Stage 2 and later');
  });
});

/** The lecture page's chooser (AMENDMENTS-LECTURE-V2 section 18.3, row LV-4): the outline it edits, re-rendered the way the page does. */
function lectureHarness(initial: LectureBlock[] = [], locale = 'en'): { renderer: ReactTestRenderer; blocks: () => LectureBlock[]; focused: string[]; reset: (next: LectureBlock[]) => void } {
  view.locale = locale;
  let blocks = initial;
  let key = 0;
  const focused: string[] = [];
  let renderer!: ReactTestRenderer;
  const render = (): JSX.Element => (
    <LectureChooserSection
      blocks={blocks}
      resetKey={key}
      onChange={(next) => {
        blocks = next;
        renderer.update(render());
      }}
    />
  );
  act(() => {
    renderer = create(render(), {
      createNodeMock: (element) => {
        const id = String(element.props['data-testid'] ?? '');
        return { indeterminate: false, focus: () => focused.push(id) };
      },
    });
  });
  const reset = (next: LectureBlock[]): void => {
    blocks = next;
    key += 1;
    act(() => renderer.update(render()));
  };
  return { renderer, blocks: () => blocks, focused, reset };
}

const lw = getMessages('en').console.lecture.presets;

describe('LectureChooserSection (the lecture page, tabs)', () => {
  it('is What to add with three tabs (no Letters: the console offers no letter sets), one panel, Stage 1 by default', () => {
    const { renderer } = lectureHarness();
    const root = renderer.root;
    expect(textOf(root.find((n) => n.type === 'h2'))).toBe(lw.chooser.label);
    const tabs = root.findAll((n) => n.type === 'button' && n.props.role === 'tab');
    expect(tabs.map((t) => textOf(t))).toEqual([lw.chooser.tab.lessons, lw.chooser.tab.stories, lw.chooser.tab.words]);
    expect(tabs.map((t) => t.props['aria-selected'])).toEqual([true, false, false]);
    expect(tabs.map((t) => t.props.tabIndex)).toEqual([0, -1, -1]);
    const list = root.find((n) => n.props.role === 'tablist');
    expect(list.props['aria-labelledby']).toBe(root.find((n) => n.type === 'h2').props.id);
    const panels = root.findAll((n) => n.props.role === 'tabpanel' && typeof n.type === 'string');
    expect(panels).toHaveLength(1);
    expect(panels[0]?.props['aria-labelledby']).toBe(tabs[0]?.props.id);
    expect(tabs[0]?.props['aria-controls']).toBe(panels[0]?.props.id);
    // The Lessons tab's stage chips: one per ready stage, a legend naming them; no group chips.
    const stageChips = root.findAll((n) => n.type === 'input' && n.props.type === 'radio');
    expect(stageChips.map((c) => c.props['data-testid'])).toEqual(['stage1', 'stage2', 'stage3', 'stage4', 'stage5', 'stage6', 'stage7'].map((s) => `lecture-picker-stage-${s}`));
    expect(textOf(root.find((n) => n.type === 'legend'))).toBe(lw.stage.choose);
    expect(hasTestId(root, 'lecture-picker-chip-stories')).toBe(false);
    expect(textOf(root.find((n) => n.type === 'h3'))).toBe('Stage 1 · 15 lessons');
  });

  it('the arrow keys, Home and End move between the tabs and select them', () => {
    const { renderer, focused } = lectureHarness();
    const root = renderer.root;
    const key = (id: string, k: string): void => {
      const preventDefault = vi.fn();
      act(() => byTestId(root, id).props.onKeyDown({ key: k, preventDefault }));
      expect(preventDefault).toHaveBeenCalled();
    };
    key('lecture-picker-tab-lessons', 'ArrowRight');
    expect(byTestId(root, 'lecture-picker-tab-stories').props['aria-selected']).toBe(true);
    expect(focused.at(-1)).toBe('lecture-picker-tab-stories');
    key('lecture-picker-tab-stories', 'End');
    expect(byTestId(root, 'lecture-picker-tab-topics').props['aria-selected']).toBe(true);
    key('lecture-picker-tab-topics', 'ArrowRight');
    expect(byTestId(root, 'lecture-picker-tab-lessons').props['aria-selected']).toBe(true);
    key('lecture-picker-tab-lessons', 'ArrowLeft');
    expect(byTestId(root, 'lecture-picker-tab-topics').props['aria-selected']).toBe(true);
    key('lecture-picker-tab-topics', 'Home');
    expect(byTestId(root, 'lecture-picker-tab-lessons').props['aria-selected']).toBe(true);
    const ignored = vi.fn();
    act(() => byTestId(root, 'lecture-picker-tab-lessons').props.onKeyDown({ key: 'a', preventDefault: ignored }));
    expect(ignored).not.toHaveBeenCalled();
  });

  it('"{n} lessons inside" shows an episode\'s lessons; the whole episode locks them (one tri-state choice)', () => {
    const { renderer, blocks } = lectureHarness();
    const root = renderer.root;
    act(() => byTestId(root, 'lecture-picker-stage-stage2').props.onChange());
    const inside = byTestId(root, 'lecture-picker-open-episode:stage2-letters');
    expect(textOf(inside)).toBe(lw.chooser.lessonsIn(6));
    expect(inside.props['aria-expanded']).toBe(false);
    expect(inside.props['aria-label']).toBeUndefined();
    // Its row's title describes it, so six "lessons inside" buttons are told apart.
    const title = root.find((n) => n.props.id === inside.props['aria-describedby']);
    expect(textOf(title)).toBe('Word Builder');
    act(() => inside.props.onClick());
    expect(byTestId(root, 'lecture-picker-open-episode:stage2-letters').props['aria-expanded']).toBe(true);
    // Some lessons: separate blocks, the episode mixed.
    act(() => byTestId(root, 'lecture-picker-lesson-quest:stage2-letters-q2').props.onChange());
    act(() => byTestId(root, 'lecture-picker-lesson-quest:stage2-letters-q4').props.onChange());
    expect(blocks()).toEqual([
      { kind: 'quest', id: 'quest:stage2-letters-q2' },
      { kind: 'quest', id: 'quest:stage2-letters-q4' },
    ]);
    // Checking the mixed episode merges them into one block at the first one's place.
    act(() => byTestId(root, 'lecture-picker-row-episode:stage2-letters').props.onChange());
    expect(blocks()).toEqual([{ kind: 'episode', id: 'episode:stage2-letters' }]);
    for (const n of [1, 2, 3, 4, 5, 6]) {
      const box = byTestId(root, `lecture-picker-lesson-quest:stage2-letters-q${n}`);
      expect(box.props.checked).toBe(true);
      expect(box.props.disabled).toBe(true);
    }
    // Unchecking the episode clears it and its lessons.
    act(() => byTestId(root, 'lecture-picker-row-episode:stage2-letters').props.onChange());
    expect(blocks()).toEqual([]);
    expect(byTestId(root, 'lecture-picker-lesson-quest:stage2-letters-q1').props.disabled).toBe(false);
  });

  it('Stories and Word topics show 8 rows, then Show {n} more; focus moves to the first new row', () => {
    const { renderer, focused } = lectureHarness();
    const root = renderer.root;
    act(() => byTestId(root, 'lecture-picker-tab-stories').props.onClick());
    const rows = (): ReactTestInstance[] => root.findAll((n) => typeof n.props['data-testid'] === 'string' && n.props['data-testid'].startsWith('lecture-picker-row-story:') && n.type === 'input');
    expect(rows()).toHaveLength(8);
    const more = byTestId(root, 'lecture-picker-more-stories');
    expect(textOf(more)).toBe(lw.chooser.showMore(8));
    act(() => more.props.onClick());
    expect(rows()).toHaveLength(16);
    expect(focused.at(-1)).toBe(rows()[8]?.props['data-testid']);
    act(() => byTestId(root, 'lecture-picker-more-stories').props.onClick());
    expect(rows()).toHaveLength(24);
    expect(hasTestId(root, 'lecture-picker-more-stories')).toBe(false);
    act(() => byTestId(root, 'lecture-picker-tab-topics').props.onClick());
    const topics = root.findAll((n) => typeof n.props['data-testid'] === 'string' && n.props['data-testid'].startsWith('lecture-picker-row-vocab-topic:') && n.type === 'input');
    expect(topics).toHaveLength(8);
    expect(textOf(byTestId(root, 'lecture-picker-more-topics'))).toBe(lw.chooser.showMore(4));
  });

  it('adds stories, topics and Stage 2 lessons as blocks, and removes them in place; a quiz keeps its place', () => {
    const { renderer, blocks } = lectureHarness([{ kind: 'quiz', from: 'previous', rounds: 5 }]);
    const root = renderer.root;
    act(() => byTestId(root, 'lecture-picker-tab-stories').props.onClick());
    act(() => byTestId(root, 'lecture-picker-row-story:hangeul-day').props.onChange());
    act(() => byTestId(root, 'lecture-picker-tab-topics').props.onClick());
    act(() => byTestId(root, 'lecture-picker-row-vocab-topic:food').props.onChange());
    act(() => byTestId(root, 'lecture-picker-tab-lessons').props.onClick());
    act(() => byTestId(root, 'lecture-picker-stage-stage2').props.onChange());
    act(() => byTestId(root, 'lecture-picker-lesson-quest:stage2-letters-q1').props.onChange());
    expect(blocks()).toEqual([
      { kind: 'quiz', from: 'previous', rounds: 5 },
      { kind: 'story', storyId: 'story:hangeul-day', checks: true },
      { kind: 'vocab', topicId: 'vocab-topic:food' },
      { kind: 'quest', id: 'quest:stage2-letters-q1' },
    ]);
    act(() => byTestId(root, 'lecture-picker-tab-stories').props.onClick());
    act(() => byTestId(root, 'lecture-picker-row-story:hangeul-day').props.onChange());
    expect(blocks().map((b) => b.kind)).toEqual(['quiz', 'vocab', 'quest']);
    expect(LECTURE_MAX_BLOCKS).toBe(30);
  });

  it('a replaced outline (a preset) opens on the tab and stage of its first lesson', () => {
    const { renderer, reset } = lectureHarness();
    const root = renderer.root;
    reset([{ kind: 'quiz', from: 'previous', rounds: 4 }, { kind: 'quest', id: 'quest:stage3-letters-q1' }]);
    expect(byTestId(root, 'lecture-picker-tab-lessons').props['aria-selected']).toBe(true);
    expect(byTestId(root, 'lecture-picker-stage-stage3').props.checked).toBe(true);
    reset([{ kind: 'story', storyId: 'story:hangeul-day', checks: true }]);
    expect(byTestId(root, 'lecture-picker-tab-stories').props['aria-selected']).toBe(true);
    reset([{ kind: 'revisit', chars: ['ㄱ', 'ㄴ', 'ㄷ', 'ㅏ'] }]);
    expect(byTestId(root, 'lecture-picker-tab-lessons').props['aria-selected']).toBe(true);
    expect(byTestId(root, 'lecture-picker-stage-stage1').props.checked).toBe(true);
  });

  it('a search lists every matching group with no tabs; clearing it brings the tabs back', () => {
    const { renderer } = lectureHarness();
    const root = renderer.root;
    act(() => byTestId(root, 'lecture-picker-search').props.onChange({ target: { value: 'hangul' } }));
    expect(root.findAll((n) => n.props.role === 'tablist')).toHaveLength(0);
    expect(root.findAll((n) => n.type === 'h3').length).toBeGreaterThan(1);
    act(() => byTestId(root, 'lecture-picker-clear').props.onClick());
    expect(root.findAll((n) => n.props.role === 'tablist')).toHaveLength(1);
  });

  it('titles and tabs follow the console language (ko)', () => {
    const { renderer } = lectureHarness([], 'ko');
    const root = renderer.root;
    const ko = getMessages('ko').console.lecture.presets;
    expect(textOf(byTestId(root, 'lecture-picker-tab-stories'))).toBe(ko.chooser.tab.stories);
    expect(textOf(byTestId(root, 'lecture-picker-open-episode:stage1-letters'))).toBe(ko.chooser.lessonsIn(3));
    expect(textOf(root.find((n) => n.type === 'legend'))).toBe(ko.stage.choose);
  });
});
