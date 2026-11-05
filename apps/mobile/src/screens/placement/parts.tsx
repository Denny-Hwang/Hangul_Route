import {
  Body,
  Caption,
  Icon,
  borderWidth,
  colors,
  radii,
  spacing,
  touchTarget,
  GuardedPressable,
  TapScroller,
  clampOffset,
  type TapScrollerLike,
} from '@hangul-route/design-system';
import { useMemo, useRef, useState } from 'react';
import type { ReactNode, ComponentProps, ReactElement } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';

export type IconName = ComponentProps<typeof Icon>['name'];

/**
 * Small building blocks shared by the level check's screens (F-PLC-001
 * section 3.12): every control is at least `touchTarget.min`, tokens only,
 * no emoji. Design: design/wireframes/placement/placement.md.
 */

/** The large round speaker: the prompt's play button, and "Tap to hear it" after a resume. */
export function SpeakerButton({
  onPress,
  label,
  size = touchTarget.hero,
  testID,
}: {
  onPress: () => void;
  label: string;
  size?: number;
  testID?: string;
}): ReactElement {
  return (
    <GuardedPressable
      setsLock={false}
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: radii.circle,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? colors.brand.primaryDark : colors.brand.primary,
      })}
    >
      <Icon name="speaker" size={Math.round(size / 2)} color={colors.text.inverse} />
    </GuardedPressable>
  );
}

/**
 * The footstep trail: one dot per answer, and one open dot for the question
 * now. It only fills, shows no number, and screen readers skip it.
 */
export function FootstepTrail({ answered }: { answered: number }): ReactElement {
  const dots = Array.from({ length: answered + 1 }, (_, i) => i < answered);
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, alignItems: 'center' }}
    >
      {dots.map((filled, i) => (
        <View
          key={i}
          style={{
            width: spacing.md,
            height: spacing.md,
            borderRadius: radii.circle,
            borderWidth: borderWidth.base,
            borderColor: colors.brand.primary,
            backgroundColor: filled ? colors.brand.primary : colors.surface.paper,
          }}
        />
      ))}
    </View>
  );
}

/**
 * LinkButton moved to `components/LinkButton.tsx` (shared by placement, the Learning Route and the plan screens).
 * Re-exported here only for `screens/home/HomeScreen.tsx`, which was out of scope for #609 (another task owns it).
 * Follow-up (#609 review): switch HomeScreen to `../../components/LinkButton`, then delete this re-export.
 */
export { LinkButton } from '../../components/LinkButton';

/**
 * A radio tile (`accessibilityRole="radio"` with `selected` and `disabled`):
 * the mode tiles and the sound-guide choices. Never "recommended".
 */
export function RadioTile({
  selected,
  disabled = false,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  testID,
  children,
  flex,
}: {
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  testID?: string;
  children: ReactNode;
  flex?: boolean;
}): ReactElement {
  return (
    <Pressable
      testID={testID}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected, disabled }}
      aria-checked={selected}
      aria-disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={{
        flex: flex ? 1 : undefined,
        minHeight: touchTarget.child,
        padding: spacing.md,
        gap: spacing.xs,
        borderRadius: radii.lg,
        borderWidth: selected ? borderWidth.thick : borderWidth.base,
        borderColor: selected ? colors.brand.primary : colors.border.subtle,
        backgroundColor: disabled ? colors.surface.sunken : colors.surface.paper,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View
          style={{
            width: spacing.xl,
            height: spacing.xl,
            borderRadius: radii.circle,
            borderWidth: borderWidth.base,
            borderColor: selected ? colors.brand.primary : colors.border.strong,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {selected ? (
            <View style={{ width: spacing.md, height: spacing.md, borderRadius: radii.circle, backgroundColor: colors.brand.primary }} />
          ) : null}
        </View>
        <View style={{ flex: 1 }}>{children}</View>
      </View>
    </Pressable>
  );
}

/** A quiet line for a grown-up, under a control. */
export function Note({ children, testID }: { children: ReactNode; testID?: string }): ReactElement {
  return (
    <Caption tone="secondary" testID={testID}>
      {children}
    </Caption>
  );
}

/**
 * Choice cards in rows of `columns`, every cell the same width (the last row
 * is padded with empty cells), so a 2 x 2 grid stays a grid at any width.
 */
export function ChoiceGrid({ columns, children }: { columns: 1 | 2; children: ReactNode[] }): ReactElement {
  const rows: ReactNode[][] = [];
  for (let i = 0; i < children.length; i += columns) rows.push(children.slice(i, i + columns));
  return (
    <View style={{ gap: spacing.md }}>
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', gap: spacing.md }}>
          {Array.from({ length: columns }, (_, c) => (
            <View key={c} style={{ flex: 1 }}>
              {row[c] ?? null}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

type WebScrollNode = { scrollTop: number; scrollHeight: number; clientHeight: number };

/**
 * Short in a small landscape window: the choices scroll in their own column. Their board scrolls it for a drag that
 * starts on a card (AMENDMENTS-TOUCH KT-D3, rule 5), as `Screen` does for its own ScrollView; on the web the offset is
 * the node's own `scrollTop`, as in `Screen`. "I am not sure" stays under the column on a board of its own: a board
 * that also held it would read the clipped cards' rectangles under it (a hidden card would take its tap).
 */
export function ChoiceScroller({ children }: { children: ReactNode }): ReactElement {
  const ref = useRef<ScrollView | null>(null);
  const size = useRef({ viewport: 0, content: 0, offset: 0 });
  const listeners = useRef(new Set<(offset: number) => void>());
  const [canScroll, setCanScroll] = useState(false);
  const measure = (): void => setCanScroll(size.current.content > size.current.viewport + 1);
  const scroller = useMemo<TapScrollerLike>(
    () => ({
      axis: 'y',
      canScroll,
      scrollBy: (delta) => {
        const s = size.current;
        if (Platform.OS === 'web') {
          const node = (ref.current as { getScrollableNode?: () => WebScrollNode | null } | null)?.getScrollableNode?.();
          if (node === null || node === undefined) return s.offset;
          node.scrollTop = clampOffset(node.scrollTop, delta, node.scrollHeight, node.clientHeight);
          return node.scrollTop;
        }
        s.offset = clampOffset(s.offset, delta, s.content, s.viewport);
        ref.current?.scrollTo({ y: s.offset, animated: false });
        return s.offset;
      },
      onScroll: (listener) => {
        listeners.current.add(listener);
        return () => {
          listeners.current.delete(listener);
        };
      },
    }),
    [canScroll],
  );
  return (
    <ScrollView
      ref={ref}
      style={{ flex: 1 }}
      scrollEventThrottle={16}
      testID="placement-choice-scroller"
      onLayout={(e) => {
        size.current.viewport = e.nativeEvent.layout.height;
        measure();
      }}
      onContentSizeChange={(_w, h) => {
        size.current.content = h;
        measure();
      }}
      onScroll={(e) => {
        size.current.offset = e.nativeEvent.contentOffset.y;
        for (const listener of listeners.current) listener(size.current.offset);
      }}
    >
      <TapScroller scroller={scroller}>{children}</TapScroller>
    </ScrollView>
  );
}
