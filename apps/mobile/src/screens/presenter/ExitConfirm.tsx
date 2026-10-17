import { colors, layout, radii, shadows, spacing, typography, z, KOREAN_LINE_BREAK, useTypeScale } from '@hangul-route/design-system';
import React, { useEffect, useRef } from 'react';
import { Text, View } from 'react-native';
import { trapFocus } from '../../platform/presenter';
import { EXIT_DIALOG_WIDTH } from './stage-metrics';
import { usePresenterView } from './presenter-context';
import { GhostButton, PrimaryButton } from './StatePage';

/**
 * The Exit confirm (design/screens/presenter/overlays.md "Exit"): an alert dialog over
 * `surface.overlay`, "Leave the lesson?", "Nothing about anyone's progress changes.", Keep going
 * (primary, focused) and Exit. Esc or Keep going closes it; Tab and Shift+Tab stay inside it.
 */
export function ExitConfirm({ onKeepGoing, onExit }: { onKeepGoing: () => void; onExit: () => void }): React.ReactElement {
  const textScale = useTypeScale();
  const { messages } = usePresenterView();
  const m = messages.learner.presenter;
  const keep = useRef<View>(null);
  const exit = useRef<View>(null);
  useEffect(() => {
    keep.current?.focus?.();
    // Tab stays in the dialog (aria-modal), so no control behind it can be reached or activated.
    return trapFocus(() => [exit.current, keep.current]);
  }, []);
  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        zIndex: z.modal,
        backgroundColor: colors.surface.overlay,
        alignItems: 'center',
        justifyContent: 'center',
        padding: layout.gutter.compact,
      }}
    >
      <View
        testID="presenter-exit-dialog"
        role="alertdialog"
        aria-modal
        aria-labelledby="presenter-exit-title"
        style={{
          width: '100%',
          maxWidth: EXIT_DIALOG_WIDTH,
          backgroundColor: colors.surface.paper,
          borderRadius: radii.xl,
          padding: spacing.xxl,
          gap: spacing.lg,
          ...shadows.modal,
        }}
      >
        <Text {...KOREAN_LINE_BREAK} nativeID="presenter-exit-title" role="heading" style={{ fontSize: textScale.size.title, fontWeight: typography.weight.bold, color: colors.text.primary }}>
          {m.exit.title}
        </Text>
        <Text {...KOREAN_LINE_BREAK} style={{ fontSize: textScale.size.body, color: colors.text.secondary, lineHeight: Math.round(textScale.size.body * typography.leading.normal) }}>{m.exit.line}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'flex-end' }}>
          <GhostButton ref={exit} testID="presenter-exit-confirm" label={m.bar.exit.cta} onPress={onExit} />
          <PrimaryButton ref={keep} testID="presenter-keep-going" label={m.exit.keepGoing.cta} onPress={onKeepGoing} />
        </View>
      </View>
    </View>
  );
}
