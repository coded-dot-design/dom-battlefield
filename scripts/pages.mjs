// After `astro build`: copy the committed game build (dist) to /play/ and check the site links up.
// artifacts/pages is exactly what GitHub Pages serves:
//   /                landing page        (site/src/pages/index.astro)
//   /style-guide/    Board UI guide      (site/src/pages/style-guide/index.astro)
//   /play/           the game            (dist, the same bytes the DOM VIRUS hub ships)
//   /v/<version>/    past builds         (each release's own dist, pinned in site/archive.json)
//   /robots.txt, /sitemap.xml, /llms.txt   from the built pages (scripts/discovery.mjs)
import { cpSync, existsSync, readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { archiveBuilds } from "./archive.mjs";
import { pageLd, ldJson } from "../site/src/schema.mjs";
import { writeDiscovery } from "./discovery.mjs";

const out = resolve("artifacts/pages");
if (!existsSync(join(out, "index.html"))) throw Error("Run astro build first (npm run site:build).");
if (!existsSync("dist/index.html")) throw Error("Build the game first (npm run build).");
cpSync("dist", join(out, "play"), { recursive: true });
// The served copies of dist (/play/, /v/<version>/) get the head every page of the site has: canonical,
// share tags and JSON-LD (from the page's own title and description). dist stays the bytes the hub ships.
const home = new URL((process.env.SITE_BASE || "/dom-battlefield").replace(/\/?$/, "/"), process.env.SITE_URL || "https://coded-dot-design.github.io").href;
const playUrl = `${home}play/`;
const unescape = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const attr = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
function servedHead(html, { url, crumbs, version }) {
  if (!html.includes("</head>")) throw Error(`${url}: no </head>`);
  const read = (re) => unescape((html.match(re)?.[1] ?? "").replace(/\s+/g, " ").trim());
  const title = read(/<title>([^<]*)<\/title>/);
  const description = read(/<meta\s+name="description"\s+content="([^"]*)"/);
  const add = [];
  if (!html.includes('rel="canonical"')) add.push(`<link rel="canonical" href="${playUrl}">`);
  if (!html.includes('property="og:'))
    add.push(
      '<meta property="og:type" content="website">',
      `<meta property="og:title" content="${attr(title)}">`,
      `<meta property="og:description" content="${attr(description)}">`,
      `<meta property="og:url" content="${playUrl}">`,
      `<meta property="og:image" content="${home}shots/og.png">`,
      '<meta name="twitter:card" content="summary_large_image">',
    );
  if (!html.includes("application/ld+json"))
    add.push(`<script type="application/ld+json">${ldJson(pageLd({ url, name: title, description, home, site: "DOM Battlefield", version, crumbs }))}</script>`);
  return html.replace("</head>", `${add.map((l) => `  ${l}\n`).join("")}  </head>`);
}
const playPage = join(out, "play/index.html");
writeFileSync(playPage, servedHead(readFileSync(playPage, "utf8"), { url: playUrl, crumbs: [["DOM Battlefield", home], ["Play", playUrl]] }));

// Released builds (/v/<version>/, noindex) point search engines and shares at /play/ (canonical, og:url).
const archived = archiveBuilds(out, (html, version) =>
  servedHead(html, { url: `${home}v/${version}/`, version, crumbs: [["DOM Battlefield", home], [version, `${home}v/${version}/`]] }));
console.log(`Released builds: ${archived} at /v/<version>/`);

// Battlefield Blitz drop-in: the pinned build from vendor/blitz (repo dom-battlefield-blitz).
mkdirSync(join(out, "blitz"), { recursive: true });
cpSync("vendor/blitz/blitz.js", join(out, "blitz/blitz.js"));
const blitzPin = JSON.parse(readFileSync("vendor/blitz/ORIGIN.json", "utf8"));
console.log(`Blitz ${blitzPin.version}: /blitz/ (about), /blitz/play/ (game), /blitz/blitz.js (drop-in)`);

// Search engines and LLM readers: robots.txt, sitemap.xml, llms.txt (indexable pages only).
console.log(`Discovery: ${writeDiscovery(out, home, "DOM Battlefield").length} pages in sitemap.xml and llms.txt`);

// Every local href/src in the built pages must resolve to a file.
const BASE = `${(process.env.SITE_BASE || "/dom-battlefield").replace(/\/$/, "")}/`;
const pages = [];
const walk = (dir) => readdirSync(dir).forEach((n) => {
  const f = join(dir, n);
  if (statSync(f).isDirectory()) walk(f);
  else if (f.endsWith(".html")) pages.push(f);
});
walk(out);
const missing = [];
for (const page of pages) {
  if (page.startsWith(join(out, "play")) || page.startsWith(join(out, "v") + "/")) continue;
  const html = readFileSync(page, "utf8");
  for (const [, url] of html.matchAll(/(?:href|src)="([^"#?]+)/g)) {
    if (/^(https?:|mailto:|data:)/.test(url)) continue;
    let path = url.startsWith(BASE) ? url.slice(BASE.length) : url.startsWith("/") ? null : join(dirname(page).slice(out.length + 1), url);
    if (path === null) {
      missing.push(`${page}: ${url} (outside ${BASE})`);
      continue;
    }
    let file = join(out, path);
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if (!existsSync(file)) missing.push(`${page.slice(out.length)}: ${url}`);
  }
}
if (missing.length) throw Error(`Broken links:\n${missing.join("\n")}`);
console.log(`Pages ready: ${pages.length} pages, game at /play/ (${JSON.parse(readFileSync("dist/build.json", "utf8")).version ?? "dist"}).`);
