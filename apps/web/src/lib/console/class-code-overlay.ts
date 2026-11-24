import { borderWidth, colors, layout, presenter, spacing, touchTarget, typography, z } from '@hangul-route/design-system/tokens';
import { DEFAULT_LOCALE, getMessages, type UiLocale } from '@hangul-route/i18n';
import type { SpaceKind } from '@hangul-route/content-schema';
import { readItem, removeItem, writeItem, type KeyValueStorage } from '../i18n/safe-storage';
import { rem } from './rem';
import { rosterJoinLink } from './join-link';
import { codeExpiry } from './rollup';

/**
 * Show the code (AMENDMENTS-CLASS-CODE-OVERLAY, row CO-1; wireframe `design/wireframes/console/class-code-overlay.md`,
 * mock `design/screens/console/class-code-overlay.md`): the class name, the class code and a QR code on a full screen
 * for a room, and nothing else. Pure: `codeOverlayShown` says when the class page offers it, `codeOverlayView` builds
 * the whole model the overlay draws. The view holds seven parts and no learner field, so none can reach the screen
 * by accident; `ClassCodeOverlay` takes the view, never the roster.
 */

/** What the entry and the view read: a `Roster` and a `SpaceListItem` both satisfy it. */
export interface CodeOverlaySource {
  space: { name: string; kind: SpaceKind; archivedAt: string | null };
  joinCode: string | null;
  joinCodeExpiresAt: string | null;
}

/** The overlay's whole model (section 3.2). */
export interface CodeOverlayView {
  spaceName: string;
  /** "Class code". */
  codeLabel: string;
  code: string;
  /** The code letter by letter for a screen reader ("S U N 2 3 4"). */
  spokenCode: string;
  /** "expires in 18 days". */
  expiry: string;
  /** "Tap “Join a class” in Hangul Route and type this code." */
  howToJoin: string;
  joinLink: string;
}

/** Section 3.1: a class that is not archived, with a code that is live at `now`. */
export function codeOverlayShown(source: CodeOverlaySource, now: Date): boolean {
  if (source.space.kind !== 'class' || source.space.archivedAt !== null) return false;
  if (source.joinCode === null || source.joinCodeExpiresAt === null) return false;
  const expires = Date.parse(source.joinCodeExpiresAt);
  return !Number.isNaN(expires) && expires > now.getTime();
}

/** "SUN234" as "S U N 2 3 4" (the presenter's rule: a screen reader says the code letter by letter). */
export function spokenCode(code: string): string {
  return Array.from(code).join(' ');
}

/** Section 3.2: the overlay's model, or null when the entry is not shown. Only these seven parts, never a learner. */
export function codeOverlayView(source: CodeOverlaySource, now: Date, locale: UiLocale = DEFAULT_LOCALE, origin: string): CodeOverlayView | null {
  if (!codeOverlayShown(source, now)) return null;
  const joinLink = rosterJoinLink({ kind: source.space.kind, code: source.joinCode, origin });
  if (source.joinCode === null || joinLink === null) return null;
  const m = getMessages(locale);
  return {
    spaceName: source.space.name,
    codeLabel: m.console.space.codeLabel.class,
    code: source.joinCode,
    spokenCode: spokenCode(source.joinCode),
    expiry: codeExpiry(source.joinCodeExpiresAt, now, locale),
    howToJoin: m.console.space.codeOverlay.howToJoin(m.caregiver.spaces.join.cta),
    joinLink,
  };
}

/** The root element's attribute while the overlay is open: the hook of the print rule (section 3.3). */
export const CODE_OVERLAY_ATTR = 'data-hr-code-overlay';

/** The session key that remembers the open overlay across a grown-up lock: the space id only (section 3.6). */
export const CODE_OVERLAY_FLAG = 'hr:console:codeOverlay';

/**
 * Six monospace characters at the 0.6 em advance of Menlo and Courier (3.6 em), plus seven letter spaces (six after the
 * letters, one before them so a centred code stays centred) of `CODE_LETTER_SPACING_EM` each (about 1.2 em), rounded up.
 * The code's size is at most `100cqi / CODE_WIDTH_EM`, so it fits one line of its column.
 */
export const CODE_WIDTH_EM = 4.8;

/** The QR caption's lines kept free under a height-capped QR in two columns (it takes 3 lines at the narrowest landscape QR). */
export const QR_CAPTION_LINES = 3;

/** The letter spacing as a share of the code size: `spacing.xl` for every `presenter.size.display` of code. */
export const CODE_LETTER_SPACING_EM = spacing.xl / presenter.size.display;

/** The nodes a focus may go back to, in order of preference. */
export interface FocusNode {
  isConnected?: boolean;
  focus?: () => void;
}

/**
 * Where focus goes when the overlay goes (section 3.3): the opener from its ref, the page head when the opener is no
 * longer connected (the code ended or was replaced and the bar drew again), the error panel when the page head is gone
 * too. A node without `isConnected` (a test double) counts as connected.
 */
export function returnFocusTarget<T extends FocusNode>(candidates: ReadonlyArray<T | null | undefined>): T | null {
  for (const node of candidates) {
    if (node && node.isConnected !== false && typeof node.focus === 'function') return node;
  }
  return null;
}

const STAGE = presenter.stage;
/** One stage unit: the window pixels per presenter stage unit (F-TCH-004 section 3.6, `stage-scale.ts`). */
const UNIT = (height: 'vh' | 'dvh'): string => `min(calc(100vw / ${STAGE.width}),calc(100${height} / ${STAGE.minHeight}))`;
/** The tallest landscape QR that leaves room for the gutters, the Close row, its gaps and the caption's lines. */
const QR_FIT = (height: 'vh' | 'dvh'): string =>
  `calc(100${height} - 2 * var(--hr-co-gutter) - ${touchTarget.min}px - 3 * ${rem(spacing.sm)} - ${QR_CAPTION_LINES} * ${typography.leading.normal} * var(--hr-co-line))`;

/**
 * The overlay's rules, from the mock `design/screens/console/mock/class-code-overlay.css`: every size is the console
 * token as a floor (in rem, so the browser text size raises it) and the presenter token in stage units above it. Colours
 * are tokens only, `text.primary` and `text.secondary` on `surface.paper`; no scrim, no shadow, no motion.
 */
export const CLASS_CODE_OVERLAY_CSS = `
.hr-co{--hr-co-unit:${UNIT('vh')};--hr-co-gutter:${layout.gutter.compact}px;--hr-co-line:max(${rem(typography.size.body)},calc(${presenter.size.caption} * var(--hr-co-unit)));--hr-co-qr:max(${4 * touchTarget.min}px,calc(${presenter.size.glyph} * var(--hr-co-unit)));--hr-co-gap:max(${rem(spacing.xl)},calc(${spacing.xxxl} * var(--hr-co-unit)));--hr-co-qr-fit:${QR_FIT('vh')};position:fixed;inset:0;z-index:${z.modal};box-sizing:border-box;display:flex;flex-direction:column;padding:var(--hr-co-gutter);overflow-x:hidden;overflow-y:auto;background:${colors.surface.paper};color:${colors.text.primary}}
@supports (height:100dvh){.hr-co{--hr-co-unit:${UNIT('dvh')};--hr-co-qr-fit:${QR_FIT('dvh')}}}
@media (min-width:${layout.breakpoint.regular}px){.hr-co{--hr-co-gutter:${layout.gutter.regular}px}}
@media (min-width:${layout.breakpoint.wide}px){.hr-co{--hr-co-gutter:${layout.gutter.wide}px}}
.hr-co-body{flex:1 0 auto;display:grid;grid-template-columns:minmax(0,1fr);align-content:center;justify-items:center;row-gap:var(--hr-co-gap);padding-block:${rem(spacing.lg)};text-align:center}
.hr-co-close{display:flex;justify-content:flex-end;flex:none;order:-1}
.hr-co-text{width:100%;display:flex;flex-direction:column;align-items:center;gap:max(${rem(spacing.sm)},calc(${spacing.lg} * var(--hr-co-unit)));container-type:inline-size}
.hr-co-text>*{margin:0}
.hr-co-name{font-size:max(${rem(typography.size.title)},calc(${presenter.size.prompt} * var(--hr-co-unit)));font-weight:${typography.weight.bold};line-height:${typography.leading.tight};overflow-wrap:anywhere;max-width:100%}
.hr-co-name:focus{outline:none}
.hr-co-caption,.hr-co-expiry,.hr-co-how,.hr-co-qr-caption{font-size:var(--hr-co-line);line-height:${typography.leading.normal};color:${colors.text.secondary}}
.hr-co-caption{font-weight:${typography.weight.semibold}}
.hr-co-code{font-size:min(max(${rem(typography.size.hero)},calc(${presenter.size.display} * var(--hr-co-unit))),calc(100cqi / ${CODE_WIDTH_EM}));letter-spacing:calc(1em * ${spacing.xl} / ${presenter.size.display});padding-inline-start:calc(1em * ${spacing.xl} / ${presenter.size.display});font-family:${typography.family.mono};font-weight:${typography.weight.bold};line-height:${typography.leading.tight};white-space:nowrap;color:${colors.text.primary}}
.hr-co-spoken{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.hr-co-qr{display:flex;flex-direction:column;align-items:center;gap:${rem(spacing.sm)};width:min(var(--hr-co-qr),100%);margin:0;text-align:center}
.hr-co-qr svg{display:block;width:100%;height:auto}
.hr-co :focus-visible{outline:${borderWidth.thick}px solid ${colors.border.focus};outline-offset:${borderWidth.base}px}
@media (orientation:landscape) and (min-width:${layout.breakpoint.regular}px){.hr-co-body{grid-template-columns:minmax(0,1fr) auto;column-gap:max(${rem(spacing.xxxl)},calc(${spacing.jumbo} * var(--hr-co-unit)));justify-items:stretch;align-items:center;text-align:start;padding-block:0}.hr-co-text{align-items:flex-start}.hr-co-code{padding-inline-start:0}.hr-co-qr{width:min(var(--hr-co-qr),var(--hr-co-qr-fit))}.hr-co-close{order:0;margin-block-start:${rem(spacing.sm)}}}
@media print{
html[${CODE_OVERLAY_ATTR}]{overflow:visible!important}
html[${CODE_OVERLAY_ATTR}] [inert]{display:none!important}
.hr-co{position:static;overflow:visible;print-color-adjust:exact;-webkit-print-color-adjust:exact}
.hr-co-close{display:none}
}`;

/** Whether the flag names `spaceId`: the class page opens the overlay in the render that first draws its roster. */
export function codeOverlayFlagged(storage: KeyValueStorage | null, spaceId: string): boolean {
  if (spaceId === '') return false;
  return readItem(storage, CODE_OVERLAY_FLAG) === spaceId;
}

/** Remembers an open overlay across a grown-up lock: the space id only, never a name or a code. */
export function rememberCodeOverlay(storage: KeyValueStorage | null, spaceId: string): void {
  writeItem(storage, CODE_OVERLAY_FLAG, spaceId);
}

/** Close, Escape, a self-close, a navigation away and a page hide remove it. */
export function forgetCodeOverlay(storage: KeyValueStorage | null): void {
  removeItem(storage, CODE_OVERLAY_FLAG);
}

/**
 * Whether the address still names this class's page (`/teach/space?id=<id>`). A grown-up lock unmounts the page with the
 * address unchanged (the flag stays); a navigation changes it (the flag goes).
 */
export function addressNamesClassPage(location: { pathname: string; search: string } | null | undefined, spaceId: string): boolean {
  if (!location || spaceId === '') return false;
  if (!/^\/teach\/space(?:\.html)?\/?$/.test(location.pathname)) return false;
  return new URLSearchParams(location.search).get('id')?.trim() === spaceId;
}
