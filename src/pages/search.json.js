import { getAllPosts } from "../lib/content";

function cleanText(value = "") {
  return String(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function GET() {
  const posts = await getAllPosts();

  return new Response(
    JSON.stringify(
      posts.map((post) => ({
        title: post.data.title,
        description: post.data.description,
        category: post.data.category,
        tags: post.data.tags,
        pubDate: post.data.pubDate.toISOString(),
        url: `/blog/${post.id}`,
        body: cleanText(post.body).slice(0, 1200)
      }))
    ),
    {
      headers: {
        "content-type": "application/json; charset=utf-8"
      }
    }
  );
}
