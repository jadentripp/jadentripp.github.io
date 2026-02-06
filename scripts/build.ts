import path from "node:path";
import { rm, mkdir, writeFile, cp } from "node:fs/promises";
import { createRoutes } from "./lib/routes";
import { loadArtworks, loadHomeMeta, loadPages, loadPosts } from "./lib/content";
import { site } from "../site.config";

const distDir = path.join(process.cwd(), "dist");

function routeToFilePath(routePath: string): string {
  if (routePath.endsWith(".xml") || routePath.endsWith(".html")) {
    return path.join(distDir, routePath.replace(/^\//, ""));
  }

  if (routePath === "/") {
    return path.join(distDir, "index.html");
  }

  return path.join(distDir, routePath.replace(/^\//, ""), "index.html");
}

async function writeRoutes() {
  const [posts, artworks, pages, home] = await Promise.all([
    loadPosts(),
    loadArtworks(),
    loadPages(),
    loadHomeMeta()
  ]);

  const routes = createRoutes({ site, posts, artworks, pages, home });

  await Promise.all(
    routes.map(async (route) => {
      const targetPath = routeToFilePath(route.path);
      await mkdir(path.dirname(targetPath), { recursive: true });
      await writeFile(targetPath, route.html, "utf8");
    })
  );

  return routes.length;
}

async function copyAssets() {
  const srcAssets = path.join(process.cwd(), "assets");
  const dstAssets = path.join(distDir, "assets");
  await cp(srcAssets, dstAssets, { recursive: true });
}

async function main() {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });

  const routeCount = await writeRoutes();
  await copyAssets();

  console.log(`Built ${routeCount} routes into dist/`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
