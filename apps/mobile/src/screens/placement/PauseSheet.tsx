import { Button, Heading, Hoya, Icon, colors, radii, spacing, touchTarget, useLayoutClass } from '@hangul-route/design-system';
import { useIsFocused } from '@react-navigation/native';
import React, { useEffect } from 'react';
import { Modal, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PauseSheet as PauseSheetModel } from '../../logic/placement/flow';
import { usePlacement } from './context';
import { LinkButton } from './parts';

/**
 * Pause (F-PLC-001 section 3.1 step 6, wireframe placement F and F2): a
 * spoken bottom sheet over the question, with two large icon buttons. It
 * opens after three "not sure" (not in Short), after 45 seconds untouched,
 * from the exit and when the app leaves the foreground; Deep's rest card
 * ("Hoya is stretching. Keep going?") is the same sheet without the grown-up
 * link. The backstop clock does not run while it is open. "That is enough"
 * ends the run with the answers so far. On a short window (a phone in
 * landscape, large text) the sheet scrolls inside the window and Hoya steps
 * aside; on a wide one it stays at reading width.
 */

/** Below this window height Hoya is left out of the sheet, so the two buttons fit. */
const HOYA_MIN_WINDOW_HEIGHT = 400;
export function PauseSheet({ sheet }: { sheet: PauseSheetModel }): React.ReactElement {
  const { m, applyRun, say, screenReader, finishForGrownUp } = usePlacement();
  const copy = m.learner.placement;
  const title = sheet.kind === 'rest' ? copy.rest.line : copy.pause.title;
  // Hidden while the PIN gate is on top ("For grown-ups: finish now"), shown again on return.
  const focused = useIsFocused();
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const layout = useLayoutClass();

  useEffect(() => {
    if (!screenReader) void say(title);
  }, [screenReader, say, title]);

  return (
    <Modal transparent animationType="fade" visible={focused} onRequestClose={() => applyRun({ type: 'keepGoing' })}>
      <View style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: colors.surface.overlay }}>
        <View
          testID={sheet.kind === 'rest' ? 'placement-rest' : 'placement-pause'}
          accessibilityViewIsModal
          style={{
            width: '100%',
            maxWidth: layout.maxWidth.reading,
            maxHeight: window.height - insets.top,
            backgroundColor: colors.surface.paper,
            borderTopLeftRadius: radii.xl,
            borderTopRightRadius: radii.xl,
          }}
        >
          <ScrollView
            bounces={false}
            contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xl + insets.bottom, gap: spacing.md }}
          >
          <View style={{ alignItems: 'center', gap: spacing.sm }}>
            {window.height >= HOYA_MIN_WINDOW_HEIGHT ? <Hoya pose={sheet.kind === 'rest' ? 'cheering' : 'idle'} size={touchTarget.hero} /> : null}
            <Heading level="title" align="center">
              {title}
            </Heading>
          </View>
          <Button
            label={copy.pause.keepGoing}
            tone="primary"
            size="hero"
            fullWidth
            leading={<Icon name="play" size={spacing.xl} color={colors.text.inverse} />}
            onPress={() => applyRun({ type: 'keepGoing' })}
            testID="placement-keep-going"
          />
          <Button
            label={copy.pause.enough}
            tone="secondary"
            size="lg"
            fullWidth
            leading={<Icon name="home" size={spacing.xl} color={colors.text.inverse} />}
            onPress={() => applyRun(sheet.enough)}
            testID="placement-enough"
          />
          {sheet.grownUpLink ? (
            <LinkButton label={copy.pause.grownUp} icon="lock" onPress={finishForGrownUp} testID="placement-grown-up-finish" />
          ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
