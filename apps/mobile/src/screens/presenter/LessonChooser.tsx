import { Icon, borderWidth, colors, radii, spacing, touchTarget, useTypeScale, z, KOREAN_LINE_BREAK } from '@hangul-route/design-system';
import { lessonChosen, type ChooserEpisodeRow, type ChooserGroup, type ChooserRow, type StageKey } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CHOOSER_PAGE, type ChooserTab, type HomeSnapshot } from '../../logic/lecture/home-state';
import { radioAfter } from '../../logic/lecture/home-view';
import { chooserFull, chooserTray, lessonLocked, pressLesson, pressRow, removeChoice, rowCheck, choiceMinutes } from '../../logic/lecture/quick-lesson';
import { ChipGroup, CheckRow, HomeButton, Line, ring, text, type Focusable } from './home-parts';

/**
 * Customize's grouped chooser on the presenter home (AMENDMENTS-LECTURE-V2 section 18.3; design
 * `presets.md` item 5, mocks `presets-customize*.html`): it replaces the flat Quick lesson list.
 *
 * - **What to add** and four tabs (`role="tablist"`, one tab stop, the arrows move and select):
 *   Lessons, Stories, Word topics, Letters; a tab with nothing in this build is not drawn, and one
 *   panel shows at a time.
 * - **Lessons**: the stage chips (only stages with a ready cell), then that stage's episodes as
 *   checkbox rows, each with a "{n} lessons inside" disclosure listing its lessons. An episode and
 *   its lessons are one tri-state choice (`quick-lesson.ts`): the whole episode locks its lessons,
 *   some lessons draw the episode mixed, and checking the mixed episode merges them into it.
 * - **Stories** and **Word topics**: 8 rows, then **Show {n} more** (8 at a time; focus moves to
 *   the first new row). **Letters**: Consonants and Vowels.
 * - **Your lesson**: the chosen parts in order, each with a remove button; then a sticky footer
 *   with "{n} parts · about {m} min" (a polite status) and **Build lesson**, off with nothing
 *   chosen. A box whose press would pass 30 blocks is off, and the status adds the full line.
 *
 * Its tab, stage, choices, open episodes and pages live in the home's kept state (section 18.2).
 */

export interface LessonChooserProps {
  messages: Messages;
  groups: readonly ChooserGroup[];
  state: HomeSnapshot;
  onState: (patch: Partial<HomeSnapshot>) => void;
  /** The Lessons tab's stage before the teacher picks one: the open preset's first lesson's, else Stage 1. */
  defaultStage: StageKey;
  onBuild: () => void;
}

const REM = 16;
/** A row asks for 16rem before it shares a line with its "lessons inside" button. */
const ROW_BASIS_REM = 16;

const stageNumber = (stage: StageKey): number => Number(stage.slice('stage'.length));

function ChooserTabs({ tabs, value, label, names, onChange }: { tabs: readonly ChooserTab[]; value: ChooserTab; label: string; names: Record<ChooserTab, string>; onChange: (tab: ChooserTab) => void }): React.ReactElement {
  const ts = useTypeScale().size;
  const refs = useRef(new Map<ChooserTab, View | null>());
  const onKey = (e: { key: string; preventDefault?: () => void }): void => {
    const next = radioAfter(tabs, value, e.key);
    if (next === null) return;
    e.preventDefault?.();
    if (next !== value) onChange(next);
    refs.current.get(next)?.focus?.();
  };
  return (
    <View role="tablist" aria-label={label} testID="presenter-chooser-tabs" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {tabs.map((tab) => {
        const on = tab === value;
        return (
          <Pressable
            key={tab}
            ref={(el) => {
              refs.current.set(tab, el);
            }}
            role="tab"
            aria-selected={on}
            {...{ 'aria-controls': 'presenter-chooser-panel', id: `presenter-chooser-tab-${tab}` }}
            accessibilityState={{ selected: on }}
            tabIndex={on ? 0 : -1}
            onPress={() => {
              if (!on) onChange(tab);
            }}
            {...{ onKeyDown: onKey }}
            testID={`presenter-chooser-tab-${tab}`}
            style={({ focused }: Focusable) => ({
              minHeight: touchTarget.min,
              minWidth: touchTarget.min,
              justifyContent: 'center',
              alignItems: 'center',
              paddingHorizontal: spacing.lg,
              borderRadius: radii.pill,
              borderWidth: borderWidth.base,
              borderColor: on ? colors.brand.primaryDark : colors.border.strong,
              backgroundColor: on ? colors.brand.primaryDark : colors.surface.paper,
              ...ring(focused),
            })}
          >
            <Text {...KOREAN_LINE_BREAK} style={text(ts.body, on ? 'bold' : 'regular', on ? colors.text.onPrimary : colors.text.primary)}>
              {names[tab]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function LessonChooser({ messages, groups, state, onState, defaultStage, onBuild }: LessonChooserProps): React.ReactElement {
  const scale = useTypeScale();
  const ts = scale.size;
  const insets = useSafeAreaInsets();
  const m = messages.learner.presenter.presets.chooser;
  const quick = messages.learner.presenter.home.quick;
  const stageGroups = useMemo(() => groups.filter((g) => g.stage !== null && g.rows.some((r) => r.kind === 'episode')), [groups]);
  const stories = useMemo(() => groups.find((g) => g.id === 'stories')?.rows ?? [], [groups]);
  const topics = useMemo(() => groups.find((g) => g.id === 'topics')?.rows ?? [], [groups]);
  const letters = useMemo(() => groups.flatMap((g) => g.rows).filter((r) => r.kind === 'letters'), [groups]);
  const tabs = useMemo(() => {
    const out: ChooserTab[] = [];
    if (stageGroups.length > 0) out.push('lessons');
    if (stories.length > 0) out.push('stories');
    if (topics.length > 0) out.push('topics');
    if (letters.length > 0) out.push('letters');
    return out;
  }, [stageGroups, stories, topics, letters]);
  const tab = tabs.includes(state.tab) ? state.tab : (tabs[0] ?? 'lessons');
  const stageIds = stageGroups.map((g) => g.id as StageKey);
  const wanted = state.chooserStage ?? defaultStage;
  const stage = stageIds.includes(wanted) ? wanted : (stageIds[0] ?? 'stage1');
  const chosen = state.chosen;
  const full = chooserFull(chosen, groups);
  const tray = chooserTray(chosen, groups);
  const minutes = tray.reduce((sum, t) => sum + t.minutes, 0);
  const basis = ROW_BASIS_REM * REM * scale.factor;

  // Show {n} more: focus moves to the first new row.
  const rowRefs = useRef(new Map<string, View | null>());
  const [focusKey, setFocusKey] = useState<string | null>(null);
  useEffect(() => {
    if (focusKey === null) return;
    rowRefs.current.get(focusKey)?.focus?.();
    setFocusKey(null);
  }, [focusKey, state.more]);

  // A remove moves focus to the next row's remove button (or the one before), else the tray's heading.
  const removeRefs = useRef(new Map<string, View | null>());
  const trayHeading = useRef<Text>(null);
  const [focusAfterRemove, setFocusAfterRemove] = useState<{ target: string | null } | null>(null);
  useEffect(() => {
    if (focusAfterRemove === null) return;
    const target = focusAfterRemove.target === null ? undefined : removeRefs.current.get(focusAfterRemove.target);
    if (target) target.focus?.();
    else (trayHeading.current as unknown as { focus?: () => void } | null)?.focus?.();
    setFocusAfterRemove(null);
  }, [chosen, focusAfterRemove]);

  const choose = (next: string[] | null): void => {
    if (next !== null) onState({ chosen: next });
  };
  const minutesLine = (row: ChooserRow): string => (row.kind === 'letters' ? quick.letters(row.jamoIds.length) : quick.minutes(row.minutes));

  const flatRow = (row: ChooserRow, ref?: (el: View | null) => void): React.ReactElement => (
    <CheckRow
      key={row.key}
      rowRef={ref}
      title={row.title}
      detail={minutesLine(row)}
      checked={rowCheck(chosen, row)}
      disabled={pressRow(chosen, row, groups) === null}
      onToggle={() => choose(pressRow(chosen, row, groups))}
      testID={`presenter-chooser-row-${row.key}`}
    />
  );

  const paged = (rows: readonly ChooserRow[], which: 'stories' | 'topics'): React.ReactElement => {
    const shown = Math.min(rows.length, state.more[which]);
    const rest = rows.length - shown;
    return (
      <View style={{ gap: spacing.xs }}>
        {rows.slice(0, shown).map((row) =>
          flatRow(row, (el) => {
            rowRefs.current.set(row.key, el);
          }),
        )}
        {rest > 0 ? (
          <View style={{ alignItems: 'flex-start', paddingTop: spacing.xs }}>
            <HomeButton
              label={m.showMore(Math.min(CHOOSER_PAGE, rest))}
              compact
              icon="plus"
              onPress={() => {
                onState({ more: { ...state.more, [which]: shown + CHOOSER_PAGE } });
                setFocusKey(rows[shown]!.key);
              }}
              testID={`presenter-chooser-more-${which}`}
            />
          </View>
        ) : null}
      </View>
    );
  };

  const episodeRow = (row: ChooserEpisodeRow): React.ReactElement => {
    const open = state.expanded.includes(row.key);
    const listId = `presenter-chooser-lessons-${row.key.replace(/[^a-z0-9-]/g, '-')}`;
    const locked = lessonLocked(chosen, row);
    return (
      <View key={row.key} style={{ gap: spacing.xs }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch', gap: spacing.xs }}>
          <CheckRow
            title={row.title}
            detail={quick.minutes(row.minutes)}
            checked={rowCheck(chosen, row)}
            disabled={pressRow(chosen, row, groups) === null}
            onToggle={() => choose(pressRow(chosen, row, groups))}
            basis={basis}
            testID={`presenter-chooser-row-${row.key}`}
          />
          <HomeButton
            label={m.lessonsIn(row.lessons.length)}
            compact
            icon={open ? 'dash' : 'plus'}
            expanded={open}
            controls={listId}
            onPress={() => onState({ expanded: open ? state.expanded.filter((k) => k !== row.key) : [...state.expanded, row.key] })}
            testID={`presenter-chooser-inside-${row.key}`}
          />
        </View>
        <View
          nativeID={listId}
          {...{ id: listId }}
          style={open ? { marginLeft: spacing.lg, paddingLeft: spacing.md, borderLeftWidth: borderWidth.thin, borderLeftColor: colors.border.subtle, gap: spacing.xs } : { display: 'none' }}
        >
          {open
            ? row.lessons.map((lesson) => (
                <CheckRow
                  key={lesson.key}
                  title={lesson.title}
                  detail={quick.minutes(lesson.minutes)}
                  checked={lessonChosen(chosen, row, lesson.key) ? 'true' : 'false'}
                  disabled={locked || pressLesson(chosen, row, lesson.key, groups) === null}
                  onToggle={() => choose(pressLesson(chosen, row, lesson.key, groups))}
                  testID={`presenter-chooser-lesson-${lesson.key}`}
                />
              ))
            : null}
        </View>
      </View>
    );
  };

  let panel: React.ReactElement | null = null;
  if (tab === 'lessons') {
    const group = stageGroups.find((g) => g.id === stage);
    panel = (
      <View style={{ gap: spacing.sm }}>
        <Line primary bold>
          {messages.learner.presenter.presets.stage.choose}
        </Line>
        <ChipGroup
          label={messages.learner.presenter.presets.stage.choose}
          options={stageIds}
          value={stage}
          onChange={(s) => onState({ chooserStage: s })}
          name={(s) => messages.learner.presenter.presets.stage.chip(stageNumber(s))}
          testID="presenter-chooser-stage"
        />
        <View style={{ gap: spacing.xs }}>{(group?.rows ?? []).flatMap((row) => (row.kind === 'episode' ? [episodeRow(row)] : []))}</View>
      </View>
    );
  } else if (tab === 'stories') panel = paged(stories, 'stories');
  else if (tab === 'topics') panel = paged(topics, 'topics');
  else panel = <View style={{ gap: spacing.xs }}>{letters.map((row) => flatRow(row))}</View>;

  const names: Record<ChooserTab, string> = { lessons: m.tab.lessons, stories: m.tab.stories, topics: m.tab.words, letters: m.tab.letters };
  const status = chosen.length === 0 || tray.length === 0 ? quick.nothing : full ? `${m.summary(tray.length, minutes)} ${quick.full}` : m.summary(tray.length, minutes);
  const sticky = { position: 'sticky', bottom: 0 } as unknown as ViewStyle;

  return (
    <View testID="presenter-home-quick" style={{ gap: spacing.md }}>
      <Line primary bold>
        {m.label}
      </Line>
      <ChooserTabs tabs={tabs} value={tab} label={m.label} names={names} onChange={(t) => onState({ tab: t })} />
      <View role="tabpanel" nativeID="presenter-chooser-panel" {...{ id: 'presenter-chooser-panel', 'aria-labelledby': `presenter-chooser-tab-${tab}` }} testID={`presenter-chooser-panel-${tab}`}>
        {panel}
      </View>
      <View style={{ gap: spacing.sm }} testID="presenter-chooser-tray">
        <Text {...KOREAN_LINE_BREAK} ref={trayHeading} role="heading" aria-level={3} {...{ tabIndex: -1 }} style={text(ts.body, 'bold', colors.text.primary)}>
          {m.tray.title}
        </Text>
        {tray.length === 0 ? (
          <Text
            {...KOREAN_LINE_BREAK}
            testID="presenter-chooser-tray-empty"
            style={{ ...text(ts.body, 'regular', colors.text.secondary), padding: spacing.md, borderWidth: borderWidth.base, borderStyle: 'dashed', borderColor: colors.border.strong, borderRadius: radii.md }}
          >
            {m.tray.empty}
          </Text>
        ) : (
          <View role="list" style={{ gap: spacing.xs }}>
            {tray.map((item, i) => (
              <View
                key={item.key}
                role="listitem"
                testID={`presenter-chooser-tray-${item.key}`}
                style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface.sunken, borderRadius: radii.md, paddingVertical: spacing.xs, paddingLeft: spacing.md, paddingRight: spacing.xs }}
              >
                <Text {...KOREAN_LINE_BREAK} style={text(ts.body, 'bold', colors.text.primary)}>
                  {String(i + 1)}
                </Text>
                <Text {...KOREAN_LINE_BREAK} style={{ ...text(ts.body, 'regular', colors.text.primary), flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: basis / 2 }}>
                  {item.title}
                </Text>
                <Text {...KOREAN_LINE_BREAK} style={text(ts.body, 'regular', colors.text.secondary)}>
                  {quick.minutes(choiceMinutes(item.key, groups))}
                </Text>
                <Pressable
                  role="button"
                  aria-label={messages.a11y.presenter.chooserRemove(item.title)}
                  ref={(el) => {
                    removeRefs.current.set(item.key, el);
                  }}
                  onPress={() => {
                    const keys = tray.map((t) => t.key);
                    setFocusAfterRemove({ target: keys[i + 1] ?? keys[i - 1] ?? null });
                    onState({ chosen: removeChoice(chosen, item.key) });
                  }}
                  testID={`presenter-chooser-remove-${item.key}`}
                  style={({ focused }: Focusable) => ({
                    width: touchTarget.min,
                    height: touchTarget.min,
                    borderRadius: radii.circle,
                    borderWidth: borderWidth.base,
                    borderColor: colors.border.strong,
                    backgroundColor: colors.surface.paper,
                    alignItems: 'center',
                    justifyContent: 'center',
                    ...ring(focused),
                  })}
                >
                  <Icon name="close" size={spacing.xl} color={colors.text.primary} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </View>
      {/* The sticky footer: it stays at the bottom of the window while Customize scrolls (`presets-customize-footer-*`). */}
      <View
        testID="presenter-chooser-footer"
        style={{
          ...sticky,
          zIndex: z.sticky,
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.md,
          paddingTop: spacing.md,
          paddingBottom: spacing.md + insets.bottom,
          borderTopWidth: borderWidth.thin,
          borderTopColor: colors.border.subtle,
          backgroundColor: colors.surface.paper,
        }}
      >
        <Text {...KOREAN_LINE_BREAK} role="status" aria-live="polite" testID="presenter-home-chosen" style={{ ...text(ts.body, 'regular', colors.text.primary), flexShrink: 1 }}>
          {status}
        </Text>
        <HomeButton label={quick.build.cta} onPress={onBuild} primary disabled={tray.length === 0} testID="presenter-home-build" />
      </View>
    </View>
  );
}

