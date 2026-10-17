'use client';

import { ACTIVITY_PRESETS, LECTURE_MAX_BLOCKS, type ChooserSelection, type LectureBlock, type RomanizationMode, type UiLocale } from '@hangul-route/content-schema';
import { colors, radii, spacing, typography } from '@hangul-route/design-system/tokens';
import { LOCALE_META, type Messages } from '@hangul-route/i18n';
import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { GroupedLessonPicker } from '@/components/console/GroupedLessonPicker';
import { Button, Muted, Notice, panelStyle } from '@/components/console/ui';
import type { PlanView } from '@/lib/console/api';
import { aboutMinutes, blockMinutes, canAdd, catalogueTitle, moveBlock, quizWarnings, updateBlock, type LectureSource } from '@/lib/console/lecture';
import { applyToOutline, chooserKeys, consoleChooserGroups, outlineSelection } from '@/lib/console/lesson-picker';
import { useLocale, useMessages } from '@/lib/i18n/locale-context';
import { aroundSlot } from '@/lib/i18n/slot';
import { rem } from '@/lib/console/rem';

/**
 * The sections of the lecture setup page (F-TCH-004 §3.11, wireframe
 * `classroom/lecture-presenter.md` screen K), split from the page so their loaded
 * states render in the en-XA dictionary test. Every word comes from `console.lecture`;
 * content titles and taught jamo are data (the jamo marked `lang="ko"`).
 */

type LectureMessages = Messages['console']['lecture'];

const QUIZ_ROUNDS = [3, 5, 8, 10] as const;
const ACTIVITY_MINUTES = [1, 2, 3, 5, 10, 15] as const;

export const lectureH2Style: CSSProperties = { fontSize: rem(typography.size.bodyLg), margin: `0 0 ${spacing.sm}px` };
export const lectureSectionStyle: CSSProperties = { ...panelStyle, marginBottom: spacing.lg };
const fieldsetStyle: CSSProperties = { ...lectureSectionStyle, minWidth: 0 };
const legendStyle: CSSProperties = { fontSize: rem(typography.size.bodyLg), fontWeight: typography.weight.bold, padding: `0 ${spacing.xs}px` };
const rowStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap', padding: `${spacing.xs}px 0` };
// A select draws at the browser's own fixed size unless told: in rem, it follows the chosen text size.
// Never wider than its row: a select is as wide as its longest option, which at a large text size (Largest, or a
// 300 % root at 320) pushes the page sideways (AMENDMENTS-DISPLAY-NAV section 4).
const selectStyle: CSSProperties = { minHeight: spacing.xxxl, padding: spacing.xs, borderRadius: radii.sm, border: `1px solid ${colors.border.strong}`, backgroundColor: colors.surface.paper, color: colors.text.primary, fontSize: rem(typography.size.body), maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' };
const rowButtonStyle: CSSProperties = {
  minWidth: spacing.xxxl,
  minHeight: spacing.xxxl,
  padding: `${spacing.xs}px ${spacing.md}px`,
  borderRadius: radii.pill,
  border: `1px solid ${colors.border.strong}`,
  backgroundColor: colors.surface.paper,
  color: colors.text.primary,
  fontSize: rem(typography.size.bodySm),
  fontWeight: typography.weight.bold,
  cursor: 'pointer',
};
const choiceStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: spacing.xs, marginRight: spacing.lg, minHeight: spacing.xxl };
const blockChoiceStyle: CSSProperties = { ...choiceStyle, display: 'flex' };

/** "Revisit together: ㄱ ㅓ" as one message, the jamo marked Korean. */
function RevisitLine({ l, chars }: { l: LectureMessages; chars: readonly string[] }): JSX.Element {
  const around = aroundSlot(l.source.revisitWith);
  return (
    <span>
      {around.before}
      <span lang="ko">{chars.join(' ')}</span>
      {around.after}
    </span>
  );
}

/** A row's own words: its content title in the console language, or the block's name (for the buttons' accessible names). */
export function blockText(block: LectureBlock, l: LectureMessages, locale?: UiLocale): string {
  const content = catalogueTitle(block, undefined, locale);
  if (content !== null) return content;
  switch (block.kind) {
    case 'revisit':
      return l.source.revisitWith(block.chars.join(' '));
    case 'jamo-set':
      return l.outline.block.letters(block.jamoIds.length);
    case 'cards':
      return l.outline.block.cards(block.cardIds.length);
    case 'quiz':
      return l.outline.block.quiz(block.rounds);
    case 'activity':
      return l.activity[block.preset];
    default:
      return l.outline.block.classCode;
  }
}

export function LectureSourceSection({
  source,
  plan,
  revisit,
  plansFailed,
  omitted,
  onChoose,
  onRetry,
}: {
  source: LectureSource;
  plan: PlanView | null;
  revisit: LectureBlock | null;
  plansFailed: boolean;
  /** Plan items the 30-block cap left out of the outline. */
  omitted: number;
  onChoose: (source: LectureSource) => void;
  onRetry: () => void;
}): JSX.Element {
  const c = useMessages().console;
  const l = c.lecture;
  return (
    <fieldset style={fieldsetStyle}>
      <legend style={legendStyle}>{l.source.title}</legend>
      <label style={blockChoiceStyle}>
        <input type="radio" name="source" checked={source === 'plan'} disabled={!plan} onChange={() => onChoose('plan')} />
        {plan ? l.source.plan(plan.title, plan.items.length) : l.source.noPlan}
      </label>
      <label style={blockChoiceStyle}>
        <input type="radio" name="source" checked={source === 'catalogue'} onChange={() => onChoose('catalogue')} />
        {l.source.catalogue}
      </label>
      <label style={blockChoiceStyle}>
        <input type="radio" name="source" checked={source === 'revisit'} disabled={!revisit} onChange={() => onChoose('revisit')} />
        {revisit && revisit.kind === 'revisit' ? <RevisitLine l={l} chars={revisit.chars} /> : l.source.noRevisit}
      </label>
      {source === 'plan' && omitted > 0 ? <Muted>{l.source.trimmed(omitted, LECTURE_MAX_BLOCKS)}</Muted> : null}
      {plansFailed ? (
        <Notice tone="nudge">
          <p style={{ margin: `0 0 ${spacing.sm}px` }}>{l.plansFailed}</p>
          <Button onClick={onRetry}>{c.tryAgain}</Button>
        </Notice>
      ) : null}
    </fieldset>
  );
}

/**
 * The catalogue (owner report 2026-10-16 item 5, AMENDMENTS-LECTURE-V2 row LV-3): the grouped lesson
 * picker over every ready stage, the stories and the word topics; a press adds or removes outline
 * blocks in place, so quizzes, activities and the class code keep their place.
 */
export function LectureCatalogueSection({ blocks, onChange }: { blocks: readonly LectureBlock[]; onChange: (next: LectureBlock[]) => void }): JSX.Element {
  const l = useMessages().console.lecture;
  const locale = useLocale();
  const groups = useMemo(() => consoleChooserGroups(locale, 'lecture'), [locale]);
  const keys = useMemo(() => chooserKeys(groups), [groups]);
  const pick = (update: (selection: ChooserSelection) => string[]): void => onChange(applyToOutline(blocks, groups, keys, update(outlineSelection(blocks, keys))));
  return (
    <div style={lectureSectionStyle}>
      <GroupedLessonPicker
        groups={groups}
        selection={outlineSelection(blocks, keys)}
        onChange={pick}
        room={LECTURE_MAX_BLOCKS - blocks.length}
        title={l.catalogue.title}
        fullNote={l.outline.full(LECTURE_MAX_BLOCKS)}
        testId="lecture-picker"
      />
    </div>
  );
}

export function LectureOutlineSection({
  blocks,
  codeBlock,
  onChange,
  onAdd,
}: {
  blocks: readonly LectureBlock[];
  /** The class-code block for this space's join code, or null when it has none. */
  codeBlock: LectureBlock | null;
  onChange: (next: LectureBlock[]) => void;
  onAdd: (block: LectureBlock) => void;
}): JSX.Element {
  const l = useMessages().console.lecture;
  const locale = useLocale();
  const room = canAdd(blocks);
  const hasCode = blocks.some((b) => b.kind === 'class-code');
  const warned = new Set(quizWarnings(blocks));

  const label = (block: LectureBlock, index: number): ReactNode => {
    if (block.kind === 'quiz') {
      return (
        <select aria-label={l.outline.quizLength} value={block.rounds} style={selectStyle} onChange={(e) => onChange(updateBlock(blocks, index, { ...block, rounds: Number(e.target.value) }))}>
          {QUIZ_ROUNDS.map((n) => (
            <option key={n} value={n}>
              {l.outline.block.quiz(n)}
            </option>
          ))}
        </select>
      );
    }
    if (block.kind === 'activity') {
      return (
        <>
          <select aria-label={l.outline.activityKind} value={block.preset} style={selectStyle} onChange={(e) => onChange(updateBlock(blocks, index, { ...block, preset: ACTIVITY_PRESETS.find((p) => p === e.target.value) ?? block.preset }))}>
            {ACTIVITY_PRESETS.map((p) => (
              <option key={p} value={p}>
                {l.activity[p]}
              </option>
            ))}
          </select>
          <select aria-label={l.outline.activityLength} value={block.minutes} style={selectStyle} onChange={(e) => onChange(updateBlock(blocks, index, { ...block, minutes: Number(e.target.value) }))}>
            {ACTIVITY_MINUTES.map((n) => (
              <option key={n} value={n}>
                {l.outline.minutes(n)}
              </option>
            ))}
          </select>
        </>
      );
    }
    if (block.kind === 'revisit') return <RevisitLine l={l} chars={block.chars} />;
    return <span>{blockText(block, l, locale)}</span>;
  };

  return (
    <section style={lectureSectionStyle} aria-label={l.outline.title}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing.sm, flexWrap: 'wrap' }}>
        <h2 style={lectureH2Style}>{l.outline.title}</h2>
        <span style={{ color: colors.text.muted }}>{l.outline.about(aboutMinutes(blocks))}</span>
      </div>
      {blocks.length === 0 ? <Muted>{l.outline.empty}</Muted> : null}
      <ol style={{ margin: 0, paddingLeft: spacing.lg }} data-testid="lecture-outline">
        {blocks.map((block, index) => {
          const text = blockText(block, l, locale);
          const first = index === 0;
          const last = index === blocks.length - 1;
          return (
            <li key={`${block.kind}-${index}`} style={{ color: colors.text.secondary }}>
              <div style={rowStyle}>
                <span style={{ display: 'flex', gap: spacing.sm, alignItems: 'center', flexWrap: 'wrap', minWidth: 0 }}>{label(block, index)}</span>
                <span style={{ display: 'flex', gap: spacing.xs, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', marginLeft: 'auto' }}>
                  <span style={{ color: colors.text.muted, fontSize: rem(typography.size.bodySm) }}>{l.outline.minutes(blockMinutes(block))}</span>
                  <button type="button" aria-label={l.outline.upItem(text)} disabled={first} onClick={() => onChange(moveBlock(blocks, index, index - 1))} style={{ ...rowButtonStyle, opacity: first ? 0.5 : 1 }}>
                    {l.outline.upGlyph}
                  </button>
                  <button type="button" aria-label={l.outline.downItem(text)} disabled={last} onClick={() => onChange(moveBlock(blocks, index, index + 1))} style={{ ...rowButtonStyle, opacity: last ? 0.5 : 1 }}>
                    {l.outline.downGlyph}
                  </button>
                  <button type="button" aria-label={l.outline.removeItem(text)} onClick={() => onChange(blocks.filter((_, i) => i !== index))} style={rowButtonStyle}>
                    {l.outline.remove}
                  </button>
                </span>
              </div>
              {warned.has(index) ? (
                <p data-testid="quiz-too-small" style={{ margin: `0 0 ${spacing.xs}px`, padding: spacing.sm, borderRadius: radii.md, backgroundColor: colors.feedback.nudgeLight, color: colors.text.primary, fontSize: rem(typography.size.bodySm) }}>
                  {l.outline.quizTooSmall}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
      {!room ? <Muted>{l.outline.full(LECTURE_MAX_BLOCKS)}</Muted> : null}
      <div style={{ display: 'flex', gap: spacing.sm, marginTop: spacing.md, flexWrap: 'wrap' }}>
        <Button disabled={!room} onClick={() => onAdd({ kind: 'quiz', from: 'previous', rounds: 5 })}>
          {l.outline.addQuiz.cta}
        </Button>
        <Button disabled={!room} onClick={() => onAdd({ kind: 'activity', preset: 'say-together', minutes: 3 })}>
          {l.outline.addActivity.cta}
        </Button>
        {codeBlock ? (
          <Button disabled={hasCode || !room} onClick={() => onAdd(codeBlock)}>
            {l.outline.addClassCode.cta}
          </Button>
        ) : null}
      </div>
    </section>
  );
}

/** The Slides language select's default option: no language in the deck. */
const SAME_AS_DEVICE = '';

/**
 * The hint under the Slides language select follows the choice (AMENDMENTS-LECTURE-V2 section
 * 18.4): with Same as this device the deck carries no language, so a copied link opens in the
 * language of the device that opens it; with a chosen language the deck carries it, so the slides
 * show in it on every device. The chosen endonym is marked with its own language.
 */
function SlidesLanguageHint({ l, uiLocale }: { l: LectureMessages; uiLocale: UiLocale | null }): JSX.Element {
  if (uiLocale === null) return <span data-testid="lecture-slides-language-hint">{l.options.languageHint}</span>;
  const around = aroundSlot(l.options.languageHintChosen);
  const meta = LOCALE_META[uiLocale];
  return (
    <span data-testid="lecture-slides-language-hint">
      {around.before}
      <span lang={meta.htmlLang}>{meta.endonym}</span>
      {around.after}
    </span>
  );
}

export interface LectureOptionValues {
  romanization: RomanizationMode;
  strokeGuide: boolean;
  sound: boolean;
  /**
   * The slides' language in the deck; null = "Same as this device" (the default): the deck carries no
   * language and the presenter speaks the presenting device's (owner items 6 and 7).
   */
  uiLocale: UiLocale | null;
}

export function LectureOptionsSection({
  value,
  available,
  onChange,
}: {
  value: LectureOptionValues;
  /** The locales that have shipped; the Slides language select shows only when there is a choice. */
  available: readonly UiLocale[];
  onChange: (next: LectureOptionValues) => void;
}): JSX.Element {
  const l = useMessages().console.lecture;
  return (
    <section style={lectureSectionStyle} aria-label={l.options.title}>
      <h2 style={lectureH2Style}>{l.options.title}</h2>
      <fieldset style={{ border: 'none', margin: 0, padding: 0, minWidth: 0 }}>
        <legend style={{ padding: 0, marginBottom: spacing.xs }}>{l.options.romanization}</legend>
        <label style={choiceStyle}>
          <input type="radio" name="romanization" checked={value.romanization === 'always'} onChange={() => onChange({ ...value, romanization: 'always' })} />
          {l.options.romanizationAlways}
        </label>
        <label style={choiceStyle}>
          <input type="radio" name="romanization" checked={value.romanization === 'tap'} onChange={() => onChange({ ...value, romanization: 'tap' })} />
          {l.options.romanizationTap}
        </label>
      </fieldset>
      <label style={blockChoiceStyle}>
        <input type="checkbox" checked={value.strokeGuide} onChange={(e) => onChange({ ...value, strokeGuide: e.target.checked })} />
        {l.options.strokeGuide}
      </label>
      <Muted>{l.options.strokeNote}</Muted>
      <label style={blockChoiceStyle}>
        <input type="checkbox" checked={value.sound} onChange={(e) => onChange({ ...value, sound: e.target.checked })} />
        {l.options.sound}
      </label>
      {available.length > 1 ? (
        <>
          <label style={blockChoiceStyle}>
            <span>{l.options.language}</span>
            <select
              value={value.uiLocale ?? SAME_AS_DEVICE}
              style={selectStyle}
              data-testid="lecture-slides-language"
              onChange={(e) => onChange({ ...value, uiLocale: available.find((a) => a === e.target.value) ?? null })}
            >
              <option value={SAME_AS_DEVICE}>{l.options.languageSame}</option>
              {available.map((option) => (
                <option key={option} value={option} lang={LOCALE_META[option].htmlLang}>
                  {LOCALE_META[option].endonym}
                </option>
              ))}
            </select>
          </label>
          <Muted>
            <SlidesLanguageHint l={l} uiLocale={value.uiLocale} />
          </Muted>
        </>
      ) : null}
    </section>
  );
}
