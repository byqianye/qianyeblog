# Deployment

Cloudflare Pages deploys this Astro site from GitHub.

- Project: `qianyeblog`
- Production branch: `main`
- Build command: `corepack pnpm build`
- Output directory: `dist`
- Production URL: `https://qianyeblog.pages.dev`

Every non-production branch produces a Preview deployment. Validate the Preview URL before merging to `main`.

## CMS

Decap CMS at `/admin` is the only editor and uses GitHub editorial workflow. Configure `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and `SITE_URL` as Cloudflare Pages secrets/variables. Never commit their values.

## Content publishing

1. Sign in at `/admin`.
2. Create or edit an entry and submit it to editorial workflow.
3. Review and publish the generated pull request.
4. Cloudflare Pages rebuilds after the change reaches `main`.
