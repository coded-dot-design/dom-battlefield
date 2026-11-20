// The DOM Battlefield site (Cloudflare Pages, battlefield.fzlt.games): landing page (/), Board UI style guide
// (/style-guide/) and the game itself (/play/, copied from dist by scripts/pages.mjs).
import { defineConfig } from "astro/config";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url));
export default defineConfig({
  root,
  srcDir: root + "site/src",
  publicDir: root + "site/public",
  outDir: root + "artifacts/pages",
  // Defaults: the production host at the root; SITE_URL / SITE_BASE (build env) override per target.
  site: process.env.SITE_URL || "https://battlefield.fzlt.games",
  base: process.env.SITE_BASE || "/",
  trailingSlash: "always",
  output: "static",
  devToolbar: { enabled: false },
  server: { host: "127.0.0.1", port: 4321 },
});
