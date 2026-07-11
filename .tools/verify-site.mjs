import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const port = 4322;
const base = `http://127.0.0.1:${port}`;
const artifacts = join(root, "artifacts");
const server = spawn(process.execPath, [join(root, "node_modules", "astro", "astro.js"), "preview", "--host", "127.0.0.1", "--port", String(port)], { cwd: root, env: { ...process.env, ASTRO_TELEMETRY_DISABLED: "1" }, stdio: ["ignore", "pipe", "pipe"] });
let logs = "";
server.stdout.on("data", (data) => (logs += data));
server.stderr.on("data", (data) => (logs += data));

const expect = (value, message) => { if (!value) throw new Error(message); };
async function ready() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try { if ((await fetch(base)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(logs);
}

try {
  await ready();
  await mkdir(artifacts, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const viewports = [{ name: "desktop", width: 1440, height: 1000 }, { name: "tablet", width: 768, height: 900 }, { name: "mobile", width: 390, height: 844 }];
  const visualRoutes = ["/", "/blog/", "/archive/", "/tags/", "/search/", "/about/", "/blog/browser-notes/"];

  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const path of visualRoutes) {
      const response = await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
      expect(response?.ok(), `${viewport.name} ${path} failed`);
      expect(!await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), `${viewport.name} ${path} overflows`);
      expect(await page.evaluate(() => [...document.images].every((image) => image.complete && image.naturalWidth > 0 && image.hasAttribute("width") && image.hasAttribute("height"))), `${viewport.name} ${path} has unstable images`);
    }
    await page.goto(base, { waitUntil: "networkidle" });
    expect((await page.title()).includes("浅靥"), "Homepage title must include site name");
    expect(await page.locator("h1").count() === 1, "Homepage must have one H1");
    await page.keyboard.press("Tab");
    expect(await page.locator(".skip-link").evaluate((link) => link === document.activeElement), "Skip link must be the first keyboard target");
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior === "auto"), "Reduced motion must disable smooth scrolling");
    if (viewport.name === "mobile") {
      await page.locator(".mobile-nav summary").click();
      expect(await page.locator(".mobile-nav nav").isVisible(), "Mobile navigation must open");
      const targets = await page.locator("button, summary").evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height));
      expect(targets.every((height) => height >= 40), "Mobile controls must have 40px touch targets");
    }
    await page.screenshot({ path: join(artifacts, `home-${viewport.name}.png`), fullPage: true });
    await page.close();
  }

  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`${base}/blog/browser-notes/`, { waitUntil: "networkidle" });
  expect(await page.locator(".post-aside nav a").count() >= 2, "Desktop article must expose its table of contents");
  const cover = await page.locator(".post-cover img").boundingBox();
  expect(cover && Math.abs(cover.width / cover.height - 16 / 9) < 0.05, "Article cover must remain 16:9");
  await page.goto(`${base}/blog/`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /资源/ }).click();
  expect(await page.locator(".entry:not([hidden])").count() === 2, "Resource filter must show both migrated entries");
  await page.goto(`${base}/search/`, { waitUntil: "networkidle" });
  await page.locator("#search").fill("浏览器");
  expect(await page.locator(".results article").count() === 1, "Search should find the browser resource");

  for (const path of ["/404.html", "/rss.xml", "/sitemap.xml", "/search.json", "/admin/"]) {
    const response = await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
    expect(response?.ok(), `${path} failed`);
  }
  const search = await (await fetch(`${base}/search.json`)).json();
  expect(search.every((item) => item.title && item.description && item.url && item.kind && Array.isArray(item.tags)), "Search contract is incomplete");
  await browser.close();
  console.log(JSON.stringify({ ok: true, checks: ["1440", "768", "390", "keyboard", "touch", "reduced-motion", "filters", "search", "TOC", "16:9 media", "legacy slugs", "CMS", "RSS", "sitemap"] }));
} finally {
  server.kill();
}
