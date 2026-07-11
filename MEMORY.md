# Project Memory

## Architecture

- Cloudflare Pages deploys the static Astro visitor site from `main` and branch previews from feature branches.
- `https://qianyeblog.pages.dev` is the configured production URL.
- Decap CMS at `/admin` is the only supported editor and uses editorial workflow.
- The `blog` collection is a unified garden model with `article`, `note`, and `resource` kinds.
- `src/lib/garden.ts` owns public content queries; media metadata is generated at build time and consumed through `src/lib/media.ts`.
- `ParticleField.astro` is the single owner of the decorative Canvas effect; it must stay dependency-free, respect reduced motion, and pause while the page is hidden.

## Maintenance

- The repository root is the only supported working directory.
- OAuth secrets and local environment files are never committed.
- Original media is committed; generated WebP variants and the media manifest are ignored and recreated by project scripts.
- Use `corepack pnpm` because pnpm is not installed globally on this machine.
