import { joinLinkUrl, type SpaceKind } from '@hangul-route/content-schema';
import qrcode from 'qrcode-generator';

/**
 * The class join link and its QR code on the teacher's roster (owner decision 2026-10-17): the link is
 * `<app origin>/join#c=<code>` (`joinLinkUrl`, content-schema), the code alone in the fragment, never a learner's
 * name; it opens the learner app's Join a class with the code filled in. Pure: the page passes the origin
 * (`appUrl()`), the space kind and its current code.
 */

/** The roster's join link: a class with a code only (a family joins from its own home, a school has no learners). */
export function rosterJoinLink(input: { kind: SpaceKind; code: string | null; origin: string }): string | null {
  if (input.kind !== 'class' || input.code === null) return null;
  return joinLinkUrl(input.origin, input.code);
}

/** The link as the page prints it: without `https://`, so it reads as one short address and wraps less. */
export function joinLinkText(url: string): string {
  return url.replace(/^https:\/\//, '');
}

/**
 * The QR code's modules (true = dark), row by row. Error correction M (15 % of the code can be covered or worn and
 * it still scans: a projector's glare, a smudge on a printout); the version is the smallest that holds the text.
 */
export function qrModules(text: string): boolean[][] {
  const qr = qrcode(0, 'M');
  qr.addData(text, 'Byte');
  qr.make();
  const size = qr.getModuleCount();
  return Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, col) => qr.isDark(row, col)));
}

/** The quiet zone the QR specification asks for around the code, in modules. */
export const QR_QUIET_ZONE = 4;

/**
 * One SVG path for the dark modules, in module units, offset by the quiet zone: each run of dark modules in a row is
 * one rectangle (`M x y h n v 1 h -n z`), so a version-3 code is about a hundred commands, not a thousand.
 */
export function qrPath(modules: readonly (readonly boolean[])[], quiet = QR_QUIET_ZONE): string {
  const parts: string[] = [];
  modules.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (!row[x]) {
        x += 1;
        continue;
      }
      let run = 1;
      while (x + run < row.length && row[x + run]) run += 1;
      parts.push(`M${x + quiet} ${y + quiet}h${run}v1h-${run}z`);
      x += run;
    }
  });
  return parts.join('');
}

/** The SVG viewBox side for a code of `size` modules: the code and its quiet zone on both sides. */
export function qrViewSize(size: number, quiet = QR_QUIET_ZONE): number {
  return size + quiet * 2;
}
