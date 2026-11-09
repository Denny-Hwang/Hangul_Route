import {
  Body,
  Caption,
  Card,
  Icon,
  KOREAN_LANGUAGE,
  SectionTabs,
  Spacer,
  borderWidth,
  colors,
  radii,
  sectionTabId,
  spacing,
  touchTarget,
  typography,
  KOREAN_LINE_BREAK,
  useTypeScale,
} from '@hangul-route/design-system';
import type { ReportPeriod } from '@hangul-route/content-schema';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode, ReactElement, Ref } from 'react';
import { AccessibilityInfo, Platform, Pressable, Text, View } from 'react-native';
import { Svg, Polyline } from 'react-native-svg';
import type {
  InAppReportView,
  ReportCalendarView,
  ReportDetailBlock,
  ReportGrowthView,
  ReportLetterTile,
  ReportLineView,
  ReportSectionView,
  ReportSentence,
} from '../../logic/reports/report-view';
import { focusForScreenReader } from '../../platform/screen-reader';

/**
 * The learner report's blocks, data-agnostic (F-REPORT-001 section 3.9; F-AUTH-004 section 8.7, row NS-5 split them
 * out of `LearnerReportScreen.tsx`). Screen spec `design/screens/reports/in-app-report.md`, and for the native account
 * report `design/screens/account/account-reports.md`.
 *
 * `ReportView` draws one report view model (`InAppReportView`, `logic/reports/report-view.ts`) whatever it was built
 * from: the device's own summary (the in-app report, `LearnerReportScreen`) or the server's roster projection (the
 * native account report, `AccountLearnerReportScreen.native.tsx`). It owns only what the report's controls need to
 * read well (the More detail disclosure, the stepper's focus, the announcement after a change); the period, the step
 * and every action outside the report come from the screen. The in-app report's behaviour does not change: every
 * block, test id and accessible name is the one it drew before the split.
 */

/** The report below the tabs is their panel (`aria-controls` / `aria-labelledby`); the stepper controls it too. */
const PANEL_ID = 'learner-report-panel';
/** The More detail disclosure's panel (`aria-controls`). */
const DETAIL_PANEL_ID = 'learner-report-more-detail-panel';
/** Read by assistive tech, drawn nowhere (the 1 x 1 clipped box of the web sr-only pattern). */
const srOnly = { position: 'absolute', width: 1, height: 1, margin: -1, overflow: 'hidden' } as const;
/** Figure tiles: two a row on a phone (design README "Constants": 7rem). */
const FIGURE_TILE_MIN = 112;
/** The growth chart's drawing box (design README "Constants"): an SVG viewBox that scales to the column. */
const GROWTH_BOX = { width: 300, height: 150 } as const;
/** The cards line is dashed so the two lines differ by more than colour (section 3.12). */
const GROWTH_DASH = `${spacing.sm} ${spacing.xs}`;
/** One week of calendar columns. */
const WEEK_COLUMNS = 7;

// `lang`, `role` and `aria-*` are web-only props react-native-web forwards to the DOM; spread so the native props
// need no type for them (the SourcesParts pattern).
const koreanSpeech = { lang: KOREAN_LANGUAGE, accessibilityLanguage: KOREAN_LANGUAGE };
const headingLevel = (level: 1 | 2 | 3): Record<string, string | number> => ({ role: 'heading', 'aria-level': level });

export function ReportHeading({ level, children, testID }: { level: 1 | 2 | 3; children: ReactNode; testID?: string }): ReactElement {
  const textScale = useTypeScale();
  const size = level === 1 ? textScale.size.title : level === 2 ? textScale.size.prompt : textScale.size.body;
  return (
    <Text {...KOREAN_LINE_BREAK}
      {...headingLevel(level)}
      accessibilityRole="header"
      testID={testID}
      style={{ fontSize: size, lineHeight: size * typography.leading.normal, fontWeight: typography.weight.bold, color: colors.text.primary }}
    >
      {children}
    </Text>
  );
}

/**
 * LR-D's `link-button` (design README "Reused"): an outlined pill on paper, `touchTarget.min` tall, named by its
 * visible text. The report's quieter controls use it: Open Learning Route, the step buttons, the table toggle and,
 * full width and square-cornered, the More detail disclosure.
 */
export function OutlineButton({
  label,
  onPress,
  accessibilityLabel,
  leading,
  trailing,
  expanded,
  controls,
  block = false,
  pressableRef,
  testID,
}: {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  expanded?: boolean;
  /** The id of the region this button changes (web `aria-controls`). */
  controls?: string;
  block?: boolean;
  pressableRef?: Ref<View>;
  testID?: string;
}): ReactElement {
  const disclosure = {
    ...(expanded === undefined ? {} : { 'aria-expanded': expanded }),
    ...(controls === undefined ? {} : { 'aria-controls': controls }),
  };
  return (
    <Pressable
      ref={pressableRef}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={expanded === undefined ? undefined : { expanded }}
      {...disclosure}
      testID={testID}
      style={({ pressed }) => ({
        minHeight: touchTarget.min,
        minWidth: touchTarget.min,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: block ? 'space-between' : 'center',
        alignSelf: block ? 'stretch' : 'flex-start',
        gap: spacing.sm,
        paddingHorizontal: spacing.lg,
        borderRadius: block ? radii.md : radii.pill,
        borderWidth: borderWidth.base,
        borderColor: pressed ? colors.border.focus : colors.border.strong,
        backgroundColor: colors.surface.paper,
      })}
    >
      {leading}
      <Body weight="bold">{label}</Body>
      {trailing}
    </Pressable>
  );
}

/** The report's loading skeleton: three sunken bars, named for assistive tech, no data. */
export function ReportSkeleton({ label }: { label: string }): ReactElement {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} testID="learner-report-loading" style={{ gap: spacing.md }}>
      {[spacing.xxxl, spacing.jumbo, spacing.jumbo].map((height, k) => (
        <View key={k} style={{ height, borderRadius: radii.md, backgroundColor: colors.surface.sunken }} />
      ))}
    </View>
  );
}

export interface ReportViewProps {
  view: InAppReportView;
  /** The period shown (the calendar labels its cells by weekday on a week, by date on a month). */
  period: ReportPeriod;
  /** The polite announcement after a period change or a step (null on open: nothing is spoken then). */
  announce: string | null;
  onChoosePeriod: (period: ReportPeriod) => void;
  /** A step of the stepper, with the window it opens (`at`). */
  onStep: (at: string | null) => void;
  /** Open Learning Route, when the screen offers it (the in-app report); without it the glance draws no button. */
  onOpenRoute?: () => void;
  /** Drawn at the end of What to practice next (the in-app report's Preview lessons row on the web). */
  practiceNextFooter?: ReactNode;
  /** Drawn at the end of More detail (the in-app report's device-only skills rows). */
  detailFooter?: ReactNode;
}

/** One report, from its title to More detail (the screen wraps it in its `Screen`). */
export function ReportView({ view, period, announce, onChoosePeriod, onStep, onOpenRoute, practiceNextFooter, detailFooter }: ReportViewProps): ReactElement {
  const textScale = useTypeScale();
  const [detailOpen, setDetailOpen] = useState(false);
  const prevRef = useRef<View>(null);
  const nextRef = useRef<View>(null);
  const lastStep = useRef<'prev' | 'next' | null>(null);

  // A step that removes the pressed button (Next on reaching this window, Previous on the oldest) moves focus to the
  // other step button, so it never drops to the page body (design pass #444).
  const stepper = view.stepper;
  useEffect(() => {
    const step = lastStep.current;
    if (step === null) return;
    lastStep.current = null;
    const target = step === 'next' && stepper?.next === null ? prevRef.current : step === 'prev' && stepper?.prev === null ? nextRef.current : null;
    if (target === null) return;
    // A view's own focus() moves keyboard focus on the web; VoiceOver and TalkBack need their own call.
    if (Platform.OS === 'web') (target as unknown as { focus?: () => void }).focus?.();
    else focusForScreenReader(target);
  }, [stepper]);

  // The polite announcement after a period change or a step (section 3.12). The live region below speaks on the web
  // and on Android; VoiceOver does not read live regions, so iOS announces it (the ResultsScreen pattern).
  useEffect(() => {
    if (announce !== null && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(announce);
  }, [announce]);

  const step = (dir: 'prev' | 'next'): void => {
    const target = dir === 'prev' ? stepper?.prev : stepper?.next;
    if (!target) return;
    lastStep.current = dir;
    onStep(target.at);
  };

  const body = (
    <>
      {view.headline !== null ? (
        <>
          <Spacer size="md" />
          <Text {...KOREAN_LINE_BREAK} testID="learner-report-headline" style={{ fontSize: textScale.size.prompt, lineHeight: textScale.size.prompt * typography.leading.normal, fontWeight: typography.weight.bold, color: colors.text.primary }}>
            {view.headline.text}
          </Text>
          {view.headline.horizon !== null ? <Caption tone="muted">{view.headline.horizon}</Caption> : null}
        </>
      ) : null}
      {view.wentWell !== null ? <InsightSection section={view.wentWell} marker={colors.brand.primary} testID="learner-report-went-well" /> : null}
      {view.practiceNext !== null ? (
        <InsightSection section={view.practiceNext} marker={colors.border.shape} testID="learner-report-practice-next">
          {practiceNextFooter}
        </InsightSection>
      ) : null}
      {view.thisPeriod !== null ? (
        <View testID="learner-report-this-period">
          <Spacer size="lg" />
          <ReportHeading level={2}>{view.thisPeriod.heading}</ReportHeading>
          <Caption tone="muted" testID="learner-report-scope">
            {view.thisPeriod.scope}
          </Caption>
          <Spacer size="sm" />
          {view.thisPeriod.figures !== null ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {view.thisPeriod.figures.map((figure) => (
                <View
                  key={figure.key}
                  testID={`learner-report-figure-${figure.key}`}
                  style={{ flexGrow: 1, flexBasis: FIGURE_TILE_MIN, minWidth: FIGURE_TILE_MIN, padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.surface.paper, borderWidth: borderWidth.thin, borderColor: colors.border.subtle }}
                >
                  <Text {...KOREAN_LINE_BREAK} style={{ fontSize: textScale.size.title, lineHeight: textScale.size.title * typography.leading.tight, fontWeight: typography.weight.bold, color: colors.text.primary }}>{figure.count}</Text>
                  <Body size="sm" tone="secondary">
                    {figure.label}
                  </Body>
                  {figure.up !== null ? <Caption style={{ color: colors.feedback.successDark }}>{figure.up}</Caption> : null}
                </View>
              ))}
            </View>
          ) : null}
          {view.thisPeriod.calendar !== null ? <CalendarBlock calendar={view.thisPeriod.calendar} period={period} /> : null}
          {view.thisPeriod.growth !== null ? <GrowthBlock growth={view.thisPeriod.growth} /> : null}
        </View>
      ) : null}
      {view.moreDetail !== null ? (
        <View testID="learner-report-more-detail">
          <Spacer size="lg" />
          <View {...headingLevel(2)}>
            <OutlineButton
              label={view.moreDetail.button}
              block
              expanded={detailOpen}
              controls={DETAIL_PANEL_ID}
              onPress={() => setDetailOpen((open) => !open)}
              trailing={<View style={{ transform: [{ rotate: detailOpen ? '-90deg' : '90deg' }] }}><Icon name="arrow-right" size={20} /></View>}
              testID="learner-report-more-detail-toggle"
            />
          </View>
          <View nativeID={DETAIL_PANEL_ID} {...{ id: DETAIL_PANEL_ID }}>
            {detailOpen ? (
              <View style={{ gap: spacing.lg, paddingTop: spacing.md }}>
                {view.moreDetail.blocks.map((detail) => (
                  <DetailBlock key={'key' in detail ? detail.key : detail.kind} block={detail} />
                ))}
                {detailFooter}
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
    </>
  );

  return (
    <>
      <ReportHeading level={1} testID="learner-report-title">
        {view.title}
      </ReportHeading>
      {view.glance !== null ? (
        <View style={{ gap: spacing.xs, marginTop: spacing.xs }} testID="learner-report-glance">
          {view.glance.nowOn !== null ? <Body>{view.glance.nowOn}</Body> : null}
          {view.glance.openRoute !== null && onOpenRoute !== undefined ? <OutlineButton label={view.glance.openRoute} onPress={onOpenRoute} testID="learner-report-open-route" /> : null}
          {view.glance.lastPractice !== null ? <Caption tone="muted">{view.glance.lastPractice}</Caption> : null}
        </View>
      ) : null}
      {view.notices.length > 0 ? (
        <>
          <Spacer size="md" />
          <Card padding="md" tone="sunken" testID="learner-report-notices">
            {view.notices.map((line) => (
              <Body key={line}>{line}</Body>
            ))}
          </Card>
        </>
      ) : null}
      {view.tabs !== null ? (
        <>
          <Spacer size="md" />
          <SectionTabs items={view.tabs.items} value={view.tabs.value} onChange={onChoosePeriod} accessibilityLabel={view.tabs.label} panelId={PANEL_ID} testID="learner-report-tabs" />
          {stepper !== null ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm }}>
              {stepper.prev !== null ? (
                <OutlineButton
                  label={stepper.prev.label}
                  accessibilityLabel={stepper.prev.name}
                  leading={<Icon name="arrow-left" size={20} />}
                  onPress={() => step('prev')}
                  controls={PANEL_ID}
                  pressableRef={prevRef}
                  testID="learner-report-step-prev"
                />
              ) : null}
              <Body tone="secondary" testID="learner-report-range">
                {stepper.range}
              </Body>
              {stepper.next !== null ? (
                <OutlineButton
                  label={stepper.next.label}
                  accessibilityLabel={stepper.next.name}
                  trailing={<Icon name="arrow-right" size={20} />}
                  onPress={() => step('next')}
                  controls={PANEL_ID}
                  pressableRef={nextRef}
                  testID="learner-report-step-next"
                />
              ) : null}
            </View>
          ) : null}
          {/* A polite announcement after a period change or a step (section 3.12). */}
          <View style={srOnly} accessibilityLiveRegion="polite" {...{ 'aria-live': 'polite' }}>
            <Text {...KOREAN_LINE_BREAK}>{announce ?? ''}</Text>
          </View>
          <View {...{ role: 'tabpanel', id: PANEL_ID, 'aria-labelledby': sectionTabId(PANEL_ID, view.tabs.value) }}>{body}</View>
        </>
      ) : (
        body
      )}
    </>
  );
}

function SentenceText({ sentence }: { sentence: ReportSentence }): ReactElement {
  return (
    <Body>
      {sentence.parts.map((part, k) => {
        if (part.kind === 'text') return <Text {...KOREAN_LINE_BREAK} key={k}>{part.text}</Text>;
        if (part.kind === 'quest') return <Text {...KOREAN_LINE_BREAK} key={k}>{part.title}</Text>;
        return (
          <Text {...KOREAN_LINE_BREAK} key={k}>
            {part.before}
            <Text {...KOREAN_LINE_BREAK} {...koreanSpeech}>{part.letter}</Text>
            {part.after}
          </Text>
        );
      })}
    </Body>
  );
}

function InsightSection({ section, marker, testID, children }: { section: ReportSectionView; marker: string; testID: string; children?: ReactNode }): ReactElement {
  return (
    <View testID={testID}>
      <Spacer size="lg" />
      <ReportHeading level={2}>{section.heading}</ReportHeading>
      <Spacer size="xs" />
      <View accessibilityRole="list" style={{ gap: spacing.xs }}>
        {section.lines.map((line: ReportLineView, k) => (
          <View key={`${line.code}-${k}`} {...{ role: 'listitem' }} style={{ flexDirection: 'row', gap: spacing.sm }} testID={`${testID}-line-${k}`}>
            {/* A small disc marks each line: never a check or a star that would grade (design pass). */}
            <View style={{ width: spacing.sm, height: spacing.sm, borderRadius: radii.circle, backgroundColor: marker, marginTop: spacing.sm + spacing.xxs }} />
            <View style={{ flex: 1 }}>
              <SentenceText sentence={line.sentence} />
              {line.tip !== null ? (
                <Body size="sm" tone="secondary">
                  {line.tip}
                </Body>
              ) : null}
            </View>
          </View>
        ))}
      </View>
      {children}
    </View>
  );
}

function CalendarBlock({ calendar, period }: { calendar: ReportCalendarView; period: ReportPeriod }): ReactElement {
  const cells: (ReportCalendarView['cells'][number] | null)[] = [...Array.from({ length: calendar.lead }, () => null), ...calendar.cells];
  const columnWidth = `${100 / WEEK_COLUMNS}%` as const;
  return (
    <View testID="learner-report-calendar" style={{ marginTop: spacing.md }}>
      {/* The sentence below says the same in words; the marks are hidden from screen readers. */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" {...{ 'aria-hidden': true }}>
        {cells.map((cell, k) => (
          <View key={cell?.day ?? `lead-${k}`} style={{ width: columnWidth, alignItems: 'center', paddingVertical: spacing.xxs }}>
            {cell === null ? null : (
              <>
                <Caption tone="secondary">{period === 'week' ? cell.weekday : String(cell.date)}</Caption>
                {period === 'week' ? <Caption tone="muted">{String(cell.date)}</Caption> : null}
                <View
                  testID={`learner-report-day-${cell.day}`}
                  style={{
                    width: '86%',
                    maxWidth: spacing.xxxl,
                    aspectRatio: 1,
                    borderRadius: radii.sm,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: cell.kind === 'practiced' ? colors.brand.secondary : colors.surface.paper,
                    borderWidth: borderWidth.base,
                    borderColor: cell.kind === 'practiced' ? colors.brand.secondary : colors.border.shape,
                  }}
                >
                  {cell.kind === 'practiced' ? <Icon name="check" size={20} color={colors.text.onSecondary} /> : null}
                </View>
              </>
            )}
          </View>
        ))}
      </View>
      <Spacer size="xs" />
      <Body size="sm" tone="secondary" testID="learner-report-calendar-sentence">
        {calendar.sentence}
      </Body>
    </View>
  );
}

function GrowthBlock({ growth }: { growth: ReportGrowthView }): ReactElement {
  const [tableOpen, setTableOpen] = useState(false);
  const count = growth.rows.length;
  // Points sit at the centres of equal columns, so a month label sits under its point (design README).
  const point = (k: number, value: number): string =>
    `${((k + 0.5) / Math.max(1, count)) * GROWTH_BOX.width},${GROWTH_BOX.height - (value / growth.max) * (GROWTH_BOX.height - spacing.lg) - spacing.xs}`;
  const line = (key: 'quests' | 'cards'): string => growth.rows.map((row, k) => point(k, row[key])).join(' ');
  const legend = (label: string, color: string, dashed: boolean): ReactElement => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
      <View style={{ width: spacing.xl, height: 0, borderTopWidth: borderWidth.thick, borderStyle: dashed ? 'dashed' : 'solid', borderColor: color }} />
      <Caption tone="secondary">{label}</Caption>
    </View>
  );
  const table = (
    <View accessibilityLabel={growth.caption} testID="learner-report-growth-table" style={{ gap: spacing.xxs }}>
      <View style={{ flexDirection: 'row' }}>
        {[growth.month, growth.quests, growth.cards].map((head) => (
          <Body key={head} weight="bold" size="sm" style={{ flex: 1 }}>
            {head}
          </Body>
        ))}
      </View>
      {growth.rows.map((row) => (
        <View key={row.m} style={{ flexDirection: 'row' }}>
          <Body size="sm" style={{ flex: 1 }}>
            {row.label}
          </Body>
          <Body size="sm" style={{ flex: 1 }}>
            {String(row.quests)}
          </Body>
          <Body size="sm" style={{ flex: 1 }}>
            {String(row.cards)}
          </Body>
        </View>
      ))}
    </View>
  );
  return (
    <View testID="learner-report-growth" style={{ marginTop: spacing.md, gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        {legend(growth.quests, colors.brand.primary, false)}
        {legend(growth.cards, colors.brand.secondary, true)}
      </View>
      {count > 0 ? (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" {...{ 'aria-hidden': true }}>
          <Svg width="100%" height={GROWTH_BOX.height} viewBox={`0 0 ${GROWTH_BOX.width} ${GROWTH_BOX.height}`} preserveAspectRatio="none">
            {/* The box stretches to the column; strokes keep their width and dash length (non-scaling-stroke). */}
            <Polyline points={line('quests')} fill="none" stroke={colors.brand.primary} strokeWidth={borderWidth.thick} vectorEffect="non-scaling-stroke" />
            <Polyline
              points={line('cards')}
              fill="none"
              stroke={colors.brand.secondary}
              strokeWidth={borderWidth.thick}
              strokeDasharray={GROWTH_DASH}
              vectorEffect="non-scaling-stroke"
            />
          </Svg>
          <View style={{ flexDirection: 'row' }}>
            {growth.rows.map((row) => (
              <Caption key={row.m} tone="muted" style={{ flex: 1, textAlign: 'center' }}>
                {row.label}
              </Caption>
            ))}
          </View>
        </View>
      ) : null}
      {growth.since !== null ? <Body size="sm" tone="secondary">{growth.since}</Body> : null}
      {count > 0 ? (
        <>
          <View style={{ alignItems: 'flex-start' }}>
            <OutlineButton label={tableOpen ? growth.hideTable : growth.showTable} expanded={tableOpen} onPress={() => setTableOpen((open) => !open)} testID="learner-report-growth-toggle" />
          </View>
          {/* The table is the line's text alternative: visible when opened, read by screen readers always. */}
          {tableOpen ? table : <View style={srOnly}>{table}</View>}
        </>
      ) : null}
    </View>
  );
}

function DetailBlock({ block }: { block: ReportDetailBlock }): ReactElement {
  if (block.kind === 'totals') return <Body testID="learner-report-detail-totals">{block.line}</Body>;
  if (block.kind === 'letters') {
    return (
      <>
        <LetterTiles heading={block.heading} tiles={block.tiles} id={block.key} />
        {block.moreLine !== null ? <Body testID={`learner-report-letters-more-${block.key}`}>{block.moreLine}</Body> : null}
      </>
    );
  }
  return (
    <View testID={`learner-report-detail-${block.key}`}>
      <ReportHeading level={3}>{block.heading}</ReportHeading>
      {block.lines.map((line) => (
        <Body key={line}>{line}</Body>
      ))}
    </View>
  );
}

/**
 * Letter tiles that expand (design: "a letter tile tapped"): each tile is a disclosure button named by its visible
 * letter and romanization; the expansion under the row shows the letter large with its content romanization and gloss.
 */
function LetterTiles({ heading, tiles, id }: { heading: string; tiles: ReportLetterTile[]; id: string }): ReactElement {
  const textScale = useTypeScale();
  const [open, setOpen] = useState<string | null>(null);
  const expansionId = `learner-report-letters-${id}-detail`;
  const opened = tiles.find((tile) => tile.letter === open) ?? null;
  return (
    <View testID={`learner-report-detail-${id}`}>
      <ReportHeading level={3}>{heading}</ReportHeading>
      <Spacer size="xs" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {tiles.map((tile) => {
          const expanded = tile.letter === open;
          return (
            <Pressable
              key={tile.letter}
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              {...{ 'aria-expanded': expanded, 'aria-controls': expansionId }}
              onPress={() => setOpen(expanded ? null : tile.letter)}
              testID={`learner-report-tile-${id}-${tile.letter}`}
              style={{
                // At least a touch target, and free to grow so large text never clips the romanization (section 3.12).
                minWidth: touchTarget.min,
                minHeight: touchTarget.min,
                paddingHorizontal: spacing.xs,
                paddingVertical: spacing.xs,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radii.md,
                backgroundColor: colors.surface.paper,
                borderWidth: expanded ? borderWidth.base : borderWidth.thin,
                borderColor: expanded ? colors.brand.primary : colors.border.strong,
              }}
            >
              <Text {...KOREAN_LINE_BREAK} {...koreanSpeech} style={{ fontSize: textScale.size.prompt, color: colors.text.primary }}>
                {tile.letter}
              </Text>
              {tile.romanization !== null ? <Caption tone="secondary">{tile.romanization}</Caption> : null}
            </Pressable>
          );
        })}
      </View>
      <View nativeID={expansionId} {...{ id: expansionId }}>
        {opened !== null ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm, padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.surface.sunken }} testID={`learner-report-tile-detail-${id}`}>
            <Text {...KOREAN_LINE_BREAK} {...koreanSpeech} style={{ fontSize: textScale.size.display, color: colors.text.primary }}>
              {opened.letter}
            </Text>
            <View style={{ flex: 1 }}>
              {opened.detail !== null ? (
                <>
                  <Body weight="bold">{opened.detail.romanization}</Body>
                  {opened.detail.gloss !== null ? <Body tone="muted">{opened.detail.gloss}</Body> : null}
                </>
              ) : opened.romanization !== null ? (
                <Body weight="bold">{opened.romanization}</Body>
              ) : null}
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}
