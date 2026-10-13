'use client';

import { BrowseTargetSchema, REPORT_PERIODS, type BrowseTarget, type ReportPeriod, type StageKey } from '@hangul-route/content-schema';
import { IconSvg } from '@hangul-route/design-system/icon-glyphs/dom';
import { borderWidth, colors, layout, radii, spacing, touchTarget, typography } from '@hangul-route/design-system/tokens';
import Link from 'next/link';
import { createContext, forwardRef, useContext, useState, type KeyboardEvent, type ReactNode } from 'react';
import {
  BrowseLink,
  BrowseNoticeLine,
  useBrowseLinksShown,
  useBrowseOpener,
  type BrowseOpener,
  type BrowseOpenerEnv,
} from '@/components/console/BrowseLink';
import { avatarChipModel } from '@/lib/console/avatar-chip';
import { browseUrl } from '@/lib/console/browse-link';
import { GROWTH_BOX, growthAxisShown, growthChart } from '@/lib/console/report-growth';
import type {
  LearnerReportView,
  ReportCalendarView,
  ReportDetailBlock,
  ReportGlance,
  ReportGrowthView,
  ReportLetter,
  ReportLineView,
  ReportLink,
  ReportMoreDetail,
  ReportSection,
  ReportSentence,
  ReportStepButton,
  ReportStepper,
  ReportTab,
  ReportThisPeriod,
} from '@/lib/console/report-view';
import { useMessages } from '@/lib/i18n/locale-context';

/**
 * The learner report page body (F-REPORT-001 RP-7a2; screen spec `design/screens/reports/learner-report.md`, mocks
 * `learner-report.html`, `learner-report-teacher.html`, `learner-report-states.html`): drawn from RP-7a1's view model
 * (`report-view.ts`), which holds every word. Three layers: the answer (headline, What went well, What to practice
 * next), then This period, then More detail behind one button.
 *
 * Anti-shame (CLAUDE.md section 1): one learner only, never a class figure or a comparison; "more than" only when a
 * figure grew; no red, no down arrow, no percentage; an empty section has no heading. Glyphs are decoration
 * (`aria-hidden`); every fact is text. Every control that only works on a screen carries `hr-report-actions`, which the
 * print rules (RP-7b) hide.
 */

/** The browser's default text size: type is written in rem from the px tokens, so the browser text size enlarges it. */
const ROOT_FONT_PX = 16;
const rem = (px: number): string => `${px / ROOT_FONT_PX}rem`;
const px = (value: number): string => `${value}px`;

/** Layout constants of the design pass (`design/screens/reports/README.md`, Constants), in em so text size moves them. */
const WIDE = '45em'; // the adult frame's phone / wide switch (F-APP-001 section 3.8)
const TWO_COLUMNS = '60em'; // the report body's two columns
const PERIOD_TAB_MIN = '4.5rem';
const FIGURE_MIN = '7rem';
const PRINT_HINT_MIN = '8rem';
const PRINT_HINT_MAX = '14rem';
const DETAIL_COLUMN_MIN = '22rem';
const INSIGHT_TEXT_MIN = '14rem';
/** The learner's avatar chip (`AVATAR_CHIP_SIZE`, AvatarChip.tsx). */
const AVATAR_CHIP = 28;
const GLYPH = 20;
/** The check glyph fills this share of a practiced calendar mark. */
const CHECK_SHARE = '60%';

export const REPORT_PANEL_ID = 'hr-report-panel';
const PRINT_HINT_ID = 'hr-report-print-hint';
const DETAIL_ID = 'hr-report-detail';
const GROWTH_TABLE_ID = 'hr-report-growth-table';
/** The growth chart's marks, in the drawing box's units (design: 2 px lines, 8 px markers ringed in paper, 6 4 dashes). */
const GROWTH_LINE = 2;
const GROWTH_MARKER_R = 4;
const GROWTH_DASH = '6 4';
export const reportTabId = (period: ReportPeriod): string => `hr-report-tab-${period}`;

const focusRing = `outline:${px(borderWidth.thick)} solid ${colors.border.focus};outline-offset:${px(borderWidth.base)}`;

export const REPORT_CSS = `
.hr-report{display:flex;flex-direction:column;gap:${rem(spacing.sm)};color:${colors.text.primary};font-size:${rem(typography.size.body)};line-height:${typography.leading.normal}}
.hr-report p,.hr-report h1,.hr-report h2,.hr-report h3,.hr-report ul,.hr-report ol,.hr-report dl,.hr-report dd{margin:0;padding:0}
.hr-report ul,.hr-report ol{list-style:none}
.hr-report-hidden{position:absolute;width:${px(borderWidth.thin)};height:${px(borderWidth.thin)};margin:-${px(borderWidth.thin)};padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0}
.hr-report-top{display:flex;flex-direction:column;align-items:flex-start;gap:${rem(spacing.xs)}}
.hr-report-back{display:inline-flex;align-items:center;gap:${rem(spacing.xs)};min-height:${px(touchTarget.min)};padding-right:${rem(spacing.md)};color:${colors.brand.secondaryDark};font-weight:${typography.weight.semibold};text-decoration:underline}
.hr-report-buttons{display:flex;flex-wrap:wrap;align-items:center;column-gap:${rem(spacing.xs)};row-gap:${rem(spacing.xxs)}}
.hr-report-hint{flex:1 1 ${PRINT_HINT_MIN};font-size:${rem(typography.size.caption)};color:${colors.text.muted};line-height:${typography.leading.tight}}
.hr-report-link-button{display:inline-flex;align-items:center;justify-content:center;min-height:${px(touchTarget.min)};padding:${rem(spacing.sm)} ${rem(spacing.lg)};border-radius:${px(radii.pill)};border:${px(borderWidth.thin)} solid ${colors.border.strong};background:${colors.surface.paper};color:${colors.text.primary};font:inherit;font-size:${rem(typography.size.bodySm)};font-weight:${typography.weight.bold};text-decoration:none;cursor:pointer}
.hr-report-link-button:disabled{background:${colors.surface.sunken};color:${colors.text.muted};cursor:default}
.hr-report-ghost{display:inline-flex;align-items:center;min-height:${px(touchTarget.min)};padding:${rem(spacing.xs)} ${rem(spacing.lg)};border-radius:${px(radii.pill)};background:${colors.brand.primaryLight};color:${colors.brand.primaryDark};font-size:${rem(typography.size.bodySm)};font-weight:${typography.weight.bold};text-decoration:none}
.hr-report-glance{display:flex;flex-direction:column;gap:${rem(spacing.xs)}}
.hr-report-title{display:flex;align-items:center;gap:${rem(spacing.sm)};font-size:${rem(typography.size.title)};font-weight:${typography.weight.bold};line-height:${typography.leading.tight};overflow-wrap:anywhere}
.hr-report-state-title{font-size:${rem(typography.size.bodyLg)};font-weight:${typography.weight.bold};line-height:${typography.leading.tight}}
.hr-report-chip{flex:none;width:${px(AVATAR_CHIP)};height:${px(AVATAR_CHIP)};border-radius:${px(radii.circle)};border:${px(borderWidth.base)} solid ${colors.surface.paper};box-shadow:0 0 0 ${px(borderWidth.thin)} ${colors.border.strong}}
.hr-report-region{display:flex;flex-direction:column;align-items:flex-start;gap:${rem(spacing.xs)}}
.hr-report-goal{display:flex;gap:${rem(spacing.sm)};align-items:flex-start;font-weight:${typography.weight.semibold}}
.hr-report-goal svg{flex:none;margin-top:${rem(spacing.xxs)}}
.hr-report-muted{font-size:${rem(typography.size.bodySm)};color:${colors.text.muted}}
.hr-report-state{display:flex;flex-direction:column;align-items:flex-start;gap:${rem(spacing.xs)};padding:${rem(spacing.md)};border-radius:${px(radii.md)};background:${colors.surface.sunken}}
.hr-report-controls{display:flex;flex-direction:column;gap:${rem(spacing.xs)}}
.hr-report-tabs{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,${PERIOD_TAB_MIN}),1fr));gap:${rem(spacing.xs)};padding:${rem(spacing.xs)};border-radius:${px(radii.lg)};background:${colors.surface.sunken};max-width:${px(layout.maxWidth.reading)}}
.hr-report-tab{min-height:${px(touchTarget.min)};padding:${rem(spacing.xs)} ${rem(spacing.sm)};border-radius:${px(radii.md)};border:${px(borderWidth.base)} solid transparent;background:transparent;color:${colors.text.secondary};font:inherit;font-size:${rem(typography.size.bodySm)};font-weight:${typography.weight.semibold};line-height:${typography.leading.tight};text-align:center;cursor:pointer}
.hr-report-tab[aria-selected="true"]{background:${colors.surface.paper};border-color:${colors.brand.primary};color:${colors.text.primary};font-weight:${typography.weight.bold}}
.hr-report-tab:disabled{color:${colors.text.muted};cursor:default}
.hr-report-tab:focus-visible,.hr-report-step:focus-visible,.hr-report-disclosure:focus-visible,.hr-report-link-button:focus-visible,.hr-report-ghost:focus-visible,.hr-report-back:focus-visible{${focusRing}}
.hr-report-stepper{display:flex;flex-wrap:wrap;align-items:center;column-gap:${rem(spacing.sm)};row-gap:${rem(spacing.xxs)}}
.hr-report-step{display:inline-flex;align-items:center;gap:${rem(spacing.xs)};min-height:${px(touchTarget.min)};padding:${rem(spacing.xs)} ${rem(spacing.md)};border-radius:${px(radii.pill)};border:${px(borderWidth.thin)} solid ${colors.border.strong};background:${colors.surface.paper};color:${colors.text.primary};font:inherit;font-size:${rem(typography.size.bodySm)};font-weight:${typography.weight.bold};cursor:pointer}
.hr-report-step-next{margin-left:auto}
.hr-report-range{color:${colors.text.secondary};font-size:${rem(typography.size.bodySm)}}
.hr-report-panel{display:flex;flex-direction:column;gap:${rem(spacing.sm)}}
.hr-report-body{display:flex;flex-direction:column;gap:${rem(spacing.xl)}}
.hr-report-layer{display:flex;flex-direction:column;gap:${rem(spacing.lg)}}
.hr-report-headline-group{display:flex;flex-direction:column;gap:${rem(spacing.xxs)}}
.hr-report-headline{font-size:${rem(typography.size.prompt)};font-weight:${typography.weight.bold};line-height:${typography.leading.tight}}
.hr-report-horizon{color:${colors.text.secondary}}
.hr-report-section{display:flex;flex-direction:column;gap:${rem(spacing.sm)}}
.hr-report-section h2{font-size:${rem(typography.size.bodyLg)};font-weight:${typography.weight.bold};line-height:${typography.leading.tight}}
.hr-report-insights{display:flex;flex-direction:column;gap:${rem(spacing.sm)}}
.hr-report-insights>li{display:flex;flex-wrap:wrap;align-items:center;column-gap:${rem(spacing.md)};row-gap:${rem(spacing.xs)};padding-left:${rem(spacing.lg)}}
.hr-report-insight-text{position:relative;flex:1 1 ${INSIGHT_TEXT_MIN};min-width:0;display:flex;flex-direction:column;gap:${rem(spacing.xxs)}}
.hr-report-insight-text>p:first-child::before{content:"";position:absolute;left:calc(-1 * ${rem(spacing.lg)} + ${rem(spacing.xxs)});top:calc(${rem(typography.size.body)} * ${typography.leading.normal} / 2 - ${rem(spacing.xs)});width:${rem(spacing.sm)};height:${rem(spacing.sm)};border-radius:${px(radii.circle)};background:${colors.border.shape}}
.hr-report-went-well .hr-report-insight-text>p:first-child::before{background:${colors.brand.primary}}
.hr-report-tip{font-size:${rem(typography.size.bodySm)};color:${colors.text.secondary}}
.hr-report-line-actions{display:flex;flex-wrap:wrap;gap:${rem(spacing.xs)}}
.hr-report-letter{white-space:nowrap}
.hr-report-letter-link,.hr-report-quest-link,.hr-report-tip-link{color:${colors.brand.secondaryDark};text-decoration:underline;text-decoration-thickness:${px(borderWidth.thin)};text-underline-offset:${rem(spacing.xxs)}}
.hr-report-tip-link{display:inline-flex;align-items:center;min-height:${px(touchTarget.min)}}
.hr-report-tile-link{color:${colors.text.primary};text-decoration:none}
.hr-report-tiles .hr-report-tile-link{display:inline-flex}
.hr-report-tiles .hr-report-tile-cell-notice{flex-basis:100%}
.hr-report-letter-link:focus-visible,.hr-report-quest-link:focus-visible,.hr-report-tip-link:focus-visible,.hr-report-tile-link:focus-visible{${focusRing}}
.hr-report [lang="ko"]{font-weight:${typography.weight.bold}}
.hr-report-figures{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,${FIGURE_MIN}),1fr));gap:${rem(spacing.sm)}}
.hr-report-figure{display:flex;flex-direction:column;gap:${rem(spacing.xxs)};padding:${rem(spacing.sm)} ${rem(spacing.md)};border-radius:${px(radii.md)};background:${colors.surface.paper};border:${px(borderWidth.thin)} solid ${colors.border.subtle}}
.hr-report-figure dt{order:1;font-size:${rem(typography.size.bodySm)};color:${colors.text.secondary}}
.hr-report-figure-value{order:0;font-size:${rem(typography.size.title)};font-weight:${typography.weight.bold};line-height:${typography.leading.tight}}
.hr-report-figure-up{order:2;font-size:${rem(typography.size.caption)};font-weight:${typography.weight.semibold};color:${colors.feedback.successDark}}
.hr-report-calendar-block{display:flex;flex-direction:column;gap:${rem(spacing.sm)}}
.hr-report-calendar{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:${rem(spacing.xs)};max-width:${px(layout.maxWidth.reading)}}
.hr-report-cal-day{display:flex;flex-direction:column;align-items:center;gap:${rem(spacing.xxs)};min-width:0}
.hr-report-cal-head{text-align:center;font-size:${rem(typography.size.caption)};font-weight:${typography.weight.semibold};color:${colors.text.muted};overflow:hidden}
.hr-report-cal-label{display:flex;flex-direction:column;align-items:center;max-width:100%;overflow:hidden;font-size:${rem(typography.size.caption)};line-height:${typography.leading.tight};color:${colors.text.secondary}}
.hr-report-cal-dow{max-width:100%;overflow:hidden;text-overflow:clip;white-space:nowrap;font-weight:${typography.weight.semibold};color:${colors.text.muted}}
.hr-report-cal-mark{width:100%;max-width:${px(spacing.xxxl)};aspect-ratio:1;border-radius:${px(radii.sm)};display:flex;align-items:center;justify-content:center;box-sizing:border-box}
.hr-report-cal-mark svg{width:${CHECK_SHARE};height:${CHECK_SHARE}}
.hr-report-cal-practiced{background:${colors.brand.secondary};border:${px(borderWidth.base)} solid ${colors.brand.secondaryDark}}
.hr-report-cal-none{background:${colors.surface.paper};border:${px(borderWidth.base)} solid ${colors.border.shape}}
.hr-report-cal-not_saved{background:transparent;border:${px(borderWidth.base)} dashed ${colors.border.shape}}
.hr-report-calendar-text{color:${colors.text.secondary};font-size:${rem(typography.size.bodySm)}}
.hr-report-more{display:flex;flex-direction:column;gap:${rem(spacing.md)}}
.hr-report-more>h2{font-size:${rem(typography.size.bodyLg)}}
.hr-report-disclosure{display:flex;width:100%;align-items:center;justify-content:space-between;gap:${rem(spacing.sm)};min-height:${px(touchTarget.min)};padding:${rem(spacing.sm)} ${rem(spacing.lg)};border-radius:${px(radii.md)};border:${px(borderWidth.thin)} solid ${colors.border.strong};background:${colors.surface.paper};color:${colors.text.primary};font:inherit;font-size:${rem(typography.size.bodyLg)};font-weight:${typography.weight.bold};text-align:left;cursor:pointer}
.hr-report-disclosure svg{transform:rotate(90deg)}
.hr-report-disclosure[aria-expanded="true"] svg{transform:rotate(-90deg)}
.hr-report-detail{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,${DETAIL_COLUMN_MIN}),1fr));gap:${rem(spacing.lg)} ${rem(spacing.xl)};align-items:start}
.hr-report-detail[hidden]{display:none}
.hr-report-detail-lead{grid-column:1/-1}
.hr-report-detail-block{display:flex;flex-direction:column;gap:${rem(spacing.xs)}}
.hr-report-detail-block h3{font-size:${rem(typography.size.body)};font-weight:${typography.weight.bold}}
.hr-report-detail-lines{display:flex;flex-direction:column;gap:${rem(spacing.xxs)}}
.hr-report-tiles{display:flex;flex-wrap:wrap;gap:${rem(spacing.xs)}}
.hr-report-tile{min-width:${px(touchTarget.min)};min-height:${px(touchTarget.min)};padding:${rem(spacing.xxs)} ${rem(spacing.sm)};display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:${px(radii.md)};background:${colors.surface.paper};border:${px(borderWidth.thin)} solid ${colors.border.strong};box-sizing:border-box}
.hr-report-tile [lang="ko"]{font-size:${rem(typography.size.prompt)};line-height:${typography.leading.tight}}
.hr-report-rom{font-size:${rem(typography.size.caption)};color:${colors.text.secondary}}
.hr-report-growth{display:flex;flex-direction:column;gap:${rem(spacing.sm)};max-width:${px(layout.maxWidth.reading)}}
.hr-report-growth-legend{display:flex;flex-wrap:wrap;gap:${rem(spacing.lg)};font-size:${rem(typography.size.bodySm)};color:${colors.text.secondary}}
.hr-report-growth-legend li{display:inline-flex;align-items:center;gap:${rem(spacing.xs)}}
.hr-report-growth-legend b{color:${colors.text.primary}}
.hr-report-swatch{display:inline-block;width:${rem(spacing.xl)};height:0;border-top:${px(borderWidth.base)} solid ${colors.brand.primary}}
.hr-report-swatch-cards{border-top-style:dashed;border-top-color:${colors.brand.secondary}}
.hr-report-growth-chart{width:100%;height:auto;display:block;background:${colors.surface.paper};border-radius:${px(radii.md)};border:${px(borderWidth.thin)} solid ${colors.border.subtle}}
.hr-report-growth-axis{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);text-align:center;font-size:${rem(typography.size.caption)};color:${colors.text.muted}}
.hr-report-growth-table{width:100%;table-layout:fixed;border-collapse:collapse;font-size:${rem(typography.size.bodySm)}}
.hr-report-growth-table caption{text-align:left;font-weight:${typography.weight.bold};padding-bottom:${rem(spacing.xs)}}
.hr-report-growth-table th,.hr-report-growth-table td{padding:${rem(spacing.xs)} ${rem(spacing.sm)};overflow-wrap:anywhere;border-bottom:${px(borderWidth.thin)} solid ${colors.border.subtle};text-align:left}
.hr-report-growth-table[hidden]{display:none}
.hr-report-growth>.hr-report-link-button{align-self:flex-start}
.hr-report-skeleton{height:${rem(spacing.xxxl)};border-radius:${px(radii.md)};background:${colors.surface.sunken}}
.hr-report-skeleton-tall{height:calc(3 * ${rem(spacing.xxxl)})}
.hr-report-skeleton-title{display:inline-block;width:50%;height:${rem(typography.size.title)};border-radius:${px(radii.sm)};background:${colors.surface.sunken}}
@media screen{.hr-report-print-footer{display:none}}
@media print{
@page{margin:0}
.hr-report{padding:${rem(spacing.xxl)} ${rem(spacing.xxl)} ${rem(spacing.jumbo)};background:${colors.surface.paper};color:${colors.text.primary}}
.hr-report-tab[aria-selected="true"]{font-size:${rem(typography.size.body)}}
.hr-report-controls{gap:${rem(spacing.sm)}}
.hr-report-figure,.hr-report-tile{border-color:${colors.border.strong}}
.hr-report-insight-text>p:first-child::before,.hr-report-chip{-webkit-print-color-adjust:exact;print-color-adjust:exact}
.hr-report .hr-report-print-footer{padding:${rem(spacing.md)} ${rem(spacing.xxl)};font-size:${rem(typography.size.caption)};color:${colors.text.secondary};border-top:${px(borderWidth.thin)} solid ${colors.border.strong};background:${colors.surface.paper}}
.hr-report-letter-link,.hr-report-quest-link,.hr-report-tip-link,.hr-report-tile-link{color:inherit;text-decoration:none}
.hr-report-tip-link{display:inline;min-height:0}
.hr-report [data-testid$="-link-notice"]{display:none!important}
}
@media (min-width:${WIDE}){
.hr-report-top{flex-direction:row;flex-wrap:wrap;align-items:center;justify-content:space-between;column-gap:${rem(spacing.sm)}}
.hr-report-buttons{justify-content:flex-end;column-gap:${rem(spacing.sm)}}
.hr-report-hint{max-width:${PRINT_HINT_MAX}}
}
@media (min-width:${TWO_COLUMNS}){
.hr-report-body{display:grid;grid-template-columns:minmax(0,6fr) minmax(0,5fr);column-gap:${rem(spacing.xxl)};row-gap:${rem(spacing.xl)};align-items:start}
.hr-report-body>.hr-report-more{grid-column:1/-1}
}
`;

// ---------------------------------------------------------------------------------------------
// Header, title and glance

/** "Back to home" with the arrow glyph: on a phone the header's first row to itself (a long space name wraps in it). */
export function ReportBack({ link }: { link: ReportLink }): JSX.Element {
  return (
    <Link className="hr-report-back" href={link.href} data-testid="report-back">
      <IconSvg name="arrow-left" size={GLYPH} color={colors.brand.secondaryDark} />
      <span>{link.text}</span>
    </Link>
  );
}

/**
 * The header: the back link, then (row 2 on a phone) **Print or save as PDF** with its hint, which it names with
 * `aria-describedby`. Print is disabled while the report loads; a cached report shown with a failed later load stays printable. **Send a note** joins the second row in
 * RP-12 (after F-FEEDBACK-001 FB-11), so it is not drawn here.
 */
export function ReportHeader({ back, printDisabled, onPrint }: { back: ReportLink; printDisabled: boolean; onPrint: () => void }): JSX.Element {
  const p = useMessages().report.print;
  return (
    <div className="hr-report-top hr-report-actions">
      <ReportBack link={back} />
      <div className="hr-report-buttons">
        <button type="button" className="hr-report-link-button" aria-describedby={PRINT_HINT_ID} disabled={printDisabled} onClick={onPrint} data-testid="report-print">
          {p.button}
        </button>
        <p className="hr-report-hint" id={PRINT_HINT_ID}>
          {p.hint}
        </p>
      </div>
    </div>
  );
}

/** The decorative avatar chip before the title (`aria-hidden`: the name is the title's text). */
function TitleChip({ avatar }: { avatar: string | null }): JSX.Element {
  return <span className="hr-report-chip" aria-hidden="true" style={{ backgroundColor: avatarChipModel(avatar ?? '').fill }} />;
}

/** The page's one `h1`: "{name}: report" with the chip, or a skeleton bar on the first load (no name is known yet). */
export function ReportTitle({ title, avatar }: { title: string | null; avatar: string | null }): JSX.Element {
  const documentTitle = useMessages().report.documentTitle;
  if (title === null) {
    return (
      <h1 className="hr-report-title">
        <span className="hr-report-skeleton-title" aria-hidden="true" />
        <span className="hr-report-hidden">{documentTitle}</span>
      </h1>
    );
  }
  return (
    <h1 className="hr-report-title">
      <TitleChip avatar={avatar} />
      <span>{title}</span>
    </h1>
  );
}

/**
 * At a glance: LR-D's region (`console.learningRoute.section`) holding "Now on", the goal line (the flag only for a goal
 * or a plan) and **Open Learning Route** when that page is on the build; then "Last practice" outside it.
 */
export function ReportGlanceBlock({ glance }: { glance: ReportGlance }): JSX.Element | null {
  const hasRegion = glance.nowOn !== null || glance.goal !== null || glance.route !== null;
  if (!hasRegion && glance.lastPractice === null) return null;
  return (
    <>
      {hasRegion ? (
        <section className="hr-report-region" aria-label={glance.region} data-testid="report-glance">
          {glance.nowOn ? <p>{glance.nowOn}</p> : null}
          {glance.goal ? (
            <p className="hr-report-goal" data-testid="report-goal">
              {glance.goal.flag ? <IconSvg name="flag" size={GLYPH} /> : null}
              <span>{glance.goal.line}</span>
            </p>
          ) : null}
          {glance.route ? (
            <Link className="hr-report-link-button hr-report-actions" href={glance.route.href} data-testid="report-open-route">
              {glance.route.text}
            </Link>
          ) : null}
        </section>
      ) : null}
      {glance.lastPractice ? <p className="hr-report-muted">{glance.lastPractice}</p> : null}
    </>
  );
}

/**
 * One neutral block under the glance (no warning colour, no icon): the archived sentence, the stale / legacy / no_data /
 * empty lines, and, when a later load failed while the cached report stays, the error and Try again.
 */
export function ReportStateBlock({ lines, error, onRetry }: { lines: string[]; error: { message: string; retry: string } | null; onRetry: () => void }): JSX.Element | null {
  if (lines.length === 0 && error === null) return null;
  return (
    <div className="hr-report-state" data-testid="report-state">
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
      {error ? (
        <>
          <p data-testid="report-error-line">{error.message}</p>
          <button type="button" className="hr-report-link-button hr-report-actions" onClick={onRetry} data-testid="report-retry">
            {error.retry}
          </button>
        </>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Tabs and stepper

export interface ReportControlsProps {
  tabs: ReportTab[];
  tabsLabel: string;
  stepper: ReportStepper | null;
  /** The first load: the tab row is drawn disabled (later loads keep it enabled; only the panel is busy). */
  disabled: boolean;
  onSelect: (tab: ReportTab) => void;
  onStep: (which: 'prev' | 'next', button: ReportStepButton) => void;
  prevRef: (node: HTMLButtonElement | null) => void;
  nextRef: (node: HTMLButtonElement | null) => void;
  /** The polite live region's text after a period change or a step. */
  announce: string;
}

const ROVING_KEYS: Record<string, (index: number, count: number) => number> = {
  ArrowRight: (i, n) => (i + 1) % n,
  ArrowDown: (i, n) => (i + 1) % n,
  ArrowLeft: (i, n) => (i - 1 + n) % n,
  ArrowUp: (i, n) => (i - 1 + n) % n,
  Home: () => 0,
  End: (_i, n) => n - 1,
};

/**
 * The period tabs (`role="tablist"`, manual activation: arrows, Home and End move focus; Enter or Space selects and
 * loads) and the Previous / Next stepper with the window's dates between them. Both control the report panel.
 */
export function ReportControls(props: ReportControlsProps): JSX.Element {
  const { tabs, stepper } = props;
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const buttons: (HTMLButtonElement | null)[] = [];
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number): void => {
    const move = ROVING_KEYS[event.key];
    if (!move) return;
    event.preventDefault();
    const next = move(index, tabs.length);
    setFocusIndex(next);
    buttons[next]?.focus();
  };
  const selectedIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.selected),
  );
  const stop = focusIndex ?? selectedIndex;
  return (
    <div className="hr-report-controls">
      <div className="hr-report-tabs" role="tablist" aria-label={props.tabsLabel}>
        {tabs.map((tab, index) => (
          <button
            key={tab.period}
            ref={(node) => {
              buttons[index] = node;
            }}
            type="button"
            role="tab"
            className="hr-report-tab"
            id={reportTabId(tab.period)}
            aria-controls={REPORT_PANEL_ID}
            aria-selected={tab.selected}
            tabIndex={index === stop ? 0 : -1}
            disabled={props.disabled}
            onKeyDown={(event) => onKeyDown(event, index)}
            onFocus={() => setFocusIndex(index)}
            onBlur={() => setFocusIndex(null)}
            onClick={() => props.onSelect(tab)}
            data-testid={`report-tab-${tab.period}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {stepper ? (
        <div className="hr-report-stepper">
          {stepper.prev ? <StepButton ref={props.prevRef} button={stepper.prev} which="prev" onStep={props.onStep} /> : null}
          <p className="hr-report-range" data-testid="report-range">
            {stepper.range}
          </p>
          {stepper.next ? <StepButton ref={props.nextRef} button={stepper.next} which="next" onStep={props.onStep} /> : null}
        </div>
      ) : null}
      <p className="hr-report-hidden" aria-live="polite" data-testid="report-announce">
        {props.announce}
      </p>
    </div>
  );
}

const StepButton = forwardRef<HTMLButtonElement, { button: ReportStepButton; which: 'prev' | 'next'; onStep: ReportControlsProps['onStep'] }>(function StepButton(
  { button, which, onStep },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={which === 'next' ? 'hr-report-step hr-report-step-next hr-report-actions' : 'hr-report-step hr-report-actions'}
      aria-controls={REPORT_PANEL_ID}
      aria-label={button.name}
      onClick={() => onStep(which, button)}
      data-testid={`report-step-${which}`}
    >
      {which === 'prev' ? <IconSvg name="arrow-left" size={GLYPH} /> : null}
      <span>{button.label}</span>
      {which === 'next' ? <IconSvg name="arrow-right" size={GLYPH} /> : null}
    </button>
  );
});

/** The tab row of the first load: every period, the address's one selected, all disabled. */
export function loadingTabs(period: ReportPeriod, labels: Record<ReportPeriod, string>): ReportTab[] {
  return REPORT_PERIODS.map((p) => ({ period: p, label: labels[p], selected: p === period, href: '' }));
}

// ---------------------------------------------------------------------------------------------
// The report body

/**
 * Browse links on the report (F-REPORT-001 RP-13, section 3.6; F-BROWSE-001 section 4.11 item 2): present while the
 * page's All lessons entries render (`browseLinksShown()`), else null and every letter, quest title and tip stays text.
 * `stage` is the strand tip's target (`reportBrowseStage`); `env` is the browser, injectable for tests.
 */
export interface ReportBrowse {
  stage: StageKey;
  env?: BrowseOpenerEnv;
}

const ReportBrowseContext = createContext<ReportBrowse | null>(null);

/** The target when it is a content id All lessons can open (BD7), else null: the part then stays text. */
function browseTargetOf(target: BrowseTarget): BrowseTarget | null {
  return BrowseTargetSchema.safeParse(target).success ? target : null;
}

/**
 * One link into All lessons, source `report`: a real `/browse#…` link (content ids only) that a plain click opens
 * through `openBrowse`, then its status line. `inline` keeps the empty line from breaking a sentence.
 */
function ReportBrowseLink({ target, className, testId, inline = false, children }: { target: BrowseTarget; className: string; testId: string; inline?: boolean; children: ReactNode }): JSX.Element {
  const browse = useContext(ReportBrowseContext);
  const opener = useBrowseOpener(target, 'report', browse?.env);
  return (
    <>
      <ReportBrowseAnchor target={target} opener={opener} className={className} testId={testId}>
        {children}
      </ReportBrowseAnchor>
      <BrowseNoticeLine opener={opener} testId={testId} inline={inline} />
    </>
  );
}

/** The anchor alone: content ids only in its href, a plain click goes through the opener. */
function ReportBrowseAnchor({ target, opener, className, testId, ariaLabel, children }: { target: BrowseTarget; opener: BrowseOpener; className: string; testId: string; ariaLabel?: string; children: ReactNode }): JSX.Element {
  return (
    <a href={browseUrl('', target, 'report')} className={className} onClick={opener.onClick} aria-label={ariaLabel} aria-busy={opener.checking || undefined} data-testid={testId}>
      {children}
    </a>
  );
}

/**
 * A sentence with its taught parts: letters and words in `lang="ko"`, a quest by its catalogue title. With Browse
 * links on (RP-13) each letter opens its letter and the quest title (P4) its quest; words stay text.
 */
export function ReportSentenceText({ sentence }: { sentence: ReportSentence }): JSX.Element {
  const browse = useContext(ReportBrowseContext);
  return (
    <>
      {sentence.parts.map((part, index) => {
        const key = `${part.kind}-${index}`;
        if (part.kind === 'text') return <span key={key}>{part.text}</span>;
        if (part.kind === 'letter') {
          const letter = (
            <>
              {part.before}
              <span lang="ko">{part.letter}</span>
              {part.after}
            </>
          );
          const target = browse ? browseTargetOf({ kind: 'char', char: part.letter }) : null;
          return target ? (
            <ReportBrowseLink key={key} target={target} className="hr-report-letter hr-report-letter-link" testId="report-letter-link" inline>
              {letter}
            </ReportBrowseLink>
          ) : (
            <span key={key} className="hr-report-letter">
              {letter}
            </span>
          );
        }
        if (part.kind === 'quest') {
          const target = browse ? browseTargetOf({ kind: 'quest', id: part.id }) : null;
          return target ? (
            <ReportBrowseLink key={key} target={target} className="hr-report-quest-link" testId="report-quest-link" inline>
              {part.title}
            </ReportBrowseLink>
          ) : (
            <span key={key}>{part.title}</span>
          );
        }
        return (
          <span key={key}>
            {part.ko === null ? null : (
              <>
                <span lang="ko">{part.ko}</span>{' '}
              </>
            )}
            {plainWordTail(part.romanization, part.gloss)}
          </span>
        );
      })}
    </>
  );
}

/** A word's romanization and gloss: the same words as `sentence.text`, which the view model built. */
function plainWordTail(romanization: string, gloss: string | null): ReactNode {
  return gloss === null ? romanization : <WordGloss romanization={romanization} gloss={gloss} />;
}

function WordGloss({ romanization, gloss }: { romanization: string; gloss: string }): JSX.Element {
  const m = useMessages();
  return <>{m.console.space.wordGloss(romanization, gloss)}</>;
}

/**
 * One insight line: a disc, the sentence (its `id` describes the line's actions), the strand tip, and the action group
 * (**Add to a plan** or **Open the plan**; F-BROWSE-001 BR-11 adds **Preview** beside Add to a plan). No group without
 * an action.
 */
function InsightLine({ line, id, preview }: { line: ReportLineView; id: string; preview: boolean }): JSX.Element {
  const browse = useContext(ReportBrowseContext);
  const label = useMessages().console.browse.preview.cta;
  const target = preview ? (line.preview ?? null) : null;
  return (
    <li data-testid={`report-line-${line.code}`}>
      <div className="hr-report-insight-text">
        <p id={id}>
          <ReportSentenceText sentence={line.sentence} />
        </p>
        {line.tip ? (
          <p className="hr-report-tip">
            {browse ? (
              <ReportBrowseLink target={{ kind: 'stage', stage: browse.stage }} className="hr-report-tip-link" testId="report-tip-link">
                {/* No link inside the tip's link: its parts render as text (no nested anchors). */}
                <ReportBrowseContext.Provider value={null}>
                  <ReportSentenceText sentence={line.tip} />
                </ReportBrowseContext.Provider>
              </ReportBrowseLink>
            ) : (
              <ReportSentenceText sentence={line.tip} />
            )}
          </p>
        ) : null}
      </div>
      {line.actions.length > 0 || target ? (
        <div className="hr-report-line-actions hr-report-actions" data-testid="report-line-actions">
          {line.actions.map((action) => (
            <Link key={action.href} className="hr-report-ghost" href={action.href} aria-describedby={id}>
              {action.text}
            </Link>
          ))}
          {target ? <BrowseLink target={target} source="report" label={label} describedBy={id} className="hr-report-ghost" testId={`report-preview-${line.code}`} /> : null}
        </div>
      ) : null}
    </li>
  );
}

/** What went well or What to practice next: drawn only with a line (the view model gives null otherwise). */
export function ReportInsights({
  section,
  kind,
  preview,
}: {
  section: ReportSection;
  kind: 'went-well' | 'practice-next';
  /** **Preview** into All lessons on P1 (F-BROWSE-001 BR-11); omitted, `browseLinksShown()` for this page decides. */
  preview?: boolean;
}): JSX.Element {
  const shown = useBrowseLinksShown();
  return (
    <section className={`hr-report-section hr-report-${kind}`} data-testid={`report-${kind}`}>
      <h2>{section.heading}</h2>
      <ul className="hr-report-insights">
        {section.lines.map((line, index) => (
          <InsightLine key={`${line.code}-${index}`} line={line} id={`hr-report-${kind}-${index}`} preview={preview ?? shown} />
        ))}
      </ul>
    </section>
  );
}

function CalendarBlock({ calendar, month }: { calendar: ReportCalendarView; month: boolean }): JSX.Element {
  return (
    <div className="hr-report-calendar-block">
      <ol className="hr-report-calendar" aria-hidden="true" data-testid="report-calendar">
        {month
          ? calendar.weekdays.map((name) => (
              <li key={`head-${name}`} className="hr-report-cal-head">
                {name}
              </li>
            ))
          : null}
        {Array.from({ length: calendar.lead }, (_, index) => (
          <li key={`lead-${index}`} />
        ))}
        {calendar.cells.map((cell) => (
          <li key={cell.day} className="hr-report-cal-day" data-kind={cell.kind}>
            <span className="hr-report-cal-label">
              {month ? null : <span className="hr-report-cal-dow">{cell.weekday}</span>}
              <span>{cell.date}</span>
            </span>
            <span className={`hr-report-cal-mark hr-report-cal-${cell.kind}`}>{cell.kind === 'practiced' ? <IconSvg name="check" size={GLYPH} color={colors.text.onSecondary} /> : null}</span>
          </li>
        ))}
      </ol>
      <p className="hr-report-calendar-text" data-testid="report-calendar-text">
        {calendar.practiced}
      </p>
      {calendar.notSaved ? <p className="hr-report-calendar-text">{calendar.notSaved}</p> : null}
    </div>
  );
}

/**
 * The All-time growth block (RP-7b; design "All time: the growth block"): a legend with each series' latest value, two
 * cumulative lines that only rise (quests solid, cards dashed; `role="img"` named by the table caption), the months
 * under their points, the since line, then **Show as table** and the table, its required alternative. On paper the
 * table prints in place of the chart, even when it is closed on screen.
 */
export function ReportGrowthBlock({ growth }: { growth: ReportGrowthView }): JSX.Element {
  const [open, setOpen] = useState(false);
  const chart = growthChart(growth.rows);
  const shown = growthAxisShown(growth.rows.length);
  const line = (points: string, color: string, dashed: boolean): JSX.Element => (
    <polyline points={points} fill="none" stroke={color} strokeWidth={GROWTH_LINE} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={dashed ? GROWTH_DASH : undefined} />
  );
  const markers = (points: { x: number; y: number }[], color: string, key: string): JSX.Element[] =>
    points.map((p, index) => <circle key={`${key}-${index}`} cx={p.x} cy={p.y} r={GROWTH_MARKER_R} fill={color} stroke={colors.surface.paper} strokeWidth={GROWTH_LINE} />);
  return (
    <div className="hr-report-growth" data-testid="report-growth">
      <ul className="hr-report-growth-legend" aria-hidden="true">
        <li>
          <span className="hr-report-swatch" />
          {growth.quests} <b>{growth.latest.quests}</b>
        </li>
        <li>
          <span className="hr-report-swatch hr-report-swatch-cards" />
          {growth.cards} <b>{growth.latest.cards}</b>
        </li>
      </ul>
      {growth.rows.length > 0 ? (
        <>
          <svg className="hr-report-growth-chart" viewBox={`0 0 ${GROWTH_BOX.width} ${GROWTH_BOX.height}`} role="img" aria-label={growth.caption} focusable="false" data-testid="report-growth-chart">
            {chart.grid.map((y) => (
              <line key={y} x1={0} x2={GROWTH_BOX.width} y1={y} y2={y} stroke={colors.border.subtle} strokeWidth={borderWidth.thin} />
            ))}
            {line(chart.questsPoints, colors.brand.primary, false)}
            {markers(chart.quests, colors.brand.primary, 'q')}
            {line(chart.cardsPoints, colors.brand.secondary, true)}
            {markers(chart.cards, colors.brand.secondary, 'c')}
          </svg>
          <ol className="hr-report-growth-axis" aria-hidden="true">
            {growth.rows.map((row, index) => (
              <li key={row.m}>{shown[index] ? row.short : null}</li>
            ))}
          </ol>
        </>
      ) : null}
      {growth.since ? <p className="hr-report-muted">{growth.since}</p> : null}
      <button
        type="button"
        className="hr-report-link-button hr-report-actions"
        aria-expanded={open}
        aria-controls={GROWTH_TABLE_ID}
        onClick={() => setOpen(!open)}
        data-testid="report-growth-toggle"
      >
        {open ? growth.hideTable : growth.showTable}
      </button>
      <table className="hr-report-growth-table" id={GROWTH_TABLE_ID} hidden={!open} data-testid="report-growth-table">
        <caption>{growth.caption}</caption>
        <thead>
          <tr>
            <th scope="col">{growth.month}</th>
            <th scope="col">{growth.quests}</th>
            <th scope="col">{growth.cards}</th>
          </tr>
        </thead>
        <tbody>
          {growth.rows.map((row) => (
            <tr key={row.m}>
              <th scope="row">{row.label}</th>
              <td>{row.quests}</td>
              <td>{row.cards}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** This period (layer 2): figure tiles, then the calendar (a week or a month) or the growth block (All time). */
export function ReportThisPeriodBlock({ block, month }: { block: ReportThisPeriod; month: boolean }): JSX.Element | null {
  if (block.figures === null && block.calendar === null && block.growth === null) return null;
  return (
    <section className="hr-report-section" data-testid="report-this-period">
      <h2>{block.heading}</h2>
      {block.figures && block.figures.length > 0 ? (
        <dl className="hr-report-figures">
          {block.figures.map((figure) => (
            <div key={figure.key} className="hr-report-figure" data-testid={`report-figure-${figure.key}`}>
              <dt>{figure.label}</dt>
              <dd className="hr-report-figure-value">{figure.count}</dd>
              {figure.up ? <dd className="hr-report-figure-up">{figure.up}</dd> : null}
            </div>
          ))}
        </dl>
      ) : null}
      {block.calendar ? <CalendarBlock calendar={block.calendar} month={month} /> : null}
      {block.growth ? <ReportGrowthBlock growth={block.growth} /> : null}
    </section>
  );
}

function letterFace(letter: ReportLetter): JSX.Element {
  return (
    <>
      <span lang="ko">{letter.letter}</span>
      {letter.romanization ? <span className="hr-report-rom">{letter.romanization}</span> : null}
    </>
  );
}

/** A More detail letter tile: with Browse links on (RP-13) the tile is the link to its letter. */
function LetterTile({ letter }: { letter: ReportLetter }): JSX.Element {
  const browse = useContext(ReportBrowseContext);
  const target = browse ? browseTargetOf({ kind: 'char', char: letter.letter }) : null;
  return target ? <LinkedLetterTile letter={letter} target={target} env={browse?.env} /> : <li className="hr-report-tile">{letterFace(letter)}</li>;
}

/**
 * The linked tile. Its name reads "letter (romanization)" (`report.letter`), not the face run together. While its
 * line shows, the cell takes the whole row, so the line sits under the tile and the other tiles keep their places.
 */
function LinkedLetterTile({ letter, target, env }: { letter: ReportLetter; target: BrowseTarget; env: BrowseOpenerEnv | undefined }): JSX.Element {
  const opener = useBrowseOpener(target, 'report', env);
  const words = useMessages().report;
  return (
    <li className={opener.notice === null ? undefined : 'hr-report-tile-cell-notice'}>
      <ReportBrowseAnchor target={target} opener={opener} className="hr-report-tile hr-report-tile-link" testId="report-tile-link" ariaLabel={letter.romanization ? words.letter(letter.letter, letter.romanization) : undefined}>
        {letterFace(letter)}
      </ReportBrowseAnchor>
      <BrowseNoticeLine opener={opener} testId="report-tile-link" />
    </li>
  );
}

function DetailBlock({ block }: { block: Exclude<ReportDetailBlock, { kind: 'totals' }> }): JSX.Element {
  return (
    <div className="hr-report-detail-block">
      <h3>{block.heading}</h3>
      {block.kind === 'letters' ? (
        <>
          <ul className="hr-report-tiles">
            {block.letters.map((letter) => (
              <LetterTile key={letter.letter} letter={letter} />
            ))}
          </ul>
          {block.moreLine !== null ? (
            <p className="hr-report-letters-more" data-testid="report-letters-more">
              {block.moreLine}
            </p>
          ) : null}
        </>
      ) : (
        <ul className="hr-report-detail-lines">
          {block.lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** More detail (layer 3): one disclosure button (`aria-expanded`), collapsed; its panel holds an `h3` per block. */
export function ReportMoreDetailBlock({ detail }: { detail: ReportMoreDetail }): JSX.Element {
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
        {detail.blocks.map((block, index) =>
          block.kind === 'totals' ? (
            <p key={`totals-${index}`} className="hr-report-detail-lead">
              {block.line}
            </p>
          ) : (
            <DetailBlock key={`${block.heading}-${index}`} block={block} />
          ),
        )}
      </div>
    </section>
  );
}

/**
 * The headline, the two insight sections, This period and More detail: the report under the controls. `browse` turns
 * the letters, the P4 quest title and the strand tip into All lessons links (RP-13); null or omitted, they are text.
 */
export function ReportBody({ view, browse = null }: { view: LearnerReportView; browse?: ReportBrowse | null }): JSX.Element {
  return (
    <ReportBrowseContext.Provider value={browse}>
      <ReportBodyLayers view={view} />
    </ReportBrowseContext.Provider>
  );
}

function ReportBodyLayers({ view }: { view: LearnerReportView }): JSX.Element {
  const month = view.tabs?.find((tab) => tab.selected)?.period === 'month';
  return (
    <div className="hr-report-body">
      {view.headline || view.wentWell || view.practiceNext ? (
        <div className="hr-report-layer">
          {view.headline ? (
            <div className="hr-report-headline-group">
              <p className="hr-report-headline" data-testid="report-headline">
                {view.headline.text}
              </p>
              {view.headline.horizon ? <p className="hr-report-horizon">{view.headline.horizon}</p> : null}
            </div>
          ) : null}
          {view.wentWell ? <ReportInsights section={view.wentWell} kind="went-well" /> : null}
          {view.practiceNext ? <ReportInsights section={view.practiceNext} kind="practice-next" /> : null}
        </div>
      ) : null}
      {view.thisPeriod ? <ReportThisPeriodBlock block={view.thisPeriod} month={month} /> : null}
      {view.moreDetail ? <ReportMoreDetailBlock detail={view.moreDetail} /> : null}
    </div>
  );
}

/** Three skeleton blocks: the busy panel's content while a report loads. */
export function ReportSkeleton(): JSX.Element {
  return (
    <>
      <div className="hr-report-skeleton" />
      <div className="hr-report-skeleton" />
      <div className="hr-report-skeleton hr-report-skeleton-tall" />
    </>
  );
}
