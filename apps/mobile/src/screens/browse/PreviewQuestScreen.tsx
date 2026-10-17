import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useMessages } from '../../i18n/use-messages';
import { previewReturnTarget } from '../../logic/browse/preview';
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
 * (the strip's Leave preview or the header's Close, both after the one Leave
 * this preview question) returns to the item page. The games open as the browse `Minigame` route in
 * the learner's own host modes.
 */
type Props = NativeStackScreenProps<BrowseStackParamList, 'PreviewQuest'>;

export function PreviewQuestScreen({ route, navigation }: Props): React.ReactElement {
  const { questId, episodeId, returnTo } = route.params;
  const m = useMessages().caregiver.browse;
  const [confirming, setConfirming] = useState(false);

  const toItem = useCallback((): void => {
    endPreview(false);
    // Back to the page the preview started from: a story's questions return to the story (section 4.7).
    navigation.navigate('BrowseItem', previewReturnTarget(questId, returnTo));
  }, [navigation, questId, returnTo]);

  const ports = useMemo(
    () =>
      previewQuestPorts({
        resetRun: () => useQuestRunStore.getState().reset(),
        toEnd: () => {
          endPreview(true);
          navigation.replace('PreviewEnd', { kind: 'quest', id: questId, episodeId, ...(returnTo ? { returnTo } : {}) });
        },
        toItem,
      }),
    [navigation, questId, episodeId, returnTo, toItem],
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
      <ErrorBoundary fallbackRender={() => <OopsScreen onRetry={leave} actionLabel={returnTo?.kind === 'story' ? m.end.backToStory.cta : m.end.back.cta} />}>
        <QuestPlayerView
          questId={questId}
          episodeId={episodeId}
          ports={ports}
          onOpenGame={(stepIndex) => navigation.navigate('Minigame', { questId, episodeId, stepIndex })}
          onBack={toItem}
          // The header's Close (and the browser back) asks Leave this preview, as the strip's Leave preview does.
          onAskLeave={() => setConfirming(true)}
        />
      </ErrorBoundary>
      <LeavePreviewSheet visible={confirming} onKeep={() => setConfirming(false)} onLeave={leave} />
    </PreviewFrame>
  );
}
