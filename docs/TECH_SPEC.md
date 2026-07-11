# Swiss Digital Garden Technical Specification

## Modules

### Garden content

`src/lib/garden.ts` owns public entry loading, chronological sorting, kind and tag filtering, tag aggregation, related-entry scoring, and previous/next resolution. Components receive complete collection entries rather than reconstructed view models.

### Media

`.tools/build-media.mjs` scans original raster assets and writes 480, 960, and 1440 pixel WebP variants plus `src/generated/media-manifest.json`. `src/lib/media.ts` exposes one lookup function returning dimensions, fallback, and `srcset`. Generated output is ignored and recreated before Astro commands.

### Presentation

`src/styles/global.css` contains tokens, reset, document primitives, and shared layout utilities. Astro components own their local styles. No automatic dark theme is maintained.

## Build

- `predev`, `precheck`, and `prebuild` run the media task.
- Astro statically generates all pages.
- Tests use Node's test runner for pure contracts and Playwright for rendered behavior.

## Security

- `/api/auth` creates a cryptographically random OAuth state and stores it in a short-lived HttpOnly, SameSite=Lax, Secure cookie.
- `/api/callback` requires a constant-time state match, clears the cookie, exchanges the code, and posts only to the configured site origin.
- Missing configuration and upstream failures return a consistent HTML error document without exposing secrets.
- The former localhost admin service and all authentication state are removed.

## Deployment

Cloudflare Pages uses `corepack pnpm build` and publishes `dist`. GitHub OAuth Functions remain under `functions/api`. Branch deployments are validated before production approval.
