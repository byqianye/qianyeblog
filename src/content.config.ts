import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const blog = defineCollection({
  loader: glob({ base: "./src/content/blog", pattern: "**/*.md" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    category: z.string().default("随心分享"),
    tags: z.array(z.string()).default([]),
    cover: z.string().default("/images/covers/morning-notes.png"),
    draft: z.boolean().default(false)
  })
});

export const collections = { blog };
