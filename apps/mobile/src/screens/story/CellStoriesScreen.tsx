import { Body, Button, Card, Heading, Screen, Spacer, colors, radii, spacing } from '@hangul-route/design-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';
import { episodeById, episodesAll, stageByKey, themeByKey } from '../../content';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { localizeEpisode, localizeStage, localizeTheme } from '../../logic/content-locale';
import { cellStoriesOpenKey, cellStoriesOpenedEvent, cellStoriesView, episodeOpenFromCellPage } from '../../logic/story/cell-stories';
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
  // A tile or the lesson row: Back when the page under this one is that episode, else push (so Back returns here).
  const openEpisode = useCallback(
    (episodeId: string): void => {
      const state = navigation.getState();
      const under = state.routes[state.index - 1];
      if (episodeOpenFromCellPage(under, episodeId) === 'back') navigation.goBack();
      else navigation.push('EpisodeDetail', { episodeId });
    },
    [navigation],
  );
  const tiles = useStoryTiles(view.entries, openEpisode);
  const grid = useTileGridWidth();

  const stageDef = stageByKey(stage);
  const themeDef = themeByKey(theme);
  // A link with a stage or theme the bundle does not know (only ever a stale or hand-made one) shows
  // the calm empty card with no "<Stage> · <Theme>" header and sends no event (§3.11: known keys only).
  const header =
    stageDef && themeDef ? m.title(localizeStage(stageDef, locale).titleEn, localizeTheme(themeDef, locale).titleEn) : null;
  const known = header !== null;
  const lessonSource = view.lessonEpisodeId ? episodeById(view.lessonEpisodeId) : undefined;
  const lesson = lessonSource ? localizeEpisode(lessonSource, locale) : undefined;

  // The profile id rides along as of the open; it resolving or changing later is not a second open.
  const profileIdRef = useRef(tiles.profileId);
  profileIdRef.current = tiles.profileId;
  // Once per open: on mount, and when a door brings this cell's page back with new params (`getId`
  // returns to it), never on a progress change or on Back from a story opened here. A second tap on a
  // door before the page has left (same cell, same door) only swaps in equal params: not a second open.
  const lastOpenRef = useRef<string | null>(null);
  useEffect(() => navigation.addListener('blur', () => (lastOpenRef.current = null)), [navigation]);
  useEffect(() => {
    if (!known) return;
    const key = cellStoriesOpenKey({ stage, theme, source });
    if (lastOpenRef.current === key) return;
    lastOpenRef.current = key;
    const opened = cellStoriesOpenedEvent(view, source);
    void track({ name: opened.name, profileId: profileIdRef.current, payload: { ...opened.payload } });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the open (the params object), see above
  }, [route.params]);

  const back = (): void => navigation.goBack();

  return (
    <Screen tone="canvas" scrollable>
      <View testID="cell-stories">

        {header !== null ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <View
                aria-hidden
                importantForAccessibility="no"
                style={{ width: ACCENT, height: ACCENT, borderRadius: radii.circle, backgroundColor: colors.theme[theme] }}
              />
              <View style={{ flex: 1 }}>
                <Heading level="title" testID="cell-stories-title">
                  {header}
                </Heading>
              </View>
            </View>
            <Spacer size="xs" />
            <Body tone="secondary">{m.subtitle}</Body>
          </>
        ) : (
          <Heading level="title" testID="cell-stories-title-unknown">
            {m.subtitle}
          </Heading>
        )}

        {lesson ? (
          <>
            <Spacer size="lg" />
            <CellLinkRow
              label={view.lessonKind === 'book' ? m.bookRow(lesson.titleEn) : m.lessonRow(lesson.titleEn)}
              onPress={() => openEpisode(lesson.id)}
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
