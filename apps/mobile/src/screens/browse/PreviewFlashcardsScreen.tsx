import { Screen } from '@hangul-route/design-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useMessages } from '../../i18n/use-messages';
import { previewCardsPorts } from '../../logic/vocab/cards-ports';
import type { BrowseStackParamList } from '../../navigation/browse';
import { OopsScreen } from '../system/OopsScreen';
import { pickerTopic, wordsOffered } from '../vocab/topic-data';
import { CardsSession, type CardsExits } from '../vocab/VocabCardsScreen';
import { LeavePreviewSheet } from './LeavePreviewSheet';
import { PreviewFrame } from './PreviewFrame';
import { beginPreview, endPreview } from './preview-session';

/**
 * A word topic's flashcards as a learner sees them (F-BROWSE-001 section 4.7,
 * vocabulary topic, BR-9b; wireframe `browse/item.md` D, mock
 * `design/screens/browse/topic-states.html`): the learner F-VOC-003 session
 * (`CardsSession`: the cards, the quick check, the chunk summary) under the
 * preview strip, with the preview ports, so the quick check runs in
 * `MinigameHost` mode `'preview'` and nothing is saved: no F-VOC-005
 * vocabulary progress, no reading practice switch (a profile setting), no
 * learner event. Leave (the strip's, after its confirm, or the cards' own
 * back and Stop) and Back to topic return to the topic page. Next words and
 * Review these play another run here; there is no Speed round in a preview.
 */
type Props = NativeStackScreenProps<BrowseStackParamList, 'PreviewFlashcards'>;

export function PreviewFlashcardsScreen({ route, navigation }: Props): React.ReactElement {
  const m = useMessages().caregiver.browse;
  const { topicId, topicKey } = route.params;
  // The learner picker's topic, only while Words is on for learners (the item page offers the preview on the same terms).
  const topic = wordsOffered() ? pickerTopic(topicKey) : undefined;
  const [confirming, setConfirming] = useState(false);
  // The run on screen: Next words and Review these open another run of the same topic in place.
  const [run, setRun] = useState<{ n: number; chunk?: number; ids?: string[] }>({ n: 0 });
  // Lets the strip's Leave and the exits go without the cards' own Keep going question.
  const leavingRef = useRef(false);

  const toItem = useCallback((): void => {
    leavingRef.current = true;
    endPreview(false);
    navigation.navigate('BrowseItem', { kind: 'vocab-topic', id: topicId });
  }, [navigation, topicId]);

  // A topic this build cannot show as cards goes back to its page, which has no preview button for it.
  useEffect(() => {
    if (!topic) toItem();
  }, [topic, toItem]);

  // A preview left by the browser's own back still ends (once; the summary and Leave have already ended it).
  useEffect(() => () => endPreview(false), []);

  const ports = useMemo(() => previewCardsPorts(), []);
  const exits = useMemo<CardsExits>(
    () => ({
      back: toItem,
      next: (params) => {
        beginPreview('vocab-topic', topicId);
        leavingRef.current = false;
        setRun((r) => ({ n: r.n + 1, ...(params.chunk !== undefined ? { chunk: params.chunk } : {}), ...(params.ids ? { ids: params.ids } : {}) }));
      },
      speed: null,
      done: () => endPreview(true),
      guard: (handler) => navigation.addListener('beforeRemove', handler),
      dispatch: (action) => navigation.dispatch(action),
    }),
    [navigation, toItem, topicId],
  );

  const leave = (): void => {
    setConfirming(false);
    toItem();
  };

  if (!topic) return <Screen tone="canvas">{null}</Screen>;
  return (
    <PreviewFrame onLeave={() => setConfirming(true)}>
      <ErrorBoundary fallbackRender={() => <OopsScreen onRetry={leave} actionLabel={m.end.back.cta} />}>
        <CardsSession
          key={run.n}
          source={topic}
          params={{ topicKey, ...(run.chunk !== undefined ? { chunk: run.chunk } : {}), ...(run.ids ? { ids: run.ids } : {}) }}
          ports={ports}
          exits={exits}
          leavingRef={leavingRef}
        />
      </ErrorBoundary>
      <LeavePreviewSheet visible={confirming} onKeep={() => setConfirming(false)} onLeave={leave} />
    </PreviewFrame>
  );
}
