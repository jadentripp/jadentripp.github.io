export type SiteMeta = {
  title: string;
  description: string;
  lang: string;
  url: string;
  basePath: string;
  showWriteLink: boolean;
};

const basePath = process.env.BASE_PATH ?? "";
const showWriteLink = process.env.LOCAL_DEV === "true";

export const site: SiteMeta = {
  title: "Jaden Tripp",
  description: "A personal space for essays, artwork, and creative experiments.",
  lang: "en-US",
  url: "https://jadentripp.github.io",
  basePath,
  showWriteLink
};
