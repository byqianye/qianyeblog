import { getGardenEntries, getGardenTags } from "../lib/garden";
import { siteConfig } from "../site.config";

function urlEntry(url, { changefreq = "weekly", priority = "0.7", lastmod } = {}) {
  const updated = lastmod ? `<lastmod>${lastmod.toISOString().slice(0, 10)}</lastmod>` : "";
  return `  <url><loc>${url}</loc>${updated}<changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`;
}

export async function GET() {
  const siteUrl = siteConfig.url.replace(/\/$/, "");
  const posts = await getGardenEntries();
  const tags = await getGardenTags();
  const staticPaths = ["/", "/blog", "/archive", "/tags", "/search", "/about"];
  const urls = [
    ...staticPaths.map((path) => urlEntry(`${siteUrl}${path}`, { changefreq: path === "/" ? "daily" : "weekly", priority: path === "/" ? "1.0" : "0.7" })),
    ...posts.map((post) => urlEntry(`${siteUrl}/blog/${post.id}`, { changefreq: "monthly", priority: "0.8", lastmod: post.data.updatedDate ?? post.data.pubDate })),
    ...tags.map(({ tag }) => urlEntry(`${siteUrl}/tags/${encodeURIComponent(tag)}`, { changefreq: "weekly", priority: "0.6" }))
  ];

  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`, {
    headers: {
      "content-type": "application/xml; charset=utf-8"
    }
  });
}
