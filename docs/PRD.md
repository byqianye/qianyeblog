# Interactive Digital Garden PRD

## Objective

Transform Qianye Blog into an immersive retro-futuristic personal digital garden inspired by lightweight HTML5 Canvas experiments while preserving all published content, slugs, `/blog` routes, RSS, and sitemap compatibility.

## Audience and Jobs

- Readers scan recent writing, notes, and useful resources.
- Readers browse by content kind or tag and search the complete public collection.
- Qianye edits content through Decap CMS at `/admin` with editorial workflow.

## Experience Requirements

- Use a deep navy surface, system monospace typography, cyan and magenta signals, hairline rules, and restrained scanlines.
- Use a site-wide dependency-free particle field, oversized dates, and sequence numbers as the primary visual motif.
- Pointer interaction remains decorative, never blocks reading or navigation, and degrades to a static frame for reduced motion.
- Provide an immersive but bounded homepage hero followed by compact sections for featured entries, recent entries, kinds, and tags.
- Use `nebula.html` as the primary motion reference: slow orbital particles, restrained pointer parallax, and luminous depth without copying its implementation.
- Provide a stable article measure, 16:9 cover, desktop table of contents, and previous/next navigation.
- Support 1440 px, 768 px, and 390 px layouts without horizontal overflow or Canvas-driven layout shift.
- Meet keyboard, focus, contrast, touch-target, reduced-motion, and skip-navigation requirements.

## Content Requirements

- Keep a single `blog` collection with `article`, `note`, and `resource` kinds.
- Preserve existing slugs and migrate existing entries to resources with valid external URLs.
- Exclude drafts from every public output.
- Keep search JSON backward compatible while adding kind, tags, and external URL.

## Publishing Requirements

- Decap CMS is the only editor.
- Cloudflare Pages deploys `main` to production and feature branches to previews.
- This change ships first on `codex/swiss-digital-garden`; it must not merge to `main` without explicit approval.

## Acceptance Criteria

- Type checking, production build, content contract tests, OAuth tests, and browser tests pass.
- Public pages, RSS, sitemap, search JSON, legacy slugs, and CMS configuration are verified.
- Preview deployment is checked on desktop and mobile before handoff.
