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
  realiaGoodsRef,
  realiaPaper,
  spacing,
  touchTarget,
  typography,
  KOREAN_LINE_BREAK,
  type DrawItem,
} from '@hangul-route/design-system';
import React from 'react';
import { Text, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Ellipse, Line, Path, Polygon, Rect } from 'react-native-svg';
import type { RealiaSheetView, SheetText } from '../../../logic/lecture/build-steps';
import { sheetRoomy } from '../../../logic/lecture/slide-view';
import { units } from '../../../logic/lecture/stage-constants';
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
 */

const TAGS = { rect: Rect, circle: Circle, ellipse: Ellipse, line: Line, path: Path, polygon: Polygon } as const;
const hidden = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const, 'aria-hidden': true };

export function RealiaSheetStage({ sheet, rom, width }: { sheet: RealiaSheetView; rom: boolean; width: number }): React.ReactElement {
  const { unit } = usePresenterView();
  const roomy = sheetRoomy(sheet);
  const paper = realiaPaper(sheet.kind);
  const dressing = REALIA_DRESSINGS[sheet.kind];
  const line = Math.max(STAGE_BORDER_MIN, units(unit, borderWidth.base));
  const box: ViewStyle = { backgroundColor: paper.backgroundColor, borderColor: paper.borderColor, borderWidth: line, borderRadius: units(unit, paper.borderRadius) };
  const strip = units(unit, spacing.xl);
  const rows = (
    <View role="list" style={{ gap: units(unit, spacing.xs) }}>
      {sheet.entries.map((entry) => (
        <View role="listitem" key={entry.id}>
          <SheetLine text={entry.text} value={entry.value} rom={rom} roomy={roomy} />
        </View>
      ))}
    </View>
  );
  const title = sheet.heading ? <Heading text={sheet.heading} rom={rom} centered={sheet.kind !== 'ticket'} /> : null;

  let body: React.ReactElement;
  switch (sheet.kind) {
    case 'ticket':
      body = (
        <View style={{ ...box, flexDirection: 'row', overflow: 'hidden' }}>
          <View style={{ flex: 1 }}>
            <View style={{ backgroundColor: colors.brand.secondaryLight, borderBottomWidth: line, borderColor: paper.borderColor }}>
              {dressing.top ? <Dressing refId={dressing.top} height={strip} stretch={false} /> : null}
            </View>
            <View style={{ padding: units(unit, spacing.md), gap: units(unit, spacing.sm) }}>
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
          <View style={{ gap: units(unit, spacing.sm) }}>
            {/* The post runs behind the boards. */}
            <View {...hidden} style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: units(unit, spacing.md), marginLeft: -units(unit, spacing.md) / 2, backgroundColor: colors.text.secondary }} />
            {title ? <View style={{ ...box, alignSelf: 'center', paddingVertical: units(unit, spacing.xs), paddingHorizontal: units(unit, spacing.md) }}>{title}</View> : null}
            <View role="list" style={{ gap: units(unit, spacing.sm) }}>
              {sheet.entries.map((entry) => (
                <Board key={entry.id} dir={entry.dir} box={box} line={line}>
                  <SheetLine text={entry.text} value={entry.value} rom={rom} roomy={roomy} />
                </Board>
              ))}
            </View>
          </View>
        </View>
      );
      break;
    case 'price-card':
      body = (
        <View style={{ backgroundColor: colors.surface.sunken, borderColor: colors.border.strong, borderWidth: line, borderRadius: units(unit, radii.md), padding: units(unit, spacing.md), gap: units(unit, spacing.sm) }}>
          {title}
          <View role="list" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: units(unit, spacing.md) }}>
            {sheet.entries.map((entry) => (
              <View role="listitem" key={entry.id} style={{ flexGrow: 1, flexBasis: 0, minWidth: units(unit, touchTarget.hero) }}>
                {entry.goods ? <Dressing refId={realiaGoodsRef(entry.goods)} height={units(unit, spacing.xxxl)} stretch={false} centered /> : null}
                <View style={{ ...box, padding: units(unit, spacing.xs) }}>
                  <SheetLine text={entry.text} value={entry.value} rom={rom} roomy stack />
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
          <View style={{ ...box, padding: units(unit, spacing.md), gap: units(unit, spacing.xs) }}>
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
function Heading({ text, rom, centered }: { text: SheetText; rom: boolean; centered: boolean }): React.ReactElement {
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
function Piece({ text, rom, roomy, align, shrink = true }: { text: SheetText; rom: boolean; roomy: boolean; align: 'flex-start' | 'flex-end' | 'center'; shrink?: boolean }): React.ReactElement {
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

function Rom({ text, on, align = 'flex-start' }: { text: string; on: boolean; align?: 'flex-start' | 'flex-end' | 'center' }): React.ReactElement {
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
function SheetLine({ text, value, rom, roomy, stack = false }: { text: SheetText; value?: SheetText | undefined; rom: boolean; roomy: boolean; stack?: boolean }): React.ReactElement {
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
          <View {...hidden} style={{ flexGrow: 1, minWidth: units(unit, spacing.lg), alignSelf: 'center', borderBottomWidth: Math.max(STAGE_BORDER_MIN, units(unit, borderWidth.base)), borderStyle: 'dotted', borderColor: colors.border.strong }} />
          <Piece text={value} rom={rom} roomy={roomy} align="flex-end" />
        </>
      ) : null}
    </View>
  );
}

/** A trail board: the line and its arrow cell, on the side it points to. */
function Board({ dir, box, line, children }: { dir?: 'left' | 'right' | undefined; box: ViewStyle; line: number; children: React.ReactNode }): React.ReactElement {
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
function Dressing({ refId, height, stretch, width, centered = false }: { refId: string; height: number; stretch: boolean; width?: number; centered?: boolean }): React.ReactElement | null {
  const drawn = drawProp(refId, REALIA_REGISTRY);
  if (!drawn) return null;
  return (
    <View {...hidden} style={{ height, width: width ?? '100%' }}>
      <Svg width="100%" height="100%" viewBox={drawn.viewBox} preserveAspectRatio={stretch ? 'none' : centered ? 'xMidYMax meet' : 'xMinYMid meet'}>
        {drawn.items.map((item: DrawItem) => {
          if (item.tag === 'card') return null;
          const Tag = TAGS[item.tag] as React.ComponentType<Record<string, unknown>>;
          return <Tag key={item.key} {...item.geometry} {...item.paint} transform={item.transform} />;
        })}
      </Svg>
    </View>
  );
}
