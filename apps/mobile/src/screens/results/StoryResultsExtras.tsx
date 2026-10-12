import { Body, Button, Caption, Card, KoreanText, Spacer, spacing } from '@hangul-route/design-system';
import React from 'react';
import { View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import type {
  StoryResultsExtras as StoryResultsExtrasView,
  StoryResultsPrimary,
  StoryResultsSecondary,
} from '../../logic/story/results-extras';

export type StoryResultsChoice = StoryResultsPrimary | StoryResultsSecondary | { action: 'culture-note'; noteId: string };

interface Props {
  /** From `storyResultsExtras` (logic/story/results-extras): this component only paints it. */
  extras: StoryResultsExtrasView;
  /** The screen navigates and records `story.results.action`. */
  onChoose: (choice: StoryResultsChoice) => void;
}

/**
 * The story variant of Results (F-STORY-003 §3.7, wireframe
 * design/wireframes/results/celebrate-story.md H and H2, brief
 * design/brief/screens/22-story-check.md frame 6), drawn under the stars and
 * the card reveal. The story card (title in Korean with its romanization and
 * the title in the UI language; a "Learn about" link when F-STORY-004 supplies
 * a culture note), the reserved F-STORY-006 line, the 0-1 star line, then one
 * primary (Next story, else Back home) and at most two ghosts (Read it again,
 * Episode page). No number anywhere (D3).
 */
export function StoryResultsExtras({ extras, onChoose }: Props): React.ReactElement {
  const m = useMessages();
  const { title, cultureNote, episodeLine, encouragement, primary, secondary } = extras;
  return (
    <View testID="story-results-extras">
      <Card tone="paper" padding="md" elevation="card" testID="story-results-story">
        <View style={{ alignItems: 'flex-start', gap: spacing.xs }}>
          <KoreanText
            ko={title.ko}
            romanization={title.romanization}
            size="sm"
            accessibilityLabel={m.a11y.koreanItem({ ko: title.ko, romanization: title.romanization, gloss: title.en })}
            testID="story-results-title"
          />
          {title.en ? (
            <Body weight="semibold" testID="story-results-title-en">
              {title.en}
            </Body>
          ) : null}
        </View>
        {cultureNote ? (
          <>
            <Spacer size="sm" />
            <View style={{ alignSelf: 'flex-start' }}>
              <Button
                label={cultureNote.label}
                tone="ghost"
                size="md"
                onPress={() => onChoose({ action: 'culture-note', noteId: cultureNote.id })}
                testID="story-results-culture-note"
              />
            </View>
          </>
        ) : null}
      </Card>

      {/* Reserved for F-STORY-006's "Episode complete" line, above the actions. */}
      {episodeLine ? (
        <>
          <Spacer size="md" />
          <Caption tone="secondary" testID="story-results-episode-line">
            {episodeLine}
          </Caption>
        </>
      ) : null}

      {encouragement ? (
        <>
          <Spacer size="md" />
          <Body testID="story-results-encourage">{encouragement}</Body>
        </>
      ) : null}

      <Spacer size="xl" />
      <Button
        label={primary.label}
        tone="primary"
        size="hero"
        fullWidth
        onPress={() => onChoose(primary)}
        testID={`story-results-${primary.action}`}
      />
      {secondary.map((choice) => (
        <React.Fragment key={choice.action}>
          <Spacer size="sm" />
          <Button
            label={choice.label}
            tone="ghost"
            size="lg"
            fullWidth
            onPress={() => onChoose(choice)}
            testID={`story-results-${choice.action}`}
          />
        </React.Fragment>
      ))}
    </View>
  );
}
