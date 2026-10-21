'use client';

import { SITE_ORIGIN, type AdultPersona, type DeviceUses } from '@hangul-route/content-schema';
import { IconSvg } from '@hangul-route/design-system/icon-glyphs/dom';
import { borderWidth, colors, layout, radii, spacing, touchTarget, typography } from '@hangul-route/design-system/tokens';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import type { ConsoleApi, SpaceListItem } from '@/lib/console/api';
import { consoleFlashText, takeConsoleFlash, type ConsoleFlash } from '@/lib/console/console-flash';
import { learnerHome } from '@/lib/console/grown-up-lock';
import { deviceUsesOf } from '@/lib/console/one-account';
import { activePersona, fallbackPersona, heldPersonas, homeToRecord, pageArea, personaHome, showPersonaSwitch } from '@/lib/console/personas';
import { ROUTES } from '@/lib/console/routing';
import { readLastPersona, writeDeviceUses, writeLastPersona } from '@/lib/console/shell-store';
import { currentNavItem, navFlags, navItemsFor, revealScrollLeft, samePageFragment, soloFamilyLearnerSpace, type NavEntry, type SoloLearner } from '@/lib/console/shell-nav';
import { clearGrownUpTab } from '@/lib/console/unlock';
import { browserStorage, type KeyValueStorage } from '@/lib/i18n/safe-storage';
import { useConsoleAuth } from './auth-context';
import { BrowseNoticeLine, useBrowseOpener } from './BrowseLink';
import { useGrownUpLocation } from './grown-up-location';
import { DisplayButton } from './DisplaySheet';
import { PAGE_BACK_CSS, PageBack, type PageBackLink } from './PageBack';
import { PinCards, browserPinCardsEnvironment, type PinCardsEnvironment } from './PinCards';
import { useConsole } from './use-console';
import { rem } from '@/lib/console/rem';

/**
 * The adult frame of every grown-up page (F-APP-001 A-5a, section 3.8; design mock
 * design/screens/app-shell/adult-frame.md, wireframe design/wireframes/shell/adult-frame.md).
 * Replaces `ConsoleShell`: no "Back to site", no disabled Account button, no "Console" title.
 *
 * - Header: the brand mark (to the active persona's home; from 45em, below it the nav's first item is
 *   the persona home), the persona switch for an account that holds both personas (otherwise the
 *   persona name), then at the right the Aa button (the Display sheet: the device's one language and
 *   text size, owner items 6 and 7), Sign out from 45em (it sits in the footer below it), and last the
 *   **Learner app** exit (AMENDMENTS-DISPLAY-NAV section 7.3): it leaves the grown-up pages, so it is
 *   never a Back and never takes the top left, which belongs to PageBack. The row wraps at any text
 *   size (a 300 % root at 320) instead of scrolling: the right group moves down, still at the right.
 * - Content: a page that is not a persona home or a nav target passes `back`, drawn as PageBack at
 *   the top left, above the page's context line and its h1.
 * - The active persona comes from the page: its own on a home, the kind of the page's space on a
 *   space page under either prefix (looked up in the spaces list the frame reads), never the path.
 * - The navigation is `ADULT_NAV` filtered by the active persona and the sibling predicates. When the tab row scrolls
 *   sideways it shows its current item on load (AMENDMENTS-LECTURE-V2 E3, LV-5), moving the row only. An item whose
 *   target is a part of the page already open (Lecture mode's `/parent#lecture-mode` on `/parent`) moves there itself:
 *   the fragment is set and the page's card takes focus. A tab keeps its label on one line (it is never narrower than
 *   that line, `min-width: fit-content`) unless the label is wider than the whole row (Lecture mode at a 300 % root
 *   at 320); then it wraps inside its tab instead of pushing the page sideways.
 * - Footer: About Hangul Route, Privacy and Terms on the site.
 * - [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS (row OA-3): on a persona home the frame writes the account's grown-up uses
 *   (`hr-shell` `deviceUses`, `{ v: 1, uses, at }`, from the spaces list it holds; no name, email or id) and draws the
 *   PIN cards above the page (`PinCards`); the Learner app exit opens the learner app's chooser (`who=1`, OA-D12).
 * The frame refreshes nothing itself: `GrownUpLock` keeps the unlock fresh (A-4a review).
 */

/** Everything the frame touches in the browser, injectable for tests. */
export interface AdultFrameEnvironment {
  location: () => { origin: string; pathname: string; search: string };
  readLastPersona: () => Promise<AdultPersona | null>;
  writeLastPersona: (persona: AdultPersona) => void;
  clearGrownUpTab: () => void;
  assign: (url: string) => void;
  /** The tab's `sessionStorage`, where the Lessons item writes the All lessons pass (F-BROWSE-001 BR-10). */
  sessionStorage?: () => KeyValueStorage | null;
  now?: () => number;
  /** Sets a fragment of the page already open (a nav target such as `/parent#lecture-mode`) and lets the page answer it. */
  showFragment?: (href: string) => void;
  /** [OA] Section 7.1: writes `deviceUses` (shell store). Absent, nothing is written. */
  writeDeviceUses?: (record: DeviceUses) => void;
  /** [OA] The persona-home PIN cards' environment. Absent, the cards are not drawn. */
  pinCards?: PinCardsEnvironment;
}

export function browserFrameEnvironment(): AdultFrameEnvironment {
  const win = typeof window === 'undefined' ? null : window;
  return {
    location: () => ({ origin: win?.location.origin ?? '', pathname: win?.location.pathname ?? '', search: win?.location.search ?? '' }),
    readLastPersona: () => readLastPersona(),
    writeLastPersona: (persona) => {
      void writeLastPersona(persona);
    },
    clearGrownUpTab: () => clearGrownUpTab(),
    assign: (url) => win?.location.assign(url),
    sessionStorage: () => browserStorage('session'),
    now: () => Date.now(),
    showFragment: (href) => {
      if (!win) return;
      // The router's own history entry stays (its state is kept); `hashchange` reaches the page even when the fragment
      // was already set, so a second click moves to the card again.
      win.history.replaceState(win.history.state, '', href);
      win.dispatchEvent(new HashChangeEvent('hashchange'));
    },
    writeDeviceUses: (record) => {
      void writeDeviceUses(record);
    },
    pinCards: win ? browserPinCardsEnvironment() : undefined,
  };
}

/** The spaces list a page already holds: loading (null), loaded, or failed. Omitted, the frame reads it itself. */
export type FrameSpaces = readonly SpaceListItem[] | null | 'failed';

/** The one learner of a one-learner family, read once per tab (memory only) for the Reports item. */
const soloLearners = new Map<string, Promise<string | null>>();

function readSoloLearner(api: ConsoleApi, spaceId: string): Promise<string | null> {
  let pending = soloLearners.get(spaceId);
  if (!pending) {
    pending = api.roster(spaceId).then(
      (result) => (result.ok && result.data.learners.length === 1 ? (result.data.learners[0]?.id ?? null) : null),
      () => null,
    );
    soloLearners.set(spaceId, pending);
  }
  return pending;
}

/** Test hook: forget the per-tab roster reads. */
export function resetFrameMemory(): void {
  soloLearners.clear();
}

/** The phone / wide switch (45em = `layout.maxWidth.reading`) and the step where the brand name joins (70em = `layout.maxWidth.full`). */
const WIDE = `${layout.maxWidth.reading / 16}em`;
const FULL = `${layout.maxWidth.full / 16}em`;

/** Layout rules that change at a breakpoint live here (inline styles would beat them); every value is a token. */
const FRAME_CSS = `
.hr-frame{min-height:100vh;display:flex;flex-direction:column;background:${colors.surface.canvas};color:${colors.text.primary}}
.hr-frame-top{background:${colors.surface.paper};border-bottom:${borderWidth.thin}px solid ${colors.border.subtle}}
.hr-frame-bar,.hr-frame-nav,.hr-frame-main,.hr-frame-foot-inner{box-sizing:border-box;width:100%;max-width:${layout.maxWidth.full}px;margin:0 auto;padding-left:${layout.gutter.compact}px;padding-right:${layout.gutter.compact}px}
.hr-frame-bar{padding-top:${spacing.sm}px;padding-bottom:${spacing.sm}px;display:flex;flex-wrap:wrap;align-items:center;column-gap:${spacing.sm}px;row-gap:${spacing.xs}px}
.hr-frame-brand{display:inline-flex;align-items:center;gap:${spacing.sm}px;min-height:${touchTarget.min}px;min-width:${touchTarget.min}px;text-decoration:none;font-size:${rem(typography.size.bodyLg)};font-weight:${typography.weight.bold};color:${colors.text.primary}}
.hr-frame-mark{width:${spacing.xxxl}px;height:${spacing.xxxl}px;border-radius:${radii.circle}px;background:${colors.brand.primary};color:${colors.text.inverse};display:inline-flex;align-items:center;justify-content:center;font-size:${rem(typography.size.bodyLg)};font-weight:${typography.weight.bold};flex:none}
.hr-frame-name,.hr-frame-hidden{position:absolute;width:${borderWidth.thin}px;height:${borderWidth.thin}px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.hr-frame-brand{display:none}
.hr-frame-bar.hr-no-nav .hr-frame-brand{display:inline-flex}
.hr-frame-persona{display:inline-flex;align-items:center;min-height:${touchTarget.min}px;color:${colors.text.secondary};font-weight:${typography.weight.semibold}}
.hr-frame-switch{display:inline-flex;border:${borderWidth.base}px solid ${colors.brand.secondaryDark};border-radius:${radii.pill}px;background:${colors.surface.paper};overflow:hidden}
.hr-frame-switch [role="radio"]{min-height:${touchTarget.min}px;min-width:${touchTarget.min}px;padding:${spacing.xs}px ${spacing.sm}px;border:none;background:transparent;color:${colors.brand.secondaryDark};font-size:${rem(typography.size.bodySm)};font-weight:${typography.weight.bold};cursor:pointer}
.hr-frame-switch [role="radio"][aria-checked="true"]{background:${colors.brand.secondaryDark};color:${colors.text.onSecondary}}
.hr-frame-end{margin-left:auto;display:inline-flex;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:${spacing.sm}px;min-width:0;max-width:100%}
.hr-frame-exit{display:inline-flex;align-items:center;gap:${spacing.xs}px;min-height:${touchTarget.min}px;min-width:0;max-width:100%;box-sizing:border-box;padding:${spacing.xs}px ${spacing.sm}px ${spacing.xs}px ${spacing.md}px;border-radius:${radii.pill}px;border:${borderWidth.thin}px solid ${colors.border.strong};background:${colors.surface.paper};color:${colors.text.primary};font-size:${rem(typography.size.bodySm)};font-weight:${typography.weight.bold};line-height:${typography.leading.tight};text-align:left;overflow-wrap:anywhere;cursor:pointer}
.hr-frame-exit svg{flex:none}
.hr-frame-wide{display:none}
.hr-frame-list{display:flex;flex-wrap:wrap;list-style:none;margin:0;padding:0}
.hr-frame-list li{flex:1 0 ${touchTarget.min}px;display:flex;min-width:fit-content;max-width:100%}
.hr-frame-item{flex:1;display:inline-flex;align-items:center;justify-content:center;min-height:${touchTarget.min}px;padding:0 ${spacing.xs}px;border:none;border-bottom:${borderWidth.thick}px solid transparent;background:transparent;color:${colors.text.secondary};font-size:${rem(typography.size.bodySm)};font-weight:${typography.weight.semibold};text-align:center;text-decoration:none;overflow-wrap:anywhere;cursor:pointer}
.hr-frame-item[aria-current="page"]{color:${colors.text.primary};font-weight:${typography.weight.bold};border-bottom-color:${colors.brand.primary}}
.hr-frame-main{flex:1;padding-top:${spacing.lg}px;padding-bottom:${spacing.xxl}px;overflow-wrap:anywhere}
.hr-frame-foot{background:${colors.surface.sunken}}
.hr-frame-foot-inner{padding-top:${spacing.sm}px;padding-bottom:${spacing.lg}px;display:flex;flex-direction:column;gap:${spacing.xs}px}
.hr-frame-links{display:flex;flex-wrap:wrap;column-gap:${spacing.lg}px}
.hr-frame-links a{display:inline-flex;align-items:center;justify-content:center;min-height:${touchTarget.min}px;min-width:${touchTarget.min}px;color:${colors.text.secondary};text-decoration:underline;text-underline-offset:${spacing.xs}px}
.hr-frame-tools{display:flex;flex-wrap:wrap;align-items:center;gap:${spacing.sm}px}
.hr-frame :focus-visible{outline:${borderWidth.thick}px solid ${colors.border.focus};outline-offset:${spacing.xxs}px}
@media (min-width:${WIDE}){
.hr-frame-bar,.hr-frame-nav,.hr-frame-main,.hr-frame-foot-inner{padding-left:${layout.gutter.regular}px;padding-right:${layout.gutter.regular}px}
.hr-frame-bar{column-gap:${spacing.md}px}
.hr-frame-brand{display:inline-flex}
.hr-frame-wide{display:inline-flex}
.hr-frame-exit{padding-left:${spacing.lg}px;padding-right:${spacing.md}px}
.hr-frame-switch [role="radio"]{padding-left:${spacing.md}px;padding-right:${spacing.md}px}
.hr-frame-list{gap:${spacing.xs}px}
.hr-frame-list li{flex:none}
.hr-frame-item{padding:0 ${spacing.md}px}
.hr-frame-tools{display:none}
}
${PAGE_BACK_CSS}
@media (min-width:${FULL}){
.hr-frame-bar,.hr-frame-nav,.hr-frame-main,.hr-frame-foot-inner{padding-left:${layout.gutter.wide}px;padding-right:${layout.gutter.wide}px}
.hr-frame-name{position:static;width:auto;height:auto;overflow:visible;clip-path:none}
}`;

const quietButton = {
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: touchTarget.min,
  padding: `${spacing.sm}px ${spacing.md}px ${spacing.sm}px ${spacing.sm}px`,
  borderRadius: radii.pill,
  border: `${borderWidth.thin}px solid transparent`,
  backgroundColor: 'transparent',
  color: colors.text.secondary,
  fontSize: rem(typography.size.bodySm),
  fontWeight: typography.weight.bold,
  cursor: 'pointer',
} as const;

const footButton = {
  ...quietButton,
  padding: `${spacing.sm}px ${spacing.lg}px`,
  border: `${borderWidth.thin}px solid ${colors.border.strong}`,
  backgroundColor: colors.surface.paper,
  color: colors.text.primary,
} as const;

const PERSONAS: readonly AdultPersona[] = ['parent', 'teacher'];

/** The persona switch (section 3.16): a radiogroup with manual activation. Arrows move focus only; Space, Enter or a click commits. */
function PersonaSwitch({ checked, label, names, onChoose }: { checked: AdultPersona | null; label: string; names: Record<AdultPersona, string>; onChoose: (persona: AdultPersona) => void }): JSX.Element {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const [focus, setFocus] = useState(Math.max(0, checked ? PERSONAS.indexOf(checked) : 0));
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number): void => {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = (index + step + PERSONAS.length) % PERSONAS.length;
    setFocus(next);
    refs.current[next]?.focus();
  };
  return (
    <div className="hr-frame-switch" role="radiogroup" aria-label={label} data-testid="persona-switch">
      {PERSONAS.map((persona, index) => (
        <button
          key={persona}
          ref={(node) => {
            refs.current[index] = node;
          }}
          type="button"
          role="radio"
          aria-checked={checked === persona}
          tabIndex={index === focus ? 0 : -1}
          onKeyDown={(event) => onKeyDown(event, index)}
          onFocus={() => setFocus(index)}
          onClick={() => onChoose(persona)}
          data-testid={`persona-${persona}`}
        >
          {names[persona]}
        </button>
      ))}
    </div>
  );
}

/**
 * [SA] AMENDMENTS-SEATS-ADMINS section 6.6 step 7: the one-shot done note above the page's title (mock board 19): "You're
 * an administrator of …" after an accept, "You're no longer an administrator of …" after Stop. Taken from this tab's
 * flash on the page's first render; the check glyph is decoration.
 */
function FlashNote({ here }: { here: string }): JSX.Element | null {
  const { locale } = useConsole();
  const [flash] = useState<ConsoleFlash | null>(() => takeConsoleFlash(here));
  if (!flash) return null;
  return (
    <p
      role="status"
      data-testid="console-flash"
      style={{ display: 'flex', alignItems: 'flex-start', gap: spacing.sm, margin: `0 0 ${spacing.md}px`, padding: `${spacing.md}px ${spacing.lg}px`, borderRadius: radii.md, backgroundColor: colors.feedback.successLight, color: colors.text.primary, overflowWrap: 'anywhere' }}
    >
      <span aria-hidden="true" style={{ flex: 'none', display: 'inline-flex', marginTop: spacing.xxs }}>
        <IconSvg name="check" size={spacing.lg + spacing.xs} color={colors.feedback.successDark} />
      </span>
      <span>{consoleFlashText(flash, locale)}</span>
    </p>
  );
}

export function AdultFrame({
  children,
  title,
  back,
  onSignOut,
  spaces,
  env,
}: {
  children: ReactNode;
  /** The page's context line (a space or a page name), shown at the top of the content. */
  title?: string;
  /** PageBack: the page above, for a page that is not a persona home or a nav target (AMENDMENTS-DISPLAY-NAV 7.3). */
  back?: PageBackLink;
  onSignOut?: () => void;
  /** The spaces list the page already reads (the teacher home); omitted, the frame reads it. */
  spaces?: FrameSpaces;
  env?: AdultFrameEnvironment;
}): JSX.Element {
  const { api, m, locale, signOut } = useConsole();
  const auth = useConsoleAuth();
  const router = useRouter();
  const [browser] = useState<AdultFrameEnvironment>(() => env ?? browserFrameEnvironment());
  const [ownSpaces, setOwnSpaces] = useState<FrameSpaces>(null);
  const [last, setLast] = useState<AdultPersona | null>(null);
  const [solo, setSolo] = useState<SoloLearner | null>(null);
  // Lessons (F-BROWSE-001 BR-10, section 4.3): a plain click writes the tab's pass, then opens All lessons here.
  const lessons = useBrowseOpener(undefined, 'nav', {
    origin: () => browser.location().origin,
    now: () => (browser.now ?? Date.now)(),
    storage: () => (browser.sessionStorage ? browser.sessionStorage() : browserStorage('session')),
    assign: (url) => browser.assign(url),
  });

  const fetchOwn = spaces === undefined;
  useEffect(() => {
    if (!fetchOwn) return undefined;
    if (!api) {
      setOwnSpaces('failed');
      return undefined;
    }
    let live = true;
    void api.listSpaces().then(
      (result) => live && setOwnSpaces(result.ok ? result.data : 'failed'),
      () => live && setOwnSpaces('failed'),
    );
    return () => {
      live = false;
    };
  }, [api, fetchOwn]);

  useEffect(() => {
    let live = true;
    browser.readLastPersona().then(
      (persona) => live && setLast(persona),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [browser]);

  const state: FrameSpaces = fetchOwn ? ownSpaces : spaces;
  const list = Array.isArray(state) ? (state as readonly SpaceListItem[]) : null;
  const failed = state === 'failed';
  // The router's committed path and query when the page sits in `GrownUpGate`; the browser's otherwise.
  const routed = useGrownUpLocation();
  const where = browser.location();
  const origin = where.origin;
  const pathname = routed ? routed.pathname : where.pathname;
  const search = routed ? routed.search : where.search;
  const area = pageArea(pathname, search);
  const active = activePersona({ area, spaces: list, last });
  const held = heldPersonas(list);
  const flags = navFlags(locale, undefined, origin);
  const soloSpace = flags.reports && list ? soloFamilyLearnerSpace(list) : null;
  const toRecord = homeToRecord(area, active, held);

  useEffect(() => {
    if (toRecord) browser.writeLastPersona(toRecord);
  }, [toRecord, browser]);

  // [OA] Section 7.1: every persona home that renders with the spaces list writes the account's uses (no names).
  const onHome = area.kind === 'home';
  useEffect(() => {
    if (!onHome || !list || !browser.writeDeviceUses) return;
    browser.writeDeviceUses(deviceUsesOf(list, (browser.now ?? Date.now)()));
  }, [onHome, list, browser]);

  useEffect(() => {
    if (!soloSpace || !api) {
      setSolo(null);
      return undefined;
    }
    let live = true;
    void readSoloLearner(api, soloSpace).then((learnerId) => live && setSolo(learnerId ? { spaceId: soloSpace, learnerId } : null));
    return () => {
      live = false;
    };
  }, [api, soloSpace]);

  const shell = m.console.shell;
  const names: Record<AdultPersona, string> = { parent: shell.persona.parent, teacher: shell.persona.teacher };
  const navPersona = list ? active.persona : fallbackPersona(last, null);
  const items: NavEntry[] = failed ? [] : navItemsFor({ persona: navPersona, spaces: list ?? [], soloLearner: solo, flags });
  const current = list ? currentNavItem(pathname, active.persona, active.resolved, flags.lecture) : currentNavItem(pathname, navPersona, false, flags.lecture);
  const withSwitch = !!list && showPersonaSwitch(held);
  const rowRef = useRef<HTMLUListElement | null>(null);
  const currentShown = items.some((entry) => entry.id === current);
  // A tab row that scrolls sideways shows its current item (the family row's fifth and sixth items start off-screen
  // on a phone): only the row moves, never the page, with no smooth motion.
  useEffect(() => {
    const row = rowRef.current;
    const item = row?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!row || !item || row.scrollWidth <= row.clientWidth) return;
    const rowBox = row.getBoundingClientRect();
    const itemBox = item.getBoundingClientRect();
    const left = revealScrollLeft({ scrollLeft: row.scrollLeft, width: row.clientWidth }, { left: itemBox.left - rowBox.left + row.scrollLeft, width: itemBox.width });
    if (left !== null) row.scrollLeft = left;
  }, [current, currentShown]);
  // A target inside the page already open: set its fragment here instead of a client navigation that would only scroll.
  const toFragment = (entry: NavEntry) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (samePageFragment(entry.target.href, pathname) === null || !browser.showFragment) return;
    event.preventDefault();
    browser.showFragment(entry.target.href);
  };
  const brandHref = list && held.length > 0 ? personaHome(active.persona) : ROUTES.signIn;
  const doSignOut = (): void => {
    // The per-tab roster read belongs to this account: the next one to sign in here reads its own.
    resetFrameMemory();
    (onSignOut ?? signOut)();
  };

  const choose = (persona: AdultPersona): void => {
    if (active.resolved && persona === active.persona) return;
    browser.writeLastPersona(persona);
    router.push(personaHome(persona));
  };
  // The Learner app exit: clears the grown-up unlock and the console session, then opens the learner app with the
  // device's language (section 6) at its chooser ([OA] `who=1`, OA-D12; the label stays Learner app).
  const toLearnerApp = (): void => {
    browser.clearGrownUpTab();
    browser.assign(learnerHome(origin, locale, { who: true }));
  };

  return (
    <div className="hr-frame" data-testid="adult-frame">
      <style>{FRAME_CSS}</style>
      <header className="hr-frame-top">
        {/* Below 45em the nav's first item is the persona home and the brand hides; with no nav (a failed spaces read) the brand stays. */}
        <div className={['hr-frame-bar', withSwitch ? 'hr-has-switch' : null, items.length === 0 ? 'hr-no-nav' : null].filter(Boolean).join(' ')}>
          <Link className="hr-frame-brand" href={brandHref} data-testid="frame-brand">
            <span className="hr-frame-mark" aria-hidden="true">
              {m.landing.brand.mark}
            </span>
            <span className="hr-frame-name">{m.landing.brand.name}</span>
          </Link>
          {withSwitch ? (
            <PersonaSwitch checked={active.resolved ? active.persona : null} label={m.a11y.shell.personaSwitch} names={names} onChoose={choose} />
          ) : list && held.length > 0 ? (
            <span className="hr-frame-persona" data-testid="frame-persona">
              {names[active.persona]}
            </span>
          ) : null}
          <div className="hr-frame-end">
            <DisplayButton testId="frame-display" />
            <button type="button" className="hr-frame-wide" style={quietButton} onClick={doSignOut} data-testid="frame-sign-out">
              {shell.signOut.cta}
            </button>
            <button type="button" className="hr-frame-exit" onClick={toLearnerApp} data-testid="frame-learner-app">
              <span>{shell.backToLearning}</span>
              <IconSvg name="arrow-right" size={spacing.lg + spacing.xs} color={colors.text.primary} />
            </button>
          </div>
        </div>
        {items.length > 0 ? (
          <nav className="hr-frame-nav" aria-label={names[navPersona]} data-testid="frame-nav">
            <ul className="hr-frame-list" ref={rowRef}>
              {items.map((entry) => (
                <li key={entry.id}>
                  {entry.target.document ? (
                    <a className="hr-frame-item" href={entry.target.href} onClick={entry.id === 'lessons' ? lessons.onClick : undefined} aria-busy={entry.id === 'lessons' && lessons.checking ? true : undefined} data-testid={`nav-${entry.id}`}>
                      {shell.nav[entry.labelKey]}
                    </a>
                  ) : (
                    <Link
                      className="hr-frame-item"
                      href={entry.target.href}
                      onClick={entry.id === 'lecture' ? toFragment(entry) : undefined}
                      aria-current={current === entry.id ? 'page' : undefined}
                      data-testid={`nav-${entry.id}`}
                    >
                      {shell.nav[entry.labelKey]}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
            {items.some((entry) => entry.id === 'lessons') ? <BrowseNoticeLine opener={lessons} testId="frame-lessons" /> : null}
          </nav>
        ) : null}
      </header>
      <main className="hr-frame-main">
        {back ? <PageBack href={back.href} label={back.label} /> : null}
        {onHome && browser.pinCards ? (
          <PinCards
            accountId={auth.session?.accountId ?? null}
            accountLabel={auth.session?.email ?? auth.session?.displayName ?? null}
            home={pathname}
            reverifySecret={auth.reverifySecret}
            env={browser.pinCards}
          />
        ) : null}
        <FlashNote here={`${pathname}${search ? (search.startsWith('?') ? search : `?${search}`) : ''}`} />
        {title ? (
          <p data-testid="frame-title" style={{ margin: `0 0 ${spacing.md}px`, color: colors.text.secondary, fontWeight: typography.weight.semibold }}>
            {title}
          </p>
        ) : null}
        {children}
      </main>
      <footer className="hr-frame-foot">
        <div className="hr-frame-foot-inner">
          <div className="hr-frame-links">
            <a href={SITE_ORIGIN}>{shell.aboutSite}</a>
            <a href={`${SITE_ORIGIN}/privacy`}>{shell.privacy}</a>
            <a href={`${SITE_ORIGIN}/terms`}>{shell.terms}</a>
          </div>
          <div className="hr-frame-tools" data-testid="frame-foot-tools">
            <button type="button" style={footButton} onClick={doSignOut} data-testid="frame-foot-sign-out">
              {shell.signOut.cta}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
