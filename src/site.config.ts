import siteData from "./data/site.json";

export const siteConfig = {
  ...siteData,
  nav: [
    { href: "/", label: "首页" },
    { href: "/blog", label: "花园" },
    { href: "/archive", label: "归档" },
    { href: "/tags", label: "标签" },
    { href: "/search", label: "搜索" },
    { href: "/about", label: "关于" }
  ]
};
