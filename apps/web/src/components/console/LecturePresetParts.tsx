'use client';

import { PRESET_LENGTHS, type LectureBlock, type LecturePreset, type PresetMinutes, type StageKey } from '@hangul-route/content-schema';
import { IconSvg } from '@hangul-route/design-system/icon-glyphs/dom';
import { borderWidth, colors, radii, shadows, spacing, touchTarget, typography } from '@hangul-route/design-system/tokens';
import type { Messages } from '@hangul-route/i18n';
import type { ReactNode } from 'react';
import { RevisitLine, blockText } from '@/components/console/LectureParts';
import { aboutMinutes, blockMinutes } from '@/lib/console/lecture';
import { presetCardWords } from '@/lib/console/lecture-presets';
import { useLocale, useMessages } from '@/lib/i18n/locale-context';
import { rem } from '@/lib/console/rem';

/**
 * The lecture setup page's ready-made lessons and its Customize disclosure (AMENDMENTS-LECTURE-V2 sections 4.1, 4.6,
 * 6 and 10, row LV-4; wireframe `classroom/lecture-presets.md` Panel F; mock `design/screens/app-shell/lecture-setup.md`).
 *
 * - **Ready-made lessons**: the presets as cards in the order the page passes (section 4.1), one column below 45em
 *   and two from 45em. Each card is one disclosure button (`aria-expanded`, `aria-controls` naming its panel, no
 *   `aria-pressed`), named "{title}, about {n} minutes"; one card is open at a time and spans its row with a
 *   `borderWidth.thick` outline. Its panel holds the fallback line, the stage chips (Stage by stage), the length chips
 *   (none for the warm-up) and **What's in this lesson**: the outline, read-only, with its about-minutes.
 * - **Customize**: a disclosure (`plus` / `dash`) with its lead; the page's own sections go inside.
 *
 * The page mounts `PRESETS_CSS` once. Every word comes from `console.lecture` (the card's accessible name is the presenter's `a11y.presenter.presetCard`,
 * the same words); content titles are data and taught jamo are marked `lang="ko"`.
 */

const px = (value: number): string => `${value}px`;
const focusRing = `outline:${px(borderWidth.thick)} solid ${colors.border.focus};outline-offset:${px(borderWidth.base)}`;
const alpha = Math.round(shadows.card.shadowOpacity * 255)
  .toString(16)
  .padStart(2, '0');
const CARD_SHADOW = `0 ${px(shadows.card.shadowOffset.height)} ${px(shadows.card.shadowRadius)} ${shadows.card.shadowColor}${alpha}`;

export const PRESETS_CSS = `
.hr-lp{display:flex;flex-direction:column;gap:${rem(spacing.md)};margin:${rem(spacing.xl)} 0;min-width:0;color:${colors.text.primary};font-size:${rem(typography.size.body)};line-height:${typography.leading.normal}}
.hr-lp h2{margin:0;font-size:${rem(typography.size.prompt)};line-height:${typography.leading.tight};font-weight:${typography.weight.bold}}
.hr-lp p{margin:0}
.hr-lp-lead{color:${colors.text.secondary}}
.hr-lp-cards{display:grid;grid-template-columns:minmax(0,1fr);gap:${rem(spacing.md)};list-style:none;margin:0;padding:0}
@media (min-width:45em){.hr-lp-cards{grid-template-columns:repeat(2,minmax(0,1fr))}}
.hr-lp-card{display:flex;flex-direction:column;min-width:0;background:${colors.surface.paper};border:${px(borderWidth.thin)} solid ${colors.border.subtle};border-radius:${px(radii.lg)};box-shadow:${CARD_SHADOW}}
.hr-lp-card[data-open="true"]{grid-column:1 / -1;border:${px(borderWidth.thick)} solid ${colors.text.primary};box-shadow:none}
.hr-lp-btn{display:flex;flex-direction:column;align-items:stretch;gap:${rem(spacing.xs)};box-sizing:border-box;width:100%;min-height:${px(touchTarget.min)};padding:${rem(spacing.lg)};background:transparent;border:none;border-radius:${px(radii.lg)};color:${colors.text.primary};font:inherit;text-align:start;cursor:pointer}
.hr-lp-btn:focus-visible{${focusRing}}
.hr-lp-title{font-size:${rem(typography.size.bodyLg)};font-weight:${typography.weight.bold};line-height:${typography.leading.tight};overflow-wrap:anywhere}
.hr-lp-line{color:${colors.text.secondary};overflow-wrap:anywhere}
.hr-lp-meta{display:flex;align-items:center;justify-content:space-between;gap:${rem(spacing.sm)};margin-top:auto;padding-top:${rem(spacing.xs)};color:${colors.text.secondary};font-weight:${typography.weight.semibold}}
.hr-lp-meta svg{flex:none}
.hr-lp-panel{display:flex;flex-direction:column;gap:${rem(spacing.lg)};padding:0 ${rem(spacing.lg)} ${rem(spacing.lg)}}
.hr-lp-panel[hidden]{display:none}
.hr-lp-fallback{padding:${rem(spacing.sm)} ${rem(spacing.md)};border-radius:${px(radii.md)};background:${colors.surface.sunken};color:${colors.text.primary}}
.hr-lp-chips{display:flex;flex-wrap:wrap;gap:${rem(spacing.sm)};min-width:0;margin:0;padding:0;border:none}
.hr-lp-chips legend{padding:0;margin:0 0 ${rem(spacing.xs)};font-weight:${typography.weight.bold}}
.hr-lp-chip{display:inline-flex;align-items:center;gap:${rem(spacing.xs)};min-height:${px(touchTarget.min)};padding:0 ${rem(spacing.md)};border-radius:${px(radii.pill)};border:${px(borderWidth.thin)} solid ${colors.border.strong};background:${colors.surface.paper};font-weight:${typography.weight.semibold};cursor:pointer}
.hr-lp-chip:has(input:checked){border:${px(borderWidth.thick)} solid ${colors.text.primary};font-weight:${typography.weight.bold}}
.hr-lp-chip:has(input:focus-visible){${focusRing}}
.hr-lp-chip input{width:${px(spacing.xl)};height:${px(spacing.xl)};margin:0;flex:none;accent-color:${colors.text.primary}}
.hr-lp-sub{display:flex;flex-direction:column;gap:${rem(spacing.xs)};min-width:0}
.hr-lp-head{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;column-gap:${rem(spacing.md)}}
.hr-lp-head h3{margin:0;font-size:${rem(typography.size.body)};font-weight:${typography.weight.bold}}
.hr-lp-head span{color:${colors.text.secondary}}
.hr-lp-list{display:flex;flex-direction:column;margin:0;padding:0;list-style:none;border-top:${px(borderWidth.thin)} solid ${colors.border.subtle}}
.hr-lp-list li{display:flex;flex-wrap:wrap;justify-content:space-between;column-gap:${rem(spacing.md)};padding:${rem(spacing.sm)} 0;border-bottom:${px(borderWidth.thin)} solid ${colors.border.subtle}}
.hr-lp-list li > span:first-child{font-weight:${typography.weight.bold};overflow-wrap:anywhere;min-width:0}
.hr-lp-list li > span:last-child{color:${colors.text.secondary}}
.hr-lp-skel{min-height:${rem(spacing.xxxl * 2)};border-radius:${px(radii.lg)};background:${colors.surface.sunken}}
.hr-lp-customize{display:flex;flex-direction:column;gap:${rem(spacing.sm)};margin-bottom:${rem(spacing.lg)};min-width:0}
.hr-lp-disclosure{display:inline-flex;align-self:flex-start;align-items:center;gap:${rem(spacing.xs)};min-height:${px(touchTarget.min)};padding:0 ${rem(spacing.lg)};border-radius:${px(radii.pill)};border:${px(borderWidth.thin)} solid ${colors.border.strong};background:${colors.surface.paper};color:${colors.text.primary};font:inherit;font-weight:${typography.weight.bold};cursor:pointer}
.hr-lp-disclosure:focus-visible{${focusRing}}
.hr-lp-disclosure svg{flex:none}
.hr-lp-customize-body{display:flex;flex-direction:column;min-width:0}
.hr-lp-customize-body[hidden]{display:none}
.hr-lp-foot{position:sticky;bottom:0;z-index:1;display:flex;flex-wrap:wrap;align-items:center;gap:${rem(spacing.sm)};margin-top:${rem(spacing.md)};padding-top:${rem(spacing.sm)};padding-bottom:max(${rem(spacing.sm)}, env(safe-area-inset-bottom));border-top:${px(borderWidth.thin)} solid ${colors.border.subtle};background:${colors.surface.canvas}}
.hr-lp-foot-sum{flex:1 1 100%;color:${colors.text.secondary};font-size:${rem(typography.size.body)}}
.hr-lp-foot-btn{flex:0 1 auto;display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;min-height:${px(touchTarget.hero)};padding:${rem(spacing.sm)} ${rem(spacing.md)};border-radius:${px(radii.pill)};border:${px(borderWidth.thin)} solid ${colors.border.strong};background:${colors.surface.paper};color:${colors.text.primary};font:inherit;font-size:${rem(typography.size.body)};font-weight:${typography.weight.bold};text-align:center;overflow-wrap:anywhere;cursor:pointer}
.hr-lp-foot-btn:focus-visible{${focusRing}}
.hr-lp-foot-btn:disabled{opacity:0.5;cursor:default}
.hr-lp-foot-btn[data-tone="primary"]{flex:1 1 auto;background:${colors.brand.primary};border-color:${colors.brand.primary};color:${colors.text.onPrimary}}
@media (min-width:45em){.hr-lp-foot-sum{flex:1 1 auto}.hr-lp-foot-btn{flex:none;padding:${rem(spacing.sm)} ${rem(spacing.xl)}}.hr-lp-foot-btn[data-tone="primary"]{flex:none;padding:${rem(spacing.sm)} ${rem(spacing.xxl)};font-size:${rem(typography.size.bodyLg)}}}
`;

type LectureWords = Messages['console']['lecture'];

/** One read-only row of What's in this lesson: the block's own words (jamo marked Korean) and its minutes. */
function PreviewRow({ block, l, family }: { block: LectureBlock; l: LectureWords; family: boolean }): JSX.Element {
  const locale = useLocale();
  return (
    <li>
      <span>{block.kind === 'revisit' ? <RevisitLine l={l} chars={block.chars} /> : blockText(block, l, locale, family)}</span>
      <span>{l.outline.minutes(blockMinutes(block))}</span>
    </li>
  );
}

function Chips<T extends string | number>({ legend, options, value, name, label, onChange, testId }: { legend: string; options: readonly T[]; value: T; name: string; label: (option: T) => string; onChange: (option: T) => void; testId: string }): JSX.Element {
  return (
    <fieldset className="hr-lp-chips" data-testid={testId}>
      <legend>{legend}</legend>
      {options.map((option) => (
        <label key={String(option)} className="hr-lp-chip">
          <input type="radio" name={name} checked={option === value} onChange={() => onChange(option)} data-testid={`${testId}-${option}`} />
          {label(option)}
        </label>
      ))}
    </fieldset>
  );
}

export interface LecturePresetsProps {
  /** The cards in display order (`consolePresetOrder`). */
  order: readonly LecturePreset[];
  open: LecturePreset | null;
  /** The length each card builds (`presetMinutes`). */
  minutesOf: (preset: LecturePreset) => PresetMinutes;
  /** Stage by stage's chip and the stages it offers. */
  stage: StageKey;
  stages: readonly StageKey[];
  /** The open card's fallback line, or null. */
  fallback: string | null;
  /** This week's plan title, for Next lesson's line; null with no plan this week. */
  planTitle: string | null;
  family: boolean;
  /** What the open card holds: the page's outline. */
  outline: readonly LectureBlock[];
  onToggle: (preset: LecturePreset) => void;
  onMinutes: (preset: LecturePreset, minutes: PresetMinutes) => void;
  onStage: (stage: StageKey) => void;
}

const stageNumber = (stage: StageKey): number => Number(stage.slice('stage'.length));

export function LecturePresetsSection({ order, open, minutesOf, stage, stages, fallback, planTitle, family, outline, onToggle, onMinutes, onStage }: LecturePresetsProps): JSX.Element {
  const m = useMessages();
  const l = m.console.lecture;
  const p = l.presets;
  return (
    <section className="hr-lp" aria-labelledby="lecture-presets-title" data-testid="lecture-presets">
      <h2 id="lecture-presets-title">{p.title}</h2>
      <p className="hr-lp-lead">{p.lead}</p>
      <ul className="hr-lp-cards">
        {order.map((preset) => {
          const isOpen = open === preset;
          const minutes = minutesOf(preset);
          const words = presetCardWords(preset, p, { planTitle, family });
          const panelId = `lecture-preset-panel-${preset}`;
          const lengths = PRESET_LENGTHS[preset];
          return (
            <li key={preset} className="hr-lp-card" data-open={isOpen} data-testid={`lecture-preset-card-${preset}`}>
              <button
                type="button"
                className="hr-lp-btn"
                aria-expanded={isOpen}
                aria-controls={panelId}
                aria-label={m.a11y.presenter.presetCard(words.title, minutes)}
                onClick={() => onToggle(preset)}
                data-testid={`lecture-preset-${preset}`}
              >
                <span className="hr-lp-title">{words.title}</span>
                <span className="hr-lp-line">{words.line}</span>
                <span className="hr-lp-meta">
                  <span>{l.outline.about(minutes)}</span>
                  <IconSvg name="arrow-right" size={spacing.xl} color={colors.text.secondary} />
                </span>
              </button>
              <div id={panelId} className="hr-lp-panel" hidden={!isOpen} data-testid={panelId}>
                {isOpen ? (
                  <>
                    {fallback !== null ? (
                      <p className="hr-lp-fallback" data-testid={`lecture-preset-fallback-${preset}`}>
                        {fallback}
                      </p>
                    ) : null}
                    {preset === 'by-stage' ? (
                      <Chips legend={p.stage.choose} options={stages} value={stage} name="lecture-preset-stage" label={(s) => p.stage.chip(stageNumber(s))} onChange={onStage} testId="lecture-preset-stage" />
                    ) : null}
                    {lengths.length > 1 ? (
                      <Chips
                        legend={p.length.title}
                        options={lengths}
                        value={minutes}
                        name={`lecture-preset-length-${preset}`}
                        label={(n) => p.length.option(n)}
                        onChange={(n) => onMinutes(preset, n)}
                        testId={`lecture-preset-length-${preset}`}
                      />
                    ) : null}
                    <div className="hr-lp-sub">
                      <div className="hr-lp-head">
                        <h3 id={`${panelId}-list`}>{p.preview.title}</h3>
                        <span data-testid="lecture-preset-minutes">{l.outline.about(aboutMinutes(outline))}</span>
                      </div>
                      <ul className="hr-lp-list" aria-labelledby={`${panelId}-list`} data-testid="lecture-preset-preview">
                        {outline.map((block, i) => (
                          <PreviewRow key={`${block.kind}-${i}`} block={block} l={l} family={family} />
                        ))}
                      </ul>
                    </div>
                  </>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** The cards while the roster and plans load: the heading and lead at once, six placeholders, nothing to press (`aria-busy`). */
export function LecturePresetsLoading({ loadingLine }: { loadingLine: string }): JSX.Element {
  const p = useMessages().console.lecture.presets;
  return (
    <section className="hr-lp" aria-labelledby="lecture-presets-title" aria-busy="true" data-testid="lecture-presets-loading">
      <h2 id="lecture-presets-title">{p.title}</h2>
      <p className="hr-lp-lead">{p.lead}</p>
      <p className="hr-lp-lead" role="status">
        {loadingLine}
      </p>
      <ul className="hr-lp-cards" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className="hr-lp-skel" />
        ))}
      </ul>
    </section>
  );
}

/** Customize (section 4.6): never needed; its lead says so. The page's Source, chooser, Outline, Options, title and checks go inside. */
export function LectureCustomize({ open, onToggle, children }: { open: boolean; onToggle: () => void; children: ReactNode }): JSX.Element {
  const p = useMessages().console.lecture.presets;
  return (
    <section className="hr-lp-customize" data-testid="lecture-customize">
      <button type="button" className="hr-lp-disclosure" aria-expanded={open} aria-controls="lecture-customize-body" onClick={onToggle} data-testid="lecture-customize-toggle">
        <IconSvg name={open ? 'dash' : 'plus'} size={spacing.lg} color={colors.text.primary} />
        <span>{p.customize.cta}</span>
      </button>
      <p className="hr-lp-lead">{p.customize.lead}</p>
      <div id="lecture-customize-body" className="hr-lp-customize-body" hidden={!open} data-testid="lecture-customize-body">
        {open ? children : null}
      </div>
    </section>
  );
}
