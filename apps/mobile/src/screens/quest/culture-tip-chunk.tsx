import { Heading, Icon, KOREAN_LANGUAGE, KOREAN_LINE_BREAK, colors, radii, spacing, typography, useTypeScale } from '@hangul-route/design-system';
import { useEffect, useSyncExternalStore, type ReactElement } from 'react';
import { Text, View } from 'react-native';
import { questById } from '../../content';
import { lessonContent, lessonEpisodes } from '../../content/lessons';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { CONTENT_OVERLAYS } from '../../logic/content-locale';
import { cardTipQuest, cultureTipView, type CultureTipView } from '../../logic/culture-tip';

/**
 * The Did you know? tip's chunk (F-CURR-002 §5.7, row CM-3C), one precached web bundle of its own, reached only through
 * the literal `import()` of `./culture-tip-entry.tsx`. Never import it statically from the start bundle (Metro would
 * then fold it back in). Its marker is `CULTURE_TIP_CHUNK`.
 */
export const CULTURE_TIP_CHUNK = 'screen-chunk:culture-tip';

// Speech language for the Korean of a token or a source; `lang` is forwarded to the DOM on the web.
const koreanSpeech = { accessibilityLanguage: KOREAN_LANGUAGE, lang: KOREAN_LANGUAGE };

/** The quest's note once its cell's chunk is in (asked for here; a quest player already has it), with the cell's id. */
function useQuestNote(questId: string | undefined): { note: ReturnType<typeof lessonContent.noteOf>; cellId: string | undefined } {
  useSyncExternalStore(lessonContent.subscribe, lessonContent.version, lessonContent.version);
  const cellId = questId === undefined ? undefined : lessonContent.cellOfQuest(questId);
  useEffect(() => {
    // A chunk that cannot load leaves the tip out; the card and the reward step stand as they are.
    if (cellId !== undefined) lessonContent.ensureCells([cellId]).catch(() => undefined);
  }, [cellId]);
  return { note: questId === undefined ? undefined : lessonContent.noteOf(questId), cellId };
}

function useTipView(questId: string | undefined): CultureTipView | null {
  const { note, cellId } = useQuestNote(questId);
  const locale = useLocale();
  const citation = useMessages().learner.cardDetail.citation;
  if (note === undefined || cellId === undefined) return null;
  return cultureTipView(note, cellId, locale, CONTENT_OVERLAYS, citation);
}

/** The reward step's tip (`QuestCultureTip`). */
export function QuestTip({ questId }: { questId: string }): ReactElement | null {
  const view = useTipView(questId);
  return view === null ? null : <TipBox view={view} place="reward" />;
}

/** A card's tip (`CardCultureTip`): the note of the quest that awards it in its lesson cell. */
export function CardTip({ cardId, face }: { cardId: string; face: 'back' | 'fact-card' }): ReactElement | null {
  const questId = cardTipQuest(cardId, lessonEpisodes, (q) => questById(q)?.rewardCardId);
  const view = useTipView(questId);
  return view === null ? null : <TipBox view={view} place={face} />;
}

/**
 * The tip: a sparkle and Did you know?, the note (each `{ko:}` token is taught Korean on a sunken chip, then its
 * romanization) and its source line. At the reward step and in the fact card it is a named region a screen reader can
 * jump to; on the card's back it sits inside the flip button, which a screen reader reads as one control, so there it
 * is drawn only (the fact card under the card repeats it).
 */
function TipBox({ view, place }: { view: CultureTipView; place: 'reward' | 'back' | 'fact-card' }): ReactElement {
  const m = useMessages().learner.cultureTip;
  const textScale = useTypeScale();
  const centered = place === 'back';
  const line = {
    fontSize: textScale.size.bodySm,
    lineHeight: textScale.size.bodySm * typography.leading.relaxed,
    color: colors.text.secondary,
    textAlign: centered ? ('center' as const) : ('left' as const),
  };
  const sourceLine = {
    fontSize: textScale.size.caption,
    lineHeight: textScale.size.caption * typography.leading.normal,
    fontWeight: typography.weight.medium,
    color: colors.text.muted,
    textAlign: line.textAlign,
  };
  const region = place === 'back' ? {} : { role: 'region' as const, 'aria-label': m.region };
  // A token's chip stands out from the box: sunken on the reward step's paper box, paper on the sunken card boxes.
  const chip = place === 'reward' ? colors.surface.sunken : colors.surface.paper;
  return (
    <View
      {...region}
      testID={`culture-tip-${place}`}
      style={{
        alignSelf: 'stretch',
        marginTop: place === 'fact-card' ? spacing.sm : spacing.md,
        backgroundColor: place === 'reward' ? colors.surface.paper : colors.surface.sunken,
        borderRadius: radii.md,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        gap: spacing.xs,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: centered ? 'center' : 'flex-start', gap: spacing.xs }}>
        <Icon name="sparkle" size={16} color={colors.brand.primary} />
        <Heading level="caption" testID="culture-tip-title">
          {m.title}
        </Heading>
      </View>
      <Text {...KOREAN_LINE_BREAK} testID="culture-tip-text" style={line}>
        {view.parts.map((part, i) =>
          'text' in part ? (
            <Text {...KOREAN_LINE_BREAK} key={i}>
              {part.text}
            </Text>
          ) : (
            <Text {...KOREAN_LINE_BREAK} key={i}>
              <Text {...KOREAN_LINE_BREAK} {...koreanSpeech} style={{ fontWeight: typography.weight.semibold, color: colors.text.primary, backgroundColor: chip }}>
                {` ${part.ko} `}
              </Text>
              {part.romanization !== '' ? <Text {...KOREAN_LINE_BREAK}>{` ${part.romanization}`}</Text> : null}
            </Text>
          ),
        )}
      </Text>
      {view.citation ? (
        <Text {...KOREAN_LINE_BREAK} testID="culture-tip-source" style={sourceLine}>
          {view.citation.runs.map((run, i) => (
            <Text {...KOREAN_LINE_BREAK} key={i} {...(run.korean ? koreanSpeech : {})}>
              {run.text}
            </Text>
          ))}
          {view.citation.more ? ` ${view.citation.more}` : ''}
        </Text>
      ) : null}
    </View>
  );
}
