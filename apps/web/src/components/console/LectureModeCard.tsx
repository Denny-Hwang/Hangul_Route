'use client';

import type { AdultPersona } from '@hangul-route/content-schema';
import { borderWidth, colors, layout, radii, spacing, touchTarget, typography } from '@hangul-route/design-system/tokens';
import Link from 'next/link';
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { LECTURE_CARD_ID, type LectureCardView } from '@/lib/console/lecture-entry';
import { headRem, rem } from '@/lib/console/rem';
import { useConsole } from './use-console';

/**
 * The Lecture mode card on the teacher home and the family home (AMENDMENTS-LECTURE-V2 section 3, E1 and E2, row
 * LV-5; mock design/screens/app-shell/lecture-card.md, `mock/lecture-card-states.html`). Title, the line "Teach on a
 * big screen", one body line for a class or a family, then **Start lecture mode**:
 * - one space: its lecture setup page (presets first);
 * - several: "Which class?" / "Which family?" radio rows by space name, most recent first, the first chosen;
 * - none (or the spaces list failed): the no-space line, and Start opens the presenter in a new tab with no opener,
 *   described as "Opens in a new tab";
 * - loading: the words at once and Start as "Loading…" with `aria-busy`, so nothing jumps.
 * No badge, no count, never drawn disabled except while loading; the page passes `view` null while
 * `lectureModeEnabled()` is off, and nothing is drawn. The section is `#lecture-mode`, the nav item's target with zero
 * or several spaces: on load with that fragment (or when the frame moves to it on this page) the card scrolls into
 * view and its heading takes focus.
 */

const WIDE = `${layout.maxWidth.reading / 16}em`;

/** Rules that change at a breakpoint or style a state (inline styles would beat them); every value is a token. */
const CARD_CSS = `
.hr-lm{display:flex;flex-direction:column;gap:${spacing.sm}px;box-sizing:border-box;min-width:0;padding:${spacing.lg}px;border-radius:${radii.lg}px;background:${colors.brand.secondaryLight};border:${borderWidth.base}px solid ${colors.brand.secondary};color:${colors.text.primary};overflow-wrap:anywhere}
.hr-lm-title{margin:0;font-size:${headRem(typography.size.title)};line-height:${typography.leading.tight};font-weight:${typography.weight.bold}}
.hr-lm-tag{margin:0;font-size:${rem(typography.size.bodyLg)};font-weight:${typography.weight.semibold}}
.hr-lm-body{margin:0;font-size:${rem(typography.size.body)};line-height:${typography.leading.normal}}
.hr-lm-choices{display:flex;flex-direction:column;gap:${spacing.xs}px;min-width:0;margin:0;padding:0;border:none}
.hr-lm-choices legend{padding:0;margin-bottom:${spacing.xs}px;font-size:${rem(typography.size.body)};font-weight:${typography.weight.bold}}
.hr-lm-choice{display:flex;align-items:center;gap:${spacing.md}px;box-sizing:border-box;min-height:${touchTarget.min}px;padding:${spacing.sm}px ${spacing.md}px;border-radius:${radii.md}px;border:${borderWidth.thin}px solid ${colors.border.strong};background:${colors.surface.paper};font-size:${rem(typography.size.body)};font-weight:${typography.weight.semibold};cursor:pointer}
.hr-lm-choice.hr-lm-on{border:${borderWidth.thick}px solid ${colors.text.primary}}
.hr-lm-choice input{flex:none;width:${spacing.xl}px;height:${spacing.xl}px;margin:0;accent-color:${colors.text.primary}}
.hr-lm-cta{display:inline-flex;align-items:center;justify-content:center;align-self:stretch;box-sizing:border-box;min-height:${touchTarget.hero}px;padding:${spacing.sm}px ${spacing.xl}px;border-radius:${radii.pill}px;border:${borderWidth.thin}px solid ${colors.brand.primary};background:${colors.brand.primary};color:${colors.text.onPrimary};font-size:${rem(typography.size.bodyLg)};font-weight:${typography.weight.bold};line-height:${typography.leading.tight};text-align:center;text-decoration:none;cursor:pointer}
.hr-lm-cta[disabled]{background:${colors.surface.sunken};border-color:${colors.surface.sunken};color:${colors.text.muted};cursor:default}
.hr-lm-hidden{position:absolute;width:${borderWidth.thin}px;height:${borderWidth.thin}px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
@media (min-width:${WIDE}){.hr-lm-cta{align-self:flex-start;padding-left:${spacing.xxl}px;padding-right:${spacing.xxl}px}}
`;

/** Whether the window is at least `minWidth` wide (a CSS length), following resizes; false before the browser answers. */
export function useMinWidth(minWidth: string): boolean {
  const query = `(min-width: ${minWidth})`;
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => undefined;
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => (typeof window !== 'undefined' && !!window.matchMedia ? window.matchMedia(query).matches : false),
    () => false,
  );
}

export function LectureModeCard({
  view,
  persona,
  revealReady = true,
}: {
  /** What the card draws; null while `lectureModeEnabled()` is off (nothing is drawn). */
  view: LectureCardView | null;
  /** Teacher reads the class words, Family the family words. */
  persona: AdultPersona;
  /** False while the card's place on the page can still move (the family home's first roster loading): the reveal waits. */
  revealReady?: boolean;
}): JSX.Element | null {
  const { m } = useConsole();
  const [chosen, setChosen] = useState<string | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const uid = useId();
  const settled = !!view && view.state !== 'loading' && revealReady;

  // `#lecture-mode` (the nav item with zero or several spaces): once the card has its place, bring it into view and
  // focus its heading; again whenever the fragment is set while the page is open.
  useEffect(() => {
    if (!settled || typeof window === 'undefined') return undefined;
    const reveal = (): void => {
      if (window.location.hash !== `#${LECTURE_CARD_ID}`) return;
      headingRef.current?.focus({ preventScroll: true });
      sectionRef.current?.scrollIntoView({ block: 'start' });
    };
    reveal();
    window.addEventListener('hashchange', reveal);
    return () => window.removeEventListener('hashchange', reveal);
  }, [settled]);

  if (!view) return null;
  const c = m.console.lecture.card;
  const family = persona === 'parent';
  const headingId = `${uid}-title`;
  const noteId = `${uid}-tab`;
  const choice = view.state === 'several' ? (view.choices.find((entry) => entry.id === chosen) ?? view.choices[0] ?? null) : null;

  let start: JSX.Element;
  if (view.state === 'loading') {
    start = (
      <button type="button" className="hr-lm-cta" disabled aria-busy="true" data-testid="lecture-card-start">
        {m.console.space.loading}
      </button>
    );
  } else if (view.state === 'none') {
    // The presenter is another root of the app origin: a new tab with no opener, as the setup page opens it (LV-4).
    start = (
      <>
        <a className="hr-lm-cta" href={view.href} target="_blank" rel="noopener noreferrer" aria-describedby={noteId} data-testid="lecture-card-start">
          {c.cta}
        </a>
        <span id={noteId} className="hr-lm-hidden">
          {c.opensTab}
        </span>
      </>
    );
  } else {
    start = (
      <Link className="hr-lm-cta" href={view.state === 'one' ? view.href : (choice?.href ?? '')} data-testid="lecture-card-start">
        {c.cta}
      </Link>
    );
  }

  return (
    <section ref={sectionRef} id={LECTURE_CARD_ID} aria-labelledby={headingId} className="hr-lm" data-testid="lecture-card" data-state={view.state}>
      <style>{CARD_CSS}</style>
      <h2 id={headingId} ref={headingRef} tabIndex={-1} className="hr-lm-title">
        {c.title}
      </h2>
      <p className="hr-lm-tag">{c.tagline}</p>
      <p className="hr-lm-body">{family ? c.bodyFamily : c.bodyClass}</p>
      {view.state === 'none' ? (
        <p className="hr-lm-body" data-testid="lecture-card-no-space">
          {family ? c.noSpaceFamily : c.noSpace}
        </p>
      ) : null}
      {view.state === 'several' ? (
        <fieldset className="hr-lm-choices" data-testid="lecture-card-choices">
          <legend>{family ? c.chooseFamily : c.chooseClass}</legend>
          {view.choices.map((entry) => {
            const on = entry.id === choice?.id;
            return (
              <label key={entry.id} className={on ? 'hr-lm-choice hr-lm-on' : 'hr-lm-choice'}>
                <input type="radio" name={`${uid}-space`} value={entry.id} checked={on} onChange={() => setChosen(entry.id)} data-testid={`lecture-card-choice-${entry.id}`} />
                <span>{entry.name}</span>
              </label>
            );
          })}
        </fieldset>
      ) : null}
      {start}
    </section>
  );
}
