import data from '../data/third-party-notices.json';

/**
 * The open-source notices of the shipped apps, as `scripts/third-party-notices.mjs` generates them into
 * `apps/web/src/data/third-party-notices.json` (the same model as THIRD_PARTY_NOTICES.md at the repository root).
 * `/licenses` renders them grouped by license (wireframe design/wireframes/site/licenses.md).
 */

/** Where a package ships: the learner app, the site and grown-up console, the Worker, or the iOS app's native libraries. */
export type NoticeWhere = 'app' | 'web' | 'server' | 'ios';

export interface NoticePackage {
  name: string;
  version: string;
  /** The SPDX id we comply with (the chosen side of an `OR`). */
  license: string;
  /** Why the license reads as it does, when it is not simply the declared one (English, from the generator). */
  note?: string;
  copyright: string;
  usedIn: NoticeWhere[];
}

export interface NoticeAsset {
  path: string;
  source: string;
  url: string;
  license: string;
  attribution: string;
}

export interface NoticeLicense {
  id: string;
  name: string;
  text: string;
}

export interface NoticeFile {
  name: string;
  version: string;
  text: string;
}

export interface ThirdPartyNotices {
  packages: NoticePackage[];
  assets: NoticeAsset[];
  notices: NoticeFile[];
  licenses: NoticeLicense[];
}

/** One license and the packages under it. */
export interface LicenseGroup {
  license: NoticeLicense;
  packages: NoticePackage[];
}

export const THIRD_PARTY_NOTICES = data as ThirdPartyNotices;

/**
 * The packages grouped by license, the largest group first (ties by id), each group in the generator's order (name,
 * then version). A license with no package (the font's OFL) is not a group; `assetLicenses` has it.
 */
export function licenseGroups(notices: ThirdPartyNotices = THIRD_PARTY_NOTICES): LicenseGroup[] {
  const byId = new Map(notices.licenses.map((l) => [l.id, l]));
  const groups = new Map<string, NoticePackage[]>();
  for (const p of notices.packages) {
    const list = groups.get(p.license);
    if (list) list.push(p);
    else groups.set(p.license, [p]);
  }
  return [...groups.entries()]
    .map(([id, packages]) => {
      const license = byId.get(id);
      if (!license) throw new Error(`third-party notices: no text for ${id}; run node scripts/third-party-notices.mjs`);
      return { license, packages };
    })
    .sort((a, b) => b.packages.length - a.packages.length || (a.license.id < b.license.id ? -1 : 1));
}

/** The license texts the fonts and other assets need, in the order the assets name them. */
export function assetLicenses(notices: ThirdPartyNotices = THIRD_PARTY_NOTICES): NoticeLicense[] {
  const ids = [...new Set(notices.assets.map((a) => a.license))];
  return ids.flatMap((id) => notices.licenses.filter((l) => l.id === id));
}
