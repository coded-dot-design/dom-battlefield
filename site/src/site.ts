// Shared site facts (read at build time).
import pkg from "../../package.json";
export const VERSION = pkg.version;
export const REPO = "https://github.com/coded-dot-design/dom-battlefield";
export const HUB = "https://coded-dot-design.github.io/dom-virus/";
export const HUB_GAME = `${HUB}games/battlefield/`;
export const base = (path = "") => `${import.meta.env.BASE_URL.replace(/\/$/, "")}/${path}`;
