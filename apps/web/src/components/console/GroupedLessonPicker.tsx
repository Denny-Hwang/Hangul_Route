'use client';

import {
  lessonChosen,
  rowState,
  searchChooser,
  shownLessons,
  toggleLesson,
  toggleRow,
  type ChooserEpisodeRow,
  type ChooserGroup,
  type ChooserRow,
  type ChooserSelection,
  type StageKey,
} from '@hangul-route/content-schema';
import { IconSvg } from '@hangul-route/design-system/icon-glyphs/dom';
import { borderWidth, colors, radii, spacing, touchTarget, typography } from '@hangul-route/design-system/tokens';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  CHOOSER_PAGE,
  addsItems,
  chooserTabs,
  groupChip,
  groupHeading,
  initialGroup,
  initialView,
  lessonLocked,
  rowDetail,
  stageGroupsOf,
  visibleCount,
  type ChooserTab,
  type ChooserView,
} from '@/lib/console/lesson-picker';
import { useMessages } from '@/lib/i18n/locale-context';
import { rem } from '@/lib/console/rem';

/**
 * The grouped lesson picker (owner report 2026-10-16 item 5; spec
 * `docs/specs/AMENDMENTS-LESSON-CHOOSER.md`, row LV-3a; wireframe
 * `design/wireframes/console/plan-builder.md` G; design `design/screens/app-shell/lesson-picker.md`):
 * the plan builder's Lessons panel and the lecture page's Catalogue. One stage (or Stories, or
 * Word topics) at a time behind a chip, one row per episode with a checkbox that chooses the
 * whole episode and a button that shows its lessons, and a search across every group (titles in
 * the console language, the Korean title, its romanization). Nothing is chosen here that the page
 * does not hold: the page owns the selection (its plan items or outline blocks) and gets each
 * change as an update. Search results only narrow what is drawn: every press acts on the whole
 * episode (`searchChooser` keeps `lessons` whole and names the `shown` ones).
 *
 * The lecture page's Customize draws it as tabs (`tabs`, AMENDMENTS-LECTURE-V2 section 18.3, row LV-4; mock
 * `design/screens/app-shell/lecture-setup.md`): **Lessons · Stories · Word topics** (`role="tablist"`, one tab stop,
 * the arrows move and select, one panel at a time), the Lessons tab's stage chips, a "{n} lessons inside" disclosure
 * per episode, and Stories and Word topics 8 rows at a time with **Show {n} more** (focus moves to the first new row).
 * There an episode and its lessons are one tri-state choice: the whole episode locks its lessons (`lessonLocked`).
 */

const px = (value: number): string => `${value}px`;
const focusRing = `outline:${px(borderWidth.thick)} solid ${colors.border.focus};outline-offset:${px(borderWidth.base)}`;

export const PICKER_CSS = `
.hr-pick{display:flex;flex-direction:column;gap:${rem(spacing.md)};min-width:0;color:${colors.text.primary};font-size:${rem(typography.size.body)};line-height:${typography.leading.normal}}
.hr-pick h2,.hr-pick h3,.hr-pick p,.hr-pick ul{margin:0;padding:0}
.hr-pick ul{list-style:none}
.hr-pick h2{font-size:${rem(typography.size.bodyLg)};font-weight:${typography.weight.bold}}
.hr-pick h3{font-size:${rem(typography.size.body)};font-weight:${typography.weight.bold};color:${colors.text.secondary}}
.hr-pick-search{display:flex;flex-wrap:wrap;align-items:center;gap:${rem(spacing.xs)} ${rem(spacing.sm)}}
.hr-pick-search label{flex:1 1 100%;font-weight:${typography.weight.semibold}}
.hr-pick-input{flex:1 1 12rem;min-width:0;box-sizing:border-box;min-height:${px(touchTarget.min)};padding:${rem(spacing.sm)} ${rem(spacing.md)};border:${px(borderWidth.base)} solid ${colors.border.strong};border-radius:${px(radii.md)};background:${colors.surface.paper};color:${colors.text.primary};font:inherit}
.hr-pick-hint{flex:1 1 100%;color:${colors.text.secondary};font-size:${rem(typography.size.bodySm)}}
.hr-pick-btn{display:inline-flex;align-items:center;justify-content:center;min-height:${px(touchTarget.min)};min-width:${px(touchTarget.min)};padding:0 ${rem(spacing.lg)};border-radius:${px(radii.pill)};border:${px(borderWidth.thin)} solid ${colors.border.strong};background:${colors.surface.paper};color:${colors.text.primary};font:inherit;font-size:${rem(typography.size.bodySm)};font-weight:${typography.weight.bold};cursor:pointer}
.hr-pick-open{border-radius:${px(radii.md)};padding:0}
.hr-pick-chevron{display:block;width:${px(spacing.sm)};height:${px(spacing.sm)};border-right:${px(borderWidth.thick)} solid ${colors.text.primary};border-bottom:${px(borderWidth.thick)} solid ${colors.text.primary};transform:rotate(-45deg)}
.hr-pick-open[aria-expanded="true"] .hr-pick-chevron{transform:rotate(45deg)}
.hr-pick-chips{display:flex;flex-wrap:wrap;gap:${rem(spacing.xs)};border:none;margin:0;padding:0;min-width:0}
.hr-pick-chip{display:inline-flex;align-items:center;gap:${rem(spacing.xs)};min-height:${px(touchTarget.min)};padding:0 ${rem(spacing.md)};border-radius:${px(radii.pill)};border:${px(borderWidth.thin)} solid ${colors.border.strong};background:${colors.surface.paper};font-weight:${typography.weight.semibold};cursor:pointer}
.hr-pick-chip:has(input:checked){border:${px(borderWidth.thick)} solid ${colors.text.primary};font-weight:${typography.weight.bold}}
.hr-pick-chip input,.hr-pick-check input{width:${px(spacing.xl)};height:${px(spacing.xl)};margin:0;flex:none;accent-color:${colors.brand.primary}}
.hr-pick-chip:has(input:focus-visible),.hr-pick-check:has(input:focus-visible),.hr-pick-btn:focus-visible,.hr-pick-input:focus-visible{${focusRing}}
.hr-pick-status{color:${colors.text.secondary};font-size:${rem(typography.size.bodySm)}}
.hr-pick-group{display:flex;flex-direction:column;gap:${rem(spacing.xs)}}
.hr-pick-rows{display:flex;flex-direction:column;gap:${rem(spacing.xs)}}
.hr-pick-line{display:flex;align-items:stretch;gap:${rem(spacing.xs)};min-width:0}
.hr-pick-check{flex:1 1 auto;display:flex;flex-wrap:wrap;align-items:center;column-gap:${rem(spacing.md)};row-gap:${rem(spacing.xxs)};min-width:0;min-height:${px(touchTarget.min)};padding:${rem(spacing.xs)} ${rem(spacing.md)};border-radius:${px(radii.md)};border:${px(borderWidth.thin)} solid ${colors.border.subtle};background:${colors.surface.paper};cursor:pointer}
.hr-pick-check:has(input:checked){border:${px(borderWidth.base)} solid ${colors.brand.primary}}
.hr-pick-check:has(input:disabled){background:${colors.surface.sunken};cursor:default}
.hr-pick-title{flex:1 1 10rem;min-width:0;font-weight:${typography.weight.semibold};overflow-wrap:anywhere}
.hr-pick-detail{color:${colors.text.secondary};font-size:${rem(typography.size.bodySm)}}
.hr-pick .hr-pick-lessons{display:flex;flex-direction:column;gap:${rem(spacing.xs)};margin:${rem(spacing.xs)} 0 0 ${rem(spacing.xl)};padding-left:${rem(spacing.md)};border-left:${px(borderWidth.base)} solid ${colors.border.subtle}}
.hr-pick .hr-pick-lessons[hidden]{display:none}
.hr-pick-lessons .hr-pick-title{font-weight:${typography.weight.regular}}
.hr-pick .hr-pick-note{padding:${rem(spacing.sm)} ${rem(spacing.md)};border-left:${px(borderWidth.thick)} solid ${colors.feedback.nudge};border-radius:${px(radii.sm)};background:${colors.feedback.nudgeLight};color:${colors.text.primary};font-size:${rem(typography.size.bodySm)}}
.hr-pick-note a{color:inherit;font-weight:${typography.weight.semibold};text-decoration:underline;text-underline-offset:${px(borderWidth.thick)}}
.hr-pick-tabs{display:flex;flex-wrap:wrap;gap:${rem(spacing.xs)}}
.hr-pick-tab{display:inline-flex;align-items:center;justify-content:center;min-height:${px(touchTarget.min)};min-width:${px(touchTarget.min)};padding:0 ${rem(spacing.lg)};border-radius:${px(radii.pill)};border:${px(borderWidth.base)} solid ${colors.border.strong};background:${colors.surface.paper};color:${colors.text.primary};font:inherit;font-weight:${typography.weight.regular};cursor:pointer}
.hr-pick-tab[aria-selected="true"]{border-color:${colors.brand.primaryDark};background:${colors.brand.primaryDark};color:${colors.text.onPrimary};font-weight:${typography.weight.bold}}
.hr-pick-tab:focus-visible{${focusRing}}
.hr-pick-panel{display:flex;flex-direction:column;gap:${rem(spacing.sm)};min-width:0}
.hr-pick-legend{padding:0;margin:0 0 ${rem(spacing.xs)};font-weight:${typography.weight.bold}}
.hr-pick-inside{flex:0 1 auto;gap:${rem(spacing.xs)};padding:0 ${rem(spacing.md)};border-radius:${px(radii.md)}}
.hr-pick-line-wrap{flex-wrap:wrap}
.hr-pick-line-wrap > .hr-pick-check{flex:1 1 16rem}
.hr-pick-inside svg{flex:none}
.hr-pick-more{align-self:flex-start}
.hr-pick-hidden{position:absolute;width:${px(borderWidth.thin)};height:${px(borderWidth.thin)};margin:-${px(borderWidth.thin)};padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0}
`;

export interface GroupedLessonPickerProps {
  /** `consoleChooserGroups(locale, use)`. */
  groups: readonly ChooserGroup[];
  /** The keys the page holds now (its plan items or outline blocks). */
  selection: ChooserSelection;
  /** One press: the page applies the update to its own current selection. */
  onChange: (update: (selection: ChooserSelection) => string[]) => void;
  /** How many more items fit; a press that would add more is disabled (one that removes never is). */
  room: number;
  /** The h2: "Lessons" on the plan builder, "Catalogue" on the lecture page. */
  title: string;
  /** Drawn while nothing more fits. */
  fullNote?: ReactNode;
  /** A line under the chips (the plan builder's stages line, AMENDMENTS-LESSON-CHOOSER section 4). */
  notice?: ReactNode;
  /**
   * `false` on the plan builder: ticking a partly chosen episode adds its missing lessons and keeps
   * the chosen lesson items with their dates and notes (`toggleRow` `merge: false`); default `true`
   * (a deck outline: the whole episode becomes one block).
   */
  merge?: boolean;
  /**
   * Changes when the page replaces its list (another plan opened, a stored draft or a link's
   * draft loaded): the picker opens again on the group of the first chosen item, with an empty
   * search and every episode closed. An edit in the list never changes it.
   */
  resetKey?: string | number;
  /**
   * The lecture page's words for its tabs layout (AMENDMENTS-LECTURE-V2 section 18.3): given, the picker draws the
   * Lessons, Stories and Word topics tabs with stage chips, "{n} lessons inside" and Show more, and the whole
   * episode locks its lessons. Absent (the plan builder), one chip per group.
   */
  tabs?: ChooserTabWords;
  testId: string;
}

/** `console.lecture.presets.chooser` with the stage chips' words (`presets.stage.choose`, `.chip`). */
export interface ChooserTabWords {
  tab: { lessons: string; stories: string; words: string };
  lessonsIn: (n: number) => string;
  showMore: (n: number) => string;
  stageChoose: string;
  stageChip: (n: number) => string;
}

function Checkbox({
  checked,
  mixed,
  disabled,
  onChange,
  title,
  titleId,
  detail,
  testId,
  inputRef,
}: {
  checked: boolean;
  mixed: boolean;
  disabled: boolean;
  onChange: () => void;
  title: string;
  /** The title's id, for a button that names its row (`aria-describedby`). */
  titleId?: string;
  detail: string;
  testId: string;
  inputRef?: (el: HTMLInputElement | null) => void;
}): JSX.Element {
  return (
    <label className="hr-pick-check">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        data-testid={testId}
        // The tri-state of a row: some of its lessons are chosen (read as "mixed").
        ref={(el) => {
          if (el) el.indeterminate = mixed;
          inputRef?.(el);
        }}
      />
      <span className="hr-pick-title" id={titleId}>
        {title}
      </span>
      {detail ? <span className="hr-pick-detail">{detail}</span> : null}
    </label>
  );
}

export function GroupedLessonPicker({ groups, selection, onChange, room, title, fullNote, notice, merge = true, resetKey, tabs, testId }: GroupedLessonPickerProps): JSX.Element {
  const w = useMessages().console.chooser;
  const uid = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [groupId, setGroupId] = useState<ChooserGroup['id'] | null>(() => initialGroup(groups, selection));
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  // The tabs layout: the tab, the Lessons tab's stage chip and how many story and topic rows show.
  const [view, setView] = useState<ChooserView>(() => initialView(groups, selection));
  const [more, setMore] = useState<Readonly<Record<'stories' | 'topics', number>>>({ stories: CHOOSER_PAGE, topics: CHOOSER_PAGE });
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const rowInputs = useRef(new Map<string, HTMLInputElement>());
  const tabButtons = useRef(new Map<ChooserTab, HTMLButtonElement>());
  // A new list from the page (resetKey): open on its first chosen item's group again (state adjusted while rendering).
  const [seenKey, setSeenKey] = useState(resetKey);
  if (seenKey !== resetKey) {
    setSeenKey(resetKey);
    setGroupId(initialGroup(groups, selection));
    setView(initialView(groups, selection));
    setMore({ stories: CHOOSER_PAGE, topics: CHOOSER_PAGE });
    setQuery('');
    setOpen(new Set());
  }
  // Show more moves the keyboard to the first new row (section 18.3).
  useEffect(() => {
    if (focusKey === null) return;
    rowInputs.current.get(focusKey)?.focus();
    setFocusKey(null);
  }, [focusKey]);
  // The chips change with the groups (the plan builder's stages load later): a chip that is gone falls back to the first group.
  const groupShown = groups.some((g) => g.id === groupId) ? groupId : initialGroup(groups, selection);
  const results = useMemo(() => (query.trim().length > 0 ? searchChooser(groups, query) : null), [groups, query]);
  const shown = results ?? groups.filter((g) => g.id === groupShown);
  const options = { merge };
  const blocked = (row: ChooserRow, lessonKey?: string): boolean => addsItems(selection, row, lessonKey, options) > room;
  const clearSearch = (): void => {
    setQuery('');
    // Clear unmounts itself: keep the keyboard in the search field.
    searchRef.current?.focus();
  };
  const toggleOpen = (key: string): void =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const lessonList = (row: ChooserEpisodeRow, listId: string, visible: boolean): JSX.Element => (
    <ul id={listId} className="hr-pick-lessons" hidden={!visible}>
      {shownLessons(row).map((lesson) => (
        <li key={lesson.key}>
          <Checkbox
            checked={lessonChosen(selection, row, lesson.key)}
            mixed={false}
            // Off when the press would add more than fits, a chosen lesson's too: unticking one lesson of a whole episode adds the others.
            // On the lecture page the whole episode locks its lessons: one tri-state choice (section 18.3).
            disabled={(tabs !== undefined && lessonLocked(selection, row)) || blocked(row, lesson.key)}
            onChange={() => onChange((s) => toggleLesson(s, row, lesson.key))}
            title={lesson.title}
            detail={w.minutes(lesson.minutes)}
            testId={`${testId}-lesson-${lesson.key}`}
          />
        </li>
      ))}
    </ul>
  );

  const rowItem = (row: ChooserRow): JSX.Element => {
    const state = rowState(selection, row);
    const listId = `${uid}-${row.key}`;
    const isOpen = results !== null || open.has(row.key);
    const titleId = `${listId}-title`;
    return (
      <li key={row.key}>
        {/* On the lecture page a row asks for 16rem before it shares a line with its "lessons inside" button (200 % text at 320). */}
        <div className={tabs === undefined ? 'hr-pick-line' : 'hr-pick-line hr-pick-line-wrap'}>
          <Checkbox
            checked={state === 'all'}
            mixed={state === 'some'}
            disabled={state !== 'all' && blocked(row)}
            onChange={() => onChange((s) => toggleRow(s, row, options))}
            title={row.title}
            titleId={titleId}
            detail={rowDetail(row, w)}
            testId={`${testId}-row-${row.key}`}
            inputRef={(el) => {
              if (el) rowInputs.current.set(row.key, el);
              else rowInputs.current.delete(row.key);
            }}
          />
          {row.kind === 'episode' && results === null && tabs === undefined ? (
            <button
              type="button"
              className="hr-pick-btn hr-pick-open"
              aria-expanded={isOpen}
              aria-controls={listId}
              aria-label={w.lessonsOf(row.title)}
              onClick={() => toggleOpen(row.key)}
              data-testid={`${testId}-open-${row.key}`}
            >
              <span className="hr-pick-chevron" aria-hidden="true" />
            </button>
          ) : null}
          {row.kind === 'episode' && results === null && tabs !== undefined ? (
            // "{n} lessons inside" (section 18.3): its own words, and the row's title as its description.
            <button
              type="button"
              className="hr-pick-btn hr-pick-inside"
              aria-expanded={isOpen}
              aria-controls={listId}
              aria-describedby={titleId}
              onClick={() => toggleOpen(row.key)}
              data-testid={`${testId}-open-${row.key}`}
            >
              <IconSvg name={isOpen ? 'dash' : 'plus'} size={spacing.xl} color={colors.text.primary} />
              <span>{tabs.lessonsIn(row.lessons.length)}</span>
            </button>
          ) : null}
        </div>
        {row.kind === 'episode' ? lessonList(row, listId, isOpen) : null}
      </li>
    );
  };

  const groupBlock = (group: ChooserGroup, rows: readonly ChooserRow[], after?: ReactNode): JSX.Element => (
    <div key={group.id} className="hr-pick-group" data-testid={`${testId}-group-${group.id}`}>
      <h3>{groupHeading(group, w)}</h3>
      <ul className="hr-pick-rows">{rows.map(rowItem)}</ul>
      {after}
    </div>
  );

  const tabsBody = (t: ChooserTabWords): ReactNode => {
    const tabList = chooserTabs(groups);
    if (tabList.length === 0) return null;
    const stages = stageGroupsOf(groups);
    const tab = tabList.includes(view.tab) ? view.tab : (tabList[0] as ChooserTab);
    const stage = stages.some((g) => g.id === view.stage) ? (view.stage as StageKey) : ((stages[0]?.id ?? null) as StageKey | null);
    const names: Record<ChooserTab, string> = { lessons: t.tab.lessons, stories: t.tab.stories, topics: t.tab.words };
    const select = (next: ChooserTab | undefined): void => {
      if (next === undefined) return;
      setView((v) => ({ ...v, tab: next }));
      tabButtons.current.get(next)?.focus();
    };
    const step = (from: ChooserTab, by: number): void => select(tabList[(tabList.indexOf(from) + by + tabList.length) % tabList.length]);
    let panel: ReactNode = null;
    if (tab === 'lessons') {
      const group = stages.find((g) => g.id === stage);
      panel = (
        <>
          <fieldset className="hr-pick-chips">
            <legend className="hr-pick-legend">{t.stageChoose}</legend>
            {stages.map((g) => (
              <label key={g.id} className="hr-pick-chip">
                <input type="radio" name={`${uid}-stage`} checked={g.id === stage} onChange={() => setView((v) => ({ ...v, stage: g.id as StageKey }))} data-testid={`${testId}-stage-${g.id}`} />
                {t.stageChip(g.stage ?? 0)}
              </label>
            ))}
          </fieldset>
          {group ? groupBlock(group, group.rows.filter((r) => r.kind === 'episode')) : null}
        </>
      );
    } else {
      const group = groups.find((g) => g.id === tab);
      if (group) {
        const page = tab === 'stories' ? more.stories : more.topics;
        const shownRows = group.rows.slice(0, page);
        const rest = group.rows.length - shownRows.length;
        const next = group.rows[shownRows.length];
        panel = groupBlock(
          group,
          shownRows,
          rest > 0 && next ? (
            <button
              type="button"
              className="hr-pick-btn hr-pick-inside hr-pick-more"
              onClick={() => {
                setMore((m) => ({ ...m, [tab]: page + CHOOSER_PAGE }));
                setFocusKey(next.key);
              }}
              data-testid={`${testId}-more-${tab}`}
            >
              <IconSvg name="plus" size={spacing.xl} color={colors.text.primary} />
              <span>{t.showMore(Math.min(CHOOSER_PAGE, rest))}</span>
            </button>
          ) : null,
        );
      }
    }
    return (
      <>
        <div className="hr-pick-tabs" role="tablist" aria-labelledby={`${uid}-title`} data-testid={`${testId}-tabs`}>
          {tabList.map((name) => (
            <button
              key={name}
              ref={(node) => {
                if (node) tabButtons.current.set(name, node);
                else tabButtons.current.delete(name);
              }}
              type="button"
              role="tab"
              className="hr-pick-tab"
              id={`${uid}-tab-${name}`}
              aria-selected={name === tab}
              aria-controls={`${uid}-panel`}
              tabIndex={name === tab ? 0 : -1}
              onClick={() => setView((v) => ({ ...v, tab: name }))}
              onKeyDown={(event) => {
                if (event.key === 'ArrowRight' || event.key === 'ArrowDown') step(name, 1);
                else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') step(name, -1);
                else if (event.key === 'Home') select(tabList[0]);
                else if (event.key === 'End') select(tabList[tabList.length - 1]);
                else return;
                event.preventDefault();
              }}
              data-testid={`${testId}-tab-${name}`}
            >
              {names[name]}
            </button>
          ))}
        </div>
        <div role="tabpanel" id={`${uid}-panel`} aria-labelledby={`${uid}-tab-${tab}`} className="hr-pick-panel" data-testid={`${testId}-panel-${tab}`}>
          {panel}
        </div>
      </>
    );
  };

  return (
    <section className="hr-pick" aria-labelledby={`${uid}-title`} data-testid={testId}>
      <style>{PICKER_CSS}</style>
      <h2 id={`${uid}-title`}>{title}</h2>
      <div className="hr-pick-search">
        <label htmlFor={`${uid}-search`}>{w.search.label}</label>
        <input
          ref={searchRef}
          id={`${uid}-search`}
          className="hr-pick-input"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-describedby={`${uid}-hint`}
          data-testid={`${testId}-search`}
        />
        {query.length > 0 ? (
          <button type="button" className="hr-pick-btn" onClick={clearSearch} data-testid={`${testId}-clear`}>
            {w.clearSearch.cta}
          </button>
        ) : null}
        <p id={`${uid}-hint`} className="hr-pick-hint">
          {w.search.hint}
        </p>
      </div>
      {results === null && tabs === undefined ? (
        <fieldset className="hr-pick-chips">
          <legend className="hr-pick-hidden">{w.groups}</legend>
          {groups.map((g) => (
            <label key={g.id} className="hr-pick-chip">
              <input type="radio" name={`${uid}-group`} checked={g.id === groupShown} onChange={() => setGroupId(g.id)} data-testid={`${testId}-chip-${g.id}`} />
              {groupChip(g, w)}
            </label>
          ))}
        </fieldset>
      ) : null}
      {/* Always in the accessibility tree (an empty live region is only visually hidden), so the first "n matches" is announced. */}
      <p className={results === null ? 'hr-pick-status hr-pick-hidden' : 'hr-pick-status'} role="status" aria-live="polite" data-testid={`${testId}-status`}>
        {results === null ? '' : results.length > 0 ? w.found(visibleCount(results)) : w.noMatch}
      </p>
      {notice ? (
        <p className="hr-pick-note" data-testid={`${testId}-notice`}>
          {notice}
        </p>
      ) : null}
      {room <= 0 && fullNote ? <p className="hr-pick-note">{fullNote}</p> : null}
      {results === null && tabs !== undefined ? tabsBody(tabs) : shown.map((group) => groupBlock(group, group.rows))}
    </section>
  );
}
