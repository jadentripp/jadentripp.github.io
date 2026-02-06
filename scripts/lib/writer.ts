import path from "node:path";
import { existsSync } from "node:fs";

export type WriterDraftInput = {
  title?: unknown;
  excerpt?: unknown;
  tags?: unknown;
  cover_image?: unknown;
  published?: unknown;
  slug?: unknown;
  date?: unknown;
  markdown?: unknown;
};

export type WriterDraftNormalized = {
  title: string;
  excerpt: string;
  tags: string[];
  cover_image: string;
  published: boolean;
  slug: string;
  date: string;
  markdown: string;
};

export type WriterValidationResult = {
  valid: boolean;
  errors: string[];
  normalized: WriterDraftNormalized;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const IMAGE_PATH_RE = /^\/assets\/images\/[a-zA-Z0-9._/-]+$/;

const toString = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value).trim();
  return "";
};

export const slugify = (value: string): string => {
  const cleaned = value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "untitled";
};

const normalizeTags = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((item) => toString(item)).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
  return [];
};

const normalizeDate = (value: unknown): string => {
  const asString = toString(value);
  if (DATE_RE.test(asString)) return asString;
  return new Date().toISOString().slice(0, 10);
};

export const validateDraft = (input: WriterDraftInput): WriterValidationResult => {
  const title = toString(input.title);
  const excerpt = toString(input.excerpt);
  const markdown = toString(input.markdown);
  const date = normalizeDate(input.date);
  const requestedSlug = toString(input.slug);
  const slug = slugify(requestedSlug || title);
  const tags = normalizeTags(input.tags);
  const coverImage = toString(input.cover_image);
  const published =
    typeof input.published === "boolean"
      ? input.published
      : String(input.published).toLowerCase() !== "false";

  const errors: string[] = [];
  if (!title) errors.push("Title is required.");
  if (!excerpt) errors.push("Excerpt is required.");
  if (!markdown) errors.push("Body content is required.");
  if (coverImage && !IMAGE_PATH_RE.test(coverImage)) {
    errors.push("Cover image must be a local path like /assets/images/your-file.jpg.");
  }
  if (!DATE_RE.test(date)) errors.push("Date must use YYYY-MM-DD format.");

  return {
    valid: errors.length === 0,
    errors,
    normalized: {
      title,
      excerpt,
      tags,
      cover_image: coverImage,
      published,
      slug,
      date,
      markdown
    }
  };
};

export const serializePostMarkdown = (
  draft: WriterDraftNormalized,
  includeSlug: boolean,
  includeDate: boolean
): string => {
  const lines = [
    "---",
    `title: ${JSON.stringify(draft.title)}`,
    `excerpt: ${JSON.stringify(draft.excerpt)}`,
    `tags: [${draft.tags.map((tag) => JSON.stringify(tag)).join(", ")}]`,
    `cover_image: ${JSON.stringify(draft.cover_image)}`,
    `published: ${draft.published ? "true" : "false"}`
  ];

  if (includeSlug) lines.push(`slug: ${JSON.stringify(draft.slug)}`);
  if (includeDate) lines.push(`date: ${JSON.stringify(draft.date)}`);

  lines.push("---", "", draft.markdown.trim(), "");
  return lines.join("\n");
};

export const resolveUniquePostFile = (
  postsDir: string,
  date: string,
  slug: string
): { filePath: string; fileName: string; slug: string } => {
  const baseSlug = slugify(slug);
  let suffix = 0;

  while (true) {
    const resolvedSlug = suffix === 0 ? baseSlug : `${baseSlug}-${suffix + 1}`;
    const fileName = `${date}-${resolvedSlug}.md`;
    const filePath = path.join(postsDir, fileName);
    if (!existsSync(filePath)) {
      return { filePath, fileName, slug: resolvedSlug };
    }
    suffix += 1;
  }
};
