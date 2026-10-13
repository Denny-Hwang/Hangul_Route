import { Body, Icon, borderWidth, colors, radii, spacing, touchTarget } from '@hangul-route/design-system';
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { PromptPanel } from '../../components/PromptPanel';
import { usePromptSlot } from '../../components/use-prompt-slot';
import { VoiceHelpSheet } from '../../components/VoiceHelpSheet';
import { useMessages } from '../../i18n/use-messages';
import type { TopicWordFact } from '../../logic/browse/facts';
import { TOPIC_HEAR_SOURCE, topicHearSpec } from '../../logic/browse/topic-view';
import { playPrompt, stop } from '../../platform/audio';
import { PictureArt } from '../minigames/PictureArt';
import { KoChip, focusRing, type FocusState } from './browse-ui';

/**
 * The word list of a word topic in All lessons (F-BROWSE-001 sections 4.6 and
 * 4.7, BR-9; mock `design/screens/browse/topic.md`, README decisions 18 and
 * 23). One row per word: its 64 picture tile, the Korean with its
 * romanization, the gloss in the UI language and a 64 Hear button that plays
 * the word through the learner audio (its recording when bundled, else the
 * device voice, `playPrompt`), which writes nothing. Until F-VOC-003's
 * flashcards come to All lessons, this list is the topic's preview: a closed
 * topic (`hear` false) keeps every word and drops only the Hear buttons.
 */

/** The picture tile of a row (`touchTarget.min`, the mock's 64 tile). */
const ART = touchTarget.min;

export function TopicWordList({ words, hear }: { words: readonly TopicWordFact[]; hear: boolean }): React.ReactElement {
  const m = useMessages().caregiver.browse;
  // The Korean and its romanization are printed beside every button: the panel only says why it is silent.
  const slot = usePromptSlot({ source: TOPIC_HEAR_SOURCE, textOnScreen: true });
  const [last, setLast] = useState<TopicWordFact | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  // Leaving the page stops a word mid-way.
  useEffect(() => () => stop(), []);

  const play = (word: TopicWordFact): void => {
    setLast(word);
    void slot.play(() => playPrompt(topicHearSpec(word)));
  };

  return (
    <View testID="browse-topic-words">
      {words.map((word, i) => (
        <View
          key={word.id}
          testID={`browse-topic-word-${word.id}`}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            paddingVertical: spacing.sm,
            borderTopWidth: i === 0 ? 0 : borderWidth.thin,
            borderTopColor: colors.border.subtle,
          }}
        >
          <PictureArt pictureRef={word.visual} gloss={word.gloss} size={ART} decorative />
          <View style={{ flex: 1, gap: spacing.xxs, alignItems: 'flex-start' }}>
            <KoChip ko={word.ko} romanization={word.romanization} />
            <Body tone="secondary">{word.gloss}</Body>
          </View>
          {hear ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={m.topic.hearA11y(word.romanization)}
              onPress={() => play(word)}
              testID={`browse-topic-hear-${word.id}`}
              style={({ pressed, focused }: FocusState) => ({
                width: touchTarget.min,
                height: touchTarget.min,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radii.pill,
                backgroundColor: pressed ? colors.brand.secondaryLight : colors.surface.paper,
                ...focusRing(focused, colors.brand.secondary),
              })}
            >
              <Icon name="speaker" size={24} color={colors.brand.secondary} />
            </Pressable>
          ) : null}
        </View>
      ))}
      {hear ? (
        <>
          <PromptPanel
            variant="status"
            view={slot.view}
            onAction={(action) => slot.act(action, () => last && play(last))}
            onHelp={() => setHelpOpen(true)}
          />
          <VoiceHelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} />
        </>
      ) : null}
    </View>
  );
}
