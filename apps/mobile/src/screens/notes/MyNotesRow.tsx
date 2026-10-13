import { Body, Card, Icon, Spacer, colors, spacing, touchTarget } from '@hangul-route/design-system';
import React, { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { flags } from '../../config/flags';
import { useMessages } from '../../i18n/use-messages';
import { myNotesRowView } from '../../logic/notes/screens';
import { CARD_GLYPH, NewPill } from './parts';
import { useActiveNotes } from './use-notes';

/**
 * "My notes" on Profile (F-FEEDBACK-001 section 6.5 item 2; mock notes-list.md, "Profile row"):
 * only with the flag on and a class or family membership or a cached note, so a self-learner with
 * neither never sees it. The `New` pill while a note shown on this device is unread. The row's name
 * is its visible text. Renders nothing (and no gap) when hidden.
 */
export function MyNotesRow({ onOpen }: { onOpen: () => void }): React.ReactElement | null {
  return flags.notesEnabled ? <MyNotesRowInner onOpen={onOpen} /> : null;
}

function MyNotesRowInner({ onOpen }: { onOpen: () => void }): React.ReactElement | null {
  const m = useMessages();
  const { data, memberships } = useActiveNotes();
  const row = useMemo(() => myNotesRowView({ enabled: true, memberships, data: data ?? null }), [memberships, data]);
  if (row === null) return null;
  const title = m.learner.notes.profileRow.title;
  return (
    <>
      <Spacer size="lg" />
      <Card padding="md">
        <Pressable
          testID="profile-notes-row"
          onPress={onOpen}
          accessibilityRole="button"
          style={{ minHeight: touchTarget.min, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
        >
          <Icon name="note" size={CARD_GLYPH} color={colors.text.secondary} />
          <Body weight="semibold" style={{ flex: 1 }}>
            {title}
          </Body>
          {row.isNew ? <NewPill /> : null}
          <View>
            <Icon name="arrow-right" size={CARD_GLYPH} color={colors.text.muted} />
          </View>
        </Pressable>
      </Card>
    </>
  );
}
