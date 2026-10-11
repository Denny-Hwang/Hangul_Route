import {
  Body,
  Button,
  Caption,
  Card,
  Heading,
  Icon,
  Screen,
  Spacer,
  borderWidth,
  colors,
  radii,
  spacing,
  touchTarget,
  useLayoutClass,
} from '@hangul-route/design-system';
import React from 'react';
import { Pressable, Switch, View, useWindowDimensions } from 'react-native';
import { canProceed, controlsFor, flowReducer, showSoundGuideQuestion, type FlowControl } from '../../logic/placement/flow';
import { MOTIVATION_CHOICES, modeTiles, modeTilesSideBySide } from '../../logic/placement/options-view';
import { usePlacement } from './context';
import { BackArrow, LinkButton, Note, RadioTile } from './parts';

/**
 * Options (F-PLC-001 section 3.1 step 3, wireframe placement C1 / C2): a
 * grown-up screen. Every label is also spoken when tapped (in the test
 * language). C1 is the one pre-filled Short card of a *Pictures first*
 * learner with **Change** and **Start**; C2 has the three equal mode tiles
 * (radios, no badge, Short disabled without sound), the sound-guide question
 * for Standard and Deep with nothing pre-selected (NEXT waits for it), *Take
 * my time* and the optional *Why Korean?*. The profile's own sound-guide
 * setting is never written.
 */
export function OptionsScreen(): React.ReactElement {
  const { m, flow, dispatch, say, leave } = usePlacement();
  const copy = m.learner.placement.options;
  const layout = useLayoutClass();
  const { fontScale } = useWindowDimensions();
  const contentWidth = Math.min(layout.windowWidth - 2 * layout.gutter, layout.maxWidth.reading);

  /** Taps speak the label first, then act. */
  const spoken = (label: string, act: () => void) => (): void => {
    void say(label);
    act();
  };
  const back = (): void => {
    if (flowReducer(flow, { type: 'back' }) !== flow) dispatch({ type: 'back' });
    else leave();
  };

  const header = (title: string): React.ReactElement => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <BackArrow onPress={back} label={m.a11y.goBack} />
      <View style={{ flex: 1 }}>
        <Heading level="title">{title}</Heading>
      </View>
    </View>
  );

  if (flow.optionsLayout === 'card') {
    const short = copy.mode.short;
    const controls = controlsFor(flow);
    const control = (id: FlowControl['id']): FlowControl | undefined => controls.find((c) => c.id === id);
    const start = control('options.start');
    const change = control('options.change');
    return (
      <Screen tone="canvas" testID="placement-options-card">
        {header(copy.cardTitle)}
        <Spacer size="lg" />
        <Card padding="lg" testID="placement-short-card">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Icon name="ear" size={spacing.xxl} color={colors.brand.primary} />
            <Heading level="prompt">{short.label}</Heading>
          </View>
          <Spacer size="sm" />
          <Body>{short.help}</Body>
          {flow.takeMyTime ? null : <Caption tone="secondary">{short.duration}</Caption>}
          <View style={{ alignItems: 'flex-end' }}>
            {change ? (
              <LinkButton label={copy.change} icon={change.icon === 'pencil' ? 'pencil' : undefined} onPress={spoken(copy.change, () => dispatch(change.event))} testID="placement-change" />
            ) : null}
          </View>
        </Card>
        <Spacer size="xl" />
        {start ? (
          <Button
            label={copy.start.cta}
            tone="primary"
            size="hero"
            fullWidth
            leading={<Icon name="play" size={spacing.xl} color={colors.text.inverse} />}
            onPress={spoken(copy.start.cta, () => dispatch(start.event))}
            testID="placement-start"
          />
        ) : null}
      </Screen>
    );
  }

  const tiles = modeTiles(flow, m);
  const row = modeTilesSideBySide(contentWidth, fontScale);
  const guide = copy.soundGuide;
  const ready = canProceed(flow);

  return (
    <Screen
      tone="canvas"
      testID="placement-options"
      footer={
        <Button
          label={copy.next.cta}
          tone="primary"
          size="hero"
          fullWidth
          disabled={!ready}
          leading={<Icon name="arrow-right" size={spacing.xl} color={colors.text.inverse} />}
          onPress={spoken(copy.next.cta, () => dispatch({ type: 'next' }))}
          testID="placement-next"
        />
      }
    >
      {header(copy.title)}
      <Spacer size="lg" />
      <Heading level="prompt">{copy.howLong}</Heading>
      <Spacer size="sm" />
      <View accessibilityRole="radiogroup" style={{ flexDirection: row ? 'row' : 'column', gap: spacing.md }}>
        {tiles.map((tile) => (
          <RadioTile
            key={tile.mode}
            flex={row}
            selected={tile.selected}
            disabled={tile.disabled}
            onPress={spoken(tile.copy.label, () => dispatch({ type: 'selectMode', mode: tile.mode }))}
            accessibilityLabel={tile.copy.label}
            accessibilityHint={tile.hint ?? tile.copy.help}
            testID={`placement-mode-${tile.mode}`}
          >
            <Body weight="semibold" size="lg">
              {tile.copy.label}
            </Body>
            <Body size="sm">{tile.copy.help}</Body>
            {tile.copy.duration === null ? null : <Caption tone="secondary">{tile.copy.duration}</Caption>}
            {tile.hint === null ? null : <Caption tone="secondary">{tile.hint}</Caption>}
          </RadioTile>
        ))}
      </View>
      {!flow.koreanAudio && flow.mode !== 'short' && !flow.listenFirst ? (
        <>
          <Spacer size="sm" />
          <Note testID="placement-limited">{copy.limited}</Note>
        </>
      ) : null}

      {showSoundGuideQuestion(flow) ? (
        <>
          <Spacer size="lg" />
          <Heading level="prompt">{guide.title}</Heading>
          <Spacer size="sm" />
          <View accessibilityRole="radiogroup" style={{ gap: spacing.md }}>
            {(['always', 'tap'] as const).map((revealMode) => (
              <RadioTile
                key={revealMode}
                selected={flow.revealMode === revealMode}
                onPress={spoken(guide[revealMode], () => dispatch({ type: 'setRevealMode', revealMode }))}
                accessibilityLabel={guide[revealMode]}
                testID={`placement-guide-${revealMode}`}
              >
                <Body weight="semibold">{guide[revealMode]}</Body>
              </RadioTile>
            ))}
          </View>
          <Spacer size="sm" />
          <Note>{guide.consequence}</Note>
        </>
      ) : null}

      <Spacer size="lg" />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: touchTarget.min }}>
        <Pressable style={{ flex: 1 }} onPress={() => void say(`${copy.takeMyTime.label}. ${copy.takeMyTime.help}`)} accessibilityRole="text">
          <Body weight="semibold">{copy.takeMyTime.label}</Body>
          <Caption tone="secondary">{copy.takeMyTime.help}</Caption>
        </Pressable>
        <Switch
          testID="placement-take-my-time"
          value={flow.takeMyTime}
          onValueChange={(on) => dispatch({ type: 'setTakeMyTime', on })}
          accessibilityLabel={copy.takeMyTime.label}
          trackColor={{ true: colors.brand.primary, false: colors.border.strong }}
          thumbColor={colors.surface.paper}
        />
      </View>

      <Spacer size="lg" />
      <Heading level="prompt">{copy.why.title}</Heading>
      <Spacer size="sm" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {MOTIVATION_CHOICES.map(({ motivation, icon }) => {
          const label = copy.why[motivation];
          const selected = flow.motivation === motivation;
          return (
            <Pressable
              key={motivation}
              testID={`placement-why-${motivation}`}
              onPress={spoken(label, () => dispatch({ type: 'setMotivation', motivation: selected ? null : motivation }))}
              accessibilityRole="radio"
              accessibilityState={{ selected, checked: selected }}
              accessibilityLabel={label}
              style={{
                minHeight: touchTarget.min,
                minWidth: touchTarget.min,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                paddingHorizontal: spacing.md,
                borderRadius: radii.pill,
                borderWidth: selected ? borderWidth.thick : borderWidth.base,
                borderColor: selected ? colors.brand.primary : colors.border.subtle,
                backgroundColor: colors.surface.paper,
              }}
            >
              <Icon name={icon} size={spacing.xl} color={colors.brand.primary} />
              <Body weight="medium">{label}</Body>
            </Pressable>
          );
        })}
        <LinkButton label={copy.why.skip} onPress={spoken(copy.why.skip, () => dispatch({ type: 'setMotivation', motivation: null }))} />
      </View>
    </Screen>
  );
}
