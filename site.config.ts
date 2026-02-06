export type SiteMeta = {
  title: string;
  description: string;
  lang: string;
  url: string;
  basePath: string;
};

const basePath = process.env.BASE_PATH ?? "";

export const site: SiteMeta = {
  title: "Jaden Tripp",
  description: "A personal space for essays, artwork, and creative experiments.",
  lang: "en-US",
  url: "https://jadentripp.github.io",
  basePath
};
