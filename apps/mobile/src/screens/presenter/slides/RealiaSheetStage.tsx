import {
  Icon,
  REALIA_BOARD_WIDTH,
  REALIA_DRESSINGS,
  REALIA_REGISTRY,
  REALIA_STUB,
  borderWidth,
  colors,
  drawProp,
  presenter,
  radii,
  realiaBaseKind,
  realiaGoodsRef,
  realiaLineLook,
  realiaPaper,
  spacing,
  touchTarget,
  typography,
  KOREAN_LINE_BREAK,
  type DrawItem,
} from '@hangul-route/design-system';
import type { RealiaKindDressing, RealiaKindLook } from '@hangul-route/design-system/src/components/RealiaSheet/kinds-style';
import type { ReactElement, ReactNode, ComponentType } from 'react';
import { Text, View, type ViewStyle } from 'react-native';
import { Svg, Circle, Ellipse, Line, Path, Polygon, Rect } from 'react-native-svg';
import type { RealiaSheetView, SheetText } from '../../../logic/lecture/build-steps';
import { sheetRoomy } from '../../../logic/lecture/slide-view';
import { units } from '../../../logic/lecture/stage-constants';
import { useRealiaKinds } from '../../minigames/realia-kinds-entry';
import { STAGE_BORDER_MIN } from '../stage-metrics';
import { TaughtKo, usePresenterView, useStageText } from '../presenter-context';

/**
 * A realia sheet on the stage (design/screens/presenter/slide-realia.md "The sheet on the stage";
 * F-CURR-001 G-2): the anatomy of the design system's `RealiaSheet` for each kind (menu, ticket,
 * trail sign, price cards and the plain sheet), with its looks (`realiaPaper`, `REALIA_DRESSINGS`)
 * and its dressing art (`drawProp` over `REALIA_REGISTRY`), drawn in stage units at the
 * presenter's text sizes: Korean at `presenter.size.body` (the title at `presenter.size.prompt`)
 * with its romanization at `presenter.size.caption`. `RealiaSheet` itself is the learner's control
 * (each line a button sized to the learner's text); on the stage nothing takes input (section 5.3),
 * so the lines are text. The dressing is decorative and hidden; the sheet is one group named by its
 * own accessible text (`altEn`, F-CURR-001 §3.14). A sheet of more than four lines draws each
 * romanization beside its Korean (`sheetRoomy`), so a five-board trail sign fits.
 *
 * On a realia question (LV-S2, design V7) the sheet stays beside the question, and at the answer
 * build the line that holds the answer gets RealiaSheet's `found` look (`realiaLineLook`: the
 * `feedback.successLight` ground, a thick `feedback.success` border and the `check` glyph in
 * `feedback.successDark`), named "Hoya's answer". Every line keeps a transparent border of that
 * width from the start, so marking one moves nothing but that line's own text.
 *
 * `tight` (a realia question whose sheet is taller than the stage's content area, measured by the
 * slide: the found line's glyph can wrap its value onto one more row, and a wider fallback font for
 * the romanization can wrap a line before that) draws the same lines at the same width with less
 * room around them: the dressing strip at `spacing.sm` units, the paper's top and bottom padding and
 * the gaps between lines at `spacing.xxs` or none. Nothing gets narrower, so no line wraps anew.
 */

/** A realia question's answer line (`entryId`) and whether its answer build is reached. */
export interface SheetAnswer {
  entryId?: string | undefined;
  shown: boolean;
}

/** The realia kinds chunk: the CM-47 looks and dressings, reached through `useRealiaKinds`. */
type RealiaKinds = NonNullable<ReturnType<typeof useRealiaKinds>>;

/** A top dressing taller than a strip (a map's park) draws taller on the stage too. */
const REALIA_STRIP_UNITS = spacing.xxxl;

const TAGS = { rect: Rect, circle: Circle, ellipse: Ellipse, line: Line, path: Path, polygon: Polygon } as const;
const hidden = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const, 'aria-hidden': true };

export function RealiaSheetStage({ sheet, rom, width, answer, tight = false }: { sheet: RealiaSheetView; rom: boolean; width: number; answer?: SheetAnswer; tight?: boolean }): ReactElement {
  const { unit } = usePresenterView();
  const mark = (id: string): Mark | undefined => (answer === undefined ? undefined : answer.shown && answer.entryId === id ? 'found' : 'none');
  const roomy = sheetRoomy(sheet);
  // A CM-47 kind is drawn from the realia kinds chunk once it is in; before (or if it cannot load), as the plain sheet.
  const kind = realiaBaseKind(sheet.kind);
  const kinds = useRealiaKinds(kind !== sheet.kind);
  if (kinds !== null && kind !== sheet.kind) {
    return <KindSheet sheet={sheet} kinds={kinds} look={kinds.REALIA_KIND_LOOKS[sheet.kind as keyof typeof kinds.REALIA_KIND_LOOKS]} rom={rom} width={width} mark={mark} roomy={roomy} tight={tight} />;
  }
  const paper = realiaPaper(kind);
  const dressing = REALIA_DRESSINGS[kind];
  const line = Math.max(STAGE_BORDER_MIN, units(unit, borderWidth.base));
  const box: ViewStyle = { backgroundColor: paper.backgroundColor, borderColor: paper.borderColor, borderWidth: line, borderRadius: units(unit, paper.borderRadius) };
  const strip = units(unit, tight ? spacing.sm : spacing.xl);
  // Tight: the same widths, less height (the paper's top and bottom padding, the gaps between lines).
  const padTB = units(unit, tight ? spacing.xxs : spacing.md);
  const rowGap = tight ? 0 : units(unit, spacing.xs);
  const innerGap = units(unit, tight ? spacing.xxs : spacing.sm);
  const rows = (
    <View role="list" style={{ gap: rowGap }}>
      {sheet.entries.map((entry) => (
        <View role="listitem" key={entry.id}>
          <Marked mark={mark(entry.id)}>
            <SheetLine text={entry.text} value={entry.value} rom={rom} roomy={roomy} />
          </Marked>
        </View>
      ))}
    </View>
  );
  const title = sheet.heading ? <Heading text={sheet.heading} rom={rom} centered={sheet.kind !== 'ticket'} /> : null;

  let body: ReactElement;
  switch (kind) {
    case 'ticket':
      body = (
        <View style={{ ...box, flexDirection: 'row', overflow: 'hidden' }}>
          <View style={{ flex: 1 }}>
            <View style={{ backgroundColor: colors.brand.secondaryLight, borderBottomWidth: line, borderColor: paper.borderColor }}>
              {dressing.top ? <Dressing refId={dressing.top} height={strip} stretch={false} /> : null}
            </View>
            <View style={{ paddingHorizontal: units(unit, spacing.md), paddingVertical: padTB, gap: innerGap }}>
              {title}
              {rows}
            </View>
          </View>
          <View {...hidden} style={{ width: units(unit, touchTarget.min), backgroundColor: colors.surface.sunken, borderLeftWidth: line, borderStyle: 'dashed', borderColor: colors.border.strong, justifyContent: 'center' }}>
            <Dressing refId={REALIA_STUB} height={units(unit, touchTarget.child)} stretch={false} width={units(unit, touchTarget.min)} centered />
          </View>
        </View>
      );
      break;
    case 'sign':
      body = (
        <View>
          {dressing.top ? <Dressing refId={dressing.top} height={strip} stretch /> : null}
          <View style={{ gap: innerGap }}>
            {/* The post runs behind the boards. */}
            <View {...hidden} style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: units(unit, spacing.md), marginLeft: -units(unit, spacing.md) / 2, backgroundColor: colors.text.secondary }} />
            {title ? <View style={{ ...box, alignSelf: 'center', paddingVertical: units(unit, spacing.xs), paddingHorizontal: units(unit, spacing.md) }}>{title}</View> : null}
            <View role="list" style={{ gap: innerGap }}>
              {sheet.entries.map((entry) => (
                <Board key={entry.id} dir={entry.dir} box={box} line={line}>
                  <Marked mark={mark(entry.id)}>
                    <SheetLine text={entry.text} value={entry.value} rom={rom} roomy={roomy} />
                  </Marked>
                </Board>
              ))}
            </View>
          </View>
        </View>
      );
      break;
    case 'price-card':
      body = (
        <View style={{ backgroundColor: colors.surface.sunken, borderColor: colors.border.strong, borderWidth: line, borderRadius: units(unit, radii.md), paddingHorizontal: units(unit, spacing.md), paddingVertical: padTB, gap: innerGap }}>
          {title}
          <View role="list" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: units(unit, spacing.md) }}>
            {sheet.entries.map((entry) => (
              <View role="listitem" key={entry.id} style={{ flexGrow: 1, flexBasis: 0, minWidth: units(unit, touchTarget.hero) }}>
                {entry.goods ? <Dressing refId={realiaGoodsRef(entry.goods)} height={units(unit, spacing.xxxl)} stretch={false} centered /> : null}
                <View style={{ ...box, padding: units(unit, spacing.xs) }}>
                  <Marked mark={mark(entry.id)} corner>
                    <SheetLine text={entry.text} value={entry.value} rom={rom} roomy stack />
                  </Marked>
                </View>
              </View>
            ))}
          </View>
        </View>
      );
      break;
    default:
      // A menu, and the plain sheet for a realia with no known kind (the same lines on paper, never blank).
      body = (
        <View>
          {dressing.top ? <Dressing refId={dressing.top} height={strip} stretch /> : null}
          <View style={{ ...box, paddingHorizontal: units(unit, spacing.md), paddingVertical: padTB, gap: tight ? 0 : units(unit, spacing.xs) }}>
            {title}
            {rows}
          </View>
        </View>
      );
  }
  return (
    <View testID="presenter-realia-sheet" role="group" aria-label={sheet.alt} accessibilityLabel={sheet.alt} style={{ width }}>
      {body}
    </View>
  );
}

/** The sheet's title: its Korean at `presenter.size.prompt`, its romanization beside it. */
function Heading({ text, rom, centered }: { text: SheetText; rom: boolean; centered: boolean }): ReactElement {
  const { unit } = usePresenterView();
  const size = useStageText();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: centered ? 'center' : 'flex-start', columnGap: units(unit, spacing.sm) }}>
      <TaughtKo size={size(presenter.size.prompt)}>{text.ko}</TaughtKo>
      <Rom text={text.romanization} on={rom} />
    </View>
  );
}

/**
 * A piece of the sheet: Korean at `presenter.size.body`, its romanization under it (roomy) or beside
 * it. A line's own text keeps its width (`shrink` false); its value gives way and wraps, so no word
 * spills out of its line on a narrow stage.
 */
function Piece({ text, rom, roomy, align, shrink = true }: { text: SheetText; rom: boolean; roomy: boolean; align: 'flex-start' | 'flex-end' | 'center'; shrink?: boolean }): ReactElement {
  const { unit } = usePresenterView();
  const size = useStageText();
  const give = shrink ? { flexShrink: 1, minWidth: 0 } : { flexShrink: 0 };
  return (
    <View style={roomy ? { alignItems: align, ...give } : { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: align, columnGap: units(unit, spacing.sm), ...give }}>
      <TaughtKo size={size(presenter.size.body)}>{text.ko}</TaughtKo>
      <Rom text={text.romanization} on={rom} align={align} />
    </View>
  );
}

function Rom({ text, on, align = 'flex-start' }: { text: string; on: boolean; align?: 'flex-start' | 'flex-end' | 'center' }): ReactElement {
  const size = useStageText();
  return (
    <Text
      {...KOREAN_LINE_BREAK}
      aria-hidden={!on}
      style={{
        fontSize: size(presenter.size.caption),
        lineHeight: Math.round(size(presenter.size.caption) * typography.leading.tight),
        fontWeight: typography.weight.semibold,
        color: colors.text.secondary,
        textAlign: align === 'flex-end' ? 'right' : align === 'center' ? 'center' : 'left',
        opacity: on ? 1 : 0,
      }}
    >
      {text}
    </Text>
  );
}

/** One line of the sheet: its text, a dotted leader and its value at the end of the row; on a price card, stacked and centred. */
function SheetLine({ text, value, rom, roomy, stack = false, leader = true }: { text: SheetText; value?: SheetText | undefined; rom: boolean; roomy: boolean; stack?: boolean; leader?: boolean }): ReactElement {
  const { unit } = usePresenterView();
  if (stack) {
    return (
      <View style={{ alignItems: 'center', gap: units(unit, spacing.xs) }}>
        <Piece text={text} rom={rom} roomy={roomy} align="center" />
        {value ? <Piece text={value} rom={rom} roomy={roomy} align="center" /> : null}
      </View>
    );
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', columnGap: units(unit, spacing.sm), paddingHorizontal: units(unit, spacing.sm) }}>
      <Piece text={text} rom={rom} roomy={roomy} align="flex-start" shrink={value === undefined} />
      {value ? (
        <>
          <View {...hidden} style={{ flexGrow: 1, minWidth: units(unit, spacing.lg), alignSelf: 'center', borderBottomWidth: leader ? Math.max(STAGE_BORDER_MIN, units(unit, borderWidth.base)) : 0, borderStyle: 'dotted', borderColor: colors.border.strong }} />
          <Piece text={value} rom={rom} roomy={roomy} align="flex-end" />
        </>
      ) : null}
    </View>
  );
}

/** A trail board: the line and its arrow cell, on the side it points to. */
function Board({ dir, box, line, children }: { dir?: 'left' | 'right' | undefined; box: ViewStyle; line: number; children: ReactNode }): ReactElement {
  const { unit } = usePresenterView();
  const right = dir !== 'left';
  const arrow = (
    <View {...hidden} style={{ width: units(unit, touchTarget.min), alignItems: 'center', justifyContent: 'center', borderColor: box.borderColor, ...(right ? { borderLeftWidth: line } : { borderRightWidth: line }) }}>
      <Icon name={right ? 'arrow-right' : 'arrow-left'} size={units(unit, spacing.xl)} color={colors.text.primary} />
    </View>
  );
  return (
    <View
      role="listitem"
      style={{
        ...box,
        width: dir === undefined ? '100%' : REALIA_BOARD_WIDTH,
        alignSelf: dir === 'left' ? 'flex-start' : dir === 'right' ? 'flex-end' : 'stretch',
        flexDirection: 'row',
      }}
    >
      {dir === 'left' ? arrow : null}
      <View style={{ flex: 1, paddingVertical: units(unit, spacing.xxs) }}>{children}</View>
      {dir === 'right' ? arrow : null}
    </View>
  );
}

/** One dressing prop, stretched to its box or kept at its aspect ratio (RealiaSheet's `Dressing`, in stage units). */
function Dressing({ refId, height, stretch, width, centered = false, registry = REALIA_REGISTRY }: { refId: string; height: number; stretch: boolean; width?: number; centered?: boolean; registry?: typeof REALIA_REGISTRY }): ReactElement | null {
  const drawn = drawProp(refId, registry);
  if (!drawn) return null;
  return (
    <View {...hidden} style={{ height, width: width ?? '100%' }}>
      <Svg width="100%" height="100%" viewBox={drawn.viewBox} preserveAspectRatio={stretch ? 'none' : centered ? 'xMidYMax meet' : 'xMinYMid meet'}>
        {drawn.items.map((item: DrawItem) => {
          if (item.tag === 'card') return null;
          const Tag = TAGS[item.tag] as ComponentType<Record<string, unknown>>;
          return <Tag key={item.key} {...item.geometry} {...item.paint} transform={item.transform} />;
        })}
      </Svg>
    </View>
  );
}

type Mark = 'found' | 'none';

/**
 * A line of a realia question's sheet: RealiaSheet's line look in stage units (`found` at the
 * answer build, else a transparent border of the same width), the `check` glyph before the found
 * line's text. A price card's stacked, centred line (`corner`) keeps its text where it was: the
 * glyph sits smaller in its top-left corner, over the card's margin. A realia page draws its lines
 * bare (`mark` absent).
 */
function Marked({ mark, corner = false, children }: { mark: Mark | undefined; corner?: boolean; children: ReactNode }): ReactElement {
  const { unit, messages } = usePresenterView();
  if (mark === undefined) return <>{children}</>;
  const look = realiaLineLook(mark);
  return (
    <View
      testID={mark === 'found' ? 'presenter-realia-found' : undefined}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: Math.max(STAGE_BORDER_MIN, units(unit, look.borderWidth)),
        borderColor: look.borderColor,
        borderStyle: look.borderStyle,
        borderRadius: units(unit, radii.sm),
        backgroundColor: look.backgroundColor,
      }}
    >
      {look.icon !== null ? (
        <View
          role="img"
          accessibilityLabel={messages.a11y.presenter.answerMark}
          style={corner ? { position: 'absolute', top: units(unit, spacing.xxs), left: units(unit, spacing.xxs), zIndex: 1 } : { paddingLeft: units(unit, spacing.xs) }}
        >
          <Icon name={look.icon.name} size={units(unit, corner ? spacing.xl : spacing.xxxl)} color={look.icon.color} />
        </View>
      ) : null}
      <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
    </View>
  );
}

/**
 * A sheet of one of the eight F-CURR-002 row CM-47 kinds on the stage (slide-realia.md "The CM-47 kinds"): the anatomy of
 * `RealiaKindSheet` (rows, tiles, a map legend, a poster) with its looks (`REALIA_KIND_LOOKS`) and dressings
 * (`REALIA_KIND_REGISTRY`), in stage units at the presenter's text sizes, the lines as text. `tight` changes what it
 * changes on the G-2 kinds: the top strip, the sheet's top and bottom padding, the gap after the title and between lines.
 */
function KindSheet({
  sheet,
  kinds,
  look,
  rom,
  width,
  mark,
  roomy,
  tight,
}: {
  sheet: RealiaSheetView;
  kinds: RealiaKinds;
  look: RealiaKindLook;
  rom: boolean;
  width: number;
  mark: (id: string) => Mark | undefined;
  roomy: boolean;
  tight: boolean;
}): ReactElement {
  const { unit } = usePresenterView();
  const size = useStageText();
  // A receipt's strip widens with its text as the sheet does (`sheetUnits`): on a small phone the 18 px floor draws the
  // text bigger than its units, and a cap in plain units would wrap its lines more than the other kinds'.
  const textScale = Math.max(1, size(presenter.size.caption) / (unit * presenter.size.caption));
  const maxWidth = look.maxWidth === undefined ? undefined : units(unit, Math.round(look.maxWidth * textScale));
  const line = Math.max(STAGE_BORDER_MIN, units(unit, borderWidth.base));
  const box: ViewStyle = {
    backgroundColor: look.paper.backgroundColor,
    borderColor: look.paper.borderColor,
    borderWidth: Math.max(STAGE_BORDER_MIN, units(unit, look.paper.borderWidth)),
    borderRadius: units(unit, look.paper.borderRadius),
    paddingHorizontal: units(unit, spacing.md),
    paddingVertical: units(unit, tight ? spacing.xxs : spacing.md),
    gap: units(unit, tight ? spacing.xxs : spacing.sm),
  };
  const rowGap = tight ? 0 : units(unit, spacing.xs);
  const heading = sheet.heading ? <Heading text={sheet.heading} rom={rom} centered={look.centeredTitle} /> : null;
  const entry = (e: RealiaSheetView['entries'][number], stack: boolean, corner = false): ReactElement => (
    <Marked mark={mark(e.id)} corner={corner}>
      <SheetLine text={e.text} value={e.value} rom={rom} roomy={stack || roomy} stack={stack} leader={look.leader} />
    </Marked>
  );

  let body: ReactElement;
  switch (look.anatomy) {
    case 'tiles':
      body = (
        <View style={box}>
          {heading}
          <View role="list" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: units(unit, spacing.sm) }}>
            {sheet.entries.map((e) => (
              <View
                role="listitem"
                key={e.id}
                style={{
                  flexGrow: 1,
                  flexBasis: 0,
                  minWidth: units(unit, look.tileMin ?? touchTarget.hero),
                  backgroundColor: kinds.REALIA_TILE.backgroundColor,
                  borderColor: kinds.REALIA_TILE.borderColor,
                  borderWidth: line,
                  borderRadius: units(unit, kinds.REALIA_TILE.borderRadius),
                  padding: units(unit, spacing.xs),
                }}
              >
                {entry(e, true, true)}
              </View>
            ))}
          </View>
        </View>
      );
      break;
    case 'poster':
      body = (
        <View style={box}>
          {heading}
          <View role="list" style={{ gap: rowGap }}>
            {sheet.entries.map((e) => (
              <View role="listitem" key={e.id}>
                {entry(e, true)}
              </View>
            ))}
          </View>
        </View>
      );
      break;
    case 'legend':
      body = (
        <View style={box}>
          {heading}
          <View role="list" style={{ gap: rowGap }}>
            {sheet.entries.map((e) => (
              <View role="listitem" key={e.id} style={{ flexDirection: 'row', alignItems: 'center', columnGap: units(unit, spacing.xs) }}>
                <View {...hidden}>
                  <Icon name="pin" size={units(unit, spacing.xl)} color={colors.text.secondary} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>{entry(e, false)}</View>
              </View>
            ))}
          </View>
        </View>
      );
      break;
    default:
      // Rows: a recipe card, a receipt, a label (its title over a thick rule), a timetable.
      body = (
        <View style={box}>
          {heading && sheet.kind === 'label' ? (
            <View style={{ borderBottomWidth: Math.max(STAGE_BORDER_MIN, units(unit, borderWidth.thick)), borderColor: look.paper.borderColor }}>{heading}</View>
          ) : (
            heading
          )}
          <View role="list">
            {sheet.entries.map((e, i) => {
              const rule = kinds.realiaRowRule(look, i);
              return (
                <View
                  role="listitem"
                  key={e.id}
                  style={{ borderTopWidth: rule.borderTopWidth > 0 ? Math.max(STAGE_BORDER_MIN, units(unit, rule.borderTopWidth)) : 0, borderStyle: rule.borderStyle, borderColor: rule.borderColor, paddingVertical: rowGap / 2 }}
                >
                  {entry(e, false)}
                </View>
              );
            })}
          </View>
        </View>
      );
  }
  const strip = (d: RealiaKindDressing): ReactElement => (
    <View style={d.band ? { backgroundColor: d.band } : undefined}>
      <Dressing
        refId={d.ref}
        height={units(unit, d.height > REALIA_STRIP_UNITS ? (tight ? spacing.xl : spacing.jumbo) : tight ? spacing.sm : spacing.xl)}
        stretch={d.stretch}
        centered={d.centered ?? false}
        registry={kinds.REALIA_KIND_REGISTRY}
      />
    </View>
  );
  return (
    <View testID="presenter-realia-sheet" role="group" aria-label={sheet.alt} accessibilityLabel={sheet.alt} style={{ width }}>
      <View testID={`presenter-realia-kind-${sheet.kind}`} style={{ width: '100%', maxWidth, alignSelf: 'center' }}>
        {look.top ? strip(look.top) : null}
        {body}
        {look.bottom ? <Dressing refId={look.bottom.ref} height={units(unit, spacing.sm)} stretch registry={kinds.REALIA_KIND_REGISTRY} /> : null}
      </View>
    </View>
  );
}
