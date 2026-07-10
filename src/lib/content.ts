import { getCollection, type CollectionEntry } from "astro:content";

type BlogPost = CollectionEntry<"blog">;
type ScoredPost = { post: BlogPost; score: number };

export async function getAllPosts() {
  const posts = await getCollection("blog", ({ data }) => !data.draft);
  return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

export async function getAllTags() {
  const posts = await getAllPosts();
  const counts = new Map<string, number>();

  for (const post of posts) {
    for (const tag of post.data.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => a.tag.localeCompare(b.tag, "zh-Hans-CN"));
}

export function getRelatedPosts(currentPost: BlogPost, posts: BlogPost[], limit = 3): BlogPost[] {
  const currentTags = new Set(currentPost.data.tags ?? []);
  const currentCategory = currentPost.data.category ?? "";

  return posts
    .filter((post) => post.id !== currentPost.id)
    .map((post): ScoredPost => {
      const sharedTags = (post.data.tags ?? []).filter((tag) => currentTags.has(tag)).length;
      const sameCategory = currentCategory && post.data.category === currentCategory ? 1 : 0;

      return {
        post,
        score: sharedTags * 2 + sameCategory
      };
    })
    .filter(({ score }: ScoredPost) => score > 0)
    .sort((a, b) => b.score - a.score || b.post.data.pubDate.valueOf() - a.post.data.pubDate.valueOf())
    .slice(0, limit)
    .map(({ post }: ScoredPost) => post);
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(date);
}

export function getReadingMinutes(body = "", template = "{minutes} 分钟读完") {
  const text = body.replace(/<[^>]+>/g, "").trim();
  const chineseChars = text.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
  const latinWords = text.match(/[A-Za-z0-9]+/g)?.length ?? 0;
  const minutes = Math.max(1, Math.ceil((chineseChars + latinWords * 2) / 500));

  return template.replaceAll("{minutes}", String(minutes));
}
