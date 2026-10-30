// scripts/check-no-secrets.mjs (AMENDMENTS-AUDIO-CLIPS AC-B5 key safety; row AC-3). The positive fixtures are built
// at run time from pieces, so this file itself never matches a pattern and the tree scan below stays clean. The
// last test is the CI step: CI runs `pnpm run test:scripts`, so every tracked file is scanned on every PR.
import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { isBinary, main, scanText } from "../check-no-secrets.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..");
const SCRIPT = join(REPO, "scripts", "check-no-secrets.mjs");
const patterns = (text) => scanText(text).map((f) => f.pattern);

// Fake credentials, assembled so no literal in this file is one.
const AWS_ID = "AK" + "IA" + "Q4ZT7XK2LMNB3VWD";
const AWS_STS_ID = "AS" + "IA" + "ZZZZ2222YYYY3333";
const AWS_SECRET = "abcdEFGH1234/ijklMNOP5678+qrstUVWX90yzAB";
const AZURE_32 = "0123456789abcdef".repeat(2);
const AZURE_84 = "a".repeat(26) + "B".repeat(26) + "JQQJ" + "9" + "c".repeat(27);
const SA_JSON = JSON.stringify({ type: "service_account", project_id: "demo", private_key_id: "x", ["private" + "_key"]: "-----" + "BEGIN PRIVATE KEY-----\\nMIIE\\n-----END PRIVATE KEY-----\\n", client_email: "tts@demo.iam.gserviceaccount.com" }, null, 2);

describe("check-no-secrets: each pattern", () => {
  test("a Google service-account key (private_key with client_email)", () => {
    assert.deepEqual(patterns(SA_JSON), ["google-service-account"]);
    assert.deepEqual(patterns(SA_JSON.replace(/"client_email"/, '"owner"')), [], "a private key alone is not this pattern");
  });

  test("an AWS access key id (AKIA or ASIA + 16 of [A-Z2-7])", () => {
    assert.deepEqual(patterns(`aws_access_key_id = ${AWS_ID}`), ["aws-access-key-id"]);
    assert.deepEqual(patterns(`"AccessKeyId": "${AWS_STS_ID}"`), ["aws-access-key-id"]);
    assert.deepEqual(patterns(`${AWS_ID.slice(0, 19)}`), [], "15 characters after the prefix is not a key id");
    assert.deepEqual(patterns(`${AWS_ID}1`), [], "a longer run is not a key id");
    assert.deepEqual(patterns("AKIAIOSFODNN7EXAMPLE"), [], "AWS's documented example is allowed");
  });

  test("a 40-character secret assigned to aws_secret_access_key", () => {
    assert.deepEqual(patterns(`aws_secret_access_key = ${AWS_SECRET}`), ["aws-secret-access-key"]);
    assert.deepEqual(patterns(`AWS_SECRET_ACCESS_KEY="${AWS_SECRET}"`), ["aws-secret-access-key"]);
    assert.deepEqual(patterns(`"aws_secret_access_key": "${AWS_SECRET}"`), ["aws-secret-access-key"]);
    assert.deepEqual(patterns(`some_value = ${AWS_SECRET}`), [], "a bare 40-character string is not flagged");
    assert.deepEqual(patterns("aws_secret_access_key = <your secret>"), []);
  });

  test("an Azure Speech key assigned to AZURE_SPEECH_KEY, and the 84-character Azure key format", () => {
    assert.deepEqual(patterns(`AZURE_SPEECH_KEY=${AZURE_32}`), ["azure-speech-key"]);
    assert.deepEqual(patterns(`export AZURE_SPEECH_KEY="${AZURE_84}"`), ["azure-key-84", "azure-speech-key"]);
    assert.deepEqual(patterns(`key: ${AZURE_84}`), ["azure-key-84"]);
    assert.deepEqual(patterns("AZURE_SPEECH_KEY=<키> AZURE_SPEECH_REGION=koreacentral"), []);
  });

  test("reports the line, never the matched text", () => {
    const findings = scanText(`line one\nAZURE_SPEECH_KEY=${AZURE_32}\n`);
    assert.deepEqual(findings, [{ line: 2, pattern: "azure-speech-key" }]);
    const lines = [];
    const dir = mkdtempSync(join(tmpdir(), "secrets-"));
    try {
      const file = join(dir, "leak.env");
      writeFileSync(file, `AWS_SECRET_ACCESS_KEY=${AWS_SECRET}\n`);
      assert.equal(main([file], () => {}, (l) => lines.push(l)), 1);
      assert.match(lines[0], /leak\.env:1: looks like a credential \(aws-secret-access-key\)/);
      assert.ok(!lines.join("\n").includes(AWS_SECRET));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("check-no-secrets: content hashes never trip it (no bare 32-hex pattern)", () => {
  test("the sha256 values of a tts-lock.json and the say keys of the clip map", () => {
    const sha = (n) => n.toString(16).padStart(2, "0").repeat(32);
    const lock = { schemaVersion: 1, rows: [1, 2, 3].map((n) => ({ ref: `audio/say/${sha(n).slice(0, 16)}.mp3`, key: sha(n).slice(0, 16), engine: "polly", voice: "Seoyeon", model: "neural", rate: 0.9, generated: "2026-11-02", saySha256: sha(n), mp3Sha256: sha(n + 7) })) };
    assert.deepEqual(scanText(JSON.stringify(lock, null, 2)), []);
    assert.deepEqual(scanText("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"), []);
    assert.deepEqual(scanText(AZURE_32), [], "a bare 32-hex value is not flagged");
    assert.deepEqual(scanText(`'audio/say/0123456789abcdef.mp3': require('../../../assets/audio/say/0123456789abcdef.mp3'),`), []);
  });

  test("the committed lock, manifest, clip map and licence CSV are clean", () => {
    for (const rel of ["content/audio/tts-lock.json", "content/audio/tts-manifest.json", "apps/mobile/src/content/__generated__/audio-assets.ts", "content/assets-license.csv"]) {
      assert.deepEqual(scanText(readFileSync(join(REPO, rel), "utf8")), [], rel);
    }
  });

  test("binary files are skipped", () => {
    assert.equal(isBinary(Buffer.from([0x49, 0x44, 0x33, 0x00, 0x01])), true);
    assert.equal(isBinary(Buffer.from("text")), false);
  });
});

describe("check-no-secrets: the hook and the tree", () => {
  test("staged mode reads the staged blob and refuses a staged key (as the pre-commit hook runs it)", () => {
    const dir = mkdtempSync(join(tmpdir(), "secrets-git-"));
    try {
      const git = (...args) => spawnSync("git", ["-C", dir, ...args], { encoding: "utf8" });
      git("init", "-q");
      writeFileSync(join(dir, "ok.txt"), "nothing here\n");
      git("add", "ok.txt");
      const clean = spawnSync(process.execPath, [SCRIPT], { cwd: dir, encoding: "utf8" });
      assert.equal(clean.status, 0, clean.stderr);
      assert.match(clean.stdout, /1 file\(s\) clean/);
      writeFileSync(join(dir, "creds.json"), SA_JSON);
      git("add", "creds.json");
      writeFileSync(join(dir, "creds.json"), "{}\n"); // the working tree is clean; the staged blob is not
      const dirty = spawnSync(process.execPath, [SCRIPT], { cwd: dir, encoding: "utf8" });
      assert.equal(dirty.status, 1);
      assert.match(dirty.stderr, /creds\.json:\d+: looks like a credential \(google-service-account\)/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test(".githooks/pre-commit runs the check, and pnpm hooks:install turns it on", () => {
    const hook = readFileSync(join(REPO, ".githooks", "pre-commit"), "utf8");
    assert.match(hook, /^#!\/bin\/sh\n/);
    assert.match(hook, /exec node scripts\/check-no-secrets\.mjs\n$/);
    const mode = spawnSync("git", ["-C", REPO, "ls-files", "-s", ".githooks/pre-commit"], { encoding: "utf8" }).stdout;
    assert.match(mode, /^100755 /, "the hook is committed executable");
    const pkg = JSON.parse(readFileSync(join(REPO, "package.json"), "utf8"));
    assert.equal(pkg.scripts["hooks:install"], "git config core.hooksPath .githooks");
    assert.equal(pkg.scripts["secrets:check"], "node scripts/check-no-secrets.mjs --all");
  });

  test("every tracked file of the repository is clean (the CI step)", () => {
    const r = spawnSync(process.execPath, [SCRIPT, "--all"], { cwd: REPO, encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /^check-no-secrets: \d+ file\(s\) clean\n$/);
  });

  test("refuses unknown flags", () => {
    const errors = [];
    assert.equal(main(["--staged-only"], () => {}, (l) => errors.push(l)), 2);
    assert.match(errors[0], /^usage: check-no-secrets\.mjs/);
  });
});
