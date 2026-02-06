import type { SiteMeta } from "../../site.config";
import { renderTemplate } from "./render";
import type { Artwork, PageMeta, Post, HomeMeta } from "./content";

export type Route = {
  path: string;
  html: string;
};

const absoluteUrl = (site: SiteMeta, routePath: string): string => {
  const withBase = `${site.basePath.replace(/\/$/, "")}${routePath}`.replace(/\/+/g, "/");
  return `${site.url}${withBase}`;
};

const xmlEscape = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const withLeadingSlash = (value: string): string => (value.startsWith("/") ? value : `/${value}`);

const buildRss = (site: SiteMeta, posts: Post[]): string => {
  const items = posts
    .slice(0, 20)
    .map(
      (post) => `<item>
<title>${xmlEscape(post.title)}</title>
<link>${xmlEscape(absoluteUrl(site, post.url))}</link>
<guid>${xmlEscape(absoluteUrl(site, post.url))}</guid>
<pubDate>${new Date(post.updated ?? post.date).toUTCString()}</pubDate>
<description>${xmlEscape(post.excerpt)}</description>
</item>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${xmlEscape(site.title)}</title>
<link>${xmlEscape(site.url)}</link>
<description>${xmlEscape(site.description)}</description>
<atom:link href="${xmlEscape(absoluteUrl(site, "/feed.xml"))}" rel="self" type="application/rss+xml" />
${items}
</channel>
</rss>`;
};

const buildSitemap = (site: SiteMeta, routes: Array<{ path: string; lastmod?: string }>): string => {
  const urls = routes
    .map(
      (route) =>
        `<url><loc>${xmlEscape(absoluteUrl(site, route.path))}</loc>${
          route.lastmod ? `<lastmod>${xmlEscape(route.lastmod)}</lastmod>` : ""
        }</url>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
};

export function createRoutes(input: {
  site: SiteMeta;
  home: HomeMeta;
  pages: Record<string, PageMeta>;
  posts: Post[];
  artworks: Artwork[];
}): Route[] {
  const { site, home, pages, posts, artworks } = input;
  const featuredPost = posts[0] ?? null;
  const secondaryPosts = posts.slice(1, 3);
  const featuredArt = artworks[0] ?? null;
  const secondaryArt = artworks.slice(1, 4);
  const artTags = Array.from(new Set(artworks.flatMap((artwork) => artwork.tags))).sort((a, b) =>
    a.localeCompare(b)
  );

  const routes: Route[] = [
    {
      path: "/",
      html: renderTemplate("home", site, {
        pageTitle: home.title,
        pageDescription: site.description,
        canonicalPath: "/",
        socialImage: featuredArt?.cover_image || undefined,
        ogType: "website",
        home,
        featuredPost,
        secondaryPosts,
        featuredArt,
        secondaryArt
      })
    },
    {
      path: "/blog/",
      html: renderTemplate("blog-index", site, {
        pageTitle: "Blog",
        pageDescription: "Essays on art, process, and attention.",
        canonicalPath: "/blog/",
        socialImage: posts[0]?.cover_image || undefined,
        ogType: "website",
        leadPost: posts[0] ?? null,
        otherPosts: posts.slice(1)
      })
    },
    {
      path: "/art/",
      html: renderTemplate("art-index", site, {
        pageTitle: "Art",
        pageDescription: "Selected visual works and process notes.",
        canonicalPath: "/art/",
        socialImage: artworks[0]?.cover_image || undefined,
        ogType: "website",
        artTags,
        artworks
      })
    }
  ];

  for (const post of posts) {
    routes.push({
      path: post.url,
      html: renderTemplate("post", site, {
        pageTitle: post.title,
        pageDescription: post.excerpt || site.description,
        canonicalPath: post.url,
        socialImage: post.cover_image || undefined,
        ogType: "article",
        post
      })
    });
  }

  for (const artwork of artworks) {
    routes.push({
      path: artwork.url,
      html: renderTemplate("artwork", site, {
        pageTitle: artwork.title,
        pageDescription: `${artwork.medium} · ${artwork.dimensions}`,
        canonicalPath: artwork.url,
        socialImage: artwork.cover_image || undefined,
        ogType: "article",
        artwork
      })
    });
  }

  for (const page of Object.values(pages)) {
    routes.push({
      path: page.permalink,
      html: renderTemplate("page", site, {
        pageTitle: page.meta_title || page.title,
        pageDescription: page.meta_description || page.intro || site.description,
        canonicalPath: page.canonical_path || page.permalink,
        socialImage: page.social_image || undefined,
        ogType: "website",
        page
      })
    });
  }

  routes.push({
    path: "/404.html",
    html: renderTemplate("not-found", site, {
      pageTitle: "404",
      pageDescription: "Page not found",
      canonicalPath: "/404.html",
      ogType: "website"
    })
  });

  const indexablePaths = routes
    .map((route) => route.path)
    .filter((routePath) => routePath !== "/404.html");
  const sitemapEntries = indexablePaths.map((routePath) => {
    const matchedPost = posts.find((post) => post.url === routePath);
    if (matchedPost) {
      return { path: routePath, lastmod: matchedPost.updated ?? matchedPost.date };
    }

    const matchedArtwork = artworks.find((artwork) => artwork.url === routePath);
    if (matchedArtwork) {
      return { path: routePath, lastmod: matchedArtwork.updated ?? matchedArtwork.date };
    }

    return { path: withLeadingSlash(routePath) };
  });

  routes.push({ path: "/feed.xml", html: buildRss(site, posts) });
  routes.push({ path: "/sitemap.xml", html: buildSitemap(site, sitemapEntries) });

  return routes;
}
