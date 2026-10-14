import {
  Body,
  Button,
  ChoiceCard,
  Heading,
  HoyaBubble,
  KoreanText,
  layout,
  Pill,
  Progress,
  RealiaSheet,
  Screen,
  Spacer,
  spacing,
  touchTarget,
  useLayoutClass,
  useMediaSize,
} from '@hangul-route/design-system';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import { useRomanizationMode } from '../../i18n/use-romanization-mode';
import { screenScrollsWithColumns } from '../../logic/layout/game-layout';
import type { MinigameScope } from '../../logic/minigame-config';
import {
  lineSpeech,
  lineViews,
  playableRealia,
  realiaArrangement,
  realiaHeaderView,
  realiaKeyLabel,
  realiaOptionColumns,
  realiaOptionView,
  realiaStatus,
  sheetKind,
  sheetSummary,
  shuffleRealiaOptions,
  startRealiaRead,
  stepRealiaRead,
  titleView,
  type RealiaReadEffect,
  type RealiaReadEvent,
  type RealiaReadState,
} from '../../logic/realia-read-flow';
import { playPrompt, stop } from '../../platform/audio';
import { nudge, success, tapLight } from '../../platform/haptics';
import { GameColumns } from './GameColumns';
import type { MinigameHost } from './host';
import { PictureArt } from './PictureArt';

/**
 * Realia Read (F-CURR-001 §3.6, row G-2): read a drawn menu, ticket, trail sign or price cards
 * and pick the answer to each question. The behaviour lives in `logic/realia-read-flow.ts`
 * (reducer, effects, view-models); this file renders it and runs the effects. Reading is the
 * skill: nothing here asks the learner to speak. Design: design/wireframes/minigame/realia-read.md,
 * design/screens/minigame-realia-read/.
 */

interface Props {
  scope: MinigameScope;
  host: MinigameHost;
  /** Leave an empty scope (never a dead end). */
  onBack?: () => void;
}

/** D-2 D7: the realia stays in view beside the options. One flag for the Screen and GameColumns. */
const STICKY_PROMPT = true;

export function RealiaReadGame({ scope, host, onBack }: Props): React.ReactElement {
  const [seed] = useState(() => Math.floor(Math.random() * 0x7fffffff));
  const play = useMemo(() => {
    const p = playableRealia(scope);
    return p ? { realia: p.realia, rounds: p.rounds.map((r, i) => shuffleRealiaOptions(r, seed + i)) } : null;
  }, [scope, seed]);

  const m = useMessages();
  const copy = m.learner.minigame;
  const a11y = m.a11y.minigame;
  const romanizationMode = useRomanizationMode();
  const layoutClass = useLayoutClass();
  const pictureSize = useMediaSize(touchTarget.hero);

  const [state, setState] = useState<RealiaReadState>(() => startRealiaRead(play?.rounds.length ?? 0));
  const stateRef = useRef(state);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hostRef = useRef(host);
  hostRef.current = host;
  const playRef = useRef(play);
  playRef.current = play;
  const dispatchRef = useRef<(event: RealiaReadEvent) => void>(() => undefined);

  const runEffect = useCallback((effect: RealiaReadEffect): void => {
    const current = playRef.current;
    switch (effect.type) {
      case 'answer': {
        const round = current?.rounds[effect.roundKey];
        hostRef.current.answer(effect.roundKey, effect.correct, round ? { itemId: round.id } : undefined);
        return;
      }
      case 'haptic':
        if (effect.kind === 'success') {
          tapLight();
          success();
        } else if (effect.kind === 'nudge') {
          nudge();
        } else {
          tapLight();
        }
        return;
      case 'play-line': {
        const entry = current?.realia.entries.find((e) => e.id === effect.entryId);
        // No voice: the line still shows its romanization (the reducer revealed it); nothing blocks.
        if (entry) void playPrompt(lineSpeech(entry));
        return;
      }
      case 'play-option': {
        const option = current?.rounds[stateRef.current.roundIdx]?.options.find((o) => o.id === effect.optionId);
        if (option?.text) void playPrompt({ text: option.text.spokenKo ?? option.text.ko, audioRef: option.text.audioRef });
        return;
      }
      case 'schedule-advance':
        advanceTimer.current = setTimeout(() => dispatchRef.current({ type: 'advance' }), effect.ms);
        return;
      case 'complete':
        hostRef.current.complete();
        return;
    }
  }, []);

  const dispatch = useCallback(
    (event: RealiaReadEvent): void => {
      const out = stepRealiaRead(stateRef.current, event);
      stateRef.current = out.state;
      setState(out.state);
      out.effects.forEach(runEffect);
    },
    [runEffect],
  );
  dispatchRef.current = dispatch;

  useEffect(
    () => () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      stop();
    },
    [],
  );

  const round = play?.rounds[state.roundIdx];
  if (!play || state.status === 'empty' || !round) {
    return (
      <Screen>
        <Body>{copy.realia.empty}</Body>
        {onBack ? (
          <>
            <Spacer size="lg" />
            <Button label={copy.backToQuest.cta} tone="secondary" size="md" onPress={onBack} />
          </>
        ) : null}
      </Screen>
    );
  }

  const context = { romanizationMode };
  const header = realiaHeaderView(host.mode, state, copy);
  const title = titleView(play.realia, context);
  const lines = lineViews(play.realia, round, state, context, a11y);
  const status = realiaStatus(play.realia, round, state, host.mode, copy, a11y);
  const arrangement = realiaArrangement(layoutClass.windowWidth, layout.sideBySideMin);
  const columns = arrangement === 'side' ? 1 : realiaOptionColumns(round, layoutClass.windowWidth);
  // D7 on native: the sheet stays put beside the options, so the screen does not scroll; each column does.
  const screenScrolls = screenScrollsWithColumns(arrangement, STICKY_PROMPT, Platform.OS);

  return (
    <Screen tone="canvas" scrollable={screenScrolls}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          {header.kind === 'dots' ? (
            <Progress variant="dots" value={header.value} max={header.max} tone="primary" />
          ) : (
            <Progress value={header.value} max={header.max} tone="primary" />
          )}
        </View>
        {header.title ? <Pill label={header.title} tone="primary" size="sm" /> : null}
        {header.label ? <Pill label={header.label} tone="neutral" size="sm" /> : null}
      </View>

      <Spacer size="lg" />
      <GameColumns
        arrangement={arrangement}
        stackedGap="lg"
        stickyPrompt={STICKY_PROMPT}
        resetKey={round.id}
        feedbackKey={status.hoya || status.lookHere ? `${state.wrongIds.length}|${status.hoya ?? ''}|${status.lookHere ?? ''}` : undefined}
        prompt={
          <View testID="realia-read-sheet-column" style={{ gap: spacing.sm }}>
            <RealiaSheet
              testID="realia-read-sheet"
              kind={sheetKind(play.realia)}
              title={title ? { ko: title.ko, romanization: title.romanization } : undefined}
              titleLabel={title?.label}
              lines={lines}
              accessibilityLabel={sheetSummary(play.realia, a11y)}
              lineHint={a11y.realia.lineHint}
              onPressLine={(entryId) => dispatch({ type: 'line', entryId })}
            />
            <Body tone="muted">{copy.realia.lineHint}</Body>
          </View>
        }
        answers={
          <View style={{ gap: spacing.md }}>
            <Heading level="prompt" testID="realia-read-question">
              {round.questionEn}
            </Heading>
            {round.key ? (
              <View style={{ alignItems: 'center' }}>
                <KoreanText
                  testID="realia-read-key"
                  ko={round.key.ko}
                  romanization={round.key.romanization}
                  romanizationShown={romanizationMode === 'always'}
                  size="sm"
                  accessibilityLabel={realiaKeyLabel(round.key, m.a11y.koreanItem)}
                />
              </View>
            ) : null}
            <View testID="realia-read-options" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
              {round.options.map((option) => {
                const view = realiaOptionView(round, option, state, context, a11y, m.a11y.koreanItem);
                return (
                  <View key={option.id} style={{ flexGrow: 1, flexBasis: columns === 2 ? '45%' : '100%', minWidth: touchTarget.hero }}>
                    <ChoiceCard
                      testID={`realia-read-option-${option.id}`}
                      state={view.cardState}
                      ko={view.ko}
                      romanization={view.romanization}
                      label={view.label}
                      art={view.pictureRef !== undefined ? <PictureArt pictureRef={view.pictureRef} gloss={view.label ?? ''} size={pictureSize} /> : undefined}
                      accessibilityLabel={view.accessibilityLabel}
                      onPress={() => dispatch({ type: 'tap', optionId: option.id, answerId: round.answerId, at: Date.now() })}
                    />
                  </View>
                );
              })}
            </View>
          </View>
        }
        feedback={
          <View accessibilityLiveRegion="polite" testID="realia-read-status">
            {status.hoya ? (
              <>
                <Spacer size="lg" />
                <HoyaBubble tone="thinking" message={status.hoya} />
              </>
            ) : null}
            {status.lookHere ? (
              <Body tone="muted" testID="realia-read-look-here">
                {status.lookHere}
              </Body>
            ) : null}
          </View>
        }
      />
      <Spacer size="xl" />
    </Screen>
  );
}
