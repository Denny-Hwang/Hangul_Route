import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AskGate } from '../../logic/access-copy';
import type { BackTarget } from '../../logic/episode-access';
import type { RootStackParamList } from '../../navigation/types';

/**
 * Where the lesson page's preview card goes (F-ENT-003 section 3.7, wireframe
 * episode/detail-access-preview): the ask opens the Plan screen through the gate, and Back to open
 * lessons opens the next lesson page (`openEpisode`: the stack screen replaces itself, the Journey's
 * two panes select the cell), the first free word topic, the Library or the Journey. The view stays
 * free of navigation (F-LAYOUT-001 PR 4); its two hosts pass these.
 */
export interface EpisodeAccessExits {
  onAsk: (gate: AskGate) => void;
  onBackToOpenLessons: (target: BackTarget) => void;
}

export function episodeAccessExits(
  navigation: Pick<NativeStackNavigationProp<RootStackParamList>, 'navigate'>,
  openEpisode: (episodeId: string) => void,
): EpisodeAccessExits {
  return {
    onAsk: (gate) => {
      if (gate.route === 'Paywall') navigation.navigate('Paywall', gate.params);
      else navigation.navigate('PinEntry', gate.params);
    },
    onBackToOpenLessons: (target) => {
      if (target.kind === 'episode') openEpisode(target.episodeId);
      else if (target.kind === 'topic') navigation.navigate('VocabTopic', { topicKey: target.topicKey });
      else if (target.kind === 'library') navigation.navigate('Main', { screen: 'Library' });
      else navigation.navigate('Main', { screen: 'Journey' });
    },
  };
}
