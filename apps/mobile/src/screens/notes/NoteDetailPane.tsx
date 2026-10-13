import { Body, Button, Hoya, Spacer, spacing, touchTarget } from '@hangul-route/design-system';
import type { NoteReactionId } from '@hangul-route/content-schema';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { episodesAll, questsAll } from '../../content';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { localizeTitle } from '../../logic/content-locale';
import { noteOpenedEvent, reactionPickedEvent, reportLinkA11y, reportLinkTarget, suggestStartTarget, suggestStartedEvent } from '../../logic/notes/screens';
import { noteDetail } from '../../logic/notes/view';
import type { RootStackParamList } from '../../navigation/types';
import { track } from '../../platform/telemetry';
import { useAudience } from '../../store/audience';
import { useNotesStore } from '../../store/notes-store';
import { useQuestAccess } from '../../store/tier-store';
import { NotePage } from './NotePage';
import { useActiveNotes } from './use-notes';

/**
 * One note of the active profile (F-FEEDBACK-001 section 6.5 item 3; mock note-page.md), for the
 * `NoteDetail` stack screen and the right pane of My notes on a wide window. Opening it marks the
 * note read once (local first, queued) and sends `notes.note_opened` once per visit. A note that is
 * not on this device any more (a stale route, or an inbox took it away while it was open) shows
 * "This note was put away." with See my notes; a store that cannot be read shows Try again.
 */
export function NoteDetailPane({
  noteId,
  onPutAway,
  onSeeMyNotes,
}: {
  noteId: string;
  /** After Put this note away: back to My notes, which says it once. */
  onPutAway: () => void;
  onSeeMyNotes: () => void;
}): React.ReactElement | null {
  const m = useMessages();
  const locale = useLocale();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { profileId, data, status, retry, ctx } = useActiveNotes();
  const isQuestOpen = useQuestAccess();
  const { opensDirectly } = useAudience();
  // A self-managed profile (no gate on this device) reads "Report this note" and goes straight to the sheet.
  const selfManaged = opensDirectly(false);
  const view = useMemo(
    () => (data === undefined ? null : noteDetail(data, noteId, ctx, { isQuestOpen, selfManaged })),
    [data, noteId, ctx, isQuestOpen, selfManaged],
  );
  const note = useMemo(() => data?.notes.find((n) => n.id === noteId) ?? null, [data, noteId]);
  const [picked, setPicked] = useState<string | null>(null);
  const opened = useRef<string | null>(null);

  // A new note in the same pane starts a new visit.
  useEffect(() => setPicked(null), [noteId]);

  useEffect(() => {
    if (profileId === null || view === null || note === null) return;
    const visit = `${profileId}|${noteId}`;
    if (opened.current === visit) return;
    opened.current = visit;
    void useNotesStore.getState().markRead(profileId, noteId);
    void track(noteOpenedEvent(note, view));
  }, [profileId, noteId, view, note]);

  const questTitle = useMemo(() => {
    const id = view?.suggest?.questId;
    const quest = id === undefined ? undefined : questsAll.find((q) => q.id === id);
    return quest === undefined ? null : localizeTitle(quest, quest.id, locale).titleEn;
  }, [view, locale]);

  if (status === 'loading' && data === undefined) return null;
  const t = m.learner.notes.detail;

  if (status === 'error' || view === null || note === null || profileId === null) {
    const failed = status === 'error';
    return (
      <View style={{ alignItems: 'center', gap: spacing.md }} testID={failed ? 'note-error' : 'note-gone'}>
        <Hoya pose="idle" size={touchTarget.hero} accessibilityLabel={m.a11y.hoya('idle')} />
        <Body align="center" size="lg">
          {failed ? t.error : t.gone}
        </Body>
        <Spacer size="xs" />
        <Button label={failed ? t.retry.cta : t.seeMyNotes.cta} tone="ghost" size="md" onPress={failed ? retry : onSeeMyNotes} />
      </View>
    );
  }

  const pick = (reaction: NoteReactionId): void => {
    if (view.reaction === reaction) return;
    void useNotesStore.getState().pickReaction(profileId, noteId, reaction);
    void track(reactionPickedEvent(reaction, note.from.role, view.reaction));
    setPicked(m.a11y.notes.reactionPicked(m.common.notes.reactions[reaction]));
  };

  const start = (): void => {
    const target = view.suggest?.open ? suggestStartTarget(view.suggest.questId, episodesAll) : null;
    if (target === null) return;
    void track(suggestStartedEvent(note.from.role));
    navigation.navigate('QuestPlayer', target);
  };

  const putAway = (): void => {
    void useNotesStore.getState().putAway(profileId, noteId);
    onPutAway();
  };

  const report = (): void => {
    const target = reportLinkTarget({ selfManaged, noteId, profileId });
    if (target.screen === 'PinEntry') navigation.navigate('PinEntry', target.params);
    else navigation.navigate('NoteReport', target.params);
  };

  return (
    <NotePage
      view={view}
      questTitle={questTitle}
      picked={picked}
      onPick={pick}
      onStart={start}
      onPutAway={putAway}
      onReport={report}
      reportA11y={reportLinkA11y(m, view.reportLink, selfManaged)}
    />
  );
}
