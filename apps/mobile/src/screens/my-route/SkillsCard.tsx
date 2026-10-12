import { Body, Button, Card, Caption, Heading, Icon, PipRow, Spacer, colors, layout, radii, spacing, touchTarget } from '@hangul-route/design-system';
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import type { Skill } from '../../logic/my-route/types';
import type { SkillRowView } from '../../logic/my-route/view';

/**
 * "What your quests practice" (F-ROUTE-001 section 3.7; wireframe
 * `design/wireframes/journey/my-route-overview.md` A, C1, C7): an inventory of
 * finished quests, never a score. Each row shows its earned marks (drawn
 * discs) and at most one faint next slot, and opens a sheet listing the games
 * that count for it. Reading, listening and writing only.
 */

/** Decoration only: the done disc carries its own check (PipRow spec). Also the parent dashboard row's mini rows (R-9b). */
export const SKILL_ACCENT: Readonly<Record<Skill, string>> = { read: colors.stage.stage1, listen: colors.stage.stage4, write: colors.stage.stage7 };

function SkillSheet({ row, onClose }: { row: SkillRowView; onClose: () => void }): React.ReactElement {
  const m = useMessages();
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} accessibilityViewIsModal>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.surface.overlay }} testID="my-route-skill-sheet">
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={m.common.buttons.close} style={{ flex: 1 }} />
        <View
          style={{
            maxHeight: '85%',
            width: '100%',
            maxWidth: layout.maxWidth.reading,
            alignSelf: 'center',
            backgroundColor: colors.surface.paper,
            borderTopLeftRadius: radii.xl,
            borderTopRightRadius: radii.xl,
            padding: spacing.lg,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Icon name={row.icon} size={28} color={colors.text.secondary} />
            <View style={{ flex: 1 }}>
              <Heading level="prompt">{row.sheet.title}</Heading>
            </View>
          </View>
          <Spacer size="xs" />
          <Body tone="secondary">{row.sheet.note}</Body>
          <Spacer size="md" />
          <ScrollView style={{ flexShrink: 1 }}>
            {row.sheet.games.map((game) => (
              <View key={game} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs }}>
                <View style={{ width: spacing.sm, height: spacing.sm, borderRadius: radii.circle, backgroundColor: colors.border.shape }} />
                <Body>{game}</Body>
              </View>
            ))}
          </ScrollView>
          <Spacer size="md" />
          <Button label={m.common.buttons.ok} tone="primary" size="md" fullWidth onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

export interface SkillsCardProps {
  title: string;
  rows: SkillRowView[];
  /** Grown-up only: "Spelling with tiles: N quests" and the skills note. */
  tiles: string | null;
  note: string | null;
}

export function SkillsCard({ title, rows, tiles, note }: SkillsCardProps): React.ReactElement {
  const [sheet, setSheet] = useState<SkillRowView | null>(null);
  return (
    <Card padding="md" testID="my-route-skills">
      <Heading level="prompt">{title}</Heading>
      <Spacer size="sm" />
      <View accessibilityRole="list" style={{ gap: spacing.xs }}>
        {rows.map((row) => (
          <Pressable
            key={row.skill}
            onPress={() => setSheet(row)}
            accessibilityRole="button"
            accessibilityLabel={row.a11yLabel}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              minHeight: touchTarget.min,
              paddingHorizontal: spacing.xs,
              borderRadius: radii.md,
              backgroundColor: pressed ? colors.surface.sunken : 'transparent',
            })}
            testID={`my-route-skill-${row.skill}`}
          >
            <Icon name={row.icon} size={28} color={colors.text.secondary} />
            <View style={{ flex: 1, gap: spacing.xxs }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing.sm, rowGap: spacing.xxs }}>
                <Body weight="semibold">{row.label}</Body>
                {row.marks.length > 0 ? <PipRow groups={[row.marks]} context="stage" accent={SKILL_ACCENT[row.skill]} /> : null}
              </View>
              <Body size="sm" tone="secondary">
                {row.detail}
              </Body>
            </View>
            <Icon name="arrow-right" size={20} color={colors.text.muted} />
          </Pressable>
        ))}
      </View>
      {tiles !== null ? (
        <>
          <Spacer size="sm" />
          <Body tone="secondary">{tiles}</Body>
        </>
      ) : null}
      {note !== null ? (
        <>
          <Spacer size="sm" />
          <Caption tone="muted">{note}</Caption>
        </>
      ) : null}
      {sheet !== null ? <SkillSheet row={sheet} onClose={() => setSheet(null)} /> : null}
    </Card>
  );
}
