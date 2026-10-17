import { borderWidth, colors, layout, radii, spacing, touchTarget, typography, KOREAN_LINE_BREAK, useTypeScale } from '@hangul-route/design-system';
import React, { useRef } from 'react';
import { Pressable, ScrollView, Text, View, type ViewStyle } from 'react-native';
import type { GridItem } from '../../../logic/lecture/tools';
import { THUMB_HEIGHT, THUMB_WIDTH } from '../stage-metrics';
import { usePresenterView } from '../presenter-context';
import { Cover, ToolButton } from './OverlayParts';

/**
 * The slide grid (G; design/screens/presenter/overlays.md "Grid", README D13): a teacher tool in
 * real pixels on `surface.sunken`. Each thumbnail is the jump button (it closes the grid) with the
 * number, the kind label and the title text: no Korean, no names, no notes, nothing for a quiz.
 * The open slide is outlined and marked Now; a hidden slide is dashed with Hidden and Show; the
 * others have Hide; the End slide has neither. Hidden slides last for this lesson only.
 */
export function GridOverlay({ items, onGoto, onToggle, onClose }: { items: readonly GridItem[]; onGoto: (idx: number) => void; onToggle: (key: string) => void; onClose: () => void }): React.ReactElement {
  const textScale = useTypeScale();
  const { messages } = usePresenterView();
  const m = messages.learner.presenter.grid;
  const now = useRef<View>(null);
  return (
    <Cover label={m.title} testID="presenter-grid" sunken initialFocus={now}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.lg, paddingHorizontal: layout.gutter.regular, paddingTop: spacing.lg }}>
        <Text {...KOREAN_LINE_BREAK} role="heading" aria-level={2} style={{ fontSize: textScale.size.title, fontWeight: typography.weight.bold, color: colors.text.primary }}>
          {m.title}
        </Text>
        <ToolButton testID="presenter-grid-close" label={messages.common.buttons.close} onPress={onClose} />
      </View>
      <Text {...KOREAN_LINE_BREAK} style={{ fontSize: textScale.size.body, color: colors.text.secondary, paddingHorizontal: layout.gutter.regular, paddingVertical: spacing.sm }}>{m.hint}</Text>
      <ScrollView contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, paddingHorizontal: layout.gutter.regular, paddingBottom: spacing.lg }}>
        {items.map((item) => (
          <Thumb key={item.key} item={item} innerRef={item.now ? now : undefined} onGoto={onGoto} onToggle={onToggle} />
        ))}
      </ScrollView>
    </Cover>
  );
}

type PressState = { focused?: boolean };

function Thumb({ item, innerRef, onGoto, onToggle }: { item: GridItem; innerRef?: React.Ref<View>; onGoto: (idx: number) => void; onToggle: (key: string) => void }): React.ReactElement {
  const textScale = useTypeScale();
  const { messages } = usePresenterView();
  const m = messages.learner.presenter.grid;
  const kind = m.kind[item.kind];
  const label = [String(item.n), kind, item.title, item.now ? m.now : '', item.hidden ? m.hidden : ''].filter((part) => part !== '').join(', ');
  const pill = (text: string): React.ReactElement => (
    <View style={{ borderRadius: radii.pill, borderWidth: borderWidth.base, borderColor: colors.border.strong, backgroundColor: colors.surface.paper, paddingHorizontal: spacing.sm }}>
      <Text {...KOREAN_LINE_BREAK} style={{ fontSize: textScale.size.body, fontWeight: typography.weight.bold, color: colors.text.primary }}>{text}</Text>
    </View>
  );
  return (
    <View
      testID={`presenter-grid-item-${item.n}`}
      style={{
        width: THUMB_WIDTH,
        minHeight: THUMB_HEIGHT,
        borderRadius: radii.lg,
        borderWidth: item.now ? borderWidth.thick : borderWidth.base,
        borderStyle: item.hidden ? 'dashed' : 'solid',
        borderColor: item.now ? colors.text.primary : colors.border.strong,
        backgroundColor: item.hidden ? colors.surface.sunken : colors.surface.paper,
        overflow: 'hidden',
      }}
    >
      <Pressable
        ref={innerRef}
        role="button"
        accessibilityLabel={label}
        testID={`presenter-grid-goto-${item.n}`}
        onPress={() => onGoto(item.idx)}
        style={(state) => ({ flex: 1, padding: spacing.md, gap: spacing.xs, minHeight: touchTarget.min, ...focus((state as PressState).focused === true) })}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
          <Text {...KOREAN_LINE_BREAK} style={{ fontSize: textScale.size.body, fontWeight: typography.weight.bold, color: colors.text.primary, fontVariant: ['tabular-nums'] }}>{item.n}</Text>
          <Text {...KOREAN_LINE_BREAK} style={{ fontSize: textScale.size.body, fontWeight: typography.weight.semibold, color: colors.text.secondary }}>{kind}</Text>
          {item.now ? pill(m.now) : null}
          {item.hidden ? pill(m.hidden) : null}
        </View>
        {item.title !== '' ? (
          <Text {...KOREAN_LINE_BREAK} numberOfLines={2} style={{ fontSize: textScale.size.body, color: colors.text.primary }}>
            {item.title}
          </Text>
        ) : null}
      </Pressable>
      {item.canHide ? (
        <Pressable
          role="button"
          testID={`presenter-grid-toggle-${item.n}`}
          accessibilityLabel={`${item.hidden ? m.show.cta : m.hide.cta}: ${item.n}`}
          onPress={() => onToggle(item.key)}
          style={(state) => ({
            minHeight: touchTarget.min,
            alignItems: 'center',
            justifyContent: 'center',
            borderTopWidth: borderWidth.base,
            borderTopColor: colors.border.subtle,
            ...focus((state as PressState).focused === true),
          })}
        >
          <Text {...KOREAN_LINE_BREAK} style={{ fontSize: textScale.size.body, fontWeight: typography.weight.bold, color: colors.text.primary }}>{item.hidden ? m.show.cta : m.hide.cta}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function focus(on: boolean): ViewStyle {
  return on ? ({ outlineStyle: 'solid', outlineWidth: borderWidth.thick, outlineColor: colors.border.focus, outlineOffset: -borderWidth.thick } as ViewStyle) : {};
}
