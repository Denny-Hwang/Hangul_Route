'use client';

import { IconSvg } from '@hangul-route/design-system/icon-glyphs/dom';
import { borderWidth, colors, layout, radii, spacing, touchTarget, typography } from '@hangul-route/design-system/tokens';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import type {
  LearningRouteCard,
  LearningRouteGoal,
  LearningRouteLink,
  LearningRouteRow,
  LearningRouteStageRow,
  LearningRouteTag,
  LearningRouteView,
} from '@/lib/console/learning-route-view';
import { useMessages } from '@/lib/i18n/locale-context';
import { PipShape, stageStateParts } from './JourneyParts';
import { Notice, panelStyle } from './ui';

/**
 * The grown-up Learning Route (AMENDMENTS-ROUTE-LEARNING-ROUTE section 6.1, LR-8; screen spec
 * `design/screens/learning-route/stage-list.md`, mocks `stage-list-family.html`,
 * `stage-list-class.html` and `stage-list-states.html`): the grown-up route card and the stage
 * list page body, drawn from LR-7's view model (`learning-route-view.ts`), which holds every word.
 *
 * Read-only: nothing here plays, writes or sends telemetry. Never another learner, an average, a
 * sort, a total, a zero count, a billing link or a free-lessons line (LR-OD-8). Glyphs and shapes
 * are decoration (`aria-hidden`); every fact is text.
 */

const GLYPH = 20;
const TAG_GLYPH = 16;
const SHAPE = 24;

/** The page's one reading column (`layout.maxWidth.reading`, centred). */
export const readingColumn: CSSProperties = {
  maxWidth: layout.maxWidth.reading,
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: spacing.md,
};

const reset: CSSProperties = { margin: 0 };
const lineRow: CSSProperties = { ...reset, display: 'flex', gap: spacing.sm, alignItems: 'flex-start' };
const glyphBox: CSSProperties = { flex: 'none', display: 'inline-flex', marginTop: spacing.xxs, lineHeight: 0 };
const strongLine: CSSProperties = { fontSize: typography.size.bodyLg, fontWeight: typography.weight.bold, lineHeight: typography.leading.tight };
const secondaryLine: CSSProperties = { ...reset, fontSize: typography.size.bodySm, color: colors.text.secondary, lineHeight: typography.leading.normal };

/** "Back to the class" with the arrow glyph: `touchTarget.min` tall, underlined `brand.secondaryDark` (stage-list.md, Layout 2). */
export function BackLink({ link }: { link: LearningRouteLink }): JSX.Element {
  return (
    <Link
      href={link.href}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: spacing.xs,
        minHeight: touchTarget.min,
        paddingRight: spacing.md,
        color: colors.brand.secondaryDark,
        fontWeight: typography.weight.semibold,
        textDecoration: 'underline',
      }}
    >
      <IconSvg name="arrow-left" size={GLYPH} color={colors.brand.secondaryDark} />
      {link.text}
    </Link>
  );
}

/**
 * One goal line: the flag only when the line names a goal or a plan's destination (cases 1 and 2);
 * "Next open stage" (case 3) names neither, so it has none. The report's goal line under "Now on"
 * (F-REPORT-001 RP-7a2) is this line alone.
 */
export function RouteGoalLine({ goal }: { goal: LearningRouteGoal }): JSX.Element {
  return (
    <p style={lineRow}>
      {goal.case === 3 ? null : (
        <span style={glyphBox}>
          <IconSvg name="flag" size={GLYPH} />
        </span>
      )}
      <strong style={strongLine}>{goal.line}</strong>
    </p>
  );
}

/** The goal's own lines under the goal line: who set it, the plan end, "reached this stage", the can-do line. */
function GoalDetails({ goal }: { goal: LearningRouteGoal }): JSX.Element {
  return (
    <>
      {goal.from ? <p style={secondaryLine}>{goal.from}</p> : null}
      {goal.planEnds ? <p style={secondaryLine}>{goal.planEnds}</p> : null}
      {goal.reached ? <p style={reset}>{goal.reached}</p> : null}
      {goal.canDoLead && goal.canDo ? (
        <div>
          <p style={{ ...reset, fontSize: typography.size.caption, fontWeight: typography.weight.semibold, color: colors.text.muted }}>{goal.canDoLead}</p>
          <p style={reset}>{goal.canDo}</p>
        </div>
      ) : null}
      {goal.familyPlan ? (
        <>
          <hr style={{ width: '100%', margin: 0, border: 'none', borderTop: `${borderWidth.thin}px solid ${colors.border.subtle}` }} />
          <p style={{ ...reset, color: colors.text.secondary }}>{goal.familyPlan.line}</p>
          {goal.familyPlan.planEnds ? <p style={secondaryLine}>{goal.familyPlan.planEnds}</p> : null}
        </>
      ) : null}
    </>
  );
}

/**
 * The grown-up route card (section 6.1): Now, the goal line of case 1, 2 or 3 with its details, or
 * the end of the open road. A `section` labelled "Learning Route" under the page's `h1`.
 */
export function GrownUpRouteCard({ card }: { card: LearningRouteCard }): JSX.Element {
  const lr = useMessages().console.learningRoute;
  return (
    <section aria-label={lr.section} style={{ ...panelStyle, display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
      {card.now ? (
        <p style={lineRow}>
          <span style={glyphBox}>
            <IconSvg name="pin" size={GLYPH} />
          </span>
          <strong style={strongLine}>{card.now}</strong>
        </p>
      ) : null}
      {card.goal ? (
        <>
          <RouteGoalLine goal={card.goal} />
          <GoalDetails goal={card.goal} />
        </>
      ) : null}
      {card.endOfRoad ? <p style={reset}>{card.endOfRoad}</p> : null}
    </section>
  );
}

function StageShape({ state, stage }: { state: LearningRouteStageRow['state']; stage: LearningRouteStageRow['stage'] }): JSX.Element {
  return (
    <span style={{ flex: 'none', paddingTop: spacing.xxs, lineHeight: 0 }}>
      <svg width={SHAPE} height={SHAPE} viewBox={`0 0 ${SHAPE} ${SHAPE}`} aria-hidden="true" focusable="false">
        {stageStateParts(state, SHAPE).map((part, i) => (
          <PipShape key={i} part={part} accent={colors.stage[stage]} />
        ))}
      </svg>
    </span>
  );
}

/** A tag chip, text first (never colour alone): "{name} is here" on the brand tint; the goal flag and the start pin on sunken. */
function Tag({ tag }: { tag: LearningRouteTag }): JSX.Element {
  const glyph = tag.kind === 'goal' || tag.kind === 'planGoal' ? 'flag' : tag.kind === 'start' ? 'pin' : null;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: spacing.xxs,
        padding: `${spacing.xxs}px ${spacing.sm}px`,
        borderRadius: radii.pill,
        fontSize: typography.size.caption,
        fontWeight: typography.weight.semibold,
        color: colors.text.primary,
        backgroundColor: glyph ? colors.surface.sunken : colors.brand.primaryLight,
      }}
    >
      {glyph ? <IconSvg name={glyph} size={TAG_GLYPH} /> : null}
      {tag.text}
    </span>
  );
}

const rowBase: CSSProperties = {
  display: 'flex',
  gap: spacing.md,
  padding: spacing.md,
  borderRadius: radii.md,
  border: `${borderWidth.thin}px solid ${colors.border.subtle}`,
  backgroundColor: colors.surface.paper,
};
/** A stage coming later stays quiet: dashed, no fill, its name and "Coming later" only. */
const rowQuiet: CSSProperties = { ...rowBase, backgroundColor: 'transparent', borderStyle: 'dashed' };
const rowBody: CSSProperties = { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: spacing.xs };
const stateWordStyle: CSSProperties = { fontWeight: typography.weight.regular, color: colors.text.secondary };

function StageRowItem({ row }: { row: LearningRouteRow }): JSX.Element {
  if (row.kind === 'later') {
    // "Stages 5 to 7: Coming later": the range bold, the state word as on a single row. A locale that does not end
    // the sentence with the state word keeps it whole.
    const split = row.text.endsWith(row.stateWord) && row.text.length > row.stateWord.length;
    const head = split ? row.text.slice(0, -row.stateWord.length) : row.text;
    const tail = split ? row.stateWord : '';
    return (
      <li style={rowQuiet}>
        <StageShape state="later" stage={row.stages[0] ?? 'stage7'} />
        <div style={rowBody}>
          <p style={{ ...reset, fontWeight: typography.weight.bold }}>
            {head}
            {tail ? <span style={stateWordStyle}>{tail}</span> : null}
          </p>
        </div>
      </li>
    );
  }
  return (
    <li style={row.state === 'later' ? rowQuiet : rowBase}>
      <StageShape state={row.state} stage={row.stage} />
      <div style={rowBody}>
        <p style={{ ...reset, fontWeight: typography.weight.bold }}>
          {row.order}. {row.title} <span style={stateWordStyle}>· {row.stateWord}</span>
        </p>
        {row.canDo ? <p style={reset}>{row.canDo}</p> : null}
        {row.line ? <p style={secondaryLine}>{row.line}</p> : null}
        {row.tags.length > 0 ? (
          <p style={{ ...reset, display: 'flex', flexWrap: 'wrap', gap: spacing.xs }}>
            {row.tags.map((tag) => (
              <Tag key={tag.kind} tag={tag} />
            ))}
          </p>
        ) : null}
      </div>
    </li>
  );
}

const headingStyle: CSSProperties = { fontSize: typography.size.title, margin: 0, lineHeight: typography.leading.tight };
const updatedStyle: CSSProperties = { ...reset, fontSize: typography.size.bodySm, color: colors.text.muted };

/**
 * The stage list page body for one learner (section 6.1, Layout): back link, `h1`, "Updated {date}",
 * the card, "Stages" and the `ol`. The not-synced and not-found states keep the back link, so no
 * state is a dead end; not-found lists no other learner.
 */
export function LearningRouteContent({ view }: { view: LearningRouteView }): JSX.Element {
  if (view.status === 'notFound') {
    return (
      <div style={readingColumn}>
        <Notice>{view.message}</Notice>
        <BackLink link={view.back} />
      </div>
    );
  }
  const head = (
    <>
      <BackLink link={view.back} />
      <header>
        <h1 style={headingStyle}>{view.title}</h1>
        {view.updated ? <p style={updatedStyle}>{view.updated}</p> : null}
      </header>
    </>
  );
  if (view.status === 'notSynced') {
    return (
      <div style={readingColumn}>
        {head}
        <Notice>{view.message}</Notice>
      </div>
    );
  }
  return (
    <div style={readingColumn}>
      {head}
      <GrownUpRouteCard card={view.card} />
      <h2 style={{ fontSize: typography.size.bodyLg, margin: `${spacing.sm}px 0 0` }}>{view.stagesTitle}</h2>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
        {view.stages.map((row) => (
          <StageRowItem key={row.kind === 'later' ? `later-${row.from}` : row.stage} row={row} />
        ))}
      </ol>
    </div>
  );
}

/** Loading: three sunken placeholder rows, busy, with no text (stage-list.md, States). */
export function LearningRouteLoading(): JSX.Element {
  return (
    <div style={readingColumn} aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div key={i} data-testid="route-placeholder" style={{ height: spacing.xxxl, borderRadius: radii.md, backgroundColor: colors.surface.sunken }} />
      ))}
    </div>
  );
}
