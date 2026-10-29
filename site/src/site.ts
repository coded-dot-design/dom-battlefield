// Shared site facts (read at build time).
import pkg from "../../package.json";
export const VERSION = pkg.version;
export const REPO = "https://github.com/coded-dot-design/dom-battlefield";
export const HUB = "https://domvirus.com/";
// Blitz has its own site (dom-battlefield-blitz, blitz.domvirus.com); /blitz/ here stays for old links.
export const BLITZ = "https://blitz.domvirus.com/";
export const HUB_GAME = `${HUB}games/battlefield/`;
export const base = (path = "") => `${import.meta.env.BASE_URL.replace(/\/$/, "")}/${path}`;
