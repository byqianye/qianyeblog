import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { siteConfig } from "../site.config";

export async function GET(context) {
  const posts = await getCollection("blog", ({ data }) => !data.draft);
  const sortedPosts = posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

  return rss({
    title: siteConfig.title,
    description: siteConfig.description,
    site: context.site ?? siteConfig.url,
    items: sortedPosts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: `/blog/${post.id}`
    }))
  });
}
