// Past builds: copy each pinned release's committed dist, byte for byte, to /v/<version>/.
// site/archive.json pins every version to a commit (npm run sync:archive); the current build
// stays at /play/ and is never touched here.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const REPO = "https://github.com/coded-dot-design/dom-battlefield.git";

export function archiveBuilds(out, playUrl) {
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
    const html = readFileSync(page, "utf8");
    if (!html.includes('rel="canonical"'))
      writeFileSync(page, html.replace("</head>", `  <link rel="canonical" href="${playUrl}">\n  </head>`));
  }
  return archive.length;
}
