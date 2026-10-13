import type { VocabTopic } from '@hangul-route/content-schema';
import { Screen } from '@hangul-route/design-system';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { bundleOs, flags, gatingActive } from '../../config/flags';
import { localizedGloss } from '../../content/vocab';
import { useLocale } from '../../i18n/use-messages';
import { isContentLocked } from '../../logic/content-access';
import { backOrHome } from '../../logic/navigation/screen-exits';
import { matchBoard, matchScope } from '../../logic/vocab/match-board';
import { emptyVocab, vocabOf } from '../../logic/vocab/progress';
import type { RootStackParamList } from '../../navigation/types';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';
import { useAccessTier } from '../../store/tier-store';
import { useVocabRunStore, vocabHost } from '../../store/vocab-run-store';
import type { MinigameHost } from '../minigames/host';
import { PicWordMatchGame } from '../minigames/PicWordMatchGame';
import { BackButton } from './BackButton';
import { canRenderPicture, pickerTopic, topicWords } from './topic-data';

type Props = NativeStackScreenProps<RootStackParamList, 'VocabMatch'>;
type Navigation = NativeStackNavigationProp<RootStackParamList, 'VocabMatch'>;

/**
 * Words Match (F-VOC-003 §3.9, PR C-6; design/screens/vocab/match.md): one
 * F-QUEST-002 Pic-Word Match board of the topic's collected words, played
 * through the vocab host (`vocab-run-store`), which writes each first answer
 * (`source: 'match'`) and the session when the board is done. The board is
 * `logic/vocab/match-board.ts`. A topic the picker does not show, a locked one
 * (gating on only, D5) or one with fewer than 3 playable collected words goes
 * to the topic page instead, which says "Topic not found", opens the grown-up
 * gate or leads to Learn.
 */
export function VocabMatchScreen({ route, navigation }: Props): React.ReactElement {
  const { topicKey } = route.params;
  const topic = pickerTopic(topicKey);
  const profile = useProfileStore(activeProfileSelector);
  const tier = useAccessTier(profile?.id ?? '');
  const locked = topic !== undefined && isContentLocked({ kind: 'vocab-topic', id: topic.key, tier, gatingEnabled: gatingActive(flags, bundleOs()) });
  const usable = topic !== undefined && !locked;

  useEffect(() => {
    if (!usable) navigation.replace('VocabTopic', { topicKey });
  }, [usable, navigation, topicKey]);

  if (!usable) return <Screen tone="canvas" testID="vocab-match-redirect">{null}</Screen>;
  return <MatchSession key={topic.key} source={topic} navigation={navigation} />;
}

function MatchSession({ source, navigation }: { source: VocabTopic; navigation: Navigation }): React.ReactElement {
  const topicKey = source.key;
  const locale = useLocale();
  const profile = useProfileStore(activeProfileSelector);
  const profileId = profile?.id ?? null;
  const snap = useProgressStore((s) => (profileId ? s.byProfile[profileId] : undefined));
  // The board is dealt once, from the words collected when the screen opened. Its identity never follows the
  // UI language (a language change mid-board must not restart the run); the meanings follow it at render.
  const [dealt] = useState(() =>
    matchBoard(topicWords(topicKey), snap ? vocabOf(snap) : emptyVocab(), { seed: Date.now(), canRender: canRenderPicture, glossOf: (item) => item.en }),
  );
  const scope = useMemo(() => {
    if (dealt === null) return null;
    const byId = new Map(topicWords(topicKey).map((item) => [item.id, item]));
    const pairs = dealt.pairs.map((p) => {
      const item = byId.get(p.id);
      return item ? { ...p, word: { ...p.word, en: localizedGloss(item, locale) } } : p;
    });
    return matchScope({ ...dealt, pairs });
  }, [dealt, topicKey, locale]);

  const back = useCallback(() => backOrHome(navigation, () => navigation.navigate('VocabTopic', { topicKey })), [navigation, topicKey]);

  // The run: begun when the board shows, written once when it is done; left early, nothing is written.
  const done = useRef(false);
  // Pairs matched so far: a board whose last pair landed is finished, even when the learner leaves inside the
  // game's short pause before it reports the end.
  const matched = useRef(new Set<string>());
  useEffect(() => {
    if (dealt === null || profileId === null) return;
    useVocabRunStore.getState().begin(profileId, topicKey, 'match');
    return () => {
      if (done.current) return;
      if (matched.current.size >= dealt.pairs.length) useVocabRunStore.getState().complete();
      else useVocabRunStore.getState().reset();
    };
  }, [dealt, profileId, topicKey]);

  // No board (the words cannot share one): back to the topic page it came from, or the topic page in its place.
  useEffect(() => {
    if (dealt !== null) return;
    const routes = navigation.getState().routes;
    const before = routes[routes.length - 2];
    const fromTopic = before?.name === 'VocabTopic' && (before.params as { topicKey?: string } | undefined)?.topicKey === topicKey;
    if (fromTopic) navigation.goBack();
    else navigation.replace('VocabTopic', { topicKey });
  }, [dealt, navigation, topicKey]);

  const host = useMemo<MinigameHost>(
    () => ({
      mode: 'vocab',
      answer: (key, correct, meta) => {
        if (correct && meta?.itemId !== undefined) matched.current.add(meta.itemId);
        vocabHost.answer(key, correct, meta);
      },
      complete: () => {
        done.current = true;
        vocabHost.complete();
        back();
      },
    }),
    [back],
  );

  if (scope === null) return <Screen tone="canvas" testID="vocab-match-redirect">{null}</Screen>;
  return <PicWordMatchGame scope={scope} host={host} onBack={back} leading={<BackButton onPress={back} />} showCount={false} />;
}
