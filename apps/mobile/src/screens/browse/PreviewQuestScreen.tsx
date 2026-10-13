import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useMessages } from '../../i18n/use-messages';
import { previewQuestPorts } from '../../logic/quest-flow/quest-player-ports';
import type { BrowseStackParamList } from '../../navigation/browse';
import { useQuestRunStore } from '../../store/quest-run-store';
import { QuestPlayerView } from '../quest/QuestPlayerView';
import { OopsScreen } from '../system/OopsScreen';
import { LeavePreviewSheet } from './LeavePreviewSheet';
import { PreviewFrame } from './PreviewFrame';
import { endPreview } from './preview-session';

/**
 * A lesson played as the learner sees it (F-BROWSE-001 sections 4.7 and 4.8;
 * mock `design/screens/browse/preview-player.md`): the learner
 * `QuestPlayerView` under the preview strip, with the preview ports. No
 * session starts, no result is recorded, no card is awarded and no learner
 * event is sent: the run lives in `quest-run-store` (memory only) and is reset
 * on leave and finish. The end goes to `PreviewEnd`, never Results; Leave
 * (the strip's, after its confirm, or the lesson's own close and confirm)
 * returns to the item page. The games open as the browse `Minigame` route in
 * the learner's own host modes.
 */
type Props = NativeStackScreenProps<BrowseStackParamList, 'PreviewQuest'>;

export function PreviewQuestScreen({ route, navigation }: Props): React.ReactElement {
  const { questId, episodeId } = route.params;
  const m = useMessages().caregiver.browse;
  const [confirming, setConfirming] = useState(false);

  const toItem = useCallback((): void => {
    endPreview(false);
    navigation.navigate('BrowseItem', { kind: 'quest', id: questId });
  }, [navigation, questId]);

  const ports = useMemo(
    () =>
      previewQuestPorts({
        resetRun: () => useQuestRunStore.getState().reset(),
        toEnd: () => {
          endPreview(true);
          navigation.replace('PreviewEnd', { kind: 'quest', id: questId, episodeId });
        },
        toItem,
      }),
    [navigation, questId, episodeId, toItem],
  );

  // A preview left by the browser's own back still ends (once; the end screen and Leave have already ended it).
  useEffect(() => () => endPreview(false), []);

  const leave = (): void => {
    setConfirming(false);
    useQuestRunStore.getState().reset();
    toItem();
  };

  return (
    <PreviewFrame onLeave={() => setConfirming(true)}>
      <ErrorBoundary fallbackRender={() => <OopsScreen onRetry={leave} actionLabel={m.end.back.cta} />}>
        <QuestPlayerView
          questId={questId}
          episodeId={episodeId}
          ports={ports}
          onOpenGame={(stepIndex) => navigation.navigate('Minigame', { questId, episodeId, stepIndex })}
          onBack={toItem}
        />
      </ErrorBoundary>
      <LeavePreviewSheet visible={confirming} onKeep={() => setConfirming(false)} onLeave={leave} />
    </PreviewFrame>
  );
}
