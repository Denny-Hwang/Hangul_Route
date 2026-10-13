import { Body, Button, Caption, Card, Heading, Icon, borderWidth, colors, radii, spacing, touchTarget } from '@hangul-route/design-system';
import { PACES, type PaceId } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import React from 'react';
import { Pressable, View } from 'react-native';
import { PACE_IDS } from '../../logic/route/proposal-flow';

/**
 * The weekly plan after a level check (F-PLC-001 P-7b; wireframe journey/my-route-overview.md
 * J1 and K3): the pace chips shared with the grown-up report's card, the learner's strip
 * ("Hoya made a weekly plan for you", the plan in words, the chips, **Use this plan** as the
 * one primary, **Change**) and the card after a retake that found a later start (**Update my
 * plan**, **Keep my plan**). Tokens only; every control at least `touchTarget.min`.
 */

type ProposalMessages = Messages['learner']['weeklyPlan']['proposal'];

/** The three pace chips (Gentle 2 / Steady 3 / Brisk 4), one selected; a chip with no proposal is left out. */
export function PaceChips({
  t,
  selected,
  available,
  onSelect,
  label,
  testIDPrefix,
}: {
  t: ProposalMessages;
  selected: PaceId;
  available: readonly PaceId[];
  onSelect: (pace: PaceId) => void;
  label: string;
  testIDPrefix: string;
}): React.ReactElement {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {PACE_IDS.filter((id) => available.includes(id)).map((id) => {
        const on = id === selected;
        return (
          <Pressable
            key={id}
            testID={`${testIDPrefix}-${id}`}
            onPress={() => onSelect(id)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on, checked: on }}
            aria-checked={on}
            accessibilityLabel={t.paceLabel(t.pace[id], PACES[id])}
            style={{
              flexGrow: 1,
              minWidth: touchTarget.hero,
              minHeight: touchTarget.min,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.xs,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radii.lg,
              borderWidth: on ? borderWidth.thick : borderWidth.base,
              borderColor: on ? colors.brand.primary : colors.border.subtle,
              backgroundColor: on ? colors.brand.primaryLight : colors.surface.paper,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              {on ? <Icon name="check" size={spacing.lg} color={colors.brand.primaryDark} /> : null}
              <Body weight="semibold">{t.pace[id]}</Body>
            </View>
            <Caption tone="secondary">{t.paceDays(PACES[id])}</Caption>
          </Pressable>
        );
      })}
    </View>
  );
}

export interface PlanStripProps {
  m: Messages;
  pace: PaceId;
  paces: readonly PaceId[];
  /** The plan in words: "4 weeks, 3 days a week, about 15 minutes a day". */
  basis: string;
  busy: boolean;
  failed: boolean;
  onPace: (pace: PaceId) => void;
  onUse: () => void;
  onChange: () => void;
}

/** J1: the learner's strip. **Use this plan** is the screen's one primary; no PIN (OD-14). */
export function PlanStrip({ m, pace, paces, basis, busy, failed, onPace, onUse, onChange }: PlanStripProps): React.ReactElement {
  const copy = m.learner.placement.result.strip;
  const t = m.learner.weeklyPlan.proposal;
  return (
    <Card padding="md" testID="placement-plan-strip">
      <Heading level="prompt">{copy.title}</Heading>
      <Body tone="secondary" testID="placement-plan-basis">
        {basis}
      </Body>
      <View style={{ marginTop: spacing.md }}>
        <PaceChips t={t} selected={pace} available={paces} onSelect={onPace} label={t.paceTitle} testIDPrefix="placement-plan-pace" />
      </View>
      <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
        <Button
          label={busy ? t.starting.cta : copy.usePlan}
          tone="primary"
          size="hero"
          fullWidth
          disabled={busy}
          onPress={onUse}
          testID="placement-plan-use"
        />
        {failed ? (
          <Body tone="secondary" align="center" testID="placement-plan-failed">
            {t.saveFailed}
          </Body>
        ) : null}
        <Button label={copy.change} tone="ghost" size="lg" fullWidth disabled={busy} onPress={onChange} testID="placement-plan-change" />
      </View>
    </Card>
  );
}

/** K3: a retake found a later start and a plan exists. **Update my plan** is the one primary. */
export function PlanUpdateCard({
  m,
  busy,
  failed,
  onUpdate,
  onKeep,
}: {
  m: Messages;
  busy: boolean;
  failed: boolean;
  onUpdate: () => void;
  onKeep: () => void;
}): React.ReactElement {
  const copy = m.learner.placement.result;
  return (
    <Card padding="md" testID="placement-plan-update">
      <Heading level="prompt">{copy.laterStart}</Heading>
      <Body tone="secondary">{copy.planCanMove}</Body>
      <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
        <Button
          label={busy ? m.learner.weeklyPlan.proposal.starting.cta : copy.updatePlan}
          tone="primary"
          size="hero"
          fullWidth
          disabled={busy}
          onPress={onUpdate}
          testID="placement-plan-update-cta"
        />
        {failed ? (
          <Body tone="secondary" align="center" testID="placement-plan-failed">
            {m.learner.weeklyPlan.proposal.saveFailed}
          </Body>
        ) : null}
        <Button label={copy.keepPlan} tone="ghost" size="lg" fullWidth disabled={busy} onPress={onKeep} testID="placement-plan-keep" />
      </View>
    </Card>
  );
}
