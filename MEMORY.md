# Project Memory

## Architecture

- Cloudflare Pages deploys the static Astro visitor site from the `main` branch.
- `https://qianyeblog.pages.dev` is the configured production URL.
- The local admin service is intentionally not deployed publicly.

## Maintenance

- The repository root is the only supported working directory.
- Runtime credentials and admin state are local-only and ignored by Git.
- Use `corepack pnpm` because pnpm is not installed globally on this machine.
