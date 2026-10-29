// Structured data (JSON-LD) for every page, from facts already on the page only: names, copy,
// version, author, licence, links. No ratings, counts or quotes. Plain JS so the Astro pages and
// scripts/pages.mjs (the served /play/ and /v/<version>/ copies of dist) share one source.
const author = { "@type": "Person", name: "Chris Cooley", url: "https://coded.design/" };
const publisher = { "@type": "Organization", name: "coded.design", url: "https://coded.design/" };

// A game's landing page: the site and the game. basedOn: { name, url } of the game it is a version of.
export function gameLd({ home, name, description, image, version, play, basedOn }) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", "@id": `${home}#website`, name, url: home, inLanguage: "en" },
      {
        "@type": "VideoGame",
        "@id": `${home}#game`,
        name,
        url: home,
        description,
        image,
        author,
        creator: author,
        publisher,
        gamePlatform: "Web browser",
        applicationCategory: "Game",
        softwareVersion: version,
        license: "https://opensource.org/licenses/MIT",
        ...(basedOn ? { isBasedOn: { "@type": "VideoGame", ...basedOn } } : {}),
        potentialAction: { "@type": "PlayAction", target: play },
      },
    ],
  };
}

// Any other page of a game's site. crumbs: [[name, url], ...] from the home page down to this page;
// aboutGame: false for a page that is not about the game itself (the style guide).
export function pageLd({ url, name, description, home, site, version, crumbs, aboutGame = true }) {
  const graph = [
    {
      "@type": "WebPage",
      "@id": url,
      url,
      name,
      description,
      inLanguage: "en",
      ...(version ? { version } : {}),
      isPartOf: { "@type": "WebSite", "@id": `${home}#website`, name: site, url: home },
      ...(aboutGame ? { about: { "@type": "VideoGame", "@id": `${home}#game`, name: site, url: home } } : {}),
    },
  ];
  if (crumbs?.length)
    graph.push({
      "@type": "BreadcrumbList",
      itemListElement: crumbs.map(([n, item], i) => ({ "@type": "ListItem", position: i + 1, name: n, item })),
    });
  return { "@context": "https://schema.org", "@graph": graph };
}

// Safe inside <script>: no "</script>" can close the block early.
export const ldJson = (ld) => JSON.stringify(ld).replace(/</g, "\\u003c");
