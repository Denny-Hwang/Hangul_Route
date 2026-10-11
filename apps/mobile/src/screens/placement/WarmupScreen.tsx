import { Body, ChoiceCard, HoyaBubble, Screen, Spacer, touchTarget, useMediaSize } from '@hangul-route/design-system';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { PLACEMENT_WARMUP } from '../../content/placement.generated';
import { optionViews, promptView } from '../../logic/placement/item-view';
import { playPrompt } from '../../platform/audio';
import { PictureArt } from '../minigames/PictureArt';
import { usePlacement } from './context';
import { ChoiceGrid, ExitButton, FootstepTrail, SpeakerButton } from './parts';

const WARMUP_QUESTION = { id: PLACEMENT_WARMUP.id, ...PLACEMENT_WARMUP.question };

/**
 * Warm-up (F-PLC-001 section 3.1 step 4, wireframe placement D): one
 * unscored question (hear a word, tap the picture). Its speaker tap unlocks
 * audio for the run and checks it: `unavailable` turns sound off for the
 * whole run, and Short or a listen-first learner then sees the grown-up
 * sound-needed screen instead; sound switched off (`muted`) counts the same
 * for the draw. The pictures wait for that check; any answer
 * opens the first scored question. Hoya's line is spoken on open (the
 * hand-off tap unlocked audio), never over a screen reader. The exit leaves
 * with nothing recorded (no run has begun). Nothing here is recorded.
 */
export function WarmupScreen(): React.ReactElement {
  const { m, flow, dispatch, markGesture, say, screenReader, leave } = usePlacement();
  const copy = m.learner.placement;
  const [busy, setBusy] = useState(false);
  const pictureSize = useMediaSize(touchTarget.hero);
  const prompt = promptView(WARMUP_QUESTION, false);
  const options = optionViews(WARMUP_QUESTION, { revealed: false, mode: flow.mode, testLocale: flow.testLocale, m });
  const checked = flow.audio !== null;

  useEffect(() => {
    if (!screenReader) void say(copy.warmup.line);
  }, [screenReader, say, copy.warmup.line]);

  const hear = (): void => {
    if (busy || prompt.kind !== 'speaker') return;
    setBusy(true);
    markGesture();
    void playPrompt({
      text: prompt.text,
      ...(prompt.audioRef === undefined ? {} : { audioRef: prompt.audioRef }),
      kind: 'word',
      source: 'placement',
    }).then((result) => {
      setBusy(false);
      dispatch({ type: 'warmupAudio', result });
    });
  };

  return (
    <Screen tone="canvas" testID="placement-warmup">
      <ExitButton onPress={leave} label={copy.item.exit} testID="placement-warmup-exit" />
      <HoyaBubble tone="idle" message={copy.warmup.line} />
      <Spacer size="lg" />
      <View style={{ alignItems: 'center' }}>
        <SpeakerButton onPress={hear} label={checked ? copy.item.hearAgain : copy.item.tapToHear} testID="placement-warmup-speaker" />
      </View>
      {flow.noSoundNote ? (
        <>
          <Spacer size="md" />
          <Body align="center" tone="secondary" testID="placement-no-sound-note">
            {copy.warmup.noSound}
          </Body>
        </>
      ) : null}
      <Spacer size="lg" />
      <ChoiceGrid columns={2}>
        {options.map((option) => (
          <ChoiceCard
            key={option.id}
            testID={`placement-warmup-option-${option.id}`}
            art={<PictureArt pictureRef={option.pictureRef} gloss={option.label} size={pictureSize} />}
            state={checked ? 'idle' : 'disabled'}
            onPress={() => dispatch({ type: 'warmupAnswer' })}
            accessibilityLabel={option.label}
          />
        ))}
      </ChoiceGrid>
      <Spacer size="lg" />
      <FootstepTrail answered={0} />
    </Screen>
  );
}
