import {
  Button,
  Card,
  Heading,
  KoreanText,
  Pill,
  Spacer,
  spacing,
  useLayoutClass,
  useEffectiveFontScale,
} from '@hangul-route/design-system';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import { useRomanizationMode } from '../../i18n/use-romanization-mode';
import type { PlaySpec } from '../../logic/audio/controller';
import type { RecapWord } from '../../logic/story/recap';
import {
  RECAP_WORD_CELL,
  longestRecapGlyphs,
  notePlayed,
  recapChipView,
  recapColumns,
  recapPlayedPayload,
  recapSpeech,
} from '../../logic/story/recap-view';
import { focusForScreenReader } from '../../platform/screen-reader';
import { track } from '../../platform/telemetry';
import { SpeakerButton } from './ReaderParts';

interface Props {
  /** From `recapWords(story, level)`; never empty (the check step skips the recap then). */
  words: readonly RecapWord[];
  storyId: string;
  profileId: string | undefined;
  /** No Korean voice on this device: the shared "Say it yourself" chip shows; the text carries every word. */
  sayIt: boolean;
  /** The check step's audio chain (`useReaderAudio`): a newer play cuts the previous one. */
  play: (steps: readonly PlaySpec[]) => void;
  /** Done: the check step completes (`markStepComplete`, `onFinish`). */
  onDone: () => void;
}

/**
 * The word recap at the end of the story check step (F-STORY-003 §3.6,
 * wireframe design/wireframes/story/word-recap.md E, brief
 * design/brief/screens/22-story-check.md frame 5). The new words of the story
 * once more: a chip per word (Korean at title size, romanization subject to
 * the D2 setting, the gloss, a 64 dp speaker), two columns from 360 dp, and
 * Done. Unscored and never blocking. The speaker is the chip's one play
 * control (the Korean is plain text): a tap plays the word (its clip, else
 * Korean speech) and, the first time per word in this visit, records
 * `story.recap.word_played`; with no Korean voice ("Say it yourself") the
 * speaker stays (F-AUDIO-004 §3.8) but records nothing. The rules live in
 * `logic/story/recap-view.ts`.
 */
export function StoryWordRecap({ words, storyId, profileId, sayIt, play, onDone }: Props): React.ReactElement {
  const romanizationMode = useRomanizationMode();
  const m = useMessages();
  const copy = m.learner.story.recap;
  const width = useLayoutClass().windowWidth;
  // Larger device text needs more room per chip (web reports 1).
  // OS text size x the chosen Display text size (owner items 6 and 7).
  const fontScale = useEffectiveFontScale();
  const columns = recapColumns(width, longestRecapGlyphs(words), fontScale);
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(() => new Set());
  const played = useRef<ReadonlySet<string>>(new Set());
  const headingRef = useRef<View | null>(null);

  // The Next button that had focus is gone: focus lands on the recap heading (web: the DOM node).
  useEffect(() => {
    focusForScreenReader(headingRef.current);
  }, []);

  const hear = useCallback(
    (word: RecapWord): void => {
      play([recapSpeech(word)]);
      // Hearing a word shows how to say it (hide-until-tap mode), as in the reader.
      setRevealed((r) => (r.has(word.id) ? r : new Set([...r, word.id])));
      const out = notePlayed(played.current, word.id, !sayIt);
      played.current = out.played;
      if (out.track) {
        void track({ name: 'story.recap.word_played', profileId, payload: recapPlayedPayload(storyId, word.id) });
      }
    },
    [play, profileId, storyId, sayIt],
  );

  return (
    <View testID="story-recap">
      <View
        ref={headingRef}
        tabIndex={-1}
        accessible={Platform.OS !== 'web'}
        accessibilityRole={Platform.OS !== 'web' ? 'header' : undefined}
        accessibilityLabel={Platform.OS !== 'web' ? copy.title : undefined}
      >
        <Heading level="title" testID="story-recap-title">
          {copy.title}
        </Heading>
      </View>
      {sayIt ? (
        <>
          <Spacer size="sm" />
          <View style={{ alignSelf: 'flex-start' }}>
            <Pill label={m.learner.story.reader.sayItYourself.pill} tone="info" testID="story-recap-say-it" />
          </View>
        </>
      ) : null}
      <Spacer size="lg" />
      <View
        role="list"
        aria-label={copy.wordsLabel(words.length)}
        accessibilityLabel={copy.wordsLabel(words.length)}
        testID="story-recap-words"
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}
      >
        {words.map((word) => {
          const chip = recapChipView(word, { romanizationMode, revealed }, copy, m.a11y.koreanItem);
          return (
            <View key={chip.id} role="listitem" style={RECAP_WORD_CELL[columns]} testID={`story-recap-word-${chip.id}`}>
              {/* Stacked and centred: the Korean keeps the chip's full width, so a word never breaks across lines. */}
              <Card tone="paper" padding="md" elevation="card" style={{ flexGrow: 1 }}>
                <View style={{ alignItems: 'center', gap: spacing.sm }}>
                  <KoreanText
                    ko={chip.ko}
                    romanization={chip.romanization}
                    gloss={chip.gloss}
                    size="sm"
                    accessibilityLabel={chip.accessibilityLabel}
                    testID={`story-recap-text-${chip.id}`}
                  />
                  {chip.revealNeeded ? (
                    <Button
                      label={m.learner.story.check.showRomanization.cta}
                      accessibilityLabel={chip.revealLabel}
                      tone="ghost"
                      size="md"
                      onPress={() => setRevealed((r) => new Set([...r, chip.id]))}
                      testID={`story-recap-reveal-${chip.id}`}
                    />
                  ) : null}
                  <SpeakerButton label={chip.hearLabel} onPress={() => hear(word)} testID={`story-recap-hear-${chip.id}`} />
                </View>
              </Card>
            </View>
          );
        })}
      </View>
      <Spacer size="xl" />
      <Button label={copy.done.cta} tone="primary" size="hero" fullWidth onPress={onDone} testID="story-recap-done" />
    </View>
  );
}
