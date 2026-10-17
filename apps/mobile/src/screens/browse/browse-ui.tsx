import type { HeritageCard } from '@hangul-route/content-schema';
import {
  Body,
  Caption,
  Icon,
  KOREAN_LANGUAGE,
  borderWidth,
  colors,
  koreanTextLabel,
  radii,
  spacing,
  touchTarget,
  typography,
  type IconName,
  KOREAN_LINE_BREAK,
  useCappedFont,
  useTypeScale,
} from '@hangul-route/design-system';
import React, { useEffect, useState } from 'react';
import { Pressable, Text, View, type PressableStateCallbackType, type ViewStyle } from 'react-native';
import { CardArt } from '../../components/CardArt';
import { DeviceDisplaySheet } from '../../components/DeviceDisplaySheet';
import { DisplayButton } from '../../components/DisplayButton';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { cardKoLine } from '../../logic/card-art';
import { localizeCard } from '../../logic/content-locale';
import type { ItemViewedEvent, PlansTappedEvent } from '../../logic/browse/home-view';
import type { PreviewEndedEvent, PreviewStartedEvent } from '../../logic/browse/preview';
import type { Skill } from '../../logic/my-route/types';
import { track } from '../../platform/telemetry';

/**
 * Small parts the All lessons catalogue screens share (F-BROWSE-001 sections
 * 4.5 and 4.6; mocks `design/screens/browse/home.md`, `episode.md`,
 * `item.md`): the keyboard focus ring (design README decision 20), the header
 * row, the Korean chip, the skills chips, the card row and the item telemetry.
 */

/** react-native-web adds `focused` (keyboard focus) to the pressable's state. */
export type FocusState = PressableStateCallbackType & { focused?: boolean };

/** The `border.focus` ring at `borderWidth.thick` on keyboard focus; clear at rest so nothing moves. */
export function focusRing(focused: boolean | undefined, rest: string = 'transparent'): ViewStyle {
  return { borderWidth: borderWidth.thick, borderColor: focused ? colors.border.focus : rest };
}

/** Taught Korean as a chip: the Hangul (`lang="ko"`) with its romanization beside it, never colour alone. */
export function KoChip({
  ko,
  romanization,
  marked = false,
  accessibilityLabel,
  testID,
}: {
  ko: string;
  romanization: string;
  /** The focus letter (section 4.6): a thick `text.primary` outline, and the label says so. */
  marked?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}): React.ReactElement {
  const textScale = useTypeScale();
  return (
    <View
      accessible
      accessibilityLabel={koreanTextLabel(ko, romanization, accessibilityLabel)}
      testID={testID}
      style={{
        flexDirection: 'row',
        // A narrow row moves the romanization under the Korean instead of breaking a Korean word in two.
        flexWrap: 'wrap',
        alignItems: 'baseline',
        gap: spacing.xs,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xxs,
        borderRadius: radii.md,
        backgroundColor: colors.brand.secondaryLight,
        borderWidth: borderWidth.thick,
        borderColor: marked ? colors.text.primary : colors.brand.secondaryLight,
      }}
    >
      <Text {...KOREAN_LINE_BREAK}
        {...{ lang: KOREAN_LANGUAGE }}
        style={{ flexShrink: 0, maxWidth: '100%', fontFamily: typography.family.sansKr, fontSize: textScale.size.prompt, fontWeight: typography.weight.bold, color: colors.text.primary }}
      >
        {ko}
      </Text>
      <Text {...KOREAN_LINE_BREAK} style={{ fontSize: textScale.size.bodySm, fontWeight: typography.weight.medium, color: colors.text.secondary }}>{romanization}</Text>
    </View>
  );
}

/** A word: its chip, then the gloss in the UI language. */
export function WordChip({ ko, romanization, gloss }: { ko: string; romanization: string; gloss: string }): React.ReactElement {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexShrink: 1 }}>
      <KoChip ko={ko} romanization={romanization} />
      <Body tone="secondary">{gloss}</Body>
    </View>
  );
}

const SKILL_ICON: Readonly<Record<Skill, IconName>> = { read: 'book', listen: 'ear', write: 'pencil' };

/** Read, listen, write as outlined chips with a glyph and the word (speaking is never a skill). Nothing for none. */
export function SkillChips({ skills }: { skills: readonly Skill[] }): React.ReactElement | null {
  const textScale = useTypeScale();
  const m = useMessages().learner.myRoute.skill;
  if (skills.length === 0) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
      {skills.map((skill) => (
        <View
          key={skill}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xxs,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xxs,
            borderRadius: radii.pill,
            borderWidth: borderWidth.thin,
            borderColor: colors.border.strong,
          }}
        >
          <Icon name={SKILL_ICON[skill]} size={spacing.lg} color={colors.text.primary} />
          <Text {...KOREAN_LINE_BREAK} style={{ fontSize: textScale.size.bodySm, fontWeight: typography.weight.semibold, color: colors.text.primary }}>{m[skill]}</Text>
        </View>
      ))}
    </View>
  );
}

/** A 64 card thumbnail with its rarity border (RouteMarkers D9); the end screen's still card is 96 (CardArtThumb's size). */
const CARD_THUMB = { row: touchTarget.min, end: touchTarget.hero } as const;

/** One card row: the thumbnail, the English title and the Korean with its romanization; one button to the card. */
export function CardRow({
  card: source,
  onPress,
  testID,
  size = 'row',
}: {
  card: HeritageCard;
  onPress: () => void;
  testID?: string;
  /** `end`: the preview end screen's still 96 card (mock preview-end.md), no flip, no burst. */
  size?: keyof typeof CARD_THUMB;
}): React.ReactElement {
  const thumb = CARD_THUMB[size];
  const card = localizeCard(source, useLocale());
  const messages = useMessages();
  // A Korean title that is the word itself shows once: the title line, then the romanization alone.
  const ko = cardKoLine(card) ?? '';
  const romanization = card.romanization ?? '';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={messages.caregiver.browse.cardRowA11y(card.titleEn, ko, romanization)}
      testID={testID}
      style={({ focused }: FocusState) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        minHeight: touchTarget.min,
        borderRadius: radii.md,
        ...focusRing(focused),
      })}
    >
      <View
        style={{
          width: thumb,
          height: thumb,
          borderRadius: radii.md,
          borderWidth: borderWidth.thick,
          borderColor: colors.rarity[card.rarity],
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <CardArt card={card} size={thumb - 2 * borderWidth.thick} style={{ borderRadius: radii.sm }} />
      </View>
      <View style={{ flex: 1, gap: spacing.xxs, alignItems: 'flex-start' }}>
        <Body weight={size === 'end' ? 'bold' : 'semibold'} size={size === 'end' ? 'lg' : 'md'}>
          {card.titleEn}
        </Body>
        {ko && romanization ? (
          <KoChip ko={ko} romanization={romanization} />
        ) : !ko && card.subtitleKo?.trim() && romanization ? (
          <Caption tone="muted" style={{ fontStyle: 'italic' }}>
            {romanization}
          </Caption>
        ) : null}
      </View>
    </Pressable>
  );
}

/** The header's one fixed top-left position: [ < Close ] on home, the back arrow (named) on the other pages. */
export function HeaderBack({
  label,
  showLabel,
  onPress,
  testID,
}: {
  label: string;
  /** Home shows "Close" beside the arrow; the outline and the item page show the arrow alone, named. */
  showLabel: boolean;
  onPress: () => void;
  testID: string;
}): React.ReactElement {
  const textScale = useTypeScale();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={showLabel ? undefined : label}
      style={({ focused }: FocusState) => ({
        minHeight: touchTarget.min,
        minWidth: touchTarget.min,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: showLabel ? 'flex-start' : 'center',
        gap: spacing.xs,
        paddingLeft: spacing.xs,
        paddingRight: showLabel ? spacing.sm : spacing.xs,
        borderRadius: radii.md,
        ...focusRing(focused),
      })}
    >
      <Icon name="arrow-left" size={spacing.xl} color={colors.text.primary} />
      {showLabel ? (
        <Text {...KOREAN_LINE_BREAK} style={{ color: colors.text.primary, fontSize: textScale.size.body, fontWeight: typography.weight.semibold }}>{label}</Text>
      ) : null}
    </Pressable>
  );
}

/** [ Lesson display ]: the pill chip at the right of the header row. */
export function LessonDisplayButton({ onPress }: { onPress: () => void }): React.ReactElement {
  const m = useMessages().caregiver.browse.home;
  // Drawn at the chosen text size; the native 1.3 cap stays a budget for the step and the OS together.
  const capped = useCappedFont('body', 1.3);
  return (
    <Pressable
      testID="browse-lesson-display"
      onPress={onPress}
      accessibilityRole="button"
      aria-haspopup="dialog"
      style={({ focused }: FocusState) => ({
        minHeight: touchTarget.min,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.lg,
        borderRadius: radii.pill,
        backgroundColor: colors.surface.paper,
        ...focusRing(focused, colors.border.strong),
        borderWidth: focused ? borderWidth.thick : borderWidth.base,
      })}
    >
      <Icon name="settings" size={spacing.lg + spacing.xxs} color={colors.text.primary} />
      <Text {...KOREAN_LINE_BREAK} maxFontSizeMultiplier={capped.maxFontSizeMultiplier} style={{ color: colors.text.primary, fontSize: capped.fontSize, fontWeight: typography.weight.semibold }}>
        {m.lessonDisplay.cta}
      </Text>
    </Pressable>
  );
}

/**
 * The header row: the back position at the left; at the right [ Lesson display ] when given, then the
 * Aa button (AMENDMENTS-DISPLAY-NAV section 6: All lessons speaks the device's language, set on the
 * shared Display sheet, which also holds the text size). Wraps at large text.
 */
export function HeaderRow({ back, onDisplay }: { back: React.ReactNode; onDisplay?: () => void }): React.ReactElement {
  const [displayOpen, setDisplayOpen] = useState(false);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
      {back}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, marginLeft: 'auto' }}>
        {onDisplay ? <LessonDisplayButton onPress={onDisplay} /> : null}
        <DisplayButton onPress={() => setDisplayOpen(true)} testID="browse-display-open" />
      </View>
      <DeviceDisplaySheet visible={displayOpen} onClose={() => setDisplayOpen(false)} testID="browse-device-display" />
    </View>
  );
}

/** Sends one browse event (the telemetry fence passes `browse.*` only; it carries no profile id). */
export function sendBrowseEvent(event: ItemViewedEvent | PlansTappedEvent | PreviewStartedEvent | PreviewEndedEvent): void {
  void track(event);
}

/** `browse.item_viewed` once when the page opens (section 9). */
export function useItemViewed(event: ItemViewedEvent | null): void {
  const key = event ? `${event.payload.kind}|${event.payload.itemId}|${event.payload.access}` : null;
  useEffect(() => {
    if (event) sendBrowseEvent(event);
    // One event per opened item: the key holds everything the event carries.
  }, [key]);
}
