import { Body, Button, Card, Heading, Icon, Screen, Spacer, colors, radii, spacing } from '@hangul-route/design-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { episodeById, episodesAll, stageByKey, themeByKey } from '../../content';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { localizeEpisode, localizeStage, localizeTheme } from '../../logic/content-locale';
import { cellStoriesOpenedEvent, cellStoriesView } from '../../logic/story/cell-stories';
import { defaultStoryIndex } from '../../logic/story/story-index';
import type { RootStackParamList } from '../../navigation/types';
import { track } from '../../platform/telemetry';
import { StoryTileGrid, useStoryTiles, useTileGridWidth } from '../library/StoryTileGrid';
import { CellLinkRow } from './CellLinkRow';

type Props = NativeStackScreenProps<RootStackParamList, 'CellStories'>;

/** The decorative theme accent beside the header (brief 27 §3). */
const ACCENT = spacing.md;

/**
 * The heritage stories of one grid cell (F-STORY-005 §3.6; wireframe design/wireframes/story/cell-stories.md B,
 * brief design/brief/screens/27-cell-stories.md): "<Stage> · <Theme>", the cell's lesson or book first as a
 * secondary row so it is never hidden, then the cell's stories as the Library's `StoryTile`s in shelf order.
 * No primary button, no counts of unread stories, no ranking, no timer. A stale link to a cell with no
 * story shows one calm card and Back. `journey.cell_stories_opened` is sent once per open.
 */
export function CellStoriesScreen({ route, navigation }: Props): React.ReactElement {
  const { stage, theme, source } = route.params;
  const messages = useMessages();
  const m = messages.learner.journey.cellStories;
  const locale = useLocale();

  const view = useMemo(() => cellStoriesView({ stage, theme, episodes: episodesAll, index: defaultStoryIndex() }), [stage, theme]);
  const tiles = useStoryTiles(view.entries);
  const grid = useTileGridWidth();

  const stageDef = stageByKey(stage);
  const themeDef = themeByKey(theme);
  const stageTitle = stageDef ? localizeStage(stageDef, locale).titleEn : '';
  const themeTitle = themeDef ? localizeTheme(themeDef, locale).titleEn : '';
  const lessonSource = view.lessonEpisodeId ? episodeById(view.lessonEpisodeId) : undefined;
  const lesson = lessonSource ? localizeEpisode(lessonSource, locale) : undefined;

  const { profileId } = tiles;
  // Once per open (`view` is memoised on the cell): a progress change re-renders without a second event.
  useEffect(() => {
    const opened = cellStoriesOpenedEvent(view, source);
    void track({ name: opened.name, profileId, payload: { ...opened.payload } });
  }, [view, source, profileId]);

  const back = (): void => navigation.goBack();

  return (
    <Screen tone="canvas" scrollable>
      <View testID="cell-stories">
        <Pressable
          onPress={back}
          hitSlop={spacing.md}
          accessibilityRole="button"
          accessibilityLabel={messages.a11y.goBack}
          style={{ alignSelf: 'flex-start', padding: spacing.xs }}
        >
          <Icon name="arrow-left" size={spacing.xxl} />
        </Pressable>
        <Spacer size="sm" />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View
            aria-hidden
            importantForAccessibility="no"
            style={{ width: ACCENT, height: ACCENT, borderRadius: radii.circle, backgroundColor: colors.theme[theme] }}
          />
          <View style={{ flex: 1 }}>
            <Heading level="title" testID="cell-stories-title">
              {m.title(stageTitle, themeTitle)}
            </Heading>
          </View>
        </View>
        <Spacer size="xs" />
        <Body tone="secondary">{m.subtitle}</Body>

        {lesson ? (
          <>
            <Spacer size="lg" />
            <CellLinkRow
              label={m.lessonRow(lesson.titleEn)}
              onPress={() => navigation.navigate('EpisodeDetail', { episodeId: lesson.id })}
              testID="cell-stories-lesson"
            />
          </>
        ) : null}

        <Spacer size="lg" />
        {tiles.items.length > 0 ? (
          <StoryTileGrid tiles={tiles} grid={grid} testID="cell-stories-grid" />
        ) : (
          <Card padding="md" tone="sunken" testID="cell-stories-empty">
            <Body weight="semibold">{m.empty}</Body>
            <Spacer size="md" />
            <View style={{ alignSelf: 'flex-start' }}>
              <Button label={messages.common.buttons.back} tone="secondary" size="md" onPress={back} testID="cell-stories-back" />
            </View>
          </Card>
        )}
        <Spacer size="xxl" />
      </View>
    </Screen>
  );
}
