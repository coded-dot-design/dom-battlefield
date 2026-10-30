// Released builds at /v/<version>/ (scripts/archive.mjs): every released tag is pinned in
// site/archive.json (fails when a release is missing: npm run sync:archive), each is served
// noindex with search engines pointed at /play/, the landing page's picker lists all of them, and
// 0.15.8 and the newest build (the current release once tagged) boot in Chromium.
// Run after `npm run build && npm run site:build` (needs the network for git ls-remote).
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { chromium } from "playwright";
import { releasedBuilds, remoteTags } from "../scripts/archive.mjs";

const current = `v${JSON.parse(readFileSync("package.json", "utf8")).version}`;
const archive = JSON.parse(readFileSync("site/archive.json", "utf8"));

// The tag reader: annotated tags resolve to their commit; nothing past the current version.
assert.deepEqual(
  releasedBuilds(
    [
      `${"a".repeat(40)}\trefs/tags/v1.1.0`,
      `${"b".repeat(40)}\trefs/tags/v1.0.0`,
      `${"c".repeat(40)}\trefs/tags/v1.0.0^{}`,
      `${"d".repeat(40)}\trefs/tags/v0.10.0`,
      `${"e".repeat(40)}\trefs/tags/v0.9.0`,
      `${"f".repeat(40)}\trefs/tags/engine-baseline`,
    ].join("\n"),
    "v1.0.0",
  ),
  [
    { version: "v1.0.0", commit: "c".repeat(40) },
    { version: "v0.10.0", commit: "d".repeat(40) },
    { version: "v0.9.0", commit: "e".repeat(40) },
  ],
);

// Every released tag up to the current version is pinned, at its tag's commit.
const released = releasedBuilds(remoteTags(), current);
const pinned = new Map(archive.map((b) => [b.version, b.commit]));
assert.deepEqual(
  released.filter((b) => !pinned.has(b.version)).map((b) => b.version),
  [],
  "released but not in site/archive.json (npm run sync:archive)",
);
for (const { version, commit } of released) assert.equal(pinned.get(version), commit, `${version}: tag moved`);
// The newest pinned build: the current release once it is tagged (a version bump lands before its tag).
const newest = archive[0].version;
assert.ok(pinned.has("v0.15.8"), "v0.15.8 is served at /v/v0.15.8/");
if (released.some((b) => b.version === current)) assert.equal(newest, current, `${current} is served at /v/${current}/`);

// Served pages: each build noindex, canonical and og:url to /play/; /play/ and the landing page stay indexable.
const root = resolve("artifacts/pages");
if (!existsSync(join(root, "index.html"))) throw Error("Build the site first: npm run site:build");
const robots = (html) => /<meta\s+name="robots"\s+content="[^"]*noindex/.test(html);
for (const { version } of archive) {
  const html = readFileSync(join(root, "v", version, "index.html"), "utf8");
  assert.ok(robots(html), `/v/${version}/ is noindex`);
  assert.match(html.match(/<link rel="canonical" href="([^"]+)"/)?.[1] ?? "", /\/play\/$/, `/v/${version}/ canonical is /play/`);
  assert.equal(`v${JSON.parse(readFileSync(join(root, "v", version, "build.json"), "utf8")).version}`, version);
}
for (const page of ["index.html", "play/index.html"])
  assert.equal(robots(readFileSync(join(root, page), "utf8")), false, `/${page} stays indexable`);
const landing = readFileSync(join(root, "index.html"), "utf8");
for (const { version } of archive) assert.ok(landing.includes(`/v/${version}/"`), `the picker offers ${version}`);
// The current release is marked in the picker once it is tagged.
if (newest === current) assert.ok(landing.includes(`>${current} · current</option>`), `the picker marks ${current} current`);

// 0.15.8 and the newest build boot from their own paths.
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".json": "application/json", ".webmanifest": "application/manifest+json" };
const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (!path.startsWith("/dom-battlefield/")) return res.writeHead(404).end();
  let file = join(root, path.slice("/dom-battlefield".length));
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (!existsSync(file)) return res.writeHead(404).end();
  res.writeHead(200, { "content-type": types[extname(file)] || "application/octet-stream" });
  res.end(readFileSync(file));
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const base = `http://127.0.0.1:${server.address().port}/dom-battlefield/`;
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && !/status of 404/.test(m.text()) && errors.push(m.text()));
  // Old builds predate the icon links, so the browser's own /favicon.ico probe may 404.
  const failed = [];
  page.on("response", (r) => r.status() >= 400 && !r.url().endsWith("/favicon.ico") && failed.push(r.url()));
  await page.goto(base);
  const pick = page.locator("[data-past-builds] select");
  for (const version of ["v0.15.8", newest]) {
    await page.goto(base);
    await pick.selectOption({ value: `/dom-battlefield/v/${version}/` });
    await page.locator("[data-past-builds] a").click();
    await page.waitForURL(new RegExp(`/v/${version.replaceAll(".", "\\.")}/$`));
    await page.waitForFunction(() => document.querySelector("#battlefield")?.children.length > 0);
    assert.equal(await page.locator('meta[name="robots"]').getAttribute("content"), "noindex");
  }
  assert.deepEqual(failed, []);
  assert.deepEqual(errors, [], "the builds run without errors");
} finally {
  await browser.close();
  server.close();
}
console.log(`Released builds: ${archive.length} pinned up to ${newest}, all noindex; v0.15.8 and ${newest} boot.`);
