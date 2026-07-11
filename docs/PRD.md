# Swiss Digital Garden PRD

## Objective

Transform Qianye Blog into a light-only Swiss editorial personal digital garden while preserving all published content, slugs, `/blog` routes, RSS, and sitemap compatibility.

## Audience and Jobs

- Readers scan recent writing, notes, and useful resources.
- Readers browse by content kind or tag and search the complete public collection.
- Qianye edits content through Decap CMS at `/admin` with editorial workflow.

## Experience Requirements

- Use a white and light-gray grid, black sans-serif typography, hairline rules, and International Orange (`#ff4f00`) as the only accent.
- Use oversized dates and sequence numbers as the primary visual motif.
- Provide compact asymmetric homepage sections for positioning, featured entries, recent entries, kinds, and tags.
- Provide a stable article measure, 16:9 cover, desktop table of contents, and previous/next navigation.
- Support 1440 px, 768 px, and 390 px layouts without horizontal overflow.
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
