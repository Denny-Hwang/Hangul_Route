import { Body, Heading, Hoya, Screen, Spacer, spacing, touchTarget } from '@hangul-route/design-system';
import React, { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { controlsFor } from '../../logic/placement/flow';
import { usePlacement } from './context';

/**
 * Hand-off (F-PLC-001 section 3.1 step 3a, wireframe placement C3): shown
 * after the options when Short is chosen or the learner is *Pictures first*.
 * The whole Hoya is the one button (`controlsFor`: spoken, with an icon), so
 * nothing has to be read. The ready line and the grown-up's line are spoken
 * once on open; with a screen reader on nothing auto-plays. The exit (the
 * route's ScreenHeader Close) leaves with nothing recorded: no run has begun.
 */
export function HandoffScreen(): React.ReactElement {
  const { m, flow, dispatch, say, screenReader } = usePlacement();
  const copy = m.learner.placement.handoff;
  const [hoya] = controlsFor(flow);

  useEffect(() => {
    if (screenReader) return;
    let alive = true;
    void say(copy.ready).then(() => {
      if (alive) void say(copy.helper);
    });
    return () => {
      alive = false;
    };
  }, [screenReader, say, copy.ready, copy.helper]);

  return (
    <Screen tone="canvas" testID="placement-handoff">
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, paddingTop: spacing.xl }}>
        <Pressable
          testID="placement-hoya-start"
          onPress={() => hoya && dispatch(hoya.event)}
          accessibilityRole="button"
          accessibilityLabel={copy.ready}
          style={{ minWidth: touchTarget.hero * 2, minHeight: touchTarget.hero * 2, alignItems: 'center', justifyContent: 'center' }}
        >
          <Hoya pose="cheering" size={touchTarget.hero * 2} />
        </Pressable>
        <Heading level="title" align="center">
          {copy.ready}
        </Heading>
      </View>
      <Spacer size="xl" />
      <Body tone="secondary" align="center">
        {copy.helper}
      </Body>
    </Screen>
  );
}
