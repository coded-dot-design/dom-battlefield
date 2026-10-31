// The site map: one source for every public page of this site and the footer groups that list them.
// Plain JS so the footer (site/src/components/SiteFooter.astro), the build (scripts/pages.mjs) and the
// tests share it. A new page goes here, or under HIDDEN, or the build fails; the footer lists it.

// Footer columns, in order.
export const GROUPS = [
  { id: "play", title: "Play" },
  { id: "guide", title: "Guide" },
  { id: "board", title: "Board UI" },
  { id: "family", title: "DOM VIRUS family" },
  { id: "about", title: "About & legal" },
];

// The family line: the same four sites, in the same order, in every family footer (domvirus.com,
// battlefield.domvirus.com, battlefieldblitz.domvirus.com and fizlet.com list it too). Production
// URLs; Fizlet is the engine. This site's own entry (SELF) has no ↗. Other hosts never go in sitemap.xml.
export const FAMILY_LINE = [
  { label: "DOM VIRUS", href: "https://domvirus.com/" },
  { label: "DOM Battlefield", href: "https://battlefield.domvirus.com/" },
  { label: "Battlefield Blitz", href: "https://battlefieldblitz.domvirus.com/" },
  { label: "Built with Fizlet", href: "https://fizlet.com/", engine: true },
];
export const SELF = "https://battlefield.domvirus.com/";

// Every public, indexable page: path under the site base, footer label, footer group. sections:
// headings on that page worth a link of their own (id on the page), in the page's group unless set.
export const PAGES = [
  { path: "play/", label: "Play DOM Battlefield", group: "play" },
  {
    path: "",
    label: "Overview",
    group: "guide",
    sections: [
      { id: "how", label: "How it plays" },
      { id: "radio", label: "Five radio keys" },
      { id: "fronts", label: "The four fronts" },
      { id: "anywhere", label: "Every screen" },
      { id: "builds", label: "Every build", group: "play" },
    ],
  },
  {
    path: "style-guide/",
    label: "Style guide",
    group: "board",
    sections: [
      { id: "principles", label: "Principles" },
      { id: "palette", label: "Palette" },
      { id: "key", label: "The 3D key" },
      { id: "cards", label: "Cards" },
      { id: "layouts", label: "Layouts" },
      { id: "build", label: "Build a board" },
    ],
  },
];

// Built pages that stay out of the site map (and the footer), and why.
export const HIDDEN = [
  { match: /^v\/[^/]+\/$/, why: "released builds: noindex, canonical on /play/" },
  { match: /^blitz\//, why: "old Blitz links: canonical on battlefieldblitz.domvirus.com" },
];
export const hidden = (path) => HIDDEN.some((h) => h.match.test(path));
