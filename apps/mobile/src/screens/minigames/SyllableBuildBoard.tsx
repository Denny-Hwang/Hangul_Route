import type { SyllableZone } from '@hangul-route/content-schema';
import {
  Body,
  Caption,
  Button,
  HoyaBubble,
  Icon,
  KOREAN_LANGUAGE,
  KOREAN_LINE_BREAK,
  KoreanText,
  TAP_LOCK_MS,
  TapBoard,
  TapTarget,
  borderWidth,
  colors,
  motion,
  radii,
  spacing,
  touchTarget,
  typography,
  useMediaSize,
  usePressLook,
  useTapLock,
  useTypeScale,
  pressInset,
  pressTransform,
  GuardedPressable,
} from '@hangul-route/design-system';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { Pressable, Text, View } from 'react-native';
import { CantHear } from '../../components/CantHear';
import { PromptPanel } from '../../components/PromptPanel';
import { VoiceHelpSheet } from '../../components/VoiceHelpSheet';
import { heldAnswers } from '../../components/held-answers';
import { usePromptSlot } from '../../components/use-prompt-slot';
import { useSoundPacing } from '../../components/use-sound-pacing';
import { useMessages } from '../../i18n/use-messages';
import { afterMiss, afterRightAnswer, answerItem, answerOptionLabel, lookHereLine } from '../../logic/answer-feedback';
import { shouldAutoReplay } from '../../logic/audio/prompt-view';
import { hoyaLine, NO_FINAL, startBuild, stepBuild, wantedLetter, type BuildEffect, type BuildEvent, type BuildState } from '../../logic/syllable-build/flow';
import { letterName } from '../../logic/syllable-build/letters';
import { partsOf } from '../../logic/syllable-build/pool';
import type { TileRows } from '../../logic/syllable-build/tiles';
import { promptView, rowViews, zoneViews, type TileLook, type ZoneLook } from '../../logic/syllable-build/view';
import { hasClipFor, playPrompt, stop, type PlaySpec } from '../../platform/audio';
import { nudge, success, tapLight } from '../../platform/haptics';
import { AnswerAnnouncer } from './answer-announcer';
import { CornerMark, LookHereRing } from './answer-marks';
import { useAnswerAnnouncement, type AnswerAnnouncement } from './use-answer-announcement';
import { useRoundNext } from './use-round-next';

/**
 * One Syllable Build round (F-CURR-002 section 7.1 F3, row CM-32; design/wireframes/minigame/syllable-build.md, the mock
 * design/screens/minigame-variety/mock/syllable-build.html and D5 of its README): the speaker and the meaning button
 * beside the block, then three labelled rows of jamo-only tiles (First letter, Vowel, Final with No final last), then
 * Hoya's line. The behaviour is `logic/syllable-build/flow.ts`; this file draws it and runs its effects. It serves a
 * quest step (`SyllableBuildGame`), a review round at the produce rung and the Block Sprint.
 *
 * - Tiles at `touchTarget.min` (64, the 48 dp floor met), zones 64 x 64 on a phone with the final zone 64 tall across
 *   the block, `touchTarget.hero` from regular. Four tiles and their gaps fit the 288 of a 320 window.
 * - A miss is amber with the `replay` mark, never red; the right block takes the success look with the `check` glyph.
 * - Reduced motion: nothing moves (letters appear in place, nothing pulses); the pause before the next round stays,
 *   so the built block and its sound are not skipped.
 *
 * Answer feedback (F-A11Y-001 row AF-4c; design/components/AnswerFeedback/spec.md D2, D4, D9): the drawn dot is `replay`
 * at 20 inside the corner of a zone or tile, a right zone shows `check`, the second miss rings the right tile with the
 * dashed look-here ring, and a marked or right zone and a marked tile are named with the state first. Each result is
 * said once by the answer announcer (the right block by its romanization, a miss by the letter that did not fit, never
 * Hangul); the least wait after a right block is the 1000 ms floor, and with a screen reader on the block shows Next and
 * waits for it (OD-AF9 (b)) and the block's sound starts after the line. The sound that replays by itself after a miss
 * is not played with a reader on (the learner taps Hear it). A quest step passes its own `speech` so its heading can be
 * the round's header node.
 */

export interface BoardTarget {
  ko: string;
  romanization: string;
  /** The word's meaning in the UI language; a bare block has none. */
  gloss?: string;
  spokenKo?: string;
  audioRef?: string;
}

export interface SyllableBuildBoardProps {
  target: BoardTarget;
  tiles: TileRows;
  /** A zone already filled and locked (a symbol item at the produce rung). */
  fixed?: SyllableZone;
  /** The first full block: the scored answer. */
  onFirst: (correct: boolean, hinted: boolean) => void;
  /** The block is right and has been said: on to the next round. */
  onSolved: () => void;
  /** The block has just come right (before the pause): the Block Sprint holds its clock here. */
  onRight?: () => void;
  /** Say the block when the round opens (not on a quest's first round, whose first sound needs a tap). */
  autoplay: boolean;
  /** The surface id for the sound notice's telemetry (`audio.fallback_shown`). */
  source: string;
  /**
   * Offer "Can't hear it?" next to the speaker (AMENDMENTS-AUDIO-CANT-HEAR CH-1b): the quest step and the review round
   * do, and so do the Stage and Cell Check (CH-1e); the Block Sprint (a clocked drill, OD-CH4) does not. Show the letters shows
   * the block's romanization, never the block.
   */
  cantHear?: boolean;
  /** A Check: "Always show the letters" does not apply (owner decision 2026-11-25). */
  soundFirst?: boolean;
  /** The quest step's announcement hook, when its heading is the round's header node (§3.4); else the board has its own. */
  speech?: AnswerAnnouncement;
  testID?: string;
}

/** How long the built block stays on screen, with its sound, before the next round. */
export const SOLVED_PAUSE_MS = motion.duration.celebration;

/** A mark's inset from the corner of a zone or tile (AnswerFeedback: inside the corner, `spacing.xs`). */
const MARK_INSET = spacing.xs;
/** A jamo face is part of its tile's picture: half the tile, so it keeps its size at every text setting (wireframe, States). */
const JAMO_FACE = 0.5;
const koreanSpeech = { accessibilityLanguage: KOREAN_LANGUAGE, lang: KOREAN_LANGUAGE };

const ZONE_LOOK: Record<ZoneLook, { backgroundColor?: string; borderColor: string; borderWidth: number; borderStyle: 'solid' | 'dashed' }> = {
  empty: { borderColor: colors.border.shape, borderWidth: borderWidth.base, borderStyle: 'dashed' },
  filled: { backgroundColor: colors.brand.secondaryLight, borderColor: colors.brand.secondary, borderWidth: borderWidth.base, borderStyle: 'solid' },
  fixed: { backgroundColor: colors.surface.sunken, borderColor: colors.border.subtle, borderWidth: borderWidth.base, borderStyle: 'solid' },
  marked: { backgroundColor: colors.feedback.nudgeLight, borderColor: colors.feedback.nudge, borderWidth: borderWidth.thick, borderStyle: 'solid' },
  right: { backgroundColor: colors.feedback.successLight, borderColor: colors.feedback.success, borderWidth: borderWidth.thick, borderStyle: 'solid' },
};

function tileColors(zone: SyllableZone, look: TileLook): { backgroundColor: string; borderColor: string; borderWidth: number; borderBottomWidth?: number } {
  if (look === 'selected') return { backgroundColor: colors.brand.secondaryLight, borderColor: colors.brand.secondary, borderWidth: borderWidth.thick };
  if (look === 'marked') return { backgroundColor: colors.feedback.nudgeLight, borderColor: colors.feedback.nudge, borderWidth: borderWidth.thick };
  // The keyboard's two quiet fills: paper for consonants, sunken for vowels; a final tile has the Build a Letter base line.
  if (zone === 'vowel') return { backgroundColor: colors.surface.sunken, borderColor: colors.border.subtle, borderWidth: borderWidth.base };
  if (zone === 'final') return { backgroundColor: colors.surface.paper, borderColor: colors.border.subtle, borderWidth: borderWidth.base, borderBottomWidth: spacing.xs };
  return { backgroundColor: colors.surface.paper, borderColor: colors.border.subtle, borderWidth: borderWidth.base };
}

/** What the built word's speaker plays: its recording, else the device voice on its spoken text. */
function targetSpeech(target: SyllableBuildBoardProps['target'], source: string): PlaySpec {
  return { text: target.spokenKo ?? target.ko, ...(target.audioRef ? { audioRef: target.audioRef } : {}), kind: 'word', source };
}

export function SyllableBuildBoard({ target, tiles, fixed, onFirst, onSolved, onRight, autoplay, source, cantHear = false, soundFirst = false, speech, testID = 'syllable-build' }: SyllableBuildBoardProps): ReactElement {
  const m = useMessages();
  const copy = m.learner.minigame.syllableBuild;
  const a11y = m.a11y.minigame.syllableBuild;
  const scale = useTypeScale().size;
  const tile = useMediaSize(touchTarget.min);
  const zoneTop = useMediaSize(touchTarget.min) > touchTarget.min ? touchTarget.hero : touchTarget.min;
  const parts = useMemo(() => partsOf(target.ko), [target.ko]);

  // [FU] FU-3: the slot asks about what plays (the target's recording, else the say clip of its spoken text).
  const slot = usePromptSlot({ source, hasClip: hasClipFor(targetSpeech(target, source)), cantHear, soundFirst });
  const speakerRef = useRef<View | null>(null);
  const { play: slotPlay } = slot;
  const viewRef = useRef(slot.view);
  viewRef.current = slot.view;
  const noVoice = slot.view.textShown;
  const [helpOpen, setHelpOpen] = useState(false);
  const press = usePressLook();
  const tapLock = useTapLock();
  const lockRef = useRef(tapLock.lock);
  lockRef.current = tapLock.lock;

  const [state, setState] = useState<BuildState>(() => (parts ? startBuild(parts, fixed ?? null) : startBuild({ first: '', vowel: '', final: null })));
  const stateRef = useRef(state);
  // F-A11Y-001 AF-4c: each result is said once by the answer announcer; with a screen reader on a right block shows Next.
  const ownSpeech = useAnswerAnnouncement();
  const a = speech ?? ownSpeech;
  const aRef = useRef(a);
  aRef.current = a;
  const nextButton = useRoundNext();
  const nextRef = useRef(nextButton);
  nextRef.current = nextButton;
  const mounted = useRef(true);
  /** The block has moved on (Next, or its wait): a second Next, or a late wait or sound, does nothing. */
  const moved = useRef(false);
  const replayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // [QS] AMENDMENTS-QUEST-SOUND-BACK QS-4: the next round waits for the built word to be said.
  const pacing = useSoundPacing();
  const handlers = useRef({ onFirst, onSolved, onRight });
  handlers.current = { onFirst, onSolved, onRight };
  // Read when a result comes, so `dispatch` keeps one identity.
  const latestTexts = useRef({ a11y: m.a11y, lookHere: copy.lookHere });
  latestTexts.current = { a11y: m.a11y, lookHere: copy.lookHere };
  const targetRomanization = useRef(target.romanization);
  targetRomanization.current = target.romanization;
  const targetGloss = useRef(target.gloss);
  targetGloss.current = target.gloss;

  const say = useCallback((): void => {
    void pacing.track(slotPlay(() => playPrompt(targetSpeech(target, source))));
  }, [slotPlay, target, source, pacing]);

  const dispatchRef = useRef<(e: BuildEvent) => void>(() => undefined);
  const run = useCallback(
    (effect: BuildEffect): void => {
      switch (effect.type) {
        case 'answer':
          handlers.current.onFirst(effect.correct, effect.hinted);
          return;
        case 'play':
          // With a screen reader on the sound is not replayed by itself after a miss: the learner taps Hear it (§3.4).
          if (effect.why === 'replay' && (!shouldAutoReplay(viewRef.current) || aRef.current.readerOn)) return;
          say();
          return;
        case 'schedule-replay':
          replayTimer.current = setTimeout(() => dispatchRef.current({ type: 'replay-due' }), effect.ms);
          return;
        case 'cancel-replay':
          if (replayTimer.current) clearTimeout(replayTimer.current);
          replayTimer.current = null;
          return;
        case 'haptic':
          if (effect.kind === 'success') {
            tapLight();
            success();
          } else nudge();
          return;
        case 'solved':
          // The round-ending commit locks the app clock, so the next round's keyed board mounts locked (KT-D5).
          lockRef.current(TAP_LOCK_MS);
          handlers.current.onRight?.();
          return;
      }
    },
    [say],
  );

  /** The block moves on once: Next, or the wait that follows a right block with the reader off. */
  const moveOn = useCallback((): void => {
    if (moved.current || !mounted.current) return;
    moved.current = true;
    nextRef.current.hide();
    handlers.current.onSolved();
  }, []);

  const dispatch = useCallback(
    (event: BuildEvent): void => {
      if (!parts) return;
      const before = stateRef.current;
      const out = stepBuild(before, event, { target: parts, voice: !viewRef.current.textShown });
      stateRef.current = out.state;
      setState(out.state);
      const solved = out.effects.some((e) => e.type === 'solved');
      const missed = out.effects.some((e) => e.type === 'schedule-replay');
      const { a11y: texts } = latestTexts.current;
      const speak = aRef.current;
      if (solved) {
        // The block's sound is the right answer's own: it starts after the line, and is dropped if Next came first.
        const sound = out.effects.find((e) => e.type === 'play' && e.why === 'right');
        out.effects.filter((e) => e !== sound).forEach(run);
        const say = (): Promise<void> => speak.announce({ kind: 'right', item: answerItem(texts, targetRomanization.current, targetGloss.current) });
        void afterRightAnswer({
          readerOn: speak.readerOn,
          gameMinMs: SOLVED_PAUSE_MS,
          announce: speak.readerOn ? () => nextRef.current.afterFocus(say) : say,
          play: () => {
            if (moved.current || !mounted.current) return;
            if (sound) run(sound);
          },
          showNext: () => nextRef.current.show(),
          waitThenAdvance: (minMs) => void pacing.after(minMs, moveOn),
        });
        return;
      }
      out.effects.forEach(run);
      if (missed) {
        // The letter of the first zone that did not fit; the miss that turns the look-here ring on carries its line (§3.2).
        const zone = (['first', 'vowel', 'final'] as const).find((z) => out.state.marked.includes(z));
        const tried = zone === undefined ? null : out.state.zones[zone];
        // No final is a tile with no letter: it is named, never left empty ("Not this one: . Listen again.").
        const item = tried === null || tried === undefined ? '' : tried === NO_FINAL ? texts.minigame.syllableBuild.noFinal : letterName(tried);
        const ringed = out.state.ring !== null && before.ring === null;
        afterMiss({
          readerOn: speak.readerOn,
          announce: () => speak.announce(ringed ? { kind: 'missHint', item, hint: latestTexts.current.lookHere } : { kind: 'missListen', item }),
        });
      }
    },
    [parts, run, pacing, moveOn],
  );
  dispatchRef.current = dispatch;

  useEffect(() => {
    mounted.current = true;
    if (autoplay) say();
    return () => {
      mounted.current = false;
      if (replayTimer.current) clearTimeout(replayTimer.current);
      stop();
    };
    // Once per round: the board is keyed by its round.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!parts) return <Body>{copy.heading}</Body>;

  const rows = rowViews(tiles, state, parts, copy, a11y);
  const zones = zoneViews(state, copy, a11y);
  const prompt = promptView(target, state, noVoice, a11y);
  const line = hoyaLine(state, parts);
  const speakerLabel = slot.view.reason === 'muted' || slot.view.reason === 'blocked' ? slot.view.speakerLabel : m.a11y.minigame.hearAgain;
  const right = state.status === 'right';

  // A zone is a take-back target (AMENDMENTS-TOUCH 6, row KT-6): only a touch inside it clears it (`gapFill={false}`),
  // outside its own lock, so a bounce on a tile never empties the zone it just filled.
  const zoneBox = (zone: (typeof zones)[number], width: number, height: number): ReactElement => {
    const look = ZONE_LOOK[zone.look];
    // The state first (§3.2): a zone that did not fit is "Not this one", the built block's zones are "Right answer".
    const label = zone.look === 'marked' ? answerOptionLabel('wrong', zone.accessibilityLabel, m.a11y.minigame.option) : zone.look === 'right' ? answerOptionLabel('correct', zone.accessibilityLabel, m.a11y.minigame.option) : zone.accessibilityLabel;
    return (
      <TapTarget
        key={zone.zone}
        testID={`${testID}-zone-${zone.zone}`}
        accessibilityLabel={label}
        // A right block is locked, never disabled (§3.1); an empty or fixed zone has nothing to take back.
        disabled={!zone.tappable && zone.look !== 'right'}
        inactive={zone.look === 'right'}
        gapFill={false}
        onCommit={() => dispatch({ type: 'clear', zone: zone.zone })}
      >
        {({ pressed }) => {
          const p = pressed && zone.tappable ? press : null;
          return (
            <View
              style={{
                width,
                height,
                borderRadius: radii.lg,
                alignItems: 'center',
                justifyContent: 'center',
                ...look,
                ...(p ? { borderColor: p.borderColor, borderWidth: p.borderWidth, borderStyle: 'solid' as const } : {}),
                transform: pressTransform(p),
              }}
            >
              {zone.face !== null ? (
                zone.text ? (
                  <Text {...KOREAN_LINE_BREAK} style={{ fontSize: scale.bodySm, fontWeight: typography.weight.semibold, color: colors.text.primary, textAlign: 'center' }}>{zone.face}</Text>
                ) : (
                  <Text {...KOREAN_LINE_BREAK} {...koreanSpeech} style={{ fontSize: Math.round(JAMO_FACE * Math.min(width, height)), fontWeight: typography.weight.bold, color: colors.text.primary }}>
                    {zone.face}
                  </Text>
                )
              ) : null}
              {zone.look === 'marked' || zone.look === 'right' ? <CornerMark mark={zone.look === 'right' ? 'right' : 'miss'} inset={MARK_INSET} testID={`${testID}-mark-zone-${zone.zone}`} /> : null}
            </View>
          );
        }}
      </TapTarget>
    );
  };

  const [first, vowel, final] = zones as [(typeof zones)[number], (typeof zones)[number], (typeof zones)[number]];
  const blockWidth = 2 * zoneTop + spacing.sm;

  return (
    <View testID={testID} style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', gap: spacing.lg, alignItems: 'flex-start' }}>
        <View style={{ flexShrink: 1, gap: spacing.sm, minWidth: touchTarget.min }}>
          <GuardedPressable
            ref={speakerRef}
            setsLock={false}
            testID={`${testID}-speaker`}
            onPress={say}
            accessibilityRole="button"
            accessibilityLabel={speakerLabel}
            style={{
              width: touchTarget.min,
              height: touchTarget.min,
              borderRadius: radii.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.brand.secondary,
            }}
          >
            <Icon name="speaker" size={spacing.xl} color={colors.text.onSecondary} />
          </GuardedPressable>
          {slot.cantHear ? (
            <CantHear
              // Keyed by the block: a round is a new board, but a new block closes an open sheet all the same.
              round={target.ko}
              active={slot.cantHearActive}
              onHear={say}
              onShowLetters={slot.showLetters}
              focusAfter={speakerRef}
              lettersText={target.romanization}
            />
          ) : null}
          {right ? (
            // The announcer says the built block once, so this is not a live region too (§3.3).
            <View testID={`${testID}-built`}>
              <KoreanText ko={target.ko} romanization={target.romanization} gloss={target.gloss} size="md" accessibilityLabel={prompt.blockLabel ?? undefined} />
            </View>
          ) : (
            <Pressable
              testID={`${testID}-meaning`}
              accessibilityRole="button"
              accessibilityLabel={[prompt.gloss !== undefined && prompt.gloss !== '' ? a11y.meaning(prompt.gloss) : null, prompt.showLink ? copy.showSound : prompt.sound].filter((x): x is string => x !== null).join('. ')}
              disabled={!prompt.showLink}
              onPress={() => dispatch({ type: 'reveal' })}
              style={{ minHeight: touchTarget.min, justifyContent: 'center' }}
            >
              {prompt.gloss !== undefined && prompt.gloss !== '' ? <Body>{prompt.gloss}</Body> : null}
              <View accessibilityLiveRegion="polite">
                {prompt.showLink ? (
                  <Text {...KOREAN_LINE_BREAK} style={{ fontSize: scale.body, color: colors.brand.secondaryDark, textDecorationLine: 'underline', fontWeight: typography.weight.semibold }}>{copy.showSound}</Text>
                ) : (
                  <Text {...KOREAN_LINE_BREAK} testID={`${testID}-sound`} style={{ fontSize: scale.bodyLg, color: colors.text.secondary, fontWeight: typography.weight.semibold }}>
                    {prompt.sound}
                  </Text>
                )}
              </View>
            </Pressable>
          )}
        </View>
        {/* The block's zones on their own `target` board (the tiles have theirs below). */}
        <TapBoard lock="target">
          <View
            role="group"
            aria-label={prompt.blockLabel ?? undefined}
            testID={`${testID}-block`}
            style={{ gap: spacing.sm }}
          >
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {zoneBox(first, zoneTop, zoneTop)}
              {zoneBox(vowel, zoneTop, zoneTop)}
            </View>
            {zoneBox(final, blockWidth, touchTarget.min)}
          </View>
        </TapBoard>
      </View>

      {noVoice ? <PromptPanel view={slot.view} onAction={(action) => slot.act(action, say)} onHelp={() => setHelpOpen(true)} testID={`${testID}-prompt`} /> : null}
      {helpOpen ? <VoiceHelpSheet visible onClose={() => setHelpOpen(false)} /> : null}

      {/* The tiles on one `target` board (AMENDMENTS-TOUCH section 6, row KT-6): tapping two different tiles quickly is a
          real move; a bounce on one tile counts once. */}
      <TapBoard lock="target">
        <View style={{ gap: spacing.sm }}>
          {rows.map((row) => (
            <View key={row.zone} role="group" aria-label={row.caption} style={[{ gap: spacing.xxs }, heldAnswers(!slot.settled)]}>
              <Caption>{row.caption}</Caption>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {row.tiles.map((t) => {
                  const look = tileColors(t.zone, t.look);
                  // The state first (§3.2); a miss is not "selected" (a reader would take it for the answer).
                  const label = t.look === 'marked' ? answerOptionLabel('wrong', t.accessibilityLabel, m.a11y.minigame.option) : t.look === 'ring' ? answerOptionLabel('hint', t.accessibilityLabel, m.a11y.minigame.option) : t.accessibilityLabel;
                  return (
                    <TapTarget
                      key={t.key}
                      testID={`${testID}-tile-${t.key}`}
                      accessibilityLabel={label}
                      accessibilityState={{ selected: t.look === 'selected' }}
                      // A right block locks its tiles: inactive, never disabled (§3.1).
                      inactive={right}
                      onCommit={() => dispatch({ type: 'tile', zone: t.zone, letter: t.letter })}
                    >
                      {({ pressed }) => {
                        const p = pressed && !right ? press : null;
                        const inset = pressInset(p, look.borderWidth);
                        return (
                          <View
                            style={{
                              minWidth: tile,
                              minHeight: tile,
                              width: t.text ? undefined : tile,
                              paddingHorizontal: t.text ? Math.max(0, spacing.xs - inset) : 0,
                              borderRadius: radii.lg,
                              alignItems: 'center',
                              justifyContent: 'center',
                              ...look,
                              ...(p ? { borderColor: p.borderColor, borderWidth: p.borderWidth, ...(look.borderBottomWidth !== undefined ? { borderBottomWidth: Math.max(look.borderBottomWidth, p.borderWidth) } : {}) } : {}),
                              transform: pressTransform(p),
                            }}
                          >
                            {t.text ? (
                              <Text {...KOREAN_LINE_BREAK} style={{ fontSize: scale.bodySm, fontWeight: typography.weight.semibold, color: colors.text.primary, textAlign: 'center', maxWidth: tile + spacing.xxl }}>{t.face}</Text>
                            ) : (
                              <Text {...KOREAN_LINE_BREAK} {...koreanSpeech} style={{ fontSize: Math.round(JAMO_FACE * tile), fontWeight: typography.weight.bold, color: colors.text.primary }}>
                                {t.face}
                              </Text>
                            )}
                            {t.look === 'ring' ? <LookHereRing radius={radii.lg} answerBorder={look.borderWidth} testID={`${testID}-ring`} /> : null}
                            {t.look === 'marked' ? <CornerMark mark="miss" inset={MARK_INSET} testID={`${testID}-mark-tile-${t.key}`} /> : null}
                          </View>
                        );
                      }}
                    </TapTarget>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      </TapBoard>

      {nextButton.shown ? (
        <Button pressableRef={nextButton.nextRef} label={m.learner.minigame.trace.next.cta} tone="primary" size="hero" fullWidth onPress={moveOn} testID={`${testID}-next`} />
      ) : null}

      {/* The announcer says the result once, so Hoya's line is not a live region too (§3.3). */}
      <View style={{ minHeight: touchTarget.min }}>
        {line !== null ? (
          <HoyaBubble
            testID={`${testID}-hoya`}
            tone={line === 'built' ? 'cheering' : 'thinking'}
            message={line === 'built' ? copy.built : line === 'lookHere' ? copy.lookHere : copy.miss[line]}
            live={false}
          />
        ) : null}
      </View>
      {speech === undefined ? <AnswerAnnouncer line={a.line} /> : null}
    </View>
  );
}
