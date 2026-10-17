'use client';

import { IconSvg } from '@hangul-route/design-system/icon-glyphs/dom';
import { colors, spacing, typography } from '@hangul-route/design-system/tokens';
import type { ClassGoalLine } from '@/lib/console/class-goal-line';
import { rem } from '@/lib/console/rem';

/**
 * The class plan goal line on the class roster header (AMENDMENTS-ROUTE-LEARNING-ROUTE section 6.3,
 * LR-9, LR-OD-10; wireframe `design/wireframes/console/learning-route.md` T1): "Your class's weekly
 * plan reaches Stage {n} · {title}" with "Plan ends {date}" under it. It is a statement about the
 * newest live whole-class plan (`classGoalLine`, LR-7), never about the learners: no count of who
 * reached the stage, no share, no list. The flag marks a plan's destination, as on the stage list
 * page (`design/screens/learning-route/stage-list.md`); it is decoration, the words carry the line.
 */
export function ClassGoalLineView({ line }: { line: ClassGoalLine | null }): JSX.Element | null {
  if (line === null) return null;
  return (
    <div data-testid="class-goal-line" style={{ display: 'flex', gap: spacing.sm, alignItems: 'flex-start', marginBottom: spacing.lg }}>
      <span style={{ flex: 'none', display: 'inline-flex', marginTop: spacing.xxs, lineHeight: 0 }}>
        <IconSvg name="flag" size={20} />
      </span>
      <div>
        <p style={{ margin: 0, fontWeight: typography.weight.semibold, lineHeight: typography.leading.normal }}>{line.line}</p>
        {line.planEnds ? <p style={{ margin: 0, fontSize: rem(typography.size.bodySm), color: colors.text.secondary }}>{line.planEnds}</p> : null}
      </div>
    </div>
  );
}
