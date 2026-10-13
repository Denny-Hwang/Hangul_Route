import { Screen, Spacer, useLayoutClass } from '@hangul-route/design-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { useMessages } from '../../i18n/use-messages';
import { episodeOutline } from '../../logic/browse/facts';
import { accessOf, itemViewedEvent } from '../../logic/browse/home-view';
import type { BrowseStackParamList } from '../../navigation/browse';
import { EpisodeOutlineView } from './EpisodeOutlineView';
import { HeaderBack, HeaderRow, useItemViewed } from './browse-ui';
import { useBrowseSession } from './browse-session';

/**
 * The episode outline screen (F-BROWSE-001 section 4.6; mock
 * `design/screens/browse/episode.md`): the back arrow ("Back to all lessons")
 * in the one fixed top-left position, then the outline. No Lesson display on
 * this page. An id this build does not hold sends home with the
 * not-in-this-version line.
 */
type Props = NativeStackScreenProps<BrowseStackParamList, 'BrowseEpisode'>;

export function BrowseEpisodeScreen({ route, navigation }: Props): React.ReactElement {
  const m = useMessages().caregiver.browse;
  const { bundle, pass, gatingEnabled } = useBrowseSession();
  const { episodeId } = route.params;
  const known = episodeOutline(episodeId, bundle) !== null;
  const wide = useLayoutClass().width !== 'compact';
  const access = pass ? accessOf({ kind: 'episode', id: episodeId }, { bundle, scope: pass.scope, gatingEnabled }) : 'access';
  useItemViewed(known && pass ? itemViewedEvent('episode', episodeId, access) : null);

  useEffect(() => {
    if (!known) navigation.replace('BrowseHome', { note: 'not-in-version' });
  }, [known, navigation]);

  const back = (): void => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('BrowseHome', {});
  };

  return (
    <Screen tone="canvas" scrollable width={wide ? 'full' : 'reading'} testID="browse-episode-screen">
      <HeaderRow back={<HeaderBack label={m.episode.back} showLabel={false} onPress={back} testID="browse-back" />} />
      <Spacer size="sm" />
      {known ? (
        <EpisodeOutlineView
          episodeId={episodeId}
          onOpenItem={(item) => navigation.navigate('BrowseItem', item)}
          onOpenCard={(cardId) => navigation.navigate('CardDetail', { cardId })}
        />
      ) : null}
      <Spacer size="xl" />
    </Screen>
  );
}
