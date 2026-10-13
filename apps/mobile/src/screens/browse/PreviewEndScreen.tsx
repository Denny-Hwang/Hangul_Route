import { Body, Button, Heading, Hoya, Screen, Spacer, spacing, touchTarget, useLayoutClass } from '@hangul-route/design-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { View } from 'react-native';
import { cardById } from '../../content';
import { useMessages } from '../../i18n/use-messages';
import { itemFacts } from '../../logic/browse/facts';
import { BROWSE_ACTION_MAX_WIDTH } from '../../logic/browse/layout';
import { endCardId, nextLesson, nextStory, storyPreviewParams } from '../../logic/browse/preview';
import type { BrowseStackParamList } from '../../navigation/browse';
import { useBrowseSession } from './browse-session';
import { CardRow } from './browse-ui';
import { PreviewFrame } from './PreviewFrame';
import { beginPreview } from './preview-session';

/**
 * The preview end screen (F-BROWSE-001 section 4.8, BD9, OD-6; mock
 * `design/screens/browse/preview-end.md`). It replaces the learner Results:
 * no stars, no score, no accuracy and no card animation. It says what a
 * learner gets here and names the card as a still thumbnail. Actions:
 * [[ Next lesson ]] (catalogue order; a closed one opens its page in closed
 * form and never plays; hidden after the last lesson, when [[ Back to the
 * lesson page ]] leads), [ Preview again ] and [ Back to the lesson page ].
 * A story: "That is the whole story." with Next story, Read again and Back to
 * the story page. The strip stays, with no Leave button.
 */
type Props = NativeStackScreenProps<BrowseStackParamList, 'PreviewEnd'>;

export function PreviewEndScreen({ route, navigation }: Props): React.ReactElement {
  const m = useMessages().caregiver.browse.end;
  const { bundle, pass, gatingEnabled } = useBrowseSession();
  const { kind, id, episodeId } = route.params;
  const compact = useLayoutClass().width === 'compact';
  const input = { bundle, scope: pass?.scope ?? ('sampler' as const), gatingEnabled };
  const story = kind === 'story';

  const toItem = (): void => navigation.navigate('BrowseItem', { kind, id });
  const lesson = story ? null : nextLesson(id, input);
  const nextTale = story ? nextStory(id, input) : null;
  const cardId = story ? null : endCardId(bundle, id);
  const card = cardId ? cardById(cardId) : undefined;

  const again = (): void => {
    beginPreview(kind, id);
    if (story) {
      const facts = itemFacts({ kind: 'story', id }, bundle);
      if (facts?.kind === 'story') navigation.replace('StoryReader', storyPreviewParams(id, facts.defaultLevel));
      else toItem();
    } else {
      navigation.replace('PreviewQuest', { questId: id, episodeId: episodeId ?? '' });
    }
  };

  const next = (): void => {
    if (lesson) {
      if (!lesson.open) {
        navigation.navigate('BrowseItem', { kind: 'quest', id: lesson.questId });
        return;
      }
      beginPreview('quest', lesson.questId);
      navigation.replace('PreviewQuest', { questId: lesson.questId, episodeId: lesson.episodeId });
      return;
    }
    if (nextTale) {
      if (!nextTale.open) {
        navigation.navigate('BrowseItem', { kind: 'story', id: nextTale.storyId });
        return;
      }
      const facts = itemFacts({ kind: 'story', id: nextTale.storyId }, bundle);
      if (facts?.kind !== 'story') return;
      beginPreview('story', nextTale.storyId);
      navigation.replace('StoryReader', storyPreviewParams(nextTale.storyId, facts.defaultLevel));
    }
  };

  const hasNext = lesson !== null || nextTale !== null;
  const button = (label: string, onPress: () => void, primary: boolean, testID: string): React.ReactElement => (
    <View style={{ width: '100%', maxWidth: compact ? undefined : BROWSE_ACTION_MAX_WIDTH }}>
      <Button label={label} tone={primary ? 'primary' : 'ghost'} size={primary ? 'lg' : 'md'} fullWidth onPress={onPress} testID={testID} />
    </View>
  );

  return (
    <PreviewFrame>
      <Screen tone="canvas" scrollable testID="browse-preview-end">
        <View style={{ alignItems: 'center', gap: spacing.md }}>
          <Spacer size="lg" />
          <Hoya pose="cheering" size={touchTarget.hero} />
          <Heading level="title" align="center">
            {story ? m.story.title : m.lesson.title}
          </Heading>
          <Body align="center">{story ? m.story.line : card ? m.lesson.line : m.lesson.lineNoCard}</Body>
          {card ? (
            <View style={{ alignSelf: 'stretch', alignItems: 'center' }}>
              <View style={{ width: '100%', maxWidth: compact ? undefined : BROWSE_ACTION_MAX_WIDTH }}>
                <CardRow card={card} size="end" onPress={() => navigation.navigate('CardDetail', { cardId: card.id })} testID="browse-end-card" />
              </View>
            </View>
          ) : null}
          <Spacer size="sm" />
          <View style={{ alignSelf: 'stretch', alignItems: 'center', gap: spacing.sm }}>
            {hasNext ? button(story ? m.nextStory.cta : m.next.cta, next, true, 'browse-end-next') : null}
            {/* After the last one, Back leads and Preview again stays a ghost button under it (mock, variants). */}
            {hasNext ? null : button(story ? m.backToStory.cta : m.back.cta, toItem, true, 'browse-end-back')}
            {button(story ? m.readAgain.cta : m.again.cta, again, false, 'browse-end-again')}
            {hasNext ? button(story ? m.backToStory.cta : m.back.cta, toItem, false, 'browse-end-back') : null}
          </View>
          <Spacer size="xl" />
        </View>
      </Screen>
    </PreviewFrame>
  );
}
