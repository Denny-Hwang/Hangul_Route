import {
  Button,
  Card,
  Heading,
  KoreanText,
  Pill,
  Spacer,
  spacing,
  useLayoutClass,
} from '@hangul-route/design-system';
import type { RomanizationMode } from '@hangul-route/i18n';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import type { PlaySpec } from '../../logic/audio/controller';
import type { RecapWord } from '../../logic/story/recap';
import {
  RECAP_WORD_CELL,
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
  romanizationMode: RomanizationMode;
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
 * Done. Unscored and never blocking. A speaker tap plays the word (its clip,
 * else Korean speech) and, the first time per word in this visit, records
 * `story.recap.word_played`. The rules live in `logic/story/recap-view.ts`.
 */
export function StoryWordRecap({ words, storyId, profileId, romanizationMode, sayIt, play, onDone }: Props): React.ReactElement {
  const m = useMessages();
  const copy = m.learner.story.recap;
  const width = useLayoutClass().windowWidth;
  const columns = recapColumns(width);
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
      const out = notePlayed(played.current, word.id);
      played.current = out.played;
      if (out.track) {
        void track({ name: 'story.recap.word_played', profileId, payload: recapPlayedPayload(storyId, word.id) });
      }
    },
    [play, profileId, storyId],
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
              <Card tone="paper" padding="md" elevation="card" style={{ flexGrow: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <KoreanText
                      ko={chip.ko}
                      romanization={chip.romanization}
                      gloss={chip.gloss}
                      size="sm"
                      onPress={() => hear(word)}
                      accessibilityLabel={chip.accessibilityLabel}
                      testID={`story-recap-text-${chip.id}`}
                    />
                  </View>
                  <SpeakerButton label={chip.hearLabel} onPress={() => hear(word)} testID={`story-recap-hear-${chip.id}`} />
                </View>
                {chip.revealNeeded ? (
                  <>
                    <Spacer size="xs" />
                    <View style={{ alignSelf: 'flex-start' }}>
                      <Button
                        label={m.learner.story.check.showRomanization.cta}
                        tone="ghost"
                        size="md"
                        onPress={() => setRevealed((r) => new Set([...r, chip.id]))}
                        testID={`story-recap-reveal-${chip.id}`}
                      />
                    </View>
                  </>
                ) : null}
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
