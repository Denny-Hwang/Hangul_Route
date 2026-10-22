#!/usr/bin/env node
// The site's share images (AMENDMENTS-SITE-NEWUSER §3.14, row SN-2): one 1200 x 630 PNG per locale, Hoya waving on a
// `brand.primaryLight` circle, the brand mark and name, the locale's `landing.meta.tagline` and the host. The design
// tool draws them (`node design/screens/site/newuser/tools/build-head.mjs`, after `build-mocks.mjs`); this copies the
// approved drawings to `public/site/<locale>/og.png`, where `siteMetadataFor` names them. On demand, not in `build`:
// run it after the design tool redraws a share image (a new tagline, say), and commit the files.
//
//   node apps/web/scripts/site-og.mjs
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, '../../..');
const HEAD = join(REPO, 'design/screens/site/newuser/head');
const PUBLIC = resolve(here, '../public/site');

/** The locales with a share image: every site locale (a hidden one's folder leaves the export with its pages). */
export const OG_LOCALES = ['en', 'es', 'ko'];
/** The size every share image has, and the most bytes one may take (§8, row SN-2). */
export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;
export const OG_MAX_BYTES = 60 * 1024;

/** Width and height from a PNG's IHDR chunk. @param {Buffer} png */
export function pngSize(png) {
  if (png.toString('latin1', 1, 4) !== 'PNG') throw new Error('not a PNG');
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

/** Copies each locale's drawing to `public/site/<locale>/og.png` after checking its size and bytes. */
export function copyShareImages() {
  for (const locale of OG_LOCALES) {
    const from = join(HEAD, `og-${locale}.png`);
    if (!existsSync(from)) throw new Error(`no drawing at ${from} (run design/screens/site/newuser/tools/build-head.mjs)`);
    const { width, height } = pngSize(readFileSync(from));
    if (width !== OG_WIDTH || height !== OG_HEIGHT) throw new Error(`${from} is ${width} x ${height}, not ${OG_WIDTH} x ${OG_HEIGHT}`);
    const bytes = statSync(from).size;
    if (bytes > OG_MAX_BYTES) throw new Error(`${from} has ${bytes} bytes, more than ${OG_MAX_BYTES}`);
    const to = join(PUBLIC, locale, 'og.png');
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
    console.log(`site-og: ${locale} ${width} x ${height}, ${bytes} bytes -> ${to}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) copyShareImages();
