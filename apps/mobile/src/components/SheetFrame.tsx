import { Heading, Icon, Spacer, GuardedPressable, borderWidth, colors, radii, spacing, touchTarget, useLayoutClass } from '@hangul-route/design-system';
import { useEffect, useId, useRef, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { focusForScreenReader } from '../platform/screen-reader';
import { useHistorySheet } from '../platform/history-bridge';

/**
 * The bottom sheet the "Can't hear it?" sheet and the "Add a Korean voice" sheet share
 * (AMENDMENTS-AUDIO-CANT-HEAR section 3.3 and 3.9; design/components/CantHear/spec.md and VoiceHelp/spec.md section 2;
 * mock decisions MD6 and MD11 in design/screens/audio-cant-hear/README.md). It holds only what the two sheets have in
 * common, so they cannot drift:
 *
 * - a `Modal` that slides up over `colors.surface.overlay`, `accessibilityViewIsModal`; the browser back and the phone's
 *   back close it (`useHistorySheet`, `onRequestClose`);
 * - the scrim is a tap target for sight only, built as `ConfirmSheet`'s backdrop: neither read nor reached by Tab, so it
 *   is not a second "Close" button for a screen reader;
 * - focus starts on the title (a header), then the close button, then the body, then the footer buttons;
 * - from window class `regular` the sheet is capped at `layout.maxWidth.reading` and centred at the bottom;
 * - the title row and the body scroll as one and the footer stays under them. When they scroll, a `border.strong` rule is
 *   drawn over the footer and the native scroll cues are on (`persistentScrollbar`, `flashScrollIndicators()`).
 */
export interface SheetFrameProps {
  visible: boolean;
  /** Close, the scrim, the back and Escape: close the sheet and change nothing else. */
  onClose: () => void;
  /** iOS: the `Modal` has gone away, so `setAccessibilityFocus` reaches the screen behind it. */
  onDismiss?: () => void;
  title: string;
  closeLabel: string;
  testID: string;
  /** Scrolls with the title. */
  children: ReactNode;
  /** The buttons; they stay under the scroll area. */
  footer: ReactNode;
}

export function SheetFrame({ visible, onClose, onDismiss, title, closeLabel, testID, children, footer }: SheetFrameProps): ReactElement {
  const layoutClass = useLayoutClass();
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const titleId = `${testID}-title-${id}`;
  // One history level while open: the browser back closes the sheet (AMENDMENTS-DISPLAY-NAV section 7.2).
  useHistorySheet(visible, onClose);
  const capped = layoutClass.width !== 'compact';
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} onDismiss={onDismiss} accessibilityViewIsModal>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.surface.overlay }} testID={testID}>
        <Pressable
          onPress={onClose}
          accessible={false}
          focusable={false}
          aria-hidden
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          {...{ tabIndex: -1 }}
          style={{ flex: 1 }}
          testID={`${testID}-scrim`}
        />
        <View
          role="dialog"
          aria-modal
          aria-labelledby={titleId}
          style={{
            maxHeight: '85%',
            width: '100%',
            ...(capped ? { maxWidth: layoutClass.maxWidth.reading, alignSelf: 'center' as const } : null),
            backgroundColor: colors.surface.paper,
            borderTopLeftRadius: radii.xl,
            borderTopRightRadius: radii.xl,
            padding: spacing.lg,
          }}
        >
          <SheetBody titleId={titleId} title={title} closeLabel={closeLabel} onClose={onClose} testID={testID} footer={footer}>
            {children}
          </SheetBody>
        </View>
      </View>
    </Modal>
  );
}

type Focusable = { focus?: () => void };

/** Mounts with the sheet's content, so focus and the scroll cue start when the sheet is really on screen. */
function SheetBody({
  titleId,
  title,
  closeLabel,
  onClose,
  testID,
  footer,
  children,
}: {
  titleId: string;
  title: string;
  closeLabel: string;
  onClose: () => void;
  testID: string;
  footer: ReactNode;
  children: ReactNode;
}): ReactElement {
  const titleRef = useRef<View | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);
  const sizes = useRef({ content: 0, view: 0 });
  const [scrolls, setScrolls] = useState(false);

  useEffect(() => {
    // Focus lands on the title (a header). `Heading` takes no ref, so it sits in a focusable wrapper that does.
    focusForScreenReader(titleRef.current as Focusable | null);
    scrollRef.current?.flashScrollIndicators?.();
  }, []);

  const measure = (): void => setScrolls(sizes.current.content > sizes.current.view + 1);
  return (
    <>
      <ScrollView
        ref={scrollRef}
        style={{ flexShrink: 1 }}
        persistentScrollbar
        onLayout={(e: LayoutChangeEvent) => {
          sizes.current.view = e.nativeEvent.layout.height;
          measure();
        }}
        onContentSizeChange={(_w: number, h: number) => {
          sizes.current.content = h;
          measure();
        }}
        testID={`${testID}-scroll`}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <View
              ref={titleRef}
              nativeID={titleId}
              testID={`${testID}-title`}
              {...{ id: titleId, tabIndex: -1 }}
              accessible
              focusable
              accessibilityRole={Platform.OS === 'web' ? undefined : 'header'}
            >
              <Heading level="prompt">{title}</Heading>
            </View>
          </View>
          <GuardedPressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={closeLabel}
            // Native only (react-native-web drops it); the target is already at least touchTarget.min each way.
            hitSlop={spacing.sm}
            style={{ minWidth: touchTarget.min, minHeight: touchTarget.min, alignItems: 'center', justifyContent: 'center' }}
            testID={`${testID}-close`}
          >
            <Icon name="close" size={22} color={colors.text.muted} />
          </GuardedPressable>
        </View>
        {children}
      </ScrollView>
      <Spacer size="md" />
      <View
        testID={`${testID}-footer`}
        style={{
          ...(scrolls ? { borderTopWidth: borderWidth.thin, borderTopColor: colors.border.strong, paddingTop: spacing.md } : null),
        }}
      >
        {footer}
      </View>
    </>
  );
}
