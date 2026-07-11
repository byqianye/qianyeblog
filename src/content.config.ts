import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const blog = defineCollection({
  loader: glob({ base: "./src/content/blog", pattern: "**/*.md" }),
  schema: z.object({
    kind: z.enum(["article", "note", "resource"]),
    title: z.string().min(1),
    description: z.string().min(1),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    cover: z.string().optional(),
    coverAlt: z.string().optional(),
    externalUrl: z.string().url().optional(),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false)
  }).superRefine((entry, context) => {
    if (entry.kind === "resource" && !entry.externalUrl) {
      context.addIssue({ code: "custom", path: ["externalUrl"], message: "Resources require a valid externalUrl." });
    }
  })
});

export const collections = { blog };
