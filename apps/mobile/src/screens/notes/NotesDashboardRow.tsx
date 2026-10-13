import { Body, Card, Icon, Spacer, colors, spacing, touchTarget } from '@hangul-route/design-system';
import React, { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import { grownUpRow } from '../../logic/notes/grown-up';
import { CARD_GLYPH, NewPill } from './parts';
import { useProfileNotes } from './use-notes';

/**
 * One dashboard row "Notes for <learner>" (F-FEEDBACK-001 section 6.10 item 1, FB-9; mock
 * grown-up-notes.md A): for a local profile with notes or memberships, with the New pill while a
 * note arrived since a grown-up last opened that learner's notes. The dashboard never lists notes
 * itself. The caller renders it only with `flags.notesEnabled` on.
 */
export function NotesDashboardRow({ profileId, name, onOpen }: { profileId: string; name: string; onOpen: () => void }): React.ReactElement | null {
  const m = useMessages();
  const { data, memberships } = useProfileNotes(profileId);
  const row = useMemo(() => grownUpRow({ data: data ?? null, memberships }), [data, memberships]);
  if (row === null) return null;
  return (
    <>
      <Card padding="md" testID={`dashboard-notes-${profileId}`}>
        <Pressable
          onPress={onOpen}
          accessibilityRole="button"
          style={{ minHeight: touchTarget.min, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
        >
          <Icon name="note" size={CARD_GLYPH} color={colors.text.secondary} />
          <Body weight="semibold" style={{ flex: 1 }}>
            {m.caregiver.notes.row.title(name)}
          </Body>
          {row.isNew ? <NewPill /> : null}
          <View>
            <Icon name="arrow-right" size={CARD_GLYPH} color={colors.text.muted} />
          </View>
        </Pressable>
      </Card>
      <Spacer size="md" />
    </>
  );
}
