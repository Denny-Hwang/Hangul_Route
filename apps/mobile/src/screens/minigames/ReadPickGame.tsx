import { Body, Button, ChoiceCard, Heading, HoyaBubble, KOREAN_LANGUAGE, KOREAN_LINE_BREAK, Pill, Screen, Spacer, colors, motion, spacing, typography, useLayoutClass, useTypeScale, type ChoiceCardState } from '@hangul-route/design-system';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { Text, View } from 'react-native';
import { findJamo } from '../../content/jamo';
import { useMessages } from '../../i18n/use-messages';
import type { ReadPickOption } from '../../logic/match-shape/fallback';
import { soundSpoken } from '../../logic/match-shape/view';
import type { MinigameScope } from '../../logic/minigame-config';
import { shuffleSeeded } from '../../logic/story/seeded-order';
import { playJamo, stop } from '../../platform/audio';
import { nudge, success } from '../../platform/haptics';
import { useReducedMotion } from '../../platform/motion';
import type { MinigameHost } from './host';

/**
 * Read Pick, Match Shape's fallback round while `game.match-shape` is off (F-CURR-002 sections 7.1 F4 and 12.2, row
 * CM-33; design/wireframes/minigame/match-shape.md, Fallback round; board M3 of the variety mocks): see the letter,
 * pick its sound among 3 on the Listen & Pick option cards (`ChoiceCard`), the `sym` read rung. Its options keep
 * `read-pick-values-distinct` (`matchShapeToReadPick`). The first tap of a round is scored, at the read rung; a miss is
 * the amber nudge with Hoya's line and the round stays open; the right card says the letter's sound once and the next
 * round follows after a short pause (at once with reduced motion). The letter alone is the prompt: no romanization is
 * drawn under it, since that would answer the round.
 */

const koreanSpeech = { accessibilityLanguage: KOREAN_LANGUAGE, lang: KOREAN_LANGUAGE };

interface Props {
  scope: MinigameScope;
  host: MinigameHost;
  onBack?: () => void;
}

export function ReadPickGame({ scope, host, onBack }: Props): ReactElement {
  const m = useMessages();
  const copy = m.learner.minigame;
  const scale = useTypeScale().size;
  const lc = useLayoutClass();
  const reduced = useReducedMotion();
  const [seed] = useState(() => Math.floor(Math.random() * 0x7fffffff));
  const rounds = useMemo(() => (scope.readPick?.rounds ?? []).map((r, i) => ({ ...r, options: shuffleSeeded(r.options, seed + i) })), [scope, seed]);
  const [index, setIndex] = useState(0);
  const [wrong, setWrong] = useState<readonly string[]>([]);
  const [solved, setSolved] = useState(false);
  const answered = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const done = useRef(false);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      stop();
    },
    [],
  );

  const round = rounds[index];
  if (round === undefined) {
    return (
      <Screen>
        <Body>{copy.listenPick.empty}</Body>
        {onBack ? (
          <>
            <Spacer size="lg" />
            <Button label={copy.backToQuest.cta} tone="secondary" size="md" onPress={onBack} />
          </>
        ) : null}
      </Screen>
    );
  }
  const letter = findJamo(round.target);

  const next = (): void => {
    timer.current = null;
    answered.current = false;
    setWrong([]);
    setSolved(false);
    if (index + 1 < rounds.length) setIndex(index + 1);
    else if (!done.current) {
      done.current = true;
      host.complete();
    }
  };

  const tap = (option: ReadPickOption): void => {
    if (solved) return;
    const right = option.id === round.answerId;
    if (!answered.current) {
      answered.current = true;
      host.answer(round.id, right, { itemId: round.id });
    }
    if (right) {
      success();
      setSolved(true);
      // Read Pick is a sound question (AMENDMENTS-AUDIO-CLIPS JV-A1, section 6.1): the learner saw the letter and picked
      // its sound, so the confirmation says the letter's sound syllable (ㄴ is na, ㅏ is a), never a name on a sound pick.
      if (letter) void playJamo(letter, 'sound');
      timer.current = setTimeout(next, reduced ? 0 : motion.duration.celebration);
    } else if (!wrong.includes(option.id)) {
      nudge();
      setWrong([...wrong, option.id]);
    }
  };

  const stateOf = (option: ReadPickOption): ChoiceCardState => {
    if (option.id === round.answerId) return solved ? 'correct' : 'idle';
    return wrong.includes(option.id) ? 'wrong' : solved ? 'disabled' : 'idle';
  };

  return (
    <Screen tone="canvas" testID="read-pick-game">
      <Pill label={copy.progress.pill(index + 1, rounds.length)} size="sm" />
      <Spacer size="md" />
      <Heading level="prompt">{copy.matchShape.readPick.heading}</Heading>
      <Spacer size="lg" />
      <View style={{ alignItems: 'center' }}>
        <Text {...KOREAN_LINE_BREAK} {...koreanSpeech} testID="read-pick-letter" style={{ fontFamily: typography.family.sansKr, fontSize: scale.hero, fontWeight: typography.weight.bold, color: colors.text.primary }}>
          {letter?.char ?? ''}
        </Text>
      </View>
      <Spacer size="lg" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {round.options.map((option) => (
          <View key={option.id} style={{ flexGrow: 1, flexBasis: lc.width === 'compact' ? '30%' : '20%', minWidth: 0 }}>
            <ChoiceCard
              state={stateOf(option)}
              label={option.sound}
              onPress={() => tap(option)}
              accessibilityLabel={soundSpoken(option.sound, m.a11y.minigame.matchShape)}
              testID={`read-pick-option-${option.id}`}
            />
          </View>
        ))}
      </View>
      <Spacer size="lg" />
      <View accessibilityLiveRegion="polite">
        {wrong.length > 0 && !solved ? <HoyaBubble tone="thinking" message={copy.matchShape.readPick.miss} testID="read-pick-hoya" /> : null}
      </View>
    </Screen>
  );
}
