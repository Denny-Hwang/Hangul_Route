import { Icon, borderWidth, colors, layout, radii, shadows, spacing, touchTarget, useTypeScale, KOREAN_LINE_BREAK } from '@hangul-route/design-system';
import { PRESET_DEFAULT_MINUTES, PRESET_LENGTHS, type LecturePreset, type PresetContext, type PresetMinutes, type ResolvedPreset, type StageKey } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { lengthOf, type HomeSnapshot } from '../../logic/lecture/home-state';
import { presenterPresetOrder } from '../../logic/lecture/preset-source';
import { ChipGroup, H, HomeButton, Line, ring, text, type Focusable } from './home-parts';

/**
 * Ready-made lessons on the presenter home (AMENDMENTS-LECTURE-V2 sections 4.1, 4.6 and 10; design
 * `presets.md` items 2 and 3, decisions V1 and V3): the six presets as cards, in the section 4.1
 * order (Next lesson first only when it has something to follow, else last with its fallback
 * line). One column below 30rem of the section's width, two from 30rem, three from 46rem (rem
 * follows the chosen text size).
 *
 * Each card is one button following the disclosure pattern (`aria-expanded`, `aria-controls`
 * naming its panel; no `aria-pressed`), named "{title}, about {n} minutes". One card is open at a
 * time; the open card spans its row with a `borderWidth.thick` outline, and its panel holds the
 * fallback line when the preset cannot build what it names, the stage chips (Stage by stage), the
 * length chips (none for the warm-up, nor for a preset that fell back to it) and **Start**. Changing a chip re-resolves the deck; nothing
 * else moves. What the cards hold lives in the home's kept state (`HomeSnapshot`), so Back from
 * the start screen finds them as they were.
 */

const REM = 16;
/** Two columns from 30rem of the section's width, three from 46rem (`presets.md` item 3). */
const TWO_COLUMNS_REM = 30;
const THREE_COLUMNS_REM = 46;

export function presetColumns(width: number, factor: number): 1 | 2 | 3 {
  const rem = width / (REM * (factor > 0 ? factor : 1));
  if (rem >= THREE_COLUMNS_REM) return 3;
  return rem >= TWO_COLUMNS_REM ? 2 : 1;
}

type Words = Messages['learner']['presenter']['presets'];

function cardWords(preset: LecturePreset, w: Words): { title: string; line: string } {
  switch (preset) {
    case 'next-lesson':
      return { title: w.next.title, line: w.next.device };
    case 'hangul-week-1':
      return { title: w.zero.title, line: w.zero.body };
    case 'by-stage':
      return { title: w.stage.title, line: w.stage.body };
    case 'story-time':
      return { title: w.story.title, line: w.story.body };
    case 'word-review':
      return { title: w.words.title, line: w.words.body };
    case 'warm-up':
      return { title: w.warmup.title, line: w.warmup.body };
  }
}

const stageNumber = (stage: StageKey): number => Number(stage.slice('stage'.length));

/**
 * The stage Stage by stage builds: the kept one when it is still offered, else the first offered
 * stage. The cards, their Start and Customize's opening stage all read this one value, so they
 * resolve the same deck even when a kept home names a stage this bundle no longer offers.
 */
export function presetStageOf(stages: readonly StageKey[], kept: StageKey): StageKey {
  return stages.includes(kept) ? kept : (stages[0] ?? 'stage1');
}

export interface PresetCardsProps {
  messages: Messages;
  ctx: PresetContext;
  /** A preset resolved on this presenter (`resolveOnPresenter`), so the fallback line says what Start builds. */
  resolve: (preset: LecturePreset, minutes: PresetMinutes, stage: StageKey) => ResolvedPreset;
  /** The stages Stage by stage offers (only stages with a ready cell). */
  stages: readonly StageKey[];
  state: HomeSnapshot;
  onState: (patch: Partial<HomeSnapshot>) => void;
  onStart: (preset: LecturePreset, minutes: PresetMinutes, stage: StageKey) => void;
  /** The section's width until it is measured (the page's estimate), so the first frame has its columns. */
  initialWidth?: number;
}

export function PresetCards({ messages, ctx, resolve, stages, state, onState, onStart, initialWidth = 0 }: PresetCardsProps): React.ReactElement {
  const scale = useTypeScale();
  const ts = scale.size;
  const w = messages.learner.presenter.presets;
  const [width, setWidth] = useState(initialWidth);
  const columns = presetColumns(width, scale.factor);
  const order = useMemo(() => presenterPresetOrder(ctx), [ctx]);
  const stage = presetStageOf(stages, state.stage);
  // What each card builds now: its minutes on the card, its fallback line in the panel (one result, as Start uses).
  const { lengths } = state;
  const resolved = useMemo(
    () => new Map(order.map((preset) => [preset, resolve(preset, lengthOf({ lengths }, preset, PRESET_DEFAULT_MINUTES[preset]), stage)] as const)),
    [order, resolve, lengths, stage],
  );
  const gap = spacing.md;
  const cardWidth = columns === 1 || width === 0 ? width : Math.floor((width - gap * (columns - 1)) / columns);

  return (
    <View role="region" aria-label={w.title} testID="presenter-home-presets" style={{ gap: spacing.md }}>
      <H level={2} style={text(ts.prompt, 'bold', colors.text.primary)}>
        {w.title}
      </H>
      <Line>{w.lead}</Line>
      <View role="list" onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
        {order.map((preset) => {
          const open = state.open === preset;
          const minutes = lengthOf(state, preset, PRESET_DEFAULT_MINUTES[preset]);
          const built = resolved.get(preset)!;
          const words = cardWords(preset, w);
          const panelId = `presenter-preset-panel-${preset}`;
          const lineId = `presenter-preset-line-${preset}`;
          return (
            <View
              key={preset}
              role="listitem"
              testID={`presenter-preset-card-${preset}`}
              style={{
                width: open || columns === 1 || width === 0 ? '100%' : cardWidth,
                borderWidth: open ? borderWidth.thick : borderWidth.thin,
                borderColor: open ? colors.text.primary : colors.border.subtle,
                borderRadius: radii.lg,
                backgroundColor: colors.surface.paper,
                ...(open ? {} : shadows.card),
              }}
            >
              <Pressable
                role="button"
                aria-expanded={open}
                // The name is "{title}, about {n} minutes"; the card's line is its description.
                {...{ 'aria-controls': panelId, 'aria-describedby': lineId }}
                accessibilityState={{ expanded: open }}
                accessibilityLabel={messages.a11y.presenter.presetCard(words.title, built.minutes)}
                onPress={() => onState({ open: open ? null : preset })}
                testID={`presenter-preset-${preset}`}
                style={({ focused }: Focusable) => ({
                  minHeight: touchTarget.min,
                  padding: spacing.lg - (open ? borderWidth.thick - borderWidth.thin : 0),
                  gap: spacing.xs,
                  borderRadius: radii.lg,
                  ...ring(focused),
                })}
              >
                <Text {...KOREAN_LINE_BREAK} style={text(ts.bodyLg, 'bold', colors.text.primary)}>
                  {words.title}
                </Text>
                <Text {...KOREAN_LINE_BREAK} nativeID={lineId} {...{ id: lineId }} style={text(ts.body, 'regular', colors.text.secondary)}>
                  {words.line}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingTop: spacing.xs }}>
                  <Text {...KOREAN_LINE_BREAK} style={{ ...text(ts.body, 'bold', colors.text.secondary), flexShrink: 1 }}>
                    {messages.learner.presenter.home.quick.minutes(built.minutes)}
                  </Text>
                  <Icon name="arrow-right" size={spacing.xl} color={colors.text.secondary} />
                </View>
              </Pressable>
              <View nativeID={panelId} {...{ id: panelId }} testID={panelId} style={open ? { paddingHorizontal: spacing.lg - borderWidth.thick + borderWidth.thin, paddingBottom: spacing.lg, gap: spacing.md } : { display: 'none' }}>
                {open ? (
                  <PresetPanel
                    messages={messages}
                    preset={preset}
                    minutes={minutes}
                    stage={stage}
                    stages={stages}
                    resolved={built}
                    onMinutes={(m) => onState({ lengths: { ...state.lengths, [preset]: m } })}
                    onStage={(s) => onState({ stage: s })}
                    onStart={() => onStart(preset, minutes, stage)}
                  />
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function PresetPanel({
  messages,
  preset,
  minutes,
  stage,
  stages,
  resolved,
  onMinutes,
  onStage,
  onStart,
}: {
  messages: Messages;
  preset: LecturePreset;
  minutes: PresetMinutes;
  stage: StageKey;
  stages: readonly StageKey[];
  resolved: ResolvedPreset;
  onMinutes: (m: PresetMinutes) => void;
  onStage: (s: StageKey) => void;
  onStart: () => void;
}): React.ReactElement {
  const ts = useTypeScale().size;
  const w = messages.learner.presenter.presets;
  const fallback = resolved.fallback === 'zero' ? w.fallback.zero : resolved.fallback === 'warm-up' ? w.fallback.warmUp : resolved.fallback === 'restart' ? w.fallback.restart : null;
  // The chips of the preset that builds the deck: a Word review that fell back to the warm-up has
  // the warm-up's one fixed length, so no chips (section 4.1), and the card's minutes stay true.
  const lengths = PRESET_LENGTHS[resolved.preset];
  const fallbackId = `presenter-preset-fallback-${preset}`;
  // Start is at least 2 x hero wide (presets.md item 3) from the regular width; in a narrower window it
  // is the panel's width up to 2 x hero, so at 320 px with 200 % text it never runs past the page (section 10).
  const regular = useWindowDimensions().width >= layout.breakpoint.regular;
  return (
    <>
      {fallback !== null ? (
        // Information, never a warning colour (V3): `text.primary` on `surface.sunken`.
        <View testID={fallbackId} nativeID={fallbackId} {...{ id: fallbackId }} style={{ backgroundColor: colors.surface.sunken, borderRadius: radii.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md }}>
          <Text {...KOREAN_LINE_BREAK} style={text(ts.body, 'regular', colors.text.primary)}>
            {fallback}
          </Text>
        </View>
      ) : null}
      {preset === 'by-stage' ? (
        <View style={{ gap: spacing.xs }}>
          <Line primary bold>
            {w.stage.choose}
          </Line>
          <ChipGroup label={w.stage.choose} options={stages} value={stage} onChange={onStage} name={(s) => w.stage.chip(stageNumber(s))} testID="presenter-preset-stage" />
        </View>
      ) : null}
      {lengths.length > 1 ? (
        <View style={{ gap: spacing.xs }}>
          <Line primary bold>
            {w.length.title}
          </Line>
          <ChipGroup label={w.length.title} options={lengths} value={minutes} onChange={onMinutes} name={(n) => w.length.option(n)} testID={`presenter-preset-length-${preset}`} />
        </View>
      ) : null}
      <View style={{ alignItems: 'flex-end' }}>
        {/* Start builds what the fallback line says, so a keyboard or screen-reader user hears it on Start too. */}
        <HomeButton label={w.start.cta} onPress={onStart} primary describedBy={fallback !== null ? fallbackId : undefined} {...(regular ? { minWidth: touchTarget.hero * 2 } : { upTo: touchTarget.hero * 2 })} testID={`presenter-preset-start-${preset}`} />
      </View>
    </>
  );
}
