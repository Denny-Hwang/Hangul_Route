import { Button, Heading, Hoya, Screen, Spacer, spacing, touchTarget } from '@hangul-route/design-system';
import React from 'react';
import { View } from 'react-native';
import { usePlacement } from './context';

/**
 * Reopening the level check within 24 hours (F-PLC-001 section 3.1 step 8,
 * wireframe placement L): **Continue** goes back to the same question with
 * the same options; **Start again** drops the saved run.
 */
export function ResumeScreen(): React.ReactElement {
  const { m, continueRun, startAgain } = usePlacement();
  const copy = m.learner.placement.resume;
  return (
    <Screen tone="canvas" testID="placement-resume">
      <View style={{ alignItems: 'center', paddingTop: spacing.xl, gap: spacing.md }}>
        <Hoya pose="waving" size={touchTarget.hero + touchTarget.min} />
        <Heading level="title" align="center">
          {copy.title}
        </Heading>
      </View>
      <Spacer size="xl" />
      <Button label={copy.continue} tone="primary" size="hero" fullWidth onPress={continueRun} testID="placement-continue" />
      <Spacer size="md" />
      <Button label={copy.startAgain} tone="secondary" size="lg" fullWidth onPress={startAgain} testID="placement-start-again" />
    </Screen>
  );
}
