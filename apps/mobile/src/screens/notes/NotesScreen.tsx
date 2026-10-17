import {
  Body,
  Button,
  Heading,
  Hoya,
  Icon,
  Screen,
  Spacer,
  SplitPane,
  borderWidth,
  colors,
  radii,
  spacing,
  touchTarget,
  useLayoutClass,
  KOREAN_LINE_BREAK,
  useTypeScale,
} from '@hangul-route/design-system';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import { listViewedEvent } from '../../logic/notes/screens';
import { notesList, type NoteRowView } from '../../logic/notes/view';
import type { RootStackParamList } from '../../navigation/types';
import { track } from '../../platform/telemetry';
import { useAudience } from '../../store/audience';
import { NoteDetailPane } from './NoteDetailPane';
import { NewPill, ROW_GLYPH, glyphColor } from './parts';
import { useActiveNotes } from './use-notes';

const REACTION_GLYPH = { thanks: 'heart', will_try: 'pencil', did_it: 'check-circle', happy: 'sparkle' } as const;

/**
 * notes/list — My notes (F-FEEDBACK-001 section 6.5 item 2, FB-8; mock
 * design/screens/notes/notes-list.md): every note of the active profile shown on this device, "New"
 * then "Earlier", newest first; never sorted by sender and no count in the title. A row opens the
 * note; on a wide window (two panes) the open note sits on the right and its row is marked. Empty
 * shows one calm line and no button. `notes.list_viewed` once per visit.
 */
export function NotesScreen(): React.ReactElement {
  const m = useMessages();
  const t = m.learner.notes;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Notes'>>();
  const { profileId, data, status, retry, ctx } = useActiveNotes();
  const { panes } = useLayoutClass();
  const { opensDirectly } = useAudience();
  const selfManaged = opensDirectly(false);
  const list = useMemo(() => (data === undefined ? { new: [], earlier: [] } : notesList(data, ctx)), [data, ctx]);
  const rows = useMemo(() => [...list.new, ...list.earlier], [list]);
  const [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState(route.params?.notice === 'putAway');
  const viewed = useRef<string | null>(null);
  /** Two panes open the newest note once per visit; after that only a tapped row opens (and so is marked read). */
  const autoPicked = useRef(false);

  // Back from a note page that put its note away: this same list says so once.
  const noticeParam = route.params?.notice;
  useEffect(() => {
    if (noticeParam !== 'putAway') return;
    setNotice(true);
    navigation.setParams({ notice: undefined });
  }, [noticeParam, navigation]);

  useEffect(() => {
    if (status !== 'ready' || profileId === null || viewed.current === profileId) return;
    viewed.current = profileId;
    void track(listViewedEvent(list));
  }, [status, profileId, list]);

  // Two panes: the newest note opens once when the list first shows (it is on screen, so it is
  // opened and marked read). The pick is pinned: a note that moves to Earlier, or one put away,
  // never makes the next unread note open by itself.
  const twoPanes = panes === 2;
  const firstId = rows[0]?.id ?? null;
  useEffect(() => {
    if (!twoPanes || autoPicked.current || firstId === null) return;
    autoPicked.current = true;
    setSelected((current) => current ?? firstId);
  }, [twoPanes, firstId]);
  const openId = twoPanes ? (rows.find((r) => r.id === selected)?.id ?? null) : null;

  const open = (id: string): void => {
    setNotice(false);
    if (twoPanes) setSelected(id);
    else navigation.navigate('NoteDetail', { noteId: id });
  };

  const failed = status === 'error';
  const empty = rows.length === 0;

  const master = (
    <View style={{ gap: spacing.md }} testID="notes-list">
      {notice ? (
        <View
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={{ backgroundColor: colors.surface.sunken, borderRadius: radii.md, padding: spacing.md }}
          testID="notes-put-away-done"
        >
          <Body>{selfManaged ? t.detail.putAwayDoneSelf : t.detail.putAwayDone}</Body>
        </View>
      ) : null}
      {failed || (empty && status === 'ready') ? (
        <View style={{ alignItems: 'center', gap: spacing.md }} testID={failed ? 'notes-error' : 'notes-empty'}>
          <Hoya pose="idle" size={touchTarget.hero} accessibilityLabel={m.a11y.hoya('idle')} />
          <Body align="center" size="lg">
            {failed ? t.list.error : t.list.empty}
          </Body>
          {failed ? <Button label={t.list.retry.cta} tone="ghost" size="md" onPress={retry} /> : null}
        </View>
      ) : (
        <>
          <Group title={t.list.groups.new} rows={list.new} openId={openId} onOpen={open} testID="notes-group-new" />
          <Group title={t.list.groups.earlier} rows={list.earlier} openId={openId} onOpen={open} testID="notes-group-earlier" />
        </>
      )}
    </View>
  );

  const header = (
    <>
      <Heading level="title">{t.list.title}</Heading>
      <Spacer size="lg" />
    </>
  );

  if (!twoPanes) {
    return (
      <Screen tone="canvas" scrollable testID="notes-screen">
        {header}
        {master}
        <Spacer size="xl" />
      </Screen>
    );
  }

  return (
    <Screen tone="canvas" width="full" testID="notes-screen">
      {header}
      <SplitPane
        master={master}
        detail={
          openId === null ? null : (
            <NoteDetailPane
              noteId={openId}
              onPutAway={() => {
                setSelected(null);
                setNotice(true);
              }}
              onSeeMyNotes={() => setSelected(null)}
            />
          )
        }
        masterLabel={t.list.title}
        detailLabel={rows.find((r) => r.id === openId)?.preset}
      />
    </Screen>
  );
}

function Group({
  title,
  rows,
  openId,
  onOpen,
  testID,
}: {
  title: string;
  rows: readonly NoteRowView[];
  openId: string | null;
  onOpen: (id: string) => void;
  testID: string;
}): React.ReactElement | null {
  if (rows.length === 0) return null;
  return (
    <View style={{ gap: spacing.sm }} testID={testID}>
      <Body size="lg" weight="bold">
        {title}
      </Body>
      {rows.map((row) => (
        <NoteRow key={row.id} row={row} current={row.id === openId} onPress={() => onOpen(row.id)} />
      ))}
    </View>
  );
}

function NoteRow({ row, current, onPress }: { row: NoteRowView; current: boolean; onPress: () => void }): React.ReactElement {
  const textScale = useTypeScale();
  const m = useMessages();
  const name = m.a11y.notes.row(row.sender, row.preset, row.date, row.isNew) + (row.reactionText === null ? '' : ` ${m.a11y.notes.answer(row.reactionText)}`);
  const langProps = row.textLang === undefined ? {} : { lang: row.textLang, accessibilityLanguage: row.textLang };
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={name}
      {...(current ? { 'aria-current': 'true' as const } : {})}
      testID={`notes-row-${row.id}`}
      style={{
        minHeight: touchTarget.min,
        padding: spacing.md,
        gap: spacing.xxs,
        backgroundColor: colors.surface.paper,
        borderRadius: radii.lg,
        borderWidth: current ? borderWidth.thick : borderWidth.thin,
        borderColor: current ? colors.brand.secondaryDark : colors.border.subtle,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Icon name="note" size={ROW_GLYPH} color={glyphColor} />
        {row.isNew ? <NewPill /> : null}
        <Text {...KOREAN_LINE_BREAK} style={{ marginLeft: 'auto', fontSize: textScale.size.bodySm, color: colors.text.muted }}>{row.date}</Text>
      </View>
      <Body weight="bold">{row.sender}</Body>
      <Body tone="secondary">{row.preset}</Body>
      {row.text !== null ? (
        <Text {...KOREAN_LINE_BREAK} {...langProps} numberOfLines={1} style={{ fontSize: textScale.size.body, color: colors.text.secondary }}>
          {row.text}
        </Text>
      ) : null}
      {row.reaction !== null && row.reactionText !== null ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }} testID="notes-row-answer">
          <Icon name={REACTION_GLYPH[row.reaction]} size={ROW_GLYPH} color={glyphColor} />
          <Body size="sm">{row.reactionText}</Body>
        </View>
      ) : null}
    </Pressable>
  );
}

