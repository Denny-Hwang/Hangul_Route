import { Body, Card, Icon, Pill, borderWidth, colors, radii, spacing, touchTarget, typography, KOREAN_LINE_BREAK } from '@hangul-route/design-system';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useMemo } from 'react';
import { Text, View } from 'react-native';
import { flags } from '../../config/flags';
import { useMessages } from '../../i18n/use-messages';
import { takeCardShown } from '../../logic/notes/screens';
import { homeNotesCard } from '../../logic/notes/view';
import type { RootStackParamList } from '../../navigation/types';
import { track } from '../../platform/telemetry';
import { CARD_GLYPH } from './parts';
import { useActiveNotes } from './use-notes';

/** `notes.card_shown` goes once per app session and profile (F-FEEDBACK-001 section 10). */
const cardShownSent = new Set<string>();

/**
 * Row 2a of Home (F-FEEDBACK-001 section 6.5 item 1; F-ROUTE-001 section 6.4; mock
 * design/screens/notes/home-card.md): shown while the active profile has an unread note it did not
 * put away. One target, one focus stop (N1): the whole card opens the note (one new note) or My
 * notes (several); **Read** is drawn inside it as the primary pill, not a second target. The free
 * text is never on Home. No dismiss, no timer, no Hoya. Renders nothing with the flag off.
 */
export function NotesHomeCard({ gap }: { gap: 'after' | 'top' }): React.ReactElement | null {
  return flags.notesEnabled ? <NotesHomeCardInner gap={gap} /> : null;
}

/** `gap`: after the mission cards the space goes above the card; at the top of the right column, below it. */
function NotesHomeCardInner({ gap }: { gap: 'after' | 'top' }): React.ReactElement | null {
  const m = useMessages();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { profileId, data, ctx } = useActiveNotes();
  const card = useMemo(() => (data === undefined ? null : homeNotesCard(data, ctx)), [data, ctx]);

  useEffect(() => {
    const event = takeCardShown(cardShownSent, profileId ?? undefined, card);
    if (event !== null) void track(event);
  }, [profileId, card]);

  if (card === null) return null;
  const home = m.learner.notes.home;
  const open = (): void => {
    if (card.kind === 'one') navigation.navigate('NoteDetail', { noteId: card.noteId });
    else navigation.navigate('Notes');
  };

  return (
    <View style={gap === 'after' ? { paddingTop: spacing.lg } : { paddingBottom: spacing.xl }}>
    <Card padding="lg" onPress={open} accessibilityLabel={card.a11y} testID="home-notes-card" style={{ borderWidth: borderWidth.thin, borderColor: colors.border.subtle }}>
      <View style={{ gap: spacing.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Icon name="note" size={CARD_GLYPH} color={colors.text.primary} />
          <Pill tone="secondary" size="sm" label={m.common.notes.new.pill} />
        </View>
        <Body size="lg" weight="bold">
          {card.title}
        </Body>
        <Body tone="secondary">{card.kind === 'one' ? card.preset : card.from}</Body>
        {/* Drawn as the primary pill; the card is the one target (mock N1). */}
        <View
          style={{
            alignSelf: 'flex-end',
            minHeight: touchTarget.min,
            justifyContent: 'center',
            paddingHorizontal: spacing.xl,
            borderRadius: radii.pill,
            borderWidth: borderWidth.base,
            borderColor: colors.brand.primary,
            backgroundColor: colors.brand.primary,
          }}
        >
          <Text {...KOREAN_LINE_BREAK} style={{ color: colors.text.inverse, fontSize: typography.size.body, fontWeight: typography.weight.bold }}>{home.read.cta}</Text>
        </View>
      </View>
    </Card>
    </View>
  );
}
