import path from "node:path";
import { existsSync, statSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import chokidar from "chokidar";
import type { ServerWebSocket } from "bun";
import { marked } from "marked";
import {
  resolveUniquePostFile,
  serializePostMarkdown,
  slugify,
  validateDraft,
  type WriterDraftInput
} from "./lib/writer";

const distDir = path.join(process.cwd(), "dist");
const port = Number(process.env.PORT || 4173);
const liveReloadPath = "/__live-reload";
const clients = new Set<ServerWebSocket<unknown>>();
const writerEnabled = process.env.NODE_ENV !== "production" && process.env.ENABLE_WRITER !== "false";

marked.setOptions({ gfm: true, breaks: false });

const liveReloadSnippet = `
<script>
(() => {
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  const socket = new WebSocket(protocol + "://" + location.host + "${liveReloadPath}");
  socket.addEventListener("message", (event) => {
    if (event.data === "reload") location.reload();
  });
})();
</script>
`;

const build = async () => {
  const proc = Bun.spawn(["bun", "run", "scripts/build.ts"], {
    env: {
      ...process.env,
      LOCAL_DEV: writerEnabled ? "true" : "false"
    },
    stdout: "inherit",
    stderr: "inherit"
  });
  const code = await proc.exited;
  if (code !== 0) {
    console.error("Build failed.");
  }
};

const mimeType = (filePath: string): string => {
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".xml")) return "application/xml; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg";
  if (filePath.endsWith(".webp")) return "image/webp";
  if (filePath.endsWith(".gif")) return "image/gif";
  return "text/html; charset=utf-8";
};

const resolvePath = (pathname: string): string => {
  if (pathname === "/") return path.join(distDir, "index.html");
  if (pathname.endsWith(".xml") || pathname.endsWith(".html")) {
    return path.join(distDir, pathname.slice(1));
  }

  const direct = path.join(distDir, pathname.slice(1));
  if (existsSync(direct) && statSync(direct).isFile()) return direct;

  const indexFile = path.join(direct, "index.html");
  return existsSync(indexFile) ? indexFile : path.join(distDir, "404.html");
};

const notFound = () => new Response("Not found", { status: 404 });

const jsonResponse = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8"
    }
  });

const htmlResponseWithReload = async (filePath: string) => {
  const html = await Bun.file(filePath).text();
  const bodyClosed = html.includes("</body>");
  const withReload = bodyClosed
    ? html.replace("</body>", `${liveReloadSnippet}</body>`)
    : `${html}${liveReloadSnippet}`;

  return new Response(withReload, {
    headers: {
      "content-type": "text/html; charset=utf-8"
    }
  });
};

const parseJsonBody = async (req: Request): Promise<Record<string, unknown>> => {
  const body = (await req.json()) as Record<string, unknown>;
  return body || {};
};

const uniqueImagePath = (imagesDir: string, originalName: string): { disk: string; web: string } => {
  const parsed = path.parse(originalName || "image");
  const ext = (parsed.ext || "").toLowerCase();
  const safeBase = slugify(parsed.name || "image");
  let counter = 0;

  while (true) {
    const fileName = counter === 0 ? `${safeBase}${ext}` : `${safeBase}-${counter + 1}${ext}`;
    const disk = path.join(imagesDir, fileName);
    if (!existsSync(disk)) {
      return { disk, web: `/assets/images/${fileName}` };
    }
    counter += 1;
  }
};

const handleWriterPreview = async (req: Request) => {
  const body = await parseJsonBody(req);
  const markdown = typeof body.markdown === "string" ? body.markdown : "";
  const html = await marked.parse(markdown);
  return jsonResponse(200, { html });
};

const handleWriterValidate = async (req: Request) => {
  const body = (await parseJsonBody(req)) as WriterDraftInput;
  const result = validateDraft(body);
  return jsonResponse(200, {
    valid: result.valid,
    errors: result.errors,
    normalized: {
      slug: result.normalized.slug,
      date: result.normalized.date,
      tags: result.normalized.tags
    }
  });
};

const handleWriterUpload = async (req: Request) => {
  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return jsonResponse(400, { error: "No file was uploaded." });
  }

  const allowed = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"]);
  const extension = path.extname(file.name || "").toLowerCase();
  if (!allowed.has(extension)) {
    return jsonResponse(400, { error: "Unsupported image format." });
  }

  const imagesDir = path.join(process.cwd(), "assets/images");
  await mkdir(imagesDir, { recursive: true });

  const filePath = uniqueImagePath(imagesDir, file.name || `image${extension}`);
  const arrayBuffer = await file.arrayBuffer();
  await writeFile(filePath.disk, Buffer.from(arrayBuffer));

  return jsonResponse(200, { path: filePath.web });
};

const handleWriterPublish = async (req: Request) => {
  const body = (await parseJsonBody(req)) as WriterDraftInput;
  const result = validateDraft(body);

  if (!result.valid) {
    return jsonResponse(400, {
      ok: false,
      errors: result.errors,
      normalized: {
        slug: result.normalized.slug,
        date: result.normalized.date,
        tags: result.normalized.tags
      }
    });
  }

  const postsDir = path.join(process.cwd(), "content/posts");
  await mkdir(postsDir, { recursive: true });

  const titleSlug = slugify(result.normalized.title);
  const resolved = resolveUniquePostFile(postsDir, result.normalized.date, result.normalized.slug);
  const finalDraft = {
    ...result.normalized,
    slug: resolved.slug
  };

  const includeSlug = finalDraft.slug !== titleSlug;
  const markdown = serializePostMarkdown(finalDraft, includeSlug, false);
  await writeFile(resolved.filePath, markdown, "utf8");

  return jsonResponse(200, {
    ok: true,
    file: `content/posts/${resolved.fileName}`,
    url: `/blog/${finalDraft.slug}/`,
    slug: finalDraft.slug,
    date: finalDraft.date
  });
};

await build();

const server = Bun.serve({
  port,
  websocket: {
    open(ws) {
      clients.add(ws);
    },
    message() {
      // No client-originated messages are needed for live reload.
    },
    close(ws) {
      clients.delete(ws);
    }
  },
  async fetch(req: Request) {
    const url = new URL(req.url);

    if (url.pathname === liveReloadPath) {
      if (server.upgrade(req)) return;
      return new Response("Upgrade failed", { status: 400 });
    }

    if (url.pathname === "/write") {
      if (!writerEnabled) return notFound();
      const writerPage = path.join(distDir, "assets/write/index.html");
      if (!existsSync(writerPage)) {
        return new Response("Writer UI not found. Run bun run build.", { status: 500 });
      }
      return htmlResponseWithReload(writerPage);
    }

    if (url.pathname.startsWith("/__writer/")) {
      if (!writerEnabled) return notFound();
      if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed." });

      try {
        if (url.pathname === "/__writer/preview") return await handleWriterPreview(req);
        if (url.pathname === "/__writer/validate") return await handleWriterValidate(req);
        if (url.pathname === "/__writer/upload-image") return await handleWriterUpload(req);
        if (url.pathname === "/__writer/publish") return await handleWriterPublish(req);
        return notFound();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown writer error.";
        return jsonResponse(500, { error: message });
      }
    }

    const filePath = resolvePath(url.pathname);

    if (!existsSync(filePath)) {
      return notFound();
    }

    const contentType = mimeType(filePath);
    if (contentType.startsWith("text/html")) {
      return htmlResponseWithReload(filePath);
    }

    return new Response(Bun.file(filePath), {
      headers: {
        "content-type": contentType
      }
    });
  }
});

const watcher = chokidar.watch(["src/templates", "scripts", "content", "assets", "site.config.ts"], {
  ignoreInitial: true
});

let rebuilding = false;
let queued = false;

const notifyReload = () => {
  for (const client of clients) {
    client.send("reload");
  }
};

const rebuildAndNotify = async () => {
  if (rebuilding) {
    queued = true;
    return;
  }

  rebuilding = true;
  try {
    await build();
    notifyReload();
  } finally {
    rebuilding = false;
    if (queued) {
      queued = false;
      await rebuildAndNotify();
    }
  }
};

watcher.on("all", async () => {
  await rebuildAndNotify();
});

console.log(`Dev server running on http://localhost:${port} (live reload enabled)`);
