'use client';

import { TEXT_SIZES, type TextSize } from '@hangul-route/content-schema';
import { TEXT_SIZE_FACTORS, typeScale } from '@hangul-route/design-system/text-size';
import { borderWidth, colors, layout, radii, shadows, spacing, touchTarget, typography, z } from '@hangul-route/design-system/tokens';
import { LOCALE_META, type UiLocale } from '@hangul-route/i18n';
import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { useConsoleLocale } from '@/lib/i18n/locale-context';
import { rem } from '@/lib/console/rem';

/**
 * The Display (Aa) sheet of the grown-up pages (owner items 6 and 7; the DOM twin of the design
 * system's `DisplaySheet`): the device's one UI language and text size, the same record the
 * learner app, All lessons and the presenter read. The Aa button opens it from the adult frame
 * header (every width), `/signin` and the grown-up lock. A modal sheet (a bottom sheet on phones,
 * a centred dialog from 45em): Language (endonyms, each in its own `lang`; hidden with one
 * language) with a one-tap way back after a change, Text size (four steps, each drawing its Aa),
 * a live sample line, the note and Done. Escape, the scrim and Done close it; focus returns to
 * the Aa button. Sizes are in rem, so the chosen text size (`--hr-text-scale` on `<html>`) grows
 * the sheet itself live; each segment's Aa is drawn in px at its own step, a fixed preview. Not behind the grown-up gate (display only, reversible).
 */

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';
const alphaHex = Math.round(shadows.modal.shadowOpacity * 255)
  .toString(16)
  .padStart(2, '0');
const MODAL_SHADOW = `0 ${shadows.modal.shadowOffset.height}px ${shadows.modal.shadowRadius}px ${shadows.modal.shadowColor}${alphaHex}`;

const SHEET_CSS = `
.hr-display-scrim{position:fixed;inset:0;background:${colors.surface.overlay}}
.hr-display-sheet{position:fixed;left:0;right:0;bottom:0;max-height:90vh;overflow-y:auto;box-sizing:border-box;background:${colors.surface.paper};color:${colors.text.primary};border-radius:${radii.xl}px ${radii.xl}px 0 0;padding:${rem(spacing.lg)} ${layout.gutter.compact}px ${rem(spacing.xl)};box-shadow:${MODAL_SHADOW};text-align:left}
.hr-display-sheet h2{margin:0;font-size:${rem(typography.size.prompt)};font-weight:${typography.weight.bold};line-height:${typography.leading.tight};outline:none}
.hr-display-label{margin:${rem(spacing.md)} 0 ${rem(spacing.xs)};font-size:${rem(typography.size.body)};font-weight:${typography.weight.bold}}
.hr-display-row{display:flex;flex-wrap:wrap;gap:${rem(spacing.xs)}}
.hr-display-option{flex:1 1 auto;min-width:${touchTarget.min}px;min-height:${touchTarget.min}px;box-sizing:border-box;display:inline-flex;flex-direction:column;align-items:center;justify-content:center;gap:${rem(spacing.xxs)};padding:${rem(spacing.xs)} ${rem(spacing.sm)};border-radius:${radii.lg}px;border:${borderWidth.base}px solid ${colors.border.strong};background:${colors.surface.paper};color:${colors.text.primary};font-size:${rem(typography.size.bodySm)};font-weight:${typography.weight.semibold};line-height:${typography.leading.tight};cursor:pointer;overflow-wrap:break-word}
.hr-display-steps .hr-display-option{flex-basis:45%}
.hr-display-option[aria-checked="true"]{background:${colors.brand.primary};border-color:${colors.brand.primary};color:${colors.text.onPrimary}}
.hr-display-glyph{font-weight:${typography.weight.bold};line-height:${typography.leading.tight}}
.hr-display-sample{margin-top:${rem(spacing.sm)};padding:${rem(spacing.md)};border-radius:${radii.md}px;background:${colors.surface.sunken};font-size:${rem(typography.size.bodyLg)};line-height:${typography.leading.normal}}
.hr-display-note{margin:${rem(spacing.md)} 0 0;color:${colors.text.secondary};font-size:${rem(typography.size.body)};line-height:${typography.leading.normal}}
.hr-display-button{display:inline-flex;align-items:center;justify-content:center;min-height:${touchTarget.min}px;min-width:${touchTarget.min}px;box-sizing:border-box;padding:${rem(spacing.xs)} ${rem(spacing.lg)};border-radius:${radii.pill}px;font-size:${rem(typography.size.body)};font-weight:${typography.weight.bold};cursor:pointer}
.hr-display-done{width:100%;margin-top:${rem(spacing.lg)};border:none;background:${colors.brand.primary};color:${colors.text.onPrimary}}
.hr-display-undo{width:100%;margin-top:${rem(spacing.sm)};border:${borderWidth.base}px solid ${colors.brand.primary};background:transparent;color:${colors.brand.primary}}
.hr-display-sheet :focus-visible{outline:${borderWidth.thick}px solid ${colors.border.focus};outline-offset:${borderWidth.base}px}
@media (min-width:45em){.hr-display-steps .hr-display-option{flex-basis:0}.hr-display-sheet{left:50%;right:auto;bottom:auto;top:50%;transform:translate(-50%,-50%);width:calc(100% - ${2 * layout.gutter.regular}px);max-width:${rem(touchTarget.min * 8)};border-radius:${radii.xl}px;padding:${rem(spacing.xl)} ${rem(spacing.xxl)}}}`;

interface FocusTarget {
  focus?: (options?: { preventScroll?: boolean }) => void;
  querySelectorAll?: (selector: string) => ArrayLike<FocusTarget>;
}

function RadioRow<T extends string>({
  label,
  options,
  selected,
  onSelect,
  testId,
  render,
  steps = false,
}: {
  /** Text size: two per row on a phone, four equal columns from 45em; languages size to their endonym. */
  steps?: boolean;
  label: string;
  options: readonly { value: T; label: string; lang?: string }[];
  selected: T;
  onSelect: (value: T) => void;
  testId: string;
  render: (option: { value: T; label: string; lang?: string }) => JSX.Element;
}): JSX.Element {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const index = Math.max(0, options.findIndex((o) => o.value === selected));
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, at: number): void => {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = (at + step + options.length) % options.length;
    const option = options[next];
    if (option) onSelect(option.value);
    refs.current[next]?.focus();
  };
  return (
    <div className={steps ? 'hr-display-row hr-display-steps' : 'hr-display-row'} role="radiogroup" aria-label={label} data-testid={testId}>
      {options.map((option, at) => (
        <button
          key={option.value}
          ref={(node) => {
            refs.current[at] = node;
          }}
          type="button"
          role="radio"
          className="hr-display-option"
          aria-checked={option.value === selected}
          aria-label={option.label}
          lang={option.lang}
          tabIndex={at === index ? 0 : -1}
          onKeyDown={(event) => onKeyDown(event, at)}
          onClick={() => onSelect(option.value)}
          data-testid={`${testId}-${option.value}`}
        >
          {render(option)}
        </button>
      ))}
    </div>
  );
}

export function ConsoleDisplaySheet({ onClose }: { onClose: () => void }): JSX.Element {
  const { locale, available, messages, setLocale, textSize, setTextSize } = useConsoleLocale();
  const d = messages.common.display;
  const headingId = useId();
  const sheetRef = useRef<FocusTarget | null>(null);
  const headingRef = useRef<FocusTarget | null>(null);
  const [previous, setPrevious] = useState<UiLocale | null>(null);

  useEffect(() => {
    const opener = typeof document === 'undefined' ? null : (document.activeElement as FocusTarget | null);
    headingRef.current?.focus?.({ preventScroll: true });
    return () => {
      opener?.focus?.();
    };
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const items = sheetRef.current?.querySelectorAll?.(FOCUSABLE);
    if (!items || items.length === 0 || typeof document === 'undefined') return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement as FocusTarget | null;
    if (event.shiftKey && (active === first || active === headingRef.current)) {
      event.preventDefault();
      last?.focus?.();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first?.focus?.();
    }
  };

  const chooseLanguage = (next: UiLocale): void => {
    if (next === locale) return;
    setPrevious(locale);
    setLocale(next);
  };

  const languages = available.map((l) => ({ value: l, label: LOCALE_META[l].endonym, lang: LOCALE_META[l].htmlLang }));
  const sizes = TEXT_SIZES.map((step) => ({ value: step, label: d.sizes[step] }));

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: z.modal }} data-testid="console-display">
      <style>{SHEET_CSS}</style>
      <div className="hr-display-scrim" aria-hidden onClick={onClose} data-testid="console-display-scrim" />
      <div
        ref={(el) => {
          sheetRef.current = el as FocusTarget | null;
        }}
        className="hr-display-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        onKeyDown={onKeyDown}
        data-testid="console-display-sheet"
      >
        <h2
          id={headingId}
          tabIndex={-1}
          ref={(el) => {
            headingRef.current = el as FocusTarget | null;
          }}
        >
          {d.title}
        </h2>
        {languages.length > 1 ? (
          <>
            <p className="hr-display-label">{d.language}</p>
            <RadioRow label={d.language} options={languages} selected={locale} onSelect={chooseLanguage} testId="console-display-language" render={(o) => <span>{o.label}</span>} />
            {previous !== null && previous !== locale ? (
              <button
                type="button"
                className="hr-display-button hr-display-undo"
                onClick={() => {
                  setLocale(previous);
                  setPrevious(null);
                }}
                data-testid="console-display-language-undo"
              >
                {d.back(LOCALE_META[previous].endonym)}
              </button>
            ) : null}
          </>
        ) : null}
        <p className="hr-display-label">{d.textSize}</p>
        <RadioRow<TextSize>
          label={d.textSize}
          options={sizes}
          selected={textSize}
          onSelect={setTextSize}
          testId="console-display-text-size"
          steps
          render={(o) => (
            <>
              <span className="hr-display-glyph" aria-hidden="true" style={{ fontSize: `${typeScale(TEXT_SIZE_FACTORS[o.value]).size.body}px` }}>
                {d.glyph}
              </span>
              <span>{o.label}</span>
            </>
          )}
        />
        <p className="hr-display-sample" aria-live="polite" data-testid="console-display-sample">
          {d.sample}
        </p>
        <p className="hr-display-note">{d.note}</p>
        <button type="button" className="hr-display-button hr-display-done" onClick={onClose} data-testid="console-display-done">
          {d.done.cta}
        </button>
      </div>
    </div>
  );
}

/** The Aa pill: one touch target, the sign in rem (so it grows with the chosen size), a strong outline. */
const aaStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: 'none',
  minHeight: touchTarget.min,
  minWidth: touchTarget.min,
  boxSizing: 'border-box',
  padding: `0 ${rem(spacing.md)}`,
  borderRadius: radii.pill,
  border: `${borderWidth.base}px solid ${colors.border.strong}`,
  backgroundColor: colors.surface.paper,
  color: colors.text.primary,
  fontSize: rem(typography.size.bodyLg),
  fontWeight: typography.weight.bold,
  cursor: 'pointer',
};

/** The Aa button: draws the sign, named "Display" for a screen reader; opens the sheet. */
export function DisplayButton({ testId = 'console-display-open' }: { testId?: string }): JSX.Element {
  const { messages } = useConsoleLocale();
  const [open, setOpen] = useState(false);
  const d = messages.common.display;
  return (
    <>
      <button type="button" style={aaStyle} aria-label={d.open} aria-haspopup="dialog" onClick={() => setOpen(true)} data-testid={testId}>
        <span aria-hidden="true">{d.glyph}</span>
      </button>
      {open ? <ConsoleDisplaySheet onClose={() => setOpen(false)} /> : null}
    </>
  );
}
