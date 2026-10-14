import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, Line, Path, Polygon, Rect } from 'react-native-svg';
import { KOREAN_LANGUAGE } from '../../korean-text';
import { drawProp, type DrawItem } from '../../scene-art/draw';
import { REALIA_REGISTRY } from '../../scene-art/realia-registry';
import { borderWidth, colors, radii, spacing, touchTarget, typography } from '../../tokens';
import { Icon } from '../Icon';
import {
  REALIA_BOARD_WIDTH,
  REALIA_BOTTOM_DRESSING,
  REALIA_CARD_MIN_WIDTH,
  REALIA_DRESSINGS,
  REALIA_GOODS_HEIGHT,
  REALIA_MARK_SIZE,
  REALIA_STUB,
  REALIA_STUB_WIDTH,
  REALIA_TOP_DRESSING,
  realiaGoodsRef,
  realiaLineLook,
  realiaPaper,
} from './style';
import type { RealiaSheetLine, RealiaSheetProps, RealiaSheetText } from './types';

/**
 * RealiaSheet — a drawn real-world text (F-CURR-001 G-2): a menu board, a train ticket, a
 * trail sign or market price cards. Two layers, never one picture: the dressing is scene art
 * (`REALIA_REGISTRY`, decorative and hidden from assistive tech), and every word is live text
 * inside it, so it is in the accessibility tree, grows with the text size and follows the
 * romanization setting. Each line is a button (tap = hear it; never an answer).
 * Design: design/screens/minigame-realia-read/ (D1-D8), design/wireframes/minigame/realia-read.md.
 */

const TAGS = { rect: Rect, circle: Circle, ellipse: Ellipse, line: Line, path: Path, polygon: Polygon } as const;
const koreanSpeech = { accessibilityLanguage: KOREAN_LANGUAGE, lang: KOREAN_LANGUAGE };
const hidden = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const, 'aria-hidden': true };

/** One dressing prop, stretched to its box (`stretch`) or kept at its aspect ratio. */
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

function Part({ part, align = 'left' }: { part: RealiaSheetText; align?: 'left' | 'right' | 'center' }): React.ReactElement {
  return (
    <View style={{ alignItems: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start', flexShrink: 1 }}>
      <Text
        {...koreanSpeech}
        style={{
          fontFamily: typography.family.sansKr,
          fontSize: typography.size.bodyLg,
          fontWeight: typography.weight.bold,
          color: colors.text.primary,
          textAlign: align,
        }}
      >
        {part.ko}
      </Text>
      {part.romanization !== '' ? (
        <Text style={{ fontSize: typography.size.caption, fontStyle: 'italic', color: colors.text.secondary, textAlign: align }}>{part.romanization}</Text>
      ) : null}
    </View>
  );
}

function Title({ title, label, centered }: { title: RealiaSheetText; label?: string; centered: boolean }): React.ReactElement {
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: centered ? 'center' : 'flex-start', gap: spacing.sm }}
    >
      <Text {...koreanSpeech} style={{ fontFamily: typography.family.sansKr, fontSize: typography.size.bodyLg, fontWeight: typography.weight.bold, color: colors.text.primary }}>
        {title.ko}
      </Text>
      {title.romanization !== '' ? (
        <Text style={{ fontSize: typography.size.caption, fontStyle: 'italic', color: colors.text.secondary }}>{title.romanization}</Text>
      ) : null}
    </View>
  );
}

interface LineProps {
  line: RealiaSheetLine;
  layout: 'row' | 'stack';
  hint: string;
  onPress?: (id: string) => void;
  testID?: string;
}

/** A line of the text layer: the button, its mark and, once found, its gloss. */
function LineButton({ line, layout, hint, onPress, testID }: LineProps): React.ReactElement {
  const look = realiaLineLook(line.mark);
  return (
    <Pressable
      testID={testID}
      onPress={onPress ? () => onPress(line.id) : undefined}
      accessibilityRole="button"
      accessibilityLabel={line.accessibilityLabel}
      accessibilityHint={hint}
      style={{
        minHeight: touchTarget.min,
        justifyContent: 'center',
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.sm,
        borderRadius: radii.sm,
        borderWidth: look.borderWidth,
        borderStyle: look.borderStyle,
        borderColor: look.borderColor,
        backgroundColor: look.backgroundColor,
        flexGrow: 1,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        {look.icon ? (
          <View {...hidden}>
            <Icon name={look.icon.name} size={REALIA_MARK_SIZE} color={look.icon.color} />
          </View>
        ) : null}
        {layout === 'row' ? (
          <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', columnGap: spacing.md }}>
            <Part part={line.text} />
            {line.value ? (
              <>
                <View {...hidden} style={{ flexGrow: 1, minWidth: spacing.lg, borderBottomWidth: borderWidth.base, borderStyle: 'dotted', borderColor: colors.border.strong, marginBottom: spacing.md }} />
                {/* Pushed to the end of its row, also when it wraps under the text at a large text size. */}
                <View style={{ marginLeft: 'auto' }}>
                  <Part part={line.value} align="right" />
                </View>
              </>
            ) : null}
          </View>
        ) : (
          <View style={{ flex: 1, alignItems: 'center', gap: spacing.xs }}>
            <Part part={line.text} align="center" />
            {line.value ? <Part part={line.value} align="center" /> : null}
          </View>
        )}
      </View>
      {line.mark === 'found' && line.gloss ? (
        <Text style={{ marginTop: spacing.xs, fontSize: typography.size.body, color: colors.text.primary, textAlign: layout === 'stack' ? 'center' : 'left' }}>{line.gloss}</Text>
      ) : null}
    </Pressable>
  );
}

/** A trail board: the button and its arrow cell, on the side it points to. */
function Board({ line, hint, onPress, testID }: LineProps): React.ReactElement {
  const right = line.dir !== 'left';
  const paper = realiaPaper('sign');
  const arrow = (
    <View {...hidden} style={{ width: touchTarget.min, alignItems: 'center', justifyContent: 'center', borderColor: paper.borderColor, ...(right ? { borderLeftWidth: borderWidth.base } : { borderRightWidth: borderWidth.base }) }}>
      <Icon name={right ? 'arrow-right' : 'arrow-left'} size={REALIA_MARK_SIZE} color={colors.text.primary} />
    </View>
  );
  return (
    <View
      role="listitem"
      style={{
        width: line.dir === undefined ? '100%' : REALIA_BOARD_WIDTH,
        alignSelf: line.dir === 'left' ? 'flex-start' : line.dir === 'right' ? 'flex-end' : 'stretch',
        flexDirection: 'row',
        backgroundColor: paper.backgroundColor,
        borderColor: paper.borderColor,
        borderWidth: borderWidth.base,
        borderRadius: paper.borderRadius,
      }}
    >
      {line.dir === 'left' ? arrow : null}
      <View style={{ flex: 1 }}>
        <LineButton line={line} layout="row" hint={hint} onPress={onPress} testID={testID} />
      </View>
      {line.dir === 'right' ? arrow : null}
    </View>
  );
}

export function RealiaSheet({ kind, title, titleLabel, lines, accessibilityLabel, lineHint, onPressLine, testID }: RealiaSheetProps): React.ReactElement {
  const dressing = REALIA_DRESSINGS[kind];
  const paper = realiaPaper(kind);
  const lineId = (id: string): string | undefined => (testID ? `${testID}-line-${id}` : undefined);

  const rows = (
    <View role="list" style={{ gap: spacing.xs }}>
      {lines.map((line) => (
        <View role="listitem" key={line.id}>
          <LineButton line={line} layout="row" hint={lineHint} onPress={onPressLine} testID={lineId(line.id)} />
        </View>
      ))}
    </View>
  );

  let body: React.ReactElement;
  switch (kind) {
    case 'ticket':
      body = (
        <View style={{ flexDirection: 'row', backgroundColor: paper.backgroundColor, borderColor: paper.borderColor, borderWidth: borderWidth.base, borderRadius: paper.borderRadius, overflow: 'hidden' }}>
          <View style={{ flex: 1 }}>
            <View style={{ backgroundColor: colors.brand.secondaryLight, borderBottomWidth: borderWidth.base, borderColor: paper.borderColor }}>
              {dressing.top ? <Dressing refId={dressing.top} height={REALIA_TOP_DRESSING} stretch={false} /> : null}
            </View>
            <View style={{ padding: spacing.md, gap: spacing.sm }}>
              {title ? <Title title={title} label={titleLabel} centered={false} /> : null}
              {rows}
            </View>
          </View>
          <View {...hidden} style={{ width: REALIA_STUB_WIDTH, backgroundColor: colors.surface.sunken, borderLeftWidth: borderWidth.base, borderStyle: 'dashed', borderColor: colors.border.strong, justifyContent: 'center' }}>
            <Dressing refId={REALIA_STUB} height={touchTarget.child + spacing.xl} stretch={false} width={REALIA_STUB_WIDTH} centered />
          </View>
        </View>
      );
      break;
    case 'sign':
      body = (
        <View>
          {dressing.top ? <Dressing refId={dressing.top} height={REALIA_TOP_DRESSING} stretch /> : null}
          <View style={{ alignItems: 'stretch', gap: spacing.sm }}>
            {/* The post runs behind the boards. */}
            <View {...hidden} style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: spacing.md, marginLeft: -spacing.md / 2, backgroundColor: colors.text.secondary }} />
            {title ? (
              <View style={{ alignSelf: 'center', backgroundColor: paper.backgroundColor, borderColor: paper.borderColor, borderWidth: borderWidth.base, borderRadius: paper.borderRadius, paddingVertical: spacing.xs, paddingHorizontal: spacing.md }}>
                <Title title={title} label={titleLabel} centered />
              </View>
            ) : null}
            <View role="list" style={{ gap: spacing.sm }}>
              {lines.map((line) => (
                <Board key={line.id} line={line} layout="row" hint={lineHint} onPress={onPressLine} testID={lineId(line.id)} />
              ))}
            </View>
          </View>
          {dressing.bottom ? <Dressing refId={dressing.bottom} height={REALIA_BOTTOM_DRESSING} stretch /> : null}
        </View>
      );
      break;
    case 'price-card':
      body = (
        <View style={{ backgroundColor: colors.surface.sunken, borderColor: colors.border.strong, borderWidth: borderWidth.base, borderRadius: radii.md, padding: spacing.md, gap: spacing.sm }}>
          {title ? <Title title={title} label={titleLabel} centered /> : null}
          <View role="list" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
            {lines.map((line) => (
              <View role="listitem" key={line.id} style={{ flexGrow: 1, flexBasis: REALIA_CARD_MIN_WIDTH, minWidth: REALIA_CARD_MIN_WIDTH }}>
                {line.goods ? <Dressing refId={realiaGoodsRef(line.goods)} height={REALIA_GOODS_HEIGHT} stretch={false} centered /> : null}
                <View style={{ backgroundColor: paper.backgroundColor, borderColor: paper.borderColor, borderWidth: borderWidth.base, borderRadius: paper.borderRadius }}>
                  <LineButton line={line} layout="stack" hint={lineHint} onPress={onPressLine} testID={lineId(line.id)} />
                </View>
              </View>
            ))}
          </View>
        </View>
      );
      break;
    default:
      // menu, and the plain sheet for a realia with no known kind (the same lines, never blank).
      body = (
        <View>
          {dressing.top ? <Dressing refId={dressing.top} height={REALIA_TOP_DRESSING} stretch /> : null}
          <View style={{ backgroundColor: paper.backgroundColor, borderColor: paper.borderColor, borderWidth: borderWidth.base, borderRadius: paper.borderRadius, padding: spacing.md, gap: spacing.sm }}>
            {title ? <Title title={title} label={titleLabel} centered={kind === 'menu'} /> : null}
            {rows}
          </View>
          {dressing.bottom ? <Dressing refId={dressing.bottom} height={REALIA_BOTTOM_DRESSING} stretch /> : null}
        </View>
      );
  }

  return (
    <View role="group" accessibilityLabel={accessibilityLabel} aria-label={accessibilityLabel} testID={testID} style={{ width: '100%' }}>
      {body}
    </View>
  );
}
