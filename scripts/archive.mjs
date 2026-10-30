// Released builds: copy each pinned release's committed dist, byte for byte, to /v/<version>/.
// site/archive.json pins every released version, the current one included, to its tag's commit
// (npm run sync:archive); /play/ keeps serving the working tree's dist and is never touched here.
// Every /v/<version>/ page is noindex: search engines should only ever list /play/.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const REPO = "https://github.com/coded-dot-design/dom-battlefield.git";
export const NOINDEX = '<meta name="robots" content="noindex">';

const parse = (v) => v.slice(1).split(".").map(Number);
export const compare = (a, b) => {
  const [x, y] = [parse(a), parse(b)];
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
};

/** `git ls-remote --tags` output → every vX.Y.Z tag up to `current`, newest first, each pinned to its
 *  commit. Peeled (^{}) entries name the commit behind an annotated tag. */
export function releasedBuilds(lsRemote, current) {
  const tags = new Map();
  for (const line of lsRemote.trim().split("\n")) {
    const [commit, ref] = line.split("\t");
    const match = /^refs\/tags\/(v\d+\.\d+\.\d+)(\^\{\})?$/.exec(ref ?? "");
    if (match && (match[2] || !tags.has(match[1]))) tags.set(match[1], commit);
  }
  return [...tags]
    .filter(([v]) => compare(v, current) <= 0)
    .sort(([a], [b]) => compare(b, a))
    .map(([version, commit]) => ({ version, commit }));
}
export const remoteTags = () => execFileSync("git", ["ls-remote", "--tags", REPO], { encoding: "utf8" });

// head(html, version): the served page's <head> additions (scripts/pages.mjs: canonical to /play/, share tags, JSON-LD).
export function archiveBuilds(out, head) {
  const archive = JSON.parse(readFileSync("site/archive.json", "utf8"));
  if (!archive.length) return 0;
  const git = resolve("artifacts/archive-src.git");
  if (!existsSync(git)) execFileSync("git", ["clone", "--quiet", "--bare", REPO, git], { stdio: "inherit" });
  for (const { version, commit } of archive) {
    if (!/^v\d+\.\d+\.\d+$/.test(version) || !/^[a-f0-9]{40}$/.test(commit)) throw Error(`Invalid archive pin: ${version}`);
    const dest = join(out, "v", version);
    rmSync(dest, { recursive: true, force: true });
    mkdirSync(dest, { recursive: true });
    const tar = execFileSync("git", ["--git-dir", git, "archive", commit, "dist"], { maxBuffer: 64 << 20 });
    execFileSync("tar", ["-x", "--strip-components=1", "-C", dest], { input: tar });
    const manifest = JSON.parse(readFileSync(join(dest, "build.json"), "utf8"));
    if (`v${manifest.version}` !== version) throw Error(`Archive ${version} holds build ${manifest.version}`);
    for (const [file, hash] of Object.entries(manifest.files ?? {})) {
      if (file.includes("..") || file.startsWith("/")) throw Error(`Invalid archive asset path: ${file}`);
      if (createHash("sha256").update(readFileSync(join(dest, file))).digest("hex") !== hash)
        throw Error(`Archive ${version} asset mismatch: ${file}`);
    }
    // Search engines should send people to the current build, not an old one.
    const page = join(dest, "index.html");
    let html = head(readFileSync(page, "utf8"), version);
    if (!/<meta\s+name="robots"/.test(html)) html = html.replace("</head>", `  ${NOINDEX}\n  </head>`);
    writeFileSync(page, html);
  }
  return archive.length;
}
