import rss from "@astrojs/rss";
import { getGardenEntries } from "../lib/garden";
import { siteConfig } from "../site.config";

export async function GET(context) {
  const sortedPosts = await getGardenEntries();

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
