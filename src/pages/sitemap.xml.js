import { getAllPosts, getAllTags } from "../lib/content";
import { siteConfig } from "../site.config";

function urlEntry(url, changefreq = "weekly", priority = "0.7") {
  return `  <url><loc>${url}</loc><changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`;
}

export async function GET() {
  const siteUrl = siteConfig.url.replace(/\/$/, "");
  const posts = await getAllPosts();
  const tags = await getAllTags();
  const staticPaths = ["/", "/blog", "/archive", "/tags", "/search", "/about"];
  const urls = [
    ...staticPaths.map((path) => urlEntry(`${siteUrl}${path}`, path === "/" ? "daily" : "weekly", path === "/" ? "1.0" : "0.7")),
    ...posts.map((post) => urlEntry(`${siteUrl}/blog/${post.id}`, "monthly", "0.8")),
    ...tags.map(({ tag }) => urlEntry(`${siteUrl}/tags/${encodeURIComponent(tag)}`, "weekly", "0.6"))
  ];

  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`, {
    headers: {
      "content-type": "application/xml; charset=utf-8"
    }
  });
}
