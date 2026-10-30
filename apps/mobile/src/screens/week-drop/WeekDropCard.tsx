import type { WeekDropEntry } from '@hangul-route/content-schema/week-drops';
import { Body, Caption, Card, Icon, KOREAN_LANGUAGE, KOREAN_LINE_BREAK, colors, spacing, touchTarget, typography, useTypeScale } from '@hangul-route/design-system';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Pressable, Text, View } from 'react-native';
import { weekDrops } from '../../content/week-drops';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { readDoneWeeks } from '../../logic/week-drop/done-weeks';
import { weekDropView } from '../../logic/week-drop/view';
import type { RootStackParamList } from '../../navigation/types';

/*
 * Home's "This week in Korea" card (F-CURR-002 §5.7, row CM-48; design/wireframes/home/this-week-in-korea.md A1, A2):
 * one button on a sunken card, secondary to the Next lesson hero. It names the week's moment by its first word (taught
 * Korean with its romanization), its title in the UI language and its minutes, or "Done for this week" once the learner
 * finished it on this device. Never a count of weeks, a missed week or a score. Nothing when the drop cannot load.
 */

const koreanSpeech = { accessibilityLanguage: KOREAN_LANGUAGE, lang: KOREAN_LANGUAGE };

export function WeekDropCard({ profileId, week }: { profileId: string; week: string }): ReactElement | null {
  const m = useMessages();
  const locale = useLocale();
  const scale = useTypeScale().size;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [drop, setDrop] = useState<WeekDropEntry | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let live = true;
    weekDrops.dropOf(week).then(
      (d) => live && setDrop(d ?? null),
      () => live && setDrop(null),
    );
    return () => {
      live = false;
    };
  }, [week]);

  // Read again whenever Home comes back into focus, so finishing the drop shows A2 at once.
  useFocusEffect(
    useCallback(() => {
      let live = true;
      void readDoneWeeks(profileId).then((weeks) => live && setDone(weeks.includes(week)));
      return () => {
        live = false;
      };
    }, [profileId, week]),
  );

  if (drop === null) return null;
  const view = weekDropView(drop, locale, m.learner.cardDetail.citation);
  const state = done ? m.learner.weekDrop.done : m.learner.home.next.minutes(view.minutes);
  return (
    <Pressable
      onPress={() => navigation.navigate('WeekDrop')}
      accessibilityRole="button"
      accessibilityLabel={m.a11y.weekDrop.card(view.title, state)}
      testID="home-week-drop"
      // Its own gap above, so Home draws nothing at all while there is no card.
      style={{ minHeight: touchTarget.min, marginTop: spacing.lg }}
    >
      <Card padding="md" tone="sunken">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Icon name="sparkle" size={16} color={colors.brand.primary} />
          <Caption tone="secondary" weight="semibold">
            {m.learner.weekDrop.heading}
          </Caption>
        </View>
        <Text {...KOREAN_LINE_BREAK} style={{ marginTop: spacing.xs, color: colors.text.primary }} testID="home-week-drop-lead">
          <Text {...KOREAN_LINE_BREAK} {...koreanSpeech} style={{ fontFamily: typography.family.sansKr, fontSize: scale.title, fontWeight: typography.weight.bold }}>
            {view.lead.ko}
          </Text>
          <Text {...KOREAN_LINE_BREAK} style={{ fontSize: scale.bodySm, color: colors.text.secondary }}>{`  ${view.lead.romanization}`}</Text>
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Body weight="semibold" testID="home-week-drop-title">
              {view.title}
            </Body>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              {done ? <Icon name="check" size={16} color={colors.text.muted} /> : null}
              <Caption tone="muted" testID={done ? 'home-week-drop-done' : 'home-week-drop-minutes'}>
                {state}
              </Caption>
            </View>
          </View>
          <Icon name="arrow-right" size={24} color={colors.text.muted} />
        </View>
      </Card>
    </Pressable>
  );
}
