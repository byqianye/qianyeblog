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
- `server/`: localhost-only editorial admin service
- `.tools/`: reproducible verification utilities

## Constraints

- The visitor site is static and deploys from `main` to Cloudflare Pages.
- The admin service must bind only to localhost and must never ship credentials, session data, or generated local state.
- Use `corepack pnpm` for commands. Run `check` and `test` before publishing.
- Keep all public UI copy in Chinese; keep code, comments, and project documentation in English.
