'use client';

import { borderWidth, colors, radii, spacing, touchTarget, typography } from '@hangul-route/design-system/tokens';
import { useEffect, useRef } from 'react';
import { VISUALLY_HIDDEN, cardShadow } from '../../lib/site-style';

/**
 * The header's language control (AMENDMENTS-SITE-NEWUSER §3.2, SN-D1; wireframe
 * design/wireframes/site/newuser-header-language.md; mock design/screens/site/newuser/mock/<locale>/*.html, shots
 * `header-<locale>-*-lang-open.png`). A native `<details>`: without JavaScript it opens and closes by itself; with it,
 * Escape and a pointer down outside close it and return focus to the summary (`bindLanguageMenu`).
 *
 * The summary holds a decorative globe, the visually hidden word "Language" and the current endonym (with `lang`); the
 * menu is one plain link per shown locale to the same page in that locale, each 64 px tall with `lang` and `hrefLang`,
 * the current one `aria-current="page"`, bold and checked (not colour alone). Endonyms and paths come in as values from
 * the server header (`LOCALE_META`, `sitePath`): this client file imports no dictionary. Below 45em the globe and a
 * small chevron sit over the endonym in one 64 x 64 box; from 45em globe, endonym and chevron sit in a row (from 45em to
 * 60em the endonym is visually hidden, as the brand name is there, so the header keeps one row in Spanish), so each
 * layout has its own chevron (the stylesheet shows one; nothing is reordered). Layout and the breakpoint rules are the
 * `hr-site-lang*` rules of `globals.css`.
 */
export interface LanguageMenuItem {
  href: string;
  endonym: string;
  /** The locale's `htmlLang`: the link's `lang` and `hrefLang`. */
  lang: string;
  current: boolean;
}

export interface LanguageMenuProps {
  /** `landing.footer.language` in the page's locale: the control's hidden word. */
  label: string;
  items: readonly LanguageMenuItem[];
  /** True where no Start pill precedes it on phones (`/`, the legal pages): it takes the auto margin that pushes the controls right. */
  push?: boolean;
}

/** What `bindLanguageMenu` needs of the `<details>` element. */
export interface MenuElement {
  open: boolean;
  contains(node: unknown): boolean;
  querySelector(selector: 'summary'): { focus(options?: FocusOptions): void } | null;
}

/**
 * Closes `menu` on Escape and on a pointer down outside it, and returns focus to its summary. Returns the cleanup.
 * Exported so the node tests can drive it with plain event targets.
 */
export function bindLanguageMenu(menu: MenuElement, doc: EventTarget): () => void {
  const close = (): void => {
    menu.open = false;
    menu.querySelector('summary')?.focus({ preventScroll: true });
  };
  const onKey = (event: Event): void => {
    if (menu.open && (event as KeyboardEvent).key === 'Escape') close();
  };
  const onPointer = (event: Event): void => {
    if (menu.open && !menu.contains(event.target)) close();
  };
  doc.addEventListener('keydown', onKey);
  doc.addEventListener('pointerdown', onPointer);
  return () => {
    doc.removeEventListener('keydown', onKey);
    doc.removeEventListener('pointerdown', onPointer);
  };
}

const ICON = { width: spacing.lg + spacing.xs, height: spacing.lg + spacing.xs } as const;

function Globe(): JSX.Element {
  return (
    <svg {...ICON} viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth={borderWidth.base} />
      <path
        d="M2 10h16M10 2c2.4 2.2 3.6 4.9 3.6 8s-1.2 5.8-3.6 8c-2.4-2.2-3.6-4.9-3.6-8S7.6 4.2 10 2z"
        stroke="currentColor"
        strokeWidth={borderWidth.base}
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Chevron({ className }: { className: string }): JSX.Element {
  return (
    <svg className={className} width={spacing.md + spacing.xxs} height={spacing.md + spacing.xxs} viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
      <path d="M3 6l5 5 5-5" stroke="currentColor" strokeWidth={borderWidth.base} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Check(): JSX.Element {
  return (
    <svg width={spacing.lg + spacing.xxs} height={spacing.lg + spacing.xxs} viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
      <path d="M3 8.5l3.2 3L13 4.5" stroke="currentColor" strokeWidth={borderWidth.base} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LanguageMenu({ label, items, push = false }: LanguageMenuProps): JSX.Element | null {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const menu = ref.current;
    return menu ? bindLanguageMenu(menu, document) : undefined;
  }, []);
  const current = items.find((item) => item.current);
  if (items.length < 2 || !current) return null;
  return (
    <details ref={ref} className={push ? 'hr-site-lang hr-site-lang-push' : 'hr-site-lang'}>
      <summary className="hr-site-lang-summary" style={{ color: colors.text.primary, fontWeight: typography.weight.semibold, borderRadius: radii.sm }}>
        <span className="hr-site-lang-top">
          <Globe />
          <Chevron className="hr-site-lang-chev-phone" />
        </span>
        <span style={VISUALLY_HIDDEN}>{label}</span>{' '}
        <span lang={current.lang} className="hr-site-lang-endonym">
          {current.endonym}
        </span>
        <Chevron className="hr-site-lang-chev-wide" />
      </summary>
      <ul
        role="list"
        className="hr-site-lang-menu"
        style={{
          listStyle: 'none',
          margin: `${spacing.xs}px 0 0`,
          padding: `${spacing.xs}px 0`,
          backgroundColor: colors.surface.paper,
          border: `${borderWidth.thin}px solid ${colors.border.subtle}`,
          borderRadius: radii.lg,
          boxShadow: cardShadow(),
        }}
      >
        {items.map((item) => (
          <li key={item.lang}>
            <a
              href={item.href}
              hrefLang={item.lang}
              lang={item.lang}
              aria-current={item.current ? 'page' : undefined}
              className="hr-site-lang-link"
              style={{
                minHeight: touchTarget.min,
                minWidth: touchTarget.min,
                color: item.current ? colors.text.primary : colors.text.secondary,
                fontWeight: item.current ? typography.weight.bold : typography.weight.regular,
              }}
            >
              <span>{item.endonym}</span>
              {item.current ? <Check /> : null}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}
