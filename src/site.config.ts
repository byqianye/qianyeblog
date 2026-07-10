import siteData from "./data/site.json";

const email = siteData.email?.trim() || "";

export const siteConfig = {
  title: siteData.title || "浅靥",
  author: siteData.author || "林间未名",
  description: siteData.description || "一处安静的中文个人博客，记录日常、阅读、散步和生活里偶然亮起来的句子。",
  url: siteData.url || "https://qianyeblog.pages.dev",
  email,
  brandMark: siteData.brandMark || "浅",
  favicon: siteData.favicon || "/favicon.svg",
  nav: [
    { href: "/", label: siteData.navHomeLabel || "首页" },
    { href: "/blog", label: siteData.navBlogLabel || "文章" },
    { href: "/archive", label: siteData.navArchiveLabel || "归档" },
    { href: "/tags", label: siteData.navTagsLabel || "标签" },
    { href: "/search", label: siteData.navSearchLabel || "搜索" },
    { href: "/about", label: siteData.navAboutLabel || "关于" }
  ],
  social: [
    ...(email ? [{ href: `mailto:${email}`, label: siteData.socialEmailLabel || "Email" }] : []),
    { href: "/rss.xml", label: siteData.socialRssLabel || "RSS" }
  ]
};
