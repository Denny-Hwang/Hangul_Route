import { Button, Heading, Icon, Screen, Spacer, colors, spacing, touchTarget } from '@hangul-route/design-system';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { usePlacement } from './context';
import { LinkButton } from '../../components/LinkButton';

/**
 * Sound needed (F-PLC-001 section 3.1 step 4, wireframe placement L2): a
 * grown-up screen shown when Short, or a listen-first run, finds no sound at
 * the warm-up. **Try again** repeats the warm-up, **Start learning** leaves
 * with nothing recorded, **Check without sound** is the grown-up's explicit
 * choice of a Standard run with listen-first off (back to the full options,
 * the sound guide unanswered; the warm-up is not repeated).
 */
export function SoundNeededScreen(): React.ReactElement {
  const { m, dispatch, say, screenReader } = usePlacement();
  const copy = m.learner.placement.soundNeeded;

  useEffect(() => {
    if (!screenReader) void say(copy.title);
  }, [screenReader, say, copy.title]);

  return (
    <Screen tone="canvas" testID="placement-sound-needed">
      <View style={{ alignItems: 'center', paddingTop: spacing.xxl, gap: spacing.lg }}>
        <Icon name="speaker-off" size={touchTarget.hero} color={colors.text.secondary} />
        <Heading level="title" align="center">
          {copy.title}
        </Heading>
      </View>
      <Spacer size="xl" />
      <Button
        label={copy.tryAgain}
        tone="primary"
        size="hero"
        fullWidth
        leading={<Icon name="replay" size={spacing.xl} color={colors.text.inverse} />}
        onPress={() => dispatch({ type: 'tryAgain' })}
        testID="placement-try-again"
      />
      <Spacer size="md" />
      <Button label={copy.startLearning} tone="secondary" size="lg" fullWidth onPress={() => dispatch({ type: 'startLearning' })} />
      <Spacer size="md" />
      <LinkButton label={copy.withoutSound} onPress={() => dispatch({ type: 'withoutSound' })} testID="placement-without-sound" />
    </Screen>
  );
}
