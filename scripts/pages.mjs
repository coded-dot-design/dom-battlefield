// After `astro build`: copy the committed game build (dist) to /play/ and check the site links up.
// artifacts/pages is exactly what GitHub Pages serves:
//   /                landing page        (site/src/pages/index.astro)
//   /style-guide/    Board UI guide      (site/src/pages/style-guide/index.astro)
//   /play/           the game            (dist, the same bytes the DOM VIRUS hub ships)
import { cpSync, existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";

const out = resolve("artifacts/pages");
if (!existsSync(join(out, "index.html"))) throw Error("Run astro build first (npm run site:build).");
if (!existsSync("dist/index.html")) throw Error("Build the game first (npm run build).");
cpSync("dist", join(out, "play"), { recursive: true });

// Every local href/src in the built pages must resolve to a file.
const BASE = "/dom-battlefield/";
const pages = [];
const walk = (dir) => readdirSync(dir).forEach((n) => {
  const f = join(dir, n);
  if (statSync(f).isDirectory()) walk(f);
  else if (f.endsWith(".html")) pages.push(f);
});
walk(out);
const missing = [];
for (const page of pages) {
  if (page.startsWith(join(out, "play"))) continue;
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
