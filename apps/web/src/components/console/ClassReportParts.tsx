'use client';

import { IconSvg } from '@hangul-route/design-system/icon-glyphs/dom';
import { borderWidth, colors, layout, radii, spacing, touchTarget, typography } from '@hangul-route/design-system/tokens';
import Link from 'next/link';
import { useState } from 'react';
import type { ClassLetterBlock, ClassReportView } from '@/lib/console/class-report-view';
import { ReportSentenceText } from './ReportParts';

/**
 * The class report page body (F-REPORT-001 RP-8; screen spec `design/screens/reports/class-report.md`, mocks
 * `class-report.html` and `class-report-states.html`), drawn from `class-report-view.ts`, which holds every word. It
 * reuses the learner report's frame, header, tabs, stepper, panel and print rules (`ReportParts`, RP-7b).
 *
 * Hard rules (section 3.7): counts for the class as a whole. No learner's name, initials, avatar or id; the only
 * lists are letters, bands, strands and plans; no bar, no highlight on any band, "Not yet" never stands out; no red.
 */

const ROOT_FONT_PX = 16;
const rem = (px: number): string => `${px / ROOT_FONT_PX}rem`;
const px = (value: number): string => `${value}px`;
/** One strand per row on phones, up to five across on wide screens (design README, Constants). */
const STRAND_MIN = '12rem';
const DETAIL_ID = 'hr-class-detail';
const GLYPH = 20;

export const CLASS_REPORT_CSS = `
.hr-class-line{font-size:${rem(typography.size.bodySm)};color:${colors.text.muted}}
.hr-class-up{font-size:${rem(typography.size.caption)};font-weight:${typography.weight.semibold};color:${colors.feedback.successDark}}
.hr-class-block{display:flex;flex-direction:column;gap:${rem(spacing.xs)}}
.hr-class-block h3{font-size:${rem(typography.size.body)};font-weight:${typography.weight.bold}}
.hr-class-chips{display:flex;flex-wrap:wrap;gap:${rem(spacing.xs)}}
.hr-class-chip{padding:${rem(spacing.xs)} ${rem(spacing.md)};border-radius:${px(radii.pill)};background:${colors.surface.sunken};font-size:${rem(typography.size.bodySm)};font-weight:${typography.weight.semibold}}
.hr-class-rows{display:flex;flex-direction:column;max-width:${px(layout.maxWidth.reading)}}
.hr-class-rows li{padding:${rem(spacing.xs)} 0;border-bottom:${px(borderWidth.thin)} solid ${colors.border.subtle}}
.hr-class-strands{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,${STRAND_MIN}),1fr));gap:${rem(spacing.md)}}
.hr-class-strand{display:flex;flex-direction:column;gap:${rem(spacing.xxs)}}
.hr-class-strand h4{margin:0;font-size:${rem(typography.size.bodySm)};font-weight:${typography.weight.bold}}
.hr-class-plans{display:flex;flex-direction:column;gap:${rem(spacing.xs)};max-width:${px(layout.maxWidth.reading)}}
.hr-class-plan{display:flex;flex-direction:column;justify-content:center;gap:${rem(spacing.xxs)};min-height:${px(touchTarget.min)};padding:${rem(spacing.xs)} ${rem(spacing.md)};border-radius:${px(radii.md)};background:${colors.surface.paper};border:${px(borderWidth.thin)} solid ${colors.border.subtle};color:${colors.text.primary};text-decoration:none;box-sizing:border-box}
.hr-class-plan-title{color:${colors.brand.secondaryDark};font-weight:${typography.weight.bold};text-decoration:underline;text-decoration-thickness:${px(borderWidth.thin)}}
.hr-class-plan-counts{font-size:${rem(typography.size.bodySm)}}
.hr-class-chooser{display:flex;flex-direction:column;gap:${rem(spacing.xs)}}
.hr-class-chooser a{display:flex;align-items:center;gap:${rem(spacing.sm)};min-height:${px(touchTarget.min)};padding:${rem(spacing.xs)} ${rem(spacing.md)};border-radius:${px(radii.md)};background:${colors.surface.paper};border:${px(borderWidth.thin)} solid ${colors.border.subtle};color:${colors.text.primary};font-weight:${typography.weight.bold};text-decoration:none;box-sizing:border-box}
.hr-class-chooser a span{flex:1}
.hr-report-section>.hr-report-ghost{align-self:flex-start}
@media print{.hr-class-plan{min-height:0;padding:0;border:none}.hr-class-plan-title{color:inherit;text-decoration:none}}
`;

function Chips({ block, testId }: { block: ClassLetterBlock; testId: string }): JSX.Element {
  return (
    <div className="hr-class-block">
      <h3>{block.heading}</h3>
      <ul className="hr-class-chips" data-testid={testId}>
        {block.chips.map((chip) => (
          <li key={chip.text} className="hr-class-chip">
            <ReportSentenceText sentence={chip} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Layer 1: the headline (with "more than" only when it grew), What went well, Practice together. */
function LayerOne({ view }: { view: ClassReportView }): JSX.Element | null {
  const { headline, wentWell, practiceTogether } = view;
  if (!headline && !wentWell && !practiceTogether) return null;
  return (
    <div className="hr-report-layer">
      {headline ? (
        <div className="hr-report-headline-group">
          <p className="hr-report-headline" data-testid="report-headline">
            {headline.text}
          </p>
          {headline.up ? <p className="hr-class-up">{headline.up}</p> : null}
        </div>
      ) : null}
      {wentWell ? (
        <section className="hr-report-section" data-testid="class-went-well">
          <h2>{wentWell.heading}</h2>
          {wentWell.letters ? <Chips block={wentWell.letters} testId="class-letters-new" /> : null}
          <div className="hr-class-block">
            <p>{wentWell.quests.text}</p>
            {wentWell.quests.up ? <p className="hr-class-up">{wentWell.quests.up}</p> : null}
            <p>{wentWell.cards}</p>
          </div>
          {wentWell.milestones ? (
            <div className="hr-class-block">
              <h3>{wentWell.milestones.heading}</h3>
              <ul className="hr-class-rows">
                {wentWell.milestones.lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}
      {practiceTogether ? (
        <section className="hr-report-section" data-testid="class-practice-together">
          <h2>{practiceTogether.heading}</h2>
          {practiceTogether.revisit ? <Chips block={practiceTogether.revisit} testId="class-revisit" /> : null}
          {practiceTogether.planLesson ? (
            <Link className="hr-report-ghost hr-report-actions" href={practiceTogether.planLesson.href} data-testid="class-plan-lesson">
              {practiceTogether.planLesson.text}
            </Link>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

/** Layer 2: This period, the day bands as text rows (no bar), the not-saved line, time. */
function LayerTwo({ block }: { block: NonNullable<ClassReportView['thisPeriod']> }): JSX.Element {
  return (
    <section className="hr-report-section" data-testid="class-this-period">
      <h2>{block.heading}</h2>
      {block.noneYet ? <p>{block.noneYet}</p> : null}
      {block.afterUpdate ? <p>{block.afterUpdate}</p> : null}
      {block.bands ? (
        <div className="hr-class-block">
          <h3>{block.bands.heading}</h3>
          <ul className="hr-class-rows" data-testid="class-bands">
            {block.bands.rows.map((row) => (
              <li key={row}>{row}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {block.notSaved ? <p className="hr-report-muted">{block.notSaved}</p> : null}
      {block.time ? (
        <div className="hr-class-block">
          <h3>{block.time.heading}</h3>
          <p>{block.time.total}</p>
          {block.time.up ? <p className="hr-class-up">{block.time.up}</p> : null}
          {block.time.median ? <p>{block.time.median}</p> : null}
        </div>
      ) : null}
    </section>
  );
}

/** Layer 3: More detail, collapsed: level-check counts per strand and the homework link blocks. */
function LayerThree({ detail }: { detail: NonNullable<ClassReportView['moreDetail']> }): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <section className="hr-report-more" data-testid="report-more">
      <h2 className="hr-report-more-heading">
        <button type="button" className="hr-report-disclosure hr-report-actions" aria-expanded={open} aria-controls={DETAIL_ID} onClick={() => setOpen(!open)} data-testid="report-more-button">
          <span>{detail.button}</span>
          <IconSvg name="arrow-right" size={GLYPH} color={colors.text.secondary} />
        </button>
      </h2>
      <div className="hr-report-detail" id={DETAIL_ID} hidden={!open} data-testid="report-detail">
        {detail.levelCheck ? (
          <div className="hr-report-detail-block">
            <h3>{detail.levelCheck.heading}</h3>
            <div className="hr-class-strands">
              {detail.levelCheck.strands.map((strand) => (
                <div key={strand.name} className="hr-class-strand">
                  <h4>{strand.name}</h4>
                  <ul className="hr-class-rows">
                    {strand.rows.map((row) => (
                      <li key={row}>{row}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {detail.homework ? (
          <div className="hr-report-detail-block">
            <h3>{detail.homework.heading}</h3>
            <div className="hr-class-plans">
              {detail.homework.plans.map((plan) => (
                <Link key={plan.href} className="hr-class-plan" href={plan.href} data-testid="class-plan">
                  <span className="hr-class-plan-title">{plan.title}</span>
                  <span className="hr-class-plan-counts">{plan.counts}</span>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** The class report under the controls: three layers. */
export function ClassReportContent({ view }: { view: ClassReportView }): JSX.Element {
  return (
    <div className="hr-report-body">
      <LayerOne view={view} />
      {view.thisPeriod ? <LayerTwo block={view.thisPeriod} /> : null}
      {view.moreDetail ? <LayerThree detail={view.moreDetail} /> : null}
    </div>
  );
}

/** The class chooser (no id): one row per class, at least `touchTarget.min` tall, in teacher-home order. */
export function ClassChooser({ title, rows }: { title: string; rows: { href: string; name: string }[] }): JSX.Element {
  return (
    <>
      <h1 className="hr-report-title">{title}</h1>
      <ul className="hr-class-chooser" data-testid="class-chooser">
        {rows.map((row) => (
          <li key={row.href}>
            <Link href={row.href}>
              <span>{row.name}</span>
              <IconSvg name="arrow-right" size={GLYPH} />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
