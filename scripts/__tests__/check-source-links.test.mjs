// Self-tests for scripts/check-source-links.mjs (F-STORY-001 §3.7 "Link rot", PR 1.5).
//
// No network: every request goes through an injected fetch, and the rate
// limiter through an injected clock. The fixtures are story-shaped JSON under
// __fixtures__/source-links/content/stories (read as plain JSON, no zod).

import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  checkAll,
  checkUrl,
  collectSourceUrls,
  createHostLimiter,
  formatReport,
  isIgnored,
  loadIgnoreHosts,
  USER_AGENT,
} from "../check-source-links.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(HERE, "..", "check-source-links.mjs");
const REPO_ROOT = resolve(HERE, "..", "..");
const FIXTURE_ROOT = join(HERE, "__fixtures__", "source-links");
const WORKFLOW = join(REPO_ROOT, ".github", "workflows", "source-links.yml");

/** A minimal Response stand-in: what checkUrl reads. */
function response(status, url, location) {
  return { status, ok: status >= 200 && status < 300, url, headers: { get: (name) => (name.toLowerCase() === "location" ? location ?? null : null) } };
}

function fetchError(code) {
  return Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error(code), { code }) });
}

/**
 * A fake fetch from a table: `${method} ${url}` -> status | [status, finalUrl]
 * | { status, location } (a redirect answer) | Error.
 */
function fakeFetch(table, calls = []) {
  return async (url, init) => {
    calls.push({ url, method: init.method, headers: init.headers, hasSignal: Boolean(init.signal), redirect: init.redirect });
    const hit = table[`${init.method} ${url}`];
    if (hit === undefined) throw new Error(`unexpected request ${init.method} ${url}`);
    if (hit instanceof Error) throw hit;
    if (!Array.isArray(hit) && typeof hit === "object") return response(hit.status, url, hit.location);
    const [status, finalUrl] = Array.isArray(hit) ? hit : [hit, url];
    return response(status, finalUrl);
  };
}

const noWait = { wait: async () => {} };

describe("collectSourceUrls", () => {
  test("unique URLs of every top-level story file, with the stories and facts citing each; research files skipped", () => {
    const urls = collectSourceUrls(FIXTURE_ROOT);
    assert.deepEqual([...urls.keys()].sort(), [
      "https://gone.example/missing",
      "https://good.example/page",
      "https://ich.unesco.org/en/RL/fixture",
      "https://moved.example/old",
    ]);
    assert.deepEqual(urls.get("https://good.example/page"), [
      { file: "content/stories/alpha.json", factId: "f1" },
      { file: "content/stories/alpha.json", factId: "f2" },
      { file: "content/stories/beta.json", factId: "f1" },
    ]);
  });

  test("a missing stories directory gives no URLs", () => {
    const empty = mkdtempSync(join(tmpdir(), "source-links-"));
    try {
      assert.equal(collectSourceUrls(empty).size, 0);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  test("the repository's own stories cite only https URLs", () => {
    const urls = collectSourceUrls(REPO_ROOT);
    assert.ok(urls.size > 0);
    for (const url of urls.keys()) assert.match(url, /^https:\/\//);
  });
});

describe("ignore list", () => {
  test("the committed list names UNESCO (resets bot connections, per the verification notes)", () => {
    const hosts = loadIgnoreHosts(join(REPO_ROOT, "scripts", "source-link-ignore.json"));
    assert.ok(hosts.includes("unesco.org"));
    const raw = JSON.parse(readFileSync(join(REPO_ROOT, "scripts", "source-link-ignore.json"), "utf8"));
    for (const entry of raw.hosts) assert.ok(entry.reason && entry.reason.length > 0, `${entry.host} has a reason`);
  });

  test("a host matches itself and its subdomains, never a lookalike", () => {
    const hosts = ["unesco.org"];
    assert.equal(isIgnored("https://unesco.org/x", hosts), true);
    assert.equal(isIgnored("https://ich.unesco.org/en/RL/1", hosts), true);
    assert.equal(isIgnored("https://whc.unesco.org/en/list/1", hosts), true);
    assert.equal(isIgnored("https://notunesco.org/x", hosts), false);
    assert.equal(isIgnored("https://unesco.org.example/x", hosts), false);
    assert.equal(isIgnored("not a url", hosts), false);
  });

  test("a missing ignore file means no ignored hosts", () => {
    assert.deepEqual(loadIgnoreHosts(join(FIXTURE_ROOT, "no-such-file.json")), []);
  });
});

describe("checkUrl", () => {
  const url = "https://good.example/page";

  test("HEAD ok: one request, polite User-Agent, a timeout signal, redirects followed by hand", async () => {
    const calls = [];
    const r = await checkUrl(url, { fetchImpl: fakeFetch({ [`HEAD ${url}`]: 200 }, calls), limiter: noWait });
    assert.equal(r.kind, "ok");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].headers["User-Agent"], USER_AGENT);
    assert.match(USER_AGENT, /Hangul.?Route/);
    assert.match(USER_AGENT, /github\.com\/Denny-Hwang\/Hangul_Route/);
    assert.equal(calls[0].hasSignal, true);
    assert.equal(calls[0].redirect, "manual");
  });

  test("HEAD refused (405), GET ok: ok", async () => {
    const calls = [];
    const r = await checkUrl(url, { fetchImpl: fakeFetch({ [`HEAD ${url}`]: 405, [`GET ${url}`]: 200 }, calls), limiter: noWait });
    assert.equal(r.kind, "ok");
    assert.deepEqual(calls.map((c) => c.method), ["HEAD", "GET"]);
  });

  test("HEAD and GET both 404: an http problem with the GET status", async () => {
    const r = await checkUrl(url, { fetchImpl: fakeFetch({ [`HEAD ${url}`]: 404, [`GET ${url}`]: 404 }), limiter: noWait });
    assert.deepEqual({ kind: r.kind, status: r.status }, { kind: "http", status: 404 });
  });

  test("a 5xx is an http problem", async () => {
    const r = await checkUrl(url, { fetchImpl: fakeFetch({ [`HEAD ${url}`]: 503, [`GET ${url}`]: 502 }), limiter: noWait });
    assert.deepEqual({ kind: r.kind, status: r.status }, { kind: "http", status: 502 });
  });

  test("a redirect to another host is a problem; www and http-to-https on the same host are not", async () => {
    let r = await checkUrl(url, { fetchImpl: fakeFetch({ [`HEAD ${url}`]: [200, "https://elsewhere.example/landing"] }), limiter: noWait });
    assert.deepEqual({ kind: r.kind, finalUrl: r.finalUrl }, { kind: "redirect", finalUrl: "https://elsewhere.example/landing" });
    r = await checkUrl(url, { fetchImpl: fakeFetch({ [`HEAD ${url}`]: [200, "https://www.good.example/page2"] }), limiter: noWait });
    assert.equal(r.kind, "ok");
    const plain = "http://good.example/page";
    r = await checkUrl(plain, { fetchImpl: fakeFetch({ [`HEAD ${plain}`]: [200, "https://good.example/page"] }), limiter: noWait });
    assert.equal(r.kind, "ok");
  });

  test("a TLS failure is reported as tls with the error code", async () => {
    const err = fetchError("CERT_HAS_EXPIRED");
    const r = await checkUrl(url, { fetchImpl: fakeFetch({ [`HEAD ${url}`]: err, [`GET ${url}`]: err }), limiter: noWait });
    assert.deepEqual({ kind: r.kind, detail: r.detail }, { kind: "tls", detail: "CERT_HAS_EXPIRED" });
  });

  test("an unknown host or a reset connection is unreachable; a timeout says so", async () => {
    let r = await checkUrl(url, { fetchImpl: fakeFetch({ [`HEAD ${url}`]: fetchError("ENOTFOUND"), [`GET ${url}`]: fetchError("ENOTFOUND") }), limiter: noWait });
    assert.deepEqual({ kind: r.kind, detail: r.detail }, { kind: "unreachable", detail: "ENOTFOUND" });
    const timeout = Object.assign(new Error("aborted"), { name: "TimeoutError" });
    r = await checkUrl(url, { fetchImpl: fakeFetch({ [`HEAD ${url}`]: timeout, [`GET ${url}`]: timeout }), limiter: noWait, timeoutMs: 10_000 });
    assert.deepEqual({ kind: r.kind, detail: r.detail }, { kind: "unreachable", detail: "no answer within 10 s" });
  });

  test("HEAD throws but GET answers: the GET answer counts", async () => {
    const r = await checkUrl(url, { fetchImpl: fakeFetch({ [`HEAD ${url}`]: fetchError("ECONNRESET"), [`GET ${url}`]: 200 }), limiter: noWait });
    assert.equal(r.kind, "ok");
  });

  test("each redirect hop is its own request and waits for its host's turn", async () => {
    const waited = [];
    const calls = [];
    const limiter = { wait: async (host) => { waited.push(host); } };
    const r = await checkUrl(url, {
      fetchImpl: fakeFetch({ [`HEAD ${url}`]: { status: 301, location: "/page/" }, [`HEAD ${url}/`]: 200 }, calls),
      limiter,
    });
    assert.equal(r.kind, "ok");
    assert.deepEqual(calls.map((c) => `${c.method} ${c.url}`), [`HEAD ${url}`, `HEAD ${url}/`]);
    assert.deepEqual(waited, ["good.example", "good.example"]);
  });

  test("a redirect hop to another host waits for that host and is reported as a cross-host redirect", async () => {
    const waited = [];
    const limiter = { wait: async (host) => { waited.push(host); } };
    const r = await checkUrl(url, {
      fetchImpl: fakeFetch({ [`HEAD ${url}`]: { status: 302, location: "https://elsewhere.example/x" }, ["HEAD https://elsewhere.example/x"]: 200 }),
      limiter,
    });
    assert.deepEqual({ kind: r.kind, finalUrl: r.finalUrl }, { kind: "redirect", finalUrl: "https://elsewhere.example/x" });
    assert.deepEqual(waited, ["good.example", "elsewhere.example"]);
  });

  test("a redirect loop stops after 5 hops and is unreachable", async () => {
    const loop = { status: 302, location: url };
    const calls = [];
    const r = await checkUrl(url, { fetchImpl: fakeFetch({ [`HEAD ${url}`]: loop, [`GET ${url}`]: loop }, calls), limiter: noWait });
    assert.deepEqual({ kind: r.kind, detail: r.detail }, { kind: "unreachable", detail: "too many redirects" });
    assert.equal(calls.length, 12); // HEAD and GET, each the first request plus 5 hops
  });

  test("every request waits for its host's turn", async () => {
    const waited = [];
    const limiter = { wait: async (host) => { waited.push(host); } };
    await checkUrl(url, { fetchImpl: fakeFetch({ [`HEAD ${url}`]: 404, [`GET ${url}`]: 200 }), limiter });
    assert.deepEqual(waited, ["good.example", "good.example"]);
  });
});

describe("createHostLimiter", () => {
  test("at most 2 requests per host per second; other hosts do not wait", async () => {
    let clock = 0;
    const sleeps = [];
    const limiter = createHostLimiter({
      perSecond: 2,
      now: () => clock,
      sleep: async (ms) => { sleeps.push(ms); clock += ms; },
    });
    await limiter.wait("a.example"); // t=0
    await limiter.wait("a.example"); // waits 500
    await limiter.wait("b.example"); // another host: no wait
    clock += 100;
    await limiter.wait("a.example"); // last at 500, now 600: waits 400
    assert.deepEqual(sleeps, [500, 400]);
  });
});

describe("checkAll", () => {
  test("checks each unique URL once, skips ignored hosts, and returns the problems", async () => {
    const calls = [];
    const fetchImpl = fakeFetch({
      "HEAD https://good.example/page": 200,
      "HEAD https://gone.example/missing": 404,
      "GET https://gone.example/missing": 410,
      "HEAD https://moved.example/old": [200, "https://other.example/new"],
    }, calls);
    const urls = collectSourceUrls(FIXTURE_ROOT);
    const result = await checkAll(urls, { fetchImpl, ignoreHosts: ["unesco.org"], limiter: noWait });
    assert.equal(result.checked, 3);
    assert.deepEqual(result.ignored, ["https://ich.unesco.org/en/RL/fixture"]);
    assert.deepEqual(result.problems.map((p) => [p.url, p.kind]).sort(), [
      ["https://gone.example/missing", "http"],
      ["https://moved.example/old", "redirect"],
    ]);
    assert.ok(!calls.some((c) => c.url.includes("unesco")));
    assert.equal(calls.filter((c) => c.url === "https://good.example/page").length, 1);
  });
});

describe("formatReport", () => {
  const urls = collectSourceUrls(FIXTURE_ROOT);
  const result = {
    checked: 3,
    ignored: ["https://ich.unesco.org/en/RL/fixture"],
    ignoreHosts: ["unesco.org"],
    problems: [
      { url: "https://gone.example/missing", kind: "http", status: 410 },
      { url: "https://moved.example/old", kind: "redirect", status: 200, finalUrl: "https://other.example/new" },
      { url: "https://tls.example/x", kind: "tls", detail: "CERT_HAS_EXPIRED" },
      { url: "https://down.example/x", kind: "unreachable", detail: "ENOTFOUND" },
    ],
  };

  test("groups the problems, names the citing stories and facts, and says what to do", () => {
    const md = formatReport(result, { date: "2026-11-01", citations: urls });
    assert.match(md, /^## Source link check, 2026-11-01/m);
    assert.match(md, /3 URL\(s\) checked, 4 problem\(s\)/);
    assert.match(md, /### Error status \(4xx or 5xx\)/);
    assert.match(md, /- 410 https:\/\/gone\.example\/missing\n\s+- cited by content\/stories\/alpha\.json f1/);
    assert.match(md, /### Redirected to another host/);
    assert.match(md, /https:\/\/moved\.example\/old -> https:\/\/other\.example\/new/);
    assert.match(md, /### TLS failure/);
    assert.match(md, /CERT_HAS_EXPIRED https:\/\/tls\.example\/x/);
    assert.match(md, /### Could not reach/);
    assert.match(md, /Skipped 1 URL\(s\) on hosts that block automated requests \(scripts\/source-link-ignore\.json\): unesco\.org/);
    assert.match(md, /A dead link does not make a fact wrong/);
    assert.match(md, /rev/);
  });

  test("stays under the GitHub issue body limit", () => {
    const many = { ...result, problems: Array.from({ length: 3000 }, (_, i) => ({ url: `https://gone.example/${"x".repeat(40)}${i}`, kind: "http", status: 404 })) };
    const md = formatReport(many, { date: "2026-11-01", citations: new Map() });
    assert.ok(md.length < 65_000, String(md.length));
    assert.match(md, /list cut short/);
  });
});

describe("check-source-links.mjs CLI", () => {
  test("--list prints the unique URLs without any request", () => {
    const r = spawnSync("node", [SCRIPT, "--list"], { env: { ...process.env, HANGUL_ROUTE_ROOT: FIXTURE_ROOT }, encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(r.stdout.trim().split("\n").sort(), [
      "https://gone.example/missing",
      "https://good.example/page",
      "https://ich.unesco.org/en/RL/fixture",
      "https://moved.example/old",
    ]);
  });

  test("an unknown argument is a usage error", () => {
    const r = spawnSync("node", [SCRIPT, "--nope"], { encoding: "utf8" });
    assert.equal(r.status, 1);
    assert.match(r.stdout, /::error::unknown argument --nope/);
  });
});

describe("source-links.yml", () => {
  const yml = readFileSync(WORKFLOW, "utf8");
  const on = yml.slice(yml.indexOf("\non:"), yml.indexOf("\npermissions:"));

  test("runs monthly and by hand only: never on a pull request or a push, so it never fails a PR", () => {
    assert.match(on, /schedule:\n\s+- cron: "[^"]+ 1 \* \*"/);
    assert.match(on, /workflow_dispatch:/);
    assert.doesNotMatch(on, /pull_request|push:/);
  });

  test("no job carries the name of a required check", () => {
    for (const name of ["lint · typecheck · test · build", "Build PWA · offline e2e", "Measure coverage vs rolling targets"]) {
      assert.ok(!yml.includes(`name: ${name}`), name);
    }
  });

  test("runs the script and opens one issue only when there are problems", () => {
    assert.match(yml, /node scripts\/check-source-links\.mjs --out "\$RUNNER_TEMP\/source-links\.md"/);
    assert.match(yml, /if: steps\.links\.outputs\.problems != '0'/);
    assert.equal(yml.match(/gh issue create/g)?.length, 1);
    assert.match(yml, /--body-file "\$RUNNER_TEMP\/source-links\.md"/);
  });

  test("a link that stays broken updates the open source-links issue instead of opening a new one each month", () => {
    assert.match(yml, /gh label create source-links [^\n]*--force/);
    assert.match(yml, /gh issue list --label source-links --state open/);
    assert.match(yml, /gh issue edit "\$existing"[^\n]*--body-file "\$RUNNER_TEMP\/source-links\.md"/);
    assert.match(yml, /gh issue comment "\$existing"/);
    assert.match(yml, /gh issue create [^\n]*--label source-links/);
  });

  test("the token can read the code and write issues, nothing else", () => {
    const after = yml.slice(yml.indexOf("\npermissions:") + 1).split("\n").slice(1);
    const block = [];
    for (const l of after) {
      if (!/^ {2}\S/.test(l)) break;
      block.push(l.trim());
    }
    assert.deepEqual(block.sort(), ["contents: read", "issues: write"]);
  });
});
