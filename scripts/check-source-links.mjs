#!/usr/bin/env node
// Source link check (F-STORY-001 §3.7 "Link rot", PR 1.5).
//
// Collects every unique source URL cited by content/stories/*.json
// (facts[].sources[].url; the research files under content/stories/research/
// are not read) and asks each one: HEAD first, then GET when HEAD fails or
// answers with an error status. 10 s timeout per request, at most 2 requests
// per host per second (one host at a time, hosts in parallel; redirects are
// followed by hand, up to 5 hops, and each hop counts as a request to its
// host), and a User-Agent that names the project.
//
// Problems: a 4xx/5xx status, a redirect that ends on another host, a TLS
// failure, and (listed separately) a URL that could not be reached at all.
// Hosts in scripts/source-link-ignore.json (known to block automated requests)
// are skipped and named in the report.
//
// It never fails a pull request: .github/workflows/source-links.yml runs it
// monthly and by hand, and opens one GitHub issue per run when there are
// problems. The exit code is 0 whatever the links say (1 only for a usage
// error). A dead link does not make a fact wrong: the owner decides.
//
// Usage:
//   node scripts/check-source-links.mjs [--out <report.md>]   check every URL
//   node scripts/check-source-links.mjs --list                print the URLs, no requests
//
// With --out the Markdown report is written only when there are problems. In
// GitHub Actions the step output `problems` carries the count.

import { appendFileSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.HANGUL_ROUTE_ROOT ? resolve(process.env.HANGUL_ROUTE_ROOT) : resolve(SCRIPT_DIR, "..");
const STORY_DIR = "content/stories";
const IGNORE_FILE = join(SCRIPT_DIR, "source-link-ignore.json");

export const USER_AGENT =
  "HangulRoute-SourceLinkCheck/1.0 (+https://github.com/Denny-Hwang/Hangul_Route; monthly check of the sources our stories cite)";
const TIMEOUT_MS = 10_000;
const PER_HOST_PER_SECOND = 2;
const MAX_REDIRECTS = 5;
/** GitHub caps an issue body at 65 536 characters. */
const REPORT_LIMIT = 60_000;

// ---- collecting --------------------------------------------------------------

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Every unique source URL of the top-level story files, with who cites it.
 * @returns {Map<string, Array<{ file: string, factId: string }>>}
 */
export function collectSourceUrls(root) {
  const out = new Map();
  const dir = join(root, STORY_DIR);
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    const file = `${STORY_DIR}/${name}`;
    let story;
    try {
      story = JSON.parse(readFileSync(join(dir, name), "utf8"));
    } catch {
      continue; // validate-content reports a file that does not parse
    }
    if (!isObject(story) || !Array.isArray(story.facts)) continue;
    for (const fact of story.facts) {
      if (!isObject(fact) || !Array.isArray(fact.sources)) continue;
      for (const source of fact.sources) {
        if (!isObject(source) || typeof source.url !== "string" || source.url.length === 0) continue;
        const list = out.get(source.url) ?? [];
        list.push({ file, factId: typeof fact.id === "string" ? fact.id : "?" });
        out.set(source.url, list);
      }
    }
  }
  return out;
}

/** Host suffixes from the ignore file ({ hosts: [{ host, reason }] }); none when it is missing. */
export function loadIgnoreHosts(path) {
  if (!existsSync(path)) return [];
  const raw = JSON.parse(readFileSync(path, "utf8"));
  return Array.isArray(raw.hosts) ? raw.hosts.map((h) => (typeof h === "string" ? h : h.host)).filter(Boolean) : [];
}

function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** True when the URL's host is a listed host or one of its subdomains. */
export function isIgnored(url, hosts) {
  const host = hostOf(url);
  if (!host) return false;
  return hosts.some((h) => host === h || host.endsWith(`.${h}`));
}

function sameSite(a, b) {
  const strip = (h) => (h ?? "").replace(/^www\./, "");
  return strip(hostOf(a)) === strip(hostOf(b));
}

// ---- requesting --------------------------------------------------------------

/** Spaces the requests to one host so no more than `perSecond` start in any second. */
export function createHostLimiter({ perSecond = PER_HOST_PER_SECOND, now = () => Date.now(), sleep = (ms) => delay(ms) } = {}) {
  const gap = 1000 / perSecond;
  const last = new Map();
  return {
    async wait(host) {
      const prev = last.get(host);
      if (prev !== undefined) {
        const ready = prev + gap;
        const t = now();
        if (t < ready) await sleep(ready - t);
      }
      last.set(host, now());
    },
  };
}

function classifyError(error, timeoutMs) {
  if (error?.name === "TimeoutError" || error?.name === "AbortError") {
    return { kind: "unreachable", detail: `no answer within ${Math.round(timeoutMs / 1000)} s` };
  }
  const code = error?.cause?.code ?? error?.code ?? error?.message ?? "error";
  if (/CERT|TLS|SSL/i.test(String(code))) return { kind: "tls", detail: String(code) };
  return { kind: "unreachable", detail: String(code) };
}

/**
 * One request, following redirects by hand so that every hop (http to https, a
 * trailing slash, another host) waits for its own host's turn in the limiter.
 */
async function request(url, method, { fetchImpl, limiter, timeoutMs }) {
  let current = url;
  for (let hop = 0; ; hop++) {
    await limiter.wait(hostOf(current));
    let res;
    try {
      res = await fetchImpl(current, {
        method,
        redirect: "manual",
        headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml,*/*;q=0.8" },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      return { error };
    }
    // Free the socket: only the status, the Location and the final URL matter.
    if (res.body && typeof res.body.cancel === "function") await res.body.cancel().catch(() => {});
    const location = res.status >= 300 && res.status < 400 ? res.headers?.get?.("location") : null;
    if (!location) return { status: res.status, finalUrl: res.url || current };
    if (hop >= MAX_REDIRECTS) return { error: new Error("too many redirects") };
    try {
      current = new URL(location, current).href;
    } catch {
      return { error: new Error("bad redirect location") };
    }
  }
}

function classifyResponse(url, { status, finalUrl }) {
  if (status >= 400) return { url, kind: "http", status };
  if (!sameSite(url, finalUrl)) return { url, kind: "redirect", status, finalUrl };
  return { url, kind: "ok", status };
}

/**
 * Check one URL: HEAD, then GET when HEAD errors or answers >= 400.
 * @returns {Promise<{ url: string, kind: 'ok'|'http'|'redirect'|'tls'|'unreachable', status?: number, finalUrl?: string, detail?: string }>}
 */
export async function checkUrl(url, { fetchImpl = fetch, limiter = createHostLimiter(), timeoutMs = TIMEOUT_MS } = {}) {
  const opts = { fetchImpl, limiter, timeoutMs };
  const head = await request(url, "HEAD", opts);
  if (!head.error && head.status < 400) return classifyResponse(url, head);
  const get = await request(url, "GET", opts);
  if (!get.error) return classifyResponse(url, get);
  return { url, ...classifyError(get.error, timeoutMs) };
}

/**
 * Check every URL (each host in turn, hosts in parallel).
 * @param {Map<string, unknown>} urls
 * @returns {Promise<{ checked: number, ignored: string[], ignoreHosts: string[], problems: Array<ReturnType<typeof checkUrl> extends Promise<infer R> ? R : never> }>}
 */
export async function checkAll(urls, { fetchImpl = fetch, ignoreHosts = [], limiter = createHostLimiter(), timeoutMs = TIMEOUT_MS } = {}) {
  const ignored = [];
  const byHost = new Map();
  for (const url of [...urls.keys()].sort()) {
    if (isIgnored(url, ignoreHosts)) {
      ignored.push(url);
      continue;
    }
    const host = hostOf(url) ?? "";
    byHost.set(host, [...(byHost.get(host) ?? []), url]);
  }
  const results = [];
  await Promise.all(
    [...byHost.values()].map(async (list) => {
      for (const url of list) results.push(await checkUrl(url, { fetchImpl, limiter, timeoutMs }));
    })
  );
  const problems = results.filter((r) => r.kind !== "ok").sort((a, b) => a.url.localeCompare(b.url));
  return { checked: results.length, ignored, ignoreHosts, problems };
}

// ---- reporting ---------------------------------------------------------------

const SECTIONS = [
  ["http", "Error status (4xx or 5xx)", (p) => `${p.status} ${p.url}`],
  ["redirect", "Redirected to another host", (p) => `${p.url} -> ${p.finalUrl}`],
  ["tls", "TLS failure", (p) => `${p.detail} ${p.url}`],
  ["unreachable", "Could not reach (timeout, reset or unknown host; often a bot block rather than a dead page)", (p) => `${p.detail} ${p.url}`],
];

/** The Markdown issue body. */
export function formatReport(result, { date, citations }) {
  const head = [
    `## Source link check, ${date}`,
    "",
    `${result.checked} URL(s) checked, ${result.problems.length} problem(s). Generated by \`scripts/check-source-links.mjs\` (F-STORY-001 §3.7).`,
    "",
  ];
  const tail = [
    "",
    "### What to do",
    "",
    "A dead link does not make a fact wrong. For each one: open it by hand, then re-verify the fact, replace the source (raise that fact's `rev` and the story's `contentVer`), or leave it. A host that always blocks automated requests can go in `scripts/source-link-ignore.json` with a reason.",
  ];
  if (result.ignored.length > 0) {
    tail.unshift(
      "",
      `Skipped ${result.ignored.length} URL(s) on hosts that block automated requests (scripts/source-link-ignore.json): ${result.ignoreHosts.join(", ")}.`
    );
  }

  const body = [];
  for (const [kind, title, line] of SECTIONS) {
    const items = result.problems.filter((p) => p.kind === kind);
    if (items.length === 0) continue;
    body.push(`### ${title}`, "");
    for (const p of items) {
      body.push(`- ${line(p)}`);
      for (const c of citations.get(p.url) ?? []) body.push(`  - cited by ${c.file} ${c.factId}`);
    }
    body.push("");
  }

  const fixed = head.join("\n").length + tail.join("\n").length + 200;
  const kept = [];
  let size = 0;
  for (const l of body) {
    if (size + l.length + 1 + fixed > REPORT_LIMIT) {
      kept.push("", `(list cut short at the issue size limit; run node scripts/check-source-links.mjs locally for the full list)`);
      break;
    }
    kept.push(l);
    size += l.length + 1;
  }
  return [...head, ...kept, ...tail, ""].join("\n");
}

// ---- CLI ---------------------------------------------------------------------

function parseArgs(argv) {
  const args = { out: null, list: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--list") args.list = true;
    else if (argv[i] === "--out" && argv[i + 1]) args.out = argv[++i];
    else throw new Error(`unknown argument ${argv[i]}; usage: node scripts/check-source-links.mjs [--out <report.md>] [--list]`);
  }
  return args;
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    process.stdout.write(`::error::${error.message}\n`);
    return 1;
  }

  const urls = collectSourceUrls(ROOT);
  if (args.list) {
    for (const url of [...urls.keys()].sort()) process.stdout.write(`${url}\n`);
    return 0;
  }

  const ignoreHosts = loadIgnoreHosts(IGNORE_FILE);
  const result = await checkAll(urls, { ignoreHosts });
  const date = new Date().toISOString().slice(0, 10);
  const report = formatReport(result, { date, citations: urls });

  process.stdout.write(
    `check-source-links: ${result.checked} URL(s) checked, ${result.ignored.length} skipped (ignore list), ${result.problems.length} problem(s)\n`
  );
  if (result.problems.length > 0) process.stdout.write(`\n${report}`);

  if (args.out) {
    if (result.problems.length > 0) writeFileSync(args.out, report);
    else rmSync(args.out, { force: true });
  }
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `problems=${result.problems.length}\n`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
