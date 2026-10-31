// This site's settings for the analytics-only consent pattern (the other files in this folder are the
// astro-engine kit, kit/src/lib/analytics, copied as is). GA4 + PostHog load only after Accept, and only
// on a build with PUBLIC_GA4_ID or PUBLIC_POSTHOG_KEY set (repository Variables): with neither set this
// returns '' and the pages ship no analytics code at all.
import { resolveAnalytics } from "./config.mjs";
import { analyticsSnippet } from "./snippet.mjs";

export const SITE = {
  storageKey: "dom-battlefield:consent",
  privacyUrl: "https://domvirus.com/legal/privacy/",
  cookiesUrl: "https://domvirus.com/legal/cookies/",
  text: "With your OK we use Google Analytics and PostHog to count visits and see how the games are played. No ads, no selling data.",
};

/** The end-of-<body> HTML for one build: the consent runtime, or '' (no ids). */
export function consentSnippet(env) {
  return analyticsSnippet(resolveAnalytics(env), SITE);
}
