import path from "node:path";
import { readFile } from "node:fs/promises";
import matter from "gray-matter";
import fg from "fast-glob";
import { marked } from "marked";

export type PostMeta = {
  title: string;
  slug: string;
  date: string;
  excerpt: string;
  tags: string[];
  cover_image: string;
  cover_image_alt: string;
  cover_image_width?: number;
  cover_image_height?: number;
  updated?: string;
  published: boolean;
  url: string;
};

export type ArtMeta = {
  title: string;
  slug: string;
  date: string;
  medium: string;
  dimensions: string;
  cover_image: string;
  cover_image_alt: string;
  cover_image_width?: number;
  cover_image_height?: number;
  gallery: string[];
  tags: string[];
  updated?: string;
  published: boolean;
  url: string;
};

export type Post = PostMeta & { content: string };
export type Artwork = ArtMeta & { content: string };

export type PageMeta = {
  title: string;
  kicker?: string;
  intro?: string;
  permalink: string;
  meta_title?: string;
  meta_description?: string;
  social_image?: string;
  canonical_path?: string;
  content: string;
};

export type HomeMeta = {
  title: string;
  hero_title: string;
  hero_copy: string;
};

marked.setOptions({ gfm: true, breaks: false });
const UNKNOWN_DATE = "1970-01-01";
const fileDatePattern = /^(\d{4}-\d{2}-\d{2})-/;
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const imageMetaCache = new Map<string, { width?: number; height?: number }>();

const toString = (value: unknown, fallback = ""): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return fallback;
};

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter(Boolean);
};

const inferPostSlug = (filePath: string): string => {
  const base = path.basename(filePath, path.extname(filePath));
  const match = base.match(/^\d{4}-\d{2}-\d{2}-(.+)$/);
  return match ? match[1] : base;
};

const inferDate = (filePath: string): string => {
  const base = path.basename(filePath, path.extname(filePath));
  const match = base.match(fileDatePattern);
  return match ? match[1] : "";
};

const toIsoDate = (value: unknown): string => {
  const raw = toString(value).trim();
  if (!raw) return "";
  if (!isoDatePattern.test(raw)) return "";
  const parsed = new Date(`${raw}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? "" : raw;
};

const withDateFallback = (value: unknown, filePath: string, fieldName: "date" | "updated"): string | undefined => {
  const normalized = toIsoDate(value);
  if (normalized) return normalized;

  if (fieldName === "updated") {
    if (value !== undefined) {
      console.warn(`[content] ${filePath}: invalid updated "${String(value)}" (expected YYYY-MM-DD), ignoring.`);
    }
    return undefined;
  }

  const inferred = inferDate(filePath);
  if (inferred) {
    console.warn(`[content] ${filePath}: missing/invalid date, falling back to filename date ${inferred}.`);
    return inferred;
  }

  console.warn(
    `[content] ${filePath}: missing/invalid date and no filename date prefix; falling back to ${UNKNOWN_DATE}.`
  );
  return UNKNOWN_DATE;
};

const normalizeTags = (value: unknown): string[] => {
  const tags = toStringArray(value)
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set(tags));
};

const parseNumeric = (value: string | undefined): number | undefined => {
  if (!value) return undefined;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

async function getImageDimensions(publicPath: string): Promise<{ width?: number; height?: number }> {
  if (!publicPath || !publicPath.startsWith("/assets/") || !publicPath.endsWith(".svg")) {
    return {};
  }

  const cached = imageMetaCache.get(publicPath);
  if (cached) return cached;

  try {
    const fullPath = path.join(process.cwd(), publicPath.replace(/^\//, ""));
    const svg = await readFile(fullPath, "utf8");
    const widthMatch = svg.match(/\bwidth=['"]([\d.]+)(?:px)?['"]/i);
    const heightMatch = svg.match(/\bheight=['"]([\d.]+)(?:px)?['"]/i);
    let width = parseNumeric(widthMatch?.[1]);
    let height = parseNumeric(heightMatch?.[1]);

    if ((!width || !height) && /\bviewBox=['"]([^'"]+)['"]/i.test(svg)) {
      const viewBox = svg.match(/\bviewBox=['"]([^'"]+)['"]/i)?.[1] ?? "";
      const parts = viewBox.trim().split(/[\s,]+/).map(Number);
      if (parts.length === 4 && Number.isFinite(parts[2]) && Number.isFinite(parts[3])) {
        width = width ?? parts[2];
        height = height ?? parts[3];
      }
    }

    const result = { width, height };
    imageMetaCache.set(publicPath, result);
    return result;
  } catch {
    return {};
  }
}

export async function loadPosts(): Promise<Post[]> {
  const files = await fg("content/posts/*.md", { dot: false });

  const posts = await Promise.all(
    files.map(async (filePath) => {
      const raw = await Bun.file(filePath).text();
      const { data, content } = matter(raw);
      const slug = toString(data.slug, inferPostSlug(filePath));
      const date = withDateFallback(data.date, filePath, "date") ?? UNKNOWN_DATE;
      const updated = withDateFallback(data.updated, filePath, "updated");
      const title = toString(data.title, slug.replace(/-/g, " "));
      const excerpt = toString(data.excerpt, "");
      const coverImage = toString(data.cover_image, "");
      const coverImageAlt = toString(data.image_alt, title);
      const tags = normalizeTags(data.tags);
      const published = data.published !== false;
      const html = await marked.parse(content);
      const dimensions = await getImageDimensions(coverImage);

      if (!toString(data.title).trim()) {
        console.warn(`[content] ${filePath}: missing title, using slug-derived fallback "${title}".`);
      }
      if (coverImage && !toString(data.image_alt).trim()) {
        console.warn(`[content] ${filePath}: missing image_alt, using title fallback.`);
      }

      return {
        title,
        slug,
        date,
        excerpt,
        tags,
        cover_image: coverImage,
        cover_image_alt: coverImageAlt,
        cover_image_width: dimensions.width,
        cover_image_height: dimensions.height,
        updated,
        published,
        url: `/blog/${slug}/`,
        content: html
      } satisfies Post;
    })
  );

  return posts
    .filter((post) => post.published)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function loadArtworks(): Promise<Artwork[]> {
  const files = await fg("content/art/*.md", { dot: false });

  const artworks = await Promise.all(
    files.map(async (filePath) => {
      const raw = await Bun.file(filePath).text();
      const { data, content } = matter(raw);
      const slug = toString(data.slug, path.basename(filePath, path.extname(filePath)));
      const date = withDateFallback(data.date, filePath, "date") ?? UNKNOWN_DATE;
      const updated = withDateFallback(data.updated, filePath, "updated");
      const title = toString(data.title, slug.replace(/-/g, " "));
      const medium = toString(data.medium, "Mixed media");
      const dimensions = toString(data.dimensions, "Unknown dimensions");
      const coverImage = toString(data.cover_image, "");
      const coverImageAlt = toString(data.image_alt, title);
      const gallery = toStringArray(data.gallery);
      const tags = normalizeTags(data.tags);
      const published = data.published !== false;
      const html = await marked.parse(content);
      const imageDimensions = await getImageDimensions(coverImage);

      if (!toString(data.title).trim()) {
        console.warn(`[content] ${filePath}: missing title, using slug-derived fallback "${title}".`);
      }
      if (coverImage && !toString(data.image_alt).trim()) {
        console.warn(`[content] ${filePath}: missing image_alt, using title fallback.`);
      }

      return {
        title,
        slug,
        date,
        medium,
        dimensions,
        cover_image: coverImage,
        cover_image_alt: coverImageAlt,
        cover_image_width: imageDimensions.width,
        cover_image_height: imageDimensions.height,
        gallery,
        tags,
        updated,
        published,
        url: `/art/${slug}/`,
        content: html
      } satisfies Artwork;
    })
  );

  return artworks
    .filter((artwork) => artwork.published)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function loadPages(): Promise<Record<string, PageMeta>> {
  const files = await fg("content/pages/*.md", { dot: false });
  const entries = await Promise.all(
    files.map(async (filePath) => {
      const raw = await Bun.file(filePath).text();
      const { data, content } = matter(raw);
      const html = await marked.parse(content);
      const key = path.basename(filePath, path.extname(filePath));
      const page: PageMeta = {
        title: toString(data.title, key),
        kicker: toString(data.kicker),
        intro: toString(data.intro),
        permalink: toString(data.permalink, `/${key}/`),
        meta_title: toString(data.meta_title),
        meta_description: toString(data.meta_description),
        social_image: toString(data.social_image),
        canonical_path: toString(data.canonical_path),
        content: html
      };
      return [key, page] as const;
    })
  );

  return Object.fromEntries(entries);
}

export async function loadHomeMeta(): Promise<HomeMeta> {
  const raw = await Bun.file("content/pages/home.json").text();
  const parsed = JSON.parse(raw) as Partial<HomeMeta>;
  return {
    title: parsed.title ?? "Home",
    hero_title: parsed.hero_title ?? "A quiet exhibition.",
    hero_copy: parsed.hero_copy ?? ""
  };
}
