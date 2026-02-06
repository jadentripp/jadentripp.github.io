import path from "node:path";
import pug from "pug";
import type { SiteMeta } from "../../site.config";

export type RenderLocals = Record<string, unknown>;

export const toUrl = (pathname: string, basePath: string): string => {
  if (/^(https?:)?\/\//.test(pathname) || pathname.startsWith("#") || pathname.startsWith("mailto:")) {
    return pathname;
  }

  const cleanBase = basePath.replace(/\/$/, "");
  const cleanPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return cleanBase ? `${cleanBase}${cleanPath}` : cleanPath;
};

const monthShort = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric"
});

const monthLong = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric"
});

export const formatDate = (date: string, style: "short" | "long"): string => {
  const parsed = new Date(date);
  return style === "short" ? monthShort.format(parsed) : monthLong.format(parsed);
};

export const formatYear = (date: string): string => String(new Date(date).getFullYear());

export function renderTemplate(
  templateName: string,
  site: SiteMeta,
  locals: RenderLocals
): string {
  const templatePath = path.join(process.cwd(), "src/templates", `${templateName}.pug`);

  return pug.renderFile(templatePath, {
    site,
    year: new Date().getFullYear(),
    u: (pathname: string) => toUrl(pathname, site.basePath),
    formatDate,
    formatYear,
    ...locals
  });
}
