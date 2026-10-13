import { Body, Caption, Card, Heading, Icon, Pill, Spacer, borderWidth, colors, radii, spacing, touchTarget } from '@hangul-route/design-system';
import { CATALOG, type DateKey, type WeekExtra } from '@hangul-route/content-schema';
import { formatDate, type Messages, type UiLocale } from '@hangul-route/i18n';
import React from 'react';
import { Pressable, View } from 'react-native';
import { episodesAll, questsAll } from '../../content';
import { useMessages } from '../../i18n/use-messages';
import { vocabTopic } from '../../content/vocab';
import { localizeEpisode, localizeQuest } from '../../logic/content-locale';
import { openableTopicKey, type PlanWeek } from '../../logic/route/plan-view';
import type { WeekRow } from '../../logic/route/proposal-flow';
import { localizedTopicTitle } from '../../logic/vocab/question-view';
import { LinkButton } from '../placement/parts';

/**
 * Pieces the weekly plan screens share (F-PLAN-002 section 3.9): the proposal (K1), the set-up
 * steps (G1), the preview (G2) and the overview (G3). Chips and buttons are at least 64 dp with a
 * visible selected state; a week is a list with its day and the lesson or story title.
 */

type ProposalMessages = Messages['learner']['weeklyPlan']['proposal'];

/** A Sunday, so `WEEKDAYS[i]` is this day plus i (weekday chip labels in the UI locale). */
export const A_SUNDAY = '2026-10-11';
/** A radio chip that holds a short word beside its circle at the 18 pt body size: two to a phone row. */
export const WIDE_CHIP = touchTarget.hero + touchTarget.min;

export const dayLabel = (locale: UiLocale, date: DateKey): string => formatDate(locale, `${date}T00:00:00Z`, 'weekday', { utc: true });

/** A plan item's title in the UI language; a coming-soon episode says so. */
export function rowTitle(row: WeekRow, locale: UiLocale, t: Pick<ProposalMessages, 'comingSoonItem'>, fallback: string): string {
  if (row.kind === 'episode') {
    const episode = episodesAll.find((e) => e.id === row.id);
    return t.comingSoonItem(episode ? localizeEpisode(episode, locale).titleEn : fallback);
  }
  const quest = questsAll.find((q) => q.id === row.id);
  return quest ? localizeQuest(quest, locale).titleEn : fallback;
}

export function WeekList({ rows, locale, testID }: { rows: readonly WeekRow[]; locale: UiLocale; testID: string }): React.ReactElement {
  const m = useMessages();
  const t = m.learner.weeklyPlan.proposal;
  return (
    <View testID={testID} style={{ gap: spacing.sm }}>
      {rows.map((row) => {
        const day = dayLabel(locale, row.date);
        const title = rowTitle(row, locale, t, m.learner.homework.questFallback);
        return (
          <View
            key={`${row.date}|${row.id}`}
            accessible
            accessibilityLabel={t.weekRowLabel(day, title)}
            style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.md }}
          >
            <Caption tone="secondary" weight="semibold" style={{ minWidth: touchTarget.min }}>
              {day}
            </Caption>
            <Body style={{ flex: 1 }}>{title}</Body>
          </View>
        );
      })}
    </View>
  );
}

/** One weekday under "Change days and time": a checkbox with a visible state (fill and check), at least 64 dp. */
export function DayChip({ label, checked, onPress, testID }: { label: string; checked: boolean; onPress: () => void; testID: string }): React.ReactElement {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      aria-checked={checked}
      accessibilityLabel={label}
      style={{
        minWidth: touchTarget.min,
        minHeight: touchTarget.min,
        paddingHorizontal: spacing.sm,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xxs,
        borderRadius: radii.lg,
        borderWidth: checked ? borderWidth.thick : borderWidth.base,
        borderColor: checked ? colors.brand.primary : colors.border.subtle,
        backgroundColor: checked ? colors.brand.primaryLight : colors.surface.paper,
      }}
    >
      <Body weight="semibold">{label}</Body>
      {checked ? <Icon name="check" size={spacing.lg} color={colors.brand.primaryDark} /> : null}
    </Pressable>
  );
}

/** The Choose weeks stepper: an icon button with a spoken label, at least 64 dp, quiet when it cannot step. */
export function StepButton({
  icon,
  label,
  disabled,
  onPress,
  testID,
}: {
  icon: 'dash' | 'plus';
  label: string;
  disabled: boolean;
  onPress: () => void;
  testID: string;
}): React.ReactElement {
  return (
    <Pressable
      testID={testID}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      aria-disabled={disabled}
      accessibilityLabel={label}
      style={{
        width: touchTarget.min,
        height: touchTarget.min,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radii.circle,
        borderWidth: borderWidth.base,
        borderColor: disabled ? colors.border.subtle : colors.brand.primary,
        backgroundColor: disabled ? colors.surface.sunken : colors.surface.paper,
      }}
    >
      <Icon name={icon} size={spacing.xl} color={disabled ? colors.text.muted : colors.brand.primaryDark} />
    </Pressable>
  );
}

/** A catalogue word topic (`topic:<key>`) in the UI language: the Words topic when it is bundled, else the catalogue title. */
export function topicTitle(topicId: string, locale: UiLocale): string {
  const key = topicId.replace(/^topic:/, '');
  const topic = vocabTopic(key);
  if (topic !== undefined) return localizedTopicTitle(topic, locale);
  return CATALOG.topics.find((t) => t.id === topicId)?.title ?? key;
}

function extraText(extra: WeekExtra, locale: UiLocale, t: Messages['learner']['weeklyPlan']['planPreview']['extras']): string {
  return extra.kind === 'vocab' ? t.vocab(topicTitle(extra.topicId, locale)) : t.hangulCheck;
}

/**
 * One week of a plan (G2 preview, G3 overview): its number and first day, its kind as a text
 * badge (never colour alone), the days with their lesson or story, and the optional extras. With
 * `onOpenTopic` (the overview), an optional word topic bundled in this build opens its Words page.
 */
export function PlanWeekCard({
  week,
  locale,
  onOpenTopic,
  testID,
}: {
  week: PlanWeek;
  locale: UiLocale;
  onOpenTopic?: (topicKey: string) => void;
  testID: string;
}): React.ReactElement {
  const m = useMessages();
  const t = m.learner.weeklyPlan.planPreview;
  const story = week.storyQuestId === null ? undefined : questsAll.find((q) => q.id === week.storyQuestId);
  const kind = week.kind === 'culture' && story !== undefined ? t.cultureWeek(localizeQuest(story, locale).titleEn) : t.kind[week.kind];
  const firstDay = formatDate(locale, `${week.startDate}T00:00:00Z`, 'monthDay', { utc: true });
  return (
    <Card padding="md" testID={testID}>
      <View accessibilityRole="header" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm }}>
        <Heading level="prompt">{t.week(week.index)}</Heading>
        <Caption tone="secondary">{firstDay}</Caption>
        <Pill label={kind} tone="neutral" size="sm" />
      </View>
      <Spacer size="sm" />
      {week.rows.length > 0 ? <WeekList rows={week.rows} locale={locale} testID={`${testID}-rows`} /> : <Body tone="secondary">{t.weekEmpty}</Body>}
      {week.extras.map((extra) => {
        const topicKey = extra.kind === 'vocab' && onOpenTopic !== undefined ? openableTopicKey(extra.topicId, (key) => vocabTopic(key) !== undefined) : null;
        return (
          <View key={extra.kind === 'vocab' ? extra.topicId : extra.kind} style={{ marginTop: spacing.sm, alignItems: 'flex-start' }}>
            {topicKey !== null && onOpenTopic !== undefined ? (
              <LinkButton label={extraText(extra, locale, t.extras)} onPress={() => onOpenTopic(topicKey)} testID={`${testID}-topic-${topicKey}`} />
            ) : (
              <Body>{extraText(extra, locale, t.extras)}</Body>
            )}
            {extra.kind === 'vocab' ? <Caption tone="secondary">{t.extras.wordsOptional}</Caption> : null}
          </View>
        );
      })}
    </Card>
  );
}
