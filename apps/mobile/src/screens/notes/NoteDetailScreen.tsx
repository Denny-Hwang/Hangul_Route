import { Screen, Spacer } from '@hangul-route/design-system';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import type { RootStackParamList } from '../../navigation/types';
import { backToNotes } from './back-to-notes';
import { NoteDetailPane } from './NoteDetailPane';
import { BackButton } from './parts';

/**
 * notes/detail — the `NoteDetail { noteId }` stack screen (F-FEEDBACK-001 section 6.5 item 3,
 * FB-8; mock design/screens/notes/note-page.md). One centred reading column; reached from the Home
 * card (one new note) and from My notes. Put this note away returns to My notes, which says so once.
 */
export function NoteDetailScreen(): React.ReactElement {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { noteId } = useRoute<RouteProp<RootStackParamList, 'NoteDetail'>>().params;
  return (
    <Screen tone="canvas" scrollable testID="note-detail-screen">
      <BackButton onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Notes'))} />
      <Spacer size="sm" />
      <NoteDetailPane
        noteId={noteId}
        onPutAway={() => backToNotes(navigation, { notice: 'putAway' })}
        onSeeMyNotes={() => backToNotes(navigation)}
      />
      <Spacer size="xl" />
    </Screen>
  );
}
