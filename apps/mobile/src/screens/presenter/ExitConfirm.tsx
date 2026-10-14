import { colors, layout, radii, shadows, spacing, typography, z } from '@hangul-route/design-system';
import React, { useEffect, useRef } from 'react';
import { Text, View } from 'react-native';
import { EXIT_DIALOG_WIDTH } from './stage-metrics';
import { usePresenterView } from './presenter-context';
import { GhostButton, PrimaryButton } from './StatePage';

/**
 * The Exit confirm (design/screens/presenter/overlays.md "Exit"): an alert dialog over
 * `surface.overlay`, "Leave the lesson?", "Nothing about anyone's progress changes.", Keep going
 * (primary, focused) and Exit. Esc or Keep going closes it.
 */
export function ExitConfirm({ onKeepGoing, onExit }: { onKeepGoing: () => void; onExit: () => void }): React.ReactElement {
  const { messages } = usePresenterView();
  const m = messages.learner.presenter;
  const keep = useRef<View>(null);
  useEffect(() => {
    keep.current?.focus?.();
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
        <Text nativeID="presenter-exit-title" role="heading" style={{ fontSize: typography.size.title, fontWeight: typography.weight.bold, color: colors.text.primary }}>
          {m.exit.title}
        </Text>
        <Text style={{ fontSize: typography.size.body, color: colors.text.secondary, lineHeight: Math.round(typography.size.body * typography.leading.normal) }}>{m.exit.line}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'flex-end' }}>
          <GhostButton testID="presenter-exit-confirm" label={m.bar.exit.cta} onPress={onExit} />
          <PrimaryButton ref={keep} testID="presenter-keep-going" label={m.exit.keepGoing.cta} onPress={onKeepGoing} />
        </View>
      </View>
    </View>
  );
}
