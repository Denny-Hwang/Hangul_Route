'use client';

import { SITE_ORIGIN, type AdultPersona } from '@hangul-route/content-schema';
import { IconSvg } from '@hangul-route/design-system/icon-glyphs/dom';
import { borderWidth, colors, layout, radii, spacing, touchTarget, typography } from '@hangul-route/design-system/tokens';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { ConsoleApi, SpaceListItem } from '@/lib/console/api';
import { readDeviceGate } from '@/lib/console/device-marker';
import { learnerHome, type DeviceGateRead } from '@/lib/console/grown-up-lock';
import { FAMILY_HOME_LIVE, activePersona, fallbackPersona, heldPersonas, homeToRecord, pageArea, personaHome, showPersonaSwitch } from '@/lib/console/personas';
import { ROUTES } from '@/lib/console/routing';
import { readLastPersona, writeLastPersona } from '@/lib/console/shell-store';
import { currentNavItem, navFlags, navItemsFor, soloFamilyLearnerSpace, type NavEntry, type SoloLearner } from '@/lib/console/shell-nav';
import { clearGrownUpTab } from '@/lib/console/unlock';
import { LanguageSelect } from './LanguageSelect';
import { useConsole } from './use-console';

/**
 * The adult frame of every grown-up page (F-APP-001 A-5a, section 3.8; design mock
 * design/screens/app-shell/adult-frame.md, wireframe design/wireframes/shell/adult-frame.md).
 * Replaces `ConsoleShell`: no "Back to site", no disabled Account button, no "Console" title.
 *
 * - Header: the brand mark (to the active persona's home), the persona switch for an account that
 *   holds both personas (otherwise the persona name), the way back to the learner app; Language and
 *   Sign out from 45em (they sit in the footer below it, so the phone header is one row).
 * - The active persona comes from the page: its own on a home, the kind of the page's space on a
 *   space page under either prefix (looked up in the spaces list the frame reads), never the path.
 * - The navigation is `ADULT_NAV` filtered by the active persona and the sibling predicates.
 * - Footer: About Hangul Route, Privacy and Terms on the site.
 * The frame refreshes nothing itself: `GrownUpLock` keeps the unlock fresh (A-4a review).
 */

/** Everything the frame touches in the browser, injectable for tests. */
export interface AdultFrameEnvironment {
  location: () => { origin: string; pathname: string; search: string };
  readDevice: () => Promise<DeviceGateRead>;
  readLastPersona: () => Promise<AdultPersona | null>;
  writeLastPersona: (persona: AdultPersona) => void;
  clearGrownUpTab: () => void;
  assign: (url: string) => void;
}

export function browserFrameEnvironment(): AdultFrameEnvironment {
  const win = typeof window === 'undefined' ? null : window;
  return {
    location: () => ({ origin: win?.location.origin ?? '', pathname: win?.location.pathname ?? '', search: win?.location.search ?? '' }),
    readDevice: () => readDeviceGate(),
    readLastPersona: () => readLastPersona(),
    writeLastPersona: (persona) => {
      void writeLastPersona(persona);
    },
    clearGrownUpTab: () => clearGrownUpTab(),
    assign: (url) => win?.location.assign(url),
  };
}

/** The spaces list a page already holds: loading (null), loaded, or failed. Omitted, the frame reads it itself. */
export type FrameSpaces = readonly SpaceListItem[] | null | 'failed';

/**
 * The way back reads "Open the learner app" on a device that has no learner profile and a marker
 * that is absent or `none` (a teacher's laptop), and on a browser without IndexedDB (which cannot
 * keep learner profiles). Unknown or failed reads keep "Back to learning".
 */
export function opensLearnerApp(device: DeviceGateRead | null): boolean {
  if (!device) return false;
  if (!device.readable) return device.reason === 'unavailable';
  return !device.hasProfiles && (device.marker === null || device.marker.gate === 'none');
}

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
/** The way back shrinks before the header row wraps: its label may take two lines on a narrow phone (mock README, Constants). */
const WAY_BACK_BASIS = '7.5rem';

/** Layout rules that change at a breakpoint live here (inline styles would beat them); every value is a token. */
const FRAME_CSS = `
.hr-frame{min-height:100vh;display:flex;flex-direction:column;background:${colors.surface.canvas};color:${colors.text.primary}}
.hr-frame-top{background:${colors.surface.paper};border-bottom:${borderWidth.thin}px solid ${colors.border.subtle}}
.hr-frame-bar,.hr-frame-nav,.hr-frame-main,.hr-frame-foot-inner{box-sizing:border-box;width:100%;max-width:${layout.maxWidth.full}px;margin:0 auto;padding-left:${layout.gutter.compact}px;padding-right:${layout.gutter.compact}px}
.hr-frame-bar{padding-top:${spacing.sm}px;padding-bottom:${spacing.sm}px;display:flex;flex-wrap:wrap;align-items:center;column-gap:${spacing.sm}px;row-gap:${spacing.xs}px}
.hr-frame-brand{display:inline-flex;align-items:center;gap:${spacing.sm}px;min-height:${touchTarget.min}px;min-width:${touchTarget.min}px;text-decoration:none;font-size:${typography.size.bodyLg}px;font-weight:${typography.weight.bold};color:${colors.text.primary}}
.hr-frame-mark{width:${spacing.xxxl}px;height:${spacing.xxxl}px;border-radius:${radii.circle}px;background:${colors.brand.primary};color:${colors.text.inverse};display:inline-flex;align-items:center;justify-content:center;font-size:${typography.size.bodyLg}px;font-weight:${typography.weight.bold};flex:none}
.hr-frame-name,.hr-frame-hidden{position:absolute;width:${borderWidth.thin}px;height:${borderWidth.thin}px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.hr-frame-bar.hr-has-switch .hr-frame-brand{display:none}
.hr-frame-persona{display:inline-flex;align-items:center;min-height:${touchTarget.min}px;color:${colors.text.secondary};font-weight:${typography.weight.semibold}}
.hr-frame-switch{display:inline-flex;border:${borderWidth.base}px solid ${colors.brand.secondaryDark};border-radius:${radii.pill}px;background:${colors.surface.paper};overflow:hidden}
.hr-frame-switch [role="radio"]{min-height:${touchTarget.min}px;min-width:${touchTarget.min}px;padding:${spacing.xs}px ${spacing.sm}px;border:none;background:transparent;color:${colors.brand.secondaryDark};font-size:${typography.size.bodySm}px;font-weight:${typography.weight.bold};cursor:pointer}
.hr-frame-switch [role="radio"][aria-checked="true"]{background:${colors.brand.secondaryDark};color:${colors.text.onSecondary}}
.hr-frame-back{margin-left:auto;flex:1 1 ${WAY_BACK_BASIS};max-width:max-content;display:inline-flex;align-items:center;gap:${spacing.xs}px;min-height:${touchTarget.min}px;padding:${spacing.xs}px ${spacing.md}px ${spacing.xs}px ${spacing.sm}px;border-radius:${radii.pill}px;border:${borderWidth.thin}px solid ${colors.border.strong};background:${colors.surface.paper};color:${colors.text.primary};font-size:${typography.size.bodySm}px;font-weight:${typography.weight.bold};line-height:${typography.leading.tight};text-align:left;cursor:pointer}
.hr-frame-wide{display:none}
.hr-frame-list{display:flex;overflow-x:auto;scrollbar-width:none;list-style:none;margin:0;padding:0}
.hr-frame-list li{flex:1 0 ${touchTarget.min}px;display:flex}
.hr-frame-item{flex:1;display:inline-flex;align-items:center;justify-content:center;min-height:${touchTarget.min}px;padding:0 ${spacing.xs}px;border:none;border-bottom:${borderWidth.thick}px solid transparent;background:transparent;color:${colors.text.secondary};font-size:${typography.size.bodySm}px;font-weight:${typography.weight.semibold};text-decoration:none;white-space:nowrap;cursor:pointer}
.hr-frame-item[aria-current="page"]{color:${colors.text.primary};font-weight:${typography.weight.bold};border-bottom-color:${colors.brand.primary}}
.hr-frame-main{flex:1;padding-top:${spacing.lg}px;padding-bottom:${spacing.xxl}px}
.hr-frame-foot{background:${colors.surface.sunken}}
.hr-frame-foot-inner{padding-top:${spacing.sm}px;padding-bottom:${spacing.lg}px;display:flex;flex-direction:column;gap:${spacing.xs}px}
.hr-frame-links{display:flex;flex-wrap:wrap;column-gap:${spacing.lg}px}
.hr-frame-links a{display:inline-flex;align-items:center;justify-content:center;min-height:${touchTarget.min}px;min-width:${touchTarget.min}px;color:${colors.text.secondary};text-decoration:underline;text-underline-offset:${spacing.xs}px}
.hr-frame-tools{display:flex;flex-wrap:wrap;align-items:center;gap:${spacing.sm}px}
.hr-frame :focus-visible{outline:${borderWidth.thick}px solid ${colors.border.focus};outline-offset:${spacing.xxs}px}
@media (min-width:${WIDE}){
.hr-frame-bar,.hr-frame-nav,.hr-frame-main,.hr-frame-foot-inner{padding-left:${layout.gutter.regular}px;padding-right:${layout.gutter.regular}px}
.hr-frame-bar{column-gap:${spacing.md}px}
.hr-frame-bar.hr-has-switch .hr-frame-brand{display:inline-flex}
.hr-frame-wide{display:inline-flex}
.hr-frame-back{flex:none}
.hr-frame-switch [role="radio"]{padding-left:${spacing.md}px;padding-right:${spacing.md}px}
.hr-frame-list{overflow-x:visible;gap:${spacing.xs}px}
.hr-frame-list li{flex:none}
.hr-frame-item{padding:0 ${spacing.md}px}
.hr-frame-tools{display:none}
}
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
  fontSize: typography.size.bodySm,
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

export function AdultFrame({
  children,
  title,
  onSignOut,
  spaces,
  env,
}: {
  children: ReactNode;
  /** The page's context line (a space or a page name), shown at the top of the content. */
  title?: string;
  onSignOut?: () => void;
  /** The spaces list the page already reads (the teacher home); omitted, the frame reads it. */
  spaces?: FrameSpaces;
  env?: AdultFrameEnvironment;
}): JSX.Element {
  const { api, m, locale, signOut } = useConsole();
  const router = useRouter();
  const [browser] = useState<AdultFrameEnvironment>(() => env ?? browserFrameEnvironment());
  const [ownSpaces, setOwnSpaces] = useState<FrameSpaces>(null);
  const [last, setLast] = useState<AdultPersona | null>(null);
  const [device, setDevice] = useState<DeviceGateRead | null>(null);
  const [solo, setSolo] = useState<SoloLearner | null>(null);

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
    browser.readDevice().then(
      (read) => live && setDevice(read),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [browser]);

  const state: FrameSpaces = fetchOwn ? ownSpaces : spaces;
  const list = Array.isArray(state) ? (state as readonly SpaceListItem[]) : null;
  const failed = state === 'failed';
  const { origin, pathname, search } = browser.location();
  const area = pageArea(pathname, search);
  const live = FAMILY_HOME_LIVE;
  const active = activePersona({ area, spaces: list, last, live });
  const held = heldPersonas(list);
  const flags = navFlags(locale, undefined, origin);
  const soloSpace = flags.reports && list ? soloFamilyLearnerSpace(list) : null;
  const toRecord = homeToRecord(area, active, held, live);

  useEffect(() => {
    if (toRecord) browser.writeLastPersona(toRecord);
  }, [toRecord, browser]);

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
  const items: NavEntry[] = failed ? [] : navItemsFor({ persona: navPersona, spaces: list ?? [], soloLearner: solo, flags, live });
  const current = list ? currentNavItem(pathname, active.persona, active.resolved) : currentNavItem(pathname, navPersona, false);
  const withSwitch = !!list && showPersonaSwitch(held, live);
  const brandHref = list && held.length > 0 ? personaHome(active.persona, live) : ROUTES.signIn;
  const doSignOut = onSignOut ?? signOut;

  const choose = (persona: AdultPersona): void => {
    if (active.resolved && persona === active.persona) return;
    browser.writeLastPersona(persona);
    router.push(personaHome(persona, live));
  };
  const goBack = (): void => {
    browser.clearGrownUpTab();
    browser.assign(learnerHome(origin));
  };

  return (
    <div className="hr-frame" data-testid="adult-frame">
      <style>{FRAME_CSS}</style>
      <header className="hr-frame-top">
        <div className={withSwitch ? 'hr-frame-bar hr-has-switch' : 'hr-frame-bar'}>
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
          <button type="button" className="hr-frame-back" onClick={goBack} data-testid="frame-way-back">
            <IconSvg name="arrow-left" size={spacing.lg + spacing.xs} color={colors.text.primary} />
            <span>{opensLearnerApp(device) ? shell.openLearnerApp : shell.backToLearning}</span>
          </button>
          <span className="hr-frame-wide">
            <LanguageSelect />
          </span>
          <button type="button" className="hr-frame-wide" style={quietButton} onClick={doSignOut} data-testid="frame-sign-out">
            {shell.signOut.cta}
          </button>
        </div>
        {items.length > 0 ? (
          <nav className="hr-frame-nav" aria-label={names[navPersona]} data-testid="frame-nav">
            <ul className="hr-frame-list">
              {items.map((entry) => (
                <li key={entry.id}>
                  {entry.target.document ? (
                    <a className="hr-frame-item" href={entry.target.href} data-testid={`nav-${entry.id}`}>
                      {shell.nav[entry.labelKey]}
                    </a>
                  ) : (
                    <Link className="hr-frame-item" href={entry.target.href} aria-current={current === entry.id ? 'page' : undefined} data-testid={`nav-${entry.id}`}>
                      {shell.nav[entry.labelKey]}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </header>
      <main className="hr-frame-main">
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
            <LanguageSelect />
            <button type="button" style={footButton} onClick={doSignOut} data-testid="frame-foot-sign-out">
              {shell.signOut.cta}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
