import type { RomanizationMode } from '@hangul-route/content-schema';
import { Hoya, colors, koreanTextLabel, presenter, spacing, touchTarget, typography, KOREAN_LINE_BREAK } from '@hangul-route/design-system';
import type { ReactElement } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';
import type { BuildName, QuizOption, SpokenLine } from '../../../logic/lecture/build-steps';
import type { Slide } from '../../../logic/lecture/deck-builder';
import { markerFor } from '../../../logic/lecture/slide-view';
import { ROLE_PLAY_CHAT_SHARE, ROLE_PLAY_BUBBLE_SHARE, units } from '../../../logic/lecture/stage-constants';
import { optionRomShown } from '../../../logic/lecture/tools';
import { ShapeMarker } from '../ShapeMarker';
import { STAGE_BORDER, STAGE_BORDER_MIN, STAGE_GAP, STAGE_GAP_INNER, STAGE_RADIUS } from '../stage-metrics';
import { TaughtKo, usePresenterView, useStageText } from '../presenter-context';
import { AnswerLine, OptionRows } from './QuizParts';
import { ChipText, KindLabel, RomGloss, useFitLevel } from './ReadingParts';
import { revealProps } from './reveal';

type RolePlayBody = Extract<Slide, { kind: 'role-play' }>;

/**
 * The reply column fits itself (V8's measured fallback, `nextFitLevel`): level 1 draws compact rows, level 2 the
 * question at body size, level 3 the rows' romanization and meaning and Hoya's reasons at caption size.
 */
const MAX_LEVEL = 3;
/** The chat column fits itself: level 1 draws the earlier exchange at caption size, level 2 the partner's line at body size. */
const CHAT_MAX_LEVEL = 2;

/**
 * Role Play slide (design/screens/presenter/slide-role-play.md; F-CURR-002 section 8 "Role Play (a read-together
 * chat; the class picks the reply)", row CM-35). The chat on the left: the kind label and the scene's place, the
 * exchange just before this turn (the partner's line on the left, the room's reply on the right in the taught-Korean
 * chip colours, both a step smaller), and the partner's line now, named by the partner's role. On the right the
 * question ("Which answer fits?") and the replies, one row each with their shape-and-number markers, so the room
 * answers "triangle, 2" by pointing; nothing is collected, tallied or spoken into (LV-D9, section 7.7).
 *
 * Builds `question`, `answer`. At the answer every natural reply is marked as a quiz answer is (README D6), the
 * meanings join their rows, and under the rows Hoya (`thinking`) gives the reason of each less natural reply in the
 * amber nudge (`feedback.nudge` border on `feedback.nudgeLight`, its marker beside it), never red: the room sees why
 * and the chat goes on. The last turn's answer adds the scene's closing line under the chat, so every turn ends well.
 * Every part keeps its space from the first build, so nothing moves at the reveal. With `romanization: 'tap'` the
 * romanization of the partner's line and of the replies waits for the answer build (D2), as on a reply question.
 */
export function RolePlaySlide({ slide, shown, romanization }: { slide: RolePlayBody; shown: ReadonlySet<BuildName>; romanization: RomanizationMode }): ReactElement {
  const { unit, messages } = usePresenterView();
  const size = useStageText();
  const fit = useFitLevel(MAX_LEVEL, unit);
  const chatFit = useFitLevel(CHAT_MAX_LEVEL, unit);
  const onRoom = (e: LayoutChangeEvent): void => {
    fit.onRoom(e);
    chatFit.onRoom(e);
  };
  const revealed = shown.has('answer');
  const rom = optionRomShown(romanization, revealed);
  const options = slide.replies.map((r): QuizOption => ({ ko: r.ko, romanization: r.romanization, gloss: r.gloss, correct: r.natural }));
  const whys = slide.replies.flatMap((r, i) => (r.why === undefined ? [] : [{ index: i, why: r.why }]));
  const promptSize = size(fit.level >= 2 ? presenter.size.body : presenter.size.prompt);
  const gap = units(unit, spacing.md);
  return (
    <View testID="presenter-role-play" onLayout={onRoom} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: units(unit, STAGE_GAP), minHeight: 0 }}>
      <View style={{ width: ROLE_PLAY_CHAT_SHARE, minWidth: 0 }}>
        <View ref={chatFit.contentRef} onLayout={chatFit.onContent} testID="presenter-role-play-chat" {...{ dataSet: { fit: String(chatFit.level) } }} style={{ gap }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: units(unit, spacing.lg) }}>
            <KindLabel text={messages.learner.presenter.slide.rolePlay.label} testID="presenter-kind-label" />
            <Text {...KOREAN_LINE_BREAK} testID="presenter-role-play-scene" style={{ fontSize: size(presenter.size.caption), color: colors.text.primary }}>
              {slide.scene}
            </Text>
          </View>
          <View role="list" aria-label={messages.a11y.minigame.rolePlay.log} accessibilityLabel={messages.a11y.minigame.rolePlay.log} style={{ gap }}>
            {slide.before !== undefined ? (
              <>
                <Bubble who="partner" speaker={slide.partner} line={slide.before.line} rom past level={chatFit.level} />
                <Bubble who="class" line={slide.before.reply} rom past level={chatFit.level} />
              </>
            ) : null}
            <Bubble who="partner" speaker={slide.partner} line={slide.line} rom={rom} level={chatFit.level} />
          </View>
          {slide.closing !== undefined ? <Closing text={slide.closing} shown={revealed} /> : null}
        </View>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View ref={fit.contentRef} onLayout={fit.onContent} testID="presenter-role-play-replies" {...{ dataSet: { fit: String(fit.level) } }} style={{ gap }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: units(unit, STAGE_GAP_INNER), minHeight: units(unit, touchTarget.hero) }}>
            <Text
              {...KOREAN_LINE_BREAK}
              role="heading"
              testID="presenter-quiz-question"
              style={{ flex: 1, minWidth: 0, fontSize: promptSize, fontWeight: typography.weight.bold, color: colors.text.primary, lineHeight: Math.round(promptSize * typography.leading.tight) }}
            >
              {messages.learner.presenter.quiz.reply}
            </Text>
            <AnswerLine shown={revealed} />
          </View>
          <OptionRows options={options} revealed={revealed} romanization={romanization} compact={fit.level >= 1} small={fit.level >= 3} />
          {whys.length > 0 ? <Why whys={whys} shown={revealed} rom={rom} small={fit.level >= 3} /> : null}
        </View>
      </View>
    </View>
  );
}

/**
 * One chat bubble (design/wireframes/minigame/role-play.md tokens on the stage): the partner's on the left on
 * `surface.sunken` with a `border.strong` line and the role above the Korean; the room's on the right on the
 * taught-Korean chip colours (`brand.secondaryLight`, `brand.secondary`) with no name, as the learner's own bubbles
 * have none. Each is a list item named as a read-along line is, the room's as "The class said" (never a name).
 */
function Bubble({
  who,
  speaker,
  line,
  rom,
  past = false,
  level,
}: {
  who: 'partner' | 'class';
  speaker?: string;
  line: SpokenLine;
  rom: boolean;
  past?: boolean;
  level: number;
}): ReactElement {
  const { unit, messages } = usePresenterView();
  const size = useStageText();
  const border = Math.max(STAGE_BORDER_MIN, units(unit, STAGE_BORDER));
  // The earlier exchange is a step smaller from the start, and at caption size from level 1; the line now at body size from level 2.
  const small = past && level >= 1;
  const koSize = size(small ? presenter.size.caption : past || level >= 2 ? presenter.size.body : presenter.size.prompt);
  const textSize = size(presenter.size.caption);
  const said = rom ? koreanTextLabel(line.ko, line.romanization) : line.ko;
  const label = who === 'class' ? `${messages.a11y.presenter.rolePlayClass(said)}, ${line.gloss}` : `${speaker ?? ''}: ${said}, ${line.gloss}`;
  return (
    <View
      testID={who === 'class' ? 'presenter-role-play-class' : past ? 'presenter-role-play-before' : 'presenter-role-play-line'}
      role="listitem"
      accessibilityLabel={label}
      style={{
        maxWidth: ROLE_PLAY_BUBBLE_SHARE,
        alignSelf: who === 'partner' ? 'flex-start' : 'flex-end',
        gap: units(unit, spacing.xs),
        paddingVertical: units(unit, small ? spacing.sm : spacing.md),
        paddingHorizontal: units(unit, spacing.xl),
        borderWidth: border,
        borderColor: who === 'partner' ? colors.border.strong : colors.brand.secondary,
        borderRadius: units(unit, STAGE_RADIUS),
        backgroundColor: who === 'partner' ? colors.surface.sunken : colors.brand.secondaryLight,
      }}
    >
      {who === 'partner' && speaker !== undefined ? (
        <Text {...KOREAN_LINE_BREAK} style={{ fontSize: size(presenter.size.caption), fontWeight: typography.weight.semibold, color: colors.text.secondary }}>
          {speaker}
        </Text>
      ) : null}
      <TaughtKo size={koSize}>{line.ko}</TaughtKo>
      <RomGloss romanization={line.romanization} gloss={line.gloss} rom={rom} size={textSize} lit={who === 'class'} />
    </View>
  );
}

/**
 * Hoya's reasons at the answer build: one amber box (`feedback.nudge` border on `feedback.nudgeLight`) with Hoya
 * `thinking`, and for each less natural reply its marker and its reason (`{ko:}` tokens as Korean chips). It keeps its
 * space from the first build, so the rows above it never move; it is not read before it shows.
 */
function Why({ whys, shown, rom, small }: { whys: ReadonlyArray<{ index: number; why: NonNullable<RolePlayBody['replies'][number]['why']> }>; shown: boolean; rom: boolean; small: boolean }): ReactElement {
  const { unit, messages } = usePresenterView();
  const hidden = revealProps(shown);
  return (
    <View
      testID="presenter-role-play-why"
      aria-hidden={hidden['aria-hidden']}
      accessibilityElementsHidden={!shown}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: units(unit, STAGE_GAP_INNER),
          paddingVertical: units(unit, spacing.sm),
          paddingHorizontal: units(unit, spacing.xl),
          borderWidth: Math.max(STAGE_BORDER_MIN, units(unit, STAGE_BORDER)),
          borderColor: colors.feedback.nudge,
          borderRadius: units(unit, STAGE_RADIUS),
          backgroundColor: colors.feedback.nudgeLight,
        },
        hidden.style,
      ]}
    >
      <Hoya pose="thinking" size={units(unit, touchTarget.min)} accessibilityLabel={messages.a11y.hoya('thinking')} />
      <View style={{ flex: 1, minWidth: 0, gap: units(unit, spacing.xs) }}>
        {whys.map(({ index, why }) => {
          const marker = markerFor(index, presenter.marker.shapes);
          return (
            <View key={index} testID="presenter-role-play-why-row" style={{ flexDirection: 'row', alignItems: 'center', gap: units(unit, spacing.md) }}>
              <ShapeMarker shape={marker.shape} n={marker.n} side={presenter.size.body} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <ChipText pieces={why} rom={rom} small={small} />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** The scene's closing line on the last turn (content in the slide language), joining under the chat at the answer build. */
function Closing({ text, shown }: { text: string; shown: boolean }): ReactElement {
  const { unit } = usePresenterView();
  const size = useStageText();
  return (
    <View
      testID="presenter-role-play-closing"
      aria-hidden={!shown}
      style={[
        {
          paddingVertical: units(unit, spacing.sm),
          paddingHorizontal: units(unit, spacing.xl),
          borderWidth: Math.max(STAGE_BORDER_MIN, units(unit, STAGE_BORDER)),
          borderColor: colors.feedback.success,
          borderRadius: units(unit, STAGE_RADIUS),
          backgroundColor: colors.feedback.successLight,
        },
        revealProps(shown).style,
      ]}
    >
      <Text {...KOREAN_LINE_BREAK} style={{ fontSize: size(presenter.size.body), fontWeight: typography.weight.semibold, color: colors.text.primary }}>
        {text}
      </Text>
    </View>
  );
}
