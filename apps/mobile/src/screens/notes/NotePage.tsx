import {
  Body,
  Button,
  Card,
  Heading,
  Hoya,
  Icon,
  Spacer,
  borderWidth,
  colors,
  layout,
  radii,
  spacing,
  touchTarget,
  typography,
  type IconName,
  KOREAN_LINE_BREAK,
} from '@hangul-route/design-system';
import { NOTE_REACTION_IDS, type NoteReactionId } from '@hangul-route/content-schema';
import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import type { NoteDetailView } from '../../logic/notes/view';

/** Mock constants (design/screens/notes/README.md): Hoya 96 (`touchTarget.hero`), quest art 64 (`touchTarget.min`), glyphs 24. */
const HOYA_SIZE = touchTarget.hero;
const ART_SIZE = touchTarget.min;
const GLYPH = 24;
/** The seen-by line describes the reaction group (web `aria-describedby`). */
const SEEN_BY_ID = 'note-seen-by';
const QUEST_TITLE_ID = 'note-quest-title';
/** Read by assistive tech, not drawn (the pick is already visible). */
const srOnly = { position: 'absolute', width: 1, height: 1, margin: -1, overflow: 'hidden' } as const;

const REACTION_GLYPH: Record<NoteReactionId, IconName> = {
  thanks: 'heart',
  will_try: 'pencil',
  did_it: 'check-circle',
  happy: 'sparkle',
};

export interface NotePageProps {
  view: NoteDetailView;
  /** The suggested quest's title in the UI language; null draws no quest card. */
  questTitle: string | null;
  /** "You picked: …" after a pick in this visit; read by a polite live region on the web. */
  picked: string | null;
  onPick: (reaction: NoteReactionId) => void;
  onStart: () => void;
  onPutAway: () => void;
  onReport: () => void;
  /** "Tell a grown-up (PIN required)", or the self-managed "Report this note". */
  reportA11y: string;
}

/**
 * The body of the note page (F-FEEDBACK-001 section 6.5 item 3, 6.6; mock
 * design/screens/notes/note-page.md): Hoya cheering, the preset as the page heading, the grown-up's
 * words as typed under "From <sender>", the suggested quest (Start only when it is open; a closed one
 * shows "Opens with the full route" and nothing to press, never a gate or a price), the reaction
 * radio group with the seen-by line as its description, then the two quiet links under a rule.
 * Shared by the stack screen and the wide split pane.
 */
export function NotePage({ view, questTitle, picked, onPick, onStart, onPutAway, onReport, reportA11y }: NotePageProps): React.ReactElement {
  const m = useMessages();
  const t = m.learner.notes.detail;
  const fromLine = [view.from, view.date].filter((part) => part !== '').join(' · ');
  const langProps = view.textLang === undefined ? {} : { lang: view.textLang, accessibilityLanguage: view.textLang };
  const quest = view.suggest !== null && questTitle !== null ? { ...view.suggest, title: questTitle } : null;

  return (
    <View style={{ width: '100%', maxWidth: layout.maxWidth.reading, alignSelf: 'center' }} testID="note-page">
      <View style={{ alignItems: 'center', gap: spacing.md }}>
        <Hoya pose="cheering" size={HOYA_SIZE} accessibilityLabel={m.a11y.hoya('cheering')} />
        <Heading level="title" align="center" testID="note-preset">
          {view.preset}
        </Heading>
        {view.text === null ? (
          <Body tone="secondary" align="center" testID="note-from">
            {fromLine}
          </Body>
        ) : null}
      </View>

      {view.text !== null ? (
        <>
          <Spacer size="lg" />
          <Card padding="md" testID="note-words">
            <Text {...KOREAN_LINE_BREAK} {...langProps} style={{ fontSize: typography.size.bodyLg, color: colors.text.primary, lineHeight: typography.size.bodyLg * typography.leading.normal }}>
              {view.text}
            </Text>
            <Spacer size="xs" />
            <Body tone="secondary" testID="note-from">
              {fromLine}
            </Body>
          </Card>
        </>
      ) : null}

      {quest !== null ? (
        <>
          <Spacer size="lg" />
          <Card padding="md" accessibilityLabel={m.a11y.notes.questCard(quest.title)} testID={quest.open ? 'note-quest-open' : 'note-quest-closed'}>
            <Body weight="semibold">{t.suggest.title}</Body>
            <Spacer size="sm" />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View
                style={{
                  width: ART_SIZE,
                  height: ART_SIZE,
                  borderRadius: radii.md,
                  backgroundColor: colors.brand.primaryLight,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="book" size={GLYPH} color={colors.brand.primaryDark} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text {...KOREAN_LINE_BREAK} nativeID={QUEST_TITLE_ID} style={{ fontSize: typography.size.body, fontWeight: typography.weight.semibold, color: colors.text.primary }}>
                  {quest.title}
                </Text>
                {quest.open ? null : (
                  <Body tone="secondary" size="sm" testID="note-quest-closed-caption">
                    {t.suggest.closed}
                  </Body>
                )}
              </View>
            </View>
            {quest.open ? (
              <>
                <Spacer size="md" />
                <Button label={t.suggest.start.cta} tone="primary" size="lg" fullWidth accessibilityHint={quest.title} onPress={onStart} testID="note-quest-start" />
              </>
            ) : null}
          </Card>
        </>
      ) : null}

      <Spacer size="xl" />
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={t.reactions.heading}
        {...(Platform.OS === 'web' ? { 'aria-describedby': SEEN_BY_ID } : { accessibilityHint: view.seenBy })}
        style={{ gap: spacing.sm }}
        testID="note-reactions"
      >
        <Heading level="prompt">{t.reactions.heading}</Heading>
        {NOTE_REACTION_IDS.map((id) => {
          const selected = view.reaction === id;
          const label = m.common.notes.reactions[id];
          return (
            <Pressable
              key={id}
              onPress={() => onPick(id)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              aria-checked={selected}
              accessibilityLabel={label}
              testID={`note-reaction-${id}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                minHeight: touchTarget.min,
                paddingHorizontal: spacing.lg,
                borderRadius: radii.pill,
                backgroundColor: colors.surface.paper,
                borderColor: selected ? colors.brand.primary : colors.border.strong,
                borderWidth: selected ? borderWidth.thick : borderWidth.base,
              }}
            >
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={{
                  width: spacing.xl,
                  height: spacing.xl,
                  borderRadius: radii.circle,
                  borderWidth: borderWidth.base,
                  borderColor: selected ? colors.brand.primary : colors.border.shape,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {selected ? <View style={{ width: spacing.md, height: spacing.md, borderRadius: radii.circle, backgroundColor: colors.brand.primary }} /> : null}
              </View>
              <Icon name={REACTION_GLYPH[id]} size={GLYPH} color={colors.text.primary} />
              <Text {...KOREAN_LINE_BREAK} style={{ flex: 1, fontSize: typography.size.body, color: colors.text.primary, fontWeight: selected ? typography.weight.bold : typography.weight.regular }}>
                {label}
              </Text>
              {selected ? <Icon name="check" size={GLYPH} color={colors.brand.primary} /> : null}
            </Pressable>
          );
        })}
        <Text {...KOREAN_LINE_BREAK} nativeID={SEEN_BY_ID} style={{ fontSize: typography.size.body, color: colors.text.secondary }} testID="note-seen-by">
          {view.seenBy}
        </Text>
        <View style={srOnly} accessibilityLiveRegion="polite" {...{ 'aria-live': 'polite' }}>
          {picked !== null ? <Text {...KOREAN_LINE_BREAK}>{picked}</Text> : null}
        </View>
      </View>

      <Spacer size="xl" />
      <View style={{ borderTopWidth: borderWidth.thin, borderTopColor: colors.border.subtle, paddingTop: spacing.sm }}>
        <QuietLink label={t.putAway.cta} onPress={onPutAway} testID="note-put-away" />
        <QuietLink label={view.reportLink} accessibilityLabel={reportA11y} role="link" onPress={onReport} testID="note-report-link" />
      </View>
    </View>
  );
}

/** A quiet link at the bottom of the page (mock N4): `text.secondary`, `touchTarget.min` tall, never a primary. */
function QuietLink({
  label,
  accessibilityLabel,
  role = 'button',
  onPress,
  testID,
}: {
  label: string;
  accessibilityLabel?: string;
  /** "Put this note away" acts in place (a button); the report link opens another screen. */
  role?: 'button' | 'link';
  onPress: () => void;
  testID: string;
}): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={role}
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}
      style={{ minHeight: touchTarget.min, justifyContent: 'center' }}
    >
      <Text {...KOREAN_LINE_BREAK} style={{ fontSize: typography.size.body, color: colors.text.secondary, textDecorationLine: 'underline' }}>{label}</Text>
    </Pressable>
  );
}
