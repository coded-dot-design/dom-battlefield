// Shared site facts (read at build time).
import pkg from "../../package.json";
export const VERSION = pkg.version;
export const REPO = "https://github.com/coded-dot-design/dom-battlefield";
export const HUB = "https://domvirus.com/";
// Blitz has its own site (dom-battlefield-blitz, battlefieldblitz.domvirus.com); /blitz/ here stays for old links.
export const BLITZ = "https://battlefieldblitz.domvirus.com/";
export const HUB_GAME = `${HUB}games/battlefield/`;
// The other released games in the DOM VIRUS family (dom-virus brand/family.json, production URLs).
export const FAMILY = [
  ["Battlefield Blitz", BLITZ],
  ["Sherman Bytes", `${HUB}games/sherman-bytes/`],
  ["Swarm Protocol", `${HUB}games/swarm-protocol/`],
  ["Byte Runner", `${HUB}games/byte-runner/`],
  ["Null Invaders", `${HUB}games/null-invaders/`],
];
export const FIZLET = "https://github.com/coded-dot-design/fizlet";
export const base = (path = "") => `${import.meta.env.BASE_URL.replace(/\/$/, "")}/${path}`;
// An absolute URL on this site (canonical, JSON-LD).
export const abs = (path: string, site: URL | undefined) => new URL(base(path), site).href;
