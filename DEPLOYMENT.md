# Cloudflare Pages 部署说明

这个项目是 Astro 静态博客，线上只部署访客站；本地 Node 后台继续只在本机使用，不暴露到公网。

## Cloudflare Pages 设置

- Project name: `qianyeblog`
- Production branch: `main`
- Framework preset: `Astro`
- Build command: `pnpm build`
- Build output directory: `dist`
- Root directory: 项目根目录

当前默认站点地址配置为：

```txt
https://qianyeblog.pages.dev
```

如果 Cloudflare Pages 分配了不同域名，或以后绑定自定义域名，需要同步修改：

- `astro.config.mjs` 里的 `site`
- `src/site.config.ts` 里的 `url`

如果 Cloudflare 构建环境的 Node 版本不兼容，可以在 Pages 的环境变量里添加：

```txt
NODE_VERSION=20
```

## 更新内容流程

1. 本地运行后台，编辑文章或首页配置。
2. 本地运行 `pnpm build`，确认构建通过。
3. 提交并推送到 GitHub。
4. Cloudflare Pages 会自动重新部署线上访客站。

后台服务不部署到公网；线上内容以仓库里的 `src/`、`public/` 和配置文件为准。
