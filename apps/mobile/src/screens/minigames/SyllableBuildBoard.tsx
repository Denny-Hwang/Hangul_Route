import type { SyllableZone } from '@hangul-route/content-schema';
import {
  Body,
  Caption,
  HoyaBubble,
  Icon,
  KOREAN_LANGUAGE,
  KOREAN_LINE_BREAK,
  KoreanText,
  borderWidth,
  colors,
  motion,
  radii,
  spacing,
  touchTarget,
  typography,
  useMediaSize,
  useTypeScale,
} from '@hangul-route/design-system';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { Pressable, Text, View } from 'react-native';
import { PromptPanel } from '../../components/PromptPanel';
import { VoiceHelpSheet } from '../../components/VoiceHelpSheet';
import { usePromptSlot } from '../../components/use-prompt-slot';
import { useMessages } from '../../i18n/use-messages';
import { shouldAutoReplay } from '../../logic/audio/prompt-view';
import { hoyaLine, startBuild, stepBuild, type BuildEffect, type BuildEvent, type BuildState } from '../../logic/syllable-build/flow';
import { partsOf } from '../../logic/syllable-build/pool';
import type { TileRows } from '../../logic/syllable-build/tiles';
import { promptView, rowViews, zoneViews, type TileLook, type ZoneLook } from '../../logic/syllable-build/view';
import { hasClip, playPrompt, stop } from '../../platform/audio';
import { nudge, success, tapLight } from '../../platform/haptics';

/**
 * One Syllable Build round (F-CURR-002 section 7.1 F3, row CM-32; design/wireframes/minigame/syllable-build.md, the mock
 * design/screens/minigame-variety/mock/syllable-build.html and D5 of its README): the speaker and the meaning button
 * beside the block, then three labelled rows of jamo-only tiles (First letter, Vowel, Final with No final last), then
 * Hoya's line. The behaviour is `logic/syllable-build/flow.ts`; this file draws it and runs its effects. It serves a
 * quest step (`SyllableBuildGame`), a review round at the produce rung and the Block Sprint.
 *
 * - Tiles at `touchTarget.min` (64, the 48 dp floor met), zones 64 x 64 on a phone with the final zone 64 tall across
 *   the block, `touchTarget.hero` from regular. Four tiles and their gaps fit the 288 of a 320 window.
 * - A miss is amber with the mark dot, never red; the right block takes the success look with the check glyph.
 * - Reduced motion: nothing moves (letters appear in place, nothing pulses); the pause before the next round stays,
 *   so the built block and its sound are not skipped.
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
  testID?: string;
}

/** How long the built block stays on screen, with its sound, before the next round. */
export const SOLVED_PAUSE_MS = motion.duration.celebration;

const MARK = spacing.md;
/** A jamo face is part of its tile's picture: half the tile, so it keeps its size at every text setting (wireframe, States). */
const JAMO_FACE = 0.5;
const koreanSpeech = { accessibilityLanguage: KOREAN_LANGUAGE, lang: KOREAN_LANGUAGE };

function Mark({ look }: { look: 'marked' | 'right' }): ReactElement {
  return look === 'right' ? (
    <View style={{ position: 'absolute', top: spacing.xxs, right: spacing.xxs }}>
      <Icon name="check" size={MARK + spacing.xs} color={colors.feedback.success} />
    </View>
  ) : (
    <View
      style={{
        position: 'absolute',
        top: spacing.xxs,
        right: spacing.xxs,
        width: MARK,
        height: MARK,
        borderRadius: radii.circle,
        backgroundColor: colors.feedback.nudge,
        borderWidth: borderWidth.thin,
        borderColor: colors.text.primary,
      }}
    />
  );
}

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
  if (look === 'ring') return { backgroundColor: zone === 'vowel' ? colors.surface.sunken : colors.surface.paper, borderColor: colors.border.focus, borderWidth: borderWidth.thick };
  // The keyboard's two quiet fills: paper for consonants, sunken for vowels; a final tile has the Build a Letter base line.
  if (zone === 'vowel') return { backgroundColor: colors.surface.sunken, borderColor: colors.border.subtle, borderWidth: borderWidth.base };
  if (zone === 'final') return { backgroundColor: colors.surface.paper, borderColor: colors.border.subtle, borderWidth: borderWidth.base, borderBottomWidth: spacing.xs };
  return { backgroundColor: colors.surface.paper, borderColor: colors.border.subtle, borderWidth: borderWidth.base };
}

export function SyllableBuildBoard({ target, tiles, fixed, onFirst, onSolved, onRight, autoplay, source, testID = 'syllable-build' }: SyllableBuildBoardProps): ReactElement {
  const m = useMessages();
  const copy = m.learner.minigame.syllableBuild;
  const a11y = m.a11y.minigame.syllableBuild;
  const scale = useTypeScale().size;
  const tile = useMediaSize(touchTarget.min);
  const zoneTop = useMediaSize(touchTarget.min) > touchTarget.min ? touchTarget.hero : touchTarget.min;
  const parts = useMemo(() => partsOf(target.ko), [target.ko]);

  const slot = usePromptSlot({ source, hasClip: hasClip(target.audioRef) });
  const { play: slotPlay } = slot;
  const viewRef = useRef(slot.view);
  viewRef.current = slot.view;
  const noVoice = slot.view.textShown;
  const [helpOpen, setHelpOpen] = useState(false);

  const [state, setState] = useState<BuildState>(() => (parts ? startBuild(parts, fixed ?? null) : startBuild({ first: '', vowel: '', final: null })));
  const stateRef = useRef(state);
  const replayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const solvedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handlers = useRef({ onFirst, onSolved, onRight });
  handlers.current = { onFirst, onSolved, onRight };

  const say = useCallback((): void => {
    void slotPlay(() => playPrompt({ text: target.spokenKo ?? target.ko, ...(target.audioRef ? { audioRef: target.audioRef } : {}), kind: 'word', source }));
  }, [slotPlay, target.spokenKo, target.ko, target.audioRef, source]);

  const dispatchRef = useRef<(e: BuildEvent) => void>(() => undefined);
  const run = useCallback(
    (effect: BuildEffect): void => {
      switch (effect.type) {
        case 'answer':
          handlers.current.onFirst(effect.correct, effect.hinted);
          return;
        case 'play':
          if (effect.why === 'replay' && !shouldAutoReplay(viewRef.current)) return;
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
          handlers.current.onRight?.();
          solvedTimer.current = setTimeout(() => handlers.current.onSolved(), SOLVED_PAUSE_MS);
          return;
      }
    },
    [say],
  );

  const dispatch = useCallback(
    (event: BuildEvent): void => {
      if (!parts) return;
      const out = stepBuild(stateRef.current, event, { target: parts, voice: !viewRef.current.textShown });
      stateRef.current = out.state;
      setState(out.state);
      out.effects.forEach(run);
    },
    [parts, run],
  );
  dispatchRef.current = dispatch;

  useEffect(() => {
    if (autoplay) say();
    return () => {
      if (replayTimer.current) clearTimeout(replayTimer.current);
      if (solvedTimer.current) clearTimeout(solvedTimer.current);
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

  const zoneBox = (zone: (typeof zones)[number], width: number, height: number): ReactElement => {
    const look = ZONE_LOOK[zone.look];
    return (
      <Pressable
        key={zone.zone}
        testID={`${testID}-zone-${zone.zone}`}
        accessibilityRole="button"
        accessibilityLabel={zone.accessibilityLabel}
        accessibilityState={{ disabled: !zone.tappable }}
        disabled={!zone.tappable}
        onPress={() => dispatch({ type: 'clear', zone: zone.zone })}
        style={{ width, height, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center', ...look }}
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
        {zone.look === 'marked' || zone.look === 'right' ? <Mark look={zone.look} /> : null}
      </Pressable>
    );
  };

  const [first, vowel, final] = zones as [(typeof zones)[number], (typeof zones)[number], (typeof zones)[number]];
  const blockWidth = 2 * zoneTop + spacing.sm;

  return (
    <View testID={testID} style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', gap: spacing.lg, alignItems: 'flex-start' }}>
        <View style={{ flexShrink: 1, gap: spacing.sm, minWidth: touchTarget.min }}>
          <Pressable
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
          </Pressable>
          {right ? (
            <View accessibilityLiveRegion="polite" testID={`${testID}-built`}>
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
      </View>

      {noVoice ? <PromptPanel view={slot.view} onAction={(action) => slot.act(action, say)} onHelp={() => setHelpOpen(true)} testID={`${testID}-prompt`} /> : null}
      {helpOpen ? <VoiceHelpSheet visible onClose={() => setHelpOpen(false)} /> : null}

      {rows.map((row) => (
        <View key={row.zone} role="group" aria-label={row.caption} style={{ gap: spacing.xxs }}>
          <Caption>{row.caption}</Caption>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {row.tiles.map((t) => {
              const look = tileColors(t.zone, t.look);
              return (
                <Pressable
                  key={t.key}
                  testID={`${testID}-tile-${t.key}`}
                  accessibilityRole="button"
                  accessibilityLabel={t.accessibilityLabel}
                  accessibilityState={{ selected: t.look === 'selected' || t.look === 'marked', disabled: right }}
                  disabled={right}
                  onPress={() => dispatch({ type: 'tile', zone: t.zone, letter: t.letter })}
                  style={{ minWidth: tile, minHeight: tile, width: t.text ? undefined : tile, paddingHorizontal: t.text ? spacing.xs : 0, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center', ...look }}
                >
                  {t.text ? (
                    <Text {...KOREAN_LINE_BREAK} style={{ fontSize: scale.bodySm, fontWeight: typography.weight.semibold, color: colors.text.primary, textAlign: 'center', maxWidth: tile + spacing.xxl }}>{t.face}</Text>
                  ) : (
                    <Text {...KOREAN_LINE_BREAK} {...koreanSpeech} style={{ fontSize: Math.round(JAMO_FACE * tile), fontWeight: typography.weight.bold, color: colors.text.primary }}>
                      {t.face}
                    </Text>
                  )}
                  {t.look === 'marked' ? <Mark look="marked" /> : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}

      <View accessibilityLiveRegion="polite" style={{ minHeight: touchTarget.min }}>
        {line !== null ? (
          <HoyaBubble
            testID={`${testID}-hoya`}
            tone={line === 'built' ? 'cheering' : 'thinking'}
            message={line === 'built' ? copy.built : line === 'lookHere' ? copy.lookHere : copy.miss[line]}
          />
        ) : null}
      </View>
    </View>
  );
}
