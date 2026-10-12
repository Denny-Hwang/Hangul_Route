import { Body, Heading, Icon, Spacer, borderWidth, colors, radii, spacing, touchTarget } from '@hangul-route/design-system';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { storiesAll } from '../../content/stories';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { localizeStory } from '../../logic/content-locale';
import { foundNotes } from '../../logic/story/culture-notes';
import { cultureNotesCard } from '../../logic/story/culture-notes-view';
import { shelfCopy } from '../../logic/story/shelf-copy';
import type { StoryIndexEntry } from '../../logic/story/story-index';
import type { RootStackParamList } from '../../navigation/types';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';
import { StoryShelf } from './StoryShelf';

/**
 * The Library's Culture section (F-STORY-004 §3.5; wireframe
 * design/wireframes/library/culture.md C, brief
 * design/brief/screens/24-culture-notes.md): the Culture notes card on top
 * ("N found" and the two newest titles, or how notes are found; the whole card
 * opens `CultureNotes`), then the `culture` story tiles exactly as Story Time
 * (`StoryShelf`, which also sends `story.shelf.viewed`).
 */
export function CultureSection({ index }: { index: readonly StoryIndexEntry[] }): React.ReactElement {
  const messages = useMessages();
  const copy = shelfCopy(messages);
  const locale = useLocale();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const profile = useProfileStore(activeProfileSelector);
  const snap = useProgressStore((s) => (profile ? s.byProfile[profile.id] : undefined));
  // Note titles in the UI language (F-CNT-002 overlay).
  const stories = useMemo(() => storiesAll.map((s) => localizeStory(s, locale)), [locale]);
  const card = useMemo(() => cultureNotesCard(foundNotes(index, stories, snap), copy), [index, stories, snap, copy]);
  const hasTiles = index.some((e) => e.placement === 'shelf' && e.category === 'culture');

  return (
    <View testID="library-culture">
      <Pressable
        onPress={() => navigation.navigate('CultureNotes', undefined)}
        accessibilityRole="button"
        accessibilityLabel={card.accessibilityLabel}
        testID="library-culture-notes"
        style={({ pressed }) => ({
          minHeight: touchTarget.min,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          padding: spacing.lg,
          backgroundColor: colors.surface.paper,
          borderRadius: radii.lg,
          borderWidth: borderWidth.base,
          borderColor: pressed ? colors.border.focus : colors.border.subtle,
        })}
      >
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Heading level="prompt">{copy.cultureNotes.title}</Heading>
          {card.foundLine ? (
            <Body weight="semibold" tone="secondary" testID="library-culture-notes-count">
              {card.foundLine}
            </Body>
          ) : null}
          {card.newest.map((title) => (
            <Body key={title} size="sm">
              {title}
            </Body>
          ))}
          {card.emptyLine ? (
            <Body size="sm" tone="secondary">
              {card.emptyLine}
            </Body>
          ) : null}
        </View>
        <Icon name="arrow-right" size={spacing.xl} color={colors.text.secondary} />
      </Pressable>
      {hasTiles ? (
        <>
          <Spacer size="lg" />
          <StoryShelf category="culture" index={index} />
        </>
      ) : null}
    </View>
  );
}
