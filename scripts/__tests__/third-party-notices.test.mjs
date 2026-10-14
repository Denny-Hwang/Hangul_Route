// Self-tests for scripts/third-party-notices.mjs (proprietary license, owner decision 2026-10-14).
//
// The pure rules run on inline inputs; the walk runs on a throwaway pnpm-shaped node_modules tree; and, when the
// workspace is installed (CI runs `pnpm install` before `pnpm run test:scripts`), `--check` runs on the repository,
// so a dependency with a copyleft or unknown license, or a stale THIRD_PARTY_NOTICES.md, fails the build.

import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  JSON_OUT,
  MARKDOWN_OUT,
  PERMISSIVE,
  assetLicenseId,
  buildModel,
  classify,
  copyrightLines,
  declaredLicense,
  exceptionFor,
  parseCsv,
  renderJson,
  renderMarkdown,
  walk,
} from "../third-party-notices.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const SCRIPT = resolve(HERE, "..", "third-party-notices.mjs");

describe("third-party-notices: license rules", () => {
  test("reads the license field in its current and old shapes", () => {
    assert.equal(declaredLicense({ license: "MIT" }), "MIT");
    assert.equal(declaredLicense({ license: { type: "ISC" } }), "ISC");
    assert.equal(declaredLicense({ licenses: "MIT" }), "MIT");
    assert.equal(declaredLicense({ licenses: [{ type: "MIT" }] }), "MIT");
    assert.equal(declaredLicense({ licenses: [{ type: "MIT" }, { type: "Apache-2.0" }] }), "(MIT OR Apache-2.0)");
    assert.equal(declaredLicense({}), null);
  });

  test("a permissive license passes as itself", () => {
    assert.deepEqual(classify("a", "1.0.0", "MIT"), { status: "permissive", license: "MIT", expression: "MIT" });
    assert.equal(classify("a", "1.0.0", "Apache 2.0").license, "Apache-2.0");
  });

  test("an OR expression passes on its permissive choice, and says which was taken", () => {
    const v = classify("node-forge", "1.4.0", "(BSD-3-Clause OR GPL-2.0)");
    assert.equal(v.status, "permissive");
    assert.equal(v.license, "BSD-3-Clause");
    assert.match(v.note, /BSD-3-Clause chosen from \(BSD-3-Clause OR GPL-2.0\)/);
    assert.equal(classify("rc", "1.2.8", "(BSD-2-Clause OR MIT OR Apache-2.0)").license, "MIT");
  });

  for (const id of ["GPL-3.0-only", "AGPL-3.0", "LGPL-2.1-or-later", "SSPL-1.0", "CC-BY-SA-4.0", "MPL-2.0", "EUPL-1.2", "(GPL-2.0 OR LGPL-3.0)"]) {
    test(`${id} is copyleft and fails`, () => {
      assert.equal(classify("x", "1.0.0", id).status, "copyleft");
    });
  }

  test("a reviewed exception passes only for its own package and license", () => {
    const exceptions = { lightningcss: { license: "MPL-2.0", reason: "build tool" }, "lightningcss-*": { license: "MPL-2.0", reason: "binary" } };
    assert.equal(classify("lightningcss", "1.27.0", "MPL-2.0", { exceptions }).status, "exception");
    assert.equal(classify("lightningcss-linux-x64-gnu", "1.27.0", "MPL-2.0", { exceptions }).status, "exception");
    assert.equal(classify("lightningcss", "1.27.0", "GPL-3.0", { exceptions }).status, "copyleft");
    assert.equal(classify("other", "1.0.0", "MPL-2.0", { exceptions }).status, "copyleft");
    assert.equal(exceptionFor("lightning", exceptions), null);
  });

  test("no license, a bare BSD, an AND expression or an unknown id is unknown and fails", () => {
    assert.equal(classify("x", "1.0.0", null).status, "unknown");
    assert.equal(classify("x", "1.0.0", "BSD").status, "unknown");
    assert.equal(classify("x", "1.0.0", "(MIT AND Zlib)").status, "unknown");
    assert.equal(classify("x", "1.0.0", "SEE LICENSE IN LICENSE.txt").status, "unknown");
  });

  test("an override settles a package read by hand, keeps what it declared and prints why", () => {
    const overrides = { "readline@1.3.0": { license: "BSD-3-Clause", reason: "read by hand" } };
    const v = classify("readline", "1.3.0", "BSD", { overrides });
    assert.equal(v.status, "permissive");
    assert.equal(v.license, "BSD-3-Clause");
    assert.equal(v.expression, "BSD");
    assert.equal(v.note, "read by hand");
    assert.equal(classify("readline", "1.4.0", "BSD", { overrides }).status, "unknown");
  });

  test("every permissive id has a license text", () => {
    for (const id of Object.keys(PERMISSIVE)) {
      assert.ok(existsSync(join(REPO, "scripts", "third-party-notices", "licenses", `${id}.txt`)), id);
    }
  });
});

describe("third-party-notices: copyright lines and assets", () => {
  test("takes notices, skips templates and license clauses", () => {
    const text = [
      "MIT License",
      "",
      "Copyright (c) 2014-present Sebastian McKenzie and other contributors",
      "Copyright jQuery Foundation and other contributors <https://jquery.org/>",
      "   Copyright [yyyy] [name of copyright owner]",
      "Copyright (c) <year> <copyright holders>",
      "The above copyright notice and this permission notice shall be included",
      "(c) You must retain, in the Source form of any Derivative Works",
      "Copyright License. Subject to the terms",
      " * Copyright (c) Meta Platforms, Inc. and affiliates.",
    ].join("\n");
    assert.deepEqual(copyrightLines(text), [
      "Copyright (c) 2014-present Sebastian McKenzie and other contributors",
      "Copyright jQuery Foundation and other contributors <https://jquery.org/>",
      "Copyright (c) Meta Platforms, Inc. and affiliates.",
    ]);
  });

  test("keeps at most three lines, without repeats", () => {
    const text = ["Copyright 2001 A", "Copyright 2001 A", "Copyright 2002 B", "Copyright 2003 C", "Copyright 2004 D"].join("\n");
    assert.deepEqual(copyrightLines(text), ["Copyright 2001 A", "Copyright 2002 B", "Copyright 2003 C"]);
  });

  test("parses the assets CSV with quoted commas", () => {
    const rows = parseCsv('asset_path,license,attribution\nfonts/a.woff2,SIL OFL 1.1,"Copyright 2014, Adobe; text in ""OFL.txt"""\n');
    assert.deepEqual(rows, [{ asset_path: "fonts/a.woff2", license: "SIL OFL 1.1", attribution: 'Copyright 2014, Adobe; text in "OFL.txt"' }]);
    assert.equal(assetLicenseId("SIL OFL 1.1"), "OFL-1.1");
    assert.equal(assetLicenseId("MIT"), "MIT");
    assert.equal(assetLicenseId("All rights reserved"), null);
  });
});

/** A throwaway workspace laid out the way pnpm lays one out: dependencies are symlinks into .pnpm. */
function fixtureRepo() {
  const root = mkdtempSync(join(tmpdir(), "hr-tpn-"));
  const store = (name, version, pkg, files = {}) => {
    const dir = join(root, "node_modules", ".pnpm", `${name.replace("/", "+")}@${version}`, "node_modules", name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name, version, ...pkg }));
    for (const [file, text] of Object.entries(files)) writeFileSync(join(dir, file), text);
    return dir;
  };
  const link = (fromDir, name, target) => {
    const at = join(fromDir, "node_modules", name);
    mkdirSync(dirname(at), { recursive: true });
    symlinkSync(target, at);
  };
  const app = join(root, "apps", "app");
  mkdirSync(app, { recursive: true });
  writeFileSync(join(app, "package.json"), JSON.stringify({ name: "@hangul-route/app", dependencies: { left: "1", "@hangul-route/lib": "workspace:*" }, devDependencies: { devtool: "1" } }));
  const lib = join(root, "packages", "lib");
  mkdirSync(lib, { recursive: true });
  writeFileSync(join(lib, "package.json"), JSON.stringify({ name: "@hangul-route/lib", dependencies: { right: "1" } }));

  const left = store("left", "1.0.0", { license: "MIT", dependencies: { shared: "1" }, optionalDependencies: { "left-linux": "1", absent: "1" }, peerDependencies: { react: "1", tester: "1" }, peerDependenciesMeta: { tester: { optional: true } } }, { LICENSE: "MIT License\n\nCopyright (c) 2020 Left Author\n" });
  const right = store("right", "2.0.0", { license: "Apache-2.0", dependencies: { shared: "1" } }, { LICENSE: "Apache License\n", NOTICE: "Right\nCopyright 2021 Right Org\n" });
  const shared = store("shared", "3.0.0", { license: "(MIT OR GPL-3.0)", author: "Shared Person <s@example.com>" });
  const react = store("react", "18.0.0", { license: "MIT" }, { LICENSE: "Copyright (c) Meta Platforms, Inc. and affiliates.\n" });
  const leftLinux = store("left-linux", "1.0.0", { license: "MIT", os: ["linux"] });
  const tester = store("tester", "1.0.0", { license: "GPL-3.0" });
  const devtool = store("devtool", "1.0.0", { license: "AGPL-3.0" });
  link(app, "left", left);
  link(app, "devtool", devtool);
  link(app, "@hangul-route/lib", lib);
  link(app, "react", react);
  link(app, "tester", tester);
  link(lib, "right", right);
  link(dirname(dirname(left)), "shared", shared);
  link(dirname(dirname(left)), "left-linux", leftLinux);
  link(dirname(dirname(left)), "react", react);
  link(dirname(dirname(right)), "shared", shared);

  mkdirSync(join(root, "content"), { recursive: true });
  writeFileSync(join(root, "content", "assets-license.csv"), "asset_path,category,source,license,attribution,url\nfonts/x.woff2,font,X Sans,SIL OFL 1.1,Copyright 2020 X,https://example.com/x\n");
  mkdirSync(join(root, "apps", "mobile", "public", "fonts"), { recursive: true });
  writeFileSync(join(root, "apps", "mobile", "public", "fonts", "OFL.txt"), "Copyright 2020 X\n\nSIL OPEN FONT LICENSE Version 1.1\n");
  return root;
}

describe("third-party-notices: the walk", () => {
  test("lists production dependencies once, with where they are used, and skips dev, optional peers and our own packages", () => {
    const root = fixtureRepo();
    try {
      const { packages, platform, problems } = walk(root, [{ dir: "apps/app", label: "app" }, { dir: "packages/lib", label: "server" }]);
      assert.deepEqual(problems, []);
      const names = packages.map((p) => `${p.name}@${p.version}:${[...p.usedIn].sort().join("+")}`).sort();
      assert.deepEqual(names, ["left@1.0.0:app", "react@18.0.0:app", "right@2.0.0:app+server", "shared@3.0.0:app+server"]);
      assert.deepEqual(platform.map((p) => p.name), ["left-linux"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("builds the notices: elected licenses, copyright lines, NOTICE files, asset rows and each license text", () => {
    const root = fixtureRepo();
    try {
      const model = buildModel(root, [{ dir: "apps/app", label: "app" }, { dir: "packages/lib", label: "server" }]);
      assert.deepEqual(model.problems, []);
      const byName = Object.fromEntries(model.packages.map((p) => [p.name, p]));
      assert.equal(byName.left.copyright, "Copyright (c) 2020 Left Author");
      assert.equal(byName.shared.license, "MIT");
      assert.equal(byName.shared.copyright, "(no copyright line in the package; author: Shared Person)");
      assert.equal(byName.right.notice, "Right\nCopyright 2021 Right Org");
      assert.equal(byName.right.copyright, "Copyright 2021 Right Org");
      assert.deepEqual(model.licenses.map((l) => l.id), ["Apache-2.0", "MIT", "OFL-1.1"]);
      assert.match(model.licenses.find((l) => l.id === "OFL-1.1").text, /SIL OPEN FONT LICENSE/);
      const md = renderMarkdown(model);
      assert.match(md, /\| left \| 1\.0\.0 \| MIT \| Copyright \(c\) 2020 Left Author \| app \|/);
      assert.match(md, /\| shared \| 3\.0\.0 \| MIT \(MIT chosen from \(MIT OR GPL-3\.0\)\) \|/);
      assert.match(md, /### right 2\.0\.0/);
      assert.match(md, /\| fonts\/x\.woff2 \| X Sans \(https:\/\/example\.com\/x\) \| OFL-1\.1 \| Copyright 2020 X \|/);
      assert.doesNotMatch(md, /left-linux|devtool|tester|@hangul-route/);
      const json = JSON.parse(renderJson(model));
      assert.deepEqual(Object.keys(json), ["packages", "assets", "notices", "licenses"]);
      assert.equal(json.packages.length, 4);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("reports a copyleft or unknown production dependency, and a missing one", () => {
    const root = fixtureRepo();
    try {
      const shared = join(root, "node_modules", ".pnpm", "shared@3.0.0", "node_modules", "shared", "package.json");
      writeFileSync(shared, JSON.stringify({ name: "shared", version: "3.0.0", license: "GPL-3.0" }));
      const right = join(root, "node_modules", ".pnpm", "right@2.0.0", "node_modules", "right", "package.json");
      writeFileSync(right, JSON.stringify({ name: "right", version: "2.0.0", dependencies: { shared: "1", gone: "1" } }));
      const model = buildModel(root, [{ dir: "apps/app", label: "app" }, { dir: "packages/lib", label: "server" }]);
      assert.deepEqual(model.problems.map((p) => p.code).sort(), ["copyleft", "missing-dependency", "unknown-license"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

const installed = existsSync(join(REPO, "apps", "mobile", "node_modules")) && existsSync(join(REPO, "apps", "web", "node_modules"));

describe("third-party-notices: the repository", () => {
  test("--check passes: no copyleft or unknown license, and the notices are current", { skip: !installed && "workspace not installed" }, () => {
    const run = spawnSync(process.execPath, [SCRIPT, "--check"], { cwd: REPO, encoding: "utf8" });
    assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
  });

  test("the committed notices name the license and cover the shipped apps", () => {
    const md = readFileSync(join(REPO, MARKDOWN_OUT), "utf8");
    assert.match(md, /Copyright \(c\) 2026 Sungjoo Hwang\. All rights reserved\./);
    for (const name of ["react", "react-native-web", "next", "hono", "zod", "expo"]) assert.match(md, new RegExp(`^\\| ${name} \\|`, "m"), name);
    assert.match(md, /hr-presenter-kr\.woff2/);
    assert.match(md, /### OFL-1\.1: SIL Open Font License 1\.1/);
    const json = JSON.parse(readFileSync(join(REPO, JSON_OUT), "utf8"));
    assert.ok(json.packages.length > 100);
  });
});

describe("proprietary license: package manifests", () => {
  test("the root and every workspace package are private and UNLICENSED (none is published to npm)", () => {
    const manifests = ["package.json"];
    for (const group of ["apps", "packages"]) {
      for (const name of readdirSync(join(REPO, group))) {
        if (existsSync(join(REPO, group, name, "package.json"))) manifests.push(join(group, name, "package.json"));
      }
    }
    assert.ok(manifests.length >= 10);
    for (const rel of manifests) {
      const pkg = JSON.parse(readFileSync(join(REPO, rel), "utf8"));
      assert.equal(pkg.private, true, rel);
      assert.equal(pkg.license, "UNLICENSED", rel);
      assert.equal(pkg.publishConfig, undefined, rel);
    }
  });

  test("LICENSE is the proprietary license and points to the third-party notices", () => {
    const text = readFileSync(join(REPO, "LICENSE"), "utf8");
    assert.match(text, /Copyright \(c\) 2026 Sungjoo Hwang\. All rights reserved\./);
    assert.match(text, /THIRD_PARTY_NOTICES\.md/);
    assert.match(text, /Terms of Service/);
  });
});
