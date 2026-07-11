# Project Instructions

## Project

- Name: Qianye Blog
- Stack: Astro 5, TypeScript, Node.js, Cloudflare Pages
- Package manager: pnpm through Corepack
- Source of truth: this repository root

## Structure

- `src/`: visitor-facing Astro site and content
- `public/`: static assets and CMS entry files
- `functions/`: Cloudflare Pages Functions for OAuth
- `docs/`: product, architecture, and content contracts
- `src/generated/`: build-generated media metadata; never edit manually
- `.tools/`: reproducible verification utilities

## Constraints

- The visitor site is static and deploys from `main` to Cloudflare Pages.
- Decap CMS at `/admin` is the only editor; Cloudflare Pages Functions provide GitHub OAuth.
- Never ship credentials, OAuth state, generated media, or local environment data.
- Use `corepack pnpm` for commands. Run `check` and `test` before publishing.
- Keep all public UI copy in Chinese; keep code, comments, and project documentation in English.
